import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuoteForm } from "@/components/QuoteForm";
import { PROJECT_TYPE_OPTIONS, ROLE_OPTIONS, TIMELINE_OPTIONS } from "@/lib/quotes/fields";
import { makePdf } from "@/lib/quotes/fixtures";
import {
  PAGE_ENDPOINT,
  SUCCESS_PAGE,
  deferred,
  fillRequiredFields,
  getDrawingsInput,
  getDropZone,
  getSendButton,
  htmlResponse,
  renderQuoteForm,
  sentBody,
  setUpSending,
  statusTexts,
  successResponse,
} from "./quote-form/testSupport";

const PRIVACY_NOTE =
  "Your details and drawings are sent to Numa Living by email through FormSubmit.co and used only to reply to your enquiry.";

// The classes the form had before this migration; the design must not drift.
const ORIGINAL_FIELD_CLASS =
  "mt-1.5 w-full rounded-sm border border-line bg-paper px-3.5 py-2.5 text-ink outline-none transition-colors focus:border-gold";
const ORIGINAL_BUTTON_CLASS =
  "w-full rounded-sm bg-gold px-8 py-3.5 font-medium tracking-wide text-white transition-colors hover:bg-gold-dark disabled:opacity-60 sm:w-auto";
const ORIGINAL_FIELDSET_CLASS = "grid gap-5 sm:grid-cols-2";

const REQUIRED_LABELS = [
  "Full name *",
  "Email *",
  "Your role *",
  "Project type *",
  "Site location (city, country) *",
  "Timeline *",
  "Scope and notes *",
];

