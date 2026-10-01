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
  await page.route("**/*.png", (route) => route.abort());
}

test.beforeEach(async ({ page }) => {
  await mockApis(page);
  await page.goto("/");
});

test("adds, edits, inserts and removes journey stops", async ({ page }) => {
  const search = page.getByLabel("Search for a place");
  await search.fill("Vienna");
  await page.getByRole("option", { name: /Vienna/ }).click();
  await search.fill("Graz");
  await page.getByRole("option", { name: /Graz/ }).click();
  await expect(page.getByText("199 km")).toBeVisible();
  await page.getByLabel("Marker style for Vienna").selectOption("dot");
  await page.getByLabel("Name for stop 1").fill("Wien");
  await page.getByRole("button", { name: "Delete Graz" }).click();
  await expect(page.getByLabel("Name for stop 1")).toHaveValue("Wien");
});

test("changes styling, manual zoom and enables optional provider", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open settings" }).click();
  await page
    .getByText("Automatically fit journey")
    .locator("..")
    .getByRole("checkbox")
    .uncheck();
  await expect(page.getByText("Zoom level")).toBeVisible();
  await page.getByLabel("Mapbox access token").fill("pk.test-token");
  await expect(page.getByText("Mapbox routing enabled")).toBeVisible();
});

test("opens export choices after a place is added", async ({ page }) => {
  await page.getByLabel("Search for a place").fill("Vienna");
  await page.getByRole("option", { name: /Vienna/ }).click();
  await page.getByRole("button", { name: "Export" }).click();
  await expect(
    page.getByRole("heading", { name: "Export journey" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /GPX/ })).toBeVisible();
});

test("keeps the journey after reload", async ({ page }) => {
  await page.getByLabel("Search for a place").fill("Vienna");
  await page.getByRole("option", { name: /Vienna/ }).click();
  await page.reload();
  await expect(page.getByLabel("Name for stop 1")).toHaveValue("Vienna");
});
