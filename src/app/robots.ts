import type { MetadataRoute } from "next";
import { isIndexable } from "@/config/site";
import { buildRobots } from "@/lib/robots";

// A static export has no server, so this file is generated once at build time as /robots.txt.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return buildRobots(isIndexable);
}
