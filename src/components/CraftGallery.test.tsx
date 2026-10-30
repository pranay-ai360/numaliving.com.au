import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhotoTile } from "@/components/CraftGallery";

const SIZES = "(min-width: 768px) 25vw, 50vw";

describe("PhotoTile", () => {
  it("loads a photo lazily, as it nears the screen", () => {
    // Arrange
    const photo = { src: "/craft/veneer-panel.jpg", material: "walnut", alt: "Bookmatched walnut veneer", caption: "Veneer", width: 1000, height: 700 };

    // Act
    render(<PhotoTile photo={photo} sizes={SIZES} />);

    // Assert
    const image = screen.getByRole("img", { name: photo.alt });
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
  });

  it("offers AVIF and WebP copies of the photo, and tells the browser its size before it loads", () => {
    // Arrange
    const photo = { src: "/craft/veneer-panel.jpg", material: "walnut", alt: "Bookmatched walnut veneer", caption: "Veneer", width: 1000, height: 700 };

    // Act
    const { container } = render(<PhotoTile photo={photo} sizes={SIZES} />);

    // Assert
    const sources = Array.from(container.querySelectorAll("source"));
    expect(sources.map((source) => source.getAttribute("type"))).toEqual(["image/avif", "image/webp"]);
    expect(sources[0]).toHaveAttribute("srcset", "/craft/veneer-panel-480.avif 480w, /craft/veneer-panel-800.avif 800w");
    expect(sources[0]).toHaveAttribute("sizes", SIZES);
    const image = screen.getByRole("img", { name: photo.alt });
    expect(image).toHaveAttribute("width", "1000");
    expect(image).toHaveAttribute("height", "700");
  });

  it("shows a wood-tone placeholder, not an image file, while the photo has no source", () => {
    // Arrange
    const photo = { src: "", material: "oak", alt: "Fluted oak paneling detail", caption: "Fluted oak", width: 1000, height: 700 };

    // Act
    render(<PhotoTile photo={photo} sizes={SIZES} />);

    // Assert
    expect(screen.getByRole("img", { name: photo.alt }).tagName).toBe("DIV");
  });
});
