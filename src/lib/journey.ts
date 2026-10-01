import type { Place, RouteGeometry } from "../types";

export const straightRoute = (places: Place[]): RouteGeometry => ({
  coordinates: places.map((place) => [place.lng, place.lat]),
  distanceMeters: places.slice(1).reduce((sum, place, index) => {
    const previous = places[index];
    const earth = 6371e3;
    const phi1 = (previous.lat * Math.PI) / 180;
    const phi2 = (place.lat * Math.PI) / 180;
    const dPhi = ((place.lat - previous.lat) * Math.PI) / 180;
    const dLambda = ((place.lng - previous.lng) * Math.PI) / 180;
    const a =
      Math.sin(dPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
    return sum + earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, 0),
  durationSeconds: 0,
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
  places: Place[],
  route: RouteGeometry,
): string => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wayfare" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>My journey</name></metadata>
${places.map((place) => `  <wpt lat="${place.lat}" lon="${place.lng}"><name>${xml(place.name)}</name></wpt>`).join("\n")}
  <trk><name>My journey</name><trkseg>
${route.coordinates.map(([lng, lat]) => `    <trkpt lat="${lat}" lon="${lng}" />`).join("\n")}
  </trkseg></trk>
</gpx>`;

export const downloadText = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};
