import { useId, useRef } from "react";
import { DRAWINGS_LIMITS, formatFileSize } from "@/lib/quotes/drawings";
import type { ChosenDrawing } from "@/lib/quotes/drawingsList";
import { ChosenDrawings } from "./ChosenDrawings";
import { DropZone } from "./DropZone";
import { useFieldErrorProps } from "./fieldErrors";
import { FIELD_CLASS, LABEL_CLASS } from "./formStyles";

const LINK_HELP_TEXT = `For sets over ${formatFileSize(DRAWINGS_LIMITS.maxTotalBytes)}, paste a share link instead`;

type Props = {
  chosen: readonly ChosenDrawing[];
  problems: readonly string[];
  announcement: string;
  /** True while the request is being sent. */
  isDisabled: boolean;
  onAdd: (files: readonly File[]) => void;
  onRemove: (id: string) => void;
};

/** The optional link for a set of drawings too big to attach. */
function DrawingsLinkField() {
  const helpId = useId();
  const errorProps = useFieldErrorProps("drawingsLink", helpId);

  return (
    <div className="mt-6">
      <label className={LABEL_CLASS}>
        Link to larger drawings
        <input
          name="drawingsLink"
          type="url"
          placeholder="Google Drive, Dropbox or WeTransfer link"
          className={FIELD_CLASS}
          {...errorProps}
        />
      </label>
      <p id={helpId} className="mt-1.5 text-sm text-ink-muted">
        {LINK_HELP_TEXT}
      </p>
    </div>
  );
}

/** Attach PDF drawings, by choosing or dropping them, or paste a link to a set that is too big to attach. */
export function DrawingsFieldset({ chosen, problems, announcement, isDisabled, onAdd, onRemove }: Props) {
  const problemsId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasProblems = problems.length > 0;

  return (
    <fieldset>
      <legend className="eyebrow mb-4">Drawings</legend>
      <DropZone
        inputRef={fileInputRef}
        problemsId={hasProblems ? problemsId : undefined}
        isDisabled={isDisabled}
        onAdd={onAdd}
      />
      {hasProblems && (
        <div id={problemsId} role="alert" className="mt-2 space-y-1 text-sm text-red-700">
          {problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </div>
      )}
      {chosen.length > 0 && <ChosenDrawings chosen={chosen} onRemove={onRemove} fileInputRef={fileInputRef} />}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <DrawingsLinkField />
    </fieldset>
  );
}