describe("QuoteForm", () => {
  const fetchSpy = setUpSending();

  describe("what the visitor sees", () => {
    it("shows the three sections of the form", () => {
      // Arrange / Act
      renderQuoteForm();

      // Assert
      expect(screen.getByRole("group", { name: "About you" })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "The project" })).toBeInTheDocument();
      expect(screen.getByRole("group", { name: "Drawings" })).toBeInTheDocument();
    });

    it.each([
      ["Your role *", ROLE_OPTIONS],
      ["Project type *", PROJECT_TYPE_OPTIONS],
      ["Timeline *", TIMELINE_OPTIONS],
    ])("offers every choice from the shared list for %s", (label, options) => {
      // Arrange
      renderQuoteForm();

      // Act
      const choices = within(screen.getByLabelText(label))
        .getAllByRole("option")
        .map((option) => option.textContent);

      // Assert
      expect(choices).toEqual(["Select…", ...options]);
    });

    it("keeps the browser's own required checks on the essential fields only", () => {
      // Arrange / Act
      renderQuoteForm();

      // Assert
      for (const label of REQUIRED_LABELS) expect(screen.getByLabelText(label)).toBeRequired();
      for (const label of ["Company", "Phone / WhatsApp", "Link to larger drawings"]) {
        expect(screen.getByLabelText(label)).not.toBeRequired();
      }
    });

    it("invites the visitor to attach PDF drawings and states the limits", () => {
      // Arrange / Act
      renderQuoteForm();

      // Assert
      const input = getDrawingsInput();
      expect(input).toHaveAttribute("type", "file");
      expect(input).toHaveAttribute("accept", "application/pdf");
      expect(input).toHaveAttribute("multiple");
      expect(screen.getByText("Attach drawings or BOQ (PDF)")).toBeInTheDocument();
      expect(screen.getByText("Up to 10 files, 9 MB in total")).toBeInTheDocument();
    });

    it("rings the drop zone when its hidden file picker has keyboard focus", () => {
      // Arrange / Act
      renderQuoteForm();

      // Assert
      expect(getDropZone().className.split(" ")).toEqual(
        expect.arrayContaining([
          "has-[:focus-visible]:border-gold",
          "has-[:focus-visible]:outline-2",
          "has-[:focus-visible]:outline-offset-2",
          "has-[:focus-visible]:outline-gold",
        ]),
      );
    });

    it("offers an optional link for drawings that are too big to attach", () => {
      // Arrange / Act
      renderQuoteForm();

      // Assert
      const link = screen.getByLabelText("Link to larger drawings");
      expect(link).toHaveAttribute("type", "url");
      expect(link).toHaveAttribute("name", "drawingsLink");
      expect(link).toHaveAttribute("placeholder", "Google Drive, Dropbox or WeTransfer link");
      expect(link).toHaveAccessibleDescription("For sets over 9 MB, paste a share link instead");
    });

    it("no longer mentions sketching", () => {
      // Arrange / Act
      renderQuoteForm();

      // Assert
      expect(screen.queryByText(/sketch/i)).not.toBeInTheDocument();
    });

    it("says, under the Send button, who receives the details and drawings and why", () => {
      // Arrange / Act
      renderQuoteForm();

      // Assert
      const note = screen.getByText(PRIVACY_NOTE);
      expect(getSendButton().compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("hides a honeypot field from people, keyboards and autofill", () => {
      // Arrange / Act
      renderQuoteForm();

      // Assert
      const honeypot = screen.getByLabelText(/leave this field empty/i);
      expect(honeypot).toHaveAttribute("name", "_honey");
      expect(honeypot).toHaveAttribute("tabindex", "-1");
      expect(honeypot).toHaveAttribute("autocomplete", "off");
      expect(honeypot).not.toBeVisible();
      expect(honeypot.closest("[hidden]")).not.toBeNull();
      expect(honeypot.closest(".sr-only")).toBeNull();
    });

    it("keeps the original look of the buttons, fields and sections", () => {
      // Arrange / Act
      renderQuoteForm();

      // Assert
      expect(getSendButton()).toHaveAttribute("class", ORIGINAL_BUTTON_CLASS);
      expect(screen.getByLabelText("Full name *")).toHaveAttribute("class", ORIGINAL_FIELD_CLASS);
      expect(screen.getByLabelText("Your role *")).toHaveAttribute("class", ORIGINAL_FIELD_CLASS);
      expect(screen.getByLabelText("Scope and notes *")).toHaveAttribute("class", ORIGINAL_FIELD_CLASS);
      expect(screen.getByRole("group", { name: "About you" })).toHaveAttribute("class", ORIGINAL_FIELDSET_CLASS);
      expect(screen.getByRole("group", { name: "The project" })).toHaveAttribute("class", ORIGINAL_FIELDSET_CLASS);
    });
  });

  describe("before the page's script runs", () => {
    it("renders a static form that cannot be sent and would never put details in the address", () => {
      // Arrange
      const container = document.createElement("div");

      // Act
      container.innerHTML = renderToString(createElement(QuoteForm));

      // Assert
      expect(container.querySelector("form")).toHaveAttribute("method", "post");
      expect(within(container).getByRole("button", { name: "Send Request" })).toBeDisabled();
    });

    it("enables Send once the script is running", () => {
      renderQuoteForm();

      expect(getSendButton()).toBeEnabled();
    });
  });

  describe("sending a Quote Request", () => {
    it("emails the details and the Drawings through FormSubmit, then thanks the visitor with a reference", async () => {
      // Arrange: Drawings travel on FormSubmit's ordinary endpoint, which answers with a web page
      fetchSpy().mockImplementation(async () => htmlResponse(SUCCESS_PAGE));
      const user = renderQuoteForm();
      await fillRequiredFields(user);
      await user.type(screen.getByLabelText("Company"), "Lovelace Interiors");
      await user.type(screen.getByLabelText("Phone / WhatsApp"), "+971 50 000 0000");
      await user.type(screen.getByLabelText("Link to larger drawings"), "https://drive.google.com/drive/folders/abc123");
      await user.upload(getDrawingsInput(), [makePdf("plan.pdf", 2048), makePdf("boq.pdf", 4096)]);
      await screen.findByRole("button", { name: "Remove boq.pdf" });

      // Act
      await user.click(getSendButton());

      // Assert
      expect(await screen.findByText("Thank You")).toBeVisible();
      expect(fetchSpy()).toHaveBeenCalledOnce();
      expect(fetchSpy().mock.calls[0][0]).toBe(PAGE_ENDPOINT);
      const body = sentBody(fetchSpy());
      expect(body.get("Full name")).toBe("Ada Lovelace");
      expect(body.get("Company")).toBe("Lovelace Interiors");
      expect(body.get("Email")).toBe("ada@example.com");
      expect(body.get("Phone")).toBe("+971 50 000 0000");
      expect(body.get("Role")).toBe("Architect / designer");
      expect(body.get("Project type")).toBe("Residences");
      expect(body.get("Site location")).toBe("Dubai, UAE");
      expect(body.get("Timeline")).toBe("Start within 3 months");
      expect(body.get("Scope and notes")).toBe("Walnut wardrobes for twelve villas.");
      expect(body.get("Drawings link")).toBe("https://drive.google.com/drive/folders/abc123");
      expect(body.get("Attached drawings")).toBe("Expect 2 PDFs attached: plan.pdf (2 KB); boq.pdf (4 KB)");
      expect(String(body.get("_subject")).endsWith("[2 PDFs]")).toBe(true);
      expect((body.get("attachment") as File).name).toBe("plan.pdf");
      expect((body.get("attachment2") as File).name).toBe("boq.pdf");
    });

    it("disables the whole form, says Sending, and announces it politely while the request is in flight", async () => {
      // Arrange
      const gate = deferred<Response>();
      fetchSpy().mockImplementation(() => gate.promise);
      const user = renderQuoteForm();
      await fillRequiredFields(user);

      // Act
      await user.click(getSendButton());

      // Assert
      const sending = await screen.findByRole("button", { name: "Sending…" });
      expect(sending).toBeDisabled();
      expect(screen.getByLabelText("Full name *")).toBeDisabled();
      expect(getDrawingsInput()).toBeDisabled();
      expect(statusTexts()).toContain("Sending…");
      gate.resolve(successResponse());
      expect(await screen.findByText("Thank You")).toBeVisible();
    });

    it("sends only once when the form is submitted twice before it has re-rendered", async () => {
      // Arrange
      const gate = deferred<Response>();
      fetchSpy().mockImplementation(() => gate.promise);
      const user = renderQuoteForm();
      await fillRequiredFields(user);
      const form = getSendButton().closest("form");
      if (form === null) throw new Error("Expected the Send button to be inside the form");

      // Act
      fireEvent.submit(form);
      fireEvent.submit(form);

      // Assert: the second submit changed nothing while the first is in flight
      await waitFor(() => expect(fetchSpy()).toHaveBeenCalledOnce());
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(getSendButton()).toHaveTextContent("Sending…");
      expect(getSendButton()).toBeDisabled();
      gate.resolve(successResponse());
      expect(await screen.findByText("Thank You")).toBeVisible();
      expect(fetchSpy()).toHaveBeenCalledOnce();
    });

    it("does not send an empty form, because the browser's required checks stop it", async () => {
      // Arrange
      const user = renderQuoteForm();

      // Act
      await user.click(getSendButton());

      // Assert
      expect(fetchSpy()).not.toHaveBeenCalled();
      expect(screen.queryByText("Thank You")).not.toBeInTheDocument();
    });

    it("rejects a name made only of spaces, which the browser's required check lets through", async () => {
      // Arrange
      const user = renderQuoteForm();
      await fillRequiredFields(user);
      await user.clear(screen.getByLabelText("Full name *"));
      await user.type(screen.getByLabelText("Full name *"), "   ");

      // Act
      await user.click(getSendButton());

      // Assert
      expect(await screen.findByRole("alert")).toHaveTextContent("Please enter your full name.");
      expect(fetchSpy()).not.toHaveBeenCalled();
    });

    it.each([
      ["a script address", "javascript:alert(1)"],
      ["an unencrypted address", "http://drive.example.com/plans"],
    ])("rejects a drawings link that is %s", async (_label, link) => {
      // Arrange
      const user = renderQuoteForm();
      await fillRequiredFields(user);
      await user.type(screen.getByLabelText("Link to larger drawings"), link);

      // Act
      await user.click(getSendButton());

      // Assert
      expect(await screen.findByRole("alert")).toHaveTextContent("Please enter a link that starts with https://.");
      expect(fetchSpy()).not.toHaveBeenCalled();
    });
  });
});
