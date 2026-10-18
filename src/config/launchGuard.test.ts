/**
 * Launch guard: fails `npm test` (and so the deploy workflow) if the site is made indexable while it
 * still carries placeholder or sample content: the placeholder contact details in src/config/site.ts,
 * the "Preview" ribbon (`showSampleNotice`), a project in src/content/projects.ts marked `sample: true`,
 * or anything the content modules still list as not ready. That last part comes from one place,
 * `contentBlockers()` in src/content/readiness.ts: invented figures named in `sampleContent`, company
 * facts not yet supplied (src/content/company.ts) and legal drafts waiting for a lawyer
 * (src/content/legal.ts). A module with blockers of its own registers them there, not here.
 */
import { describe, expect, it } from "vitest";
import { isIndexable, showSampleNotice, site } from "@/config/site";
import { EMPTY_COMPANY_FACTS, LISTED_CLAIMS, LISTED_FIGURES, PENDING_LEGAL_DRAFTS } from "@/content/blockerFixtures";
import { claimBlockers } from "@/content/claims";
import { companyFactsBlockers } from "@/content/company";
import { legalDraftBlockers } from "@/content/legal";
import { projects } from "@/content/projects";
import { contentBlockers, sampleContentBlockers } from "@/content/readiness";
import type { ShowcaseProject } from "@/lib/types";

type ContactField = "email" | "phone" | "whatsapp" | "address";
type ContactDetails = Readonly<Record<ContactField, string>>;
type ProjectFlags = Readonly<Pick<ShowcaseProject, "slug" | "sample">>;

/** What the guard looks at: the search-engine switch, and everything that must be real before it is on. */
type LaunchState = Readonly<{
  isIndexable: boolean;
  contact: ContactDetails;
  showSampleNotice: boolean;
  projects: readonly ProjectFlags[];
  /** What the content modules still list as not ready (src/content/readiness.ts). */
  contentBlockers: readonly string[];
}>;

/** The made-up contact details the site shipped with (marked TODO(Ramya) in src/config/site.ts). */
const PLACEHOLDER_CONTACT: ContactDetails = {
  email: "projects@numaliving.com",
  phone: "+971 4 000 0000",
  whatsapp: "971400000000",
  address: "Factory address, Dubai, UAE",
};

const CONTACT_FIELDS: readonly ContactField[] = ["email", "phone", "whatsapp", "address"];

/** Example real details for the tests of the guard itself. */
const REAL_CONTACT: ContactDetails = {
  email: "enquiries@example.com",
  phone: "+61 2 5550 0100",
  whatsapp: "61255500100",
  address: "1 Example Street, Sydney NSW 2000, Australia",
};

/** A site that is ready for search engines, for the tests of the guard itself. */
const READY_STATE: LaunchState = {
  isIndexable: true,
  contact: REAL_CONTACT,
  showSampleNotice: false,
  projects: [{ slug: "real-villa" }, { slug: "real-office", sample: false }],
  // No content module has a blocker.
  contentBlockers: contentBlockers([]),
};

/**
 * What the content modules list while nothing is ready, for the tests of the guard itself: the real
 * sources, fed with fixtures. The guard's own tests never read the live content (the owner clears it
 * for real), only the first test below does, because that one is the guard.
 */
const OPEN_CONTENT_BLOCKERS = contentBlockers([
  () => sampleContentBlockers(LISTED_FIGURES),
  () => companyFactsBlockers(EMPTY_COMPANY_FACTS),
  () => legalDraftBlockers(PENDING_LEGAL_DRAFTS),
  () => claimBlockers(LISTED_CLAIMS),
]);

/** The words of the ribbon that showSampleNotice switches on (src/components/Chrome.tsx). */
const SAMPLE_RIBBON_TEXT = "Preview: projects, figures and photos on this site are sample content.";

function contactBlockers(contact: ContactDetails): readonly string[] {
  return CONTACT_FIELDS.filter((field) => contact[field] === PLACEHOLDER_CONTACT[field]).map(
    (field) => `site.contact.${field} is still ${JSON.stringify(contact[field])}`,
  );
}

