/**
 * Test support for the quotes modules and the Quote Request form.
 * Imported only by tests; nothing in the shipped site uses it.
 */
import type { QuoteRequest } from "./schema";

export const BYTES_PER_MB = 1024 * 1024;

const PDF_HEADER_BYTES = new TextEncoder().encode("%PDF-1.4\n");

/** The smallest Quote Request the schema accepts (every optional field left out). */
export const MINIMAL_REQUEST: QuoteRequest = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  role: "Architect / designer",
  projectType: "Residences",
  location: "Dubai, UAE",
  timeline: "Start within 3 months",
  message: "Walnut wardrobes and vanities for twelve villas.",
};

export function makeRequest(overrides: Partial<QuoteRequest> = {}): QuoteRequest {
  return { ...MINIMAL_REQUEST, ...overrides };
}

/** A copy of the request with one key left out, as untyped input (for "missing field" cases). */
export function withoutField(request: QuoteRequest, field: keyof QuoteRequest): Record<string, unknown> {
  return Object.fromEntries(Object.entries(request).filter(([key]) => key !== field));
}

/**
 * A real File of exactly `sizeBytes`, PDF by default: it starts with the
 * "%PDF-" header (cut short when the file is smaller than the header) and is
 * zero-filled after it.
 */
export function makePdf(name = "plan.pdf", sizeBytes = 1024, type = "application/pdf"): File {
  const content = new Uint8Array(sizeBytes);
  content.set(PDF_HEADER_BYTES.subarray(0, sizeBytes));
  return new File([content], name, { type });
}

/** A file that claims to be a PDF by its name and type, but has no PDF header (a renamed image, say). */
export function makeNotPdf(name = "renamed.pdf", sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes).fill(0xff)], name, { type: "application/pdf" });
}
