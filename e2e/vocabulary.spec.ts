// Request-only (no browser): the words a visitor, a screen reader and a search engine read in each page as served.
import { expect, test } from "@playwright/test";
import { findUkTerms } from "../src/lib/vocabulary";
import { servedText } from "./page-text";
import { ALL_PAGES, pageUrl } from "./site";

test.skip(({ isMobile }) => isMobile, "Search engines get the same HTML at every screen size.");

/** Each UK-only term in the page, named with the US word to use: `"wardrobes" (wardrobe): write "closets or dressing rooms"`. */
function ukTermsIn(html: string): readonly string[] {
  return findUkTerms(servedText(html)).map((found) => `"${found.match}" (${found.term}): write "${found.us}"`);
}

for (const path of ALL_PAGES) {
  test(`${path} is written in US English`, async ({ request }) => {
    const response = await request.get(pageUrl(path));

    expect(response.status()).toBe(200);
    expect(ukTermsIn(await response.text()), `UK-only terms in ${path}`).toEqual([]);
  });
}

test("the not-found page is written in US English", async ({ request }) => {
  const response = await request.get("no-such-page/");

  expect(response.status()).toBe(404);
  expect(ukTermsIn(await response.text()), "UK-only terms in the not-found page").toEqual([]);
});
