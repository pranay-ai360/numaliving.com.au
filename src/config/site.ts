import { companyFacts } from "@/content/company";

/** Search-engine ownership tokens (public by design, they sit in the page source); null until the owner supplies one. */
export type SearchVerification = Readonly<{ google: string | null; bing: string | null }>;

/**
 * Site-wide settings: name, address, language, contact details, navigation.
 * Edit the values here. If you change the contact email or the site address, update its pin in site.test.ts too.
 */
export const site = {
  name: "Numa Living",
  wordmark: "NUMA",
  wordmarkSub: "LIVING",
  group: "A Conqueror Group company",
  tagline: "Custom millwork, built for the world",
  // Written for the United States, where the structured data says Numa serves customers
  // (src/lib/seo/jsonld.ts); the same positioning as the home page (claims.positioning).
  description:
    "Numa Living designs, engineers and manufactures luxury custom millwork in Dubai for residences, workplaces and multifamily buildings in the United States.",

  // Where the site is served, as an origin: no trailing slash and no path (the base path is separate,
  // see src/lib/seo/canonical.ts). Canonical links, Open Graph URLs, the sitemap and the structured
  // data all start from it.
  url: "https://numaliving.us",
  // The language and region of the copy, for <html lang> and Open Graph (written "en_US" there).
  locale: "en-US",

  // Facts the structured data (src/lib/seo/jsonld.ts) only publishes once they are set. They come from
  // the company facts (src/content/company.ts), which stay empty until Numa confirms them.
  legalName: companyFacts.legalName,
  foundingYear: companyFacts.foundingYear,
  // Full URLs of Numa's real profiles (LinkedIn, Instagram, Houzz and so on), published as `sameAs`.
  social: [] as readonly string[],
  verification: { google: null, bing: null } as SearchVerification,

  // The email is real. TODO(Ramya): replace the placeholder phone, WhatsApp number and address. Until
  // then, src/config/launchGuard.test.ts fails the tests (and the deploy) if isIndexable below is true.
  // The guard judges the shape (src/lib/realContact.ts), not the exact stubs: a phone or WhatsApp number
  // needs 7 or more digits and no run of four zeros (the WhatsApp number digits only), the address a number.
  contact: {
    email: "projects@numaliving.us",
    phone: "+971 4 000 0000",
    whatsapp: "971400000000", // digits only, used for the wa.me link
    address: "Factory address, Dubai, UAE",
    // Optional: the Contact page shows them only when set, for example "Monday to Friday, 9 am to 5 pm"
    // and "Central Time". Null until the owner supplies them; the launch guard does not require them.
    hours: null as string | null,
    timezone: null as string | null,
  },

  nav: [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Projects", href: "/projects" },
    { label: "Capabilities", href: "/capabilities" },
    { label: "Process", href: "/process" },
    { label: "Contact", href: "/contact" },
  ],
} as const;

/**
 * Show the "Sample content" ribbon until real content is in place.
 * Set to false once projects, photos and copy are final.
 */
export const showSampleNotice = true;

/**
 * Whether search engines may index the site (the robots meta tag follows this; robots.txt lets
 * crawlers in either way so they can read that tag, see src/lib/robots.ts).
 * Keep false while the site is a preview; flip to true when the real domain is live and the
 * contact details above are real (src/config/launchGuard.test.ts checks the second part).
 * Keep it a plain `true` or `false`: the guard reads the value the tests see, so a test requires the
 * literal in this file (a value computed from an environment variable could differ in the build).
 */
export const isIndexable = false;
