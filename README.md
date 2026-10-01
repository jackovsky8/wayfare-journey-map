# Wayfare — Journey Map Studio

A frontend-only journey map editor. Add visited places, reorder and style the stops, trace a road route, choose a map style, and export PNG, JPG, WebP, or GPX. The app has no server and is ready for GitHub Pages.

## What works without an API key

- Place search via OpenStreetMap Nominatim
- Road routing via the public OSRM demo service, with straight-line fallback
- OpenStreetMap and CARTO-based Paper, Atlas, and Midnight styles
- Editable/reorderable stops with pin, dot, or route-only markers
- Automatic framing or manual zoom
- Image and GPX export
- Journey persistence in `localStorage`

For light personal use these public services are convenient. For significant traffic, host your own service or configure a commercial provider and follow each provider's usage policy.

## Optional provider

Open **Settings** and add a Mapbox public access token to enable Mapbox Directions. The token is kept in `sessionStorage`, so it disappears when the browser tab/session closes. A frontend cannot keep an API key secret: always restrict public tokens by allowed URL and scope in the provider dashboard.

## Local development

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Open <http://localhost:4173>.

## Verify

```bash
npm run format
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

Browser tests mock search/routing responses and do not require API keys or network access.

## Deploy to GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source.
3. Push to `main`. The included workflow formats, tests, builds, and deploys `dist/`.

Vite uses a relative asset base, so both user/organization sites and repository subpaths work without changing configuration.

## Data and privacy

The journey stays in the browser's local storage. Search text and coordinates are sent directly from the browser to the selected map/routing services. There is no application backend or account system.
