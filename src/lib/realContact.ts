/**
 * What counts as a real phone number, WhatsApp number and street address. One rule, used by the
 * launch guard (src/config/launchGuard.test.ts), the Contact page (src/components/ContactDetails.tsx)
 * and the structured data (src/lib/seo/jsonld.ts), so a detail that blocks the launch is also never
 * shown or published. The rules judge the shape of a value, not whether it equals the stub the site
 * shipped with: a stub with one digit changed ("+971 4 000 0001"), an empty string or a full stop
 * added to the address is still not real.
 */

/** The shortest phone number there is (a local number without an area code). */
export const MIN_PHONE_DIGITS = 7;

/** Four zeros in a row do not occur in a real number; the stubs are made of them. */
const RUN_OF_ZEROS = /0{4}/;

const NOT_A_DIGIT = /\D/g;
const DIGITS_ONLY = /^\d+$/;
const ANY_DIGIT = /\d/;

/** The words the site's stub address starts with ("Factory address, Dubai, UAE"), in any capitals. */
const STUB_ADDRESS = /^factory address\b/i;

/** At least 7 digits once spaces, brackets, dashes and the plus sign are ignored, and no run of four zeros. */
export function isRealPhoneNumber(value: string): boolean {
  const digits = value.replace(NOT_A_DIGIT, "");
  return digits.length >= MIN_PHONE_DIGITS && !RUN_OF_ZEROS.test(digits);
}

/** A real phone number written as digits only, because it goes into a wa.me link. */
export function isRealWhatsappNumber(value: string): boolean {
  return DIGITS_ONLY.test(value) && isRealPhoneNumber(value);
}

/** Not empty, not the stub and with a number in it (a street number, a plot or a postal code). */
export function isRealAddress(value: string): boolean {
  const text = value.trim();
  return text !== "" && ANY_DIGIT.test(text) && !STUB_ADDRESS.test(text);
}
