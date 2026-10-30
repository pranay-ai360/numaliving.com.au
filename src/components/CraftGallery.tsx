import { Photo } from "./Photo";
import { MATERIAL_FILL } from "./ui";
import type { Material } from "@/lib/types";

/** A craft or factory photo: the source JPEG in /public/craft/ with its size in pixels, and its caption. `material` picks the placeholder colour. */
type CraftPhoto = { src: string; material: string; alt: string; caption: string; width: number; height: number };

/** How wide the gallery draws a photo at each screen width: the big one is half the grid from 768 px up, a small one a quarter. */
const LARGE_TILE_SIZES = "(min-width: 768px) 50vw, 100vw";
const SMALL_TILE_SIZES = "(min-width: 768px) 25vw, 50vw";

/**
 * One photo tile. Shows the real photo, with its AVIF and WebP copies (see `Photo`), if `src` is set,
 * otherwise a wood-tone placeholder. `sizes` says how wide the tile is drawn at each screen width.
 */
export function PhotoTile({ photo, sizes, className = "" }: { photo: CraftPhoto; sizes: string; className?: string }) {
  return (
    <figure className={`group relative overflow-hidden ${className}`}>
      {photo.src ? (
        <Photo photo={photo} sizes={sizes} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
      ) : (
        <div role="img" aria-label={photo.alt} className="h-full w-full" style={{ background: MATERIAL_FILL[photo.material as Material] ?? MATERIAL_FILL.oak }} />
      )}
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-3 pt-10 text-xs font-medium uppercase tracking-[0.2em] text-white">
        {photo.caption}
      </figcaption>
    </figure>
  );
}

/** Big photo on the left, four smaller ones on the right. Stacks to two columns on phones. */
export function CraftGallery({ photos }: { photos: CraftPhoto[] }) {
  const [first, ...rest] = photos;
  return (
    <div className="grid grid-cols-2 gap-2 md:h-[30rem] md:grid-cols-4 md:grid-rows-2">
      <PhotoTile photo={first} sizes={LARGE_TILE_SIZES} className="col-span-2 aspect-[4/3] md:aspect-auto md:row-span-2" />
      {rest.slice(0, 4).map((p) => (
        <PhotoTile key={p.caption} photo={p} sizes={SMALL_TILE_SIZES} className="aspect-square md:aspect-auto" />
      ))}
    </div>
  );
}
