import { describe, expect, it } from "vitest";
import { applyDiff, createItemsDiff } from "./history";
import type { Place } from "../types";

const place = (id: string): Place => ({
  id,
  type: "place",
  name: id,
  description: "",
  lat: 48,
  lng: 16,
  marker: "pin",
});

describe("journey diff history", () => {
  it("undoes an inserted place without storing a whole-state snapshot", () => {
    const before = [place("a"), place("c")];
    const after = [place("a"), place("b"), place("c")];
    const diff = createItemsDiff(before, after, "Add b")!;
    expect(diff.start).toBe(1);
    expect(diff.removed).toEqual([]);
    expect(diff.added.map((item) => item.id)).toEqual(["b"]);
    expect(applyDiff(after, diff, "backward")).toEqual(before);
  });

  it("reverses a GPX split", () => {
    const track = {
      id: "track",
      type: "track" as const,
      name: "Walk",
      sourceFile: "walk.gpx",
      coordinates: [
        [16, 48],
        [17, 49],
      ] as [number, number][],
    };
    const split = [
      { ...track, id: "before" },
      place("cut"),
      { ...track, id: "after" },
    ];
    const diff = createItemsDiff([track], split, "Split track")!;
    expect(applyDiff(split, diff, "backward")).toEqual([track]);
  });
});
