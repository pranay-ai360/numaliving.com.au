import { serializeJsonLd, type JsonLdNode } from "@/lib/seo/jsonld";

/**
 * Structured data for search engines: one `<script type="application/ld+json">` with the entity (or
 * the list of entities) given. This is the only place on the site that sets HTML from a string.
 * That is safe here because the text comes from `serializeJsonLd`, which writes every "<" as <
 * (and the line and paragraph separators as escapes), so no value can close the script tag or open
 * another; see src/lib/seo/jsonld.ts and the tests beside this file.
 */
export function JsonLd({ data }: { data: JsonLdNode | readonly JsonLdNode[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
