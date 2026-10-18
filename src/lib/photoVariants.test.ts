import { describe, expect, it } from "vitest";
import { PHOTO_FORMATS, PHOTO_WIDTHS, photoSrcSet, variantPath, variantWidths, type PhotoFormat } from "@/lib/photoVariants";
// The script that writes the files and the page that links them must agree on every name, so the
// script's own helpers are the reference here.
import { VARIANT_FORMATS, VARIANT_WIDTHS, variantPathFor, variantWidthsFor } from "../../scripts/image-plan.mjs";

const PHOTO = "/projects/golf-links/golf-links-01.jpg";

describe("variantWidths", () => {
  it("offers the four standard widths for a photo as wide as the largest", () => {
    // Arrange
    const photoWidth = 1600;

    // Act
    const widths = variantWidths(photoWidth);

    // Assert
    expect(widths).toEqual([480, 800, 1200, 1600]);
  });

  it.each([
    [1500, [480, 800, 1200]],
    [1200, [480, 800, 1200]],
    [1000, [480, 800]],
    [480, [480]],
  ])("never offers a width above the photo's own: %i px gives %j", (photoWidth, expected) => {
    // Arrange
    // (the table above supplies the width)

    // Act
    const widths = variantWidths(photoWidth);

    // Assert
    expect(widths).toEqual(expected);
  });

  it("caps a very wide photo at the largest standard width", () => {
    // Arrange
    const photoWidth = 5000;

    // Act
    const widths = variantWidths(photoWidth);

    // Assert
    expect(widths).toEqual([480, 800, 1200, 1600]);
  });

  it("offers a photo narrower than the smallest standard width only at its own width", () => {
    // Arrange
    const photoWidth = 300;

    // Act
    const widths = variantWidths(photoWidth);

    // Assert
    expect(widths).toEqual([300]);
  });

  it.each([0, -800, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects %s as a photo width", (photoWidth) => {
    // Arrange
    // (the table above supplies the width)

    // Act
    const act = (): readonly number[] => variantWidths(photoWidth);

    // Assert
    expect(act).toThrow(/whole number of pixels/);
  });

  it("returns a new list on every call, so callers cannot share state", () => {
    // Arrange
    const first = variantWidths(1600);

    // Act
    const second = variantWidths(1600);

    // Assert
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });
});

describe("variantPath", () => {
  it("puts the width and the format after the photo's name, in the same folder", () => {
    // Arrange
    const format: PhotoFormat = "avif";

    // Act
    const path = variantPath(PHOTO, 800, format);

    // Assert
    expect(path).toBe("/projects/golf-links/golf-links-01-800.avif");
  });

  it("accepts the .jpeg spelling and a capital extension", () => {
    // Arrange
    const sources = ["/projects/x/x-01.jpeg", "/projects/x/x-01.JPG"];

    // Act
    const paths = sources.map((source) => variantPath(source, 480, "webp"));

    // Assert
    expect(paths).toEqual(["/projects/x/x-01-480.webp", "/projects/x/x-01-480.webp"]);
  });

  it.each(["/projects/x/x-01.png", "/projects/x/x-01", "/projects/x/x-01.jpg.bak"])("rejects %s, which is not a JPEG photo", (source) => {
    // Arrange
    // (the table above supplies the path)

    // Act
    const act = (): string => variantPath(source, 800, "avif");

    // Assert
    expect(act).toThrow(/must be a \.jpg or \.jpeg photo/);
  });
});

describe("photoSrcSet", () => {
  it("lists every variant that fits the photo with its width, narrowest first", () => {
    // Arrange
    const format: PhotoFormat = "avif";

    // Act
    const srcSet = photoSrcSet(PHOTO, format, 1600);

    // Assert
    expect(srcSet).toBe(
      "/projects/golf-links/golf-links-01-480.avif 480w, /projects/golf-links/golf-links-01-800.avif 800w, /projects/golf-links/golf-links-01-1200.avif 1200w, /projects/golf-links/golf-links-01-1600.avif 1600w",
    );
  });

  it("lists only the widths that fit a narrower photo", () => {
    // Arrange
    const photoWidth = 1000;

    // Act
    const srcSet = photoSrcSet(PHOTO, "webp", photoWidth);

    // Assert
    expect(srcSet).toBe("/projects/golf-links/golf-links-01-480.webp 480w, /projects/golf-links/golf-links-01-800.webp 800w");
  });

  it("passes each path through the resolver it is given, such as the base path", () => {
    // Arrange
    const resolve = (path: string): string => `/numaliving.com.au${path}`;

    // Act
    const srcSet = photoSrcSet(PHOTO, "avif", 480, resolve);

    // Assert
    expect(srcSet).toBe("/numaliving.com.au/projects/golf-links/golf-links-01-480.avif 480w");
  });
});

describe("agreement with scripts/image-plan.mjs", () => {
  it("uses the same standard widths and formats", () => {
    // Arrange
    // (both modules are imported above)

    // Act
    const [widths, formats] = [PHOTO_WIDTHS, PHOTO_FORMATS];

    // Assert
    expect(widths).toEqual(VARIANT_WIDTHS);
    expect(formats).toEqual(VARIANT_FORMATS);
  });

  it.each([100, 300, 479, 480, 481, 799, 800, 1199, 1200, 1599, 1600, 1601, 4000])("offers the same widths for a photo %i px wide", (photoWidth) => {
    // Arrange
    // (the table above supplies the width)

    // Act
    const [fromApp, fromScript] = [variantWidths(photoWidth), variantWidthsFor(photoWidth)];

    // Assert
    expect(fromApp).toEqual(fromScript);
  });

  it("names every variant file the same way", () => {
    // Arrange
    const sources = ["/projects/golf-links/golf-links-01.jpg", "/projects/sonate/sonate-03.jpg"];

    // Act
    const mismatches = sources.flatMap((source) =>
      PHOTO_WIDTHS.flatMap((width) =>
        PHOTO_FORMATS.filter((format) => variantPath(source, width, format) !== `/${variantPathFor(`public${source}`, width, format).replace(/^public\//, "")}`),
      ),
    );

    // Assert
    expect(mismatches).toEqual([]);
  });
});
