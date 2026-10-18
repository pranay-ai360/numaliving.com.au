import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CARD_PHOTO_SIZES, FigureValue, HERO_PHOTO_SIZES, ProjectCard, ProjectVisual } from "@/components/ui";
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
  photos: [
    { src: "/projects/test-villa/test-villa-01.jpg", alt: "A villa living room with a walnut-paneled wall", width: 1600, height: 1067 },
    { src: "/projects/test-villa/test-villa-02.jpg", alt: "A villa kitchen with a lacquered island", width: 1600, height: 1067 },
  ],
  palette: ["oak", "linen", "brass"],
};

/** The project's cover photo is described by this text, not by the project's name. */
const COVER_ALT = PROJECT.photos[0].alt;

describe("ProjectCard", () => {
  it("loads its photo lazily, as it nears the screen", () => {
    // Arrange
    render(<ProjectCard project={PROJECT} />);

    // Act
    const photo = screen.getByRole("img", { name: COVER_ALT });

    // Assert
    expect(photo).toHaveAttribute("loading", "lazy");
    expect(photo).toHaveAttribute("decoding", "async");
    expect(photo).not.toHaveAttribute("fetchpriority");
  });

  it("loads its photo at once when the card is in view on arrival, still decoded off the main thread", () => {
    // Arrange
    render(<ProjectCard project={PROJECT} photoLoading="eager" />);

    // Act
    const photo = screen.getByRole("img", { name: COVER_ALT });

    // Assert
    expect(photo).toHaveAttribute("loading", "eager");
    expect(photo).toHaveAttribute("decoding", "async");
    expect(photo).not.toHaveAttribute("fetchpriority");
  });
});

describe("ProjectVisual", () => {
  it("loads lazily by default", () => {
    // Arrange
    render(<ProjectVisual project={PROJECT} sizes={HERO_PHOTO_SIZES} />);

    // Act
    const photo = screen.getByRole("img", { name: COVER_ALT });

    // Assert
    expect(photo).toHaveAttribute("loading", "lazy");
  });

  it("loads a page's main photo straight away and ahead of other images", () => {
    // Arrange
    render(<ProjectVisual project={PROJECT} sizes={HERO_PHOTO_SIZES} photoLoading="priority" />);

    // Act
    const photo = screen.getByRole("img", { name: COVER_ALT });

    // Assert
    expect(photo).toHaveAttribute("loading", "eager");
    expect(photo).toHaveAttribute("fetchpriority", "high");
    expect(photo).not.toHaveAttribute("decoding");
  });

  it("shows the material placeholder instead of an image when the project has no photos", () => {
    // Arrange
    const withoutPhotos: ShowcaseProject = { ...PROJECT, photos: [] };

    // Act
    render(<ProjectVisual project={withoutPhotos} sizes={HERO_PHOTO_SIZES} photoLoading="priority" />);

    // Assert
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("ProjectVisual photo", () => {
  it("shows the cover, the first photo, as a picture with fast copies and the JPEG as fallback", () => {
    // Arrange
    const { container } = render(<ProjectVisual project={PROJECT} sizes={HERO_PHOTO_SIZES} />);

    // Act
    const sources = Array.from(container.querySelectorAll("source"));

    // Assert
    expect(sources.map((source) => source.getAttribute("type"))).toEqual(["image/avif", "image/webp"]);
    expect(sources[0].getAttribute("srcset")).toContain("/projects/test-villa/test-villa-01-480.avif 480w");
    expect(sources[0]).toHaveAttribute("sizes", HERO_PHOTO_SIZES);
    expect(screen.getByRole("img", { name: COVER_ALT })).toHaveAttribute("src", "/projects/test-villa/test-villa-01.jpg");
  });

  it("does not show the project's other photos", () => {
    // Arrange
    render(<ProjectVisual project={PROJECT} sizes={HERO_PHOTO_SIZES} />);

    // Act
    const images = screen.getAllByRole("img");

    // Assert
    expect(images).toHaveLength(1);
  });
});

describe("ProjectCard link", () => {
  it("draws its photo for the browser at card width, so a small copy is chosen", () => {
    // Arrange
    const { container } = render(<ProjectCard project={PROJECT} />);

    // Act
    const [avif] = Array.from(container.querySelectorAll("source"));

    // Assert
    expect(avif).toHaveAttribute("sizes", CARD_PHOTO_SIZES);
  });
});

describe("FigureValue", () => {
  it("writes a figure with its unit and metric twin as one line of text, the unit in a smaller span", () => {
    // Arrange
    const { container } = render(<FigureValue value="194,000 sq ft (18,000 m²)" />);

    // Act
    const unit = screen.getByText("sq ft (18,000 m²)");

    // Assert
    expect(container.textContent).toBe("194,000 sq ft (18,000 m²)");
    expect(unit.tagName).toBe("SPAN");
    expect(container.querySelectorAll("span")).toHaveLength(1);
  });

  it("shows a figure that has no unit as it is, with no span", () => {
    // Arrange
    const { container } = render(<FigureValue value="120+" />);

    // Act
    const spans = container.querySelectorAll("span");

    // Assert
    expect(container.textContent).toBe("120+");
    expect(spans).toHaveLength(0);
  });
});
