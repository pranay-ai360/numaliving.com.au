import { afterEach, describe, expect, it, vi } from "vitest";
import { SUCCESS_PAGE, formSubmitPage } from "./fetchFixtures";
import { sendFailureMessage } from "./messages";
import { judgePageReply, judgeReply, type Reply } from "./reply";

const REFERENCE = "NL-ABC234";
const ACTIVATION_MESSAGE =
  "This form needs Activation. We've sent you an email containing an 'Activate Form' link. Just click it and your form will be actived!";

/** An answer from FormSubmit: by default a plain "yes". */
function reply(overrides: Partial<Reply> = {}): Reply {
  return { status: 200, isOk: true, isRedirected: false, body: { success: "true" }, ...overrides };
}

describe("judgeReply", () => {
  describe("when FormSubmit says plainly that it accepted the request", () => {
    it.each([true, "true", "TRUE", "True"])("is sent, with the reference, when success is %j", (success) => {
      // Arrange
      const answer = reply({ body: { success } });

      // Act
      const result = judgeReply(answer, REFERENCE);

      // Assert
      expect(result).toEqual({ ok: true, reference: REFERENCE });
    });

    it("ignores any extra fields in the answer", () => {
      const answer = reply({ body: { success: "true", message: "Sent", extra: { nested: 1 } } });

      expect(judgeReply(answer, REFERENCE)).toEqual({ ok: true, reference: REFERENCE });
    });

    it("is not put off by a message that is not text", () => {
      expect(judgeReply(reply({ body: { success: "true", message: 42 } }), REFERENCE).ok).toBe(true);
    });

    it("trusts a plain yes even when the message mentions activation", () => {
      const answer = reply({ body: { success: "true", message: "Form activated." } });

      expect(judgeReply(answer, REFERENCE).ok).toBe(true);
    });
  });

  describe("when FormSubmit refuses the request", () => {
    it.each([false, "false", "FALSE", "False"])("reports rejected when success is %j", (success) => {
      // Arrange
      const answer = reply({ body: { success, message: "The form could not be submitted." } });

      // Act
      const result = judgeReply(answer, REFERENCE);

      // Assert
      expect(result).toEqual({
        ok: false,
        reason: "rejected",
        error: sendFailureMessage("rejected"),
        status: 200,
        serviceMessage: "The form could not be submitted.",
      });
    });

    it.each([400, 403, 404, 429, 500, 503])("reports rejected for HTTP status %d, even if the body says success", (status) => {
      // Arrange
      const answer = reply({ status, isOk: false, body: { success: "true" } });

      // Act
      const result = judgeReply(answer, REFERENCE);

      // Assert
      expect(result).toEqual({ ok: false, reason: "rejected", error: sendFailureMessage("rejected"), status });
    });

    it("reports rejected for an error status whose body is not JSON", () => {
      const answer = reply({ status: 502, isOk: false, body: undefined });

      expect(judgeReply(answer, REFERENCE)).toMatchObject({ ok: false, reason: "rejected", status: 502 });
    });
  });

  describe("when the form has not been activated yet", () => {
    it("reports not-activated when FormSubmit says no and asks for activation", () => {
      // Arrange
      const answer = reply({ body: { success: "false", message: ACTIVATION_MESSAGE } });

      // Act
      const result = judgeReply(answer, REFERENCE);

      // Assert
      expect(result).toEqual({
        ok: false,
        reason: "not-activated",
        error: sendFailureMessage("not-activated"),
        status: 200,
        serviceMessage: ACTIVATION_MESSAGE,
      });
    });

    it("reports not-activated for an error status whose message asks for activation", () => {
      const answer = reply({ status: 403, isOk: false, body: { success: "false", message: "This form needs Activation." } });

      expect(judgeReply(answer, REFERENCE)).toMatchObject({ ok: false, reason: "not-activated", status: 403 });
    });

    it("reports not-activated when the activation message comes without a success field", () => {
      const answer = reply({ body: { message: "This form needs Activation." } });

      expect(judgeReply(answer, REFERENCE)).toMatchObject({ ok: false, reason: "not-activated" });
    });
  });

  describe("when the request was too large", () => {
    it.each([
      ["an HTML page", undefined],
      ["JSON that says success", { success: "true" }],
    ])("reports too-large for HTTP 413 with %s", (_label, body) => {
      // Arrange
      const answer = reply({ status: 413, isOk: false, body });

      // Act
      const result = judgeReply(answer, REFERENCE);

      // Assert
      expect(result).toEqual({ ok: false, reason: "too-large", error: sendFailureMessage("too-large"), status: 413 });
    });
  });

  describe("when the answer is unclear, the request is never treated as sent", () => {
    it("reports invalid-response for an answer reached through a redirect, even one that says success", () => {
      // Arrange
      const answer = reply({ isRedirected: true, body: { success: "true" } });

      // Act
      const result = judgeReply(answer, REFERENCE);

      // Assert
      expect(result).toEqual({
        ok: false,
        reason: "invalid-response",
        error: sendFailureMessage("invalid-response"),
        status: 200,
      });
    });

    it.each([
      ["not JSON", undefined],
      ["null", null],
      ["an array", []],
      ["a bare string", "true"],
      ["an object without success", { ok: true }],
      ["an unknown success value", { success: "maybe" }],
      ["a padded success value", { success: " true " }],
      ["a numeric success value", { success: 1 }],
    ])("reports invalid-response when the body is %s", (_label, body) => {
      expect(judgeReply(reply({ body }), REFERENCE)).toEqual({
        ok: false,
        reason: "invalid-response",
        error: sendFailureMessage("invalid-response"),
        status: 200,
      });
    });
  });

  describe("diagnostics", () => {
    it("keeps FormSubmit's message for diagnosis but never shows it to the visitor", () => {
      // Arrange
      const answer = reply({ status: 500, isOk: false, body: { success: "false", message: "Internal Server Error" } });

      // Act
      const result = judgeReply(answer, REFERENCE);

      // Assert
      expect(result).toMatchObject({ ok: false, status: 500, serviceMessage: "Internal Server Error" });
      expect(!result.ok && result.error).not.toContain("Internal Server Error");
    });

    it("keeps the message on one line and at most 300 characters", () => {
      // Arrange
      const answer = reply({ body: { success: "false", message: `Line one\r\nLine two ${"x".repeat(400)}` } });

      // Act
      const result = judgeReply(answer, REFERENCE);

      // Assert
      if (result.ok || !("serviceMessage" in result)) throw new Error("Expected a failure with a service message");
      expect(result.serviceMessage).toHaveLength(300);
      expect(result.serviceMessage?.startsWith("Line one Line two x")).toBe(true);
    });

    it.each([
      ["blank", "  \n "],
      ["not text", { text: "nested" }],
    ])("leaves the message out when it is %s", (_label, message) => {
      const result = judgeReply(reply({ body: { success: "false", message } }), REFERENCE);

      expect(result).not.toHaveProperty("serviceMessage");
    });
  });
});


