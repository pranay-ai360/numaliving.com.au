import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BYTES_PER_MB, makeNotPdf, makePdf } from "@/lib/quotes/fixtures";
import { deferred, getDrawingsInput, getSendButton, renderQuoteForm } from "./quote-form/testSupport";

const NOT_A_VALID_PDF = "is not a valid PDF. Please save or export the drawing as a PDF and attach it again.";

function chosenFiles(): string[] {
  const list = screen.queryByRole("list");
  if (list === null) return [];
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.textContent ?? "");
}

/** Each message in the Drawings alert, in order. */
async function drawingsProblems(): Promise<string[]> {
  const alert = await screen.findByRole("alert");
  return Array.from(alert.querySelectorAll("p"), (line) => line.textContent ?? "");
}

// These tests do not depend on time, so the real clock is used.
describe("QuoteForm Drawings", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("choosing PDFs", () => {
    it("lists each chosen PDF with its size, once its contents have been checked", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });

      // Act
      await user.upload(getDrawingsInput(), [makePdf("plan.pdf", 2048), makePdf("boq.pdf", 1.5 * BYTES_PER_MB)]);

      // Assert
      await screen.findByRole("button", { name: "Remove boq.pdf" });
      const items = chosenFiles();
      expect(items).toHaveLength(2);
      expect(items[0]).toContain("plan.pdf");
      expect(items[0]).toContain("2 KB");
      expect(items[1]).toContain("boq.pdf");
      expect(items[1]).toContain("1.5 MB");
    });

    it("adds newly chosen files to the ones already listed", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });
      await user.upload(getDrawingsInput(), [makePdf("plan.pdf")]);
      await screen.findByRole("button", { name: "Remove plan.pdf" });

      // Act
      await user.upload(getDrawingsInput(), [makePdf("boq.pdf")]);

      // Assert
      await screen.findByRole("button", { name: "Remove boq.pdf" });
      expect(chosenFiles()).toHaveLength(2);
    });

    it("prints file names without line breaks or control characters", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });

      // Act
      await user.upload(getDrawingsInput(), [makePdf("plan\nrev B.pdf")]);

      // Assert
      expect(await screen.findByRole("button", { name: "Remove plan rev B.pdf" })).toBeInTheDocument();
      expect(chosenFiles()[0]).toContain("plan rev B.pdf");
    });

    it("keeps Send disabled until the chosen files have been checked", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });
      const reading = deferred<ArrayBuffer>();
      const file = makePdf("plan.pdf");
      const realStart = await file.slice(0, 1024).arrayBuffer();
      vi.spyOn(file, "slice").mockReturnValue({ arrayBuffer: () => reading.promise } as unknown as Blob);

      // Act
      await user.upload(getDrawingsInput(), [file]);

      // Assert
      expect(getSendButton()).toBeDisabled();
      reading.resolve(realStart);
      await screen.findByRole("button", { name: "Remove plan.pdf" });
      expect(getSendButton()).toBeEnabled();
    });
  });

  describe("refusing files", () => {
    it("refuses a file that is not a PDF, says why, and lists nothing", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false, applyAccept: false });

      // Act
      await user.upload(getDrawingsInput(), [makePdf("photo.png", 1024, "image/png")]);

      // Assert
      expect(await screen.findByRole("alert")).toHaveTextContent("photo.png is not a PDF. Drawings must be PDF files.");
      expect(chosenFiles()).toEqual([]);
    });

    it("refuses a file named .pdf whose contents are not a PDF", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });

      // Act
      await user.upload(getDrawingsInput(), [makeNotPdf("site-photo.pdf")]);

      // Assert
      expect(await screen.findByRole("alert")).toHaveTextContent(`site-photo.pdf ${NOT_A_VALID_PDF}`);
      expect(chosenFiles()).toEqual([]);
    });

    it("refuses a file that is already attached", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });
      const plan = makePdf("plan.pdf");
      await user.upload(getDrawingsInput(), [plan]);
      await screen.findByRole("button", { name: "Remove plan.pdf" });

      // Act
      await user.upload(getDrawingsInput(), [plan]);

      // Assert
      expect(await screen.findByRole("alert")).toHaveTextContent("plan.pdf is already attached.");
      expect(chosenFiles()).toHaveLength(1);
    });

    it("gives a message for each refused file and still adds the good ones", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false, applyAccept: false });

      // Act
      await user.upload(getDrawingsInput(), [
        makeNotPdf("photo.pdf"),
        makePdf("plan.pdf"),
        makePdf("notes.txt", 1024, "text/plain"),
      ]);

      // Assert
      expect(await drawingsProblems()).toEqual([
        `photo.pdf ${NOT_A_VALID_PDF}`,
        "notes.txt is not a PDF. Drawings must be PDF files.",
      ]);
      expect(chosenFiles()).toHaveLength(1);
      expect(chosenFiles()[0]).toContain("plan.pdf");
    });

    it("links the message to the file picker, so it is read out with it", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });

      // Act
      await user.upload(getDrawingsInput(), [makeNotPdf("photo.pdf")]);

      // Assert
      await screen.findByRole("alert");
      expect(getDrawingsInput()).toHaveAccessibleDescription(`photo.pdf ${NOT_A_VALID_PDF}`);
    });

    it("refuses a set over 9 MB in total and suggests a share link", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });

      // Act
      await user.upload(getDrawingsInput(), [makePdf("a.pdf", 5 * BYTES_PER_MB), makePdf("b.pdf", 4 * BYTES_PER_MB + 1)]);

      // Assert
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Your files total 9.1 MB, over the 9 MB limit. Remove some files, or paste a share link to the larger drawings instead.",
      );
      expect(chosenFiles()).toEqual([]);
    });

    it("refuses an eleventh file", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });
      const eleven = Array.from({ length: 11 }, (_, index) => makePdf(`sheet-${index + 1}.pdf`));

      // Act
      await user.upload(getDrawingsInput(), eleven);

      // Assert
      expect(await screen.findByRole("alert")).toHaveTextContent("Please attach up to 10 files.");
      expect(chosenFiles()).toEqual([]);
    });

    it("keeps the files already chosen when a later choice is refused", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false, applyAccept: false });
      await user.upload(getDrawingsInput(), [makePdf("plan.pdf")]);
      await screen.findByRole("button", { name: "Remove plan.pdf" });

      // Act
      await user.upload(getDrawingsInput(), [makePdf("notes.txt", 1024, "text/plain")]);

      // Assert
      expect(await screen.findByRole("alert")).toHaveTextContent("notes.txt is not a PDF.");
      expect(chosenFiles()).toHaveLength(1);
      expect(chosenFiles()[0]).toContain("plan.pdf");
    });

    it("clears the message once valid files are chosen", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false, applyAccept: false });
      await user.upload(getDrawingsInput(), [makePdf("notes.txt", 1024, "text/plain")]);
      await screen.findByRole("alert");

      // Act
      await user.upload(getDrawingsInput(), [makePdf("plan.pdf")]);

      // Assert
      await screen.findByRole("button", { name: "Remove plan.pdf" });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(getDrawingsInput()).not.toHaveAccessibleDescription();
    });
  });
});
