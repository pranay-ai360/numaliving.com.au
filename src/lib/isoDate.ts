const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * True when the text is a real calendar day written YYYY-MM-DD, the form a browser's date field sends
 * ("2026-11-12"). A day that does not exist ("2026-02-30") is refused, not rolled over to March.
 */
export function isIsoCalendarDay(text: string): boolean {
  const match = ISO_DAY.exec(text);
  if (match === null) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
