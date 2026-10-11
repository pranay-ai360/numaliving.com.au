"""Report assembly (report.json) and Markdown rendering (report.md) for site_check.py."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from check_rules import FAIL, Issue, internal_links
from http_checks import is_ok
from page_probe import ABORTED_ERROR
from qa_common import BaseUrl, utc_now

CELL_LIMIT = 48
LANDMARK_LETTERS = (("H", "header"), ("M", "main"), ("F", "footer"))


def link_summary(record: dict[str, Any], base: BaseUrl, link_results: dict[str, dict[str, Any]]) -> dict[str, int]:
    urls = internal_links(record, base)
    checked = [link_results[url] for url in urls if url in link_results]
    return {
        "internal": len(urls),
        "broken": sum(not is_ok(result) for result in checked),
        "redirecting": sum(is_ok(result) and bool(result["redirects"]) for result in checked),
    }


def build_page_entry(record: dict[str, Any], issues: list[Issue], base: BaseUrl, link_results: dict[str, dict[str, Any]]) -> dict[str, Any]:
    failures = sum(issue.severity == FAIL for issue in issues)
    return {
        **record,
        "link_summary": link_summary(record, base, link_results),
        "issues": [issue.to_dict() for issue in issues],
        "failures": failures,
        "warnings": len(issues) - failures,
        "result": "FAIL" if failures else "PASS",
    }


def build_not_found_entry(api_result: dict[str, Any], record: dict[str, Any], issues: list[Issue]) -> dict[str, Any]:
    return {
        "url": api_result["url"],
        "api": {key: api_result.get(key) for key in ("status", "error", "content_type", "body_length", "body_sha256", "final_url")},
        "page": {key: record.get(key) for key in ("status", "title", "h1_count", "landmarks", "visible_text", "meta_robots")},
        "issues": [issue.to_dict() for issue in issues],
        "record": record,
    }


def issue_digest(entries: list[dict[str, Any]], extra: list[tuple[str, list[dict[str, str]]]]) -> list[dict[str, Any]]:
    """Count issues per (severity, code) with the pages they occur on."""
    grouped: dict[tuple[str, str], list[str]] = defaultdict(list)
    sources = [(entry["route"], entry["issues"]) for entry in entries] + extra
    for label, issues in sources:
        for issue in issues:
            grouped[(issue["severity"], issue["code"])].append(label)
    ordered = sorted(grouped.items(), key=lambda item: (item[0][0] != FAIL, -len(item[1]), item[0][1]))
    return [
        {"severity": severity, "code": code, "count": len(labels), "pages": list(dict.fromkeys(labels))}
        for (severity, code), labels in ordered
    ]


def build_report(
    base: BaseUrl,
    run_info: dict[str, Any],
    entries: list[dict[str, Any]],
    site: dict[str, Any],
    link_results: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    site_sources = [("(site)", site["issues"]), ("(404 probe)", site["not_found"]["issues"])]
    digest = issue_digest(entries, site_sources)
    failures = sum(item["count"] for item in digest if item["severity"] == FAIL)
    warnings = sum(item["count"] for item in digest if item["severity"] != FAIL)
    return {
        "tool": "site_check.py",
        "generated_at": utc_now(),
        "base_url": base.url,
        **run_info,
        "summary": {
            "pages_audited": len(entries),
            "pages_failed": sum(entry["failures"] > 0 for entry in entries),
            "failures": failures,
            "warnings": warnings,
            "passed": failures == 0,
            "issue_digest": digest,
        },
        "site": site,
        "pages": entries,
        "link_checks": {
            url: {"status": result["status"], "final_url": result["final_url"], "redirects": len(result["redirects"]), "error": result["error"]}
            for url, result in link_results.items()
        },
    }


def cell(value: Any, limit: int = CELL_LIMIT) -> str:
    text = str(value).replace("|", "\\|").replace("\n", " ")
    return text if len(text) <= limit else text[: limit - 3] + "..."


def flag(is_bad: bool, text: str) -> str:
    return f"**{text}**" if is_bad else text


def landmark_cell(landmarks: dict[str, int]) -> str:
    return "/".join(letter if landmarks.get(name) else "-" for letter, name in LANDMARK_LETTERS)


def overflow_cell(entry: dict[str, Any]) -> str:
    widths = [str(item["width"]) for item in entry["overflow"] if item["overflows"]]
    return flag(bool(widths), ", ".join(widths)) if widths else "none"


def robots_cell(entry: dict[str, Any]) -> str:
    parts = [*entry["meta_robots"], f"header: {entry['x_robots_tag']}" if entry["x_robots_tag"] else ""]
    return cell(", ".join(part for part in parts if part) or "-")


def health_row(entry: dict[str, Any]) -> str:
    status = entry["status"] if entry["status"] is not None else "ERR"
    title_ok = bool(entry["title"])
    lang = entry["lang"] or "MISSING"
    result = flag(entry["failures"] > 0, f"{entry['result']} ({entry['failures']}f/{entry['warnings']}w)")
    return (
        f"| {cell(entry['route'])} | {flag(entry['status'] != 200, str(status))} | {'yes' if title_ok else '**MISSING**'} "
        f"| {flag(entry['h1_count'] != 1, str(entry['h1_count']))} | {flag(not entry['lang'], lang)} "
        f"| {landmark_cell(entry['landmarks'])} | {robots_cell(entry)} | {result} |"
    )


def failed_requests(entry: dict[str, Any]) -> list[dict[str, Any]]:
    """Failed requests other than browser-cancelled ones (reported separately as warnings)."""
    return [item for item in entry["failed_requests"] if item["error"] != ABORTED_ERROR]


def runtime_row(entry: dict[str, Any]) -> str:
    failed = failed_requests(entry)
    images = entry["images"]
    links = entry["link_summary"]
    hosts = ", ".join(entry["third_party_hosts"]) or "-"
    return (
        f"| {cell(entry['route'])} | {flag(bool(entry['console_errors']), str(len(entry['console_errors'])))}/{len(entry['console_warnings'])} "
        f"| {flag(bool(failed), str(len(failed)))}/{flag(bool(entry['http_errors']), str(len(entry['http_errors'])))} "
        f"| {cell(hosts)} | {len(entry['mixed_content'])} "
        f"| {flag(bool(images['broken']), str(len(images['broken'])))}/{flag(bool(images['missing_alt']), str(len(images['missing_alt'])))}/{images['count']} "
        f"| {flag(links['broken'] > 0, str(links['broken']))}/{links['internal']} "
        f"| {flag(bool(entry['unnamed_controls']), str(len(entry['unnamed_controls'])))} | {overflow_cell(entry)} |"
    )


def issue_line(issue: dict[str, str]) -> str:
    marker = "**FAIL**" if issue["severity"] == FAIL else "warn"
    return f"  - {marker} `{issue['code']}`: {issue['message']}"


def page_details(entry: dict[str, Any]) -> list[str]:
    redirect = f" (final: {entry['final_url']})" if entry["final_url"] != entry["url"] else ""
    lines = [
        f"### {entry['route']} - {entry['result']} ({entry['failures']} failure(s), {entry['warnings']} warning(s))",
        "",
        f"- URL: {entry['url']}{redirect}",
        f"- HTTP {entry['status']}, `{entry['content_type'] or 'n/a'}`, redirects: {len(entry['redirect_chain'])}",
        f"- Title: {entry['title']!r}; H1: {entry['h1_count']}; lang: {entry['lang'] or 'MISSING'}; landmarks: {entry['landmarks']}",
        f"- Console: {len(entry['console_errors'])} error(s), {len(entry['console_warnings'])} warning(s); "
        f"network: {len(failed_requests(entry))} failed, {len(entry['failed_requests']) - len(failed_requests(entry))} aborted, "
        f"{len(entry['http_errors'])} HTTP>=400",
        f"- Images: {entry['images']['count']} total, {len(entry['images']['broken'])} broken, {len(entry['images']['missing_alt'])} without alt",
        f"- Links: {entry['link_summary']['internal']} internal, {entry['link_summary']['broken']} broken, {entry['link_summary']['redirecting']} redirecting",
        "- Horizontal overflow: " + (", ".join(f"{item['width']}px {'OVERFLOW' if item['overflows'] else 'ok'}" for item in entry["overflow"]) or "n/a"),
    ]
    if entry["screenshots"]:
        lines.append(f"- Screenshots: {', '.join('screenshots/' + name for name in entry['screenshots'])}")
    lines.append("- Issues:" if entry["issues"] else "- Issues: none")
    return [*lines, *[issue_line(issue) for issue in entry["issues"]], ""]


def robots_lines(robots: dict[str, dict[str, Any]]) -> list[str]:
    lines = []
    for name, item in robots.items():
        outcome = item["error"] or f"HTTP {item['status']}"
        extras = []
        if item["disallow_all"]:
            extras.append("disallows everything for `*`")
        if item["sitemaps"]:
            extras.append(f"sitemap: {', '.join(item['sitemaps'])}")
        if item["looks_like_html"] and item["status"] == 200:
            extras.append("served as HTML (soft 404?)")
        lines.append(f"- {name}: {item['url']} -> {outcome}" + (f" ({'; '.join(extras)})" if extras else ""))
    return lines


def not_found_lines(not_found: dict[str, Any]) -> list[str]:
    api, page = not_found["api"], not_found["page"]
    lines = [
        f"- Probe URL: {not_found['url']}",
        f"- Response: {api['error'] or 'HTTP ' + str(api['status'])}, `{api['content_type'] or 'n/a'}`, {api['body_length']} bytes",
        f"- Rendered: title {page['title']!r}, H1 {page['h1_count']}, landmarks {page['landmarks']}",
        f"- Visible text: {cell(page['visible_text'] or '', 160)}",
    ]
    return [*lines, *[issue_line(issue) for issue in not_found["issues"]]]


def https_lines(result: dict[str, Any] | None) -> list[str]:
    if result is None:
        return ["- not checked (only for https base URLs on the default port with --expect-https)"]
    hops = " -> ".join(f"{hop['status']} {hop['url']}" for hop in result["redirects"]) or "no redirect"
    return [f"- {result['url']}: {hops}; ended on {result['final_url']} (HTTP {result['status']})"]


def render_markdown(report: dict[str, Any]) -> str:
    summary, site = report["summary"], report["site"]
    verdict = "PASS" if summary["passed"] else "FAIL"
    lines = [
        f"# Site check: {report['base_url']}",
        "",
        f"- Generated: {report['generated_at']} | browser: {report.get('browser_version', 'n/a')}",
        f"- Viewports: {', '.join(str(width) for width in report['options']['viewports'])} | max pages: {report['options']['max_pages']}"
        f" | expect noindex: {report['options']['expect_noindex']} | expect https: {report['options']['expect_https']}",
        f"- Duration: {report.get('duration_seconds', 'n/a')} s",
        "",
        f"## Result: {verdict} - {summary['failures']} failure(s), {summary['warnings']} warning(s) over {summary['pages_audited']} page(s) ({summary['pages_failed']} with failures)",
        "",
        "## Summary: page health",
        "",
        "| Page | HTTP | Title | H1 | Lang | Landmarks H/M/F | Robots | Result |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
        *[health_row(entry) for entry in report["pages"]],
        "",
        "## Summary: runtime and assets",
        "",
        "Console = errors/warnings; Net = failed requests/HTTP>=400; Images = broken/no-alt/total; Links = broken/internal.",
        "",
        "| Page | Console | Net | Third-party hosts | Mixed | Images | Links | Unnamed controls | Overflow at |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        *[runtime_row(entry) for entry in report["pages"]],
        "",
        "## Issue digest",
        "",
    ]
    if summary["issue_digest"]:
        lines += ["| Severity | Code | Count | Where |", "| --- | --- | ---: | --- |"]
        lines += [
            f"| {'**FAIL**' if item['severity'] == FAIL else 'warn'} | `{item['code']}` | {item['count']} | {cell(', '.join(item['pages']), 90)} |"
            for item in summary["issue_digest"]
        ]
    else:
        lines.append("No issues.")
    lines += ["", "## Site-level checks", "", "### robots.txt", "", *robots_lines(site["robots"]), "", "### Not-found page", "", *not_found_lines(site["not_found"]), ""]
    lines += ["### HTTP to HTTPS", "", *https_lines(site["https_redirect"]), ""]
    if site["issues"]:
        lines += ["### Site-level issues", "", *[issue_line(issue) for issue in site["issues"]], ""]
    lines += ["## Per-page details", ""]
    for entry in report["pages"]:
        lines += page_details(entry)
    return "\n".join(lines) + "\n"
