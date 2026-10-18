# SEO research tools

The scripts behind the US SEO study of 18 October 2026, kept so the study can be repeated: fetch pages politely, audit them, compare vocabulary, read sitemaps, run SERP queries on a local SearXNG, and capture screenshots and Google result pages with the single CloakBrowser seat. `launch_check.py` turns the study's findings into a gate: it checks whether the site itself is ready to be opened to search engines. None of them changes the site. Everything is standard library only (Python 3.9 or newer), except `browse.py`, which needs `python3.14` with CloakBrowser. The tests need no network, browser or Docker.

"Politely" describes `fetch_pages.py` and `sitemap_report.py`, which read `robots.txt`, pause between requests and refuse risky redirects. `browse.py` drives a real browser and is different: read its section before you use it.

Output goes to the git-ignored `tools/seo/data/` folder, or to the folder in `SEO_DATA_DIR`. Run every command from the repository root. The reasons for the study and its findings are in [`docs/seo/`](../../docs/seo/README.md) and [ADR 0003](../../docs/adr/0003-us-seo-strategy.md).

| File | Purpose |
| --- | --- |
| `fetch_pages.py` | Download pages politely (robots.txt, pauses, checked redirect hops); writes `<name>.html` and `<name>.meta.json` |
| `audit_pages.py` | Analyse saved pages (`<name>.analysis.json`, `<name>.txt`), print a summary, or `--table DIR` to compare many |
| `html_facts.py` | The HTML parser behind the audit: titles, tags, headings, images, structured data, words, platform hints |
| `sitemap_report.py` | Read a sitemap or index, group URLs by path shape, count URLs per `lastmod` day |
| `serp_search.py` | Run a list of queries on the local SearXNG; one JSON file per query |
| `serp_report.py` | Top domains per query and a domain-frequency table; `--urls N` lists ranking pages to fetch |
| `google_features.py` | Read Google result-page text: AI Overview and its sources, People also ask, related searches, local pack, ads |
| `vocab_gap.py` | Compare ranking pages with the site's own pages: phrase gaps and the plan's US-versus-UK term table |
| `browse.py` | CloakBrowser: page screenshots and text (`shots`), Google result pages (`serp`). Run with `python3.14` |
| `launch_check.py` | Is the site ready to open to search engines? A PASS, FAIL or SKIP for every check, for a closed site (`--mode preview`) or an open one (`--mode live`) |
| `launch_model.py`, `launch_crawl.py` | The site under test (base URL, canonical host, mode) and the internal-link crawl |
| `launch_page_checks.py`, `launch_structured_data.py` | The per-page checks, and the JSON-LD checks |
| `launch_documents.py`, `launch_site_checks.py` | The robots.txt and sitemap checks; the checks of `/index.html`, the 404 and login pages, share images, redirects and the crawl limit |
| `launch_report.py` | The table, the verdict and the JSON report |
| `seo_common.py` | Shared helpers (errors, data folder, file names, list files, URL checks, safe printing) |
| `robots_rules.py`, `robots_policy.py` | robots.txt as RFC 9309 describes it, and what a site's answer means for the fetcher |
| `http_reply.py`, `fetch_result.py` | One HTTP answer (headers, bounded body, Retry-After) and the saved result of one fetch |
| `url_guard.py` | The check that keeps redirects away from local and private addresses |
| `html_links.py`, `json_ld.py`, `platform_signatures.py` | Link kinds, JSON-LD types and platform hints, used by `html_facts.py` |
| `serp_guard.py` | The stop rules around Google captures: the capture loop and the block marker |
| `queries/` | The 45 study queries and 8 brand queries of 18 October 2026 |
| `tests/` | `unittest` tests, written first, with hand-made fixtures |

## Set up

