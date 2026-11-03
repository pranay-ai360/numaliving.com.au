# Index every page before the launch blockers are cleared

On 3 November 2026 the site was still a `noindex` preview: `isIndexable` in `src/config/site.ts` was `false`, the client login was marked never indexable in the page registry, and Search Console listed every page it had found as excluded by its noindex tag. Turning `isIndexable` on would have failed the launch guard (`src/config/launchGuard.test.ts`), and with it the deploy, on 91 blockers: the placeholder phone, WhatsApp number and address, the Preview ribbon, 4 projects and 4 content blocks marked as sample content, 15 claims the owner has not confirmed, 8 legal-draft items (a lawyer's review of the privacy notice and of the terms, and 6 open points of the notice), 7 company facts not yet supplied, and 49 published photos that still carry camera metadata. The owner asked for every page to be indexed, with none excluded.

## Decision

- **Every page may be indexed.** `isIndexable` is `true`, and the client login's registry entry is `indexable: true` like every other page. No page carries a robots tag, `sitemap.xml` lists every page, and `robots.txt` names it.
- **The owner's acceptance is a switch, not a deleted check.** `launchBlockersAccepted` in `src/config/site.ts` is `true`. While it is, the launch guard passes with blockers left and skips the photo scan. Every blocker check stays, and its tests still run on fixtures. Like `isIndexable` and `showSampleNotice`, the switch must be a plain `true` or `false`: the guard's own test reads it from the file's text.
- **The rest of the site stays as it is.** The Preview ribbon stays on, so every page still says that its projects, figures and photos are sample content, and the Contact page and the structured data still leave out the phone number, WhatsApp number and address while they are placeholders (`src/lib/realContact.ts`): none of them appears on any page.

## Considered options

- **Keep the preview until the guard passes**, the plan of ADR 0003. Rejected by the owner, who wants the pages in search results now.
- **Delete the guard.** Rejected: its list is the to-do list for a launch without caveats, and turning the switch off makes the guard block again with no code to restore.
- **Index every page but the client login.** Rejected by the owner: no page is to be excluded.

## Consequences

- Search engines may list the sample projects and figures, the unconfirmed claims and the draft legal pages, and may show them in results until the pages change and are crawled again. The placeholder contact details are not on the pages, so they cannot be listed.
- Photos that still carry camera serial numbers and edit history can now be found through image search. The files were already public.
- The not-found page keeps its noindex: a missing page has nothing to index, and GitHub Pages answers it with a 404.
- `sitemap.xml` has to be submitted to Search Console again once this is deployed.
- `tools/seo/launch_check.py --mode live` still expects the client login to be `noindex` and left out of the sitemap, so it reports `login-noindex` and related failures for `/login/` until its rules (`tools/seo/launch_model.py`, `launch_site_checks.py` and `launch_documents.py`, with their tests) are updated. CI does not run it.
- To make the guard block again, set `launchBlockersAccepted` to `false`: the failing test then lists every blocker that is left, and the owner input pack (`docs/seo/owner-input-pack.md`) says what clears each one. To take the site back out of search, set `isIndexable` to `false`.
