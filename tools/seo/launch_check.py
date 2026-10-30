#!/usr/bin/env python3
"""Is this site ready to be opened to search engines? One command, a PASS or FAIL for every check.

Usage:
    launch_check.py --base-url URL [--mode preview|live] [--canonical-host URL] [--max-pages N] [--delay SECONDS]
                    [--json FILE]

--mode live       the site is open: every page must be indexable except /login/ and the 404 page, the sitemap must
                  list them all with real dates, and robots.txt must point at it.
--mode preview    (default) the site is closed: every page must be noindex, the sitemap empty, robots.txt without a
                  Sitemap line. This is the state the site must stay in until the launch.

Pages are found from the home page, by following internal links breadth first, and (live) from the sitemap. The
crawl stops at --max-pages (default 60) and says so: a site too big for the limit cannot pass. --canonical-host
(default https://numaliving.us) is the address the pages must name in their canonical links, Open Graph URLs and
sitemap; give it with a --base-url on localhost to check a local build made for production. Addresses on the canonical
host are fetched from --base-url. Nothing else is requested: links to other sites are never followed.

Each page is checked for status, title, description, canonical, robots tags, language, headings, Open Graph and
Twitter tags, JSON-LD (Organization, BreadcrumbList, no placeholder, phone and address shown on the page), image
alt and size, internal links and insecure resources. The site is checked for robots.txt, sitemap.xml, /index.html,
the 404 page, the login page, share images, the http and www redirects, and the crawl limit.

The pages are fetched politely (robots.txt, a pause of --delay seconds, default 1.5; use --delay 0 for localhost).
Exit status: 0 when no check failed (a SKIP is not a failure, but is shown), 1 when a check failed, 2 for a usage
error. --json FILE saves the whole report, with every failing address. Standard library only.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Optional, Sequence

from fetch_pages import DEFAULT_DELAY_SECONDS, PoliteFetcher, default_opener
from launch_crawl import FetchFunction, crawl_site
from launch_documents import document_checks, fetch_documents, sitemap_seeds
from launch_model import DEFAULT_CANONICAL_HOST, DEFAULT_MAX_PAGES, MODE_PREVIEW, MODES, Site
from launch_page_checks import build_views, page_checks
from launch_report import Report, page_record, render_report, report_json
from launch_site_checks import site_checks
from launch_structured_data import structured_data_checks
from seo_common import EXIT_FAILURE, emit, log, non_negative_float, positive_int, run_cli, utc_now, write_text_file


def run_launch_check(site: Site, fetch: FetchFunction, max_pages: int, now: str) -> Report:
    """Fetch the documents, crawl, and run every check. Nothing is written; the Report holds all the findings."""
    documents = fetch_documents(site, fetch)
    seeds = (site.base_url, *sitemap_seeds(site, documents))
    crawl = crawl_site(site, fetch, seeds, max_pages)
    views = build_views(site, crawl)
    results = (
        *page_checks(site, views, crawl),
        *structured_data_checks(views),
        *document_checks(site, documents, views),
        *site_checks(site, fetch, crawl, views),
    )
    return Report(
        mode=site.mode,
        base_url=site.base_url,
        canonical_origin=site.canonical_origin,
        max_pages=max_pages,
        generated_at=now,
        fetched=len(crawl.fetched),
        pages=tuple(page_record(view) for view in views),
        results=results,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False
    )
    parser.add_argument("--base-url", required=True, metavar="URL",
                        help="where to fetch the site from, such as https://numaliving.us/ or http://127.0.0.1:4573/")
    parser.add_argument("--mode", choices=MODES, default=MODE_PREVIEW,
                        help="live: the site is open to search engines; preview: it is closed (default)")
    parser.add_argument("--canonical-host", default=DEFAULT_CANONICAL_HOST, metavar="URL",
                        help=f"the origin pages must name as their own (default {DEFAULT_CANONICAL_HOST})")
    parser.add_argument("--max-pages", type=positive_int, default=DEFAULT_MAX_PAGES, metavar="N",
                        help=f"most internal addresses to fetch (default {DEFAULT_MAX_PAGES}); a site with more fails")
    parser.add_argument("--delay", type=non_negative_float, default=DEFAULT_DELAY_SECONDS, metavar="SECONDS",
                        help=f"least pause between requests to one host (default {DEFAULT_DELAY_SECONDS:g}); "
                             "0 is fine for localhost")
    parser.add_argument("--json", type=Path, metavar="FILE", help="also save the full report as JSON")
    return parser


def main(argv: Optional[Sequence[str]] = None, fetch: Optional[FetchFunction] = None) -> int:
    args = build_parser().parse_args(argv)
    site = Site.create(args.base_url, args.canonical_host, args.mode)
    fetcher = fetch or PoliteFetcher(default_opener(), delay=args.delay).fetch
    log(f"checking {site.base_url} in {site.mode} mode: at most {args.max_pages} addresses, "
        f"{args.delay:g} s between requests")
    report = run_launch_check(site, fetcher, args.max_pages, utc_now())
    emit(render_report(report))
    if args.json:
        write_text_file(args.json, report_json(report))
        log(f"wrote {args.json}")
    return 0 if report.passed else EXIT_FAILURE


if __name__ == "__main__":
    sys.exit(run_cli(main))
