import { describe, expect, it } from "vitest";
import {
  acceptQrFrame,
  createQrFrames,
  decodeJourney,
  encodeJourney,
} from "./share";

describe("journey sharing", () => {
  it("round-trips unicode journey data", () => {
    const state = {
      version: 2 as const,
      name: "Österreich-Tour",
      items: [],
      settings: { mapStyle: "österreich" } as never,
    };
    expect(decodeJourney(encodeJourney(state))).toEqual(state);
  });
  it("reassembles QR frames in any order and tolerates duplicates", () => {
    const encoded = "abc".repeat(1000);
    const rawFrames = createQrFrames(encoded, 100);
    const frames = new Map<number, string>();
    let complete = "";
    [...rawFrames]
      .reverse()
      .concat(rawFrames[0])
      .forEach((raw) => {
        const result = acceptQrFrame(frames, raw);
        if (result.complete) complete = result.value;
      });
    expect(complete).toBe(encoded);
  });
});