function previewBlockers(state: LaunchState): readonly string[] {
  const ribbon = state.showSampleNotice
    ? [`showSampleNotice is still true in src/config/site.ts, so every page says ${JSON.stringify(SAMPLE_RIBBON_TEXT)}`]
    : [];
  const sampleProjects = state.projects
    .filter((project) => project.sample === true)
    .map((project) => `project ${JSON.stringify(project.slug)} in src/content/projects.ts is still marked sample: true`);
  return [...ribbon, ...sampleProjects];
}

/** Everything that still blocks indexing; nothing while the site is not indexable. */
function launchBlockers(state: LaunchState): readonly string[] {
  if (!state.isIndexable) return [];
  return [...contactBlockers(state.contact), ...previewBlockers(state), ...state.contentBlockers];
}

function launchGuardMessage(blockers: readonly string[]): string {
  return [
    "isIndexable is true in src/config/site.ts, so search engines may list the site, but it still has placeholder or sample content:",
    ...blockers.map((blocker) => `  - ${blocker}`),
    "To fix it: put Numa's real email address, phone number, WhatsApp number (digits only) and factory address in `site.contact` in src/config/site.ts (marked TODO(Ramya)); replace each project marked `sample: true` in src/content/projects.ts with a real one, or remove it; replace each invented figure or placeholder photo listed in `sampleContent` in src/content/pages.ts with a real one, then delete its entry; fill in each company fact in src/content/company.ts; have a lawyer review the privacy notice and the terms, then delete their entries in `legalDrafts` in src/content/legal.ts; ask the owner about each claim in `unconfirmedClaims` in src/content/claims.ts, then delete its entry; set showSampleNotice to false in src/config/site.ts; or set isIndexable back to false until all of that is ready.",
  ].join("\n");
}

describe("launch guard", () => {
  it("keeps the site out of search engines until its placeholder and sample content is replaced", () => {
    // Arrange
    const state: LaunchState = { isIndexable, contact: site.contact, showSampleNotice, projects, contentBlockers: contentBlockers() };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers, launchGuardMessage(blockers)).toEqual([]);
  });
});

