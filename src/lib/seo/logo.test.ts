import { readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { LOGO_PATH } from "@/lib/seo/jsonld";

// Vitest runs from the repository root (npm test, npm run test:coverage).
const ROOT = process.cwd();

/** Google asks for a logo of at least 112 x 112 pixels. */
const MIN_LOGO_SIDE = 112;

describe("the logo that the structured data points at", () => {
  it("is a PNG in public/, because structured data needs the address of a file, not of a generated icon", async () => {
    // Arrange
    const file = path.join(ROOT, "public", LOGO_PATH);

    // Act
    const metadata = await sharp(file).metadata();

    // Assert
    expect(metadata.format).toBe("png");
    expect(Math.min(metadata.width ?? 0, metadata.height ?? 0)).toBeGreaterThanOrEqual(MIN_LOGO_SIDE);
  });

  it("is a byte-for-byte copy of the site icon in src/app/icon.png, so the two never differ", () => {
    // Arrange
    const [logo, icon] = [path.join(ROOT, "public", LOGO_PATH), path.join(ROOT, "src/app/icon.png")].map((file) => readFileSync(file));

    // Act
    const isSame = logo.equals(icon);

    // Assert
    expect(isSame).toBe(true);
  });
});
