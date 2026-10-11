/**
 * Where the end-to-end tests find the site: the static export in out/, served by
 * scripts/serve-pages.mjs below the same base path GitHub Pages uses. Shared by
 * playwright.config.ts and the specs.
 */
import { parseBasePath } from "../src/lib/basePath";

const DEFAULT_BASE_PATH = "/numaliving.com.au";

export const SERVER_HOST = "127.0.0.1";
export const SERVER_PORT = 4173;
export const SERVER_ORIGIN = `http://${SERVER_HOST}:${SERVER_PORT}`;

/**
 * PAGES_BASE_PATH must match the NEXT_PUBLIC_BASE_PATH the site was built with; `npm run build:e2e`
 * reads the same variable with the same default, so the two agree. "" means the site is served from
 * the root of the host (a custom domain). It follows the same rule as the build (src/lib/basePath.ts).
 */
export const BASE_PATH = parseBasePath(process.env.PAGES_BASE_PATH ?? DEFAULT_BASE_PATH, "PAGES_BASE_PATH");

/** The home page. It ends in "/", so a relative page URL such as "about/" stays below the base path. */
export const BASE_URL = `${SERVER_ORIGIN}${BASE_PATH}/`;
