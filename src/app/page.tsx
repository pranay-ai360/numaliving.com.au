import Link from "next/link";
import { home, process } from "@/content/pages";
import { projects } from "@/content/projects";
import { site } from "@/config/site";
import { LineArt, Wordmark } from "@/components/Brand";
import { ButtonLink, Container, ProjectCard, SectionTitle } from "@/components/ui";
import { PortalPreview } from "@/components/PortalPreview";

export default function HomePage() {
  const featured = projects.filter((p) => p.featured).slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="linen relative overflow-hidden">
        <LineArt
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[85%] w-full text-gold/45"
          style={{ maskImage: "radial-gradient(ellipse 38% 55% at 50% 45%, transparent 55%, black 100%)", WebkitMaskImage: "radial-gradient(ellipse 38% 55% at 50% 45%, transparent 55%, black 100%)" }}
        />
        <div className="relative mx-auto flex min-h-[560px] max-w-7xl flex-col items-center justify-center px-4 py-20 text-center sm:min-h-[640px]">
          <Wordmark size="lg" />
          <h1 className="display mt-12 text-3xl sm:text-5xl">{home.heroTitle}</h1>
          <p className="display mt-6 text-sm text-ink sm:text-lg">{home.heroSub}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/contact">Request a Quote</ButtonLink>
            <ButtonLink href="/projects" variant="outline">
              View Projects
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* Featured projects */}
      <section className="py-24">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionTitle ghost="Projects" title="Selected Work" />
            <Link href="/projects" className="text-sm font-medium text-gold hover:text-gold-dark">
              All projects →
            </Link>
          </div>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {featured.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        </Container>
      </section>

     {/* About strip */}
      <section className="linen py-24">
        <Container className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <SectionTitle ghost="About" eyebrow={site.group} title="The Craft Behind Great Interiors" />
            <p className="mt-8 text-lg leading-relaxed text-ink-muted">{home.intro}</p>
            <div className="mt-8">
              <ButtonLink href="/about" variant="outline">
                Our Story
              </ButtonLink>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-px bg-line">
            {home.stats.map((s) => (
              <div key={s.label} className="bg-paper p-6 sm:p-8">
                <dt className="text-sm text-ink-muted">{s.label}</dt>
                <dd className="display mt-2 normal-case text-2xl text-gold sm:text-3xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* Process teaser + portal */}
      <section className="bg-ink py-24 text-white">
        <Container className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow">How we work</p>
            <h2 className="display mt-4 text-2xl sm:text-3xl">Every Approval, Online</h2>
            <p className="mt-6 max-w-lg leading-relaxed text-white/70">
              Clients, architects and contractors follow their project in the Numa client portal: drawings, shop drawing
              approvals, RFIs, samples and production status in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/process">Our Process</ButtonLink>
              <Link href="/login" className="inline-flex items-center px-2 py-3 text-sm font-medium text-gold hover:text-white">
                Client Login →
              </Link>
            </div>
          </div>
          <PortalPreview />
        </Container>
      </section>

      {/* CTA */}
      <section className="py-24">
        <Container className="text-center">
          <SectionTitle ghost="Enquire" title="Start a Project" align="center" />
          <p className="mx-auto mt-8 max-w-xl text-lg text-ink-muted">
            Send drawings, a BOQ or a hand sketch. We reply with scope, programme and a priced proposal.
          </p>
          <div className="mt-8">
            <ButtonLink href="/contact">Request a Quote</ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
