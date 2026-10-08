import type { NextConfig } from "next";

/**
 * Static export: `npm run build` writes plain HTML/CSS/JS to /out,
 * which Firebase Hosting serves. The site talks to Firebase from the
 * browser, so no server is needed. If the portal later needs server
 * code, remove `output` and deploy with Firebase App Hosting instead.
 */
const nextConfig: NextConfig = {
  output: "export",
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
