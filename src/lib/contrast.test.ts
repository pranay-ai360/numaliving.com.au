import { describe, expect, it } from "vitest";
import { blend, contrastRatio, parseHexColor, relativeLuminance, type Rgb } from "@/lib/contrast";

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

describe("parseHexColor", () => {
  it.each([
    ["#ffffff", [255, 255, 255]],
    ["#000000", [0, 0, 0]],
    ["#ac8f50", [172, 143, 80]],
    ["#AC8F50", [172, 143, 80]],
    ["#fff", [255, 255, 255]],
    ["#1c1b19", [28, 27, 25]],
  ])("reads %s", (hex, expected) => {
    // Arrange
    // (the table supplies the color)

    // Act
    const rgb = parseHexColor(hex);

    // Assert
    expect(rgb).toEqual(expected);
  });

  it.each(["", "ffffff", "#ff", "#ggg", "#12345", "rgb(0,0,0)"])("refuses %j with a plain message", (hex) => {
    // Arrange
    // (the table supplies the text)

    // Act
    const act = (): Rgb => parseHexColor(hex);

    // Assert
    expect(act).toThrow(/not a hex color/);
  });
});

describe("relativeLuminance", () => {
  it("is 1 for white and 0 for black", () => {
    // Arrange / Act
    const [white, black] = [relativeLuminance(WHITE), relativeLuminance(BLACK)];

    // Assert
    expect(white).toBeCloseTo(1, 6);
    expect(black).toBe(0);
  });

  it("follows the WCAG formula for a mid gray", () => {
    // Arrange
    const gray: Rgb = [119, 119, 119];

    // Act
    const luminance = relativeLuminance(gray);

    // Assert
    expect(luminance).toBeCloseTo(0.1845, 3);
  });
});

describe("contrastRatio", () => {
  it("is 21 between black and white, whichever is first", () => {
    // Arrange / Act
    const ratios = [contrastRatio(WHITE, BLACK), contrastRatio(BLACK, WHITE)];

    // Assert
    expect(ratios[0]).toBeCloseTo(21, 6);
    expect(ratios[1]).toBeCloseTo(21, 6);
  });

  it("is 1 between a color and itself", () => {
    // Arrange
    const gold = parseHexColor("#ac8f50");

    // Act
    const ratio = contrastRatio(gold, gold);

    // Assert
    expect(ratio).toBeCloseTo(1, 6);
  });

  it("matches the known ratio of #777777 on white, 4.48", () => {
    // Arrange
    const gray: Rgb = [119, 119, 119];

    // Act
    const ratio = contrastRatio(gray, WHITE);

    // Assert
    expect(ratio).toBeCloseTo(4.48, 2);
  });
});

describe("blend", () => {
  it("returns the color underneath at zero opacity and the color on top at full opacity", () => {
    // Arrange
    const top: Rgb = [28, 27, 25];

    // Act
    const [none, full] = [blend(top, 0, WHITE), blend(top, 1, WHITE)];

    // Assert
    expect(none).toEqual(WHITE);
    expect(full).toEqual(top);
  });

  it("mixes the two in proportion to the opacity", () => {
    // Arrange
    const top: Rgb = [0, 0, 0];

    // Act
    const mixed = blend(top, 0.7, WHITE);

    // Assert
    mixed.forEach((channel) => expect(channel).toBeCloseTo(76.5, 6));
  });

  it("refuses an opacity outside 0 to 1", () => {
    // Arrange
    const act = (): Rgb => blend(BLACK, 1.5, WHITE);

    // Act / Assert
    expect(act).toThrow(/between 0 and 1/);
  });

  it("does not change the colors it was given", () => {
    // Arrange
    const top: Rgb = [10, 20, 30];
    const under: Rgb = [200, 210, 220];

    // Act
    blend(top, 0.5, under);

    // Assert
    expect(top).toEqual([10, 20, 30]);
    expect(under).toEqual([200, 210, 220]);
  });
});
