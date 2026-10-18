import { describe, expect, it } from "vitest";
import { brandColor, cssRuleBody, textColorName } from "@/lib/brandColors";

describe("brandColor", () => {
  it("reads a color from the theme block of globals.css", () => {
    // Arrange
    const name = "ink";

    // Act
    const color = brandColor(name);

    // Assert
    expect(color).toEqual([28, 27, 25]);
  });

  it("refuses a color that the theme does not have, naming it", () => {
    // Arrange
    const name = "teal";

    // Act
    const act = (): unknown => brandColor(name);

    // Assert
    expect(act).toThrow("There is no --brand-teal color in src/app/globals.css.");
  });
});

describe("cssRuleBody and textColorName", () => {
  it("finds the rule for a selector and the brand color it paints text with", () => {
    // Arrange
    const selector = ".eyebrow";

    // Act
    const body = cssRuleBody(selector);
    const name = textColorName(selector);

    // Assert
    expect(body).toContain("letter-spacing");
    expect(name).toMatch(/^gold/);
  });

  it("does not take the color of a border or a stroke for the text color", () => {
    // Arrange
    const selector = ".ghost-word";

    // Act
    const act = (): string => textColorName(selector);

    // Assert
    expect(act).toThrow("The .ghost-word rule in src/app/globals.css has no color: var(--brand-...).");
  });

  it("refuses a selector it cannot find", () => {
    // Arrange
    const selector = ".no-such-rule";

    // Act
    const act = (): string => cssRuleBody(selector);

    // Assert
    expect(act).toThrow("There is no .no-such-rule rule in src/app/globals.css.");
  });
});
