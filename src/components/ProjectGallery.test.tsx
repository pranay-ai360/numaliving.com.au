import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GALLERY_VISIBLE_COUNT, ProjectGallery } from "@/components/ProjectGallery";
import type { ShowcasePhoto } from "@/lib/types";

/** `count` photos with descriptions "Photo 1", "Photo 2" and so on; the first is the cover. */
function photosOf(count: number): ShowcasePhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    src: `/projects/test-villa/test-villa-${String(index + 1).padStart(2, "0")}.jpg`,
    alt: `Photo ${index + 1}`,
    width: 1600,
    height: 1067,
  }));
}

function altsOutsideDetails(container: HTMLElement): readonly (string | null)[] {
  return Array.from(container.querySelectorAll("img"))
    .filter((image) => image.closest("details") === null)
    .map((image) => image.getAttribute("alt"));
}

function altsInsideDetails(container: HTMLElement): readonly (string | null)[] {
  return Array.from(container.querySelectorAll("details img")).map((image) => image.getAttribute("alt"));
}

describe("ProjectGallery", () => {
  it("shows the six photos after the cover straight away, and keeps the cover out because the page shows it above", () => {
    // Arrange
    const { container } = render(<ProjectGallery photos={photosOf(14)} />);

    // Act
    const shown = altsOutsideDetails(container);

    // Assert
    expect(GALLERY_VISIBLE_COUNT).toBe(6);
    expect(shown).toEqual(["Photo 2", "Photo 3", "Photo 4", "Photo 5", "Photo 6", "Photo 7"]);
  });

  it("puts the rest inside a native details element, closed until the visitor opens it", () => {
    // Arrange
    const { container } = render(<ProjectGallery photos={photosOf(14)} />);

    // Act
    const details = container.querySelector("details");

    // Assert
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    expect(altsInsideDetails(container)).toEqual(["Photo 8", "Photo 9", "Photo 10", "Photo 11", "Photo 12", "Photo 13", "Photo 14"]);
  });

  it("labels the summary with the project's total number of photos", () => {
    // Arrange
    render(<ProjectGallery photos={photosOf(14)} />);

    // Act
    const summary = screen.getByText("Show all 14 photos");

    // Assert
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary.closest("details")).not.toBeNull();
  });

  it("loads every gallery photo lazily, so those in the closed details are never fetched", () => {
    // Arrange
    const { container } = render(<ProjectGallery photos={photosOf(14)} />);

    // Act
    const notLazy = Array.from(container.querySelectorAll("img")).filter((image) => image.getAttribute("loading") !== "lazy");

    // Assert
    expect(notLazy).toEqual([]);
  });

  it.each([1, 2, 7])("has no details element when the project has %i photos, because every one of them is already on the page", (count) => {
    // Arrange
    const { container } = render(<ProjectGallery photos={photosOf(count)} />);

    // Act
    const details = container.querySelector("details");

    // Assert
    expect(details).toBeNull();
    expect(altsOutsideDetails(container)).toHaveLength(Math.max(count - 1, 0));
  });

  it("starts the details with a single photo when the project has one more than fits", () => {
    // Arrange
    const { container } = render(<ProjectGallery photos={photosOf(8)} />);

    // Act
    const inside = altsInsideDetails(container);

    // Assert
    expect(inside).toEqual(["Photo 8"]);
    expect(screen.getByText("Show all 8 photos")).toBeInTheDocument();
  });

  it("renders nothing for a project without photos", () => {
    // Arrange
    const { container } = render(<ProjectGallery photos={[]} />);

    // Act
    const content = container.innerHTML;

    // Assert
    expect(content).toBe("");
  });
});
