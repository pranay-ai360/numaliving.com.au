import type { Metadata } from "next";
import { capabilities } from "@/content/pages";
import { ButtonLink, Container, PageHero } from "@/components/ui";

export const metadata: Metadata = { title: "Capabilities" };

export default function CapabilitiesPage() {
  return (
    <>
      <PageHero eyebrow="Capabilities" title="What We Make" lead={capabilities.lead} />
      <section className="py-24">
        <Container>
          <div className="grid gap-px bg-line md:grid-cols-2 lg:grid-cols-3">
            {capabilities.groups.map((g) => (
              <div key={g.name} className="bg-paper p-8">
                <h2 className="display text-base text-gold">{g.name}</h2>
                <ul className="mt-6 space-y-3">
                  {g.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span aria-hidden="true" className="mt-2.5 h-px w-4 shrink-0 bg-gold" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-14 text-center">
            <p className="text-ink-muted">Not on the list? If it is built in a factory and finished by hand, ask us.</p>
            <div className="mt-6">
              <ButtonLink href="/contact">Ask About Your Scope</ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
