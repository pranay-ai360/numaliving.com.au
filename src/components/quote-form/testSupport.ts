/**
 * Helpers shared by the Quote Request form tests. Imported only by tests.
 */
import { render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, vi, type MockInstance } from "vitest";
import { QuoteForm } from "@/components/QuoteForm";
import { FORM_ID, FORM_ID_ENV_NAME, jsonResponse } from "@/lib/quotes/fetchFixtures";
import { MIN_FILL_TIME_MS } from "./constants";

export { ENDPOINT, FORM_ID, FORM_ID_ENV_NAME, REFERENCE_PATTERN } from "@/lib/quotes/fetchFixtures";

export type FetchSpy = MockInstance<typeof fetch>;

/** Only the clock is faked, so user-event and Testing Library keep their real timers. */
export function useFakeClock(): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-11T10:00:00Z"));
}

export function passTime(milliseconds: number): void {
  vi.advanceTimersByTime(milliseconds);
}

/**
 * Registers the usual set-up for tests that send the form: a fake clock, a
 * configured form id, and a fetch that answers "sent". Returns a getter for
 * the fetch spy of the running test.
 */
export function setUpSending(): () => FetchSpy {
  let fetchSpy: FetchSpy | null = null;

  beforeEach(() => {
    useFakeClock();
    vi.stubEnv(FORM_ID_ENV_NAME, FORM_ID);
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => successResponse());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  return () => {
    if (fetchSpy === null) throw new Error("setUpSending() must be called inside a describe block");
    return fetchSpy;
  };
}

/**
 * Renders the form. By default it has been on screen long enough to be sent
 * (this needs the fake clock). `applyAccept: false` lets a test choose a file
 * that the file input's `accept` filter would otherwise hide from the browser.
 */
export function renderQuoteForm(options: { isAged?: boolean; applyAccept?: boolean } = {}): UserEvent {
  const user = userEvent.setup({ applyAccept: options.applyAccept ?? true });
  render(createElement(QuoteForm));
  if (options.isAged ?? true) passTime(MIN_FILL_TIME_MS);
  return user;
}

export async function fillRequiredFields(user: UserEvent): Promise<void> {
  await user.type(screen.getByLabelText("Full name *"), "Ada Lovelace");
  await user.type(screen.getByLabelText("Email *"), "ada@example.com");
  await user.selectOptions(screen.getByLabelText("Your role *"), "Architect / designer");
  await user.selectOptions(screen.getByLabelText("Project type *"), "Residences");
  await user.type(screen.getByLabelText("Site location (city, country) *"), "Dubai, UAE");
  await user.selectOptions(screen.getByLabelText("Timeline *"), "Start within 3 months");
  await user.type(screen.getByLabelText("Scope and notes *"), "Walnut wardrobes for twelve villas.");
}

export function getSendButton(): HTMLElement {
  return screen.getByRole("button", { name: /^(Send Request|Sending…)$/ });
}

export function getDrawingsInput(): HTMLElement {
  return screen.getByLabelText(/Attach drawings or BOQ/);
}

/** The dashed area around the file picker that also accepts dropped files. */
export function getDropZone(): HTMLElement {
  const zone = getDrawingsInput().closest("label");
  if (zone === null) throw new Error("Expected the file picker to sit inside its drop zone label");
  return zone;
}

/** The polite status regions of the form, by their current text. */
export function statusTexts(): string[] {
  return screen.queryAllByRole("status").map((region) => region.textContent ?? "");
}

export function successResponse(): Response {
  return jsonResponse({ success: "true" });
}

/** The FormData that the nth call to fetch sent. */
export function sentBody(fetchSpy: { mock: { calls: unknown[][] } }, callIndex = 0): FormData {
  const init = fetchSpy.mock.calls[callIndex]?.[1] as RequestInit | undefined;
  if (!(init?.body instanceof FormData)) throw new Error("Expected fetch to have been given FormData");
  return init.body;
}

/** A promise the test settles by hand, for holding a request in flight. */
export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
