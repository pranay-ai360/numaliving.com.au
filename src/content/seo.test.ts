import { describe, expect, it } from "vitest";
import { site } from "@/config/site";
import { LEGAL_LAST_UPDATED, privacyNotice, websiteTerms } from "@/content/legal";
import { pageRegistry, getPageSeo, projectSeo, requirePageSeo } from "@/content/seo";
import { projects } from "@/content/projects";
import { canonicalUrl } from "@/lib/seo/canonical";
import { buildPageMetadata, DEFAULT_OG_IMAGE, renderedTitle } from "@/lib/seo/metadata";
import { buildSitemap } from "@/lib/seo/sitemap";
import { findUkTerms } from "@/lib/vocabulary";
import type { PageSeo, ShowcaseProject } from "@/lib/types";

/** The longest title a search result shows in full, brand included. */
const MAX_RENDERED_TITLE_CHARACTERS = 60;
const INDEXABLE_DESCRIPTION_RANGE = { min: 120, max: 160 } as const;
const NOINDEX_DESCRIPTION_RANGE = { min: 50, max: 160 } as const;
const LOGIN_PATH = "/login";

const projectPaths = projects.map((project) => `/projects/${project.slug}`);
/** The privacy notice and the website terms: linked from the footer, not the main menu. Taken from the pages themselves, not from `legalDrafts`, which the owner empties once a lawyer has reviewed them. */
const legalPaths = [privacyNotice, websiteTerms].map((legal) => legal.path);
const menuPaths = site.nav.map((item) => item.href);

function descriptionRange(entry: PageSeo): { min: number; max: number } {
  return entry.indexable ? INDEXABLE_DESCRIPTION_RANGE : NOINDEX_DESCRIPTION_RANGE;
}

function duplicatesOf(values: readonly string[]): readonly string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

describe("page registry coverage", () => {
  it("has an entry for every page in the main menu", () => {
    // Arrange
    const paths = pageRegistry.map((entry) => entry.path);

    // Act
    const missing = menuPaths.filter((path) => !paths.includes(path));

    // Assert
    expect(missing).toEqual([]);
  });

  it("has an entry for the client login", () => {
    // Arrange
    const paths = pageRegistry.map((entry) => entry.path);

    // Act
    const hasLogin = paths.includes(LOGIN_PATH);

    // Assert
    expect(hasLogin).toBe(true);
  });

  it("has an entry for the privacy notice and the website terms, the two legal pages", () => {
    // Arrange
    const paths = pageRegistry.map((entry) => entry.path);

    // Act
    const missing = legalPaths.filter((path) => !paths.includes(path));

    // Assert
    expect(legalPaths).toEqual(["/privacy", "/terms"]);
    expect(missing).toEqual([]);
  });

  it("dates each legal page the day its draft was last written", () => {
    // Arrange
    const entries = legalPaths.map((path) => requirePageSeo(path));

    // Act
    const dates = entries.map((entry) => entry.updated);

    // Assert
    expect(dates).toEqual([LEGAL_LAST_UPDATED.iso, LEGAL_LAST_UPDATED.iso]);
  });

  it("has an entry for every project", () => {
    // Arrange
    const paths = pageRegistry.map((entry) => entry.path);

    // Act
    const missing = projectPaths.filter((path) => !paths.includes(path));

    // Assert
    expect(missing).toEqual([]);
  });

  it("has no entry for a page that does not exist", () => {
    // Arrange
    const known = new Set([...menuPaths, LOGIN_PATH, ...projectPaths, ...legalPaths]);

    // Act
    const strays = pageRegistry.map((entry) => entry.path).filter((path) => !known.has(path));

    // Assert
    expect(strays).toEqual([]);
  });

  it("has one entry per page", () => {
    // Arrange
    const paths = pageRegistry.map((entry) => entry.path);

    // Act
    const repeated = duplicatesOf(paths);

    // Assert
    expect(repeated).toEqual([]);
  });

  it("lists the home page first and writes every path as site.nav does, without a trailing slash", () => {
    // Arrange
    const [first] = pageRegistry;

    // Act
    const withSlash = pageRegistry.filter((entry) => entry.path !== "/" && entry.path.endsWith("/"));

    // Assert
    expect(first.path).toBe("/");
    expect(withSlash).toEqual([]);
  });
});

