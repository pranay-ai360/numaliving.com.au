import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  organizationJsonLd,
  serializeJsonLd,
  serviceJsonLd,
  webSiteJsonLd,
  type JsonLdSite,
} from "@/lib/seo/jsonld";

const PLACEHOLDER_PHONE = "+971 4 000 0000";
const PLACEHOLDER_ADDRESS = "Factory address, Dubai, UAE";

/** A site whose details are real, as the launch guard requires before the site may be indexed. */
const REAL_SITE: JsonLdSite = {
  name: "Numa Living",
  description: "Numa Living builds custom millwork in its Dubai factory.",
  locale: "en-US",
  legalName: null,
  foundingYear: null,
  social: [],
  contact: { email: "hello@example.com", phone: "+1 512 555 0100", address: "100 Example Street, Austin, TX 78701, USA" },
};

const BASE_PATH_URLS = { basePath: "/numaliving.com.au" };

describe("organizationJsonLd", () => {
  it("describes the company with its name, address on the web, logo, description and contact email", () => {
    // Arrange
    const options = { site: REAL_SITE, isIndexable: false };

    // Act
    const organization = organizationJsonLd(options);

    // Assert
    expect(organization).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": "https://numaliving.us/#organization",
      name: "Numa Living",
      url: "https://numaliving.us/",
      logo: "https://numaliving.us/logo.png",
      description: "Numa Living builds custom millwork in its Dubai factory.",
      areaServed: "US",
      contactPoint: [{ "@type": "ContactPoint", contactType: "sales", email: "hello@example.com" }],
    });
  });

  it("leaves out the profiles, legal name and founding date while they are not known", () => {
    // Arrange
    const options = { site: REAL_SITE, isIndexable: false };

    // Act
    const organization = organizationJsonLd(options);

    // Assert
    expect(organization).not.toHaveProperty("sameAs");
    expect(organization).not.toHaveProperty("legalName");
    expect(organization).not.toHaveProperty("foundingDate");
  });

  it("lists the profiles, the legal name and the founding year once they are set", () => {
    // Arrange
    const known: JsonLdSite = {
      ...REAL_SITE,
      legalName: "Numa Living FZ-LLC",
      foundingYear: 2015,
      social: ["https://www.linkedin.com/company/example", "https://www.instagram.com/example"],
    };

    // Act
    const organization = organizationJsonLd({ site: known, isIndexable: false });

    // Assert
    expect(organization).toMatchObject({
      legalName: "Numa Living FZ-LLC",
      foundingDate: "2015",
      sameAs: ["https://www.linkedin.com/company/example", "https://www.instagram.com/example"],
    });
  });

  it("publishes no phone number or address while the site is not indexable, because the real ones are not in place", () => {
    // Arrange
    const options = { site, isIndexable: false };

    // Act
    const json = serializeJsonLd(organizationJsonLd(options));

    // Assert
    expect(json).not.toContain(PLACEHOLDER_PHONE);
    expect(json).not.toContain(PLACEHOLDER_ADDRESS);
    expect(json).not.toContain('"telephone"');
    expect(json).not.toContain('"address"');
  });

  it("publishes the phone number and address once the site is indexable, when the launch guard has made them real", () => {
    // Arrange
    const options = { site: REAL_SITE, isIndexable: true };

    // Act
    const organization = organizationJsonLd(options);

    // Assert
    expect(organization).toMatchObject({
      telephone: "+1 512 555 0100",
      address: { "@type": "PostalAddress", streetAddress: "100 Example Street, Austin, TX 78701, USA" },
      contactPoint: [{ "@type": "ContactPoint", contactType: "sales", email: "hello@example.com", telephone: "+1 512 555 0100" }],
    });
  });

  it("writes every address below the base path when the site is served from a sub-path", () => {
    // Arrange
    const options = { site: REAL_SITE, isIndexable: false, urls: BASE_PATH_URLS };

    // Act
    const organization = organizationJsonLd(options);

    // Assert
    expect(organization).toMatchObject({
      "@id": "https://numaliving.us/numaliving.com.au/#organization",
      url: "https://numaliving.us/numaliving.com.au/",
      logo: "https://numaliving.us/numaliving.com.au/logo.png",
    });
  });

  it("returns a new object on every call", () => {
    // Arrange
    const options = { site: REAL_SITE, isIndexable: false };
    const first = organizationJsonLd(options);

    // Act
    const second = organizationJsonLd(options);

    // Assert
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });
});

