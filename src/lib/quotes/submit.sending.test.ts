import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FORM_ID,
  FORM_ID_ENV_NAME,
  REFERENCE_PATTERN,
  fetchAnswering,
  fetchDelivering,
  fetchFailing,
  fetchHangingUntilAborted,
  fetchWithStalledBody,
  jsonResponse,
  redirectedResponse,
  sentRequest,
  type FetchMock,
} from "./fetchFixtures";
import { makeRequest } from "./fixtures";
import { sendFailureMessage } from "./messages";
import { submitQuoteRequest } from "./submit";

const DEFAULT_TIMEOUT_MS = 60_000;

function send(fetchImpl: FetchMock, timeoutMs?: number) {
  return submitQuoteRequest(makeRequest(), [], { formId: FORM_ID, fetchImpl, timeoutMs });
}

describe("submitQuoteRequest, sending", () => {
  beforeEach(() => {
    vi.stubEnv(FORM_ID_ENV_NAME, "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("when FormSubmit accepts the request", () => {
    it.each([true, "true", "TRUE"])("returns ok with a reference when success is %j", async (success) => {
      // Arrange
      const fetchImpl = fetchAnswering(() => jsonResponse({ success }));

      // Act
      const result = await send(fetchImpl);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.ok && result.reference).toMatch(REFERENCE_PATTERN);
    });
  });

  describe("when sending fails", () => {
    it("reports network, with no status, when the request cannot be made", async () => {
      const result = await send(fetchFailing());

      expect(result).toEqual({ ok: false, reason: "network", error: sendFailureMessage("network") });
    });

    it("reads the answer to an error status, keeping its status and message for diagnosis", async () => {
      // Arrange
      const fetchImpl = fetchAnswering(() => jsonResponse({ success: "false", message: "Internal Server Error" }, 500));

      // Act
      const result = await send(fetchImpl);

      // Assert
      expect(result).toEqual({
        ok: false,
        reason: "rejected",
        error: sendFailureMessage("rejected"),
        status: 500,
        serviceMessage: "Internal Server Error",
      });
    });

    it("reports too-large when FormSubmit answers 413 with an HTML page", async () => {
      const fetchImpl = fetchAnswering(() => new Response("<html>413 Request Entity Too Large</html>", { status: 413 }));

      const result = await send(fetchImpl);

      expect(result).toEqual({ ok: false, reason: "too-large", error: sendFailureMessage("too-large"), status: 413 });
    });

    it("reports not-activated when FormSubmit asks for the form to be activated", async () => {
      const fetchImpl = fetchAnswering(() => jsonResponse({ success: "false", message: "This form needs Activation." }));

      const result = await send(fetchImpl);

      expect(result).toMatchObject({ ok: false, reason: "not-activated", status: 200 });
    });

    it("never treats an answer reached through a redirect as sent", async () => {
      const fetchImpl = fetchAnswering(() => redirectedResponse({ success: "true" }));

      const result = await send(fetchImpl);

      expect(result).toMatchObject({ ok: false, reason: "invalid-response" });
    });

    it.each([
      ["an HTML page", () => new Response("<html>Bad gateway</html>", { status: 200 })],
      ["an empty body", () => new Response("", { status: 200 })],
      ["truncated JSON", () => new Response('{"success": "tr', { status: 200 })],
    ])("reports invalid-response when the answer is %s", async (_label, makeResponse) => {
      const result = await send(fetchAnswering(makeResponse));

      expect(result).toEqual({
        ok: false,
        reason: "invalid-response",
        error: sendFailureMessage("invalid-response"),
        status: 200,
      });
    });
  });

  describe("timing out", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("reports timeout and aborts the request when the answer takes longer than timeoutMs", async () => {
      // Arrange
      const fetchImpl = fetchHangingUntilAborted();
      const pending = send(fetchImpl, 5000);

      // Act
      await vi.advanceTimersByTimeAsync(5000);
      const result = await pending;

      // Assert
      expect(result).toEqual({ ok: false, reason: "timeout", error: sendFailureMessage("timeout") });
      expect(sentRequest(fetchImpl).init.signal?.aborted).toBe(true);
    });

    it("keeps waiting until timeoutMs has passed", async () => {
      // Arrange
      let isSettled = false;
      const pending = send(fetchHangingUntilAborted(), 5000).then((result) => {
        isSettled = true;
        return result;
      });

      // Act
      await vi.advanceTimersByTimeAsync(4999);

      // Assert
      expect(isSettled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toMatchObject({ reason: "timeout" });
    });

    it("waits 60 seconds by default", async () => {
      // Arrange
      let isSettled = false;
      const pending = send(fetchHangingUntilAborted()).then((result) => {
        isSettled = true;
        return result;
      });

      // Act
      await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS - 1);

      // Assert
      expect(isSettled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toMatchObject({ reason: "timeout" });
    });

    it("reports timeout, not invalid-response, when the time runs out while reading a good answer", async () => {
      const pending = send(fetchWithStalledBody(200), 1000);

      await vi.advanceTimersByTimeAsync(1000);

      await expect(pending).resolves.toMatchObject({ ok: false, reason: "timeout" });
    });

    it("still reports rejected when the time runs out while reading the body of an error status", async () => {
      const pending = send(fetchWithStalledBody(503), 1000);

      await vi.advanceTimersByTimeAsync(1000);

      await expect(pending).resolves.toEqual({
        ok: false,
        reason: "rejected",
        error: sendFailureMessage("rejected"),
        status: 503,
      });
    });

    it("clears its timer once the request has succeeded", async () => {
      const result = await send(fetchDelivering());

      expect(result.ok).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("clears its timer once the request has failed", async () => {
      await send(fetchFailing());

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe("what the visitor is told", () => {
    it("points to the contact email for every failure that happens after validation", async () => {
      // Arrange
      const failingFetches: FetchMock[] = [
        fetchFailing(),
        fetchAnswering(() => jsonResponse({}, 500)),
        fetchAnswering(() => jsonResponse({}, 413)),
        fetchAnswering(() => jsonResponse({ success: "false" })),
        fetchAnswering(() => jsonResponse({ success: "false", message: "This form needs Activation." })),
        fetchAnswering(() => new Response("not json")),
      ];

      // Act
      const results = await Promise.all(failingFetches.map((fetchImpl) => send(fetchImpl)));

      // Assert
      for (const result of results) {
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error).toContain("projects@numaliving.com");
      }
    });

    it("writes nothing to the console, whatever happens", async () => {
      // Arrange
      const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
        vi.spyOn(console, method).mockImplementation(() => undefined),
      );

      // Act
      await send(fetchDelivering());
      await send(fetchAnswering(() => new Response("oops")));
      await send(vi.fn<typeof fetch>().mockRejectedValue(new Error("boom")));
      await submitQuoteRequest(makeRequest({ name: "" }), [], { formId: FORM_ID });
      await submitQuoteRequest(makeRequest(), [], { formId: "" });

      // Assert
      for (const spy of spies) {
        expect(spy).not.toHaveBeenCalled();
      }
    });

    it("gives a different reference to each request", async () => {
      // Arrange
      const references = new Set<string>();

      // Act
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const result = await send(fetchDelivering());
        if (result.ok) references.add(result.reference);
      }

      // Assert
      expect(references.size).toBeGreaterThan(15);
    });
  });
});
