import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const COVERAGE_THRESHOLD_PERCENT = 80;

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors the "@/*" path in tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
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
