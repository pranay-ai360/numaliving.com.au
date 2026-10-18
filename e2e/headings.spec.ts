// Request-only (no browser): the outline of headings in each page as served, which screen readers and search engines read as a nested list.
import { expect, test } from "@playwright/test";
import { headingProblems } from "../src/lib/headings";
import { headingLevels } from "./page-text";
import { ALL_PAGES, pageUrl } from "./site";

test.skip(({ isMobile }) => isMobile, "Search engines get the same HTML at every screen size.");

for (const path of ALL_PAGES) {
  test(`${path} has one H1, first, and skips no heading level`, async ({ request }) => {
    const response = await request.get(pageUrl(path));

    expect(response.status()).toBe(200);
    expect(headingProblems(headingLevels(await response.text())), `heading outline of ${path}`).toEqual([]);
  });
}

test("the not-found page has one H1, first, and skips no heading level", async ({ request }) => {
  const response = await request.get("no-such-page/");

  expect(response.status()).toBe(404);
  expect(headingProblems(headingLevels(await response.text())), "heading outline of the not-found page").toEqual([]);
});
