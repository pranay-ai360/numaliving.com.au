import { describe, expect, it } from "vitest";
import { findUkTerms, UK_TERMS } from "@/lib/vocabulary";

/** The words of each match, in the order they appear. */
function foundWords(text: string): readonly string[] {
  return findUkTerms(text).map((match) => match.match);
}

describe("UK_TERMS", () => {
  it("names the US word for every term, so a failure tells the writer what to put instead", () => {
    // Arrange
    const rules = UK_TERMS;

    // Act
    const incomplete = rules.filter((rule) => rule.term.trim() === "" || rule.us.trim() === "");

    // Assert
    expect(incomplete).toEqual([]);
  });

  it("writes every pattern as global and case-insensitive, so no occurrence or capital letter slips past", () => {
    // Arrange
    const rules = UK_TERMS;

    // Act
    const unsafe = rules.filter((rule) => !rule.pattern.global || !rule.pattern.ignoreCase);

    // Assert
    expect(unsafe.map((rule) => rule.term)).toEqual([]);
  });

  it("lists each term once", () => {
    // Arrange
    const terms = UK_TERMS.map((rule) => rule.term);

    // Act
    const repeated = terms.filter((term, index) => terms.indexOf(term) !== index);

    // Assert
    expect(repeated).toEqual([]);
  });
});

