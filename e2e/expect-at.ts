import { expect, type Page } from "@playwright/test";
import { absolutePageUrl } from "./site";

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Waits until the browser shows the page for `sitePath` below the base path. Next.js writes links
 * to the home page without the trailing slash ("/numaliving.com.au"), so the home page may show
 * either way; every other page must match exactly.
 */
export async function expectAt(page: Page, sitePath: string): Promise<void> {
  const url = absolutePageUrl(sitePath);
  const isHome = sitePath.replace(/\/+$/, "") === "";
  await expect(page).toHaveURL(isHome ? new RegExp(`^${escapeForRegExp(url.replace(/\/$/, ""))}/?$`) : url);
}
