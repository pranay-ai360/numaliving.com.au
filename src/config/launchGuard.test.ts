/**
 * Launch guard: fails `npm test` (and so the deploy workflow) if the site is made indexable while it
 * still carries placeholder or sample content: contact details that are not real in src/config/site.ts
 * (judged by their shape, src/lib/realContact.ts, so a stub with one digit changed still blocks),
 * the "Preview" ribbon (`showSampleNotice`), a project in src/content/projects.ts marked `sample: true`,
 * or anything the content modules still list as not ready. That last part comes from one place,
 * `contentBlockers()` in src/content/readiness.ts: invented figures and placeholder photos named in
 * `sampleContent`, company facts not yet supplied (src/content/company.ts), legal drafts waiting for a
 * lawyer (src/content/legal.ts) and claims the owner has not confirmed (src/content/claims.ts). A module
 * with blockers of its own registers them there, not here. The guard also reads every published photo
 * (src/lib/photoMetadata.ts): none may still carry a camera serial number, an edit history, Lightroom
 * settings or a GPS position. That scan runs only when the site is indexable.
 *
 * The guard reads `isIndexable` and `showSampleNotice` as imported values, so a last describe block
 * requires both to be plain `true` or `false` literals in src/config/site.ts: a value computed from an
 * environment variable would be false here and could be true in the build.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isIndexable, showSampleNotice, site } from "@/config/site";
import { EMPTY_COMPANY_FACTS, LISTED_CLAIMS, LISTED_FIGURES, PENDING_LEGAL_DRAFTS } from "@/content/blockerFixtures";
import { claimBlockers } from "@/content/claims";
import { companyFactsBlockers } from "@/content/company";
import { legalDraftBlockers } from "@/content/legal";
import { projects } from "@/content/projects";
import { contentBlockers, sampleContentBlockers } from "@/content/readiness";
import { photoMetadataBlockers, scanPhotos, type PhotoFinding } from "@/lib/photoMetadata";
import { formatAddress, isRealAddress, isRealPhoneNumber, isRealWhatsappNumber, type ContactInfo } from "@/lib/realContact";
import type { ShowcaseProject } from "@/lib/types";

type ContactField = "email" | "phone" | "whatsapp" | "address";
type ContactDetails = Pick<ContactInfo, ContactField>;
type ProjectFlags = Readonly<Pick<ShowcaseProject, "slug" | "sample">>;

/** What the guard looks at: the search-engine switch, and everything that must be real before it is on. */
type LaunchState = Readonly<{
  isIndexable: boolean;
  contact: ContactDetails;
  showSampleNotice: boolean;
  projects: readonly ProjectFlags[];
  /** What the content modules still list as not ready (src/content/readiness.ts). */
  contentBlockers: readonly string[];
  /** The published photos that still carry something private (src/lib/photoMetadata.ts); empty while the site is not indexable, because nothing is scanned then. */
  photoMetadata: readonly string[];
}>;

/** The made-up contact details the site shipped with (marked TODO(Ramya) in src/config/site.ts). */
const PLACEHOLDER_CONTACT: ContactDetails = {
  email: "projects@numaliving.com",
  phone: "+971 4 000 0000",
  whatsapp: "971400000000",
  address: { street: "Factory address", locality: "Dubai", country: "UAE" },
};

const CONTACT_FIELDS: readonly ContactField[] = ["email", "phone", "whatsapp", "address"];

/** Example real details for the tests of the guard itself. */
const REAL_CONTACT: ContactDetails = {
  email: "enquiries@example.com",
  phone: "+61 2 5550 0100",
  whatsapp: "61255500100",
  address: { street: "1 Example Street", locality: "Sydney", region: "NSW", postalCode: "2000", country: "Australia" },
};

