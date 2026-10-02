export type MarkerKind = "pin" | "dot" | "route";
export type MapSourceKind = "style" | "raster";

export interface PhotoStyle {
  dataUrl: string;
  fileName: string;
  cropX: number;
  cropY: number;
  zoom: number;
}

export interface PhotoAppearance {
  size: number;
  borderWidth: number;
  borderColor: string;
  radius: number;
}

export interface Place {
  id: string;
  type: "place";
  name: string;
  description: string;
  subtitle?: string;
  lat: number;
  lng: number;
  marker: MarkerKind;
  photo?: PhotoStyle;
}

export interface GpxTrack {
  id: string;
  type: "track";
  name: string;
  coordinates: [number, number][];
  sourceFile: string;
  startPlace?: Place;
  endPlace?: Place;
}

export type JourneyItem = Place | GpxTrack;

export interface JourneyDocument {
  id: string;
  name: string;
  items: JourneyItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RouteGeometry {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
}

export interface MapSource {
  id: string;
  name: string;
  description: string;
  kind: MapSourceKind;
  url: string;
  attribution: string;
  maxZoom?: number;
  builtIn?: boolean;
}

export interface LabelStyle {
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  radius: number;
  showDescriptions: boolean;
}

export interface CalloutStyle {
  connectorColor: string;
  connectorWidth: number;
  connectorStyle: "curved" | "straight" | "dashed";
}

export interface AppSettings {
  mapStyle: string;
  routeColor: string;
  routeWidth: number;
  autoFit: boolean;
  manualZoom: number;
  provider: "osrm" | "mapbox";
  mapboxToken: string;
  labels: LabelStyle;
  photos: PhotoAppearance;
  callouts: CalloutStyle;
  customMaps: MapSource[];
}
