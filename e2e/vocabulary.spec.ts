// Request-only (no browser): the words a visitor, a screen reader and a search engine read in each page as served.
import { expect, test } from "@playwright/test";
import { JSDOM } from "jsdom";
import { findUkTerms } from "../src/lib/vocabulary";
import { ALL_PAGES, pageUrl } from "./site";

test.skip(({ isMobile }) => isMobile, "Search engines get the same HTML at every screen size.");

/** Elements whose attributes carry words: alt text, labels, tooltips, placeholders and the meta tags (description, share cards). */
const TEXT_ATTRIBUTE_SELECTOR = "[alt], [title], [aria-label], [placeholder], meta[content]";
const TEXT_ATTRIBUTES = ["alt", "title", "aria-label", "placeholder", "content"] as const;

/**
 * Everything a page says: its text (scripts and styles left out), the words in its attributes, and its
 * structured data (JSON-LD), which search engines read as copy too.
 */
function servedText(html: string): string {
  const { document } = new JSDOM(html).window;
  const structuredData = Array.from(document.querySelectorAll('script[type="application/ld+json"]'), (script) => script.textContent ?? "");
  document.querySelectorAll("script, style").forEach((element) => element.remove());
  const attributeText = Array.from(document.querySelectorAll(TEXT_ATTRIBUTE_SELECTOR), (element) =>
    TEXT_ATTRIBUTES.map((name) => element.getAttribute(name) ?? "").join(" "),
  );
  return [document.documentElement.textContent ?? "", ...attributeText, ...structuredData].join("\n");
}

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
