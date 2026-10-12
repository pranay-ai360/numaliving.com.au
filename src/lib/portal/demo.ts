/**
 * SAMPLE DATA for the client portal demo.
 *
 * Every name, date and number here is invented, so the portal can be
 * clicked through before the real backend (Firebase) is connected.
 * Nothing is saved: refreshing the page resets the demo.
 *
 * When the backend is built, these lists are replaced by data loaded
 * from the database; the screens stay the same.
 */
import type { PortalModule } from "@/lib/types";

export type DemoRole = "owner" | "architect" | "contractor";

/** 0 = hidden, 1 = view, 2 = act, 3 = approve */
export type Level = 0 | 1 | 2 | 3;
export const levelNames = ["Hidden", "View", "Act", "Approve"] as const;
export const levelHelp = ["cannot see it", "can see it", "can upload, comment, answer", "signs off"] as const;

export const project = {
  name: "Marina Villa",
  location: "Palm Jumeirah, Dubai",
  handover: "[DATE]",
};

export const modules: { key: PortalModule; label: string }[] = [
  { key: "designDrawings", label: "Design drawings" },
  { key: "shopDrawings", label: "Shop drawings" },
  { key: "samples", label: "Samples" },
  { key: "rfis", label: "RFIs" },
  { key: "production", label: "Production" },
  { key: "updates", label: "Updates" },
  { key: "commercials", label: "Commercials" },
];

export const people = [
  { name: "Sara Al Mansoori", org: "Owner" },
  { name: "Daniel Ortiz", org: "Studio Linea · Architect" },
  { name: "Leila Haddad", org: "Studio Linea · Interior designer" },
  { name: "Ravi Menon", org: "Al Noor Contracting · Main contractor" },
  { name: "Anita Rao", org: "Owner's project manager" },
];

/** Starting answers on the responsibility form: one row per person, one column per module (same order as `modules`). */
export const startingRights: Level[][] = [
  [1, 1, 3, 1, 1, 1, 3],
  [2, 3, 2, 2, 1, 1, 1],
  [2, 2, 2, 2, 1, 1, 0],
  [2, 1, 1, 2, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 2],
];

/** Who started the conversation with Numa. Can be anyone; can be handed over. */
export const startingMainContact = 1;

/** The three people you can "be" in the demo, and which row of `people` they are. */
export const roles: { key: DemoRole; label: string; person: number }[] = [
  { key: "owner", label: "Owner", person: 0 },
  { key: "architect", label: "Architect", person: 1 },
  { key: "contractor", label: "Main contractor", person: 3 },
];

export const stages = [
  { name: "Enquiry & tender", note: "Done", state: "done" },
  { name: "Responsibilities", note: "Done", state: "done" },
  { name: "Shop drawings", note: "18 of 24", state: "done" },
  { name: "Samples", note: "9 of 11", state: "done" },
  { name: "Production", note: "60%", state: "now" },
  { name: "Quality control", note: "Next", state: "next" },
  { name: "Shipping", note: "1 of 3 sent", state: "next" },
  { name: "Handover", note: "[DATE]", state: "next" },
] as const;

export const stats = [
  { value: "18/24", label: "Shop drawings approved" },
  { value: "9/11", label: "Samples approved" },
  { value: "3", label: "Open RFIs" },
  { value: "12 Nov", label: "Next shipment arrives" },
];

export const updates = [
  { title: "Kitchen island carcasses machined", meta: "Production · 4 photos · Today", photo: true },
  { title: "SD-109 Rev C approved", meta: "Shop drawings · by Daniel Ortiz · Yesterday", photo: false },
  { title: "Shipment 1 delivered to site, 14 crates", meta: "Shipping · signed by Ravi Menon · 2 Oct", photo: false },
];

export type ReviewItem = {
  id: string;
  kind: "shop" | "sample";
  code: string;
  title: string;
  status: "waiting" | "approved" | "revising";
  sub: string;
  swatch?: string;
};

