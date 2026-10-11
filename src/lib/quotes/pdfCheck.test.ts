import { afterEach, describe, expect, it, vi } from "vitest";
import { makeNotPdf, makePdf } from "./fixtures";
import { inspectFile } from "./pdfCheck";

const NOT_A_VALID_PDF = "is not a valid PDF. Please save or export the drawing as a PDF and attach it again.";

/** A file whose bytes are `prefix` followed by a PDF header, padded to 2 KB. */
function pdfWithPrefix(prefix: Uint8Array, name = "plan.pdf"): File {
  const header = new TextEncoder().encode("%PDF-1.7\n");
  const content = new Uint8Array(2048);
  content.set(prefix);
  content.set(header, prefix.length);
  return new File([content], name, { type: "application/pdf" });
}

/** A file whose contents can no longer be read, as when it was moved or deleted after being chosen. */
function unreadable(file: File): File {
  vi.spyOn(file, "slice").mockReturnValue({
    arrayBuffer: () => Promise.reject(new DOMException("The file could not be read.", "NotReadableError")),
  } as unknown as Blob);
  return file;
}

describe("inspectFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a PDF that starts with the %PDF- header", async () => {
    // Arrange
    const file = makePdf("plan.pdf");

    // Act
    const inspected = await inspectFile(file);

    // Assert
    expect(inspected).toEqual({ file, problem: null });
  });

  it("accepts a PDF whose header follows a few stray bytes, as PDF readers do", async () => {
    const file = pdfWithPrefix(new Uint8Array([0xef, 0xbb, 0xbf]));

    expect((await inspectFile(file)).problem).toBeNull();
  });

  it("refuses a file named .pdf that has no PDF header, and names it", async () => {
    // Arrange
    const file = makeNotPdf("photo.pdf");

    // Act
    const inspected = await inspectFile(file);

    // Assert
    expect(inspected).toEqual({ file, problem: `photo.pdf ${NOT_A_VALID_PDF}` });
  });

  it("refuses a file whose only PDF header comes after the first kilobyte", async () => {
    const file = pdfWithPrefix(new Uint8Array(1024).fill(0x20), "late-header.pdf");

    expect((await inspectFile(file)).problem).toBe(`late-header.pdf ${NOT_A_VALID_PDF}`);
  });

  it("refuses a file that cannot be read, and asks for it again", async () => {
    // Arrange
    const file = unreadable(makePdf("moved.pdf"));

    // Act
    const inspected = await inspectFile(file);

    // Assert
    expect(inspected.problem).toBe("moved.pdf could not be read. Please check the file and choose it again.");
  });

  it("reports a file that is not a PDF by name and type without reading it", async () => {
    // Arrange
    const file = makePdf("photo.png", 1024, "image/png");
    const slice = vi.spyOn(file, "slice");

    // Act
    const inspected = await inspectFile(file);

    // Assert
    expect(inspected.problem).toBe("photo.png is not a PDF. Drawings must be PDF files.");
    expect(slice).not.toHaveBeenCalled();
  });

  it("reports an empty file without reading it", async () => {
    expect((await inspectFile(makePdf("blank.pdf", 0))).problem).toBe("blank.pdf is empty. Please attach a valid PDF.");
  });

  it("prints file names without line breaks or control characters", async () => {
    expect((await inspectFile(makeNotPdf("photo\nrev\u0000.pdf"))).problem).toBe(`photo rev.pdf ${NOT_A_VALID_PDF}`);
  });
});
