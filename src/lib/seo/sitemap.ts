import type { MetadataRoute } from "next";
import { canonicalUrl, type UrlOptions } from "@/lib/seo/canonical";
import type { PageSeo } from "@/lib/types";

export type SitemapOptions = Readonly<{
  /** Whether the site may be indexed. A preview lists nothing, so search engines are not pointed at it. */
  isIndexable: boolean;
  /** The address and base path to write URLs with; the site's own by default. */
  urls?: UrlOptions;
}>;

/**
 * The entries of /sitemap.xml: the canonical address of every indexable page, with the day its
 * content last changed (the entry's `updated`, a fixed date: the time of a build says nothing
 * about the page). Empty while the site is not indexable, and a page marked never indexable in the
 * registry (none is) is never listed.
 */
export function buildSitemap(pages: readonly PageSeo[], options: SitemapOptions): MetadataRoute.Sitemap {
  if (!options.isIndexable) return [];
  return pages
    .filter((page) => page.indexable)
    .map((page) => ({ url: canonicalUrl(page.path, options.urls), lastModified: page.updated }));
}
