import { expect, test } from "./fixtures";
import { ALL_PAGES, pageUrl } from "./site";

test.skip(({ isMobile }) => isMobile, "What a page stores or loads does not depend on the screen size.");

/**
 * The privacy notice (src/content/legal.ts) says the site sets no cookies and loads everything from
 * numaliving.us. This spec is what keeps that sentence true. The `test` from ./fixtures already fails
 * on any request to another host (FormSubmit included, which only a submitted form calls), on a page
 * error and on a console error, so a page that loaded a script, font or image from elsewhere fails here.
 */
test("no page sets a cookie or stores anything in the browser, and none loads anything from another site", async ({ page, context }) => {
  for (const path of ALL_PAGES) {
    await page.goto(pageUrl(path));
    await page.waitForLoadState("networkidle");
  }

  const stored = await page.evaluate(() => ({ cookie: document.cookie, localStorageKeys: Object.keys(window.localStorage) }));

  expect(await context.cookies()).toEqual([]);
  expect(stored).toEqual({ cookie: "", localStorageKeys: [] });
});

test("the privacy notice and the terms are among the pages checked, so the claim covers them too", () => {
  expect(ALL_PAGES).toEqual(expect.arrayContaining(["/privacy", "/terms"]));
});
