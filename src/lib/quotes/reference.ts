/**
 * Reference for a Quote Request, such as "NL-K7M2QX". The visitor sees it on
 * the confirmation, and Numa sees it in the email subject, so the two can be
 * matched up in a follow-up.
 */

const REFERENCE_PREFIX = "NL-";
const REFERENCE_LENGTH = 6;

// A to Z without I and O, plus 2 to 9: nothing that reads as another character.
// There are 32 symbols and 256 is a multiple of 32, so `byte % 32` is unbiased.
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Returns `length` random bytes. */
export type RandomBytes = (length: number) => Uint8Array;

function cryptoRandomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}

export function createReference(randomBytes: RandomBytes = cryptoRandomBytes): string {
  const characters = Array.from(
    randomBytes(REFERENCE_LENGTH),
    (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length],
  );
  return `${REFERENCE_PREFIX}${characters.join("")}`;
}
