import { PRIVACY_NOTE, SENDING_TEXT } from "./constants";

// Kept exactly as before the migration.
const SEND_BUTTON_CLASS =
  "w-full rounded-sm bg-gold px-8 py-3.5 font-medium tracking-wide text-white transition-colors hover:bg-gold-dark disabled:opacity-60 sm:w-auto";

type Props = {
  isSending: boolean;
  /** False until the page's script is running, and while chosen files are still being checked. */
  isReady: boolean;
};

/** The Send button, the privacy note under it, and a polite announcement while sending. */
export function SendControls({ isSending, isReady }: Props) {
  return (
    <div>
      <button type="submit" disabled={isSending || !isReady} className={SEND_BUTTON_CLASS}>
        {isSending ? SENDING_TEXT : "Send Request"}
      </button>
      <p className="mt-3 text-xs text-ink-muted">{PRIVACY_NOTE}</p>
      <p role="status" className="sr-only">
        {isSending ? SENDING_TEXT : ""}
      </p>
    </div>
  );
}
