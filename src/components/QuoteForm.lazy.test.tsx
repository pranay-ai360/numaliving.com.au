import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fillRequiredFields, getSendButton, renderQuoteForm, setUpSending } from "./quote-form/testSupport";

// Records each time the validation and sending code (which includes Zod) is loaded.
const submitModule = vi.hoisted(() => ({ loads: vi.fn() }));

vi.mock("@/lib/quotes/submit", async (importOriginal) => {
  submitModule.loads();
  return importOriginal();
});

describe("QuoteForm loading its sending code", () => {
  const fetchSpy = setUpSending();

  it("loads the validation and sending code only once the visitor starts using the form, then sends with it", async () => {
    // Arrange
    const user = renderQuoteForm();
    expect(submitModule.loads).not.toHaveBeenCalled();

    // Act
    await user.click(screen.getByLabelText("Full name *"));

    // Assert
    await waitFor(() => expect(submitModule.loads).toHaveBeenCalledOnce());
    await fillRequiredFields(user);
    await user.click(getSendButton());
    expect(await screen.findByText("Thank You")).toBeVisible();
    expect(fetchSpy()).toHaveBeenCalledOnce();
  });
});
