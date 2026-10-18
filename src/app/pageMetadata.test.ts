import { describe, expect, it } from "vitest";
import { pageMetadata } from "@/app/pageMetadata";
import { requirePageSeo } from "@/content/seo";
import { buildPageMetadata } from "@/lib/seo/metadata";

describe("pageMetadata", () => {
  it("builds a page's metadata from its entry in the page registry", () => {
    // Arrange
    const expected = buildPageMetadata(requirePageSeo("/about"));

    // Act
    const metadata = pageMetadata("/about");

    // Assert
    expect(metadata).toEqual(expected);
  });

  it("gives the client login the never-indexed treatment from its registry entry", () => {
    // Arrange
    const path = "/login";

    // Act
    const metadata = pageMetadata(path);

    // Assert
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("gives the home page an absolute title", () => {
    // Arrange
    const path = "/";

    // Act
    const metadata = pageMetadata(path);

    // Assert
    expect(metadata.title).toEqual({ absolute: "Custom Luxury Millwork, Made in Dubai | Numa Living" });
  });

  it("stops with a plain message when the page has no entry, instead of publishing it without a title", () => {
    // Arrange
    const path = "/no-such-page";

    // Act
    const act = (): unknown => pageMetadata(path);

    // Assert
    expect(act).toThrow("src/content/seo.ts");
  });
});