describe("launchBlockers", () => {
  it("names every placeholder detail when the site is indexable", () => {
    // Arrange
    const state: LaunchState = { ...READY_STATE, contact: PLACEHOLDER_CONTACT };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toEqual([
      'site.contact.email is still "projects@numaliving.com"',
      'site.contact.phone is still "+971 4 000 0000"',
      'site.contact.whatsapp is still "971400000000"',
      'site.contact.address is still "Factory address, Dubai, UAE"',
    ]);
  });

  it("names only the details that are still placeholders", () => {
    // Arrange
    const state: LaunchState = { ...READY_STATE, contact: { ...REAL_CONTACT, phone: PLACEHOLDER_CONTACT.phone } };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toEqual(['site.contact.phone is still "+971 4 000 0000"']);
  });

  it("names the sample-content ribbon when the site is indexable while it is still on", () => {
    // Arrange
    const state: LaunchState = { ...READY_STATE, showSampleNotice: true };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toEqual([
      'showSampleNotice is still true in src/config/site.ts, so every page says "Preview: projects, figures and photos on this site are sample content."',
    ]);
  });

  it("names every project still marked as sample content when the site is indexable", () => {
    // Arrange
    const state: LaunchState = {
      ...READY_STATE,
      projects: [{ slug: "marina-villa", sample: true }, { slug: "real-office" }, { slug: "sonate", sample: true }],
    };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toEqual([
      'project "marina-villa" in src/content/projects.ts is still marked sample: true',
      'project "sonate" in src/content/projects.ts is still marked sample: true',
    ]);
  });

  it("names every invented figure still listed in sampleContent when the site is indexable", () => {
    // Arrange
    const state: LaunchState = { ...READY_STATE, contentBlockers: sampleContentBlockers(LISTED_FIGURES) };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toEqual([
      '"home.stats" is still listed in sampleContent in src/content/pages.ts, so the site shows sample content (src/content/pages.ts: home.stats (projects delivered, countries, factory floor, staff))',
      '"factory.facts" is still listed in sampleContent in src/content/pages.ts, so the site shows sample content (src/content/pages.ts: factory.facts (production floor, machines))',
    ]);
  });

  it("blocks on a single listed figure, whatever else is real", () => {
    // Arrange
    const state: LaunchState = { ...READY_STATE, contentBlockers: sampleContentBlockers([LISTED_FIGURES[0]]) };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toHaveLength(1);
  });

  it("reports every kind of blocker together, so the owner sees the whole list at once", () => {
    // Arrange
    const state: LaunchState = {
      isIndexable: true,
      contact: PLACEHOLDER_CONTACT,
      showSampleNotice: true,
      projects: [{ slug: "marina-villa", sample: true }],
      contentBlockers: sampleContentBlockers(LISTED_FIGURES),
    };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toHaveLength(4 + 1 + 1 + 2);
  });

  it("lets the site be indexed once every detail is real and no sample content is left", () => {
    // Arrange
    const state = READY_STATE;

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toEqual([]);
  });

  it("allows placeholders and sample content while the site is not indexable", () => {
    // Arrange
    const state: LaunchState = {
      isIndexable: false,
      contact: PLACEHOLDER_CONTACT,
      showSampleNotice: true,
      projects: [{ slug: "marina-villa", sample: true }],
      contentBlockers: OPEN_CONTENT_BLOCKERS,
    };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(OPEN_CONTENT_BLOCKERS.length).toBeGreaterThan(0);
    expect(blockers).toEqual([]);
  });

  it("tells the owner what to replace, and where", () => {
    // Arrange
    const blockers = launchBlockers({
      ...READY_STATE,
      contact: PLACEHOLDER_CONTACT,
      showSampleNotice: true,
      projects: [{ slug: "marina-villa", sample: true }],
    });

    // Act
    const message = launchGuardMessage(blockers);

    // Assert
    expect(message).toContain('site.contact.email is still "projects@numaliving.com"');
    expect(message).toContain('project "marina-villa" in src/content/projects.ts is still marked sample: true');
    expect(message).toContain("set showSampleNotice to false in src/config/site.ts");
    expect(message).toContain("src/content/projects.ts");
    expect(message).toContain("or set isIndexable back to false");
  });

  it("names the company facts and the legal drafts that are still open, from the one list the content modules keep", () => {
    // Arrange
    const state: LaunchState = { ...READY_STATE, contentBlockers: OPEN_CONTENT_BLOCKERS };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toContain("legal.privacy needs legal review");
    expect(blockers).toContain("legal.terms needs legal review");
    expect(blockers.filter((blocker) => blocker.startsWith("company fact"))).toHaveLength(7);
    expect(blockers).toEqual(OPEN_CONTENT_BLOCKERS);
  });

  it("names every claim the owner has not confirmed when the site is indexable, whatever else is real", () => {
    // Arrange
    const state: LaunchState = { ...READY_STATE, contentBlockers: contentBlockers([() => claimBlockers(LISTED_CLAIMS)]) };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toHaveLength(2);
    expect(blockers[0]).toContain("claims.usShipping");
    expect(blockers[1]).toContain("claims.fireRatedDoors");
  });

  it("takes in the blockers a module registers later, with no change to the guard", () => {
    // Arrange
    const registered = contentBlockers([() => ["guides.cost needs the sales interview"]]);
    const state: LaunchState = { ...READY_STATE, contentBlockers: registered };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toEqual(["guides.cost needs the sales interview"]);
  });

  it("tells the owner where the company facts, the legal drafts and the claims are cleared", () => {
    // Arrange
    const blockers = launchBlockers({ ...READY_STATE, contentBlockers: OPEN_CONTENT_BLOCKERS });

    // Act
    const message = launchGuardMessage(blockers);

    // Assert
    expect(message).toContain("fill in each company fact in src/content/company.ts");
    expect(message).toContain("delete their entries in `legalDrafts` in src/content/legal.ts");
    expect(message).toContain("ask the owner about each claim in `unconfirmedClaims` in src/content/claims.ts, then delete its entry");
  });

  it("tells the owner how to clear a listed figure: replace it, then delete its entry", () => {
    // Arrange
    const blockers = launchBlockers({ ...READY_STATE, contentBlockers: sampleContentBlockers(LISTED_FIGURES) });

    // Act
    const message = launchGuardMessage(blockers);

    // Assert
    expect(message).toContain('"home.stats" is still listed in sampleContent in src/content/pages.ts');
    expect(message).toContain("replace each invented figure or placeholder photo listed in `sampleContent` in src/content/pages.ts with a real one, then delete its entry");
  });
});
