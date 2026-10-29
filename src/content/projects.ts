import type { ShowcaseProject } from "@/lib/types";

/**
 * Showcase projects for the Projects page and home page.
 *
 * SAMPLE CONTENT — every entry below is invented (sample: true).
 * To add a real project: copy one block, change the text, put photos
 * in /public/projects/<slug>/ and list them in `images`.
 * Name photo files in lowercase with hyphens and no spaces (for example kitchen-01.jpg):
 * the site is hosted on a case-sensitive server and spaces would need URL-encoding.
 * Keep each path starting with "/"; the site adds its base path when it shows the photo.
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
      "Interior joinery for a beachfront villa: a backlit display wall framed by fluted panels, pale cabinetry picked out with fine metallic trims, floating vanities with concealed lighting, and a curved console on a metallic plinth.",
    scope: ["Feature display wall", "Built-in cabinetry", "Vanities", "Display niches", "Wall panelling"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
    durationWeeks: 26,
    images: ["/projects/marina-villa/Marina-View-0001.jpg", "/projects/marina-villa/Marina-View-0036.jpg", "/projects/marina-villa/Marina-View-0039.jpg", "/projects/marina-villa/Marina-View-0066.jpg", "/projects/marina-villa/Marina-View-0067.jpg", "/projects/marina-villa/Marina-View-0077.jpg"],
    palette: ["walnut", "stone", "brass"],
    featured: true,
    sample: true,
  },
  {
    slug: "Amherst",
    name: "Amherst Ct",
    sector: "Residences",
    city: "Los Altos Hills",
    country: "USA",
    year: 2023,
    summary:
      "Whole-house millwork in light natural wood tones: a kitchen with fluted-glass upper cabinets and integrated appliance panels, a built-in window unit, wardrobes and vanities with reeded lower panels, lit floating shelves at the bar, and a sage-green laundry.",
    scope: ["Kitchen and island", "Window seat", "Bar shelving", "Vanities", "Wardrobes and closets", "Laundry"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
    durationWeeks: 16,
    images: ["/projects/Amherst/amherst-05.jpg", "/projects/Amherst/amherst-12.jpg", "/projects/Amherst/amherst-11.jpg", "/projects/Amherst/amherst-10.jpg", "/projects/Amherst/amherst-07.jpg", "/projects/Amherst/amherst-06.jpg", "/projects/Amherst/amherst-13.jpg" ,"/projects/Amherst/amherst-04.jpg", "/projects/Amherst/amherst-01.jpg", "/projects/Amherst/amherst-02.jpg", "/projects/Amherst/amherst-03.jpg"],
    palette: ["oak", "linen", "lacquer"],
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
      "Kitchens and bathroom joinery for luxury apartments: handleless kitchens pairing cream upper cabinets with horizontal wood-grain bases, under-cabinet and plinth lighting, and floating vanities beside lit niches with slim black shelves.",
    scope: ["Kitchens", "Bathroom vanities", "Lit shelving niches", "Full-height panelling"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
    durationWeeks: 18,
    images: ["/projects/sonate/DSC00734.JPG", "/projects/sonate/DSC00614.JPG", "/projects/sonate/DSC00773.JPG"],
    palette: ["oak", "linen", "brass"],
    featured: true,
    sample: true,
  },
  {
    slug: "Poppy_16",
    name: "Poppy 16",
    sector: "Residences",
    city: "Pebble Beach",
    country: "USA",
    year: 2025,
    summary:
      "Warm light wood home: a kitchen wall of tall units with lit display niches, an island with a long breakfast bar, vanities under stone tops, a floating powder-room vanity, a dressing-room island, and laundry and pantry storage with open shelving.",
    scope: ["Kitchen and island", "Display niches", "Vanities", "Dressing room", "Laundry", "Pantry"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
    durationWeeks: 16,
    images: ["/projects/Poppy_16/poppy16-18.jpeg", "/projects/Poppy_16/poppy16-11.jpg", "/projects/Poppy_16/poppy16-12.jpg", "/projects/Poppy_16/poppy16-13.jpg", "/projects/Poppy_16/poppy16-15.jpg", "/projects/Poppy_16/poppy16-16.jpg", "/projects/Poppy_16/poppy16-17.jpg", "/projects/Poppy_16/poppy16-19.jpeg", "/projects/Poppy_16/poppy16-20.jpeg", "/projects/Poppy_16/poppy16-24.jpeg", "/projects/Poppy_16/poppy16-25.jpeg", "/projects/Poppy_16/poppy16-26.jpeg", "/projects/Poppy_16/poppy16-28.jpeg", "/projects/Poppy_16/poppy16-29.jpeg", "/projects/Poppy_16/poppy16-31.jpeg"],
    palette: ["oak", "linen", "lacquer"],
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
      "A high-rise penthouse in warm neutrals: a long bar counter in a champagne metallic finish, a kitchen island with seamless handleless tall units, decorative lattice screens framing the city views, and backlit display shelving at the entrance.",
    scope: ["Kitchen and island", "Bar counter", "Lattice screens", "Handleless wall units", "Display shelving"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
    durationWeeks: 32,
    images: ["/projects/penthouse25/Penthouse-25-0001.jpg", "/projects/penthouse25/Penthouse-25-0003.jpg", "/projects/penthouse25/Penthouse-25-0004.jpg", "/projects/penthouse25/Penthouse-25-0005.jpg", "/projects/penthouse25/Penthouse-25-0006.jpg", "/projects/penthouse25/Penthouse-25-0011.jpg", "/projects/penthouse25/Penthouse-25-0014.jpg"],
    palette: ["lacquer", "oak", "stone"],
    featured: true,
    sample: true,
  },
  {
    slug: "Sandy",
    name: "Sandy Ct",
    sector: "Residences",
    city: "Morgan Hill",
    country: "USA",
    year: 2023,
    summary:
      "Contrasting moods across a hillside home: a dark wood-grain kitchen with full-height tall units and a two-level island, a warm-toned home office with a waterfall desk and steel-framed shelving, floating wood vanities, vertical timber-look cladding in the primary bath, and a lit bar and wine lounge.",
    scope: ["Kitchen and island", "Home office", "Vanities", "Timber wall cladding", "Bar and wine lounge", "Media console"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
    durationWeeks: 16,
    images: ["/projects/Sandy/sandy-14.jpg", "/projects/Sandy/sandy-01.jpg", "/projects/Sandy/sandy-02.jpg", "/projects/Sandy/sandy-03.jpg", "/projects/Sandy/sandy-06.jpg", "/projects/Sandy/sandy-07.jpg", "/projects/Sandy/sandy-12.jpg", "/projects/Sandy/sandy-13.jpg", "/projects/Sandy/sandy-15.jpg", "/projects/Sandy/sandy-16.jpg", "/projects/Sandy/sandy-17.jpg"],
    palette: ["oak", "linen", "lacquer"],
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
      "Lobby and apartment joinery for a residential tower: a reception desk on a lit plinth, light timber-look wall panelling through the lobby and lounge, handleless kitchens and full-height wardrobes in the apartments, and dark wood-grain vanities and gym shelving with concealed lighting.",
    scope: ["Reception desk", "Lobby wall panelling", "Kitchens", "Wardrobes", "Vanities", "Gym shelving"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
    durationWeeks: 20,
    images: ["/projects/golf-links/condor-golf-links18-photo-by-intelier-01.jpg", "/projects/golf-links/condor-golf-links18-photo-by-intelier-02.jpg", "/projects/golf-links/condor-golf-links18-photo-by-intelier-03.jpg", "/projects/golf-links/condor-golf-links18-photo-by-intelier-04.jpg", "/projects/golf-links/condor-golf-links18-photo-by-intelier-05.jpg", "/projects/golf-links/condor-golf-links18-photo-by-intelier-06.jpg", "/projects/golf-links/condor-golf-links18-photo-by-intelier-07.jpg", "/projects/golf-links/condor-golf-links18-photo-by-intelier-08.jpg", "/projects/golf-links/condor-golf-links18-photo-by-intelier-16.jpg", "/projects/golf-links/condor-golf-links18-photo-by-intelier-24.jpg", "/projects/golf-links/condor-golf-links18-photo-by-intelier-25.jpg", "/projects/golf-links/condor-golf-links18-photo-by-intelier-31.jpg", "/projects/golf-links/condor-golf-links18-photo-by-intelier-32.jpg", "/projects/golf-links/condor-golf-links18-photo-by-intelier-33.jpg"],
    palette: ["walnut", "lacquer", "brass"],
    sample: true,
  },
  {
    slug: "Poppy_11",
    name: "Poppy 11",
    sector: "Residences",
    city: "Pebble Beach",
    country: "USA",
    year: 2025,
    summary:
      "A modern coastal residence: a kitchen of floor-to-ceiling dark wood-grain tall units around a charcoal island, dark wood wardrobe walls with tinted-glass doors in the primary suite, matching sliding panels, and floating vanities beneath backlit mirrors.",
    scope: ["Kitchen and island", "Primary closet", "Bathroom vanities", "Wall panels and sliders"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
    durationWeeks: 16,
    images: ["/projects/Poppy_11/poppy11-08.jpg", "/projects/Poppy_11/poppy11-10.jpg", "/projects/Poppy_11/poppy11-01.jpg", "/projects/Poppy_11/poppy11-03.jpg", "/projects/Poppy_11/poppy11-05.jpg", "/projects/Poppy_11/poppy11-07.jpg", "/projects/Poppy_11/poppy11-12.jpg", "/projects/Poppy_11/poppy11-13.jpg", "/projects/Poppy_11/poppy11-15.jpg", "/projects/Poppy_11/poppy11-17.jpg", "/projects/Poppy_11/poppy11-19.jpg", "/projects/Poppy_11/poppy11-23.jpg"],
    palette: ["oak", "linen", "lacquer"],
    sample: true,
  },
  {
    slug: "Estacada",
    name: "Estacada",
    sector: "Residences",
    city: "Los Altos Hills",
    country: "USA",
    year: 2024,
    summary:
      "Light, calm millwork through a single-storey home: a pale wood kitchen wall with integrated appliances and open shelving, white perimeter cabinets around a waterfall island, arched-panel wardrobes with sculpted pulls, light wood vanities, and a child's room wall of lit shelving with blue flower-cutout doors.",
    scope: ["Kitchen and island", "Pantry shelving", "Vanities", "Wardrobes", "Bedroom built-ins"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
    durationWeeks: 16,
    images: ["/projects/Estacada/estacada-01.jpg", "/projects/Estacada/estacada-02.jpg", "/projects/Estacada/estacada-03.jpg", "/projects/Estacada/estacada-05.jpg", "/projects/Estacada/estacada-08.jpg", "/projects/Estacada/estacada-09.jpg", "/projects/Estacada/estacada-10.jpg"],
    palette: ["oak", "linen", "lacquer"],
    sample: true,
  },
];

export const sectors = ["Residences", "Office", "Multifamily", "Hospitality"] as const;

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}
