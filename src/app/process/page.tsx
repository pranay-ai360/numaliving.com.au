import type { Metadata } from "next";
import { process } from "@/content/pages";
import { ButtonLink, Container, PageHero } from "@/components/ui";

export const metadata: Metadata = { title: "Process" };

export default function ProcessPage() {
  return (
    <>
      <PageHero eyebrow="Process" title={process.title} lead={process.lead} />
      <section className="py-24">
        <Container>
          <ol className="relative mx-auto max-w-3xl">
            <span aria-hidden="true" className="absolute bottom-6 left-[1.2rem] top-6 w-px bg-gold/40" />
            {process.steps.map((s, i) => (
              <li key={s.name} className="relative flex gap-8 pb-12 last:pb-0">
                <span className="display relative z-10 flex h-10 w-10 shrink-0 items-center justify-center border border-gold bg-paper text-xs text-gold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="pt-1.5">
                  <h2 className="text-lg font-semibold">{s.name}</h2>
                  <p className="mt-2 leading-relaxed text-ink-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mx-auto mt-16 max-w-3xl bg-ink p-8 text-white sm:p-10">
            <p className="eyebrow">Client portal</p>
            <p className="mt-3 text-lg">From step three onward, your team follows every drawing, approval and shipment online.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/contact">Start a Project</ButtonLink>
              <ButtonLink href="/login" variant="outline">
                Client Login
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
