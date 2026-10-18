# Treat claims the owner has not confirmed as launch blockers

The combined review of Phases 1 and 2 found that the pages state things about Numa that nothing in the repository backs ("Shipped to US job sites", "Fire-rated doors", "24/7 support", "a warranty period on every project", "We review your scope within two business days", a portal that "opens soon"). The owner pack asked about some of them, but only a document tracked them: with the contact details, company facts, sample figures and legal drafts all cleared, the launch guard went green and the claims went live. That breaks the content rule that no Numa-specific fact is written without a source.

## Decision

- **A claims register is the fourth source of `contentBlockers()`.** `unconfirmedClaims` in `src/content/claims.ts` lists each sentence as `{ id, where, claim }`, with ids `claims.*`, and `claimBlockers` turns the list into launch blockers (`src/content/readiness.ts`, ADR 0004). An entry is deleted only on the owner's word, in the commit that records the answer; a no changes or removes the sentence first. A new Numa-specific claim goes into the register before it goes on a page.
- **The register is kept honest by tests, not by memory.** `src/content/claims.test.ts` checks that each entry's exact words are still in the file it names (an edit cannot leave an entry that blocks nothing) and that the owner pack, Part 3, asks about every id.
- **The guard judges contact details by shape.** The phone and WhatsApp number need at least 7 digits and no run of four zeros (the WhatsApp number digits only, for its wa.me link), the address needs a number in it and must not be the stub, the email must not be the old placeholder (`src/lib/realContact.ts`, used by `src/config/launchGuard.test.ts`). Comparing with the exact stub strings let `+971 4 000 0001`, `971400000001`, `Factory address, Dubai, UAE.` and an empty string through.
- **The switches must be literals.** `src/config/launchGuard.test.ts` reads the text of `src/config/site.ts` and requires `export const isIndexable = true|false;` (and the same for `showSampleNotice`). A value computed from an environment variable (`process.env.NEXT_PUBLIC_INDEXABLE === "true"`) is false in the tests and can be true in the build, so the guard would pass while the deployed pages were indexable.
- **Tests of the blockers never read the live lists.** They start from the fixtures in `src/content/blockerFixtures.ts`, so clearing a real entry (deleting a legal draft, filling in a company fact, confirming a claim) needs no test edit. Only the guard's own first test reads the live list, because it is the guard.

## Considered options

- **Drop the claims from the pages now.** Rejected: most are the owner's own words from the original site or the plan's approved positioning, and the owner may well confirm them. Removing them would make the pages worse on a guess.
- **Keep tracking them in the owner pack only.** Rejected: nothing fails while a claim is open, which is how the gap appeared.
- **One flag, "claims confirmed".** Rejected: it hides which sentence is open and invites flipping it for all of them at once.

## Consequences

- The owner sees one list, each blocker naming the sentence, its file and its id, and the owner pack lists the same ids with what to confirm.
- A claim that is edited on the page must be edited in the register too, or its test fails with the file and the words.
- The count of claims is a cost: every confirmation is a small commit.
