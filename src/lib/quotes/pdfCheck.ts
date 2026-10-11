/**
 * Looks inside a newly chosen Drawing before it is listed: a file is only
 * accepted when it can be read and its first bytes carry the PDF header, so
 * a renamed image or a broken download is refused with a clear message
 * rather than emailed.
 */
import { fileProblem, sanitiseFileName } from "./drawings";

const PDF_HEADER = "%PDF-";
// PDF readers accept the header anywhere in the first kilobyte, because some tools write a few bytes before it.
const HEADER_SEARCH_BYTES = 1024;

/** A chosen file and what is wrong with it, or `problem: null` when it can be attached. */
export type InspectedFile = {
  readonly file: File;
  readonly problem: string | null;
};

async function readStart(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.slice(0, HEADER_SEARCH_BYTES).arrayBuffer());
  // One character per byte (Latin-1), which is how the ASCII header reads in any PDF.
  return String.fromCharCode(...bytes);
}

/** Never rejects: a file that cannot be read comes back with a problem saying so. */
export async function inspectFile(file: File): Promise<InspectedFile> {
  const name = sanitiseFileName(file.name);
  try {
    const problem = fileProblem(file);
    if (problem !== null) return { file, problem };
    const start = await readStart(file);
    if (start.includes(PDF_HEADER)) return { file, problem: null };
    return {
      file,
      problem: `${name} is not a valid PDF. Please save or export the drawing as a PDF and attach it again.`,
    };
  } catch {
    // The browser could not read the file, for example because it was moved or deleted after being chosen.
    return { file, problem: `${name} could not be read. Please check the file and choose it again.` };
  }
}
