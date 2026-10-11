import type { NextConfig } from "next";
// A relative path, not "@/lib/basePath": Next.js loads this file before the "@/" alias exists. The
// same rule checks the base path in withBasePath(), so the build and the images always agree.
import { parseBasePath } from "./src/lib/basePath";

/**
 * Static export for GitHub Pages: `npm run build` writes plain HTML, CSS and JS to /out and the
 * deploy workflow publishes that folder. GitHub Pages serves static files only, so server
 * features (API routes, middleware, rewrites) cannot be used.
 */
const nextConfig: NextConfig = {
  output: "export",
  // NEXT_PUBLIC_BASE_PATH is the sub-path the site is served from: "/numaliving.com.au" on the GitHub
  // Pages project site, empty for local development or a custom domain. Next.js would also reject a
  // malformed basePath, but without naming the setting, so a bad value stops the build here first.
  basePath: parseBasePath(process.env.NEXT_PUBLIC_BASE_PATH),
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
