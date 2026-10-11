import { BASE_PATH, SERVER_ORIGIN } from "./env";
import { expectAt } from "./expect-at";
import { expect, test } from "./fixtures";

test.skip(({ isMobile }) => isMobile, "The answers do not depend on the screen size.");

test.describe("an unknown page below the base path", () => {
  // The browser logs its own console line for the 404 answer.
  test.use({ allowedConsoleErrors: [/status of 404/] });

  test("answers 404 with the custom not-found page, which leads back home", async ({ page }) => {
    // Act
    const response = await page.goto("no-such-page/");

    // Assert
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
    await page.getByRole("link", { name: "Back Home" }).click();
    await expectAt(page, "/");
  });
});

test("the root of the host, outside the base path, answers 404", async ({ request }) => {
  test.skip(BASE_PATH === "", "The site is served from the root of the host.");

  // Act
  const response = await request.get(`${SERVER_ORIGIN}/`);

  // Assert
  expect(response.status()).toBe(404);
  expect(await response.text()).toContain("Page Not Found");
});
