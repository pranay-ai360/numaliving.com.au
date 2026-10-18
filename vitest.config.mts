import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const COVERAGE_THRESHOLD_PERCENT = 80;
// The defaults (5 s per test, 10 s per hook) ran out on a busy or shared machine: the Quote Request form
// tests type a whole form and normally take 1 to 1.5 s. src/config/testRunner.test.ts pins these.
const TEST_TIMEOUT_MS = 20_000;
const HOOK_TIMEOUT_MS = 30_000;

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors the "@/*" path in tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: TEST_TIMEOUT_MS,
    hookTimeout: HOOK_TIMEOUT_MS,
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      thresholds: {
        statements: COVERAGE_THRESHOLD_PERCENT,
        branches: COVERAGE_THRESHOLD_PERCENT,
        functions: COVERAGE_THRESHOLD_PERCENT,
        lines: COVERAGE_THRESHOLD_PERCENT,
      },
    },
  },
});
