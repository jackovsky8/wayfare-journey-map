export type MarkerKind = "pin" | "dot" | "route";

export interface Place {
  id: string;
  name: string;
  subtitle?: string;
  lat: number;
  lng: number;
  marker: MarkerKind;
}

export interface RouteGeometry {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

export type MapStyleId = "atlas" | "paper" | "midnight";

export interface AppSettings {
  mapStyle: MapStyleId;
  routeColor: string;
  routeWidth: number;
  autoFit: boolean;
  manualZoom: number;
  provider: "osrm" | "mapbox" | "google";
  mapboxToken: string;
  googleKey: string;
}
