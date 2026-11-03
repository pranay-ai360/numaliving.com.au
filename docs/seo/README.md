# US SEO research and decisions

numaliving.us was a `noindex` preview until 3 November 2026, when the owner had every page indexed before the launch blockers were cleared ([ADR 0006](../adr/0006-index-every-page-before-the-launch-blockers-are-cleared.md)). This folder records why and how it is being prepared for US search, with the research behind it. The decision is [ADR 0003](../adr/0003-us-seo-strategy.md); the scripts that produced the data are in [`tools/seo/`](../../tools/seo/README.md).

| Page | What it holds |
| --- | --- |
| [`competitor-analysis-2026-10.md`](competitor-analysis-2026-10.md) | The curated findings of 18 October 2026: the two named competitors, what the US results look like, vocabulary, brand and entity, a scorecard. No competitor page text |
| [`baseline-2026-10-18.md`](baseline-2026-10-18.md) | What the site looked like before any SEO work (served HTML, cold mobile speed) and how to measure it again |
| [`keyword-map.md`](keyword-map.md) | Which queries each proposed page answers, the real buyer questions, and draft titles and descriptions |
| [`owner-input-pack.md`](owner-input-pack.md) | The ten decisions and the facts each page needs from the owner, and what each unlocks |

## The programme in one view

The plan has seven phases, each its own branch and pull request, in order:

| Phase | What | Changes the site? |
| --- | --- | --- |
| 0 | Decisions, research tooling in `tools/seo/`, these docs | no |
| 1 | Technical SEO foundation: canonical, metadata, JSON-LD, sitemap, responsive images, analytics, a stronger launch guard | yes (code, test first) |
| 2 | US wording and trust repairs: vocabulary, a first screen that says what and for whom, real facts, contact, privacy and terms | yes (copy, small code) |
| 3 | New pages in two content waves (the URL map is final before this starts) | yes |
| 4 | Authority, entity and links: profiles, trade listings, earned links | mostly operations |
| 5 | Launch gate and go-live: one pull request flips `isIndexable`, only with the owner's approval (done 3 November 2026, with the launch blockers accepted: ADR 0006) | yes |
| 6 | A 90-day loop of measuring, refreshing and publishing | ongoing |

The site has been indexable since 3 November 2026, before the launch guard's (`src/config/launchGuard.test.ts`) blockers were cleared: the owner accepted them (ADR 0006). Open owner decisions are still in the owner input pack.

## Repeat the study

You need the SearXNG checkout running for the search step (Docker Desktop, then `docker compose up -d` in that checkout) and `python3.14` with CloakBrowser for the browser step. From the repository root:

```bash
SEO=tools/seo; DATA=$SEO/data
python3 $SEO/serp_search.py $SEO/queries/us-study-2026-10.txt                   # the 45 queries
python3 $SEO/serp_report.py $DATA/serp/us-study-2026-10 --hide-noise            # who ranks, and how often
python3 $SEO/serp_report.py $DATA/serp/us-study-2026-10 --urls 3 > $DATA/top3.txt
python3 $SEO/fetch_pages.py $DATA/pages/ranking --urls-file $DATA/top3.txt      # the ranking pages, politely
python3 $SEO/audit_pages.py $DATA/pages/ranking/*.html
python3 $SEO/vocab_gap.py --ranking $DATA/pages/ranking --own $DATA/pages/own   # after fetching and auditing our own pages
python3.14 $SEO/browse.py serp --queries-file $DATA/tracked.txt                 # at most 15 queries, 10 s or more apart
python3 $SEO/google_features.py $DATA/browse/serp
```

The brand queries are in `tools/seo/queries/brand-2026-10.txt`. The tools README explains each step, the options and the politeness rules of `fetch_pages.py` and `sitemap_report.py`.

## Limits

- The search results come from SearXNG (Google CSE and DuckDuckGo): no People-also-ask, AI Overview or local pack, `site:` queries under-report, and the run was from an Australian IP. The live Google captures were low volume and said "Can't determine location".
- There are no search volumes, difficulty scores, backlink data or Search Console data. Difficulty is a reading of each results page.
- Competitor figures are those of 18 October 2026 and will drift. The competitor study is re-run quarterly (Phase 6).
- Google's terms restrict automated queries: the browser capture is for small research runs only, stops at the first block page (and after two failed captures in a row), never tries to get past it, and refuses to run again for six hours after a block. Browser screenshots (`browse.py shots`) run a page's own JavaScript and do not read `robots.txt`; the tools README says when that matters.
- `prestigeartmillwork.com` returned 403 even in the browser, so nothing is inferred about it.
