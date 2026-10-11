import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhotoTile } from "@/components/CraftGallery";

describe("PhotoTile", () => {
  it("loads a photo lazily, as it nears the screen", () => {
    // Arrange
    const photo = { src: "/craft/veneer-panel.jpg", material: "walnut", alt: "Bookmatched walnut veneer", caption: "Veneer" };

    // Act
    render(<PhotoTile photo={photo} />);

    // Assert
    const image = screen.getByRole("img", { name: photo.alt });
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
  });

  it("shows a wood-tone placeholder, not an image file, while the photo has no source", () => {
    // Arrange
    const photo = { src: "", material: "oak", alt: "Fluted oak panelling detail", caption: "Fluted oak" };

    // Act
    render(<PhotoTile photo={photo} />);

    // Assert
    expect(screen.getByRole("img", { name: photo.alt }).tagName).toBe("DIV");
  });
});
