/** Web addresses the site publishes or accepts must be encrypted: a plain http:// link, or anything that is not a web address, is refused. */
const SECURE_WEB_PROTOCOL = "https:";

/** True when the text is a complete web address that starts with https://. */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === SECURE_WEB_PROTOCOL;
  } catch {
    // Not parseable as a web address at all: that is a refusal, which the caller reports.
    return false;
  }
}
