import { describe, expect, it } from "vitest";
import { destinations, factory as factoryPlace } from "@/content/locations";
import { about, capabilities, craft, delivery, factory, home, process, sampleContent } from "@/content/pages";

/** Every content object a sampleContent id can start from, as the id's first word names it. */
const CONTENT: Readonly<Record<string, unknown>> = {
  home,
  about,
  capabilities,
  factory,
  process,
  delivery,
  craft,
  locations: { factory: factoryPlace, destinations },
};

/** Follows an id such as "home.stats" through the content, or returns undefined where the path breaks. */
function resolve(id: string): unknown {
  return id.split(".").reduce<unknown>((value, key) => (typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined), CONTENT);
}

describe("sampleContent", () => {
  it("names each entry after a content object that exists, as its first word", () => {
    // Arrange
    const roots = Object.keys(CONTENT);

    // Act
    const unknown = sampleContent.filter((item) => !roots.includes(item.id.split(".")[0]));

    // Assert
    expect(unknown).toEqual([]);
  });

  it.each(sampleContent.map((item) => [item.id] as const))("still finds real content for %s, so a rename cannot leave a stale entry that blocks nothing", (id) => {
    // Arrange
    // (the table above supplies the id)

    // Act
    const content = resolve(id);

    // Assert
    const isContent = Array.isArray(content) ? content.length > 0 : typeof content === "object" && content !== null;
    expect(isContent, `${id} should be a non-empty list, or an object, in the content files`).toBe(true);
  });

  it.each([
    ["craft", "any craft gallery photo", () => craft.some((photo) => photo.src === "")],
    ["factory.photo", "the factory photo", () => factory.photo.src === ""],
  ])("lists %s while %s still has no photo file, so a wood-tone placeholder cannot go live", (id, _label, isPlaceholder) => {
    // Arrange
    const ids = sampleContent.map((item) => item.id);

    // Act
    const isListed = ids.includes(id);

    // Assert
    expect(!isPlaceholder() || isListed, `${id} still shows a placeholder, so it must be listed in sampleContent`).toBe(true);
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
