/**
 * The US vocabulary guard: the words that British, Australian and Gulf readers use for what US buyers
 * call something else. `findUkTerms` finds them in a piece of text; the unit tests, the content tests
 * and the end-to-end spec (e2e/vocabulary.spec.ts, which reads every page as served) fail on any hit and
 * name the US word to use. To add a term, add a row to `UK_TERMS` and an example to
 * src/lib/vocabulary.test.ts.
 *
 * "Moulding" and "mouldings" are accepted US trade spellings, so they are not listed.
 * "Tender" is flagged in every sense: the site never uses it for anything but a bid.
 * Metric units are not wrong, only second: "about 15,000 sq ft (1,400 m²)" is fine, "1,400 m²" is not.
 */

/** One UK-only term: how to spot it, and what a US buyer says instead. */
export type UkTermRule = Readonly<{
  /** The term as a failure names it, such as "wardrobe". */
  term: string;
  /** What to write instead. */
  us: string;
  /** Finds the term in every form (plural, capitals, -ed, -ing). Global and case-insensitive. */
  pattern: RegExp;
}>;

/** One place where a UK term stands in a text. */
export type UkTermMatch = Readonly<{
  term: string;
  /** The words as the text has them, such as "Panelled". */
  match: string;
  us: string;
  /** Where the match starts in the text. */
  index: number;
}>;

/** The stems of the British "-ise" spellings; a stem plus an ending ("organis" + "ation") is the UK word. */
const ISE_STEMS = [
  "organis",
  "specialis",
  "customis",
  "finalis",
  "pressuris",
  "recognis",
  "optimis",
  "standardis",
  "minimis",
  "maximis",
  "prioritis",
  "summaris",
  "utilis",
  "realis",
  "emphasis",
] as const;

const ISE_ENDINGS = ["e", "es", "ed", "ing", "ation", "ations", "er", "ers", "able"] as const;

export const UK_TERMS: readonly UkTermRule[] = [
  { term: "joinery", us: "millwork", pattern: /\bjoinery\b/gi },
  { term: "joiner", us: "carpenter or millworker", pattern: /\bjoiners?\b/gi },
  { term: "wardrobe", us: "closets or dressing rooms", pattern: /\bwardrobes?\b/gi },
  { term: "panelling", us: "paneling or paneled", pattern: /\bpanell(?:ing|ed)\b/gi },
  { term: "programme", us: "schedule (or program, for software and CNC)", pattern: /\bprogrammes?\b/gi },
  { term: "colour", us: "color", pattern: /\bcolour\w*/gi },
  { term: "metre", us: "meter, millimeter, centimeter, kilometer", pattern: /\b(?:milli|centi|kilo)?metres?\b/gi },
  { term: "architrave", us: "casing (door casing)", pattern: /\barchitraves?\b/gi },
  { term: "tender", us: "bid or bidding", pattern: /\btender(?:s|ed|ing)?\b/gi },
  { term: "enquiry", us: "inquiry, inquire, inquiries", pattern: /\benqui(?:ry|ries|re|res|red|ring)\b/gi },
  { term: "BOQ", us: "quantity takeoff", pattern: /\bBOQs?\b/gi },
  { term: "defects period", us: "warranty period", pattern: /\bdefects?(?:[- ]liability)? period\b/gi },
  { term: "cupboard", us: "cabinet or closet", pattern: /\bcupboards?\b/gi },
  { term: "skirting", us: "baseboard", pattern: /\bskirting\b/gi },
  { term: "storey", us: "story", pattern: /\bstoreys?\b/gi },
  { term: "-ise spelling", us: "the -ize spelling (organize, specialize, pressurize)", pattern: new RegExp(`\\b(?:${ISE_STEMS.join("|")})(?:${ISE_ENDINGS.join("|")})\\b`, "gi") },
  { term: "centre", us: "center", pattern: /\bcentr(?:e|es|ed|ing)\b/gi },
  { term: "fibre", us: "fiber", pattern: /\bfibres?\b/gi },
  { term: "grey", us: "gray", pattern: /\bgrey(?:s|ish)?\b/gi },
  { term: "whilst", us: "while", pattern: /\bwhilst\b/gi },
  { term: "amongst", us: "among", pattern: /\bamongst\b/gi },
  { term: "worktop", us: "countertop", pattern: /\bworktops?\b/gi },
  { term: "aluminium", us: "aluminum", pattern: /\baluminium\b/gi },
  { term: "labour", us: "labor", pattern: /\blabour(?:s|ed|er|ers|ing)?\b/gi },
  { term: "licence", us: "license", pattern: /\blicences?\b/gi },
  // "Matt" alone is also a first name, so only the finish is flagged.
  { term: "matt finish", us: "matte", pattern: /\bmatt(?=\s+(?:lacquer|finish|finishes|paint|varnish|laminate|glass|veneer)\b)/gi },
];

/**
 * A metric measure: a number with a metric unit (9 m, 19 mm, 2 cm), an area or volume symbol (m², m³,
 * m2) or "sq m". Case-sensitive on purpose: "$2 M" is two million dollars, not two meters. Built from a
 * string so the lookbehind does not depend on the TypeScript target.
 */
const METRIC_UNIT_RULE: UkTermRule = {
  term: "metric unit",
  us: "feet, inches and sq ft first, with the metric figure in parentheses after it",
  pattern: new RegExp(
    String.raw`\b\d[\d,.]*\s?(?:mm|cm|km|m)(?![\w²³])|(?<![A-Za-z_])(?:mm|cm|km|m)[²³]|\b\d[\d,.]*\s?m[23]\b|\bsq\.?\s?m\b`,
    "g",
  ),
};

const US_UNIT = String.raw`(?:sq\.?\s?ft\.?|square\s(?:feet|foot)|feet|foot|ft|inches|inch|in\.?)`;
const METRIC_UNIT = String.raw`(?:sq\.?\s?m|(?:mm|cm|km|m)[²³23]?)`;
const METRIC_TWIN = String.raw`\(\s*(?:about\s+|approximately\s+|approx\.\s+)?\d[\d,.]*(?:\s?[-–]\s?\d[\d,.]*)?\s?${METRIC_UNIT}\s*\)`;

/** A US measure followed by its metric twin in parentheses: group 1 is the US measure, group 2 the twin. */
const US_MEASURE_WITH_METRIC_TWIN = new RegExp(String.raw`(\d[\d,./]*\s?${US_UNIT}\s*)(${METRIC_TWIN})`, "gi");

/** The text with every accepted metric twin blanked out (same length, so positions still line up). */
function withoutAcceptedMetricTwins(text: string): string {
  return text.replace(US_MEASURE_WITH_METRIC_TWIN, (_whole, usMeasure: string, twin: string) => `${usMeasure}${" ".repeat(twin.length)}`);
}

function matchesOf(rule: UkTermRule, text: string): readonly UkTermMatch[] {
  return Array.from(text.matchAll(rule.pattern), (found) => ({ term: rule.term, match: found[0], us: rule.us, index: found.index }));
}

/** Every UK-only term in `text`, in the order they appear. Empty when the text is written in US English. */
export function findUkTerms(text: string): readonly UkTermMatch[] {
  const words = UK_TERMS.flatMap((rule) => matchesOf(rule, text));
  const units = matchesOf(METRIC_UNIT_RULE, withoutAcceptedMetricTwins(text));
  return [...words, ...units].sort((a, b) => a.index - b.index);
}
