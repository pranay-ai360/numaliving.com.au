import type { Metadata } from "next";
import { delivery } from "@/content/pages";
import { ButtonLink, Container, PageHero, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Global Delivery" };

export default function GlobalDeliveryPage() {
  return (
    <>
      <PageHero eyebrow="Global Delivery" title="Made Here, Installed Anywhere" lead={delivery.lead} />
      <section className="py-24">
        <Container>
          <SectionTitle ghost="Reach" title="Where We Have Delivered" />
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {delivery.regions.map((r) => (
              <div key={r.name} className="border-t-2 border-gold pt-6">
                <h3 className="display text-sm">{r.name}</h3>
                <ul className="mt-4 space-y-1.5 text-ink-muted">
                  {r.countries.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>
      <section className="linen py-24">
        <Container>
          <SectionTitle ghost="Logistics" title="Door to Site" />
          <div className="mt-12 grid gap-px bg-line md:grid-cols-2">
            {delivery.points.map((p) => (
              <div key={p.name} className="bg-paper p-8">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-3 leading-relaxed text-ink-muted">{p.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <ButtonLink href="/contact">Tell Us Where Your Site Is</ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
