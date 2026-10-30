// Request-only (no browser): every photo the site shows is served as an image, and no image file in the
// repository is so big that a phone on mobile data would struggle. Phone cameras make 5 to 13 MB files;
// they must be resized first.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { craft, factoryPhoto } from "../src/content/pages";
import { projects } from "../src/content/projects";
import { BASE_PATH, SERVER_ORIGIN } from "./env";

/** The biggest file the site serves, in bytes. The largest photo in use today is about 1.3 MB. */
const MAX_IMAGE_BYTES = 1_500_000;

/** The two client-portal screenshots on the home page; they are named in the component, not in the content files. */
const PORTAL_PREVIEW_PHOTOS = ["/portal-preview/portal-desktop.jpg", "/portal-preview/portal-mobile.jpg"] as const;

const PHOTO_PATHS: readonly string[] = [
  ...projects.flatMap((project) => project.images),
  ...craft.map((photo) => photo.src),
  factoryPhoto.src,
  ...PORTAL_PREVIEW_PHOTOS,
].filter((src) => src !== "");

/** The tests run from the repository root, as the web server command in playwright.config.ts does. */
const PUBLIC_DIR = join(process.cwd(), "public");
const IMAGE_FILE = /\.(jpe?g|png|webp|avif|gif)$/i;

test.skip(({ isMobile }) => isMobile, "The same files are served at every screen size.");

test("every photo is served as an image no bigger than 1.5 MB", async ({ request }) => {
  for (const path of new Set(PHOTO_PATHS)) {
    const response = await request.get(`${SERVER_ORIGIN}${BASE_PATH}${encodeURI(path)}`);

    expect.soft(response.status(), `${path} should answer 200`).toBe(200);
    expect.soft(response.headers()["content-type"], `${path} should be an image`).toMatch(/^image\//);
    expect.soft((await response.body()).byteLength, `${path} is bigger than ${MAX_IMAGE_BYTES} bytes`).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
  }
});

test("no image file in public/ is bigger than 1.5 MB, whether a page uses it or not", () => {
  // Arrange: a file nothing refers to is still published and stays in git history for good
  const imageFiles = readdirSync(PUBLIC_DIR, { recursive: true, encoding: "utf8" }).filter((file) => IMAGE_FILE.test(file));

  // Act
  const tooBig = imageFiles.filter((file) => statSync(join(PUBLIC_DIR, file)).size > MAX_IMAGE_BYTES);

  // Assert
  expect(imageFiles.length, "public/ should hold the site's photos").toBeGreaterThan(0);
  expect(tooBig).toEqual([]);
});
