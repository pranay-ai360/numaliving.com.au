import type { Locator, Page } from "@playwright/test";
import { site } from "../src/config/site";
import { expectAt } from "./expect-at";
import { expect, test } from "./fixtures";
import { CONTACT_PATH, LOGIN_PATH, NAV_ITEMS, PROJECTS_PATH, PROJECT_PAGES, type NavItem, pageUrl } from "./site";

/** The header marks the current section in gold. */
const HIGHLIGHTED = /(^|\s)text-gold(\s|$)/;

const CLIENT_LOGIN: NavItem = { label: "Client Login", href: LOGIN_PATH };

/** The calls to action in the home page's main content, and where each one leads. */
const HOME_CALLS_TO_ACTION: readonly NavItem[] = [
  { label: "Request a Quote", href: CONTACT_PATH },
  { label: "View Projects", href: PROJECTS_PATH },
  { label: "Our Story", href: "/about" },
  { label: "All projects →", href: PROJECTS_PATH },
  { label: "Our Process", href: "/process" },
  { label: "Client Login →", href: LOGIN_PATH },
];

function linkIn(container: Locator, item: NavItem): Locator {
  return container.getByRole("link", { name: item.label, exact: true });
}

/**
 * Opens a page and waits until the router has prefetched the links in view, Home among them, before
 * a test clicks Home. When the base path ends in a part with a dot (".au" in "/numaliving.com.au"),
 * Next.js reads it as a file extension and writes the Home link without its trailing slash. A click
 * that beats the prefetch then asks for "/numaliving.com.au.txt", outside the site (a console 404),
 * and Next.js falls back to a full page load of the home page.
 */
async function openSettled(page: Page, sitePath: string): Promise<void> {
  await page.goto(pageUrl(sitePath));
  await page.waitForLoadState("networkidle");
}

async function expectOnlyHighlighted(nav: Locator, current: NavItem): Promise<void> {
  for (const item of NAV_ITEMS) {
    const link = linkIn(nav, item);
    await (item === current ? expect(link).toHaveClass(HIGHLIGHTED) : expect(link).not.toHaveClass(HIGHLIGHTED));
  }
}

async function openMobileMenu(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("navigation", { name: "Mobile" });
  await expect(menu).toBeVisible();
  return menu;
}

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "The header links and the Enquire Now tab only show on wide screens.");

  test("every header link opens its page, which is then highlighted", async ({ page }) => {
    await openSettled(page, LOGIN_PATH);
    const nav = page.getByRole("navigation", { name: "Main" });

    for (const item of [...NAV_ITEMS, CLIENT_LOGIN]) {
      await linkIn(nav, item).click();
      await expectAt(page, item.href);
      if (item !== CLIENT_LOGIN) await expectOnlyHighlighted(nav, item);
    }
  });

  test("every footer link opens its page", async ({ page }) => {
    await openSettled(page, LOGIN_PATH);
    const footer = page.getByRole("contentinfo");

    for (const item of [...NAV_ITEMS, CLIENT_LOGIN]) {
      await linkIn(footer, item).click();
      await expectAt(page, item.href);
    }
  });

  test("the Enquire Now tab opens the Contact page", async ({ page }) => {
    await page.goto(pageUrl(PROJECTS_PATH));

    await page.getByRole("link", { name: "Enquire Now", exact: true }).click();

    await expectAt(page, CONTACT_PATH);
  });
});

test.describe("mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "The menu button only shows on small screens.");

  test("every menu link opens its page, closes the menu and is highlighted next time", async ({ page }) => {
    await openSettled(page, LOGIN_PATH);

    for (const item of [...NAV_ITEMS, CLIENT_LOGIN]) {
      await linkIn(await openMobileMenu(page), item).click();
      await expectAt(page, item.href);
      await expect(page.getByRole("navigation", { name: "Mobile" })).toBeHidden();
      if (item === CLIENT_LOGIN) continue;
      await expectOnlyHighlighted(await openMobileMenu(page), item);
      await page.getByRole("button", { name: "Close menu" }).click();
    }
  });
});

test("the logo returns home", async ({ page }) => {
  await openSettled(page, "/about");

  await page.getByRole("link", { name: `${site.name} home` }).click();

  await expectAt(page, "/");
});

for (const cta of HOME_CALLS_TO_ACTION) {
  test(`home page "${cta.label}" opens ${cta.href}`, async ({ page }) => {
    await page.goto(pageUrl("/"));

    await linkIn(page.getByRole("main"), cta).first().click();

    await expectAt(page, cta.href);
  });
}

test("a project card opens its project page", async ({ page }) => {
  await page.goto(pageUrl(PROJECTS_PATH));
  const firstProject = PROJECT_PAGES[0];

  await page.locator(`main a[href$="${firstProject}/"]`).first().click();

  await expectAt(page, firstProject);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
