import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// A `findBy*` or `waitFor` gives up after 1 s by default, which a starved machine can miss; five seconds
// still fails a test that is truly broken quickly enough (src/config/testRunner.test.ts pins this).
const ASYNC_UTIL_TIMEOUT_MS = 5_000;
configure({ asyncUtilTimeout: ASYNC_UTIL_TIMEOUT_MS });

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
});
