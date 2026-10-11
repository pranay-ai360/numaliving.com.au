import type { Metadata, MetadataRoute } from "next";

/**
 * The rules served at /robots.txt. They allow crawling whether or not the site is indexable:
 * a crawler has to fetch a page to see its `noindex` tag (`buildRobotsMetadata`), and a page that
 * robots.txt blocks can still be listed in search results from links elsewhere. Crawlers also only
 * read robots.txt at the root of a host, so on a project site (served below a sub-path) this file
 * is not consulted at all. `isIndexable` stays so a sitemap can be listed here once the site is live.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the sitemap, see above
export function buildRobots(isIndexable: boolean): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" } };
}

/**
 * The robots metadata for every page, rendered as `<meta name="robots">`. It stays unset once the
 * site is indexable. Crawlers only read /robots.txt at the root of a host, so on a project site
 * (served below a sub-path) this tag is the control that actually applies.
 */
export function buildRobotsMetadata(isIndexable: boolean): Metadata["robots"] {
  return isIndexable ? undefined : { index: false, follow: false };
}
