/**
 * Small text helpers for values that end up in an email subject, an email
 * table or an error message, where a stray line break or invisible
 * character could confuse a reader or a mail header.
 */

const ELLIPSIS = "...";
const WHITESPACE_RUN = /\s+/g;
// Control characters (Cc) and invisible formatting characters (Cf), such as
// zero-width spaces and the right-to-left override used to disguise file names.
const CONTROL_AND_FORMAT_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;

/**
 * Collapses all whitespace (line breaks and tabs included) to single spaces,
 * removes control and invisible formatting characters, and trims the ends.
 */
export function toSingleLine(text: string): string {
  return text
    .replace(WHITESPACE_RUN, " ")
    .replace(CONTROL_AND_FORMAT_CHARACTERS, "")
    .replace(WHITESPACE_RUN, " ")
    .trim();
}

/** Shortens text to at most `maxLength` characters, ending in "...". Never splits an emoji. */
export function truncate(text: string, maxLength: number): string {
  const characters = Array.from(text);
  if (characters.length <= maxLength) return text;
  if (maxLength <= ELLIPSIS.length) return ELLIPSIS.slice(0, Math.max(0, maxLength));
  return `${characters.slice(0, maxLength - ELLIPSIS.length).join("")}${ELLIPSIS}`;
}
