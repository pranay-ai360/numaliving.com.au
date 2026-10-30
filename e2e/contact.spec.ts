import { site } from "../src/config/site";
import { HONEYPOT_FIELD_NAME } from "../src/components/quote-form/constants";
import { formatFileSize } from "../src/lib/quotes/drawings";
import {
  FORMSUBMIT_ACCEPTED,
  FORMSUBMIT_ACCEPTED_PAGE,
  FORMSUBMIT_REFUSED_PAGE,
  FORMSUBMIT_SERVER_ERROR,
  QUOTE,
  attachDrawings,
  fileField,
  fillQuoteRequest,
  makePdf,
  mockFormSubmit,
  mockFormSubmitPage,
  openContactForm,
  passMinimumFillTime,
  readSubmission,
  sendRequest,
  textFields,
  thankYouPanel,
} from "./contact-form";
import { expect, test } from "./fixtures";
import { CONTACT_PATH, pageUrl } from "./site";

const REFERENCE = /NL-[A-Z2-9]{6}/;
const PDF_SIGNATURE = "%PDF-1.4";

/** The "Email us instead" address: the short reason code goes in the subject. */
function fallbackHref(reason: string): string {
  return `mailto:${site.contact.email}?subject=${encodeURIComponent(`Quote Request (website error: ${reason})`)}`;
}

test.beforeEach(async ({ page }) => {
  await openContactForm(page);
});

