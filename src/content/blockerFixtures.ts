/**
 * Test support for the launch blockers (src/content/readiness.ts and the sources it collects).
 * Imported only by tests; nothing in the shipped site uses it.
 *
 * The tests of the blockers, the launch guard and the pages that show company facts or legal drafts
 * start from these examples, never from what the live content lists today. That way the owner can
 * clear a real entry (delete a legal draft, fill in a company fact) without a single test needing an edit.
 */
import type { UnconfirmedClaim } from "@/content/claims";
import type { CompanyFacts } from "@/content/company";
import type { LegalDraft } from "@/content/legal";
import type { SampleContent } from "@/content/pages";

/** A company that has supplied nothing yet: every fact is a blocker. */
export const EMPTY_COMPANY_FACTS: CompanyFacts = {
  legalName: null,
  foundingYear: null,
  factoryAreaSqFt: null,
  headcount: null,
  certifications: [],
  leadership: [],
  parentGroupUrl: null,
};

/** The privacy notice and the website terms, both still waiting for a lawyer. */
export const PENDING_LEGAL_DRAFTS: readonly LegalDraft[] = [
  { id: "legal.privacy", page: "/privacy" },
  { id: "legal.terms", page: "/terms" },
];

/** Invented figures, as sampleContent lists them. */
export const LISTED_FIGURES: readonly SampleContent[] = [
  { id: "home.stats", where: "src/content/pages.ts: home.stats (projects delivered, countries, factory floor, staff)" },
  { id: "factory.facts", where: "src/content/pages.ts: factory.facts (production floor, machines)" },
];

/** Two claims the pages make that the owner has not confirmed, as unconfirmedClaims lists them. */
export const LISTED_CLAIMS: readonly UnconfirmedClaim[] = [
  { id: "claims.usShipping", where: "src/content/pages.ts: home.heroSub", claim: "Shipped to US job sites" },
  { id: "claims.fireRatedDoors", where: "src/content/pages.ts: capabilities, Doors & Openings", claim: "Fire-rated doors" },
];
