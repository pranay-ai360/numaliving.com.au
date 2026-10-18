/**
 * Judging FormSubmit's answer to a Quote Request.
 *
 * FormSubmit has two endpoints and answers each differently. The AJAX endpoint
 * answers in JSON that it does not document; the ordinary endpoint, which is
 * the one that carries attachments, answers with a web page. Either way only a
 * plain "yes" counts as sent and anything unclear is reported as not sent.
 * The HTTP status and FormSubmit's own message are kept on a failure for
 * diagnosis; the visitor only ever sees the friendly text from `./messages`.
 */
import { z } from "zod";
import type { SendFailure, SendFailureReason, SubmissionResult } from "@/lib/types";
import { sendFailureMessage } from "./messages";
import { toSingleLine, truncate } from "./text";

const HTTP_PAYLOAD_TOO_LARGE = 413;
const MAX_SERVICE_MESSAGE_LENGTH = 300;

// A form that has not been activated yet is answered with a message asking for activation.
const ACTIVATION_PATTERN = /activat/i;

// The wording of FormSubmit's own success page: a heading, then a sentence (seen on 18 October 2026). The sentence
// is matched from its start, so "could not be submitted successfully" does not pass for it.
const SUCCESS_HEADING_PATTERN = /^thanks!?$/i;
const SUCCESS_MESSAGE_PATTERN = /^the form was submitted successfully\b/i;

// A real FormSubmit page is a few tens of kilobytes. A far larger answer is not one, and is not parsed.
const MAX_PAGE_LENGTH = 256 * 1024;

/** What came back from FormSubmit, reduced to the parts that decide the outcome. */
export type Reply = {
  status: number;
  isOk: boolean;
  /** True when fetch followed a redirect, so the answer is not the endpoint's own. */
  isRedirected: boolean;
  /** The parsed JSON (AJAX endpoint) or the page's HTML text (ordinary endpoint), or undefined when it could not be read. */
  body: unknown;
};

type Diagnostics = Pick<SendFailure, "status" | "serviceMessage">;

// FormSubmit documents `success` as a string ("true") in some places and a
// boolean in others. Text is compared without regard to case.
const verdictSchema = z.object({
  success: z.union([
    z.boolean(),
    z
      .string()
      .transform((value) => value.toLowerCase())
      .pipe(z.enum(["true", "false"]))
      .transform((value) => value === "true"),
  ]),
});

const serviceMessageSchema = z.object({ message: z.string() });

export function sendFailure(reason: SendFailureReason, diagnostics: Diagnostics = {}): SendFailure {
  return { ok: false, reason, error: sendFailureMessage(reason), ...diagnostics };
}

function diagnosticsFor(reply: Reply, serviceMessage: string | undefined): Diagnostics {
  return serviceMessage === undefined ? { status: reply.status } : { status: reply.status, serviceMessage };
}

/** FormSubmit's text on one line and capped in length. */
function tidy(text: string): string {
  return truncate(toSingleLine(text), MAX_SERVICE_MESSAGE_LENGTH);
}

/** The failure that the status and the route of an answer already decide, or null when its content must be read. */
function failureFromReply(reply: Reply, diagnostics: Diagnostics, needsActivation: boolean): SendFailure | null {
  if (reply.status === HTTP_PAYLOAD_TOO_LARGE) return sendFailure("too-large", diagnostics);
  if (!reply.isOk) return sendFailure(needsActivation ? "not-activated" : "rejected", diagnostics);
  // After a redirect the answer comes from some other page, so it proves nothing about delivery.
  if (reply.isRedirected) return sendFailure("invalid-response", diagnostics);
  return null;
}

/** FormSubmit's message on one line and capped in length, or undefined when it gave none. */
function readServiceMessage(body: unknown): string | undefined {
  const parsed = serviceMessageSchema.safeParse(body);
  if (!parsed.success) return undefined;
  const message = tidy(parsed.data.message);
  return message === "" ? undefined : message;
}

/** True for a plain yes, false for a plain no, null when the answer does not say. */
function readVerdict(body: unknown): boolean | null {
  const parsed = verdictSchema.safeParse(body);
  return parsed.success ? parsed.data.success : null;
}

/** AJAX endpoint: sent only when FormSubmit says so plainly; a "no" is a refusal; anything else is unclear. */
export function judgeReply(reply: Reply, reference: string): SubmissionResult {
  const serviceMessage = readServiceMessage(reply.body);
  const diagnostics = diagnosticsFor(reply, serviceMessage);
  const needsActivation = serviceMessage !== undefined && ACTIVATION_PATTERN.test(serviceMessage);

  const failure = failureFromReply(reply, diagnostics, needsActivation);
  if (failure !== null) return failure;

  const verdict = readVerdict(reply.body);
  if (verdict === true) return { ok: true, reference };
  if (needsActivation) return sendFailure("not-activated", diagnostics);
  return sendFailure(verdict === false ? "rejected" : "invalid-response", diagnostics);
}

type Page = { heading: string; message: string };

/**
 * The first heading of a page and the first paragraph after it, or undefined when there is no heading.
 * The page is read as a document and never run or shown: a success page quoted inside a script, a
 * comment, a template or a textarea is not part of the document's own content, so it cannot pass for
 * one. A parsed document has scripting turned off, so the content of <noscript> counts as live markup
 * there; it is left out on purpose.
 */
function readPage(body: unknown): Page | undefined {
  if (typeof body !== "string" || body.length > MAX_PAGE_LENGTH) return undefined;
  try {
    const document = new DOMParser().parseFromString(body, "text/html");
    const nodes = Array.from(document.querySelectorAll("h1, p")).filter((node) => node.closest("noscript") === null);
    const headingIndex = nodes.findIndex((node) => node.tagName === "H1");
    if (headingIndex === -1) return undefined;
    const heading = tidy(nodes[headingIndex].textContent ?? "");
    if (heading === "") return undefined;
    const paragraph = nodes.slice(headingIndex + 1).find((node) => node.tagName === "P");
    return { heading, message: tidy(paragraph?.textContent ?? "") };
  } catch {
    // A browser that cannot parse the page is the same as a page that says nothing clear.
    return undefined;
  }
}

/**
 * Ordinary endpoint: sent only when FormSubmit's own success page comes back. Any other page might be a refusal or
 * a success page that FormSubmit has reworded, so it is reported as "could not confirm": the visitor is asked to
 * email, which lets the enquiry be checked, rather than told it was refused, which invites a second send.
 */
export function judgePageReply(reply: Reply, reference: string): SubmissionResult {
  const page = readPage(reply.body);
  const serviceMessage = page === undefined ? undefined : page.message || page.heading;
  const diagnostics = diagnosticsFor(reply, serviceMessage);
  const needsActivation = page !== undefined && ACTIVATION_PATTERN.test(`${page.heading} ${page.message}`);

  const failure = failureFromReply(reply, diagnostics, needsActivation);
  if (failure !== null) return failure;

  if (page === undefined) return sendFailure("invalid-response", diagnostics);
  // A page that mentions activation is not believed even if it also says thanks: the mail may be held, not sent.
  if (needsActivation) return sendFailure("not-activated", diagnostics);
  if (SUCCESS_HEADING_PATTERN.test(page.heading) && SUCCESS_MESSAGE_PATTERN.test(page.message)) {
    return { ok: true, reference };
  }
  return sendFailure("invalid-response", diagnostics);
}
