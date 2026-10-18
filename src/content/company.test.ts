import { describe, expect, it } from "vitest";
import { EMPTY_COMPANY_FACTS } from "@/content/blockerFixtures";
import { companyFacts, companyFactsBlockers, publishableFacts, type CompanyFacts } from "@/content/company";
import { organizationJsonLd } from "@/lib/seo/jsonld";

/** A company whose every fact is supplied, for the tests of the blockers themselves. */
const KNOWN: CompanyFacts = {
  legalName: "Numa Living FZ-LLC",
  foundingYear: 2015,
  factoryAreaSqFt: 194000,
  headcount: 250,
  certifications: [{ name: "ISO 9001", documentUrl: "https://example.com/iso-9001.pdf" }],
  leadership: [{ name: "Ada Lovelace", role: "Managing Director", profileUrl: "https://www.linkedin.com/in/example" }],
  parentGroupUrl: "https://example.com/conqueror-group",
};

describe("companyFacts", () => {
  it("has a rule for every fact it holds, so no fact can be left out of the launch blockers", () => {
    // Arrange
    const facts = Object.keys(companyFacts);

    // Act
    const named = companyFactsBlockers(EMPTY_COMPANY_FACTS).map((blocker) => blocker.match(/company fact "(\w+)"/)?.[1]);

    // Assert
    expect([...named].sort()).toEqual([...facts].sort());
  });

  it("never holds a value the rules reject: a fact that is listed as missing is empty, not set to a zero or a broken link", () => {
    // Arrange
    const missing = companyFactsBlockers().map((blocker) => blocker.match(/company fact "(\w+)"/)?.[1] as keyof CompanyFacts);

    // Act
    const setButUnusable = missing.filter((field) => {
      const value = companyFacts[field];
      return Array.isArray(value) ? value.length > 0 : value !== null;
    });

    // Assert
    expect(setButUnusable).toEqual([]);
  });
});

describe("companyFactsBlockers", () => {
  it("names each missing fact in plain words, with the file and the field to fill in", () => {
    // Arrange
    const facts = EMPTY_COMPANY_FACTS;

    // Act
    const blockers = companyFactsBlockers(facts);

    // Assert
    expect(blockers).toEqual([
      'company fact "legalName" is missing or not valid: the company\'s legal name (fill it in src/content/company.ts)',
      'company fact "foundingYear" is missing or not valid: the year the company was founded (fill it in src/content/company.ts)',
      'company fact "factoryAreaSqFt" is missing or not valid: the factory\'s floor area in square feet (fill it in src/content/company.ts)',
      'company fact "headcount" is missing or not valid: the number of people the company employs (fill it in src/content/company.ts)',
      'company fact "certifications" is missing or not valid: the certifications, each with a link to its document (fill it in src/content/company.ts)',
      'company fact "leadership" is missing or not valid: the named leaders, with their roles (fill it in src/content/company.ts)',
      'company fact "parentGroupUrl" is missing or not valid: a web page that proves the Conqueror Group connection (fill it in src/content/company.ts)',
    ]);
  });

  it("lists nothing once every fact is supplied", () => {
    // Arrange
    const facts = KNOWN;

    // Act
    const blockers = companyFactsBlockers(facts);

    // Assert
    expect(blockers).toEqual([]);
  });

  it("lists only the facts that are still missing", () => {
    // Arrange
    const facts: CompanyFacts = { ...KNOWN, legalName: null, headcount: null, leadership: [] };

    // Act
    const blockers = companyFactsBlockers(facts).map((blocker) => blocker.match(/company fact "(\w+)"/)?.[1]);

    // Assert
    expect(blockers).toEqual(["legalName", "headcount", "leadership"]);
  });

  it.each([
    ["a founding year of zero", { foundingYear: 0 }, "foundingYear"],
    ["a founding year with a fraction", { foundingYear: 2015.5 }, "foundingYear"],
    ["a founding year in the distant future", { foundingYear: 3000 }, "foundingYear"],
    ["a negative factory area", { factoryAreaSqFt: -1 }, "factoryAreaSqFt"],
    ["a headcount of zero", { headcount: 0 }, "headcount"],
    ["a headcount with a fraction", { headcount: 12.5 }, "headcount"],
    ["a blank legal name", { legalName: "   " }, "legalName"],
  ] as const)("counts %s as missing, not as supplied", (_label, override, field) => {
    // Arrange
    const facts: CompanyFacts = { ...KNOWN, ...override };

    // Act
    const blockers = companyFactsBlockers(facts);

    // Assert
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain(`company fact "${field}"`);
  });

  it.each([
    ["a certification without a link to its document", { certifications: [{ name: "ISO 9001", documentUrl: "" }] }, "certifications"],
    ["a certification whose link is not https", { certifications: [{ name: "ISO 9001", documentUrl: "http://example.com/a.pdf" }] }, "certifications"],
    ["a parent group link that is not https", { parentGroupUrl: "javascript:alert(1)" }, "parentGroupUrl"],
    ["a leader without a name", { leadership: [{ name: "", role: "Director", profileUrl: null }] }, "leadership"],
    ["a leader whose profile link is not https", { leadership: [{ name: "Ada", role: "Director", profileUrl: "ftp://example.com/ada" }] }, "leadership"],
  ] as const)("counts %s as missing, so a broken link is never published", (_label, override, field) => {
    // Arrange
    const facts: CompanyFacts = { ...KNOWN, ...override };

    // Act
    const blockers = companyFactsBlockers(facts);

    // Assert
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain(`company fact "${field}"`);
  });

  it("accepts a leader without a profile link, since a link is optional", () => {
    // Arrange
    const facts: CompanyFacts = { ...KNOWN, leadership: [{ name: "Ada Lovelace", role: "Managing Director", profileUrl: null }] };

    // Act
    const blockers = companyFactsBlockers(facts);

    // Assert
    expect(blockers).toEqual([]);
  });

  it("does not change the facts it reads", () => {
    // Arrange
    const facts = Object.freeze({ ...KNOWN });

    // Act
    const act = (): readonly string[] => companyFactsBlockers(facts);

    // Assert
    expect(act).not.toThrow();
  });
});