export const shopDrawings: ReviewItem[] = [
  { id: "sd104", kind: "shop", code: "SD-104 Rev B", title: "Kitchen island", status: "waiting", sub: "Issued 9 Oct by Numa engineering · review by 16 Oct" },
  { id: "sd110", kind: "shop", code: "SD-110 Rev A", title: "Library wall", status: "waiting", sub: "Issued 11 Oct by Numa engineering · review by 22 Oct" },
  { id: "sd109", kind: "shop", code: "SD-109 Rev C", title: "Master wardrobe", status: "approved", sub: "Approved by Daniel Ortiz · 11 Oct" },
  { id: "sd107", kind: "shop", code: "SD-107 Rev B", title: "Majlis wall panelling", status: "revising", sub: "Returned with comments · Numa revising" },
  { id: "sd101", kind: "shop", code: "SD-101 Rev D", title: "Entrance door", status: "approved", sub: "Approved by Daniel Ortiz · 24 Sep" },
];

export const samples: ReviewItem[] = [
  { id: "walnut", kind: "sample", code: "Walnut veneer", title: "Master bedroom panelling", status: "waiting", sub: "Sent 6 Oct · approve by 18 Oct", swatch: "linear-gradient(160deg, #6b4a32, #4a3121)" },
  { id: "brass", kind: "sample", code: "Brushed brass handle", title: "Wardrobes", status: "waiting", sub: "Sent 6 Oct · approve by 18 Oct", swatch: "linear-gradient(135deg, #c9a965, #ac8f50 45%, #8a713b)" },
  { id: "lacquer", kind: "sample", code: "Matt lacquer, [RAL]", title: "Kitchen fronts", status: "approved", sub: "Approved by Sara Al Mansoori · 30 Sep", swatch: "linear-gradient(150deg, #efe9e1, #cfc6ba)" },
  { id: "stone", kind: "sample", code: "Calacatta stone", title: "Island worktop", status: "approved", sub: "Approved by Sara Al Mansoori · 28 Sep", swatch: "linear-gradient(125deg, #f4f2ee 40%, #cfc8be 42%, #f4f2ee 44%)" },
];

export const designUploads = [
  { name: "A-201 Kitchen layout.pdf", version: "v3", by: "Daniel Ortiz, Studio Linea", date: "28 Sep" },
  { name: "A-305 Master bedroom elevations.pdf", version: "v2", by: "Leila Haddad, Studio Linea", date: "24 Sep" },
  { name: "Site survey, ground floor.pdf", version: "v1", by: "Ravi Menon, Al Noor Contracting", date: "20 Sep" },
  { name: "A-110 Joinery schedule.pdf", version: "v4", by: "Daniel Ortiz, Studio Linea", date: "18 Sep" },
];

export type Message = { who: string; when: string; text: string; file?: string; fromNuma: boolean };
export type Rfi = { id: string; code: string; area: string; title: string; to: number; due: string; open: boolean; messages: Message[] };

export const rfis: Rfi[] = [
  {
    id: "rfi12", code: "RFI-012", area: "Wardrobes", title: "Handle height on wardrobe doors", to: 1, due: "15 Oct", open: true,
    messages: [{ who: "Numa engineering", when: "11 Oct", fromNuma: true, file: "SD-109 handle detail", text: "The design set shows handles at 1050 mm, but the master wardrobe doors are 2700 mm tall. Please confirm 1050 mm, or should we centre them at 1200 mm?" }],
  },
  {
    id: "rfi14", code: "RFI-014", area: "Majlis", title: "Confirm ceiling height in majlis", to: 3, due: "15 Oct", open: true,
    messages: [{ who: "Numa engineering", when: "10 Oct", fromNuma: true, text: "Wall panelling SD-107 assumes a finished ceiling at 3400 mm. Please confirm the as-built height before we cut panels." }],
  },
  {
    id: "rfi11", code: "RFI-011", area: "Kitchen", title: "Veneer grain direction on island", to: 1, due: "8 Oct", open: false,
    messages: [
      { who: "Numa engineering", when: "6 Oct", fromNuma: true, text: "Should the walnut grain on the island run horizontally or vertically?" },
      { who: "Daniel Ortiz", when: "8 Oct", fromNuma: false, file: "Island grain markup", text: "Horizontal, continuous across all four doors. Marked-up PDF attached." },
    ],
  },
  {
    id: "rfi9", code: "RFI-009", area: "Library", title: "Socket positions in library wall", to: 3, due: "30 Sep", open: false,
    messages: [
      { who: "Numa engineering", when: "27 Sep", fromNuma: true, text: "Please share the electrical layout for the library wall." },
      { who: "Ravi Menon", when: "29 Sep", fromNuma: false, file: "E-210 library electrical", text: "Layout attached. Two double sockets at 450 mm." },
    ],
  },
];

