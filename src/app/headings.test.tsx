/**
 * Renders every page of the registry (src/content/seo.ts) and checks its outline with the rules in
 * src/lib/headings.ts: one H1 first, and no level skipped on the way down. The registry drives the list,
 * so a page added there without a case here fails with a message that says where to add it; the
 * request-only end-to-end spec (e2e/headings.spec.ts) checks the same rules on the built pages.
 */
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import AboutPage from "@/app/about/page";
import CapabilitiesPage from "@/app/capabilities/page";
import ContactPage from "@/app/contact/page";
import LoginPage from "@/app/login/page";
import NotFound from "@/app/not-found";
import HomePage from "@/app/page";
import PrivacyPage from "@/app/privacy/page";
import ProcessPage from "@/app/process/page";
import ProjectPage from "@/app/projects/[slug]/page";
import ProjectsPage from "@/app/projects/page";
import TermsPage from "@/app/terms/page";
import { pageRegistry } from "@/content/seo";
import { headingProblems } from "@/lib/headings";

type ProjectPageProps = Parameters<typeof ProjectPage>[0];

const PROJECT_PATH = /^\/projects\/([^/]+)$/;

/** The page components by their path in the registry; a project's page is built from its slug. */
const STATIC_PAGES: Readonly<Record<string, () => ReactElement>> = {
  "/": () => <HomePage />,
  "/about": () => <AboutPage />,
  "/projects": () => <ProjectsPage />,
  "/capabilities": () => <CapabilitiesPage />,
  "/process": () => <ProcessPage />,
  "/contact": () => <ContactPage />,
  "/privacy": () => <PrivacyPage />,
  "/terms": () => <TermsPage />,
  "/login": () => <LoginPage />,
};

async function elementFor(path: string): Promise<ReactElement> {
  const staticPage = STATIC_PAGES[path];
  if (staticPage !== undefined) return staticPage();
  const slug = PROJECT_PATH.exec(path)?.[1];
  if (slug === undefined) throw new Error(`${path} is in the page registry but src/app/headings.test.tsx has no case for it: add its page component to STATIC_PAGES.`);
  const props: ProjectPageProps = { params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) };
  return ProjectPage(props);
}

/** The levels of the headings in the rendered markup, in page order. */
function levelsOf(container: HTMLElement): readonly number[] {
  return Array.from(container.querySelectorAll("h1, h2, h3, h4, h5, h6"), (heading) => Number(heading.tagName.slice(1)));
}

describe("the headings of every page", () => {
  it.each(pageRegistry.map((entry) => [entry.path] as const))("%s has one H1, first, and skips no level", async (path) => {
    // Arrange
    const { container } = render(await elementFor(path));

    // Act
    const problems = headingProblems(levelsOf(container));

    // Assert
    expect(problems).toEqual([]);
  });

  it("the not-found page has one H1 and nothing else", () => {
    // Arrange
    const { container } = render(<NotFound />);

    // Act
    const levels = levelsOf(container);

    // Assert
    expect(headingProblems(levels)).toEqual([]);
    expect(levels).toEqual([1]);
  });
});
