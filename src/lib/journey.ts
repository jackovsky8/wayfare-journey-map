import type { GpxTrack, JourneyItem, Place, RouteGeometry } from "../types";

export const distanceBetween = (a: [number, number], b: [number, number]) => {
  const earth = 6371e3;
  const phi1 = (a[1] * Math.PI) / 180;
  const phi2 = (b[1] * Math.PI) / 180;
  const dPhi = ((b[1] - a[1]) * Math.PI) / 180;
  const dLambda = ((b[0] - a[0]) * Math.PI) / 180;
  const value =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

export const geometryDistance = (coordinates: [number, number][]) =>
  coordinates
    .slice(1)
    .reduce(
      (sum, coordinate, index) =>
        sum + distanceBetween(coordinates[index], coordinate),
      0,
    );

export const straightRoute = (places: Place[]): RouteGeometry => {
  const coordinates = places.map(
    (place) => [place.lng, place.lat] as [number, number],
  );
  return {
    coordinates,
    distanceMeters: geometryDistance(coordinates),
    durationSeconds: 0,
  };
};

export const itemStart = (item: JourneyItem): [number, number] =>
  item.type === "place" ? [item.lng, item.lat] : item.coordinates[0];

export const itemEnd = (item: JourneyItem): [number, number] =>
  item.type === "place"
    ? [item.lng, item.lat]
    : item.coordinates[item.coordinates.length - 1];

export async function composeJourneyRoute(
  items: JourneyItem[],
  connect: (
    from: [number, number],
    to: [number, number],
  ) => Promise<RouteGeometry>,
): Promise<RouteGeometry> {
  if (items.length === 0)
    return { coordinates: [], distanceMeters: 0, durationSeconds: 0 };
  const coordinates: [number, number][] = [];
  let distanceMeters = 0;
  let durationSeconds = 0;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (index > 0) {
      const connection = await connect(
        itemEnd(items[index - 1]),
        itemStart(item),
      );
      coordinates.push(
        ...connection.coordinates.slice(coordinates.length ? 1 : 0),
      );
      distanceMeters += connection.distanceMeters;
      durationSeconds += connection.durationSeconds;
    }
    if (item.type === "track") {
      coordinates.push(...item.coordinates.slice(coordinates.length ? 1 : 0));
      distanceMeters += geometryDistance(item.coordinates);
    } else if (coordinates.length === 0) coordinates.push([item.lng, item.lat]);
  }
  return { coordinates, distanceMeters, durationSeconds };
}

export const parseGpx = (xmlText: string, fileName: string): GpxTrack => {
  const document = new DOMParser().parseFromString(xmlText, "application/xml");
  if (document.querySelector("parsererror"))
    throw new Error("This file is not valid GPX XML.");
  const points = [...document.querySelectorAll("trkpt, rtept")];
  const coordinates = points
    .map(
      (point) =>
        [
          Number(point.getAttribute("lon")),
          Number(point.getAttribute("lat")),
        ] as [number, number],
    )
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  if (coordinates.length < 2)
    throw new Error(
      "The GPX file must contain at least two track or route points.",
    );
  const embeddedName = document
    .querySelector("trk > name, rte > name")
    ?.textContent?.trim();
  return {
    id: crypto.randomUUID(),
    type: "track",
    name: embeddedName || fileName.replace(/\.gpx$/i, ""),
    coordinates,
    sourceFile: fileName,
  };
};

export const resizeImage = (file: File, maxSide = 1400): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () =>
        reject(new Error("The selected file is not a supported image."));
      image.onload = () => {
        const scale = Math.min(
          1,
          maxSide / Math.max(image.width, image.height),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas
          .getContext("2d")
          ?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

export const moveItem = <T>(items: T[], from: number, to: number): T[] => {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  )
    return items;
  const copy = [...items];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
};

export const formatDistance = (meters: number): string =>
  meters >= 1000
    ? `${Math.round(meters / 100) / 10} km`
    : `${Math.round(meters)} m`;

const xml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character] ?? character,
  );

export const buildGpx = (
  items: JourneyItem[],
  route: RouteGeometry,
): string => {
  const places = items.filter((item): item is Place => item.type === "place");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Wayfare" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>My journey</name></metadata>\n${places.map((place) => `  <wpt lat="${place.lat}" lon="${place.lng}"><name>${xml(place.name)}</name><desc>${xml(place.description)}</desc></wpt>`).join("\n")}\n  <trk><name>My journey</name><trkseg>\n${route.coordinates.map(([lng, lat]) => `    <trkpt lat="${lat}" lon="${lng}" />`).join("\n")}\n  </trkseg></trk>\n</gpx>`;
};

export const downloadText = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};