describe("page registry titles", () => {
  it("keeps every title, once the brand is added, within 60 characters", () => {
    // Arrange
    const rendered = pageRegistry.map((entry) => ({ path: entry.path, title: renderedTitle(entry) }));

    // Act
    const tooLong = rendered.filter(({ title }) => title.length > MAX_RENDERED_TITLE_CHARACTERS);

    // Assert
    expect(tooLong).toEqual([]);
  });

  it("leaves the brand out of the registry, because the layout adds it", () => {
    // Arrange
    const brand = site.name.toLowerCase();

    // Act
    const withBrand = pageRegistry.filter((entry) => entry.title.toLowerCase().includes(brand));

    // Assert
    expect(withBrand.map((entry) => entry.path)).toEqual([]);
  });

  it("gives every page a title of its own", () => {
    // Arrange
    const titles = pageRegistry.map((entry) => renderedTitle(entry).toLowerCase());

    // Act
    const repeated = duplicatesOf(titles);

    // Assert
    expect(repeated).toEqual([]);
  });

  it("never leaves a title empty", () => {
    // Arrange
    const titles = pageRegistry.map((entry) => entry.title.trim());

    // Act
    const empty = titles.filter((title) => title === "");

    // Assert
    expect(empty).toEqual([]);
  });
});

describe("page registry descriptions", () => {
  it("keeps an indexable page's description between 120 and 160 characters, and a noindex page's between 50 and 160", () => {
    // Arrange
    const lengths = pageRegistry.map((entry) => ({ path: entry.path, length: entry.description.length, range: descriptionRange(entry) }));

    // Act
    const outOfRange = lengths.filter(({ length, range }) => length < range.min || length > range.max);

    // Assert
    expect(outOfRange).toEqual([]);
  });

  it("gives every page a description of its own, so no two pages tell search engines the same thing", () => {
    // Arrange
    const descriptions = pageRegistry.map((entry) => entry.description.toLowerCase());

    // Act
    const repeated = duplicatesOf(descriptions);

    // Assert
    expect(repeated).toEqual([]);
  });

  it("uses US words, not the British, Australian or Gulf ones, in titles and descriptions", () => {
    // Arrange
    const copy = pageRegistry.map((entry) => ({ path: entry.path, text: `${entry.title} ${entry.description}` }));

    // Act
    const offenders = copy.filter(({ text }) => findUkTerms(text).length > 0);

    // Assert
    expect(offenders.map(({ path }) => path)).toEqual([]);
  });
});

