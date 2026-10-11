import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import { fallbackEmailHref, followUpEmailHref } from "./emailLinks";

/** The decoded subject of a mailto: link, or null when it has none. */
function subjectOf(href: string): string | null {
  return new URL(href).searchParams.get("subject");
}

describe("fallbackEmailHref", () => {
  it("writes to the contact email", () => {
    // Arrange / Act
    const href = fallbackEmailHref("rejected");

    // Assert
    expect(href.startsWith(`mailto:${site.contact.email}?`)).toBe(true);
  });

  it.each(["network", "timeout", "too-large", "not-activated", "unexpected"] as const)(
    "puts the short reason code %s in the subject",
    (reason) => {
      expect(subjectOf(fallbackEmailHref(reason))).toBe(`Quote Request (website error: ${reason})`);
    },
  );

  it("encodes the subject so the link stays one valid address", () => {
    expect(fallbackEmailHref("rejected")).toBe(
      `mailto:${site.contact.email}?subject=Quote%20Request%20(website%20error%3A%20rejected)`,
    );
  });
});

describe("followUpEmailHref", () => {
  it("writes to the contact email quoting the reference in the subject", () => {
    // Arrange / Act
    const href = followUpEmailHref("NL-ABC234");

    // Assert
    expect(href.startsWith(`mailto:${site.contact.email}?`)).toBe(true);
    expect(subjectOf(href)).toBe("Quote Request NL-ABC234");
  });
});
