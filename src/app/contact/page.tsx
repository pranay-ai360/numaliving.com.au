import type { Metadata } from "next";
import { pageMetadata } from "@/app/pageMetadata";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { site } from "@/config/site";
import { Container, PageHero } from "@/components/ui";
import { ContactDetails } from "@/components/ContactDetails";
import { QuoteForm } from "@/components/QuoteForm";

export const metadata: Metadata = pageMetadata("/contact");

export default function ContactPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: "Contact", path: "/contact" }]} />
      <PageHero
        eyebrow="Contact"
        title="Request a Quote"
        lead="Tell us about the project. Attach drawings as PDFs, or paste a link to larger files."
      />
      <section className="py-20">
        <Container className="grid gap-14 lg:grid-cols-[1.6fr_1fr]">
          <QuoteForm />
          <aside className="h-fit space-y-8 bg-linen p-8">
            <ContactDetails contact={site.contact} />

            <div>
              <p className="eyebrow">What happens next</p>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-ink-muted">
                <li>We review your scope within two business days.</li>
                <li>We will get in touch with you to understand your project better.</li>
                <li>We provide you with a proposal.</li>
                <li>Once agreed, we start your project.</li>
                <li>The client portal, which opens soon, will track progress until final delivery.</li>
              </ol>
            </div>
          </aside>
        </Container>
      </section>
    </>
  );
}
