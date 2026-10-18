import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { projects } from "@/content/projects";
import ProjectPage from "./page";

type ProjectPageProps = Parameters<typeof ProjectPage>[0];

/** The photos that belong to the project itself: the "More work" cards at the bottom (each a link) show other projects' covers. */
function ownPhotos(): readonly HTMLElement[] {
  return screen.queryAllByRole("img").filter((image) => image.closest("a") === null);
}

/** The page is an async server component: resolve it first, then render what it returns. */
async function renderProjectPage(slug: string): Promise<void> {
  const props: ProjectPageProps = { params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) };
  render(await ProjectPage(props));
}

function projectWithGallery(): string {
  const project = projects.find((candidate) => candidate.photos.length > 1);
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

describe("project page gallery", () => {
  it("keeps the photos beyond the cover and the first six gallery photos behind a closed Show all control", async () => {
    // Arrange
    const project = projects.find((candidate) => candidate.photos.length > 7);
    if (project === undefined) throw new Error("No project has more photos than fit, so there is no Show all control to test.");
    await renderProjectPage(project.slug);

    // Act
    const summary = screen.getByText(`Show all ${project.photos.length} photos`);
    const details = summary.closest("details");

    // Assert
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");
    expect(details?.querySelectorAll("img")).toHaveLength(project.photos.length - 1 - 6);
  });

  it("shows every photo straight away when they all fit, with no Show all control", async () => {
    // Arrange
    const project = projects.find((candidate) => candidate.photos.length > 1 && candidate.photos.length <= 7);
    if (project === undefined) throw new Error("No project has a gallery that fits on the page, so there is nothing to compare.");
    await renderProjectPage(project.slug);

    // Act
    const images = ownPhotos();

    // Assert
    expect(images).toHaveLength(project.photos.length);
    expect(screen.queryByText(/^Show all/)).not.toBeInTheDocument();
  });

  it("describes each photo in words of its own, not with the project's name", async () => {
    // Arrange
    const slug = projectWithGallery();
    await renderProjectPage(slug);

    // Act
    const alts = ownPhotos().map((image) => image.getAttribute("alt"));

    // Assert
    expect(new Set(alts).size).toBe(alts.length);
    expect(alts.filter((alt) => alt === null || alt === "")).toEqual([]);
  });

  it("shows a swatch placeholder, and no photo, for a project without photos", async () => {
    // Arrange
    const project = projects.find((candidate) => candidate.photos.length === 0);
    if (project === undefined) throw new Error("Every project has photos, so there is no placeholder to test.");
    await renderProjectPage(project.slug);

    // Act
    const images = ownPhotos();

    // Assert
    expect(images).toEqual([]);
  });
});

