/**
 * The outline rules every page follows, so screen readers, search engines and answer engines can read
 * a page as a nested list: exactly one H1, and it comes first; after that a heading is at most one
 * level deeper than the one before it (an H3 never follows an H1 directly), and any heading may jump
 * back up. Used by the unit tests that render each page (src/app/headings.test.tsx) and by the
 * request-only end-to-end spec that reads every page as served (e2e/headings.spec.ts).
 */

const SHALLOWEST_LEVEL = 1;
const DEEPEST_LEVEL = 6;

function assertLevels(levels: readonly number[]): void {
  const invalid = levels.find((level) => !Number.isInteger(level) || level < SHALLOWEST_LEVEL || level > DEEPEST_LEVEL);
  if (invalid !== undefined) throw new Error(`A heading level is ${SHALLOWEST_LEVEL} to ${DEEPEST_LEVEL}, not ${invalid}.`);
}

function topLevelProblems(levels: readonly number[]): readonly string[] {
  const topCount = levels.filter((level) => level === SHALLOWEST_LEVEL).length;
  if (topCount === 0) return ["the page has no H1"];
  if (topCount > 1) return [`the page has ${topCount} H1 headings, not one`];
  return levels[0] === SHALLOWEST_LEVEL ? [] : [`the first heading is an H${levels[0]}, not the H1`];
}

function skippedLevelProblems(levels: readonly number[]): readonly string[] {
  return levels.flatMap((level, index) => {
    const previous = levels[index - 1];
    if (previous === undefined || level <= previous + 1) return [];
    return [`heading ${index + 1} is an H${level} after an H${previous}: it skips H${previous + 1}`];
  });
}

/** What is wrong with a page's headings, from the levels of its headings in page order (1 for an H1); empty when the outline is sound. */
export function headingProblems(levels: readonly number[]): readonly string[] {
  assertLevels(levels);
  return [...topLevelProblems(levels), ...skippedLevelProblems(levels)];
}
