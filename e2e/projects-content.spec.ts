import { getProject } from "../src/content/projects";
import { expect, test } from "./fixtures";
import { PROJECTS_PATH, pageUrl } from "./site";

test.skip(({ isMobile }) => isMobile, "The content is the same at every screen size.");

/** The five projects in the USA, with the lowercase slugs their web addresses use. */
const USA_PROJECTS = [
  { slug: "amherst", name: "Amherst Ct", city: "Los Altos Hills" },
  { slug: "estacada", name: "Estacada", city: "Los Altos Hills" },
  { slug: "poppy-11", name: "Poppy 11", city: "Pebble Beach" },
  { slug: "poppy-16", name: "Poppy 16", city: "Pebble Beach" },
  { slug: "sandy", name: "Sandy Ct", city: "Morgan Hill" },
] as const;

test.describe("Projects page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(pageUrl(PROJECTS_PATH));
  });

  test("the country filter offers UAE and USA only", async ({ page }) => {
    await expect(page.getByLabel("Country").locator("option")).toHaveText(["All", "UAE", "USA"]);
  });

  test("filtering by USA lists the five US projects", async ({ page }) => {
    await page.getByLabel("Country").selectOption("USA");

    await expect(page.getByText("5 projects", { exact: true })).toBeVisible();
    for (const { name } of USA_PROJECTS) {
      await expect(page.getByRole("main").getByRole("heading", { level: 3, name, exact: true })).toBeVisible();
    }
  });
});

for (const { slug, name, city } of USA_PROJECTS) {
  test(`${slug} opens with its name, its location and every photo`, async ({ page }) => {
    const project = getProject(slug);
    if (!project) throw new Error(`There is no project with the slug "${slug}"`);

    await page.goto(pageUrl(`${PROJECTS_PATH}/${slug}`));

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.locator("aside")).toContainText(`${city}, USA`);
    await expect(page.getByRole("img", { name, exact: true })).toHaveCount(project.images.length);
  });
}
