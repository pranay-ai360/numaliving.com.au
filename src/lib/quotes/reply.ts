/**
 * Judging FormSubmit's answer to a Quote Request.
 *
 * FormSubmit does not document the JSON its AJAX endpoint returns, so only a
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

/** What came back from FormSubmit, reduced to the parts that decide the outcome. */
export type Reply = {
  status: number;
  isOk: boolean;
  /** True when fetch followed a redirect, so the answer is not the AJAX endpoint's own. */
  isRedirected: boolean;
  /** The parsed JSON body, or undefined when the body could not be read as JSON. */
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

/** FormSubmit's message on one line and capped in length, or undefined when it gave none. */
function readServiceMessage(body: unknown): string | undefined {
  const parsed = serviceMessageSchema.safeParse(body);
  if (!parsed.success) return undefined;
  const message = truncate(toSingleLine(parsed.data.message), MAX_SERVICE_MESSAGE_LENGTH);
  return message === "" ? undefined : message;
}

/** True for a plain yes, false for a plain no, null when the answer does not say. */
function readVerdict(body: unknown): boolean | null {
  const parsed = verdictSchema.safeParse(body);
  return parsed.success ? parsed.data.success : null;
}

/** Sent only when FormSubmit says so plainly; a "no" is a refusal; anything else is unclear. */
export function judgeReply(reply: Reply, reference: string): SubmissionResult {
  const serviceMessage = readServiceMessage(reply.body);
  const diagnostics: Diagnostics =
    serviceMessage === undefined ? { status: reply.status } : { status: reply.status, serviceMessage };
  const needsActivation = serviceMessage !== undefined && ACTIVATION_PATTERN.test(serviceMessage);

  if (reply.status === HTTP_PAYLOAD_TOO_LARGE) return sendFailure("too-large", diagnostics);
  if (!reply.isOk) return sendFailure(needsActivation ? "not-activated" : "rejected", diagnostics);
  // After a redirect the answer comes from some other page, so it proves nothing about delivery.
  if (reply.isRedirected) return sendFailure("invalid-response", diagnostics);

  const verdict = readVerdict(reply.body);
  if (verdict === true) return { ok: true, reference };
  if (needsActivation) return sendFailure("not-activated", diagnostics);
  return sendFailure(verdict === false ? "rejected" : "invalid-response", diagnostics);
}
