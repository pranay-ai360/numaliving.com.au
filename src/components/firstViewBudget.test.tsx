/**
 * Keeps the first view of every page with photos light: the files a browser loads for the photos on
 * a page (the AVIF copy it picks for its screen, from the real files in public/) stay under 1.5 MB, on
 * a phone and on a large screen, at the heaviest screen density in use. Photos inside a closed "Show
 * all" control are not counted (they are not fetched), but every other photo is, lazy or not.
 */
import { statSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import ProjectPage from "@/app/projects/[slug]/page";
import ProjectsPage from "@/app/projects/page";
import { projects } from "@/content/projects";
import { firstViewCopies, type Screen } from "@/lib/photoBudget";

const MAX_FIRST_VIEW_BYTES = 1_500_000;

const SCREENS: readonly (Screen & { name: string })[] = [
  { name: "a phone at 3x", width: 390, density: 3 },
  { name: "a laptop at 1x", width: 1440, density: 1 },
  { name: "a laptop at 2x", width: 1440, density: 2 },
];

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function bytesOf(sitePath: string): number {
  return statSync(path.join(process.cwd(), "public", sitePath)).size;
}

function totalBytes(files: readonly string[]): number {
  return files.reduce((sum, file) => sum + bytesOf(file), 0);
}

type PageUnderTest = { name: string; render: () => Promise<HTMLElement> };

async function renderProjectPage(slug: string): Promise<HTMLElement> {
  const props: Parameters<typeof ProjectPage>[0] = { params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) };
  return render(await ProjectPage(props)).container;
}

const PAGES: readonly PageUnderTest[] = [
  { name: "the home page", render: async () => render(<HomePage />).container },
  { name: "the Projects page", render: async () => render(<ProjectsPage />).container },
  ...projects.map((project) => ({ name: `the ${project.slug} project page`, render: () => renderProjectPage(project.slug) })),
];

describe("the images a page loads on first view", () => {
  it.each(PAGES.flatMap((page) => SCREENS.map((screen) => [page, screen] as const)))("stay under 1.5 MB on %o", async (page, screen) => {
    // Arrange
    const container = await page.render();

    // Act
    const files = firstViewCopies(container, screen);
    const total = totalBytes(files);

    // Assert
    expect(total, `${page.name} on ${screen.name} loads ${files.length} files, ${total} bytes`).toBeLessThanOrEqual(MAX_FIRST_VIEW_BYTES);
  });

  it("are a small part of what the original JPEGs would weigh on the page with the most photos", async () => {
    // Arrange
    const heaviest = projects.reduce((most, project) => (project.photos.length > most.photos.length ? project : most));
    const container = await renderProjectPage(heaviest.slug);
    const jpegBytes = totalBytes(heaviest.photos.map((photo) => photo.src));

    // Act
    const loaded = totalBytes(firstViewCopies(container, SCREENS[0]));

    // Assert
    expect(loaded).toBeLessThan(jpegBytes / 4);
  });

  it("include the photos of a project with a gallery, so the budget is measuring something", async () => {
    // Arrange
    const container = await renderProjectPage("penthouse25");

    // Act
    const files = firstViewCopies(container, SCREENS[0]);

    // Assert
    expect(files.length).toBeGreaterThanOrEqual(7);
    expect(files.every((file) => file.endsWith(".avif"))).toBe(true);
  });
});