- **Nothing to install** for the tools that use only the standard library.
- **Python version.** The tools run on Python 3.9 or newer and the tests pass on 3.9.6, 3.14 and 3.15. Use an up-to-date patch release, because three things depend on it. The XML parser: recent expat releases limit entity expansion by themselves, but the Python 3.9.6 that ships with macOS has expat 2.2.8, which does not (a 2.8 KB document expanded to 20 million characters in a test), so `sitemap_report.py` refuses any DOCTYPE or entity declaration before parsing. `html.parser`: older releases are slow on pages with thousands of unterminated tags or comments (about ten seconds for 10,000 unterminated tags on 3.9.6). `json`: from Python 3.11 a number with more than 4,300 digits is an error, which the tools treat as an ordinary bad file.
- **Compare runs from the same interpreter.** `html.parser` handles broken markup differently from one Python release to the next (unterminated comments, `--!>`, tags inside `<title>` or `<textarea>`; a link such as `http://[domain]/x` is "external" on 3.9 and "other" from 3.11.4). The counts for a malformed page can therefore differ between interpreters, while well-formed pages give the same numbers everywhere. When you compare two runs, use the same Python for both.
- **SearXNG** (for `serp_search.py` only) lives in a separate checkout. Start Docker Desktop, then run `docker compose up -d` in that checkout; the instance answers on `http://localhost:8080` (override with `SEARXNG_URL`, which must start with `http://` or `https://`). The tool imports `searxng_client.py`, a single standard-library file, from `SEARXNG_CLIENT_DIR` (default: the `SearXNG` folder next to this repository, so set the variable when you work in a git worktree). That file is **run**, not just read, so point the variable only at a folder you trust; the tool logs the path of the file it runs. If `SEARXNG_URL` points at a server on the internet, the tool says so before it sends any query. If SearXNG is missing or unreachable the tool says how to start it and exits with 2.
- **CloakBrowser** (for `browse.py` only) is installed for `python3.14` as described in [`tools/site-qa/README.md`](../site-qa/README.md). The free licence has **one seat** shared with the other browser tools: if the browser cannot be launched, most often because the seat is taken, `browse.py` exits with code 76. Find out whose browser it is before closing it (`cloakbrowser info` shows `Sessions: 0/1` when it is free).

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

## Check the site before and after the launch

```bash
python3 tools/seo/launch_check.py --base-url https://numaliving.us/ --mode preview                   # closed: must keep passing until the launch
python3 tools/seo/launch_check.py --base-url http://127.0.0.1:4573/ --mode live --delay 0            # a local build of the open site; canonicals still name numaliving.us
python3 tools/seo/launch_check.py --base-url https://numaliving.us/ --mode live --json tools/seo/data/launch-check.json   # after the launch
```

## What each tool does and promises

**`fetch_pages.py OUT_DIR URL... [--delay S] [--urls-file F] [--allow-private-hosts]`**

