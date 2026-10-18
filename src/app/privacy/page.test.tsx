import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage, { metadata } from "@/app/privacy/page";
import { requirePageSeo } from "@/content/seo";
import { buildPageMetadata } from "@/lib/seo/metadata";

describe("the /privacy page", () => {
  it("shows the page with one top-level heading", () => {
    // Arrange
    render(<PrivacyPage />);

    // Act
    const headings = screen.getAllByRole("heading", { level: 1 });

    // Assert
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Privacy Notice");
  });

  it("takes its search metadata from its entry in the page registry", () => {
    // Arrange
    const expected = buildPageMetadata(requirePageSeo("/privacy"));

    // Act
    const actual = metadata;

    // Assert
    expect(actual).toEqual(expected);
  });
});
