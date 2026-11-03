/**
 * The plan for the photo pipeline (scripts/optimize-images.mjs): which files each source photo
 * produces, how they are named, and how to tell whether they are up to date. Pure functions with no
 * file access and no sharp, so the unit tests (src/lib/imagePlan.test.ts) can check them and the page
 * code (src/lib/photoVariants.ts, checked against this file) can rely on the same names.
 *
 * Paths here are relative to the repository root and use "/", for example
 * "public/projects/golf-links/golf-links-01.jpg".
 */
import { createHash } from "node:crypto";

/** Where the source photos live, one folder per project: public/projects/<project-slug>/<project-slug>-<nn>.jpg. */
export const PROJECTS_DIR = "public/projects";

/**
 * Where the craft and factory photos live, directly in the folder: public/craft/<name>.jpg. They get their
 * AVIF and WebP copies like the project photos, but no share image: no page of their own is shared.
 */
export const CRAFT_DIR = "public/craft";

/** Where the 1200 x 630 share images go. */
export const OG_DIR = "public/og";

/** The record of what the generated files were made from, committed so a test can tell when they are out of date. */
export const MANIFEST_PATH = "scripts/images.manifest.json";

/** Widths a photo is offered in. The largest is the full width of the sources (1600 px); nothing is ever enlarged. */
export const VARIANT_WIDTHS = Object.freeze([480, 800, 1200, 1600]);

export const VARIANT_FORMATS = Object.freeze(["avif", "webp"]);

/** Encoder settings. AVIF at 60 is visually the same as the JPEG at about a fifth of its size. */
export const ENCODER_SETTINGS = Object.freeze({
  avif: Object.freeze({ quality: 60, effort: 4 }),
  webp: Object.freeze({ quality: 78, effort: 4 }),
  og: Object.freeze({ quality: 78, mozjpeg: true }),
});

export const OG_SIZE = Object.freeze({ width: 1200, height: 630 });

/** Share images are cut from the middle: the saliency crop ("attention") cut the furniture off the villa's living room. */
export const OG_CROP_POSITION = "centre";

/** The photo the site-wide share image (public/og/default.jpg) is cut from. Its description is DEFAULT_OG_IMAGE.alt in src/lib/seo/metadata.ts. */
export const DEFAULT_OG_SOURCE = `${PROJECTS_DIR}/marina-villa/marina-villa-01.jpg`;

const DEFAULT_OG_NAME = "default";

/** Bump when the way files are made changes in a way the settings above do not show, so every file is made again. */
const PIPELINE_VERSION = 1;

const SOURCE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/;
const JPEG_EXTENSION = /\.jpe?g$/i;

/**
 * @typedef {{ path: string, width: number, sha256: string }} SourcePhoto
 *   A source photo: its path, its width in pixels and the SHA-256 of its bytes.
 * @typedef {{ output: string, source: string, kind: "variant" | "og", width?: number, format?: string }} PlannedOutput
 *   One file the pipeline makes, and the source photo it is made from.
 * @typedef {{ settings: string, sources: Record<string, string> }} Manifest
 *   What the generated files were made from: a fingerprint of the settings, and each photo's SHA-256.
 */

/**
 * Lower-case letters and digits, joined by single hyphens, ending in ".jpg". GitHub Pages matches file
 * names case-sensitively, and anything else would need URL-encoding or break on a case-insensitive disk.
 * @param {string} name
 * @returns {boolean}
 */
export function isSourceName(name) {
  return SOURCE_NAME.test(name);
}

/** @param {number} photoWidth */
function assertPhotoWidth(photoWidth) {
  if (!Number.isInteger(photoWidth) || photoWidth <= 0) {
    throw new Error(`A photo's width must be a whole number of pixels above 0, but it is ${photoWidth}.`);
  }
}

/**
 * The standard widths that fit a photo: all up to its own width, never above it. A photo narrower than
 * the smallest standard width is offered only at its own.
 * @param {number} photoWidth
 * @returns {number[]}
 */
export function variantWidthsFor(photoWidth) {
  assertPhotoWidth(photoWidth);
  const fitting = VARIANT_WIDTHS.filter((width) => width <= photoWidth);
  return fitting.length > 0 ? fitting : [photoWidth];
}

/**
 * Where a variant of a source photo is written: next to it, with the width and format after its name.
 * @param {string} sourcePath
 * @param {number} width
 * @param {string} format
 * @returns {string}
 */
export function variantPathFor(sourcePath, width, format) {
  if (!JPEG_EXTENSION.test(sourcePath)) {
    throw new Error(`The photo ${JSON.stringify(sourcePath)} must be a .jpg or .jpeg photo.`);
  }
  return `${sourcePath.replace(JPEG_EXTENSION, "")}-${width}.${format}`;
}

