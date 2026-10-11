import { useReducer } from "react";
import { drawingsReducer, EMPTY_DRAWINGS_LIST, type ChosenDrawing } from "@/lib/quotes/drawingsList";
import { inspectFile } from "@/lib/quotes/pdfCheck";

export type Drawings = {
  chosen: readonly ChosenDrawing[];
  files: readonly File[];
  /** Why files from the latest choice were refused, one message per problem. */
  problems: readonly string[];
  /** The latest change to the list, for the screen-reader status region. */
  announcement: string;
  /** True while newly chosen files are still being read; sending waits for them. */
  isChecking: boolean;
  addFiles: (incoming: readonly File[]) => Promise<void>;
  removeFile: (id: string) => void;
};

/**
 * The PDFs a visitor has chosen. Each new file is read to check that it
 * really is a PDF before it is listed. Each refused file gets its own
 * message, and a choice that would break the Drawings limits is refused as a
 * whole, leaving the files already chosen as they are.
 */
export function useDrawings(): Drawings {
  const [list, dispatch] = useReducer(drawingsReducer, EMPTY_DRAWINGS_LIST);

  async function addFiles(incoming: readonly File[]): Promise<void> {
    if (incoming.length === 0) return;
    dispatch({ type: "check-started" });
    // `inspectFile` never rejects, so every started check also finishes.
    const inspected = await Promise.all(incoming.map((file) => inspectFile(file)));
    dispatch({ type: "checked", inspected });
  }

  function removeFile(id: string): void {
    dispatch({ type: "removed", id });
  }

  return {
    chosen: list.chosen,
    files: list.chosen.map((drawing) => drawing.file),
    problems: list.problems,
    announcement: list.announcement,
    isChecking: list.pendingChecks > 0,
    addFiles,
    removeFile,
  };
}
