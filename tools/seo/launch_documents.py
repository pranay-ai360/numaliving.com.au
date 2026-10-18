"""The robots.txt and sitemap.xml checks of the launch check.

A live site tells search engines where its sitemap is, lists every indexable page in it with a real date, and keeps
the login and 404 pages out. A preview does the opposite: no Sitemap line and an empty sitemap, so nothing invites
a crawler in. The sitemap is read with sitemap_report.parse_sitemap, which refuses a DOCTYPE, entity declarations
and anything that is not UTF-8 XML. Standard library only.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from datetime import date
from typing import Callable, Dict, List, Mapping, Optional, Sequence, Tuple

from fetch_result import FetchResult
from launch_crawl import FetchFunction, fetch_item, fetch_problem
from launch_model import (
    MODE_LIVE, ROBOTS_PATH, SITEMAP_PATH, SITE_SCOPE, CheckResult, Failure, Site, counted, failing, judge, listed,
    passing, skipped,
)
from launch_page_checks import PageView, has_noindex, robots_tokens
from seo_common import SeoToolError
from sitemap_report import SitemapEntry, parse_sitemap

WATCHED_AGENTS = ("*", "googlebot", "bingbot")  # a blanket Disallow for these keeps the site out of search
BLANKET_PATTERNS = ("/", "/*")
LASTMOD = re.compile(
    r"(\d{4})-(\d{2})-(\d{2})"
    r"(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?",
    re.ASCII,
)
UNUSABLE = "sitemap.xml is not usable (see sitemap-valid)"
TITLES = {
    "robots-txt": "robots.txt is served and fits the mode: live has one right Sitemap line and no blanket Disallow, "
                  "preview has no Sitemap line",
    "sitemap-valid": "sitemap.xml is a valid urlset",
    "sitemap-empty": "the sitemap is empty while the site is noindex",
    "sitemap-locations": "every sitemap location is an absolute address on the canonical host",
    "sitemap-duplicates": "no location is listed twice",
    "sitemap-lastmod": "every lastmod is an ISO 8601 date",
    "sitemap-no-noindex": "no noindex page is listed",
    "sitemap-complete": "every indexable page the crawl found is listed",
}
LIVE_SITEMAP_IDS = (
    "sitemap-locations", "sitemap-duplicates", "sitemap-lastmod", "sitemap-no-noindex", "sitemap-complete",
)
PREVIEW_SITEMAP_IDS = ("sitemap-empty",)


@dataclass(frozen=True)
class Documents:
    """robots.txt and sitemap.xml as fetched, and the sitemap's entries (None when the sitemap cannot be used)."""

    robots: FetchResult
    sitemap: FetchResult
    entries: Optional[Tuple[SitemapEntry, ...]]
    sitemap_problem: str = ""


def _read_sitemap(site: Site, result: FetchResult) -> Tuple[Optional[Tuple[SitemapEntry, ...]], str]:
    problem = fetch_problem(site, result, "sitemap")
    if problem:
        return None, problem
    try:
        sitemap = parse_sitemap(result.body, result.final_url)
    except SeoToolError as error:
        return None, str(error)
    if sitemap.is_index:
        return None, "sitemap.xml is a sitemap index; the launch check reads a single urlset"
    return sitemap.entries, ""


def fetch_documents(site: Site, fetch: FetchFunction) -> Documents:
    robots = fetch_item(site, fetch, site.url_for(ROBOTS_PATH)).result
    sitemap = fetch_item(site, fetch, site.url_for(SITEMAP_PATH)).result
    entries, problem = _read_sitemap(site, sitemap)
    return Documents(robots, sitemap, entries, problem)


def sitemap_seeds(site: Site, documents: Documents) -> Tuple[str, ...]:
    """Where to fetch each page the sitemap lists on the site. A preview's sitemap is empty and is not used."""
    if site.mode != MODE_LIVE or documents.entries is None:
        return ()
    return tuple(dict.fromkeys(site.fetch_url(entry.loc) for entry in documents.entries if site.is_own(entry.loc)))


# -- robots.txt ---------------------------------------------------------------------------------------------------


def _robots_fields(text: str) -> List[Tuple[str, str]]:
    """(field name in lower case, value) for every ``Name: value`` line, comments cut off."""
    fields: List[Tuple[str, str]] = []
    for line in text.splitlines():
        name, separator, value = line.split("#", 1)[0].partition(":")
        if separator:
            fields.append((name.strip().lower(), value.strip()))
    return fields


def _blocked_agents(fields: Sequence[Tuple[str, str]]) -> List[str]:
    """The watched crawlers that a group tells to stay away from the whole site."""
    blocked: List[str] = []
    group: List[str] = []
    in_rules = False
    for name, value in fields:
        if name == "user-agent":
            if in_rules:
                group, in_rules = [], False
            group.append(value.lower())
        elif name in ("allow", "disallow", "crawl-delay"):
            in_rules = True
            if name == "disallow" and value in BLANKET_PATTERNS:
                blocked.extend(agent for agent in group if agent in WATCHED_AGENTS and agent not in blocked)
    return blocked


def _sitemap_line_problem(site: Site, sitemaps: Sequence[str]) -> str:
    expected = site.canonical_origin + SITEMAP_PATH
    if not sitemaps:
        return f"no Sitemap line (expected Sitemap: {expected})"
    if len(sitemaps) > 1:
        return f"{len(sitemaps)} Sitemap lines ({', '.join(sitemaps)}), expected exactly one: {expected}"
    return "" if sitemaps[0] == expected else f"Sitemap line is {sitemaps[0]}, expected {expected}"


