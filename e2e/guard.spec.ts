// Proves the page guard in fixtures.ts still fails a test for each kind of problem, in every
// Chromium build: each test below breaks something on purpose and is marked as expected to fail.
import { expect, test } from "./fixtures";
import { pageUrl } from "./site";

test.skip(({ isMobile }) => isMobile, "The guard does not depend on the screen size.");

test.beforeEach(async ({ page }) => {
  await page.goto(pageUrl("/"));
  await expect(page.getByRole("main")).toBeVisible();
});

test("fails a test when the page throws", async ({ page }) => {
  test.fail();
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error("deliberate uncaught error");
    }, 0);
  });
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
});

test("fails a test when the page logs a console error", async ({ page }) => {
  test.fail();
  await page.evaluate(() => console.error("deliberate console error"));
});

test("fails a test when an image cannot load", async ({ page }) => {
  test.fail();
  await page.evaluate(
    (source) =>
      new Promise<void>((resolve) => {
        const image = document.createElement("img");
        image.addEventListener("error", () => resolve());
        image.src = source;
        document.body.append(image);
      }),
    new URL("missing-photo.jpg", page.url()).href,
  );
});

test("fails a test when the page calls a host other than the test server", async ({ page }) => {
  test.fail();
  await page.evaluate(() => fetch("https://example.com/").catch(() => undefined));
});
