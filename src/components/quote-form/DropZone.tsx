import type { ChangeEvent, DragEvent, RefObject } from "react";
import { DRAWINGS_LIMITS, formatFileSize } from "@/lib/quotes/drawings";
import { useFieldErrorProps } from "./fieldErrors";

const LIMITS_TEXT = `Up to ${DRAWINGS_LIMITS.maxFiles} files, ${formatFileSize(DRAWINGS_LIMITS.maxTotalBytes)} in total`;

// The original drop zone, plus a visible ring while the hidden file picker inside it has keyboard focus.
const DROP_ZONE_CLASS =
  "flex cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed border-gold/60 bg-linen px-6 py-8 text-center transition-colors hover:border-gold " +
  "has-[:focus-visible]:border-gold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold";

type Props = {
  inputRef: RefObject<HTMLInputElement | null>;
  /** The id of the message about refused files, while there is one. */
  problemsId: string | undefined;
  /** True while the request is being sent: dropped files are ignored, as the disabled picker ignores clicks. */
  isDisabled: boolean;
  onAdd: (files: readonly File[]) => void;
};

function allowDrop(event: DragEvent<HTMLLabelElement>): void {
  // Without this the browser does not let files be dropped here.
  event.preventDefault();
}

/** The dashed area that opens the file picker, and takes PDFs dropped on it. */
export function DropZone({ inputRef, problemsId, isDisabled, onAdd }: Props) {
  const errorProps = useFieldErrorProps("drawings", problemsId);

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(event.target.files ?? []);
    // Clear the input so choosing the same file again still counts as a change.
    event.target.value = "";
    onAdd(files);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>): void {
    // Stops the browser from opening the dropped file in place of the page.
    event.preventDefault();
    // A drag event may carry no data at all (dataTransfer is null), for example when a script made it.
    const files = event.dataTransfer?.files;
    if (!isDisabled && files) onAdd(Array.from(files));
  }

  return (
    <label onDragOver={allowDrop} onDrop={handleDrop} className={DROP_ZONE_CLASS}>
      <span className="font-medium">Attach drawings or BOQ (PDF)</span>
      <span className="mt-1 text-sm text-ink-muted">{LIMITS_TEXT}</span>
      <input
        ref={inputRef}
        type="file"
        accept={DRAWINGS_LIMITS.accept}
        multiple
        className="sr-only"
        onChange={handleChange}
        {...errorProps}
      />
    </label>
  );
}
