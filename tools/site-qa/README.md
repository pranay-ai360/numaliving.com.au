# Browser QA tools for the numaliving.com.au migration

Reusable CloakBrowser (stealth Chromium) tooling: a GitHub-Pages-like static server, a crawler/auditor,
deterministic screenshots and a pixel comparison. The tools never change the site; their outputs go to the
git-ignored folders listed in `.gitignore` or to a scratch folder of your choice.

```sh
QA=tools/site-qa                  # run the commands below from the repository root
SP=${TMPDIR:-/tmp}/numa-qa        # scratch folder for baselines and reports
```

| File | Purpose |
| --- | --- |
| `serve_pages.py` | Static server that behaves like GitHub Pages (prefix, 301 for directories, `404.html`, exact-case paths) |
| `site_check.py` | BFS crawl + audit; writes `report.json` / `report.md`; exit 1 on any failure |
| `capture.py` | Deterministic full-page screenshots `<route-slug>-<width>.png` + `manifest.json` |
| `compare.py` | Pixel diff of two screenshot folders; `parity.md`, `parity.json`, `diff/*.png` |
| `qa_common.py`, `page_probe.py`, `probe_js.py`, `http_checks.py`, `check_rules.py`, `check_report.py` | Helpers imported by the tools (keep them next to the scripts) |
| `tests/test_qa_tools.py`, `tests/make_fixtures.py` | Browser-free unit tests; builds deliberately broken fixture sites |

Requirements: Python 3 with the packages in `requirements.txt` (`pip install -r tools/site-qa/requirements.txt`, then
`cloakbrowser install` once to download its Chromium). On the owner's Mac they are installed for Homebrew's
`python3.14`; plain `python3` does not have them, so run the tools as `python3.14 tools/site-qa/site_check.py ...`.

## One browser at a time (licence limit)

The free CloakBrowser tier allows ONE concurrent browser. Every script launches exactly one browser, reuses it for
all pages, and closes it in `finally` (SIGTERM is turned into a clean exit). Never run two browser scripts at once;
run capture, then check, then compare one after the other. Check the seat count with `cloakbrowser info`
(`Sessions: 0/1 in use`). A launch that exits with code 76 means another process holds the seat, for example a
CloakBrowser window left open by another project: find it with the check below, and find out whose it is before
closing it.

Leftover check. Do not use plain `pgrep -fl Chromium`: it also matches any process whose command line merely
contains the word (e.g. Claude CLI sessions). Use:

```sh
pgrep -fl 'Chromium.app/Contents/MacOS/Chromium' || echo "no chromium running"
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(4301|4302)\b' || echo "no servers listening"
```

## 1. serve_pages.py

```sh
# baseline (pre-migration export) at the ROOT of a host
python3 $QA/serve_pages.py --root $SP/baseline-out --port 4301 > $QA/logs/serve-4301.log 2>&1 &

# migrated static export under the GitHub Pages project path
python3 $QA/serve_pages.py --root /path/to/out --prefix /numaliving.com.au --port 4302 > $QA/logs/serve-4302.log 2>&1 &

kill %1            # or: kill <pid>; Ctrl-C when running in the foreground
```

Options: `--host` (default 127.0.0.1), `--port 0` (pick a free port; the chosen URL is printed), `--quiet`,
`--emulate-jekyll`. Behaviour: with a prefix only URLs under it are served (`/` and everything else answers 404 with the
root's `404.html`); `/dir` -> 301 `/dir/`; `/dir/` serves `index.html`; unknown paths answer status 404 with the body of
`404.html`; paths are matched case-sensitively even on macOS (so `/img/a.JPG` is not found as `a.jpg`, as on GitHub
Pages); only GET/HEAD (405 otherwise); single byte ranges; `Cache-Control: no-cache`. The access log (stderr) shows every
non-200 the browser provoked.

`--emulate-jekyll` reproduces the classic Pages trap: when `<root>/.nojekyll` is missing, any path with a segment starting
with `_` or `.` answers 404, which silently removes Next.js's `_next/` assets (publishing from a branch runs Jekyll;
publishing through GitHub Actions does not). The Next export has no `.nojekyll` file by default.

## 2. capture.py (visual parity screenshots)

```sh
# baseline: all default routes plus the baseline-only /portal/ and the not-found page
python3 $QA/capture.py --base-url http://127.0.0.1:4301/ --out-dir $QA/parity/baseline \
    --extra-route /portal/ --extra-route /definitely-not-a-page/

# after migration (same routes; /portal/ no longer exists)
python3 $QA/capture.py --base-url http://127.0.0.1:4302/numaliving.com.au/ --out-dir $QA/parity/candidate \
    --extra-route /definitely-not-a-page/
```

