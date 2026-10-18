import type { Metadata } from "next";
import { requirePageSeo } from "@/content/seo";
import { buildPageMetadata } from "@/lib/seo/metadata";

/**
 * The metadata of the page at `path`, from its entry in the page registry (src/content/seo.ts):
 * `export const metadata = pageMetadata("/about")`. A page with no entry stops the build.
 */
export function pageMetadata(path: string): Metadata {
  return buildPageMetadata(requirePageSeo(path));
}
