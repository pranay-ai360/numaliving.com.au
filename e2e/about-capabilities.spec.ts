import { expect, test } from "./fixtures";
import { pageUrl } from "./site";

test.skip(({ isMobile }) => isMobile, "The content is the same at every screen size.");

const REGIONS = [
  { name: "Middle East", countries: "UAE, Qatar" },
  { name: "Asia", countries: "India" },
  { name: "North America", countries: "United States" },
] as const;

/** The map's accessible name ends with the stops it draws a route to; its visible labels only show from the md breakpoint up. */
const MAP_ROUTES = /delivery routes to Doha, Thiruvananthapuram, California$/;

const FACTORY_ZONES = ["Engineering", "Machining", "Veneer", "Finishing", "Assembly & QC", "Export Packing"] as const;

test.describe("About", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(pageUrl("/about"));
  });

  test("lists Middle East, Asia and North America with their countries", async ({ page }) => {
    const reach = page.locator("section").filter({ has: page.getByRole("img", { name: /World map/ }) });

    await expect(reach.getByRole("heading", { level: 3 })).toHaveText(REGIONS.map((region) => region.name));
    for (const { countries } of REGIONS) {
      await expect(reach.getByText(countries, { exact: true })).toBeVisible();
    }
  });

  test("the world map routes to Doha, Thiruvananthapuram and California only", async ({ page }) => {
    await expect(page.getByRole("img", { name: /World map/ })).toHaveAccessibleName(MAP_ROUTES);
  });

  test("describes sea freight, not air freight", async ({ page }) => {
    await expect(page.getByText("Sea freight through established logistics partners")).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(/air freight/i);
  });
});

test.describe("Capabilities", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(pageUrl("/capabilities"));
  });

  test("the factory shows its six zones and no figures", async ({ page }) => {
    const factory = page.locator("#factory");

    await expect(factory.getByRole("heading", { level: 3 })).toHaveText(FACTORY_ZONES);
    await expect(factory.locator("dl")).toHaveCount(0);
  });

  test("shows five craft photos and the factory photo", async ({ page }) => {
    await expect(page.getByRole("main").locator("img")).toHaveCount(6);
  });
});

