import { describe, expect, it } from "vitest";
import { readQuoteRequest } from "./readQuoteRequest";

const ALL_FIELDS = [
  "name",
  "company",
  "email",
  "phone",
  "role",
  "projectType",
  "location",
  "timeline",
  "message",
  "drawingsLink",
] as const;

function formDataOf(entries: Record<string, string | File>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.append(key, value);
  return formData;
}

describe("readQuoteRequest", () => {
  it("reads every Quote Request field as the visitor typed it", () => {
    // Arrange
    const formData = formDataOf({
      name: "  Ada Lovelace ",
      company: "Lovelace Interiors",
      email: "ada@example.com",
      phone: "+971 50 000 0000",
      role: "Main contractor",
      projectType: "Office",
      location: "Dubai, UAE",
      timeline: "Tendering now",
      message: "Reception desk.",
      drawingsLink: "https://example.com/plans",
    });

    // Act
    const request = readQuoteRequest(formData);

    // Assert
    expect(request).toEqual({
      name: "  Ada Lovelace ",
      company: "Lovelace Interiors",
      email: "ada@example.com",
      phone: "+971 50 000 0000",
      role: "Main contractor",
      projectType: "Office",
      location: "Dubai, UAE",
      timeline: "Tendering now",
      message: "Reception desk.",
      drawingsLink: "https://example.com/plans",
    });
  });

  it("returns an empty string for every field the form did not send", () => {
    // Arrange / Act
    const request = readQuoteRequest(new FormData());

    // Assert
    expect(Object.keys(request).sort()).toEqual([...ALL_FIELDS].sort());
    expect(Object.values(request).every((value) => value === "")).toBe(true);
  });

  it("ignores the honeypot and any other field that is not part of a Quote Request", () => {
    // Arrange
    const formData = formDataOf({ name: "Ada", _honey: "bot", isAdmin: "true" });

    // Act
    const request = readQuoteRequest(formData);

    // Assert
    expect(request).not.toHaveProperty("_honey");
    expect(request).not.toHaveProperty("isAdmin");
  });

  it("does not turn a file into text", () => {
    // Arrange
    const formData = formDataOf({ name: new File(["x"], "plan.pdf") });

    // Act
    const request = readQuoteRequest(formData);

    // Assert
    expect(request.name).toBe("");
  });
});
