#!/usr/bin/env node
/**
 * Makes the fast copies of the project photos and the craft photos, and the share images, with sharp.
 *
 *   npm run images:build                          # make what is missing or out of date
 *   node scripts/optimize-images.mjs --check      # change nothing; exit 1 if anything is missing, out of date or left over
 *   node scripts/optimize-images.mjs --force      # make every file again
 *
 * From each source photo public/projects/<project-slug>/<project-slug>-<nn>.jpg it writes, next to it,
 * an AVIF and a WebP at 480, 800, 1200 and 1600 px wide (never wider than the photo) without any
 * metadata, and for each project a 1200 x 630 share image public/og/<project-slug>.jpg cut from
 * `<project-slug>-01.jpg`, plus public/og/default.jpg for the whole site. The craft and factory photos,
 * public/craft/<name>.jpg, get the same copies next to them but no share image. The sources are never touched.
 *
 * The output is deterministic, and `scripts/images.manifest.json` records which photos (by SHA-256)
 * and which settings the files were made from, so a second run changes nothing and a test
 * (src/lib/optimizeImages.test.ts) can tell when a photo changed without its copies being remade.
 * What is planned and how files are named: scripts/image-plan.mjs.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import sharp from "sharp";
import {
  CRAFT_DIR,
  ENCODER_SETTINGS,
  MANIFEST_PATH,
  OG_CROP_POSITION,
  OG_DIR,
  OG_SIZE,
  PROJECTS_DIR,
  buildManifest,
  compareWithDisk,
  isSourceName,
  planOutputs,
} from "./image-plan.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const USAGE = "Usage: node scripts/optimize-images.mjs [--check | --force]";
const USAGE_ERROR_EXIT_CODE = 2;
const FAILURE_EXIT_CODE = 1;
const SOURCE_EXTENSION = /\.jpe?g$/i;
const GENERATED_PHOTO_EXTENSIONS = [".avif", ".webp"];
/** EXIF orientations 5 to 8 turn the picture by a quarter, so its displayed width is the stored height. */
const FIRST_QUARTER_TURN_ORIENTATION = 5;
const FIX_COMMAND = "npm run images:build";

/**
 * @typedef {import("./image-plan.mjs").SourcePhoto} SourcePhoto
 * @typedef {import("./image-plan.mjs").PlannedOutput} PlannedOutput
 * @typedef {import("./image-plan.mjs").Manifest} Manifest
 * @typedef {"build" | "check" | "force"} Mode
 */

/** @param {unknown} error */
function isMissingFile(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** The files below `relativeDir` (paths relative to `root`, with "/"), in a fixed order; none if the folder is missing. @returns {Promise<string[]>} */
async function listFiles(root, relativeDir) {
  let entries;
  try {
    entries = await readdir(path.join(root, relativeDir), { withFileTypes: true });
  } catch (error) {
    if (isMissingFile(error)) return [];
    throw error;
  }
  const nested = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? listFiles(root, `${relativeDir}/${entry.name}`) : [`${relativeDir}/${entry.name}`])),
  );
  return nested.flat().sort();
}

/** What is wrong with the place or name of a source photo, as a list of plain sentences. @param {string} file */
function problemsWithSource(file) {
  const [slug, name, ...deeper] = file.slice(PROJECTS_DIR.length + 1).split("/");
  if (name === undefined || deeper.length > 0) {
    return [`${file}: put each photo directly in ${PROJECTS_DIR}/<project-slug>/`];
  }
  const slugProblem = isSourceName(`${slug}.jpg`) ? [] : [`${file}: the folder ${slug} must be named in lower case with hyphens`];
  const nameProblem = isSourceName(name) ? [] : [`${file}: rename it in lower case with hyphens and a .jpg ending (for example ${slug}-01.jpg)`];
  return [...slugProblem, ...nameProblem];
}

/** What is wrong with the place or name of a craft photo: it goes directly in public/craft/, named in lower case with hyphens. @param {string} file */
function problemsWithCraftSource(file) {
  const [name, ...deeper] = file.slice(CRAFT_DIR.length + 1).split("/");
  if (deeper.length > 0) return [`${file}: put each photo directly in ${CRAFT_DIR}/`];
  return isSourceName(name) ? [] : [`${file}: rename it in lower case with hyphens and a .jpg ending (for example spray-booth.jpg)`];
}

