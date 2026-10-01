import type { Place, RouteGeometry } from "../types";
import { straightRoute } from "./journey";

export interface SearchResult {
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<SearchResult[]> {
  if (query.trim().length < 2) return [];
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  const response = await fetch(url, {
    signal,
    headers: { "Accept-Language": navigator.language },
  });
  if (!response.ok) throw new Error("Place search is temporarily unavailable.");
  const data = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    name?: string;
  }>;
  return data.map((item) => {
    const parts = item.display_name.split(",");
    return {
      name: item.name || parts[0],
      subtitle: parts.slice(1, 4).join(",").trim(),
      lat: Number(item.lat),
      lng: Number(item.lon),
    };
  });
}

export async function routeWithOsrm(
  places: Place[],
  signal?: AbortSignal,
): Promise<RouteGeometry> {
  if (places.length < 2) return straightRoute(places);
  const coordinates = places
    .map((place) => `${place.lng},${place.lat}`)
    .join(";");
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`,
    { signal },
  );
  if (!response.ok) throw new Error("Road routing is temporarily unavailable.");
  const data = (await response.json()) as {
    routes?: Array<{
      geometry: { coordinates: [number, number][] };
      distance: number;
      duration: number;
    }>;
  };
  const route = data.routes?.[0];
  if (!route) throw new Error("No road route was found for these stops.");
  return {
    coordinates: route.geometry.coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

export async function routeWithMapbox(
  places: Place[],
  token: string,
  signal?: AbortSignal,
): Promise<RouteGeometry> {
  if (places.length < 2) return straightRoute(places);
  const coordinates = places
    .map((place) => `${place.lng},${place.lat}`)
    .join(";");
  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?overview=full&geometries=geojson&access_token=${encodeURIComponent(token)}`,
    { signal },
  );
  if (!response.ok)
    throw new Error("Mapbox rejected this request. Check your token.");
  const data = (await response.json()) as {
    routes?: Array<{
      geometry: { coordinates: [number, number][] };
      distance: number;
      duration: number;
    }>;
  };
  const route = data.routes?.[0];
  if (!route) throw new Error("Mapbox found no route.");
  return {
    coordinates: route.geometry.coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}
