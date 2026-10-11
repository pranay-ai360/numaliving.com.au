/**
 * The Drawings a visitor has chosen, as the state of the form's reducer.
 *
 * Every state change here is pure: it returns a new list and never changes
 * the one it was given. Each listed file gets an id that stays the same while
 * it is listed, so the form can key its list and move focus by it.
 */
import { sanitiseFileName, validateDrawings } from "./drawings";
import type { InspectedFile } from "./pdfCheck";

export type ChosenDrawing = {
  readonly id: string;
  readonly file: File;
};

export type DrawingsList = {
  readonly chosen: readonly ChosenDrawing[];
  /** Why files from the latest choice were refused, one message per problem. */
  readonly problems: readonly string[];
  /** The latest change to the list, for screen readers; empty until the list first changes. */
  readonly announcement: string;
  /** How many choices are still being inspected. Sending waits until there are none. */
  readonly pendingChecks: number;
  readonly nextId: number;
};

export type DrawingsAction =
  | { type: "check-started" }
  | { type: "checked"; inspected: readonly InspectedFile[] }
  | { type: "removed"; id: string };

export const EMPTY_DRAWINGS_LIST: DrawingsList = {
  chosen: [],
  problems: [],
  announcement: "",
  pendingChecks: 0,
  nextId: 1,
};

type SortedChoice = { accepted: readonly File[]; problems: readonly string[] };

/** Same name, size and last-modified time: the same file chosen again. */
function isSameFile(first: File, second: File): boolean {
  return first.name === second.name && first.size === second.size && first.lastModified === second.lastModified;
}

function describeCount(count: number): string {
  if (count === 0) return "No files attached.";
  return count === 1 ? "1 file attached." : `${count} files attached.`;
}

/** Splits a checked choice into the files that can be added and a message for each one that cannot. */
function sortChoice(listed: readonly File[], inspected: readonly InspectedFile[]): SortedChoice {
  return inspected.reduce<SortedChoice>(
    (sorted, { file, problem }) => {
      if (problem !== null) return { ...sorted, problems: [...sorted.problems, problem] };
      const isDuplicate = [...listed, ...sorted.accepted].some((other) => isSameFile(other, file));
      if (isDuplicate) {
        return { ...sorted, problems: [...sorted.problems, `${sanitiseFileName(file.name)} is already attached.`] };
      }
      return { ...sorted, accepted: [...sorted.accepted, file] };
    },
    { accepted: [], problems: [] },
  );
}

/**
 * Adds the files of a checked choice. Each refused file gets its own message;
 * a choice that would break the count or size limit is refused as a whole,
 * and the files already listed stay as they are.
 */
function addChecked(list: DrawingsList, inspected: readonly InspectedFile[]): DrawingsList {
  const pendingChecks = Math.max(0, list.pendingChecks - 1);
  const listed = list.chosen.map((drawing) => drawing.file);
  const { accepted, problems } = sortChoice(listed, inspected);
  const limitProblem = accepted.length === 0 ? null : validateDrawings([...listed, ...accepted]);
  const allProblems = [...new Set(limitProblem === null ? problems : [...problems, limitProblem])];

  if (accepted.length === 0 || limitProblem !== null) return { ...list, problems: allProblems, pendingChecks };

  const added = accepted.map((file, index) => ({ id: `drawing-${list.nextId + index}`, file }));
  const chosen = [...list.chosen, ...added];
  return {
    chosen,
    problems: allProblems,
    announcement: describeCount(chosen.length),
    pendingChecks,
    nextId: list.nextId + added.length,
  };
}

function removeChosen(list: DrawingsList, id: string): DrawingsList {
  const chosen = list.chosen.filter((drawing) => drawing.id !== id);
  if (chosen.length === list.chosen.length) return list;
  return { ...list, chosen, problems: [], announcement: describeCount(chosen.length) };
}

export function drawingsReducer(list: DrawingsList, action: DrawingsAction): DrawingsList {
  switch (action.type) {
    case "check-started":
      return { ...list, pendingChecks: list.pendingChecks + 1 };
    case "checked":
      return addChecked(list, action.inspected);
    case "removed":
      return removeChosen(list, action.id);
  }
}
