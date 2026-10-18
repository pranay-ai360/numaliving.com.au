/**
 * Where the end-to-end tests find the site: the static export in out/, served by
 * scripts/serve-pages.mjs below the same base path GitHub Pages uses. Shared by
 * playwright.config.ts and the specs.
 */
import { parseBasePath } from "../src/lib/basePath";
import { parsePort } from "../src/lib/port";

const DEFAULT_BASE_PATH = "/numaliving.com.au";
const DEFAULT_PORT = 4173;

export const SERVER_HOST = "127.0.0.1";

/**
 * The port the site is served on: 4173, or E2E_PORT (a whole number from 1024 to 65535, see
 * src/lib/port.ts), so that checkouts and worktrees can run their tests side by side. `npm run
 * serve:pages` reads the same variable.
 */
export const SERVER_PORT = parsePort(process.env.E2E_PORT, DEFAULT_PORT, "E2E_PORT");
export const SERVER_ORIGIN = `http://${SERVER_HOST}:${SERVER_PORT}`;

/**
 * PAGES_BASE_PATH must match the NEXT_PUBLIC_BASE_PATH the site was built with; `npm run build:e2e`
 * reads the same variable with the same default, so the two agree. "" means the site is served from
 * the root of the host (a custom domain). It follows the same rule as the build (src/lib/basePath.ts).
 */
export const BASE_PATH = parseBasePath(process.env.PAGES_BASE_PATH ?? DEFAULT_BASE_PATH, "PAGES_BASE_PATH");

/** The home page. It ends in "/", so a relative page URL such as "about/" stays below the base path. */
export const BASE_URL = `${SERVER_ORIGIN}${BASE_PATH}/`;
