// Request-only (no browser): search engines read the HTML and robots.txt as served.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { JSDOM } from "jsdom";
import { isIndexable, site } from "../src/config/site";
import { BASE_PATH, SERVER_ORIGIN } from "./env";
import { bodyText } from "./page-text";
import { ALL_PAGES, LOGIN_PATH, pageUrl } from "./site";

const ROBOTS_META = /<meta\s+name="robots"\s+content="([^"]*)"/i;
const H1_OPEN_TAG = /<h1[\s>]/gi;

function robotsMetaInHead(html: string): string | undefined {
  const [head] = html.split("</head>");
  return head.match(ROBOTS_META)?.[1];
}

/** Opening <h1> tags in the HTML. The page data Next.js embeds in scripts never contains one. */
function topHeadingCount(html: string): number {
  return html.match(H1_OPEN_TAG)?.length ?? 0;
}

test.skip(({ isMobile }) => isMobile, "Search engines get the same HTML at every screen size.");

for (const path of ALL_PAGES) {
  test(`${path} asks search engines not to index it`, async ({ request }) => {
    const response = await request.get(pageUrl(path));

    expect(response.status()).toBe(200);
    expect(robotsMetaInHead(await response.text())).toMatch(/\bnoindex\b/);
  });
}

test("every page has exactly one top-level heading (<h1>)", async ({ request }) => {
  const counts = await Promise.all(
    ALL_PAGES.map(async (path) => ({ path, h1Count: topHeadingCount(await (await request.get(pageUrl(path))).text()) })),
  );

  expect(counts.filter(({ h1Count }) => h1Count !== 1)).toEqual([]);
});

test("the not-found page asks search engines not to index it", async ({ request }) => {
  const response = await request.get("no-such-page/");

  expect(response.status()).toBe(404);
  expect(robotsMetaInHead(await response.text())).toMatch(/\bnoindex\b/);
});

test("robots.txt below the base path lets crawlers fetch every page", async ({ request }) => {
  const response = await request.get("robots.txt");
  const body = await response.text();

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/^text\/plain/);
  expect(body).toMatch(/^User-Agent: \*$/im);
  expect(body).toMatch(/^Allow: \/$/im);
  expect(body).not.toMatch(/^Disallow:\s*\/\s*$/im);
});

// ---- Search metadata: what a crawler or a link preview reads in each page's <head> ----

/** The longest title a search result shows in full, brand included. */
const MAX_TITLE_CHARACTERS = 60;
const INDEXABLE_DESCRIPTION = { min: 120, max: 160 };
const NOINDEX_DESCRIPTION = { min: 50, max: 160 };
const HTML_ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', "#x27": "'", "#39": "'" };
const ANCHOR_HREF = /<a\b[^>]*?\shref="([^"]*)"/g;
const INDEX_HTML_ADDRESS = /(^|\/)index\.html?([?#]|$)/;

type Page = { path: string; html: string; head: string };

async function fetchPages(request: APIRequestContext): Promise<readonly Page[]> {
  return Promise.all(
    ALL_PAGES.map(async (path) => {
      const html = await (await request.get(pageUrl(path))).text();
      return { path, html, head: html.split("</head>")[0] };
    }),
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (_match, name: string) => HTML_ENTITIES[name]);
}

function titlesIn(head: string): readonly string[] {
  return Array.from(head.matchAll(/<title>([^<]*)<\/title>/g), (match) => decodeEntities(match[1]));
}

function metaContent(head: string, attribute: "name" | "property", key: string): string | undefined {
  const match = head.match(new RegExp(`<meta\\s+${attribute}="${escapeRegExp(key)}"\\s+content="([^"]*)"`, "i"));
  return match === null ? undefined : decodeEntities(match[1]);
}

function canonicalIn(head: string): string | undefined {
  return head.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i)?.[1];
}

function jsonLdBlocks(html: string): readonly string[] {
  return Array.from(html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g), (match) => match[1]);
}

function duplicatesOf(values: readonly string[]): readonly string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

/** A site path as its canonical address ends: "/about" is "/about/", the home page "/". */
function canonicalPathOf(sitePath: string): string {
  return sitePath === "/" ? "/" : `${sitePath.replace(/\/+$/, "")}/`;
}

/** A pathname below the base path, without it: "/numaliving.com.au/about/" is "/about/". */
function belowBasePath(pathname: string): string {
  if (pathname === BASE_PATH) return "/";
  return pathname.startsWith(`${BASE_PATH}/`) ? pathname.slice(BASE_PATH.length) : pathname;
}

