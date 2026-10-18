import type { Metadata } from "next";
import { pageMetadata } from "@/app/pageMetadata";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { projects } from "@/content/projects";
import { Container } from "@/components/ui";
import { ProjectsGallery } from "@/components/ProjectsGallery";

export const metadata: Metadata = pageMetadata("/projects");

export default function ProjectsPage() {
  return (
    <>
      <Breadcrumbs items={[{ name: "Projects", path: "/projects" }]} />
      <section className="py-16">
        <Container>
          {/* The design shows no title here, so the page's heading is for screen readers and search engines only. */}
          <h1 className="sr-only">Projects</h1>
          <ProjectsGallery projects={projects} />
        </Container>
      </section>
    </>
  );
}
