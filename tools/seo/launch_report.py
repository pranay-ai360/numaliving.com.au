"""The report of the launch check: a readable table with PASS, FAIL or SKIP for every check and the failing addresses
under each failure, a verdict, and the same facts as a JSON file.

The table goes through ``printable``, so page text in a title or a message cannot move the cursor or set the window
title. The JSON is written as plain ASCII, so any text a page held (even a lone surrogate from a JSON-LD escape) can
be saved, and a JSON reader gets the original text back. Standard library only.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Mapping, Sequence, Tuple

from launch_model import FAIL, PAGE_SCOPE, PASS, SITE_SCOPE, SKIP, CheckResult, counted
from launch_page_checks import PageView
from launch_structured_data import parse_structured_data
from seo_common import printable

FAILURES_SHOWN = 8
FAILURE_INDENT = " " * 8
SCOPE_HEADINGS = ((PAGE_SCOPE, "PAGE CHECKS"), (SITE_SCOPE, "SITE CHECKS"))
MODE_NOTES = {
    "live": "Live mode: pages must be indexable (only the login and 404 pages may be noindex), the sitemap must "
            "list them all and robots.txt must point at it.",
    "preview": "Preview mode: every page must be noindex, the sitemap empty and robots.txt without a Sitemap line.",
}
TOOL_NAME = "launch_check"


@dataclass(frozen=True)
class Report:
    """What one run found: the settings, the pages read, and the result of every check."""

    mode: str
    base_url: str
    canonical_origin: str
    max_pages: int
    generated_at: str
    fetched: int  # internal addresses the crawl fetched (pages, files and failures alike)
    pages: Tuple[Mapping[str, Any], ...]
    results: Tuple[CheckResult, ...]

    @property
    def counts(self) -> Dict[str, int]:
        statuses = [result.status for result in self.results]
        return {status: statuses.count(status) for status in (PASS, FAIL, SKIP)}

    @property
    def passed(self) -> bool:
        """True when something was checked and nothing failed. A skipped check is shown, but does not fail the run."""
        return bool(self.results) and self.counts[FAIL] == 0


def page_record(view: PageView) -> Dict[str, Any]:
    """What a page looked like to the checks, for the JSON report."""
    facts = view.facts
    return {
        "url": view.url,
        "path": view.path,
        "title": facts.title,
        "title_length": len(facts.title),
        "description_length": len(facts.description),
        "canonical": facts.canonical,
        "robots": list(facts.robots_meta),
        "lang": facts.lang,
        "h1": list(facts.heading_texts(1)),
        "json_ld_types": sorted(parse_structured_data(facts.jsonld_blobs).types),
        "images": len(facts.images),
        "internal_links": len(facts.links_of("internal")),
    }


def _check_lines(result: CheckResult, id_width: int) -> List[str]:
    summary = f"  [{result.summary}]" if result.summary else ""
    lines = [f"{result.status}  {result.id:<{id_width}}  {result.title}{summary}"]
    lines += [f"{FAILURE_INDENT}{failure.url}  {failure.message}" for failure in result.failures[:FAILURES_SHOWN]]
    hidden = len(result.failures) - FAILURES_SHOWN
    if hidden > 0:
        lines.append(f"{FAILURE_INDENT}... and {hidden} more (the --json report lists them all)")
    return lines


def _verdict(report: Report) -> List[str]:
    counts = report.counts
    lines = [
        f"{counted(len(report.results), 'check')}: {counts[PASS]} passed, {counts[FAIL]} failed, {counts[SKIP]} skipped"
    ]
    if not report.passed:
        return lines + ["Result: FAIL"]
    skips = counts[SKIP]
    verb = "was" if skips == 1 else "were"
    note = f" ({counted(skips, 'check')} {verb} skipped; see the SKIP lines)" if skips else ""
    return lines + [f"Result: PASS{note}"]


def render_report(report: Report) -> str:
    id_width = max((len(result.id) for result in report.results), default=0)
    lines = [
        f"Launch check, {report.mode} mode: {report.base_url}",
        f"canonical host {report.canonical_origin}; {counted(len(report.pages), 'page')} read, "
        f"{counted(report.fetched, 'address', 'addresses')} fetched (limit {report.max_pages})",
        MODE_NOTES.get(report.mode, ""),
    ]
    for scope, heading in SCOPE_HEADINGS:
        results = [result for result in report.results if result.scope == scope]
        if results:
            lines += ["", heading]
            for result in results:
                lines += _check_lines(result, id_width)
    lines += [""] + _verdict(report)
    return printable("\n".join(lines))


def report_json(report: Report) -> str:
    """The report as JSON text (ASCII only, one trailing newline)."""
    data = {
        "tool": TOOL_NAME,
        "mode": report.mode,
        "base_url": report.base_url,
        "canonical_host": report.canonical_origin,
        "max_pages": report.max_pages,
        "generated_at": report.generated_at,
        "addresses_fetched": report.fetched,
        "passed": report.passed,
        "counts": report.counts,
        "pages": list(report.pages),
        "checks": [
            {
                "id": result.id,
                "scope": result.scope,
                "title": result.title,
                "status": result.status,
                "summary": result.summary,
                "failures": [{"url": failure.url, "message": failure.message} for failure in result.failures],
            }
            for result in report.results
        ],
    }
    return json.dumps(data, indent=1, ensure_ascii=True) + "\n"