test("every page has exactly one title in its head, within 60 characters, and no two pages share one", async ({ request }) => {
  const pages = await fetchPages(request);

  const titles = pages.map((page) => ({ path: page.path, titles: titlesIn(page.head) }));

  expect(titles.filter(({ titles: found }) => found.length !== 1).map(({ path }) => path), "pages without exactly one <title>").toEqual([]);
  const rendered = titles.map(({ titles: found }) => found[0]);
  expect(rendered.filter((title) => title.trim() === "")).toEqual([]);
  expect(rendered.filter((title) => title.length > MAX_TITLE_CHARACTERS), "titles over 60 characters").toEqual([]);
  expect(duplicatesOf(rendered), "titles used by more than one page").toEqual([]);
});

test("every page has a description of the right length, and no two pages share one", async ({ request }) => {
  const pages = await fetchPages(request);

  const descriptions = pages.map((page) => ({ path: page.path, text: metaContent(page.head, "name", "description") ?? "" }));

  const outOfRange = descriptions.filter(({ path, text }) => {
    const range = path === LOGIN_PATH ? NOINDEX_DESCRIPTION : INDEXABLE_DESCRIPTION;
    return text.length < range.min || text.length > range.max;
  });
  expect(outOfRange.map(({ path, text }) => `${path} (${text.length} characters)`), "descriptions outside their range").toEqual([]);
  expect(duplicatesOf(descriptions.map(({ text }) => text)), "descriptions used by more than one page").toEqual([]);
});

test("every page's canonical link is its own address on the site's domain, with a trailing slash", async ({ request }) => {
  const pages = await fetchPages(request);

  const problems = pages.flatMap((page) => {
    const canonical = canonicalIn(page.head);
    if (canonical === undefined) return [`${page.path} has no canonical link`];
    const url = new URL(canonical);
    const issues: string[] = [];
    if (url.origin !== site.url) issues.push(`${page.path}: canonical is on ${url.origin}, not ${site.url}`);
    if (belowBasePath(url.pathname) !== canonicalPathOf(page.path)) issues.push(`${page.path}: canonical path is ${belowBasePath(url.pathname)}, not ${canonicalPathOf(page.path)}`);
    if (url.search !== "" || url.hash !== "") issues.push(`${page.path}: canonical has a query string or a hash`);
    return issues;
  });

  expect(problems).toEqual([]);
});

test("/index.html is a copy of the home page whose canonical link names the home page, so it never competes with it", async ({ request }) => {
  const [home, copy] = await Promise.all([request.get(pageUrl("/")), request.get("index.html")]);

  const [homeHead, copyHead] = [(await home.text()).split("</head>")[0], (await copy.text()).split("</head>")[0]];

  expect(copy.status()).toBe(200);
  expect(canonicalIn(copyHead)).toBeDefined();
  expect(canonicalIn(copyHead)).toBe(canonicalIn(homeHead));
});

test("every page has the Open Graph and X card tags a shared link needs, and its share image answers", async ({ request }) => {
  const pages = await fetchPages(request);
  const required = ["og:title", "og:description", "og:url", "og:image", "og:type", "og:locale"];

  const missing = pages.flatMap((page) => required.filter((key) => (metaContent(page.head, "property", key) ?? "") === "").map((key) => `${page.path} has no ${key}`));
  const wrong = pages.flatMap((page) => [
    ...(metaContent(page.head, "property", "og:type") === "website" ? [] : [`${page.path}: og:type is not website`]),
    ...(metaContent(page.head, "property", "og:locale") === "en_US" ? [] : [`${page.path}: og:locale is not en_US`]),
    ...(metaContent(page.head, "property", "og:url") === canonicalIn(page.head) ? [] : [`${page.path}: og:url is not the canonical address`]),
    ...(metaContent(page.head, "name", "twitter:card") === "summary_large_image" ? [] : [`${page.path}: twitter:card is not summary_large_image`]),
    ...(metaContent(page.head, "property", "og:image:alt") ? [] : [`${page.path}: the share image has no description (og:image:alt)`]),
  ]);

  expect(missing).toEqual([]);
  expect(wrong).toEqual([]);
  const images = [...new Set(pages.map((page) => metaContent(page.head, "property", "og:image") ?? ""))];
  for (const image of images) {
    const response = await request.get(`${SERVER_ORIGIN}${new URL(image).pathname}`);
    expect.soft(response.status(), image).toBe(200);
    expect.soft(response.headers()["content-type"], image).toMatch(/^image\/jpeg/);
  }
});

