import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AboutPage from "@/app/about/page";
import { EMPTY_COMPANY_FACTS } from "@/content/blockerFixtures";
import type { CompanyFacts } from "@/content/company";

const SOME_FACTS: CompanyFacts = { ...EMPTY_COMPANY_FACTS, foundingYear: 2015 };

/** The About page as it is when the company facts hold `facts` (loaded afresh, since the page reads them when it is imported). */
async function renderAboutPageWith(facts: CompanyFacts): Promise<void> {
  vi.resetModules();
  vi.doMock("@/content/company", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/content/company")>()), companyFacts: facts }));
  const { default: PageWithFacts } = await import("@/app/about/page");
  render(<PageWithFacts />);
}

describe("the About page", () => {
  afterEach(() => {
    vi.doUnmock("@/content/company");
    vi.resetModules();
  });

  it("shows no company facts while none is supplied, rather than a gap or a placeholder", async () => {
    // Arrange
    await renderAboutPageWith(EMPTY_COMPANY_FACTS);

    // Act
    const heading = screen.queryByRole("heading", { name: "Company Facts" });

    // Assert
    expect(heading).not.toBeInTheDocument();
  });

  it("shows the company facts once the owner has supplied some", async () => {
    // Arrange
    await renderAboutPageWith(SOME_FACTS);

    // Act
    const heading = screen.queryByRole("heading", { name: "Company Facts" });

    // Assert
    expect(heading).toBeInTheDocument();
  });

  it("lists the regions with North America first and no misspelled name", () => {
    // Arrange
    render(<AboutPage />);

    // Act
    const regions = screen.getAllByRole("heading", { level: 3 }).slice(0, 3).map((heading) => heading.textContent);

    // Assert
    expect(regions).toEqual(["North America", "Middle East", "Asia"]);
  });

  it("has one top-level heading", () => {
    // Arrange
    render(<AboutPage />);

    // Act
    const headings = screen.getAllByRole("heading", { level: 1 });

    // Assert
    expect(headings).toHaveLength(1);
  });
});
