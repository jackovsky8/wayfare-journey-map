import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronUp,
  ChevronDown,
  Download,
  GripVertical,
  ImageDown,
  ImagePlus,
  FolderOpen,
  History,
  KeyRound,
  Layers3,
  LocateFixed,
  Map,
  MapPin,
  Palette,
  Plus,
  QrCode,
  Route,
  Scissors,
  Search,
  Share2,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import qrcode from "qrcode-generator";
import { JourneyMap, type JourneyMapHandle } from "./components/JourneyMap";
import {
  buildGpx,
  composeJourneyRoute,
  distanceBetween,
  downloadText,
  formatDistance,
  moveItem,
  parseGpx,
  resizeImage,
  splitTrackAtPlace,
} from "./lib/journey";
import {
  acceptQrFrame,
  createQrFrames,
  decodeJourney,
  encodeJourney,
} from "./lib/share";
import { applyDiff, createItemsDiff, type JourneyDiff } from "./lib/history";
import { createAnimatedQrGif } from "./lib/share-gif";
import { buildQrShareMessage } from "./lib/share-message";
import { BUILT_IN_MAPS, findMap } from "./lib/maps";
import {
  routeWithMapbox,
  routeWithOsrm,
  searchPlaces,
  type SearchResult,
} from "./lib/providers";
import type {
  AppSettings,
  GpxTrack,
  JourneyItem,
  JourneyDocument,
  MapSource,
  MapSourceKind,
  MarkerKind,
  PhotoAppearance,
  PhotoStyle,
  Place,
  RouteGeometry,
} from "./types";

const STORAGE_KEY = "wayfare.journey.v2";
const SETTINGS_KEY = "wayfare.settings.v2";
const LIBRARY_KEY = "wayfare.journeys.v3";
const ACTIVE_KEY = "wayfare.active-journey.v3";
const HISTORY_KEY = "wayfare.history.v1";
const emptyRoute: RouteGeometry = {
  coordinates: [],
  distanceMeters: 0,
  durationSeconds: 0,
};

const EXPORT_PRESETS = [
  {
    id: "screen",
    label: "Current map view",
    detail: "Same proportions as the editor",
    width: 0,
    height: 0,
  },
  {
    id: "a3-p",
    label: "A3 portrait",
    detail: "297 × 420 mm · print",
    width: 2806,
    height: 3969,
  },
  {
    id: "a3-l",
    label: "A3 landscape",
    detail: "420 × 297 mm · print",
    width: 3969,
    height: 2806,
  },
  {
    id: "a4-p",
    label: "A4 portrait",
    detail: "210 × 297 mm · print",
    width: 2480,
    height: 3508,
  },
  {
    id: "a4-l",
    label: "A4 landscape",
    detail: "297 × 210 mm · print",
    width: 3508,
    height: 2480,
  },
  {
    id: "a5-p",
    label: "A5 portrait",
    detail: "148 × 210 mm · print",
    width: 1748,
    height: 2480,
  },
  {
    id: "a5-l",
    label: "A5 landscape",
    detail: "210 × 148 mm · print",
    width: 2480,
    height: 1748,
  },
  {
    id: "letter-p",
    label: "US Letter portrait",
    detail: "8.5 × 11 in",
    width: 2550,
    height: 3300,
  },
  {
    id: "letter-l",
    label: "US Letter landscape",
    detail: "11 × 8.5 in",
    width: 3300,
    height: 2550,
  },
  {
    id: "book-square",
    label: "Photo book square",
    detail: "20 × 20 cm",
    width: 2362,
    height: 2362,
  },
  {
    id: "book-l",
    label: "Photo book landscape",
    detail: "28 × 21 cm",
    width: 3307,
    height: 2480,
  },
  {
    id: "photo-10x15",
    label: "Photo print portrait",
    detail: "10 × 15 cm",
    width: 1200,
    height: 1800,
  },
  {
    id: "photo-13x18",
    label: "Photo print",
    detail: "13 × 18 cm",
    width: 1560,
    height: 2160,
  },
  {
    id: "photo-20x30",
    label: "Photo poster",
    detail: "20 × 30 cm",
    width: 2400,
    height: 3600,
  },
  {
    id: "screen-16x9",
    label: "Full HD screen",
    detail: "16:9 · 1920 × 1080",
    width: 1920,
    height: 1080,
  },
  {
    id: "screen-4x3",
    label: "Classic screen",
    detail: "4:3 · 1600 × 1200",
    width: 1600,
    height: 1200,
  },
  {
    id: "screen-square",
    label: "Square screen",
    detail: "1:1 · 1600 × 1600",
    width: 1600,
    height: 1600,
  },
  {
    id: "screen-story",
    label: "Phone story",
    detail: "9:16 · 1080 × 1920",
    width: 1080,
    height: 1920,
  },
] as const;

const defaults: AppSettings = {
  mapStyle: "ofm-positron",
  routeColor: "#df5f3f",
  routeWidth: 5,
  autoFit: true,
  manualZoom: 7,
  provider: "osrm",
  mapboxToken: "",
  labels: {
    fontSize: 13,
    textColor: "#2b302a",
    backgroundColor: "#fffaf0",
    borderColor: "#df5f3f",
    borderWidth: 1,
    radius: 9,
    showDescriptions: true,
  },
  photos: {
    size: 112,
    borderWidth: 4,
    borderColor: "#fffaf0",
    radius: 18,
  },
  callouts: {
    connectorColor: "#df5f3f",
    connectorWidth: 2,
    connectorStyle: "curved",
  },
  customMaps: [],
};

const defaultPhoto = (dataUrl: string, fileName: string): PhotoStyle => ({
  dataUrl,
  fileName,
  cropX: 50,
  cropY: 50,
  zoom: 1,
});

function loadItems(): JourneyItem[] {
  try {
    const library = loadJourneyLibrary();
    if (library.length) {
      const active = localStorage.getItem(ACTIVE_KEY);
      return (library.find((journey) => journey.id === active) ?? library[0])
        .items;
    }
    const current = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]",
    ) as JourneyItem[];
    if (current.length) return current;
    const legacy = JSON.parse(
      localStorage.getItem("wayfare.journey.v1") || "[]",
    ) as Array<Partial<Place>>;
    return legacy.map((place) => ({
      ...place,
      id: place.id || crypto.randomUUID(),
      type: "place",
      name: place.name || "Untitled place",
      description: "",
      lat: place.lat || 0,
      lng: place.lng || 0,
      marker: place.marker || "pin",
    }));
  } catch {
    return [];
  }
}

function loadSettings(): AppSettings {
  try {
    const saved = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) || "{}",
    ) as Partial<AppSettings>;
    return {
      ...defaults,
      ...saved,
      labels: {
        ...defaults.labels,
        ...saved.labels,
      },
      photos: {
        ...defaults.photos,
        ...saved.photos,
      },
      callouts: {
        ...defaults.callouts,
        ...saved.callouts,
      },
      mapboxToken: sessionStorage.getItem("wayfare.mapbox") || "",
    };
  } catch {
    return defaults;
  }
}

function loadStoredSettings(): Omit<AppSettings, "mapboxToken"> {
  const { mapboxToken: _token, ...safe } = loadSettings();
  return safe;
}

type StoredJourney = JourneyDocument & {
  history: JourneyDiff[];
  settings?: Omit<AppSettings, "mapboxToken">;
};

function loadJourneyLibrary(): StoredJourney[] {
  try {
    return JSON.parse(
      localStorage.getItem(LIBRARY_KEY) || "[]",
    ) as StoredJourney[];
  } catch {
    return [];
  }
}

function initialJourney(): StoredJourney {
  const library = loadJourneyLibrary();
  if (library.length) {
    const active = localStorage.getItem(ACTIVE_KEY);
    return library.find((journey) => journey.id === active) ?? library[0];
  }
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "My journey",
    items: loadItems(),
    createdAt: now,
    updatedAt: now,
    history: [],
    settings: loadStoredSettings(),
  };
}