describe("findUkTerms: words and spellings", () => {
  it.each([
    ["joinery", "Full interior joinery for a villa", "joinery"],
    ["joiner", "A joiner fits each door", "joiner"],
    ["wardrobes", "Walk-in wardrobes and vanities", "wardrobes"],
    ["wardrobe", "A tall wardrobe with shaker doors", "wardrobe"],
    ["panelling", "Veneer wall panelling", "panelling"],
    ["panelled", "Panelled reception rooms", "Panelled"],
    ["programme", "Delivered on programme", "programme"],
    ["CNC programmes", "CNC programmes produced from your drawings", "programmes"],
    ["colour", "Choose a colour", "colour"],
    ["coloured", "Hand-coloured veneer", "coloured"],
    ["colour-matched", "Finishes colour-matched to samples", "colour"],
    ["metres", "Delivered in 12 metres of cabinets", "metres"],
    ["millimetre", "Built to millimetre tolerances", "millimetre"],
    ["architraves", "Architraves and frames", "Architraves"],
    ["tender", "Submit your tender early", "tender"],
    ["main contractor", "Main contractor or owner", "Main contractor"],
    ["working days", "Reply within two working days", "working days"],
    ["tendering", "Tendering now", "Tendering"],
    ["enquiry", "Send an enquiry", "enquiry"],
    ["enquire", "Enquire Now", "Enquire"],
    ["enquiries", "General enquiries", "enquiries"],
    ["BOQ", "Send drawings or a BOQ", "BOQ"],
    ["defects period", "A defects period on every project", "defects period"],
    ["defects liability period", "The defects liability period ends", "defects liability period"],
    ["cupboard", "Kitchen cupboards", "cupboards"],
    ["skirting", "Matching skirting boards", "skirting"],
    ["storey", "A three-storey building", "storey"],
    ["organisation", "The organisation behind it", "organisation"],
    ["specialised", "Specialised finishing", "Specialised"],
    ["customised", "Customised drawers", "Customised"],
    ["finalise", "Finalise the drawings", "Finalise"],
    ["pressurised", "Pressurised spray booths", "Pressurised"],
    ["recognised", "A recognised standard", "recognised"],
    ["optimised", "Optimised cutting lists", "Optimised"],
    ["centre", "CNC machining centres", "centres"],
    ["fibre", "Wood fibre board", "fibre"],
    ["grey", "A grey sofa", "grey"],
    ["whilst", "Made whilst you wait", "whilst"],
    ["amongst", "Amongst the best", "Amongst"],
    ["worktops", "Quartz worktops", "worktops"],
    ["aluminium", "Aluminium trims", "Aluminium"],
    ["labour", "Labour on site", "Labour"],
    ["licence", "A trade licence", "licence"],
    ["matt lacquer", "High-gloss and matt lacquer", "matt"],
    ["labelled", "Crated, labelled by room and sequence", "labelled"],
    ["labelling", "Room labelling on every crate", "labelling"],
    ["travelled", "Samples travelled by air", "travelled"],
    ["traveller", "A traveller's trunk", "traveller"],
    ["cancelled", "A cancelled order", "cancelled"],
    ["modelling", "3D modelling of the stair", "modelling"],
    ["modeller", "A CNC modeller", "modeller"],
    ["levelled", "A levelled floor", "levelled"],
    ["catalogue", "Download the catalogue", "catalogue"],
    ["catalogues", "Finish catalogues and samples", "catalogues"],
    ["litre", "A litre of lacquer", "litre"],
    ["litres", "20 litres of oil", "litres"],
    ["millilitres", "Fifty millilitres of dye", "millilitres"],
    ["fit-out", "A fit-out contractor", "fit-out"],
    ["fitout", "The fitout schedule", "fitout"],
    ["fit-outs", "Hotel fit-outs", "fit-outs"],
  ])("finds %s", (_label, text, expected) => {
    // Arrange
    // (the table supplies the text)

    // Act
    const words = foundWords(text);

    // Assert
    expect(words).toEqual([expected]);
  });

  it.each([
    "Full interior millwork for a villa",
    "Walk-in closets and vanities",
    "Veneer wall paneling and paneled rooms",
    "Delivered on schedule",
    "Choose a color",
    "A gray sofa and a meter of cabinets",
    "Door casing and frames",
    "Bidding now and a general contractor",
    "We reply within two business days",
    "Send an inquiry or a quantity takeoff",
    "A warranty period on every project",
    "Pressurized spray booths in the center of the shop",
    "Moulding and mouldings are accepted US trade spelling",
    "Countertops and baseboards",
    "Matte lacquer, and Matt Damon is a name",
    "Crated, labeled by room and sequence",
    "Samples traveled by air, a canceled order, 3D modeling by a modeler",
    "A leveled floor and a catalog of finishes",
    "A liter of lacquer",
    "A build-out and we fit out the villa",
    "Our factory produces to millimeter tolerances",
    "Sold by the meter, and a gas meter",
  ])("finds nothing in US copy: %s", (text) => {
    // Arrange
    // (the table supplies the text)

    // Act
    const words = foundWords(text);

    // Assert
    expect(words).toEqual([]);
  });

  it("leaves alone the words that only start like a UK term", () => {
    // Arrange
    const text =
      "A specialist and an organizer in an organic tendency, pressure-tested, recognition, a greyhound, fibrous, an optimist, tenderloin, a programmer and a centered shop";

    // Act
    const words = foundWords(text);

    // Assert
    expect(words).toEqual([]);
  });

  it("reports each of the two terms in a heading that carries both", () => {
    // Arrange
    const text = "Enquiry & Tender";

    // Act
    const words = foundWords(text);

    // Assert
    expect(words).toEqual(["Enquiry", "Tender"]);
  });

  it.each([
    "standardised",
    "Minimise waste",
    "maximised",
    "prioritise the drawings",
    "summarise",
    "utilise",
    "realised",
    "emphasised",
    "a recognisable finish",
    "customisation",
    "specialisation",
  ])("finds the -ise spelling in %s", (text) => {
    // Arrange
    // (the table supplies the text)

    // Act
    const terms = findUkTerms(text).map((match) => match.term);

    // Assert
    expect(terms).toEqual(["-ise spelling"]);
  });

  it("finds a term whatever its capitals", () => {
    // Arrange
    const text = "JOINERY, Joinery and joinery";

    // Act
    const words = foundWords(text);

    // Assert
    expect(words).toEqual(["JOINERY", "Joinery", "joinery"]);
  });
});

