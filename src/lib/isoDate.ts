const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The first and last year a date may name, so a typo such as 0202 or 2206 is refused instead of sent on. */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/**
 * True when the text is a real calendar day written YYYY-MM-DD, the form a browser's date field sends
 * ("2026-11-12"), in a year from 2000 to 2100. A day that does not exist ("2026-02-30") is refused, not
 * rolled over to March.
 */
export function isIsoCalendarDay(text: string): boolean {
  const match = ISO_DAY.exec(text);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