/** A site that is ready for search engines, for the tests of the guard itself. */
const READY_STATE: LaunchState = {
  isIndexable: true,
  contact: REAL_CONTACT,
  showSampleNotice: false,
  projects: [{ slug: "real-villa" }, { slug: "real-office", sample: false }],
  // No content module has a blocker.
  contentBlockers: contentBlockers([]),
  photoMetadata: [],
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

/** Photos as the scan would report them, for the tests of the guard itself. */
const DIRTY_PHOTOS: readonly PhotoFinding[] = [
  { file: "public/projects/alpha/alpha-01.jpg", findings: ["BodySerialNumber", "LensSerialNumber", "xmpMM:History", "crs: settings"] },
  { file: "public/projects/alpha/alpha-02.jpg", findings: ["xmpMM:History"] },
];

/** The words of the ribbon that showSampleNotice switches on (src/components/Chrome.tsx). */
const SAMPLE_RIBBON_TEXT = "Preview: projects, figures and photos on this site are sample content.";

const LOOKS_LIKE_AN_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** How the guard judges each contact detail, and what it tells the owner a real one looks like. */
const CONTACT_CHECKS: Readonly<Record<ContactField, { isReal: (contact: ContactDetails) => boolean; rule: string }>> = {
  email: { isReal: ({ email }) => email !== PLACEHOLDER_CONTACT.email && LOOKS_LIKE_AN_EMAIL.test(email), rule: "a real email address, not the old placeholder" },
  phone: { isReal: ({ phone }) => isRealPhoneNumber(phone), rule: "a real phone number has at least 7 digits and no run of four zeros" },
  whatsapp: { isReal: ({ whatsapp }) => isRealWhatsappNumber(whatsapp), rule: "a real WhatsApp number is digits only, at least 7 of them, with no run of four zeros" },
  address: { isReal: ({ address }) => isRealAddress(address), rule: "a real address has a street with a number in it (not the stub), a city and a country" },
};

/** A contact detail as the guard prints it: text as written, an address on one line. */
function shownValue(contact: ContactDetails, field: ContactField): string {
  return field === "address" ? formatAddress(contact.address) : contact[field];
}

function contactBlockers(contact: ContactDetails): readonly string[] {
  return CONTACT_FIELDS.filter((field) => !CONTACT_CHECKS[field].isReal(contact)).map(
    (field) => `site.contact.${field} is still ${JSON.stringify(shownValue(contact, field))}, which is not real: ${CONTACT_CHECKS[field].rule}`,
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
  return [...contactBlockers(state.contact), ...previewBlockers(state), ...state.contentBlockers, ...state.photoMetadata];
}

/** The photo blockers of the published photos under `root`; the photos are read only when the site is indexable. */
async function photoMetadataIfIndexable(isSiteIndexable: boolean, scan: () => Promise<readonly PhotoFinding[]> = () => scanPhotos(process.cwd())): Promise<readonly string[]> {
  return isSiteIndexable ? photoMetadataBlockers(await scan()) : [];
}

function launchGuardMessage(blockers: readonly string[]): string {
  return [
    "isIndexable is true in src/config/site.ts, so search engines may list the site, but it still has placeholder or sample content:",
    ...blockers.map((blocker) => `  - ${blocker}`),
    "To fix it: put Numa's real email address, phone number, WhatsApp number (digits only) and factory address in `site.contact` in src/config/site.ts (marked TODO(Ramya)); replace each project marked `sample: true` in src/content/projects.ts with a real one, or remove it; replace each invented figure or placeholder photo listed in `sampleContent` in src/content/pages.ts with a real one, then delete its entry; fill in each company fact in src/content/company.ts; strip serial numbers, edit history, camera settings and any GPS position from every published original photo under public/, keeping the orientation (`photos.metadata`); have a lawyer review the privacy notice and the terms, then delete their entries in `legalDrafts` in src/content/legal.ts; ask the owner about each claim in `unconfirmedClaims` in src/content/claims.ts, then delete its entry; set showSampleNotice to false in src/config/site.ts; or set isIndexable back to false until all of that is ready.",
  ].join("\n");
}

describe("launch guard", () => {
  it("keeps the site out of search engines until its placeholder and sample content is replaced", async () => {
    // Arrange
    const state: LaunchState = {
      isIndexable,
      contact: site.contact,
      showSampleNotice,
      projects,
      contentBlockers: contentBlockers(),
      photoMetadata: await photoMetadataIfIndexable(isIndexable),
    };

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
      'site.contact.email is still "projects@numaliving.com", which is not real: a real email address, not the old placeholder',
      'site.contact.phone is still "+971 4 000 0000", which is not real: a real phone number has at least 7 digits and no run of four zeros',
      'site.contact.whatsapp is still "971400000000", which is not real: a real WhatsApp number is digits only, at least 7 of them, with no run of four zeros',
      'site.contact.address is still "Factory address, Dubai, UAE", which is not real: a real address has a street with a number in it (not the stub), a city and a country',
    ]);
  });

  it.each([
    ["the stub phone with its last digit changed", { phone: "+971 4 000 0001" }, "phone"],
    ["the stub WhatsApp number with its last digit changed", { whatsapp: "971400000001" }, "whatsapp"],
    ["the stub street with a full stop added", { address: { street: "Factory address.", locality: "Dubai", country: "UAE" } }, "address"],
    ["the whole stub address pasted into the street", { address: { street: "Factory address, Dubai, UAE.", locality: "Dubai", country: "UAE" } }, "address"],
    ["an empty phone number", { phone: "" }, "phone"],
    ["an empty WhatsApp number", { whatsapp: "" }, "whatsapp"],
    ["an empty street", { address: { street: "", locality: "Dubai", country: "UAE" } }, "address"],
    ["an address with no city", { address: { street: "1 Example Street", locality: "", country: "UAE" } }, "address"],
    ["an address with no country", { address: { street: "1 Example Street", locality: "Dubai", country: "" } }, "address"],
    ["an empty email address", { email: "" }, "email"],
    ["a phone number of six digits", { phone: "555 014" }, "phone"],
    ["a WhatsApp number with a plus sign, which the wa.me link cannot take", { whatsapp: "+61255500100" }, "whatsapp"],
    ["a street with no number", { address: { street: "Al Quoz Industrial Area", locality: "Dubai", country: "UAE" } }, "address"],
    ["an email address without a domain", { email: "projects" }, "email"],
  ] as const)("still blocks %s", (_label, override, field) => {
    // Arrange
    const state: LaunchState = { ...READY_STATE, contact: { ...REAL_CONTACT, ...override } };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain(`site.contact.${field} is still`);
  });

  it("lets real details through, written the way people write them", () => {
    // Arrange
    const contact: ContactDetails = {
      email: "projects@numaliving.us",
      phone: "+1 (512) 555-0147",
      whatsapp: "15125550147",
      address: { street: "Plot 12, Al Quoz Industrial Area 3", locality: "Dubai", country: "UAE" },
    };

    // Act
    const blockers = launchBlockers({ ...READY_STATE, contact });

    // Assert
    expect(blockers).toEqual([]);
  });

  it("names only the details that are still placeholders", () => {
    // Arrange
    const state: LaunchState = { ...READY_STATE, contact: { ...REAL_CONTACT, phone: PLACEHOLDER_CONTACT.phone } };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toEqual(['site.contact.phone is still "+971 4 000 0000", which is not real: a real phone number has at least 7 digits and no run of four zeros']);
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
      photoMetadata: photoMetadataBlockers(DIRTY_PHOTOS),
    };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toHaveLength(4 + 1 + 1 + 2 + 2);
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
      photoMetadata: photoMetadataBlockers(DIRTY_PHOTOS),
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
    expect(message).toContain('site.contact.address is still "Factory address, Dubai, UAE"');
    expect(message).toContain('project "marina-villa" in src/content/projects.ts is still marked sample: true');
    expect(message).toContain("set showSampleNotice to false in src/config/site.ts");
    expect(message).toContain("src/content/projects.ts");
    expect(message).toContain("or set isIndexable back to false");
    expect(message).toContain("strip serial numbers, edit history, camera settings and any GPS position from every published original photo under public/, keeping the orientation");
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

  it("names every published photo that still carries a serial number, an edit history or camera settings when the site is indexable", () => {
    // Arrange
    const state: LaunchState = { ...READY_STATE, photoMetadata: photoMetadataBlockers(DIRTY_PHOTOS) };

    // Act
    const blockers = launchBlockers(state);

    // Assert
    expect(blockers).toHaveLength(2);
    expect(blockers[0]).toContain("photos.metadata: public/projects/alpha/alpha-01.jpg carries BodySerialNumber, LensSerialNumber, xmpMM:History, crs: settings");
    expect(blockers[1]).toContain("photos.metadata: public/projects/alpha/alpha-02.jpg carries xmpMM:History");
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

const SITE_FILE = "src/config/site.ts";

/** The value of `export const <name> = true;` or `= false;` as written in a file's text, or null when it is spelled any other way (an expression, an environment variable, a cast). */
function literalSwitch(source: string, name: string): boolean | null {
  const match = new RegExp(`^export const ${name} = (true|false);[ \\t]*$`, "m").exec(source);
  return match === null ? null : match[1] === "true";
}

describe("literalSwitch", () => {
  it.each([
    ["false", "export const isIndexable = false;", false],
    ["true", "export const isIndexable = true;", true],
    ["a literal with a trailing space", "export const isIndexable = true; ", true],
    ["a literal among other lines", 'export const a = 1;\nexport const isIndexable = false;\nexport const b = 2;', false],
  ])("reads %s", (_label, source, expected) => {
    // Arrange
    // (the table supplies the source text)

    // Act
    const value = literalSwitch(source, "isIndexable");

    // Assert
    expect(value).toBe(expected);
  });

  it.each([
    ["an environment variable", 'export const isIndexable = process.env.NEXT_PUBLIC_INDEXABLE === "true";'],
    ["a cast", "export const isIndexable = false as boolean;"],
    ["a type annotation", "export const isIndexable: boolean = false;"],
    ["a function call", "export const isIndexable = readFlag();"],
    ["a line that is commented out", "// export const isIndexable = true;"],
    ["a different name", "export const isIndexableSoon = false;"],
    ["no definition at all", "export const other = 1;"],
  ])("does not read %s as a literal", (_label, source) => {
    // Arrange
    // (the table supplies the source text)

    // Act
    const value = literalSwitch(source, "isIndexable");

    // Assert
    expect(value).toBeNull();
  });
});

describe("the switches the guard reads", () => {
  const source = readFileSync(path.join(process.cwd(), SITE_FILE), "utf8");

  it.each([
    ["isIndexable", isIndexable],
    ["showSampleNotice", showSampleNotice],
  ])("%s is a plain true or false in src/config/site.ts, the value the build uses", (name, value) => {
    // Arrange
    // (the table supplies the imported value)

    // Act
    const written = literalSwitch(source, name);

    // Assert
    expect(written, `${SITE_FILE} must say \`export const ${name} = true;\` or \`= false;\`, not an expression: the guard cannot see a value that depends on the build's environment`).toBe(value);
  });
});

describe("photoMetadataIfIndexable", () => {
  it("reads no photo while the site is not indexable, because the originals may be replaced before launch", async () => {
    // Arrange
    let scans = 0;
    const scan = async (): Promise<readonly PhotoFinding[]> => {
      scans += 1;
      return DIRTY_PHOTOS;
    };

    // Act
    const blockers = await photoMetadataIfIndexable(false, scan);

    // Assert
    expect(scans).toBe(0);
    expect(blockers).toEqual([]);
  });

  it("reads the photos and names each dirty one once the site is indexable", async () => {
    // Arrange
    const scan = async (): Promise<readonly PhotoFinding[]> => DIRTY_PHOTOS;

    // Act
    const blockers = await photoMetadataIfIndexable(true, scan);

    // Assert
    expect(blockers).toEqual(photoMetadataBlockers(DIRTY_PHOTOS));
  });

  it("scans the repository's own photos by default, and every one of them can be read", async () => {
    // Arrange
    const isSiteIndexable = true;

    // Act
    const blockers = await photoMetadataIfIndexable(isSiteIndexable);

    // Assert
    expect(blockers.every((blocker) => blocker.startsWith("photos.metadata: public/"))).toBe(true);
  });
});
