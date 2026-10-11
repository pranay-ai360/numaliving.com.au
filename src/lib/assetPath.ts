/**
 * Base path support for a site served from a sub-path, such as the GitHub Pages project site
 * https://pranay-ai360.github.io/numaliving.com.au/ (base path "/numaliving.com.au").
 *
 * Next.js adds the base path to `next/link` hrefs and to its own assets (scripts, CSS, fonts,
 * icons). It does not add it to a plain `<img src="/...">` that points at a file in /public, so
 * those sources go through `withBasePath` at render time. Content files keep root-relative paths.
 */
import { parseBasePath } from "./basePath";

/** What may follow the base path in a path that already carries it: nothing, "/", "?" or "#". */
const PATH_BOUNDARY = /^[/?#]?$/;

/** True for "/x" and false for "//host/x" (protocol-relative), "https://x", "data:x" and "x". */
function isRootRelative(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

function hasBasePrefix(base: string, path: string): boolean {
  return path.startsWith(base) && PATH_BOUNDARY.test(path.charAt(base.length));
}

/**
 * Prefixes a root-relative path with the base path. Anything else is returned unchanged:
 * absolute and protocol-relative URLs, `data:` and `blob:` URLs, paths without a leading
 * slash, and paths that already start with the base path (so applying it twice is safe).
 *
 * Throws when the base path breaks the rule in basePath.ts (the same rule next.config.ts applies,
 * so a setting the build accepted never throws here).
 */
export function joinBasePath(base: string | undefined, path: string): string {
  const prefix = parseBasePath(base);
  if (prefix === "" || !isRootRelative(path) || hasBasePrefix(prefix, path)) return path;
  return `${prefix}${path}`;
}

/**
 * `joinBasePath` with the base path from NEXT_PUBLIC_BASE_PATH ("" or unset when the site is
 * served from the domain root). Next.js inlines the variable at build time; keep the
 * `process.env.NEXT_PUBLIC_BASE_PATH` spelling so the inlining still finds it.
 */
export function withBasePath(path: string): string {
  return joinBasePath(process.env.NEXT_PUBLIC_BASE_PATH, path);
}
