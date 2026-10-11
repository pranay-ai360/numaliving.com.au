/**
 * The one rule for a base path: the sub-path a site is served from, such as "/numaliving.com.au" on
 * the GitHub Pages project site, or "" at the root of a domain. next.config.ts (which hands it to
 * Next.js as `basePath`), `withBasePath()` (which adds it to raw `<img>` sources) and the end-to-end
 * test settings all go through `parseBasePath`, so a value is accepted or refused the same way
 * everywhere.
 *
 * Keep this file free of imports: next.config.ts loads it with a relative path before the "@/" alias
 * or anything else from Next.js is available.
 */

const DEFAULT_SETTING_NAME = "NEXT_PUBLIC_BASE_PATH";

/** Characters that never need escaping in a URL path: letters, digits, "-", ".", "_" and "~". */
const SEGMENT_PATTERN = /^[A-Za-z0-9._~-]+$/;

const DOT_SEGMENTS: readonly string[] = [".", ".."];

function isValidSegment(segment: string): boolean {
  return SEGMENT_PATTERN.test(segment) && !DOT_SEGMENTS.includes(segment);
}

/** What is wrong with a non-empty setting, or undefined when it is a valid base path. */
function findProblem(raw: string): string | undefined {
  if (!raw.startsWith("/")) return 'it must start with "/"';
  if (raw.endsWith("/")) return 'it must not end with "/"';
  const segments = raw.slice(1).split("/");
  if (segments.includes("")) return 'it must not contain "//"';
  if (!segments.every(isValidSegment)) {
    return 'each part between the slashes may only use letters, digits, "-", ".", "_" and "~", and may not be "." or ".."';
  }
  return undefined;
}

/**
 * Returns the base path a setting describes: "" when it is unset or empty, otherwise the value
 * itself, which then starts with "/" and does not end with one (the form Next.js requires).
 * Anything else throws an error naming the setting and its value, so a bad setting stops the
 * build instead of producing a site with broken links and images.
 */
export function parseBasePath(raw: string | undefined, settingName: string = DEFAULT_SETTING_NAME): string {
  if (raw === undefined || raw === "") return "";
  const problem = findProblem(raw);
  if (problem === undefined) return raw;
  throw new Error(
    `${settingName} is ${JSON.stringify(raw)}, but ${problem}. Use a path such as "/numaliving.com.au", or leave it empty to serve the site from the root of the domain.`,
  );
}
