/**
 * Copy for every public page. Edit the words here; the page layouts
 * read from this file. Numbers and claims marked SAMPLE are
 * placeholders and must be replaced with real figures. Each of them is also
 * listed in `sampleContent` at the bottom of this file, which keeps the site out
 * of search engines (src/config/launchGuard.test.ts) until it is replaced and delisted.
 */
import { projects } from "@/content/projects";
import type { ShowcasePhoto } from "@/lib/types";

/**
 * A photo already in the sample projects, found by its file (src/content/projects.ts holds its
 * description and size). Stops the build with a plain message if the photo is replaced, so the home
 * page never keeps a picture that is gone.
 */
function projectPhoto(src: string): ShowcasePhoto {
  const photo = projects.flatMap((project) => project.photos).find((candidate) => candidate.src === src);
  if (photo === undefined) {
    throw new Error(`The home page photo ${src} is not in src/content/projects.ts. Choose another photo for home.heroPhoto in src/content/pages.ts.`);
  }
  return photo;
}

export const home = {
  // The first screen says what Numa makes, where it is made and who it is for. It states what the
  // factory can do ("Shipped to US job sites"), not a record of projects delivered: the delivery
  // list further down is sample content. The photo must show no other company's logo (the Sonate
  // and Golf Links photos do).
  eyebrow: "Architectural millwork and FF&E",
  heroTitle: ["Custom millwork,", "engineered in Dubai.", "Built for US projects."] as const,
  heroSub: "Made in our Dubai factory. Shipped to US job sites.",
  heroAudience: "For US architects, designers, general contractors and developers. Send your drawings and we return a priced proposal.",
  heroPhoto: projectPhoto("/projects/penthouse25/penthouse25-02.jpg"),
  intro:
    "Numa Living crafts details that define a room: paneled walls, kitchens, closets, doors and statement pieces, engineered in-house and installed anywhere in the world.",
  // SAMPLE figures
  stats: [
    { value: "45+", label: "Projects delivered" },
    { value: "4", label: "Countries shipped to" },
    { value: "8,000 sq ft", label: "Factory floor" },
    { value: "50", label: "Craftspeople and engineers" },
  ],
  sectors: [
    {
      name: "Luxury Residences",
      text: "Villas, penthouses and private homes where every surface is bespoke.",
    },
    {
      name: "Premium Workplaces",
      text: "Headquarters, family offices and executive floors that carry a brand.",
    },
    {
      name: "Multifamily",
      text: "Repeatable, high-finish packages for hundreds of units, on schedule.",
    },
  ],
};

export const about = {
  title: "From Dubai to the World",
  lead:
    "Numa Living is the millwork arm of the Conqueror Group, a family enterprise with decades of experience in contracting, development and hospitality across the world. We craft your dream finishes in Dubai and deliver them around the world.",
  body: [
    "We started Numa because the projects we built as developers needed millwork we could not buy: precise, beautifully finished and delivered on the contractor's schedule, not the workshop's.",
    "Today we work directly with owners, architects and general contractors. Our engineers turn design intent into shop drawings, our factory produces to millimeter tolerances, and our site teams install and hand over.",
  ],
  values: [
    { name: "Craft", text: "Bookmatched veneers, hand-finished lacquer and joints you will never see." },
    { name: "Precision", text: "Production from approved shop drawings, checked at every stage." },
    { name: "Transparency", text: "Clients will see their drawings, approvals and production status online once the client portal opens." },
    { name: "Reach", text: "Export-packed, shipped and installed wherever the project is." },
  ],
};

export const capabilities = {
  title: "Capabilities",
  lead: "Everything made of wood, veneer and lacquer in a premium interior, and the stone, metal and glass that meet it.",
  groups: [
    {
      name: "Wall & Ceiling",
      items: ["Veneer wall paneling", "Fluted and slatted panels", "Acoustic panels", "Ceiling features"],
    },
    {
      name: "Kitchens & Closets",
      items: ["Custom kitchens", "Walk-in closets", "Dressing rooms", "Vanities"],
    },
    {
      name: "Doors & Openings",
      items: ["Flush and paneled doors", "Concealed doors", "Fire-rated doors", "Door casing and frames"],
    },
    {
      name: "Statement Pieces",
      items: ["Reception desks", "Bars and counters", "Libraries and media walls", "Stair cladding"],
    },
    {
      name: "Loose Furniture (FF&E)",
      items: ["Tables", "Beds and headboards", "Cabinets and consoles", "Custom upholstery frames"],
    },
    {
      name: "Finishes & Integration",
      items: ["Natural veneers", "High-gloss and matte lacquer", "Solid surface", "Metal, stone and glass inlays"],
    },
  ],
};

export const factory = {
  title: "The Factory",
  lead: "One roof, from raw board to export crate. Owning every stage is how we control quality and schedule.",
  /** One wide photo of the factory floor, shown above the factory section. */
  photo: { src: "/craft/factory-jointer.jpg", material: "oak", alt: "Craftsmen straightening timber on the jointer, Numa Living factory, Dubai", caption: "The factory floor, Dubai", width: 1448, height: 633 },
  zones: [
    { name: "Engineering", text: "Shop drawings and cutting lists produced from your approved design." },
    { name: "Machining", text: "Panel saws, edgebanders and boring machines for repeatable precision." },
    { name: "Veneer", text: "Veneer selection, laying and hot pressing onto panels." },
    { name: "Finishing", text: "Spray booths for lacquer and paint finishes, matched to approved samples." },
    { name: "Assembly & QC", text: "Pre-assembly and dry-fitting, checked against drawings before anything is packed." },
    { name: "Export Packing", text: "Crated, labeled by room and sequence, ready for container shipping." },
  ],
};

