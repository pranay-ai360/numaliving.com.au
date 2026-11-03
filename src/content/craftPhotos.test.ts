/**
 * The craft and factory photos in src/content/pages.ts against the files in public/craft: each is named so
 * that GitHub Pages can serve it, is as big as the content says, has all its fast copies, and has a
 * description of its own. The pipeline that makes the copies is scripts/optimize-images.mjs.
 */
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { craft, factory } from "@/content/pages";
import { PHOTO_FORMATS, variantPath, variantWidths } from "@/lib/photoVariants";

// Vitest runs from the repository root (npm test, npm run test:coverage).
const PUBLIC_DIR = path.join(process.cwd(), "public");

const CRAFT_PATH = /^\/craft\/[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/;

/** The shortest and longest description of a picture, in words, as for the project photos. */
const MIN_ALT_WORDS = 8;
const MAX_ALT_WORDS = 20;

/** These tests open every photo and copy, which a small CI runner does more slowly than a laptop. */
const DISK_TEST_TIMEOUT_MS = 30_000;

/** The photos that have a file; one without a source shows a placeholder and has nothing to check. */
const photos = [...craft, factory.photo].filter((photo) => photo.src !== "");

function publicFile(sitePath: string): string {
  return path.join(PUBLIC_DIR, sitePath);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

describe("craft and factory photos", { timeout: DISK_TEST_TIMEOUT_MS }, () => {
  it("has the six photos of the Capabilities page", () => {
    // Arrange
    const expected = 6;

    // Act
    const count = photos.length;

    // Assert
    expect(count).toBe(expected);
  });

  it("names each photo in lower case with hyphens, directly in /craft/", () => {
    // Arrange
    const sources = photos.map((photo) => photo.src);

    // Act
    const misnamed = sources.filter((src) => !CRAFT_PATH.test(src));

    // Assert
    expect(misnamed).toEqual([]);
  });

  it("lists no photo twice", () => {
    // Arrange
    const sources = photos.map((photo) => photo.src);

    // Act
    const repeated = sources.filter((src, index) => sources.indexOf(src) !== index);

    // Assert
    expect(repeated).toEqual([]);
  });

  it("gives each photo the size in pixels that its file really has", async () => {
    // Arrange
    const problems: string[] = [];

    // Act
    for (const photo of photos) {
      const metadata = await sharp(publicFile(photo.src)).metadata().catch(() => undefined);
      if (metadata === undefined) problems.push(`${photo.src} is missing or unreadable`);
      else if (metadata.width !== photo.width || metadata.height !== photo.height) problems.push(`${photo.src} is ${metadata.width} x ${metadata.height}, not ${photo.width} x ${photo.height}`);
    }

    // Assert
    expect(problems).toEqual([]);
  });

  it("has an AVIF and a WebP copy of every photo at every width that fits it", async () => {
    // Arrange
    const missing: string[] = [];

    // Act
    for (const photo of photos) {
      for (const width of variantWidths(photo.width)) {
        for (const format of PHOTO_FORMATS) {
          const copy = variantPath(photo.src, width, format);
          const metadata = await sharp(publicFile(copy)).metadata().catch(() => undefined);
          if (metadata === undefined || metadata.width !== width) missing.push(copy);
        }
      }
    }

    // Assert
    expect(missing).toEqual([]);
  });

  it("describes each photo in 8 to 20 words, and no two the same", () => {
    // Arrange
    const alts = photos.map((photo) => photo.alt.trim());

    // Act
    const outOfRange = alts.filter((alt) => wordCount(alt) < MIN_ALT_WORDS || wordCount(alt) > MAX_ALT_WORDS);
    const repeated = alts.filter((alt, index) => alts.map((other) => other.toLowerCase()).indexOf(alt.toLowerCase()) !== index);

    // Assert
    expect(outOfRange).toEqual([]);
    expect(repeated).toEqual([]);
  });
});
