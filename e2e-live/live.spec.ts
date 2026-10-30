// Read-only smoke tests of the deployed site (npm run test:live). Nothing is submitted: no test touches
// the contact form. The site is still a noindex preview, so every page must say so; change that check
// when the site launches.
import { expect, test, type Page } from "@playwright/test";
import { home } from "../src/content/pages";
import { projects } from "../src/content/projects";
import { ALL_PAGES, pageUrl } from "../e2e/site";

const ROBOTS_META = /<meta\s+name="robots"\s+content="([^"]*)"/i;
const H1_OPEN_TAG = /<h1[\s>]/gi;

/** Next.js cancels its own link prefetches; the browser reports them as aborted. They are not failures. */
const ABORTED = "net::ERR_ABORTED";

/** What a visitor's browser would complain about while pages load. */
function watchProblems(page: Page): () => readonly string[] {
  let problems: readonly string[] = [];
  const record = (problem: string): void => {
    problems = [...problems, problem];
  };
  page.on("console", (message) => {
    if (message.type() === "error") record(`console error: ${message.text()}`);
  });
  page.on("pageerror", (error) => record(`uncaught error: ${error.message}`));
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText !== ABORTED) record(`request failed: ${request.url()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) record(`HTTP ${response.status()}: ${response.url()}`);
  });
  return () => problems;
}

/** Photos load lazily: scroll to each one that shows, so that it starts loading. */
async function scrollThroughPhotos(page: Page): Promise<void> {
  for (const photo of await page.locator("img:visible").all()) {
    await photo.scrollIntoViewIfNeeded();
  }
}

/** The photos that show but have not (yet) loaded. Poll it: over a real network a photo takes a moment. */
async function unloadedPhotos(page: Page): Promise<readonly string[]> {
  return page.locator("img:visible").evaluateAll((images: HTMLImageElement[]) =>
    images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.currentSrc || image.src),
  );
}

test.describe("as served", () => {
  test.skip(({ isMobile }) => isMobile, "Every screen size gets the same HTML.");

  test("every page answers 200, asks search engines not to index it and has one main heading", async ({ request }) => {
    for (const path of ALL_PAGES) {
      const response = await request.get(pageUrl(path));
      const html = await response.text();

      expect.soft(response.status(), `${path} should answer 200`).toBe(200);
      expect.soft(html.split("</head>")[0].match(ROBOTS_META)?.[1], `${path} should say noindex`).toMatch(/\bnoindex\b/);
      expect.soft(html.match(H1_OPEN_TAG)?.length ?? 0, `${path} should have one h1`).toBe(1);
    }
  });
});

// One test per page: each gets its own timeout, so a slow page (some projects carry several MB of photos)
// cannot use up the time of the pages after it, and a failure names the page.
for (const path of ALL_PAGES) {
  test(`${path} loads without errors, failed requests or broken photos`, async ({ page }) => {
    const problems = watchProblems(page);

    await page.goto(pageUrl(path));
    await scrollThroughPhotos(page);

    await expect.poll(() => unloadedPhotos(page), { message: "photos that did not load" }).toEqual([]);
    expect(problems()).toEqual([]);
  });
}

test("the home page shows the hero line and figures the site's content describes", async ({ page }) => {
  await page.goto(pageUrl("/"));
  const main = page.getByRole("main");

  await expect(main.getByText(home.heroSub, { exact: true })).toBeVisible();
  for (const { label, value } of home.stats) {
    await expect(main.locator("dl > div").filter({ has: page.getByText(label, { exact: true }) }).locator("dd")).toHaveText(value);
  }
});

for (const project of projects) {
  test(`/projects/${project.slug} shows all of its photos`, async ({ page }) => {
    await page.goto(pageUrl(`/projects/${project.slug}`));

    await expect(page.getByRole("img", { name: project.name, exact: true })).toHaveCount(project.images.length);
  });
}