Defaults: routes `/ /about/ /capabilities/ /process/ /projects/ /projects/marina-villa/ /projects/golf-links/ /contact/
/login/` (override with `--routes a b c` or comma separated), viewports `320x800,768x1024,1024x768,1440x900`
(`--viewports`). Routes are relative to `--base-url`, so the same route list works for both hosts. Each shot uses device
scale factor 1, reduced motion, light colour scheme, injected CSS that finishes animations/transitions and hides the caret,
waits for `document.fonts.ready`, scrolls to the bottom in steps and back to the top, waits for every rendered `<img>` to be
`complete`, settles 400 ms and takes one full-page PNG. `manifest.json` records status, final URL, PNG size, unloaded images
and fonts per shot, plus the browser version and fingerprint seed; non-200 statuses and unloaded images are flagged in the
log (the not-found route is expected to be 404). Exit 1 if any shot failed.

Reproducibility depends on a pinned fingerprint seed (see CloakBrowser notes): all tools launch with
`FINGERPRINT_SEED = 41337` (`qa_common.py`), so captures from different runs are comparable. If you ever change the seed or
the CloakBrowser binary, recapture the baseline too. A full run (11 routes x 4 viewports) takes about 2.5 minutes.

## 3. compare.py

```sh
python3 $QA/compare.py --baseline $QA/parity/baseline --candidate $QA/parity/candidate --out-dir $QA/parity/report
# options: --tolerance 8  --threshold 0.1  --expect-missing 'portal-*' (repeatable; replaces the default)
```

A pixel is "different" when any channel differs by more than 8/255. Pairs are matched by file name. Per pair: size of
both images, differing pixels, percentage (area present in only one image counts as different, so a height change shows
up as a large percentage) and a result: `identical`, `ok` (<= 0.1%), `DIFF` (> 0.1%), `SIZE` (size mismatch). `DIFF` and
`SIZE` get `diff/<name>.png` (faded candidate, differences red, main regions boxed magenta) and a list of the largest
differing row bands in `parity.md`. Baseline files with no candidate counterpart are listed separately; those matching
`--expect-missing` (default `portal-*`) are expected, any other missing file fails the run. Candidate-only files are
informational. Verdict `PASS` needs at least one matched pair and no `DIFF`/`SIZE`/unexpected missing file. Exit 0 = PASS,
1 = FAIL.

## 4. site_check.py (crawler / auditor)

```sh
# baseline
python3 $QA/site_check.py --base-url http://127.0.0.1:4301/ --out-dir $QA/baseline-check --extra-path /portal/

# migrated build served under the Pages prefix (staging: expect noindex), with evidence screenshots
python3 $QA/site_check.py --base-url http://127.0.0.1:4302/numaliving.com.au/ --out-dir $QA/candidate-check \
    --expect-noindex --screenshots

# LIVE site over https (project page or custom domain; the base URL must end at the site root)
python3 $QA/site_check.py --base-url https://<owner>.github.io/<repo>/ --out-dir $QA/live-check --expect-https
python3 $QA/site_check.py --base-url https://numaliving.us/ --out-dir $QA/live-check --expect-https
```

Other options: `--max-pages 60`, `--viewports 320,768,1024,1440`, `--extra-path` (repeatable, relative to the base URL, must
be same-origin), `--not-found-file /path/to/404.html` (the served 404 body must be byte-identical to that file). The
browser only navigates to same-origin URLs (pages may still load third-party subresources, which are reported); internal
links are fetched with the browser context's request API (redirects followed by hand within the site's host, so external
redirects are not followed). `report.json` records the browser version and fingerprint seed.

Per page (each page is loaded once per viewport): status, redirect chain, final URL, `<title>`, `<h1>` count, robots meta /
`X-Robots-Tag`, console errors and warnings, failed requests, HTTP >= 400 responses, third-party hosts, mixed content
(requests plus `http:` references in the markup of an https page), images (broken after scrolling to the bottom, missing
`alt`), internal links resolving to non-200 (plus favicon/manifest links), horizontal overflow per viewport
(`documentElement.scrollWidth > innerWidth`, with the elements sticking out), `html[lang]`, header/main/footer landmarks,
links/buttons without an accessible name. Site level: `/robots.txt` at the origin root and under the base path, a request
to `<base>/definitely-not-a-page/` that must answer 404 with the site's own page (not a soft 404, not the host's default
page, site layout rendered, its assets and links healthy), and with `--expect-https` that `http://` redirects to
`https://`.

Failures (exit 1): non-200 page, missing title/h1/lang/landmark, console error, failed request or HTTP >= 400 response,
mixed content, broken image, missing `alt`, broken internal link, overflow, unnamed link/button, missing noindex
(`--expect-noindex`), not https (`--expect-https`), bad 404 behaviour. Warnings only: several h1, console warnings,
third-party hosts, redirecting pages/links, dead `#anchors`, cancelled requests (`net::ERR_ABORTED`, e.g. Next.js
prefetches), no robots.txt, crawl truncated by `--max-pages`. Exit 0 = no failures, 1 = failures, 2 = usage/launch error.
`report.md` starts with the verdict and two summary tables, then an issue digest, site-level checks and per-page details
(failures in bold); `report.json` has everything, including the per-link results.

