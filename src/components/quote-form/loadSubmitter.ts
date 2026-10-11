/**
 * The code that validates and sends a Quote Request includes Zod, which is
 * too heavy to ship with the contact page. It is fetched as its own chunk
 * once the visitor starts using the form, and awaited on Send if it has not
 * arrived by then. Nothing else in the form may import `@/lib/quotes/submit`
 * or `@/lib/quotes/schema` statically (`staticImports.test.ts` checks this).
 */
export type SubmitQuoteRequest = typeof import("@/lib/quotes/submit").submitQuoteRequest;

export async function loadSubmitter(): Promise<SubmitQuoteRequest> {
  const submitModule = await import("@/lib/quotes/submit");
  return submitModule.submitQuoteRequest;
}

/** Starts the download early. A failure here is ignored on purpose: Send loads it again and reports any failure. */
export function preloadSubmitter(): void {
  loadSubmitter().catch(() => undefined);
}
