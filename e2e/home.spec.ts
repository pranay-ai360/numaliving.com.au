import type { Locator } from "@playwright/test";
import { BASE_PATH } from "./env";
import { expect, test } from "./fixtures";
import { pageUrl } from "./site";

const HERO_REGIONS = "UAE · Qatar · USA";

/** The figures beside the craft story, as the page shows them. */
const STATS = [
  { label: "Projects delivered", value: "45+" },
  { label: "Countries shipped to", value: "4" },
  { label: "Factory floor", value: "8,000 sq ft" },
  { label: "Craftspeople and engineers", value: "50" },
] as const;

const PORTAL_LAPTOP = { alt: /client portal on a laptop/i, src: "/portal-preview/portal-desktop.jpg" } as const;
const PORTAL_PHONE = { alt: "The same project on a phone", src: "/portal-preview/portal-mobile.jpg" } as const;

/** True when `first` comes before `second` in the page's markup. */
async function comesBefore(first: Locator, second: Locator): Promise<boolean> {
  return first.evaluate((a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING), await second.elementHandle());
}

/** The photo loads lazily, so scroll to it, then wait until it has really decoded and check where it came from. */
async function expectLoadedFrom(photo: Locator, sitePath: string): Promise<void> {
  await photo.scrollIntoViewIfNeeded();
  await expect(photo).toHaveAttribute("src", `${BASE_PATH}${sitePath}`);
  await expect
    .poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0), { message: `${sitePath} did not load` })
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto(pageUrl("/"));
});

test("the hero names UAE, Qatar and USA, and no other country", async ({ page }) => {
  const main = page.getByRole("main");

  await expect(main.getByText(HERO_REGIONS, { exact: true })).toBeVisible();
  await expect(main).not.toContainText(/Australia|United Kingdom/);
});

for (const { label, value } of STATS) {
  test(`the figure "${label}" reads ${value}`, async ({ page }) => {
    const figure = page.getByRole("main").locator("dl > div").filter({ has: page.getByText(label, { exact: true }) });

    await expect(figure.locator("dd")).toHaveText(value);
  });
}

test("Selected Work comes before the craft story, and the sectors section is gone", async ({ page }) => {
  const selectedWork = page.getByRole("heading", { name: "Selected Work" });
  const craftStory = page.getByRole("heading", { name: "The Craft Behind Great Interiors" });

  expect(await comesBefore(selectedWork, craftStory)).toBe(true);
  await expect(page.getByRole("heading", { name: "Who We Build For" })).toHaveCount(0);
});

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "The laptop screenshot only shows from the sm breakpoint up.");

  test("a laptop and a phone show the client portal, both loaded from below the base path", async ({ page }) => {
    await expectLoadedFrom(page.getByRole("img", { name: PORTAL_LAPTOP.alt }), PORTAL_LAPTOP.src);
    await expectLoadedFrom(page.getByRole("img", { name: PORTAL_PHONE.alt, exact: true }), PORTAL_PHONE.src);
  });
});

test.describe("phone", () => {
  test.skip(({ isMobile }) => !isMobile, "Phone emulation only.");

  test("only the phone screenshot shows, loaded from below the base path", async ({ page }) => {
    await expect(page.getByRole("img", { name: PORTAL_LAPTOP.alt })).toBeHidden();
    await expectLoadedFrom(page.getByRole("img", { name: PORTAL_PHONE.alt, exact: true }), PORTAL_PHONE.src);
  });
});