## 5. Tests and fixtures

```sh
cd $QA && python3 -m unittest discover -s tests -v          # browser-free, ~1 s
python3 $QA/tests/make_fixtures.py                          # rebuilds $QA/fixtures/{bad-site,bare-404}
python3 $QA/serve_pages.py --root $QA/fixtures/bad-site --prefix /numaliving.com.au --port 4303 &
python3 $QA/site_check.py --base-url http://127.0.0.1:4303/numaliving.com.au/ --out-dir $QA/tmp-check-bad --expect-noindex
```

The bad site must FAIL with: broken link/image/icon, missing alt, console error, uncaught exception, overflow at 320 only,
unnamed controls, missing title/h1/lang/landmarks, missing noindex, a 404 page, and a prefix bug (root-absolute `/about/`
link and icon); and WARN about: a console warning, a second host counted as third-party, a redirecting link, a dead anchor,
two h1. Expected result: 30 failures, 7 warnings, exit 1. Use it to prove the checker still bites after changing it.

## Baseline of the pre-migration site

Baseline artifacts are not committed. They were captured during the migration from the last pre-migration commit
(`87a12de`, served at the root of a host on port 4301): 44 PNGs (11 routes x 4 viewports, including `/portal/` and the
not-found page), a self-check of two independent captures (PASS, 38 identical, worst 0.004%) and a `site_check` report
of 14 pages. To recreate it: `git worktree add ../numa-baseline 87a12de`, then `npm ci && npm run build` in that folder,
serve its `out/` with `serve_pages.py` (no prefix) and run `capture.py` / `site_check.py` against it.

Known pre-existing findings, so later differences can be attributed: `/projects/` has no `<h1>` (its first heading in
`<main>` is an h3 project title); every page logs cancelled `fetch` requests to its navigation links (`net::ERR_ABORTED`,
Next.js link prefetching; the `__next.*.txt` segment prefetches succeed); no `robots.txt`; `/portal/` and the 404 page carry
`noindex`, no other page does; the export contains identical `404.html`, `404/index.html` and `_not-found/index.html`
(the last two answer 200). Everything else is clean at all four widths: no console errors, failed requests, HTTP >= 400,
broken links or images, overflow, unnamed controls, missing alt or third-party hosts (fonts are self-hosted).
All internal URLs in the export are root-absolute (`/about/`, `/_next/...`), so it only works at the root of a host.

Fixed since, so expect them to differ in a candidate run: `/projects/` now has a visually hidden `<h1>` (no visual change),
and the site now serves a `robots.txt` that allows crawling (the noindex meta tag is the control).

## CloakBrowser notes (this machine)

* CloakBrowser picks a RANDOM `--fingerprint` seed on every launch and the seed perturbs text metrics: the same unchanged
  page renders with text 1-2 px lower/higher and sometimes a 1-2 px different page height. Two captures of the baseline
  from launches with different seeds differed in all 44 shots (up to 8.7% of pixels, 5 size mismatches); two launches with
  the same seed are identical. `open_browser()` therefore pins the seed for every tool run.
* `page.set_content()` hangs; the tools only use `page.goto()` on http(s) URLs.
* Playwright's `console` and `pageerror` events do NOT report what the page itself logs or throws (the stealth patches
  suppress `Runtime.enable`; a manual CDP `Runtime.enable` only replays old messages). Only browser-generated messages
  (failed resource loads, mixed-content warnings) arrive. `site_check.py` therefore installs an init script
  (`probe_js.py: JS_CONSOLE_HOOK`) that records `console.error/warn/assert`, `window.onerror` and unhandled rejections.
* Network events (`request`, `response`, `requestfailed`) and the request API work normally.
* Headless Chromium requests `/favicon.ico` when a page has no `<link rel=icon>`; a 404 there is reported.
* Links back to the page itself (`#main` skip links) are not link-checked, so the 404 page's own skip link does not count
  as a broken link.
* Each page is loaded in a fresh context; the page is blanked (`about:blank`) between viewports so cancelled requests of
  the previous load are not attributed to the next one.

## Limitations

* The crawl only follows `<a href>` links of rendered pages (no sitemap, no JS-only routes); use `--extra-path` for
  unlinked pages such as `/portal/`.
* The accessible-name test approximates the accname algorithm for links and buttons only. It is not axe: no contrast,
  form-label or ARIA validity checks.
* Mixed content can only be exercised on https; locally it is covered by unit tests, not by a live run.
* `compare.py` is pixel-exact within tolerance and size sensitive: a changed page height shifts everything below it. Read
  the "where the differences are" row bands first. Residual noise between two captures of the same site with the pinned
  seed: 38 of 44 identical, the rest within 0.004% (`parity/baseline-selfcheck/parity.md`).
* `serve_pages.py` does not emulate HTTP caching, compression, HTTPS/HSTS, custom-domain redirects or extensionless
  `.html` URLs. Real hosting can still differ (headers, CDN caching); re-run `site_check.py` against the live URL.
