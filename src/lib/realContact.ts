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

/**
 * A postal address in parts, as schema.org writes it. The Contact page shows the parts and the
 * structured data publishes them exactly as written here, so what search engines read is what a
 * visitor sees. `country` is a name ("United Arab Emirates") or a two-letter code ("AE").
 */
export type PostalAddress = Readonly<{ street: string; locality: string; region?: string; postalCode?: string; country: string }>;

/** The contact details the Contact page shows: `site.contact` in src/config/site.ts. The hours and the time zone are optional (null until the owner supplies them). */
export type ContactInfo = Readonly<{
  email: string;
  phone: string;
  /** Digits only, because it goes into a wa.me link. */
  whatsapp: string;
  address: PostalAddress;
  hours: string | null;
  timezone: string | null;
}>;

function isFilled(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== "";
}

/** Not empty, not the stub and with a number in it (a street number or a plot). */
export function isRealStreet(value: string): boolean {
  const text = value.trim();
  return text !== "" && ANY_DIGIT.test(text) && !STUB_ADDRESS.test(text);
}

/** A real street, and a city and a country: the region and the postal code are optional. */
export function isRealAddress(address: PostalAddress): boolean {
  return isRealStreet(address.street) && isFilled(address.locality) && isFilled(address.country);
}

/** The address on one line: "1 Example Street, Austin, TX 78701, United States"; a part that is blank is left out. */
export function formatAddress(address: PostalAddress): string {
  const place = [address.locality, address.region].filter(isFilled).join(", ");
  const city = isFilled(address.postalCode) ? `${place} ${address.postalCode}` : place;
  return [address.street, city, address.country].filter(isFilled).join(", ");
}
