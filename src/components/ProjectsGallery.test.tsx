import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectsGallery } from "@/components/ProjectsGallery";
import type { ShowcaseProject } from "@/lib/types";

function projectWithPhoto(slug: string): ShowcaseProject {
  return {
    slug,
    name: `Project ${slug}`,
    sector: "Residences",
    city: "Dubai",
    country: "UAE",
    year: 2025,
    summary: "A project used by the tests.",
    scope: ["Kitchen"],
    materials: ["Oak veneer"],
    durationWeeks: 12,
    photos: [{ src: `/projects/${slug}/${slug}-01.jpg`, alt: `Photo of project ${slug}`, width: 1600, height: 1067 }],
    palette: ["oak", "linen", "brass"],
  };
}

const PROJECTS: readonly ShowcaseProject[] = ["one", "two", "three", "four", "five"].map(projectWithPhoto);

function photosOf(projects: readonly ShowcaseProject[]): readonly HTMLElement[] {
  return projects.map((project) => screen.getByRole("img", { name: project.photos[0].alt }));
}

describe("ProjectsGallery", () => {
  it("loads the photos of the first three cards, the first row on a wide screen, at once", () => {
    // Arrange
    render(<ProjectsGallery projects={PROJECTS} />);

    // Act
    const firstRow = photosOf(PROJECTS.slice(0, 3));

    // Assert
    for (const photo of firstRow) {
      expect(photo).toHaveAttribute("loading", "eager");
      expect(photo).toHaveAttribute("decoding", "async");
      expect(photo).not.toHaveAttribute("fetchpriority");
    }
  });

  it("loads the photos of every later card lazily, as they near the screen", () => {
    // Arrange
    render(<ProjectsGallery projects={PROJECTS} />);

    // Act
    const laterCards = photosOf(PROJECTS.slice(3));

    // Assert
    for (const photo of laterCards) {
      expect(photo).toHaveAttribute("loading", "lazy");
      expect(photo).toHaveAttribute("decoding", "async");
    }
  });

  it("puts each card's title in a second-level heading, because the page's own title is the H1", () => {
    // Arrange
    render(<ProjectsGallery projects={PROJECTS} />);

    // Act
    const headings = screen.getAllByRole("heading");

    // Assert
    expect(headings.map((heading) => heading.tagName)).toEqual(PROJECTS.map(() => "H2"));
  });

  it("puts them one level lower when the page has a section title of its own above them", () => {
    // Arrange
    render(<ProjectsGallery projects={PROJECTS} headingLevel={3} />);

    // Act
    const headings = screen.getAllByRole("heading");

    // Assert
    expect(headings.map((heading) => heading.tagName)).toEqual(PROJECTS.map(() => "H3"));
  });
});
