import { expect, test, type Page } from "@playwright/test";

const vienna = {
  display_name: "Vienna, Austria",
  name: "Vienna",
  lat: "48.2082",
  lon: "16.3738",
};
const graz = {
  display_name: "Graz, Styria, Austria",
  name: "Graz",
  lat: "47.0707",
  lon: "15.4395",
};
const emptyStyle = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#ece8df" },
    },
  ],
};

async function mockApis(page: Page) {
  await page.route("**/nominatim.openstreetmap.org/search**", async (route) => {
    const query = new URL(route.request().url()).searchParams
      .get("q")
      ?.toLowerCase();
    await route.fulfill({ json: query?.includes("graz") ? [graz] : [vienna] });
  });
  await page.route("**/router.project-osrm.org/route/**", (route) =>
    route.fulfill({
      json: {
        routes: [
          {
            geometry: {
              coordinates: [
                [16.3738, 48.2082],
                [15.4395, 47.0707],
              ],
            },
            distance: 199000,
            duration: 8000,
          },
        ],
      },
    }),
  );
  await page.route("**/tiles.openfreemap.org/styles/**", (route) =>
    route.fulfill({ json: emptyStyle }),
  );
  await page.route("**/*.png", (route) => route.abort());
}

async function addPlace(page: Page, name: string) {
  await page.getByLabel("Search for a place").fill(name);
  await page.getByRole("option", { name: new RegExp(name) }).click();
  await page.getByRole("button", { name: "Close Place details" }).click();
}

test.beforeEach(async ({ page }) => {
  await mockApis(page);
  await page.goto("/");
  const continueButton = page.getByRole("button", { name: "Continue" });
  if (await continueButton.isVisible()) await continueButton.click();
});

test("adds, edits, reorders and removes places", async ({ page }) => {
  await addPlace(page, "Vienna");
  await addPlace(page, "Graz");
  await expect(page.getByText("199 km")).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByLabel("Description").fill("First coffee of the journey");
  await page.getByLabel("Place marker type").selectOption("dot");
  await page.getByRole("button", { name: "Close Place details" }).click();
  await expect(
    page
      .locator('[aria-label="Journey items"]')
      .getByText("First coffee of the journey", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete Graz" }).click();
  await expect(page.getByText("Graz", { exact: true })).not.toBeVisible();
});

test("imports a GPX track and connects it in the journey sequence", async ({
  page,
}) => {
  await addPlace(page, "Vienna");
  await page.getByLabel("Import GPX track").setInputFiles({
    name: "morning-walk.gpx",
    mimeType: "application/gpx+xml",
    buffer: Buffer.from(
      '<?xml version="1.0"?><gpx><trk><name>Morning walk</name><trkseg><trkpt lat="48.20" lon="16.37"/><trkpt lat="48.21" lon="16.38"/></trkseg></trk></gpx>',
    ),
  });
  await expect(page.getByLabel("Name for item 2")).toHaveValue("Morning walk");
  await expect(page.getByText(/2 GPX points/)).toBeVisible();
  await expect(
    page.getByText("Tracks").locator("..").getByText("1"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).nth(1).click();
  await page.getByRole("button", { name: "Add start place" }).click();
  await expect(page.getByLabel("Name for Morning walk start")).toBeVisible();
  await page.getByRole("button", { name: "Close Edit GPX track" }).click();
});

test("adds and styles a place photograph", async ({ page }) => {
  await page.getByLabel("Search for a place").fill("Vienna");
  await page.getByRole("option", { name: /Vienna/ }).click();
  await page.locator('.upload-zone input[type="file"]').setInputFiles({
    name: "vienna.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.locator(".photo-preview")).toBeVisible();
  await page.getByRole("button", { name: "Close Place details" }).click();
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("button", { name: "Photograph style" }).click();
  await page
    .getByText("Photo corner roundness")
    .locator("..")
    .getByRole("slider")
    .fill("40");
  await page.getByRole("button", { name: "Close Settings" }).click();
  await page.getByRole("button", { name: "Edit" }).first().click();
  await expect(page.locator(".photo-preview")).toHaveCSS(
    "border-radius",
    "40%",
  );
});

test("groups settings, changes labels and accepts a custom map", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(page.getByText("Map background")).toBeVisible();
  const labelSettings = page.getByRole("button", { name: "Place labels" });
  await labelSettings.click();
  await expect(labelSettings).toHaveAttribute("aria-expanded", "true");
  await page.getByLabel("Show place descriptions").uncheck();
  await page
    .getByRole("button", { name: "Callout placement & connectors" })
    .click();
  await page.getByLabel("Arrow style").selectOption("dashed");
  await expect(page.getByLabel("Arrow style")).toHaveValue("dashed");
  await page.getByRole("button", { name: "Add another map" }).click();
  await page.getByLabel("Custom map name").fill("My local tiles");
  await page.getByLabel("Source type").selectOption("raster");
  await page.getByLabel("Map URL").fill("https://example.test/{z}/{x}/{y}.png");
  await page.getByRole("button", { name: "Add and select map" }).click();
  await expect(
    page.getByRole("button", { name: "Remove My local tiles" }),
  ).toBeVisible();
});

test("explains the workflow and offers every export format", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "How Wayfare works" }),
  ).toBeVisible();
  await expect(page.getByText("Mix places and tracks")).toBeVisible();
  await page.getByRole("button", { name: "Close How Wayfare works" }).click();
  await addPlace(page, "Vienna");
  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByLabel("Page or photo-book format")).toBeVisible();
  await page.getByLabel("Page or photo-book format").selectOption("a4-p");
  await expect(page.getByLabel("Image file format")).toHaveValue("png");
  await expect(
    page.getByRole("button", { name: "Download image" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "GPX Complete connected route",
      exact: true,
    }),
  ).toBeVisible();
});

