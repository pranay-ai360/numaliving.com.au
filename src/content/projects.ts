import type { ShowcaseProject } from "@/lib/types";

/** The golf-links photos were credited in their old file names ("photo-by-intelier"); kept here so the credit survives the renaming. */
const GOLF_LINKS_CREDIT = "Photo by Intelier";

/**
 * Showcase projects for the Projects page and home page.
 *
 * SAMPLE CONTENT — every entry below is invented (sample: true).
 * To add a real project: copy one block, change the text, put the photos in
 * /public/projects/<slug>/ and list them in `photos`, the cover first.
 * Name each photo file <slug>-<nn>.jpg, in lowercase with hyphens and no spaces (for example
 * public/projects/marina-villa/marina-villa-01.jpg): the site is hosted on a case-sensitive server, and spaces
 * would need URL-encoding. Then run `npm run images:build`: it makes the fast AVIF and WebP copies the pages
 * load, and the 1200 x 630 share image public/og/<slug>.jpg from the first photo.
 * Give every photo a description of its own in `alt` (8 to 20 words that say what the picture shows) and its
 * size in pixels. Keep each path starting with "/"; the site adds its base path when it shows the photo.
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
      "Full interior millwork for a beachfront villa of about 15,000 sq ft (1,400 m²): walnut wall paneling, a bookmatched-veneer library and a lacquered kitchen with integrated stone.",
    scope: ["Wall paneling", "Library and study", "Kitchen", "Walk-in closets", "Interior doors"],
    materials: ["American walnut veneer", "High-gloss lacquer", "Calacatta marble", "Brushed brass"],
    durationWeeks: 26,
    photos: [
      { src: "/projects/marina-villa/marina-villa-01.jpg", alt: "Open-plan living room with a curved cream sofa, a gray kitchen with island behind it and a glass-sided staircase", width: 1600, height: 1067 },
      { src: "/projects/marina-villa/marina-villa-02.jpg", alt: "Powder room with a pale double vanity, backlit mirrors, brass towel bars and a black and white patterned ceiling", width: 1600, height: 2400 },
      { src: "/projects/marina-villa/marina-villa-03.jpg", alt: "Backlit veined stone alcove with open shelves and drawers beside a wall of green fluted paneling", width: 1600, height: 2400 },
      { src: "/projects/marina-villa/marina-villa-04.jpg", alt: "Dining corner with a round marble table, a woven pendant light and a shelved niche between brass-trimmed doors", width: 1600, height: 1067 },
      { src: "/projects/marina-villa/marina-villa-05.jpg", alt: "Wall-mounted console with bronze end panels below an antiqued mirror with brass inlay lines, in a stepped white frame", width: 1600, height: 2400 },
      { src: "/projects/marina-villa/marina-villa-06.jpg", alt: "Bathroom with a stone-look floating vanity, backlit mirror, brass fittings and a freestanding oval bathtub", width: 1600, height: 2400 },
    ],
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
      "Executive floor build-out for a family office: a reception desk of about 30 ft (9 m), a boardroom table and acoustic oak slat walls across about 21,500 sq ft (2,000 m²).",
    scope: ["Reception desk", "Boardroom", "Acoustic wall panels", "Executive suites", "Pantry millwork"],
    materials: ["Rift-cut white oak", "Fluted panels", "Leather inlay", "Bronze trims"],
    durationWeeks: 18,
    photos: [
      { src: "/projects/sonate/sonate-01.jpg", alt: "Living and dining area with a round white table, black chairs, sheer curtains and a curved white sofa", width: 1600, height: 1067 },
      { src: "/projects/sonate/sonate-02.jpg", alt: "Bathroom with a wall-hung vanity in a striped wood-grain finish, a white basin, backlit mirror and lit shelves", width: 1600, height: 1067 },
      { src: "/projects/sonate/sonate-03.jpg", alt: "U-shaped kitchen with striped wood-grain base cabinets, cream wall cabinets, a built-in oven and under-cabinet lighting", width: 1600, height: 1067 },
    ],
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
      "Repeatable kitchen and closet packages for 84 luxury apartments, engineered for fast install and consistent finish across every unit.",
    scope: ["Kitchens x 84", "Closets x 210", "Vanities", "Entrance doors"],
    materials: ["Matte lacquer", "Oak veneer", "Quartz countertops"],
    durationWeeks: 32,
    photos: [
      { src: "/projects/penthouse25/penthouse25-01.jpg", alt: "Open-plan high-rise living room with tan armchairs, a curved cream sofa, perforated screens and floor-to-ceiling city views", width: 1600, height: 1067 },
      { src: "/projects/penthouse25/penthouse25-02.jpg", alt: "Living area looking toward a long bar counter with brass-footed stools, a fluted curved wall and lattice screens", width: 1600, height: 1067 },
      { src: "/projects/penthouse25/penthouse25-03.jpg", alt: "Dining room with a long table, cream upholstered chairs, an oval patchwork rug and perforated screens by large windows", width: 1600, height: 1067 },
      { src: "/projects/penthouse25/penthouse25-04.jpg", alt: "Living space with bronze double doors, a backlit stone niche behind the bar and a curved cream sofa", width: 1600, height: 1067 },
      { src: "/projects/penthouse25/penthouse25-05.jpg", alt: "Kitchen with a long island, tan bar stools and white flat-front tall cabinets housing built-in ovens", width: 1600, height: 1067 },
      { src: "/projects/penthouse25/penthouse25-06.jpg", alt: "Bedroom with a ribbed wood bed frame, cream bedding, sheer curtains and a curved white armchair", width: 1600, height: 1067 },
      { src: "/projects/penthouse25/penthouse25-07.jpg", alt: "Bedroom with a padded headboard, brass globe lamps, a white bench and a lattice screen by the window", width: 1600, height: 1067 },
    ],
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
      "A duplex penthouse with curved stair cladding, a bar in smoked oak and custom dressing rooms finished in silk-lined lacquer.",
    scope: ["Stair cladding", "Bar", "Dressing rooms", "Media wall"],
    materials: ["Smoked oak", "Lacquer", "Onyx", "Antique brass"],
    durationWeeks: 20,
    photos: [
      { src: "/projects/golf-links/golf-links-01.jpg", alt: "Seating lounge with tan and gray sofas, tan armchairs, a marble coffee table and curved beige wall panels", credit: GOLF_LINKS_CREDIT, width: 1600, height: 1067 },
      { src: "/projects/golf-links/golf-links-02.jpg", alt: "Entrance hall with a sculpted tree in a stone planter, hanging light tubes, elevators and a veined reception desk", credit: GOLF_LINKS_CREDIT, width: 1600, height: 1067 },
      { src: "/projects/golf-links/golf-links-03.jpg", alt: "Gray sofa under two framed wave artworks, flanked by potted trees, with a marble coffee table in front", credit: GOLF_LINKS_CREDIT, width: 1600, height: 1067 },
      { src: "/projects/golf-links/golf-links-04.jpg", alt: "Elevator lobby with three brass-toned doors in backlit stone panels, a polished floor and a tree planter", credit: GOLF_LINKS_CREDIT, width: 1600, height: 1067 },
      { src: "/projects/golf-links/golf-links-05.jpg", alt: "Two armchairs with striped cushions before floor-to-ceiling sheer curtains, beside a green plant wall and a potted tree", credit: GOLF_LINKS_CREDIT, width: 1600, height: 1067 },
      { src: "/projects/golf-links/golf-links-06.jpg", alt: "Reception desk of veined green-gray stone with a vase of white blossoms, in front of backlit beige wall panels", credit: GOLF_LINKS_CREDIT, width: 1600, height: 1067 },
      { src: "/projects/golf-links/golf-links-07.jpg", alt: "Close-up of an orange cushion on a gray sofa, a framed wave artwork, a potted tree and side tables", credit: GOLF_LINKS_CREDIT, width: 1600, height: 2400 },
      { src: "/projects/golf-links/golf-links-08.jpg", alt: "Fitness room with a dumbbell rack, dark wood shelving holding an exercise ball, and a mirrored wall", credit: GOLF_LINKS_CREDIT, width: 1600, height: 1067 },
      { src: "/projects/golf-links/golf-links-09.jpg", alt: "Sauna door in a wood frame beside a dark stone vanity with two amber glass basins and backlit mirrors", credit: GOLF_LINKS_CREDIT, width: 1600, height: 1762 },
      { src: "/projects/golf-links/golf-links-10.jpg", alt: "Open-plan apartment with a pale sofa, a breakfast table and a kitchen with white upper and wood-toned lower cabinets", credit: GOLF_LINKS_CREDIT, width: 1600, height: 1067 },
      { src: "/projects/golf-links/golf-links-11.jpg", alt: "Compact apartment with a cream sofa, orange cushions and a round white coffee table, dining table and kitchen beyond", credit: GOLF_LINKS_CREDIT, width: 1600, height: 1067 },
      { src: "/projects/golf-links/golf-links-12.jpg", alt: "Bedroom with floor-to-ceiling white closet doors, a padded headboard with tan piping and a three-panel textured artwork", credit: GOLF_LINKS_CREDIT, width: 1600, height: 1067 },
      { src: "/projects/golf-links/golf-links-13.jpg", alt: "View from a hallway into an en-suite bathroom with a wood-toned vanity and, beyond, a bedroom with balcony doors", credit: GOLF_LINKS_CREDIT, width: 1600, height: 1067 },
      { src: "/projects/golf-links/golf-links-14.jpg", alt: "Bathroom with a glass-screened shower, a wall-hung toilet, a backlit mirror and an oval basin on a wood-toned vanity", credit: GOLF_LINKS_CREDIT, width: 1600, height: 1067 },
    ],
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
      "Made in our factory and shipped to London in two containers: paneled reception rooms, a kitchen and vanity millwork for four bathrooms.",
    scope: ["Paneled reception rooms", "Kitchen", "Vanities", "Closets"],
    materials: ["Painted MDF paneling", "Walnut", "Nero Marquina marble"],
    durationWeeks: 22,
    photos: [],
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
      "Workplace millwork across three floors: collaboration booths, café counters, lockers and a wood-lined auditorium.",
    scope: ["Café counters", "Booths", "Lockers", "Auditorium lining"],
    materials: ["Oak veneer", "Laminate", "Acoustic felt"],
    durationWeeks: 16,
    photos: [],
    palette: ["oak", "linen", "lacquer"],
    sample: true,
  },
];

export const sectors = ["Residences", "Office", "Multifamily", "Hospitality"] as const;

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}
