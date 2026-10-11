import type { Metadata } from "next";
import { about, delivery } from "@/content/pages";
import { ButtonLink, Container, PageHero, SectionTitle } from "@/components/ui";
import { WorldMap } from "@/components/WorldMap";

export const metadata: Metadata = { title: "From Dubai to the World" };

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About" title={about.title} lead={about.lead} />

      {/* Story */}
      <section className="py-24">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <SectionTitle ghost="Story" title="Starting with Why" />
          <div className="space-y-6 text-lg leading-relaxed text-ink-muted">
            {about.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </Container>
      </section>

      {/* Map */}
      <section className="linen py-24">
        <Container>
          <SectionTitle ghost="Reach" title="Where We Have Delivered" />
          <div className="mt-12">
            <WorldMap />
          </div>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {delivery.regions.map((r) => (
              <div key={r.name} className="border-t-2 border-gold pt-5">
                <h3 className="display text-sm">{r.name}</h3>
                <p className="mt-3 leading-relaxed text-ink-muted">{r.countries.join(", ")}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* How delivery works */}
      <section className="py-24">
        <Container>
          <SectionTitle ghost="Logistics" title={delivery.title} />
          <div className="mt-12 grid gap-px bg-line md:grid-cols-2">
            {delivery.points.map((p) => (
              <div key={p.name} className="bg-paper p-8">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-3 leading-relaxed text-ink-muted">{p.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20">
        <Container className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <ul className="mt-3 flex flex-wrap gap-3">
            </ul>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/contact" variant="outline">
              Tell Us About Your Project
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
