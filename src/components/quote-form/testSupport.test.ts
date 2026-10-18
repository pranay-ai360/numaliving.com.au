import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderQuoteForm } from "./testSupport";

describe("renderQuoteForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets user-event up with no pause between key presses, so typing a whole form cannot run out of time on a busy machine", () => {
    // Arrange
    const setUp = vi.spyOn(userEvent, "setup");

    // Act
    renderQuoteForm({ isAged: false });

    // Assert
    expect(setUp).toHaveBeenCalledWith(expect.objectContaining({ delay: null }));
  });

  it("still lets a test choose to ignore the file input's accept filter", () => {
    // Arrange
    const setUp = vi.spyOn(userEvent, "setup");

    // Act
    renderQuoteForm({ isAged: false, applyAccept: false });

    // Assert
    expect(setUp).toHaveBeenCalledWith(expect.objectContaining({ applyAccept: false, delay: null }));
  });
});
