// Request-only (no browser): reads each page's main area as served, the way a crawler would.
import { expect, test } from "@playwright/test";
import { ALL_PAGES, pageUrl } from "./site";

/** Claims the site no longer makes: other countries, CNC machines, air freight and the old factory floor area. */
const RETIRED_CLAIMS = /Australia|United Kingdom|\bCNC\b|air freight|18,000/i;

const MAIN_AREA = /<main[\s\S]*<\/main>/;

test.skip(({ isMobile }) => isMobile, "Every screen size gets the same HTML.");

test("no page makes a claim the site has retired", async ({ request }) => {
  for (const path of ALL_PAGES) {
    const html = await (await request.get(pageUrl(path))).text();
    const main = html.match(MAIN_AREA)?.[0] ?? "";

    expect.soft(main, `${path} should have a main area`).not.toBe("");
    expect.soft(main.match(RETIRED_CLAIMS)?.[0], `${path} still makes a retired claim`).toBeUndefined();
  }
});
