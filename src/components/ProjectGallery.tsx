import type { ShowcasePhoto } from "@/lib/types";
import { Photo } from "./Photo";

/** How many gallery photos show straight away; the rest wait behind "Show all". */
export const GALLERY_VISIBLE_COUNT = 6;

/** `sizes` for a gallery photo: three columns beside the facts column from 1024 px, three from 640 px, two below. Only px and vw, see Photo.tsx. */
export const GALLERY_PHOTO_SIZES = "(min-width: 1024px) 22vw, (min-width: 640px) 31vw, 47vw";

function GalleryGrid({ photos, className = "" }: { photos: readonly ShowcasePhoto[]; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${className}`}>
      {photos.map((photo) => (
        <Photo key={photo.src} photo={photo} sizes={GALLERY_PHOTO_SIZES} className="aspect-square w-full object-cover" />
      ))}
    </div>
  );
}

/**
 * The photos of a project page below its main photo, which the page shows above. The first six
 * show at once; the others sit in a native `<details>` ("Show all N photos"), which works without
 * JavaScript, and, being lazy, are not fetched until it is opened. `photos` is the project's whole
 * list, cover first.
 */
export function ProjectGallery({ photos }: { photos: readonly ShowcasePhoto[] }) {
  const [, ...gallery] = photos;
  if (gallery.length === 0) return null;
  const shownNow = gallery.slice(0, GALLERY_VISIBLE_COUNT);
  const later = gallery.slice(GALLERY_VISIBLE_COUNT);
  return (
    <div className="mt-12">
      <GalleryGrid photos={shownNow} />
      {later.length > 0 && (
        <details className="mt-3">
          <summary className="inline-flex cursor-pointer list-none items-center justify-center rounded-sm border border-gold px-6 py-3 text-sm font-medium tracking-wide text-gold transition-colors hover:bg-gold hover:text-white [&::-webkit-details-marker]:hidden">
            Show all {photos.length} photos
          </summary>
          <GalleryGrid photos={later} className="mt-3" />
        </details>
      )}
    </div>
  );
}
