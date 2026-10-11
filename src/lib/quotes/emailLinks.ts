/**
 * mailto: links to Numa's contact email, for a visitor who could not send
 * the form or is still waiting for a reply.
 */
import { site } from "@/config/site";
import type { SendFailureReason } from "@/lib/types";

/**
 * The short code put in the subject of an "Email us instead" message, so Numa
 * can see what went wrong without the visitor having to explain it.
 */
export type FallbackReason = SendFailureReason | "unexpected";

const SUBJECT = "Quote Request";

function mailtoContact(subject: string): string {
  return `mailto:${site.contact.email}?subject=${encodeURIComponent(subject)}`;
}

/** For example a subject of "Quote Request (website error: rejected)". */
export function fallbackEmailHref(reason: FallbackReason): string {
  return mailtoContact(`${SUBJECT} (website error: ${reason})`);
}

/** For a visitor following up on a sent request: the subject quotes its reference. */
export function followUpEmailHref(reference: string): string {
  return mailtoContact(`${SUBJECT} ${reference}`);
}
