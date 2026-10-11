import { useEffect, useId, useRef, type DragEvent } from "react";
import { QUOTE_REQUEST_FIELDS } from "@/lib/quotes/fields";
import { AboutYouFieldset } from "./AboutYouFieldset";
import { DrawingsFieldset } from "./DrawingsFieldset";
import { FieldErrorContext, findField, type FieldError } from "./fieldErrors";
import { FormNotice } from "./FormNotice";
import { Honeypot } from "./Honeypot";
import { preloadSubmitter } from "./loadSubmitter";
import { ProjectFieldset } from "./ProjectFieldset";
import { SendControls } from "./SendControls";
import { useDrawings } from "./useDrawings";
import { useIsHydrated } from "./useIsHydrated";
import { useQuoteSubmission } from "./useQuoteSubmission";

const FIRST_FIELD = QUOTE_REQUEST_FIELDS[0];

type Props = {
  /** Called with the reference once the request has been sent. */
  onSent: (reference: string) => void;
  /** Moves focus to the first field when the form appears, as after "Send another request". */
  shouldFocusFirstField?: boolean;
};

/** Stops a file dropped anywhere on the form from opening in place of the page. Dragged text is left alone. */
function preventFileDrop(event: DragEvent<HTMLFormElement>): void {
  // A drag event may carry no data at all (dataTransfer is null), for example when a script made it.
  const types = event.dataTransfer?.types ?? [];
  if (Array.from(types).includes("Files")) event.preventDefault();
}

/**
 * The "Request a Quote" form itself. It is mounted afresh each time it is
 * shown, which restarts the minimum fill time. `method="post"` means that
 * even a submit before the script runs can never put details in the address;
 * Send stays disabled until then anyway.
 */
export function QuoteFormBody({ onSent, shouldFocusFirstField = false }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const noticeTextId = useId();
  const isHydrated = useIsHydrated();
  const drawings = useDrawings();
  const { isSending, notice, handleSubmit } = useQuoteSubmission({ files: drawings.files, onSent });
  const fieldError: FieldError | null = notice?.field ? { field: notice.field, messageId: noticeTextId } : null;

  useEffect(() => {
    if (shouldFocusFirstField) findField(formRef.current, FIRST_FIELD)?.focus();
  }, [shouldFocusFirstField]);

  useEffect(() => {
    if (notice?.field) findField(formRef.current, notice.field)?.focus();
  }, [notice]);

  return (
    <form
      ref={formRef}
      method="post"
      onSubmit={handleSubmit}
      onFocus={preloadSubmitter}
      onInput={preloadSubmitter}
      onDragOver={preventFileDrop}
      onDrop={preventFileDrop}
    >
      {/* Disabled while sending, so nothing can be changed, added or sent twice mid-upload. */}
      <fieldset disabled={isSending} className="min-w-0 space-y-8">
        <Honeypot />
        <FieldErrorContext value={fieldError}>
          <AboutYouFieldset />
          <ProjectFieldset />
          <DrawingsFieldset
            chosen={drawings.chosen}
            problems={drawings.problems}
            announcement={drawings.announcement}
            isDisabled={isSending}
            onAdd={(files) => void drawings.addFiles(files)}
            onRemove={drawings.removeFile}
          />
        </FieldErrorContext>

        {notice && <FormNotice notice={notice} textId={noticeTextId} />}

        <SendControls isSending={isSending} isReady={isHydrated && !drawings.isChecking} />
      </fieldset>
    </form>
  );
}
