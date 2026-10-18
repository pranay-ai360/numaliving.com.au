import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import { companyFacts } from "@/content/company";

describe("site contact details", () => {
  it("publishes projects@numaliving.us as the contact email", () => {
    // Arrange / Act
    const { email } = site.contact;

    // Assert
    expect(email).toBe("projects@numaliving.us");
  });
});

describe("site office hours", () => {
  it("has no office hours or time zone until the owner supplies them", () => {
    // Arrange / Act
    const { hours, timezone } = site.contact;

    // Assert
    expect(hours).toBeNull();
    expect(timezone).toBeNull();
  });
});

describe("site address and language", () => {
  it("serves the site at https://numaliving.us, written without a trailing slash", () => {
    // Arrange / Act
    const { url } = site;

    // Assert
    expect(url).toBe("https://numaliving.us");
    expect(new URL(url).origin).toBe(url);
  });

  it("is written for visitors in the United States", () => {
    // Arrange / Act
    const { locale } = site;

    // Assert
    expect(locale).toBe("en-US");
  });
});

describe("site identity facts that are not known yet", () => {
  it("leaves the legal name and the founding year empty until Numa confirms them", () => {
    // Arrange / Act
    const { legalName, foundingYear } = site;

    // Assert
    expect(legalName).toBeNull();
    expect(foundingYear).toBeNull();
  });

  it("takes both from the company facts, the one place the owner's confirmed facts are kept", () => {
    // Arrange
    const { legalName, foundingYear } = site;

    // Act
    const same = legalName === companyFacts.legalName && foundingYear === companyFacts.foundingYear;

    // Assert
    expect(same).toBe(true);
  });

  it("lists no social profiles until real ones exist", () => {
    // Arrange / Act
    const { social } = site;

    // Assert
    expect(social).toEqual([]);
  });

  it("holds no search-engine verification tokens until the owner supplies them", () => {
    // Arrange / Act
    const { verification } = site;

    // Assert
    expect(verification).toEqual({ google: null, bing: null });
  });
});
