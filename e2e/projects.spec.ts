import { expect, test } from "./fixtures";
import { MAX_LAYOUT_SHIFT, recordLayoutShifts, totalLayoutShift } from "./layout-shift";
import { PROJECTS_PATH, pageUrl } from "./site";

test.describe("the Projects page", () => {
  test("shows its heading to everyone, and the page does not shift while it loads", async ({ page }) => {
    await recordLayoutShifts(page);

    await page.goto(pageUrl(PROJECTS_PATH));
    await page.waitForLoadState("networkidle");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    const box = await heading.boundingBox();
    const shift = await totalLayoutShift(page);

    expect(box?.height ?? 0).toBeGreaterThan(0);
    expect(shift).toBeLessThanOrEqual(MAX_LAYOUT_SHIFT);
  });

  test("puts the cards' titles directly under the heading as second-level headings", async ({ page }) => {
    await page.goto(pageUrl(PROJECTS_PATH));

    const cardTitles = page.getByRole("main").getByRole("heading", { level: 2 });

    await expect(cardTitles.first()).toBeVisible();
    await expect(page.getByRole("main").getByRole("heading", { level: 3 })).toHaveCount(0);
  });
});
