import { describe, expect, it } from "vitest";
import { buildQrShareMessage } from "./share-message";

describe("QR share message", () => {
  it("uses the configured public site URL for sharing and importing", () => {
    const message = buildQrShareMessage(
      "https://jackovsky8.github.io/wayfare-journey-map/",
      "http://localhost:4173/?old=value#map",
    );

    expect(message.appUrl).toBe(
      "https://jackovsky8.github.io/wayfare-journey-map/",
    );
    expect(message.importUrl).toBe(
      "https://jackovsky8.github.io/wayfare-journey-map/?import=1",
    );
    expect(message.text).toContain("Scan frames with this device");
    expect(message.text).toContain("Keep scanning until it reaches 100%");
  });

  it("falls back to the current page without retaining its query or hash", () => {
    const message = buildQrShareMessage(
      undefined,
      "https://example.test/app/?journey=old#map",
    );

    expect(message.appUrl).toBe("https://example.test/app/");
    expect(message.importUrl).toBe("https://example.test/app/?import=1");
  });
});
