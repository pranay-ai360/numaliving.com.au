"""Pass/fail rules for site_check.py: turn probe facts into issues.

``fail`` issues make the run exit non-zero; ``warn`` issues are reported only.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urldefrag, urlsplit

from http_checks import is_ok
from page_probe import ABORTED_ERROR, clip, is_html
from qa_common import BaseUrl

FAIL = "fail"
WARN = "warn"
REQUIRED_LANDMARKS = ("header", "main", "footer")
MESSAGE_LIMIT = 220
NOT_FOUND_MARKER = re.compile(r"\b404\b|not\s+found", re.IGNORECASE)
GENERIC_NOT_FOUND_PAGES = (
    re.compile(r"There isn't a GitHub Pages site here", re.IGNORECASE),
    re.compile(r"^\s*File not found\b", re.IGNORECASE),
    re.compile(r"Cannot GET /", re.IGNORECASE),
    re.compile(r"The requested URL was not found on this server", re.IGNORECASE),
    re.compile(r"404 Not Found\s+nginx", re.IGNORECASE),
    re.compile(r"Error response\s+Error code: 404", re.IGNORECASE),
)


@dataclass(frozen=True)
class Issue:
    severity: str
    code: str
    message: str

    def to_dict(self) -> dict[str, str]:
        return {"severity": self.severity, "code": self.code, "message": self.message}


@dataclass(frozen=True)
class CheckOptions:
    expect_noindex: bool = False
    expect_https: bool = False
    not_found_file_sha256: str | None = None


def at_widths(item: dict[str, Any]) -> str:
    widths = item.get("viewports") or []
    return f" [at {', '.join(str(width) for width in widths)}px]" if widths else ""


def source_suffix(entry: dict[str, Any]) -> str:
    return f" ({entry['url']})" if entry.get("url") else ""


def normalize_link(url: str) -> str:
    return urldefrag(url)[0]


def internal_links(record: dict[str, Any], base: BaseUrl) -> list[str]:
    """Unique same-origin link targets of a page, in document order.

    Fragments are removed and links back to the page itself (skip links, `#top`) are
    left out: they are anchors, not navigation, and the page's own status is checked anyway.
    """
    own = {normalize_link(record["url"]), normalize_link(record["final_url"])}
    urls = (normalize_link(link["href"]) for link in record["links"])
    return list(dict.fromkeys(url for url in urls if base.same_origin(url) and url not in own))


def internal_head_resources(record: dict[str, Any], base: BaseUrl) -> list[str]:
    urls = (normalize_link(resource["href"]) for resource in record["head_resources"])
    return list(dict.fromkeys(url for url in urls if base.same_origin(url)))


def document_issues(record: dict[str, Any], base: BaseUrl, expected_status: int) -> list[Issue]:
    if record["nav_error"]:
        return [Issue(FAIL, "navigation-error", record["nav_error"])]
    issues: list[Issue] = []
    if record["status"] != expected_status:
        issues.append(Issue(FAIL, "http-status", f"HTTP {record['status']} (expected {expected_status})"))
    if not is_html(record["content_type"]):
        return [*issues, Issue(FAIL, "not-html", f"content type {record['content_type'] or 'unknown'} is not HTML")]
    if record["measure_error"]:
        issues.append(Issue(FAIL, "measure-error", f"could not measure the page: {record['measure_error']}"))
    if not record["measured"]:
        return issues
    issues += [Issue(WARN, "screenshot-failed", error) for error in record["screenshot_errors"]]
    if not base.same_origin(record["final_url"]):
        issues.append(Issue(FAIL, "off-origin-redirect", f"ended on another origin: {record['final_url']}"))
    if record["redirect_chain"]:
        hops = " -> ".join(f"{hop['status']} {hop['url']}" for hop in record["redirect_chain"])
        issues.append(Issue(WARN, "page-redirected", f"{hops} -> {record['final_url']}"))
    return [*issues, *structure_issues(record)]


def structure_issues(record: dict[str, Any]) -> list[Issue]:
    issues: list[Issue] = []
    if not record["title"]:
        issues.append(Issue(FAIL, "missing-title", "no <title> text"))
    if record["h1_count"] == 0:
        issues.append(Issue(FAIL, "missing-h1", "no <h1>"))
    elif record["h1_count"] > 1:
        issues.append(Issue(WARN, "multiple-h1", f"{record['h1_count']} <h1> elements"))
    if not record["lang"]:
        issues.append(Issue(FAIL, "missing-lang", "<html> has no lang attribute"))
    for name in REQUIRED_LANDMARKS:
        if not record["landmarks"].get(name):
            issues.append(Issue(FAIL, "missing-landmark", f"no <{name}> landmark"))
    return issues


def event_issues(record: dict[str, Any]) -> list[Issue]:
    issues = [
        Issue(FAIL, "console-error", f"{clip(error['text'], MESSAGE_LIMIT)}{source_suffix(error)}{at_widths(error)}")
        for error in record["console_errors"]
    ]
    warnings = record["console_warnings"]
    if warnings:
        issues.append(Issue(WARN, "console-warning", f"{len(warnings)} distinct warning(s); first: {clip(warnings[0]['text'], MESSAGE_LIMIT)}{source_suffix(warnings[0])}"))
    aborted = [failure for failure in record["failed_requests"] if failure["error"] == ABORTED_ERROR]
    issues += [
        Issue(FAIL, "request-failed", f"{failure['error']} {failure['url']} ({failure['resource_type']}){at_widths(failure)}")
        for failure in record["failed_requests"]
        if failure["error"] != ABORTED_ERROR
    ]
    if aborted:
        issues.append(Issue(WARN, "request-aborted", f"{len(aborted)} request(s) cancelled by the browser (usually prefetches); first: {aborted[0]['url']}"))
    issues += [
        Issue(FAIL, "http-error", f"HTTP {error['status']} {error['url']} ({error['resource_type']}){at_widths(error)}")
        for error in record["http_errors"]
    ]
    issues += [Issue(FAIL, "mixed-content", f"{item['source']}: {item['url']}{at_widths(item)}") for item in record["mixed_content"]]
    if record["third_party_hosts"]:
        hosts = ", ".join(f"{host} ({count})" for host, count in record["third_party_hosts"].items())
        issues.append(Issue(WARN, "third-party-host", f"contacts third-party host(s): {hosts}"))
    return issues


def image_issues(record: dict[str, Any]) -> list[Issue]:
    images = record["images"]
    broken = [Issue(FAIL, "broken-image", f"{image['src']}: {image['reason']}{at_widths(image)}") for image in images["broken"]]
    no_alt = [Issue(FAIL, "missing-alt", f"<img> without alt attribute: {image['src']}{at_widths(image)}") for image in images["missing_alt"]]
    return [*broken, *no_alt]


def broken_link_message(url: str, text: str, result: dict[str, Any], base: BaseUrl) -> str:
    outcome = result["error"] or f"HTTP {result['status']}"
    label = f"{text!r} -> " if text else ""
    detail = f"{label}{url}: {outcome}"
    if result["redirects"]:
        detail += f" (after {len(result['redirects'])} redirect(s) to {result['final_url']})"
    if not base.contains(url):
        detail += f" [outside the site base path {base.path}; missing path prefix?]"
    return detail


def link_issues(record: dict[str, Any], base: BaseUrl, link_results: dict[str, dict[str, Any]]) -> list[Issue]:
    issues: list[Issue] = []
    text_by_url = {normalize_link(link["href"]): link["text"] for link in record["links"]}
    redirecting: list[str] = []
    for url in internal_links(record, base):
        result = link_results.get(url)
        if result is None:
            continue
        if not is_ok(result):
            issues.append(Issue(FAIL, "broken-link", broken_link_message(url, text_by_url.get(url, ""), result, base)))
        elif result["redirects"]:
            redirecting.append(f"{url} -> {result['final_url']}")
    for url in internal_head_resources(record, base):
        result = link_results.get(url)
        if result is not None and not is_ok(result):
            issues.append(Issue(FAIL, "broken-head-resource", broken_link_message(url, "icon/manifest", result, base)))
    if redirecting:
        issues.append(Issue(WARN, "redirecting-link", f"{len(redirecting)} internal link(s) redirect; first: {redirecting[0]}"))
    if record["dead_anchors"]:
        issues.append(Issue(WARN, "dead-anchor", f"in-page link(s) with no target: {', '.join(record['dead_anchors'])}"))
    return issues


def layout_issues(record: dict[str, Any]) -> list[Issue]:
    issues: list[Issue] = []
    for measurement in record["overflow"]:
        if not measurement["overflows"]:
            continue
        excess = measurement["scrollWidth"] - measurement["innerWidth"]
        offenders = ", ".join(
            f"{item['tag']}{'#' + item['id'] if item['id'] else ''}{'.' + item['className'].split()[0] if item['className'] else ''} (x {item['left']}..{item['right']})"
            for item in measurement["offenders"][:3]
        )
        suffix = f"; sticking out: {offenders}" if offenders else ""
        issues.append(
            Issue(FAIL, "horizontal-overflow", f"{measurement['width']}px: scrollWidth {measurement['scrollWidth']} > innerWidth {measurement['innerWidth']} (+{excess}px){suffix}")
        )
    issues += [
        Issue(FAIL, "unnamed-control", f"<{control['tag']}> has no accessible name: {control['html']}{at_widths(control)}")
        for control in record["unnamed_controls"]
    ]
    return issues


def exposure_issues(record: dict[str, Any], options: CheckOptions, check_indexing: bool) -> list[Issue]:
    issues: list[Issue] = []
    if options.expect_https and urlsplit(record["final_url"]).scheme != "https":
        issues.append(Issue(FAIL, "not-https", f"page ended on {record['final_url']}"))
    robots = " ".join([*record["meta_robots"], record["x_robots_tag"] or ""]).lower()
    if check_indexing and options.expect_noindex and "noindex" not in robots:
        issues.append(Issue(FAIL, "missing-noindex", "no noindex in <meta name=robots> or X-Robots-Tag"))
    return issues


def evaluate_page(
    record: dict[str, Any],
    base: BaseUrl,
    link_results: dict[str, dict[str, Any]],
    options: CheckOptions,
    expected_status: int = 200,
    check_indexing: bool = True,
) -> list[Issue]:
    issues = document_issues(record, base, expected_status)
    if record["nav_error"] or not record["measured"]:
        return issues
    return [
        *issues,
        *event_issues(record),
        *image_issues(record),
        *link_issues(record, base, link_results),
        *layout_issues(record),
        *exposure_issues(record, options, check_indexing),
    ]


def strip_markup(html: str) -> str:
    without_blocks = re.sub(r"<(script|style)\b.*?</\1>", " ", html, flags=re.IGNORECASE | re.DOTALL)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", without_blocks)).strip()


def evaluate_not_found(api_result: dict[str, Any], record: dict[str, Any], options: CheckOptions) -> list[Issue]:
    """Rules for the deliberate request to a URL that must 404 with the site's own page."""
    if api_result["error"]:
        return [Issue(FAIL, "not-found-request-error", f"{api_result['url']}: {api_result['error']}")]
    issues: list[Issue] = []
    status = api_result["status"]
    if status != 404:
        soft = " (soft 404: unknown URLs are served with content)" if status == 200 else ""
        issues.append(Issue(FAIL, "not-found-status", f"{api_result['url']} returned HTTP {status}, expected 404{soft}"))
    text = record["visible_text"] or strip_markup(api_result.get("body_text", ""))
    if any(pattern.search(text) for pattern in GENERIC_NOT_FOUND_PAGES):
        issues.append(Issue(FAIL, "not-found-generic", f"the host's default error page is shown, not the site's: {clip(text, 120)}"))
    elif not NOT_FOUND_MARKER.search(text):
        issues.append(Issue(FAIL, "not-found-content", f"page does not say 404 / not found: {clip(text, 120)}"))
    missing = [name for name in REQUIRED_LANDMARKS if not record["landmarks"].get(name)]
    if missing:
        issues.append(Issue(FAIL, "not-found-not-custom", f"the 404 page does not render the site layout (no <{'>, <'.join(missing)}>)"))
    expected_hash = options.not_found_file_sha256
    if expected_hash and api_result.get("body_sha256") != expected_hash:
        issues.append(Issue(FAIL, "not-found-file-mismatch", "the served 404 body differs from --not-found-file"))
    return issues


