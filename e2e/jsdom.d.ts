// jsdom ships no types, and @types/jsdom is not a dependency of this project. The end-to-end tests use
// jsdom for two things: reading the text of a page (e2e/page-text.ts) and parsing sitemap.xml, which it
// refuses to do when the XML is malformed. Only the part they use is described here.
declare module "jsdom" {
  export class JSDOM {
    constructor(source: string, options?: { contentType?: string });
    readonly window: { readonly document: Document };
  }
}
