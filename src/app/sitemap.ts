import type { MetadataRoute } from "next";
import { isIndexable } from "@/config/site";
import { pageRegistry } from "@/content/seo";
import { buildSitemap } from "@/lib/seo/sitemap";

// A static export has no server, so this file is generated once at build time as /sitemap.xml.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap(pageRegistry, { isIndexable });
}