def evaluate_site(
    robots: dict[str, dict[str, Any]],
    https_result: dict[str, Any] | None,
    options: CheckOptions,
    page_count: int,
    truncated_urls: list[str],
) -> list[Issue]:
    issues: list[Issue] = []
    if page_count == 0:
        issues.append(Issue(FAIL, "no-pages", "no page could be audited"))
    if truncated_urls:
        issues.append(Issue(WARN, "crawl-truncated", f"--max-pages reached; {len(truncated_urls)} discovered URL(s) not audited, e.g. {truncated_urls[0]}"))
    if not any(item["status"] == 200 and not item["looks_like_html"] for item in robots.values()):
        statuses = ", ".join(f"{name}: {item['status'] or item['error']}" for name, item in robots.items())
        issues.append(Issue(WARN, "no-robots-txt", f"no usable robots.txt ({statuses}); crawlers only read the origin root"))
    if https_result is not None:
        final_ok = https_result["final_url"].startswith("https://") and https_result["status"] == 200
        if not final_ok:
            outcome = https_result["error"] or f"HTTP {https_result['status']} at {https_result['final_url']}"
            issues.append(Issue(FAIL, "http-not-redirected", f"{https_result['url']} does not end on https: {outcome}"))
    elif options.expect_https:
        issues.append(Issue(WARN, "https-redirect-unchecked", "http->https redirect not checked (base URL is not https on the default port)"))
    return issues
