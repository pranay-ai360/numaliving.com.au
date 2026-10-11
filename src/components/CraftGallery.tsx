import { LAZY_IMAGE_PROPS, MATERIAL_FILL } from "./ui";
import { withBasePath } from "@/lib/assetPath";
import type { Material } from "@/lib/types";

type Photo = { src: string; material: string; alt: string; caption: string };

/** One photo tile. Shows the real image if `src` is set, otherwise a wood-tone placeholder. */
export function PhotoTile({ photo, className = "" }: { photo: Photo; className?: string }) {
  return (
    <figure className={`group relative overflow-hidden ${className}`}>
      {photo.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={withBasePath(photo.src)} alt={photo.alt} {...LAZY_IMAGE_PROPS} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
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
export function CraftGallery({ photos }: { photos: Photo[] }) {
  const [first, ...rest] = photos;
  return (
    <div className="grid grid-cols-2 gap-2 md:h-[30rem] md:grid-cols-4 md:grid-rows-2">
      <PhotoTile photo={first} className="col-span-2 aspect-[4/3] md:aspect-auto md:row-span-2" />
      {rest.slice(0, 4).map((p) => (
        <PhotoTile key={p.caption} photo={p} className="aspect-square md:aspect-auto" />
      ))}
    </div>
  );
}
