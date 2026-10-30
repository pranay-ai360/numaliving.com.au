import { describe, expect, it } from "vitest";
import { projects } from "./projects";

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe("project slugs", () => {
  it("are unique and use only lowercase letters, digits and hyphens, because a slug becomes the page address", () => {
    // Arrange
    const slugs = projects.map((project) => project.slug);

    // Act
    const badSlugs = slugs.filter((slug) => !KEBAB_CASE.test(slug));

    // Assert
    expect(badSlugs).toEqual([]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
