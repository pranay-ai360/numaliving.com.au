import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectCard, ProjectVisual } from "@/components/ui";
import type { ShowcaseProject } from "@/lib/types";

const PROJECT: ShowcaseProject = {
  slug: "test-villa",
  name: "Test Villa",
  sector: "Residences",
  city: "Dubai",
  country: "UAE",
  year: 2025,
  summary: "A villa used by the tests.",
  scope: ["Kitchen"],
  materials: ["Oak veneer"],
  durationWeeks: 12,
  images: ["/projects/test-villa/cover.jpg", "/projects/test-villa/detail.jpg"],
  palette: ["oak", "linen", "brass"],
};

describe("ProjectCard", () => {
  it("loads its photo lazily, as it nears the screen", () => {
    // Arrange
    render(<ProjectCard project={PROJECT} />);

    // Act
    const photo = screen.getByRole("img", { name: PROJECT.name });

    // Assert
    expect(photo).toHaveAttribute("loading", "lazy");
    expect(photo).toHaveAttribute("decoding", "async");
    expect(photo).not.toHaveAttribute("fetchpriority");
  });

  it("loads its photo at once when the card is in view on arrival, still decoded off the main thread", () => {
    // Arrange
    render(<ProjectCard project={PROJECT} photoLoading="eager" />);

    // Act
    const photo = screen.getByRole("img", { name: PROJECT.name });

    // Assert
    expect(photo).toHaveAttribute("loading", "eager");
    expect(photo).toHaveAttribute("decoding", "async");
    expect(photo).not.toHaveAttribute("fetchpriority");
  });
});

describe("ProjectVisual", () => {
  it("loads lazily by default", () => {
    // Arrange
    render(<ProjectVisual project={PROJECT} />);

    // Act
    const photo = screen.getByRole("img", { name: PROJECT.name });

    // Assert
    expect(photo).toHaveAttribute("loading", "lazy");
  });

  it("loads a page's main photo straight away and ahead of other images", () => {
    // Arrange
    render(<ProjectVisual project={PROJECT} photoLoading="priority" />);

    // Act
    const photo = screen.getByRole("img", { name: PROJECT.name });

    // Assert
    expect(photo).toHaveAttribute("loading", "eager");
    expect(photo).toHaveAttribute("fetchpriority", "high");
    expect(photo).not.toHaveAttribute("decoding");
  });

  it("shows the material placeholder instead of an image when the project has no photos", () => {
    // Arrange
    const withoutPhotos: ShowcaseProject = { ...PROJECT, images: [] };

    // Act
    render(<ProjectVisual project={withoutPhotos} photoLoading="priority" />);

    // Assert
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
