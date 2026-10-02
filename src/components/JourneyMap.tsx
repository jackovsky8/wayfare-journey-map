import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import maplibregl, {
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type {
  CalloutStyle,
  LabelStyle,
  MapSource,
  PhotoAppearance,
  Place,
  RouteGeometry,
} from "../types";
import {
  connectorPath,
  type CalloutItem,
  type CalloutPlacement,
  type LayoutOptions,
  type Point,
} from "../lib/callout-layout";

export interface JourneyMapHandle {
  exportImage: (
    format: "png" | "jpeg" | "webp",
    output?: { width: number; height: number },
  ) => void;
  fit: () => void;
}

interface Props {
  places: Place[];
  route: RouteGeometry;
  mapSource: MapSource;
  routeColor: string;
  routeWidth: number;
  autoFit: boolean;
  zoom: number;
  labels: LabelStyle;
  photos: PhotoAppearance;
  callouts: CalloutStyle;
  suspendLayout: boolean;
}

const emptyCollection = { type: "FeatureCollection" as const, features: [] };

const styleFor = (source: MapSource): string | StyleSpecification => {
  if (source.kind === "style") return source.url;
  return {
    version: 8,
    sources: {
      base: {
        type: "raster",
        tiles: [source.url],
        tileSize: 256,
        maxzoom: source.maxZoom ?? 19,
        attribution: source.attribution,
      },
    },
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#e8e4db" },
      },
      { id: "base", type: "raster", source: "base" },
    ],
  };
};

const loadImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });

const saveCanvas = async (
  canvas: HTMLCanvasElement,
  format: "png" | "jpeg" | "webp",
) => {
  const mime = `image/${format}`;
  const extension = format === "jpeg" ? "jpg" : format;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, 0.94),
  );
  if (!blob) throw new Error("The browser could not create the image file.");
  const file = new File([blob], `journey-map.${extension}`, { type: mime });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Journey map" });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.target = "_blank";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

const svgNamespace = "http://www.w3.org/2000/svg";
const computeLayoutInBackground = (
  items: CalloutItem[],
  route: Point[],
  viewport: { width: number; height: number },
  options?: LayoutOptions,
) =>
  new Promise<CalloutPlacement[]>((resolve, reject) => {
    const worker = new Worker(
      new URL("../workers/callout-layout.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (
      event: MessageEvent<{ placements: CalloutPlacement[] }>,
    ) => {
      worker.terminate();
      resolve(event.data.placements);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(event.error);
    };
    worker.postMessage({
      id: 1,
      items,
      route,
      viewport,
      options,
      progressive: false,
    });
  });

function drawConnectors(
  svg: SVGSVGElement,
  placements: CalloutPlacement[],
  style: CalloutStyle,
) {
  svg.replaceChildren();
  svg.setAttribute("viewBox", `0 0 ${svg.clientWidth} ${svg.clientHeight}`);
  const definitions = document.createElementNS(svgNamespace, "defs");
  const marker = document.createElementNS(svgNamespace, "marker");
  marker.setAttribute("id", "callout-arrowhead");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "5");
  marker.setAttribute("markerHeight", "5");
  marker.setAttribute("orient", "auto-start-reverse");
  const tip = document.createElementNS(svgNamespace, "path");
  tip.setAttribute("d", "M 0 1 L 10 5 L 0 9 z");
  tip.setAttribute("fill", style.connectorColor);
  marker.append(tip);
  definitions.append(marker);
  svg.append(definitions);
  placements.forEach((placement) => {
    const path = document.createElementNS(svgNamespace, "path");
    path.setAttribute(
      "d",
      connectorPath(
        placement.connectorStart,
        placement.connectorEnd,
        style.connectorStyle === "curved",
      ),
    );
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", style.connectorColor);
    path.setAttribute("stroke-width", String(style.connectorWidth));
    path.setAttribute("stroke-linecap", "round");
    if (style.connectorStyle === "dashed")
      path.setAttribute("stroke-dasharray", "7 6");
    path.setAttribute("marker-end", "url(#callout-arrowhead)");
    svg.append(path);
  });
}