describe("the search copy of the existing pages", () => {
  const HOME_TITLE = "Custom Architectural Millwork for US Projects | Numa Living";
  const HOME_DESCRIPTION =
    "Numa Living engineers and builds custom architectural millwork and FF&E in Dubai for US architects, designers and contractors. Send drawings for a quote.";

  it("gives the home page the approved title, 59 characters with the brand, and the approved description", () => {
    // Arrange
    const home = requirePageSeo("/");

    // Act
    const title = renderedTitle(home);

    // Assert
    expect(title).toBe(HOME_TITLE);
    expect(title).toHaveLength(59);
    expect(home.description).toBe(HOME_DESCRIPTION);
  });

  it("tells a US buyer what each page offers, not just which page it is: every page but the project pages and the login names millwork or the work", () => {
    // Arrange
    const pages = ["/", "/about", "/projects", "/capabilities", "/process", "/contact"].map((path) => requirePageSeo(path));

    // Act
    const vague = pages.filter((page) => !/millwork/i.test(`${page.title} ${page.description}`));

    // Assert
    expect(vague.map((page) => page.path)).toEqual([]);
  });

  it("promises nothing the pages do not say: no certification, ranking, year, number of projects or price in a title or description", () => {
    // Arrange
    const copy = pageRegistry.filter((page) => !page.path.startsWith("/projects/")).map((page) => ({ path: page.path, text: `${page.title} ${page.description}` }));

    // Act
    const claims = copy.filter(({ text }) => /\b(ISO|AWI|FSC|certified|award|best|leading|#1|since \d{4}|\d+\+? (projects|years|countries)|from \$)/i.test(text));

    // Assert
    expect(claims.map(({ path }) => path)).toEqual([]);
  });
});

describe("the Contact page's search description", () => {
  it("does not read the two-day review as a deadline for the proposal: the review, the conversation and the proposal come in that order", () => {
    // Arrange
    const { description } = requirePageSeo("/contact");

    // Act
    const sentences = description.split(/(?<=\.)\s+/);
    const reviewSentence = sentences.find((sentence) => /business days/i.test(sentence)) ?? "";

    // Assert
    expect(reviewSentence).not.toBe("");
    expect(reviewSentence).toMatch(/review your scope within two business days, then get in touch before we send a proposal/i);
    expect(reviewSentence).not.toMatch(/business days (and|to) (send|get)/i);
  });
});

describe("page registry dates and flags", () => {
  it("writes every last-modified date as a real calendar day, YYYY-MM-DD", () => {
    // Arrange
    const dates = pageRegistry.map((entry) => entry.updated);

    // Act
    const invalid = dates.filter((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date);

    // Assert
    expect(invalid).toEqual([]);
  });

  it("never dates a page in the future", () => {
    // Arrange
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Act
    const future = pageRegistry.filter((entry) => entry.updated > tomorrow);

    // Assert
    expect(future.map((entry) => entry.path)).toEqual([]);
  });

  it("marks only the client login as never indexable", () => {
    // Arrange
    const neverIndexable = pageRegistry.filter((entry) => !entry.indexable);

    // Act
    const paths = neverIndexable.map((entry) => entry.path);

    // Assert
    expect(paths).toEqual([LOGIN_PATH]);
  });
});

describe("page registry share images", () => {
  it("gives a project with photos the share image cut from its first photo, described as that photo is", () => {
    // Arrange
    const withPhotos = projects.filter((project) => project.photos.length > 0);

    // Act
    const entries = withPhotos.map((project) => ({ project, seo: requirePageSeo(`/projects/${project.slug}`) }));

    // Assert
    expect(entries.length).toBeGreaterThan(0);
    for (const { project, seo } of entries) {
      expect(seo.ogImage).toEqual({ src: `/og/${project.slug}.jpg`, alt: project.photos[0].alt });
    }
  });

  it("describes the site-wide share image in the words of the Signature Villa photo it is cut from", () => {
    // Arrange
    const cover = projects.find((project) => project.slug === "marina-villa")?.photos[0];

    // Act
    const alt = DEFAULT_OG_IMAGE.alt;

    // Assert
    expect(cover).toBeDefined();
    expect(alt).toBe(cover?.alt);
  });

  it("leaves a project without photos, and every other page, on the site-wide share image", () => {
    // Arrange
    const withoutPhotoPaths = new Set(projects.filter((project) => project.photos.length === 0).map((project) => `/projects/${project.slug}`));

    // Act
    const withImage = pageRegistry.filter((entry) => entry.ogImage !== undefined).map((entry) => entry.path);

    // Assert
    expect(withImage.filter((path) => !path.startsWith("/projects/") || withoutPhotoPaths.has(path))).toEqual([]);
  });
});

describe("projectSeo", () => {
  const NEW_PROJECT: ShowcaseProject = {
    slug: "new-office",
    name: "New Office Build-out",
    sector: "Office",
    city: "Austin",
    country: "USA",
    year: 2026,
    summary: "A project added after the registry was written, so it has no hand-written search description.",
    scope: ["Reception desk"],
    materials: ["Oak veneer"],
    durationWeeks: 10,
    photos: [{ src: "/projects/new-office/new-office-01.jpg", alt: "A reception desk in oak veneer", width: 1600, height: 1067 }],
    palette: ["oak", "linen", "brass"],
  };

  it("derives an entry for a project nobody wrote copy for: its name, its summary and its first photo", () => {
    // Arrange
    const project = NEW_PROJECT;

    // Act
    const seo = projectSeo(project);

    // Assert
    expect(seo).toMatchObject({
      path: "/projects/new-office",
      title: "New Office Build-out",
      description: project.summary,
      indexable: true,
      ogImage: { src: "/og/new-office.jpg", alt: "A reception desk in oak veneer" },
    });
  });

  it("has no share image of its own for a project without photos", () => {
    // Arrange
    const project: ShowcaseProject = { ...NEW_PROJECT, photos: [] };

    // Act
    const seo = projectSeo(project);

    // Assert
    expect(seo).not.toHaveProperty("ogImage");
  });
});

describe("getPageSeo and requirePageSeo", () => {
  it("finds a page by its path, with or without a trailing slash", () => {
    // Arrange
    const paths = ["/about", "/about/"];

    // Act
    const found = paths.map((path) => getPageSeo(path)?.path);

    // Assert
    expect(found).toEqual(["/about", "/about"]);
  });

  it("finds the home page", () => {
    // Arrange
    const path = "/";

    // Act
    const seo = getPageSeo(path);

    // Assert
    expect(seo?.path).toBe("/");
  });

  it("finds nothing for a path with no page", () => {
    // Arrange
    const path = "/no-such-page";

    // Act
    const seo = getPageSeo(path);

    // Assert
    expect(seo).toBeUndefined();
  });

  it("fails with a plain message that says where to add the page when it must exist", () => {
    // Arrange
    const path = "/no-such-page";

    // Act
    const act = (): PageSeo => requirePageSeo(path);

    // Assert
    expect(act).toThrow('There is no entry for "/no-such-page" in src/content/seo.ts');
  });
});

describe("the indexable preview", () => {
  it("asks for no noindex on any page but the client login when the site is indexable", () => {
    // Arrange
    const options = { isIndexable: true };

    // Act
    const noindexed = pageRegistry.filter((entry) => buildPageMetadata(entry, options).robots !== undefined).map((entry) => entry.path);

    // Assert
    expect(noindexed).toEqual([LOGIN_PATH]);
  });

  it("lists exactly the indexable pages in the sitemap when the site is indexable", () => {
    // Arrange
    const expected = pageRegistry.filter((entry) => entry.indexable).map((entry) => canonicalUrl(entry.path));

    // Act
    const listed = buildSitemap(pageRegistry, { isIndexable: true }).map((entry) => entry.url);

    // Assert
    expect(listed).toEqual(expected);
    expect(listed).not.toContain(canonicalUrl(LOGIN_PATH));
  });

  it("asks every page, the client login included, not to be indexed while the site is not indexable", () => {
    // Arrange
    const options = { isIndexable: false };

    // Act
    const robots = pageRegistry.map((entry) => buildPageMetadata(entry, options).robots);

    // Assert
    expect(robots.filter((rule) => rule === undefined)).toEqual([]);
    expect(robots.every((rule) => typeof rule === "object" && rule !== null && "index" in rule && rule.index === false)).toBe(true);
  });

  it("lists nothing in the sitemap while the site is not indexable", () => {
    // Arrange
    const options = { isIndexable: false };

    // Act
    const sitemap = buildSitemap(pageRegistry, options);

    // Assert
    expect(sitemap).toEqual([]);
  });
});
