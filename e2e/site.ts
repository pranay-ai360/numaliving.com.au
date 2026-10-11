/**
 * The site's pages, taken from the same settings and content the site is built from, so the
 * tests follow when a page or project is added.
 */
import { site } from "../src/config/site";
import { projects } from "../src/content/projects";
import { BASE_URL } from "./env";

export type NavItem = { readonly label: string; readonly href: string };

export const NAV_ITEMS: readonly NavItem[] = site.nav;

export const LOGIN_PATH = "/login";
export const CONTACT_PATH = "/contact";
export const PROJECTS_PATH = "/projects";

export const STATIC_PAGES: readonly string[] = [...NAV_ITEMS.map((item) => item.href), LOGIN_PATH];

export const PROJECT_PAGES: readonly string[] = projects.map((project) => `${PROJECTS_PATH}/${project.slug}`);

export const ALL_PAGES: readonly string[] = [...STATIC_PAGES, ...PROJECT_PAGES];

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
