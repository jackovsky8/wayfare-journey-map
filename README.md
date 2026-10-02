# Wayfare — Journey Map Studio

Wayfare is a frontend-only travel-map editor for turning places, stories, photographs, and recorded GPX tracks into a polished map image or connected GPX route. It has no application backend and can be hosted as static files on GitHub Pages.

## Features

### Journey building

- Search for cities, landmarks, and addresses through OpenStreetMap Nominatim.
- Add, rename, reorder, insert, and remove places.
- Reorder with drag-and-drop on pointer devices or dedicated touch-safe up/down controls on phones and tablets.
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

Photographs are resized to at most 1024 px and JPEG-compressed before being saved, reducing browser-storage and transfer size while retaining useful visible detail.

### Multiple journeys and reversible history

- Keep several named journeys in the same browser and switch through **My journeys**.
- Every journey retains its own items and compact change history.
- History entries store the changed array range (removed and added items), not full snapshots.
- Undo the latest edit from the toolbar or History dialog.
- The browser Back button undoes the latest edit without leaving the editor.
- GPX cuts are a single reversible history change, restoring the original track when undone.

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

- Named journeys, descriptions, GPX coordinates, reversible diffs, appearance settings, custom maps, privacy-notice state, and resized photographs are stored in `localStorage`.
- The optional Mapbox token is stored in `sessionStorage` and disappears when the browser session ends.
- Search terms are sent directly to Nominatim.
- Coordinates used for road connections are sent directly to OSRM or the user-selected Mapbox service.
- There is no Wayfare account, database, or application server.
- Base64 copy/paste and animated QR transfers happen locally; Wayfare does not upload the transferred data.
- The in-app Privacy page explains local storage, required map-provider requests, sharing, Cloudflare Web Analytics, and Google AdSense.
- Cloudflare Web Analytics and Google AdSense are inserted directly into the built HTML when their build-time IDs are configured. They are displayed as active services and cannot be disabled in Wayfare.

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

The unit tests cover reordering, distance calculation, GPX import/export (including endpoint places), malformed GPX handling, splitting a track at its closest coordinate, connecting imported tracks to adjacent places, Base64 serialization, unordered multi-frame QR reconstruction and integrity checks, reversible item diffs, box collisions, route intersection, callout placement, and connector geometry.

The Playwright suite covers desktop and mobile place editing, GPX import and endpoint editing, photograph controls, grouped settings, custom map sources, Help, every export preset, Base64/animated-QR transfer, named journeys, browser-Back undo, privacy controls, and browser persistence. Search, routing, and map-style responses are mocked, so browser tests require no API key.

## GitHub Pages deployment

1. Create a GitHub repository and push this project to its `main` branch.
2. Open **Settings → Pages** in GitHub.
3. Select **GitHub Actions** as the build and deployment source.
4. Push to `main`.

The included workflow installs dependencies, verifies formatting, runs unit and Chromium browser tests, creates the production build, and deploys `dist/`.

Required GitHub deployment configuration:

| GitHub setting                      | Vite build variable               | Purpose                                                 |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------- |
| Secret `ADSENSE_CLIENT`             | `VITE_ADSENSE_CLIENT`             | Google AdSense publisher client, for example `ca-pub-…` |
| Secret `CLOUDFLARE_ANALYTICS_TOKEN` | `VITE_CLOUDFLARE_ANALYTICS_TOKEN` | Cloudflare Web Analytics site token                     |
| Variable `PUBLIC_SITE_URL`          | `VITE_PUBLIC_SITE_URL`            | Absolute production URL used for the canonical SEO link |

The build injects the standard AdSense loader directly into `<head>`, allowing Google’s crawler to detect it, and injects Cloudflare’s module beacon with its site token. AdSense is suitable for Auto ads; configure placement, site approval, and Google’s certified CMP/European regulations message in the AdSense account. Public frontend build variables are never secret at runtime even when supplied through GitHub Secrets.

The privacy banner is informational: it links to the active-service details but does not disable either configured integration.

Vite uses relative asset paths, so the build supports both root domains and GitHub repository subpaths.

## Responsive layout

On tablets and phones, a compact map appears first while the beginning of the journey list remains visible in the first screen. Toolbars contract to the available width, settings and editors become bottom sheets on narrow phones, and multi-column controls collapse to touch-friendly single columns.

## Sharing a complete journey

Choose **Share** to serialize the journey name, items, GPX coordinates, endpoint places, appearance settings, descriptions, and photographs into URL-safe Base64. The code is displayed for copying and pasting; it is deliberately not placed in the page URL. Loading a code creates a new local journey so it does not overwrite existing work. The Mapbox session token is deliberately excluded.

For phone-to-phone transfer, the same dialog divides the code into numbered QR frames. The sender repeats them in a loop. The receiver collects frames in any order, ignores repeats, waits for missed frames to appear again, and validates a checksum before importing. In-page scanning uses the browser Barcode Detector API and camera permission over HTTPS; copy/paste is the universal fallback. This is fault-tolerant against missed frames, but it is not an internet transfer and both devices must remain present until completion.

**Share GIF via WhatsApp, Signal, or…** creates an animated GIF containing the repeating QR sequence and invokes the device’s native share sheet. The shared text uses `VITE_PUBLIC_SITE_URL` (configured from the GitHub `PUBLIC_SITE_URL` variable), includes the public Wayfare address and `?import=1` link, and explains how to open the scanner, allow camera access, and keep the GIF visible until reception reaches 100%. If file sharing is unavailable, Wayfare downloads the GIF and copies the complete instructions so both can be attached manually.

## Search and generative-engine discoverability

The static entry page contains a concise description, robots directives, Open Graph metadata, relevant keywords, a no-script explanation, and `SoftwareApplication` JSON-LD. Set `PUBLIC_SITE_URL` in GitHub to add the correct canonical URL without hard-coding a repository name.