describe("webSiteJsonLd", () => {
  it("describes the site, its language and its publisher, and offers no search box because there is none", () => {
    // Arrange
    const options = { site: REAL_SITE };

    // Act
    const webSite = webSiteJsonLd(options);

    // Assert
    expect(webSite).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": "https://numaliving.us/#website",
      url: "https://numaliving.us/",
      name: "Numa Living",
      description: "Numa Living builds custom millwork in its Dubai factory.",
      inLanguage: "en-US",
      publisher: { "@id": "https://numaliving.us/#organization" },
    });
  });

  it("points at the organization below the base path as well", () => {
    // Arrange
    const options = { site: REAL_SITE, urls: BASE_PATH_URLS };

    // Act
    const webSite = webSiteJsonLd(options);

    // Assert
    expect(webSite).toMatchObject({
      url: "https://numaliving.us/numaliving.com.au/",
      publisher: { "@id": "https://numaliving.us/numaliving.com.au/#organization" },
    });
  });
});

describe("breadcrumbJsonLd", () => {
  it("lists each step in order, counting from 1, with the canonical address of its page", () => {
    // Arrange
    const items = [
      { name: "Home", path: "/" },
      { name: "Projects", path: "/projects" },
      { name: "Waterfront Residences", path: "/projects/penthouse25" },
    ];

    // Act
    const breadcrumbs = breadcrumbJsonLd(items);

    // Assert
    expect(breadcrumbs).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://numaliving.us/" },
        { "@type": "ListItem", position: 2, name: "Projects", item: "https://numaliving.us/projects/" },
        { "@type": "ListItem", position: 3, name: "Waterfront Residences", item: "https://numaliving.us/projects/penthouse25/" },
      ],
    });
  });

  it("writes the addresses below the base path when the site is served from a sub-path", () => {
    // Arrange
    const items = [{ name: "Home", path: "/" }];

    // Act
    const breadcrumbs = breadcrumbJsonLd(items, BASE_PATH_URLS);

    // Assert
    expect(breadcrumbs.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://numaliving.us/numaliving.com.au/" },
    ]);
  });

  it("refuses an empty trail, which search engines would reject", () => {
    // Arrange
    const items: readonly { name: string; path: string }[] = [];

    // Act
    const act = (): unknown => breadcrumbJsonLd(items);

    // Assert
    expect(act).toThrow("at least one step");
  });
});

describe("serviceJsonLd", () => {
  it("describes a service the company provides, to the United States unless told otherwise", () => {
    // Arrange
    const service = { name: "Custom millwork", description: "Wall paneling, casework and doors.", path: "/capabilities", serviceType: "Architectural millwork" };

    // Act
    const json = serviceJsonLd(service);

    // Assert
    expect(json).toEqual({
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Custom millwork",
      description: "Wall paneling, casework and doors.",
      url: "https://numaliving.us/capabilities/",
      serviceType: "Architectural millwork",
      areaServed: "US",
      provider: { "@id": "https://numaliving.us/#organization" },
    });
  });

  it("leaves out the service type when none is given and takes another area when given one", () => {
    // Arrange
    const service = { name: "Custom millwork", description: "Wall paneling.", path: "/capabilities", areaServed: "CA" };

    // Act
    const json = serviceJsonLd(service);

    // Assert
    expect(json).not.toHaveProperty("serviceType");
    expect(json).toMatchObject({ areaServed: "CA" });
  });
});

