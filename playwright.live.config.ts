import { defineConfig } from "@playwright/test";

/**
 * Smoke tests against the deployed site: `npm run test:live` (LIVE_URL overrides the address). They
 * only read pages and photos and never submit a form. They live apart from e2e/, which CI runs against
 * a build served on this machine, so CI stays offline.
 */
const LIVE_URL = (process.env.LIVE_URL ?? "https://numaliving.us/").replace(/\/*$/, "/");

// Optional: run with another Chromium build installed on this machine, as in playwright.config.ts.
const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || undefined;

export default defineConfig({
  testDir: "e2e-live",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 60_000,
  // Photos take a moment over a real network: polls and assertions wait up to 20 s, not the default 5 s.
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: LIVE_URL,
    trace: "retain-on-failure",
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
});
