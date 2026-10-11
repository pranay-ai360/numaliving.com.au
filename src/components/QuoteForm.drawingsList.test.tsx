import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { jsonResponse } from "@/lib/quotes/fetchFixtures";
import { makeNotPdf, makePdf } from "@/lib/quotes/fixtures";
import {
  deferred,
  fillRequiredFields,
  getDrawingsInput,
  getDropZone,
  getSendButton,
  renderQuoteForm,
  setUpSending,
  statusTexts,
} from "./quote-form/testSupport";

function removeButton(name: string): HTMLElement {
  return screen.getByRole("button", { name: `Remove ${name}` });
}

/** A drag carrying files, as the browser describes it to drag and drop handlers. */
function fileDrag(files: readonly File[]): { dataTransfer: { files: readonly File[]; types: readonly string[] } } {
  return { dataTransfer: { files, types: ["Files"] } };
}

describe("QuoteForm Drawings list", () => {
  const fetchSpy = setUpSending();

  describe("removing a file", () => {
    it("removes only the file whose Remove button was pressed, keeping the other rows as they are", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });
      await user.upload(getDrawingsInput(), [makePdf("plan.pdf"), makePdf("boq.pdf")]);
      const boqRow = (await screen.findByRole("button", { name: "Remove boq.pdf" })).closest("li");

      // Act
      await user.click(removeButton("plan.pdf"));

      // Assert
      const rows = within(screen.getByRole("list")).getAllByRole("listitem");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toBe(boqRow);
      expect(rows[0]).toHaveTextContent("boq.pdf");
    });

    it("removes the list altogether when the last file is removed", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });
      await user.upload(getDrawingsInput(), [makePdf("plan.pdf")]);
      await screen.findByRole("button", { name: "Remove plan.pdf" });

      // Act
      await user.click(removeButton("plan.pdf"));

      // Assert
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("moves focus to the next Remove button", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });
      await user.upload(getDrawingsInput(), [makePdf("plan.pdf"), makePdf("boq.pdf"), makePdf("detail.pdf")]);
      await screen.findByRole("button", { name: "Remove detail.pdf" });

      // Act
      await user.click(removeButton("boq.pdf"));

      // Assert
      expect(removeButton("detail.pdf")).toHaveFocus();
    });

    it("moves focus back to the file picker when the last file in the list is removed", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });
      await user.upload(getDrawingsInput(), [makePdf("plan.pdf"), makePdf("boq.pdf")]);
      await screen.findByRole("button", { name: "Remove boq.pdf" });

      // Act
      await user.click(removeButton("boq.pdf"));

      // Assert
      expect(getDrawingsInput()).toHaveFocus();
    });

    it("clears the message when a file is removed", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false, applyAccept: false });
      await user.upload(getDrawingsInput(), [makePdf("plan.pdf")]);
      await screen.findByRole("button", { name: "Remove plan.pdf" });
      await user.upload(getDrawingsInput(), [makePdf("notes.txt", 1024, "text/plain")]);
      await screen.findByRole("alert");

      // Act
      await user.click(removeButton("plan.pdf"));

      // Assert
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("announcing the list to screen readers", () => {
    it("announces nothing before the list changes", () => {
      renderQuoteForm({ isAged: false });

      expect(statusTexts().filter((text) => text !== "")).toEqual([]);
    });

    it("announces the new number of files after each change", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });

      // Act / Assert
      await user.upload(getDrawingsInput(), [makePdf("plan.pdf"), makePdf("boq.pdf")]);
      await waitFor(() => expect(statusTexts()).toContain("2 files attached."));

      await user.click(removeButton("plan.pdf"));
      expect(statusTexts()).toContain("1 file attached.");

      await user.click(removeButton("boq.pdf"));
      expect(statusTexts()).toContain("No files attached.");
    });
  });

  describe("dropping files", () => {
    it("adds PDFs dropped on the drop zone through the same checks, without leaving the page", async () => {
      // Arrange
      renderQuoteForm({ isAged: false });

      // Act
      const isNotPrevented = fireEvent.drop(getDropZone(), fileDrag([makePdf("plan.pdf"), makeNotPdf("photo.pdf")]));

      // Assert
      expect(isNotPrevented).toBe(false);
      expect(await screen.findByRole("button", { name: "Remove plan.pdf" })).toBeInTheDocument();
      expect(await screen.findByRole("alert")).toHaveTextContent("photo.pdf is not a valid PDF.");
    });

    it("lets files be dragged over the drop zone", () => {
      renderQuoteForm({ isAged: false });

      expect(fireEvent.dragOver(getDropZone(), fileDrag([]))).toBe(false);
    });

    it("stops a file dropped anywhere else on the form from opening in place of the page, and adds nothing", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });
      const nameField = screen.getByLabelText("Full name *");

      // Act (the click gives a wrongly started, asynchronous add the time to show up)
      const isDragOverNotPrevented = fireEvent.dragOver(nameField, fileDrag([makePdf("plan.pdf")]));
      const isDropNotPrevented = fireEvent.drop(nameField, fileDrag([makePdf("plan.pdf")]));
      await user.click(nameField);

      // Assert
      expect(isDragOverNotPrevented).toBe(false);
      expect(isDropNotPrevented).toBe(false);
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("ignores a drag event that carries no data at all", () => {
      // Arrange
      renderQuoteForm({ isAged: false });

      // Act
      const dropOnZone = () => fireEvent.drop(getDropZone(), { dataTransfer: null });
      const dragOverForm = () => fireEvent.dragOver(screen.getByLabelText("Full name *"), { dataTransfer: null });

      // Assert
      expect(dropOnZone).not.toThrow();
      expect(dragOverForm).not.toThrow();
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("leaves dragged text alone, so it can still be dropped into a field", () => {
      renderQuoteForm({ isAged: false });

      const isNotPrevented = fireEvent.drop(screen.getByLabelText("Scope and notes *"), {
        dataTransfer: { files: [], types: ["text/plain"] },
      });

      expect(isNotPrevented).toBe(true);
    });

    it("ignores files dropped while the request is being sent", async () => {
      // Arrange
      const gate = deferred<Response>();
      fetchSpy().mockImplementation(() => gate.promise);
      const user = renderQuoteForm();
      await fillRequiredFields(user);
      await user.click(getSendButton());
      await screen.findByRole("button", { name: "Sending…" });

      // Act: drop mid-upload, then let the send fail so the form stays on screen
      const isNotPrevented = fireEvent.drop(getDropZone(), fileDrag([makePdf("late.pdf")]));
      gate.resolve(jsonResponse({ success: "false" }, 500));

      // Assert
      expect(isNotPrevented).toBe(false);
      await screen.findByRole("alert");
      expect(screen.queryByRole("button", { name: "Remove late.pdf" })).not.toBeInTheDocument();
      expect(statusTexts()).not.toContain("1 file attached.");
    });
  });
});
