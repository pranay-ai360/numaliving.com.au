import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LISTED_CLAIMS } from "@/content/blockerFixtures";
import { claimBlockers, unconfirmedClaims, type UnconfirmedClaim } from "@/content/claims";

const ROOT = process.cwd();
const OWNER_PACK = "docs/seo/owner-input-pack.md";
const PART_3_HEADING = "## Part 3";

/** A repo file's text with every run of white space made one space, so a sentence that wraps in the source still matches. */
function textOf(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8").replace(/\s+/g, " ");
}

/** The file a claim's `where` starts with: the words before the first colon or opening bracket. */
function fileOf(claim: UnconfirmedClaim): string {
  return claim.where.split(/[:(]/)[0].trim();
}

/** The part of the owner pack that lists the claims (Part 3 and anything after it). */
function ownerPackPart3(): string {
  const text = readFileSync(path.join(ROOT, OWNER_PACK), "utf8");
  const start = text.indexOf(PART_3_HEADING);
  if (start === -1) throw new Error(`${OWNER_PACK} has no "${PART_3_HEADING}" heading`);
  return text.slice(start);
}

describe("unconfirmedClaims", () => {
  it("names each claim claims.<name>, once", () => {
    // Arrange
    const ids = unconfirmedClaims.map((claim) => claim.id);

    // Act
    const misnamed = ids.filter((id) => !/^claims\.[a-z][A-Za-z0-9]*$/.test(id));
    const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);

    // Assert
    expect(misnamed).toEqual([]);
    expect(repeated).toEqual([]);
  });

  it("gives each claim the file that says it and the exact words, so the owner sees what they are confirming", () => {
    // Arrange
    const claims = unconfirmedClaims;

    // Act
    const unclear = claims.filter((claim) => !existsSync(path.join(ROOT, fileOf(claim))) || claim.claim.trim() === "");

    // Assert
    expect(unclear.map((claim) => claim.id)).toEqual([]);
  });

  it.each(unconfirmedClaims.map((claim) => [claim.id, claim] as const))("still finds the words of %s in its file, so an edit cannot leave an entry that blocks nothing", (_id, claim) => {
    // Arrange
    const text = textOf(fileOf(claim));

    // Act
    const isFound = text.includes(claim.claim.replace(/\s+/g, " "));

    // Assert
    expect(isFound, `"${claim.claim}" is no longer in ${fileOf(claim)}: delete ${claim.id} if the sentence is gone, or update the entry`).toBe(true);
  });

  it("is asked about in the owner pack, Part 3, id by id", () => {
    // Arrange
    const part3 = ownerPackPart3();

    // Act
    const missing = unconfirmedClaims.filter((claim) => !part3.includes(claim.id));

    // Assert
    expect(missing.map((claim) => claim.id)).toEqual([]);
  });
});

describe("claimBlockers", () => {
  it("names each claim, the words the pages use and where to find them", () => {
    // Arrange
    const claims = LISTED_CLAIMS;

    // Act
    const blockers = claimBlockers(claims);

    // Assert
    expect(blockers).toEqual([
      'claims.usShipping needs the owner\'s word: the pages say "Shipped to US job sites" (src/content/pages.ts: home.heroSub)',
      'claims.fireRatedDoors needs the owner\'s word: the pages say "Fire-rated doors" (src/content/pages.ts: capabilities, Doors & Openings)',
    ]);
  });

  it("lists nothing once the owner has confirmed every claim and the entries are deleted", () => {
    // Arrange
    const confirmed: readonly UnconfirmedClaim[] = [];

    // Act
    const blockers = claimBlockers(confirmed);

    // Assert
    expect(blockers).toEqual([]);
  });

  it("reads the live list by default", () => {
    // Arrange
    const expected = claimBlockers(unconfirmedClaims);

    // Act
    const blockers = claimBlockers();

    // Assert
    expect(blockers).toEqual(expected);
  });
});
