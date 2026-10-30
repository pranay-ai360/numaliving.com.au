import { describe, expect, it } from "vitest";
import { projects } from "./projects";

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A photo path may hold letters, digits and . _ - / only: no spaces or other characters a web address would have to escape. */
const URL_SAFE_PATH = /^\/[A-Za-z0-9._/-]+$/;

describe("project content", () => {
  it("gives every project a unique slug in lowercase letters, digits and hyphens", () => {
    // Arrange
    const slugs = projects.map((project) => project.slug);

    // Act
    const badSlugs = slugs.filter((slug) => !KEBAB_CASE.test(slug));

    // Assert
    expect(badSlugs).toEqual([]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps each project's photos in /projects/<slug>/", () => {
    const strays = projects.flatMap((project) => project.images.filter((src) => !src.startsWith(`/projects/${project.slug}/`)));

    expect(strays).toEqual([]);
  });

  it("uses only web-address-safe characters in photo paths", () => {
    const unsafe = projects.flatMap((project) => project.images.filter((src) => !URL_SAFE_PATH.test(src)));

    expect(unsafe).toEqual([]);
  });

  it("lists no photo twice in a project", () => {
    const repeated = projects.filter((project) => new Set(project.images).size !== project.images.length).map((project) => project.slug);

    expect(repeated).toEqual([]);
  });
});
