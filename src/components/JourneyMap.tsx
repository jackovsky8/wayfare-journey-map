import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import maplibregl, {
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapStyleId, Place, RouteGeometry } from "../types";

export interface JourneyMapHandle {
  exportImage: (format: "png" | "jpeg" | "webp") => void;
  fit: () => void;
}

const tiles: Record<
  MapStyleId,
  { url: string; attribution: string; background: string }
> = {
  atlas: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    background: "#d9e6e2",
  },
  paper: {
    url: "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
    attribution: "© OpenStreetMap © CARTO",
    background: "#f6f3eb",
  },
  midnight: {
    url: "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
    attribution: "© OpenStreetMap © CARTO",
    background: "#151d24",
  },
};

const styleFor = (id: MapStyleId): StyleSpecification => ({
  version: 8,
  sources: {
    base: {
      type: "raster",
      tiles: [tiles[id].url],
      tileSize: id === "atlas" ? 256 : 256,
      attribution: tiles[id].attribution,
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": tiles[id].background },
    },
    {
      id: "base",
      type: "raster",
      source: "base",
      paint: {
        "raster-saturation": id === "atlas" ? -0.25 : -0.45,
        "raster-opacity": 0.96,
      },
    },
  ],
});

const emptyCollection = { type: "FeatureCollection" as const, features: [] };

export const JourneyMap = forwardRef<
  JourneyMapHandle,
  {
    places: Place[];
    route: RouteGeometry;
    mapStyle: MapStyleId;
    routeColor: string;
    routeWidth: number;
    autoFit: boolean;
    zoom: number;
  }
>(({ places, route, mapStyle, routeColor, routeWidth, autoFit, zoom }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);

  const fit = () => {
    const map = mapRef.current;
    if (!map || places.length === 0) return;
    if (places.length === 1)
      map.easeTo({ center: [places[0].lng, places[0].lat], zoom: 10 });
    else {
      const bounds = places.reduce(
        (box, place) => box.extend([place.lng, place.lat]),
        new maplibregl.LngLatBounds(
          [places[0].lng, places[0].lat],
          [places[0].lng, places[0].lat],
        ),
      );
      map.fitBounds(bounds, { padding: 84, maxZoom: 13, duration: 700 });
    }
  };

  const draw = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const routeSource = map.getSource("journey-route") as
      maplibregl.GeoJSONSource | undefined;
    const placeSource = map.getSource("journey-places") as
      maplibregl.GeoJSONSource | undefined;
    routeSource?.setData(
      route.coordinates.length > 1
        ? {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: route.coordinates },
          }
        : emptyCollection,
    );
    placeSource?.setData({
      type: "FeatureCollection",
      features: places
        .filter((p) => p.marker !== "route")
        .map((place, index) => ({
          type: "Feature",
          properties: { index: index + 1, kind: place.marker },
          geometry: { type: "Point", coordinates: [place.lng, place.lat] },
        })),
    });
    if (map.getLayer("journey-line"))
      map.setPaintProperty("journey-line", "line-color", routeColor);
    if (map.getLayer("journey-line"))
      map.setPaintProperty("journey-line", "line-width", routeWidth);
  };

  const addJourneyLayers = () => {
    const map = mapRef.current;
    if (!map || map.getSource("journey-route")) return;
    map.addSource("journey-route", { type: "geojson", data: emptyCollection });
    map.addLayer({
      id: "journey-shadow",
      type: "line",
      source: "journey-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 0.75,
        "line-width": routeWidth + 5,
      },
    });
    map.addLayer({
      id: "journey-line",
      type: "line",
      source: "journey-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": routeColor, "line-width": routeWidth },
    });
    map.addSource("journey-places", { type: "geojson", data: emptyCollection });
    map.addLayer({
      id: "journey-pins",
      type: "circle",
      source: "journey-places",
      filter: ["==", ["get", "kind"], "pin"],
      paint: {
        "circle-color": "#fffaf0",
        "circle-radius": 13,
        "circle-stroke-color": routeColor,
        "circle-stroke-width": 4,
      },
    });
    map.addLayer({
      id: "journey-dots",
      type: "circle",
      source: "journey-places",
      filter: ["==", ["get", "kind"], "dot"],
      paint: {
        "circle-color": routeColor,
        "circle-radius": 6,
        "circle-stroke-color": "#fffaf0",
        "circle-stroke-width": 2,
      },
    });
    map.addLayer({
      id: "journey-labels",
      type: "symbol",
      source: "journey-places",
      filter: ["==", ["get", "kind"], "pin"],
      layout: {
        "text-field": ["to-string", ["get", "index"]],
        "text-size": 12,
      },
      paint: { "text-color": routeColor },
    });
    readyRef.current = true;
    draw();
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleFor(mapStyle),
      center: [13.4, 47.6],
      zoom: 4.6,
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );
    map.on("load", addJourneyLayers);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    readyRef.current = false;
    map.setStyle(styleFor(mapStyle));
    map.once("style.load", addJourneyLayers);
  }, [mapStyle]);

  useEffect(() => {
    draw();
    if (autoFit) fit();
  }, [places, route, routeColor, routeWidth, autoFit]);
  useEffect(() => {
    if (!autoFit) mapRef.current?.easeTo({ zoom, duration: 350 });
  }, [zoom, autoFit]);

  useImperativeHandle(ref, () => ({
    fit,
    exportImage: (format) => {
      const map = mapRef.current;
      if (!map) return;
      map.once("idle", () => {
        const anchor = document.createElement("a");
        anchor.download = `journey-map.${format === "jpeg" ? "jpg" : format}`;
        anchor.href = map.getCanvas().toDataURL(`image/${format}`, 0.94);
        anchor.click();
      });
      map.triggerRepaint();
    },
  }));

  return <div ref={containerRef} className="map-canvas" data-testid="map" />;
});
