import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProjectsPage from "./page";

describe("Projects page", () => {
  it("has one top-level heading for screen readers and search engines", () => {
    // Arrange
    render(<ProjectsPage />);

    // Act
    const headings = screen.getAllByRole("heading", { level: 1 });

    // Assert
    expect(headings.map((heading) => heading.textContent)).toEqual(["Projects"]);
  });

  it("keeps that heading visually hidden, so the design does not change", () => {
    // Arrange
    render(<ProjectsPage />);

    // Act
    const heading = screen.getByRole("heading", { level: 1, name: "Projects" });

    // Assert
    expect(heading).toHaveClass("sr-only");
  });
});
