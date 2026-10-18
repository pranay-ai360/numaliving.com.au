/**
 * The Contact page and the Organization structured data are made from the same contact details by the
 * same rule (src/lib/realContact.ts), so markup that search engines read never says more than a visitor
 * can read. These tests render the page and build the data for one fixture site at a time.
 */
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JsonLdNode } from "@/lib/seo/jsonld";
import type { ContactInfo } from "@/lib/realContact";

const REAL: ContactInfo = {
  email: "projects@numaliving.us",
  phone: "+1 512 555 0147",
  whatsapp: "15125550147",
  address: { street: "100 Example Street", locality: "Austin", region: "TX", postalCode: "78701", country: "United States" },
  hours: null,
  timezone: null,
};

const STUBS: ContactInfo = {
  ...REAL,
  phone: "+971 4 000 0000",
  whatsapp: "971400000000",
  address: { street: "Factory address", locality: "Dubai", country: "UAE" },
};

const NUDGED_STUBS: ContactInfo = {
  ...REAL,
  phone: "+971 4 000 0001",
  whatsapp: "971400000001",
  address: { street: "Factory address.", locality: "Dubai", country: "UAE" },
};

/** The Contact page's text and the Organization data for a site that has these contact details. */
async function pageAndData(contact: ContactInfo): Promise<{ text: string; organization: JsonLdNode }> {
  vi.resetModules();
  vi.doMock("@/config/site", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/config/site")>();
    return { ...original, site: { ...original.site, contact } };
  });
  const { default: ContactPage } = await import("@/app/contact/page");
  const { organizationJsonLd } = await import("@/lib/seo/jsonld");
  const { container } = render(<ContactPage />);
  return { text: container.textContent ?? "", organization: organizationJsonLd() };
}

/** Every piece of contact information in the Organization data, as the text a visitor would have to find on the page. */
function contactValuesIn(organization: JsonLdNode): readonly string[] {
  const address = (organization.address ?? {}) as Readonly<Record<string, string>>;
  const [contactPoint] = (organization.contactPoint ?? []) as readonly Readonly<Record<string, string>>[];
  const addressParts = Object.entries(address).filter(([key]) => key !== "@type").map(([, value]) => value);
  return [contactPoint?.email, contactPoint?.telephone, organization.telephone as string | undefined, ...addressParts].filter((value): value is string => value !== undefined);
}

describe("the Contact page and the Organization data", () => {
  afterEach(() => {
    vi.doUnmock("@/config/site");
    vi.resetModules();
  });

  it("publish the same contact details: every phone number, address part and email in the data is also on the page", async () => {
    // Arrange
    const { text, organization } = await pageAndData(REAL);

    // Act
    const values = contactValuesIn(organization);
    const missingFromPage = values.filter((value) => !text.includes(value));

    // Assert
    expect(values).toEqual(expect.arrayContaining(["projects@numaliving.us", "+1 512 555 0147", "100 Example Street", "Austin", "TX", "78701", "United States"]));
    expect(missingFromPage).toEqual([]);
  });

  it("publish none of the placeholders: the page does not show them and the data does not carry them", async () => {
    // Arrange
    const { text, organization } = await pageAndData(STUBS);

    // Act
    const json = JSON.stringify(organization);

    // Assert
    expect(text).not.toMatch(/000 0000|971400000000|Factory address/);
    expect(json).not.toMatch(/000 0000|971400000000|Factory address/);
    expect(organization).not.toHaveProperty("telephone");
    expect(organization).not.toHaveProperty("address");
  });

  it("publish none of a placeholder that was only nudged, such as +971 4 000 0001", async () => {
    // Arrange
    const { text, organization } = await pageAndData(NUDGED_STUBS);

    // Act
    const json = JSON.stringify(organization);

    // Assert
    expect(text).not.toMatch(/000 0001|971400000001|Factory address/);
    expect(json).not.toMatch(/000 0001|971400000001|Factory address/);
  });
});
