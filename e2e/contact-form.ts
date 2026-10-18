/**
 * Helpers for the "Request a Quote" form on the Contact page: a valid Quote Request, generated PDF
 * Drawings, and a stand-in for FormSubmit so nothing is ever sent for real.
 */
import { expect, type Locator, type Page, type Request } from "@playwright/test";
import { MIN_FILL_TIME_MS } from "../src/components/quote-form/constants";
import { CONTACT_PATH, pageUrl } from "./site";

export const FORMSUBMIT_ROUTE = "https://formsubmit.co/ajax/**";

/** The visible text of the dashed Drawings drop zone (a label around the hidden file picker). */
const DROP_ZONE_TEXT = "Attach drawings or BOQ (PDF)";

/** A little more than the form's minimum fill time, so the check is clearly passed. */
const FILL_TIME_MARGIN_MS = 100;

const PDF_MIME_TYPE = "application/pdf";
const PDF_SOURCE = [
  "%PDF-1.4",
  "1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj",
  "2 0 obj <</Type /Pages /Kids [] /Count 0>> endobj",
  "trailer <</Root 1 0 R>>",
  "%%EOF",
  "",
].join("\n");

export const QUOTE = {
  name: "Ada Lovelace",
  company: "Analytical Engines Ltd",
  email: "ada@example.com",
  role: "Architect / designer",
  projectType: "Residences",
  location: "Dubai, UAE",
  timeline: "Start within 3 months",
  message: "Walnut wardrobes and vanities for twelve villas.",
} as const;

export type FilePayload = { name: string; mimeType: string; buffer: Buffer };

export type FormSubmitReply = { status: number; body: Readonly<Record<string, string>> };

/** What FormSubmit's AJAX endpoint answers when it accepts a submission. */
export const FORMSUBMIT_ACCEPTED: FormSubmitReply = {
  status: 200,
  body: { success: "true", message: "The form was submitted successfully." },
};

export const FORMSUBMIT_SERVER_ERROR: FormSubmitReply = {
  status: 500,
  body: { success: "false", message: "Internal Server Error" },
};

/** A small, valid PDF (it starts with "%PDF-1.4"), padded with zero bytes up to `sizeBytes`. */
export function makePdf(name: string, sizeBytes = 0): FilePayload {
  const content = Buffer.from(PDF_SOURCE, "latin1");
  const padding = Buffer.alloc(Math.max(0, sizeBytes - content.length));
  return { name, mimeType: PDF_MIME_TYPE, buffer: Buffer.concat([content, padding]) };
}

/** A file named and typed as a PDF whose contents are not one (a renamed photo or note, say). */
export function makeFakePdf(name: string): FilePayload {
  return { name, mimeType: PDF_MIME_TYPE, buffer: Buffer.from("Not a drawing, just text with a .pdf name.", "latin1") };
}

/** Answers every FormSubmit call with `reply`. Returns a function that lists the calls seen so far. */
export async function mockFormSubmit(page: Page, reply: FormSubmitReply): Promise<() => readonly Request[]> {
  let calls: readonly Request[] = [];
  await page.route(FORMSUBMIT_ROUTE, async (route) => {
    calls = [...calls, route.request()];
    await route.fulfill({
      status: reply.status,
      contentType: "application/json",
      // FormSubmit's AJAX endpoint allows any origin; without this header the browser hides the answer.
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(reply.body),
    });
  });
  return () => calls;
}

/**
 * Waits until the form's script is running. Send is disabled in the static HTML and only enabled
 * once React has taken over the form, so this is a reliable "ready" signal before files are given.
 */
export async function waitForFormReady(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Send Request" })).toBeEnabled();
}

/**
 * Opens the Contact page with Playwright's clock installed: the form refuses a Send pressed within
 * two seconds of appearing, and the clock lets a test move past that without waiting for real.
 */
export async function openContactForm(page: Page): Promise<void> {
  await page.clock.install();
  await page.goto(pageUrl(CONTACT_PATH));
  await waitForFormReady(page);
}

/**
 * The thank-you panel. The form has its own polite status regions (file count, "Sending…"), so the
 * panel is picked out by its text rather than by its role alone.
 */
export function thankYouPanel(page: Page): Locator {
  return page.getByRole("main").getByRole("status").filter({ hasText: "Thank You" });
}

/** Fills every required field, plus Company to show an optional field reaching the email. */
export async function fillQuoteRequest(page: Page): Promise<void> {
  await page.getByLabel("Full name").fill(QUOTE.name);
  await page.getByLabel("Company").fill(QUOTE.company);
  await page.getByLabel("Email").fill(QUOTE.email);
  await page.getByLabel("Your role").selectOption(QUOTE.role);
  await page.getByLabel("Project type").selectOption(QUOTE.projectType);
  await page.getByLabel("Site location").fill(QUOTE.location);
  await page.getByLabel("Timeline").selectOption(QUOTE.timeline);
  await page.getByLabel("Scope and notes").fill(QUOTE.message);
}

export async function attachDrawings(page: Page, files: readonly FilePayload[]): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles([...files]);
}

/** Drops files on the Drawings drop zone, carried by a real DataTransfer as in a browser drag and drop. */
export async function dropDrawings(page: Page, files: readonly FilePayload[]): Promise<void> {
  const items = files.map((file) => ({ name: file.name, mimeType: file.mimeType, bytes: Array.from(file.buffer) }));
  const dataTransfer = await page.evaluateHandle((payload) => {
    const transfer = new DataTransfer();
    for (const item of payload) {
      transfer.items.add(new File([new Uint8Array(item.bytes)], item.name, { type: item.mimeType }));
    }
    return transfer;
  }, items);
  await page.locator("label", { hasText: DROP_ZONE_TEXT }).dispatchEvent("drop", { dataTransfer });
}

export async function passMinimumFillTime(page: Page): Promise<void> {
  await page.clock.fastForward(MIN_FILL_TIME_MS + FILL_TIME_MARGIN_MS);
}

export async function sendRequest(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Send Request" }).click();
}

/** The multipart body of a FormSubmit call, parsed the way a server would parse it. */
export async function readSubmission(request: Request): Promise<FormData> {
  const body = request.postDataBuffer();
  if (body === null) throw new Error(`The request to ${request.url()} has no body.`);
  const contentType = request.headers()["content-type"] ?? "";
  return new Response(new Uint8Array(body), { headers: { "content-type": contentType } }).formData();
}

/** The text fields of a submission, by field name. */
export function textFields(form: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(form.entries()).flatMap(([name, value]) => (typeof value === "string" ? [[name, value]] : [])),
  );
}

/** The file sent in field `name`; fails when the field is missing or holds text. */
export function fileField(form: FormData, name: string): File {
  const value = form.get(name);
  if (!(value instanceof File)) throw new Error(`Field "${name}" is not a file (it is ${value === null ? "missing" : "text"}).`);
  return value;
}
