import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LegalPage } from "@/components/LegalPage";
import { PENDING_LEGAL_DRAFTS } from "@/content/blockerFixtures";
import { LEGAL_LAST_UPDATED, legalDrafts, privacyNotice, websiteTerms } from "@/content/legal";

const DRAFT_NOTICE = "Draft: a lawyer has not reviewed this page yet.";

describe("LegalPage", () => {
  it("shows the title as the page's one heading, with the lead under it", () => {
    // Arrange
    render(<LegalPage legal={privacyNotice} />);

    // Act
    const headings = screen.getAllByRole("heading", { level: 1 });

    // Assert
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Privacy Notice");
    expect(screen.getByText(privacyNotice.lead)).toBeInTheDocument();
  });

  it("shows when the page was last updated, in US style and as a date a machine can read", () => {
    // Arrange
    render(<LegalPage legal={websiteTerms} />);

    // Act
    const line = screen.getByText(/^Last updated/);
    const time = within(line).getByText(LEGAL_LAST_UPDATED.text);

    // Assert
    expect(line).toHaveTextContent("Last updated October 18, 2026");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", "2026-10-18");
  });

  it("shows each section under its own second-level heading, in order, with its paragraphs", () => {
    // Arrange
    render(<LegalPage legal={privacyNotice} />);

    // Act
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    const paragraphs = privacyNotice.sections.flatMap((section) => section.paragraphs);

    // Assert
    expect(headings).toEqual(privacyNotice.sections.map((section) => section.heading));
    for (const paragraph of paragraphs) expect(screen.getByText(paragraph)).toBeInTheDocument();
  });

  it("says it is a draft while the page is still listed as waiting for a lawyer", () => {
    // Arrange
    render(<LegalPage legal={privacyNotice} drafts={PENDING_LEGAL_DRAFTS} />);

    // Act
    const notice = screen.getByText(DRAFT_NOTICE);

    // Assert
    expect(notice).toBeInTheDocument();
  });

  it("says nothing about a draft once the page's entry is deleted from the list", () => {
    // Arrange
    render(<LegalPage legal={privacyNotice} drafts={PENDING_LEGAL_DRAFTS.filter((draft) => draft.id !== privacyNotice.id)} />);

    // Act
    const notice = screen.queryByText(DRAFT_NOTICE);

    // Assert
    expect(notice).not.toBeInTheDocument();
  });

  it("keeps the draft notice on the page that is still waiting when only the other one has been reviewed", () => {
    // Arrange
    render(<LegalPage legal={websiteTerms} drafts={PENDING_LEGAL_DRAFTS.filter((draft) => draft.id !== privacyNotice.id)} />);

    // Act
    const notice = screen.queryByText(DRAFT_NOTICE);

    // Assert
    expect(notice).toBeInTheDocument();
  });

  it("follows the live list of drafts when it is given none: a notice while the page's entry is listed, none once it is deleted", () => {
    // Arrange
    render(<LegalPage legal={privacyNotice} />);

    // Act
    const hasNotice = screen.queryByText(DRAFT_NOTICE) !== null;

    // Assert
    expect(hasNotice).toBe(legalDrafts.some((draft) => draft.id === privacyNotice.id));
  });

  it("shows its place in the site as a breadcrumb trail ending at the page", () => {
    // Arrange
    render(<LegalPage legal={websiteTerms} />);

    // Act
    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });

    // Assert
    expect(within(trail).getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(within(trail).getByText("Website Terms")).toHaveAttribute("aria-current", "page");
  });
});
