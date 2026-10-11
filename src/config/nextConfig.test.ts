import type { NextConfig } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";

const BASE_PATH_ENV = "NEXT_PUBLIC_BASE_PATH";

/** Loads next.config.ts from scratch so that it reads the environment as stubbed by the test. */
async function loadConfig(): Promise<NextConfig> {
  vi.resetModules();
  const loaded = await import("../../next.config");
  return loaded.default;
}

describe("next.config.ts", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("basePath", () => {
    it("is empty when NEXT_PUBLIC_BASE_PATH is not set", async () => {
      // Arrange
      vi.stubEnv(BASE_PATH_ENV, undefined);

      // Act
      const config = await loadConfig();

      // Assert
      expect(config.basePath).toBe("");
    });

    it("is empty when NEXT_PUBLIC_BASE_PATH is empty, as on a custom domain", async () => {
      // Arrange
      vi.stubEnv(BASE_PATH_ENV, "");

      // Act
      const config = await loadConfig();

      // Assert
      expect(config.basePath).toBe("");
    });

    it("is the value of NEXT_PUBLIC_BASE_PATH for a project site", async () => {
      // Arrange
      vi.stubEnv(BASE_PATH_ENV, "/numaliving.com.au");

      // Act
      const config = await loadConfig();

      // Assert
      expect(config.basePath).toBe("/numaliving.com.au");
    });

    // The full rule and its messages are tested in src/lib/basePath.test.ts; these check that the
    // build applies it.
    it.each([
      ["does not start with a slash", "numaliving.com.au", 'must start with "/"'],
      ["ends with a slash", "/numaliving.com.au/", 'must not end with "/"'],
      ["is a single slash", "/", 'must not end with "/"'],
      ["starts with two slashes, like a link to another host", "//numaliving.com.au", 'must not contain "//"'],
    ])("fails the build when NEXT_PUBLIC_BASE_PATH %s", async (_label, value, message) => {
      // Arrange
      vi.stubEnv(BASE_PATH_ENV, value);

      // Act
      const act = loadConfig();

      // Assert
      await expect(act).rejects.toThrow(message);
    });

    it("names the setting and the offending value in the error", async () => {
      // Arrange
      vi.stubEnv(BASE_PATH_ENV, "numaliving.com.au");

      // Act
      const act = loadConfig();

      // Assert
      await expect(act).rejects.toThrow('NEXT_PUBLIC_BASE_PATH is "numaliving.com.au"');
    });
  });

  describe("static export", () => {
    it("writes plain files with a trailing slash on every route and unoptimised images", async () => {
      // Arrange
      vi.stubEnv(BASE_PATH_ENV, "/numaliving.com.au");

      // Act
      const config = await loadConfig();

      // Assert
      expect(config.output).toBe("export");
      expect(config.trailingSlash).toBe(true);
      expect(config.images).toEqual({ unoptimized: true });
    });
  });
});
