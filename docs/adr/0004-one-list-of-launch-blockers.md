# Keep what blocks launch in one list that content modules add to

The launch guard (`src/config/launchGuard.test.ts`) used to know each kind of blocker itself: placeholder contact details, the Preview ribbon, projects marked `sample: true` and the invented figures in `sampleContent`. Phase 2 of the US SEO programme adds two more kinds, the company facts only the owner can supply (`src/content/company.ts`) and the privacy and terms drafts waiting for a lawyer (`src/content/legal.ts`), and Phase 3 will add one for each new page (a guide waiting for an interview, a factory page waiting for permission to publish its photos).

## Decision

`contentBlockers()` in `src/content/readiness.ts` is the one list of what is not ready on the content side. It combines sources, each a function that returns one plain sentence for every item in its part of the content that is not ready (`sampleContentBlockers`, `companyFactsBlockers`, `legalDraftBlockers`, and since the fix round `claimBlockers`, see [ADR 0005](0005-claims-and-guard-checks.md)). The launch guard reads that list and nothing else from the content, and still checks the contact details, the ribbon and the sample projects itself. A module with blockers of its own adds one function to `BLOCKER_SOURCES`; the guard is not edited.

A fact that is missing or unusable (a zero, a link that is not https) counts as missing. To publish without a fact the owner cannot supply, delete its row in `FACT_RULES`, or its entry in `legalDrafts`; never fill it with a guess.

## Considered options

- **A registry that modules push into when they are imported.** Rejected: it is global mutable state, and the list would depend on which modules happen to be loaded.
- **The guard importing every content module.** Rejected: each new module would mean editing the guard, which is the one test that must never be loosened by accident.
- **A checklist outside the code.** Rejected: nothing would fail the build while an item is open.

## Consequences

- One place shows everything still open, and the guard's failure names each item with where to fix it.
- An entry nobody deletes blocks the launch for good. That is the point: removing a blocker is a decision, made in a commit.
- The sources are plain functions with their own tests, and `src/content/readiness.test.ts` covers the combination, including a module registering its list later.
