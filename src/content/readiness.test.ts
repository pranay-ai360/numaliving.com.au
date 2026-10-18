import { describe, expect, it } from "vitest";
import { EMPTY_COMPANY_FACTS, LISTED_CLAIMS, LISTED_FIGURES, PENDING_LEGAL_DRAFTS } from "@/content/blockerFixtures";
import { claimBlockers } from "@/content/claims";
import { companyFactsBlockers } from "@/content/company";
import { legalDraftBlockers } from "@/content/legal";
import { sampleContent, type SampleContent } from "@/content/pages";
import { BLOCKER_SOURCES, contentBlockers, sampleContentBlockers, type BlockerSource } from "@/content/readiness";

describe("sampleContentBlockers", () => {
  it("names every invented figure still listed in sampleContent, and where to replace it", () => {
    // Arrange
    const items = LISTED_FIGURES;

    // Act
    const blockers = sampleContentBlockers(items);

    // Assert
    expect(blockers).toEqual([
      '"home.stats" is still listed in sampleContent in src/content/pages.ts, so the site shows invented figures (src/content/pages.ts: home.stats (projects delivered, countries, factory floor, staff))',
      '"factory.facts" is still listed in sampleContent in src/content/pages.ts, so the site shows invented figures (src/content/pages.ts: factory.facts (production floor, machines))',
    ]);
  });

  it("lists nothing once sampleContent is empty", () => {
    // Arrange
    const items: readonly SampleContent[] = [];

    // Act
    const blockers = sampleContentBlockers(items);

    // Assert
    expect(blockers).toEqual([]);
  });

  it("reads the real sampleContent by default", () => {
    // Arrange
    const expected = sampleContent.map((item) => item.id);

    // Act
    const blockers = sampleContentBlockers();

    // Assert
    expect(blockers).toHaveLength(expected.length);
    expected.forEach((id, index) => expect(blockers[index]).toContain(JSON.stringify(id)));
  });
});

describe("contentBlockers", () => {
  it("reads these sources, in this order: the sample figures, the company facts, the legal drafts and the unconfirmed claims", () => {
    // Arrange
    const expected = [sampleContentBlockers, companyFactsBlockers, legalDraftBlockers, claimBlockers];

    // Act
    const sources = BLOCKER_SOURCES;

    // Assert
    expect(sources).toEqual(expected);
  });

  it("collects whatever its sources list right now, so clearing a real entry needs no change here", () => {
    // Arrange
    const expected = BLOCKER_SOURCES.flatMap((source) => source());

    // Act
    const blockers = contentBlockers();

    // Assert
    expect(blockers).toEqual(expected);
  });

  it("lists one blocker for each open item of every kind, in the order of the sources", () => {
    // Arrange
    const sources: readonly BlockerSource[] = [
      () => sampleContentBlockers(LISTED_FIGURES),
      () => companyFactsBlockers(EMPTY_COMPANY_FACTS),
      () => legalDraftBlockers(PENDING_LEGAL_DRAFTS),
      () => claimBlockers(LISTED_CLAIMS),
    ];

    // Act
    const blockers = contentBlockers(sources);

    // Assert
    expect(blockers.slice(0, 2).every((blocker) => blocker.includes("sampleContent"))).toBe(true);
    expect(blockers.slice(2, 9).every((blocker) => blocker.startsWith("company fact"))).toBe(true);
    expect(blockers.slice(9, 11)).toEqual(["legal.privacy needs legal review", "legal.terms needs legal review"]);
    expect(blockers.slice(11).every((blocker) => blocker.startsWith("claims."))).toBe(true);
    expect(blockers).toHaveLength(2 + 7 + 2 + 2);
  });

  it("says each blocker once, in plain words", () => {
    // Arrange
    const blockers = contentBlockers();

    // Act
    const repeated = blockers.filter((blocker, index) => blockers.indexOf(blocker) !== index);
    const blank = blockers.filter((blocker) => blocker.trim() === "");

    // Assert
    expect(repeated).toEqual([]);
    expect(blank).toEqual([]);
  });

  it("combines the lists of whatever modules register, in the order given, without anyone editing the launch guard", () => {
    // Arrange
    const guides: BlockerSource = () => ["guides.cost needs the sales interview"];
    const ready: BlockerSource = () => [];
    const factory: BlockerSource = () => ["factory.photos needs permission", "factory.area needs the owner"];

    // Act
    const blockers = contentBlockers([guides, ready, factory]);

    // Assert
    expect(blockers).toEqual(["guides.cost needs the sales interview", "factory.photos needs permission", "factory.area needs the owner"]);
  });

  it("lists nothing when no module has a blocker", () => {
    // Arrange
    const sources: readonly BlockerSource[] = [() => [], () => []];

    // Act
    const blockers = contentBlockers(sources);

    // Assert
    expect(blockers).toEqual([]);
  });

  it("asks each module afresh every time, so a fixed blocker disappears from the list", () => {
    // Arrange
    let remaining = ["one", "two"];
    const source: BlockerSource = () => remaining;

    // Act
    const before = contentBlockers([source]);
    remaining = ["two"];
    const after = contentBlockers([source]);

    // Assert
    expect(before).toEqual(["one", "two"]);
    expect(after).toEqual(["two"]);
  });
});