describe("findUkTerms: metric units", () => {
  it.each([
    ["an area on its own", "A 1,400 m² villa", "m²"],
    ["an area in parentheses with no US unit before it", "A villa (1,400 m²)", "m²"],
    ["a cubic measure", "Packed in 12 m³ crates", "m³"],
    ["a length on its own", "A 9 m reception desk", "9 m"],
    ["a length glued to its number", "A 9m reception desk", "9m"],
    ["millimeters as a symbol", "Panels 19 mm thick", "19 mm"],
    ["centimeters as a symbol", "Panels 2 cm thick", "2 cm"],
    ["the metric twin first, the US unit in parentheses", "1,400 m² (15,000 sq ft)", "m²"],
    ["a metric twin that follows text, not a US unit", "Factory floor (18,000 m²)", "m²"],
    ["square meters with no US unit", "1,400 square meters of factory", "1,400 square meters"],
    ["meters spelled out", "A reception desk 9 meters long", "9 meters"],
    ["a hyphenated length in meters", "A 10-meter run", "10-meter"],
    ["millimeters spelled out", "Panels 19 millimeters thick", "19 millimeters"],
    ["kilometers spelled out", "Ships 12 kilometers inland", "12 kilometers"],
    ["a single meter", "Cut at 1 meter", "1 meter"],
  ])("flags %s", (_label, text, expected) => {
    // Arrange
    // (the table supplies the text)

    // Act
    const words = foundWords(text);

    // Assert
    expect(words).toEqual([expected]);
  });

  it.each([
    "A villa of about 15,000 sq ft (1,400 m²)",
    "About 194,000 sq ft (18,000 m²)",
    "A reception desk of about 30 ft (9 m)",
    "Panels 3/4 in (19 mm) thick",
    "A 12 ft (3.7 m) run of cabinets",
    "A 20 square feet (1.9 m²) room",
    "A 1 1/2 inches (38 mm) door",
    "A 10 feet (about 3 m) run",
    "About 15,000 sq ft (1,400 square meters)",
    "A run of 30 ft (9 meters)",
    "Panels 3/4 in (19 millimeters) thick",
    "A 100 feet (30 meters) run",
  ])("accepts the metric twin in parentheses after a US unit: %s", (text) => {
    // Arrange
    // (the table supplies the text)

    // Act
    const words = foundWords(text);

    // Assert
    expect(words).toEqual([]);
  });

  it("still flags a metric unit elsewhere in a sentence that also has an accepted twin", () => {
    // Arrange
    const text = "About 15,000 sq ft (1,400 m²) in total, in 2,500 m² of space";

    // Act
    const words = foundWords(text);

    // Assert
    expect(words).toEqual(["m²"]);
  });

  it("does not take times, months or minutes for metric units", () => {
    // Arrange
    const text = "Open 9 am to 5 pm, a 6 month wait, 5 min away, 2 minutes, $2 M budget in 3 months";

    // Act
    const words = foundWords(text);

    // Assert
    expect(words).toEqual([]);
  });
});

describe("findUkTerms: crafted input", () => {
  /** The fastest of a few runs, so a busy machine does not make a fast function look slow. */
  function fastestMilliseconds(text: string): number {
    const runs = Array.from({ length: 3 }, () => {
      const start = performance.now();
      findUkTerms(text);
      return performance.now() - start;
    });
    return Math.min(...runs);
  }

  const FORTY_KB = 40_000;

  it.each([
    ["a long run of numbers and commas", `1${",1".repeat(FORTY_KB / 2)} x`],
    ["a metric twin that never closes", `5 ft (${"9,".repeat(FORTY_KB / 2)} m`],
    ["numbers and periods", `${"1.".repeat(FORTY_KB / 2)}m`],
    ["many measures with no unit", `${"5 ".repeat(FORTY_KB / 2)}ft `],
    ["a US unit followed by endless spaces", `5 ft${" ".repeat(FORTY_KB)}x`],
    ["open parentheses with spaces", `5 ft${"( ".repeat(FORTY_KB / 2)}`],
    ["a number and endless spaces before a unit", `5${" ".repeat(FORTY_KB)}m`],
  ])("finishes in under 100 ms on %s of about 40 KB", (_label, text) => {
    // Arrange
    // (the table supplies the crafted text)

    // Act
    const milliseconds = fastestMilliseconds(text);

    // Assert
    expect(text.length).toBeGreaterThanOrEqual(FORTY_KB);
    expect(milliseconds).toBeLessThan(100);
  });
});

describe("findUkTerms: what it reports", () => {
  it("gives the term, the words found, the US word and where they start, in the order they appear", () => {
    // Arrange
    const text = "Kitchens and wardrobes, painted in grey.";

    // Act
    const matches = findUkTerms(text);

    // Assert
    expect(matches).toEqual([
      { term: "wardrobe", match: "wardrobes", us: "closets or dressing rooms", index: 13 },
      { term: "grey", match: "grey", us: "gray", index: 35 },
    ]);
  });

  it("finds each occurrence of a term", () => {
    // Arrange
    const text = "Programme one, programme two";

    // Act
    const words = foundWords(text);

    // Assert
    expect(words).toEqual(["Programme", "programme"]);
  });

  it("returns an empty list for an empty text", () => {
    // Arrange
    const text = "";

    // Act
    const matches = findUkTerms(text);

    // Assert
    expect(matches).toEqual([]);
  });

  it("can be called again and again with the same answer", () => {
    // Arrange
    const text = "Joinery and grey";

    // Act
    const first = findUkTerms(text);
    const second = findUkTerms(text);

    // Assert
    expect(second).toEqual(first);
    expect(first).toHaveLength(2);
  });
});
