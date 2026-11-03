import { withBasePath } from "@/lib/assetPath";
import { PHOTO_FORMATS, photoSrcSet } from "@/lib/photoVariants";
import type { ShowcasePhoto } from "@/lib/types";
import { PHOTO_LOADING_PROPS, type PhotoLoading } from "./photoLoading";

type PhotoProps = {
  photo: ShowcasePhoto;
  /**
   * The `sizes` attribute: how wide the photo is drawn at each screen width (for example
   * "(min-width: 1024px) 33vw, 100vw"), which the browser uses to pick a copy. Use only `px` and `vw`
   * lengths, so the image-weight test can work out which copy a screen picks.
   */
  sizes: string;
  loading?: PhotoLoading;
  className?: string;
};

/**
 * A project photo: an AVIF and a WebP source at several widths (written by `npm run images:build`,
 * see scripts/optimize-images.mjs), and the original JPEG as the fallback. The width and height give
 * the browser the picture's proportions before it loads, so the page does not jump.
 */
export function Photo({ photo, sizes, loading = "lazy", className }: PhotoProps) {
  return (
    <picture>
      {PHOTO_FORMATS.map((format) => (
        <source key={format} type={`image/${format}`} srcSet={photoSrcSet(photo.src, format, photo.width, withBasePath)} sizes={sizes} />
      ))}
      <img src={withBasePath(photo.src)} alt={photo.alt} width={photo.width} height={photo.height} {...PHOTO_LOADING_PROPS[loading]} className={className} />
    </picture>
  );
}
