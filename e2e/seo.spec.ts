// Request-only (no browser): search engines read the HTML and robots.txt as served.
import { expect, test } from "@playwright/test";
import { ALL_PAGES, pageUrl } from "./site";

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
