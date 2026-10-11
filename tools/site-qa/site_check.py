#!/usr/bin/env python3
"""Crawl and audit a site with CloakBrowser; write report.json and report.md.

Breadth-first crawl of same-origin links from --base-url. Every page is loaded
once per viewport and checked for: HTTP status and redirect chain, <title>, <h1>
count, robots meta, console errors/warnings, failed requests and HTTP>=400
responses, third-party hosts, mixed content, images (broken after scrolling to
the bottom, missing alt), broken internal links (checked with the browser
context's request API), horizontal overflow per viewport, html[lang],
header/main/footer landmarks and links/buttons without an accessible name.
It also fetches robots.txt (origin root and base path) and probes a URL that
must answer 404 with the site's own not-found page.

Examples:
    python3 site_check.py --base-url http://127.0.0.1:4302/numaliving.com.au/ \
        --out-dir out/check --expect-noindex --screenshots
    python3 site_check.py --base-url https://example.github.io/numaliving.com.au/ \
        --out-dir out/live-check --expect-https

Exit status: 0 = no failures, 1 = failures found, 2 = usage or launch error.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import time
from collections import deque
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from check_report import build_not_found_entry, build_page_entry, build_report, render_markdown
from check_rules import (
    CheckOptions,
    Issue,
    evaluate_not_found,
    evaluate_page,
    evaluate_site,
    internal_head_resources,
    internal_links,
    normalize_link,
)
from http_checks import check_https_redirect, check_links, check_robots, probe_not_found
from page_probe import probe_page
from qa_common import FINGERPRINT_SEED, BaseUrl, QAError, log, open_browser, parse_base_url, parse_viewport_widths, write_json

DEFAULT_VIEWPORTS = "320,768,1024,1440"
DEFAULT_MAX_PAGES = 60
PAGE_EXTENSIONS = (".html", ".htm")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crawl and audit a site with CloakBrowser.")
    parser.add_argument("--base-url", required=True, help="e.g. http://127.0.0.1:4302/numaliving.com.au/ or https://host/path/")
    parser.add_argument("--out-dir", required=True, help="directory for report.json, report.md and screenshots/")
    parser.add_argument("--max-pages", type=int, default=DEFAULT_MAX_PAGES, help=f"crawl limit (default {DEFAULT_MAX_PAGES})")
    parser.add_argument("--viewports", default=DEFAULT_VIEWPORTS, help=f"comma-separated widths (default {DEFAULT_VIEWPORTS})")
    parser.add_argument("--screenshots", action="store_true", help="save a full-page screenshot per page and viewport")
    parser.add_argument("--expect-noindex", action="store_true", help="fail pages without noindex (meta robots or X-Robots-Tag)")
    parser.add_argument("--expect-https", action="store_true", help="fail unless pages end on https and http:// redirects to https")
    parser.add_argument("--extra-path", action="append", default=[], help="URL to force into the crawl, relative to the base URL (repeatable)")
    parser.add_argument("--not-found-file", help="local 404.html; the served 404 body must be byte-identical to it")
    return parser.parse_args(argv)


def seed_urls(base: BaseUrl, extra_paths: list[str]) -> list[str]:
    seeds = [base.url, *(base.resolve(path) for path in extra_paths)]
    foreign = [url for url in seeds if not base.same_origin(url)]
    if foreign:
        raise QAError(f"--extra-path must stay on the site's own origin ({base.origin}); got {foreign[0]}")
    return list(dict.fromkeys(normalize_link(url) for url in seeds))


def looks_like_page(url: str) -> bool:
    """Heuristic: skip obvious assets (images, pdf, css...) when choosing pages to render."""
    path = urlsplit(url).path
    last_segment = path.rsplit("/", 1)[-1]
    return path.endswith("/") or "." not in last_segment or last_segment.lower().endswith(PAGE_EXTENSIONS)


def crawlable_links(record: dict[str, Any], base: BaseUrl) -> list[str]:
    return [url for url in internal_links(record, base) if base.contains(url) and looks_like_page(url)]


def crawl(
    browser: Any, base: BaseUrl, seeds: list[str], widths: list[int], max_pages: int, screenshot_dir: Path | None
) -> tuple[list[dict[str, Any]], list[str]]:
    """Breadth-first crawl; returns (page records, URLs found but not audited because of --max-pages)."""
    queue = deque(seeds)
    seen: set[str] = set()
    audited: set[str] = set()
    records: list[dict[str, Any]] = []
    skipped: list[str] = []
    while queue:
        url = normalize_link(queue.popleft())
        if url in seen:
            continue
        seen.add(url)
        if len(records) >= max_pages:
            skipped.append(url)
            continue
        started = time.monotonic()
        record = probe_page(browser, base, url, widths, screenshot_dir)
        final_url = normalize_link(record["final_url"])
        if final_url != url and final_url in audited:
            log(f"skip {record['route']}: redirects to {record['final_url']}, already audited")
            continue
        audited.add(final_url)
        records.append(record)
        seen.add(final_url)
        log(f"[{len(records)}] {record['route']} -> HTTP {record['status']} ({time.monotonic() - started:.1f}s)")
        queue.extend(link for link in crawlable_links(record, base) if link not in seen)
    return records, skipped


def link_targets(records: list[dict[str, Any]], base: BaseUrl) -> list[str]:
    urls = [url for record in records for url in (*internal_links(record, base), *internal_head_resources(record, base))]
    return list(dict.fromkeys(urls))


def file_sha256(path: str | None) -> str | None:
    if path is None:
        return None
    try:
        return hashlib.sha256(Path(path).expanduser().read_bytes()).hexdigest()
    except OSError as error:
        raise QAError(f"cannot read --not-found-file {path}: {error}") from error


def audit_site(args: argparse.Namespace, base: BaseUrl, widths: list[int], options: CheckOptions, out_dir: Path) -> dict[str, Any]:
    """Run every browser and HTTP check and return the raw results (one browser session)."""
    screenshot_dir = out_dir / "screenshots" if args.screenshots else None
    if screenshot_dir is not None:
        screenshot_dir.mkdir(parents=True, exist_ok=True)
    with open_browser() as browser:
        api_context = browser.new_context()
        try:
            api = api_context.request
            records, skipped = crawl(browser, base, seed_urls(base, args.extra_path), widths, args.max_pages, screenshot_dir)
            not_found_api = probe_not_found(api, base)
            not_found_record = probe_page(browser, base, not_found_api["url"], widths[:1], screenshot_dir)
            targets = link_targets([*records, not_found_record], base)
            log(f"checking {len(targets)} distinct internal link target(s)")
            link_results = check_links(api, targets, base.hostname)
            robots = check_robots(api, base)
            https_result = check_https_redirect(api, base) if options.expect_https else None
        finally:
            api_context.close()
        browser_version = browser.version
    return {
        "records": records,
        "skipped": skipped,
        "link_results": link_results,
        "robots": robots,
        "https_result": https_result,
        "not_found_api": not_found_api,
        "not_found_record": not_found_record,
        "browser_version": browser_version,
    }


def evaluate_all(raw: dict[str, Any], base: BaseUrl, options: CheckOptions) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    link_results = raw["link_results"]
    entries = [
        build_page_entry(record, evaluate_page(record, base, link_results, options), base, link_results)
        for record in raw["records"]
    ]
    not_found_record = raw["not_found_record"]
    not_found_issues: list[Issue] = [
        *evaluate_page(not_found_record, base, link_results, options, expected_status=404, check_indexing=False),
        *evaluate_not_found(raw["not_found_api"], not_found_record, options),
    ]
    site_issues = evaluate_site(raw["robots"], raw["https_result"], options, len(entries), raw["skipped"])
    site = {
        "robots": raw["robots"],
        "https_redirect": raw["https_result"],
        "not_found": build_not_found_entry(raw["not_found_api"], not_found_record, not_found_issues),
        "issues": [issue.to_dict() for issue in site_issues],
    }
    return entries, site


def print_summary(report: dict[str, Any], out_dir: Path) -> None:
    summary = report["summary"]
    verdict = "PASS" if summary["passed"] else "FAIL"
    log(f"{verdict}: {summary['pages_audited']} page(s), {summary['failures']} failure(s), {summary['warnings']} warning(s)")
    for item in summary["issue_digest"][:12]:
        log(f"  {item['severity']:<4} {item['code']:<22} x{item['count']}")
    log(f"report: {out_dir / 'report.md'}")


def run(args: argparse.Namespace) -> int:
    base = parse_base_url(args.base_url)
    widths = parse_viewport_widths(args.viewports)
    if args.max_pages < 1:
        raise QAError("--max-pages must be at least 1")
    options = CheckOptions(args.expect_noindex, args.expect_https, file_sha256(args.not_found_file))
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    log(f"auditing {base.url} at widths {widths} into {out_dir}")

    started = time.monotonic()
    raw = audit_site(args, base, widths, options, out_dir)
    entries, site = evaluate_all(raw, base, options)
    run_info = {
        "browser_version": raw["browser_version"],
        "fingerprint_seed": FINGERPRINT_SEED,
        "duration_seconds": round(time.monotonic() - started, 1),
        "options": {
            "max_pages": args.max_pages,
            "viewports": widths,
            "screenshots": args.screenshots,
            "expect_noindex": args.expect_noindex,
            "expect_https": args.expect_https,
            "extra_paths": args.extra_path,
            "not_found_file": args.not_found_file,
        },
    }
    report = build_report(base, run_info, entries, site, raw["link_results"])
    write_json(out_dir / "report.json", report)
    (out_dir / "report.md").write_text(render_markdown(report), encoding="utf-8")
    print_summary(report, out_dir)
    return 0 if report["summary"]["passed"] else 1


def main(argv: list[str] | None = None) -> int:
    try:
        return run(parse_args(argv))
    except QAError as error:
        print(f"site_check: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
