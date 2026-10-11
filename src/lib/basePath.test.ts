import { describe, expect, it } from "vitest";
import { parseBasePath } from "@/lib/basePath";

describe("parseBasePath", () => {
  describe("without a base path", () => {
    it.each([
      ["unset", undefined],
      ["empty", ""],
    ])("returns an empty base path when the setting is %s", (_label, raw) => {
      // Arrange
      // (the table above supplies the raw setting)

      // Act
      const result = parseBasePath(raw);

      // Assert
      expect(result).toBe("");
    });
  });

  describe("with a valid base path", () => {
    it.each([
      ["the GitHub Pages project path", "/numaliving.com.au"],
      ["a path of several parts", "/sites/numa-living_v2"],
      ["a part with a tilde", "/~numa"],
    ])("returns %s unchanged", (_label, raw) => {
      // Arrange
      // (the table above supplies the raw setting)

      // Act
      const result = parseBasePath(raw);

      // Assert
      expect(result).toBe(raw);
    });
  });

  describe("with an invalid base path", () => {
    it.each([
      ["has no leading slash", "numaliving.com.au", 'it must start with "/"'],
      ["is blank", " ", 'it must start with "/"'],
      ["is a single slash", "/", 'it must not end with "/"'],
      ["ends with a slash", "/numaliving.com.au/", 'it must not end with "/"'],
      ["starts with two slashes, like a link to another host", "//numaliving.com.au", 'it must not contain "//"'],
      ["has an empty part", "/sites//numa", 'it must not contain "//"'],
      ["has a space", "/numaliving.com.au ", 'may only use letters, digits, "-", ".", "_" and "~"'],
      ["has a query string", "/numa?x=1", 'may only use letters, digits, "-", ".", "_" and "~"'],
      ["has a hash", "/numa#top", 'may only use letters, digits, "-", ".", "_" and "~"'],
      ["has a backslash", "/numa\\living", 'may only use letters, digits, "-", ".", "_" and "~"'],
      ["has a parent-directory part", "/sites/../numa", 'may not be "." or ".."'],
      ["has a current-directory part", "/./numa", 'may not be "." or ".."'],
    ])("throws when the setting %s", (_label, raw, problem) => {
      // Arrange
      // (the table above supplies the raw setting and the expected problem)

      // Act
      const act = (): string => parseBasePath(raw);

      // Assert
      expect(act).toThrow(problem);
    });

    it("names the setting and the offending value, and shows a valid example", () => {
      // Arrange
      const raw = "numaliving.com.au";

      // Act
      const act = (): string => parseBasePath(raw);

      // Assert
      expect(act).toThrow(
        'NEXT_PUBLIC_BASE_PATH is "numaliving.com.au", but it must start with "/". Use a path such as "/numaliving.com.au", or leave it empty to serve the site from the root of the domain.',
      );
    });

    it("names another setting when asked to", () => {
      // Arrange
      const settingName = "PAGES_BASE_PATH";

      // Act
      const act = (): string => parseBasePath("/numaliving.com.au/", settingName);

      // Assert
      expect(act).toThrow('PAGES_BASE_PATH is "/numaliving.com.au/", but it must not end with "/"');
    });
  });
});
