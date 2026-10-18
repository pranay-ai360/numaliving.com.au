/**
 * Runs the real pipeline (scripts/optimize-images.mjs) on a throwaway folder with small synthetic
 * photos, so what it promises (right sizes, no metadata, nothing enlarged, the same bytes every time,
 * nothing remade when nothing changed) is checked without touching the repository's photos.
 */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildImages, inspectImages } from "../../scripts/optimize-images.mjs";

const ALPHA_01 = "public/projects/alpha/alpha-01.jpg";
const ALPHA_02 = "public/projects/alpha/alpha-02.jpg";
const MANIFEST = "scripts/images.manifest.json";
const OPTIONS = { defaultOgSource: ALPHA_01 };

/** A smooth colour ramp that differs with the seed: cheap to encode, and no two seeds give the same bytes. */
async function makePhoto(width: number, height: number, seed: number, options: { orientation?: number; copyright?: string } = {}): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let index = 0; index < pixels.length; index += 1) {
    const pixel = Math.floor(index / 3);
    const [x, y, channel] = [pixel % width, Math.floor(pixel / width), index % 3];
    pixels[index] = Math.floor(((x / width) * 160 + (y / height) * 60 + seed * 23 + channel * 40) % 256);
  }
  let image = sharp(pixels, { raw: { width, height, channels: 3 } });
  if (options.orientation !== undefined) image = image.withMetadata({ orientation: options.orientation });
  if (options.copyright !== undefined) image = image.withExif({ IFD0: { Copyright: options.copyright } });
  return image.jpeg({ quality: 90 }).toBuffer();
}

async function writeUnder(root: string, file: string, bytes: Buffer | string): Promise<void> {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), bytes);
}

async function filesUnder(root: string, relativeDir: string): Promise<readonly string[]> {
  const entries = await readdir(path.join(root, relativeDir), { withFileTypes: true, recursive: true }).catch(() => []);
  return entries.filter((entry) => entry.isFile()).map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join("/")).sort();
}

async function sha256Of(root: string, file: string): Promise<string> {
  return createHash("sha256").update(await readFile(path.join(root, file))).digest("hex");
}

async function mtimeOf(root: string, file: string): Promise<number> {
  return (await stat(path.join(root, file))).mtimeMs;
}

const roots: string[] = [];

async function newRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "numa-images-"));
  roots.push(root);
  return root;
}

/** A project with two photos: a wide one, and a narrow one that must not be enlarged. */
async function projectRoot(): Promise<string> {
  const root = await newRoot();
  await writeUnder(root, ALPHA_01, await makePhoto(1000, 700, 1));
  await writeUnder(root, ALPHA_02, await makePhoto(500, 340, 2));
  return root;
}

beforeEach(() => {
  roots.length = 0;
});

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

/** Encoding AVIF is slow on a small CI runner, so these tests get far more than the default five seconds. */
const SLOW_TEST_TIMEOUT_MS = 60_000;

