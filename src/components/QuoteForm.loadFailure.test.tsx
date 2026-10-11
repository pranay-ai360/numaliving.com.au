import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { site } from "@/config/site";
import { UNEXPECTED_FAILURE_MESSAGE } from "@/lib/quotes/messages";
import { fillRequiredFields, getSendButton, renderQuoteForm, setUpSending } from "./quote-form/testSupport";

const loader = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock("./quote-form/loadSubmitter", () => ({
  loadSubmitter: loader.load,
  preloadSubmitter: () => undefined,
}));

describe("QuoteForm when its sending code cannot be loaded", () => {
  const fetchSpy = setUpSending();

  it("offers the email fallback, sends nothing, and lets the visitor try again", async () => {
    // Arrange
    const { submitQuoteRequest } = await vi.importActual<typeof import("@/lib/quotes/submit")>("@/lib/quotes/submit");
    loader.load.mockRejectedValueOnce(new Error("Loading chunk failed")).mockResolvedValue(submitQuoteRequest);
    const user = renderQuoteForm();
    await fillRequiredFields(user);

    // Act
    await user.click(getSendButton());

    // Assert
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(UNEXPECTED_FAILURE_MESSAGE);
    expect(within(alert).getByRole("link", { name: "Email us instead" })).toHaveAttribute(
      "href",
      `mailto:${site.contact.email}?subject=Quote%20Request%20(website%20error%3A%20unexpected)`,
    );
    expect(fetchSpy()).not.toHaveBeenCalled();
    expect(getSendButton()).toBeEnabled();

    // Act again
    await user.click(getSendButton());

    // Assert again
    expect(await screen.findByText("Thank You")).toBeVisible();
    expect(fetchSpy()).toHaveBeenCalledOnce();
  });
});
