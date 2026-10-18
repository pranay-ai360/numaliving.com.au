/**
 * The project photos in src/content/projects.ts against the files in public/: every photo is where
 * it says, is named so that GitHub Pages can serve it, has all its fast copies and a share image,
 * has an honest description of its own, and those copies are up to date with the photo.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { getProject, projects } from "@/content/projects";
import { PHOTO_FORMATS, variantPath, variantWidths } from "@/lib/photoVariants";
import { OG_SIZE } from "../../scripts/image-plan.mjs";
import { inspectImages } from "../../scripts/optimize-images.mjs";

// Vitest runs from the repository root (npm test, npm run test:coverage).
const REPO_ROOT = process.cwd();
const PUBLIC_DIR = path.join(REPO_ROOT, "public");

/** The shortest and longest description of a picture, in words. */
const MIN_ALT_WORDS = 8;
const MAX_ALT_WORDS = 20;

const allPhotos = projects.flatMap((project) => project.photos.map((photo) => ({ project, photo })));

function publicFile(sitePath: string): string {
  return path.join(PUBLIC_DIR, sitePath);
}

function filesBelow(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(PUBLIC_DIR, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

/** These tests open every photo and copy (270 files), which a small CI runner does more slowly than a laptop. */
const DISK_TEST_TIMEOUT_MS = 30_000;

describe("project photos", { timeout: DISK_TEST_TIMEOUT_MS }, () => {
  it("has a gallery of real photos for the four projects that have them", () => {
    // Arrange
    const withPhotos = projects.filter((project) => project.photos.length > 0).map((project) => project.slug);

    // Act
    const [first] = projects;

    // Assert
    expect(withPhotos).toEqual(["marina-villa", "sonate", "penthouse25", "golf-links"]);
    expect(first.photos.length).toBeGreaterThan(0);
  });

  it("names each photo <project-slug>-<nn>.jpg in its project's folder, numbered from 01 in the order shown", () => {
    // Arrange
    const expected = (slug: string, count: number): readonly string[] =>
      Array.from({ length: count }, (_, index) => `/projects/${slug}/${slug}-${String(index + 1).padStart(2, "0")}.jpg`);

    // Act
    const mismatches = projects.filter((project) => JSON.stringify(project.photos.map((photo) => photo.src)) !== JSON.stringify(expected(project.slug, project.photos.length)));

    // Assert
    expect(mismatches.map((project) => project.slug)).toEqual([]);
  });

  it("has every photo file where the content says, with the size the content says", async () => {
    // Arrange
    const problems: string[] = [];

    // Act
    for (const { photo } of allPhotos) {
      const metadata = await sharp(publicFile(photo.src)).metadata().catch(() => undefined);
      if (metadata === undefined) problems.push(`${photo.src} is missing or unreadable`);
      else if (metadata.width !== photo.width || metadata.height !== photo.height) problems.push(`${photo.src} is ${metadata.width} x ${metadata.height}, not ${photo.width} x ${photo.height}`);
    }

    // Assert
    expect(problems).toEqual([]);
  });

  it("describes every photo in its own words, between 8 and 20 of them", () => {
    // Arrange
    const alts = allPhotos.map(({ photo }) => photo.alt);

    // Act
    const outOfRange = alts.filter((alt) => wordCount(alt) < MIN_ALT_WORDS || wordCount(alt) > MAX_ALT_WORDS);

    // Assert
    expect(alts.every((alt) => alt.trim() !== "")).toBe(true);
    expect(outOfRange).toEqual([]);
  });

  it("gives no two photos the same description", () => {
    // Arrange
    const alts = allPhotos.map(({ photo }) => photo.alt.trim().toLowerCase());

    // Act
    const repeated = alts.filter((alt, index) => alts.indexOf(alt) !== index);

    // Assert
    expect(repeated).toEqual([]);
  });

  it("describes a picture rather than naming the project or the company", () => {
    // Arrange
    const names = [...projects.map((project) => project.name.toLowerCase()), "numa"];

    // Act
    const offenders = allPhotos.filter(({ photo }) => names.some((name) => photo.alt.toLowerCase().includes(name)));

    // Assert
    expect(offenders.map(({ photo }) => photo.src)).toEqual([]);
  });

  it("has an AVIF and a WebP copy of every photo at every width that fits it, and no copy that does not fit", async () => {
    // Arrange
    const missing: string[] = [];

    // Act
    for (const { photo } of allPhotos) {
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

  it("has a 1200 x 630 share image for every project with photos, and one for the whole site", async () => {
    // Arrange
    const slugs = ["default", ...projects.filter((project) => project.photos.length > 0).map((project) => project.slug)];

    // Act
    const sizes = await Promise.all(slugs.map(async (slug) => ({ slug, metadata: await sharp(publicFile(`/og/${slug}.jpg`)).metadata().catch(() => undefined) })));

    // Assert
    expect(sizes.filter(({ metadata }) => metadata?.width !== OG_SIZE.width || metadata?.height !== OG_SIZE.height).map(({ slug }) => slug)).toEqual([]);
  });

  it("has no photo file that the content does not use", () => {
    // Arrange
    const used = new Set(allPhotos.map(({ photo }) => photo.src.replace(/^\//, "")));

    // Act
    const unused = filesBelow(path.join(PUBLIC_DIR, "projects")).filter((file) => file.endsWith(".jpg") && !used.has(file));

    // Assert
    expect(unused).toEqual([]);
  });

  it("uses only lower-case letters, digits and hyphens in photo file names, because GitHub Pages is case-sensitive", () => {
    // Arrange
    const files = filesBelow(path.join(PUBLIC_DIR, "projects"));

    // Act
    const offenders = files.filter((file) => /[A-Z\s]/.test(file));

    // Assert
    expect(files.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it("has copies and share images that are up to date with the photos, so none was changed without running npm run images:build", async () => {
    // Arrange
    const { comparison } = await inspectImages(REPO_ROOT);

    // Act
    const problems = [...comparison.missing, ...comparison.stale, ...comparison.orphaned];

    // Assert
    expect(problems, "run `npm run images:build` and commit the result").toEqual([]);
  });
});

describe("getProject", () => {
  it("finds a project by its slug", () => {
    // Arrange
    const slug = "golf-links";

    // Act
    const project = getProject(slug);

    // Assert
    expect(project?.slug).toBe(slug);
  });

  it("finds nothing for a slug that no project has", () => {
    // Arrange
    const slug = "no-such-project";

    // Act
    const project = getProject(slug);

    // Assert
    expect(project).toBeUndefined();
  });
});
