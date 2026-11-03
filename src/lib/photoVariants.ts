/**
 * The files that go with a photo: scripts/optimize-images.mjs writes an AVIF and a WebP at several
 * widths next to each source JPEG, and the `Photo` component lists them in a `srcset`. The names and
 * widths here must match the script's (scripts/image-plan.mjs); src/lib/photoVariants.test.ts checks
 * that they do.
 */

/** The standard widths, in pixels. The largest is the full width of the source photos. */
export const PHOTO_WIDTHS = [480, 800, 1200, 1600] as const;

export type PhotoFormat = "avif" | "webp";

/** Most efficient first: a browser takes the first `<source>` whose format it can show. */
export const PHOTO_FORMATS: readonly PhotoFormat[] = ["avif", "webp"];

const JPEG_EXTENSION = /\.jpe?g$/i;

/**
 * The widths a photo is offered in: the standard ones up to its own width, never above it. A photo
 * narrower than the smallest standard width is offered only at its own.
 */
export function variantWidths(photoWidth: number): readonly number[] {
  if (!Number.isInteger(photoWidth) || photoWidth <= 0) {
    throw new Error(`A photo's width must be a whole number of pixels above 0, but it is ${photoWidth}.`);
  }
  const fitting = PHOTO_WIDTHS.filter((width) => width <= photoWidth);
  return fitting.length > 0 ? fitting : [photoWidth];
}

/** Where a variant is: next to the source photo, with the width and the format after its name. */
export function variantPath(src: string, width: number, format: PhotoFormat): string {
  if (!JPEG_EXTENSION.test(src)) {
    throw new Error(`The photo ${JSON.stringify(src)} must be a .jpg or .jpeg photo.`);
  }
  return `${src.replace(JPEG_EXTENSION, "")}-${width}.${format}`;
}

/** The `srcset` of one format: every variant that fits the photo, narrowest first, each with its width. */
export function photoSrcSet(src: string, format: PhotoFormat, photoWidth: number, resolve: (path: string) => string = (path) => path): string {
  return variantWidths(photoWidth)
    .map((width) => `${resolve(variantPath(src, width, format))} ${width}w`)
    .join(", ");
}
