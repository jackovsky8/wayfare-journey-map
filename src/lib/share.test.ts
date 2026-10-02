import { describe, expect, it } from "vitest";
import { decodeJourney, encodeJourney, shareSizeWarning } from "./share";

describe("journey sharing", () => {
  it("round-trips unicode journey data", () => {
    const state = {
      version: 1 as const,
      items: [],
      settings: { mapStyle: "österreich" } as never,
    };
    expect(decodeJourney(encodeJourney(state))).toEqual(state);
  });
  it("warns when a QR link is too large", () => {
    expect(shareSizeWarning("x".repeat(13_000), 0)).toMatch(/very large/i);
    expect(shareSizeWarning("short", 0)).toBe("");
  });
});
