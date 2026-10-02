# Wayfare — Journey Map Studio

Wayfare is a frontend-only travel-map editor for turning places, stories, photographs, and recorded GPX tracks into a polished map image or connected GPX route. It has no application backend and can be hosted as static files on GitHub Pages.

## Features

### Journey building

- Search for cities, landmarks, and addresses through OpenStreetMap Nominatim.
- Add, rename, reorder, insert, and remove places.
- Import GPX tracks containing `trkpt` or `rtept` points.
- Add optional numbered start and end places to a GPX track, including names, descriptions, cropped photographs, and map callouts.
- Edit and split a GPX track by searching for a place; Wayfare cuts at the nearest recorded GPX point and inserts the selected place between both track segments.
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

Photographs are resized to at most 1024 px and JPEG-compressed before being saved, reducing browser-storage, URL-sharing, and QR-code size while retaining useful visible detail.

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
- Choose the current view, A3/A4/A5, US Letter, common photo prints, square/landscape photo books, Full HD, 4:3, square, or phone-story formats.
- Fixed-size exports temporarily recompose and fit the map in the selected aspect ratio instead of stretching a phone-shaped screenshot.
- Image and GPX downloads use Blob URLs; supported iPhone/iPad browsers can use the native share sheet for generated images.
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

The unit tests cover reordering, distance calculation, GPX import/export (including endpoint places), malformed GPX handling, splitting a track at its closest coordinate, connecting imported tracks to adjacent places, Base64 sharing, URL-size warnings, box collisions, route intersection, callout placement, and connector geometry.

The Playwright suite covers desktop and mobile place editing, GPX import and endpoint editing, photograph controls, grouped settings, custom map sources, Help, every export preset, URL/QR sharing, and browser persistence. Search, routing, and map-style responses are mocked, so browser tests require no API key.

## GitHub Pages deployment

1. Create a GitHub repository and push this project to its `main` branch.
2. Open **Settings → Pages** in GitHub.
3. Select **GitHub Actions** as the build and deployment source.
4. Push to `main`.

The included workflow installs dependencies, verifies formatting, runs unit and Chromium browser tests, creates the production build, and deploys `dist/`.

Vite uses relative asset paths, so the build supports both root domains and GitHub repository subpaths.

## Responsive layout

On tablets and phones, a compact map appears first while the beginning of the journey list remains visible in the first screen. Toolbars contract to the available width, settings and editors become bottom sheets on narrow phones, and multi-column controls collapse to touch-friendly single columns.

## Sharing a complete journey

Choose **Share** to serialize journey items, GPX coordinates, endpoint places, appearance settings, descriptions, and photographs into URL-safe Base64 in the `journey` query parameter. Opening that URL on another browser imports the complete configuration for continued editing. The Mapbox session token is deliberately excluded.

The Share dialog generates the QR code entirely in the browser. Because QR codes and browsers have practical URL-size limits, Wayfare warns and suppresses the QR code when photographs make the URL too large. The full URL can still be copied, but for reliable QR sharing use no photographs or one small photograph.