test("persists the full journey in browser storage", async ({ page }) => {
  await addPlace(page, "Vienna");
  await page.reload();
  await expect(page.getByLabel("Name for item 1")).toHaveValue("Vienna");
});

test("copies, loads, and animates a self-contained journey code", async ({
  page,
}) => {
  await addPlace(page, "Vienna");
  await page.getByRole("button", { name: "Share journey" }).click();
  await expect(page.getByLabel("Journey code")).not.toHaveValue(/https?:/);
  await expect(page.getByAltText(/Journey QR frame 1 of/)).toBeVisible();
  await page.getByRole("button", { name: "Start repeating frames" }).click();
  await expect(
    page.getByRole("button", { name: "Pause frames" }),
  ).toBeVisible();
  const code = await page.getByLabel("Journey code").inputValue();
  await page.getByLabel("Load a copied code").fill(code);
  await page.getByRole("button", { name: "Load as new journey" }).click();
  await expect(page.getByText(/Imported “My journey”/)).toBeVisible();
});

test("keeps named journeys and undoes with browser back", async ({ page }) => {
  await page.getByLabel("Journey name").fill("Austria 2026");
  await addPlace(page, "Vienna");
  await page.goBack();
  await expect(page.getByLabel("Name for item 1")).not.toBeVisible();
  await page.getByRole("button", { name: "My journeys" }).click();
  await expect(page.getByText("Austria 2026", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New journey" }).click();
  await expect(page.getByLabel("Journey name")).toHaveValue("New journey");
});

test("shows active vendors and privacy information", async ({ page }) => {
  await page.getByRole("button", { name: "Privacy settings" }).click();
  await expect(
    page.getByRole("heading", { name: "Privacy settings" }),
  ).toBeVisible();
  await expect(page.getByText("Cloudflare Web Analytics")).toBeVisible();
  await expect(page.getByText("Google AdSense")).toBeVisible();
  await expect(page.getByText("Active")).toHaveCount(3);
  await page.getByRole("button", { name: "Close privacy information" }).click();
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(
    page.getByText("Information stored on your device"),
  ).toBeVisible();
});

test("reorders journey items with touch-safe controls", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile interaction only");
  await addPlace(page, "Vienna");
  await addPlace(page, "Graz");
  await page.getByRole("button", { name: "Move Graz up" }).click();
  await expect(page.getByLabel("Name for item 1")).toHaveValue("Graz");
  await expect(page.getByLabel("Name for item 2")).toHaveValue("Vienna");
});