def _robots_problems(site: Site, documents: Documents) -> List[str]:
    problem = fetch_problem(site, documents.robots, "robots.txt")
    if problem:
        return [problem]
    fields = _robots_fields(documents.robots.body.decode("utf-8-sig", errors="replace"))
    sitemaps = [value for name, value in fields if name == "sitemap"]
    if site.mode != MODE_LIVE:
        return [f"has a Sitemap line ({sitemaps[0]}) while the site is noindex"] if sitemaps else []
    blocked = _blocked_agents(fields)
    problems = [_sitemap_line_problem(site, sitemaps)]
    problems.append(f"disallows the whole site for {', '.join(blocked)}" if blocked else "")
    return [problem for problem in problems if problem]


def _outcome(check_id: str, failures: Sequence[Failure], summary: str) -> CheckResult:
    if failures:
        return failing(check_id, SITE_SCOPE, TITLES[check_id], failures, counted(len(failures), "problem"))
    return passing(check_id, SITE_SCOPE, TITLES[check_id], summary)


def _robots_check(site: Site, documents: Documents) -> CheckResult:
    failures = [Failure(documents.robots.requested, problem) for problem in _robots_problems(site, documents)]
    summary = "as expected for a live site" if site.mode == MODE_LIVE else "no Sitemap line"
    return _outcome("robots-txt", failures, summary)


# -- sitemap.xml --------------------------------------------------------------------------------------------------


def _lastmod_problem(entry: SitemapEntry) -> str:
    if not entry.lastmod:
        return "no lastmod"
    match = LASTMOD.fullmatch(entry.lastmod)
    try:
        if match is not None:
            date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            return ""
    except ValueError:
        pass  # a date that does not exist, such as 2026-02-30
    return f"lastmod {entry.lastmod!r} is not an ISO 8601 date (YYYY-MM-DD)"


def _duplicate_failures(entries: Sequence[SitemapEntry]) -> List[Failure]:
    counts = Counter(entry.loc for entry in entries)
    return [Failure(loc, f"listed {count} times") for loc, count in counts.items() if count > 1]


def _noindex_problem(by_canonical: Mapping[str, PageView]) -> Callable[[SitemapEntry], str]:
    def problem(entry: SitemapEntry) -> str:
        view = by_canonical.get(entry.loc)
        if view is None:
            return ""
        tokens = robots_tokens(view.facts, view.headers)
        if has_noindex(tokens):
            shown = "; ".join(view.facts.robots_meta) or "X-Robots-Tag header"
            return f"listed in the sitemap, but the page is noindex (robots: {shown})"
        if view.noindex_expected:
            return "listed in the sitemap, but this page is meant to stay out of the index"
        return ""

    return problem


def _live_sitemap_checks(
    site: Site, entries: Tuple[SitemapEntry, ...], views: Sequence[PageView]
) -> Tuple[CheckResult, ...]:
    prefix = site.canonical_origin + "/"
    listed_locations = {entry.loc for entry in entries}
    by_canonical: Dict[str, PageView] = {view.expected_canonical: view for view in views}
    indexable = [
        view for view in views
        if not view.noindex_expected and not has_noindex(robots_tokens(view.facts, view.headers))
    ]

    def on_site(entry: SitemapEntry) -> str:
        return "" if entry.loc.startswith(prefix) else f"must start with {prefix}"

    def check(check_id: str, rule: Callable[[SitemapEntry], str]) -> CheckResult:
        return judge(check_id, SITE_SCOPE, TITLES[check_id], entries, rule, lambda entry: entry.loc, "URL")

    return (
        check("sitemap-locations", on_site),
        _outcome("sitemap-duplicates", _duplicate_failures(entries), counted(len(entries), "URL")),
        check("sitemap-lastmod", _lastmod_problem),
        check("sitemap-no-noindex", _noindex_problem(by_canonical)),
        judge(
            "sitemap-complete", SITE_SCOPE, TITLES["sitemap-complete"], indexable,
            lambda view: "" if view.expected_canonical in listed_locations
            else f"not listed in the sitemap (expected {view.expected_canonical})",
            lambda view: view.url,
        ),
    )


def _empty_check(documents: Documents, entries: Tuple[SitemapEntry, ...]) -> CheckResult:
    failures = [Failure(
        documents.sitemap.requested,
        f"lists {counted(len(entries), 'URL')} while the site is noindex; it must be empty",
    )] if entries else []
    return _outcome("sitemap-empty", failures, "no URLs listed")


def document_checks(site: Site, documents: Documents, views: Sequence[PageView]) -> Tuple[CheckResult, ...]:
    """robots.txt, then the sitemap: whether it is a urlset, and what it lists for this mode."""
    valid = (
        _outcome("sitemap-valid", [], counted(len(documents.entries), "URL") + " listed")
        if documents.entries is not None
        else failing("sitemap-valid", SITE_SCOPE, TITLES["sitemap-valid"],
                     [Failure(documents.sitemap.requested, documents.sitemap_problem)], "1 problem")
    )
    results = [_robots_check(site, documents), valid]
    if documents.entries is None:
        later = LIVE_SITEMAP_IDS if site.mode == MODE_LIVE else PREVIEW_SITEMAP_IDS
        results += [skipped(check_id, SITE_SCOPE, TITLES[check_id], UNUSABLE) for check_id in later]
    elif site.mode == MODE_LIVE:
        results += _live_sitemap_checks(site, documents.entries, views)
    else:
        results.append(_empty_check(documents, documents.entries))
    return tuple(results)
