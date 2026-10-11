import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import { REVIEW_MESSAGE } from "./quote-form/constants";
import {
  REFERENCE_PATTERN,
  fillRequiredFields,
  getSendButton,
  renderQuoteForm,
  sentBody,
  setUpSending,
} from "./quote-form/testSupport";

const LINK_HELP = "For sets over 9 MB, paste a share link instead";

describe("QuoteForm focus and field errors", () => {
  const fetchSpy = setUpSending();

  describe("once a Quote Request has been sent", () => {
    it("moves focus to the Thank You heading, so phone and screen-reader users land on it", async () => {
      // Arrange
      const user = renderQuoteForm();
      await fillRequiredFields(user);

      // Act
      await user.click(getSendButton());

      // Assert
      const heading = await screen.findByRole("heading", { name: "Thank You" });
      expect(heading).toHaveFocus();
      expect(heading).toHaveAttribute("tabindex", "-1");
      expect(screen.getByRole("status")).toHaveTextContent("Thank You");
    });

    it("shows the reference that was emailed and how to follow up if no reply comes", async () => {
      // Arrange
      const user = renderQuoteForm();
      await fillRequiredFields(user);

      // Act
      await user.click(getSendButton());

      // Assert
      await screen.findByText("Thank You");
      const reference = String(sentBody(fetchSpy()).get("Reference"));
      expect(reference).toMatch(REFERENCE_PATTERN);
      expect(screen.getByText(`Reference: ${reference}`)).toBeVisible();
      expect(screen.getByText("We have your request. Our team will reply within two working days.")).toBeVisible();
      const followUp = screen.getByText(/^No reply within two working days\?/);
      expect(followUp).toHaveTextContent(`No reply within two working days? Email ${site.contact.email} quoting ${reference}.`);
      expect(screen.getByRole("link", { name: site.contact.email })).toHaveAttribute(
        "href",
        `mailto:${site.contact.email}?subject=${encodeURIComponent(`Quote Request ${reference}`)}`,
      );
      expect(screen.queryByText(/preview mode/i)).not.toBeInTheDocument();
    });

    it("offers a fresh, empty form with focus on its first field, again subject to the 2 second rule", async () => {
      // Arrange
      const user = renderQuoteForm();
      await fillRequiredFields(user);
      await user.click(getSendButton());
      await screen.findByText("Thank You");

      // Act
      await user.click(screen.getByRole("button", { name: "Send another request →" }));

      // Assert
      expect(screen.getByLabelText("Full name *")).toHaveValue("");
      expect(screen.getByLabelText("Full name *")).toHaveFocus();
      expect(screen.queryByText("Thank You")).not.toBeInTheDocument();

      // Act again: fill and send at once
      await fillRequiredFields(user);
      await user.click(getSendButton());

      // Assert again
      expect(await screen.findByRole("alert")).toHaveTextContent(REVIEW_MESSAGE);
      expect(fetchSpy()).toHaveBeenCalledOnce();
    });

    it("leaves focus alone when the form first appears", () => {
      renderQuoteForm();

      expect(screen.getByLabelText("Full name *")).not.toHaveFocus();
    });
  });

  describe("when a detail fails validation", () => {
    it("marks the field invalid, links it to the message and moves focus to it", async () => {
      // Arrange
      const user = renderQuoteForm();
      await fillRequiredFields(user);
      await user.clear(screen.getByLabelText("Email *"));
      await user.type(screen.getByLabelText("Email *"), "ada@localhost");

      // Act
      await user.click(getSendButton());

      // Assert
      expect(await screen.findByRole("alert")).toHaveTextContent("Please enter a valid email address.");
      const email = screen.getByLabelText("Email *");
      expect(email).toHaveAttribute("aria-invalid", "true");
      expect(email).toHaveAccessibleDescription("Please enter a valid email address.");
      expect(email).toHaveFocus();
      expect(screen.getByLabelText("Full name *")).not.toHaveAttribute("aria-invalid");
      expect(screen.queryByRole("link", { name: "Email us instead" })).not.toBeInTheDocument();
      expect(fetchSpy()).not.toHaveBeenCalled();
      expect(getSendButton()).toBeEnabled();
      expect(screen.getByLabelText("Full name *")).toHaveValue("Ada Lovelace");
    });

    it("keeps a field's own help text in its description next to the problem", async () => {
      // Arrange
      const user = renderQuoteForm();
      await fillRequiredFields(user);
      await user.type(screen.getByLabelText("Link to larger drawings"), "http://drive.example.com/plans");

      // Act
      await user.click(getSendButton());

      // Assert
      await screen.findByRole("alert");
      const link = screen.getByLabelText("Link to larger drawings");
      expect(link).toHaveAttribute("aria-invalid", "true");
      expect(link).toHaveAccessibleDescription(`${LINK_HELP} Please enter a link that starts with https://.`);
      expect(link).toHaveFocus();
    });

    it("moves the mark to the next problem once the first is fixed", async () => {
      // Arrange
      const user = renderQuoteForm();
      await fillRequiredFields(user);
      await user.clear(screen.getByLabelText("Full name *"));
      await user.type(screen.getByLabelText("Full name *"), "   ");
      await user.type(screen.getByLabelText("Link to larger drawings"), "ftp://example.com/plans");
      await user.click(getSendButton());
      await screen.findByText("Please enter your full name.");

      // Act
      await user.clear(screen.getByLabelText("Full name *"));
      await user.type(screen.getByLabelText("Full name *"), "Ada Lovelace");
      await user.click(getSendButton());

      // Assert
      expect(await screen.findByText("Please enter a link that starts with https://.")).toBeVisible();
      expect(screen.getByLabelText("Full name *")).not.toHaveAttribute("aria-invalid");
      expect(screen.getByLabelText("Full name *")).not.toHaveAccessibleDescription();
      expect(screen.getByLabelText("Link to larger drawings")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("Link to larger drawings")).toHaveFocus();
    });

    it("marks no field when sending fails for a reason that is not about the details", async () => {
      // Arrange
      fetchSpy().mockRejectedValue(new TypeError("Failed to fetch"));
      const user = renderQuoteForm();
      await fillRequiredFields(user);

      // Act
      await user.click(getSendButton());

      // Assert
      await screen.findByRole("alert");
      for (const field of screen.getAllByRole("textbox")) expect(field).not.toHaveAttribute("aria-invalid");
      for (const field of screen.getAllByRole("combobox")) expect(field).not.toHaveAttribute("aria-invalid");
    });
  });
});