- **robots.txt**, read once per site and applied as RFC 9309 describes (Python's own `urllib.robotparser` ignores wildcards and takes the first matching rule before 3.14, so this tool carries its own matcher and behaves the same on every release). It reads the `*` group; the longest matching rule wins and an Allow beats a Disallow of the same length; `*` and a trailing `$` work as wildcards; rules are matched against the path and the query string. A disallowed URL is recorded as `skipped` in its `.meta.json` and never requested. A `robots.txt` that answers 401 or 403, cannot be read (network error, 429, 5xx), or is not UTF-8 text (UTF-16, a NUL byte) skips the site; a missing one (404) means no rules. Only the first 512 KiB are read, and a byte order mark is ignored.
- **Pauses.** It waits at least `max(--delay, the site's Crawl-delay)` between two requests to the same host, and counts the `robots.txt` request as one. A Crawl-delay may have decimals (`2.5`); a value that is not a plain number is ignored; one over 60 s skips the site instead of waiting. The default `--delay` is 1.5 s. After a 429 or 503 answer it also waits as long as `Retry-After` says (10 s when the header is absent) before the next request to that host; a request to wait more than 60 s ends the visit to that host, and its remaining URLs are recorded as skipped.
- **Redirects** are followed by the tool itself, one hop at a time, so `robots.txt` and the pauses apply to each hop. Only `http` and `https` targets are followed (never `file:`, `ftp:` or `data:`), at most 10 hops, and every hop is recorded. **A redirect to a local or private address is refused**: `127.0.0.1`, `localhost`, `10.x.x.x`, `192.168.x.x`, `169.254.x.x` (cloud metadata), `::1`, shared and unspecified addresses, any name that resolves to one of those, and spellings such as `http://2130706433/`. A hop to the same host as the URL you asked for is always followed, so your own preview (`http://localhost:3000/about` redirecting to `/about/`) works; `--allow-private-hosts` follows every such redirect. The check resolves the name once, before the request, so it does not defend against a DNS server that answers differently a moment later. It covers redirects only: a URL you type yourself is requested as given.
- **Addresses.** Every URL you give must be `http` or `https`. A `#fragment` is dropped (two URLs that differ only by fragment are fetched once). Non-ASCII characters in the path or query are sent percent-encoded as UTF-8, and a raw UTF-8 `Location` header is understood.
- **Downloads.** It sends a browser-like `User-Agent` (the constant `USER_AGENT`; update it when it gets old). It records status, headers, size and time; a header sent more than once (two `Link` lines, `X-Robots-Tag: all` plus a per-robot one) is kept whole, joined with `, `. It handles gzip and deflate, keeps 4xx and 5xx bodies, and stops a body at 6 MB (`truncated` in the `.meta.json`). A download that takes longer than 5 minutes in total, or whose body ends before its `Content-Length`, is recorded as an error.
- **File names.** `<host>_<path>` for the address, for example `numaliving.us_about.html`. When two different addresses of one run would get the same name (`/x` and `/x/`, `http` and `https`, `/a/b` and `/a_b`, `/About` and `/about`), the later one gets a short hash of its full address added, and the `requested` field of each `.meta.json` says which address it belongs to. When an address is skipped or fails, a page saved by an earlier run under that name is removed, so it cannot sit next to a record that says nothing arrived. A re-run into the same folder replaces earlier files.
- Exit status 1 only when a fetch failed. A skipped URL or a 404 page is not a failure.

**`launch_check.py --base-url URL [--mode preview|live] [--canonical-host URL] [--max-pages N] [--delay S] [--json FILE]`** answers "is this site ready to be opened to search engines?" with a PASS, FAIL or SKIP for every check, the failing addresses under each failure, and an exit status. It reads the site and changes nothing.

- **Two modes.** `preview` (the default) is the closed state the site keeps until the launch: every page must be `noindex`, `sitemap.xml` must be an empty `urlset`, and `robots.txt` must have no `Sitemap:` line. `live` is the open state: every page must be indexable except `/login/` and the 404 page, the sitemap must list every indexable page the crawl found, and `robots.txt` must have one `Sitemap:` line naming `<canonical host>/sitemap.xml` and no site-wide `Disallow`. `/login/` must be `noindex` in both.
- **Addresses.** `--base-url` is where the pages are fetched from: `https://numaliving.us/`, or a local build such as `http://127.0.0.1:4573/`. `--canonical-host` (default `https://numaliving.us`) is what the pages must name in their canonical links, `og:url` and sitemap. With a local build the canonical links still name production, and an address on the canonical host (a sitemap `<loc>`, an `og:image`) is read from the base URL. A base path such as `https://user.github.io/repo/` works too.
- **Discovery.** The crawl starts at the home page (live: and at every sitemap URL on the site) and follows internal links breadth first. Every internal link is fetched once, a page or a file, so "does this link resolve?" has an answer; only an HTML page that answered 200 on the site is read for more links. The crawl stops at `--max-pages` (default 60), and a site with more addresses than that **fails** `crawl-complete`: raise the limit.
- **Politeness and scope.** Requests go through the same `PoliteFetcher` as `fetch_pages.py`: `robots.txt` is applied (a page it disallows is reported and never requested), at least `--delay` seconds pass between requests (default 1.5; `0` is fine for localhost), and redirect hops are checked. Only the site's own addresses are requested: the base URL, the canonical host and its `http://` and `www.` forms. Links to other sites are never followed, a share image on another host is reported and not fetched, and a link that redirects to another site is reported and its page is not read (the fetcher takes the redirect itself, one checked hop at a time). A run makes one request per page, one per share image and about a dozen more.
- **Exit status.** 0 when no check failed (a SKIP is shown but is not a failure, and the closing line says how many), 1 when a check failed, 2 for a usage error. `--json FILE` saves the whole report (settings, one record per page, every check with all its failing addresses; the table shows at most 8 per check), as ASCII so that any text a page held can be saved.

| Check | What has to be true |
| --- | --- |
| `status-200` | the home page and every sitemap URL answer 200 with an HTML page on the site, and `robots.txt` does not keep them out |
| `title-single`, `title-unique`, `title-length` | exactly one non-empty `<title>` (an SVG title does not count), no two pages share one, at most 60 characters as shown (entities decoded) |
| `description-present`, `description-unique`, `description-length` | a meta description on every page, none shared; **live only:** 120 to 160 characters |
| `canonical` | exactly one absolute canonical link, equal to the canonical host plus the page's path |
| `robots-meta` | the `robots`, `googlebot` and `bingbot` tags and the `X-Robots-Tag` header say noindex exactly where the mode expects it (preview: everywhere; live: only `/login/`); an indexable page must not say nofollow or none |
| `html-lang` | `<html lang="en-US">`, compared as written |
| `h1-single`, `heading-order` | exactly one non-empty H1; heading levels never skip (H1, then H2, then H3; going back up is fine) |
| `open-graph`, `twitter-card` | `og:title`, `og:description`, `og:url`, `og:image`, `og:type` and `og:locale` present, `og:url` equal to the canonical; `twitter:card` present |
| `images-alt-size` | every `<img>` has an `alt` attribute (empty is right for a decorative image), a `width` and a `height` |
| `links-resolve` | every internal link ends on a page that answers 200 |
| `no-http-resources` | no script, style sheet, image, frame or media address starts with `http://` |
| `json-ld-valid` | every JSON-LD block parses and names schema.org as its `@context` |
| `json-ld-organization` | an `Organization` is declared at the top of a block or in its `@graph` (one nested inside another entity does not count) |
| `json-ld-breadcrumbs` | every inner page (not `/`, not `/login/`) declares a BreadcrumbList with positions 1, 2, 3 and a name for each crumb |
| `json-ld-placeholders` | no text in the markup contains `+971`, `Factory address` or `000 0000`, and every `telephone` and address in the markup is shown as text on the same page |
| `robots-txt` | served; live: one `Sitemap:` line naming `<canonical host>/sitemap.xml` and no `Disallow: /` for `*`, Googlebot or Bingbot; preview: no `Sitemap:` line |
| `sitemap-valid` | `sitemap.xml` is a UTF-8 `urlset` (no DOCTYPE, not an index), read with the `sitemap_report.py` parser |
| `sitemap-empty` | (preview) it lists no URL |
| `sitemap-locations`, `sitemap-duplicates`, `sitemap-lastmod`, `sitemap-no-noindex`, `sitemap-complete` | (live) every `<loc>` starts with the canonical host and a slash, none is listed twice, every `<lastmod>` is a real ISO 8601 date (`2026-10-18`, or a date-time with a time zone), no listed page is noindex or the login page, and every indexable page the crawl found is listed |
| `index-html-canonical` | `/index.html` names `/` as its canonical (or redirects there, or answers 404) |
| `missing-page-404` | a path that cannot exist answers 404 with `noindex` and a title that no real page has |
| `login-noindex` | `/login/` is noindex in both modes (skipped when it answers 404) |
| `share-images` | every `og:image` and `twitter:image` address is absolute, on the site, and answers 200 with an `image/*` content type and a body |
| `redirect-https`, `redirect-www` | `http://` and `www.` each reach the canonical home page in one 301 or 308 hop; skipped unless `--base-url` is the https canonical host itself |
| `crawl-complete` | the crawl fetched every internal address it found |

Choices worth knowing before you read a FAIL:

- The placeholder markers are plain text. A real phone number that starts with `+971` would also trip `json-ld-placeholders`; if that is ever intended, change `PLACEHOLDER_MARKERS` in `launch_structured_data.py`.
- Contact details are compared page by page, as Google asks of structured data: a `telephone` or address in a page's JSON-LD must be readable text on that same page (a `tel:` link alone is not). A phone may be shown without its country code, or with spaces, dots or brackets.
- `lastmod` must be present and real, because Google stops trusting a sitemap whose dates it finds unreliable. Whether the date is true is for a person to check against the page's history.
- It reads HTML the way `audit_pages.py` does, not like a browser: text added by JavaScript is invisible to it. It does not validate JSON-LD against the schema.org types (use the Rich Results Test), measure speed, or know anything about Search Console.

**`audit_pages.py FILE.html... [--base-url URL]`** writes `<name>.analysis.json` and `<name>.txt` beside each page and prints a summary. It reads `<name>.meta.json` when present (the final URL decides what counts as an internal link); without it, `--base-url` plays that part. It accepts `.html` and `.htm` files only, because the output names replace that suffix (a file called `notes.txt` would be overwritten by its own text output). A page that cannot be audited is reported on one line and skipped; the others are still done and the exit status is 1. `--table DIR` compares the `*.analysis.json` files of a folder, including those the first prototype wrote, and skips (aloud) any file it cannot read.

**`sitemap_report.py SOURCE [--max-children N] [--top N] [--max-days N] [--samples N] [--delay S] [--allow-private-hosts]`** takes a file (`.xml` or `.xml.gz`) or an `http(s)` URL (fetched through `fetch_pages`, with a 50 MiB limit for the sitemap itself; a download cut at the limit is reported as "truncated at N MB", not as bad XML). A sitemap must be UTF-8: UTF-16 and UTF-32 files, and any file with a DOCTYPE or an entity declaration, are refused before parsing. An index is followed for at most 10 child sitemaps (`--max-children` takes 0 to 10), all on the index's host. The report groups URLs by first path segment and depth (`--top`, `--samples`) and shows the `lastmod` range and a count per day (`--max-days`); a `lastmod` that is not a real calendar day counts as undated. Entries whose address is not a valid web address are counted and mentioned in a note but left out of the groups. That per-day view is how scaled content shows up: one competitor's sitemap held 9,488 templated pages published at 130 to 350 a day.

**`serp_search.py QUERIES_FILE`** has `--engines` (full engine names; default `google cse,duckduckgo`, because Bing adds dictionary noise and Brave is throttled on this network), `--pages` (1 to 5), `--delay` (at least 1 second, default 5), `--language` (default `en-US`) and `--out-dir`. A search that comes back empty while engines were throttled is retried (3 attempts, 25 s apart); an empty search with no throttled engine really has no matches. Each query is saved as one JSON file named by its words and a hash of the exact query, with the keys `query, language, fetched_at, attempts, results[rank, url, domain, title, snippet, engines, score, published], suggestions, answers, corrections, infoboxes, unresponsive`, the same schema as the saved baseline.

**`serp_report.py SERP_DIR [--top N] [--limit N] [--hide-noise] [--urls N]`** prints the top domains per query and a frequency table. "Avg first-rank" is the position, in the result list of each query (within the top N), of the first result from that domain, averaged over the queries where the domain appears. The first prototype counted the position among distinct domains instead, so its figures differ slightly from this tool's. Files that are not SERP records are skipped aloud; results that are not objects are dropped. `--urls N` prints the first N result URLs of every query (noise domains skipped, tracking parameters and fragments removed) in a form `fetch_pages.py --urls-file` accepts.

**`vocab_gap.py --ranking PATH... --own PATH... [--min-share F] [--min-pages N] [--limit N] [--no-terms]`** compares the headings and main text of ranking pages with the site's own. A phrase has 1 to 3 words that sit next to each other on a line: it does not cross punctuation, a number, or a word of one or two letters ("in", "of", "US"), and it does not start or end with a stop word or a contraction. Curly and straight apostrophes are the same and accents are dropped. A phrase is a core gap when it is on at least `max(--min-pages, ceil(--min-share x ranking pages))` ranking pages (30% of 33 pages is 10) and on no page of the site. `--min-share` takes 0 to 1 (default 0.3), `--min-pages` defaults to 4, `--limit` to 90, and `--no-terms` leaves out the US-versus-UK term table.

**`browse.py`** (`python3.14`) drives a real browser. **It is not polite in the way `fetch_pages.py` is**: it does not read `robots.txt`, it runs the page's own JavaScript, and it follows redirects wherever they lead, including to local addresses (it does not check them). Point `shots` only at pages you would open yourself.

- `shots URL...` saves, for each page, a desktop and a mobile screenshot of the first screen, the page text, and with `--full-page` a full-height desktop screenshot. It refuses Google addresses (use `serp` for those, with its limits). Two addresses with the same readable name get different file names, as for `fetch_pages.py`. It exits with 1 when any view failed; the other pages are still captured.
- `serp QUERY...` saves the text and a screenshot of Google's result page (`hl=en`, `gl=us`), named by the words of the query and a hash of its exact text; the manifest lists each file name. **Google's terms restrict automated queries, so use this for small research runs only.** It refuses more than 15 queries in one run and a `--delay` under 10 seconds (the default is 15). It stops at the first block page (unusual traffic, captcha, a `/sorry/` address, HTTP 429) and never tries to get past it, and it stops after two failed captures in a row. After a block page it writes a marker, `<data folder>/browse/blocked-at`, and refuses to run again for six hours (delete the file only if you are sure the block is over). The run ends with exit status 1 when it was stopped, or when any capture failed, and its closing line counts the queries that were captured.

## Limits to keep in mind

- SERP data is directional: SearXNG returns no People-also-ask, AI Overview or local pack, `site:` queries under-report, and results depend on where the search runs from (the study ran from an Australian IP, so a few `.com.au` results leaked in). Google captures said "Can't determine location". There are no search volumes, backlink data or Search Console data here.
- `html_facts.py` counts text inside `nav`, `header`, `footer` and `aside` as boilerplate, so a `header` inside an article is boilerplate too. Words are counted from the rebuilt text lines, so a headline split into one span per letter is one word; only tokens with a letter or digit count (a lone dash or bullet is not a word), and the text of dropdown lists, text areas and scripts is left out. The parser reads a page as a browser does where these numbers depend on it: a missing `</head>` ends at the first body tag, a new `<a>` or heading closes the open one, an end tag closes what was left open inside it, and nesting stops at 512 levels.
- **Platform signatures are hints, not proof.** They search only markup the page itself uses: class and id names, inline styles, `data-*` attributes, the `src` or `href` of the tags that load a resource (`script`, `link`, `img`, `source`, `iframe` and similar), the `generator` meta tag, script and style text, and comments. They never look at the words a visitor reads, at alt or title text, or at where a link points, so a link to wordpress.com does not make a page "WordPress". Each pattern says whether it ignores case.
- An early prototype reported Google Analytics 4 on numaliving.us, which has none. Its pattern ran case-insensitively over the whole page, so class names such as `bg-background` and ordinary prose matched. Signatures are now case-aware and have regression tests.
- `google_features.py` follows the wording of Google's text today. It lists an AI Overview source only when the name is followed by a `+N` line.
- **Pages are untrusted data.** A page saved by `fetch_pages.py` is parsed, never executed, but the saved `.html` is still hostile content: do not open it in a browser you care about. (`browse.py shots` is the exception: it loads the page in a real browser, which does run its JavaScript.) Text that a tool prints, or saves in a `.txt` file, shows control characters as escapes such as `\x1b`, so a title cannot move the cursor, set the window title or write to the clipboard; the `.html` and `.json` files keep the bytes as they arrived.
- Hostile or broken input is skipped aloud instead of stopping a run: an address `urlsplit` refuses, a JSON file nested too deeply, a huge number, a bad redirect. A bug the tools did not expect prints `error: Type: message` and exits with 1; set `SEO_DEBUG=1` to get the traceback.
- The tools write only below the data folder or the folder you give.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | done |
| 1 | a fetch or query failed, a page could not be audited, a `launch_check.py` check failed, `browse.py` had a failed capture or `serp` stopped at a block page or after repeated failures, or an unexpected error (one line, see above) |
| 2 | a usage error, or a problem you can fix (printed on one line without a traceback): bad URL or option, missing file, SearXNG not running, `cloakbrowser` not installed for this Python, `serp` refused because of a recent block page |
| 76 | `browse.py` could not launch the browser, most often because the single seat is taken. A problem inside a session that is already running is an ordinary failure (1), not 76 |
| 130 | interrupted with Ctrl-C |

## Tests

They never use the network, a browser or Docker, and never really sleep. A few start a small HTTP server on `127.0.0.1` (a free port) to exercise the real `urllib` opener; nothing leaves the machine.

```bash
python3 -m unittest discover -s tools/seo/tests -v
python3.14 -m unittest discover -s tools/seo/tests            # also run on python3.14 and /usr/bin/python3 (3.9)
python3.14 -m coverage run --source=tools/seo -m unittest discover -s tools/seo/tests && python3.14 -m coverage report --omit='tools/seo/tests/*'
python3.14 -m mypy tools/seo                                   # default settings, no errors
```

Nothing runs these tests in CI (only the npm checks run there), so run them when you touch `tools/seo/`. Only `python3.14` has the `coverage` and `mypy` modules. Nothing is excluded from coverage: the code of `browse.py` that talks to a page is tested with fake browser, context and page objects.
