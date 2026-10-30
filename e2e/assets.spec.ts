import type { Page, Request } from "@playwright/test";
import { craft, factoryPhoto } from "../src/content/pages";
import { projects } from "../src/content/projects";
import { BASE_PATH, SERVER_ORIGIN } from "./env";
import { expect, test } from "./fixtures";
import { PROJECTS_PATH, pageUrl } from "./site";

/** Every file the site loads must come from below the base path on the test server. */
const SITE_ROOT = `${SERVER_ORIGIN}${BASE_PATH}`;

/**
 * True for the site root and anything below it. The root itself appears without its slash because
 * Next.js writes home links that way, and its router checks each link's page with a HEAD request.
 */
function isOnSite(url: string): boolean {
  return url === SITE_ROOT || url.startsWith(`${SITE_ROOT}/`);
}

type PageWithPhotos = { path: string; photos: readonly string[] };

const PAGES_WITH_PHOTOS: readonly PageWithPhotos[] = [
  { path: "/", photos: [] },
  { path: PROJECTS_PATH, photos: [] },
  { path: "/capabilities", photos: [...craft.map((photo) => photo.src), factoryPhoto.src].filter((src) => src !== "") },
  ...projects.map((project) => ({ path: `${PROJECTS_PATH}/${project.slug}`, photos: project.photos.map((photo) => photo.src) })),
];

type NetworkLog = { requested: () => readonly string[]; failures: () => Promise<readonly string[]> };

const ABORTED = "net::ERR_ABORTED";

/**
 * Chromium reports a fetch whose body the page never reads as aborted, even after a successful
 * answer. Next.js's router does exactly that: before prefetching a link it sends a HEAD request to
 * the link's page and only looks at the status. So "aborted after a 2xx answer" is not a failure;
 * anything aborted before an answer, or answered with an error, still is.
 */
async function isRealFailure(request: Request): Promise<boolean> {
  if (request.failure()?.errorText !== ABORTED) return true;
  const answer = await request.response();
  return answer === null || !answer.ok();
}

function watchNetwork(page: Page): NetworkLog {
  let requested: readonly string[] = [];
  let failedRequests: readonly Request[] = [];
  let errorAnswers: readonly string[] = [];
  page.on("request", (request) => {
    requested = [...requested, request.url()];
  });
  page.on("requestfailed", (request) => {
    failedRequests = [...failedRequests, request];
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errorAnswers = [...errorAnswers, `${response.url()}: HTTP ${response.status()}`];
  });
  const failures = async (): Promise<readonly string[]> => {
    const verdicts = await Promise.all(failedRequests.map(async (request) => ({ request, isReal: await isRealFailure(request) })));
    const realFailures = verdicts.filter(({ isReal }) => isReal).map(({ request }) => `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`);
    return [...errorAnswers, ...realFailures];
  };
  return { requested: () => requested, failures };
}

/** Scrolls each image into view, so the lazy-loaded ones (every photo below the fold) load too. */
async function scrollThroughImages(page: Page): Promise<void> {
  for (const image of await page.locator("img").all()) {
    await image.scrollIntoViewIfNeeded();
  }
}

async function brokenImages(page: Page): Promise<readonly string[]> {
  return page.locator("img").evaluateAll((images: HTMLImageElement[]) =>
    images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.currentSrc || image.src),
  );
}

async function loadedImagePaths(page: Page): Promise<readonly string[]> {
  return page.locator("img").evaluateAll((images: HTMLImageElement[]) =>
    images.map((image) => decodeURIComponent(new URL(image.currentSrc || image.src).pathname)),
  );
}

/**
 * True when a loaded file is the photo or one of its fast copies: the page asks for "/projects/x/x-03-800.avif",
 * not for the original "/projects/x/x-03.jpg", which is only the fallback for a browser without AVIF and WebP.
 */
function isShownAs(loadedPath: string, photo: string): boolean {
  const stem = `${BASE_PATH}${photo.replace(/\.jpg$/, "")}`;
  return loadedPath === `${stem}.jpg` || (loadedPath.startsWith(`${stem}-`) && /-\d+\.(avif|webp)$/.test(loadedPath));
}

