import type { Metadata } from "next";
import { factory } from "@/content/pages";
import { ButtonLink, Container, PageHero, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Factory" };

export default function FactoryPage() {
  return (
    <>
      <PageHero eyebrow="Factory" title={factory.title} lead={factory.lead} />
      <section className="border-b border-line">
        <Container>
          <dl className="grid grid-cols-2 lg:grid-cols-4">
            {factory.facts.map((f) => (
              <div key={f.label} className="flex flex-col-reverse justify-end border-line py-10 pr-6 [&:not(:last-child)]:lg:border-r lg:pl-6 lg:first:pl-0">
                <dt className="text-sm text-ink-muted">{f.label}</dt>
                <dd className="display mb-2 normal-case text-2xl text-gold sm:text-3xl">{f.value}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>
      <section className="py-24">
        <Container>
          <SectionTitle ghost="Inside" title="From Board to Crate" />
          <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {factory.zones.map((z, i) => (
              <li key={z.name} className="border border-line p-8">
                <span className="display text-xs text-gold">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-lg font-semibold">{z.name}</h3>
                <p className="mt-3 leading-relaxed text-ink-muted">{z.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-14 flex flex-col items-start gap-4 bg-linen p-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-ink-muted">Visiting the region? We welcome clients and design teams for factory tours and sample reviews.</p>
            <ButtonLink href="/contact">Book a Visit</ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
