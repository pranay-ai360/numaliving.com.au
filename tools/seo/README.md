# SEO research tools

The scripts behind the US SEO study of 18 October 2026, kept so the study can be repeated: fetch pages politely, audit them, compare vocabulary, read sitemaps, run SERP queries on a local SearXNG, and capture screenshots and Google result pages with the single CloakBrowser seat. They never change the site. Everything is standard library only (Python 3.9 or newer), except `browse.py`, which needs `python3.14` with CloakBrowser. The tests need no network, browser or Docker.

Output goes to the git-ignored `tools/seo/data/` folder, or to the folder in `SEO_DATA_DIR`. Run every command from the repository root. The reasons for the study and its findings are in [`docs/seo/`](../../docs/seo/README.md) and [ADR 0003](../../docs/adr/0003-us-seo-strategy.md).

| File | Purpose |
| --- | --- |
| `fetch_pages.py` | Download pages politely (robots.txt, pauses, redirect hops); writes `<name>.html` and `<name>.meta.json` |
| `audit_pages.py` | Analyse saved pages (`<name>.analysis.json`, `<name>.txt`), print a summary, or `--table DIR` to compare many |
| `html_facts.py` | The HTML parser behind the audit: titles, tags, headings, links, images, JSON-LD, words, platform hints |
| `sitemap_report.py` | Read a sitemap or index, group URLs by path shape, count URLs per `lastmod` day |
| `serp_search.py` | Run a list of queries on the local SearXNG; one JSON file per query |
| `serp_report.py` | Top domains per query and a domain-frequency table; `--urls N` lists ranking pages to fetch |
| `google_features.py` | Read Google result-page text: AI Overview and its sources, People also ask, related searches, local pack, ads |
| `vocab_gap.py` | Compare ranking pages with the site's own pages: phrase gaps and the plan's US-versus-UK term table |
| `browse.py` | CloakBrowser: page screenshots and text (`shots`), Google result pages (`serp`). Run with `python3.14` |
| `seo_common.py` | Shared helpers (errors, data folder, slugs, list files, URL checks) |
| `queries/` | The 45 study queries and 8 brand queries of 18 October 2026 |
| `tests/` | `unittest` tests, written first, with hand-made fixtures |

## Set up

- **Nothing to install** for the tools that use only the standard library.
- **SearXNG** (for `serp_search.py` only) lives in a separate checkout. Start Docker Desktop, then run `docker compose up -d` in that checkout; the instance answers on `http://localhost:8080` (override with `SEARXNG_URL`). The tool imports `searxng_client.py`, a single standard-library file, from `SEARXNG_CLIENT_DIR` (default: the `SearXNG` folder next to this repository, so set the variable when you work in a git worktree). That file is run, so point the variable only at a folder you trust. If SearXNG is missing or unreachable the tool says how to start it and exits with 2.
- **CloakBrowser** (for `browse.py` only) is installed for `python3.14` as described in [`tools/site-qa/README.md`](../site-qa/README.md). The free licence has **one seat** shared with the other browser tools: a launch that fails because the seat is taken exits with code 76. Find out whose browser it is before closing it (`cloakbrowser info` shows `Sessions: 0/1` when it is free).

## Repeat the study

```bash
SEO=tools/seo; DATA=$SEO/data                       # or: export SEO_DATA_DIR=/some/folder, then use that for DATA
python3 $SEO/serp_search.py $SEO/queries/us-study-2026-10.txt                    # 45 queries -> $DATA/serp/us-study-2026-10/
python3 $SEO/serp_report.py $DATA/serp/us-study-2026-10 --hide-noise             # who ranks, and how often
python3 $SEO/serp_report.py $DATA/serp/us-study-2026-10 --urls 3 > $DATA/top3.txt
python3 $SEO/fetch_pages.py $DATA/pages/ranking --urls-file $DATA/top3.txt       # the ranking pages, politely
python3 $SEO/fetch_pages.py $DATA/pages/own https://numaliving.us/ https://numaliving.us/about/
python3 $SEO/audit_pages.py $DATA/pages/ranking/*.html $DATA/pages/own/*.html
python3 $SEO/audit_pages.py --table $DATA/pages/own                              # compare pages side by side
python3 $SEO/vocab_gap.py --ranking $DATA/pages/ranking --own $DATA/pages/own    # wording gaps
python3 $SEO/sitemap_report.py https://numaliving.us/sitemap.xml                 # once the site has one
python3.14 $SEO/browse.py serp --queries-file $DATA/tracked.txt                  # at most 15 queries, see below
python3 $SEO/google_features.py $DATA/browse/serp
```

## What each tool does and promises

**`fetch_pages.py OUT_DIR URL... [--delay S] [--urls-file F]`**

