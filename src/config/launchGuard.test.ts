/**
 * Launch guard: fails `npm test` (and so the deploy workflow) if the site is made indexable while it
 * still carries placeholder or sample content: the placeholder contact details in src/config/site.ts,
 * the "Preview" ribbon (`showSampleNotice`), or a project in src/content/projects.ts marked `sample: true`.
 */
import { describe, expect, it } from "vitest";
import { isIndexable, showSampleNotice, site } from "@/config/site";
import { projects } from "@/content/projects";
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
};

/** The words of the ribbon that showSampleNotice switches on (src/components/Chrome.tsx). */
const SAMPLE_RIBBON_TEXT = "Preview: projects, figures and photos on this site are sample content.";

function contactBlockers(contact: ContactDetails): readonly string[] {
  return CONTACT_FIELDS.filter((field) => contact[field] === PLACEHOLDER_CONTACT[field]).map(
    (field) => `site.contact.${field} is still ${JSON.stringify(contact[field])}`,
  );
}

function sampleContentBlockers(state: LaunchState): readonly string[] {
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
  return [...contactBlockers(state.contact), ...sampleContentBlockers(state)];
}

function launchGuardMessage(blockers: readonly string[]): string {
  return [
    "isIndexable is true in src/config/site.ts, so search engines may list the site, but it still has placeholder or sample content:",
    ...blockers.map((blocker) => `  - ${blocker}`),
    "To fix it: put Numa's real email address, phone number, WhatsApp number (digits only) and factory address in `site.contact` in src/config/site.ts (marked TODO(Ramya)); replace each project marked `sample: true` in src/content/projects.ts with a real one, or remove it; set showSampleNotice to false in src/config/site.ts; or set isIndexable back to false until all of that is ready.",
  ].join("\n");
}

describe("launch guard", () => {
  it("keeps the site out of search engines until its placeholder and sample content is replaced", () => {
    // Arrange
    const state: LaunchState = { isIndexable, contact: site.contact, showSampleNotice, projects };

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
    };

    // Act
    const blockers = launchBlockers(state);

    // Assert
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
});
