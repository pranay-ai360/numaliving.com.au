import type { Metadata } from "next";
import { about } from "@/content/pages";
import { ButtonLink, Container, PageHero, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="About" title={about.title} lead={about.lead} />
      <section className="py-24">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <SectionTitle ghost="Story" title="Why Numa Exists" />
          <div className="space-y-6 text-lg leading-relaxed text-ink-muted">
            {about.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </Container>
      </section>
      <section className="linen py-24">
        <Container>
          <SectionTitle ghost="Values" title="What We Stand For" />
          <div className="mt-12 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {about.values.map((v) => (
              <div key={v.name} className="bg-paper p-8">
                <h3 className="display text-base text-gold">{v.name}</h3>
                <p className="mt-4 leading-relaxed text-ink-muted">{v.text}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>
      <section className="py-20">
        <Container className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="eyebrow">Certifications</p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {about.certifications.map((c) => (
                <li key={c} className="rounded-sm bg-gold-soft px-3 py-1.5 text-sm">
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <ButtonLink href="/factory">See the Factory</ButtonLink>
        </Container>
      </section>
    </>
  );
}