/**
 * The 8 steps on the Process page and in its diagram.
 * `phase` groups steps under a heading (keep each phase's steps next to each other).
 * `icon` picks the drawing; choose from: inquiry, responsibilities, drawings,
 * samples, production, quality, shipping, handover.
 */
export const process = {
  title: "How We Work",
  lead: "A clear path from first conversation to handover. The client portal, which opens soon, will track every step.",
  steps: [
    { phase: "Brief", icon: "inquiry", name: "Inquiry & Bid", text: "Send drawings, a quantity takeoff or even a scanned sketch (PDF). We review scope and return a priced proposal." },
    { phase: "Brief", icon: "responsibilities", name: "Responsibilities", text: "At kick-off we agree who on your team uploads drawings, approves samples and signs off quotes." },
    { phase: "Approve", icon: "drawings", name: "Shop Drawings", text: "Our engineers issue shop drawings for review. They are revised until approved." },
    { phase: "Approve", icon: "samples", name: "Samples & Mock-ups", text: "Finishes, veneers and hardware are sampled and approved before production." },
    { phase: "Make", icon: "production", name: "Production", text: "Items move through machining, assembly and finishing, with photos at each stage." },
    { phase: "Make", icon: "quality", name: "Quality Control", text: "Every piece is checked and dry-fitted against approved drawings." },
    { phase: "Deliver", icon: "shipping", name: "Packing & Shipping", text: "Export-crated and shipped, with container and tracking details shared with your team." },
    { phase: "Deliver", icon: "handover", name: "Installation & Handover", text: "We provide 24/7 support to your local install team until installation is complete." },
  ],
};

export const delivery = {
  title: "Door to Site",
  lead: "Made in our factory, delivered to your site. We handle export packing, freight and installation.",
  // SAMPLE list — replace with real destinations
  regions: [
    { name: "North America", countries: ["United States"] },
    { name: "Middle East", countries: ["UAE", "Qatar"] },
    { name: "Asia", countries: ["India"] },
  ],
  points: [
    { name: "Export packing", text: "Moisture-protected, crated and labeled by room and install sequence." },
    { name: "Freight", text: "Sea freight through established logistics partners, with tracking shared with you." },
    { name: "Installation", text: "Our own installers, or supervision of your local team, wherever the site is." },
    { name: "After care", text: "Spare parts, touch-up kits and a warranty period on every project." },
  ],
};

/**
 * Photos for the craft gallery on the Capabilities page, from the owner team's update.
 * While src is "", a wood-tone placeholder shows instead. The first photo is shown large. `material` only
 * picks the placeholder colour: walnut, oak, lacquer, stone, brass or linen.
 *
 * These files sit in /public/craft/, in lower case with hyphens. `npm run images:build` makes their AVIF and
 * WebP copies next to them (README, Photos) and `Photo` shows them with their `width` and `height`; each
 * description is 8 to 20 words, and src/content/craftPhotos.test.ts checks all of it. `craft` stays listed in
 * `sampleContent` below, so the launch guard keeps the site out of search engines, because two of the five
 * are renders carrying another brand's watermark, not photos of the factory: replace them before launch.
 */
export const craft = [
  { src: "/craft/living-01-out-1400x788.jpg", material: "walnut", alt: "Render of a living room with a fluted wood-paneled wall, a marble TV panel and veneer cabinetry", caption: "Bookmatched veneer", width: 1400, height: 788 },
  { src: "/craft/veneer-laying.jpg", material: "oak", alt: "Craftsmen laying a veneer sheet onto a panel before hot pressing", caption: "Veneer laid by hand", width: 1086, height: 1086 },
  { src: "/craft/lobby-out-2-1400x788.jpg", material: "brass", alt: "Render of a lobby with a marble reception desk and wood-and-brass slatted wall panels", caption: "Brass inlay", width: 1400, height: 788 },
  { src: "/craft/lacquer-spray-booth.jpg", material: "lacquer", alt: "Finisher spraying lacquer onto a wood-veneer frame in the spray booth", caption: "Hand-finished lacquer", width: 1086, height: 1086 },
  { src: "/craft/edgebanding.jpg", material: "walnut", alt: "Machinist feeding a panel through the edgebanding machine", caption: "Joints you never see", width: 888, height: 888 },
];

/** A figure, list or photo that is still invented or missing: `id` is its place in the content (such as "home.stats"), `where` says what to edit. */
export type SampleContent = Readonly<{ id: string; where: string }>;

/**
 * The invented figures, lists and placeholder photos the pages still show. While any is listed here the launch guard
 * (src/config/launchGuard.test.ts) refuses to let the site be indexed. To clear an entry: replace the
 * figures (or put real photos in) in the file named, then delete the entry. src/content/pages.test.ts checks that
 * every id still leads to content, so a rename cannot leave an entry that blocks nothing.
 */
export const sampleContent: readonly SampleContent[] = [
  { id: "home.stats", where: "src/content/pages.ts: home.stats (projects delivered, countries, factory floor, staff)" },
  { id: "delivery.regions", where: "src/content/pages.ts: delivery.regions (the destinations listed on the About page)" },
  { id: "locations.destinations", where: "src/content/locations.ts: destinations (the places on the About page map)" },
  { id: "craft", where: "src/content/pages.ts: craft (two of the five Capabilities gallery photos, Bookmatched veneer and Brass inlay, are watermarked renders, not photos of the factory)" },
];