- Reads each site's `robots.txt` once. A disallowed URL is recorded as `skipped` in its `.meta.json` and never requested. A `robots.txt` that answers 401 or 403, or cannot be read (network error, 429, 5xx), skips the site; a missing one (404) means no rules. It reads the `*` group.
- Waits at least `max(--delay, the site's Crawl-delay)` between two requests to the same host, and counts the `robots.txt` request as one. A Crawl-delay over 60 s skips the site instead of waiting. The default `--delay` is 1.5 s.
- Follows redirects itself, one hop at a time, so `robots.txt` and the pause apply to each hop. It follows only `http` and `https` targets (never `file:` or `ftp:`), at most 10 hops, and records every hop. Every URL you give must be `http` or `https`.
- Sends a browser-like `User-Agent` (the constant `USER_AGENT`; update it when it gets old). Records status, headers, size and time; handles gzip and deflate; keeps 4xx and 5xx bodies; stops a body at 6 MB.
- Exit status 1 only when a fetch failed. A skipped URL or a 404 page is not a failure.

**`audit_pages.py FILE.html... [--base-url URL]`** writes `<name>.analysis.json` and `<name>.txt` beside each page and prints a summary. It reads `<name>.meta.json` when present (the final URL decides what counts as an internal link); without it, `--base-url` plays that part. `--table DIR` compares the `*.analysis.json` files of a folder, including those the first prototype wrote.

**`sitemap_report.py SOURCE`** takes a file (`.xml` or `.xml.gz`) or an `http(s)` URL (fetched through `fetch_pages`). An index is followed for at most 10 child sitemaps, all on the index's host. The report groups URLs by first path segment and depth and shows the `lastmod` range and a count per day. That per-day view is how scaled content shows up: one competitor's sitemap held 9,488 templated pages published at 130 to 350 a day.

**`serp_search.py QUERIES_FILE`** has `--engines` (full engine names; default `google cse,duckduckgo`, because Bing adds dictionary noise and Brave is throttled on this network), `--pages`, `--delay`, `--language` (default `en-US`) and `--out-dir`. A search that comes back empty while engines were throttled is retried (3 attempts, 25 s apart); an empty search with no throttled engine really has no matches. Each query is saved as one JSON file with the keys `query, language, fetched_at, attempts, results[rank, url, domain, title, snippet, engines, score, published], suggestions, answers, corrections, infoboxes, unresponsive`, the same schema as the saved baseline.

**`browse.py`** (`python3.14`):

- `shots URL...` saves, for each page, a desktop and a mobile screenshot of the first screen, the page text, and with `--full-page` a full-height desktop screenshot.
- `serp QUERY...` saves the text and a screenshot of Google's result page (`hl=en`, `gl=us`). **Google's terms restrict automated queries, so use this for small research runs only.** It refuses more than 15 queries in one run and a `--delay` under 10 seconds (the default is 15), stops at the first block page (unusual traffic, captcha, a `/sorry/` address, HTTP 429) and never tries to get past it. After a block, wait a good while before the next run. The run ends with exit status 1 when it was stopped by a block page.

## Limits to keep in mind

- SERP data is directional: SearXNG returns no People-also-ask, AI Overview or local pack, `site:` queries under-report, and results depend on where the search runs from (the study ran from an Australian IP, so a few `.com.au` results leaked in). Google captures said "Can't determine location". There are no search volumes, backlink data or Search Console data here.
- `html_facts.py` counts text inside `nav`, `header`, `footer` and `aside` as boilerplate, so a `header` inside an article is boilerplate too. Words are counted from the rebuilt text lines, so a headline split into one span per letter is one word. Platform signatures are hints, not proof, and look at markup only.
- An early prototype reported Google Analytics 4 on numaliving.us, which has none. Its pattern ran case-insensitively over the whole page, so class names such as `bg-background` and ordinary prose matched. Signatures now ignore the words a visitor reads, are case-aware, and have regression tests.
- `google_features.py` follows the wording of Google's text today. It lists an AI Overview source only when the name is followed by a `+N` line.
- The pages are parsed, never executed, but they are untrusted data. The tools write only below the data folder or the folder you give.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | done |
| 1 | a fetch or query failed, or `browse.py serp` stopped at a block page |
| 2 | a usage error, or a problem you can fix (printed on one line without a traceback): bad URL or option, missing file, SearXNG not running, `cloakbrowser` not installed for this Python |
| 76 | `browse.py` could not launch the browser because the single seat is taken |
| 130 | interrupted with Ctrl-C |

## Tests

They never use the network, a browser or Docker, and never really sleep:

```bash
python3 -m unittest discover -s tools/seo/tests -v
python3.14 -m unittest discover -s tools/seo/tests            # also run on python3.14 and /usr/bin/python3 (3.9)
python3.14 -m coverage run --source=tools/seo -m unittest discover -s tools/seo/tests && python3.14 -m coverage report --omit='tools/seo/tests/*'
```

Nothing runs these tests in CI (only the npm checks run there), so run them when you touch `tools/seo/`. The functions of `browse.py` that drive the browser are excluded from coverage (`# pragma: no cover`); its URL building, block detection, limits and launcher import are tested.
