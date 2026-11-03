import { describe, expect, it } from "vitest";
import { headingProblems } from "@/lib/headings";

describe("headingProblems", () => {
  it.each([
    ["a page with only its title", [1]],
    ["a title, sections and the cards under a section", [1, 2, 3, 3, 2, 3]],
    ["a title and its sections", [1, 2, 2, 2]],
    ["a section that goes three levels deep and comes back up", [1, 2, 3, 4, 3, 2]],
    ["a title straight to a card list, the cards being sections", [1, 2, 2, 2]],
  ])("accepts %s", (_label, levels) => {
    // Arrange
    // (the table supplies the levels)

    // Act
    const problems = headingProblems(levels);

    // Assert
    expect(problems).toEqual([]);
  });

  it("names a page with no top-level heading", () => {
    // Arrange
    const levels = [2, 3];

    // Act
    const problems = headingProblems(levels);

    // Assert
    expect(problems).toContain("the page has no H1");
  });

  it("names a page with two top-level headings", () => {
    // Arrange
    const levels = [1, 2, 1];

    // Act
    const problems = headingProblems(levels);

    // Assert
    expect(problems).toContain("the page has 2 H1 headings, not one");
  });

  it("names a first heading that is not the H1", () => {
    // Arrange
    const levels = [2, 1, 2];

    // Act
    const problems = headingProblems(levels);

    // Assert
    expect(problems).toContain("the first heading is an H2, not the H1");
  });

  it("names a level that is skipped on the way down, with the heading's place in the page", () => {
    // Arrange
    const levels = [1, 3, 3];

    // Act
    const problems = headingProblems(levels);

    // Assert
    expect(problems).toEqual(["heading 2 is an H3 after an H1: it skips H2"]);
  });

  it("names a skip after a deeper section too", () => {
    // Arrange
    const levels = [1, 2, 3, 5];

    // Act
    const problems = headingProblems(levels);

    // Assert
    expect(problems).toEqual(["heading 4 is an H5 after an H3: it skips H4"]);
  });

  it("does not mind a jump back up by more than one level", () => {
    // Arrange
    const levels = [1, 2, 3, 4, 2];

    // Act
    const problems = headingProblems(levels);

    // Assert
    expect(problems).toEqual([]);
  });

  it("lists every problem a page has", () => {
    // Arrange
    const levels = [1, 3, 1, 4];

    // Act
    const problems = headingProblems(levels);

    // Assert
    expect(problems).toEqual(["the page has 2 H1 headings, not one", "heading 2 is an H3 after an H1: it skips H2", "heading 4 is an H4 after an H1: it skips H2"]);
  });

  it("refuses a level that is not 1 to 6, rather than guess", () => {
    // Arrange
    const levels = [1, 7];

    // Act
    const act = (): readonly string[] => headingProblems(levels);

    // Assert
    expect(act).toThrow("A heading level is 1 to 6, not 7.");
  });

  it("names a page with no headings at all", () => {
    // Arrange
    const levels: readonly number[] = [];

    // Act
    const problems = headingProblems(levels);

    // Assert
    expect(problems).toEqual(["the page has no H1"]);
  });
});
