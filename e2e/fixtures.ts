/**
 * The `test` every browser spec uses. It fails a test when a page throws, logs a console error,
 * fails to load a resource, or makes a request to any host other than the local test server
 * (FormSubmit included: specs that submit the form mock it with page.route, which wins over the
 * guard's route). Request-only specs import `test` from @playwright/test instead.
 */
import { test as base, expect, type Page } from "@playwright/test";
import { SERVER_HOST, SERVER_ORIGIN } from "./env";

/** sessionStorage survives navigations inside the test's tab, so nothing recorded is lost on the way. */
const PAGE_LOG_KEY = "e2e:page-problems";

type GuardOptions = {
  /** Console errors a test expects, such as the browser's own line about a 404 or 500 response. */
  allowedConsoleErrors: readonly RegExp[];
};

type GuardFixtures = {
  pageGuard: void;
};

/**
 * Runs in every document before the page's own scripts. Some Chromium builds (CloakBrowser, used
 * locally) do not report console messages or uncaught errors to Playwright, so the page records
 * them itself: uncaught errors, unhandled rejections, resources that fail to load, console.error.
 */
function installPageRecorder(storageKey: string): void {
  const record = (text: string): void => {
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      const previous: unknown = stored === null ? [] : JSON.parse(stored);
      const entries = Array.isArray(previous) ? previous : [];
      window.sessionStorage.setItem(storageKey, JSON.stringify([...entries, `${window.location.pathname}: ${text}`]));
    } catch {
      // No storage in this document (an opaque origin such as about:blank): nothing to record into.
    }
  };
  const describeTarget = (target: EventTarget | null): string => {
    if (target instanceof HTMLImageElement) return `image ${target.currentSrc || target.src}`;
    if (target instanceof HTMLScriptElement) return `script ${target.src}`;
    if (target instanceof HTMLLinkElement) return `${target.rel} ${target.href}`;
    return String(target);
  };

  // Capture phase: a resource that fails to load fires a plain Event that does not bubble.
  window.addEventListener(
    "error",
    (event: Event) => record(event instanceof ErrorEvent ? `uncaught error: ${event.message}` : `failed to load ${describeTarget(event.target)}`),
    true,
  );
  window.addEventListener("unhandledrejection", (event) => record(`unhandled rejection: ${String(event.reason)}`));
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]): void => {
    record(`console.error: ${args.map((arg) => String(arg)).join(" ")}`);
    originalConsoleError(...args);
  };
}

/** What the in-page recorder saw; [] when the tab never reached the test server. */
async function readPageLog(page: Page): Promise<readonly string[]> {
  if (page.isClosed() || !page.url().startsWith(SERVER_ORIGIN)) return [];
  try {
    return await page.evaluate((key) => {
      const stored = window.sessionStorage.getItem(key);
      return stored === null ? [] : (JSON.parse(stored) as string[]);
    }, PAGE_LOG_KEY);
  } catch (error) {
    return [`could not read the page's error log: ${error instanceof Error ? error.message : String(error)}`];
  }
}

/** True for http(s) requests to any host but the test server. data: and blob: URLs never leave the page. */
function isOffMachine(url: URL): boolean {
  return (url.protocol === "http:" || url.protocol === "https:") && url.hostname !== SERVER_HOST;
}

export const test = base.extend<GuardOptions & GuardFixtures>({
  allowedConsoleErrors: [[], { option: true }],

  pageGuard: [
    async ({ context, page, allowedConsoleErrors }, use) => {
      let problems: readonly string[] = [];
      const report = (problem: string): void => {
        problems = [...problems, problem];
      };
      const isAllowed = (text: string): boolean => allowedConsoleErrors.some((pattern) => pattern.test(text));

      await context.addInitScript(installPageRecorder, PAGE_LOG_KEY);
      await context.route(isOffMachine, async (route) => {
        report(`request that would leave the machine: ${route.request().method()} ${route.request().url()}`);
        await route.abort("blockedbyclient");
      });
      page.on("pageerror", (error) => report(`uncaught error: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() !== "error" || isAllowed(message.text())) return;
        // For "Failed to load resource" the location is the resource itself, which the text leaves out.
        const source = message.location().url;
        report(`console error: ${message.text()}${source ? ` (${source})` : ""}`);
      });

      await use();

      const pageLog = (await readPageLog(page)).filter((entry) => !isAllowed(entry));
      expect([...problems, ...pageLog], "page errors, console errors, failed resources or off-machine requests").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
