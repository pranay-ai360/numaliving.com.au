import { describe, expect, it } from "vitest";
import {
  isQuoteRequestField,
  PROJECT_TYPE_OPTIONS,
  QUOTE_REQUEST_FIELDS,
  ROLE_OPTIONS,
  TEXT_LIMITS,
  TIMELINE_OPTIONS,
} from "./fields";

describe("option lists", () => {
  it("offers the four roles in display order", () => {
    // Arrange / Act / Assert
    expect(ROLE_OPTIONS).toEqual(["Owner / developer", "Architect / designer", "Main contractor", "Other"]);
  });

  it("offers the five project types in display order", () => {
    expect(PROJECT_TYPE_OPTIONS).toEqual(["Residences", "Office", "Multifamily", "Hospitality", "Other"]);
  });

  it("offers the four timelines in display order", () => {
    expect(TIMELINE_OPTIONS).toEqual([
      "Tendering now",
      "Start within 3 months",
      "Start in 3 to 6 months",
      "Later / exploring",
    ]);
  });
});

describe("QUOTE_REQUEST_FIELDS", () => {
  it("lists every Quote Request field in the order the form shows them", () => {
    expect(QUOTE_REQUEST_FIELDS).toEqual([
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
    ]);
  });
});

describe("TEXT_LIMITS", () => {
  it("caps the length of every free-text field", () => {
    expect(TEXT_LIMITS).toEqual({
      name: 120,
      company: 120,
      email: 254,
      phone: 40,
      location: 160,
      message: 5000,
      drawingsLink: 500,
    });
  });
});

describe("isQuoteRequestField", () => {
  it.each(QUOTE_REQUEST_FIELDS)("recognises %s", (field) => {
    expect(isQuoteRequestField(field)).toBe(true);
  });

  it.each([
    ["an unknown name", "isAdmin"],
    ["the honeypot", "_honey"],
    ["the attached Drawings", "drawings"],
    ["a number", 0],
    ["a symbol", Symbol("name")],
    ["undefined", undefined],
  ])("does not recognise %s", (_label, value) => {
    expect(isQuoteRequestField(value)).toBe(false);
  });
});