/**
 * @param {{ path: string }} first
 * @param {{ path: string }} second
 */
function byPath(first, second) {
  if (first.path === second.path) return 0;
  return first.path < second.path ? -1 : 1;
}

/** True for public/projects/<slug>/<slug>-01.jpg: the first photo of a project, which its share image is cut from. */
function isFirstPhotoOfProject(path) {
  const prefix = `${PROJECTS_DIR}/`;
  if (!path.startsWith(prefix)) return false;
  const [slug, file, ...rest] = path.slice(prefix.length).split("/");
  return rest.length === 0 && file === `${slug}-01.jpg`;
}

/**
 * @param {readonly SourcePhoto[]} ordered
 * @returns {PlannedOutput[]}
 */
function planVariants(ordered) {
  return ordered.flatMap((source) =>
    variantWidthsFor(source.width).flatMap((width) =>
      VARIANT_FORMATS.map((format) => ({ output: variantPathFor(source.path, width, format), source: source.path, kind: /** @type {const} */ ("variant"), width, format })),
    ),
  );
}

/**
 * @param {readonly SourcePhoto[]} ordered
 * @param {string} defaultOgSource
 * @returns {PlannedOutput[]}
 */
function planShareImages(ordered, defaultOgSource) {
  if (!ordered.some((source) => source.path === defaultOgSource)) {
    throw new Error(
      `The site-wide share image is cut from ${defaultOgSource}, but there is no such photo. Change DEFAULT_OG_SOURCE in scripts/image-plan.mjs (and DEFAULT_OG_IMAGE.alt in src/lib/seo/metadata.ts to match).`,
    );
  }
  const perProject = ordered
    .filter((source) => isFirstPhotoOfProject(source.path))
    .map((source) => ({ output: `${OG_DIR}/${source.path.split("/")[2]}.jpg`, source: source.path, kind: /** @type {const} */ ("og") }));
  return [...perProject, { output: `${OG_DIR}/${DEFAULT_OG_NAME}.jpg`, source: defaultOgSource, kind: /** @type {const} */ ("og") }];
}

/**
 * Every file the pipeline makes from the source photos: for each photo an AVIF and a WebP at every
 * width that fits, then a share image for each project (cut from `<slug>-01.jpg`) and the site-wide
 * default. The same photos always give the same plan, in the same order.
 * @param {readonly SourcePhoto[]} sources
 * @param {{ defaultOgSource?: string }} [options]
 * @returns {PlannedOutput[]}
 */
export function planOutputs(sources, { defaultOgSource = DEFAULT_OG_SOURCE } = {}) {
  const ordered = [...sources].sort(byPath);
  return [...planVariants(ordered), ...planShareImages(ordered, defaultOgSource)];
}

/**
 * A fingerprint of everything that decides how a file is made from its photo (widths, formats,
 * encoder settings, share image crop), so changing any of it makes every file out of date.
 * @returns {string}
 */
export function settingsFingerprint() {
  const description = {
    version: PIPELINE_VERSION,
    widths: VARIANT_WIDTHS,
    formats: VARIANT_FORMATS,
    encoders: ENCODER_SETTINGS,
    og: { size: OG_SIZE, position: OG_CROP_POSITION, defaultSource: DEFAULT_OG_SOURCE },
  };
  return createHash("sha256").update(JSON.stringify(description)).digest("hex");
}

/**
 * The record that matches these photos and the current settings, with the photos in a fixed order.
 * @param {readonly SourcePhoto[]} sources
 * @returns {Manifest}
 */
export function buildManifest(sources) {
  const entries = [...sources].sort(byPath).map((source) => [source.path, source.sha256]);
  return { settings: settingsFingerprint(), sources: Object.fromEntries(entries) };
}

/**
 * Sorts the files on disk against the plan: planned files that are missing, planned files whose
 * photo or settings changed since they were made (`recorded` is what the committed record says,
 * `expected` what it would say now), and generated files nothing asks for any more.
 * @param {{ planned: readonly PlannedOutput[], expected: Manifest, recorded: Manifest | null, existing: readonly string[] }} state
 * @returns {{ missing: string[], stale: string[], orphaned: string[] }}
 */
export function compareWithDisk({ planned, expected, recorded, existing }) {
  const present = new Set(existing);
  const wanted = new Set(planned.map((entry) => entry.output));
  const isMadeFromCurrent = (/** @type {PlannedOutput} */ entry) =>
    recorded !== null && recorded.settings === expected.settings && recorded.sources[entry.source] === expected.sources[entry.source];
  return {
    missing: planned.filter((entry) => !present.has(entry.output)).map((entry) => entry.output),
    stale: planned.filter((entry) => present.has(entry.output) && !isMadeFromCurrent(entry)).map((entry) => entry.output),
    orphaned: existing.filter((file) => !wanted.has(file)),
  };
}
