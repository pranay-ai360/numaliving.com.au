import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AboutPage from "@/app/about/page";

describe("the About page", () => {
  it("shows no company facts while none is supplied, rather than a gap or a placeholder", () => {
    // Arrange
    render(<AboutPage />);

    // Act
    const heading = screen.queryByRole("heading", { name: "Company Facts" });

    // Assert
    expect(heading).not.toBeInTheDocument();
  });

  it("lists the regions with North America first and no misspelled name", () => {
    // Arrange
    render(<AboutPage />);

    // Act
    const regions = screen.getAllByRole("heading", { level: 3 }).slice(0, 4).map((heading) => heading.textContent);

    // Assert
    expect(regions).toEqual(["North America", "Middle East", "Australia & Asia", "Europe"]);
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
