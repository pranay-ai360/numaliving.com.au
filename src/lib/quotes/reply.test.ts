import { describe, expect, it } from "vitest";
import { sendFailureMessage } from "./messages";
import { judgeReply, type Reply } from "./reply";

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
