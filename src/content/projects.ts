import type { ShowcaseProject } from "@/lib/types";

/**
 * Showcase projects for the Projects page and home page.
 *
 * SAMPLE CONTENT — every entry below is invented (sample: true).
 * To add a real project: copy one block, change the text, put photos
 * in /public/projects/<slug>/ and list them in `images`.
 */
export const projects: ShowcaseProject[] = [
  {
    slug: "palm-jumeirah-villa",
    name: "Signature Villa, Palm Jumeirah",
    sector: "Residential",
    city: "Dubai",
    country: "UAE",
    year: 2025,
    summary:
      "Full interior joinery for a 1,400 m² beachfront villa: walnut wall panelling, a bookmatched-veneer library and a lacquered kitchen with integrated stone.",
    scope: ["Wall panelling", "Library and study", "Kitchen", "Walk-in wardrobes", "Internal doors"],
    materials: ["American walnut veneer", "High-gloss lacquer", "Calacatta marble", "Brushed brass"],
    durationWeeks: 26,
    images: [],
    palette: ["walnut", "stone", "brass"],
    featured: true,
    sample: true,
  },
  {
    slug: "difc-headquarters",
    name: "Private Office Headquarters, DIFC",
    sector: "Office",
    city: "Dubai",
    country: "UAE",
    year: 2025,
    summary:
      "Executive floor fit-out for a family office: a 9 m reception desk, boardroom table and acoustic oak slat walls across 2,000 m².",
    scope: ["Reception desk", "Boardroom", "Acoustic wall panels", "Executive suites", "Pantry joinery"],
    materials: ["Rift-cut white oak", "Fluted panels", "Leather inlay", "Bronze trims"],
    durationWeeks: 18,
    images: [],
    palette: ["oak", "linen", "brass"],
    featured: true,
    sample: true,
  },
  {
    slug: "kochi-waterfront-residences",
    name: "Waterfront Residences",
    sector: "Multifamily",
    city: "Kochi",
    country: "India",
    year: 2024,
    summary:
      "Repeatable kitchen and wardrobe packages for 84 luxury apartments, engineered for fast install and consistent finish across every unit.",
    scope: ["Kitchens x 84", "Wardrobes x 210", "Vanities", "Entrance doors"],
    materials: ["Matt lacquer", "Oak veneer", "Quartz worktops"],
    durationWeeks: 32,
    images: [],
    palette: ["lacquer", "oak", "stone"],
    featured: true,
    sample: true,
  },
  {
    slug: "doha-penthouse",
    name: "Penthouse Residence, The Pearl",
    sector: "Residential",
    city: "Doha",
    country: "Qatar",
    year: 2024,
    summary:
      "A duplex penthouse with a curved stair cladding, a bar in smoked oak and bespoke dressing rooms finished in silk-lined lacquer.",
    scope: ["Stair cladding", "Bar", "Dressing rooms", "Media wall"],
    materials: ["Smoked oak", "Lacquer", "Onyx", "Antique brass"],
    durationWeeks: 20,
    images: [],
    palette: ["walnut", "lacquer", "brass"],
    sample: true,
  },
  {
    slug: "london-mayfair-apartment",
    name: "Mayfair Apartment",
    sector: "Residential",
    city: "London",
    country: "United Kingdom",
    year: 2023,
    summary:
      "Made in our factory and shipped to London in two containers: panelled reception rooms, a kitchen and four bathrooms of vanity joinery.",
    scope: ["Panelled reception rooms", "Kitchen", "Vanities", "Wardrobes"],
    materials: ["Painted MDF panelling", "Walnut", "Nero Marquina marble"],
    durationWeeks: 22,
    images: [],
    palette: ["linen", "walnut", "stone"],
    sample: true,
  },
  {
    slug: "trivandrum-tech-campus",
    name: "Technology Campus Workplace",
    sector: "Office",
    city: "Thiruvananthapuram",
    country: "India",
    year: 2023,
    summary:
      "Workplace joinery across three floors: collaboration booths, café counters, lockers and a timber-lined auditorium.",
    scope: ["Café counters", "Booths", "Lockers", "Auditorium lining"],
    materials: ["Oak veneer", "Laminate", "Acoustic felt"],
    durationWeeks: 16,
    images: [],
    palette: ["oak", "linen", "lacquer"],
    sample: true,
  },
];

export const sectors = ["Residential", "Office", "Multifamily", "Hospitality"] as const;

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}
