import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSitemap } from "@/lib/seo/sitemap";
import type { PageSeo } from "@/lib/types";

function page(path: string, overrides: Partial<PageSeo> = {}): PageSeo {
  return {
    path,
    title: `Title of ${path}`,
    description: `Description of ${path}`,
    indexable: true,
    updated: "2026-10-18",
    ...overrides,
  };
}

const PAGES: readonly PageSeo[] = [
  page("/"),
  page("/about", { updated: "2026-09-30" }),
  page("/login", { indexable: false }),
  page("/projects/golf-links", { updated: "2026-10-01" }),
];

afterEach(() => {
  vi.useRealTimers();
});

describe("buildSitemap", () => {
  it("lists nothing while the site is not indexable, so search engines are not pointed at a preview", () => {
    // Arrange
    const options = { isIndexable: false };

    // Act
    const sitemap = buildSitemap(PAGES, options);

    // Assert
    expect(sitemap).toEqual([]);
  });

  it("lists the canonical address of every indexable page once the site is indexable, in registry order", () => {
    // Arrange
    const options = { isIndexable: true };

    // Act
    const sitemap = buildSitemap(PAGES, options);

    // Assert
    expect(sitemap.map((entry) => entry.url)).toEqual([
      "https://numaliving.us/",
      "https://numaliving.us/about/",
      "https://numaliving.us/projects/golf-links/",
    ]);
  });

  it("leaves out a page that is never indexable, such as the client login", () => {
    // Arrange
    const options = { isIndexable: true };

    // Act
    const sitemap = buildSitemap(PAGES, options);

    // Assert
    expect(sitemap.map((entry) => entry.url).join(" ")).not.toContain("/login");
  });

  it("takes each last-modified date from the page's own entry", () => {
    // Arrange
    const options = { isIndexable: true };

    // Act
    const sitemap = buildSitemap(PAGES, options);

    // Assert
    expect(sitemap.map((entry) => entry.lastModified)).toEqual(["2026-10-18", "2026-09-30", "2026-10-01"]);
  });

  it("never uses the time of the build for a last-modified date", () => {
    // Arrange
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-05-05T00:00:00Z"));
    const options = { isIndexable: true };

    // Act
    const sitemap = buildSitemap(PAGES, options);

    // Assert
    expect(JSON.stringify(sitemap)).not.toContain("2031");
  });

  it("writes the addresses below the base path when the site is served from a sub-path", () => {
    // Arrange
    const options = { isIndexable: true, urls: { basePath: "/numaliving.com.au" } };

    // Act
    const sitemap = buildSitemap([page("/about")], options);

    // Assert
    expect(sitemap.map((entry) => entry.url)).toEqual(["https://numaliving.us/numaliving.com.au/about/"]);
  });

  it("lists nothing when there are no pages", () => {
    // Arrange
    const options = { isIndexable: true };

    // Act
    const sitemap = buildSitemap([], options);

    // Assert
    expect(sitemap).toEqual([]);
  });

  it("returns new entries on every call and leaves the pages as they were", () => {
    // Arrange
    const pages = PAGES.map((entry) => Object.freeze({ ...entry }));
    const options = { isIndexable: true };
    const first = buildSitemap(pages, options);

    // Act
    const second = buildSitemap(pages, options);

    // Assert
    expect(second).toEqual(first);
    expect(second[0]).not.toBe(first[0]);
  });
});
