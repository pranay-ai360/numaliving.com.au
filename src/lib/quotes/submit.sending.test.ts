import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { site } from "@/config/site";
import {
  FORM_ID,
  FORM_ID_ENV_NAME,
  PAGE_ENDPOINT,
  REFERENCE_PATTERN,
  SUCCESS_PAGE,
  fetchAnswering,
  fetchDelivering,
  fetchDeliveringPage,
  fetchFailing,
  fetchHangingUntilAborted,
  fetchWithStalledBody,
  formSubmitPage,
  htmlResponse,
  jsonResponse,
  redirectedHtmlResponse,
  redirectedResponse,
  sentRequest,
  type FetchMock,
} from "./fetchFixtures";
import { makePdf, makeRequest } from "./fixtures";
import { sendFailureMessage } from "./messages";
import { submitQuoteRequest } from "./submit";

const DEFAULT_TIMEOUT_MS = 60_000;

function send(fetchImpl: FetchMock, timeoutMs?: number) {
  return submitQuoteRequest(makeRequest(), [], { formId: FORM_ID, fetchImpl, timeoutMs });
}

function sendWithDrawings(fetchImpl: FetchMock, timeoutMs?: number) {
  return submitQuoteRequest(makeRequest(), [makePdf("plan.pdf", 2048)], { formId: FORM_ID, fetchImpl, timeoutMs });
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

  // FormSubmit documents attachments for its ordinary endpoint only; its AJAX endpoint drops them (seen live on
  // 18 October 2026). So a request with Drawings goes to the ordinary endpoint, whose answer is a web page.
  describe("with Drawings attached", () => {
    it("posts to FormSubmit's ordinary endpoint and not the AJAX one, without asking for JSON", async () => {
      // Arrange
      const fetchImpl = fetchDeliveringPage();

      // Act
      await sendWithDrawings(fetchImpl);

      // Assert
      const { url, init } = sentRequest(fetchImpl);
      expect(url).toBe(PAGE_ENDPOINT);
      expect(init.method).toBe("POST");
      expect(new Headers(init.headers).get("accept")).toBeNull();
    });

    it("attaches each PDF as its own field and says how many to expect", async () => {
      // Arrange
      const fetchImpl = fetchDeliveringPage();
      const files = [makePdf("plan.pdf", 2048), makePdf("boq.pdf", 4096)];

      // Act
      await submitQuoteRequest(makeRequest(), files, { formId: FORM_ID, fetchImpl });

      // Assert
      const { body } = sentRequest(fetchImpl);
      expect((body.get("attachment") as File).name).toBe("plan.pdf");
      expect((body.get("attachment2") as File).name).toBe("boq.pdf");
      expect(body.get("Attached drawings")).toBe("Expect 2 PDFs attached: plan.pdf (2 KB); boq.pdf (4 KB)");
      expect(String(body.get("_subject")).endsWith("[2 PDFs]")).toBe(true);
    });

    it("returns ok with a reference when FormSubmit shows its success page", async () => {
      const result = await sendWithDrawings(fetchDeliveringPage());

      expect(result.ok).toBe(true);
      expect(result.ok && result.reference).toMatch(REFERENCE_PATTERN);
    });

    it("puts the same reference in the email and in the thank-you", async () => {
      const fetchImpl = fetchDeliveringPage();

      const result = await sendWithDrawings(fetchImpl);

      expect(result.ok && result.reference).toBe(sentRequest(fetchImpl).body.get("Reference"));
    });

    it("reports invalid-response, keeping the page's message for diagnosis, for any other page", async () => {
      // Arrange
      const page = formSubmitPage("Check email address", "Email address is not formatted correctly");

      // Act
      const result = await sendWithDrawings(fetchAnswering(() => htmlResponse(page)));

      // Assert
      expect(result).toEqual({
        ok: false,
        reason: "invalid-response",
        error: sendFailureMessage("invalid-response"),
        status: 200,
        serviceMessage: "Email address is not formatted correctly",
      });
    });

    it("reports rejected for an error status, whatever the page says", async () => {
      const result = await sendWithDrawings(fetchAnswering(() => htmlResponse(SUCCESS_PAGE, 503)));

      expect(result).toMatchObject({ ok: false, reason: "rejected", status: 503 });
    });

    it("reports not-activated when the page asks for the form to be activated", async () => {
      const page = formSubmitPage("Activate your form", "This form needs Activation. We've sent you an email.");

      const result = await sendWithDrawings(fetchAnswering(() => htmlResponse(page)));

      expect(result).toMatchObject({ ok: false, reason: "not-activated", status: 200 });
    });

    it("reports too-large when FormSubmit answers 413", async () => {
      const result = await sendWithDrawings(fetchAnswering(() => htmlResponse("<html>413 Request Entity Too Large</html>", 413)));

      expect(result).toEqual({ ok: false, reason: "too-large", error: sendFailureMessage("too-large"), status: 413 });
    });

    it("never treats a page reached through a redirect as sent", async () => {
      const result = await sendWithDrawings(fetchAnswering(() => redirectedHtmlResponse(SUCCESS_PAGE)));

      expect(result).toMatchObject({ ok: false, reason: "invalid-response" });
    });

    it("never treats a JSON answer as sent: the page is what proves delivery here", async () => {
      const result = await sendWithDrawings(fetchAnswering(() => jsonResponse({ success: "true" })));

      expect(result).toMatchObject({ ok: false, reason: "invalid-response" });
    });

    it("reports network when the request cannot be made", async () => {
      const result = await sendWithDrawings(fetchFailing());

      expect(result).toEqual({ ok: false, reason: "network", error: sendFailureMessage("network") });
    });

    it("reports timeout, not invalid-response, when the time runs out while the page is arriving", async () => {
      // Arrange
      vi.useFakeTimers();
      const pending = sendWithDrawings(fetchWithStalledBody(200, "text"), 1000);

      // Act
      await vi.advanceTimersByTimeAsync(1000);

      // Assert
      await expect(pending).resolves.toMatchObject({ ok: false, reason: "timeout" });
    });

    it("clears its timer once the page has arrived", async () => {
      vi.useFakeTimers();

      const result = await sendWithDrawings(fetchDeliveringPage());

      expect(result.ok).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("points to the contact email for every failure", async () => {
      const failures = [
        fetchFailing(),
        fetchAnswering(() => htmlResponse("<html>oops</html>", 500)),
        fetchAnswering(() => htmlResponse(formSubmitPage("Nope", "No."))),
        fetchAnswering(() => htmlResponse("")),
      ];

      const results = await Promise.all(failures.map((fetchImpl) => sendWithDrawings(fetchImpl)));

      for (const result of results) {
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error).toContain(site.contact.email);
      }
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
        expect(!result.ok && result.error).toContain(site.contact.email);
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
