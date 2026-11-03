import type { ShowcaseProject } from "@/lib/types";

/** The golf-links photos were credited in their old file names ("photo-by-intelier"); kept here so the credit survives the renaming. */
const GOLF_LINKS_CREDIT = "Photo by Intelier";

/**
 * Showcase projects for the Projects page and home page.
 *
 * SAMPLE CONTENT — the entries marked sample: true are invented. The five US projects (sample: false) are
 * Numa's own work, with photos it may publish, as the owner confirmed on 30 October 2026.
 * To add a real project: copy one block, change the text, put the photos in
 * /public/projects/<slug>/ and list them in `photos`, the cover first.
 * Name each photo file <slug>-<nn>.jpg, in lowercase with hyphens and no spaces (for example
 * public/projects/marina-villa/marina-villa-01.jpg): the site is hosted on a case-sensitive server, and spaces
 * would need URL-encoding. Then run `npm run images:build`: it makes the fast AVIF and WebP copies the pages
 * load, and the 1200 x 630 share image public/og/<slug>.jpg from the first photo.
 * Give every photo a description of its own in `alt` (8 to 20 words that say what the picture shows) and its
 * size in pixels. Keep each path starting with "/"; the site adds its base path when it shows the photo.
 * Use a lowercase, hyphenated slug (poppy-16, not Poppy_16): it becomes the page address.
 * Resize photos first: no file may be over 1.5 MB (e2e/image-files.spec.ts fails above that).
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
      "Interior millwork for a beachfront villa: a backlit display wall framed by fluted panels, pale cabinetry picked out with fine metallic trims, floating vanities with concealed lighting, and a curved console on a metallic plinth.",
    scope: ["Feature display wall", "Built-in cabinetry", "Vanities", "Display niches", "Wall paneling"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
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
    slug: "amherst",
    name: "Amherst Ct",
    sector: "Residences",
    city: "Los Altos Hills",
    country: "USA",
    year: 2023,
    summary:
      "Whole-house millwork in light natural wood tones: a kitchen with fluted-glass upper cabinets and integrated appliance panels, a built-in window unit, closets and vanities with reeded lower panels, lit floating shelves at the bar, and a sage-green laundry.",
    scope: ["Kitchen and island", "Window seat", "Bar shelving", "Vanities", "Closets", "Laundry"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
    durationWeeks: 16,
    photos: [
      { src: "/projects/amherst/amherst-01.jpg", alt: "Kitchen with a long marble island, light wood cabinets, glass-fronted upper units and two glass pendant lights", width: 1600, height: 1069 },
      { src: "/projects/amherst/amherst-02.jpg", alt: "Floor-to-ceiling light oak closet doors with reeded lower panels beside a window and a built-in drawer unit", width: 1600, height: 1069 },
      { src: "/projects/amherst/amherst-03.jpg", alt: "Tall oak closet doors and a drawer unit by a window, with a lit shelving niche leading to a bathroom", width: 1600, height: 2395 },
      { src: "/projects/amherst/amherst-04.jpg", alt: "Bathroom with a white stone vanity top on reeded oak drawers, two black-framed mirrors and a closet doorway", width: 1600, height: 1069 },
      { src: "/projects/amherst/amherst-05.jpg", alt: "Oak vanity drawers under black-framed mirrors, with a freestanding tub in the marble bathroom and a louvered door", width: 1600, height: 1069 },
      { src: "/projects/amherst/amherst-06.jpg", alt: "Wet bar niche with two lit oak shelves above a small sink and oak cabinet doors", width: 1600, height: 2397 },
      { src: "/projects/amherst/amherst-07.jpg", alt: "Laundry room with a washer and dryer under open cubbies, sage green cabinets and a star-patterned tile floor", width: 1600, height: 2395 },
      { src: "/projects/amherst/amherst-08.jpg", alt: "Open living area with a long oak window bench in front of a big window and the kitchen island beyond", width: 1600, height: 1069 },
      { src: "/projects/amherst/amherst-09.jpg", alt: "Kitchen seen from the end of the marble island, with glass pendants, wall ovens and light wood cabinets", width: 1600, height: 1068 },
      { src: "/projects/amherst/amherst-10.jpg", alt: "Entry hall with a tiered brass chandelier, a few wide steps and a geometric gray and white tile floor", width: 1600, height: 2396 },
      { src: "/projects/amherst/amherst-11.jpg", alt: "Stair landing with a cascading pendant chandelier, a cable railing and a triangle-patterned tile floor", width: 1600, height: 2395 },
    ],
    palette: ["oak", "linen", "lacquer"],
    sample: false,
  },
  {
    slug: "sonate",
    name: "Luxury Apartments, Dubai Sports City",
    sector: "Multifamily",
    city: "Dubai",
    country: "UAE",
    year: 2026,
    summary:
      "Kitchens and bathroom millwork for luxury apartments: handleless kitchens pairing cream upper cabinets with horizontal wood-grain bases, under-cabinet and plinth lighting, and floating vanities beside lit niches with slim black shelves.",
    scope: ["Kitchens", "Bathroom vanities", "Lit shelving niches", "Full-height paneling"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
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
    slug: "poppy-16",
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
    photos: [
      { src: "/projects/poppy-16/poppy-16-01.jpg", alt: "Oak kitchen island with a stone top under three round paper pendant lights, open to the living area", width: 1600, height: 1067 },
      { src: "/projects/poppy-16/poppy-16-02.jpg", alt: "Freestanding tub before a frosted window and green stone tile, beside a stone-topped oak vanity with orchids", width: 1600, height: 1069 },
      { src: "/projects/poppy-16/poppy-16-03.jpg", alt: "Laundry room with a washer and dryer, open oak shelving with plants, and oak drawers under a white counter", width: 1600, height: 1068 },
      { src: "/projects/poppy-16/poppy-16-04.jpg", alt: "Lounge with pale armchairs and ottomans around a white stone coffee table, a large abstract artwork and two doors", width: 1600, height: 1069 },
      { src: "/projects/poppy-16/poppy-16-05.jpg", alt: "Floor-to-ceiling oak panel doors beside a stone-topped drawer island, with the bathroom and tub visible through a doorway", width: 1600, height: 1069 },
      { src: "/projects/poppy-16/poppy-16-06.jpg", alt: "Double oak vanity with a stone top, a backlit mirror and an orchid beside a tall oak closet door", width: 1600, height: 1068 },
      { src: "/projects/poppy-16/poppy-16-07.jpg", alt: "Kitchen wall of tall oak cabinets and a stone backsplash, with a tiled-base island, stools and three paper pendants", width: 1600, height: 1067 },
      { src: "/projects/poppy-16/poppy-16-08.jpg", alt: "Long island with tiled base and wood stools beside a glass dining table with white chairs, under round pendants", width: 1600, height: 1067 },
      { src: "/projects/poppy-16/poppy-16-09.jpg", alt: "Living area with a linear fireplace, round mirror, two gray armchairs and an ottoman, with dining table behind", width: 1600, height: 1067 },
      { src: "/projects/poppy-16/poppy-16-10.jpg", alt: "Bedroom with an oak closet wall, a bed in white linens and sliding glass doors opening to a balcony", width: 1600, height: 1067 },
      { src: "/projects/poppy-16/poppy-16-11.jpg", alt: "Powder room with a floating oak vanity, a white vessel sink, a tall black-framed mirror and two wall sconces", width: 1600, height: 2399 },
      { src: "/projects/poppy-16/poppy-16-12.jpg", alt: "Shower with pale tile and a niche beside a wall-hung toilet and a floating oak vanity with white sink", width: 1600, height: 2399 },
      { src: "/projects/poppy-16/poppy-16-13.jpg", alt: "Wide view of the bathroom with a freestanding tub, glass-walled shower, rug and a long oak vanity at right", width: 1600, height: 1067 },
      { src: "/projects/poppy-16/poppy-16-14.jpg", alt: "Oak double vanity under a rounded backlit mirror, with a closet wall of tall cabinets and a wood door beyond", width: 1600, height: 1067 },
      { src: "/projects/poppy-16/poppy-16-15.jpg", alt: "Pantry corner with open oak shelves holding bowls and small plants above a white counter and deep oak drawers", width: 1600, height: 1067 },
    ],
    palette: ["oak", "linen", "lacquer"],
    sample: false,
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
    slug: "sandy",
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
    photos: [
      { src: "/projects/sandy/sandy-01.jpg", alt: "Bathroom with a walnut floating vanity, two white vessel sinks, a freestanding tub and glass doors to a terrace", width: 1600, height: 1069 },
      { src: "/projects/sandy/sandy-02.jpg", alt: "Kitchen of dark wood-grain tall cabinets under a steel hood, with a two-level island and white bar stools", width: 1600, height: 1067 },
      { src: "/projects/sandy/sandy-03.jpg", alt: "Black-framed windows behind a two-level island with striped cushioned stools and slim pendant lights", width: 1600, height: 2400 },
      { src: "/projects/sandy/sandy-04.jpg", alt: "Dark wood-grain island with a white stone top before a tall black-framed window and a sink beyond", width: 1600, height: 2400 },
      { src: "/projects/sandy/sandy-05.jpg", alt: "Floating walnut vanity with a dark stone top and white vessel sink, a wide mirror and a marble shower", width: 1600, height: 1069 },
      { src: "/projects/sandy/sandy-06.jpg", alt: "Home office with a waterfall walnut desk, steel-framed shelving, wood cabinets and a deep teal wall", width: 1600, height: 1069 },
      { src: "/projects/sandy/sandy-07.jpg", alt: "Dark wood-grain tall cabinets with a wine fridge and a steel hood above a lower island, beside a tall window", width: 1600, height: 2400 },
      { src: "/projects/sandy/sandy-08.jpg", alt: "Wider view of the dark kitchen, with built-in ovens, a skylight, a black-framed window and the island stools", width: 1600, height: 1067 },
      { src: "/projects/sandy/sandy-09.jpg", alt: "Freestanding tub on a wood deck floor before a glass wall, with walnut slat paneling and a dark stone vanity", width: 1600, height: 1069 },
      { src: "/projects/sandy/sandy-10.jpg", alt: "Game room with a pool table, a board-formed concrete wall, floating wood stairs, a long sofa and plants", width: 1600, height: 1069 },
      { src: "/projects/sandy/sandy-11.jpg", alt: "Home bar and card room with lit shelves of bottles, a round game table, wine racks and blue ceiling lighting", width: 1600, height: 1069 },
    ],
    palette: ["oak", "linen", "lacquer"],
    sample: false,
  },
  {
    slug: "golf-links",
    name: "High-end Multifamily Residences",
    sector: "Multifamily",
    city: "Sports City",
    country: "UAE",
    year: 2026,
    summary:
      "Lobby and apartment millwork for a residential tower: a reception desk on a lit plinth, light timber-look wall paneling through the lobby and lounge, handleless kitchens and full-height closets in the apartments, and dark wood-grain vanities and gym shelving with concealed lighting.",
    scope: ["Reception desk", "Lobby wall paneling", "Kitchens", "Closets", "Vanities", "Gym shelving"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
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
    slug: "poppy-11",
    name: "Poppy 11",
    sector: "Residences",
    city: "Pebble Beach",
    country: "USA",
    year: 2025,
    summary:
      "A modern coastal residence: a kitchen of floor-to-ceiling dark wood-grain tall units around a charcoal island, dark wood closet walls with tinted-glass doors in the primary suite, matching sliding panels, and floating vanities beneath backlit mirrors.",
    scope: ["Kitchen and island", "Primary closet", "Bathroom vanities", "Wall panels and sliders"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
    durationWeeks: 16,
    photos: [
      { src: "/projects/poppy-11/poppy-11-01.jpg", alt: "Kitchen with walnut tall cabinets, a dark steel hood and a stone island on a slate-blue base", width: 1600, height: 1068 },
      { src: "/projects/poppy-11/poppy-11-02.jpg", alt: "Bedroom with a tufted headboard bed under a ring pendant, beside walnut shelving and a gray upholstered chair", width: 1600, height: 1068 },
      { src: "/projects/poppy-11/poppy-11-03.jpg", alt: "Single-story house at dusk with glass walls lit from within, a reflecting pool and a stone terrace", width: 1600, height: 1068 },
      { src: "/projects/poppy-11/poppy-11-04.jpg", alt: "Long gallery hallway with a large abstract artwork, sculptural wood consoles, a potted plant and wide oak floors", width: 1600, height: 1068 },
      { src: "/projects/poppy-11/poppy-11-05.jpg", alt: "Living room sofa in the foreground, with a walnut kitchen and steel hood seen through sliding glass doors", width: 1600, height: 1068 },
      { src: "/projects/poppy-11/poppy-11-06.jpg", alt: "Stone-topped kitchen island with a cooktop and dark base, open to a living room and a pine view", width: 1600, height: 1068 },
      { src: "/projects/poppy-11/poppy-11-07.jpg", alt: "Freestanding tub beside a tall corner window framing a green fairway and pine trees", width: 1600, height: 2398 },
      { src: "/projects/poppy-11/poppy-11-08.jpg", alt: "Sitting room with a cream sofa, a round coffee table, two black chairs, a skylight and a large artwork", width: 1600, height: 1068 },
      { src: "/projects/poppy-11/poppy-11-09.jpg", alt: "Bed with a tall white headboard between slim black sconces, with a walnut closet wall and a bench", width: 1600, height: 1068 },
      { src: "/projects/poppy-11/poppy-11-10.jpg", alt: "Long stone vanity on walnut drawers under a large backlit mirror, with an orchid and a dark faucet", width: 1600, height: 1068 },
      { src: "/projects/poppy-11/poppy-11-11.jpg", alt: "Dining nook with a lit glass wine wall, a dark rack wall, a white oval table and a cowhide rug", width: 1600, height: 1068 },
      { src: "/projects/poppy-11/poppy-11-12.jpg", alt: "Long hallway with a potted plant, sculptural wood consoles and large artworks, leading to the kitchen", width: 1600, height: 1068 },
    ],
    palette: ["oak", "linen", "lacquer"],
    sample: false,
  },
  {
    slug: "estacada",
    name: "Estacada",
    sector: "Residences",
    city: "Los Altos Hills",
    country: "USA",
    year: 2024,
    summary:
      "Light, calm millwork through a single-story home: a pale wood kitchen wall with integrated appliances and open shelving, white perimeter cabinets around a waterfall island, arched-panel closets with sculpted pulls, light wood vanities, and a child's room wall of lit shelving with blue flower-cutout doors.",
    scope: ["Kitchen and island", "Pantry shelving", "Vanities", "Closets", "Bedroom built-ins"],
    materials: ["Wood veneer", "Laminate", "Paint and lacquer"],
    durationWeeks: 16,
    photos: [
      { src: "/projects/estacada/estacada-01.jpg", alt: "Kitchen with a waterfall marble island, light oak tall cabinets, a white range hood and three white pendant lights", width: 1600, height: 1069 },
      { src: "/projects/estacada/estacada-02.jpg", alt: "Marble waterfall island with oak panel doors, a white hood, open shelving and skylights above the kitchen", width: 1600, height: 1069 },
      { src: "/projects/estacada/estacada-03.jpg", alt: "Narrow pantry nook with lit white shelves holding baskets, beside a dark walnut bookcase", width: 1600, height: 2396 },
      { src: "/projects/estacada/estacada-04.jpg", alt: "Pale oak double vanity with brass pulls, a marble top and two tall mirrors with wall sconces", width: 1600, height: 2395 },
      { src: "/projects/estacada/estacada-05.jpg", alt: "Bedroom with floor-to-ceiling white closet doors and scalloped brass handles, and a doorway to the dressing area", width: 1600, height: 1069 },
      { src: "/projects/estacada/estacada-06.jpg", alt: "Built-in oak bookcase with lit shelves, a storage bench, and blue drawers with flower-shaped cutouts", width: 1600, height: 1069 },
      { src: "/projects/estacada/estacada-07.jpg", alt: "Powder room with a floating pale oak vanity, brass fixtures, a wavy-edged gold mirror and a wall-hung toilet", width: 1600, height: 2396 },
    ],
    palette: ["oak", "linen", "lacquer"],
    sample: false,
  },
];

export const sectors = ["Residences", "Office", "Multifamily", "Hospitality"] as const;

export function getProject(slug: string) {
  return projects.find((p) => p.slug === slug);
}
