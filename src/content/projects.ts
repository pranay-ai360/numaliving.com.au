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
    slug: "marina-villa",
    name: "Signature Villa, Dubai Marina",
    sector: "Residences",
    city: "Dubai",
    country: "UAE",
    year: 2025,
    summary:
      "Full interior joinery for a 1,400 m² beachfront villa: walnut wall panelling, a bookmatched-veneer library and a lacquered kitchen with integrated stone.",
    scope: ["Wall panelling", "Library and study", "Kitchen", "Walk-in wardrobes", "Internal doors"],
    materials: ["American walnut veneer", "High-gloss lacquer", "Calacatta marble", "Brushed brass"],
    durationWeeks: 26,
    images: ["/projects/marina-villa/Marina-View-0001.jpg", "/projects/marina-villa/Marina-View-0036.jpg", "/projects/marina-villa/Marina-View-0039.jpg", "/projects/marina-villa/Marina-View-0066.jpg", "/projects/marina-villa/Marina-View-0067.jpg", "/projects/marina-villa/Marina-View-0077.jpg"],
    palette: ["walnut", "stone", "brass"],
    featured: true,
    sample: true,
  },
  {
    slug: "sonate",
    name: "Luxury Apartments, Dubai Sports City",
    sector: "Multifamily",
    city: "Dubai",
    country: "UAE",
    year: 2026,
    summary:
      "Executive floor fit-out for a family office: a 9 m reception desk, boardroom table and acoustic oak slat walls across 2,000 m².",
    scope: ["Reception desk", "Boardroom", "Acoustic wall panels", "Executive suites", "Pantry joinery"],
    materials: ["Rift-cut white oak", "Fluted panels", "Leather inlay", "Bronze trims"],
    durationWeeks: 18,
    images: ["/projects/sonate/DSC00734.JPG", "/projects/sonate/DSC00614.JPG", "/projects/sonate/DSC00773.JPG"],
    palette: ["oak", "linen", "brass"],
    featured: true,
    sample: true,
  },
  {
    slug: "penthouse25",
    name: "Waterfront Residences",
    sector: "Residences",
    city: "Dubai",
    country: "UAE",
    year: 2025,
    summary:
      "Repeatable kitchen and wardrobe packages for 84 luxury apartments, engineered for fast install and consistent finish across every unit.",
    scope: ["Kitchens x 84", "Wardrobes x 210", "Vanities", "Entrance doors"],
    materials: ["Matt lacquer", "Oak veneer", "Quartz worktops"],
    durationWeeks: 32,
    images: ["/projects/penthouse25/Penthouse-25-0001.jpg", "/projects/penthouse25/Penthouse-25-0003.jpg", "/projects/penthouse25/Penthouse-25-0004.jpg", "/projects/penthouse25/Penthouse-25-0005.jpg", "/projects/penthouse25/Penthouse-25-0006.jpg", "/projects/penthouse25/Penthouse-25-0011.jpg", "/projects/penthouse25/Penthouse-25-0014.jpg"],
    palette: ["lacquer", "oak", "stone"],
    featured: true,
    sample: true,
  },
  {
    slug: "golf-links",
    name: "High-end Multifamily Residences",
    sector: "Multifamily",
    city: "Sports City",
    country: "UAE",
    year: 2026,
    summary:
      "A duplex penthouse with a curved stair cladding, a bar in smoked oak and bespoke dressing rooms finished in silk-lined lacquer.",
    scope: ["Stair cladding", "Bar", "Dressing rooms", "Media wall"],
    materials: ["Smoked oak", "Lacquer", "Onyx", "Antique brass"],
    durationWeeks: 20,
    images: ["/projects/golf-links/Condor Golf Links18 _ Photo by Intelier1.jpg", "/projects/golf-links/Condor Golf Links18 _ Photo by Intelier2.jpg", "/projects/golf-links/Condor Golf Links18 _ Photo by Intelier3.jpg", "/projects/golf-links/Condor Golf Links18 _ Photo by Intelier4.jpg", "/projects/golf-links/Condor Golf Links18 _ Photo by Intelier5.jpg", "/projects/golf-links/Condor Golf Links18 _ Photo by Intelier6.jpg", "/projects/golf-links/Condor Golf Links18 _ Photo by Intelier7.jpg", "/projects/golf-links/Condor Golf Links18 _ Photo by Intelier8.jpg", "/projects/golf-links/Condor Golf Links18 _ Photo by Intelier16.jpg", "/projects/golf-links/Condor Golf Links18 _ Photo by Intelier24.jpg", "/projects/golf-links/Condor Golf Links18 _ Photo by Intelier25.jpg", "/projects/golf-links/Condor Golf Links18 _ Photo by Intelier31.jpg", "/projects/golf-links/Condor Golf Links18 _ Photo by Intelier32.jpg", "/projects/golf-links/Condor Golf Links18 _ Photo by Intelier33.jpg"],
    palette: ["walnut", "lacquer", "brass"],
    sample: true,
  },
  {
    slug: "london-mayfair-apartment",
    name: "Mayfair Apartment",
    sector: "Residences",
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

export const sectors = ["Residences", "Office", "Multifamily", "Hospitality"] as const;

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}