/** An answer from FormSubmit's ordinary endpoint: by default its success page. */
function pageReply(overrides: Partial<Reply> = {}): Reply {
  return { status: 200, isOk: true, isRedirected: false, body: SUCCESS_PAGE, ...overrides };
}

describe("judgePageReply", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("when FormSubmit shows its success page", () => {
    it("is sent, with the reference", () => {
      expect(judgePageReply(pageReply(), REFERENCE)).toEqual({ ok: true, reference: REFERENCE });
    });

    it("is not put off by other markup, attributes, case or spacing around the wording", () => {
      // Arrange
      const body =
        '<html><body><header><p>Menu</p></header><main><h1 class="big">\n  THANKS! </h1>' +
        "<p>The   form was SUBMITTED successfully.</p></main></body></html>";

      // Act
      const result = judgePageReply(pageReply({ body }), REFERENCE);

      // Assert
      expect(result).toEqual({ ok: true, reference: REFERENCE });
    });
  });

  describe("when the page is not the success page", () => {
    // FormSubmit could reword its success page one day, so an unrecognised page is "could not confirm" (the
    // visitor is asked to email so the enquiry can be checked), never "refused" (which invites a re-send).
    it("reports invalid-response for any other heading, keeping the page's message for diagnosis", () => {
      // Arrange
      const body = formSubmitPage("Check email address", "Email address <strong>nobody</strong> is not formatted correctly");

      // Act
      const result = judgePageReply(pageReply({ body }), REFERENCE);

      // Assert
      expect(result).toEqual({
        ok: false,
        reason: "invalid-response",
        error: sendFailureMessage("invalid-response"),
        status: 200,
        serviceMessage: "Email address nobody is not formatted correctly",
      });
    });

    it("reports invalid-response when the heading says thanks but the message does not say it was submitted", () => {
      const body = formSubmitPage("Thanks!", "We could not deliver your message.");

      expect(judgePageReply(pageReply({ body }), REFERENCE)).toMatchObject({ ok: false, reason: "invalid-response" });
    });

    it("reports invalid-response when the message says it was submitted but the heading does not say thanks", () => {
      const body = formSubmitPage("Oops", "The form was submitted successfully.");

      expect(judgePageReply(pageReply({ body }), REFERENCE)).toMatchObject({ ok: false, reason: "invalid-response" });
    });

    it.each([
      ["negated", "The form was not submitted successfully."],
      ["could not be", "The form could not be submitted successfully."],
      ["after other words", "Sorry, the form was submitted successfully (not really)."],
    ])("does not count a message that only contains the success words (%s)", (_label, message) => {
      const body = formSubmitPage("Thanks!", message);

      expect(judgePageReply(pageReply({ body }), REFERENCE)).toMatchObject({ ok: false, reason: "invalid-response" });
    });

    it("asks for activation before it believes a thanks, so a held submission is not reported as sent", () => {
      const body = formSubmitPage("Thanks!", "The form was submitted successfully. This form needs Activation: check your email.");

      expect(judgePageReply(pageReply({ body }), REFERENCE)).toMatchObject({ ok: false, reason: "not-activated" });
    });

    it("reports not-activated when the page asks for the form to be activated", () => {
      // Arrange
      const body = formSubmitPage("Activate your form", `${ACTIVATION_MESSAGE}`);

      // Act
      const result = judgePageReply(pageReply({ body }), REFERENCE);

      // Assert
      expect(result).toMatchObject({ ok: false, reason: "not-activated", status: 200 });
    });

    it("reports not-activated when only the heading asks for activation", () => {
      const body = formSubmitPage("This form needs Activation", "Please check your email.");

      expect(judgePageReply(pageReply({ body }), REFERENCE)).toMatchObject({ ok: false, reason: "not-activated" });
    });
  });

  describe("status and redirects", () => {
    it.each([400, 403, 404, 429, 500, 503])("reports rejected for HTTP status %d, even if the page says thanks", (status) => {
      const result = judgePageReply(pageReply({ status, isOk: false }), REFERENCE);

      expect(result).toMatchObject({ ok: false, reason: "rejected", status });
    });

    it("reports not-activated for an error status whose page asks for activation", () => {
      const body = formSubmitPage("Activate your form", ACTIVATION_MESSAGE);

      expect(judgePageReply(pageReply({ status: 403, isOk: false, body }), REFERENCE)).toMatchObject({
        ok: false,
        reason: "not-activated",
        status: 403,
      });
    });

    it("reports too-large for HTTP 413, whatever the page says", () => {
      const result = judgePageReply(pageReply({ status: 413, isOk: false, body: "<html>413 Request Entity Too Large</html>" }), REFERENCE);

      expect(result).toMatchObject({ ok: false, reason: "too-large", error: sendFailureMessage("too-large"), status: 413 });
    });

    it("reports invalid-response for a page reached through a redirect, even the success page", () => {
      const result = judgePageReply(pageReply({ isRedirected: true }), REFERENCE);

      expect(result).toMatchObject({ ok: false, reason: "invalid-response" });
    });
  });

  describe("when the answer is unclear, the request is never treated as sent", () => {
    it.each([
      ["no body", undefined],
      ["JSON instead of a page", { success: "true" }],
      ["an empty body", ""],
      ["only spaces", "   \n"],
      ["plain text", "OK, sent"],
      ["a page with no heading", "<html><body><p>The form was submitted successfully.</p></body></html>"],
      ["a heading that is empty", "<html><body><h1> </h1><p>The form was submitted successfully.</p></body></html>"],
    ])("reports invalid-response when the answer is %s", (_label, body) => {
      const result = judgePageReply(pageReply({ body }), REFERENCE);

      expect(result).toEqual({
        ok: false,
        reason: "invalid-response",
        error: sendFailureMessage("invalid-response"),
        status: 200,
      });
    });

    it.each([
      ["a script", '<html><body><script>var page = "<h1>Thanks!</h1><p>The form was submitted successfully.</p>";</script></body></html>'],
      ["a comment", "<html><body><!-- <h1>Thanks!</h1><p>The form was submitted successfully.</p> --></body></html>"],
      ["a template", "<html><body><template><h1>Thanks!</h1><p>The form was submitted successfully.</p></template></body></html>"],
      ["a textarea", "<html><body><textarea><h1>Thanks!</h1><p>The form was submitted successfully.</p></textarea></body></html>"],
    ])("is not fooled by a success page that only appears inside %s", (_label, body) => {
      const result = judgePageReply(pageReply({ body }), REFERENCE);

      expect(result).toMatchObject({ ok: false, reason: "invalid-response" });
    });

    it("judges by the first heading, so a later success page does not rescue an error page", () => {
      const body =
        "<html><body><h1>Check email address</h1><p>Bad address.</p><h1>Thanks!</h1><p>The form was submitted successfully.</p></body></html>";

      expect(judgePageReply(pageReply({ body }), REFERENCE)).toMatchObject({ ok: false, reason: "invalid-response" });
    });

    it("ignores anything inside <noscript>, which a parsed document treats as live markup", () => {
      const body =
        "<html><body><noscript><h1>Thanks!</h1><p>The form was submitted successfully.</p></noscript></body></html>";

      expect(judgePageReply(pageReply({ body }), REFERENCE)).toMatchObject({ ok: false, reason: "invalid-response" });
    });

    it("still finds the real heading when a <noscript> block comes first", () => {
      const body =
        "<html><body><noscript><h1>Turn on JavaScript</h1><p>Please.</p></noscript>" +
        "<h1>Thanks!</h1><p>The form was submitted successfully.</p></body></html>";

      expect(judgePageReply(pageReply({ body }), REFERENCE)).toEqual({ ok: true, reference: REFERENCE });
    });

    it("reports invalid-response, and does not throw, when the browser cannot parse the page", () => {
      // Arrange
      vi.stubGlobal(
        "DOMParser",
        class {
          parseFromString(): never {
            throw new Error("cannot parse");
          }
        },
      );

      // Act
      const result = judgePageReply(pageReply(), REFERENCE);

      // Assert
      expect(result).toMatchObject({ ok: false, reason: "invalid-response" });
    });

    it("reports invalid-response for a page far larger than any real one, even if it contains the success page", () => {
      const huge = `${SUCCESS_PAGE}<!-- ${"x".repeat(300_000)} -->`;

      expect(judgePageReply(pageReply({ body: huge }), REFERENCE)).toMatchObject({ ok: false, reason: "invalid-response" });
    });

    it("accepts a success page of a generous size", () => {
      const padded = `${SUCCESS_PAGE}<!-- ${"x".repeat(100_000)} -->`;

      expect(judgePageReply(pageReply({ body: padded }), REFERENCE)).toEqual({ ok: true, reference: REFERENCE });
    });
  });

  describe("diagnostics", () => {
    it("never shows the page's wording to the visitor", () => {
      const body = formSubmitPage("Check email address", "Email address is not formatted correctly");

      const result = judgePageReply(pageReply({ body }), REFERENCE);

      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).not.toContain("formatted");
    });

    it("keeps the message on one line and at most 300 characters", () => {
      // Arrange
      const body = formSubmitPage("Problem", `Line one\r\nLine two ${"x".repeat(400)}`);

      // Act
      const result = judgePageReply(pageReply({ body }), REFERENCE);

      // Assert
      if (result.ok || !("serviceMessage" in result)) throw new Error("Expected a failure with a service message");
      expect(result.serviceMessage).toHaveLength(300);
      expect(result.serviceMessage?.startsWith("Line one Line two x")).toBe(true);
    });

    it("falls back to the heading when the page has no paragraph", () => {
      const body = "<html><body><h1>Rate limit reached</h1></body></html>";

      const result = judgePageReply(pageReply({ body }), REFERENCE);

      expect(result).toMatchObject({ ok: false, reason: "invalid-response", serviceMessage: "Rate limit reached" });
    });
  });
});
