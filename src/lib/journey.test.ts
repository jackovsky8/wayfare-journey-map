import { describe, expect, it } from "vitest";
import {
  buildGpx,
  composeJourneyRoute,
  formatDistance,
  moveItem,
  parseGpx,
  straightRoute,
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
});
