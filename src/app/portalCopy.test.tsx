/**
 * The Client Portal does not exist yet (CONTEXT.md). Nothing a page says may imply it can be used today:
 * every line that mentions the portal, or anything done "online", must say it is coming ("opens
 * soon", "opening soon", "will ...", "when it opens"). The sign-in group's screen-reader name
 * ("Sign in to the client portal") is exempt: it names a control that is disabled, and the notice
 * "The client portal opens soon." is its description.
 */
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import AboutPage from "@/app/about/page";
import ContactPage from "@/app/contact/page";
import HomePage from "@/app/page";
import LoginPage from "@/app/login/page";
import ProcessPage from "@/app/process/page";
import { getPageSeo } from "@/content/seo";

const MENTIONS_PORTAL_OR_ONLINE = /\b(portal|online)\b/i;
const SAYS_IT_IS_COMING = /\b(opens soon|opening soon|will|when (it|the (client )?portal) opens)\b/i;

/** The words directly inside an element, not those of its children, so each line is judged alone. */
function ownText(element: Element): string {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function linesMentioningThePortal(page: ReactElement): readonly string[] {
  const { container } = render(page);
  return Array.from(container.querySelectorAll("*"))
    .filter((element) => element.tagName !== "LEGEND" && element.tagName !== "SCRIPT")
    .map(ownText)
    .filter((text) => MENTIONS_PORTAL_OR_ONLINE.test(text));
}

const PAGES: readonly (readonly [string, ReactElement])[] = [
  ["the home page", <HomePage key="home" />],
  ["the About page", <AboutPage key="about" />],
  ["the Process page", <ProcessPage key="process" />],
  ["the Contact page", <ContactPage key="contact" />],
  ["the Client Login page", <LoginPage key="login" />],
];

describe("the Client Portal in the pages' copy", () => {
  it.each(PAGES)("is never described as usable today on %s", (_name, page) => {
    // Arrange
    const lines = linesMentioningThePortal(page);

    // Act
    const implyingItWorks = lines.filter((line) => !SAYS_IT_IS_COMING.test(line));

    // Assert
    expect(implyingItWorks).toEqual([]);
  });

  it("is mentioned on the pages that promote it, so the check above is not passing on nothing", () => {
    // Arrange
    const counts = PAGES.map(([, page]) => linesMentioningThePortal(page).length);

    // Act
    const total = counts.reduce((sum, count) => sum + count, 0);

    // Assert
    expect(total).toBeGreaterThanOrEqual(6);
  });

  it("is said to open soon in the search description of the Client Login page", () => {
    // Arrange
    const seo = getPageSeo("/login");

    // Act
    const description = seo?.description ?? "";

    // Assert
    expect(description).toMatch(SAYS_IT_IS_COMING);
  });
});
