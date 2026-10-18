import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import { OPEN_LEGAL_POINT, PENDING_LEGAL_DRAFTS } from "@/content/blockerFixtures";
import { LEGAL_LAST_UPDATED, legalDraftBlockers, legalDrafts, privacyNotice, websiteTerms, type LegalDocument, type LegalDraft } from "@/content/legal";
import { findUkTerms } from "@/lib/vocabulary";

/** Words and phrases the programme's style rules ban from public copy (COMMON.md, content integrity). */
const BANNED_WORDS = /\b(delve|landscape|testament|leverage|utilize|robust|seamless|furthermore|moreover|additionally|pivotal|multifaceted|harness|embark|navigate|showcase|streamline|paramount|culminate|spearhead|commence|endeavor|vibrant|innovative|comprehensive)\b/i;
const BANNED_PHRASES = /it's worth noting|in today's|let's dive in|in conclusion|plays a (crucial|vital|pivotal) role|it goes without saying|in the realm of/i;

function textOf(legal: LegalDocument): string {
  return [legal.title, legal.lead, ...legal.sections.flatMap((section) => [section.heading, ...section.paragraphs])].join("\n");
}

describe("legalDrafts", () => {
  it("names a blocker for each draft that still needs a lawyer", () => {
    // Arrange
    const drafts = PENDING_LEGAL_DRAFTS;

    // Act
    const blockers = legalDraftBlockers(drafts);

    // Assert
    expect(blockers).toEqual(["legal.privacy needs legal review", "legal.terms needs legal review"]);
  });

  it("says what is still open for an entry that has something specific to settle, not just that a lawyer must look", () => {
    // Arrange
    const drafts: readonly LegalDraft[] = [OPEN_LEGAL_POINT, { id: "legal.terms", page: "/terms" }];

    // Act
    const blockers = legalDraftBlockers(drafts);

    // Assert
    expect(blockers).toEqual(["legal.privacy.retention needs the owner to say how long Quote Requests are kept", "legal.terms needs legal review"]);
  });

  it("describes every open point in the owner pack, under the Privacy and Terms row of Part 2, id by id", () => {
    // Arrange
    const pack = readFileSync(path.join(process.cwd(), "docs/seo/owner-input-pack.md"), "utf8");
    const row = pack.split("\n").find((line) => line.startsWith("| Privacy and Terms")) ?? "";

    // Act
    const missing = legalDrafts.filter((draft) => !row.includes(draft.id));

    // Assert
    expect(row).not.toBe("");
    expect(missing.map((draft) => draft.id)).toEqual([]);
  });

  it("reads the live list by default, whatever is left in it once the owner has cleared some entries", () => {
    // Arrange
    const expected = legalDraftBlockers(legalDrafts);

    // Act
    const blockers = legalDraftBlockers();

    // Assert
    expect(blockers).toEqual(expected);
  });

  it("only ever lists a draft of one of this module's two pages, under that page's name", () => {
    // Arrange
    const documents = [privacyNotice, websiteTerms];

    // Act
    const strays = legalDrafts.filter((draft) => !documents.some((legal) => draft.page === legal.path && draft.id.startsWith(legal.id)));

    // Assert
    expect(strays).toEqual([]);
  });

  it("gives every draft an id of its own", () => {
    // Arrange
    const ids = legalDrafts.map((draft) => draft.id);

    // Act
    const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);

    // Assert
    expect(repeated).toEqual([]);
  });

  it("lists nothing once every draft has been reviewed and its entry deleted", () => {
    // Arrange
    const reviewed: readonly LegalDraft[] = [];

    // Act
    const blockers = legalDraftBlockers(reviewed);

    // Assert
    expect(blockers).toEqual([]);
  });

  it("lists only the drafts that are still waiting", () => {
    // Arrange
    const waiting: readonly LegalDraft[] = [{ id: "legal.terms", page: "/terms" }];

    // Act
    const blockers = legalDraftBlockers(waiting);

    // Assert
    expect(blockers).toEqual(["legal.terms needs legal review"]);
  });
});

describe("LEGAL_LAST_UPDATED", () => {
  it("is one day, written in US style for visitors and in ISO form for the page's markup", () => {
    // Arrange
    const { iso, text } = LEGAL_LAST_UPDATED;

    // Act
    const written = new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });

    // Assert
    expect(iso).toBe("2026-10-18");
    expect(text).toBe(written);
    expect(text).toBe("October 18, 2026");
  });
});

