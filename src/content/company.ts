/**
 * The facts about the company that only the owner can supply. Nothing here may be guessed: every value
 * is empty until Numa confirms it, and the About page shows only the facts that are set (src/components/
 * CompanyFacts.tsx), so today it shows none. `legalName` and `foundingYear` also go into the
 * structured data search engines read (src/config/site.ts passes them on).
 *
 * Each missing fact is a launch blocker (`companyFactsBlockers`, collected by src/content/readiness.ts),
 * so the launch guard keeps the site out of search engines until they are filled in. To publish
 * without a fact Numa cannot supply, delete its row in FACT_RULES below instead of inventing a value.
 */
import { isHttpsUrl } from "@/lib/httpsUrl";

/** A certification, with the document that proves it (a certificate on Numa's site or the issuer's). */
export type Certification = Readonly<{ name: string; documentUrl: string }>;

/** A named leader; `profileUrl` is a LinkedIn (or similar) page, when there is one. */
export type Leader = Readonly<{ name: string; role: string; profileUrl: string | null }>;

export type CompanyFacts = Readonly<{
  /** The registered company name, such as "Numa Living FZ-LLC". */
  legalName: string | null;
  /** The year the company was founded, such as 2015. */
  foundingYear: number | null;
  /** The factory's floor area in square feet; the page adds the square meters. */
  factoryAreaSqFt: number | null;
  /** How many people the company employs. */
  headcount: number | null;
  certifications: readonly Certification[];
  leadership: readonly Leader[];
  /** A web page that shows Numa is part of the Conqueror Group. */
  parentGroupUrl: string | null;
}>;

export const companyFacts: CompanyFacts = {
  legalName: null,
  foundingYear: null,
  factoryAreaSqFt: null,
  headcount: null,
  certifications: [],
  leadership: [],
  parentGroupUrl: null,
};

const FACTS_FILE = "src/content/company.ts";
const EARLIEST_FOUNDING_YEAR = 1800;

function isText(value: string | null): value is string {
  return value !== null && value.trim() !== "";
}

function isPositiveNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

function isFoundingYear(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value >= EARLIEST_FOUNDING_YEAR && value <= new Date().getFullYear();
}

function isHeadcount(value: number | null): value is number {
  return isPositiveNumber(value) && Number.isInteger(value);
}

function isCertification(certification: Certification): boolean {
  return isText(certification.name) && isHttpsUrl(certification.documentUrl);
}

function isLeader(leader: Leader): boolean {
  return isText(leader.name) && isText(leader.role) && (leader.profileUrl === null || isHttpsUrl(leader.profileUrl));
}

function isWebAddress(value: string | null): value is string {
  return value !== null && isHttpsUrl(value);
}

type FactRule = Readonly<{
  field: keyof CompanyFacts;
  /** What the fact is, in plain words, for the owner. */
  plain: string;
  /** True when the fact is set to a usable value. */
  isSupplied: (facts: CompanyFacts) => boolean;
}>;

const FACT_RULES: readonly FactRule[] = [
  { field: "legalName", plain: "the company's legal name", isSupplied: (facts) => isText(facts.legalName) },
  { field: "foundingYear", plain: "the year the company was founded", isSupplied: (facts) => isFoundingYear(facts.foundingYear) },
  { field: "factoryAreaSqFt", plain: "the factory's floor area in square feet", isSupplied: (facts) => isPositiveNumber(facts.factoryAreaSqFt) },
  { field: "headcount", plain: "the number of people the company employs", isSupplied: (facts) => isHeadcount(facts.headcount) },
  {
    field: "certifications",
    plain: "the certifications, each with a link to its document",
    isSupplied: (facts) => facts.certifications.length > 0 && facts.certifications.every(isCertification),
  },
  { field: "leadership", plain: "the named leaders, with their roles", isSupplied: (facts) => facts.leadership.length > 0 && facts.leadership.every(isLeader) },
  { field: "parentGroupUrl", plain: "a web page that proves the Conqueror Group connection", isSupplied: (facts) => isWebAddress(facts.parentGroupUrl) },
];

/** Each fact that is missing, or set to something unusable (a zero, a broken link), in plain words; empty when all are real. */
export function companyFactsBlockers(facts: CompanyFacts = companyFacts): readonly string[] {
  return FACT_RULES.filter((rule) => !rule.isSupplied(facts)).map(
    (rule) => `company fact "${rule.field}" is missing or not valid: ${rule.plain} (fill it in ${FACTS_FILE})`,
  );
}

/** The facts the About page may show: only values that are set and usable, so a gap or a broken link is never published. */
export type PublishedFacts = Readonly<{
  legalName?: string;
  foundingYear?: number;
  factoryAreaSqFt?: number;
  headcount?: number;
  certifications: readonly Certification[];
  leadership: readonly Leader[];
  parentGroupUrl?: string;
}>;

/** A new object with the usable facts only (the legal name trimmed); empty lists where nothing is usable. */
export function publishableFacts(facts: CompanyFacts = companyFacts): PublishedFacts {
  return {
    ...(isText(facts.legalName) ? { legalName: facts.legalName.trim() } : {}),
    ...(isFoundingYear(facts.foundingYear) ? { foundingYear: facts.foundingYear } : {}),
    ...(isPositiveNumber(facts.factoryAreaSqFt) ? { factoryAreaSqFt: facts.factoryAreaSqFt } : {}),
    ...(isHeadcount(facts.headcount) ? { headcount: facts.headcount } : {}),
    certifications: facts.certifications.filter(isCertification),
    leadership: facts.leadership.filter(isLeader),
    ...(isWebAddress(facts.parentGroupUrl) ? { parentGroupUrl: facts.parentGroupUrl } : {}),
  };
}
