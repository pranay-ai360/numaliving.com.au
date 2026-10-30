import { describe, expect, it } from "vitest";
import { destinations, factory as factoryPlace } from "@/content/locations";
import { about, capabilities, delivery, factory, home, process, sampleContent } from "@/content/pages";

/** Every content object a sampleContent id can start from, as the id's first word names it. */
const CONTENT: Readonly<Record<string, unknown>> = {
  home,
  about,
  capabilities,
  factory,
  process,
  delivery,
  locations: { factory: factoryPlace, destinations },
};

/** Follows an id such as "home.stats" through the content, or returns undefined where the path breaks. */
function resolve(id: string): unknown {
  return id.split(".").reduce<unknown>((value, key) => (typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined), CONTENT);
}

describe("sampleContent", () => {
  it("lists the figures and lists the pages still carry that are invented", () => {
    // Arrange
    const ids = sampleContent.map((item) => item.id);

    // Act
    const listed = [...ids].sort();

    // Assert
    expect(listed).toEqual(["about.certifications", "delivery.regions", "home.stats", "locations.destinations"]);
  });

  it.each(sampleContent.map((item) => [item.id] as const))("still finds real content for %s, so a rename cannot leave a stale entry that blocks nothing", (id) => {
    // Arrange
    // (the table above supplies the id)

    // Act
    const content = resolve(id);

    // Assert
    expect(Array.isArray(content) && content.length > 0, `${id} should be a non-empty list in the content files`).toBe(true);
  });

  it("lists each id once", () => {
    // Arrange
    const ids = sampleContent.map((item) => item.id);

    // Act
    const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);

    // Assert
    expect(repeated).toEqual([]);
  });

  it("says, for each entry, which file to edit", () => {
    // Arrange
    const entries = sampleContent;

    // Act
    const unclear = entries.filter((item) => !item.where.includes("src/content/"));

    // Assert
    expect(unclear).toEqual([]);
  });
});
