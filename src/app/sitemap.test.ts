import { describe, expect, it } from "vitest";
import sitemap, { dynamic } from "@/app/sitemap";
import { isIndexable } from "@/config/site";
import { pageRegistry } from "@/content/seo";
import { canonicalUrl } from "@/lib/seo/canonical";
import { buildSitemap } from "@/lib/seo/sitemap";

describe("sitemap route", () => {
  it("is generated at build time, which a static export requires", () => {
    // Arrange
    // (the route module is imported above)

    // Act
    const mode = dynamic;

    // Assert
    expect(mode).toBe("force-static");
  });

  it("serves the sitemap for the site's indexable setting and its page registry", () => {
    // Arrange
    const expected = buildSitemap(pageRegistry, { isIndexable });

    // Act
    const served = sitemap();

    // Assert
    expect(served).toEqual(expected);
  });

  it.runIf(!isIndexable)("lists nothing while the site is a preview, so search engines are not pointed at it", () => {
    // Arrange
    // (the route reads the site's current setting)

    // Act
    const served = sitemap();

    // Assert
    expect(served).toEqual([]);
  });

  it.runIf(isIndexable)("lists every page, the client login included, once the site is live", () => {
    // Arrange
    const expected = pageRegistry.map((entry) => canonicalUrl(entry.path));

    // Act
    const listed = sitemap().map((entry) => entry.url);

    // Assert
    expect(listed).toEqual(expected);
    expect(listed).toContain(canonicalUrl("/login"));
  });
});
