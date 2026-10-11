/**
 * Sends a Quote Request to Numa by email through FormSubmit.co.
 *
 * The site is static (GitHub Pages), so the browser posts straight to
 * FormSubmit's AJAX endpoint. `submitQuoteRequest` never throws for the
 * outcomes it expects: every result is a typed `SubmissionResult`, and it
 * only reports success when FormSubmit says so (a missing configuration or
 * an unclear answer is never shown to the visitor as "sent").
 *
 * This module pulls in Zod, so the form loads it on demand (see
 * `@/components/quote-form/loadSubmitter`) rather than with the page.
 */
import type { InvalidField, SubmissionResult, ValidationFailure } from "@/lib/types";
import { validateDrawings } from "./drawings";
import { isQuoteRequestField } from "./fields";
import { createReference } from "./reference";
import { judgeReply, sendFailure, type Reply } from "./reply";
import { quoteRequestSchema } from "./schema";
import { buildSubmission } from "./submission";

const FORMSUBMIT_AJAX_URL = "https://formsubmit.co/ajax/";
const DEFAULT_TIMEOUT_MS = 60_000;

// The id is either the random-string alias FormSubmit emails the owner or,
// while testing, the mailbox itself. Only characters that are safe inside
// one URL path segment are allowed, so a bad value cannot change the address.
const FORM_ID_PATTERN = /^[A-Za-z0-9._+@-]{1,254}$/;
// "." and ".." are path steps, not names: they would change which address is called.
const ONLY_DOTS_PATTERN = /^\.+$/;

export type SubmitOptions = {
  /** The FormSubmit alias or mailbox. Defaults to `NEXT_PUBLIC_FORMSUBMIT_ID`. */
  formId?: string;
  /** Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
  /** How long to wait for FormSubmit before giving up. Defaults to 60 seconds. */
  timeoutMs?: number;
};

type Outcome = { kind: "replied"; reply: Reply } | { kind: "failed"; reason: "timeout" | "network" };

const globalFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);

function invalid(error: string, field: InvalidField | undefined): ValidationFailure {
  return field === undefined ? { ok: false, reason: "invalid", error } : { ok: false, reason: "invalid", error, field };
}

/** The usable form id, or null when it is missing, blank or not safe to put in the address. */
function resolveFormId(explicitId: string | undefined): string | null {
  // Written out in full so Next.js can inline the value at build time.
  const candidate = (explicitId ?? process.env.NEXT_PUBLIC_FORMSUBMIT_ID ?? "").trim();
  if (ONLY_DOTS_PATTERN.test(candidate)) return null;
  return FORM_ID_PATTERN.test(candidate) ? candidate : null;
}

/** The parsed JSON body, or undefined when it is not JSON or could not be read in time. */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    // Not JSON, or the time ran out mid-answer: the caller tells these apart by the abort signal.
    return undefined;
  }
}

async function post(url: string, body: FormData, fetchImpl: typeof fetch, timeoutMs: number): Promise<Outcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // No Content-Type header: the browser must add it, with the multipart boundary.
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { Accept: "application/json" },
      body,
      signal: controller.signal,
    });
    // `await` keeps the timer running while the body is read; error answers are read too, for their message.
    const json = await readJson(response);
    // Out of time while reading a good answer: whether it arrived is unknown, so say it timed out.
    if (json === undefined && controller.signal.aborted && response.ok) return { kind: "failed", reason: "timeout" };
    const reply: Reply = { status: response.status, isOk: response.ok, isRedirected: response.redirected === true, body: json };
    return { kind: "replied", reply };
  } catch {
    return { kind: "failed", reason: controller.signal.aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Validates a Quote Request and its Drawings, then emails it to Numa.
 *
 * `request` is `unknown` on purpose: it comes straight from form inputs, so
 * it is checked against the schema here rather than trusted. A validation
 * failure names the field it is about, so the form can mark and focus it.
 *
 * Attachments are sent as extra multipart fields. FormSubmit documents that
 * for ordinary form posts but not for its AJAX endpoint, so it is unverified
 * until the live PDF test in the README runbook has been done.
 */
export async function submitQuoteRequest(
  request: unknown,
  files: readonly File[],
  options: SubmitOptions = {},
): Promise<SubmissionResult> {
  const parsed = quoteRequestSchema.safeParse(request);
  if (!parsed.success) {
    // A failed parse always carries at least one issue; the first is the first field in form order.
    const [issue] = parsed.error.issues;
    const field = issue.path[0];
    return invalid(issue.message, isQuoteRequestField(field) ? field : undefined);
  }

  const drawingsProblem = validateDrawings(files);
  if (drawingsProblem !== null) return invalid(drawingsProblem, "drawings");

  const formId = resolveFormId(options.formId);
  if (formId === null) return sendFailure("not-configured");

  const reference = createReference();
  const outcome = await post(
    `${FORMSUBMIT_AJAX_URL}${formId}`,
    buildSubmission(parsed.data, files, reference),
    options.fetchImpl ?? globalFetch,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  return outcome.kind === "failed" ? sendFailure(outcome.reason) : judgeReply(outcome.reply, reference);
}