function drawCanvasConnector(
  context: CanvasRenderingContext2D,
  placement: CalloutPlacement,
  style: CalloutStyle,
  scale: number,
) {
  const { connectorStart: start, connectorEnd: end } = placement;
  context.save();
  context.strokeStyle = style.connectorColor;
  context.fillStyle = style.connectorColor;
  context.lineWidth = style.connectorWidth * scale;
  context.lineCap = "round";
  if (style.connectorStyle === "dashed")
    context.setLineDash([7 * scale, 6 * scale]);
  context.beginPath();
  context.moveTo(start.x, start.y);
  if (style.connectorStyle === "curved") {
    const dx = end.x - start.x,
      dy = end.y - start.y,
      length = Math.max(1, Math.hypot(dx, dy));
    const bend = Math.min(24 * scale, length * 0.18);
    context.quadraticCurveTo(
      (start.x + end.x) / 2 - (dy / length) * bend,
      (start.y + end.y) / 2 + (dx / length) * bend,
      end.x,
      end.y,
    );
  } else context.lineTo(end.x, end.y);
  context.stroke();
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const size = 7 * scale;
  context.setLineDash([]);
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(
    end.x - Math.cos(angle - 0.5) * size,
    end.y - Math.sin(angle - 0.5) * size,
  );
  context.lineTo(
    end.x - Math.cos(angle + 0.5) * size,
    end.y - Math.sin(angle + 0.5) * size,
  );
  context.closePath();
  context.fill();
  context.restore();
}

