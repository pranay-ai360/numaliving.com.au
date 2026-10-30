import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { projects } from "@/content/projects";
import { requirePageSeo } from "@/content/seo";
import { buildPageMetadata } from "@/lib/seo/metadata";
import ProjectPage, { generateMetadata } from "./page";

type ProjectPageProps = Parameters<typeof ProjectPage>[0];

/** A slug no real project uses: the mock below answers it with a copy of the first project that has no photos. */
const { PROJECT_WITHOUT_PHOTOS_SLUG } = vi.hoisted(() => ({ PROJECT_WITHOUT_PHOTOS_SLUG: "project-without-photos" }));

vi.mock("@/content/projects", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/content/projects")>();
  const [first] = actual.projects;
  return {
    ...actual,
    getProject: (slug: string) => (slug === PROJECT_WITHOUT_PHOTOS_SLUG ? { ...first, slug, photos: [] } : actual.getProject(slug)),
  };
});

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
    await renderProjectPage(PROJECT_WITHOUT_PHOTOS_SLUG);

    // Act
    const images = ownPhotos();

    // Assert
    expect(images).toEqual([]);
  });
});

describe("project page metadata", () => {
  function propsFor(slug: string): ProjectPageProps {
    return { params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) };
  }

  it("comes from the project's entry in the page registry", async () => {
    // Arrange
    const slug = projectWithGallery();
    const expected = buildPageMetadata(requirePageSeo(`/projects/${slug}`));

    // Act
    const metadata = await generateMetadata(propsFor(slug));

    // Assert
    expect(metadata).toEqual(expected);
  });

  it("shows the share image cut from the project's first photo, described as that photo is", async () => {
    // Arrange
    const slug = projectWithGallery();
    const project = projects.find((candidate) => candidate.slug === slug);

    // Act
    const metadata = await generateMetadata(propsFor(slug));

    // Assert
    expect(metadata.openGraph?.images).toEqual([
      { url: `https://numaliving.us/og/${slug}.jpg`, width: 1200, height: 630, alt: project?.photos[0].alt },
    ]);
  });

  it("is a 404, not a page without a title, for a project that does not exist", async () => {
    // Arrange
    const props = propsFor("no-such-project");

    // Act
    const act = generateMetadata(props);

    // Assert
    await expect(act).rejects.toThrow();
  });
});

