/**
 * Structured data (JSON-LD, schema.org) for search engines and answer engines. Each builder returns
 * plain data; `serializeJsonLd` turns it into the text of a `<script type="application/ld+json">`
 * (see src/components/JsonLd.tsx). Only `organizationJsonLd`, `webSiteJsonLd` and `breadcrumbJsonLd`
 * are used by the site today; the others are ready for the service, guide and FAQ pages.
 *
 * Nothing here is invented: a field that has no real value yet (legal name, founding year,
 * profiles) is left out, and the phone number and address are published only once the site is
 * indexable, which the launch guard (src/config/launchGuard.test.ts) allows only with real ones.
 */
import { isIndexable as siteIsIndexable, site } from "@/config/site";
import { absoluteUrl, canonicalUrl, type UrlOptions } from "@/lib/seo/canonical";

/** One JSON-LD entity: plain data that serializes to JSON. */
export type JsonLdNode = Readonly<Record<string, unknown>>;

/** The facts about the company the structured data is made from; `site` in src/config/site.ts has them all. */
export type JsonLdSite = Readonly<{
  name: string;
  description: string;
  locale: string;
  legalName: string | null;
  foundingYear: number | null;
  social: readonly string[];
  contact: Readonly<{ email: string; phone: string; address: string }>;
}>;

export type BreadcrumbItem = Readonly<{ name: string; path: string }>;

export type ServiceInput = Readonly<{
  name: string;
  description: string;
  /** The service page's path, such as "/architectural-millwork". */
  path: string;
  serviceType?: string;
  /** Where the service is offered; the United States unless told otherwise. */
  areaServed?: string;
}>;

export type ArticleInput = Readonly<{
  headline: string;
  description: string;
  /** The article's path, such as "/resources/how-much-does-custom-millwork-cost". */
  path: string;
  /** YYYY-MM-DD. */
  datePublished: string;
  /** YYYY-MM-DD; the publishing date when left out. */
  dateModified?: string;
  /** A named person; the company itself when left out. */
  authorName?: string;
  /** The article's image, as a root-relative path such as "/og/guide.jpg". */
  imagePath?: string;
}>;

export type FaqItem = Readonly<{ question: string; answer: string }>;

type SiteOptions = Readonly<{
  /** The company's facts; defaults to `site`. */
  site?: JsonLdSite;
  /** The address and base path to write URLs with; the site's own by default. */
  urls?: UrlOptions;
}>;

export type OrganizationOptions = SiteOptions &
  Readonly<{
    /** Whether the site may be indexed; defaults to `isIndexable` in src/config/site.ts. Phone and address are published only when it is. */
    isIndexable?: boolean;
  }>;

const SCHEMA_CONTEXT = "https://schema.org";

/** Where the company serves customers, as schema.org writes a country: the United States. */
const DEFAULT_AREA_SERVED = "US";

/** The logo, a PNG at the site's root: a copy of src/app/icon.png (public/logo.png). Structured data needs a file address. */
export const LOGO_PATH = "/logo.png";

function organizationReference(urls: UrlOptions | undefined): JsonLdNode {
  return { "@id": absoluteUrl("/#organization", urls) };
}

/** The company: who it is, how to reach it and where it serves customers. */
export function organizationJsonLd(options: OrganizationOptions = {}): JsonLdNode {
  const { site: source = site, isIndexable = siteIsIndexable, urls } = options;
  const { email, phone, address } = source.contact;
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    "@id": absoluteUrl("/#organization", urls),
    name: source.name,
    url: absoluteUrl("/", urls),
    logo: absoluteUrl(LOGO_PATH, urls),
    description: source.description,
    areaServed: DEFAULT_AREA_SERVED,
    contactPoint: [{ "@type": "ContactPoint", contactType: "sales", email, ...(isIndexable ? { telephone: phone } : {}) }],
    ...(source.legalName === null ? {} : { legalName: source.legalName }),
    ...(source.foundingYear === null ? {} : { foundingDate: String(source.foundingYear) }),
    ...(source.social.length === 0 ? {} : { sameAs: [...source.social] }),
    // The address is one line of text today, so it is published as the street address.
    ...(isIndexable ? { telephone: phone, address: { "@type": "PostalAddress", streetAddress: address } } : {}),
  };
}

/** The website as a whole. It has no search box, so no search action is offered. */
export function webSiteJsonLd(options: SiteOptions = {}): JsonLdNode {
  const { site: source = site, urls } = options;
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    "@id": absoluteUrl("/#website", urls),
    url: absoluteUrl("/", urls),
    name: source.name,
    description: source.description,
    inLanguage: source.locale,
    publisher: organizationReference(urls),
  };
}

/** The trail from the home page to this page, one step per item, in order. */
export function breadcrumbJsonLd(items: readonly BreadcrumbItem[], urls?: UrlOptions): JsonLdNode & { itemListElement: readonly JsonLdNode[] } {
  if (items.length === 0) throw new Error("A breadcrumb trail needs at least one step.");
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: canonicalUrl(item.path, urls),
    })),
  };
}

/** A service the company provides, with its page. */
export function serviceJsonLd(service: ServiceInput, urls?: UrlOptions): JsonLdNode {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Service",
    name: service.name,
    description: service.description,
    url: canonicalUrl(service.path, urls),
    ...(service.serviceType === undefined ? {} : { serviceType: service.serviceType }),
    areaServed: service.areaServed ?? DEFAULT_AREA_SERVED,
    provider: organizationReference(urls),
  };
}

/** An article or guide, published by the company. */
export function articleJsonLd(article: ArticleInput, urls?: UrlOptions): JsonLdNode {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Article",
    headline: article.headline,
    description: article.description,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl(article.path, urls) },
    ...(article.imagePath === undefined ? {} : { image: [absoluteUrl(article.imagePath, urls)] }),
    datePublished: article.datePublished,
    dateModified: article.dateModified ?? article.datePublished,
    author: article.authorName === undefined ? organizationReference(urls) : { "@type": "Person", name: article.authorName },
    publisher: organizationReference(urls),
  };
}

/** Questions and their answers, for a page that shows them as text. */
export function faqPageJsonLd(items: readonly FaqItem[]): JsonLdNode {
  if (items.length === 0) throw new Error("An FAQ page needs at least one question.");
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

const LESS_THAN = /</g;
const LINE_SEPARATOR = /\u2028/g;
const PARAGRAPH_SEPARATOR = /\u2029/g;

/**
 * The text of a `<script type="application/ld+json">`. `JSON.stringify` alone is not safe there:
 * a `<` in any value (such as "</script>") would end the script early, and the line and paragraph
 * separators are line ends to some scripts and parsers. Each is written as a \u escape, which JSON
 * reads back as the same character (the way the Next.js JSON-LD guide advises).
 */
export function serializeJsonLd(data: JsonLdNode | readonly JsonLdNode[]): string {
  return JSON.stringify(data)
    .replace(LESS_THAN, "\\u003c")
    .replace(LINE_SEPARATOR, "\\u2028")
    .replace(PARAGRAPH_SEPARATOR, "\\u2029");
}
