import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProcessPage from "./page";
import { process } from "@/content/pages";

describe("Process page", () => {
  it("has a second-level heading above the steps, so the step names are not an H3 straight under the H1", () => {
    // Arrange
    render(<ProcessPage />);

    // Act
    const levels = screen.getAllByRole("heading").map((heading) => heading.tagName);

    // Assert
    expect(levels).toEqual(["H1", "H2", ...process.steps.map(() => "H3")]);
  });

  it("names that heading for what follows, the steps from first conversation to handover", () => {
    // Arrange
    render(<ProcessPage />);

    // Act
    const heading = screen.getByRole("heading", { level: 2 });

    // Assert
    expect(heading).toHaveTextContent("Our process in eight steps");
    expect(process.steps, "the heading says eight steps").toHaveLength(8);
  });

  it("shows the name of each step as a third-level heading, in order", () => {
    // Arrange
    render(<ProcessPage />);

    // Act
    const names = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);

    // Assert
    expect(names).toEqual(process.steps.map((step) => step.name));
  });
});
