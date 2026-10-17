/**
 * Site-wide settings: name, contact details, navigation.
 * Edit the values here. If you change the contact email, update its pin in site.test.ts too.
 */
export const site = {
  name: "Numa Living",
  wordmark: "NUMA",
  wordmarkSub: "LIVING",
  group: "A Conqueror Group company",
  tagline: "Bespoke millwork, built for the world",
  description:
    "Numa Living designs, engineers and manufactures luxury joinery and millwork for residences, workplaces and multifamily buildings, and delivers it worldwide.",

  // The email is real. TODO(Ramya): replace the placeholder phone, WhatsApp number and address. Until
  // then, src/config/launchGuard.test.ts fails the tests (and the deploy) if isIndexable below is true.
  contact: {
    email: "projects@numaliving.us",
    phone: "+971 4 000 0000",
    whatsapp: "971400000000", // digits only, used for the wa.me link
    address: "Factory address, Dubai, UAE",
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
 */
export const isIndexable = false;