describe("buildImages", { timeout: SLOW_TEST_TIMEOUT_MS }, () => {
  it("writes an AVIF and a WebP at every width that fits each photo, and never enlarges one", async () => {
    // Arrange
    const root = await projectRoot();

    // Act
    await buildImages({ root, ...OPTIONS });

    // Assert
    const projectFiles = (await filesUnder(root, "public/projects/alpha")).filter((file) => !file.endsWith(".jpg"));
    expect(projectFiles).toEqual([
      "public/projects/alpha/alpha-01-480.avif",
      "public/projects/alpha/alpha-01-480.webp",
      "public/projects/alpha/alpha-01-800.avif",
      "public/projects/alpha/alpha-01-800.webp",
      "public/projects/alpha/alpha-02-480.avif",
      "public/projects/alpha/alpha-02-480.webp",
    ]);
  });

  it("gives each variant the width in its name and the photo's proportions", async () => {
    // Arrange
    const root = await projectRoot();

    // Act
    await buildImages({ root, ...OPTIONS });
    const avif = await sharp(path.join(root, "public/projects/alpha/alpha-01-800.avif")).metadata();
    const webp = await sharp(path.join(root, "public/projects/alpha/alpha-01-480.webp")).metadata();

    // Assert
    expect([avif.width, avif.height]).toEqual([800, 560]);
    expect([webp.width, webp.height]).toEqual([480, 336]);
  });

  it("cuts a 1200 x 630 share image for the project and one for the whole site", async () => {
    // Arrange
    const root = await projectRoot();

    // Act
    await buildImages({ root, ...OPTIONS });
    const sizes = await Promise.all(["public/og/alpha.jpg", "public/og/default.jpg"].map((file) => sharp(path.join(root, file)).metadata()));

    // Assert
    expect(sizes.map((size) => [size.width, size.height, size.format])).toEqual([
      [1200, 630, "jpeg"],
      [1200, 630, "jpeg"],
    ]);
  });

  it("strips every piece of metadata, such as the photographer's name", async () => {
    // Arrange
    const root = await newRoot();
    await writeUnder(root, ALPHA_01, await makePhoto(900, 600, 3, { copyright: "A. Photographer" }));

    // Act
    await buildImages({ root, ...OPTIONS });
    const metadata = await Promise.all(
      ["public/projects/alpha/alpha-01-480.avif", "public/projects/alpha/alpha-01-800.webp", "public/og/alpha.jpg"].map((file) => sharp(path.join(root, file)).metadata()),
    );

    // Assert
    expect(metadata.filter((entry) => entry.exif !== undefined)).toEqual([]);
    expect((await sharp(path.join(root, ALPHA_01)).metadata()).exif).toBeDefined();
  });

  it("applies the photo's rotation tag before stripping it, so a turned photo is not shown on its side", async () => {
    // Arrange
    const root = await newRoot();
    await writeUnder(root, ALPHA_01, await makePhoto(900, 600, 4, { orientation: 6 }));

    // Act
    await buildImages({ root, ...OPTIONS });
    const variant = await sharp(path.join(root, "public/projects/alpha/alpha-01-480.avif")).metadata();

    // Assert
    expect([variant.width, variant.height]).toEqual([480, 720]);
  });

  it("leaves the source photos exactly as they were", async () => {
    // Arrange
    const root = await projectRoot();
    const before = await Promise.all([ALPHA_01, ALPHA_02].map((file) => sha256Of(root, file)));

    // Act
    await buildImages({ root, ...OPTIONS });

    // Assert
    expect(await Promise.all([ALPHA_01, ALPHA_02].map((file) => sha256Of(root, file)))).toEqual(before);
  });

  it("makes the same bytes every time, wherever it runs", async () => {
    // Arrange
    const photo = await makePhoto(900, 600, 5);
    const [first, second] = [await newRoot(), await newRoot()];
    await Promise.all([first, second].map((root) => writeUnder(root, ALPHA_01, photo)));

    // Act
    await Promise.all([first, second].map((root) => buildImages({ root, ...OPTIONS })));
    const files = (await filesUnder(first, "public")).filter((file) => !file.endsWith("alpha-01.jpg"));
    const [hashesFirst, hashesSecond] = await Promise.all([first, second].map((root) => Promise.all(files.map((file) => sha256Of(root, file)))));

    // Assert
    expect(files.length).toBeGreaterThan(4);
    expect(hashesSecond).toEqual(hashesFirst);
    expect(await readFile(path.join(second, MANIFEST), "utf8")).toBe(await readFile(path.join(first, MANIFEST), "utf8"));
  });

  it("makes nothing on a second run, and does not touch a file", async () => {
    // Arrange
    const root = await projectRoot();
    await buildImages({ root, ...OPTIONS });
    const before = await mtimeOf(root, "public/projects/alpha/alpha-01-800.avif");

    // Act
    const result = await buildImages({ root, ...OPTIONS });

    // Assert
    expect(result.made).toBe(0);
    expect(result.removed).toBe(0);
    expect(await mtimeOf(root, "public/projects/alpha/alpha-01-800.avif")).toBe(before);
  });

  it("makes again only the files of a photo that changed", async () => {
    // Arrange
    const root = await projectRoot();
    await buildImages({ root, ...OPTIONS });
    const untouched = await mtimeOf(root, "public/projects/alpha/alpha-01-800.avif");
    await writeUnder(root, ALPHA_02, await makePhoto(500, 340, 99));

    // Act
    const result = await buildImages({ root, ...OPTIONS });

    // Assert
    expect(result.made).toBe(2);
    expect(await mtimeOf(root, "public/projects/alpha/alpha-01-800.avif")).toBe(untouched);
  });

  it("makes a file again when it has gone missing", async () => {
    // Arrange
    const root = await projectRoot();
    await buildImages({ root, ...OPTIONS });
    await rm(path.join(root, "public/projects/alpha/alpha-01-480.webp"));

    // Act
    const result = await buildImages({ root, ...OPTIONS });

    // Assert
    expect(result.made).toBe(1);
    expect(await filesUnder(root, "public/projects/alpha")).toContain("public/projects/alpha/alpha-01-480.webp");
  });

  it("makes every file again when asked to force it", async () => {
    // Arrange
    const root = await projectRoot();
    const first = await buildImages({ root, ...OPTIONS });

    // Act
    const forced = await buildImages({ root, mode: "force", ...OPTIONS });

    // Assert
    expect(forced.made).toBe(first.made);
    expect(forced.unchanged).toBe(0);
  });

  it("removes the copies of a photo that has been renamed or deleted", async () => {
    // Arrange
    const root = await projectRoot();
    await buildImages({ root, ...OPTIONS });
    await rm(path.join(root, ALPHA_02));

    // Act
    const result = await buildImages({ root, ...OPTIONS });

    // Assert
    expect(result.removed).toBe(2);
    expect((await filesUnder(root, "public/projects/alpha")).filter((file) => file.includes("alpha-02"))).toEqual([]);
  });

  it("only reports in check mode: it writes nothing and names what is missing", async () => {
    // Arrange
    const root = await projectRoot();

    // Act
    const result = await buildImages({ root, mode: "check", ...OPTIONS });

    // Assert
    expect(result.made).toBe(0);
    expect(result.comparison.missing.length).toBeGreaterThan(0);
    expect(await filesUnder(root, "public/og")).toEqual([]);
  });

  it("finds nothing to report in check mode right after a build", async () => {
    // Arrange
    const root = await projectRoot();
    await buildImages({ root, ...OPTIONS });

    // Act
    const { comparison } = await inspectImages(root, OPTIONS);

    // Assert
    expect(comparison).toEqual({ missing: [], stale: [], orphaned: [] });
  });

  it("refuses a photo whose name would break on a case-sensitive server, and says how to rename it", async () => {
    // Arrange
    const root = await newRoot();
    await writeUnder(root, ALPHA_01, await makePhoto(900, 600, 6));
    await writeUnder(root, "public/projects/alpha/DSC00614.JPG", await makePhoto(900, 600, 7));

    // Act
    const act = buildImages({ root, ...OPTIONS });

    // Assert
    await expect(act).rejects.toThrow(/DSC00614\.JPG: rename it in lower case with hyphens and a \.jpg ending \(for example alpha-01\.jpg\)/);
  });

  it("refuses a photo that is not in a folder of its own project", async () => {
    // Arrange
    const root = await newRoot();
    await writeUnder(root, ALPHA_01, await makePhoto(900, 600, 8));
    await writeUnder(root, "public/projects/loose-01.jpg", await makePhoto(900, 600, 9));

    // Act
    const act = buildImages({ root, ...OPTIONS });

    // Assert
    await expect(act).rejects.toThrow(/put each photo directly in public\/projects\/<project-slug>\//);
  });

  it("refuses a file that is not a readable image, and names it", async () => {
    // Arrange
    const root = await newRoot();
    await writeUnder(root, ALPHA_01, "this is not a photo");

    // Act
    const act = buildImages({ root, ...OPTIONS });

    // Assert
    await expect(act).rejects.toThrow(/alpha-01\.jpg is not a readable image/);
  });

  it("refuses a record that is not valid JSON, and says how to fix it", async () => {
    // Arrange
    const root = await projectRoot();
    await writeUnder(root, MANIFEST, "{ not json");

    // Act
    const act = buildImages({ root, ...OPTIONS });

    // Assert
    await expect(act).rejects.toThrow(/images\.manifest\.json is not valid JSON .* run npm run images:build/i);
  });
});