/** @returns {Promise<string[]>} */
async function findSourcePaths(root) {
  const projectFiles = (await listFiles(root, PROJECTS_DIR)).filter((file) => SOURCE_EXTENSION.test(file));
  const craftFiles = (await listFiles(root, CRAFT_DIR)).filter((file) => SOURCE_EXTENSION.test(file));
  const problems = [...projectFiles.flatMap(problemsWithSource), ...craftFiles.flatMap(problemsWithCraftSource)];
  if (problems.length > 0) {
    throw new Error(`These photos cannot be used, because GitHub Pages matches file names case-sensitively:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
  }
  return [...projectFiles, ...craftFiles];
}

/** @returns {Promise<SourcePhoto>} */
async function readSource(root, file) {
  const bytes = await readFile(path.join(root, file));
  let metadata;
  try {
    metadata = await sharp(bytes).metadata();
  } catch (error) {
    throw new Error(`${file} is not a readable image: ${error instanceof Error ? error.message : String(error)}`);
  }
  const { width, height, orientation } = metadata;
  if (width === undefined || height === undefined) throw new Error(`${file} is not a readable image: it has no size.`);
  const isTurned = orientation !== undefined && orientation >= FIRST_QUARTER_TURN_ORIENTATION;
  return { path: file, width: isTurned ? height : width, sha256: createHash("sha256").update(bytes).digest("hex") };
}

/** The generated files on disk: the AVIF and WebP copies of the project and craft photos, and the share images. @returns {Promise<string[]>} */
async function listGenerated(root) {
  const photoFiles = [...(await listFiles(root, PROJECTS_DIR)), ...(await listFiles(root, CRAFT_DIR))];
  const copies = photoFiles.filter((file) => GENERATED_PHOTO_EXTENSIONS.includes(path.extname(file)));
  const shareImages = (await listFiles(root, OG_DIR)).filter((file) => path.extname(file) === ".jpg");
  return [...copies, ...shareImages];
}

/** @param {unknown} value @returns {value is Manifest} */
function isManifest(value) {
  return typeof value === "object" && value !== null && "settings" in value && typeof value.settings === "string" && "sources" in value && typeof value.sources === "object" && value.sources !== null;
}

/** The committed record, or null when there is none yet. @returns {Promise<Manifest | null>} */
async function readManifest(root) {
  let text;
  try {
    text = await readFile(path.join(root, MANIFEST_PATH), "utf8");
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${MANIFEST_PATH} is not valid JSON (${error instanceof Error ? error.message : String(error)}). Delete it and run ${FIX_COMMAND}.`);
  }
  if (!isManifest(parsed)) throw new Error(`${MANIFEST_PATH} does not look like an image record. Delete it and run ${FIX_COMMAND}.`);
  return parsed;
}

/**
 * Reads the photos and the generated files and sorts out what is missing, out of date or left over.
 * @param {string} [root] The repository root.
 * @param {{ defaultOgSource?: string }} [options]
 */
export async function inspectImages(root = REPO_ROOT, options = {}) {
  const sources = await Promise.all((await findSourcePaths(root)).map((file) => readSource(root, file)));
  const planned = planOutputs(sources, options);
  const expected = buildManifest(sources);
  const [recorded, existing] = await Promise.all([readManifest(root), listGenerated(root)]);
  return { sources, planned, expected, recorded, existing, comparison: compareWithDisk({ planned, expected, recorded, existing }) };
}

/** @param {string} sourceFile @param {PlannedOutput} entry @returns {Promise<Buffer>} */
function encode(sourceFile, entry) {
  // Auto-orient first: the files carry no metadata, so the orientation tag would be lost.
  const image = sharp(sourceFile, { failOn: "error" }).rotate();
  if (entry.kind === "og") {
    return image.resize({ width: OG_SIZE.width, height: OG_SIZE.height, fit: "cover", position: OG_CROP_POSITION }).jpeg(ENCODER_SETTINGS.og).toBuffer();
  }
  const resized = image.resize({ width: entry.width, withoutEnlargement: true });
  return (entry.format === "avif" ? resized.avif(ENCODER_SETTINGS.avif) : resized.webp(ENCODER_SETTINGS.webp)).toBuffer();
}

