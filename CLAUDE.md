# Numa Living website: guide for Claude Code

A static Next.js 16 site (React 19, Tailwind 4, Zod) for Numa Living, a luxury custom millwork maker. It is exported to plain files and served by GitHub Pages at https://numaliving.us/. There is no server code. Start with [`README.md`](README.md); the vocabulary is in [`CONTEXT.md`](CONTEXT.md), the operating commands in [`docs/RUNBOOK.md`](docs/RUNBOOK.md), and the reasons behind big choices in [`docs/adr/`](docs/adr/).

## Commands

```bash
npm ci
npm audit --omit=dev --audit-level=high # CI runs this first; a high or critical advisory fails the run
npm run lint && npm run typecheck
npm run test:coverage                    # Vitest; keep coverage at 80% or more (about 99% today)
npm run build:e2e && npm run test:e2e    # Playwright against a static build
python3 -m unittest discover -s tools/seo/tests    # the SEO research tools (tools/seo/README.md); offline, not run in CI
npm run test:live                        # after a deploy: read-only Playwright smoke test of the live site (e2e-live/)
```

Run Playwright with `CHROMIUM_EXECUTABLE_PATH` set to a Chrome-family binary (the installed Google Chrome works). See the runbook for details.

## How a change ships

Branch, then `gh pr create`, `gh pr checks --watch`, `gh pr merge --merge`. A pull request runs the `verify` job only; a push to `main` runs `verify`, `build` and `deploy` (`.github/workflows/deploy.yml`). Ask before pushing, merging or changing GitHub or Cloudflare settings, and plan bigger changes with `/ecc:plan`, waiting for an explicit yes.

## Single sources of truth

- **Contact details:** `site.contact` in `src/config/site.ts` (the address is kept in parts). One rule (`src/lib/realContact.ts`) decides which of the phone number, WhatsApp number and address are real: the Contact page shows, and the structured data publishes, only those. Change the email only there and in its pin, `src/config/site.test.ts`; every other test reads `site.contact.email`. `src/config/launchGuard.test.ts` keeps the old placeholder email as its fixture on purpose.
- **Where Quote Requests go:** the FormSubmit alias in the repository variable `FORMSUBMIT_ID`. It is public by design. The deploy fails if it contains `@` or is `e2e-form-id`. Changing it takes effect at the next deploy.
- **Search visibility:** `isIndexable` in `src/config/site.ts` is `false`, so every page is `noindex`; it must stay a plain `true` or `false` literal (a test reads the file's text). The launch guard test stops it being set to `true` while placeholder or sample content remains (phone, WhatsApp, address, sample projects, the Preview ribbon, and everything in `contentBlockers()`: sample figures listed in `sampleContent`, company facts not yet supplied, the legal drafts and their open points, the claims in `unconfirmedClaims` that the owner has not confirmed).
- **Company facts and what blocks launch:** the owner's confirmed facts (legal name, founding year, factory area, headcount, certifications, leadership, parent group link) live in `src/content/company.ts` (empty today; the About page shows only what is set, and the Organization structured data publishes the legal name and founding year only once `publishableFacts` accepts them). `contentBlockers()` in `src/content/readiness.ts` is the one list of content-side blockers (sample figures, missing company facts, the privacy and terms drafts and their open points in `src/content/legal.ts`, the claims in `src/content/claims.ts` that only the owner can confirm); a module with blockers of its own adds a function there, and `src/config/launchGuard.test.ts` reads only that list. Tests of the blockers start from `src/content/blockerFixtures.ts`, never from the live lists, so clearing a real entry needs no test edit.
- **US wording:** `src/lib/vocabulary.ts` (`findUkTerms`) rejects UK-only words (including labelled, travelled, catalogue, litre, fit-out) and bare metric units, symbols or spelled out; `src/content/vocabulary.test.ts` and `e2e/vocabulary.spec.ts` run it over the copy and every served page. Write US English (millwork, closets, paneling, schedule, color, bid, inquiry, quantity takeoff, general contractor, sq ft with metric in parentheses). Never state a fact about Numa that the repo does not already state: a new claim goes into `src/content/claims.ts` before it goes on a page.
- **Base path:** `NEXT_PUBLIC_BASE_PATH`, filled in by `actions/configure-pages` (empty on numaliving.us).
- **Search metadata:** every page's title, description, share image and `updated` date is in `src/content/seo.ts` (the page registry); the builders are in `src/lib/seo/`. The sitemap lists pages, and `robots.txt` names it, only while `isIndexable` is true.

## Domain and infrastructure

numaliving.us is registered at GoDaddy, its DNS is on Cloudflare (every site record "DNS only"), GitHub issues the HTTPS certificate, and Forward Email handles mail. Do not turn the Cloudflare proxy on without reading [`docs/adr/0002-custom-domain-numaliving-us.md`](docs/adr/0002-custom-domain-numaliving-us.md). Never run `gh api -X DELETE .../pages`: it deletes the Pages site.

## Secrets: hard rules

- `api-keys.json` holds Cloudflare credentials. It lives outside the repository, at `~/.config/numaliving/api-keys.json` (mode 600), where the helper finds it by itself; `NUMA_KEYS_FILE` points it elsewhere, and a copy in the repository root (git-ignored) is used first when one exists. **Never read, cat, grep, print, paste or send it.** `.claude/settings.json` blocks the obvious ways to read it (a speed bump, not a boundary, so the rule is yours to keep). Use `tools/cloudflare/cf_dns.py`, which reads it locally and prints no values.
- No secret in any committed file, log, commit message or pull request. Every `NEXT_PUBLIC_` value is public.

## Conventions

- Conventional commits (`feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`, `ci`), no attribution lines.
- Test first. Immutable data, small files (200 to 400 lines typical, 800 at most), explicit error handling, no `console.log`.
- Keep the docs true: when behaviour changes, update `README.md`, `CONTEXT.md` or the runbook in the same pull request, and record big decisions as a new ADR.

## Gotchas

- CloakBrowser (used by `tools/site-qa/` and `tools/seo/browse.py`) allows one browser session at a time. A browser launch that fails exits with code 76, most often because another process holds the seat; find out whose before closing it. The crawl needs a Python that has the package (`python3.14` on the owner's Mac).
- `tools/seo/` holds the SEO research scripts (findings and decisions in `docs/seo/` and ADR 0003). `serp_search.py` needs the separate local SearXNG running (Docker Desktop, then `docker compose up -d` in its checkout; `SEARXNG_CLIENT_DIR` points at the checkout). Output goes to the git-ignored `tools/seo/data/`.
- Tower auto-stashes uncommitted work when branches change: check `git stash list`.
- `npm run lint` right after the coverage run warns about the generated `coverage/block-navigation.js`; CI is not affected.
- Photo file names are case-sensitive on GitHub Pages. After adding or changing a project photo, run `npm run images:build` (it makes the AVIF and WebP copies, the share images and `scripts/images.manifest.json`); a unit test fails when they are out of date.
