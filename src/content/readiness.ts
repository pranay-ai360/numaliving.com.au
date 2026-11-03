/**
 * The one list of what still blocks the site from search engines on the content side: invented
 * figures, owner facts not yet supplied, legal drafts waiting for a lawyer, claims the owner has not
 * confirmed. The launch guard
 * (src/config/launchGuard.test.ts) reads `contentBlockers()` and nothing else from here, so a module
 * with its own blockers adds one line to `BLOCKER_SOURCES` below and never touches the guard.
 *
 * A source is a function that returns one plain sentence for each thing in its part of the content
 * that is not ready, and an empty list when that part is ready (the examples are `companyFactsBlockers`
 * in src/content/company.ts, `legalDraftBlockers` in src/content/legal.ts and `claimBlockers` in
 * src/content/claims.ts).
 */
import { claimBlockers } from "@/content/claims";
import { companyFactsBlockers } from "@/content/company";
import { legalDraftBlockers } from "@/content/legal";
import { sampleContent, type SampleContent } from "@/content/pages";

/** Lists what is not ready in one part of the content; empty when it is ready. */
export type BlockerSource = () => readonly string[];

/** The invented figures, lists and placeholder photos the pages still show, from `sampleContent` in src/content/pages.ts. */
export function sampleContentBlockers(items: readonly SampleContent[] = sampleContent): readonly string[] {
  return items.map((item) => `${JSON.stringify(item.id)} is still listed in sampleContent in src/content/pages.ts, so the site shows sample content (${item.where})`);
}

/** Every part of the content that must be real before launch. Add a module's list here. */
export const BLOCKER_SOURCES: readonly BlockerSource[] = [sampleContentBlockers, companyFactsBlockers, legalDraftBlockers, claimBlockers];

/** Everything on the content side that still blocks indexing, from every source in order; empty when all of it is ready. */
export function contentBlockers(sources: readonly BlockerSource[] = BLOCKER_SOURCES): readonly string[] {
  return sources.flatMap((source) => source());
}
