/**
 * US units with their metric twins, written the way the site writes them: the US figure first and the
 * metric one in parentheses ("194,000 sq ft (18,023 m²)"), which the US vocabulary guard
 * (src/lib/vocabulary.ts) accepts.
 */

/** Exact: a foot is defined as 0.3048 m, so a square foot is 0.3048 squared. */
const SQUARE_METERS_PER_SQUARE_FOOT = 0.3048 * 0.3048;

const NUMBER_LOCALE = "en-US";

/** An area in square feet, with its square meters in parentheses. Refuses a number that is not a positive area. */
export function formatSquareFeet(squareFeet: number): string {
  if (!Number.isFinite(squareFeet) || squareFeet <= 0) throw new Error(`An area must be a positive number of square feet, not ${squareFeet}.`);
  const usFigure = Math.round(squareFeet).toLocaleString(NUMBER_LOCALE);
  const metricFigure = Math.round(squareFeet * SQUARE_METERS_PER_SQUARE_FOOT).toLocaleString(NUMBER_LOCALE);
  return `${usFigure} sq ft (${metricFigure} m²)`;
}
