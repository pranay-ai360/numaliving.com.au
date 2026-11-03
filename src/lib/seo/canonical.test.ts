import { afterEach, describe, expect, it, vi } from "vitest";
import { absoluteUrl, canonicalUrl } from "@/lib/seo/canonical";

const ORIGIN = "https://numaliving.us";
const BASE = "/numaliving.com.au";
const BASE_PATH_ENV = "NEXT_PUBLIC_BASE_PATH";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("absoluteUrl", () => {
  it("joins a root-relative path to the site address", () => {
    // Arrange
    const path = "/og/default.jpg";

    // Act
    const url = absoluteUrl(path);

    // Assert
    expect(url).toBe("https://numaliving.us/og/default.jpg");
  });

  it("writes the site root with its slash", () => {
    // Arrange
    const path = "/";

    // Act
    const url = absoluteUrl(path);

    // Assert
    expect(url).toBe("https://numaliving.us/");
  });

  it("keeps a query string and a hash, which a file link may need", () => {
    // Arrange
    const path = "/logo.png?v=2#top";

    // Act
    const url = absoluteUrl(path);

    // Assert
    expect(url).toBe("https://numaliving.us/logo.png?v=2#top");
  });

  it("does not add a trailing slash to a file", () => {
    // Arrange
    const path = "/sitemap.xml";

    // Act
    const url = absoluteUrl(path);

    // Assert
    expect(url).toBe("https://numaliving.us/sitemap.xml");
  });

  it("percent-encodes a space, so the address is always valid", () => {
    // Arrange
    const path = "/projects/my photo.jpg";

    // Act
    const url = absoluteUrl(path);

    // Assert
    expect(url).toBe("https://numaliving.us/projects/my%20photo.jpg");
  });

  it("uses the address it is given instead of the site's", () => {
    // Arrange
    const options = { origin: "https://example.com" };

    // Act
    const url = absoluteUrl("/about", options);

    // Assert
    expect(url).toBe("https://example.com/about");
  });

  it.each([
    ["an empty string", ""],
    ["a path without a leading slash", "about"],
    ["a dot-relative path", "./about"],
    ["a full address", "https://example.com/about"],
    ["a protocol-relative address", "//example.com/about"],
    ["a hash-only link", "#main"],
  ])("rejects %s, because it is not a path on this site", (_label, path) => {
    // Arrange
    // (the table above supplies the path)

    // Act
    const act = (): string => absoluteUrl(path);

    // Assert
    expect(act).toThrow(/must start with a single "\/"/);
  });

  it.each([
    ["a trailing slash", "https://numaliving.us/"],
    ["a path", "https://numaliving.us/en"],
    ["no scheme", "numaliving.us"],
    ["the wrong scheme", "ftp://numaliving.us"],
    ["an empty string", ""],
  ])("rejects a site address with %s", (_label, origin) => {
    // Arrange
    // (the table above supplies the address)

    // Act
    const act = (): string => absoluteUrl("/about", { origin });

    // Assert
    expect(act).toThrow(/site address .* must be an origin/);
  });

  describe("below a base path", () => {
    it("puts the base path between the address and the path", () => {
      // Arrange
      const options = { basePath: BASE };

      // Act
      const url = absoluteUrl("/og/default.jpg", options);

      // Assert
      expect(url).toBe(`${ORIGIN}${BASE}/og/default.jpg`);
    });

    it("writes the site root below the base path with its slash", () => {
      // Arrange
      const options = { basePath: BASE };

      // Act
      const url = absoluteUrl("/", options);

      // Assert
      expect(url).toBe(`${ORIGIN}${BASE}/`);
    });

    it("reads the base path from NEXT_PUBLIC_BASE_PATH when none is given", () => {
      // Arrange
      vi.stubEnv(BASE_PATH_ENV, BASE);

      // Act
      const url = absoluteUrl("/about");

      // Assert
      expect(url).toBe(`${ORIGIN}${BASE}/about`);
    });

    it("lets an explicit empty base path win over the environment", () => {
      // Arrange
      vi.stubEnv(BASE_PATH_ENV, BASE);

      // Act
      const url = absoluteUrl("/about", { basePath: "" });

      // Assert
      expect(url).toBe(`${ORIGIN}/about`);
    });

    it("adds nothing when NEXT_PUBLIC_BASE_PATH is empty, as on numaliving.us", () => {
      // Arrange
      vi.stubEnv(BASE_PATH_ENV, "");

      // Act
      const url = absoluteUrl("/about");

      // Assert
      expect(url).toBe(`${ORIGIN}/about`);
    });

    it("throws the base path rule's error when the setting is malformed", () => {
      // Arrange
      vi.stubEnv(BASE_PATH_ENV, "numaliving.com.au");

      // Act
      const act = (): string => absoluteUrl("/about");

      // Assert
      expect(act).toThrow('NEXT_PUBLIC_BASE_PATH is "numaliving.com.au", but it must start with "/"');
    });
  });
});

describe("canonicalUrl", () => {
  it("ends a page address in a slash, as the static export serves it", () => {
    // Arrange
    const path = "/about";

    // Act
    const url = canonicalUrl(path);

    // Assert
    expect(url).toBe("https://numaliving.us/about/");
  });

  it("gives the same address for a path that already ends in a slash", () => {
    // Arrange
    const path = "/about/";

    // Act
    const url = canonicalUrl(path);

    // Assert
    expect(url).toBe("https://numaliving.us/about/");
  });

  it("writes the home page as the site address with a slash", () => {
    // Arrange
    const path = "/";

    // Act
    const url = canonicalUrl(path);

    // Assert
    expect(url).toBe("https://numaliving.us/");
  });

  it("keeps every part of a nested page path", () => {
    // Arrange
    const path = "/projects/golf-links";

    // Act
    const url = canonicalUrl(path);

    // Assert
    expect(url).toBe("https://numaliving.us/projects/golf-links/");
  });

  it.each([
    ["a query string", "/projects?sector=Office", "https://numaliving.us/projects/"],
    ["a hash", "/about#story", "https://numaliving.us/about/"],
    ["both", "/contact/?ref=ad#form", "https://numaliving.us/contact/"],
    ["a query string on the home page", "/?utm_source=x", "https://numaliving.us/"],
  ])("drops %s, so every variant shares one canonical address", (_label, path, expected) => {
    // Arrange
    // (the table above supplies the path)

    // Act
    const url = canonicalUrl(path);

    // Assert
    expect(url).toBe(expected);
  });

  it.each([
    ["an empty string", ""],
    ["a path without a leading slash", "about"],
    ["a full address", "https://example.com/about"],
    ["a protocol-relative address", "//example.com/about"],
  ])("rejects %s", (_label, path) => {
    // Arrange
    // (the table above supplies the path)

    // Act
    const act = (): string => canonicalUrl(path);

    // Assert
    expect(act).toThrow(/must start with a single "\/"/);
  });

  it("uses the address and base path it is given", () => {
    // Arrange
    const options = { origin: "https://example.com", basePath: "/preview" };

    // Act
    const url = canonicalUrl("/about", options);

    // Assert
    expect(url).toBe("https://example.com/preview/about/");
  });

  it("writes the home page below a base path as the base path with a slash", () => {
    // Arrange
    const options = { basePath: BASE };

    // Act
    const url = canonicalUrl("/", options);

    // Assert
    expect(url).toBe(`${ORIGIN}${BASE}/`);
  });
});
