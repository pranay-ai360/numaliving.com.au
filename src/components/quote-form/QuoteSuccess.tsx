import { useEffect, useRef } from "react";
import { site } from "@/config/site";
import { followUpEmailHref } from "@/lib/quotes/emailLinks";

type Props = {
  reference: string;
  onSendAnother: () => void;
};

/** The thank-you that replaces the form. Focus moves to its heading, so phone and screen-reader users land on it. */
export function QuoteSuccess({ reference, onSendAnother }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div role="status" className="border border-gold bg-gold-soft p-8">
      <h2 ref={headingRef} tabIndex={-1} className="display text-lg text-gold">
        Thank You
      </h2>
      <p className="mt-4 text-lg">We have your request. Our team will reply within two working days.</p>
      <p className="mt-2 text-sm text-ink-muted">Reference: {reference}</p>
      <p className="mt-2 text-sm text-ink-muted">
        No reply within two working days? Email{" "}
        <a href={followUpEmailHref(reference)} className="underline hover:text-gold">
          {site.contact.email}
        </a>{" "}
        quoting {reference}.
      </p>
      <button type="button" onClick={onSendAnother} className="mt-6 text-sm font-medium text-gold hover:text-gold-dark">
        Send another request →
      </button>
    </div>
  );
}
