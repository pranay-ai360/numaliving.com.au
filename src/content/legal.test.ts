import { describe, expect, it } from "vitest";
import { LEGAL_LAST_UPDATED, legalDraftBlockers, legalDrafts, type LegalDraft } from "@/content/legal";

describe("legalDrafts", () => {
  it("lists the privacy notice and the website terms as drafts that still need a lawyer", () => {
    // Arrange
    const ids = legalDrafts.map((draft) => draft.id);

    // Act
    const blockers = legalDraftBlockers();

    // Assert
    expect(ids).toEqual(["legal.privacy", "legal.terms"]);
    expect(blockers).toEqual(["legal.privacy needs legal review", "legal.terms needs legal review"]);
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
