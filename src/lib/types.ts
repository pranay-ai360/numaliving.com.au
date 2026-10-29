/**
 * Shared data types.
 *
 * The website uses the "Public" types today. The "Portal" types are
 * defined now so the client portal (Phase 2) plugs into the same
 * shapes: a showcase project on the website can later link to a live
 * portal project, and a quote request can be converted into one.
 */

// ── Public website ────────────────────────────────────────────────

export type Sector = "Residences" | "Office" | "Multifamily" | "Hospitality";

/** A material finish used to draw placeholder visuals until photos exist. */
export type Material = "walnut" | "oak" | "lacquer" | "stone" | "brass" | "linen";

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
  /** Photo paths under /public/projects. Empty = material placeholder. */
  images: string[];
  palette: Material[];
  featured?: boolean;
  /** Marks invented sample content so it is easy to find and replace. */
  sample?: boolean;
}

export interface QuoteRequest {
  name: string;
  company?: string;
  email: string;
  phone?: string;
  role: "Owner / developer" | "Architect / designer" | "Main contractor" | "Other";
  projectType: Sector | "Other";
  location: string;
  timeline: string;
  message: string;
}

/** What a quote submission returns, whichever backend handled it. */
export interface SubmissionResult {
  ok: boolean;
  reference?: string;
  error?: string;
  /** True when no backend is configured and nothing was stored. */
  demo?: boolean;
}

// ── Client portal (Phase 2) — not used by the website yet ─────────

export type PortalModule =
  | "designDrawings"
  | "shopDrawings"
  | "rfis"
  | "samples"
  | "production"
  | "updates"
  | "commercials"
  | "installation";

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
  /** The client admin: appointed first, assigns everyone's rights on the responsibility form. */
  isClientAdmin: boolean;
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
