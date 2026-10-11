import { describe, expect, it } from "vitest";
import { drawingsReducer, EMPTY_DRAWINGS_LIST, type DrawingsList } from "./drawingsList";
import { BYTES_PER_MB, makePdf } from "./fixtures";
import type { InspectedFile } from "./pdfCheck";

const FIXED_TIME = 1_760_000_000_000;

function pdf(name: string, sizeBytes = 1024, lastModified = FIXED_TIME): File {
  const file = makePdf(name, sizeBytes);
  return new File([file], name, { type: file.type, lastModified });
}

function passed(file: File): InspectedFile {
  return { file, problem: null };
}

function refused(file: File, problem: string): InspectedFile {
  return { file, problem };
}

/** The list after one finished choice of files. */
function afterChoice(list: DrawingsList, files: readonly InspectedFile[]): DrawingsList {
  return drawingsReducer(drawingsReducer(list, { type: "check-started" }), { type: "checked", inspected: files });
}

function names(list: DrawingsList): string[] {
  return list.chosen.map((drawing) => drawing.file.name);
}

describe("drawingsReducer", () => {
  describe("adding a checked choice of files", () => {
    it("adds every file that passed its checks, each with its own id", () => {
      // Arrange / Act
      const list = afterChoice(EMPTY_DRAWINGS_LIST, [passed(pdf("plan.pdf")), passed(pdf("boq.pdf"))]);

      // Assert
      expect(names(list)).toEqual(["plan.pdf", "boq.pdf"]);
      expect(new Set(list.chosen.map((drawing) => drawing.id)).size).toBe(2);
      expect(list.problems).toEqual([]);
    });

    it("keeps the ids of listed files and never reuses an id", () => {
      // Arrange
      const first = afterChoice(EMPTY_DRAWINGS_LIST, [passed(pdf("plan.pdf"))]);
      const removed = drawingsReducer(first, { type: "removed", id: first.chosen[0].id });

      // Act
      const withBoq = afterChoice(removed, [passed(pdf("boq.pdf"))]);
      const withDetail = afterChoice(withBoq, [passed(pdf("detail.pdf"))]);

      // Assert
      const ids = withDetail.chosen.map((drawing) => drawing.id);
      expect(ids[0]).toBe(withBoq.chosen[0].id);
      expect(ids).not.toContain(first.chosen[0].id);
      expect(new Set(ids).size).toBe(2);
    });

    it("refuses only the files with a problem, with one message for each", () => {
      // Arrange
      const choice = [
        refused(pdf("photo.pdf"), "photo.pdf is not a valid PDF."),
        passed(pdf("plan.pdf")),
        refused(pdf("moved.pdf"), "moved.pdf could not be read."),
      ];

      // Act
      const list = afterChoice(EMPTY_DRAWINGS_LIST, choice);

      // Assert
      expect(names(list)).toEqual(["plan.pdf"]);
      expect(list.problems).toEqual(["photo.pdf is not a valid PDF.", "moved.pdf could not be read."]);
    });

    it("refuses a file that is already listed, with the same name, size and date", () => {
      // Arrange
      const list = afterChoice(EMPTY_DRAWINGS_LIST, [passed(pdf("plan.pdf"))]);

      // Act
      const again = afterChoice(list, [passed(pdf("plan.pdf")), passed(pdf("boq.pdf"))]);

      // Assert
      expect(names(again)).toEqual(["plan.pdf", "boq.pdf"]);
      expect(again.problems).toEqual(["plan.pdf is already attached."]);
    });

    it("refuses the second copy of a file chosen twice at once", () => {
      const list = afterChoice(EMPTY_DRAWINGS_LIST, [passed(pdf("plan.pdf")), passed(pdf("plan.pdf"))]);

      expect(names(list)).toEqual(["plan.pdf"]);
      expect(list.problems).toEqual(["plan.pdf is already attached."]);
    });

    it.each([
      ["a different size", pdf("plan.pdf", 2048)],
      ["a different date", pdf("plan.pdf", 1024, FIXED_TIME + 1)],
      ["a different name", pdf("plan-rev-b.pdf")],
    ])("accepts a file that matches a listed one except for %s", (_label, file) => {
      const list = afterChoice(afterChoice(EMPTY_DRAWINGS_LIST, [passed(pdf("plan.pdf"))]), [passed(file)]);

      expect(list.chosen).toHaveLength(2);
      expect(list.problems).toEqual([]);
    });

    it("refuses the whole choice when it would take the list over 10 files", () => {
      // Arrange
      const nine = afterChoice(
        EMPTY_DRAWINGS_LIST,
        Array.from({ length: 9 }, (_, index) => passed(pdf(`sheet-${index + 1}.pdf`))),
      );

      // Act
      const list = afterChoice(nine, [passed(pdf("sheet-10.pdf")), passed(pdf("sheet-11.pdf"))]);

      // Assert
      expect(list.chosen).toHaveLength(9);
      expect(list.problems).toEqual(["Please attach up to 10 files. For a bigger set, paste a share link instead."]);
    });

    it("refuses the whole choice when it would take the list over 9 MB, after naming any other refused file", () => {
      // Arrange
      const choice = [
        refused(pdf("notes.pdf"), "notes.pdf is not a valid PDF."),
        passed(pdf("a.pdf", 5 * BYTES_PER_MB)),
        passed(pdf("b.pdf", 4 * BYTES_PER_MB + 1)),
      ];

      // Act
      const list = afterChoice(EMPTY_DRAWINGS_LIST, choice);

      // Assert
      expect(list.chosen).toEqual([]);
      expect(list.problems).toEqual([
        "notes.pdf is not a valid PDF.",
        "Your files total 9.1 MB, over the 9 MB limit. Remove some files, or paste a share link to the larger drawings instead.",
      ]);
    });

    it("says each message only once", () => {
      const choice = [refused(pdf("x.pdf"), "x.pdf is not a valid PDF."), refused(pdf("x.pdf"), "x.pdf is not a valid PDF.")];

      expect(afterChoice(EMPTY_DRAWINGS_LIST, choice).problems).toEqual(["x.pdf is not a valid PDF."]);
    });

    it("replaces the messages of the previous choice", () => {
      // Arrange
      const refusedOnce = afterChoice(EMPTY_DRAWINGS_LIST, [refused(pdf("x.pdf"), "x.pdf is not a valid PDF.")]);

      // Act
      const list = afterChoice(refusedOnce, [passed(pdf("plan.pdf"))]);

      // Assert
      expect(list.problems).toEqual([]);
    });

    it.each([
      [1, "1 file attached."],
      [3, "3 files attached."],
    ])("announces the new count when %d files are listed", (count, announcement) => {
      const choice = Array.from({ length: count }, (_, index) => passed(pdf(`sheet-${index + 1}.pdf`)));

      expect(afterChoice(EMPTY_DRAWINGS_LIST, choice).announcement).toBe(announcement);
    });

    it("announces nothing new when no file was added", () => {
      // Arrange
      const list = afterChoice(EMPTY_DRAWINGS_LIST, [passed(pdf("plan.pdf"))]);

      // Act
      const after = afterChoice(list, [refused(pdf("x.pdf"), "x.pdf is not a valid PDF.")]);

      // Assert
      expect(after.announcement).toBe("1 file attached.");
    });

    it("starts with nothing to announce", () => {
      expect(EMPTY_DRAWINGS_LIST.announcement).toBe("");
    });
  });

  describe("checks in progress", () => {
    it("counts the choices still being checked", () => {
      // Arrange / Act
      const twoStarted = drawingsReducer(drawingsReducer(EMPTY_DRAWINGS_LIST, { type: "check-started" }), {
        type: "check-started",
      });
      const oneFinished = drawingsReducer(twoStarted, { type: "checked", inspected: [passed(pdf("plan.pdf"))] });

      // Assert
      expect(twoStarted.pendingChecks).toBe(2);
      expect(oneFinished.pendingChecks).toBe(1);
    });

    it("never counts below zero", () => {
      const list = drawingsReducer(EMPTY_DRAWINGS_LIST, { type: "checked", inspected: [] });

      expect(list.pendingChecks).toBe(0);
    });
  });

  describe("removing a file", () => {
    it("removes only the file with that id and clears the messages", () => {
      // Arrange
      const list = afterChoice(EMPTY_DRAWINGS_LIST, [
        passed(pdf("plan.pdf")),
        passed(pdf("boq.pdf")),
        refused(pdf("x.pdf"), "x.pdf is not a valid PDF."),
      ]);

      // Act
      const after = drawingsReducer(list, { type: "removed", id: list.chosen[0].id });

      // Assert
      expect(names(after)).toEqual(["boq.pdf"]);
      expect(after.chosen[0]).toBe(list.chosen[1]);
      expect(after.problems).toEqual([]);
      expect(after.announcement).toBe("1 file attached.");
    });

    it("announces when no files are left", () => {
      const list = afterChoice(EMPTY_DRAWINGS_LIST, [passed(pdf("plan.pdf"))]);

      expect(drawingsReducer(list, { type: "removed", id: list.chosen[0].id }).announcement).toBe("No files attached.");
    });

    it("changes nothing for an id that is not listed", () => {
      const list = afterChoice(EMPTY_DRAWINGS_LIST, [passed(pdf("plan.pdf"))]);

      expect(drawingsReducer(list, { type: "removed", id: "drawing-999" })).toBe(list);
    });
  });

  it("never modifies the list it was given", () => {
    // Arrange
    const list = Object.freeze(afterChoice(EMPTY_DRAWINGS_LIST, [passed(pdf("plan.pdf"))]));
    const snapshot = { ...list, chosen: [...list.chosen] };

    // Act
    drawingsReducer(list, { type: "checked", inspected: [passed(pdf("boq.pdf"))] });
    drawingsReducer(list, { type: "removed", id: list.chosen[0].id });

    // Assert
    expect(list).toEqual(snapshot);
  });
});
