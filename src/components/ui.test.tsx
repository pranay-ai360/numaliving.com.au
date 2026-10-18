import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ButtonLink, CARD_PHOTO_SIZES, FigureValue, HERO_PHOTO_SIZES, ProjectCard, ProjectVisual } from "@/components/ui";
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

describe("ProjectCard heading", () => {
  it("is a third-level heading by default, for a card under a section title", () => {
    // Arrange
    render(<ProjectCard project={PROJECT} />);

    // Act
    const heading = screen.getByRole("heading", { name: PROJECT.name });

    // Assert
    expect(heading.tagName).toBe("H3");
  });

  it.each([2, 3, 4] as const)("is a level %i heading when the page asks for it, so a card never skips a level", (level) => {
    // Arrange
    render(<ProjectCard project={PROJECT} headingLevel={level} />);

    // Act
    const heading = screen.getByRole("heading", { name: PROJECT.name });

    // Assert
    expect(heading.tagName).toBe(`H${level}`);
  });

  it("looks the same whatever its level", () => {
    // Arrange
    const classes = ([2, 3, 4] as const).map((level) => {
      const { unmount, container } = render(<ProjectCard project={PROJECT} headingLevel={level} />);
      const className = container.querySelector(`h${level}`)?.className;
      unmount();
      return className;
    });

    // Act
    const distinct = new Set(classes);

    // Assert
    expect(distinct.size).toBe(1);
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
  it("writes a figure with its unit and metric twin as one line of text, the unit in a smaller span of its own", () => {
    // Arrange
    const { container } = render(<FigureValue value="194,000 sq ft (18,000 m²)" />);

    // Act
    const unit = screen.getByText("sq ft (18,000 m²)");

    // Assert
    expect(container.textContent).toBe("194,000 sq ft (18,000 m²)");
    expect(unit.tagName).toBe("SPAN");
    expect(unit).toHaveClass("block");
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

describe("ButtonLink", () => {
  it.each([
    ["solid", "bg-gold-dark"],
    ["outline", "text-gold-dark"],
    ["light", "text-paper"],
  ] as const)("draws the %s variant with its own look", (variant, expectedClass) => {
    // Arrange
    render(<ButtonLink href="/contact" variant={variant}>Talk to us</ButtonLink>);

    // Act
    const link = screen.getByRole("link", { name: "Talk to us" });

    // Assert
    expect(link).toHaveAttribute("href", "/contact");
    expect(link).toHaveClass(expectedClass);
  });

  it("draws the solid variant when none is given", () => {
    // Arrange
    render(<ButtonLink href="/contact">Talk to us</ButtonLink>);

    // Act
    const link = screen.getByRole("link", { name: "Talk to us" });

    // Assert
    expect(link).toHaveClass("bg-gold-dark");
  });

  it("fills the solid variant with the dark gold and keeps its label white, a contrast of at least 4.5:1", () => {
    // Arrange
    render(<ButtonLink href="/contact">Talk to us</ButtonLink>);

    // Act
    const link = screen.getByRole("link", { name: "Talk to us" });

    // Assert
    expect(link).toHaveClass("bg-gold-dark", "text-white");
    expect(link.className).not.toMatch(/(^|\s)bg-gold(\s|$)/);
  });

  it("gives the solid and outline variants a hover state that differs from the resting one", () => {
    // Arrange
    render(
      <>
        <ButtonLink href="/a">First</ButtonLink>
        <ButtonLink href="/b" variant="outline">
          Second
        </ButtonLink>
      </>,
    );

    // Act
    const [solid, outline] = [screen.getByRole("link", { name: "First" }), screen.getByRole("link", { name: "Second" })];

    // Assert
    expect(solid.className).toMatch(/hover:bg-(?!gold-dark)\S+/);
    expect(outline.className).toMatch(/hover:bg-gold-dark/);
    expect(outline.className).toMatch(/hover:text-white/);
  });
});
