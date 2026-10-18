import { describe, expect, it } from "vitest";
import { findUkTerms } from "@/lib/vocabulary";
import { formatSquareFeet } from "@/lib/units";

describe("formatSquareFeet", () => {
  it.each([
    [194000, "194,000 sq ft (18,023 m²)"],
    [15000, "15,000 sq ft (1,394 m²)"],
    [1000, "1,000 sq ft (93 m²)"],
    [86000, "86,000 sq ft (7,990 m²)"],
  ])("writes %i square feet with the metric figure in parentheses", (squareFeet, expected) => {
    // Arrange
    // (the table supplies the area)

    // Act
    const text = formatSquareFeet(squareFeet);

    // Assert
    expect(text).toBe(expected);
  });

  it("rounds to whole square feet and whole square meters", () => {
    // Arrange
    const squareFeet = 12345.6;

    // Act
    const text = formatSquareFeet(squareFeet);

    // Assert
    expect(text).toBe("12,346 sq ft (1,147 m²)");
  });

  it("writes a figure the US vocabulary guard accepts, because the metric twin follows the US unit", () => {
    // Arrange
    const text = formatSquareFeet(194000);

    // Act
    const found = findUkTerms(text);

    // Assert
    expect(found).toEqual([]);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])("refuses %s with a plain message", (squareFeet) => {
    // Arrange
    const act = (): string => formatSquareFeet(squareFeet);

    // Act / Assert
    expect(act).toThrow(/positive number of square feet/);
  });
});