test("every page says it is in US English", async ({ request }) => {
  const pages = await fetchPages(request);

  const languages = pages.map((page) => ({ path: page.path, lang: page.html.match(/<html[^>]*\slang="([^"]*)"/i)?.[1] }));

  expect(languages.filter(({ lang }) => lang !== "en-US")).toEqual([]);
});

test("every page has structured data that parses, and every inner page a breadcrumb trail that ends at itself", async ({ request }) => {
  const pages = await fetchPages(request);

  const problems = pages.flatMap((page) => {
    const blocks = jsonLdBlocks(page.html);
    if (blocks.length === 0) return [`${page.path} has no JSON-LD`];
    const parsed = blocks.map((block): unknown => JSON.parse(block));
    const withoutContext = parsed.filter((data) => typeof data !== "object" || data === null || !("@context" in data));
    const trail = parsed.find((data) => typeof data === "object" && data !== null && "@type" in data && data["@type"] === "BreadcrumbList") as
      | { itemListElement: { position: number; item: string }[] }
      | undefined;
    const issues = withoutContext.length > 0 ? [`${page.path} has JSON-LD without @context`] : [];
    if (page.path === "/") return issues;
    if (trail === undefined) return [...issues, `${page.path} has no BreadcrumbList`];
    const last = trail.itemListElement[trail.itemListElement.length - 1];
    return last?.item === canonicalIn(page.head) ? issues : [...issues, `${page.path}: the breadcrumb trail does not end at the page`];
  });

  expect(problems).toEqual([]);
});

test("every inner page shows its breadcrumb trail, with the current page last and not a link", async ({ request }) => {
  const pages = (await fetchPages(request)).filter((page) => page.path !== "/");

  const withoutTrail = pages.filter((page) => !/<nav aria-label="Breadcrumb"[\s\S]*?<span aria-current="page">[^<]+<\/span>/.test(page.html));

  expect(withoutTrail.map((page) => page.path)).toEqual([]);
});

test("robots.txt names the sitemap only once the site is indexable", async ({ request }) => {
  const body = await (await request.get("robots.txt")).text();

  const sitemapLine = body.match(/^Sitemap:\s*(\S+)\s*$/im)?.[1];

  expect(sitemapLine).toBe(isIndexable ? `${site.url}${BASE_PATH}/sitemap.xml` : undefined);
});

test("sitemap.xml is well-formed, and lists no page while the site is not indexable", async ({ request }) => {
  const response = await request.get("sitemap.xml");
  const text = await response.text();

  const document = new JSDOM(text, { contentType: "text/xml" }).window.document;

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/xml/);
  expect(document.documentElement.localName).toBe("urlset");
  expect(document.documentElement.namespaceURI).toBe("http://www.sitemaps.org/schemas/sitemap/0.9");
  const locations = Array.from(document.getElementsByTagName("loc"), (element) => element.textContent);
  if (!isIndexable) {
    expect(document.getElementsByTagName("url")).toHaveLength(0);
    return;
  }
  const pages = await fetchPages(request);
  const expected = pages.filter((page) => page.path !== LOGIN_PATH).map((page) => canonicalIn(page.head));
  expect(locations).toEqual(expected);
});

test("no page links to an index.html address", async ({ request }) => {
  const pages = await fetchPages(request);

  const offenders = pages.flatMap((page) => Array.from(page.html.matchAll(ANCHOR_HREF), (match) => match[1]).filter((href) => INDEX_HTML_ADDRESS.test(href)).map((href) => `${page.path} links to ${href}`));

  expect(offenders).toEqual([]);
});


// ---- The first screen: what Numa makes, where it is made and who it is for ----

/** How many words from the top of the page (the preview ribbon and the menu included) the first screen has to say it in. */
const FIRST_SCREEN_WORDS = 80;

test("the home page says what Numa makes, where it is made and who it is for within its first 80 words", async ({ request }) => {
  const html = await (await request.get(pageUrl("/"))).text();

  const firstWords = bodyText(html).split(" ").slice(0, FIRST_SCREEN_WORDS).join(" ").toLowerCase();

  const missing = ["custom millwork", "dubai", "us projects", "architects", "designers", "general contractors", "developers"].filter((fact) => !firstWords.includes(fact));
  expect(missing, `missing from the first ${FIRST_SCREEN_WORDS} words: ${firstWords}`).toEqual([]);
});
