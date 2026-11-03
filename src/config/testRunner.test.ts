/**
 * Pins the test runner's patience. The Quote Request form tests type a whole form with user-event and
 * wait for things to appear; on a busy or shared machine the defaults (5 s per test, 10 s per hook,
 * 1 s per `findBy*`) ran out and an unrelated run failed (the `QuoteForm.loadFailure` test is the
 * usual victim). The values are set in vitest.config.mts and vitest.setup.ts.
 */
import { getConfig } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const MIN_TEST_TIMEOUT_MS = 20_000;
const MIN_HOOK_TIMEOUT_MS = 30_000;
const MIN_ASYNC_UTIL_TIMEOUT_MS = 5_000;

type RunnerConfig = Readonly<{ testTimeout: number; hookTimeout: number }>;

/** The settings this run resolved from vitest.config.mts (Vitest keeps them on the worker state). */
function runnerConfig(): RunnerConfig {
  const state = (globalThis as { __vitest_worker__?: { config?: RunnerConfig } }).__vitest_worker__;
  if (state?.config === undefined) throw new Error("Vitest no longer exposes its resolved config on __vitest_worker__; read the timeouts another way.");
  return state.config;
}

describe("the test runner's timeouts", () => {
  it("gives each test at least 20 seconds, so a starved machine does not fail a slow form test", ({ task }) => {
    // Arrange
    const minimum = MIN_TEST_TIMEOUT_MS;

    // Act
    const timeout = task.timeout;

    // Assert
    expect(timeout).toBeGreaterThanOrEqual(minimum);
    expect(runnerConfig().testTimeout).toBeGreaterThanOrEqual(minimum);
  });

  it("gives each set-up and tear-down hook at least 30 seconds", () => {
    // Arrange
    const minimum = MIN_HOOK_TIMEOUT_MS;

    // Act
    const { hookTimeout } = runnerConfig();

    // Assert
    expect(hookTimeout).toBeGreaterThanOrEqual(minimum);
  });

  it("lets findBy and waitFor wait at least 5 seconds for something to appear", () => {
    // Arrange
    const minimum = MIN_ASYNC_UTIL_TIMEOUT_MS;

    // Act
    const { asyncUtilTimeout } = getConfig();

    // Assert
    expect(asyncUtilTimeout).toBeGreaterThanOrEqual(minimum);
  });
});
