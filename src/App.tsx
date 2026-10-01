import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  GripVertical,
  ImageDown,
  KeyRound,
  LocateFixed,
  Map,
  MapPin,
  Plus,
  Route,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { JourneyMap, type JourneyMapHandle } from "./components/JourneyMap";
import {
  buildGpx,
  downloadText,
  formatDistance,
  moveItem,
  straightRoute,
} from "./lib/journey";
import {
  routeWithMapbox,
  routeWithOsrm,
  searchPlaces,
  type SearchResult,
} from "./lib/providers";
import type {
  AppSettings,
  MapStyleId,
  MarkerKind,
  Place,
  RouteGeometry,
} from "./types";

const STORAGE_KEY = "wayfare.journey.v1";
const defaults: AppSettings = {
  mapStyle: "paper",
  routeColor: "#df5f3f",
  routeWidth: 5,
  autoFit: true,
  manualZoom: 7,
  provider: "osrm",
  mapboxToken: "",
  googleKey: "",
};
const initialRoute: RouteGeometry = {
  coordinates: [],
  distanceMeters: 0,
  durationSeconds: 0,
};

function loadPlaces(): Place[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as Place[];
  } catch {
    return [];
  }
}

export function App() {
  const [places, setPlaces] = useState<Place[]>(loadPlaces);
  const [route, setRoute] = useState<RouteGeometry>(() =>
    straightRoute(loadPlaces()),
  );
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...defaults,
    mapboxToken: sessionStorage.getItem("wayfare.mapbox") || "",
  }));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [routeStatus, setRouteStatus] = useState<
    "idle" | "routing" | "fallback"
  >("idle");
  const [notice, setNotice] = useState("");
  const [dragged, setDragged] = useState<number | null>(null);
  const mapRef = useRef<JourneyMapHandle>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  }, [places]);
  useEffect(() => {
    sessionStorage.setItem("wayfare.mapbox", settings.mapboxToken);
  }, [settings.mapboxToken]);

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
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const update = async () => {
      if (places.length < 2) {
        setRoute(straightRoute(places));
        return;
      }
      setRouteStatus("routing");
      try {
        const next =
          settings.provider === "mapbox" && settings.mapboxToken
            ? await routeWithMapbox(
                places,
                settings.mapboxToken,
                controller.signal,
              )
            : await routeWithOsrm(places, controller.signal);
        setRoute(next);
        setRouteStatus("idle");
        setNotice("");
      } catch {
        if (!controller.signal.aborted) {
          setRoute(straightRoute(places));
          setRouteStatus("fallback");
          setNotice(
            "Road routing is unavailable, so the journey is shown as straight connections.",
          );
        }
      }
    };
    const timeout = window.setTimeout(update, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [places, settings.provider, settings.mapboxToken]);

  const addPlace = (result: SearchResult) => {
    const place: Place = { id: crypto.randomUUID(), ...result, marker: "pin" };
    setPlaces((current) => {
      if (insertAt === null) return [...current, place];
      const copy = [...current];
      copy.splice(insertAt, 0, place);
      return copy;
    });
    setQuery("");
    setResults([]);
    setInsertAt(null);
  };

  const updatePlace = (id: string, patch: Partial<Place>) =>
    setPlaces((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const stats = useMemo(
    () => ({
      distance: route.coordinates.length
        ? formatDistance(route.distanceMeters)
        : "—",
      stops: places.length,
    }),
    [route, places.length],
  );

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
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
          >
            <Settings2 size={17} />
            <span>Settings</span>
          </button>
          <button
            className="button dark"
            onClick={() => setExportOpen(true)}
            disabled={places.length === 0}
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
            <h1>Where did you go?</h1>
            <p>
              Add each stop in order. We’ll trace the roads and frame the map.
            </p>
          </div>

          <div className="search-wrap">
            <Search size={19} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                places.length
                  ? "Add another place…"
                  : "Start with a city or landmark…"
              }
              aria-label="Search for a place"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setInsertAt(null);
                }}
                aria-label="Clear search"
              >
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
                {!searching && results.length === 0 && (
                  <div className="search-state">
                    No places found. Try a broader name.
                  </div>
                )}
              </div>
            )}
          </div>

          {insertAt !== null && (
            <div className="insert-note">
              <Plus size={14} /> Adding a stop at position {insertAt + 1}
              <button onClick={() => setInsertAt(null)}>Cancel</button>
            </div>
          )}

          <div className="stops" aria-label="Visited places">
            {places.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <Map size={23} />
                </div>
                <strong>Your journey starts here</strong>
                <span>Search for the first place you visited.</span>
              </div>
            ) : (
              places.map((place, index) => (
                <div key={place.id}>
                  <article
                    className={`stop-card ${dragged === index ? "dragging" : ""}`}
                    draggable
                    onDragStart={() => setDragged(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragged !== null)
                        setPlaces(moveItem(places, dragged, index));
                      setDragged(null);
                    }}
                  >
                    <GripVertical className="drag-handle" size={18} />
                    <span className="stop-number">{index + 1}</span>
                    <div className="stop-copy">
                      <input
                        value={place.name}
                        onChange={(event) =>
                          updatePlace(place.id, { name: event.target.value })
                        }
                        aria-label={`Name for stop ${index + 1}`}
                      />
                      <small>{place.subtitle}</small>
                    </div>
                    <select
                      value={place.marker}
                      onChange={(event) =>
                        updatePlace(place.id, {
                          marker: event.target.value as MarkerKind,
                        })
                      }
                      aria-label={`Marker style for ${place.name}`}
                    >
                      <option value="pin">Pin</option>
                      <option value="dot">Dot</option>
                      <option value="route">Route only</option>
                    </select>
                    <button
                      className="icon-button danger"
                      onClick={() =>
                        setPlaces((items) =>
                          items.filter((item) => item.id !== place.id),
                        )
                      }
                      aria-label={`Delete ${place.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </article>
                  {index < places.length - 1 && (
                    <button
                      className="insert-button"
                      onClick={() => {
                        setInsertAt(index + 1);
                        document
                          .querySelector<HTMLInputElement>(
                            '[aria-label="Search for a place"]',
                          )
                          ?.focus();
                      }}
                    >
                      <Plus size={13} /> Add stop here
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {places.length > 0 && (
            <div className="journey-summary">
              <div>
                <span>Distance</span>
                <strong>{stats.distance}</strong>
              </div>
              <div>
                <span>Stops</span>
                <strong>{stats.stops}</strong>
              </div>
              <div>
                <span>Route</span>
                <strong>
                  {routeStatus === "routing"
                    ? "Tracing…"
                    : routeStatus === "fallback"
                      ? "Direct"
                      : "Roads"}
                </strong>
              </div>
            </div>
          )}
        </aside>

        <section className="map-panel">
          <JourneyMap
            ref={mapRef}
            places={places}
            route={route}
            mapStyle={settings.mapStyle}
            routeColor={settings.routeColor}
            routeWidth={settings.routeWidth}
            autoFit={settings.autoFit}
            zoom={settings.manualZoom}
          />
          <div className="map-toolbar">
            <select
              value={settings.mapStyle}
              onChange={(event) =>
                setSettings((value) => ({
                  ...value,
                  mapStyle: event.target.value as MapStyleId,
                }))
              }
              aria-label="Map style"
            >
              <option value="paper">Paper</option>
              <option value="atlas">Atlas</option>
              <option value="midnight">Midnight</option>
            </select>
            <button onClick={() => mapRef.current?.fit()}>
              <LocateFixed size={16} />
              Fit journey
            </button>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button onClick={() => setNotice("")} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          )}
          {places.length === 0 && (
            <div className="map-prompt">
              <MapPin size={22} />
              <span>Your route will appear here</span>
            </div>
          )}
        </section>
      </section>

      {settingsOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <div className="modal-title">
              <div>
                <p className="eyebrow">Map controls</p>
                <h2 id="settings-title">Settings</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
              >
                <X />
              </button>
            </div>
            <label>
              Route color
              <input
                type="color"
                value={settings.routeColor}
                onChange={(event) =>
                  setSettings((value) => ({
                    ...value,
                    routeColor: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Route width <output>{settings.routeWidth}px</output>
              <input
                type="range"
                min="2"
                max="10"
                value={settings.routeWidth}
                onChange={(event) =>
                  setSettings((value) => ({
                    ...value,
                    routeWidth: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="toggle-row">
              Automatically fit journey
              <input
                type="checkbox"
                checked={settings.autoFit}
                onChange={(event) =>
                  setSettings((value) => ({
                    ...value,
                    autoFit: event.target.checked,
                  }))
                }
              />
            </label>
            {!settings.autoFit && (
              <label>
                Zoom level <output>{settings.manualZoom}</output>
                <input
                  type="range"
                  min="2"
                  max="16"
                  value={settings.manualZoom}
                  onChange={(event) =>
                    setSettings((value) => ({
                      ...value,
                      manualZoom: Number(event.target.value),
                    }))
                  }
                />
              </label>
            )}
            <div className="key-section">
              <div className="key-heading">
                <KeyRound size={18} />
                <div>
                  <strong>Optional Mapbox routing</strong>
                  <small>
                    Unlock an alternative routing provider. The token stays in
                    this browser tab.
                  </small>
                </div>
              </div>
              <input
                type="password"
                value={settings.mapboxToken}
                onChange={(event) =>
                  setSettings((value) => ({
                    ...value,
                    mapboxToken: event.target.value,
                    provider: event.target.value ? "mapbox" : "osrm",
                  }))
                }
                placeholder="pk.ey…"
                aria-label="Mapbox access token"
              />
              {settings.mapboxToken && (
                <div className="unlocked">Mapbox routing enabled</div>
              )}
            </div>
          </section>
        </div>
      )}

      {exportOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setExportOpen(false);
          }}
        >
          <section
            className="modal export-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
          >
            <div className="modal-title">
              <div>
                <p className="eyebrow">Take it with you</p>
                <h2 id="export-title">Export journey</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setExportOpen(false)}
                aria-label="Close export"
              >
                <X />
              </button>
            </div>
            <div className="export-grid">
              {(["png", "jpeg", "webp"] as const).map((format) => (
                <button
                  key={format}
                  onClick={() => {
                    mapRef.current?.exportImage(format);
                    setExportOpen(false);
                  }}
                >
                  <ImageDown size={20} />
                  <span>
                    <strong>
                      {format === "jpeg" ? "JPG" : format.toUpperCase()}
                    </strong>
                    <small>
                      {format === "png"
                        ? "Best quality"
                        : format === "jpeg"
                          ? "Small & universal"
                          : "Smallest file"}
                    </small>
                  </span>
                </button>
              ))}
              <button
                onClick={() => {
                  downloadText(
                    "journey.gpx",
                    buildGpx(places, route),
                    "application/gpx+xml",
                  );
                  setExportOpen(false);
                }}
              >
                <Route size={20} />
                <span>
                  <strong>GPX</strong>
                  <small>For GPS apps</small>
                </span>
              </button>
            </div>
            <p className="export-note">
              Exports include the current map style, route, and visible markers.
              Map data © OpenStreetMap contributors.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
