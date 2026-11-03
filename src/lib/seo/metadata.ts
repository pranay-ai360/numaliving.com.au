/**
 * The search and social metadata of a page, built from its entry in the page registry
 * (src/content/seo.ts): title, description, canonical link, Open Graph, X card and robots. Pure
 * functions, like src/lib/robots.ts; the pages and the layout call them (see src/app/pageMetadata.ts).
 */
import type { Metadata } from "next";
import { isIndexable as siteIsIndexable, site, type SearchVerification } from "@/config/site";
import { buildRobotsMetadata } from "@/lib/robots";
import { absoluteUrl, canonicalUrl } from "@/lib/seo/canonical";
import type { OgImage, PageSeo } from "@/lib/types";

/** The layout's title template: the brand follows every page title, so registry titles leave it out. */
export const TITLE_TEMPLATE = `%s | ${site.name}`;

/** The home page's path. Its title needs `absolute`, because the layout's template does not reach the page in the layout's own folder. */
const HOME_PATH = "/";

/** The size every share image has, the 1.91:1 shape both Open Graph and X's large card show in full. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * The share image for a page without its own: a crop of the first photo of the Signature Villa
 * project, made by scripts/optimize-images.mjs. Its description is that photo's (src/content/projects.ts).
 */
export const DEFAULT_OG_IMAGE: OgImage = {
  src: "/og/default.jpg",
  alt: "Open-plan living room with a curved cream sofa, a gray kitchen with island behind it and a glass-sided staircase",
};

/** Bing's ownership tag has no field of its own in Next.js, so it goes through `verification.other`. */
const BING_VERIFICATION_NAME = "msvalidate.01";

/** "en-US" in a `lang` attribute is "en_US" in Open Graph. */
function toOpenGraphLocale(locale: string): string {
  return locale.replace("-", "_");
}

function isSet(token: string | null): token is string {
  return token !== null && token.trim() !== "";
}

/** The title as a visitor sees it in the tab and in search results: the page title, then the brand. */
export function renderedTitle(seo: Pick<PageSeo, "title">): string {
  return TITLE_TEMPLATE.replace("%s", seo.title);
}

function openGraphImage(image: OgImage): NonNullable<NonNullable<Metadata["openGraph"]>["images"]> {
  return [{ url: absoluteUrl(image.src), ...OG_IMAGE_SIZE, alt: image.alt }];
}

export type PageMetadataOptions = Readonly<{
  /** Whether the site may be indexed; defaults to `isIndexable` in src/config/site.ts. */
  isIndexable?: boolean;
}>;

/**
 * Everything the page's `<head>` says about it. A page marked never indexable in the registry (none
 * is) always asks not to be indexed; any other page does so until the site itself is indexable.
 */
export function buildPageMetadata(seo: PageSeo, options: PageMetadataOptions = {}): Metadata {
  const { isIndexable = siteIsIndexable } = options;
  const url = canonicalUrl(seo.path);
  const image = seo.ogImage ?? DEFAULT_OG_IMAGE;
  return {
    title: seo.path === HOME_PATH ? { absolute: renderedTitle(seo) } : seo.title,
    description: seo.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: site.name,
      locale: toOpenGraphLocale(site.locale),
      title: seo.title,
      description: seo.description,
      images: openGraphImage(image),
    },
    twitter: {
      card: "summary_large_image",
      title: seo.title,
      description: seo.description,
      images: [{ url: absoluteUrl(image.src), alt: image.alt }],
    },
    robots: buildRobotsMetadata(seo.indexable && isIndexable),
  };
}

/** The ownership tags search engines ask for, only for the tokens that are set. */
export function buildVerificationMetadata({ google, bing }: SearchVerification): Metadata["verification"] {
  if (!isSet(google) && !isSet(bing)) return undefined;
  return {
    ...(isSet(google) ? { google } : {}),
    ...(isSet(bing) ? { other: { [BING_VERIFICATION_NAME]: bing } } : {}),
  };
}

export type SiteMetadataOptions = Readonly<{
  /** Whether the site may be indexed; defaults to `isIndexable` in src/config/site.ts. */
  isIndexable?: boolean;
  /** Search-engine ownership tokens; defaults to `site.verification`. */
  verification?: SearchVerification;
}>;

/**
 * The metadata of the root layout: what a page inherits when it sets nothing of its own (the title
 * template and default, the robots rule, a share card for the whole site, the verification tags).
 */
export function buildSiteMetadata(options: SiteMetadataOptions = {}): Metadata {
  const { isIndexable = siteIsIndexable, verification = site.verification } = options;
  const defaultTitle = `${site.name} | ${site.tagline}`;
  return {
    metadataBase: new URL(site.url),
    title: { default: defaultTitle, template: TITLE_TEMPLATE },
    description: site.description,
    robots: buildRobotsMetadata(isIndexable),
    openGraph: {
      type: "website",
      url: canonicalUrl(HOME_PATH),
      siteName: site.name,
      locale: toOpenGraphLocale(site.locale),
      title: defaultTitle,
      description: site.description,
      images: openGraphImage(DEFAULT_OG_IMAGE),
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: site.description,
      images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE.src), alt: DEFAULT_OG_IMAGE.alt }],
    },
    verification: buildVerificationMetadata(verification),
  };
}
