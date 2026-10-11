/** Settings and wording shared by the parts of the Quote Request form. */

/** Name of the hidden honeypot input. FormSubmit uses the same name for its own honeypot. */
export const HONEYPOT_FIELD_NAME = "_honey";

/**
 * A Send pressed sooner than this after the form appears is too quick to be a
 * person who has read it. The visitor is asked to review and send again.
 */
export const MIN_FILL_TIME_MS = 2000;

export const REVIEW_MESSAGE = "Please take a moment to review your details, then send again.";

/** What the Send button shows, and screen readers hear, while a request is in flight. */
export const SENDING_TEXT = "Sending…";

export const PRIVACY_NOTE =
  "Your details and drawings are sent to Numa Living by email through FormSubmit.co and used only to reply to your enquiry.";