describe("publishableFacts", () => {
  it("has nothing to publish while the company facts are empty", () => {
    // Arrange
    const facts = EMPTY_COMPANY_FACTS;

    // Act
    const published = publishableFacts(facts);

    // Assert
    expect(published).toEqual({ certifications: [], leadership: [] });
  });

  it("passes on every fact that is supplied, with the legal name trimmed", () => {
    // Arrange
    const facts: CompanyFacts = { ...KNOWN, legalName: "  Numa Living FZ-LLC  " };

    // Act
    const published = publishableFacts(facts);

    // Assert
    expect(published).toEqual({
      legalName: "Numa Living FZ-LLC",
      foundingYear: 2015,
      factoryAreaSqFt: 194000,
      headcount: 250,
      certifications: KNOWN.certifications,
      leadership: KNOWN.leadership,
      parentGroupUrl: "https://example.com/conqueror-group",
    });
  });

  it("leaves out a fact that is not usable, so nothing broken is published", () => {
    // Arrange
    const facts: CompanyFacts = { ...KNOWN, foundingYear: 0, headcount: 12.5, parentGroupUrl: "javascript:alert(1)", legalName: "   " };

    // Act
    const published = publishableFacts(facts);

    // Assert
    expect(published).toEqual({ factoryAreaSqFt: 194000, certifications: KNOWN.certifications, leadership: KNOWN.leadership });
  });

  it("keeps only the certifications and leaders that are complete and whose links are https", () => {
    // Arrange
    const good = { name: "ISO 9001", documentUrl: "https://example.com/iso.pdf" };
    const goodLeader = { name: "Ada Lovelace", role: "Director", profileUrl: null };
    const facts: CompanyFacts = {
      ...KNOWN,
      certifications: [good, { name: "FSC", documentUrl: "http://example.com/fsc.pdf" }, { name: "", documentUrl: "https://example.com/x.pdf" }],
      leadership: [goodLeader, { name: "Grace Hopper", role: "", profileUrl: null }, { name: "Alan Turing", role: "Engineer", profileUrl: "javascript:alert(1)" }],
    };

    // Act
    const published = publishableFacts(facts);

    // Assert
    expect(published.certifications).toEqual([good]);
    expect(published.leadership).toEqual([goodLeader]);
  });

  it("does not change the facts it reads", () => {
    // Arrange
    const facts: CompanyFacts = { ...KNOWN, certifications: [...KNOWN.certifications] };
    const before = JSON.stringify(facts);

    // Act
    publishableFacts(facts);

    // Assert
    expect(JSON.stringify(facts)).toBe(before);
  });
});

describe("the structured data", () => {
  it("publishes the legal name and the founding year in the Organization data once the company facts hold them", () => {
    // Arrange
    const options = { facts: KNOWN };

    // Act
    const organization = organizationJsonLd(options);

    // Assert
    expect(organization).toMatchObject({ legalName: "Numa Living FZ-LLC", foundingDate: "2015" });
  });

  it("leaves both out while the company facts are empty", () => {
    // Arrange
    const options = { facts: EMPTY_COMPANY_FACTS };

    // Act
    const organization = organizationJsonLd(options);

    // Assert
    expect(organization).not.toHaveProperty("legalName");
    expect(organization).not.toHaveProperty("foundingDate");
  });

  it("reads the live company facts when it is given none", () => {
    // Arrange
    const published = publishableFacts();

    // Act
    const organization = organizationJsonLd();

    // Assert
    expect(organization.legalName).toBe(published.legalName);
    expect(organization.foundingDate).toBe(published.foundingYear === undefined ? undefined : String(published.foundingYear));
  });
});
