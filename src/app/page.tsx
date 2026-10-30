import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/app/pageMetadata";
import { home } from "@/content/pages";
import { projects } from "@/content/projects";
import { site } from "@/config/site";
import { HomeHero } from "@/components/HomeHero";
import { ButtonLink, Container, FigureValue, ProjectCard, SectionTitle } from "@/components/ui";
import { PortalPreview } from "@/components/PortalPreview";

export const metadata: Metadata = pageMetadata("/");

export default function HomePage() {
  const featured = projects.filter((p) => p.featured).slice(0, 3);

  return (
    <>
      <HomeHero eyebrow={home.eyebrow} title={home.heroTitle} statement={home.heroSub} audience={home.heroAudience} photo={home.heroPhoto} />

      {/* Featured projects */}
      <section className="py-24">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionTitle ghost="Projects" title="Selected Work" />
            <Link href="/projects" className="text-sm font-medium text-gold-dark hover:text-ink">
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
                <dd className="display mt-2 normal-case text-2xl text-gold sm:text-3xl">
                  <FigureValue value={s.value} />
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* Process teaser + portal */}
      <section className="bg-ink py-24 text-white">
        <Container className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow text-gold">How we work</p>
            <h2 className="display mt-4 text-2xl sm:text-3xl">A Client Portal, Opening Soon</h2>
            <p className="mt-6 max-w-lg leading-relaxed text-white/70">
              Clients, architects and contractors will follow their project in the Numa client portal: drawings, shop drawing
              approvals, RFIs, samples and production status in one place. It opens soon.
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
          <SectionTitle ghost="Inquire" title="Start a Project" align="center" />
          <p className="mx-auto mt-8 max-w-xl text-lg text-ink-muted">
            Send drawings, a quantity takeoff or a scanned sketch (PDF). We reply with scope, schedule and a priced proposal.
          </p>
          <div className="mt-8">
            <ButtonLink href="/contact">Request a Quote</ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
