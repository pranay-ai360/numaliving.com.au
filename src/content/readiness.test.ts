import { describe, expect, it } from "vitest";
import { companyFactsBlockers } from "@/content/company";
import { legalDraftBlockers } from "@/content/legal";
import { sampleContent, type SampleContent } from "@/content/pages";
import { contentBlockers, sampleContentBlockers, type BlockerSource } from "@/content/readiness";

const LISTED_FIGURES: readonly SampleContent[] = [
  { id: "home.stats", where: "src/content/pages.ts: home.stats (projects delivered, countries, factory floor, staff)" },
  { id: "factory.facts", where: "src/content/pages.ts: factory.facts (production floor, machines)" },
];

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
  it("lists today's blockers: the sample figures, the company facts that are missing and the two legal drafts, in that order", () => {
    // Arrange
    const expected = [...sampleContentBlockers(), ...companyFactsBlockers(), ...legalDraftBlockers()];

    // Act
    const blockers = contentBlockers();

    // Assert
    expect(blockers).toEqual(expected);
    expect(blockers.length).toBeGreaterThan(0);
  });

  it("names the two legal drafts exactly", () => {
    // Arrange
    const blockers = contentBlockers();

    // Act
    const legal = blockers.filter((blocker) => blocker.startsWith("legal."));

    // Assert
    expect(legal).toEqual(["legal.privacy needs legal review", "legal.terms needs legal review"]);
  });

  it("names all seven company facts while none is supplied", () => {
    // Arrange
    const blockers = contentBlockers();

    // Act
    const facts = blockers.filter((blocker) => blocker.startsWith("company fact"));

    // Assert
    expect(facts).toHaveLength(7);
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
