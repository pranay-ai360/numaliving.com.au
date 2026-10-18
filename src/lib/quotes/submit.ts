/**
 * Sends a Quote Request to Numa by email through FormSubmit.co.
 *
 * The site is static (GitHub Pages), so the browser posts straight to
 * FormSubmit. A request without Drawings goes to FormSubmit's AJAX endpoint,
 * which answers in JSON. FormSubmit documents attachments only for its
 * ordinary endpoint and its AJAX endpoint drops them (seen live on 18 October
 * 2026), so a request with Drawings goes to the ordinary endpoint, which
 * answers with a web page that the browser may read (it allows any origin).
 * `submitQuoteRequest` never throws for the outcomes it expects: every result
 * is a typed `SubmissionResult`, and it only reports success when FormSubmit
 * says so (a missing configuration or an unclear answer is never shown to the
 * visitor as "sent").
 *
 * This module pulls in Zod, so the form loads it on demand (see
 * `@/components/quote-form/loadSubmitter`) rather than with the page.
 */
import type { InvalidField, SubmissionResult, ValidationFailure } from "@/lib/types";
import { validateDrawings } from "./drawings";
import { isQuoteRequestField } from "./fields";
import { createReference } from "./reference";
import { judgePageReply, judgeReply, sendFailure, type Reply } from "./reply";
import { quoteRequestSchema } from "./schema";
import { buildSubmission } from "./submission";

const FORMSUBMIT_URL = "https://formsubmit.co/";
const FORMSUBMIT_AJAX_URL = `${FORMSUBMIT_URL}ajax/`;
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

/** Where a request goes, how its answer is read, and how that answer is judged. */
type Endpoint = {
  url: string;
  headers: HeadersInit | undefined;
  readBody: (response: Response) => Promise<unknown>;
  judge: (reply: Reply, reference: string) => SubmissionResult;
};

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

/**
 * What `read` gives, or undefined when it fails: the body is not in the expected form, or the time ran out
 * mid-answer (the caller tells these apart by the abort signal).
 */
async function readOrUndefined<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

/** The parsed JSON body, or undefined when it is not JSON or could not be read in time. */
function readJson(response: Response): Promise<unknown> {
  return readOrUndefined<unknown>(() => response.json());
}

/** The body as text, or undefined when it could not be read in time. */
function readText(response: Response): Promise<string | undefined> {
  return readOrUndefined(() => response.text());
}

function endpointFor(formId: string, hasDrawings: boolean): Endpoint {
  if (hasDrawings) {
    // No Accept header: it is the ordinary endpoint's page that proves delivery, not JSON.
    return { url: `${FORMSUBMIT_URL}${formId}`, headers: undefined, readBody: readText, judge: judgePageReply };
  }
  return {
    url: `${FORMSUBMIT_AJAX_URL}${formId}`,
    headers: { Accept: "application/json" },
    readBody: readJson,
    judge: judgeReply,
  };
}

async function post(endpoint: Endpoint, body: FormData, fetchImpl: typeof fetch, timeoutMs: number): Promise<Outcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // No Content-Type header: the browser must add it, with the multipart boundary.
    const response = await fetchImpl(endpoint.url, {
      method: "POST",
      headers: endpoint.headers,
      body,
      signal: controller.signal,
    });
    // `await` keeps the timer running while the body is read; error answers are read too, for their message.
    const answer = await endpoint.readBody(response);
    // Out of time while reading a good answer: whether it arrived is unknown, so say it timed out.
    if (answer === undefined && controller.signal.aborted && response.ok) return { kind: "failed", reason: "timeout" };
    const reply: Reply = { status: response.status, isOk: response.ok, isRedirected: response.redirected === true, body: answer };
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
 * Attachments are sent as extra multipart fields (`attachment`, `attachment2`,
 * ...), and a request with any goes to FormSubmit's ordinary endpoint, the one
 * that carries them.
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
  const endpoint = endpointFor(formId, files.length > 0);
  const outcome = await post(
    endpoint,
    buildSubmission(parsed.data, files, reference),
    options.fetchImpl ?? globalFetch,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  return outcome.kind === "failed" ? sendFailure(outcome.reason) : endpoint.judge(outcome.reply, reference);
}
