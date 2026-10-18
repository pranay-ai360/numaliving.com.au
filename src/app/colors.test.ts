/**
 * Keeps the gold readable. Gold on white is 3.1:1, which WCAG AA rejects for the small text and the
 * buttons that carry it (4.5:1), so small gold text and the fill of the solid buttons use the dark
 * gold (`gold-dark`), light gold (`gold`) stays for large text and for text on the dark ink bands, and
 * this test fails when a new class brings the light gold back onto a light background.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { brandColor, GLOBALS_CSS, textColorName } from "@/lib/brandColors";
import { contrastRatio } from "@/lib/contrast";

/** WCAG AA: 4.5:1 for text under 24 px (18.66 px bold), 3:1 for larger text. */
const SMALL_TEXT = 4.5;
const LARGE_TEXT = 3;

type TextPair = Readonly<{ text: string; on: string; minimum: number; where: string }>;

/** The text and background colors the site actually pairs, each with where it is used. */
const TEXT_PAIRS: readonly TextPair[] = [
  { text: "gold-dark", on: "paper", minimum: SMALL_TEXT, where: "small gold text, outline buttons and the Show all summary on white" },
  { text: "gold-dark", on: "linen", minimum: SMALL_TEXT, where: "eyebrows and numerals on the linen bands" },
  { text: "gold-dark", on: "gold-soft", minimum: SMALL_TEXT, where: "the Draft notice and the Thank You panel" },
  { text: "paper", on: "gold-dark", minimum: SMALL_TEXT, where: "the label of the solid buttons, the active filter chip and the step numbers" },
  { text: "gold", on: "ink", minimum: SMALL_TEXT, where: "gold text on the footer and the dark process band" },
  { text: "paper", on: "ink", minimum: SMALL_TEXT, where: "white text on the dark bands" },
  { text: "ink", on: "paper", minimum: SMALL_TEXT, where: "body text" },
  { text: "ink", on: "linen", minimum: SMALL_TEXT, where: "body text on the linen bands" },
  { text: "ink", on: "gold-soft", minimum: SMALL_TEXT, where: "text in the Draft notice" },
  { text: "ink-muted", on: "paper", minimum: SMALL_TEXT, where: "secondary text" },
  { text: "ink-muted", on: "linen", minimum: SMALL_TEXT, where: "secondary text on the linen bands" },
  { text: "ink-muted", on: "gold-soft", minimum: SMALL_TEXT, where: "secondary text in the Preview ribbon" },
  { text: "gold", on: "paper", minimum: LARGE_TEXT, where: "the 24 px figures on the home page: large text only" },
];

describe("the brand colors that carry text", () => {
  it.each(TEXT_PAIRS.map((pair) => [`${pair.text} on ${pair.on}`, pair] as const))("%s reads well enough", (_label, pair) => {
    // Arrange
    const ratio = contrastRatio(brandColor(pair.text), brandColor(pair.on));

    // Act
    const isEnough = ratio >= pair.minimum;

    // Assert
    expect(isEnough, `${pair.text} on ${pair.on} is ${ratio.toFixed(2)}:1 and needs ${pair.minimum}:1 (${pair.where})`).toBe(true);
  });

  it("paints the eyebrows, the small gold labels on every page, in a color that reads on white, linen and the cream tint", () => {
    // Arrange
    const eyebrow = brandColor(textColorName(".eyebrow"));
    const surfaces = ["paper", "linen", "gold-soft"];

    // Act
    const ratios = surfaces.map((surface) => ({ surface, ratio: contrastRatio(eyebrow, brandColor(surface)) }));

    // Assert
    expect(ratios.filter(({ ratio }) => ratio < SMALL_TEXT)).toEqual([]);
  });

  it("has a gold-dark that is darker than gold, so it can stand in for it", () => {
    // Arrange
    const [gold, goldDark] = [brandColor("gold"), brandColor("gold-dark")];

    // Act
    const onWhite = [gold, goldDark].map((color) => contrastRatio(color, brandColor("paper")));

    // Assert
    expect(onWhite[1]).toBeGreaterThan(onWhite[0]);
  });
});

const SOURCE_ROOT = path.join(process.cwd(), "src");

/** Every .tsx file under src that is not a test, as a path below the repository root with "/". */
function componentFiles(folder: string = SOURCE_ROOT): readonly string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return componentFiles(full);
    return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx") ? [path.relative(process.cwd(), full).split(path.sep).join("/")] : [];
  });
}

/** The light gold as text: `text-gold`, `hover:text-gold` and `group-hover:text-gold`, but not `text-gold-dark`, `text-gold-soft` or `text-gold/25`. */
const LIGHT_GOLD_TEXT = /(?<![\w-])text-gold(?![\w/-])/g;

/** `bg-gold` and `text-white` as they rest, not in a hover or other variant (those are matched by the hover pair below). */
const RESTING_LIGHT_GOLD_FILL = /(?<![\w:-])bg-gold(?![\w/-])/;
const RESTING_WHITE_TEXT = /(?<![\w:-])text-white(?![\w/-])/;
const HOVER_LIGHT_GOLD_FILL = /(?<![\w-])hover:bg-gold(?![\w/-])/;
const HOVER_WHITE_TEXT = /(?<![\w-])hover:text-white(?![\w/-])/;