/** Writes through a temporary file, so an interrupted run never leaves half a picture behind. */
async function makeOutput(root, entry) {
  const bytes = await encode(path.join(root, entry.source), entry);
  const target = path.join(root, entry.output);
  const temporary = `${target}.tmp`;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(temporary, bytes);
  await rename(temporary, target);
}

/** @param {string} root @param {Manifest} manifest */
async function writeManifest(root, manifest) {
  const target = path.join(root, MANIFEST_PATH);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Makes the files that are missing or out of date (all of them with "force"), removes generated files
 * nothing asks for any more, and updates the record. With "check" it only reports.
 * @param {{ root?: string, mode?: Mode, defaultOgSource?: string, log?: (line: string) => void }} [options]
 */
export async function buildImages({ root = REPO_ROOT, mode = "build", defaultOgSource, log = () => {} } = {}) {
  const { planned, expected, recorded, comparison } = await inspectImages(root, defaultOgSource === undefined ? {} : { defaultOgSource });
  if (mode === "check") return { made: 0, removed: 0, unchanged: planned.length, comparison };

  const redo = new Set(mode === "force" ? planned.map((entry) => entry.output) : [...comparison.missing, ...comparison.stale]);
  const toMake = planned.filter((entry) => redo.has(entry.output));
  for (const entry of toMake) {
    await makeOutput(root, entry);
    log(`made ${entry.output}`);
  }
  for (const file of comparison.orphaned) {
    await rm(path.join(root, file));
    log(`removed ${file}`);
  }
  if (JSON.stringify(recorded) !== JSON.stringify(expected)) await writeManifest(root, expected);
  return { made: toMake.length, removed: comparison.orphaned.length, unchanged: planned.length - toMake.length, comparison };
}

/** @param {readonly string[]} argv @returns {Mode} */
function parseMode(argv) {
  let values;
  try {
    ({ values } = parseArgs({ args: [...argv], options: { check: { type: "boolean" }, force: { type: "boolean" } }, strict: true }));
  } catch (error) {
    process.stderr.write(`images: ${error instanceof Error ? error.message : String(error)}\n${USAGE}\n`);
    process.exit(USAGE_ERROR_EXIT_CODE);
  }
  if (values.check && values.force) {
    process.stderr.write(`images: --check and --force cannot be used together.\n${USAGE}\n`);
    process.exit(USAGE_ERROR_EXIT_CODE);
  }
  if (values.check) return "check";
  return values.force ? "force" : "build";
}

/** Prints what a check found; the exit code is 1 when there is anything. @param {{ missing: string[], stale: string[], orphaned: string[] }} comparison */
function reportCheck({ missing, stale, orphaned }) {
  const groups = [
    ["missing", missing],
    ["out of date, because its photo or the settings changed", stale],
    ["left over, because no photo asks for it any more", orphaned],
  ];
  const lines = groups.flatMap(([label, files]) => files.map((file) => `  - ${file}: ${label}`));
  if (lines.length === 0) {
    process.stdout.write("images: every photo has its copies and share images, and they are up to date.\n");
    return 0;
  }
  process.stderr.write(`images: the generated files do not match the photos:\n${lines.join("\n")}\nRun ${FIX_COMMAND} and commit the result.\n`);
  return FAILURE_EXIT_CODE;
}

/** @param {readonly string[]} argv */
async function main(argv) {
  const mode = parseMode(argv);
  try {
    const result = await buildImages({ mode, log: (line) => process.stdout.write(`images: ${line}\n`) });
    if (mode === "check") process.exitCode = reportCheck(result.comparison);
    else process.stdout.write(`images: made ${result.made}, left ${result.unchanged} as they were, removed ${result.removed}.\n`);
  } catch (error) {
    process.stderr.write(`images: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = FAILURE_EXIT_CODE;
  }
}

// Run only when started from the command line, so the tests can import the functions above.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
