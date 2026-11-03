/**
 * Finds the private details a published photo still carries: the camera's and lens's serial numbers
 * and a GPS position (EXIF), and the edit history and Lightroom settings (XMP). The launch guard
 * (src/config/launchGuard.test.ts) runs `scanPhotos` once the site is indexable, so the originals
 * are cleaned before search engines and anyone else can download them. Orientation, artist and
 * copyright are not private details and are never reported: the photo has to stay the right way up,
 * and who is credited is the owner's decision (docs/seo/owner-input-pack.md, Part 3).
 *
 * Nothing here changes a photo. Used by tests only; no page imports it.
 */
import { readdir } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";

/** What a photo can carry that the guard refuses to publish. */
export type MetadataFinding = "BodySerialNumber" | "LensSerialNumber" | "GPS position" | "xmpMM:History" | "crs: settings" | "unreadable EXIF";

/** The part of sharp's `metadata()` the scan reads. */
export type PhotoMetadata = Readonly<{ exif?: Buffer | undefined; xmp?: Buffer | undefined }>;

/** A photo that carries something private, with what it carries. */
export type PhotoFinding = Readonly<{ file: string; findings: readonly MetadataFinding[] }>;

const EXIF_LABEL = "Exif\0\0";
const TIFF_MIN_BYTES = 8;
const ENTRY_BYTES = 12;
/** A directory of more entries than this is not an EXIF directory; stopping here keeps a hostile block from costing time. */
const MAX_ENTRIES = 512;

const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_BODY_SERIAL_NUMBER = 0xa431;
const TAG_LENS_SERIAL_NUMBER = 0xa435;

const PHOTO_FILE = /\.jpe?g$/i;
const XMP_HISTORY = /xmpMM:History/;
const XMP_CAMERA_RAW = /\bcrs:[A-Za-z]|ns\.adobe\.com\/camera-raw-settings/;

const REMEDY = "strip serial numbers, edit history and camera settings from every published original, keep the orientation";

/** One 12-byte entry of an EXIF directory: its tag, and the four bytes after the type and count (a value or an offset). */
type Entry = Readonly<{ tag: number; value: number }>;

type ByteReader = Readonly<{ u16: (offset: number) => number; u32: (offset: number) => number }>;

function readerFor(tiff: Buffer): ByteReader | null {
  const order = tiff.toString("latin1", 0, 2);
  if (order === "II") return { u16: (offset) => tiff.readUInt16LE(offset), u32: (offset) => tiff.readUInt32LE(offset) };
  if (order === "MM") return { u16: (offset) => tiff.readUInt16BE(offset), u32: (offset) => tiff.readUInt32BE(offset) };
  return null;
}

/** The entries of the directory at `offset`, or null when it does not fit inside the block. */
function directoryAt(tiff: Buffer, reader: ByteReader, offset: number): readonly Entry[] | null {
  if (offset < 0 || offset + 2 > tiff.length) return null;
  const count = reader.u16(offset);
  const end = offset + 2 + count * ENTRY_BYTES;
  if (count > MAX_ENTRIES || end > tiff.length) return null;
  return Array.from({ length: count }, (_unused, index) => {
    const entry = offset + 2 + index * ENTRY_BYTES;
    return { tag: reader.u16(entry), value: reader.u32(entry + 8) };
  });
}

function pointerIn(entries: readonly Entry[], tag: number): number | null {
  return entries.find((entry) => entry.tag === tag)?.value ?? null;
}

/** The EXIF block's findings, or null when its directories cannot be read. */
function exifFindings(exif: Buffer): readonly MetadataFinding[] | null {
  const tiff = exif.toString("latin1", 0, EXIF_LABEL.length) === EXIF_LABEL ? exif.subarray(EXIF_LABEL.length) : exif;
  const reader = tiff.length >= TIFF_MIN_BYTES ? readerFor(tiff) : null;
  if (reader === null) return null;
  const main = directoryAt(tiff, reader, reader.u32(4));
  if (main === null) return null;
  const exifOffset = pointerIn(main, TAG_EXIF_IFD);
  const details = exifOffset === null ? [] : directoryAt(tiff, reader, exifOffset);
  if (details === null) return null;
  const has = (tag: number): boolean => details.some((entry) => entry.tag === tag);
  return [
    ...(has(TAG_BODY_SERIAL_NUMBER) ? (["BodySerialNumber"] as const) : []),
    ...(has(TAG_LENS_SERIAL_NUMBER) ? (["LensSerialNumber"] as const) : []),
    ...(pointerIn(main, TAG_GPS_IFD) === null ? [] : (["GPS position"] as const)),
  ];
}

/** What a photo's metadata carries that must not be published, in a fixed order, each kind once. */
export function privateMetadataIn(metadata: PhotoMetadata): readonly MetadataFinding[] {
  const fromExif = metadata.exif === undefined ? [] : (exifFindings(metadata.exif) ?? (["unreadable EXIF"] as const));
  const xmp = metadata.xmp?.toString("utf8") ?? "";
  return [...fromExif, ...(XMP_HISTORY.test(xmp) ? (["xmpMM:History"] as const) : []), ...(XMP_CAMERA_RAW.test(xmp) ? (["crs: settings"] as const) : [])];
}

function isMissingFolder(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** The photos (.jpg and .jpeg) below `folder`, as paths relative to `root` with "/", in a fixed order. Symbolic links are not followed. */
async function photoFiles(root: string, folder: string): Promise<readonly string[]> {
  const entries = await readdir(path.join(root, folder), { withFileTypes: true, recursive: true }).catch((error: unknown) => {
    if (isMissingFolder(error)) return [];
    throw error;
  });
  return entries
    .filter((entry) => entry.isFile() && PHOTO_FILE.test(entry.name))
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
    .sort();
}

async function readMetadata(root: string, file: string): Promise<Metadata> {
  try {
    return await sharp(path.join(root, file)).metadata();
  } catch (error) {
    throw new Error(`${file} is not a readable image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Every photo below `<root>/<folder>` that carries something private, with what it carries; photos
 * that are clean are left out. A .jpg that cannot be read is an error naming the file.
 */
export async function scanPhotos(root: string, folder = "public"): Promise<readonly PhotoFinding[]> {
  const files = await photoFiles(root, folder);
  const scanned = await Promise.all(files.map(async (file) => ({ file, findings: privateMetadataIn(await readMetadata(root, file)) })));
  return scanned.filter((photo) => photo.findings.length > 0);
}

/** One launch blocker for each photo in `found`, named photos.metadata, saying what it carries and what to do. */
export function photoMetadataBlockers(found: readonly PhotoFinding[]): readonly string[] {
  return found.map((photo) => `photos.metadata: ${photo.file} carries ${photo.findings.join(", ")} (${REMEDY})`);
}