/** True for a line of source that paints white text on the light gold (3.1:1), at rest or on hover. */
function paintsWhiteOnLightGold(line: string): boolean {
  return (RESTING_LIGHT_GOLD_FILL.test(line) && RESTING_WHITE_TEXT.test(line)) || (HOVER_LIGHT_GOLD_FILL.test(line) && HOVER_WHITE_TEXT.test(line));
}

/** Where the light gold may still be text, and why; the count is the most uses the file may have. */
const LIGHT_GOLD_TEXT_ALLOWED: Readonly<Record<string, Readonly<{ uses: number; why: string }>>> = {
  "src/components/Brand.tsx": { uses: 1, why: "the logo wordmark: a logotype has no contrast requirement" },
  "src/components/Chrome.tsx": { uses: 8, why: "the footer, on the dark ink band (5.6:1): its links, group name and eyebrows" },
  "src/app/page.tsx": { uses: 4, why: "24 px figures on white (large text needs 3:1) and the dark process band (5.6:1)" },
  "src/app/process/page.tsx": { uses: 1, why: "the eyebrow in the dark client portal box (5.6:1)" },
};

function sourceOf(file: string): string {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("the gold classes in the components", () => {
  const files = componentFiles();

  it("finds the components, so the scans below are not passing on nothing", () => {
    // Arrange
    const found = files.length;

    // Act
    const hasKnown = files.includes("src/components/ui.tsx") && files.includes("src/app/page.tsx");

    // Assert
    expect(found).toBeGreaterThan(20);
    expect(hasKnown).toBe(true);
  });

  it("uses the light gold for text only where it reads: large figures, the dark bands and the logo", () => {
    // Arrange
    const uses = files.map((file) => ({ file, count: (sourceOf(file).match(LIGHT_GOLD_TEXT) ?? []).length }));

    // Act
    const tooMany = uses.filter(({ file, count }) => count > (LIGHT_GOLD_TEXT_ALLOWED[file]?.uses ?? 0));

    // Assert
    expect(
      tooMany.map(({ file, count }) => `${file}: ${count} uses of text-gold (allowed ${LIGHT_GOLD_TEXT_ALLOWED[file]?.uses ?? 0}). Light gold is 3.1:1 on white; use text-gold-dark for small text, or list the file in LIGHT_GOLD_TEXT_ALLOWED with the reason.`),
    ).toEqual([]);
  });

  it("puts white text only on the dark gold, never on the light gold (3.1:1)", () => {
    // Arrange
    const lines = files.flatMap((file) => sourceOf(file).split("\n").map((text, index) => ({ place: `${file}:${index + 1}`, text })));

    // Act
    const offenders = lines.filter(({ text }) => paintsWhiteOnLightGold(text));

    // Assert
    expect(offenders.map(({ place }) => place)).toEqual([]);
  });

  it("knows the light-gold allowance is a list of real files", () => {
    // Arrange
    const listed = Object.keys(LIGHT_GOLD_TEXT_ALLOWED);

    // Act
    const missing = listed.filter((file) => !files.includes(file));

    // Assert
    expect(missing).toEqual([]);
  });
});

describe("paintsWhiteOnLightGold", () => {
  it.each([
    ["white text on the light gold at rest", 'className="bg-gold px-4 text-white"'],
    ["white text on the light gold on hover", 'className="border-gold text-gold-dark hover:bg-gold hover:text-white"'],
    ["the old solid button", 'solid: "bg-gold text-white hover:bg-gold-dark"'],
  ])("flags %s", (_label, line) => {
    // Arrange
    // (the table supplies the line)

    // Act
    const isFlagged = paintsWhiteOnLightGold(line);

    // Assert
    expect(isFlagged).toBe(true);
  });

  it.each([
    ["white text on the dark gold", 'className="bg-gold-dark px-4 text-white"'],
    ["dark text on the light gold on hover", 'className="bg-gold-dark text-white hover:bg-gold hover:text-ink"'],
    ["a line of gold at 40% with white text", 'className="bg-gold/40 text-white"'],
    ["the cream tint", 'className="bg-gold-soft text-white"'],
    ["a hover that only changes the fill", 'className="text-white enabled:hover:bg-gold enabled:hover:text-ink"'],
  ])("lets through %s", (_label, line) => {
    // Arrange
    // (the table supplies the line)

    // Act
    const isFlagged = paintsWhiteOnLightGold(line);

    // Assert
    expect(isFlagged).toBe(false);
  });
});

describe("the global styles", () => {
  it("stop smooth scrolling for people who prefer less motion", () => {
    // Arrange
    const css = GLOBALS_CSS;

    // Act
    const hasOverride = /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*html\s*\{\s*scroll-behavior:\s*auto;?\s*\}/.test(css);

    // Assert
    expect(hasOverride).toBe(true);
  });
});
