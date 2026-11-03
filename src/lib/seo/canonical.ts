/**
 * Absolute addresses for search engines and social networks: canonical links, Open Graph and
 * structured-data URLs, the sitemap. A path on this site becomes `https://numaliving.us/about/`.
 *
 * The address is `site.url` and the base path is NEXT_PUBLIC_BASE_PATH ("" on numaliving.us, so the
 * two are simply joined there). Both can be passed in, which is how the tests use other values.
 */
import { site } from "@/config/site";
import { joinBasePath } from "@/lib/assetPath";

export type UrlOptions = Readonly<{
  /** The origin the site is served from, such as "https://numaliving.us". Defaults to `site.url`. */
  origin?: string;
  /** The sub-path the site is served below, such as "/numaliving.com.au", or "" at the root of a domain. Defaults to NEXT_PUBLIC_BASE_PATH. */
  basePath?: string;
}>;

const ALLOWED_SCHEMES: readonly string[] = ["http:", "https:"];

/** The origin as given, or an error that names the rule: a scheme and host only, no path or trailing slash. */
function requireOrigin(raw: string): string {
  const parsed = URL.canParse(raw) ? new URL(raw) : undefined;
  if (parsed === undefined || !ALLOWED_SCHEMES.includes(parsed.protocol) || parsed.origin !== raw) {
    throw new Error(
      `The site address ${JSON.stringify(raw)} must be an origin such as "https://numaliving.us": http or https, a host, and no path or trailing slash. Set it in site.url in src/config/site.ts.`,
    );
  }
  return parsed.origin;
}

/** "/x" is a path on this site; "x", "./x", "#x", "https://x" and "//x" are not. */
function requireSitePath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error(`The path ${JSON.stringify(path)} must start with a single "/" (a path on this site, such as "/about").`);
  }
  return path;
}

/**
 * The full address of a path on this site. A query string and a hash are kept, and no slash is
 * added, so it suits files as well as pages (`/og/default.jpg`, `/sitemap.xml`). For a page, use
 * `canonicalUrl`.
 */
export function absoluteUrl(path: string, options: UrlOptions = {}): string {
  const origin = requireOrigin(options.origin ?? site.url);
  const sitePath = requireSitePath(path);
  // The literal spelling lets Next.js inline the variable, see withBasePath() in assetPath.ts.
  const base = options.basePath ?? process.env.NEXT_PUBLIC_BASE_PATH;
  return new URL(joinBasePath(base, sitePath), origin).href;
}

/** The path without its query string and hash, which never belong to a canonical address. */
function withoutQueryAndHash(path: string): string {
  return path.split(/[?#]/, 1)[0];
}

function withTrailingSlash(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}

/**
 * The one address a page is known by, whatever way a visitor reached it: the full address with a
 * trailing slash (the static export serves every page as a folder), and without a query string or
 * hash. The home page is the site address with a slash.
 */
export function canonicalUrl(path: string, options: UrlOptions = {}): string {
  const pagePath = withTrailingSlash(withoutQueryAndHash(requireSitePath(path)));
  return absoluteUrl(pagePath, options);
}