export const production = [
  { name: "Kitchen island and run", ref: "SD-104 · walnut veneer", stage: "Machining", pct: 35, photos: 4 },
  { name: "Master wardrobe", ref: "SD-109 · walnut and brass", stage: "Finishing", pct: 70, photos: 9 },
  { name: "Majlis wall panelling", ref: "SD-107 · waiting on RFI-014", stage: "On hold", pct: 10, photos: 1 },
  { name: "Guest suite vanities", ref: "SD-112 · matt lacquer", stage: "Quality control", pct: 90, photos: 12 },
  { name: "Entrance door", ref: "SD-101 · fire-rated", stage: "Packed", pct: 100, photos: 6 },
];

export const shipmentSteps = ["Packed", "Sailed", "Customs", "On site"];

export const shipments = [
  { id: "s1", name: "Shipment 1", status: "Delivered", done: 4, line1: "14 crates · container [NUMBER]", line2: "Signed for by Ravi Menon, 2 Oct", needsSite: false },
  { id: "s2", name: "Shipment 2", status: "At sea", done: 2, line1: "22 crates · ETA Jebel Ali 8 Nov", line2: "Site delivery window 10–14 Nov", needsSite: true },
  { id: "s3", name: "Shipment 3", status: "Planned", done: 0, line1: "Majlis, library, loose furniture", line2: "Packing from [DATE]", needsSite: false },
];

export const shippingDocs = ["Packing list, Shipment 2", "Bill of lading", "Crate map by room", "Install sequence"];

/**
 * Things that can land in someone's "Waiting for you" list.
 * A task shows for a person if they have the `need` level on its module,
 * or if it is addressed to them (`to`). It disappears once decided.
 */
export type Task = {
  id: string;
  tag: string;
  title: string;
  meta: string;
  cta: string;
  href: string;
  module: PortalModule;
  need?: Level;
  to?: number;
};

export const tasks: Task[] = [
  { id: "sd104", tag: "Shop drawing", title: "SD-104 Rev B · Kitchen island", meta: "Review by 16 Oct", cta: "Review", href: "/portal/approvals/", module: "shopDrawings", need: 3 },
  { id: "sd110", tag: "Shop drawing", title: "SD-110 Rev A · Library wall", meta: "Review by 22 Oct", cta: "Review", href: "/portal/approvals/", module: "shopDrawings", need: 3 },
  { id: "walnut", tag: "Sample", title: "Walnut veneer, master bedroom panelling", meta: "Approve by 18 Oct", cta: "Review", href: "/portal/approvals/", module: "samples", need: 3 },
  { id: "brass", tag: "Sample", title: "Brushed brass handle, wardrobes", meta: "Approve by 18 Oct", cta: "Review", href: "/portal/approvals/", module: "samples", need: 3 },
  { id: "vo3", tag: "Commercials", title: "Variation VO-03: extra wardrobe, guest suite", meta: "AED [AMOUNT] · approve by 20 Oct", cta: "Approve", href: "/portal/", module: "commercials", need: 3 },
  { id: "rfi12", tag: "RFI", title: "RFI-012 · Handle height on wardrobe doors", meta: "Answer by 15 Oct", cta: "Answer", href: "/portal/rfis/", module: "rfis", to: 1 },
  { id: "rfi14", tag: "RFI", title: "RFI-014 · Confirm ceiling height in majlis", meta: "Answer by 15 Oct", cta: "Answer", href: "/portal/rfis/", module: "rfis", to: 3 },
  { id: "s2", tag: "Shipping", title: "Confirm site is ready for Shipment 2", meta: "Delivery window 10–14 Nov", cta: "Confirm", href: "/portal/tracking/", module: "production", to: 3 },
];
