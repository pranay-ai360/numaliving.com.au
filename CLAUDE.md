# Numa Living website: guide for Claude Code

A static Next.js 16 site (React 19, Tailwind 4, Zod) for Numa Living, a luxury joinery maker. It is exported to plain files and served by GitHub Pages at https://numaliving.us/. There is no server code. Start with [`README.md`](README.md); the vocabulary is in [`CONTEXT.md`](CONTEXT.md), the operating commands in [`docs/RUNBOOK.md`](docs/RUNBOOK.md), and the reasons behind big choices in [`docs/adr/`](docs/adr/).

## Commands

```bash
npm ci
npm run lint && npm run typecheck
npm run test:coverage                    # Vitest; keep coverage at 80% or more (about 99% today)
npm run build:e2e && npm run test:e2e    # Playwright against a static build
```

Run Playwright with `CHROMIUM_EXECUTABLE_PATH` set to a Chrome-family binary (the installed Google Chrome works). See the runbook for details.

## How a change ships

Branch, then `gh pr create`, `gh pr checks --watch`, `gh pr merge --merge`. A pull request runs the `verify` job only; a push to `main` runs `verify`, `build` and `deploy` (`.github/workflows/deploy.yml`). Ask before pushing, merging or changing GitHub or Cloudflare settings, and plan bigger changes with `/ecc:plan`, waiting for an explicit yes.

## Single sources of truth

- **Contact details:** `site.contact` in `src/config/site.ts`. Never type the email anywhere else; tests read `site.contact.email`. `src/config/launchGuard.test.ts` keeps the old placeholder email as its fixture on purpose.
- **Where Quote Requests go:** the FormSubmit alias in the repository variable `FORMSUBMIT_ID`. It is public by design. The deploy fails if it contains `@` or is `e2e-form-id`. Changing it takes effect at the next deploy.
- **Search visibility:** `isIndexable` in `src/config/site.ts` is `false`, so every page is `noindex`. The launch guard test stops it being set to `true` while placeholder or sample content remains (phone, WhatsApp, address, sample projects, the Preview ribbon).
- **Base path:** `NEXT_PUBLIC_BASE_PATH`, filled in by `actions/configure-pages` (empty on numaliving.us).

## Domain and infrastructure

numaliving.us is registered at GoDaddy, its DNS is on Cloudflare (every site record "DNS only"), GitHub issues the HTTPS certificate, and Forward Email handles mail. Do not turn the Cloudflare proxy on without reading [`docs/adr/0002-custom-domain-numaliving-us.md`](docs/adr/0002-custom-domain-numaliving-us.md). Never run `gh api -X DELETE .../pages`: it deletes the Pages site.

## Secrets: hard rules

- `api-keys.json` (repository root, git-ignored) holds Cloudflare credentials. **Never read, cat, grep, print, paste or send it.** `.claude/settings.json` denies reading it. Use `tools/cloudflare/cf_dns.py`, which reads it locally and prints no values.
- No secret in any committed file, log, commit message or pull request. Every `NEXT_PUBLIC_` value is public.

## Conventions

- Conventional commits (`feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`, `ci`), no attribution lines.
- Test first. Immutable data, small files (200 to 400 lines typical, 800 at most), explicit error handling, no `console.log`.
- Keep the docs true: when behaviour changes, update `README.md`, `CONTEXT.md` or the runbook in the same pull request, and record big decisions as a new ADR.

## Gotchas

- CloakBrowser (used by `tools/site-qa/`) allows one browser session at a time. A launch that exits with code 76 means another process holds the seat; find out whose before closing it. The crawl needs a Python that has the package (`python3.14` on the owner's Mac).
- Tower auto-stashes uncommitted work when branches change: check `git stash list`.
- `npm run lint` right after the coverage run warns about the generated `coverage/block-navigation.js`; CI is not affected.
- Photo file names are case-sensitive on GitHub Pages.
