import { afterEach, describe, expect, it, vi } from "vitest";
import { isIndexable, site } from "@/config/site";
import {
  DEFAULT_OG_IMAGE,
  TITLE_TEMPLATE,
  buildPageMetadata,
  buildSiteMetadata,
  buildVerificationMetadata,
  renderedTitle,
} from "@/lib/seo/metadata";
import type { PageSeo } from "@/lib/types";

const ABOUT: PageSeo = {
  path: "/about",
  title: "About Us: Millwork Made in Dubai",
  description: "Numa Living is the millwork arm of the Conqueror Group, a family enterprise in contracting, development and hospitality.",
  indexable: true,
  updated: "2026-10-18",
};

const HOME: PageSeo = { ...ABOUT, path: "/", title: "Custom Luxury Millwork, Made in Dubai" };

const LOGIN: PageSeo = { ...ABOUT, path: "/login", title: "Client Login", indexable: false };

const WITH_OWN_IMAGE: PageSeo = {
  ...ABOUT,
  path: "/projects/golf-links",
  ogImage: { src: "/og/golf-links.jpg", alt: "A building lobby with a tree planter" },
};

/** Freezes the entry and everything inside it, so that any attempt to change it throws. */
function deepFreeze<T extends object>(value: T): T {
  for (const inner of Object.values(value)) {
    if (typeof inner === "object" && inner !== null) deepFreeze(inner);
  }
  return Object.freeze(value);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("renderedTitle", () => {
  it("adds the brand after the page title, as the layout's template does", () => {
    // Arrange
    const seo = ABOUT;

    // Act
    const title = renderedTitle(seo);

    // Assert
    expect(title).toBe("About Us: Millwork Made in Dubai | Numa Living");
    expect(title).toBe(TITLE_TEMPLATE.replace("%s", seo.title));
  });

  it("adds the brand to the home title as well", () => {
    // Arrange
    const seo = HOME;

    // Act
    const title = renderedTitle(seo);

    // Assert
    expect(title).toBe("Custom Luxury Millwork, Made in Dubai | Numa Living");
  });
});

describe("buildPageMetadata", () => {
  it("gives an inner page its plain title, so the layout's template adds the brand", () => {
    // Arrange
    const seo = ABOUT;

    // Act
    const metadata = buildPageMetadata(seo);

    // Assert
    expect(metadata.title).toBe(ABOUT.title);
  });

  it("gives the home page an absolute title, because the layout's template does not reach the page in its own folder", () => {
    // Arrange
    const seo = HOME;

    // Act
    const metadata = buildPageMetadata(seo);

    // Assert
    expect(metadata.title).toEqual({ absolute: "Custom Luxury Millwork, Made in Dubai | Numa Living" });
  });

  it("carries the page description", () => {
    // Arrange
    const seo = ABOUT;

    // Act
    const metadata = buildPageMetadata(seo);

    // Assert
    expect(metadata.description).toBe(ABOUT.description);
  });

  it("points the canonical link at the page's own address with a trailing slash", () => {
    // Arrange
    const seo = ABOUT;

    // Act
    const metadata = buildPageMetadata(seo);

    // Assert
    expect(metadata.alternates).toEqual({ canonical: "https://numaliving.us/about/" });
  });

  it("gives the home page the site address as its canonical link", () => {
    // Arrange
    const seo = HOME;

    // Act
    const metadata = buildPageMetadata(seo);

    // Assert
    expect(metadata.alternates?.canonical).toBe("https://numaliving.us/");
  });

  it("describes the page for social networks with the default share image", () => {
    // Arrange
    const seo = ABOUT;

    // Act
    const metadata = buildPageMetadata(seo);

    // Assert
    expect(metadata.openGraph).toEqual({
      type: "website",
      url: "https://numaliving.us/about/",
      siteName: "Numa Living",
      locale: "en_US",
      title: ABOUT.title,
      description: ABOUT.description,
      images: [{ url: "https://numaliving.us/og/default.jpg", width: 1200, height: 630, alt: DEFAULT_OG_IMAGE.alt }],
    });
  });

  it("shows the page's own share image, with its own description, when it has one", () => {
    // Arrange
    const seo = WITH_OWN_IMAGE;

    // Act
    const metadata = buildPageMetadata(seo);

    // Assert
    expect(metadata.openGraph?.images).toEqual([
      { url: "https://numaliving.us/og/golf-links.jpg", width: 1200, height: 630, alt: "A building lobby with a tree planter" },
    ]);
  });

  it("asks for the large-image card on X and gives it the same title, description and image", () => {
    // Arrange
    const seo = WITH_OWN_IMAGE;

    // Act
    const metadata = buildPageMetadata(seo);

    // Assert
    expect(metadata.twitter).toEqual({
      card: "summary_large_image",
      title: WITH_OWN_IMAGE.title,
      description: WITH_OWN_IMAGE.description,
      images: [{ url: "https://numaliving.us/og/golf-links.jpg", alt: "A building lobby with a tree planter" }],
    });
  });

  it("asks search engines not to index the page or follow its links while the site is not indexable", () => {
    // Arrange
    const options = { isIndexable: false };

    // Act
    const metadata = buildPageMetadata(ABOUT, options);

    // Assert
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("leaves the robots metadata unset for an indexable page once the site is indexable", () => {
    // Arrange
    const options = { isIndexable: true };

    // Act
    const metadata = buildPageMetadata(ABOUT, options);

    // Assert
    expect(metadata.robots).toBeUndefined();
  });

  it("keeps a page that is never indexable out of search engines even when the site is indexable", () => {
    // Arrange
    const options = { isIndexable: true };

    // Act
    const metadata = buildPageMetadata(LOGIN, options);

    // Assert
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("follows the site's own indexable setting when none is given", () => {
    // Arrange
    const expected = buildPageMetadata(ABOUT, { isIndexable });

    // Act
    const metadata = buildPageMetadata(ABOUT);

    // Assert
    expect(metadata).toEqual(expected);
  });

  it("writes every address below the base path when the site is served from a sub-path", () => {
    // Arrange
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/numaliving.com.au");

    // Act
    const metadata = buildPageMetadata(ABOUT);

    // Assert
    expect(metadata.alternates?.canonical).toBe("https://numaliving.us/numaliving.com.au/about/");
    expect(metadata.openGraph?.url).toBe("https://numaliving.us/numaliving.com.au/about/");
    expect(metadata.openGraph?.images).toEqual([
      { url: "https://numaliving.us/numaliving.com.au/og/default.jpg", width: 1200, height: 630, alt: DEFAULT_OG_IMAGE.alt },
    ]);
  });

  it("returns a new object on every call and never changes the entry it reads", () => {
    // Arrange
    const seo = deepFreeze({ ...WITH_OWN_IMAGE, ogImage: { ...WITH_OWN_IMAGE.ogImage! } });

    // Act
    const first = buildPageMetadata(seo);
    const second = buildPageMetadata(seo);

    // Assert
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.openGraph).not.toBe(first.openGraph);
  });
});

describe("buildVerificationMetadata", () => {
  it("is unset while no token is known", () => {
    // Arrange
    const verification = { google: null, bing: null };

    // Act
    const metadata = buildVerificationMetadata(verification);

    // Assert
    expect(metadata).toBeUndefined();
  });

  it("treats an empty or blank token as not set, because it could never verify anything", () => {
    // Arrange
    const verification = { google: "", bing: "   " };

    // Act
    const metadata = buildVerificationMetadata(verification);

    // Assert
    expect(metadata).toBeUndefined();
  });

  it("gives Google's token as google-site-verification", () => {
    // Arrange
    const verification = { google: "google-token", bing: null };

    // Act
    const metadata = buildVerificationMetadata(verification);

    // Assert
    expect(metadata).toEqual({ google: "google-token" });
  });

  it("gives Bing's token as msvalidate.01, which has no field of its own", () => {
    // Arrange
    const verification = { google: null, bing: "bing-token" };

    // Act
    const metadata = buildVerificationMetadata(verification);

    // Assert
    expect(metadata).toEqual({ other: { "msvalidate.01": "bing-token" } });
  });

  it("gives both tokens when both are known", () => {
    // Arrange
    const verification = { google: "google-token", bing: "bing-token" };

    // Act
    const metadata = buildVerificationMetadata(verification);

    // Assert
    expect(metadata).toEqual({ google: "google-token", other: { "msvalidate.01": "bing-token" } });
  });
});

describe("buildSiteMetadata", () => {
  it("resolves relative addresses against the site address", () => {
    // Arrange
    const options = { isIndexable: false };

    // Act
    const metadata = buildSiteMetadata(options);

    // Assert
    expect(metadata.metadataBase).toEqual(new URL(site.url));
  });

  it("gives pages a title template that adds the brand, and a default title for pages without one", () => {
    // Arrange
    const options = { isIndexable: false };

    // Act
    const metadata = buildSiteMetadata(options);

    // Assert
    expect(metadata.title).toEqual({ default: "Numa Living | Bespoke millwork, built for the world", template: "%s | Numa Living" });
    expect(metadata.description).toBe(site.description);
  });

  it("asks search engines not to index anything while the site is not indexable", () => {
    // Arrange
    const options = { isIndexable: false };

    // Act
    const metadata = buildSiteMetadata(options);

    // Assert
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("leaves the robots metadata unset once the site is indexable", () => {
    // Arrange
    const options = { isIndexable: true };

    // Act
    const metadata = buildSiteMetadata(options);

    // Assert
    expect(metadata.robots).toBeUndefined();
  });

  it("describes the site for social networks and X, for any page that has no metadata of its own", () => {
    // Arrange
    const options = { isIndexable: false };

    // Act
    const metadata = buildSiteMetadata(options);

    // Assert
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      siteName: "Numa Living",
      locale: "en_US",
      url: "https://numaliving.us/",
      images: [{ url: "https://numaliving.us/og/default.jpg", width: 1200, height: 630 }],
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("publishes no verification tag while no token is set", () => {
    // Arrange
    const options = { isIndexable: false, verification: { google: null, bing: null } };

    // Act
    const metadata = buildSiteMetadata(options);

    // Assert
    expect(metadata.verification).toBeUndefined();
  });

  it("publishes a verification tag once its token is set", () => {
    // Arrange
    const options = { isIndexable: false, verification: { google: "google-token", bing: null } };

    // Act
    const metadata = buildSiteMetadata(options);

    // Assert
    expect(metadata.verification).toEqual({ google: "google-token" });
  });

  it("uses the site's own settings when none are given", () => {
    // Arrange
    const expected = buildSiteMetadata({ isIndexable, verification: site.verification });

    // Act
    const metadata = buildSiteMetadata();

    // Assert
    expect(metadata).toEqual(expected);
  });
});
