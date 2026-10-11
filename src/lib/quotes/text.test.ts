import { describe, expect, it } from "vitest";
import { toSingleLine, truncate } from "./text";

describe("toSingleLine", () => {
  it("leaves ordinary text untouched", () => {
    expect(toSingleLine("Dubai, UAE")).toBe("Dubai, UAE");
  });

  it.each([
    ["a line feed", "Dubai\nUAE"],
    ["a carriage return and line feed", "Dubai\r\nUAE"],
    ["a tab", "Dubai\tUAE"],
    ["a line separator", "Dubai UAE"],
    ["a non-breaking space", "Dubai UAE"],
  ])("turns %s into one space", (_label, text) => {
    expect(toSingleLine(text)).toBe("Dubai UAE");
  });

  it("removes control characters", () => {
    expect(toSingleLine("Du\u0000ba\u001bi\u007f")).toBe("Dubai");
  });

  it("removes invisible formatting characters such as direction overrides and zero-width spaces", () => {
    expect(toSingleLine("pdf‮.exe​")).toBe("pdf.exe");
  });

  it("collapses runs of whitespace and trims the ends", () => {
    expect(toSingleLine("  Dubai   \n\n  UAE  ")).toBe("Dubai UAE");
  });

  it("keeps accented and non-Latin letters", () => {
    expect(toSingleLine("Zürich – 東京")).toBe("Zürich – 東京");
  });

  it("returns an empty string when only whitespace and control characters remain", () => {
    expect(toSingleLine(" \n\u0000\t ")).toBe("");
  });
});

describe("truncate", () => {
  it("returns text that already fits unchanged", () => {
    expect(truncate("short", 10)).toBe("short");
  });

  it("returns text that is exactly at the limit unchanged", () => {
    expect(truncate("0123456789", 10)).toBe("0123456789");
  });

  it("shortens longer text to the limit, ending in three dots", () => {
    // Arrange / Act
    const result = truncate("0123456789ABC", 10);

    // Assert
    expect(result).toBe("0123456...");
    expect(result).toHaveLength(10);
  });

  it("counts characters, not UTF-16 units, so it never splits an emoji", () => {
    const result = truncate("📐".repeat(30), 10);

    expect(Array.from(result)).toHaveLength(10);
    expect(result).toBe(`${"📐".repeat(7)}...`);
  });

  it("returns just the dots when the limit is smaller than the ellipsis", () => {
    expect(truncate("0123456789", 2)).toBe("..");
  });
});
