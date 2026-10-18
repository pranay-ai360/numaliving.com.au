// jsdom ships no types, and @types/jsdom is not a dependency of this project. The end-to-end tests use
// jsdom for one thing: parsing sitemap.xml, which it refuses to do when the XML is malformed. Only that
// part is described here.
declare module "jsdom" {
  export class JSDOM {
    constructor(source: string, options?: { contentType?: string });
    readonly window: { readonly document: Document };
  }
}
