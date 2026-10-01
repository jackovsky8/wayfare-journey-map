# Wayfare — Journey Map Studio

Wayfare is a frontend-only travel-map editor for turning places, stories, photographs, and recorded GPX tracks into a polished map image or connected GPX route. It has no application backend and can be hosted as static files on GitHub Pages.

## Features

### Journey building

- Search for cities, landmarks, and addresses through OpenStreetMap Nominatim.
- Add, rename, reorder, insert, and remove places.
- Import GPX tracks containing `trkpt` or `rtept` points.
- Mix places and GPX tracks in one ordered journey.
- Preserve every imported track’s recorded geometry.
- Route from the previous place or track endpoint to the next track’s start.
- Route onward from the imported track’s endpoint to the following place or track.
- Use free OSRM road routing, with a straight-line fallback when routing is unavailable.
- Optionally use a user-supplied Mapbox public token for connector routing.

### Places, stories, and photographs

- Give every place a name and description.
- Choose a numbered pin, small dot, or route-only marker.
- Add a photograph to any place.
- Move the crop horizontally and vertically.
- Zoom each photograph for its individual crop.
- Configure photograph size, frame color, frame width, and corner roundness once in **Settings → Photograph style**.
- Use the same global photograph appearance in the crop preview, live map, and exported image.
- Place labels and photographs with a screen-space geometry engine.
- Prefer the closest available position while avoiding the route, map edge, and every other callout.
- Recalculate placement while the map pans, zooms, resizes, or changes style.
- Position cards and arrows in one shared map overlay, so connectors meet the exact card edge and place coordinate without marker-offset drift.
- Run collision placement in a Web Worker so route geometry does not block editing or scrolling.
- Pause placement work while Settings is open, then calculate once after it closes.
- Connect every callout to its exact place with a curved, straight, or dashed arrow.
- Configure connector color and width in **Settings → Callout placement & connectors**.
- Configure the shared place-label typography, colors, border, rounding, and description visibility.

Photographs are resized before being saved to reduce browser-storage usage.

### Included free map styles

Wayfare includes the following maps without an API key:

- OpenFreeMap Liberty
- OpenFreeMap Positron
- OpenFreeMap Bright
- OpenFreeMap Dark
- OpenFreeMap Fiord
- OpenFreeMap 3D
- OpenStreetMap Standard
- OpenTopoMap

Attribution is displayed through MapLibre. Public tile services may have fair-use limits and do not provide an availability guarantee.

### Custom map sources

Open **Settings → Add another map** to add:

1. A complete MapLibre style-JSON URL, for example:

   ```text
   https://tiles.openfreemap.org/styles/liberty
   ```

2. A raster XYZ tile template containing `{z}`, `{x}`, and `{y}`, for example:

   ```text
   https://tile.openstreetmap.org/{z}/{x}/{y}.png
   ```

Enter the attribution required by the map provider. URLs and custom-map definitions are stored in the browser. API keys included in frontend URLs are visible to visitors, so use public browser tokens and restrict them to the deployed website’s domain.

### View and export

- Switch map styles instantly.
- Automatically frame the complete journey or select a manual zoom.
- Configure route color and width.
- Export PNG, JPG, or WebP images containing the map, route, captions, photographs, frames, and the same collision-aware connector layout shown in the editor.
- Choose the current view, A4/A5 portrait or landscape, square or landscape photo-book pages, or a 10 × 15 cm photo-print preset.
- Preserve the complete map without distortion; fixed page formats add neutral margins when their aspect ratio differs.
- Export a GPX file containing place waypoints and the complete connected journey track.
- Use the built-in Help section for an in-app workflow guide.

## Browser storage and privacy

- Journey items, descriptions, appearance settings, custom maps, and resized photographs are stored in `localStorage`.
- The optional Mapbox token is stored in `sessionStorage` and disappears when the browser session ends.
- Search terms are sent directly to Nominatim.
- Coordinates used for road connections are sent directly to OSRM or the user-selected Mapbox service.
- There is no Wayfare account, database, or application server.

Browser storage is limited. For journeys containing many photographs, use compressed images and periodically export the journey.

## Local development

Node.js 22 or newer is recommended.

```bash
npm ci
npm run dev
```

Open <http://localhost:4173>.

## Verification

```bash
npm run format
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

The unit tests cover reordering, distance calculation, GPX import/export, malformed GPX handling, connecting imported tracks to adjacent places, box collisions, route intersection, callout placement, and connector geometry.

The Playwright suite covers place editing, GPX import, photograph controls, grouped settings, custom map sources, Help, exports, and browser persistence. Search, routing, and map-style responses are mocked, so browser tests require no API key.

## GitHub Pages deployment

1. Create a GitHub repository and push this project to its `main` branch.
2. Open **Settings → Pages** in GitHub.
3. Select **GitHub Actions** as the build and deployment source.
4. Push to `main`.

The included workflow installs dependencies, verifies formatting, runs unit and Chromium browser tests, creates the production build, and deploys `dist/`.

Vite uses relative asset paths, so the build supports both root domains and GitHub repository subpaths.

## Responsive layout

On tablets and phones, the map appears first and the journey editor follows below it. Toolbars contract to the available width, settings and editors become bottom sheets on narrow phones, and multi-column controls collapse to touch-friendly single columns.
