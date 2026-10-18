import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { pageUrl } from "./site";

/** Widths where the Inquire Now side tab shows (from 768 px) and the page's content starts close to the left edge. */
const TAB_WIDTHS = [768, 1024, 1280, 1366, 1379, 1380, 1440] as const;
const VIEWPORT_HEIGHT = 900;
/** The room the hero's text keeps between itself and the side tab. */
const MIN_GAP_FROM_TAB_PX = 8;
/** Google's "good" Cumulative Layout Shift is below 0.1; the hero's photo and text are laid out before anything loads, so it should be far lower. */
const MAX_LAYOUT_SHIFT = 0.01;

function heroContent(page: Page): readonly Locator[] {
  const hero = page.getByRole("region", { name: /Custom millwork/ });
  return [hero.getByRole("heading", { level: 1 }), hero.locator("p").first(), hero.locator("p").nth(1), hero.locator("p").nth(2), hero.getByRole("link", { name: "Request a Quote" })];
}

test.describe("the home page's first screen", () => {
  test.describe("on wide screens", () => {
    test.skip(({ isMobile }) => isMobile, "The Inquire Now tab only shows on wide screens.");

    for (const width of TAB_WIDTHS) {
      test(`keeps its text clear of the Inquire Now tab at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
        await page.goto(pageUrl("/"));

        const tab = await page.getByRole("link", { name: "Inquire Now", exact: true }).boundingBox();
        const lefts = await Promise.all(heroContent(page).map(async (locator) => (await locator.boundingBox())?.x));

        expect(tab).not.toBeNull();
        const tabRight = (tab?.x ?? 0) + (tab?.width ?? 0);
        expect(lefts.filter((left) => left === undefined || left < tabRight + MIN_GAP_FROM_TAB_PX)).toEqual([]);
      });
    }
  });

  test("shows the photo, sharp and in place, and the page does not shift while it loads", async ({ page }) => {
    await page.addInitScript(() => {
      const shifts: number[] = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!shift.hadRecentInput) shifts.push(shift.value);
        }
      }).observe({ type: "layout-shift", buffered: true });
      (window as unknown as { __layoutShifts: number[] }).__layoutShifts = shifts;
    });

    await page.goto(pageUrl("/"));
    await page.waitForLoadState("networkidle");
    const photo = page.getByRole("region", { name: /Custom millwork/ }).getByRole("img");
    await expect(photo).toBeVisible();
    const loaded = await photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0);
    const shift = await page.evaluate(() => (window as unknown as { __layoutShifts: number[] }).__layoutShifts.reduce((sum, value) => sum + value, 0));

    expect(loaded).toBe(true);
    expect(shift).toBeLessThanOrEqual(MAX_LAYOUT_SHIFT);
  });
});
