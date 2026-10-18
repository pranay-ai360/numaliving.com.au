/**
 * The privacy notice and the website terms (pages /privacy and /terms) are drafts: written from what
 * the site actually does, not reviewed by a lawyer. While an entry is in `legalDrafts` the launch guard
 * (src/content/readiness.ts, src/config/launchGuard.test.ts) keeps the site out of search engines.
 * After a lawyer has reviewed a page, delete its entry here.
 */

/** The day the drafts were last written: shown on both pages ("Last updated October 18, 2026"), and as a machine-readable date in their markup. */
export const LEGAL_LAST_UPDATED = { iso: "2026-10-18", text: "October 18, 2026" } as const;

/** A draft page that still needs a lawyer: `id` is its name in the launch guard's list, `page` its path. */
export type LegalDraft = Readonly<{ id: string; page: string }>;

export const legalDrafts: readonly LegalDraft[] = [
  { id: "legal.privacy", page: "/privacy" },
  { id: "legal.terms", page: "/terms" },
];

/** One sentence for each draft still waiting for legal review; empty once every entry is deleted. */
export function legalDraftBlockers(drafts: readonly LegalDraft[] = legalDrafts): readonly string[] {
  return drafts.map((draft) => `${draft.id} needs legal review`);
}
