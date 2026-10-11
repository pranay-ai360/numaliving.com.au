import { afterEach, describe, expect, it, vi } from "vitest";
import { joinBasePath, withBasePath } from "@/lib/assetPath";

const BASE = "/numaliving.com.au";
const BASE_PATH_ENV = "NEXT_PUBLIC_BASE_PATH";

describe("joinBasePath", () => {
  describe("with a base path", () => {
    it("prefixes a root-relative path", () => {
      // Arrange
      const path = "/projects/golf-links/photo-01.jpg";

      // Act
      const result = joinBasePath(BASE, path);

      // Assert
      expect(result).toBe("/numaliving.com.au/projects/golf-links/photo-01.jpg");
    });

    it("prefixes the site root", () => {
      // Arrange
      const path = "/";

      // Act
      const result = joinBasePath(BASE, path);

      // Assert
      expect(result).toBe("/numaliving.com.au/");
    });

    it("keeps the query string and hash of the path", () => {
      // Arrange
      const path = "/photo.jpg?v=2#top";

      // Act
      const result = joinBasePath(BASE, path);

      // Assert
      expect(result).toBe("/numaliving.com.au/photo.jpg?v=2#top");
    });

    it.each([
      ["http URL", "http://example.com/photo.jpg"],
      ["https URL", "https://example.com/photo.jpg"],
      ["protocol-relative URL", "//cdn.example.com/photo.jpg"],
      ["data URI", "data:image/png;base64,iVBORw0KGgo="],
      ["blob URL", "blob:https://example.com/0f5e1c2a"],
    ])("returns a %s unchanged", (_label, path) => {
      // Arrange
      // (the table above supplies the path)

      // Act
      const result = joinBasePath(BASE, path);

      // Assert
      expect(result).toBe(path);
    });

    it.each([
      ["a relative path", "images/photo.jpg"],
      ["a dot-relative path", "./photo.jpg"],
      ["a parent-relative path", "../photo.jpg"],
      ["a hash-only link", "#main"],
      ["a query-only link", "?page=2"],
      ["an empty string", ""],
    ])("returns %s unchanged", (_label, path) => {
      // Arrange
      // (the table above supplies the path)

      // Act
      const result = joinBasePath(BASE, path);

      // Assert
      expect(result).toBe(path);
    });

    it.each([
      ["a file below the base", "/numaliving.com.au/photo.jpg"],
      ["the base itself", "/numaliving.com.au"],
      ["the base with a query string", "/numaliving.com.au?page=2"],
      ["the base with a hash", "/numaliving.com.au#top"],
    ])("does not prefix %s a second time", (_label, path) => {
      // Arrange
      // (the table above supplies the path)

      // Act
      const result = joinBasePath(BASE, path);

      // Assert
      expect(result).toBe(path);
    });

    it("still prefixes a path that only starts with the same characters as the base", () => {
      // Arrange
      const path = "/numaliving.com.australia/photo.jpg";

      // Act
      const result = joinBasePath(BASE, path);

      // Assert
      expect(result).toBe("/numaliving.com.au/numaliving.com.australia/photo.jpg");
    });

    it("gives the same result when applied twice", () => {
      // Arrange
      const once = joinBasePath(BASE, "/projects/photo.jpg");

      // Act
      const twice = joinBasePath(BASE, once);

      // Assert
      expect(twice).toBe(once);
    });
  });

  describe("without a base path", () => {
    it.each([
      ["an empty string", ""],
      ["undefined", undefined],
    ])("returns the path unchanged when the base is %s", (_label, base) => {
      // Arrange
      const path = "/projects/golf-links/photo-01.jpg";

      // Act
      const result = joinBasePath(base, path);

      // Assert
      expect(result).toBe(path);
    });
  });

  describe("with an invalid base path (the rule in basePath.ts, shared with next.config.ts)", () => {
    it("throws a clear error when the base does not start with a slash", () => {
      // Arrange
      const base = "numaliving.com.au";

      // Act
      const act = (): string => joinBasePath(base, "/photo.jpg");

      // Assert
      expect(act).toThrow('NEXT_PUBLIC_BASE_PATH is "numaliving.com.au", but it must start with "/"');
    });

    it.each([
      ["a single slash", "/"],
      ["one trailing slash", "/numaliving.com.au/"],
      ["several trailing slashes", "/numaliving.com.au///"],
    ])("throws, as the build does, when the base is %s", (_label, base) => {
      // Arrange
      const path = "/photo.jpg";

      // Act
      const act = (): string => joinBasePath(base, path);

      // Assert
      expect(act).toThrow('it must not end with "/"');
    });

    it("throws even when the path would have been left alone", () => {
      // Arrange
      const base = "numaliving.com.au";

      // Act
      const act = (): string => joinBasePath(base, "https://example.com/photo.jpg");

      // Assert
      expect(act).toThrow('NEXT_PUBLIC_BASE_PATH is "numaliving.com.au"');
    });
  });
});

describe("withBasePath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefixes a root-relative path with NEXT_PUBLIC_BASE_PATH", () => {
    // Arrange
    vi.stubEnv(BASE_PATH_ENV, BASE);

    // Act
    const result = withBasePath("/projects/golf-links/photo-01.jpg");

    // Assert
    expect(result).toBe("/numaliving.com.au/projects/golf-links/photo-01.jpg");
  });

  it("reads NEXT_PUBLIC_BASE_PATH on every call", () => {
    // Arrange
    vi.stubEnv(BASE_PATH_ENV, BASE);
    const withBase = withBasePath("/photo.jpg");

    // Act
    vi.stubEnv(BASE_PATH_ENV, "/other");
    const withOther = withBasePath("/photo.jpg");

    // Assert
    expect(withBase).toBe("/numaliving.com.au/photo.jpg");
    expect(withOther).toBe("/other/photo.jpg");
  });

  it("returns the path unchanged when NEXT_PUBLIC_BASE_PATH is empty", () => {
    // Arrange
    vi.stubEnv(BASE_PATH_ENV, "");

    // Act
    const result = withBasePath("/photo.jpg");

    // Assert
    expect(result).toBe("/photo.jpg");
  });

  it("returns the path unchanged when NEXT_PUBLIC_BASE_PATH is not set", () => {
    // Arrange
    vi.stubEnv(BASE_PATH_ENV, undefined);

    // Act
    const result = withBasePath("/photo.jpg");

    // Assert
    expect(result).toBe("/photo.jpg");
  });

  it("leaves an absolute URL alone when a base path is set", () => {
    // Arrange
    vi.stubEnv(BASE_PATH_ENV, BASE);

    // Act
    const result = withBasePath("https://example.com/photo.jpg");

    // Assert
    expect(result).toBe("https://example.com/photo.jpg");
  });

  it("throws a clear error when NEXT_PUBLIC_BASE_PATH does not start with a slash", () => {
    // Arrange
    vi.stubEnv(BASE_PATH_ENV, "numaliving.com.au");

    // Act
    const act = (): string => withBasePath("/photo.jpg");

    // Assert
    expect(act).toThrow('NEXT_PUBLIC_BASE_PATH is "numaliving.com.au", but it must start with "/"');
  });
});
