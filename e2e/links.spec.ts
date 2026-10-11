// Request-only (no browser): reads each page's HTML the way a crawler or a full page load would.
import { expect, test } from "@playwright/test";
import { BASE_PATH, BASE_URL } from "./env";
import { ALL_PAGES, pageUrl } from "./site";

const ANCHOR_HREF = /<a\b[^>]*?\shref="([^"]*)"/g;

/** Root-relative link targets in a page's HTML: no mailto:, tel:, #fragments or other sites. */
function internalHrefs(html: string): readonly string[] {
  return Array.from(html.matchAll(ANCHOR_HREF), (match) => match[1]).filter((href) => href.startsWith("/") && !href.startsWith("//"));
}

/** Next.js writes the home link without its trailing slash ("/numaliving.com.au"). */
function withoutTrailingSlash(path: string): string {
  return path.replace(/\/+$/, "");
}

test.skip(({ isMobile }) => isMobile, "Links do not depend on the screen size.");

test("every page answers 200, and every link on it stays below the base path and answers 200", async ({ request }) => {
  const hrefsByPage = await Promise.all(
    ALL_PAGES.map(async (path) => {
      const response = await request.get(pageUrl(path));
      expect.soft(response.status(), `${path} should answer 200`).toBe(200);
      return internalHrefs(await response.text());
    }),
  );
  const hrefs = [...new Set(hrefsByPage.flat())];
  const linkedPaths = new Set(hrefs.map(withoutTrailingSlash));
  const unlinkedPages = ALL_PAGES.filter((path) => !linkedPaths.has(withoutTrailingSlash(new URL(pageUrl(path), BASE_URL).pathname)));
  expect(unlinkedPages, "pages no link leads to").toEqual([]);

  for (const href of hrefs) {
    expect.soft(href === BASE_PATH || href.startsWith(`${BASE_PATH}/`), `${href} should start with ${BASE_PATH}/`).toBe(true);
    const response = await request.get(new URL(href, BASE_URL).href);
    expect.soft(response.status(), `${href} should answer 200`).toBe(200);
    expect.soft(response.headers()["content-type"], `${href} should be a page`).toMatch(/^text\/html/);
  }
});
