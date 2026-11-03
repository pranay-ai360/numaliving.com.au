/**
 * The rule for the port the end-to-end tests serve the site on (the E2E_PORT setting): a whole number
 * from 1024, the first port above the ones reserved for the system, to 65535, the last there is.
 * e2e/env.ts reads the setting through `parsePort`, so playwright.config.ts and the specs agree, and
 * several checkouts can run their tests side by side by giving each its own port. The same file also
 * says whether a server already running on that port may be reused (`mayReuseExistingServer`).
 */

export const MIN_PORT = 1024;
export const MAX_PORT = 65_535;

const WHOLE_NUMBER = /^\d{1,5}$/;

/**
 * The port a setting names: the default when it is unset, otherwise the number it holds. Anything
 * else, an empty value included, throws an error that names the setting and its value, so a typo stops
 * the tests with a plain message instead of starting a server somewhere else.
 */
export function parsePort(raw: string | undefined, defaultPort: number, settingName = "E2E_PORT"): number {
  if (raw === undefined) return defaultPort;
  const port = WHOLE_NUMBER.test(raw) ? Number(raw) : Number.NaN;
  if (port >= MIN_PORT && port <= MAX_PORT) return port;
  throw new Error(`${settingName} is ${JSON.stringify(raw)}, but it must be a whole number from ${MIN_PORT} to ${MAX_PORT}. Leave it unset to use ${defaultPort}.`);
}

/**
 * Whether Playwright may reuse a server it finds already running on the test port. Only for a quick local
 * rerun on the default port: never in CI, and never when E2E_PORT names the port, because a stale server
 * left there by an earlier run would be tested in place of the fresh build, without a word.
 */
export function mayReuseExistingServer(env: Readonly<Record<string, string | undefined>>): boolean {
  return !env.CI && env.E2E_PORT === undefined;
}
