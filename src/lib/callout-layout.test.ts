import { describe, expect, it } from "vitest";
import {
  boxesOverlap,
  boxIntersectsPolyline,
  connectorPath,
  layoutCallouts,
  layoutCalloutsFast,
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
      hiddenPlaces: 0,
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
    const progress: number[] = [];
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
      {},
      (value) => progress.push(value),
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
    expect(progress.at(-1)).toBe(1);
    expect(progress.length).toBe(4);
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

  it("returns an immediate usable preview before global refinement", () => {
    const placements = layoutCalloutsFast(
      [
        { id: "a", anchor: { x: 80, y: 90 }, width: 70, height: 40 },
        { id: "b", anchor: { x: 95, y: 90 }, width: 70, height: 40 },
      ],
      [],
      { width: 260, height: 220 },
    );
    expect(placements).toHaveLength(2);
    expect(placements.every(({ box }) => Number.isFinite(box.left))).toBe(true);
    expect(boxesOverlap(placements[0].box, placements[1].box, 10)).toBe(false);
  });

  it("keeps boxes visible and preserves the anchors' spatial order", () => {
    const viewport = { width: 360, height: 280 };
    const placements = layoutCallouts(
      [
        { id: "top-left", anchor: { x: 35, y: 35 }, width: 100, height: 55 },
        { id: "middle", anchor: { x: 180, y: 140 }, width: 100, height: 55 },
        {
          id: "bottom-right",
          anchor: { x: 330, y: 245 },
          width: 100,
          height: 55,
        },
      ],
      [],
      viewport,
    );
    for (const { box } of placements) {
      expect(box.left).toBeGreaterThanOrEqual(8);
      expect(box.top).toBeGreaterThanOrEqual(8);
      expect(box.right).toBeLessThanOrEqual(viewport.width - 8);
      expect(box.bottom).toBeLessThanOrEqual(viewport.height - 8);
    }
    const metrics = measureLayout(placements, [], viewport);
    expect(metrics.horizontalOrderViolations).toBe(0);
    expect(metrics.verticalOrderViolations).toBe(0);
    expect(metrics.hiddenPlaces).toBe(0);
  });

  it("keeps every place marker and the route between places visible", () => {
    const route = [
      { x: 55, y: 150 },
      { x: 390, y: 150 },
    ];
    const viewport = { width: 440, height: 320 };
    const placements = layoutCallouts(
      [
        { id: "left", anchor: { x: 90, y: 150 }, width: 118, height: 72 },
        { id: "middle", anchor: { x: 220, y: 150 }, width: 118, height: 72 },
        { id: "right", anchor: { x: 350, y: 150 }, width: 118, height: 72 },
      ],
      route,
      viewport,
      { optimizationPasses: 10, startingLayouts: 4 },
    );
    const metrics = measureLayout(placements, route, viewport);
    expect(metrics.overlaps).toBe(0);
    expect(metrics.hiddenPlaces).toBe(0);
    expect(metrics.routeIntersections).toBe(0);
    expect(metrics.connectorCrossings).toBe(0);
  });

  it("prioritizes spatial order and uncrossed arrows in a dense diagonal", () => {
    const viewport = { width: 520, height: 420 };
    const placements = layoutCallouts(
      [
        { id: "a", anchor: { x: 120, y: 105 }, width: 105, height: 58 },
        { id: "b", anchor: { x: 165, y: 140 }, width: 105, height: 58 },
        { id: "c", anchor: { x: 215, y: 180 }, width: 105, height: 58 },
        { id: "d", anchor: { x: 265, y: 220 }, width: 105, height: 58 },
      ],
      [],
      viewport,
      { optimizationPasses: 10, startingLayouts: 4 },
    );
    const metrics = measureLayout(placements, [], viewport);
    expect(metrics.overlaps).toBe(0);
    expect(metrics.connectorCrossings).toBe(0);
    expect(metrics.horizontalOrderViolations).toBe(0);
    expect(metrics.verticalOrderViolations).toBe(0);
  });

  it("publishes improving layouts during refinement", () => {
    const iterations: number[] = [];
    layoutCallouts(
      [
        { id: "a", anchor: { x: 140, y: 130 }, width: 90, height: 50 },
        { id: "b", anchor: { x: 155, y: 145 }, width: 90, height: 50 },
        { id: "c", anchor: { x: 170, y: 160 }, width: 90, height: 50 },
      ],
      [],
      { width: 320, height: 300 },
      {},
      undefined,
      (placements) => iterations.push(placements.length),
    );
    expect(iterations.length).toBeGreaterThan(0);
    expect(iterations.every((length) => length === 3)).toBe(true);
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