export const JourneyMap = forwardRef<JourneyMapHandle, Props>(
  (
    {
      places,
      route,
      mapSource,
      routeColor,
      routeWidth,
      autoFit,
      zoom,
      labels,
      photos,
      callouts,
      suspendLayout,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const calloutLayerRef = useRef<HTMLDivElement>(null);
    const connectorRef = useRef<SVGSVGElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const layoutWorkerRef = useRef<Worker | null>(null);
    const layoutRequestRef = useRef(0);
    const readyRef = useRef(false);
    const calloutEntriesRef = useRef<
      Array<{ element: HTMLDivElement; lngLat: [number, number] }>
    >([]);
    const pinMarkersRef = useRef<maplibregl.Marker[]>([]);
    const styleKeyRef = useRef(`${mapSource.kind}:${mapSource.url}`);
    const latestRef = useRef({
      places,
      route,
      routeColor,
      routeWidth,
      labels,
      photos,
      callouts,
      suspendLayout,
    });
    latestRef.current = {
      places,
      route,
      routeColor,
      routeWidth,
      labels,
      photos,
      callouts,
      suspendLayout,
    };

    const fit = () => {
      const map = mapRef.current;
      const currentPlaces = latestRef.current.places;
      const points = [
        ...latestRef.current.route.coordinates,
        ...currentPlaces.map(
          (place) => [place.lng, place.lat] as [number, number],
        ),
      ];
      if (!map || points.length === 0) return;
      if (points.length === 1) map.easeTo({ center: points[0], zoom: 10 });
      else {
        const bounds = points
          .slice(1)
          .reduce(
            (box, coordinate) => box.extend(coordinate),
            new maplibregl.LngLatBounds(points[0], points[0]),
          );
        map.fitBounds(bounds, {
          padding: { top: 150, right: 90, bottom: 90, left: 90 },
          maxZoom: 13,
          duration: 650,
        });
      }
    };

    const layoutCallouts = () => {
      const map = mapRef.current;
      const svg = connectorRef.current;
      const worker = layoutWorkerRef.current;
      if (!map || !svg || !worker || latestRef.current.suspendLayout) return;
      const coordinates = latestRef.current.route.coordinates;
      const stride = Math.max(1, Math.ceil(coordinates.length / 600));
      const routePoints = coordinates
        .filter(
          (_, index) =>
            index % stride === 0 || index === coordinates.length - 1,
        )
        .map((coordinate) => map.project(coordinate));
      const items = calloutEntriesRef.current.map((entry, index) => {
        const anchor = map.project(entry.lngLat);
        return {
          id: String(index),
          anchor,
          width: entry.element.offsetWidth,
          height: entry.element.offsetHeight,
        };
      });
      worker.postMessage({
        id: ++layoutRequestRef.current,
        items,
        route: routePoints,
        viewport: {
          width: map.getContainer().clientWidth,
          height: map.getContainer().clientHeight,
        },
        options: { optimizationPasses: 4, startingLayouts: 2 },
        progressive: true,
      });
    };

    const renderCallouts = () => {
      const map = mapRef.current;
      if (!map || latestRef.current.suspendLayout) return;
      calloutEntriesRef.current.forEach(({ element }) => element.remove());
      calloutEntriesRef.current = [];
      pinMarkersRef.current.forEach((marker) => marker.remove());
      pinMarkersRef.current = [];

      latestRef.current.places.forEach((place, index) => {
        if (place.marker === "pin") {
          const number = document.createElement("span");
          number.className = "pin-number-overlay";
          number.textContent = String(index + 1);
          const pinMarker = new maplibregl.Marker({
            element: number,
            anchor: "center",
          })
            .setLngLat([place.lng, place.lat])
            .addTo(map);
          number.setAttribute("role", "img");
          number.setAttribute(
            "aria-label",
            `Place ${index + 1}: ${place.name}`,
          );
          pinMarkersRef.current.push(pinMarker);
        }
        if (!place.name && !place.photo) return;
        const element = document.createElement("div");
        element.className = "map-callout";
        element.style.opacity = "0";
        element.style.setProperty(
          "--label-bg",
          latestRef.current.labels.backgroundColor,
        );
        element.style.setProperty(
          "--label-color",
          latestRef.current.labels.textColor,
        );
        element.style.setProperty(
          "--label-border",
          latestRef.current.labels.borderColor,
        );
        element.style.setProperty(
          "--label-border-width",
          `${latestRef.current.labels.borderWidth}px`,
        );
        element.style.setProperty(
          "--label-radius",
          `${latestRef.current.labels.radius}px`,
        );
        element.style.setProperty(
          "--label-size",
          `${latestRef.current.labels.fontSize}px`,
        );

        if (place.photo) {
          const photo = document.createElement("div");
          photo.className = "callout-photo";
          photo.style.width = `${latestRef.current.photos.size}px`;
          photo.style.height = `${latestRef.current.photos.size}px`;
          photo.style.border = `${latestRef.current.photos.borderWidth}px solid ${latestRef.current.photos.borderColor}`;
          photo.style.borderRadius = `${latestRef.current.photos.radius}%`;
          photo.style.backgroundImage = `url("${place.photo.dataUrl}")`;
          photo.style.backgroundSize = `${place.photo.zoom * 100}%`;
          photo.style.backgroundPosition = `${place.photo.cropX}% ${place.photo.cropY}%`;
          element.append(photo);
        }

        const caption = document.createElement("div");
        caption.className = "callout-caption";
        const title = document.createElement("strong");
        title.textContent = place.name;
        caption.append(title);
        if (latestRef.current.labels.showDescriptions && place.description) {
          const description = document.createElement("span");
          description.textContent = place.description;
          caption.append(description);
        }
        element.append(caption);

        calloutLayerRef.current?.append(element);
        calloutEntriesRef.current.push({
          element,
          lngLat: [place.lng, place.lat],
        });
      });

      requestAnimationFrame(layoutCallouts);
    };

    const draw = () => {
      const map = mapRef.current;
      if (!map || !readyRef.current) return;
      const current = latestRef.current;
      (
        map.getSource("journey-route") as maplibregl.GeoJSONSource | undefined
      )?.setData(
        current.route.coordinates.length > 1
          ? {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: current.route.coordinates,
              },
            }
          : emptyCollection,
      );
      (
        map.getSource("journey-places") as maplibregl.GeoJSONSource | undefined
      )?.setData({
        type: "FeatureCollection",
        features: current.places
          .filter((place) => place.marker !== "route")
          .map((place, index) => ({
            type: "Feature",
            properties: { index: index + 1, kind: place.marker },
            geometry: { type: "Point", coordinates: [place.lng, place.lat] },
          })),
      });
      if (map.getLayer("journey-shadow"))
        map.setPaintProperty(
          "journey-shadow",
          "line-width",
          current.routeWidth + 5,
        );
      if (map.getLayer("journey-line")) {
        map.setPaintProperty("journey-line", "line-color", current.routeColor);
        map.setPaintProperty("journey-line", "line-width", current.routeWidth);
      }
      if (map.getLayer("journey-pins"))
        map.setPaintProperty(
          "journey-pins",
          "circle-color",
          current.routeColor,
        );
      if (map.getLayer("journey-dots"))
        map.setPaintProperty(
          "journey-dots",
          "circle-color",
          current.routeColor,
        );
      renderCallouts();
    };

    const addJourneyLayers = () => {
      const map = mapRef.current;
      if (!map) return;
      if (!map.isStyleLoaded()) {
        map.once("idle", addJourneyLayers);
        return;
      }
      if (!map.getSource("journey-route")) {
        map.addSource("journey-route", {
          type: "geojson",
          data: emptyCollection,
        });
        map.addLayer({
          id: "journey-shadow",
          type: "line",
          source: "journey-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-opacity": 0.76,
            "line-width": latestRef.current.routeWidth + 5,
          },
        });
        map.addLayer({
          id: "journey-line",
          type: "line",
          source: "journey-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": latestRef.current.routeColor,
            "line-width": latestRef.current.routeWidth,
          },
        });
        map.addSource("journey-places", {
          type: "geojson",
          data: emptyCollection,
        });
        map.addLayer({
          id: "journey-pins",
          type: "circle",
          source: "journey-places",
          filter: ["==", ["get", "kind"], "pin"],
          paint: {
            "circle-color": latestRef.current.routeColor,
            "circle-radius": 12,
            "circle-stroke-color": "#fffaf0",
            "circle-stroke-width": 4,
          },
        });
        map.addLayer({
          id: "journey-dots",
          type: "circle",
          source: "journey-places",
          filter: ["==", ["get", "kind"], "dot"],
          paint: {
            "circle-color": latestRef.current.routeColor,
            "circle-radius": 6,
            "circle-stroke-color": "#fffaf0",
            "circle-stroke-width": 2,
          },
        });
      }
      readyRef.current = true;
      draw();
    };

    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;
      const worker = new Worker(
        new URL("../workers/callout-layout.worker.ts", import.meta.url),
        { type: "module" },
      );
      layoutWorkerRef.current = worker;
      worker.onmessage = (
        event: MessageEvent<{
          id: number;
          placements: CalloutPlacement[];
        }>,
      ) => {
        if (
          event.data.id !== layoutRequestRef.current ||
          latestRef.current.suspendLayout
        )
          return;
        event.data.placements.forEach((placement, index) => {
          const element = calloutEntriesRef.current[index]?.element;
          if (!element) return;
          element.style.left = `${placement.box.left}px`;
          element.style.top = `${placement.box.top}px`;
          element.style.opacity = "1";
        });
        if (connectorRef.current)
          drawConnectors(
            connectorRef.current,
            event.data.placements,
            latestRef.current.callouts,
          );
      };
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: styleFor(mapSource),
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
      map.once("load", () => {
        addJourneyLayers();
        if (autoFit) fit();
      });
      map.on("movestart", () => {
        if (calloutLayerRef.current)
          calloutLayerRef.current.style.opacity = "0";
        if (connectorRef.current) connectorRef.current.style.opacity = "0";
      });
      map.on("moveend", () => {
        if (calloutLayerRef.current)
          calloutLayerRef.current.style.opacity = "1";
        if (connectorRef.current) connectorRef.current.style.opacity = "1";
        layoutCallouts();
      });
      map.on("resize", layoutCallouts);
      map.on("error", (event) => console.warn("Map source error", event.error));
      return () => {
        calloutEntriesRef.current.forEach(({ element }) => element.remove());
        pinMarkersRef.current.forEach((marker) => marker.remove());
        map.remove();
        worker.terminate();
        layoutWorkerRef.current = null;
        mapRef.current = null;
      };
    }, []);

    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      const nextStyleKey = `${mapSource.kind}:${mapSource.url}`;
      if (styleKeyRef.current === nextStyleKey) return;
      styleKeyRef.current = nextStyleKey;
      readyRef.current = false;
      calloutEntriesRef.current.forEach(({ element }) => element.remove());
      calloutEntriesRef.current = [];
      pinMarkersRef.current.forEach((marker) => marker.remove());
      pinMarkersRef.current = [];
      map.once("style.load", () => {
        addJourneyLayers();
        if (autoFit) fit();
      });
      map.setStyle(styleFor(mapSource));
    }, [mapSource.id, mapSource.kind, mapSource.url]);

    useEffect(() => {
      if (!suspendLayout) {
        draw();
        if (autoFit) fit();
      }
    }, [
      places,
      route,
      routeColor,
      routeWidth,
      autoFit,
      labels,
      photos,
      callouts,
      suspendLayout,
    ]);
    useEffect(() => {
      if (!autoFit) mapRef.current?.easeTo({ zoom, duration: 350 });
    }, [zoom, autoFit]);

    useImperativeHandle(ref, () => ({
      fit,
      exportImage: async (format, output) => {
        const map = mapRef.current;
        if (!map) return;
        const stage = map.getContainer().parentElement;
        const originalHeight = stage?.style.height ?? "";
        const originalWidth = stage?.style.width ?? "";
        if (output && stage) {
          const previewWidth = Math.min(
            2000,
            Math.max(640, output.width / Math.max(1, devicePixelRatio)),
          );
          stage.style.width = `${previewWidth}px`;
          stage.style.height = `${previewWidth * (output.height / output.width)}px`;
          map.resize();
          const moved = new Promise<void>((resolve) =>
            map.once("moveend", () => resolve()),
          );
          fit();
          await moved;
        }
        await new Promise<void>((resolve) =>
          map.loaded() ? resolve() : map.once("idle", () => resolve()),
        );
        const base = map.getCanvas();
        const canvas = document.createElement("canvas");
        canvas.width = base.width;
        canvas.height = base.height;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(base, 0, 0);
        const scale = base.width / base.clientWidth;

        const exportItems = latestRef.current.places.flatMap((place, index) => {
          if (!place.name && !place.photo) return [];
          const point = map.project([place.lng, place.lat]);
          const description =
            latestRef.current.labels.showDescriptions && place.description
              ? place.description.slice(0, 70)
              : "";
          context.font = `600 ${latestRef.current.labels.fontSize * scale}px Manrope, sans-serif`;
          const labelWidth = Math.min(
            260 * scale,
            Math.max(
              80 * scale,
              context.measureText(place.name).width + 18 * scale,
              description
                ? context.measureText(description).width + 18 * scale
                : 0,
            ),
          );
          const labelHeight = (description ? 42 : 27) * scale;
          const photoSize =
            (place.photo ? latestRef.current.photos.size : 0) * scale;
          return [
            {
              id: String(index),
              anchor: { x: point.x * scale, y: point.y * scale },
              width: Math.max(labelWidth, photoSize),
              height: labelHeight + (place.photo ? photoSize + 6 * scale : 0),
            },
          ];
        });
        const routePoints = latestRef.current.route.coordinates.map(
          (coordinate) => {
            const point = map.project(coordinate);
            return { x: point.x * scale, y: point.y * scale };
          },
        );
        const exportPlacements = await computeLayoutInBackground(
          exportItems,
          routePoints,
          { width: canvas.width, height: canvas.height },
          {
            padding: 10 * scale,
            routeClearance: 8 * scale,
            viewportMargin: 8 * scale,
            minDistance: 18 * scale,
            maxDistance: 242 * scale,
            distanceStep: 32 * scale,
            optimizationPasses: 10,
            startingLayouts: 4,
          },
        );
        exportPlacements.forEach((placement) =>
          drawCanvasConnector(
            context,
            placement,
            latestRef.current.callouts,
            scale,
          ),
        );
        const placementById = new Map(
          exportPlacements.map((placement) => [placement.id, placement]),
        );

        for (const [placeIndex, place] of latestRef.current.places.entries()) {
          const point = map.project([place.lng, place.lat]);
          const x = point.x * scale;
          const y = point.y * scale;

          if (place.marker === "pin") {
            context.save();
            context.fillStyle = "#ffffff";
            context.font = `700 ${12 * scale}px Manrope, sans-serif`;
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(String(placeIndex + 1), x, y);
            context.restore();
          }

          if (!place.name && !place.photo) continue;

          const description =
            latestRef.current.labels.showDescriptions && place.description
              ? place.description.slice(0, 70)
              : "";
          context.font = `600 ${latestRef.current.labels.fontSize * scale}px Manrope, sans-serif`;
          const labelWidth = Math.min(
            260 * scale,
            Math.max(
              80 * scale,
              context.measureText(place.name).width + 18 * scale,
              description
                ? context.measureText(description).width + 18 * scale
                : 0,
            ),
          );
          const labelHeight = (description ? 42 : 27) * scale;
          const photoSize =
            (place.photo ? latestRef.current.photos.size : 0) * scale;
          const calloutWidth = Math.max(labelWidth, photoSize);
          const calloutHeight =
            labelHeight + (place.photo ? photoSize + 6 * scale : 0);

          const placement = placementById.get(String(placeIndex));
          if (!placement) continue;
          const centerX = (placement.box.left + placement.box.right) / 2;
          const calloutBottom = placement.box.bottom;
          const labelTop = calloutBottom - labelHeight;

          if (place.photo) {
            try {
              const image = await loadImage(place.photo.dataUrl);
              const size = photoSize;
              const photoX = centerX - size / 2;
              const photoY = labelTop - 6 * scale - size;
              context.save();
              const radius =
                ((latestRef.current.photos.radius / 100) * size) / 2;
              context.beginPath();
              context.roundRect(photoX, photoY, size, size, radius);
              context.clip();
              const imageRatio = image.width / image.height;
              const zoomed = place.photo.zoom;
              let sourceWidth = image.width / zoomed;
              let sourceHeight = image.height / zoomed;
              if (imageRatio > 1) sourceWidth = sourceHeight;
              else sourceHeight = sourceWidth;
              const sx =
                ((image.width - sourceWidth) * place.photo.cropX) / 100;
              const sy =
                ((image.height - sourceHeight) * place.photo.cropY) / 100;
              context.drawImage(
                image,
                sx,
                sy,
                sourceWidth,
                sourceHeight,
                photoX,
                photoY,
                size,
                size,
              );
              context.restore();
              context.strokeStyle = latestRef.current.photos.borderColor;
              context.lineWidth = latestRef.current.photos.borderWidth * scale;
              context.beginPath();
              context.roundRect(photoX, photoY, size, size, radius);
              context.stroke();
            } catch {
              /* A broken local image should not block the map export. */
            }
          }
          if (place.name) {
            context.font = `600 ${latestRef.current.labels.fontSize * scale}px Manrope, sans-serif`;
            context.fillStyle = latestRef.current.labels.backgroundColor;
            context.strokeStyle = latestRef.current.labels.borderColor;
            context.lineWidth = latestRef.current.labels.borderWidth * scale;
            context.beginPath();
            context.roundRect(
              centerX - labelWidth / 2,
              labelTop,
              labelWidth,
              labelHeight,
              latestRef.current.labels.radius * scale,
            );
            context.fill();
            context.stroke();
            context.textAlign = "center";
            context.fillStyle = latestRef.current.labels.textColor;
            context.fillText(
              place.name,
              centerX,
              calloutBottom - (description ? 23 : 9) * scale,
            );
            if (description) {
              context.font = `400 ${Math.max(10, latestRef.current.labels.fontSize - 2) * scale}px Manrope, sans-serif`;
              context.fillText(
                description,
                centerX,
                calloutBottom - 7 * scale,
                labelWidth - 12 * scale,
              );
            }
          }
        }
        let downloadCanvas = canvas;
        if (output) {
          downloadCanvas = document.createElement("canvas");
          downloadCanvas.width = output.width;
          downloadCanvas.height = output.height;
          const outputContext = downloadCanvas.getContext("2d");
          if (!outputContext) return;
          outputContext.fillStyle = "#f5f2ea";
          outputContext.fillRect(0, 0, output.width, output.height);
          const fitScale = Math.min(
            output.width / canvas.width,
            output.height / canvas.height,
          );
          const width = canvas.width * fitScale;
          const height = canvas.height * fitScale;
          outputContext.drawImage(
            canvas,
            (output.width - width) / 2,
            (output.height - height) / 2,
            width,
            height,
          );
        }
        try {
          await saveCanvas(downloadCanvas, format);
        } finally {
          if (output && stage) {
            stage.style.width = originalWidth;
            stage.style.height = originalHeight;
            map.resize();
            if (autoFit) fit();
          }
        }
      },
    }));

    return (
      <div className="map-stage">
        <div ref={containerRef} className="map-canvas" data-testid="map" />
        <svg
          ref={connectorRef}
          className="callout-connectors"
          aria-hidden="true"
        />
        <div
          ref={calloutLayerRef}
          className="callout-layer"
          aria-hidden="true"
        />
      </div>
    );
  },
);

JourneyMap.displayName = "JourneyMap";
