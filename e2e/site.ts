/**
 * The site's pages, taken from the page registry (src/content/seo.ts) that the site's metadata and
 * sitemap are built from, so every page added to the registry is covered by the tests that loop over
 * ALL_PAGES without anyone editing this file.
 */
import { site } from "../src/config/site";
import { pageRegistry } from "../src/content/seo";
import { BASE_URL } from "./env";

export type NavItem = { readonly label: string; readonly href: string };

export const NAV_ITEMS: readonly NavItem[] = site.nav;

export const LOGIN_PATH = "/login";
export const CONTACT_PATH = "/contact";
export const PROJECTS_PATH = "/projects";

/** Every page of the site, as the registry lists it: the menu pages, the client login, the project pages and any page added later. */
export const ALL_PAGES: readonly string[] = pageRegistry.map((entry) => entry.path);

export const PROJECT_PAGES: readonly string[] = ALL_PAGES.filter((path) => path.startsWith(`${PROJECTS_PATH}/`));

/**
 * A site path such as "/about" as a URL relative to the base URL ("about/"; "./" for the home
 * page). Never pass a path with a leading "/" to page.goto: it would drop the base path.
 */
export function pageUrl(sitePath: string): string {
  const trimmed = sitePath.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "./" : `${trimmed}/`;
}

/** The absolute URL the browser shows for a site path, for example http://127.0.0.1:4173/numaliving.com.au/about/. */
export function absolutePageUrl(sitePath: string): string {
  return new URL(pageUrl(sitePath), BASE_URL).href;
}
