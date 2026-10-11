/**
 * Drawings: the PDF drawings or BOQ a visitor attaches to a Quote Request.
 *
 * FormSubmit allows 10 MB of attachments per submission; the 9 MB limit
 * here leaves headroom for the rest of the request. Larger sets go in the
 * optional "drawings link" field instead.
 */
import { toSingleLine } from "./text";

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;
const DEFAULT_MAX_FILE_NAME_LENGTH = 100;
const MAX_EXTENSION_LENGTH = 10;
const FALLBACK_FILE_NAME = "drawing.pdf";

export const DRAWINGS_LIMITS = {
  maxFiles: 10,
  maxTotalBytes: 9 * BYTES_PER_MB,
  accept: "application/pdf",
} as const;

/** Rounds up, so a size that breaks a limit is never printed as equal to it. */
export function formatFileSize(bytes: number): string {
  if (bytes >= BYTES_PER_MB) return `${Math.ceil((bytes / BYTES_PER_MB) * 10) / 10} MB`;
  if (bytes >= BYTES_PER_KB) return `${Math.ceil(bytes / BYTES_PER_KB)} KB`;
  return `${bytes} B`;
}

function extensionOf(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0) return "";
  const extension = name.slice(dotIndex);
  return extension.length <= MAX_EXTENSION_LENGTH ? extension : "";
}

/**
 * Makes a file name safe to print in an email or an error message: line
 * breaks and tabs become spaces, control and invisible formatting
 * characters (including right-to-left overrides) are removed, and the
 * result is capped in length while keeping its extension.
 */
export function sanitiseFileName(name: string, maxLength: number = DEFAULT_MAX_FILE_NAME_LENGTH): string {
  const cleaned = toSingleLine(name);
  if (cleaned === "") return FALLBACK_FILE_NAME;

  const characters = Array.from(cleaned);
  if (characters.length <= maxLength) return cleaned;

  const extension = Array.from(extensionOf(cleaned));
  return [...characters.slice(0, maxLength - extension.length), ...extension].join("");
}

function isPdf(file: File): boolean {
  return file.type === DRAWINGS_LIMITS.accept || file.name.toLowerCase().endsWith(".pdf");
}

/**
 * What is wrong with one file, judged by its name, type and size alone, or
 * null. Whether its contents really are a PDF is checked when it is added
 * (see `./pdfCheck`).
 */
export function fileProblem(file: File): string | null {
  const name = sanitiseFileName(file.name);
  if (!isPdf(file)) return `${name} is not a PDF. Drawings must be PDF files.`;
  if (file.size === 0) return `${name} is empty. Please attach a valid PDF.`;
  return null;
}

/** The first problem with a set of Drawings, in plain words, or null when the set is fine. */
export function validateDrawings(files: readonly File[]): string | null {
  if (files.length > DRAWINGS_LIMITS.maxFiles) {
    return `Please attach up to ${DRAWINGS_LIMITS.maxFiles} files. For a bigger set, paste a share link instead.`;
  }

  for (const file of files) {
    const problem = fileProblem(file);
    if (problem !== null) return problem;
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > DRAWINGS_LIMITS.maxTotalBytes) {
    return (
      `Your files total ${formatFileSize(totalBytes)}, over the ${formatFileSize(DRAWINGS_LIMITS.maxTotalBytes)} limit. ` +
      "Remove some files, or paste a share link to the larger drawings instead."
    );
  }

  return null;
}