export function App() {
  const [journey, setJourney] = useState<StoredJourney>(initialJourney);
  const journeyRef = useRef(journey);
  journeyRef.current = journey;
  const items = journey.items;
  const [journeysOpen, setJourneysOpen] = useState(false);
  const [, setLibraryRevision] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [qrPlaying, setQrPlaying] = useState(false);
  const [qrFrameIndex, setQrFrameIndex] = useState(0);
  const [qrScanning, setQrScanning] = useState(false);
  const [qrProgress, setQrProgress] = useState(0);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [privacySettingsOpen, setPrivacySettingsOpen] = useState(false);
  const [route, setRoute] = useState<RouteGeometry>(emptyRoute);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg" | "webp">(
    "png",
  );
  const [exportPreset, setExportPreset] = useState("screen");
  const [editingPlace, setEditingPlace] = useState<string | null>(null);
  const [editingTrack, setEditingTrack] = useState<string | null>(null);
  const [trackQuery, setTrackQuery] = useState("");
  const [trackResults, setTrackResults] = useState<SearchResult[]>([]);
  const [shareOpen, setShareOpen] = useState(() =>
    new URLSearchParams(location.search).has("import"),
  );
  const [sharingGif, setSharingGif] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(
    () => matchMedia("(pointer: coarse)").matches,
  );
  const [routeStatus, setRouteStatus] = useState<
    "idle" | "routing" | "fallback"
  >("idle");
  const [notice, setNotice] = useState("");
  const [dragged, setDragged] = useState<number | null>(null);
  const [newMap, setNewMap] = useState({
    name: "",
    kind: "style" as MapSourceKind,
    url: "",
    attribution: "",
  });
  const mapRef = useRef<JourneyMapHandle>(null);
  const gpxInputRef = useRef<HTMLInputElement>(null);
  const scannerVideoRef = useRef<HTMLVideoElement>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const qrFramesRef = useRef(new globalThis.Map<number, string>());
  const qrTransferRef = useRef<string | undefined>(undefined);

  const places = useMemo(
    () => items.filter((item): item is Place => item.type === "place"),
    [items],
  );
  const mapPlaces = useMemo(
    () =>
      items.flatMap((item) =>
        item.type === "place"
          ? [item]
          : [item.startPlace, item.endPlace].filter((place): place is Place =>
              Boolean(place),
            ),
      ),
    [items],
  );
  const tracks = items.filter((item) => item.type === "track");
  const allMaps = [...BUILT_IN_MAPS, ...settings.customMaps];
  const activeMap = findMap(settings.mapStyle, settings.customMaps);
  const activePlace = places.find((place) => place.id === editingPlace);
  const activeTrack = items.find(
    (item): item is GpxTrack =>
      item.type === "track" && item.id === editingTrack,
  );
  const safeSettings = useMemo(() => {
    const { mapboxToken: _token, ...safe } = settings;
    return safe;
  }, [settings]);
  const serializedJourney = useMemo(
    () =>
      encodeJourney({
        version: 2,
        name: journey.name,
        items,
        settings: safeSettings,
      }),
    [items, journey.name, safeSettings],
  );
  const qrFrames = useMemo(
    () => createQrFrames(serializedJourney),
    [serializedJourney],
  );
  const qrDataUrl = useMemo(() => {
    try {
      const qr = qrcode(0, "M");
      qr.addData(qrFrames[qrFrameIndex % qrFrames.length], "Byte");
      qr.make();
      return qr.createDataURL(5, 8);
    } catch {
      return "";
    }
  }, [qrFrames, qrFrameIndex]);

  const commitItems = (
    updater: JourneyItem[] | ((current: JourneyItem[]) => JourneyItem[]),
    label = "Edit journey",
  ) => {
    const current = journeyRef.current;
    const nextItems =
      typeof updater === "function" ? updater(current.items) : updater;
    const diff = createItemsDiff(current.items, nextItems, label);
    if (!diff) return;
    window.history.pushState({ wayfare: diff.id }, "");
    const next = {
      ...current,
      items: nextItems,
      updatedAt: new Date().toISOString(),
      history: [...current.history, diff].slice(-200),
    };
    journeyRef.current = next;
    setJourney(next);
  };

  const undo = () => {
    const current = journeyRef.current;
    const diff = current.history.at(-1);
    if (!diff) return;
    const next = {
      ...current,
      items: applyDiff(current.items, diff, "backward"),
      updatedAt: new Date().toISOString(),
      history: current.history.slice(0, -1),
    };
    journeyRef.current = next;
    setJourney(next);
  };

  useEffect(() => {
    const media = matchMedia("(pointer: coarse)");
    const update = () => setCoarsePointer(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    try {
      const { mapboxToken: _token, ...journeySettings } = settings;
      const persisted = { ...journey, settings: journeySettings };
      const library = loadJourneyLibrary();
      const next = library.some((entry) => entry.id === journey.id)
        ? library.map((entry) => (entry.id === journey.id ? persisted : entry))
        : [...library, persisted];
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
      localStorage.setItem(ACTIVE_KEY, journey.id);
    } catch {
      setNotice(
        "Browser storage is full. Remove some photographs or export your journey before continuing.",
      );
    }
  }, [journey, settings]);
  useEffect(() => {
    const { mapboxToken: _token, ...safe } = settings;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(safe));
    sessionStorage.setItem("wayfare.mapbox", settings.mapboxToken);
  }, [settings]);

  useEffect(() => {
    const onPopState = () => undo();
    addEventListener("popstate", onPopState);
    return () => removeEventListener("popstate", onPopState);
  });

  useEffect(() => {
    if (!qrPlaying || qrFrames.length < 2) return;
    const interval = window.setInterval(
      () => setQrFrameIndex((current) => (current + 1) % qrFrames.length),
      550,
    );
    return () => clearInterval(interval);
  }, [qrPlaying, qrFrames.length]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setSearching(true);
        setResults(await searchPlaces(query, controller.signal));
      } catch (error) {
        if (!controller.signal.aborted)
          setNotice(error instanceof Error ? error.message : "Search failed.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!editingTrack || trackQuery.trim().length < 2) {
      setTrackResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void searchPlaces(trackQuery, controller.signal)
        .then(setTrackResults)
        .catch(() => setTrackResults([]));
    }, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [trackQuery, editingTrack]);

  useEffect(() => {
    const controller = new AbortController();
    const connect = async (
      from: [number, number],
      to: [number, number],
    ): Promise<RouteGeometry> => {
      if (from[0] === to[0] && from[1] === to[1])
        return { coordinates: [from], distanceMeters: 0, durationSeconds: 0 };
      const endpoints: Place[] = [
        {
          id: "from",
          type: "place",
          name: "",
          description: "",
          marker: "route",
          lng: from[0],
          lat: from[1],
        },
        {
          id: "to",
          type: "place",
          name: "",
          description: "",
          marker: "route",
          lng: to[0],
          lat: to[1],
        },
      ];
      try {
        return settings.provider === "mapbox" && settings.mapboxToken
          ? await routeWithMapbox(
              endpoints,
              settings.mapboxToken,
              controller.signal,
            )
          : await routeWithOsrm(endpoints, controller.signal);
      } catch {
        return {
          coordinates: [from, to],
          distanceMeters: distanceBetween(from, to),
          durationSeconds: 0,
        };
      }
    };
    const timeout = window.setTimeout(async () => {
      if (!items.length) {
        setRoute(emptyRoute);
        return;
      }
      setRouteStatus("routing");
      try {
        setRoute(await composeJourneyRoute(items, connect));
        setRouteStatus("idle");
      } catch {
        if (!controller.signal.aborted) setRouteStatus("fallback");
      }
    }, 220);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [items, settings.provider, settings.mapboxToken]);

  const updatePlace = (id: string, patch: Partial<Place>) =>
    commitItems(
      (current) =>
        current.map((item) =>
          item.id === id && item.type === "place"
            ? { ...item, ...patch }
            : item,
        ),
      "Edit place",
    );

  const updateTrack = (id: string, patch: Partial<GpxTrack>) =>
    commitItems(
      (current) =>
        current.map((item) =>
          item.id === id && item.type === "track"
            ? { ...item, ...patch }
            : item,
        ),
      "Edit GPX track",
    );

  const endpointFor = (track: GpxTrack, end: "start" | "end"): Place => {
    const coordinate =
      end === "start"
        ? track.coordinates[0]
        : track.coordinates[track.coordinates.length - 1];
    return {
      id: `${track.id}-${end}`,
      type: "place",
      name: end === "start" ? `${track.name} start` : `${track.name} end`,
      description: "",
      lng: coordinate[0],
      lat: coordinate[1],
      marker: "pin",
    };
  };

  const cutTrack = (track: GpxTrack, result: SearchResult) => {
    try {
      const split = splitTrackAtPlace(track, {
        id: crypto.randomUUID(),
        type: "place",
        ...result,
        description: "",
        marker: "pin",
      });
      commitItems(
        (current) =>
          current.flatMap((item) => (item.id === track.id ? split : [item])),
        `Split ${track.name}`,
      );
      setEditingTrack(null);
      setTrackQuery("");
      setNotice(
        `Split “${track.name}” at the track point closest to ${result.name}.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The track could not be split.",
      );
    }
  };

  const addPlace = (result: SearchResult) => {
    const place: Place = {
      id: crypto.randomUUID(),
      type: "place",
      ...result,
      description: "",
      marker: "pin",
    };
    commitItems((current) => {
      const copy = [...current];
      copy.splice(insertAt ?? current.length, 0, place);
      return copy;
    }, `Add ${place.name}`);
    setQuery("");
    setResults([]);
    setInsertAt(null);
    setEditingPlace(place.id);
  };

  const importGpx = async (file?: File) => {
    if (!file) return;
    try {
      const track = parseGpx(await file.text(), file.name);
      commitItems((current) => {
        const copy = [...current];
        copy.splice(insertAt ?? current.length, 0, track);
        return copy;
      }, `Import ${track.name}`);
      setInsertAt(null);
      setNotice(
        `Added “${track.name}” with ${track.coordinates.length.toLocaleString()} track points.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The GPX track could not be imported.",
      );
    }
  };

  const addPhoto = async (place: Place, file?: File) => {
    if (!file) return;
    try {
      updatePlace(place.id, {
        photo: defaultPhoto(await resizeImage(file), file.name),
      });
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "The photograph could not be added.",
      );
    }
  };

  const addCustomMap = () => {
    if (!newMap.name.trim() || !newMap.url.trim()) {
      setNotice("Give the map a name and URL before adding it.");
      return;
    }
    if (newMap.kind === "raster" && !newMap.url.includes("{z}")) {
      setNotice(
        "A raster XYZ URL must include {z}, {x}, and {y} placeholders.",
      );
      return;
    }
    const map: MapSource = {
      id: `custom-${crypto.randomUUID()}`,
      name: newMap.name.trim(),
      description: "Your custom map source.",
      kind: newMap.kind,
      url: newMap.url.trim(),
      attribution: newMap.attribution.trim() || "Custom map provider",
    };
    setSettings((current) => ({
      ...current,
      customMaps: [...current.customMaps, map],
      mapStyle: map.id,
    }));
    setNewMap({ name: "", kind: "style", url: "", attribution: "" });
  };

  const importSerializedJourney = (encoded: string) => {
    try {
      const decoded = decodeJourney(encoded.trim());
      const now = new Date().toISOString();
      setJourney({
        id: crypto.randomUUID(),
        name: decoded.name,
        items: decoded.items,
        createdAt: now,
        updatedAt: now,
        history: [],
      });
      setSettings((current) => ({
        ...defaults,
        ...decoded.settings,
        labels: { ...defaults.labels, ...decoded.settings.labels },
        photos: { ...defaults.photos, ...decoded.settings.photos },
        callouts: { ...defaults.callouts, ...decoded.settings.callouts },
        mapboxToken: current.mapboxToken,
      }));
      setImportCode("");
      setShareOpen(false);
      setNotice(`Imported “${decoded.name}” as a new journey.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Import failed.");
    }
  };

  const createJourney = () => {
    const now = new Date().toISOString();
    setJourney({
      id: crypto.randomUUID(),
      name: "New journey",
      items: [],
      createdAt: now,
      updatedAt: now,
      history: [],
      settings: safeSettings,
    });
    setJourneysOpen(false);
  };

  const selectJourney = (selected: StoredJourney) => {
    setJourney(selected);
    if (selected.settings)
      setSettings((current) => ({
        ...defaults,
        ...selected.settings,
        labels: { ...defaults.labels, ...selected.settings?.labels },
        photos: { ...defaults.photos, ...selected.settings?.photos },
        callouts: { ...defaults.callouts, ...selected.settings?.callouts },
        mapboxToken: current.mapboxToken,
      }));
    setJourneysOpen(false);
  };

  const deleteJourney = (id: string) => {
    const remaining = loadJourneyLibrary().filter((entry) => entry.id !== id);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(remaining));
    setLibraryRevision((current) => current + 1);
    if (id === journey.id) {
      if (remaining.length) setJourney(remaining[0]);
      else createJourney();
    }
  };

  const startQrScanner = async () => {
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect: (
            source: HTMLVideoElement,
          ) => Promise<Array<{ rawValue: string }>>;
        };
      }
    ).BarcodeDetector;
    if (!Detector) {
      setNotice(
        "This browser cannot scan QR codes inside the page. Use the copy and paste journey code instead.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      scannerStreamRef.current = stream;
      setQrScanning(true);
      qrFramesRef.current.clear();
      qrTransferRef.current = undefined;
      await new Promise((resolve) => setTimeout(resolve, 0));
      const video = scannerVideoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      const detector = new Detector({ formats: ["qr_code"] });
      const scan = async () => {
        if (!video.srcObject) return;
        try {
          for (const code of await detector.detect(video)) {
            const result = acceptQrFrame(
              qrFramesRef.current,
              code.rawValue,
              qrTransferRef.current,
            );
            qrTransferRef.current = result.frame.transferId;
            setQrProgress(qrFramesRef.current.size / result.frame.total);
            if (result.complete) {
              stream.getTracks().forEach((track) => track.stop());
              scannerStreamRef.current = null;
              setQrScanning(false);
              importSerializedJourney(result.value);
              return;
            }
          }
        } catch {
          // Other QR codes and repeated frames are safe to ignore.
        }
        requestAnimationFrame(() => void scan());
      };
      void scan();
    } catch {
      setQrScanning(false);
      setNotice(
        "Camera access was not available. Paste the journey code instead.",
      );
    }
  };

  const shareAnimatedQr = async () => {
    setSharingGif(true);
    try {
      const blob = await createAnimatedQrGif(qrFrames);
      const fileName = `${journey.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "journey"}-wayfare-qr.gif`;
      const file = new File([blob], fileName, { type: "image/gif" });
      const shareMessage = buildQrShareMessage(
        import.meta.env.VITE_PUBLIC_SITE_URL,
        location.href,
      );
      if (
        navigator.share &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        try {
          await navigator.share({
            title: `Wayfare journey: ${journey.name}`,
            text: shareMessage.text,
            url: shareMessage.importUrl,
            files: [file],
          });
          return;
        } catch (error) {
          if ((error as DOMException).name === "AbortError") return;
          // Some browsers report file sharing support but reject mixed
          // file-and-link payloads. Continue with download + copied link.
        }
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      await navigator.clipboard.writeText(shareMessage.text);
      setNotice(
        "The animated QR GIF was downloaded and the complete sharing instructions were copied. Attach the GIF and paste the text in WhatsApp, Signal, or another messenger.",
      );
    } catch (error) {
      if ((error as DOMException).name !== "AbortError")
        setNotice(
          error instanceof Error
            ? error.message
            : "The QR GIF could not be shared.",
        );
    } finally {
      setSharingGif(false);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Route size={18} />
          </span>
          <span>Wayfare</span>
        </div>
        <div className="top-actions">
          <button
            className="button ghost"
            onClick={() => setJourneysOpen(true)}
            aria-label="My journeys"
          >
            <FolderOpen size={17} />
            <span>My journeys</span>
          </button>
          <button
            className="button ghost"
            onClick={() => setHistoryOpen(true)}
            aria-label="Journey history"
          >
            <History size={17} />
            <span>History</span>
          </button>
          <button
            className="button ghost"
            onClick={undo}
            disabled={!journey.history.length}
            aria-label="Undo last change"
          >
            <Undo2 size={17} />
            <span>Undo</span>
          </button>
          <button
            className="button ghost"
            onClick={() => setHelpOpen(true)}
            aria-label="Help"
          >
            <BookOpen size={17} />
            <span>Help</span>
          </button>
          <button
            className="button ghost"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
          >
            <Settings2 size={17} />
            <span>Settings</span>
          </button>
          <button
            className="button ghost"
            onClick={() => setShareOpen(true)}
            aria-label="Share journey"
            disabled={!items.length}
          >
            <Share2 size={17} />
            <span>Share</span>
          </button>
          <button
            className="button dark"
            onClick={() => setExportOpen(true)}
            disabled={!items.length}
          >
            <Download size={17} />
            Export
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="journey-panel">
          <div className="panel-heading">
            <p className="eyebrow">Journey builder</p>
            <input
              className="journey-name"
              aria-label="Journey name"
              value={journey.name}
              onChange={(event) =>
                setJourney((current) => ({
                  ...current,
                  name: event.target.value,
                  updatedAt: new Date().toISOString(),
                }))
              }
            />
            <p>
              Mix places with recorded GPX tracks, then add notes and
              photographs.
            </p>
          </div>
          <div className="builder-actions">
            <div className="search-wrap">
              <Search size={19} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  items.length
                    ? "Add another place…"
                    : "Start with a city or landmark…"
                }
                aria-label="Search for a place"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search">
                  <X size={16} />
                </button>
              )}
              {(query.length >= 2 || searching) && (
                <div className="search-results" role="listbox">
                  {searching && (
                    <div className="search-state">Searching the map…</div>
                  )}
                  {!searching &&
                    results.map((result) => (
                      <button
                        role="option"
                        key={`${result.lat}-${result.lng}`}
                        onClick={() => addPlace(result)}
                      >
                        <MapPin size={17} />
                        <span>
                          <strong>{result.name}</strong>
                          <small>{result.subtitle}</small>
                        </span>
                      </button>
                    ))}
                  {!searching && !results.length && (
                    <div className="search-state">
                      No places found. Try a broader name.
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              className="gpx-button"
              onClick={() => gpxInputRef.current?.click()}
            >
              <Upload size={17} />
              Import GPX
            </button>
            <input
              ref={gpxInputRef}
              className="visually-hidden"
              type="file"
              accept=".gpx,application/gpx+xml"
              onChange={(event) => {
                void importGpx(event.target.files?.[0]);
                event.target.value = "";
              }}
              aria-label="Import GPX track"
            />
          </div>
          {insertAt !== null && (
            <div className="insert-note">
              <Plus size={14} />
              Adding at position {insertAt + 1}
              <button onClick={() => setInsertAt(null)}>Cancel</button>
            </div>
          )}

          <div className="stops" aria-label="Journey items">
            {!items.length ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Map size={23} />
                </div>
                <strong>Your journey starts here</strong>
                <span>Search for a place or import a GPX track.</span>
              </div>
            ) : (
              items.map((item, index) => (
                <div key={item.id}>
                  <article
                    className={`stop-card ${item.type === "track" ? "track-card" : ""} ${dragged === index ? "dragging" : ""}`}
                    draggable={!coarsePointer}
                    onDragStart={() => setDragged(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragged !== null)
                        commitItems(
                          moveItem(items, dragged, index),
                          `Move ${item.name}`,
                        );
                      setDragged(null);
                    }}
                  >
                    <GripVertical className="drag-handle" size={18} />
                    <div
                      className="mobile-reorder"
                      aria-label={`Reorder ${item.name}`}
                    >
                      <button
                        disabled={index === 0}
                        onClick={() =>
                          commitItems(
                            moveItem(items, index, index - 1),
                            `Move ${item.name} up`,
                          )
                        }
                        aria-label={`Move ${item.name} up`}
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        disabled={index === items.length - 1}
                        onClick={() =>
                          commitItems(
                            moveItem(items, index, index + 1),
                            `Move ${item.name} down`,
                          )
                        }
                        aria-label={`Move ${item.name} down`}
                      >
                        <ChevronDown size={15} />
                      </button>
                    </div>
                    <span className="stop-number">
                      {item.type === "track" ? <Route size={14} /> : index + 1}
                    </span>
                    <div className="stop-copy">
                      <input
                        value={item.name}
                        onChange={(event) =>
                          commitItems(
                            (current) =>
                              current.map((entry) =>
                                entry.id === item.id
                                  ? { ...entry, name: event.target.value }
                                  : entry,
                              ),
                            `Rename ${item.name}`,
                          )
                        }
                        aria-label={`Name for item ${index + 1}`}
                      />
                      <small>
                        {item.type === "track"
                          ? `${item.coordinates.length.toLocaleString()} GPX points · connected at both ends`
                          : item.description ||
                            item.subtitle ||
                            "Add a story and photograph"}
                      </small>
                    </div>
                    <button
                      className="mini-button"
                      onClick={() =>
                        item.type === "place"
                          ? setEditingPlace(item.id)
                          : setEditingTrack(item.id)
                      }
                    >
                      <SlidersHorizontal size={14} />
                      Edit
                    </button>
                    <button
                      className="icon-button danger"
                      onClick={() =>
                        commitItems(
                          (current) =>
                            current.filter((entry) => entry.id !== item.id),
                          `Delete ${item.name}`,
                        )
                      }
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                  {index < items.length - 1 && (
                    <button
                      className="insert-button"
                      onClick={() => setInsertAt(index + 1)}
                    >
                      <Plus size={13} />
                      Insert place or GPX here
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          {!!items.length && (
            <div className="journey-summary">
              <div>
                <span>Distance</span>
                <strong>{formatDistance(route.distanceMeters)}</strong>
              </div>
              <div>
                <span>Places</span>
                <strong>{places.length}</strong>
              </div>
              <div>
                <span>Tracks</span>
                <strong>{tracks.length}</strong>
              </div>
            </div>
          )}
        </aside>

        <section className="map-panel">
          <JourneyMap
            ref={mapRef}
            places={mapPlaces}
            route={route}
            mapSource={activeMap}
            routeColor={settings.routeColor}
            routeWidth={settings.routeWidth}
            autoFit={settings.autoFit}
            zoom={settings.manualZoom}
            labels={settings.labels}
            photos={settings.photos}
            callouts={settings.callouts}
            suspendLayout={settingsOpen}
          />
          <div className="map-toolbar">
            <select
              value={settings.mapStyle}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  mapStyle: event.target.value,
                }))
              }
              aria-label="Map style"
            >
              <optgroup label="Free built-in maps">
                {BUILT_IN_MAPS.map((map) => (
                  <option value={map.id} key={map.id}>
                    {map.name}
                  </option>
                ))}
              </optgroup>
              {!!settings.customMaps.length && (
                <optgroup label="Your maps">
                  {settings.customMaps.map((map) => (
                    <option value={map.id} key={map.id}>
                      {map.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button onClick={() => mapRef.current?.fit()}>
              <LocateFixed size={16} />
              Fit journey
            </button>
          </div>
          <div className="map-credit">{activeMap.description}</div>
          {routeStatus === "routing" && (
            <div className="routing-pill">Connecting journey…</div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button onClick={() => setNotice("")} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          )}
          {!items.length && (
            <div className="map-prompt">
              <MapPin size={22} />
              <span>Your journey will appear here</span>
            </div>
          )}
        </section>
      </section>

      {activePlace && (
        <Modal
          title="Place details"
          eyebrow="Story & photograph"
          onClose={() => setEditingPlace(null)}
        >
          <div className="place-editor">
            <label>
              Place name
              <input
                value={activePlace.name}
                onChange={(event) =>
                  updatePlace(activePlace.id, { name: event.target.value })
                }
              />
            </label>
            <label>
              Description
              <textarea
                rows={3}
                value={activePlace.description}
                onChange={(event) =>
                  updatePlace(activePlace.id, {
                    description: event.target.value,
                  })
                }
                placeholder="What made this stop memorable?"
              />
            </label>
            <label>
              Map marker
              <select
                aria-label="Place marker type"
                value={activePlace.marker}
                onChange={(event) =>
                  updatePlace(activePlace.id, {
                    marker: event.target.value as MarkerKind,
                  })
                }
              >
                <option value="pin">Numbered pin</option>
                <option value="dot">Small dot</option>
                <option value="route">Route only</option>
              </select>
            </label>
            <div className="photo-editor">
              <div className="section-heading">
                <ImagePlus size={18} />
                <div>
                  <strong>Photograph</strong>
                  <small>
                    Images are resized and stored only in this browser.
                  </small>
                </div>
              </div>
              <label className="upload-zone">
                {activePlace.photo ? "Replace photograph" : "Choose photograph"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    void addPhoto(activePlace, event.target.files?.[0])
                  }
                />
              </label>
              {activePlace.photo && (
                <>
                  <div
                    className="photo-preview"
                    style={{
                      width: settings.photos.size,
                      height: settings.photos.size,
                      border: `${settings.photos.borderWidth}px solid ${settings.photos.borderColor}`,
                      borderRadius: `${settings.photos.radius}%`,
                      backgroundImage: `url("${activePlace.photo.dataUrl}")`,
                      backgroundSize: `${activePlace.photo.zoom * 100}%`,
                      backgroundPosition: `${activePlace.photo.cropX}% ${activePlace.photo.cropY}%`,
                    }}
                  />
                  <Slider
                    label="Crop left/right"
                    min={0}
                    max={100}
                    value={activePlace.photo.cropX}
                    onChange={(value) =>
                      updatePlace(activePlace.id, {
                        photo: { ...activePlace.photo!, cropX: value },
                      })
                    }
                  />
                  <Slider
                    label="Crop up/down"
                    min={0}
                    max={100}
                    value={activePlace.photo.cropY}
                    onChange={(value) =>
                      updatePlace(activePlace.id, {
                        photo: { ...activePlace.photo!, cropY: value },
                      })
                    }
                  />
                  <Slider
                    label="Photo zoom"
                    min={1}
                    max={3}
                    step={0.1}
                    value={activePlace.photo.zoom}
                    onChange={(value) =>
                      updatePlace(activePlace.id, {
                        photo: { ...activePlace.photo!, zoom: value },
                      })
                    }
                  />
                  <p className="field-help">
                    Size, frame, and rounding are shared by all photographs.
                    Change them in Settings → Photograph style.
                  </p>
                  <button
                    className="text-danger"
                    onClick={() =>
                      updatePlace(activePlace.id, { photo: undefined })
                    }
                  >
                    Remove photograph
                  </button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {settingsOpen && (
        <Modal
          title="Settings"
          eyebrow="Make it yours"
          onClose={() => setSettingsOpen(false)}
          wide
        >
          <div className="settings-groups">
            <SettingGroup
              icon={<Layers3 />}
              title="Map background"
              description="Choose the visual foundation beneath your journey."
              open
            >
              <label>
                Map style
                <select
                  value={settings.mapStyle}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      mapStyle: event.target.value,
                    }))
                  }
                >
                  {allMaps.map((map) => (
                    <option value={map.id} key={map.id}>
                      {map.name} — {map.description}
                    </option>
                  ))}
                </select>
              </label>
              <p className="field-help">
                The built-in styles are free and need no key. Public services
                may have fair-use limits and no uptime guarantee.
              </p>
            </SettingGroup>
            <SettingGroup
              icon={<Palette />}
              title="Route appearance"
              description="Controls the line connecting every place and GPX track."
            >
              <ColorField
                label="Route color"
                value={settings.routeColor}
                onChange={(value) =>
                  setSettings((current) => ({ ...current, routeColor: value }))
                }
              />
              <Slider
                label="Route width"
                min={2}
                max={12}
                value={settings.routeWidth}
                suffix="px"
                onChange={(value) =>
                  setSettings((current) => ({ ...current, routeWidth: value }))
                }
              />
              <label className="check-row">
                <span>
                  <strong>Automatically fit journey</strong>
                  <small>Keep all journey items inside the map frame.</small>
                </span>
                <input
                  aria-label="Automatically fit journey"
                  type="checkbox"
                  checked={settings.autoFit}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      autoFit: event.target.checked,
                    }))
                  }
                />
              </label>
              {!settings.autoFit && (
                <Slider
                  label="Manual zoom"
                  min={2}
                  max={16}
                  value={settings.manualZoom}
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      manualZoom: value,
                    }))
                  }
                />
              )}
            </SettingGroup>
            <SettingGroup
              icon={<Type />}
              title="Place labels"
              description="Sets the default caption style for every place."
            >
              <Slider
                label="Text size"
                min={10}
                max={24}
                value={settings.labels.fontSize}
                suffix="px"
                onChange={(value) =>
                  setSettings((current) => ({
                    ...current,
                    labels: { ...current.labels, fontSize: value },
                  }))
                }
              />
              <div className="two-fields">
                <ColorField
                  label="Text"
                  value={settings.labels.textColor}
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      labels: { ...current.labels, textColor: value },
                    }))
                  }
                />
                <ColorField
                  label="Background"
                  value={settings.labels.backgroundColor}
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      labels: { ...current.labels, backgroundColor: value },
                    }))
                  }
                />
              </div>
              <div className="two-fields">
                <ColorField
                  label="Border"
                  value={settings.labels.borderColor}
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      labels: { ...current.labels, borderColor: value },
                    }))
                  }
                />
                <Slider
                  label="Border width"
                  min={0}
                  max={6}
                  value={settings.labels.borderWidth}
                  suffix="px"
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      labels: { ...current.labels, borderWidth: value },
                    }))
                  }
                />
              </div>
              <Slider
                label="Corner roundness"
                min={0}
                max={24}
                value={settings.labels.radius}
                suffix="px"
                onChange={(value) =>
                  setSettings((current) => ({
                    ...current,
                    labels: { ...current.labels, radius: value },
                  }))
                }
              />
              <label className="check-row">
                <span>
                  <strong>Show descriptions</strong>
                  <small>Include each place’s story below its name.</small>
                </span>
                <input
                  aria-label="Show place descriptions"
                  type="checkbox"
                  checked={settings.labels.showDescriptions}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      labels: {
                        ...current.labels,
                        showDescriptions: event.target.checked,
                      },
                    }))
                  }
                />
              </label>
            </SettingGroup>
            <SettingGroup
              icon={<ImagePlus />}
              title="Photograph style"
              description="Applies one consistent photograph design to the editor, map, and exported image."
            >
              <p className="field-help">
                These settings apply to every photograph. Only crop position and
                zoom are stored separately for each image.
              </p>
              <Slider
                label="Photo size"
                min={70}
                max={220}
                value={settings.photos.size}
                suffix="px"
                onChange={(value) =>
                  setSettings((current) => ({
                    ...current,
                    photos: { ...current.photos, size: value },
                  }))
                }
              />
              <div className="two-fields">
                <ColorField
                  label="Frame color"
                  value={settings.photos.borderColor}
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      photos: { ...current.photos, borderColor: value },
                    }))
                  }
                />
                <Slider
                  label="Frame width"
                  min={0}
                  max={12}
                  value={settings.photos.borderWidth}
                  suffix="px"
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      photos: { ...current.photos, borderWidth: value },
                    }))
                  }
                />
              </div>
              <Slider
                label="Photo corner roundness"
                min={0}
                max={50}
                value={settings.photos.radius}
                suffix="%"
                onChange={(value) =>
                  setSettings((current) => ({
                    ...current,
                    photos: { ...current.photos, radius: value },
                  }))
                }
              />
            </SettingGroup>
            <SettingGroup
              icon={<LocateFixed />}
              title="Callout placement & connectors"
              description="Keeps labels and photographs clear of the route and links them to their places."
            >
              <p className="field-help">
                Wayfare searches outward from every place for the nearest free
                position. It avoids the route, map edges, and other callouts.
              </p>
              <div className="two-fields">
                <ColorField
                  label="Arrow color"
                  value={settings.callouts.connectorColor}
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      callouts: { ...current.callouts, connectorColor: value },
                    }))
                  }
                />
                <Slider
                  label="Arrow width"
                  min={1}
                  max={6}
                  value={settings.callouts.connectorWidth}
                  suffix="px"
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      callouts: { ...current.callouts, connectorWidth: value },
                    }))
                  }
                />
              </div>
              <label>
                Arrow style
                <select
                  aria-label="Arrow style"
                  value={settings.callouts.connectorStyle}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      callouts: {
                        ...current.callouts,
                        connectorStyle: event.target
                          .value as AppSettings["callouts"]["connectorStyle"],
                      },
                    }))
                  }
                >
                  <option value="curved">Soft curve</option>
                  <option value="straight">Straight</option>
                  <option value="dashed">Dashed</option>
                </select>
              </label>
            </SettingGroup>
            <SettingGroup
              icon={<Plus />}
              title="Add another map"
              description="Connect any compatible hosted map without changing the source code."
            >
              <div className="custom-map-guide">
                <p>
                  <strong>MapLibre style JSON</strong> is best for vector maps
                  and complete themes. Paste a URL such as{" "}
                  <code>https://tiles.openfreemap.org/styles/liberty</code>.
                </p>
                <p>
                  <strong>Raster XYZ</strong> is for image tiles. Its URL must
                  contain <code>{"{z}/{x}/{y}"}</code>, for example{" "}
                  <code>
                    https://tile.openstreetmap.org/{"{z}/{x}/{y}"}.png
                  </code>
                  .
                </p>
                <p>
                  Add the provider’s required attribution. If the URL contains
                  an API key, it will be visible to visitors and saved in this
                  browser—restrict it to your website’s domain.
                </p>
              </div>
              <div className="two-fields">
                <label>
                  Name
                  <input
                    aria-label="Custom map name"
                    value={newMap.name}
                    onChange={(event) =>
                      setNewMap((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="My outdoor map"
                  />
                </label>
                <label>
                  Source type
                  <select
                    value={newMap.kind}
                    onChange={(event) =>
                      setNewMap((current) => ({
                        ...current,
                        kind: event.target.value as MapSourceKind,
                      }))
                    }
                  >
                    <option value="style">MapLibre style JSON</option>
                    <option value="raster">Raster XYZ tiles</option>
                  </select>
                </label>
              </div>
              <label>
                Map URL
                <input
                  value={newMap.url}
                  onChange={(event) =>
                    setNewMap((current) => ({
                      ...current,
                      url: event.target.value,
                    }))
                  }
                  placeholder={
                    newMap.kind === "style"
                      ? "https://…/style.json"
                      : "https://…/{z}/{x}/{y}.png"
                  }
                />
              </label>
              <label>
                Attribution
                <input
                  value={newMap.attribution}
                  onChange={(event) =>
                    setNewMap((current) => ({
                      ...current,
                      attribution: event.target.value,
                    }))
                  }
                  placeholder="© Provider © OpenStreetMap contributors"
                />
              </label>
              <button className="button dark" onClick={addCustomMap}>
                Add and select map
              </button>
              {!!settings.customMaps.length && (
                <div className="custom-map-list">
                  {settings.customMaps.map((map) => (
                    <div key={map.id}>
                      <span>
                        <strong>{map.name}</strong>
                        <small>
                          {map.kind === "style"
                            ? "Vector style"
                            : "Raster tiles"}
                        </small>
                      </span>
                      <button
                        className="icon-button danger"
                        onClick={() =>
                          setSettings((current) => ({
                            ...current,
                            mapStyle:
                              current.mapStyle === map.id
                                ? defaults.mapStyle
                                : current.mapStyle,
                            customMaps: current.customMaps.filter(
                              (entry) => entry.id !== map.id,
                            ),
                          }))
                        }
                        aria-label={`Remove ${map.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </SettingGroup>
            <SettingGroup
              icon={<KeyRound />}
              title="Optional routing provider"
              description="OSRM works without a key. Mapbox is an alternative for your own account."
            >
              <label>
                Mapbox public token
                <input
                  type="password"
                  value={settings.mapboxToken}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      mapboxToken: event.target.value,
                      provider: event.target.value ? "mapbox" : "osrm",
                    }))
                  }
                  placeholder="pk.ey…"
                />
              </label>
              <p className="field-help">
                The token is kept only for this browser session. Restrict public
                frontend tokens by website URL in your provider dashboard.
              </p>
            </SettingGroup>
          </div>
        </Modal>
      )}

      {activeTrack && (
        <Modal
          title="Edit GPX track"
          eyebrow="Track details"
          onClose={() => {
            setEditingTrack(null);
            setTrackQuery("");
          }}
          wide
        >
          <div className="track-editor">
            <label>
              Track name
              <input
                value={activeTrack.name}
                onChange={(event) =>
                  updateTrack(activeTrack.id, { name: event.target.value })
                }
              />
            </label>
            <div className="endpoint-grid">
              {(["start", "end"] as const).map((end) => {
                const key = end === "start" ? "startPlace" : "endPlace";
                const endpoint = activeTrack[key];
                return (
                  <section className="endpoint-editor" key={end}>
                    <div className="section-heading">
                      <MapPin size={18} />
                      <div>
                        <strong>
                          {end === "start" ? "Track start" : "Track end"}
                        </strong>
                        <small>
                          Optional numbered place, caption, and photograph.
                        </small>
                      </div>
                    </div>
                    {!endpoint ? (
                      <button
                        className="button ghost"
                        onClick={() =>
                          updateTrack(activeTrack.id, {
                            [key]: endpointFor(activeTrack, end),
                          })
                        }
                      >
                        <Plus size={15} /> Add {end} place
                      </button>
                    ) : (
                      <EndpointFields
                        place={endpoint}
                        photoAppearance={settings.photos}
                        onChange={(place) =>
                          updateTrack(activeTrack.id, { [key]: place })
                        }
                        onRemove={() =>
                          updateTrack(activeTrack.id, { [key]: undefined })
                        }
                      />
                    )}
                  </section>
                );
              })}
            </div>
            <section className="track-cut">
              <div className="section-heading">
                <Scissors size={18} />
                <div>
                  <strong>Cut at a place</strong>
                  <small>
                    Search a place; the nearest GPX point becomes the cut.
                  </small>
                </div>
              </div>
              <input
                aria-label="Search cut place"
                value={trackQuery}
                onChange={(event) => setTrackQuery(event.target.value)}
                placeholder="Search a town or landmark…"
              />
              {!!trackResults.length && (
                <div className="cut-results">
                  {trackResults.map((result) => (
                    <button
                      key={`${result.lat}-${result.lng}`}
                      onClick={() => cutTrack(activeTrack, result)}
                    >
                      <MapPin size={15} />
                      <span>
                        <strong>{result.name}</strong>
                        <small>{result.subtitle}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </Modal>
      )}

      {shareOpen && (
        <Modal
          title="Transfer journey"
          eyebrow="Share or load"
          onClose={() => {
            setShareOpen(false);
            setQrPlaying(false);
            scannerStreamRef.current
              ?.getTracks()
              .forEach((track) => track.stop());
            scannerStreamRef.current = null;
            setQrScanning(false);
          }}
          wide
        >
          <div className="transfer-grid">
            <section className="transfer-section">
              <h3>Copy or paste</h3>
              <p>
                The code contains the journey name, places, tracks, styles, and
                photographs. It is not uploaded or put into a URL.
              </p>
              <label>
                Journey code
                <textarea readOnly value={serializedJourney} rows={5} />
              </label>
              <button
                className="button dark"
                onClick={() =>
                  void navigator.clipboard.writeText(serializedJourney)
                }
              >
                Copy journey code
              </button>
              <label>
                Load a copied code
                <textarea
                  value={importCode}
                  onChange={(event) => setImportCode(event.target.value)}
                  rows={5}
                  placeholder="Paste a Wayfare journey code…"
                />
              </label>
              <button
                className="button primary"
                disabled={!importCode.trim()}
                onClick={() => importSerializedJourney(importCode)}
              >
                Load as new journey
              </button>
            </section>
            <section className="transfer-section qr-transfer">
              <h3>Animated QR transfer</h3>
              <p>
                {qrFrames.length} numbered frames repeat in a loop. The
                receiving phone accepts them in any order and waits for missed
                frames, then verifies the complete data.
              </p>
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt={`Journey QR frame ${qrFrameIndex + 1} of ${qrFrames.length}`}
                  className="share-qr"
                />
              )}
              <strong className="qr-counter">
                Frame {qrFrameIndex + 1} / {qrFrames.length}
              </strong>
              <button
                className="button dark"
                onClick={() => setQrPlaying((current) => !current)}
              >
                <QrCode size={16} />
                {qrPlaying ? "Pause frames" : "Start repeating frames"}
              </button>
              <button
                className="button primary"
                onClick={() => void shareAnimatedQr()}
                disabled={sharingGif}
              >
                <Share2 size={16} />
                {sharingGif
                  ? `Creating ${qrFrames.length} GIF frames…`
                  : "Share GIF via WhatsApp, Signal, or…"}
              </button>
              <button className="button ghost" onClick={startQrScanner}>
                Scan frames with this device
              </button>
              {qrScanning && (
                <div className="qr-scanner">
                  <video ref={scannerVideoRef} muted playsInline />
                  <progress value={qrProgress} max={1} />
                  <span>{Math.round(qrProgress * 100)}% received</span>
                </div>
              )}
              <p className="field-help">
                Native sharing sends the public Wayfare link, step-by-step
                scanning instructions, and the animated GIF to WhatsApp, Signal,
                or another installed app. On the receiving phone, open the link,
                tap “Scan frames with this device”, allow camera access, and
                point it at the GIF displayed on another screen. Keep scanning
                until 100%. Camera scanning requires HTTPS and the Barcode
                Detector API; copy/paste works everywhere.
              </p>
            </section>
          </div>
        </Modal>
      )}

      {journeysOpen && (
        <Modal
          title="My journeys"
          eyebrow="Saved in this browser"
          onClose={() => setJourneysOpen(false)}
        >
          <div className="journey-library">
            {loadJourneyLibrary().map((saved) => (
              <article
                key={saved.id}
                className={saved.id === journey.id ? "active" : ""}
              >
                <button onClick={() => selectJourney(saved)}>
                  <strong>{saved.name}</strong>
                  <small>
                    {saved.items.length} items · updated{" "}
                    {new Date(saved.updatedAt).toLocaleDateString()}
                  </small>
                </button>
                <button
                  className="icon-button danger"
                  aria-label={`Delete journey ${saved.name}`}
                  onClick={() => deleteJourney(saved.id)}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
            <button className="button primary" onClick={createJourney}>
              <Plus size={16} /> New journey
            </button>
          </div>
        </Modal>
      )}

      {historyOpen && (
        <Modal
          title="Journey history"
          eyebrow="Reversible changes"
          onClose={() => setHistoryOpen(false)}
        >
          <div className="history-list">
            {!journey.history.length && <p>No changes to undo yet.</p>}
            {[...journey.history].reverse().map((entry, index) => (
              <article key={entry.id}>
                <span>
                  <strong>{entry.label}</strong>
                  <small>{new Date(entry.at).toLocaleString()}</small>
                </span>
                {index === 0 && (
                  <button className="button ghost" onClick={undo}>
                    <Undo2 size={15} /> Undo
                  </button>
                )}
              </article>
            ))}
            <p className="field-help">
              History stores compact item changes, not complete snapshots. The
              browser Back button also undoes the latest change.
            </p>
          </div>
        </Modal>
      )}

      {helpOpen && (
        <Modal
          title="How Wayfare works"
          eyebrow="Help"
          onClose={() => setHelpOpen(false)}
          wide
        >
          <div className="help-grid">
            <HelpStep number="1" title="Build the sequence">
              Search for places or import GPX files. Drag cards to reorder them,
              or choose “Insert” between two items.
            </HelpStep>
            <HelpStep number="2" title="Mix places and tracks">
              A GPX track keeps its recorded shape. Wayfare routes from the
              previous item to its start and from its end to the next item. Edit
              a track to add optional named and photographed endpoints, or
              search for a place and split the track at its nearest GPX point.
            </HelpStep>
            <HelpStep number="3" title="Tell the story">
              Choose Edit on a place to write its name and description, select a
              marker, and add a photograph.
            </HelpStep>
            <HelpStep number="4" title="Compose photographs">
              Crop and zoom each image individually. Configure photo size,
              frame, and rounding once in Photograph style; the same design is
              used in the editor, map, and image export. Wayfare's geometry
              engine places callouts near their places while avoiding the route,
              map edge, and each other. A configurable arrow always links each
              callout to its exact place.
            </HelpStep>
            <HelpStep number="5" title="Style the map">
              Settings are grouped into background, route, labels, custom maps,
              and routing. Built-in maps need no key. Callout placement pauses
              while Settings is open and updates after you close it.
            </HelpStep>
            <HelpStep number="6" title="Export">
              Choose PNG, JPG, or WebP and a print, photo-book, screen, or
              social format. Exports temporarily compose the map in the chosen
              aspect ratio. You can also export the connected route as GPX.
            </HelpStep>
            <HelpStep number="7" title="Share and continue">
              Transfer keeps large data out of the URL. Copy and paste the
              Base64 journey code, or play its numbered QR frames while the
              other device scans. Frames repeat, can arrive in any order, and
              are checked before the journey is loaded. The GIF share button
              sends the animation and an import-page link through the phone’s
              native WhatsApp, Signal, or system share sheet. The message
              includes the public Wayfare address and tells the receiver to open
              the import page, start the scanner, allow camera access, and keep
              the animated GIF in view until 100% is received.
            </HelpStep>
            <HelpStep number="8" title="Keep several journeys">
              Give each journey a name and switch in My journeys. Every edit is
              saved locally as a reversible change. Use Undo, History, or the
              browser Back button—including after splitting a GPX track.
            </HelpStep>
          </div>
          <div className="help-note">
            <strong>Privacy</strong>
            <p>
              Your journey, settings, descriptions, and resized photographs
              remain in this browser. Search and routing requests go directly to
              the selected providers. Cloudflare Web Analytics and Google
              AdSense are active when configured by the site owner; use the
              privacy links for each vendor’s controls.
            </p>
            <button
              className="button ghost"
              onClick={() => setPrivacyOpen(true)}
            >
              Read privacy information
            </button>
          </div>
        </Modal>
      )}

      {exportOpen && (
        <Modal
          title="Export journey"
          eyebrow="Take it with you"
          onClose={() => setExportOpen(false)}
        >
          <div className="export-options">
            <label>
              Page or photo-book format
              <select
                value={exportPreset}
                onChange={(event) => setExportPreset(event.target.value)}
              >
                {EXPORT_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label} — {preset.detail}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Image file format
              <select
                value={exportFormat}
                onChange={(event) =>
                  setExportFormat(event.target.value as typeof exportFormat)
                }
              >
                <option value="png">PNG — best quality</option>
                <option value="jpeg">JPG — universal</option>
                <option value="webp">WebP — smallest file</option>
              </select>
            </label>
            <button
              className="button primary export-download"
              onClick={() => {
                const preset =
                  EXPORT_PRESETS.find((entry) => entry.id === exportPreset) ??
                  EXPORT_PRESETS[0];
                mapRef.current?.exportImage(
                  exportFormat,
                  preset.width
                    ? { width: preset.width, height: preset.height }
                    : undefined,
                );
                setExportOpen(false);
              }}
            >
              <ImageDown size={18} />
              Download image
            </button>
          </div>
          <div className="export-grid compact">
            <button
              onClick={() => {
                downloadText(
                  "journey.gpx",
                  buildGpx(items, route),
                  "application/gpx+xml",
                );
                setExportOpen(false);
              }}
            >
              <Route size={20} />
              <span>
                <strong>GPX</strong>
                <small>Complete connected route</small>
              </span>
            </button>
          </div>
          <p className="export-note">
            Image exports include the current map, route, labels, photographs,
            and frames. Fixed-size formats preserve the whole map and add
            neutral margins when its proportions differ from the chosen page.
          </p>
        </Modal>
      )}
      <footer className="site-footer">
        <a href="privacy.html">Privacy</a>
        <button onClick={() => setPrivacySettingsOpen(true)}>
          Privacy settings
        </button>
      </footer>
      <PrivacyCenter
        open={privacyOpen || privacySettingsOpen}
        settingsOnly={privacySettingsOpen}
        onClose={() => {
          setPrivacyOpen(false);
          setPrivacySettingsOpen(false);
        }}
      />
      <ConsentBanner onSettings={() => setPrivacySettingsOpen(true)} />
      <OptionalVendors />
    </main>
  );
}

const NOTICE_KEY = "wayfare.privacy-notice.v2";

function ConsentBanner({ onSettings }: { onSettings: () => void }) {
  const [visible, setVisible] = useState(
    () => localStorage.getItem(NOTICE_KEY) !== "acknowledged",
  );
  if (!visible) return null;
  return (
    <section className="consent-banner" aria-label="Cookie consent">
      <div>
        <strong>Your journey stays on this device</strong>
        <p>
          Cloudflare Web Analytics and Google AdSense are active when configured
          by the site owner. Your routes, descriptions, and photographs still
          remain in this browser.
        </p>
      </div>
      <div className="consent-actions">
        <button className="button ghost" onClick={onSettings}>
          Privacy details
        </button>
        <button
          className="button dark"
          onClick={() => {
            localStorage.setItem(NOTICE_KEY, "acknowledged");
            setVisible(false);
          }}
        >
          Continue
        </button>
      </div>
    </section>
  );
}

function PrivacyCenter({
  open,
  settingsOnly,
  onClose,
}: {
  open: boolean;
  settingsOnly: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <Modal
      title={settingsOnly ? "Privacy settings" : "Privacy"}
      eyebrow="How data is handled"
      onClose={onClose}
      wide
    >
      {!settingsOnly && (
        <div className="privacy-copy">
          <h3>Data stored on your device</h3>
          <p>
            Journey names, places, descriptions, GPX coordinates, editing
            history, display settings, and resized photographs are stored in
            your browser. Wayfare has no application backend and does not upload
            this content. Clearing site data removes it from that browser.
          </p>
          <h3>Requests needed for the map</h3>
          <p>
            Your browser requests map tiles, place search, and routing directly
            from the provider selected in Settings. Those providers receive the
            usual technical request information, such as your IP address. A
            Mapbox token, when supplied, is kept for the browser session.
          </p>
          <h3>Sharing</h3>
          <p>
            Copy/paste and animated QR transfer are generated locally. The
            journey code contains everything visible in the journey, including
            photographs; share it only with people you trust.
          </p>
          <h3>Analytics and advertising</h3>
          <p>
            When configured by the site owner, Cloudflare Web Analytics measures
            visits and Google AdSense supplies advertising. These services are
            active and cannot be disabled inside Wayfare. See the vendors’ own
            privacy controls:
          </p>
          <ul>
            <li>
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
              >
                Google privacy policy
              </a>{" "}
              and{" "}
              <a
                href="https://myadcenter.google.com/"
                target="_blank"
                rel="noreferrer"
              >
                My Ad Center
              </a>
            </li>
            <li>
              <a
                href="https://www.cloudflare.com/privacypolicy/"
                target="_blank"
                rel="noreferrer"
              >
                Cloudflare privacy policy
              </a>
            </li>
          </ul>
        </div>
      )}
      <div className="privacy-choices">
        <div className="vendor-status">
          <span className="status-badge">Active</span>
          <span>
            <strong>Necessary storage</strong>
            <small>Journeys, settings, notice state, and editor history.</small>
          </span>
        </div>
        <div className="vendor-status">
          <span className="status-badge">Active</span>
          <span>
            <strong>Cloudflare Web Analytics</strong>
            <small>Privacy-focused traffic and performance measurement.</small>
          </span>
        </div>
        <div className="vendor-status">
          <span className="status-badge">Active</span>
          <span>
            <strong>Google AdSense</strong>
            <small>Advertising and its related storage or identifiers.</small>
          </span>
        </div>
        <button className="button dark" onClick={onClose}>
          Close privacy information
        </button>
      </div>
    </Modal>
  );
}

function OptionalVendors() {
  useEffect(() => {
    const siteUrl = import.meta.env.VITE_PUBLIC_SITE_URL;
    if (!siteUrl) return;
    let canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = siteUrl;
  }, []);
  return null;
}

function EndpointFields({
  place,
  photoAppearance,
  onChange,
  onRemove,
}: {
  place: Place;
  photoAppearance: PhotoAppearance;
  onChange: (place: Place) => void;
  onRemove: () => void;
}) {
  const patch = (value: Partial<Place>) => onChange({ ...place, ...value });
  return (
    <div className="endpoint-fields">
      <input
        aria-label={`Name for ${place.name}`}
        value={place.name}
        onChange={(event) => patch({ name: event.target.value })}
        placeholder="Place name"
      />
      <textarea
        aria-label={`Description for ${place.name}`}
        value={place.description}
        onChange={(event) => patch({ description: event.target.value })}
        placeholder="Description"
      />
      <label className="upload-zone compact-upload">
        {place.photo ? "Replace photograph" : "Add photograph"}
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void resizeImage(file).then((dataUrl) =>
              patch({ photo: defaultPhoto(dataUrl, file.name) }),
            );
          }}
        />
      </label>
      {place.photo && (
        <>
          <div
            className="photo-preview endpoint-photo"
            style={{
              width: Math.min(120, photoAppearance.size),
              height: Math.min(120, photoAppearance.size),
              border: `${photoAppearance.borderWidth}px solid ${photoAppearance.borderColor}`,
              borderRadius: `${photoAppearance.radius}%`,
              backgroundImage: `url("${place.photo.dataUrl}")`,
              backgroundSize: `${place.photo.zoom * 100}%`,
              backgroundPosition: `${place.photo.cropX}% ${place.photo.cropY}%`,
            }}
          />
          <Slider
            label="Crop left/right"
            min={0}
            max={100}
            value={place.photo.cropX}
            onChange={(cropX) => patch({ photo: { ...place.photo!, cropX } })}
          />
          <Slider
            label="Crop up/down"
            min={0}
            max={100}
            value={place.photo.cropY}
            onChange={(cropY) => patch({ photo: { ...place.photo!, cropY } })}
          />
          <Slider
            label="Photo zoom"
            min={1}
            max={3}
            step={0.1}
            value={place.photo.zoom}
            onChange={(zoom) => patch({ photo: { ...place.photo!, zoom } })}
          />
        </>
      )}
      <button className="text-danger" onClick={onRemove}>
        Remove endpoint place
      </button>
    </div>
  );
}

function Modal({
  title,
  eyebrow,
  onClose,
  wide,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-title">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function SettingGroup({
  icon,
  title,
  description,
  open,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(Boolean(open));
  return (
    <section className={`setting-group ${expanded ? "is-open" : ""}`}>
      <button
        type="button"
        className="setting-summary"
        aria-label={title}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="setting-icon">{icon}</span>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
        <ChevronDown className="chevron" />
      </button>
      {expanded && <div className="setting-content">{children}</div>}
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider-field">
      <span>
        {label}
        <output>
          {value}
          {suffix}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="color-field">
      <span>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function HelpStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="help-step">
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </article>
  );
}
