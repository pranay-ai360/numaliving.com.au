/**
 * The privacy notice and the website terms (pages /privacy and /terms) are drafts: written from what
 * the site actually does, not reviewed by a lawyer. While an entry is in `legalDrafts` the launch guard
 * (src/content/readiness.ts, src/config/launchGuard.test.ts) keeps the site out of search engines, and
 * the page says it is a draft. There is one entry for each page, waiting for a lawyer's review, and one
 * for each thing only the owner or a lawyer can settle (below the notice's text). Delete an entry only
 * once its point is settled and written into the page.
 */
import { site } from "@/config/site";

const EMAIL = site.contact.email;

/** The day the drafts were last written: shown on both pages ("Last updated October 18, 2026"), and as a machine-readable date in their markup. */
export const LEGAL_LAST_UPDATED = { iso: "2026-10-18", text: "October 18, 2026" } as const;

/**
 * A draft page that is not done: `id` is its name in the launch guard's list, `page` its path.
 * `needs` says what is still open when the entry is a point to settle ("the owner to say how long
 * Quote Requests are kept"); an entry without it only waits for a lawyer to review the whole page.
 */
export type LegalDraft = Readonly<{ id: string; page: string; needs?: string }>;

export const legalDrafts: readonly LegalDraft[] = [
  { id: "legal.privacy", page: "/privacy" },
  { id: "legal.privacy.retention", page: "/privacy", needs: "the owner to say how long Quote Requests are kept" },
  { id: "legal.privacy.rights", page: "/privacy", needs: "a lawyer to say which rights visitors have over their details and how they use them" },
  { id: "legal.privacy.jurisdictions", page: "/privacy", needs: "a lawyer to say which privacy laws apply (US states, the Australian Privacy Act, the UAE PDPL, the GDPR)" },
  { id: "legal.privacy.postalAddress", page: "/privacy", needs: "the owner's postal address" },
  { id: "legal.privacy.controller", page: "/privacy", needs: "the owner to give the legal name of the company that receives and controls the requests" },
  {
    id: "legal.privacy.notices",
    page: "/privacy",
    needs: "links to the current FormSubmit, Forward Email and GitHub privacy notices, and the name of the service that holds the mailbox the alias forwards to",
  },
  { id: "legal.terms", page: "/terms" },
];

/** One sentence for each draft still open; empty once every entry is deleted. */
export function legalDraftBlockers(drafts: readonly LegalDraft[] = legalDrafts): readonly string[] {
  return drafts.map((draft) => `${draft.id} needs ${draft.needs ?? "legal review"}`);
}

/** A section of a legal page: a heading and its paragraphs. */
export type LegalSection = Readonly<{ heading: string; paragraphs: readonly string[] }>;

/** A legal page: `id` is its name in `legalDrafts`, `path` its address on the site. */
export type LegalDocument = Readonly<{ id: string; path: string; title: string; lead: string; sections: readonly LegalSection[] }>;

/**
 * Written only from what the site does today (the form posts to FormSubmit, which emails the mailbox;
 * Forward Email forwards the mail; the site has no database or accounts; GitHub Pages hosts it; it sets
 * no cookies, which e2e/privacy.spec.ts checks). What FormSubmit, Forward Email and the mailbox do with
 * a request is theirs to say, so the page says only that they handle it under their own policies.
 *
 * Owner and lawyer supply, and so it is NOT stated on the page (each has an entry in `legalDrafts`):
 * how long quote requests are kept, the rights visitors have, which countries' privacy laws apply, the
 * legal name of the company that receives the requests, a postal address, and links to the current
 * FormSubmit, Forward Email and GitHub privacy notices. Do not add any of them without the owner's word,
 * and write no link to another site's policy until the owner has checked it is the current one.
 */
export const privacyNotice: LegalDocument = {
  id: "legal.privacy",
  path: "/privacy",
  title: "Privacy Notice",
  lead: "What happens to the details you give Numa Living on this site.",
  sections: [
    {
      heading: "What this notice covers",
      paragraphs: ["This notice describes what the website numaliving.us does with the details you give it. It covers only what the site does today."],
    },
    {
      heading: "What you send us",
      paragraphs: [
        "When you send a quote request, you give us your name and email address. You can add your company and phone number. You also tell us about the project: your role, the project type, the site location, the timeline and the scope. You can add the project size and bid date if you know them.",
        "You can attach PDF drawings to the request, or paste a link to larger files.",
      ],
    },
    {
      heading: "Where it goes",
      paragraphs: [
        `Your browser sends the request to FormSubmit, a form service, and FormSubmit emails it to our mailbox at ${EMAIL}. Forward Email forwards the mail for that address to the mailbox our team reads. The site itself keeps no copy: it has no database and no accounts. FormSubmit and the mailbox that receives the email handle what they receive under their own policies.`,
        "If you email us directly, your message goes to the same mailbox.",
        "Your IP address reaches FormSubmit when you send a request, and GitHub whenever you load a page. The team that reads the requests is in the United Arab Emirates.",
      ],
    },
    {
      heading: "How we use it",
      paragraphs: ["We use your details to reply to your inquiry and to prepare a proposal for your project."],
    },
    {
      heading: "Cookies and tracking",
      paragraphs: ["This site sets no cookies and uses no analytics or advertising tools. Its fonts, images and scripts all come from numaliving.us."],
    },
    {
      heading: "Hosting",
      paragraphs: ["GitHub Pages hosts this site. GitHub keeps its own logs of visits, under its own privacy statement."],
    },
    {
      heading: "Questions",
      paragraphs: [`Email ${EMAIL} with any question about this notice.`],
    },
  ],
};

/** Plain website terms: what the pages are, how a quote is made, where the site's responsibility ends. Nothing here creates an obligation. */
export const websiteTerms: LegalDocument = {
  id: "legal.terms",
  path: "/terms",
  title: "Website Terms",
  lead: "How this website may be used.",
  sections: [
    {
      heading: "Using this site",
      paragraphs: ["These notes cover your use of numaliving.us. They're not a contract for any project."],
    },
    {
      heading: "The information is general",
      paragraphs: [
        "The pages describe what Numa Living makes in general terms. They're not a specification, an offer or advice for your project. Sizes, materials, schedules and prices are set for each project, not by this site.",
      ],
    },
    {
      heading: "Quotes come in writing",
      paragraphs: [
        "A price or a schedule counts as a quote only when it's in a written proposal from Numa Living. Sending a quote request through the form doesn't commit you or us to anything.",
      ],
    },
    {
      heading: "Links to other sites",
      paragraphs: ["This site may link to other websites. Numa Living doesn't control them and isn't responsible for what they say or do."],
    },
    {
      heading: "Changes and questions",
      paragraphs: ["We may update these terms. The date at the top shows the latest version.", `Email ${EMAIL} with any question.`],
    },
  ],
};
