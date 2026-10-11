import { useId, type RefObject } from "react";
import { formatFileSize, sanitiseFileName } from "@/lib/quotes/drawings";
import type { ChosenDrawing } from "@/lib/quotes/drawingsList";

type Props = {
  chosen: readonly ChosenDrawing[];
  onRemove: (id: string) => void;
  /** Where focus goes when the last file in the list is removed. */
  fileInputRef: RefObject<HTMLInputElement | null>;
};

/**
 * The chosen Drawings, each keyed by its own id. After a Remove, focus moves
 * to the next Remove button, or back to the file picker after the last one,
 * so keyboard and screen-reader users are not dropped at the top of the page.
 */
export function ChosenDrawings({ chosen, onRemove, fileInputRef }: Props) {
  const listId = useId();
  const removeButtonId = (id: string): string => `${listId}-remove-${id}`;

  function remove(index: number): void {
    const next = index + 1 < chosen.length ? chosen[index + 1] : null;
    const focusTarget = next === null ? fileInputRef.current : document.getElementById(removeButtonId(next.id));
    onRemove(chosen[index].id);
    focusTarget?.focus();
  }

  return (
    <ul className="mt-3 divide-y divide-line border border-line">
      {chosen.map(({ id, file }, index) => {
        const name = sanitiseFileName(file.name);
        return (
          <li key={id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="truncate">{name}</span>
            <span className="flex shrink-0 items-center gap-4 text-ink-muted">
              {formatFileSize(file.size)}
              <button
                id={removeButtonId(id)}
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => remove(index)}
                className="text-gold hover:text-gold-dark"
              >
                Remove
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
