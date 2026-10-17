# Host the website as a static export on GitHub Pages

The site was built for Firebase, but its only backend need is emailing Quote Requests, and Cloud Storage for Firebase (which held the Drawings) has required the paid Blaze plan since 3 February 2026. We publish the Next.js static export to GitHub Pages with GitHub Actions, email Quote Requests and small PDF Drawings from the browser through FormSubmit.co, and keep Client Login as a design-only page. This costs nothing, needs no server and meets the hard requirement that the site deploys on GitHub Pages.

## Considered options

- **Firebase Hosting on the Blaze plan.** Keeps Firestore, Storage and Auth ready for the Client Portal, but adds a billing account and pay-as-you-go exposure for a site that only needs to send email.
- **Staying on Firebase with the Trigger Email extension.** Stores each Quote Request and emails it, but extensions also need Blaze, plus an SMTP provider, and we would hold visitor data we do not need yet.
- **A Cloudflare Worker relay.** Allows Cloudflare Turnstile and accepting submissions only from our own site, but adds an account, server code and secrets to look after. It stays the upgrade path if FormSubmit attracts spam.

## Consequences

- No server code: no API routes, middleware, rewrites or server-side secrets. Every `NEXT_PUBLIC_` value, including the FormSubmit alias, is public.
- Quote Requests depend on FormSubmit, a free third party with no SLA, no domain lock and no captcha over AJAX. It does not document attachments on its AJAX endpoint, so a live PDF test gates the launch, with an ordinary multipart form post as plan B. The form never reports success unless FormSubmit confirms, and offers email as the fallback.
- The Client Portal will need separate hosting with a backend; GitHub Pages cannot run it.
- The site is served from `/numaliving.com.au` until a custom domain is set. `next.config.ts` reads `NEXT_PUBLIC_BASE_PATH`, which the deploy workflow takes from `actions/configure-pages`, and raw `<img>` paths go through `withBasePath()`. With a custom domain the base path becomes empty without a code change.
- Crawlers ignore a project site's `robots.txt`, so a `noindex` meta tag, switched by `isIndexable` in `src/config/site.ts`, keeps the preview out of search. `robots.txt` allows crawling in both states, because a crawler must fetch a page to see that tag; a blocked page can still be listed from links elsewhere once a custom domain makes `robots.txt` count.
- **Update, 16 October 2026:** the site now has its own domain, so it is served from the domain root and the base path is empty. See [ADR 0002](0002-custom-domain-numaliving-us.md).
