/**
 * The brand colors as src/app/globals.css defines them, for the tests that check contrast, so they
 * follow the real palette instead of a copy of it. Used by tests only; no page imports it.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseHexColor, type Rgb } from "@/lib/contrast";

export const GLOBALS_CSS = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

/** A brand color from the `--brand-<name>` variables in globals.css. Refuses a name it does not have. */
export function brandColor(name: string): Rgb {
  const match = new RegExp(`--brand-${name}:\\s*(#[0-9a-fA-F]{3,6})`).exec(GLOBALS_CSS);
  if (match === null) throw new Error(`There is no --brand-${name} color in src/app/globals.css.`);
  return parseHexColor(match[1]);
}

/** The body of the first rule for `selector` in globals.css, such as ".eyebrow"; throws when there is none. */
export function cssRuleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(GLOBALS_CSS);
  if (match === null) throw new Error(`There is no ${selector} rule in src/app/globals.css.`);
  return match[1];
}

/** The brand color name a rule paints its text with: `color: var(--brand-gold-dark)` gives "gold-dark". */
export function textColorName(selector: string): string {
  const match = /(?<![-\w])color:\s*var\(--brand-([\w-]+)\)/.exec(cssRuleBody(selector));
  if (match === null) throw new Error(`The ${selector} rule in src/app/globals.css has no color: var(--brand-...).`);
  return match[1];
}
