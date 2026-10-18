/**
 * Stand-ins for `fetch` and for FormSubmit's answers, shared by the quotes
 * and form tests. Imported only by tests; nothing in the shipped site uses it.
 */
import { vi, type Mock } from "vitest";

export const FORM_ID = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
export const FORM_ID_ENV_NAME = "NEXT_PUBLIC_FORMSUBMIT_ID";
export const ENDPOINT = `https://formsubmit.co/ajax/${FORM_ID}`;
/** The endpoint for requests with Drawings: FormSubmit's ordinary one, which answers with a web page. */
export const PAGE_ENDPOINT = `https://formsubmit.co/${FORM_ID}`;
export const REFERENCE_PATTERN = /^NL-[A-HJ-NP-Z2-9]{6}$/;

/**
 * A page from FormSubmit's ordinary endpoint, cut down to what the form reads: the heading and the first
 * paragraph. Only the success page below and the "Check email address" page (for an unknown form id) were seen
 * live, on 18 October 2026; every other page built with this helper, the activation page included, is made up to
 * exercise the form's own logic.
 */
export function formSubmitPage(heading: string, message: string): string {
  return (
    `<!DOCTYPE html><html lang="en"><head><title>FormSubmit</title></head><body><div class="container">` +
    `<h1>${heading}</h1><p>${message}</p><p>You are using FormSubmit</p></div></body></html>`
  );
}

export const SUCCESS_PAGE = formSubmitPage(
  "Thanks!",
  "The form was submitted successfully. Return to original site: <a class='links' href='https://numaliving.us/'>https://numaliving.us/</a>",
);

export type FetchMock = Mock<typeof fetch>;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Marks a real Response as the end of a redirect, the way fetch reports one it followed. */
function markRedirected(response: Response): Response {
  Object.defineProperty(response, "redirected", { value: true });
  return response;
}

export function redirectedResponse(body: unknown): Response {
  return markRedirected(jsonResponse(body));
}

/** An HTML page answer, the way FormSubmit's ordinary endpoint sends one. */
export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=UTF-8" } });
}

export function redirectedHtmlResponse(html: string): Response {
  return markRedirected(htmlResponse(html));
}

/** A fetch stand-in that answers every call with a fresh response (a body can be read only once). */
export function fetchAnswering(makeResponse: () => Response): FetchMock {
  return vi.fn<typeof fetch>(async () => makeResponse());
}

export function fetchDelivering(): FetchMock {
  return fetchAnswering(() => jsonResponse({ success: "true", message: "The form was submitted successfully." }));
}

/** Like `fetchDelivering`, for a request with Drawings, which FormSubmit answers with its success page. */
export function fetchDeliveringPage(): FetchMock {
  return fetchAnswering(() => htmlResponse(SUCCESS_PAGE));
}

/** A fetch stand-in that fails the way a real fetch does when the request cannot be made at all. */
export function fetchFailing(): FetchMock {
  return vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
}

function abortError(): DOMException {
  return new DOMException("The operation was aborted.", "AbortError");
}

function rejectOnAbort(signal: AbortSignal | null | undefined): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(abortError()));
  });
}

/** A fetch stand-in that never answers, and fails the way a real fetch does once it is aborted. */
export function fetchHangingUntilAborted(): FetchMock {
  return vi.fn<typeof fetch>((_input, init) => rejectOnAbort(init?.signal));
}

/** A fetch stand-in whose status arrives, but whose body (read as `reader`) never finishes until aborted. */
export function fetchWithStalledBody(status = 200, reader: "json" | "text" = "json"): FetchMock {
  return vi.fn<typeof fetch>(async (_input, init) => {
    const stalled = { ok: status >= 200 && status < 300, status, [reader]: () => rejectOnAbort(init?.signal) };
    return stalled as unknown as Response;
  });
}

/** The URL, options and FormData of the nth call to a fetch stand-in. */
export function sentRequest(fetchImpl: FetchMock, callIndex = 0): { url: string; init: RequestInit; body: FormData } {
  const [url, init] = fetchImpl.mock.calls[callIndex];
  if (!(init?.body instanceof FormData)) throw new Error("Expected the request body to be FormData");
  return { url: String(url), init, body: init.body };
}
