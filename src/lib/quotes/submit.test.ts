import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ENDPOINT,
  FORM_ID,
  FORM_ID_ENV_NAME,
  fetchDelivering,
  jsonResponse,
  sentRequest,
} from "./fetchFixtures";
import { makeNotPdf, makePdf, makeRequest } from "./fixtures";
import { sendFailureMessage } from "./messages";
import { submitQuoteRequest } from "./submit";

describe("submitQuoteRequest", () => {
  beforeEach(() => {
    vi.stubEnv(FORM_ID_ENV_NAME, "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("checks before anything is sent", () => {
    it("rejects an invalid request with the first problem and its field, without calling the network", async () => {
      // Arrange
      const fetchImpl = fetchDelivering();
      const request = makeRequest({ name: "   " });

      // Act
      const result = await submitQuoteRequest(request, [], { formId: FORM_ID, fetchImpl });

      // Assert
      expect(result).toEqual({ ok: false, reason: "invalid", error: "Please enter your full name.", field: "name" });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
      ["email", { email: "ada@localhost" }, "Please enter a valid email address."],
      ["role", { role: "Plumber" }, "Please choose your role."],
      ["drawingsLink", { drawingsLink: "http://example.com/plans" }, "Please enter a link that starts with https://."],
    ] as const)("names the %s field when that is the problem", async (field, overrides, error) => {
      const result = await submitQuoteRequest({ ...makeRequest(), ...overrides }, [], { formId: FORM_ID });

      expect(result).toEqual({ ok: false, reason: "invalid", error, field });
    });

    it("rejects input that is not even an object, without naming a field", async () => {
      const fetchImpl = fetchDelivering();

      const result = await submitQuoteRequest(null, [], { formId: FORM_ID, fetchImpl });

      expect(result).toMatchObject({ ok: false, reason: "invalid" });
      expect(result).not.toHaveProperty("field");
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("rejects Drawings that break the limits, naming the Drawings as the field, without calling the network", async () => {
      // Arrange
      const fetchImpl = fetchDelivering();
      const files = [makePdf("notes.txt", 1024, "text/plain")];

      // Act
      const result = await submitQuoteRequest(makeRequest(), files, { formId: FORM_ID, fetchImpl });

      // Assert
      expect(result).toEqual({
        ok: false,
        reason: "invalid",
        error: "notes.txt is not a PDF. Drawings must be PDF files.",
        field: "drawings",
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("reports a problem with the request before a problem with the Drawings", async () => {
      const files = [makePdf("notes.txt", 1024, "text/plain")];

      const result = await submitQuoteRequest(makeRequest({ location: "" }), files, { formId: FORM_ID });

      expect(result).toEqual({ ok: false, reason: "invalid", error: "Please enter the site location.", field: "location" });
    });

    it("reports invalid details before saying the form is not configured", async () => {
      const result = await submitQuoteRequest(makeRequest({ email: "nope" }), [], { formId: "" });

      expect(result).toMatchObject({ ok: false, reason: "invalid" });
    });

    it("reports a Drawings problem before saying the form is not configured", async () => {
      const files = [makePdf("blank.pdf", 0)];

      const result = await submitQuoteRequest(makeRequest(), files, { formId: "" });

      expect(result).toMatchObject({ ok: false, reason: "invalid", error: "blank.pdf is empty. Please attach a valid PDF." });
    });

    it("leaves the PDF header to the check made when files are added, so it does not read files again here", async () => {
      const fetchImpl = fetchDelivering();

      const result = await submitQuoteRequest(makeRequest(), [makeNotPdf("renamed.pdf")], { formId: FORM_ID, fetchImpl });

      expect(result.ok).toBe(true);
    });
  });

  describe("when the form is not configured", () => {
    it.each([
      ["missing", undefined],
      ["empty", ""],
      ["only spaces", "   "],
    ])("reports not-configured, and never a fake success, when the id is %s", async (_label, formId) => {
      // Arrange
      const fetchImpl = fetchDelivering();

      // Act
      const result = await submitQuoteRequest(makeRequest(), [], { formId, fetchImpl });

      // Assert
      expect(result).toEqual({ ok: false, reason: "not-configured", error: sendFailureMessage("not-configured") });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
      ["empty", ""],
      ["not set at all", undefined],
    ])("reports not-configured when the environment variable is %s", async (_label, value) => {
      vi.stubEnv(FORM_ID_ENV_NAME, value);
      const fetchImpl = fetchDelivering();

      const result = await submitQuoteRequest(makeRequest(), [], { fetchImpl });

      expect(result).toMatchObject({ ok: false, reason: "not-configured" });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
      ["a path", "abc/def"],
      ["a path that climbs up", "../admin"],
      ["only a dot", "."],
      ["only two dots", ".."],
      ["only dots", "..."],
      ["two dots with spaces around them", " .. "],
      ["a query string", "abc?redirect=1"],
      ["a fragment", "abc#x"],
      ["a space", "abc def"],
      ["a percent escape", "abc%2Fdef"],
      ["a full web address", "https://evil.example/collect"],
    ])("refuses to build an address from an id containing %s", async (_label, formId) => {
      const fetchImpl = fetchDelivering();

      const result = await submitQuoteRequest(makeRequest(), [], { formId, fetchImpl });

      expect(result).toMatchObject({ ok: false, reason: "not-configured" });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
      ["a random-string alias", FORM_ID],
      ["a mailbox address", "projects@numaliving.com"],
      ["a mailbox address with a plus tag", "first.last+quotes@example.co.uk"],
      ["an alias with dots in it", "a.b.c"],
    ])("accepts %s as the id", async (_label, formId) => {
      const fetchImpl = fetchDelivering();

      const result = await submitQuoteRequest(makeRequest(), [], { formId, fetchImpl });

      expect(result.ok).toBe(true);
      expect(sentRequest(fetchImpl).url).toBe(`https://formsubmit.co/ajax/${formId}`);
    });

    it("reads the id from NEXT_PUBLIC_FORMSUBMIT_ID by default, ignoring surrounding spaces", async () => {
      // Arrange
      vi.stubEnv(FORM_ID_ENV_NAME, "  env-alias-123 \n");
      const fetchImpl = fetchDelivering();

      // Act
      await submitQuoteRequest(makeRequest(), [], { fetchImpl });

      // Assert
      expect(sentRequest(fetchImpl).url).toBe("https://formsubmit.co/ajax/env-alias-123");
    });

    it("prefers the formId option over the environment variable", async () => {
      vi.stubEnv(FORM_ID_ENV_NAME, "env-alias-123");
      const fetchImpl = fetchDelivering();

      await submitQuoteRequest(makeRequest(), [], { formId: FORM_ID, fetchImpl });

      expect(sentRequest(fetchImpl).url).toBe(ENDPOINT);
    });
  });

  describe("the request it sends", () => {
    it("posts to the FormSubmit AJAX endpoint and asks for JSON back", async () => {
      // Arrange
      const fetchImpl = fetchDelivering();

      // Act
      await submitQuoteRequest(makeRequest(), [], { formId: FORM_ID, fetchImpl });

      // Assert
      const { url, init } = sentRequest(fetchImpl);
      expect(url).toBe(ENDPOINT);
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({ Accept: "application/json" });
    });

    it("leaves the Content-Type to the browser so the multipart boundary is set correctly", async () => {
      const fetchImpl = fetchDelivering();

      await submitQuoteRequest(makeRequest(), [], { formId: FORM_ID, fetchImpl });

      const headerNames = Object.keys(sentRequest(fetchImpl).init.headers ?? {}).map((name) => name.toLowerCase());
      expect(headerNames).not.toContain("content-type");
    });

    it("passes an abort signal so a stuck request can be cancelled", async () => {
      const fetchImpl = fetchDelivering();

      await submitQuoteRequest(makeRequest(), [], { formId: FORM_ID, fetchImpl });

      expect(sentRequest(fetchImpl).init.signal).toBeInstanceOf(AbortSignal);
    });

    it("sends the validated details, trimmed, in a table with the reference it returns", async () => {
      // Arrange
      const fetchImpl = fetchDelivering();
      const request = makeRequest({ name: "  Ada Lovelace  ", company: "  " });

      // Act
      const result = await submitQuoteRequest(request, [], { formId: FORM_ID, fetchImpl });

      // Assert: a failed send must fail here, before the reference is compared
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const { body } = sentRequest(fetchImpl);
      expect(body.get("Full name")).toBe("Ada Lovelace");
      expect(body.has("Company")).toBe(false);
      expect(body.get("_template")).toBe("table");
      expect(body.get("_replyto")).toBe("ada@example.com");
      expect(body.get("Reference")).toBe(result.reference);
    });

    it("attaches each PDF as its own field and says how many to expect", async () => {
      // Arrange
      const fetchImpl = fetchDelivering();
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

    it("uses the global fetch when none is supplied", async () => {
      // Arrange
      const globalFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => jsonResponse({ success: true }));

      // Act
      const result = await submitQuoteRequest(makeRequest(), [], { formId: FORM_ID });

      // Assert
      expect(result.ok).toBe(true);
      expect(globalFetch).toHaveBeenCalledOnce();
      expect(globalFetch.mock.calls[0][0]).toBe(ENDPOINT);
    });

    it("does not modify the request or the files it was given", async () => {
      const request = Object.freeze(makeRequest({ name: "  Ada  " }));
      const files = Object.freeze([makePdf("plan.pdf")]);

      const result = await submitQuoteRequest(request, files, { formId: FORM_ID, fetchImpl: fetchDelivering() });

      expect(result.ok).toBe(true);
      expect(request.name).toBe("  Ada  ");
    });
  });
});
