import { describe, expect, it } from "vitest";
import {
  buildGpx,
  composeJourneyRoute,
  formatDistance,
  moveItem,
  parseGpx,
  straightRoute,
  splitTrackAtPlace,
} from "./journey";
import type { JourneyItem, Place } from "../types";

const places: Place[] = [
  {
    id: "1",
    type: "place",
    name: "Vienna & home",
    description: "",
    lat: 48.2082,
    lng: 16.3738,
    marker: "pin",
  },
  {
    id: "2",
    type: "place",
    name: "Graz",
    description: "",
    lat: 47.0707,
    lng: 15.4395,
    marker: "dot",
  },
];

describe("journey helpers", () => {
  it("reorders without mutating the input", () => {
    const moved = moveItem(places, 0, 1);
    expect(moved.map((place) => place.name)).toEqual(["Graz", "Vienna & home"]);
    expect(places[0].name).toBe("Vienna & home");
  });
  it("keeps invalid moves unchanged", () =>
    expect(moveItem(places, -1, 1)).toBe(places));
  it("creates a direct route and human distance", () => {
    const route = straightRoute(places);
    expect(route.coordinates).toEqual([
      [16.3738, 48.2082],
      [15.4395, 47.0707],
    ]);
    expect(route.distanceMeters).toBeGreaterThan(140_000);
    expect(formatDistance(route.distanceMeters)).toMatch(/km$/);
  });
  it("exports valid escaped GPX waypoints and track points", () => {
    const gpx = buildGpx(places, straightRoute(places));
    expect(gpx).toContain("Vienna &amp; home");
    expect(gpx.match(/<wpt/g)).toHaveLength(2);
    expect(gpx.match(/<trkpt/g)).toHaveLength(2);
  });

  it("exports optional GPX endpoint places as waypoints", () => {
    const track = {
      id: "track-with-ends",
      type: "track" as const,
      name: "Coastal walk",
      sourceFile: "coast.gpx",
      coordinates: [
        [9, 44],
        [9.2, 44.2],
      ] as [number, number][],
      startPlace: { ...places[0], id: "start", name: "Trail start" },
      endPlace: { ...places[1], id: "end", name: "Trail finish" },
    };
    const gpx = buildGpx([track], {
      coordinates: track.coordinates,
      distanceMeters: 0,
      durationSeconds: 0,
    });
    expect(gpx).toContain("Trail start");
    expect(gpx).toContain("Trail finish");
    expect(gpx.match(/<wpt/g)).toHaveLength(2);
  });

  it("parses track and route points from a GPX file", () => {
    const track = parseGpx(
      `<?xml version="1.0"?><gpx><trk><name>Alpine day</name><trkseg><trkpt lat="47.1" lon="15.1"/><trkpt lat="47.2" lon="15.2"/></trkseg></trk></gpx>`,
      "fallback.gpx",
    );
    expect(track.name).toBe("Alpine day");
    expect(track.coordinates).toEqual([
      [15.1, 47.1],
      [15.2, 47.2],
    ]);
  });

  it("rejects GPX files without a usable line", () => {
    expect(() =>
      parseGpx('<gpx><wpt lat="1" lon="2"/></gpx>', "empty.gpx"),
    ).toThrow(/at least two/i);
  });

  it("keeps imported tracks and connects their endpoints to adjacent places", async () => {
    const track = {
      id: "track",
      type: "track" as const,
      name: "Walk",
      sourceFile: "walk.gpx",
      coordinates: [
        [16, 48],
        [16.1, 48.1],
      ] as [number, number][],
    };
    const items: JourneyItem[] = [places[0], track, places[1]];
    const route = await composeJourneyRoute(items, async (from, to) => ({
      coordinates: [from, to],
      distanceMeters: 10,
      durationSeconds: 5,
    }));
    expect(route.coordinates).toEqual([
      [16.3738, 48.2082],
      [16, 48],
      [16.1, 48.1],
      [15.4395, 47.0707],
    ]);
    expect(route.durationSeconds).toBe(10);
  });

  it("splits a track at the coordinate closest to a selected place", () => {
    const track = {
      id: "track",
      type: "track" as const,
      name: "Walk",
      sourceFile: "walk.gpx",
      coordinates: [
        [16, 48],
        [16.1, 48.1],
        [16.2, 48.2],
        [16.3, 48.3],
      ] as [number, number][],
    };
    const [before, cutPlace, after] = splitTrackAtPlace(track, {
      ...places[0],
      name: "Coffee",
      lng: 16.11,
      lat: 48.11,
    });
    expect(before.coordinates.at(-1)).toEqual([16.1, 48.1]);
    expect(after.coordinates[0]).toEqual([16.1, 48.1]);
    expect([cutPlace.lng, cutPlace.lat]).toEqual([16.1, 48.1]);
  });
});
