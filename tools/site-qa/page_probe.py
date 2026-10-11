"""Browser-side probing of one page for site_check.py.

``probe_page`` loads a URL once per viewport width (fresh navigation each time, so
responsive JS and image selection behave as for a real visitor), collects browser
events and DOM facts, and merges everything into one JSON-friendly record.
It records facts only; pass/fail decisions live in check_rules.py.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlsplit

from probe_js import (
    JS_CONSOLE_HOOK,
    JS_DOCUMENT_FACTS,
    JS_IMAGES,
    JS_INSECURE_REFERENCES,
    JS_LINKS,
    JS_OVERFLOW,
    JS_READ_CONSOLE_HOOK,
    JS_UNNAMED_CONTROLS,
)
from qa_common import BaseUrl, new_context, prepare_page, route_slug

VIEWPORT_HEIGHT = 900
NAVIGATION_TIMEOUT_MS = 30_000
MAX_TEXT_LENGTH = 400
ABORTED_ERROR = "net::ERR_ABORTED"
BLANK_URL = "about:blank"


def clip(text: str, limit: int = MAX_TEXT_LENGTH) -> str:
    return text if len(text) <= limit else text[: limit - 3] + "..."


class EventCollector:
    """Collects console/network events for one navigation; detaches its listeners on exit."""

    def __init__(self, page: Any) -> None:
        self._page = page
        self._console_errors: list[dict[str, str]] = []
        self._console_warnings: list[dict[str, str]] = []
        self._failed: list[dict[str, str]] = []
        self._http_errors: list[dict[str, Any]] = []
        self._request_urls: list[str] = []
        self._ok_images: dict[str, str] = {}
        self._handlers = {
            "console": self._on_console,
            "pageerror": self._on_page_error,
            "request": self._on_request,
            "requestfailed": self._on_request_failed,
            "response": self._on_response,
        }

    def __enter__(self) -> "EventCollector":
        for event, handler in self._handlers.items():
            self._page.on(event, handler)
        return self

    def __exit__(self, *_exc: object) -> None:
        for event, handler in self._handlers.items():
            self._page.remove_listener(event, handler)

    def _on_console(self, message: Any) -> None:
        entry = {"text": clip(message.text), "url": (message.location or {}).get("url", "")}
        if message.type == "error":
            self._console_errors.append(entry)
        elif message.type == "warning":
            self._console_warnings.append(entry)

    def _on_page_error(self, error: Any) -> None:
        self._console_errors.append({"text": clip(f"[uncaught exception] {error}"), "url": ""})

    def _on_request(self, request: Any) -> None:
        self._request_urls.append(request.url)

    def _on_request_failed(self, request: Any) -> None:
        failure = request.failure
        reason = failure.get("errorText", "") if isinstance(failure, dict) else (failure or "")
        self._failed.append({"url": request.url, "error": reason, "resource_type": request.resource_type})

    def _on_response(self, response: Any) -> None:
        request = response.request
        if request.resource_type == "image" and response.status < 400:
            self._ok_images[response.url] = response.headers.get("content-type", "")
        is_document = request.is_navigation_request() and request.frame == self._page.main_frame
        if response.status >= 400 and not is_document:
            self._http_errors.append(
                {"url": response.url, "status": response.status, "resource_type": request.resource_type}
            )

    def snapshot(self) -> dict[str, Any]:
        return {
            "console_errors": list(self._console_errors),
            "console_warnings": list(self._console_warnings),
            "failed_requests": list(self._failed),
            "http_errors": list(self._http_errors),
            "request_urls": list(self._request_urls),
            "ok_images": dict(self._ok_images),
        }


def redirect_chain(request: Any) -> list[dict[str, Any]]:
    """Redirect hops before the final response, oldest first."""
    hops: list[dict[str, Any]] = []
    current = request
    while current.redirected_from is not None:
        current = current.redirected_from
        response = current.response()
        hops.append({"url": current.url, "status": response.status if response else None})
    return list(reversed(hops))


def navigate(page: Any, url: str) -> tuple[Any, str | None]:
    try:
        return page.goto(url, wait_until="load", timeout=NAVIGATION_TIMEOUT_MS), None
    except Exception as error:  # Playwright raises its own Error type for net failures/timeouts
        return None, f"{type(error).__name__}: {clip(str(error))}"


def is_html(content_type: str) -> bool:
    return "html" in (content_type or "").lower()


def measure_page(page: Any) -> dict[str, Any]:
    return {
        "facts": page.evaluate(JS_DOCUMENT_FACTS),
        "images": page.evaluate(JS_IMAGES),
        "link_data": page.evaluate(JS_LINKS),
        "insecure_references": page.evaluate(JS_INSECURE_REFERENCES),
        "controls": page.evaluate(JS_UNNAMED_CONTROLS),
        "overflow": page.evaluate(JS_OVERFLOW),
        "page_console": page.evaluate(JS_READ_CONSOLE_HOOK),
    }


def probe_viewport(page: Any, url: str, width: int, screenshot_dir: Path | None, route: str) -> dict[str, Any]:
    """Navigate at one viewport width and measure; failures are recorded, never raised."""
    page.set_viewport_size({"width": width, "height": VIEWPORT_HEIGHT})
    if page.url != BLANK_URL:
        page.goto(BLANK_URL)  # cancels the previous page's in-flight requests outside any collector
    with EventCollector(page) as collector:
        response, nav_error = navigate(page, url)
        result: dict[str, Any] = {"width": width, "nav_error": nav_error, "measure_error": None}
        if response is not None:
            headers = response.headers
            result = {
                **result,
                "status": response.status,
                "final_url": page.url,
                "redirect_chain": redirect_chain(response.request),
                "content_type": headers.get("content-type", ""),
                "x_robots_tag": headers.get("x-robots-tag"),
            }
            if is_html(result["content_type"]):
                result = {**result, **measure_viewport(page, width, screenshot_dir, route)}
        events = with_page_console(collector.snapshot(), result.get("page_console"))
    return {**result, "events": events}


def as_log_entries(texts: list[str]) -> list[dict[str, str]]:
    return [{"text": clip(text), "url": ""} for text in texts]


def with_page_console(events: dict[str, Any], page_console: dict[str, list[str]] | None) -> dict[str, Any]:
    """Add what the page logged itself (captured by JS_CONSOLE_HOOK) to the browser-generated events."""
    if not page_console:
        return events
    return {
        **events,
        "console_errors": [*events["console_errors"], *as_log_entries(page_console["errors"])],
        "console_warnings": [*events["console_warnings"], *as_log_entries(page_console["warnings"])],
    }


def take_screenshot(page: Any, screenshot_dir: Path | None, route: str, width: int) -> tuple[str | None, str | None]:
    """(file name, error); a failed screenshot must never discard the measurements."""
    if screenshot_dir is None:
        return None, None
    name = f"{route_slug(route)}-{width}.png"
    try:
        page.screenshot(path=str(screenshot_dir / name), full_page=True, animations="disabled", caret="hide")
        return name, None
    except Exception as error:
        return None, f"{type(error).__name__}: {clip(str(error))}"


def measure_viewport(page: Any, width: int, screenshot_dir: Path | None, route: str) -> dict[str, Any]:
    try:
        prepared = prepare_page(page)
        measured = measure_page(page)
    except Exception as error:  # e.g. execution context destroyed by a late client-side navigation
        return {"measure_error": f"{type(error).__name__}: {clip(str(error))}"}
    screenshot, screenshot_error = take_screenshot(page, screenshot_dir, route, width)
    return {**measured, "prepared": prepared, "screenshot": screenshot, "screenshot_error": screenshot_error}


def union_by_key(per_viewport: list[tuple[int, list[dict[str, Any]]]], key: Callable[[dict[str, Any]], Any]) -> list[dict[str, Any]]:
    """Merge per-viewport lists, de-duplicating by ``key`` and recording which widths saw each item."""
    merged: dict[Any, dict[str, Any]] = {}
    for width, items in per_viewport:
        for item in items:
            existing = merged.get(key(item))
            widths = [*existing["viewports"], width] if existing else [width]
            merged[key(item)] = {**item, "viewports": widths}
    return list(merged.values())


def collect(results: list[dict[str, Any]], getter: Callable[[dict[str, Any]], list[dict[str, Any]]]) -> list[tuple[int, list[dict[str, Any]]]]:
    return [(result["width"], getter(result)) for result in results]


def analyse_images(result: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """(broken, missing_alt) for one viewport result."""
    events = result["events"]
    status_by_url = {error["url"]: error["status"] for error in events["http_errors"]}
    pending = set(result.get("prepared", {}).get("pending_images", []))
    broken, missing_alt = [], []
    for image in result.get("images", []):
        src = image["src"]
        is_svg_ok = events["ok_images"].get(src, "").startswith("image/svg")
        if image["complete"] and image["naturalWidth"] == 0 and not is_svg_ok:
            status = status_by_url.get(src)
            reason = f"HTTP {status}" if status else "decoded to zero width (failed to load)"
            broken.append({"src": src, "reason": reason})
        elif src in pending or (image["rendered"] and not image["complete"]):
            broken.append({"src": src, "reason": "never finished loading"})
        is_decorative = (image["role"] or "").lower() in ("presentation", "none") or image["ariaHidden"] == "true"
        if image["alt"] is None and not is_decorative:
            missing_alt.append({"src": src})
    return broken, missing_alt


def third_party_hosts(base: BaseUrl, results: list[dict[str, Any]]) -> dict[str, int]:
    """Distinct requested URLs per foreign host, across all viewports."""
    urls = {url for result in results for url in result["events"]["request_urls"]}
    parts = (urlsplit(url) for url in urls)
    counts = Counter(
        part.hostname
        for part in parts
        if part.scheme in ("http", "https") and part.hostname and part.hostname != base.hostname
    )
    return dict(sorted(counts.items()))


def mixed_content(final_url: str, results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if urlsplit(final_url).scheme != "https":
        return []
    per_viewport = []
    for result in results:
        from_requests = [{"url": url, "source": "request"} for url in result["events"]["request_urls"] if url.lower().startswith("http://")]
        from_markup = [{"url": ref["url"], "source": f"<{ref['tag']} {ref['attr']}>"} for ref in result.get("insecure_references", [])]
        per_viewport.append((result["width"], from_requests + from_markup))
    return union_by_key(per_viewport, lambda item: item["url"])


def without_document_echo(errors: list[dict[str, Any]], document_urls: set[str]) -> list[dict[str, Any]]:
    """Chromium logs "Failed to load resource: ... status of 404" for a 404 document; the status is reported separately."""
    return [
        error
        for error in errors
        if not (error["url"] in document_urls and error["text"].startswith("Failed to load resource"))
    ]


def merge_facts(measured: list[dict[str, Any]]) -> dict[str, Any]:
    """Document facts come from the first measured viewport."""
    facts = measured[0]["facts"] if measured else {}
    return {
        "title": facts.get("title", ""),
        "lang": facts.get("lang", ""),
        "h1_count": facts.get("h1Count", 0),
        "meta_robots": facts.get("metaRobots", []),
        "landmarks": facts.get("landmarks", {}),
        "visible_text": facts.get("visibleText", ""),
    }


def merge_events(base: BaseUrl, url: str, final_url: str, results: list[dict[str, Any]], measured: list[dict[str, Any]]) -> dict[str, Any]:
    console_errors = union_by_key(collect(results, lambda r: r["events"]["console_errors"]), lambda e: (e["text"], e["url"]))
    return {
        "console_errors": without_document_echo(console_errors, {url, final_url}),
        "console_warnings": union_by_key(collect(results, lambda r: r["events"]["console_warnings"]), lambda e: (e["text"], e["url"])),
        "failed_requests": union_by_key(collect(results, lambda r: r["events"]["failed_requests"]), lambda e: (e["url"], e["error"])),
        "http_errors": union_by_key(collect(results, lambda r: r["events"]["http_errors"]), lambda e: (e["url"], e["status"])),
        "third_party_hosts": third_party_hosts(base, results),
        "mixed_content": mixed_content(final_url, measured),
    }


def merge_images(measured: list[dict[str, Any]]) -> dict[str, Any]:
    findings = [(result["width"], *analyse_images(result)) for result in measured]
    return {
        "count": len(measured[0]["images"]) if measured else 0,
        "broken": union_by_key([(width, broken) for width, broken, _ in findings], lambda image: image["src"]),
        "missing_alt": union_by_key([(width, alt) for width, _, alt in findings], lambda image: image["src"]),
    }


def merge_dom(measured: list[dict[str, Any]]) -> dict[str, Any]:
    link_data = measured[0]["link_data"] if measured else {"deadAnchors": [], "headResources": []}
    return {
        "links": union_by_key(collect(measured, lambda r: r["link_data"]["links"]), lambda link: link["href"]),
        "dead_anchors": link_data["deadAnchors"],
        "head_resources": link_data["headResources"],
        "unnamed_controls": union_by_key(collect(measured, lambda r: r["controls"]), lambda control: control["html"]),
        "overflow": [
            {**r["overflow"], "width": r["width"], "overflows": r["overflow"]["scrollWidth"] > r["overflow"]["innerWidth"]}
            for r in measured
        ],
    }


def merge_results(base: BaseUrl, url: str, results: list[dict[str, Any]]) -> dict[str, Any]:
    """Combine per-viewport results into one page record (facts come from the first successful load)."""
    loaded = [result for result in results if result.get("status") is not None]
    first = loaded[0] if loaded else results[0]
    measured = [result for result in loaded if "facts" in result]
    final_url = first.get("final_url", url)
    return {
        "url": url,
        "route": base.route_of(url),
        "final_url": final_url,
        "status": first.get("status"),
        "redirect_chain": first.get("redirect_chain", []),
        "content_type": first.get("content_type", ""),
        "x_robots_tag": first.get("x_robots_tag"),
        "nav_error": next((result["nav_error"] for result in results if result["nav_error"]), None),
        "measure_error": next((result["measure_error"] for result in results if result["measure_error"]), None),
        "measured": bool(measured),
        **merge_facts(measured),
        **merge_events(base, url, final_url, results, measured),
        "images": merge_images(measured),
        **merge_dom(measured),
        "screenshots": [result["screenshot"] for result in measured if result.get("screenshot")],
        "screenshot_errors": [f"{r['width']}px: {r['screenshot_error']}" for r in measured if r.get("screenshot_error")],
        "viewports": [result["width"] for result in results],
    }


def probe_page(browser: Any, base: BaseUrl, url: str, widths: list[int], screenshot_dir: Path | None) -> dict[str, Any]:
    """Probe ``url`` at every width in a fresh browser context (closed afterwards)."""
    context = new_context(browser, widths[0], VIEWPORT_HEIGHT)
    route = base.route_of(url)
    try:
        context.add_init_script(JS_CONSOLE_HOOK)
        page = context.new_page()
        results = [probe_viewport(page, url, width, screenshot_dir, route) for width in widths]
    finally:
        context.close()
    return merge_results(base, url, results)
