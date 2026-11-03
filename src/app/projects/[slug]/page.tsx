import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject, projects } from "@/content/projects";
import { getPageSeo } from "@/content/seo";
import { buildPageMetadata } from "@/lib/seo/metadata";
import type { Sector } from "@/lib/types";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ProjectGallery } from "@/components/ProjectGallery";
import { ButtonLink, Container, HERO_PHOTO_SIZES, ProjectCard, ProjectVisual, MaterialVisual } from "@/components/ui";

/** The heading above the other projects in the same sector, worded as a sentence for every sector. */
const MORE_WORK_HEADINGS: Readonly<Record<Sector, string>> = {
  Residences: "More Residential Work",
  Office: "More Office Work",
  Multifamily: "More Multifamily Work",
  Hospitality: "More Hospitality Work",
};

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const seo = getPageSeo(`/projects/${slug}`);
  if (seo === undefined) notFound();
  return buildPageMetadata(seo);
}

export default async function ProjectPage(props: PageProps<"/projects/[slug]">) {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) notFound();

  const more = projects.filter((p) => p.slug !== project.slug && p.sector === project.sector).slice(0, 3);
  const facts = [
    { label: "Sector", value: project.sector },
    { label: "Location", value: `${project.city}, ${project.country}` },
    { label: "Completed", value: String(project.year) },
    { label: "Duration", value: `${project.durationWeeks} weeks` },
  ];

  return (
    <>
      <Breadcrumbs
        items={[
          { name: "Projects", path: "/projects" },
          { name: project.name, path: `/projects/${project.slug}` },
        ]}
      />

      <section className="py-10">
        <Container>
          <p className="eyebrow">
            {project.sector} · {project.city}, {project.country}
          </p>
          <h1 className="display mt-4 max-w-4xl text-2xl sm:text-4xl">{project.name}</h1>
          <ProjectVisual project={project} sizes={HERO_PHOTO_SIZES} photoLoading="priority" className="mt-10 aspect-[16/8] w-full" />
        </Container>
      </section>

      <section className="pb-20">
        <Container className="grid gap-12 lg:grid-cols-[2fr_1fr]">
          <div>
            <p className="text-lg leading-relaxed text-ink-muted">{project.summary}</p>
            <div className="mt-10 grid gap-10 sm:grid-cols-2">
              <div>
                <h2 className="eyebrow">Scope</h2>
                <ul className="mt-4 space-y-2">
                  {project.scope.map((s) => (
                    <li key={s} className="border-b border-line pb-2">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="eyebrow">Materials</h2>
                <ul className="mt-4 space-y-2">
                  {project.materials.map((m) => (
                    <li key={m} className="border-b border-line pb-2">
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {project.photos.length === 0 && (
              <div className="mt-12 grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <MaterialVisual key={i} palette={[project.palette[(i + 1) % 3], project.palette[(i + 2) % 3], project.palette[i % 3]]} className="aspect-square" />
                ))}
              </div>
            )}
            <ProjectGallery photos={project.photos} />
          </div>

          <aside className="h-fit bg-linen p-8">
            <dl className="space-y-5">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-xs uppercase tracking-[0.2em] text-ink-muted">{f.label}</dt>
                  <dd className="mt-1 font-medium">{f.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8">
              <ButtonLink href="/contact">Discuss a Similar Project</ButtonLink>
            </div>
          </aside>
        </Container>
      </section>

      {more.length > 0 && (
        <section className="linen py-20">
          <Container>
            <h2 className="display text-xl">{MORE_WORK_HEADINGS[project.sector]}</h2>
            <div className="mt-10 grid gap-10 md:grid-cols-3">
              {more.map((p) => (
                <ProjectCard key={p.slug} project={p} />
              ))}
            </div>
          </Container>
        </section>
      )}
    </>
  );
}
