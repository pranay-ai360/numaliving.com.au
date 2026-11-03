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
import { LEGAL_LAST_UPDATED } from "@/content/legal";
import { projects } from "@/content/projects";
import type { PageSeo, ShowcaseProject } from "@/lib/types";

/** The day the US wording pass finished the copy below, and so the day every page last changed. */
const US_COPY_DATE = "2026-10-18";

const PROJECTS_PATH = "/projects";

/** In the order of the main menu, then the two legal pages (linked from the footer), then the client login. */
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
    description: "Tell us about your project and attach drawings as PDFs or a link. We review your scope within two business days, then get in touch before we send a proposal.",
    indexable: true,
    updated: US_COPY_DATE,
  },
  {
    path: "/privacy",
    title: "Privacy Notice",
    description: "What Numa Living does with the details you send through the quote form on numaliving.us: where they go, who handles them and how the site is hosted.",
    indexable: true,
    updated: LEGAL_LAST_UPDATED.iso,
  },
  {
    path: "/terms",
    title: "Website Terms",
    description: "The terms for using numaliving.us: the pages give general information, a quote comes only in a written proposal, and links lead to sites we don't control.",
    indexable: true,
    updated: LEGAL_LAST_UPDATED.iso,
  },
  {
    path: "/login",
    title: "Client Login",
    description: "Sign-in page for Numa Living clients. The client portal opens soon: drawings, approvals, RFIs and production status for your project in one place.",
    indexable: true,
    updated: US_COPY_DATE,
  },
];

/**
 * Search descriptions of the projects, in US words and within 120 to 160 characters (the
 * summaries on the pages are written in other words and one is too short). A project without one
 * here falls back to its summary.
 */
const PROJECT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  "marina-villa": "Interior millwork for a beachfront villa in Dubai Marina: a backlit display wall framed by fluted panels, pale cabinetry and floating vanities.",
  amherst: "Whole-house millwork in light natural wood for a home in Los Altos Hills, USA: a kitchen with fluted-glass cabinets, a window unit, closets and vanities.",
  sonate: "Kitchens and bathroom millwork for luxury apartments in Dubai Sports City: handleless kitchens with cream upper cabinets and floating vanities.",
  "poppy-16": "A light wood home in Pebble Beach, USA: a kitchen wall of tall units with lit niches, a breakfast-bar island, vanities, a dressing room and a pantry.",
  penthouse25: "A high-rise penthouse in Dubai in warm neutrals: a long bar counter in a champagne metallic finish, a kitchen island and backlit display shelving.",
  sandy: "A hillside home in Morgan Hill, USA: a dark wood-grain kitchen with a two-level island, a home office with a waterfall desk and a lit bar and wine lounge.",
  "golf-links": "Lobby and apartment millwork for a residential tower in Sports City, UAE: a lit reception desk, paneled lobby walls, kitchens, closets and vanities.",
  "poppy-11": "A modern coastal home in Pebble Beach, USA: a dark wood-grain kitchen around a charcoal island, closet walls with tinted-glass doors and floating vanities.",
  estacada: "Light, calm millwork through a single-story home in Los Altos Hills, USA: a pale wood kitchen wall, a waterfall island, closets and vanities.",
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
