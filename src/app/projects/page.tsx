import type { Metadata } from "next";
import { projects } from "@/content/projects";
import { Container } from "@/components/ui";
import { ProjectsGallery } from "@/components/ProjectsGallery";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <>
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
