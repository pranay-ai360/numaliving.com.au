import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProjectsPage from "./page";
import { projects } from "@/content/projects";
import { requirePageSeo } from "@/content/seo";

describe("Projects page", () => {
  it("has one top-level heading, and it says what the page's search title says", () => {
    // Arrange
    render(<ProjectsPage />);

    // Act
    const headings = screen.getAllByRole("heading", { level: 1 });

    // Assert
    expect(headings.map((heading) => heading.textContent)).toEqual([requirePageSeo("/projects").title]);
  });

  it("shows that heading to everyone, instead of hiding it from sight", () => {
    // Arrange
    render(<ProjectsPage />);

    // Act
    const heading = screen.getByRole("heading", { level: 1 });

    // Assert
    expect(heading).not.toHaveClass("sr-only");
  });

  it("puts each project's title in a second-level heading, directly under the page's title", () => {
    // Arrange
    render(<ProjectsPage />);

    // Act
    const levels = screen.getAllByRole("heading").map((heading) => heading.tagName);

    // Assert
    expect(levels).toEqual(["H1", ...projects.map(() => "H2")]);
  });
});
