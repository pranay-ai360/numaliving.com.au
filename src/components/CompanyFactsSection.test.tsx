import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompanyFactsSection } from "@/components/CompanyFactsSection";
import { companyFacts, type CompanyFacts } from "@/content/company";

const KNOWN: CompanyFacts = {
  legalName: "Numa Living FZ-LLC",
  foundingYear: 2015,
  factoryAreaSqFt: 194000,
  headcount: 250,
  certifications: [{ name: "ISO 9001", documentUrl: "https://example.com/iso-9001.pdf" }],
  leadership: [
    { name: "Ada Lovelace", role: "Managing Director", profileUrl: "https://www.linkedin.com/in/example" },
    { name: "Grace Hopper", role: "Head of Engineering", profileUrl: null },
  ],
  parentGroupUrl: "https://example.com/conqueror-group",
};

describe("CompanyFactsSection", () => {
  it("renders nothing while the company facts are empty, so the About page shows no gap and no placeholder", () => {
    // Arrange
    const { container } = render(<CompanyFactsSection facts={companyFacts} />);

    // Act
    const html = container.innerHTML;

    // Assert
    expect(html).toBe("");
  });

  it("shows a Company Facts heading and one row for each fact that is supplied", () => {
    // Arrange
    render(<CompanyFactsSection facts={KNOWN} />);

    // Act
    const heading = screen.getByRole("heading", { level: 2, name: "Company Facts" });
    const labels = screen.getAllByRole("term").map((term) => term.textContent);

    // Assert
    expect(heading).toBeInTheDocument();
    expect(labels).toEqual(["Legal name", "Founded", "Factory floor", "Team", "Certifications", "Leadership", "Parent group"]);
  });

  it("writes each fact in US style: the area in square feet with square meters in parentheses, the team as a count of people", () => {
    // Arrange
    render(<CompanyFactsSection facts={KNOWN} />);

    // Act
    const values = new Map(screen.getAllByRole("term").map((term) => [term.textContent, term.nextElementSibling?.textContent]));

    // Assert
    expect(values.get("Legal name")).toBe("Numa Living FZ-LLC");
    expect(values.get("Founded")).toBe("2015");
    expect(values.get("Factory floor")).toBe("194,000 sq ft (18,023 m²)");
    expect(values.get("Team")).toBe("250 people");
  });

  it("links each certification to its document", () => {
    // Arrange
    render(<CompanyFactsSection facts={KNOWN} />);

    // Act
    const link = screen.getByRole("link", { name: "ISO 9001" });

    // Assert
    expect(link).toHaveAttribute("href", "https://example.com/iso-9001.pdf");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("names each leader with their role, and links a LinkedIn profile where there is one", () => {
    // Arrange
    render(<CompanyFactsSection facts={KNOWN} />);
    const leaders = screen.getByText("Leadership").nextElementSibling as HTMLElement;

    // Act
    const items = within(leaders).getAllByRole("listitem").map((item) => item.textContent);
    const profile = within(leaders).getByRole("link", { name: "LinkedIn" });

    // Assert
    expect(items).toEqual(["Ada Lovelace, Managing Director LinkedIn", "Grace Hopper, Head of Engineering"]);
    expect(profile).toHaveAttribute("href", "https://www.linkedin.com/in/example");
  });

  it("links the parent group", () => {
    // Arrange
    render(<CompanyFactsSection facts={KNOWN} />);

    // Act
    const link = screen.getByRole("link", { name: "Conqueror Group" });

    // Assert
    expect(link).toHaveAttribute("href", "https://example.com/conqueror-group");
  });

  it("shows only the facts that are supplied", () => {
    // Arrange
    render(<CompanyFactsSection facts={{ ...companyFacts, foundingYear: 2015 }} />);

    // Act
    const labels = screen.getAllByRole("term").map((term) => term.textContent);

    // Assert
    expect(labels).toEqual(["Founded"]);
  });

  it("never links an address that is not https, and leaves out a fact that is unusable", () => {
    // Arrange
    render(<CompanyFactsSection facts={{ ...KNOWN, parentGroupUrl: "javascript:alert(1)", certifications: [{ name: "ISO 9001", documentUrl: "http://example.com/a.pdf" }], headcount: 0 }} />);

    // Act
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    const labels = screen.getAllByRole("term").map((term) => term.textContent);

    // Assert
    expect(hrefs).toEqual(["https://www.linkedin.com/in/example"]);
    expect(labels).not.toContain("Team");
    expect(labels).not.toContain("Parent group");
    expect(labels).not.toContain("Certifications");
  });
});
