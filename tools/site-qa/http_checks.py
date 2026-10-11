"""HTTP-level checks for site_check.py, made with the browser context's request API.

Redirects are followed by hand (so the chain is recorded) and never leave the
site's own host, so a link to a third-party site is never fetched.
"""

from __future__ import annotations

import hashlib
from typing import Any
from urllib.parse import urljoin, urlsplit

from page_probe import clip
from qa_common import BaseUrl

REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})
MAX_REDIRECT_HOPS = 10
REQUEST_TIMEOUT_MS = 20_000
MAX_BODY_CHARS = 400_000
ROBOTS_PREVIEW_LINES = 15
NOT_FOUND_PROBE_PATH = "definitely-not-a-page/"
DEFAULT_HTTPS_PORT = 443


def _result(url: str, final_url: str, redirects: list[dict[str, Any]], **fields: Any) -> dict[str, Any]:
    base = {
        "url": url,
        "final_url": final_url,
        "redirects": redirects,
        "status": None,
        "content_type": "",
        "error": None,
        "external_redirect": False,
    }
    return {**base, **fields}


def _describe_body(response: Any, keep_body: bool) -> dict[str, Any]:
    body = response.body()
    fields: dict[str, Any] = {"body_length": len(body), "body_sha256": hashlib.sha256(body).hexdigest()}
    if keep_body:
        fields["body_text"] = body[:MAX_BODY_CHARS].decode("utf-8", errors="replace")
    return fields


def fetch(api: Any, url: str, allowed_host: str | None = None, keep_body: bool = False) -> dict[str, Any]:
    """GET ``url``, following redirects manually within ``allowed_host``; never raises."""
    redirects: list[dict[str, Any]] = []
    current = url
    for _ in range(MAX_REDIRECT_HOPS + 1):
        try:
            response = api.get(current, max_redirects=0, timeout=REQUEST_TIMEOUT_MS)
            location = response.headers.get("location")
            if response.status in REDIRECT_STATUSES and location:
                target = urljoin(current, location)
                redirects = [*redirects, {"url": current, "status": response.status, "location": target}]
                if allowed_host and urlsplit(target).hostname != allowed_host:
                    return _result(url, target, redirects, status=response.status, external_redirect=True)
                current = target
                continue
            return _result(
                url,
                current,
                redirects,
                status=response.status,
                content_type=response.headers.get("content-type", ""),
                **_describe_body(response, keep_body),
            )
        except Exception as error:  # Playwright wraps network failures in its own Error type
            return _result(url, current, redirects, error=f"{type(error).__name__}: {clip(str(error))}")
    return _result(url, current, redirects, error=f"more than {MAX_REDIRECT_HOPS} redirects")


def is_ok(result: dict[str, Any]) -> bool:
    return result["error"] is None and result["status"] == 200


def check_links(api: Any, urls: list[str], allowed_host: str) -> dict[str, dict[str, Any]]:
    """Fetch every URL once; the result maps URL -> fetch result."""
    return {url: fetch(api, url, allowed_host) for url in urls}


def parse_robots(text: str) -> dict[str, Any]:
    """Tiny robots.txt reader: does `User-agent: *` disallow everything, and which sitemaps exist."""
    agents: list[str] = []
    in_header = False
    disallow_all = False
    sitemaps: list[str] = []
    for raw in text.splitlines():
        field, separator, value = raw.split("#", 1)[0].strip().partition(":")
        if not separator:
            continue
        field, value = field.strip().lower(), value.strip()
        if field == "user-agent":
            agents = [*agents, value.lower()] if in_header else [value.lower()]
            in_header = True
            continue
        in_header = False
        if field == "disallow" and value == "/" and "*" in agents:
            disallow_all = True
        if field == "sitemap":
            sitemaps = [*sitemaps, value]
    return {"disallow_all": disallow_all, "sitemaps": sitemaps}


def summarize_robots(result: dict[str, Any]) -> dict[str, Any]:
    text = result.get("body_text", "") if is_ok(result) else ""
    return {
        "url": result["url"],
        "final_url": result["final_url"],
        "status": result["status"],
        "error": result["error"],
        "content_type": result["content_type"],
        "looks_like_html": "html" in result["content_type"].lower(),
        "preview": text.splitlines()[:ROBOTS_PREVIEW_LINES],
        **(parse_robots(text) if text else {"disallow_all": False, "sitemaps": []}),
    }


def check_robots(api: Any, base: BaseUrl) -> dict[str, dict[str, Any]]:
    """robots.txt at the origin root (where crawlers look) and under the base path."""
    urls = {"origin_root": f"{base.origin}/robots.txt", "base_path": base.resolve("robots.txt")}
    if urls["origin_root"] == urls["base_path"]:
        urls = {"origin_root": urls["origin_root"]}
    return {name: summarize_robots(fetch(api, url, base.hostname, keep_body=True)) for name, url in urls.items()}


def probe_not_found(api: Any, base: BaseUrl) -> dict[str, Any]:
    """Request a URL that must not exist; the body is kept for content checks."""
    return fetch(api, base.resolve(NOT_FOUND_PROBE_PATH), base.hostname, keep_body=True)


def check_https_redirect(api: Any, base: BaseUrl) -> dict[str, Any] | None:
    """For an https site on the default port: does the http:// twin redirect to https?"""
    parts = urlsplit(base.url)
    if parts.scheme != "https" or parts.port not in (None, DEFAULT_HTTPS_PORT):
        return None
    return fetch(api, f"http://{parts.hostname}{parts.path}", base.hostname)
