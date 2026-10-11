/**
 * The fields of a Quote Request, the choices its drop-downs offer and the
 * length limits of its text fields.
 *
 * This module has no Zod in it on purpose: the form renders from it, and Zod
 * only loads once the visitor starts using the form (see
 * `@/components/quote-form/loadSubmitter`). `schema.ts` builds its validation
 * from these same values, and a test keeps its fields in step with this list.
 */

/** Every field of a Quote Request, in the order the form shows them. */
export const QUOTE_REQUEST_FIELDS = [
  "name",
  "company",
  "email",
  "phone",
  "role",
  "projectType",
  "location",
  "timeline",
  "message",
  "drawingsLink",
] as const;

export type QuoteRequestField = (typeof QUOTE_REQUEST_FIELDS)[number];

export const ROLE_OPTIONS = ["Owner / developer", "Architect / designer", "Main contractor", "Other"] as const;

export const PROJECT_TYPE_OPTIONS = ["Residences", "Office", "Multifamily", "Hospitality", "Other"] as const;

export const TIMELINE_OPTIONS = [
  "Tendering now",
  "Start within 3 months",
  "Start in 3 to 6 months",
  "Later / exploring",
] as const;

/** The most characters each free-text field accepts, counted after trimming. */
export const TEXT_LIMITS = {
  name: 120,
  company: 120,
  email: 254,
  phone: 40,
  location: 160,
  message: 5000,
  drawingsLink: 500,
} as const satisfies Partial<Record<QuoteRequestField, number>>;

const FIELD_NAMES: ReadonlySet<unknown> = new Set(QUOTE_REQUEST_FIELDS);

/** True when `value` names a Quote Request field, for example the path of a validation problem. */
export function isQuoteRequestField(value: unknown): value is QuoteRequestField {
  return FIELD_NAMES.has(value);
}
