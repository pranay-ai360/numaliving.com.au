import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import { home } from "@/content/pages";

/** How many words a first screen has to say what, where and for whom. */
const FIRST_WORDS = 80;

function firstWordsOfThePage(count: number): string {
  const { container } = render(<HomePage />);
  return (container.textContent ?? "").split(/\s+/).filter((word) => word !== "").slice(0, count).join(" ");
}

describe("the home page's first screen", () => {
  it("has one top-level heading, and it names custom millwork", () => {
    // Arrange
    render(<HomePage />);

    // Act
    const headings = screen.getAllByRole("heading", { level: 1 });

    // Assert
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent?.toLowerCase()).toContain("custom millwork");
  });

  it("says what Numa makes, where it is made and who it is for within the first 80 words", () => {
    // Arrange
    const text = firstWordsOfThePage(FIRST_WORDS).toLowerCase();

    // Act
    const missing = ["custom millwork", "dubai", "us projects", "architects", "designers", "general contractors", "developers"].filter((fact) => !text.includes(fact));

    // Assert
    expect(missing).toEqual([]);
  });

  it("states what the factory can do, not a record of projects delivered", () => {
    // Arrange
    render(<HomePage />);

    // Act
    const statement = screen.getByText(home.heroSub);

    // Assert
    expect(statement).toHaveTextContent("Made in our Dubai factory. Shipped to US job sites.");
    expect(statement.textContent).not.toMatch(/delivered|projects completed|\d+\+/i);
  });

  it("no longer lists the countries, Australia first, that it once named", () => {
    // Arrange
    const { container } = render(<HomePage />);

    // Act
    const text = container.textContent ?? "";

    // Assert
    expect(text).not.toContain("Australia · India");
    expect(text).not.toContain("Woodwork, Mastered");
  });

  it("uses a photo from the sample projects that shows no other company's logo", () => {
    // Arrange
    const { src } = home.heroPhoto;

    // Act
    const folder = src.split("/")[2];

    // Assert
    expect(["sonate", "golf-links"]).not.toContain(folder);
  });
});
