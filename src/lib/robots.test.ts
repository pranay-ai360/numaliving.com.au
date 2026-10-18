import { describe, expect, it } from "vitest";
import { buildRobots, buildRobotsMetadata } from "@/lib/robots";

const ALLOW_EVERYTHING = { rules: { userAgent: "*", allow: "/" } };
const SITEMAP_ADDRESS = "https://numaliving.us/sitemap.xml";

describe("buildRobots", () => {
  it("allows every path for every crawler while the site is not indexable, so crawlers can read each page's noindex tag", () => {
    // Arrange
    const isIndexable = false;

    // Act
    const robots = buildRobots(isIndexable);

    // Assert
    expect(robots).toEqual(ALLOW_EVERYTHING);
  });

  it("allows every path for every crawler once the site is indexable, and points them at the sitemap", () => {
    // Arrange
    const isIndexable = true;

    // Act
    const robots = buildRobots(isIndexable);

    // Assert
    expect(robots).toEqual({ ...ALLOW_EVERYTHING, sitemap: SITEMAP_ADDRESS });
  });

  it("names no sitemap while the site is not indexable, because the sitemap is empty then", () => {
    // Arrange
    const isIndexable = false;

    // Act
    const robots = buildRobots(isIndexable);

    // Assert
    expect(robots).not.toHaveProperty("sitemap");
  });

  it("writes the sitemap address below the base path when the site is served from a sub-path", () => {
    // Arrange
    const urls = { basePath: "/numaliving.com.au" };

    // Act
    const robots = buildRobots(true, urls);

    // Assert
    expect(robots.sitemap).toBe("https://numaliving.us/numaliving.com.au/sitemap.xml");
  });

  it.each([false, true])("never disallows a path (isIndexable: %s)", (isIndexable) => {
    // Arrange
    // (the table above supplies the setting)

    // Act
    const robots = buildRobots(isIndexable);

    // Assert
    expect(JSON.stringify(robots)).not.toContain("disallow");
  });

  it("returns a new object on every call so that callers cannot share state", () => {
    // Arrange
    const first = buildRobots(false);

    // Act
    const second = buildRobots(false);

    // Assert
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.rules).not.toBe(first.rules);
  });
});

describe("buildRobotsMetadata", () => {
  it("asks search engines not to index the page or follow its links while the site is not indexable", () => {
    // Arrange
    const isIndexable = false;

    // Act
    const robots = buildRobotsMetadata(isIndexable);

    // Assert
    expect(robots).toEqual({ index: false, follow: false });
  });

  it("leaves the robots metadata unset once the site is indexable", () => {
    // Arrange
    const isIndexable = true;

    // Act
    const robots = buildRobotsMetadata(isIndexable);

    // Assert
    expect(robots).toBeUndefined();
  });
});
