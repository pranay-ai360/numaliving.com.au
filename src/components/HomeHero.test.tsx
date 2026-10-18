import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HERO_OVERLAY, HomeHero } from "@/components/HomeHero";
import { blend, contrastRatio, parseHexColor, type Rgb } from "@/lib/contrast";
import type { ShowcasePhoto } from "@/lib/types";

/** WCAG's minimum contrast for body text. */
const MIN_TEXT_CONTRAST = 4.5;
const WHITE: Rgb = [255, 255, 255];

const PHOTO: ShowcasePhoto = {
  src: "/projects/test-villa/test-villa-02.jpg",
  alt: "A living room with a long bar counter, a fluted curved wall and lattice screens",
  width: 1600,
  height: 1067,
};

const HERO = {
  eyebrow: "Architectural millwork and FF&E",
  title: ["Custom millwork,", "engineered in Dubai.", "Built for US projects."],
  statement: "Made in our Dubai factory. Shipped to US job sites.",
  audience: "For US architects and contractors. Send your drawings.",
  photo: PHOTO,
} as const;

const GLOBALS_CSS = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

/** A brand color from the theme block of src/app/globals.css, so the test follows the real palette. */
function brandColor(name: string): Rgb {
  const match = new RegExp(`--brand-${name}:\\s*(#[0-9a-fA-F]{3,6})`).exec(GLOBALS_CSS);
  if (match === null) throw new Error(`There is no --brand-${name} color in src/app/globals.css.`);
  return parseHexColor(match[1]);
}

/** The text-color classes the hero may use, and the brand color each one paints. */
const TEXT_COLOR_CLASSES: Readonly<Record<string, string>> = { "text-paper": "paper", "text-gold-soft": "gold-soft" };

function textColorOf(element: Element): Rgb {
  const className = Array.from(element.classList).find((name) => name in TEXT_COLOR_CLASSES);
  if (className === undefined) throw new Error(`<${element.tagName.toLowerCase()}> "${element.textContent}" has none of the text colors this test knows: ${Object.keys(TEXT_COLOR_CLASSES).join(", ")}.`);
  return brandColor(TEXT_COLOR_CLASSES[className]);
}

/** The opacities of the dark layer laid over the photo, as the page actually draws it. */
function overlayOpacities(container: HTMLElement): readonly number[] {
  const overlay = container.querySelector<HTMLElement>("[style*='linear-gradient']");
  if (overlay === null) throw new Error("The hero has no gradient layer over its photo.");
  return Array.from(overlay.style.backgroundImage.matchAll(/rgba\(28, 27, 25, ([\d.]+)\)/g), (match) => Number(match[1]));
}

function renderHero(): HTMLElement {
  return render(<HomeHero {...HERO} />).container;
}

describe("HomeHero text", () => {
  it("says what Numa makes, where it is made and who it is for, under one top-level heading", () => {
    // Arrange
    renderHero();

    // Act
    const headings = screen.getAllByRole("heading", { level: 1 });

    // Assert
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Custom millwork, engineered in Dubai. Built for US projects.");
    expect(screen.getByText(HERO.eyebrow)).toBeInTheDocument();
    expect(screen.getByText(HERO.statement)).toBeInTheDocument();
    expect(screen.getByText(HERO.audience)).toBeInTheDocument();
  });

  it("writes the lines of the heading with a space between them, so the page text reads as one sentence", () => {
    // Arrange
    renderHero();

    // Act
    const heading = screen.getByRole("heading", { level: 1 });

    // Assert
    expect(heading.textContent).toBe("Custom millwork, engineered in Dubai. Built for US projects.");
  });

  it("offers the quote request first and the projects second", () => {
    // Arrange
    renderHero();

    // Act
    const links = screen.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")]);

    // Assert
    expect(links).toEqual([
      ["Request a Quote", "/contact"],
      ["View Projects", "/projects"],
    ]);
  });
});

describe("HomeHero photo", () => {
  it("loads first, at high priority, because it is the largest thing in view on arrival", () => {
    // Arrange
    renderHero();

    // Act
    const photo = screen.getByRole("img");

    // Assert
    expect(photo).toHaveAttribute("loading", "eager");
    expect(photo).toHaveAttribute("fetchpriority", "high");
  });

  it("carries its width and height and a description of what it shows, so the page does not jump while it loads", () => {
    // Arrange
    renderHero();

    // Act
    const photo = screen.getByRole("img", { name: PHOTO.alt });

    // Assert
    expect(photo).toHaveAttribute("width", "1600");
    expect(photo).toHaveAttribute("height", "1067");
  });

  it("fills the hero from behind the text, without taking room in the page's layout", () => {
    // Arrange
    renderHero();

    // Act
    const photo = screen.getByRole("img");

    // Assert
    expect(photo).toHaveClass("absolute", "inset-0", "h-full", "w-full", "object-cover");
  });

  it("is drawn as wide as the screen, so the browser picks the copy that fits", () => {
    // Arrange
    const container = renderHero();

    // Act
    const sizes = Array.from(container.querySelectorAll("picture source"), (source) => source.getAttribute("sizes"));

    // Assert
    expect(sizes.length).toBeGreaterThan(0);
    expect(new Set(sizes)).toEqual(new Set(["100vw"]));
  });
});

describe("HomeHero legibility", () => {
  it("keeps every line of text at 4.5:1 or better against the brightest possible photo pixel under the weakest part of the dark layer", () => {
    // Arrange
    const container = renderHero();
    const weakest = Math.min(...overlayOpacities(container));
    const worstBackground = blend(brandColor("ink"), weakest, WHITE);
    const lines = [screen.getByText(HERO.eyebrow), screen.getByRole("heading", { level: 1 }), screen.getByText(HERO.statement), screen.getByText(HERO.audience)];

    // Act
    const ratios = lines.map((line) => ({ text: line.textContent, ratio: contrastRatio(textColorOf(line), worstBackground) }));

    // Assert
    expect(weakest).toBeGreaterThan(0);
    expect(ratios.filter(({ ratio }) => ratio < MIN_TEXT_CONTRAST)).toEqual([]);
  });

  it("paints the dark layer in the brand's ink color, at no less than the opacity it promises", () => {
    // Arrange
    const container = renderHero();

    // Act
    const opacities = overlayOpacities(container);

    // Assert
    expect(opacities).toHaveLength(2);
    expect(Math.min(...opacities)).toBeGreaterThanOrEqual(HERO_OVERLAY.weakestOpacity);
    expect(HERO_OVERLAY.color).toEqual(brandColor("ink"));
  });

  it("has no animation or movement, so there is nothing to switch off for people who prefer reduced motion (a color change on hover is not movement)", () => {
    // Arrange
    const container = renderHero();

    // Act
    const moving = Array.from(container.querySelectorAll("*")).filter((element) => /(^|\s)(animate-|transition-(transform|all)|scale-|translate-|rotate-)/.test(element.getAttribute("class") ?? ""));

    // Assert
    expect(moving).toEqual([]);
  });
});
