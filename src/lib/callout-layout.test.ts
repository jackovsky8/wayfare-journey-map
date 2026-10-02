import { describe, expect, it } from "vitest";
import {
  boxesOverlap,
  boxIntersectsPolyline,
  connectorPath,
  layoutCallouts,
  measureLayout,
  segmentsCross,
} from "./callout-layout";

describe("callout collision layout", () => {
  it("detects overlapping boxes with padding", () => {
    const first = { left: 0, right: 50, top: 0, bottom: 50 };
    expect(
      boxesOverlap(first, { left: 55, right: 90, top: 0, bottom: 50 }),
    ).toBe(false);
    expect(
      boxesOverlap(first, { left: 55, right: 90, top: 0, bottom: 50 }, 8),
    ).toBe(true);
  });

  it("detects a route crossing a callout", () => {
    expect(
      boxIntersectsPolyline({ left: 40, right: 80, top: 40, bottom: 80 }, [
        { x: 0, y: 60 },
        { x: 120, y: 60 },
      ]),
    ).toBe(true);
  });

  it("places callouts without overlap or covering the route", () => {
    const route = [
      { x: 0, y: 70 },
      { x: 300, y: 70 },
    ];
    const placements = layoutCallouts(
      [
        { id: "a", anchor: { x: 120, y: 70 }, width: 90, height: 55 },
        { id: "b", anchor: { x: 135, y: 70 }, width: 90, height: 55 },
      ],
      route,
      { width: 320, height: 260 },
    );
    expect(boxesOverlap(placements[0].box, placements[1].box, 10)).toBe(false);
    expect(boxIntersectsPolyline(placements[0].box, route, 8)).toBe(false);
    expect(boxIntersectsPolyline(placements[1].box, route, 8)).toBe(false);
    expect(
      measureLayout(placements, route, { width: 320, height: 260 }),
    ).toMatchObject({
      overlaps: 0,
      routeIntersections: 0,
      connectorCrossings: 0,
      connectorBoxIntersections: 0,
    });
  });

  it("detects crossed connectors", () => {
    expect(
      segmentsCross(
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ),
    ).toBe(true);
  });

  it("optimizes a dense group as one layout", () => {
    const placements = layoutCallouts(
      [
        { id: "a", anchor: { x: 145, y: 145 }, width: 92, height: 60 },
        { id: "b", anchor: { x: 160, y: 145 }, width: 92, height: 60 },
        { id: "c", anchor: { x: 145, y: 160 }, width: 92, height: 60 },
        { id: "d", anchor: { x: 160, y: 160 }, width: 92, height: 60 },
      ],
      [
        { x: 20, y: 152 },
        { x: 300, y: 152 },
      ],
      { width: 320, height: 320 },
    );
    const metrics = measureLayout(
      placements,
      [
        { x: 20, y: 152 },
        { x: 300, y: 152 },
      ],
      { width: 320, height: 320 },
    );
    expect(metrics.overlaps).toBe(0);
    expect(metrics.connectorCrossings).toBe(0);
    expect(metrics.connectorBoxIntersections).toBe(0);
  });

  it("keeps a free callout immediately beside its place and joins its edge", () => {
    const [placement] = layoutCallouts(
      [
        {
          id: "near",
          anchor: { x: 150, y: 150 },
          width: 80,
          height: 40,
        },
      ],
      [],
      { width: 300, height: 300 },
    );
    expect(placement.box.bottom).toBe(132);
    expect(placement.connectorStart).toEqual({ x: 150, y: 132 });
    expect(placement.connectorEnd).toEqual({ x: 150, y: 150 });
  });

  it("creates straight and curved connector paths", () => {
    expect(connectorPath({ x: 0, y: 0 }, { x: 10, y: 10 }, false)).toContain(
      " L ",
    );
    expect(connectorPath({ x: 0, y: 0 }, { x: 10, y: 10 }, true)).toContain(
      " Q ",
    );
  });
});
