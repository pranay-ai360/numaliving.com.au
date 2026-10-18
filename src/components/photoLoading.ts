/**
 * How a photo loads. Kept apart from ui.tsx and Photo.tsx so that both can use it without importing
 * each other. ui.tsx re-exports `LAZY_IMAGE_PROPS` and `PhotoLoading` for the code that already imports them there.
 */

/** For photos below the fold: fetched only as they near the screen, and decoded off the main thread. */
export const LAZY_IMAGE_PROPS = { loading: "lazy", decoding: "async" } as const;

/** For photos in view on arrival, such as the first row of project cards: fetched straight away, decoded off the main thread. */
const EAGER_IMAGE_PROPS = { loading: "eager", decoding: "async" } as const;

/** For the one photo in view on arrival (a project page's main photo): fetched straight away, ahead of other images. */
const PRIORITY_IMAGE_PROPS = { loading: "eager", fetchPriority: "high" } as const;

/**
 * How a project photo loads: "lazy" (the default) below the fold, "eager" when it is in view on
 * arrival, and "priority" for a page's main photo.
 */
export type PhotoLoading = "lazy" | "eager" | "priority";

export const PHOTO_LOADING_PROPS = {
  lazy: LAZY_IMAGE_PROPS,
  eager: EAGER_IMAGE_PROPS,
  priority: PRIORITY_IMAGE_PROPS,
} as const satisfies Record<PhotoLoading, object>;