describe("articleJsonLd", () => {
  const ARTICLE = {
    headline: "How much does custom millwork cost?",
    description: "What drives the price.",
    path: "/resources/how-much-does-custom-millwork-cost",
    datePublished: "2026-11-01",
  };

  it("describes an article, published by the company, as modified the day it was published unless told otherwise", () => {
    // Arrange
    const article = ARTICLE;

    // Act
    const json = articleJsonLd(article);

    // Assert
    expect(json).toEqual({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "How much does custom millwork cost?",
      description: "What drives the price.",
      mainEntityOfPage: { "@type": "WebPage", "@id": "https://numaliving.us/resources/how-much-does-custom-millwork-cost/" },
      datePublished: "2026-11-01",
      dateModified: "2026-11-01",
      author: { "@id": "https://numaliving.us/#organization" },
      publisher: { "@id": "https://numaliving.us/#organization" },
    });
  });

  it("names a person as the author, and lists the image, when they are given", () => {
    // Arrange
    const article = { ...ARTICLE, dateModified: "2026-12-05", authorName: "A. Example", imagePath: "/og/guide.jpg" };

    // Act
    const json = articleJsonLd(article);

    // Assert
    expect(json).toMatchObject({
      dateModified: "2026-12-05",
      author: { "@type": "Person", name: "A. Example" },
      image: ["https://numaliving.us/og/guide.jpg"],
    });
  });
});

describe("faqPageJsonLd", () => {
  it("lists each question with its accepted answer", () => {
    // Arrange
    const items = [
      { question: "What is AWI?", answer: "The Architectural Woodwork Institute." },
      { question: "Do you ship to the US?", answer: "Yes." },
    ];

    // Act
    const json = faqPageJsonLd(items);

    // Assert
    expect(json).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "What is AWI?", acceptedAnswer: { "@type": "Answer", text: "The Architectural Woodwork Institute." } },
        { "@type": "Question", name: "Do you ship to the US?", acceptedAnswer: { "@type": "Answer", text: "Yes." } },
      ],
    });
  });

  it("refuses a list without questions, which is not a valid FAQ page", () => {
    // Arrange
    const items: readonly { question: string; answer: string }[] = [];

    // Act
    const act = (): unknown => faqPageJsonLd(items);

    // Assert
    expect(act).toThrow("at least one question");
  });
});

describe("serializeJsonLd", () => {
  it("writes plain JSON that reads back as the same data", () => {
    // Arrange
    const data = { "@context": "https://schema.org", "@type": "Thing", name: "Numa Living", list: [1, "two", { three: 3 }] };

    // Act
    const json = serializeJsonLd(data);

    // Assert
    expect(JSON.parse(json)).toEqual(data);
  });

  it("escapes every < as \\u003c, so text can never close the script tag it is placed in", () => {
    // Arrange
    const data = { name: "</script><script>alert(1)</script><!-- x" };

    // Act
    const json = serializeJsonLd(data);

    // Assert
    expect(json).not.toContain("<");
    expect(json).toContain("\\u003c/script>");
    expect(JSON.parse(json)).toEqual(data);
  });

  it("escapes the line and paragraph separators, which some scripts and parsers treat as line ends", () => {
    // Arrange
    const data = { text: "one\u2028two\u2029three" };

    // Act
    const json = serializeJsonLd(data);

    // Assert
    expect(json).not.toContain("\u2028");
    expect(json).not.toContain("\u2029");
    expect(json).toContain("\\u2028");
    expect(json).toContain("\\u2029");
    expect(JSON.parse(json)).toEqual(data);
  });

  it("accepts a list of entities as well as one", () => {
    // Arrange
    const data = [{ "@type": "Thing" }, { "@type": "Place" }];

    // Act
    const json = serializeJsonLd(data);

    // Assert
    expect(JSON.parse(json)).toEqual(data);
  });
});
