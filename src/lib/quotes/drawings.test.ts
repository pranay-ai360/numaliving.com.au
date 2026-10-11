import { describe, expect, it } from "vitest";
import { DRAWINGS_LIMITS, fileProblem, formatFileSize, sanitiseFileName, validateDrawings } from "./drawings";
import { BYTES_PER_MB, makePdf } from "./fixtures";

describe("fileProblem", () => {
  it("finds nothing wrong with a non-empty PDF", () => {
    expect(fileProblem(makePdf("plan.pdf"))).toBeNull();
  });

  it("names a file that is not a PDF", () => {
    expect(fileProblem(makePdf("photo.png", 1024, "image/png"))).toBe("photo.png is not a PDF. Drawings must be PDF files.");
  });

  it("names an empty file", () => {
    expect(fileProblem(makePdf("blank.pdf", 0))).toBe("blank.pdf is empty. Please attach a valid PDF.");
  });
});

describe("DRAWINGS_LIMITS", () => {
  it("allows 10 PDF files and 9 MB in total, leaving headroom under FormSubmit's 10 MB", () => {
    // Arrange / Act / Assert
    expect(DRAWINGS_LIMITS.maxFiles).toBe(10);
    expect(DRAWINGS_LIMITS.maxTotalBytes).toBe(9 * 1024 * 1024);
    expect(DRAWINGS_LIMITS.accept).toBe("application/pdf");
  });
});

describe("validateDrawings", () => {
  it("accepts no files at all, because Drawings are optional", () => {
    expect(validateDrawings([])).toBeNull();
  });

  it("accepts a PDF identified by its MIME type", () => {
    expect(validateDrawings([makePdf("plan.pdf")])).toBeNull();
  });

  it("accepts a PDF identified only by its extension, whatever the case", () => {
    // Some systems report an empty MIME type for PDFs.
    expect(validateDrawings([makePdf("PLAN.PDF", 1024, "")])).toBeNull();
  });

  it("accepts exactly 10 files", () => {
    const files = Array.from({ length: 10 }, (_, index) => makePdf(`sheet-${index + 1}.pdf`));

    expect(validateDrawings(files)).toBeNull();
  });

  it("rejects 11 files and suggests a share link", () => {
    // Arrange
    const files = Array.from({ length: 11 }, (_, index) => makePdf(`sheet-${index + 1}.pdf`));

    // Act
    const problem = validateDrawings(files);

    // Assert
    expect(problem).toBe("Please attach up to 10 files. For a bigger set, paste a share link instead.");
  });

  it("rejects a file that is not a PDF and names it", () => {
    const problem = validateDrawings([makePdf("plan.pdf"), makePdf("photo.png", 1024, "image/png")]);

    expect(problem).toBe("photo.png is not a PDF. Drawings must be PDF files.");
  });

  it("accepts a file named .pdf even when the browser reports a different MIME type", () => {
    expect(validateDrawings([makePdf("plan.pdf", 1024, "application/octet-stream")])).toBeNull();
  });

  it("rejects an empty file and names it", () => {
    const problem = validateDrawings([makePdf("blank.pdf", 0)]);

    expect(problem).toBe("blank.pdf is empty. Please attach a valid PDF.");
  });

  it("accepts files totalling exactly 9 MB", () => {
    const files = [makePdf("a.pdf", 5 * BYTES_PER_MB), makePdf("b.pdf", 4 * BYTES_PER_MB)];

    expect(validateDrawings(files)).toBeNull();
  });

  it("rejects files totalling one byte over 9 MB and shows a total that exceeds the limit", () => {
    // Arrange
    const files = [makePdf("a.pdf", 5 * BYTES_PER_MB), makePdf("b.pdf", 4 * BYTES_PER_MB + 1)];

    // Act
    const problem = validateDrawings(files);

    // Assert
    expect(problem).toBe(
      "Your files total 9.1 MB, over the 9 MB limit. Remove some files, or paste a share link to the larger drawings instead.",
    );
  });

  it("checks the file count before the file types", () => {
    const files = Array.from({ length: 11 }, (_, index) => makePdf(`sheet-${index}.txt`, 1024, "text/plain"));

    expect(validateDrawings(files)).toContain("up to 10 files");
  });

  it("checks file types before the total size", () => {
    const files = [makePdf("huge.pdf", 10 * BYTES_PER_MB), makePdf("notes.txt", 1024, "text/plain")];

    expect(validateDrawings(files)).toBe("notes.txt is not a PDF. Drawings must be PDF files.");
  });

  it("shows file names without line breaks or control characters in its messages", () => {
    const problem = validateDrawings([makePdf("evil\nname\u0000.txt", 1024, "text/plain")]);

    expect(problem).toBe("evil name.txt is not a PDF. Drawings must be PDF files.");
  });
});

