/**
 * Layout-shift measurement for the browser specs: Google's "good" Cumulative Layout Shift is below 0.1,
 * and these pages lay out their text and photos before anything loads, so the limit here is far lower.
 */
import type { Page } from "@playwright/test";

export const MAX_LAYOUT_SHIFT = 0.01;

type ShiftWindow = { __layoutShifts: number[] };

/** Starts recording layout shifts in every document the page opens; call it before page.goto. */
export async function recordLayoutShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const shifts: number[] = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) shifts.push(shift.value);
      }
    }).observe({ type: "layout-shift", buffered: true });
    (window as unknown as ShiftWindow).__layoutShifts = shifts;
  });
}

/** The sum of the shifts recorded since `recordLayoutShifts`. */
export async function totalLayoutShift(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as ShiftWindow).__layoutShifts.reduce((sum, value) => sum + value, 0));
}
