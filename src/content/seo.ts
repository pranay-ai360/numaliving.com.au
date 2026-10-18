/**
 * The page registry: what search engines and social networks are told about every page. One entry
 * per page, read by the page metadata, the sitemap and the tests. Edit the words here.
 *
 * - `title` leaves the brand out: the layout adds " | Numa Living", and the result stays within 60
 *   characters, so a title is at most 46 characters.
 * - `description` is 120 to 160 characters (50 to 160 for a page that is never indexed).
 * - `updated` is the day the page's content last changed in a way worth telling search engines
 *   (YYYY-MM-DD, written by hand, never "today" by code). Change it when you change the page.
 *
 * The copy below is written in US words and says only what the pages themselves say (the home page's
 * title and description are the draft the owner's plan approved). A project's entry is made from the
 * project itself (src/content/projects.ts): its name, a description from PROJECT_DESCRIPTIONS (its
 * summary until one is written there) and the share image cut from its first photo.
 */
import { projects } from "@/content/projects";
import type { PageSeo, ShowcaseProject } from "@/lib/types";

/** The day the US wording pass finished the copy below, and so the day every page last changed. */
const US_COPY_DATE = "2026-10-18";

const PROJECTS_PATH = "/projects";

/** In the order of the main menu, then the client login, which is never indexed. */
const PAGES: readonly PageSeo[] = [
  {
    path: "/",
    title: "Custom Architectural Millwork for US Projects",
    description: "Numa Living engineers and builds custom architectural millwork and FF&E in Dubai for US architects, designers and contractors. Send drawings for a quote.",
    indexable: true,
    updated: US_COPY_DATE,
  },
  {
    path: "/about",
    title: "About Us: Custom Millwork Made in Dubai",
    description: "Numa Living is the millwork arm of the Conqueror Group, a family enterprise in contracting, development and hospitality. Made in Dubai, delivered worldwide.",
    indexable: true,
    updated: US_COPY_DATE,
  },
  {
    path: PROJECTS_PATH,
    title: "Selected Millwork Projects",
    description: "Browse selected Numa Living projects by sector and country, from residences and offices to multifamily buildings, with the scope and materials of each.",
    indexable: true,
    updated: US_COPY_DATE,
  },
  {
    path: "/capabilities",
    title: "Capabilities: Custom Millwork and FF&E",
    description: "Wall paneling, kitchens, walk-in closets, doors, reception desks, bars, loose FF&E and finishes in veneer, lacquer and stone, all built in one Dubai factory.",
    indexable: true,
    updated: US_COPY_DATE,
  },
  {
    path: "/process",
    title: "Our Process: From Quote to Handover",
    description: "Our process for custom millwork: send drawings for a priced proposal, approve shop drawings and samples, then we build, dry-fit and ship, with install support.",
    indexable: true,
    updated: US_COPY_DATE,
  },
  {
    path: "/contact",
    title: "Request a Quote for Custom Millwork",
    description: "Tell us about your project and attach drawings as PDFs, or paste a link to larger files. We review your scope within two business days and send a proposal.",
    indexable: true,
    updated: US_COPY_DATE,
  },
  {
    path: "/login",
    title: "Client Login",
    description: "Sign-in page for Numa Living clients. The client portal opens soon: drawings, approvals, RFIs and production status for your project in one place.",
    indexable: false,
    updated: US_COPY_DATE,
  },
];

/**
 * Search descriptions of the sample projects, in US words and within 120 to 160 characters (the
 * summaries on the pages are written in other words and one is too short). A project without one
 * here falls back to its summary.
 */
const PROJECT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  "marina-villa": "Full interior millwork for a beachfront villa in Dubai Marina: walnut wall paneling, a bookmatched veneer library and a lacquered kitchen with integrated stone.",
  sonate: "Executive floor build-out for a family office in Dubai: a reception desk, boardroom table, acoustic oak slat walls, pantry millwork and executive suites.",
  penthouse25: "Repeatable kitchen and closet packages for luxury apartments in Dubai, engineered for fast installation and a consistent finish in every unit.",
  "golf-links": "A duplex penthouse in Sports City, UAE, with curved stair cladding, a smoked oak bar, custom dressing rooms in silk-lined lacquer and a media wall.",
  "london-mayfair-apartment": "Made in our Dubai factory and shipped to London in two containers: paneled reception rooms, a kitchen, closets and vanities for four bathrooms.",
  "trivandrum-tech-campus": "Workplace millwork across three floors of a technology campus in India: collaboration booths, cafe counters, lockers and a timber-lined auditorium.",
};

/** The entry for a project's page: its name, a search description, and the share image of its first photo, when it has photos. */
export function projectSeo(project: ShowcaseProject): PageSeo {
  const [cover] = project.photos;
  return {
    path: `${PROJECTS_PATH}/${project.slug}`,
    title: project.name,
    description: PROJECT_DESCRIPTIONS[project.slug] ?? project.summary,
    indexable: true,
    updated: US_COPY_DATE,
    ...(cover === undefined ? {} : { ogImage: { src: `/og/${project.slug}.jpg`, alt: cover.alt } }),
  };
}

/** Every page of the site, in a fixed order. */
export const pageRegistry: readonly PageSeo[] = [...PAGES, ...projects.map(projectSeo)];

/** A page's path without a trailing slash, as the registry writes it ("/" stays "/"). */
function normalizePath(path: string): string {
  return path === "/" ? path : path.replace(/\/+$/, "");
}

export function getPageSeo(path: string): PageSeo | undefined {
  const wanted = normalizePath(path);
  return pageRegistry.find((entry) => entry.path === wanted);
}

/** The entry for a page that must have one; stops the build with a plain message when it has none. */
export function requirePageSeo(path: string): PageSeo {
  const entry = getPageSeo(path);
  if (entry === undefined) {
    throw new Error(`There is no entry for "${path}" in src/content/seo.ts. Add the page's title and description there.`);
  }
  return entry;
}