/** Opens every "Show all" control, which keeps the extra photos of a project, so that they load too. */
async function openAllDetails(page: Page): Promise<void> {
  for (const summary of await page.locator("details > summary").all()) {
    await summary.click();
  }
}

/** Stylesheets, scripts, preloads (fonts, images) and icons the page refers to. */
async function referencedAssets(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => [
    ...Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"], link[rel="preload"], link[rel~="icon"]'), (link) => link.href),
    ...Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"), (script) => script.src),
  ]);
}

async function fontStates(page: Page): Promise<readonly string[]> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return Array.from(document.fonts, (font) => `${font.family} ${font.style} ${font.status}`);
  });
}

/**
 * next/font also declares "<name> Fallback" faces (`src: local(Arial)`) that only tune the
 * metrics of a system font while the web font loads. Machines without Arial, such as the
 * Linux CI runners, report them as "error"; that is harmless, so they are left out.
 */
function isNextFontFallback(fontState: string): boolean {
  return /^"?[\w-]+ Fallback"? /.test(fontState);
}

test.skip(({ isMobile }) => isMobile, "The same files load at every screen size.");

for (const { path, photos } of PAGES_WITH_PHOTOS) {
  test(`${path} loads its images, styles, scripts, fonts and icons from below the base path`, async ({ page, request }) => {
    // Arrange
    const network = watchNetwork(page);

    // Act
    await page.goto(pageUrl(path));
    await openAllDetails(page);
    await scrollThroughImages(page);

    // Assert: every image loaded, including all of this project's own photos (as their AVIF or WebP copies)
    await expect.poll(() => brokenImages(page), { message: "images that did not load" }).toEqual([]);
    const shownPhotos = await loadedImagePaths(page);
    expect(photos.filter((photo) => !shownPhotos.some((shown) => isShownAs(shown, photo)))).toEqual([]);
    expect(network.requested().filter((url) => /\/projects\/.+\.jpe?g$/.test(url)), "the original JPEGs, which are only a fallback").toEqual([]);

    // Assert: the site's own fonts loaded and none failed
    const fonts = (await fontStates(page)).filter((font) => !isNextFontFallback(font));
    expect(fonts.filter((font) => font.endsWith(" error"))).toEqual([]);
    expect(fonts.some((font) => font.endsWith(" loaded"))).toBe(true);

    // Assert: everything referenced and requested comes from below the base path
    const assets = await referencedAssets(page);
    expect(assets.length).toBeGreaterThan(0);
    expect(assets.filter((url) => !isOnSite(url))).toEqual([]);
    expect(network.requested().filter((url) => !isOnSite(url) && !url.startsWith("data:"))).toEqual([]);

    // Assert: icons answer with images (a headless browser may never ask for them itself)
    for (const icon of await page.locator('link[rel~="icon"]').evaluateAll((links: HTMLLinkElement[]) => links.map((link) => link.href))) {
      const response = await request.get(icon);
      expect.soft(response.status(), icon).toBe(200);
      expect.soft(response.headers()["content-type"], icon).toMatch(/^image\//);
    }

    // Assert: nothing failed on the way
    expect(await network.failures()).toEqual([]);
  });
}

test("the photos behind a closed Show all control are not fetched until it is opened", async ({ page }) => {
  // Arrange
  const project = projects.find((candidate) => candidate.photos.length > 7);
  if (project === undefined) throw new Error("No project has more photos than fit on its page.");
  const hidden = project.photos.slice(7).map((photo) => photo.src);
  const network = watchNetwork(page);
  const requestedHidden = (): readonly string[] =>
    hidden.filter((photo) => network.requested().some((url) => isShownAs(decodeURIComponent(new URL(url).pathname), photo)));

  // Act: load the page and scroll to the very bottom, as a visitor reading to the end would
  await page.goto(pageUrl(`${PROJECTS_PATH}/${project.slug}`));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForLoadState("networkidle");

  // Assert: nothing inside the closed details was asked for
  expect(requestedHidden()).toEqual([]);

  // Act: open it
  await page.getByText(`Show all ${project.photos.length} photos`).click();
  await scrollThroughImages(page);

  // Assert: now every one of them loads
  await expect.poll(requestedHidden, { message: "photos inside the opened details" }).toEqual(hidden);
  await expect.poll(() => brokenImages(page), { message: "images that did not load" }).toEqual([]);
});

