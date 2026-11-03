/**
 * What the pages say about Numa that nothing in the repository backs: that it ships to US job sites,
 * supports installers around the clock, answers within two business days and so on. Only the owner can
 * confirm them, so each one is a launch blocker (`claimBlockers`, collected by src/content/readiness.ts)
 * and the launch guard keeps the site out of search engines while any is listed.
 *
 * An entry is removed ONLY on the owner's word, in the commit that records the answer: a yes deletes
 * the entry, a no changes or removes the sentence on the page and then deletes the entry. Never delete
 * one to get the guard to pass. Before the page says anything new about Numa that the repository does
 * not already state (a lead time, a port, a certification, a warranty length, a US project), add its
 * entry here first. src/content/claims.test.ts checks that each entry's words are still on the page and
 * that the owner pack (docs/seo/owner-input-pack.md, Part 3) asks about it.
 */

/** A sentence the owner has not confirmed: `id` is its name in the launch guard's list, `where` the file (first) and part of the page that says it, `claim` the exact words. */
export type UnconfirmedClaim = Readonly<{ id: string; where: string; claim: string }>;

export const unconfirmedClaims: readonly UnconfirmedClaim[] = [
  { id: "claims.usShipping", where: "src/content/pages.ts: home.heroSub (the first screen)", claim: "Shipped to US job sites" },
  {
    id: "claims.positioning",
    where: "src/content/pages.ts: home.heroTitle (the first screen); the home title and description in src/content/seo.ts and site.description say it too",
    claim: "Built for US projects.",
  },
  { id: "claims.fireRatedDoors", where: "src/content/pages.ts: capabilities, Doors & Openings", claim: "Fire-rated doors" },
  {
    id: "claims.support247",
    where: "src/content/pages.ts: process, Installation & Handover",
    claim: "We provide 24/7 support to your local install team until installation is complete.",
  },
  { id: "claims.warrantyPeriod", where: "src/content/pages.ts: delivery.points, After care", claim: "a warranty period on every project" },
  {
    id: "claims.companyHistory",
    where: "src/content/pages.ts: about.lead; the About description in src/content/seo.ts says \"family enterprise\" too",
    claim: "a family enterprise with decades of experience in contracting, development and hospitality",
  },
  {
    id: "claims.responseTime",
    where: "src/app/contact/page.tsx: What happens next; the Thank You panel (src/components/quote-form/QuoteSuccess.tsx) and the Contact description in src/content/seo.ts say it too",
    claim: "We review your scope within two business days.",
  },
  {
    id: "claims.portalInvites",
    where: "src/components/LoginForm.tsx: the notice above the sign-in fields",
    claim: "Project teams will be invited by email when their project starts.",
  },
  {
    id: "claims.portalOpening",
    where: "src/components/LoginForm.tsx: the notice above the sign-in fields; the Contact, Process, About and Login pages say it too",
    claim: "The client portal opens soon.",
  },
  {
    id: "claims.pdfAttachments",
    where: "src/app/contact/page.tsx: the lead (a visitor's PDFs reach the inbox only if the live PDF test, README Going live step 7, passes)",
    claim: "Attach drawings as PDFs, or paste a link to larger files.",
  },
  {
    id: "claims.worldwideDelivery",
    where: "src/content/seo.ts: the About description; src/content/pages.ts (home.intro, about.lead) and site.tagline say it too",
    claim: "delivered worldwide",
  },
  { id: "claims.seaFreight", where: "src/content/pages.ts: delivery.points, Freight", claim: "Sea freight through established logistics partners, with tracking shared with you." },
  { id: "claims.factoryMachining", where: "src/content/pages.ts: factory.zones, Machining", claim: "Panel saws, edgebanders and boring machines for repeatable precision." },
  { id: "claims.factoryVeneer", where: "src/content/pages.ts: factory.zones, Veneer", claim: "Veneer selection, laying and hot pressing onto panels." },
  { id: "claims.factoryFinishing", where: "src/content/pages.ts: factory.zones, Finishing", claim: "Spray booths for lacquer and paint finishes, matched to approved samples." },
];

/** One sentence for each claim still waiting for the owner; empty once every entry is deleted. */
export function claimBlockers(claims: readonly UnconfirmedClaim[] = unconfirmedClaims): readonly string[] {
  return claims.map((claim) => `${claim.id} needs the owner's word: the pages say "${claim.claim}" (${claim.where})`);
}
