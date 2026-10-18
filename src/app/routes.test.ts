/**
 * The pages in src/app and the page registry (src/content/seo.ts) must name the same pages. A page
 * without an entry would get the layout's default title and description, miss the sitemap and escape
 * every end-to-end loop over the registry; an entry without a page would put a 404 in the sitemap.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pageRegistry } from "@/content/seo";

const APP_DIR = path.join(process.cwd(), "src/app");
const DYNAMIC_SEGMENT = /^\[[^\]]+\]$/;
const ROUTE_GROUP = /^\(.*\)$/;

/** The route of every folder under src/app that holds a page.tsx: "/", "/about", "/projects/[slug]". */
function pageRoutes(folder: string = APP_DIR, segments: readonly string[] = []): readonly string[] {
  const entries = readdirSync(folder, { withFileTypes: true });
  const own = entries.some((entry) => entry.isFile() && entry.name === "page.tsx") ? [`/${segments.join("/")}`] : [];
  const below = entries
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => pageRoutes(path.join(folder, entry.name), ROUTE_GROUP.test(entry.name) ? segments : [...segments, entry.name]));
  return [...own, ...below];
}

function isDynamic(route: string): boolean {
  return route.split("/").some((segment) => DYNAMIC_SEGMENT.test(segment));
}

/** "/projects/[slug]" matches "/projects/golf-links": each dynamic segment is one non-empty segment. */
function matcherFor(route: string): RegExp {
  const pattern = route
    .split("/")
    .map((segment) => (DYNAMIC_SEGMENT.test(segment) ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${pattern}$`);
}

const ROUTES = pageRoutes();
const STATIC_ROUTES = ROUTES.filter((route) => !isDynamic(route));
const DYNAMIC_ROUTES = ROUTES.filter(isDynamic);
const REGISTRY_PATHS = pageRegistry.map((entry) => entry.path);

describe("pageRoutes", () => {
  it("finds the pages of the site, including the home page and a dynamic route", () => {
    // Arrange
    const routes = ROUTES;

    // Act
    const found = ["/", "/about", "/contact", "/projects", "/projects/[slug]"].filter((route) => routes.includes(route));

    // Assert
    expect(found).toEqual(["/", "/about", "/contact", "/projects", "/projects/[slug]"]);
  });
});

describe("the pages and the page registry", () => {
  it.each(STATIC_ROUTES.map((route) => [route] as const))("page %s has an entry in the registry", (route) => {
    // Arrange
    const paths = REGISTRY_PATHS;

    // Act
    const isRegistered = paths.includes(route);

    // Assert
    expect(isRegistered, `src/app has a page for ${route} but src/content/seo.ts has no entry for it, so it would get the layout's default title and description and miss the sitemap`).toBe(true);
  });

  it.each(DYNAMIC_ROUTES.map((route) => [route] as const))("dynamic page %s has at least one entry in the registry", (route) => {
    // Arrange
    const matcher = matcherFor(route);

    // Act
    const entries = REGISTRY_PATHS.filter((registered) => matcher.test(registered));

    // Assert
    expect(entries.length).toBeGreaterThan(0);
  });

  it("has a page for every entry in the registry", () => {
    // Arrange
    const matchers = DYNAMIC_ROUTES.map(matcherFor);

    // Act
    const withoutPage = REGISTRY_PATHS.filter((registered) => !STATIC_ROUTES.includes(registered) && !matchers.some((matcher) => matcher.test(registered)));

    // Assert
    expect(withoutPage, "these registry entries have no page in src/app, so they would appear in the sitemap and answer 404").toEqual([]);
  });

  it("does not match a dynamic route to a path with more or fewer segments", () => {
    // Arrange
    const matcher = matcherFor("/projects/[slug]");

    // Act
    const results = ["/projects", "/projects/", "/projects/a/b", "/projects/a"].map((candidate) => matcher.test(candidate));

    // Assert
    expect(results).toEqual([false, false, false, true]);
  });
});
