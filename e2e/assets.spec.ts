import type { Page, Request } from "@playwright/test";
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
  ...projects.map((project) => ({ path: `${PROJECTS_PATH}/${project.slug}`, photos: project.images })),
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

test.skip(({ isMobile }) => isMobile, "The same files load at every screen size.");

for (const { path, photos } of PAGES_WITH_PHOTOS) {
  test(`${path} loads its images, styles, scripts, fonts and icons from below the base path`, async ({ page, request }) => {
    // Arrange
    const network = watchNetwork(page);

    // Act
    await page.goto(pageUrl(path));
    await scrollThroughImages(page);

    // Assert: every image loaded, including all of this project's own photos
    await expect.poll(() => brokenImages(page), { message: "images that did not load" }).toEqual([]);
    const shownPhotos = await loadedImagePaths(page);
    expect(photos.map((photo) => `${BASE_PATH}${photo}`).filter((photo) => !shownPhotos.includes(photo))).toEqual([]);

    // Assert: fonts loaded and none failed
    const fonts = await fontStates(page);
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
