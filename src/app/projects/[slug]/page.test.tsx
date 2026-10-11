import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { projects } from "@/content/projects";
import ProjectPage from "./page";

type ProjectPageProps = Parameters<typeof ProjectPage>[0];

/** The page is an async server component: resolve it first, then render what it returns. */
async function renderProjectPage(slug: string): Promise<void> {
  const props: ProjectPageProps = { params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) };
  render(await ProjectPage(props));
}

function projectWithGallery(): string {
  const project = projects.find((candidate) => candidate.images.length > 1);
  if (project === undefined) throw new Error("No project has more than one photo, so there is no gallery to test.");
  return project.slug;
}

describe("project page photos", () => {
  it("loads the main photo first, at high priority", async () => {
    // Arrange
    await renderProjectPage(projectWithGallery());

    // Act
    const [mainPhoto] = screen.getAllByRole("img");

    // Assert
    expect(mainPhoto).toHaveAttribute("loading", "eager");
    expect(mainPhoto).toHaveAttribute("fetchpriority", "high");
  });

  it("loads every other photo lazily, as it nears the screen", async () => {
    // Arrange
    await renderProjectPage(projectWithGallery());

    // Act
    const [, ...otherPhotos] = screen.getAllByRole("img");

    // Assert
    expect(otherPhotos.length).toBeGreaterThan(0);
    expect(otherPhotos.filter((photo) => photo.getAttribute("loading") !== "lazy")).toEqual([]);
    expect(otherPhotos.filter((photo) => photo.getAttribute("decoding") !== "async")).toEqual([]);
  });
});
