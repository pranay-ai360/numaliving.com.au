/**
 * Color contrast as WCAG 2 measures it, so the tests can prove that text laid over a photo stays
 * readable (src/components/HomeHero.test.tsx). Used by tests only; no page imports it.
 */

/** A color as red, green and blue, each 0 to 255. */
export type Rgb = readonly [number, number, number];

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const HEX_DIGITS_PER_CHANNEL = 2;
const MAX_CHANNEL = 255;

/** Reads "#ac8f50" or "#fff". Refuses anything else with a plain message. */
export function parseHexColor(hex: string): Rgb {
  if (!HEX_COLOR.test(hex)) throw new Error(`${JSON.stringify(hex)} is not a hex color such as "#ac8f50".`);
  const digits = hex.length === 4 ? Array.from(hex.slice(1), (digit) => `${digit}${digit}`).join("") : hex.slice(1);
  const channel = (index: number): number => Number.parseInt(digits.slice(index * HEX_DIGITS_PER_CHANNEL, (index + 1) * HEX_DIGITS_PER_CHANNEL), 16);
  return [channel(0), channel(1), channel(2)];
}

function toLinear(channel: number): number {
  const scaled = channel / MAX_CHANNEL;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

/** 0 for black to 1 for white, the way the eye weighs red, green and blue. */
export function relativeLuminance([red, green, blue]: Rgb): number {
  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue);
}

/** 1 (no contrast) to 21 (black on white). WCAG asks for 4.5 for body text and 3 for large text and controls. */
export function contrastRatio(first: Rgb, second: Rgb): number {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/** What shows when `top` is laid over `under` at `opacity` (0 is invisible, 1 hides what is underneath). */
export function blend(top: Rgb, opacity: number, under: Rgb): Rgb {
  if (!(opacity >= 0 && opacity <= 1)) throw new Error(`Opacity must be between 0 and 1, not ${opacity}.`);
  const mix = (index: 0 | 1 | 2): number => opacity * top[index] + (1 - opacity) * under[index];
  return [mix(0), mix(1), mix(2)];
}
