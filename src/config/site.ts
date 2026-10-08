/**
 * Site-wide settings: name, contact details, navigation.
 * Edit the values here — no other file needs to change.
 */
export const site = {
  name: "Numa Living",
  wordmark: "NUMA",
  wordmarkSub: "LIVING",
  group: "A Condor Group company",
  tagline: "Bespoke millwork, built for the world",
  description:
    "Numa Living designs, engineers and manufactures luxury joinery and millwork for residences, workplaces and multifamily buildings, and delivers it worldwide.",

  // TODO(Ramya): replace with real contact details
  contact: {
    email: "projects@numaliving.com",
    phone: "+971 4 000 0000",
    whatsapp: "971400000000", // digits only, used for the wa.me link
    address: "Factory address, Dubai, UAE",
  },

  nav: [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Projects", href: "/projects" },
    { label: "Factory", href: "/factory" },
    { label: "Capabilities", href: "/capabilities" },
    { label: "Process", href: "/process" },
    { label: "Global Delivery", href: "/global-delivery" },
    { label: "Contact", href: "/contact" },
  ],
} as const;

/**
 * Show the "Sample content" ribbon until real content is in place.
 * Set to false once projects, photos and copy are final.
 */
export const showSampleNotice = true;
