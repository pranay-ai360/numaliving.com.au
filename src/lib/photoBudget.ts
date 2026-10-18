/**
 * Works out which copy of a photo a browser takes from a `srcset` and `sizes`, and so which files a
 * page loads on first view. Used by the tests that keep the first view of every page light
 * (src/components/firstViewBudget.test.tsx); no page imports it.
 *
 * It understands only the `sizes` the site writes: `(min-width: Npx) <length>` entries, then a plain
 * length, with `px` and `vw` lengths. Anything else is refused rather than guessed.
 */

/** A screen: its width in CSS pixels and its density (device pixels per CSS pixel). */
export type Screen = Readonly<{ width: number; density: number }>;

type SizesEntry = Readonly<{ minWidth: number | null; length: string }>;

const LENGTH = /^(\d+(?:\.\d+)?)(px|vw)$/;
const CONDITIONAL_ENTRY = /^\(min-width:\s*(\d+(?:\.\d+)?)px\)\s+(\S+)$/;
const WIDTH_DESCRIPTOR = /^(\d+)w$/;

function lengthIn(length: string, screenWidth: number): number {
  const match = LENGTH.exec(length);
  if (match === null) throw new Error(`Cannot work out the length ${JSON.stringify(length)}: sizes may only use px and vw lengths.`);
  const amount = Number(match[1]);
  return match[2] === "px" ? amount : (amount / 100) * screenWidth;
}

function parseEntry(entry: string): SizesEntry {
  const conditional = CONDITIONAL_ENTRY.exec(entry);
  if (conditional !== null) {
    lengthIn(conditional[2], 0); // refuses a length it cannot work out, even where its condition would not apply
    return { minWidth: Number(conditional[1]), length: conditional[2] };
  }
  lengthIn(entry, 0);
  return { minWidth: null, length: entry };
}

/** How wide, in CSS pixels, the photo is drawn on a screen this wide: the first entry whose condition holds. */
export function slotWidth(sizes: string, screenWidth: number): number {
  const entries = sizes.split(",").map((entry) => parseEntry(entry.trim()));
  const last = entries[entries.length - 1];
  if (last.minWidth !== null) throw new Error(`The sizes ${JSON.stringify(sizes)} must end with a plain length, such as 100vw, for screens no condition matches.`);
  const match = entries.find((entry) => entry.minWidth === null || screenWidth >= entry.minWidth) ?? last;
  return lengthIn(match.length, screenWidth);
}

/** The narrowest copy at least as wide as `wantedWidth`, or the widest there is, as a browser chooses. */
export function pickCandidate(srcSet: string, wantedWidth: number): string {
  const candidates = srcSet
    .split(",")
    .map((entry) => entry.trim().split(/\s+/))
    .map(([url, descriptor]) => {
      const match = WIDTH_DESCRIPTOR.exec(descriptor ?? "");
      if (match === null) throw new Error(`Expected a width descriptor such as "480w" after ${url}, but found ${JSON.stringify(descriptor)}.`);
      return { url, width: Number(match[1]) };
    })
    .sort((first, second) => first.width - second.width);
  return (candidates.find((candidate) => candidate.width >= wantedWidth) ?? candidates[candidates.length - 1]).url;
}

function copyFor(picture: Element, screen: Screen): string {
  const avif = picture.querySelector('source[type="image/avif"]');
  const srcSet = avif?.getAttribute("srcset");
  const sizes = avif?.getAttribute("sizes");
  if (srcSet === null || srcSet === undefined || sizes === null || sizes === undefined) {
    throw new Error("A picture has no AVIF source with a srcset and sizes, so the budget cannot tell which file it loads.");
  }
  return pickCandidate(srcSet, slotWidth(sizes, screen.width) * screen.density);
}

/**
 * The files a browser on this screen loads for the pictures in `root`: the AVIF copy it would pick
 * for each, once per file. Pictures inside a closed `<details>` are left out (they are not fetched
 * until it is opened); lazy ones outside it are counted, which is the cautious way to count.
 */
export function firstViewCopies(root: ParentNode, screen: Screen): readonly string[] {
  const isOnShow = (element: Element): boolean => element.closest("details:not([open])") === null;
  const pictures = Array.from(root.querySelectorAll("picture")).filter(isOnShow);
  const loose = Array.from(root.querySelectorAll("img")).filter((image) => image.closest("picture") === null && isOnShow(image));
  const files = [...pictures.map((picture) => copyFor(picture, screen)), ...loose.map((image) => image.getAttribute("src") ?? "")];
  return [...new Set(files)];
}