describe("sanitiseFileName", () => {
  it("leaves an ordinary file name untouched", () => {
    expect(sanitiseFileName("Façade plan – rev B.pdf")).toBe("Façade plan – rev B.pdf");
  });

  it("turns line breaks and tabs into single spaces", () => {
    expect(sanitiseFileName("plan\r\nrev\tB.pdf")).toBe("plan rev B.pdf");
  });

  it("removes other control characters", () => {
    expect(sanitiseFileName("pl\u0000a\u001bn\u007f.pdf")).toBe("plan.pdf");
  });

  it("removes invisible direction overrides that can disguise a file extension", () => {
    expect(sanitiseFileName("invoice‮fdp.exe")).toBe("invoicefdp.exe");
  });

  it("collapses repeated spaces and trims the ends", () => {
    expect(sanitiseFileName("   plan    rev   B.pdf  ")).toBe("plan rev B.pdf");
  });

  it("falls back to a generic name when nothing is left", () => {
    expect(sanitiseFileName("\n\u0000 \t")).toBe("drawing.pdf");
  });

  it("keeps a name that is exactly at the length cap", () => {
    const name = `${"a".repeat(96)}.pdf`;

    expect(sanitiseFileName(name, 100)).toBe(name);
  });

  it("shortens a long name but keeps its extension", () => {
    // Arrange
    const name = `${"a".repeat(200)}.pdf`;

    // Act
    const result = sanitiseFileName(name, 100);

    // Assert
    expect(result).toHaveLength(100);
    expect(result.endsWith("aaa.pdf")).toBe(true);
  });

  it("uses a sensible default cap of 100 characters", () => {
    expect(sanitiseFileName(`${"b".repeat(300)}.pdf`)).toHaveLength(100);
  });

  it("shortens a long name without an extension", () => {
    expect(sanitiseFileName("c".repeat(300), 50)).toBe("c".repeat(50));
  });

  it("does not treat a very long suffix as an extension", () => {
    const name = `report.${"x".repeat(200)}`;

    expect(sanitiseFileName(name, 50)).toBe(name.slice(0, 50));
  });

  it("never cuts a character in half when shortening", () => {
    // Each emoji is two UTF-16 units but one character.
    const name = `${"📐".repeat(60)}.pdf`;

    const result = sanitiseFileName(name, 20);

    expect(Array.from(result)).toHaveLength(20);
    expect(result.endsWith("📐.pdf")).toBe(true);
    expect(result).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });
});

describe("formatFileSize", () => {
  it.each([
    [0, "0 B"],
    [1, "1 B"],
    [1023, "1023 B"],
    [1024, "1 KB"],
    [1025, "2 KB"],
    [340 * 1024, "340 KB"],
    [BYTES_PER_MB, "1 MB"],
    [1.5 * BYTES_PER_MB, "1.5 MB"],
    [9 * BYTES_PER_MB, "9 MB"],
    [9 * BYTES_PER_MB + 1, "9.1 MB"],
  ])("formats %d bytes as %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});
