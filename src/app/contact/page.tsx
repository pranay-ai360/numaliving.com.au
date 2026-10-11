import type { Metadata } from "next";
import { site } from "@/config/site";
import { Container, PageHero } from "@/components/ui";
import { QuoteForm } from "@/components/QuoteForm";

export const metadata: Metadata = { title: "Request a Quote" };

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Request a Quote"
        lead="Tell us about the project. Attach drawings as PDFs, or paste a link to larger files."
      />
      <section className="py-20">
        <Container className="grid gap-14 lg:grid-cols-[1.6fr_1fr]">
          <QuoteForm />
          <aside className="h-fit space-y-8 bg-linen p-8">
            <div>
              <p className="eyebrow">Talk to us</p>
              <ul className="mt-4 space-y-2">
                <li>
                  <a href={`mailto:${site.contact.email}`} className="hover:text-gold">
                    {site.contact.email}
                  </a>
                </li>
              </ul>
            </div>
            
            <div>
              <p className="eyebrow">What happens next</p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-ink-muted">
                <li>We review your scope within two working days.</li>
                <li>We will get in touch with you to understand your project better.</li>
                <li>We provide you with a proposal.</li>
                <li>Once agreed, your team gets access to the client portal.</li>
                <li>Progress is updated in the portal until final delivery.</li>
              </ol>
            </div>
          </aside>
        </Container>
      </section>
    </>
  );
}
