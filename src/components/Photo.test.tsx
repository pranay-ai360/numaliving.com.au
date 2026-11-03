import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Photo } from "@/components/Photo";
import type { ShowcasePhoto } from "@/lib/types";

const PHOTO: ShowcasePhoto = {
  src: "/projects/test-villa/test-villa-01.jpg",
  alt: "A living room with a curved cream sofa and a walnut-paneled wall",
  width: 1600,
  height: 1067,
};

const SIZES = "(min-width: 1024px) 33vw, 100vw";

function sourcesOf(container: HTMLElement): readonly HTMLSourceElement[] {
  return Array.from(container.querySelectorAll("source"));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Photo", () => {
  it("offers an AVIF and then a WebP source, so a browser takes the lighter format it understands", () => {
    // Arrange
    const { container } = render(<Photo photo={PHOTO} sizes={SIZES} />);

    // Act
    const sources = sourcesOf(container);

    // Assert
    expect(sources.map((source) => source.getAttribute("type"))).toEqual(["image/avif", "image/webp"]);
    expect(container.querySelector("picture")?.firstElementChild).toBe(sources[0]);
  });

  it("lists every width in each source's srcset, with the sizes the browser needs to choose", () => {
    // Arrange
    const { container } = render(<Photo photo={PHOTO} sizes={SIZES} />);

    // Act
    const [avif, webp] = sourcesOf(container);

    // Assert
    expect(avif.getAttribute("srcset")).toBe(
      "/projects/test-villa/test-villa-01-480.avif 480w, /projects/test-villa/test-villa-01-800.avif 800w, /projects/test-villa/test-villa-01-1200.avif 1200w, /projects/test-villa/test-villa-01-1600.avif 1600w",
    );
    expect(webp.getAttribute("srcset")).toBe(
      "/projects/test-villa/test-villa-01-480.webp 480w, /projects/test-villa/test-villa-01-800.webp 800w, /projects/test-villa/test-villa-01-1200.webp 1200w, /projects/test-villa/test-villa-01-1600.webp 1600w",
    );
    expect(avif.getAttribute("sizes")).toBe(SIZES);
    expect(webp.getAttribute("sizes")).toBe(SIZES);
  });

  it("lists only the widths that fit a narrower photo, never enlarging it", () => {
    // Arrange
    const narrow: ShowcasePhoto = { ...PHOTO, width: 1000, height: 667 };
    const { container } = render(<Photo photo={narrow} sizes={SIZES} />);

    // Act
    const [avif] = sourcesOf(container);

    // Assert
    expect(avif.getAttribute("srcset")).toBe("/projects/test-villa/test-villa-01-480.avif 480w, /projects/test-villa/test-villa-01-800.avif 800w");
  });

  it("falls back to the original JPEG, with the description and the size of the picture", () => {
    // Arrange
    render(<Photo photo={PHOTO} sizes={SIZES} />);

    // Act
    const image = screen.getByRole("img", { name: PHOTO.alt });

    // Assert
    expect(image).toHaveAttribute("src", "/projects/test-villa/test-villa-01.jpg");
    expect(image).toHaveAttribute("width", "1600");
    expect(image).toHaveAttribute("height", "1067");
  });

  it("is the last thing inside the picture, which is where the browser looks for the image", () => {
    // Arrange
    const { container } = render(<Photo photo={PHOTO} sizes={SIZES} />);

    // Act
    const picture = container.querySelector("picture");

    // Assert
    expect(picture?.lastElementChild?.tagName).toBe("IMG");
    expect(picture?.querySelectorAll("img")).toHaveLength(1);
  });

  it("loads lazily, off the main thread, by default", () => {
    // Arrange
    render(<Photo photo={PHOTO} sizes={SIZES} />);

    // Act
    const image = screen.getByRole("img");

    // Assert
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("decoding", "async");
    expect(image).not.toHaveAttribute("fetchpriority");
  });

  it("loads at once, still decoded off the main thread, when it is in view on arrival", () => {
    // Arrange
    render(<Photo photo={PHOTO} sizes={SIZES} loading="eager" />);

    // Act
    const image = screen.getByRole("img");

    // Assert
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("decoding", "async");
    expect(image).not.toHaveAttribute("fetchpriority");
  });

  it("loads at once and ahead of the other images when it is a page's main photo", () => {
    // Arrange
    render(<Photo photo={PHOTO} sizes={SIZES} loading="priority" />);

    // Act
    const image = screen.getByRole("img");

    // Assert
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
    expect(image).not.toHaveAttribute("decoding");
  });

  it("puts the class names on the image, which is the element a visitor sees", () => {
    // Arrange
    render(<Photo photo={PHOTO} sizes={SIZES} className="aspect-square w-full object-cover" />);

    // Act
    const image = screen.getByRole("img");

    // Assert
    expect(image).toHaveClass("aspect-square", "w-full", "object-cover");
  });

  it("writes every address below the base path when the site is served from a sub-path", () => {
    // Arrange
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/numaliving.com.au");
    const { container } = render(<Photo photo={{ ...PHOTO, width: 480, height: 320 }} sizes={SIZES} />);

    // Act
    const [avif, webp] = sourcesOf(container);

    // Assert
    expect(avif.getAttribute("srcset")).toBe("/numaliving.com.au/projects/test-villa/test-villa-01-480.avif 480w");
    expect(webp.getAttribute("srcset")).toBe("/numaliving.com.au/projects/test-villa/test-villa-01-480.webp 480w");
    expect(screen.getByRole("img")).toHaveAttribute("src", "/numaliving.com.au/projects/test-villa/test-villa-01.jpg");
  });
});
