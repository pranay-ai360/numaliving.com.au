import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import type { SendFailureReason } from "@/lib/types";
import { sendFailureMessage, UNEXPECTED_FAILURE_MESSAGE } from "./messages";

const SEND_FAILURES = [
  "not-configured",
  "not-activated",
  "network",
  "timeout",
  "too-large",
  "rejected",
  "invalid-response",
] as const satisfies readonly SendFailureReason[];

const TECHNICAL_WORDS = /formsubmit|http|json|fetch|abort|status|error code|undefined|cors|413/i;

describe("sendFailureMessage", () => {
  it.each(SEND_FAILURES)("points the visitor to the contact email when the reason is %s", (reason) => {
    // Arrange / Act
    const message = sendFailureMessage(reason);

    // Assert
    expect(message).toContain(site.contact.email);
  });

  it.each(SEND_FAILURES)("is a friendly sentence for %s, with no technical detail", (reason) => {
    // Arrange / Act
    const message = sendFailureMessage(reason);

    // Assert
    expect(message).toMatch(/^[A-Z].*\.$/);
    expect(message).not.toMatch(TECHNICAL_WORDS);
  });

  it("gives each reason its own wording", () => {
    // Arrange
    const messages = SEND_FAILURES.map((reason) => sendFailureMessage(reason));

    // Act
    const distinct = new Set(messages);

    // Assert
    expect(distinct.size).toBe(SEND_FAILURES.length);
  });

  it("tells the visitor a slow send can be retried when the request timed out", () => {
    expect(sendFailureMessage("timeout")).toMatch(/try again/i);
  });

  it("does not claim the request was received when delivery could not be confirmed", () => {
    expect(sendFailureMessage("invalid-response")).toMatch(/could not confirm/i);
  });

  it("suggests fewer files or a share link when the request was too large", () => {
    // Arrange / Act
    const message = sendFailureMessage("too-large");

    // Assert
    expect(message).toMatch(/too large/i);
    expect(message).toMatch(/remove some files/i);
    expect(message).toMatch(/share link/i);
  });

  it("says online requests are still being set up when the form is not activated yet", () => {
    expect(sendFailureMessage("not-activated")).toMatch(/still being set up/i);
  });

  it("names being offline and blocking extensions as likely causes when the service could not be reached", () => {
    // Arrange / Act
    const message = sendFailureMessage("network");

    // Assert
    expect(message).toMatch(/online/i);
    expect(message).toMatch(/ad blocker/i);
    expect(message).toMatch(/try again/i);
  });
});

describe("UNEXPECTED_FAILURE_MESSAGE", () => {
  it("points the visitor to the contact email", () => {
    expect(UNEXPECTED_FAILURE_MESSAGE).toContain(site.contact.email);
  });

  it("is a friendly sentence with no technical detail", () => {
    expect(UNEXPECTED_FAILURE_MESSAGE).toMatch(/^[A-Z].*\.$/);
    expect(UNEXPECTED_FAILURE_MESSAGE).not.toMatch(TECHNICAL_WORDS);
  });

  it("does not repeat any of the specific send-failure messages", () => {
    for (const reason of SEND_FAILURES) {
      expect(UNEXPECTED_FAILURE_MESSAGE).not.toBe(sendFailureMessage(reason));
    }
  });
});
