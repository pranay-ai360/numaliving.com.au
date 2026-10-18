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
    { value: "120+", label: "Projects delivered" },
    { value: "14", label: "Countries shipped to" },
    { value: "194,000 sq ft (18,000 m²)", label: "Factory floor" },
    { value: "250", label: "Craftspeople and engineers" },
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
    { name: "Precision", text: "CNC-driven production from approved shop drawings, checked at every stage." },
    { name: "Transparency", text: "Every client sees their drawings, approvals and production status online." },
    { name: "Reach", text: "Export-packed, shipped and installed wherever the project is." },
  ],
  // TODO(Ramya): add certifications once confirmed
  certifications: ["ISO 9001 (to be confirmed)", "FSC chain of custody (to be confirmed)"],
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
  // SAMPLE figures — replace with real ones
  facts: [
    { value: "194,000 sq ft (18,000 m²)", label: "Production floor" },
    { value: "6", label: "CNC machining centers" },
    { value: "4", label: "Pressurized spray booths" },
    { value: "27,000 sq ft (2,500 m²)", label: "Monthly panel output" },
  ],
  zones: [
    { name: "Engineering", text: "Shop drawings, cutting lists and CNC programs produced from your approved design." },
    { name: "Machining", text: "Nested-based CNC, panel saws and edgebanders for repeatable precision." },
    { name: "Veneer", text: "Veneer selection, bookmatching and pressing, with flitches reserved per project." },
    { name: "Finishing", text: "Dust-controlled spray booths for lacquer and oil finishes, color-matched to approved samples." },
    { name: "Assembly & QC", text: "Pre-assembly and dry-fitting, checked against drawings before anything is packed." },
    { name: "Export Packing", text: "Crated, labelled by room and sequence, ready for container or air freight." },
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
  lead: "A clear path from first conversation to handover. Once a project starts, every step is tracked in your client portal.",
  steps: [
    { phase: "Brief", icon: "inquiry", name: "Inquiry & Bid", text: "Send drawings, a quantity takeoff or even a scanned sketch (PDF). We review scope and return a priced proposal." },
    { phase: "Brief", icon: "responsibilities", name: "Responsibilities", text: "At kick-off we agree who on your team uploads drawings, approves samples and signs off quotes." },
    { phase: "Approve", icon: "drawings", name: "Shop Drawings", text: "Our engineers issue shop drawings for review. They are revised until approved." },
    { phase: "Approve", icon: "samples", name: "Samples & Mock-ups", text: "Finishes, veneers and hardware are sampled and approved before production." },
    { phase: "Make", icon: "production", name: "Production", text: "Items move through machining, assembly and finishing, with photos at each stage." },
    { phase: "Make", icon: "quality", name: "Quality Control", text: "Every piece is checked and dry-fitted against approved drawings." },
    { phase: "Deliver", icon: "shipping", name: "Packing & Shipping", text: "Export-crated and shipped, with container and tracking details shared online." },
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
    { name: "Australia & Asia", countries: ["Australia", "India"] },
    { name: "Europe", countries: ["United Kingdom"] },
  ],
  points: [
    { name: "Export packing", text: "Moisture-protected, crated and labelled by room and install sequence." },
    { name: "Freight", text: "Sea and air freight through established logistics partners, with tracking shared online." },
    { name: "Installation", text: "Our own installers, or supervision of your local team, wherever the site is." },
    { name: "After care", text: "Spare parts, touch-up kits and a warranty period on every project." },
  ],
};

/**
 * Photos for the craft gallery on the Capabilities page.
 * To use a real photo: put it in /public/craft/ and set src, e.g. "/craft/veneer-panel.jpg".
 * While src is "", a wood-tone placeholder shows instead.
 * The first photo is shown large. `material` only picks the placeholder colour:
 * walnut, oak, lacquer, stone, brass or linen.
 */
export const craft = [
  { src: "", material: "walnut", alt: "Bookmatched walnut veneer wall panel", caption: "Bookmatched veneer" },
  { src: "", material: "oak", alt: "Fluted oak paneling detail", caption: "Fluted oak" },
  { src: "", material: "brass", alt: "Brass inlay detail in a millwork piece", caption: "Brass inlay" },
  { src: "", material: "lacquer", alt: "Hand-finished lacquer door", caption: "Hand-finished lacquer" },
  { src: "", material: "walnut", alt: "Craftsperson finishing a joint by hand", caption: "Joints you never see" },
];

/** One wide photo of the factory floor, shown above the factory section. */
export const factoryPhoto = { src: "", material: "oak", alt: "Numa Living factory floor, Dubai", caption: "The factory floor, Dubai" };

/** A figure or list that is still invented: `id` is its place in the content (such as "home.stats"), `where` says what to edit. */
export type SampleContent = Readonly<{ id: string; where: string }>;

/**
 * The invented figures and lists the pages still show. While any is listed here the launch guard
 * (src/config/launchGuard.test.ts) refuses to let the site be indexed. To clear an entry: replace the
 * figures with real ones in the file named, then delete the entry. src/content/pages.test.ts checks that
 * every id still leads to content, so a rename cannot leave an entry that blocks nothing.
 */
export const sampleContent: readonly SampleContent[] = [
  { id: "home.stats", where: "src/content/pages.ts: home.stats (projects delivered, countries, factory floor, staff)" },
  { id: "factory.facts", where: "src/content/pages.ts: factory.facts (production floor, machines, spray booths, monthly output)" },
  { id: "delivery.regions", where: "src/content/pages.ts: delivery.regions (the destinations listed on the About page)" },
  { id: "about.certifications", where: "src/content/pages.ts: about.certifications (ISO 9001 and FSC, both still to be confirmed)" },
  { id: "locations.destinations", where: "src/content/locations.ts: destinations (the places on the About page map)" },
];

