import type { Metadata, MetadataRoute } from "next";
import { absoluteUrl, type UrlOptions } from "@/lib/seo/canonical";

/** Where the sitemap is served: at the root of the site, written by src/app/sitemap.ts. */
const SITEMAP_PATH = "/sitemap.xml";

/**
 * The rules served at /robots.txt. They allow crawling whether or not the site is indexable:
 * a crawler has to fetch a page to see its `noindex` tag (`buildRobotsMetadata`), and a page that
 * robots.txt blocks can still be listed in search results from links elsewhere. Crawlers also only
 * read robots.txt at the root of a host, so on a project site (served below a sub-path) this file
 * is not consulted at all. The sitemap is named only once the site is indexable: while it is a
 * preview the sitemap is empty (src/lib/seo/sitemap.ts), and a Sitemap line would invite crawlers
 * to a file with nothing in it.
 */
export function buildRobots(isIndexable: boolean, urls?: UrlOptions): MetadataRoute.Robots {
  const rules = { userAgent: "*", allow: "/" };
  return isIndexable ? { rules, sitemap: absoluteUrl(SITEMAP_PATH, urls) } : { rules };
}

/**
 * The robots metadata for every page, rendered as `<meta name="robots">`. It stays unset once the
 * site is indexable. Crawlers only read /robots.txt at the root of a host, so on a project site
 * (served below a sub-path) this tag is the control that actually applies.
 */
export function buildRobotsMetadata(isIndexable: boolean): Metadata["robots"] {
  return isIndexable ? undefined : { index: false, follow: false };
}
