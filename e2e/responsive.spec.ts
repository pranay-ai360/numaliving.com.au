import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { CONTACT_PATH, LOGIN_PATH, PROJECTS_PATH, pageUrl } from "./site";

const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const VIEWPORT_HEIGHT = 900;
const PAGES = ["/", PROJECTS_PATH, CONTACT_PATH, LOGIN_PATH] as const;

/** How far the page can be scrolled sideways, in CSS pixels, once its fonts have loaded. */
async function sidewaysScroll(page: Page): Promise<number> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
}

async function expectNoSidewaysScroll(page: Page, label: string): Promise<void> {
  for (const path of PAGES) {
    await page.goto(pageUrl(path));
    const overflow = await sidewaysScroll(page);
    expect.soft(overflow, `${path} ${label} scrolls sideways by ${overflow} px`).toBeLessThanOrEqual(0);
  }
}

test.describe("desktop browser", () => {
  test.skip(({ isMobile }) => isMobile, "These tests set their own window widths.");

  for (const width of WIDTHS) {
    test(`no page scrolls sideways at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });

      await expectNoSidewaysScroll(page, `at ${width} px`);
    });
  }
});

test.describe("phone", () => {
  test.skip(({ isMobile }) => !isMobile, "Phone emulation only.");

  test("no page scrolls sideways", async ({ page }) => {
    await expectNoSidewaysScroll(page, "on a phone");
  });

  test("the menu opens and closes", async ({ page }) => {
    await page.goto(pageUrl("/"));
    const menu = page.getByRole("navigation", { name: "Mobile" });
    await expect(menu).toHaveCount(0);

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(menu).toBeVisible();
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");

    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });
});
