/**
 * The words in a served page, for the request-only specs that read what a visitor, a screen reader or a
 * search engine gets: the vocabulary spec and the home page's first-screen check.
 */
import { JSDOM } from "jsdom";

/** DOM's NodeFilter.SHOW_TEXT. jsdom's window is typed here without NodeFilter, and Node has no global one. */
const SHOW_TEXT = 4;

/** Elements whose attributes carry words: alt text, labels, tooltips, placeholders and the meta tags (description, share cards). */
const TEXT_ATTRIBUTE_SELECTOR = "[alt], [title], [aria-label], [placeholder], meta[content]";
const TEXT_ATTRIBUTES = ["alt", "title", "aria-label", "placeholder", "content"] as const;
const STRUCTURED_DATA_SELECTOR = 'script[type="application/ld+json"]';

function removeScriptsAndStyles(document: Document): void {
  document.querySelectorAll("script, style").forEach((element) => element.remove());
}

/**
 * The text under `root` in page order, each piece apart from the next by a space, so words in
 * neighboring elements ("Walk-in" and "wardrobes" in two list items) never run together.
 */
function textUnder(root: Node, document: Document): string {
  const walker = document.createTreeWalker(root, SHOW_TEXT);
  const pieces: string[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) pieces.push(node.textContent ?? "");
  return pieces.join(" ").replace(/\s+/g, " ").trim();
}

/** What a visitor reads, from the top of the page: the body's text, with scripts and styles left out. */
export function bodyText(html: string): string {
  const { document } = new JSDOM(html).window;
  removeScriptsAndStyles(document);
  return textUnder(document.body, document);
}

/**
 * Everything a page says: its text (the title included), the words in its attributes (alt text, labels,
 * meta tags) and its structured data (JSON-LD), which search engines read as copy too.
 */
export function servedText(html: string): string {
  const { document } = new JSDOM(html).window;
  const structuredData = Array.from(document.querySelectorAll(STRUCTURED_DATA_SELECTOR), (script) => script.textContent ?? "");
  removeScriptsAndStyles(document);
  const attributeText = Array.from(document.querySelectorAll(TEXT_ATTRIBUTE_SELECTOR), (element) =>
    TEXT_ATTRIBUTES.map((name) => element.getAttribute(name) ?? "").join(" "),
  );
  return [textUnder(document.documentElement, document), ...attributeText, ...structuredData].join("\n");
}
