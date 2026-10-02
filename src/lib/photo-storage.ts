import type { GpxTrack, JourneyItem, Place } from "../types";

const DATABASE_NAME = "wayfare-assets";
const STORE_NAME = "photos";

const mapPlace = (place: Place, mapPhoto: (place: Place) => Place): Place =>
  place.photo ? mapPhoto(place) : place;

const mapItemPlaces = (
  item: JourneyItem,
  mapPhoto: (place: Place) => Place,
): JourneyItem => {
  if (item.type === "place") return mapPlace(item, mapPhoto);
  const track: GpxTrack = { ...item };
  if (track.startPlace) track.startPlace = mapPlace(track.startPlace, mapPhoto);
  if (track.endPlace) track.endPlace = mapPlace(track.endPlace, mapPhoto);
  return track;
};

export const photoStorageKey = (journeyId: string, placeId: string) =>
  `${journeyId}:${placeId}`;

export function collectPhotoAssets(journeyId: string, items: JourneyItem[]) {
  const assets: Array<{ key: string; dataUrl: string }> = [];
  items.forEach((item) =>
    mapItemPlaces(item, (place) => {
      if (place.photo?.dataUrl)
        assets.push({
          key: photoStorageKey(journeyId, place.id),
          dataUrl: place.photo.dataUrl,
        });
      return place;
    }),
  );
  return assets;
}

export function stripPhotoData(items: JourneyItem[]): JourneyItem[] {
  return items.map((item) =>
    mapItemPlaces(item, (place) => ({
      ...place,
      photo: place.photo ? { ...place.photo, dataUrl: "" } : undefined,
    })),
  );
}

export async function hydratePhotoData(
  journeyId: string,
  items: JourneyItem[],
  load: (key: string) => Promise<string | undefined>,
): Promise<JourneyItem[]> {
  let changed = false;
  const hydrated = await Promise.all(
    items.map(async (item) => {
      const hydratePlace = async (place: Place) => {
        if (!place.photo || place.photo.dataUrl) return place;
        const dataUrl = await load(photoStorageKey(journeyId, place.id));
        if (!dataUrl) return place;
        changed = true;
        return { ...place, photo: { ...place.photo, dataUrl } };
      };
      if (item.type === "place") return hydratePlace(item);
      const startPlace = item.startPlace
        ? await hydratePlace(item.startPlace)
        : undefined;
      const endPlace = item.endPlace
        ? await hydratePlace(item.endPlace)
        : undefined;
      return startPlace === item.startPlace && endPlace === item.endPlace
        ? item
        : { ...item, startPlace, endPlace };
    }),
  );
  return changed ? hydrated : items;
}

function openPhotoDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("This browser does not support IndexedDB."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

const requestValue = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export async function saveJourneyPhotos(
  journeyId: string,
  items: JourneyItem[],
) {
  const assets = collectPhotoAssets(journeyId, items);
  if (!assets.length) return;
  const database = await openPhotoDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    await Promise.all(
      assets.map(({ key, dataUrl }) => requestValue(store.put(dataUrl, key))),
    );
  } finally {
    database.close();
  }
}

export async function loadJourneyPhotos(
  journeyId: string,
  items: JourneyItem[],
) {
  if (!items.some((item) => JSON.stringify(item).includes('"dataUrl":""')))
    return items;
  const database = await openPhotoDatabase();
  try {
    return await hydratePhotoData(journeyId, items, async (key) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      return requestValue<string | undefined>(
        transaction.objectStore(STORE_NAME).get(key),
      );
    });
  } finally {
    database.close();
  }
}

export async function deleteJourneyPhotos(journeyId: string) {
  const database = await openPhotoDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const keys = await requestValue<IDBValidKey[]>(store.getAllKeys());
    await Promise.all(
      keys
        .filter((key) => String(key).startsWith(`${journeyId}:`))
        .map((key) => requestValue(store.delete(key))),
    );
  } finally {
    database.close();
  }
}
