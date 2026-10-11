import type { Metadata } from "next";
import { projects } from "@/content/projects";
import { PageHero, Container } from "@/components/ui";
import { ProjectsGallery } from "@/components/ProjectsGallery";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <>
      <section className="py-16">
        <Container>
          <ProjectsGallery projects={projects} />
        </Container>
      </section>
    </>
  );
}
