/**
 * What the visitor reads when a Quote Request could not be sent.
 * Every message offers the contact email as the fallback and says nothing
 * about how the form service works.
 */
import { site } from "@/config/site";
import type { SendFailureReason } from "@/lib/types";

const EMAIL = site.contact.email;

const SEND_FAILURE_MESSAGES: Readonly<Record<SendFailureReason, string>> = {
  "not-configured": `Online requests are not available right now. Please email your details and drawings to ${EMAIL}.`,
  "not-activated": `Online requests are still being set up. Please email your details and drawings to ${EMAIL} for now.`,
  network:
    "We could not reach our form service. Please check that you are online and that no ad blocker or privacy " +
    `extension is blocking the form, then try again, or email us at ${EMAIL}.`,
  timeout: `Sending took too long, which can happen with large drawings on a slow connection. Please try again, or email us at ${EMAIL}.`,
  "too-large":
    "Your drawings were too large to send through the form. Please remove some files and paste a share link " +
    `to them instead, or email them to us at ${EMAIL}.`,
  rejected: `Our form service did not accept your request. Please try again in a few minutes, or email us at ${EMAIL}.`,
  "invalid-response": `We could not confirm that your request was received. Please email us at ${EMAIL} so we can check.`,
};

export function sendFailureMessage(reason: SendFailureReason): string {
  return SEND_FAILURE_MESSAGES[reason];
}

/** For the rare case where something other than a send failure goes wrong, so the visitor is never left waiting. */
export const UNEXPECTED_FAILURE_MESSAGE = `Something went wrong while sending your request. Please try again, or email us at ${EMAIL}.`;
