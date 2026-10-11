/**
 * The Quote Request: what the "Request a Quote" form collects.
 *
 * This schema is the single source of truth for validation. The
 * `QuoteRequest` type is inferred from it, and `submitQuoteRequest`
 * validates against it before anything leaves the browser. The option lists
 * and length limits come from the Zod-free `./fields`, which the form renders
 * from. Text is trimmed, every string has a length cap, and blank optional
 * fields come out as `undefined`.
 */
import { z } from "zod";
import { PROJECT_TYPE_OPTIONS, ROLE_OPTIONS, TEXT_LIMITS, TIMELINE_OPTIONS } from "./fields";

// Drawings links must be encrypted: a plain http:// link would expose the drawings on the way.
const SECURE_WEB_PROTOCOL = "https:";

function blankToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

/** True when the text parses as an https:// address; a blank value counts as "no link". */
function isBlankOrSecureWebAddress(value: string): boolean {
  if (value === "") return true;
  try {
    return new URL(value).protocol === SECURE_WEB_PROTOCOL;
  } catch {
    // Not parseable as a URL at all: that is a validation failure, reported by the caller.
    return false;
  }
}

function requiredText(missing: string, tooLong: string, maxLength: number) {
  return z.string({ error: missing }).trim().min(1, missing).max(maxLength, tooLong);
}

function optionalText(maxLength: number, tooLong: string) {
  return z.string().trim().max(maxLength, tooLong).transform(blankToUndefined).optional();
}

export const quoteRequestSchema = z.object({
  name: requiredText(
    "Please enter your full name.",
    `Your name must be ${TEXT_LIMITS.name} characters or fewer.`,
    TEXT_LIMITS.name,
  ),
  company: optionalText(TEXT_LIMITS.company, `Company must be ${TEXT_LIMITS.company} characters or fewer.`),
  email: z
    .string({ error: "Please enter a valid email address." })
    .trim()
    .max(TEXT_LIMITS.email, `Your email address must be ${TEXT_LIMITS.email} characters or fewer.`)
    .pipe(z.email({ error: "Please enter a valid email address." })),
  phone: optionalText(TEXT_LIMITS.phone, `Phone must be ${TEXT_LIMITS.phone} characters or fewer.`),
  role: z.enum(ROLE_OPTIONS, { error: "Please choose your role." }),
  projectType: z.enum(PROJECT_TYPE_OPTIONS, { error: "Please choose a project type." }),
  location: requiredText(
    "Please enter the site location.",
    `The site location must be ${TEXT_LIMITS.location} characters or fewer.`,
    TEXT_LIMITS.location,
  ),
  timeline: z.enum(TIMELINE_OPTIONS, { error: "Please choose a timeline." }),
  message: requiredText(
    "Please describe the scope of the project.",
    `Your notes must be ${TEXT_LIMITS.message} characters or fewer.`,
    TEXT_LIMITS.message,
  ),
  drawingsLink: z
    .string()
    .trim()
    .max(TEXT_LIMITS.drawingsLink, `The drawings link must be ${TEXT_LIMITS.drawingsLink} characters or fewer.`)
    .refine(isBlankOrSecureWebAddress, "Please enter a link that starts with https://.")
    .transform(blankToUndefined)
    .optional(),
});

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
