import { DRAWINGS_LIMITS, formatFileSize } from "../src/lib/quotes/drawings";
import { attachDrawings, dropDrawings, makeFakePdf, makePdf, waitForFormReady } from "./contact-form";
import { expect, test } from "./fixtures";
import { CONTACT_PATH, pageUrl } from "./site";

const NOT_A_VALID_PDF = "is not a valid PDF. Please save or export the drawing as a PDF and attach it again.";

test.beforeEach(async ({ page }) => {
  await page.goto(pageUrl(CONTACT_PATH));
  await waitForFormReady(page);
});

test("a file that is not a PDF is refused with a message", async ({ page }) => {
  // Arrange
  const notes = { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("Not a drawing.") };

  // Act
  await attachDrawings(page, [notes]);

  // Assert
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("notes.txt is not a PDF. Drawings must be PDF files.");
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
});

test("a file named .pdf whose contents are not a PDF is refused with a message", async ({ page }) => {
  // Arrange
  const renamed = makeFakePdf("site-photo.pdf");

  // Act
  await attachDrawings(page, [renamed]);

  // Assert
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(`site-photo.pdf ${NOT_A_VALID_PDF}`);
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
});

test("Drawings over the total size limit are refused with a message", async ({ page }) => {
  // Arrange: two PDFs that are each allowed but together just over the limit
  const halfOverLimit = Math.floor(DRAWINGS_LIMITS.maxTotalBytes / 2) + 1;
  const sheets = [makePdf("sheet-1.pdf", halfOverLimit), makePdf("sheet-2.pdf", halfOverLimit)];

  // Act
  await attachDrawings(page, sheets);

  // Assert
  await expect(page.getByRole("main").getByRole("alert")).toContainText(`over the ${formatFileSize(DRAWINGS_LIMITS.maxTotalBytes)} limit`);
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
});

test("files dropped on the drop zone go through the same checks as chosen ones", async ({ page }) => {
  // Arrange
  const plan = makePdf("dropped-plan.pdf");
  const renamed = makeFakePdf("dropped-photo.pdf");

  // Act
  await dropDrawings(page, [plan, renamed]);

  // Assert
  await expect(page.getByRole("button", { name: `Remove ${plan.name}` })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(`${renamed.name} ${NOT_A_VALID_PDF}`);
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(1);
});