describe("the privacy notice", () => {
  const text = textOf(privacyNotice);

  it("is the page /privacy, and the launch guard names its draft legal.privacy", () => {
    // Arrange
    const { path, id } = privacyNotice;

    // Act
    const names = [path, id];

    // Assert
    expect(names).toEqual(["/privacy", "legal.privacy"]);
  });

  it.each([
    ["the form goes to FormSubmit, which emails the mailbox", /FormSubmit/],
    ["mail for the address is handled by Forward Email", /Forward Email/],
    ["drawings are attached or linked", /attach PDF drawings[\s\S]*paste a link/],
    ["the site keeps no copy: no database and no accounts", /no database and no accounts/],
    ["GitHub Pages hosts the site and keeps its own logs", /GitHub Pages hosts this site\. GitHub keeps its own logs/],
    ["the site sets no cookies and uses no analytics or advertising tools", /sets no cookies and uses no analytics or advertising tools/],
    ["Forward Email forwards the mail for the address to the team's mailbox", /Forward Email forwards the mail for that address/],
    ["the visitor's IP address reaches FormSubmit and GitHub", /Your IP address reaches FormSubmit when you send a request, and GitHub whenever you load a page/],
    ["the site itself keeps no copy while FormSubmit and the mailbox handle what they receive", /FormSubmit and the mailbox that receives the email handle what they receive under their own policies/],
    ["the team that reads the requests is in the United Arab Emirates", /team that reads the requests is in the United Arab Emirates/],
    ["the details are used to reply to the inquiry", /use your details to reply to your inquiry/],
  ])("says that %s", (_label, pattern) => {
    // Arrange
    // (the table supplies the pattern)

    // Act
    const found = pattern.test(text);

    // Assert
    expect(found).toBe(true);
  });

  it("gives the contact email from the site settings, never a copy of it", () => {
    // Arrange
    const email = site.contact.email;

    // Act
    const mentions = text.split(email).length - 1;

    // Assert
    expect(mentions).toBeGreaterThanOrEqual(2);
  });

  it("promises no exclusive use: the team also reads a request to prepare a bid, so \"only to reply\" is not written", () => {
    // Arrange
    const sentence = privacyNotice.sections.find((section) => section.heading === "How we use it")?.paragraphs.join(" ") ?? "";

    // Act
    const hasAbsolute = /\bonly\b/i.test(sentence);

    // Assert
    expect(sentence).not.toBe("");
    expect(hasAbsolute).toBe(false);
  });

  it("links no other site's policy: FormSubmit's current notice is an open point for the owner, not a link written here", () => {
    // Arrange
    const links = text.match(/https?:\/\/\S+|\b\S+\.(com|co|org|net)\b/gi) ?? [];

    // Act
    const others = links.filter((link) => !/numaliving\.us/.test(link));

    // Assert
    expect(others).toEqual([]);
  });

  it("states no retention period, no country's privacy law and no right: the owner has not set them", () => {
    // Arrange
    const invented = /\b(retain|retention|kept for|\d+ (days|months|years)|GDPR|CCPA|CPRA|PDPL|Privacy Act|California|European|your rights?|right to|opt out|delete your|erase|data protection|controller|processor)\b/i;

    // Act
    const found = text.match(invented)?.[0];

    // Assert
    expect(found).toBeUndefined();
  });
});

describe("the website terms", () => {
  const text = textOf(websiteTerms);

  it("is the page /terms, and the launch guard names its draft legal.terms", () => {
    // Arrange
    const { path, id } = websiteTerms;

    // Act
    const names = [path, id];

    // Assert
    expect(names).toEqual(["/terms", "legal.terms"]);
  });

  it.each([
    ["the information is general", /general terms/],
    ["a quote comes in a written proposal", /only when it's in a written proposal/],
    ["sending a request commits nobody", /doesn't commit you or us to anything/],
    ["other sites are not Numa's to answer for", /doesn't control them and isn't responsible/],
  ])("says that %s", (_label, pattern) => {
    // Arrange
    // (the table supplies the pattern)

    // Act
    const found = pattern.test(text);

    // Assert
    expect(found).toBe(true);
  });

  it("creates no obligations: no agreement, binding force, indemnity, governing law or liability clause", () => {
    // Arrange
    const obligations = /\b(you agree|agree to|binding|indemnif\w*|governing law|jurisdiction|liab\w*|shall|must|warrant\w*)\b/i;

    // Act
    const found = text.match(obligations)?.[0];

    // Assert
    expect(found).toBeUndefined();
  });
});

describe.each([
  ["privacy notice", privacyNotice],
  ["website terms", websiteTerms],
] as const)("the %s as a document", (_name, legal) => {
  const text = textOf(legal);

  it("has a heading and at least one paragraph in every section, and no heading twice", () => {
    // Arrange
    const headings = legal.sections.map((section) => section.heading);

    // Act
    const empty = legal.sections.filter((section) => section.heading.trim() === "" || section.paragraphs.length === 0 || section.paragraphs.some((paragraph) => paragraph.trim() === ""));

    // Assert
    expect(legal.sections.length).toBeGreaterThanOrEqual(4);
    expect(empty).toEqual([]);
    expect(new Set(headings).size).toBe(headings.length);
  });

  it("is written in US English", () => {
    // Arrange
    const found = findUkTerms(text).map((match) => match.match);

    // Act
    const uk = found.join(", ");

    // Assert
    expect(uk).toBe("");
  });

  it("avoids the words and phrases the style rules ban, and em dashes", () => {
    // Arrange
    const banned = [text.match(BANNED_WORDS)?.[0], text.match(BANNED_PHRASES)?.[0], text.includes("—") ? "—" : undefined];

    // Act
    const found = banned.filter((item) => item !== undefined);

    // Assert
    expect(found).toEqual([]);
  });
});
