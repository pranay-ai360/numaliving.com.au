import type { Request } from "@playwright/test";
import { expectAt } from "./expect-at";
import { expect, test } from "./fixtures";
import { CONTACT_PATH, LOGIN_PATH, pageUrl } from "./site";

/**
 * Next.js prefetches a link's page once the link scrolls into view: a HEAD request for the page,
 * then its route files (__next.*.txt). On a phone, clicking the controls scrolls the footer links
 * into view, so these requests are expected; neither kind can carry anything typed into a form.
 */
function isLinkPrefetch(request: Request): boolean {
  return request.method() === "HEAD" || /\/__next\.[^/]*\.txt$/.test(new URL(request.url()).pathname);
}

const SIGN_IN_GROUP = "Sign in to the client portal";

test.beforeEach(async ({ page }) => {
  await page.goto(pageUrl(LOGIN_PATH));
});

test("Client Login shows the notice and every control is disabled", async ({ page }) => {
  await expect(page.getByText("The client portal opens soon.")).toBeVisible();
  // Screen readers hear the notice as the description of the (disabled) sign-in group.
  await expect(page.getByRole("group", { name: SIGN_IN_GROUP })).toHaveAccessibleDescription(/The client portal opens soon\./);
  await expect(page.getByLabel("Email")).toBeDisabled();
  await expect(page.getByLabel("Password")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Forgot password?" })).toBeDisabled();
});

test("clicking the disabled controls and pressing Enter sends nothing", async ({ page }) => {
  // Arrange: let the page finish loading (including link prefetches), then listen
  await page.waitForLoadState("networkidle");
  let requests: readonly string[] = [];
  page.on("request", (request) => {
    if (!isLinkPrefetch(request)) requests = [...requests, `${request.method()} ${request.url()}`];
  });
  const addressBefore = page.url();
  const controls = [
    page.getByLabel("Email"),
    page.getByLabel("Password"),
    page.getByRole("button", { name: "Sign In" }),
    page.getByRole("button", { name: "Forgot password?" }),
  ];

  // Act: force skips Playwright's "is it enabled?" wait; the browser still ignores the clicks
  for (const control of controls) {
    await control.click({ force: true });
  }
  await page.keyboard.press("Enter");

  // Assert
  expect(requests).toEqual([]);
  expect(page.url()).toBe(addressBefore);
});

test("with its controls switched back on, as in the developer tools, the sign-in group still sends nothing", async ({ page }) => {
  // Arrange: let the page finish loading, switch every control on, then listen
  await page.waitForLoadState("networkidle");
  await page.getByRole("group", { name: SIGN_IN_GROUP }).evaluate((group) => {
    group.removeAttribute("disabled");
    group.querySelectorAll("[disabled]").forEach((control) => control.removeAttribute("disabled"));
  });
  let requests: readonly string[] = [];
  page.on("request", (request) => {
    if (!isLinkPrefetch(request)) requests = [...requests, `${request.method()} ${request.url()}`];
  });
  const addressBefore = page.url();

  // Act: a GET form would put both values in the address on Enter or on Sign In
  await page.getByLabel("Email").fill("visitor@example.com");
  await page.getByLabel("Password").fill("not-a-real-password");
  await page.getByLabel("Password").press("Enter");
  await page.getByRole("button", { name: "Sign In" }).click();

  // Assert
  await expect(page.locator("form")).toHaveCount(0);
  expect(requests).toEqual([]);
  expect(page.url()).toBe(addressBefore);
});

test('"New project? Get in touch" opens the Contact page', async ({ page }) => {
  await page.getByRole("link", { name: "New project? Get in touch" }).click();

  await expectAt(page, CONTACT_PATH);
  await expect(page.getByRole("heading", { level: 1, name: "Request a Quote" })).toBeVisible();
});
