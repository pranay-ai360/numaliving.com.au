import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { site } from "@/config/site";
import { FORM_ID_ENV_NAME, jsonResponse } from "@/lib/quotes/fetchFixtures";
import { sendFailureMessage, UNEXPECTED_FAILURE_MESSAGE } from "@/lib/quotes/messages";
import { MIN_FILL_TIME_MS } from "./quote-form/constants";
import {
  fillRequiredFields,
  getSendButton,
  passTime,
  renderQuoteForm,
  setUpSending,
} from "./quote-form/testSupport";

const REFERENCE_PATTERN_TEXT = /^Reference: NL-[A-HJ-NP-Z2-9]{6}$/;
const REVIEW_MESSAGE = "Please take a moment to review your details, then send again.";

/** The "Email us instead" address, with the short reason code in its subject. */
function fallbackHref(reason: string): string {
  return `mailto:${site.contact.email}?subject=Quote%20Request%20(website%20error%3A%20${reason})`;
}

async function sendFilledForm(): Promise<void> {
  const user = renderQuoteForm();
  await fillRequiredFields(user);
  await user.click(getSendButton());
}

describe("QuoteForm failures", () => {
  const fetchSpy = setUpSending();

  describe("protection against automated submissions", () => {
    it("asks the visitor to review the details when Send is pressed too soon, then lets a later press through", async () => {
      // Arrange
      const user = renderQuoteForm({ isAged: false });
      await fillRequiredFields(user);
      passTime(MIN_FILL_TIME_MS - 1);

      // Act
      await user.click(getSendButton());

      // Assert
      expect(await screen.findByRole("alert")).toHaveTextContent(REVIEW_MESSAGE);
      expect(screen.queryByRole("link", { name: "Email us instead" })).not.toBeInTheDocument();
      expect(fetchSpy()).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Full name *")).toHaveValue("Ada Lovelace");

      // Act again, once the 2 seconds are up
      passTime(1);
      await user.click(getSendButton());

      // Assert again
      expect(await screen.findByText("Thank You")).toBeVisible();
      expect(fetchSpy()).toHaveBeenCalledOnce();
    });

    it("quietly shows the Thank You panel, and sends nothing, when the hidden honeypot is filled", async () => {
      // Arrange: bots are quick, and fill hidden fields directly, so neither the timing rule nor visibility matters
      const user = renderQuoteForm({ isAged: false });
      await fillRequiredFields(user);
      fireEvent.change(screen.getByLabelText(/leave this field empty/i), { target: { value: "http://spam.example" } });

      // Act
      await user.click(getSendButton());

      // Assert
      expect(await screen.findByText("Thank You")).toBeVisible();
      expect(screen.getByText(REFERENCE_PATTERN_TEXT)).toBeVisible();
      expect(fetchSpy()).not.toHaveBeenCalled();
    });
  });

  describe("when sending does not work", () => {
    it("explains the failure, keeps the details and offers an email fallback that names the reason", async () => {
      // Arrange
      fetchSpy().mockRejectedValue(new TypeError("Failed to fetch"));

      // Act
      await sendFilledForm();

      // Assert
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(sendFailureMessage("network"));
      expect(within(alert).getByRole("link", { name: "Email us instead" })).toHaveAttribute("href", fallbackHref("network"));
      expect(screen.getByLabelText("Full name *")).toHaveValue("Ada Lovelace");
      expect(screen.getByLabelText("Scope and notes *")).toHaveValue("Walnut wardrobes for twelve villas.");
      expect(getSendButton()).toBeEnabled();
      expect(screen.queryByText("Thank You")).not.toBeInTheDocument();
    });

    it.each([
      ["too-large", () => new Response("<html>Request Entity Too Large</html>", { status: 413 })],
      ["not-activated", () => jsonResponse({ success: "false", message: "This form needs Activation." })],
      ["rejected", () => jsonResponse({ success: "false", message: "Internal Server Error" }, 500)],
      ["invalid-response", () => new Response("<html>Hello</html>", { status: 200 })],
    ] as const)("gives the specific %s message, never FormSubmit's own words", async (reason, makeResponse) => {
      // Arrange
      fetchSpy().mockImplementation(async () => makeResponse());

      // Act
      await sendFilledForm();

      // Assert
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(sendFailureMessage(reason));
      expect(alert).not.toHaveTextContent(/Activation|Internal Server Error|Entity/);
      expect(within(alert).getByRole("link", { name: "Email us instead" })).toHaveAttribute("href", fallbackHref(reason));
    });

    it("lets the visitor try again, and clears the message once it works", async () => {
      // Arrange
      fetchSpy().mockRejectedValueOnce(new TypeError("Failed to fetch"));
      const user = renderQuoteForm();
      await fillRequiredFields(user);
      await user.click(getSendButton());
      await screen.findByRole("alert");

      // Act
      await user.click(getSendButton());

      // Assert
      expect(await screen.findByText("Thank You")).toBeVisible();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(fetchSpy()).toHaveBeenCalledTimes(2);
    });

    it("says online requests are unavailable, and never pretends to send, when no form id is configured", async () => {
      // Arrange
      vi.stubEnv(FORM_ID_ENV_NAME, "");

      // Act
      await sendFilledForm();

      // Assert
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(sendFailureMessage("not-configured"));
      expect(within(alert).getByRole("link", { name: "Email us instead" })).toHaveAttribute(
        "href",
        fallbackHref("not-configured"),
      );
      expect(fetchSpy()).not.toHaveBeenCalled();
      expect(screen.queryByText("Thank You")).not.toBeInTheDocument();
    });

    it("never leaves the button stuck on Sending when something unexpected goes wrong", async () => {
      // Arrange
      const user = renderQuoteForm();
      await fillRequiredFields(user);
      vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(() => {
        throw new Error("no entropy");
      });

      // Act
      await user.click(getSendButton());

      // Assert
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(UNEXPECTED_FAILURE_MESSAGE);
      expect(within(alert).getByRole("link", { name: "Email us instead" })).toHaveAttribute("href", fallbackHref("unexpected"));
      expect(getSendButton()).toBeEnabled();
      expect(fetchSpy()).not.toHaveBeenCalled();
    });

    it("writes nothing to the console", async () => {
      // Arrange
      const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
        vi.spyOn(console, method).mockImplementation(() => undefined),
      );
      fetchSpy().mockRejectedValue(new TypeError("Failed to fetch"));

      // Act
      await sendFilledForm();
      await screen.findByRole("alert");

      // Assert
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    });
  });
});
