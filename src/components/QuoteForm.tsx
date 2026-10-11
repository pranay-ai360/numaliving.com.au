"use client";

import { useState } from "react";
import { QuoteFormBody } from "./quote-form/QuoteFormBody";
import { QuoteSuccess } from "./quote-form/QuoteSuccess";

/**
 * The "Request a Quote" form on the Contact page. A sent Quote Request is
 * emailed to Numa through FormSubmit (see `@/lib/quotes/submit`, loaded on
 * demand); the form is replaced by a thank-you with the request's reference.
 */
export function QuoteForm() {
  const [reference, setReference] = useState<string | null>(null);
  const [hasSentOne, setHasSentOne] = useState(false);

  function sendAnother(): void {
    setReference(null);
    setHasSentOne(true);
  }

  if (reference !== null) {
    return <QuoteSuccess reference={reference} onSendAnother={sendAnother} />;
  }
  return <QuoteFormBody onSent={setReference} shouldFocusFirstField={hasSentOne} />;
}
