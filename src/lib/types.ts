/**
 * Shared data types.
 *
 * The website uses the "Public" types today. The "Portal" types are
 * defined ahead of time so the Client Portal, which does not exist yet
 * (see CONTEXT.md), can reuse the same shapes: a showcase project on the
 * website could link to a live portal project. A Quote Request is emailed
 * to Numa and the website stores nothing, so `quoteRequestId` below only
 * matters once a back office exists. The `QuoteRequest` type itself is
 * inferred from its schema in `@/lib/quotes/schema`.
 */
import type { QuoteRequestField } from "@/lib/quotes/fields";

// ── Public website ────────────────────────────────────────────────

export type Sector = "Residences" | "Office" | "Multifamily" | "Hospitality";

/** A material finish used to draw placeholder visuals until photos exist. */
export type Material = "walnut" | "oak" | "lacquer" | "stone" | "brass" | "linen";

/** A project photo: the source JPEG under /public/projects and what is known about it. */
export interface ShowcasePhoto {
  /**
   * Root-relative path of the source JPEG, such as "/projects/golf-links/golf-links-01.jpg". The
   * AVIF and WebP copies the page actually loads sit next to it (`npm run images:build`).
   */
  src: string;
  /** What the picture shows, for people who cannot see it: 8 to 20 words, plain description, no brand claims. */
  alt: string;
  caption?: string;
  /** Who to credit, such as "Photo by Intelier". Not shown on the site yet. */
  credit?: string;
  /** The source's size in pixels. They stop the page jumping as the photo loads and decide which copies exist. */
  width: number;
  height: number;
}

export interface ShowcaseProject {
  slug: string;
  name: string;
  sector: Sector;
  city: string;
  country: string;
  year: number;
  summary: string;
  scope: string[];
  materials: string[];
  durationWeeks: number;
  /** The project's photos, the cover first. Empty = material placeholder. */
  photos: ShowcasePhoto[];
  palette: Material[];
  featured?: boolean;
  /** Marks invented sample content so it is easy to find and replace. */
  sample?: boolean;
}

/** An image for social-network link previews, 1200 x 630 pixels, in /public/og (see scripts/optimize-images.mjs). */
export type OgImage = Readonly<{
  /** Root-relative path, such as "/og/default.jpg"; the site adds its address and base path. */
  src: string;
  /** What the picture shows, for people who cannot see it. */
  alt: string;
}>;

/**
 * What search engines and social networks are told about one page: the entry for it in the page
 * registry (src/content/seo.ts), which the metadata, the sitemap and the tests all read.
 */
export type PageSeo = Readonly<{
  /** The page's path as in `site.nav`, without a trailing slash: "/about", "/projects/golf-links", "/" for Home. */
  path: string;
  /** The page title without the brand; the layout adds " | Numa Living" (see TITLE_TEMPLATE in src/lib/seo/metadata.ts). */
  title: string;
  description: string;
  /** False for a page search engines must never list, whatever `isIndexable` says (no page is marked so). */
  indexable: boolean;
  /** The day the page's content last changed in a way worth telling search engines, as YYYY-MM-DD: the sitemap's lastmod. Never "today" by code. */
  updated: string;
  /** The image a shared link shows; the site-wide default when left out. */
  ogImage?: OgImage;
}>;

/** Why a Quote Request was not sent. */
export type SubmissionFailureReason =
  /** The details or the Drawings did not pass validation, so nothing was sent. */
  | "invalid"
  /** No FormSubmit id is set for this build, so nothing was sent. */
  | "not-configured"
  /** FormSubmit has not been activated for this form yet, so nothing was delivered. */
  | "not-activated"
  /** The form service could not be reached (offline, blocked by an extension, or refused by the browser). */
  | "network"
  /** The form service did not answer in time. */
  | "timeout"
  /** The form service refused the request as too large (HTTP 413). */
  | "too-large"
  /** The form service answered with an error or refused the request. */
  | "rejected"
  /** The form service answered with something unexpected, so delivery is unconfirmed. */
  | "invalid-response";

/** Reasons that mean the details were fine but sending did not work out. */
export type SendFailureReason = Exclude<SubmissionFailureReason, "invalid">;

/** The form field a validation problem is about: a Quote Request field, or the attached Drawings. */
export type InvalidField = QuoteRequestField | "drawings";

/** The details or the Drawings did not pass validation. `error` is safe to show to the visitor. */
export type ValidationFailure = {
  ok: false;
  reason: "invalid";
  error: string;
  /** The field to mark and focus, when the problem is about one field. */
  field?: InvalidField;
};

/** Sending could not be done or did not work out. `error` is safe to show to the visitor. */
export type SendFailure = {
  ok: false;
  reason: SendFailureReason;
  error: string;
  /** Internal, for diagnosis: the HTTP status FormSubmit answered with. Never shown to the visitor. */
  status?: number;
  /** Internal, for diagnosis: FormSubmit's own message, if it sent one. Never shown raw to the visitor. */
  serviceMessage?: string;
};

export type SubmissionFailure = ValidationFailure | SendFailure;

/** What sending a Quote Request returns. */
export type SubmissionResult = { ok: true; reference: string } | SubmissionFailure;

// ── Client portal (Phase 2) — not used by the website yet ─────────

export type PortalModule =
  | "designDrawings"
  | "shopDrawings"
  | "rfis"
  | "samples"
  | "production"
  | "updates"
  | "commercials";

export type Permission = "hidden" | "view" | "act" | "approve";

/**
 * Rights are set per person, per project, per module by the client's
 * main point of contact at kick-off (the "responsibility form"),
 * not by fixed roles.
 */
export interface ProjectMember {
  userId: string;
  email: string;
  displayName: string;
  organisation: string;
  isMainContact: boolean;
  rights: Record<PortalModule, Permission>;
}

export interface PortalProject {
  id: string;
  name: string;
  /** Optional link back to the public case study once it is published. */
  showcaseSlug?: string;
  /** The quote request this project started from, if any. */
  quoteRequestId?: string;
  members: ProjectMember[];
  createdAt: string;
}
