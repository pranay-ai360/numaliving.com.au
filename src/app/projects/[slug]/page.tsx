import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, projects } from "@/content/projects";
import { withBasePath } from "@/lib/assetPath";
import { ButtonLink, Container, LAZY_IMAGE_PROPS, ProjectCard, ProjectVisual, MaterialVisual } from "@/components/ui";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const project = getProject(slug);
  return { title: project?.name ?? "Project", description: project?.summary };
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
    { label: "Programme", value: `${project.durationWeeks} weeks` },
  ];

  return (
    <>
      <Container className="pt-10">
        <Link href="/projects" className="text-sm text-ink-muted hover:text-gold">
          ← All projects
        </Link>
      </Container>

      <section className="py-10">
        <Container>
          <p className="eyebrow">
            {project.sector} · {project.city}, {project.country}
          </p>
          <h1 className="display mt-4 max-w-4xl text-2xl sm:text-4xl">{project.name}</h1>
          <ProjectVisual project={project} photoLoading="priority" className="mt-10 aspect-[16/8] w-full" />
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
            {project.images.length === 0 && (
              <div className="mt-12 grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => (
                  <MaterialVisual key={i} palette={[project.palette[(i + 1) % 3], project.palette[(i + 2) % 3], project.palette[i % 3]]} className="aspect-square" />
                ))}
              </div>
            )}
            {project.images.length > 1 && (
              <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {project.images.slice(1).map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={withBasePath(src)} alt={project.name} {...LAZY_IMAGE_PROPS} className="aspect-square w-full object-cover" />
                ))}
              </div>
            )}
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
            <h2 className="display text-xl">More {project.sector} Work</h2>
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
