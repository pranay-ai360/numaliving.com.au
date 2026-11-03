import type { Metadata } from "next";
import { pageMetadata } from "@/app/pageMetadata";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { projects } from "@/content/projects";
import { requirePageSeo } from "@/content/seo";
import { Container } from "@/components/ui";
import { ProjectsGallery } from "@/components/ProjectsGallery";

export const metadata: Metadata = pageMetadata("/projects");

export default function ProjectsPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: "Projects", path: "/projects" }]} />
      <section className="py-16">
        <Container>
          {/* The heading says what the page's search title says (src/content/seo.ts), and the cards below it are H2s. */}
          <p className="eyebrow">Projects</p>
          <h1 className="display mt-4 mb-10 max-w-4xl text-2xl sm:text-4xl">{requirePageSeo("/projects").title}</h1>
          <ProjectsGallery projects={projects} />
        </Container>
      </section>
    </>
  );
}
