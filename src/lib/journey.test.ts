import { describe, expect, it } from "vitest";
import { buildGpx, formatDistance, moveItem, straightRoute } from "./journey";
import type { Place } from "../types";

const places: Place[] = [
  { id: "1", name: "Vienna & home", lat: 48.2082, lng: 16.3738, marker: "pin" },
  { id: "2", name: "Graz", lat: 47.0707, lng: 15.4395, marker: "dot" },
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
});
