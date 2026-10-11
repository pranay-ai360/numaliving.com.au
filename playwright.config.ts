import { defineConfig } from "@playwright/test";
import { BASE_PATH, BASE_URL, SERVER_PORT } from "./e2e/env";

/**
 * End-to-end tests against the static export (`npm run build:e2e` first: it builds below the base
 * path in PAGES_BASE_PATH with the test form id), served the way GitHub Pages serves the project site.
 * One worker: the local browser licence (CloakBrowser) allows one session at a time.
 */

const isCI = Boolean(process.env.CI);

// Optional: run with another Chromium build installed on this machine (for example CloakBrowser's).
// In CI it is unset and Playwright's own Chromium is used.
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || undefined;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { browserName: "chromium", viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    // "--prefix=" (with "=") also works when the base path is empty.
    command: `node scripts/serve-pages.mjs --root out --prefix=${BASE_PATH} --port ${SERVER_PORT}`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
  },
});
