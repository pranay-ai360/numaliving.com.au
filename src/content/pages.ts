/**
 * Copy for every public page. Edit the words here; the page layouts
 * read from this file. Numbers and claims marked SAMPLE are
 * placeholders and must be replaced with real figures.
 */

export const home = {
  heroTitle: "Woodwork, Mastered",
  heroSub: "Australia · India · Qatar · UAE · UK · USA",
  intro:
    "Numa Living crafts details that defines a room: panelled walls, kitchens, wardrobes, doors and statement pieces, engineered in-house and installed anywhere in the world.",
  // SAMPLE figures
  stats: [
    { value: "120+", label: "Projects delivered" },
    { value: "14", label: "Countries shipped to" },
    { value: "18,000 m²", label: "Factory floor" },
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
      text: "Repeatable, high-finish packages for hundreds of units, on programme.",
    },
  ],
};

export const about = {
  title: "From Dubai to the World",
  lead:
    "Numa Living is the millwork arm of the Conqueror Group, a family enterprise with decades of experience in contracting, development and hospitality across the world. We craft your dream finishes in Dubai and deliver it around the world.",
  body: [
    "We started Numa because the projects we built as developers needed joinery we could not buy: precise, beautifully finished and delivered on the contractor's programme, not the workshop's.",
    "Today we work directly with owners, architects and main contractors. Our engineers turn design intent into shop drawings, our factory produces to millimetre tolerances, and our site teams install and hand over.",
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
      items: ["Veneer wall panelling", "Fluted and slatted panels", "Acoustic panels", "Ceiling features"],
    },
    {
      name: "Kitchens & Wardrobes",
      items: ["Bespoke kitchens", "Walk-in wardrobes", "Dressing rooms", "Vanities"],
    },
    {
      name: "Doors & Openings",
      items: ["Flush and panelled doors", "Concealed doors", "Fire-rated doors", "Architraves and frames"],
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
      items: ["Natural veneers", "High-gloss and matt lacquer", "Solid surface", "Metal, stone and glass inlays"],
    },
  ],
};

export const factory = {
  title: "The Factory",
  lead: "One roof, from raw board to export crate. Owning every stage is how we control quality and programme.",
  // SAMPLE figures — replace with real ones
  facts: [
    { value: "18,000 m²", label: "Production floor" },
    { value: "6", label: "CNC machining centres" },
    { value: "4", label: "Pressurised spray booths" },
    { value: "2,500 m²", label: "Monthly panel output" },
  ],
  zones: [
    { name: "Engineering", text: "Shop drawings, cutting lists and CNC programmes produced from your approved design." },
    { name: "Machining", text: "Nested-based CNC, panel saws and edgebanders for repeatable precision." },
    { name: "Veneer", text: "Veneer selection, bookmatching and pressing, with flitches reserved per project." },
    { name: "Finishing", text: "Dust-controlled spray booths for lacquer and oil finishes, colour-matched to approved samples." },
    { name: "Assembly & QC", text: "Pre-assembly and dry-fitting, checked against drawings before anything is packed." },
    { name: "Export Packing", text: "Crated, labelled by room and sequence, ready for container or air freight." },
  ],
};

/**
 * The 8 steps on the Process page and in its diagram.
 * `phase` groups steps under a heading (keep each phase's steps next to each other).
 * `icon` picks the drawing; choose from: enquiry, responsibilities, drawings,
 * samples, production, quality, shipping, handover.
 */
export const process = {
  title: "How We Work",
  lead: "A clear path from first conversation to handover. Once a project starts, every step is tracked in your client portal.",
  steps: [
    { phase: "Brief", icon: "enquiry", name: "Enquiry & Tender", text: "Send drawings, a BOQ or even a scanned sketch (PDF). We review scope and return a priced proposal." },
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
    { name: "Middle East", countries: ["UAE", "Qatar"] },
    { name: "Austalia & Asia", countries: ["Australia", "India"] },
    { name: "Europe", countries: ["United Kingdom"] },
    { name: "North America", countries: ["United States"] },
  ],
  points: [
    { name: "Export packing", text: "Moisture-protected, crated and labelled by room and install sequence." },
    { name: "Freight", text: "Sea and air freight through established logistics partners, with tracking shared online." },
    { name: "Installation", text: "Our own installers, or supervision of your local team, wherever the site is." },
    { name: "After care", text: "Spare parts, touch-up kits and a defects period on every project." },
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
  { src: "", material: "oak", alt: "Fluted oak panelling detail", caption: "Fluted oak" },
  { src: "", material: "brass", alt: "Brass inlay detail in a joinery piece", caption: "Brass inlay" },
  { src: "", material: "lacquer", alt: "Hand-finished lacquer door", caption: "Hand-finished lacquer" },
  { src: "", material: "walnut", alt: "Craftsperson finishing a joint by hand", caption: "Joints you never see" },
];

/** One wide photo of the factory floor, shown above the factory section. */
export const factoryPhoto = { src: "", material: "oak", alt: "Numa Living factory floor, Dubai", caption: "The factory floor, Dubai" };
