import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Breadcrumbs } from "@/components/Breadcrumbs";

const PROJECT_TRAIL = [
  { name: "Projects", path: "/projects" },
  { name: "Test Villa", path: "/projects/test-villa" },
];

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** The words of a step as a screen reader gets them: the text of the item without its aria-hidden separator. */
function stepText(item: HTMLElement): string {
  return Array.from(item.childNodes)
    .filter((node) => !(node instanceof HTMLElement && node.getAttribute("aria-hidden") === "true"))
    .map((node) => node.textContent ?? "")
    .join("");
}

function trailJsonLd(container: HTMLElement): { itemListElement: { position: number; name: string; item: string }[] } {
  const script = container.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script?.textContent ?? "{}");
}

describe("Breadcrumbs", () => {
  it("is a navigation landmark named Breadcrumb with an ordered list of the steps, starting at Home", () => {
    // Arrange
    render(<Breadcrumbs items={PROJECT_TRAIL} />);

    // Act
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    const list = within(nav).getByRole("list");

    // Assert
    expect(list.tagName).toBe("OL");
    expect(within(list).getAllByRole("listitem").map(stepText)).toEqual(["Home", "Projects", "Test Villa"]);
  });

  it("links every step but the last, which is the page itself and says so", () => {
    // Arrange
    render(<Breadcrumbs items={PROJECT_TRAIL} />);

    // Act
    const links = within(screen.getByRole("navigation", { name: "Breadcrumb" })).getAllByRole("link");
    const current = screen.getByText("Test Villa");

    // Assert
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Home", "/"],
      ["Projects", "/projects"],
    ]);
    expect(current.closest("a")).toBeNull();
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("works for a page one step below Home", () => {
    // Arrange
    render(<Breadcrumbs items={[{ name: "About", path: "/about" }]} />);

    // Act
    const items = within(screen.getByRole("navigation", { name: "Breadcrumb" })).getAllByRole("listitem");

    // Assert
    expect(items.map(stepText)).toEqual(["Home", "About"]);
    expect(screen.getByText("About")).toHaveAttribute("aria-current", "page");
  });

  it("hides the separators from assistive technology, so a screen reader never reads a slash between steps", () => {
    // Arrange
    render(<Breadcrumbs items={PROJECT_TRAIL} />);

    // Act
    const separators = Array.from(screen.getByRole("navigation", { name: "Breadcrumb" }).querySelectorAll("li > span:first-child[aria-hidden='true']"));

    // Assert
    expect(separators.map((separator) => separator.textContent)).toEqual(["/", "/"]);
    expect(screen.getByText("Test Villa")).toHaveAttribute("aria-current", "page");
  });

  it("puts no separator before Home, the first step", () => {
    // Arrange
    render(<Breadcrumbs items={PROJECT_TRAIL} />);

    // Act
    const [home] = within(screen.getByRole("navigation", { name: "Breadcrumb" })).getAllByRole("listitem");

    // Assert
    expect(home.querySelector("[aria-hidden]")).toBeNull();
  });

  it("does not draw a separator with CSS generated content, which a screen reader can read", () => {
    // Arrange
    render(<Breadcrumbs items={PROJECT_TRAIL} />);

    // Act
    const generated = Array.from(screen.getByRole("navigation", { name: "Breadcrumb" }).querySelectorAll("[class*='content-']"));

    // Assert
    expect(generated).toEqual([]);
  });

  it("describes the same trail to search engines as a BreadcrumbList, in order, with the canonical address of each page", () => {
    // Arrange
    const { container } = render(<Breadcrumbs items={PROJECT_TRAIL} />);

    // Act
    const data = trailJsonLd(container);

    // Assert
    expect(data).toMatchObject({ "@type": "BreadcrumbList" });
    expect(data.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://numaliving.us/" },
      { "@type": "ListItem", position: 2, name: "Projects", item: "https://numaliving.us/projects/" },
      { "@type": "ListItem", position: 3, name: "Test Villa", item: "https://numaliving.us/projects/test-villa/" },
    ]);
  });

  it("writes the structured data addresses below the base path when the site is served from a sub-path", () => {
    // Arrange
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/numaliving.com.au");
    const { container } = render(<Breadcrumbs items={[{ name: "About", path: "/about" }]} />);

    // Act
    const data = trailJsonLd(container);

    // Assert
    expect(data.itemListElement.map((entry) => entry.item)).toEqual(["https://numaliving.us/numaliving.com.au/", "https://numaliving.us/numaliving.com.au/about/"]);
  });
});
