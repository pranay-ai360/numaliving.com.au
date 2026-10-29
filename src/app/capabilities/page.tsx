import type { Metadata } from "next";
import { capabilities, craft, factory, factoryPhoto } from "@/content/pages";
import { ButtonLink, Container, PageHero, SectionTitle } from "@/components/ui";
import { CraftGallery, PhotoTile } from "@/components/CraftGallery";

export const metadata: Metadata = { title: "Capabilities & Factory" };

export default function CapabilitiesPage() {
  return (
    <>
      <PageHero eyebrow="Capabilities" title="What We Make, and Where" lead={capabilities.lead} />

      {/* Craft photos */}
      <section className="pt-16">
        <Container>
          <CraftGallery photos={craft} />
        </Container>
      </section>

      {/* What we make: compact, six groups */}
      <section className="py-16">
        <Container>
          <div className="grid gap-px bg-line md:grid-cols-2 lg:grid-cols-3">
            {capabilities.groups.map((g) => (
              <div key={g.name} className="bg-paper p-7">
                <h2 className="display text-sm text-gold">{g.name}</h2>
                <ul className="mt-4 space-y-2">
                  {g.items.map((item) => (
                    <li key={item} className="flex gap-3 text-sm">
                      <span aria-hidden="true" className="mt-2 h-px w-4 shrink-0 bg-gold" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Factory */}
      <section id="factory" className="linen py-16 sm:py-20">
        <Container>
          <SectionTitle ghost="Factory" title={factory.title} />
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">{factory.lead}</p>

          <PhotoTile photo={factoryPhoto} className="mt-10 aspect-[16/7] w-full" />

          <ol className="mt-12 grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {factory.zones.map((z, i) => (
              <li key={z.name} className="border-t-2 border-gold pt-4">
                <span className="display text-xs text-gold">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-1 font-semibold">{z.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{z.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="py-16">
        <Container className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <p className="max-w-xl text-ink-muted">
            Not on the list? If it is built in a factory and finished by hand, ask us. Visiting the region? We welcome factory tours and sample reviews.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/contact">Ask About Your Scope</ButtonLink>
            <ButtonLink href="/contact" variant="outline">
              Book a Visit
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
