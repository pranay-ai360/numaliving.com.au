import type { ReactNode } from "react";
import { Container, SectionTitle } from "@/components/ui";
import { companyFacts, publishableFacts, type CompanyFacts } from "@/content/company";
import { formatSquareFeet } from "@/lib/units";

type FactRow = Readonly<{ label: string; value: ReactNode }>;

const LINK_CLASS = "underline decoration-gold underline-offset-4 transition-colors hover:text-gold-dark";
const EXTERNAL_LINK_REL = "noopener noreferrer";

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} rel={EXTERNAL_LINK_REL} className={LINK_CLASS}>
      {children}
    </a>
  );
}

/** "LinkedIn" for a LinkedIn address, "Profile" for any other (the addresses are https, checked by `publishableFacts`). */
function profileLabel(profileUrl: string): string {
  return new URL(profileUrl).hostname.endsWith("linkedin.com") ? "LinkedIn" : "Profile";
}

/** One row for each fact that is set, in the order the owner's list gives them; none while nothing is set. */
function rowsOf(facts: CompanyFacts): readonly FactRow[] {
  const published = publishableFacts(facts);
  return [
    ...(published.legalName === undefined ? [] : [{ label: "Legal name", value: published.legalName }]),
    ...(published.foundingYear === undefined ? [] : [{ label: "Founded", value: String(published.foundingYear) }]),
    ...(published.factoryAreaSqFt === undefined ? [] : [{ label: "Factory floor", value: formatSquareFeet(published.factoryAreaSqFt) }]),
    ...(published.headcount === undefined ? [] : [{ label: "Team", value: `${published.headcount.toLocaleString("en-US")} people` }]),
    ...(published.certifications.length === 0
      ? []
      : [
          {
            label: "Certifications",
            value: (
              <ul className="space-y-1">
                {published.certifications.map((certification) => (
                  <li key={certification.name}>
                    <ExternalLink href={certification.documentUrl}>{certification.name}</ExternalLink>
                  </li>
                ))}
              </ul>
            ),
          },
        ]),
    ...(published.leadership.length === 0
      ? []
      : [
          {
            label: "Leadership",
            value: (
              <ul className="space-y-1">
                {published.leadership.map((leader) => (
                  <li key={leader.name}>
                    {leader.name}, {leader.role}
                    {leader.profileUrl !== null && (
                      <>
                        {" "}
                        <ExternalLink href={leader.profileUrl}>{profileLabel(leader.profileUrl)}</ExternalLink>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ),
          },
        ]),
    ...(published.parentGroupUrl === undefined ? [] : [{ label: "Parent group", value: <ExternalLink href={published.parentGroupUrl}>Conqueror Group</ExternalLink> }]),
  ];
}

/**
 * The About page's "Company Facts": the facts the owner has confirmed (src/content/company.ts), each
 * only when it is set and usable. Today none is, so this renders nothing: no heading, no gap, no
 * placeholder, and no claim the site cannot back.
 */
export function CompanyFactsSection({ facts = companyFacts }: { facts?: CompanyFacts }) {
  const rows = rowsOf(facts);
  if (rows.length === 0) return null;
  return (
    <section className="border-t border-line py-24">
      <Container>
        <SectionTitle ghost="Facts" title="Company Facts" />
        <dl className="mt-12 grid gap-px bg-line sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="bg-paper p-8">
              <dt className="text-sm text-ink-muted">{row.label}</dt>
              <dd className="mt-2 text-lg">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