test("sends a Quote Request with a PDF to FormSubmit's ordinary endpoint and shows the reference", async ({ page }) => {
  // Arrange: attachments only travel on the ordinary endpoint, which answers with a page
  const calls = await mockFormSubmitPage(page, FORMSUBMIT_ACCEPTED_PAGE);
  const drawing = makePdf("ground-floor-plan.pdf");
  await fillQuoteRequest(page);
  await attachDrawings(page, [drawing]);
  await expect(page.getByRole("button", { name: `Remove ${drawing.name}` })).toBeVisible();
  await passMinimumFillTime(page);

  // Act
  await sendRequest(page);

  // Assert: the visitor lands on the thank-you, which shows a reference and how to follow up
  const thankYou = thankYouPanel(page);
  await expect(thankYou).toContainText(new RegExp(`Reference: ${REFERENCE.source}`));
  await expect(page.getByRole("heading", { name: "Thank You" })).toBeFocused();
  const reference = (await thankYou.textContent())?.match(REFERENCE)?.[0];
  await expect(thankYou.getByRole("link", { name: site.contact.email })).toHaveAttribute(
    "href",
    `mailto:${site.contact.email}?subject=${encodeURIComponent(`Quote Request ${reference}`)}`,
  );

  // Assert: exactly one multipart POST went to FormSubmit's ordinary endpoint (not /ajax/) over HTTPS
  expect(calls()).toHaveLength(1);
  const [call] = calls();
  expect(call.method()).toBe("POST");
  expect(call.url()).toMatch(/^https:\/\/formsubmit\.co\/[^/?#]+$/);
  expect(call.headers()["content-type"]).toMatch(/^multipart\/form-data; boundary=/);

  // Assert: the email table has readable labels, FormSubmit's options, the same reference, and the PDF count
  const form = await readSubmission(call);
  expect(textFields(form)).toMatchObject({
    "Full name": QUOTE.name,
    Company: QUOTE.company,
    Email: QUOTE.email,
    Role: QUOTE.role,
    "Project type": QUOTE.projectType,
    "Site location": QUOTE.location,
    Timeline: QUOTE.timeline,
    "Scope and notes": QUOTE.message,
    "Attached drawings": `Expect 1 PDF attached: ${drawing.name} (${formatFileSize(drawing.buffer.length)})`,
    Reference: reference,
    _subject: `Quote Request ${reference}: ${QUOTE.projectType}, ${QUOTE.location} [1 PDF]`,
    _template: "table",
    _captcha: "false",
    _replyto: QUOTE.email,
  });

  // Assert: the PDF itself is attached
  const attachment = fileField(form, "attachment");
  expect(attachment.name).toBe(drawing.name);
  expect(attachment.type).toBe("application/pdf");
  expect(attachment.size).toBe(drawing.buffer.length);
  expect(Buffer.from(await attachment.arrayBuffer()).subarray(0, PDF_SIGNATURE.length).toString("latin1")).toBe(PDF_SIGNATURE);
});

test("sends a Quote Request without Drawings to FormSubmit's AJAX endpoint and shows the reference", async ({ page }) => {
  // Arrange
  const calls = await mockFormSubmit(page, FORMSUBMIT_ACCEPTED);
  await fillQuoteRequest(page);
  await passMinimumFillTime(page);

  // Act
  await sendRequest(page);

  // Assert
  await expect(thankYouPanel(page)).toContainText(new RegExp(`Reference: ${REFERENCE.source}`));
  expect(calls()).toHaveLength(1);
  const [call] = calls();
  expect(call.url()).toMatch(/^https:\/\/formsubmit\.co\/ajax\/[^/?#]+$/);
  expect(call.headers().accept).toBe("application/json");
  const form = await readSubmission(call);
  expect(textFields(form)).toMatchObject({ "Attached drawings": "None", Email: QUOTE.email });
  expect(Array.from(form.keys()).filter((name) => name.startsWith("attachment"))).toEqual([]);
});

test.describe("when FormSubmit fails with Drawings attached", () => {
  test("shows an alert with an email fallback for a page that is not the success page, and keeps the PDF", async ({
    page,
  }) => {
    // Arrange
    const calls = await mockFormSubmitPage(page, FORMSUBMIT_REFUSED_PAGE);
    const drawing = makePdf("ground-floor-plan.pdf");
    await fillQuoteRequest(page);
    await attachDrawings(page, [drawing]);
    await passMinimumFillTime(page);

    // Act
    await sendRequest(page);

    // Assert: an unrecognised page is "could not confirm", never a thank-you, and the visitor can try again
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toContainText("We could not confirm that your request was received.");
    await expect(alert).not.toContainText("Check email address");
    await expect(alert.getByRole("link", { name: "Email us instead" })).toHaveAttribute("href", fallbackHref("invalid-response"));
    await expect(page.getByRole("heading", { name: "Thank You" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Remove ${drawing.name}` })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send Request" })).toBeEnabled();
    expect(calls()).toHaveLength(1);
  });
});

test.describe("when FormSubmit fails", () => {
  // The browser logs its own console line for the 500 answer.
  test.use({ allowedConsoleErrors: [/status of 500/] });

  test("shows an alert with an email fallback that names the reason, and lets the visitor try again", async ({ page }) => {
    // Arrange
    await mockFormSubmit(page, FORMSUBMIT_SERVER_ERROR);
    await fillQuoteRequest(page);
    await passMinimumFillTime(page);

    // Act
    await sendRequest(page);

    // Assert
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toContainText("Our form service did not accept your request.");
    await expect(alert).not.toContainText("Internal Server Error");
    await expect(alert.getByRole("link", { name: "Email us instead" })).toHaveAttribute("href", fallbackHref("rejected"));
    await expect(page.getByRole("button", { name: "Send Request" })).toBeEnabled();
    await expect(page.getByRole("heading", { name: "Thank You" })).toHaveCount(0);
  });
});

test("a filled honeypot looks sent to the bot but sends nothing", async ({ page }) => {
  // Arrange
  const calls = await mockFormSubmit(page, FORMSUBMIT_ACCEPTED);
  await fillQuoteRequest(page);
  await page.locator(`input[name="${HONEYPOT_FIELD_NAME}"]`).evaluate((input: HTMLInputElement) => {
    input.value = "https://spam.example";
  });
  await passMinimumFillTime(page);

  // Act
  await sendRequest(page);

  // Assert
  await expect(thankYouPanel(page)).toContainText("Thank You");
  expect(calls()).toHaveLength(0);
});

test("the static HTML form, before its script runs, cannot be sent and would never put details in the address", async ({
  request,
}) => {
  // Arrange / Act
  const html = await (await request.get(pageUrl(CONTACT_PATH))).text();

  // Assert
  const formTag = html.match(/<form\b[^>]*>/)?.[0] ?? "";
  const sendButtonTag = html.match(/<button\b[^>]*\btype="submit"[^>]*>/)?.[0] ?? "";
  expect(formTag).toContain('method="post"');
  expect(sendButtonTag).toMatch(/\sdisabled(=""|\s|>)/);
});
