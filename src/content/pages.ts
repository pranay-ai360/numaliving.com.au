/**
 * Copy for every public page. Edit the words here; the page layouts
 * read from this file. Numbers and claims marked SAMPLE are
 * placeholders and must be replaced with real figures.
 */

export const home = {
  heroTitle: "Millwork, Mastered",
  heroSub: "Dubai · India · Worldwide",
  intro:
    "Numa Living builds the joinery that defines a room: panelled walls, kitchens, wardrobes, doors and statement pieces, engineered in-house and installed anywhere in the world.",
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
  title: "About Numa Living",
  lead:
    "Numa Living is the millwork arm of the Condor Group, a family enterprise with decades of experience in contracting, development and hospitality across the UAE, India and Qatar.",
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

export const process = {
  title: "How We Work",
  lead: "A clear path from first conversation to handover. Once a project starts, every step is tracked in your client portal.",
  steps: [
    { name: "Enquiry & Tender", text: "Send drawings, a BOQ or even a hand sketch. We review scope and return a priced proposal." },
    { name: "Responsibilities", text: "At kick-off we agree who on your team uploads drawings, approves samples and signs off quotes." },
    { name: "Shop Drawings", text: "Our engineers issue shop drawings for review. They are revised until approved." },
    { name: "Samples & Mock-ups", text: "Finishes, veneers and hardware are sampled and approved before production." },
    { name: "Production", text: "Items move through machining, assembly and finishing, with photos at each stage." },
    { name: "Quality Control", text: "Every piece is checked and dry-fitted against approved drawings." },
    { name: "Packing & Shipping", text: "Export-crated and shipped, with container and tracking details shared online." },
    { name: "Installation & Handover", text: "Our team installs or supervises installation, then hands over." },
  ],
};

export const delivery = {
  title: "Global Delivery",
  lead: "Made in our factory, delivered to your site. We handle export packing, freight and installation.",
  // SAMPLE list — replace with real destinations
  regions: [
    { name: "Middle East", countries: ["UAE", "Qatar", "Saudi Arabia", "Oman", "Bahrain"] },
    { name: "South Asia", countries: ["India", "Sri Lanka", "Maldives"] },
    { name: "Europe", countries: ["United Kingdom", "France", "Switzerland"] },
    { name: "Elsewhere", countries: ["United States", "Singapore", "Kenya"] },
  ],
  points: [
    { name: "Export packing", text: "Moisture-protected, crated and labelled by room and install sequence." },
    { name: "Freight", text: "Sea and air freight through established logistics partners, with tracking shared online." },
    { name: "Installation", text: "Our own installers, or supervision of your local team, wherever the site is." },
    { name: "After care", text: "Spare parts, touch-up kits and a defects period on every project." },
  ],
};
