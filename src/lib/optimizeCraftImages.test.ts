/**
 * The craft and factory photos in public/craft get their AVIF and WebP copies from the same pipeline as
 * the project photos (scripts/optimize-images.mjs). This runs the real pipeline on a throwaway folder
 * with small synthetic photos. A craft photo gets copies only: no page of its own is shared, so no share image.
 */
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildImages, inspectImages } from "../../scripts/optimize-images.mjs";

const PROJECT_PHOTO = "public/projects/alpha/alpha-01.jpg";
const CRAFT_PHOTO = "public/craft/spray-booth.jpg";
const MANIFEST = "scripts/images.manifest.json";
const OPTIONS = { defaultOgSource: PROJECT_PHOTO };

/** Encoding AVIF is slow on a small CI runner, so these tests get far more than the default. */
const DISK_TEST_TIMEOUT_MS = 60_000;

async function solidPhoto(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 90, b: 60 } } }).jpeg().toBuffer();
}

async function writeUnder(root: string, file: string, bytes: Buffer): Promise<void> {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), bytes);
}

async function filesUnder(root: string, relativeDir: string): Promise<readonly string[]> {
  const entries = await readdir(path.join(root, relativeDir), { withFileTypes: true, recursive: true }).catch(() => []);
  return entries.filter((entry) => entry.isFile()).map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join("/")).sort();
}

const roots: string[] = [];

/** A project photo (the site-wide share image needs one) and a craft photo 1000 px wide, which gets the 480 and 800 px copies. */
async function craftRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "numa-craft-"));
  roots.push(root);
  await writeUnder(root, PROJECT_PHOTO, await solidPhoto(1000, 700));
  await writeUnder(root, CRAFT_PHOTO, await solidPhoto(1000, 700));
  return root;
}

beforeEach(() => {
  roots.length = 0;
});

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

describe("the craft photos in public/craft", { timeout: DISK_TEST_TIMEOUT_MS }, () => {
  it("get an AVIF and a WebP at every width that fits, next to the photo", async () => {
    // Arrange
    const root = await craftRoot();

    // Act
    await buildImages({ root, ...OPTIONS });

    // Assert
    expect(await filesUnder(root, "public/craft")).toEqual([
      "public/craft/spray-booth-480.avif",
      "public/craft/spray-booth-480.webp",
      "public/craft/spray-booth-800.avif",
      "public/craft/spray-booth-800.webp",
      "public/craft/spray-booth.jpg",
    ]);
  });

  it("get no share image, only the project's and the site's own", async () => {
    // Arrange
    const root = await craftRoot();

    // Act
    await buildImages({ root, ...OPTIONS });

    // Assert
    expect(await filesUnder(root, "public/og")).toEqual(["public/og/alpha.jpg", "public/og/default.jpg"]);
  });

  it("are recorded in the manifest, so a change to a photo is noticed", async () => {
    // Arrange
    const root = await craftRoot();

    // Act
    await buildImages({ root, ...OPTIONS });
    const manifest = JSON.parse(await readFile(path.join(root, MANIFEST), "utf8")) as { sources: Record<string, string> };

    // Assert
    expect(Object.keys(manifest.sources)).toContain(CRAFT_PHOTO);
  });

  it("are reported by a check when one of their copies is missing", async () => {
    // Arrange
    const root = await craftRoot();
    await buildImages({ root, ...OPTIONS });
    await rm(path.join(root, "public/craft/spray-booth-800.webp"));

    // Act
    const { comparison } = await inspectImages(root, OPTIONS);

    // Assert
    expect(comparison).toEqual({ missing: ["public/craft/spray-booth-800.webp"], stale: [], orphaned: [] });
  });

  it("lose their copies when the photo is deleted, so nothing is left over", async () => {
    // Arrange
    const root = await craftRoot();
    await buildImages({ root, ...OPTIONS });
    await rm(path.join(root, CRAFT_PHOTO));

    // Act
    const result = await buildImages({ root, ...OPTIONS });

    // Assert
    expect(result.removed).toBe(4);
    expect(await filesUnder(root, "public/craft")).toEqual([]);
  });

  it("are refused when the name is not lower case with hyphens", async () => {
    // Arrange
    const root = await craftRoot();
    await writeUnder(root, "public/craft/Spray Booth.jpg", await solidPhoto(600, 400));

    // Act
    const act = buildImages({ root, ...OPTIONS });

    // Assert
    await expect(act).rejects.toThrow(/public\/craft\/Spray Booth\.jpg: rename it in lower case with hyphens and a \.jpg ending \(for example spray-booth\.jpg\)/);
  });

  it("are refused in a sub-folder: each goes directly in public/craft/", async () => {
    // Arrange
    const root = await craftRoot();
    await writeUnder(root, "public/craft/more/veneer.jpg", await solidPhoto(600, 400));

    // Act
    const act = buildImages({ root, ...OPTIONS });

    // Assert
    await expect(act).rejects.toThrow(/public\/craft\/more\/veneer\.jpg: put each photo directly in public\/craft\//);
  });
});
