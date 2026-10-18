import { describe, expect, it } from "vitest";
import { isIsoCalendarDay } from "@/lib/isoDate";

describe("isIsoCalendarDay", () => {
  it.each(["2026-11-12", "2026-01-01", "2024-02-29", "2026-12-31", "2000-02-29"])("accepts %s", (text) => {
    // Arrange
    // (the table supplies the text)

    // Act
    const result = isIsoCalendarDay(text);

    // Assert
    expect(result).toBe(true);
  });

  it.each([
    ["a day that does not exist", "2026-02-30"],
    ["a leap day in a year that has none", "2026-02-29"],
    ["a month that does not exist", "2026-13-01"],
    ["month zero", "2026-00-10"],
    ["day zero", "2026-10-00"],
    ["a US-style date", "11/12/2026"],
    ["a day-first date", "12-11-2026"],
    ["a month and day without zeros", "2026-1-5"],
    ["words", "next Friday"],
    ["a date with a time", "2026-11-12T10:00"],
    ["spaces around a good date", " 2026-11-12 "],
    ["an empty text", ""],
    ["a five-digit year", "12026-11-12"],
  ])("refuses %s", (_label, text) => {
    // Arrange
    // (the table supplies the text)

    // Act
    const result = isIsoCalendarDay(text);

    // Assert
    expect(result).toBe(false);
  });
});
