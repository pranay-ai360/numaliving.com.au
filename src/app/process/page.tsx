import type { Metadata } from "next";
import { process } from "@/content/pages";
import { ButtonLink, Container, PageHero } from "@/components/ui";
import { ProcessDiagram } from "@/components/ProcessDiagram";

export const metadata: Metadata = { title: "Process" };

export default function ProcessPage() {
  return (
    <>
      <PageHero eyebrow="Process" title={process.title} lead={process.lead} />
      <section className="py-20">
        <Container>
          <ProcessDiagram steps={process.steps} />
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
