import { useEffect, useRef, useState, type FormEvent } from "react";
import { UNEXPECTED_FAILURE_MESSAGE } from "@/lib/quotes/messages";
import { createReference } from "@/lib/quotes/reference";
import type { SubmissionFailure } from "@/lib/types";
import { HONEYPOT_FIELD_NAME, MIN_FILL_TIME_MS, REVIEW_MESSAGE } from "./constants";
import type { Notice } from "./FormNotice";
import { loadSubmitter } from "./loadSubmitter";
import { readQuoteRequest } from "./readQuoteRequest";

const REVIEW_NOTICE: Notice = { text: REVIEW_MESSAGE, emailReason: null, field: null };
const UNEXPECTED_NOTICE: Notice = { text: UNEXPECTED_FAILURE_MESSAGE, emailReason: "unexpected", field: null };

type Options = {
  files: readonly File[];
  /** Called with the reference once the request has been sent. */
  onSent: (reference: string) => void;
};

export type QuoteSubmission = {
  isSending: boolean;
  notice: Notice | null;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

function toNotice(failure: SubmissionFailure): Notice {
  // A validation problem is about what the visitor typed, so emailing instead would not help.
  if (failure.reason === "invalid") return { text: failure.error, emailReason: null, field: failure.field ?? null };
  return { text: failure.error, emailReason: failure.reason, field: null };
}

function isHoneypotFilled(formData: FormData): boolean {
  const value = formData.get(HONEYPOT_FIELD_NAME);
  return typeof value === "string" && value.trim() !== "";
}

/** A check, for use on Send, of whether the form has been on screen for the minimum fill time. */
function useMinimumFillTime(): () => boolean {
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  return () => shownAt.current !== null && Date.now() - shownAt.current >= MIN_FILL_TIME_MS;
}

/**
 * Sending the form: the honeypot, the minimum fill time, a guard against a
 * double submit, and the call to `submitQuoteRequest`, loaded on demand.
 */
export function useQuoteSubmission({ files, onSent }: Options): QuoteSubmission {
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // Set at once, before React re-renders, so a second submit in the same moment is ignored.
  const isSendingRef = useRef(false);
  const hasBeenShownLongEnough = useMinimumFillTime();

  async function send(formData: FormData): Promise<void> {
    isSendingRef.current = true;
    setNotice(null);
    setIsSending(true);
    try {
      const submitQuoteRequest = await loadSubmitter();
      const result = await submitQuoteRequest(readQuoteRequest(formData), files);
      if (result.ok) onSent(result.reference);
      else setNotice(toNotice(result));
    } catch {
      // `submitQuoteRequest` reports every expected failure as a result. This guards against
      // the unexpected, such as its code failing to load, so Send is never stuck on "Sending".
      setNotice(UNEXPECTED_NOTICE);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isSendingRef.current) return;
    // Read before sending starts: the disabled fieldset would leave every field out of the FormData.
    const formData = new FormData(event.currentTarget);

    // A filled honeypot means a bot: look successful and send nothing.
    if (isHoneypotFilled(formData)) {
      onSent(createReference());
      return;
    }
    if (!hasBeenShownLongEnough()) {
      setNotice(REVIEW_NOTICE);
      return;
    }
    await send(formData);
  }

  return { isSending, notice, handleSubmit };
}
