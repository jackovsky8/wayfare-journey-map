import { describe, expect, it } from "vitest";
import type { JourneyItem, Place } from "../types";
import {
  collectPhotoAssets,
  hydratePhotoData,
  stripPhotoData,
} from "./photo-storage";

const place: Place = {
  id: "vienna",
  type: "place",
  name: "Vienna",
  description: "",
  lat: 48.2,
  lng: 16.3,
  marker: "pin",
  photo: {
    dataUrl: "data:image/jpeg;base64,photo",
    fileName: "vienna.jpg",
    cropX: 50,
    cropY: 50,
    zoom: 1,
  },
};

describe("photograph persistence", () => {
  it("separates large photograph data from local-storage metadata", () => {
    const items: JourneyItem[] = [place];
    expect(collectPhotoAssets("trip", items)).toEqual([
      { key: "trip:vienna", dataUrl: place.photo?.dataUrl },
    ]);
    expect((stripPhotoData(items)[0] as Place).photo?.dataUrl).toBe("");
    expect(place.photo?.dataUrl).toContain("base64");
  });

  it("hydrates photograph data without changing its crop settings", async () => {
    const stripped = stripPhotoData([place]);
    const hydrated = await hydratePhotoData("trip", stripped, async () =>
      Promise.resolve("data:image/jpeg;base64,restored"),
    );
    expect((hydrated[0] as Place).photo).toMatchObject({
      dataUrl: "data:image/jpeg;base64,restored",
      cropX: 50,
      cropY: 50,
      zoom: 1,
    });
  });
});
