import type { MapSource } from "../types";

export const BUILT_IN_MAPS: MapSource[] = [
  {
    id: "ofm-liberty",
    name: "Liberty",
    description: "A balanced, detailed street map.",
    kind: "style",
    url: "https://tiles.openfreemap.org/styles/liberty",
    attribution: "© OpenMapTiles © OpenStreetMap contributors",
    builtIn: true,
  },
  {
    id: "ofm-positron",
    name: "Positron",
    description: "A quiet, light map that keeps your journey prominent.",
    kind: "style",
    url: "https://tiles.openfreemap.org/styles/positron",
    attribution: "© OpenMapTiles © OpenStreetMap contributors",
    builtIn: true,
  },
  {
    id: "ofm-bright",
    name: "Bright",
    description: "Clear colors and strong place labels.",
    kind: "style",
    url: "https://tiles.openfreemap.org/styles/bright",
    attribution: "© OpenMapTiles © OpenStreetMap contributors",
    builtIn: true,
  },
  {
    id: "ofm-dark",
    name: "Dark",
    description: "A deep charcoal map for vivid routes and photographs.",
    kind: "style",
    url: "https://tiles.openfreemap.org/styles/dark",
    attribution: "© OpenMapTiles © OpenStreetMap contributors",
    builtIn: true,
  },
  {
    id: "ofm-fiord",
    name: "Fiord",
    description: "A cool blue-gray editorial map.",
    kind: "style",
    url: "https://tiles.openfreemap.org/styles/fiord",
    attribution: "© OpenMapTiles © OpenStreetMap contributors",
    builtIn: true,
  },
  {
    id: "ofm-3d",
    name: "3D",
    description: "Detailed buildings and terrain-inspired depth.",
    kind: "style",
    url: "https://tiles.openfreemap.org/styles/3d",
    attribution: "© OpenMapTiles © OpenStreetMap contributors",
    builtIn: true,
  },
  {
    id: "osm-standard",
    name: "OSM Standard",
    description: "The familiar OpenStreetMap raster style.",
    kind: "raster",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
    builtIn: true,
  },
  {
    id: "open-topo",
    name: "OpenTopoMap",
    description: "Topographic detail for hikes and outdoor journeys.",
    kind: "raster",
    url: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors, SRTM | © OpenTopoMap",
    maxZoom: 17,
    builtIn: true,
  },
];

export const findMap = (id: string, customMaps: MapSource[]) =>
  [...BUILT_IN_MAPS, ...customMaps].find((map) => map.id === id) ??
  BUILT_IN_MAPS[1];
