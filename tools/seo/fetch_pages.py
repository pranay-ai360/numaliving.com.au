#!/usr/bin/env python3
"""Download pages for an SEO audit politely: robots.txt rules, a pause between requests, every redirect hop recorded.

Usage:
    fetch_pages.py OUT_DIR URL [URL ...] [--delay SECONDS] [--urls-file FILE]

For each URL the tool writes <slug>.html and <slug>.meta.json into OUT_DIR; audit_pages.py reads both.
A URL that was skipped or that failed gets only the .meta.json. Exit status: 0 when nothing errored (a skipped URL
or a 404 page is not an error), 1 when a fetch failed, 2 for a usage error.

Good manners, because the pages belong to other people:
  * robots.txt is read once per site (origin). A URL it disallows is recorded as skipped and never requested.
    A robots.txt that answers 401/403, or cannot be read (network error, 429, 5xx), skips the whole site; a
    missing one (404) means no rules. Rules for other robots are ignored: this tool reads the "*" group.
  * Between two requests to the same host it waits at least max(--delay, the site's Crawl-delay). The robots.txt
    request counts as a request. A Crawl-delay above 60 s skips the site instead of waiting that long.
  * Redirects are followed here, one hop at a time, so robots.txt and the pause apply to every hop, and only
    http(s) targets are followed (never file: or ftp:). At most 10 hops.
  * 4xx and 5xx pages are kept (a custom 404 page is worth auditing); a body is cut at 6 MB.
Standard library only.
"""

from __future__ import annotations

import argparse
import http.client
import sys
import time
import urllib.error
import urllib.request
import zlib
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple
from urllib.parse import urljoin, urlsplit

from robots_rules import RobotsRules, UnusableRobots, parse_robots, request_target
from seo_common import (
    SeoToolError,
    log,
    non_negative_float,
    read_list_file,
    require_http_url,
    run_cli,
    url_slug,
    write_bytes_file,
    write_json_file,
)

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)
REQUEST_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
}
ROBOTS_PATH = "/robots.txt"
TIMEOUT_SECONDS = 30
MAX_BYTES = 6_000_000
MAX_REDIRECTS = 10
MAX_CRAWL_DELAY_SECONDS = 60.0
DEFAULT_DELAY_SECONDS = 1.5
REDIRECT_STATUSES = (301, 302, 303, 307, 308)
KEEP_OUT_STATUSES = (401, 403)
RATE_LIMITED_STATUS = 429
KEPT_HEADERS = (
    "content-type", "server", "cache-control", "x-robots-tag", "link", "content-language", "x-powered-by",
    "strict-transport-security", "content-security-policy", "age", "via", "cf-cache-status", "x-cache",
    "last-modified", "etag", "location", "retry-after",
)
GZIP_WBITS = zlib.MAX_WBITS | 16
Headers = Tuple[Tuple[str, str], ...]
Opener = Any  # anything with .open(request, timeout=...) like urllib's OpenerDirector


@dataclass(frozen=True)
class RedirectHop:
    status: int
    source: str
    target: str


@dataclass(frozen=True)
class RawReply:
    """One HTTP exchange: what came back (or why nothing did)."""

    status: Optional[int]
    headers: Headers
    body: bytes = b""
    error: str = ""
    truncated: bool = False
    elapsed_ms: int = 0


@dataclass(frozen=True)
class FetchResult:
    """The outcome for one requested URL, after robots.txt and any redirects."""

    requested: str
    final_url: str
    status: Optional[int] = None
    error: str = ""
    skipped: str = ""
    headers: Headers = ()
    redirects: Tuple[RedirectHop, ...] = ()
    body: bytes = b""
    elapsed_ms: int = 0
    truncated: bool = False


@dataclass(frozen=True)
class RobotsPolicy:
    """What robots.txt allows for one origin. ``blocked`` set means every page there is skipped."""

    rules: Optional[RobotsRules] = None
    crawl_delay: float = 0.0
    blocked: str = ""

    def refusal(self, url: str) -> str:
        """Why this URL must not be fetched, or "" when it may be. robots.txt itself is always fetchable."""
        if urlsplit(url).path == ROBOTS_PATH:
            return ""
        if self.blocked:
            return self.blocked
        if self.rules is not None and not self.rules.allows(request_target(url)):
            return "robots.txt disallows this URL"
        return ""


def decode_body(raw: bytes, encoding: str, limit: int = MAX_BYTES) -> Tuple[bytes, bool]:
    """Undo gzip or deflate without ever producing more than ``limit`` bytes. Returns (body, truncated)."""
    name = encoding.strip().lower()
    if name in ("", "identity"):
        return raw[:limit], len(raw) > limit
    if name in ("gzip", "x-gzip"):
        window_sizes = (GZIP_WBITS,)
    elif name == "deflate":
        window_sizes = (zlib.MAX_WBITS, -zlib.MAX_WBITS)  # with and without the zlib header: servers differ
    else:
        raise ValueError(f"unsupported Content-Encoding {name!r}")
    failure = ""
    for wbits in window_sizes:
        decompressor = zlib.decompressobj(wbits)
        try:
            out = decompressor.decompress(raw, limit + 1)
        except zlib.error as error:
            failure = str(error)
            continue
        return out[:limit], len(out) > limit or not decompressor.eof
    raise ValueError(f"could not decode the {name} body: {failure}")


def _seconds(value: float) -> str:
    return f"{value:,.1f}".rstrip("0").rstrip(".")


def _parse_robots(body: bytes) -> RobotsPolicy:
    try:
        rules = parse_robots(body)
    except UnusableRobots as error:
        return RobotsPolicy(blocked=str(error))
    if rules.crawl_delay > MAX_CRAWL_DELAY_SECONDS:
        return RobotsPolicy(
            blocked=f"robots.txt asks for a Crawl-delay of {_seconds(rules.crawl_delay)} s, longer than the "
            f"{_seconds(MAX_CRAWL_DELAY_SECONDS)} s this tool will wait"
        )
    return RobotsPolicy(rules=rules, crawl_delay=rules.crawl_delay)


def policy_from_reply(reply: RawReply) -> RobotsPolicy:
    if reply.error:
        return RobotsPolicy(blocked=f"robots.txt could not be read ({reply.error})")
    status = reply.status or 0
    if 200 <= status < 300:
        return _parse_robots(reply.body)
    if status in KEEP_OUT_STATUSES:
        return RobotsPolicy(blocked=f"robots.txt answered HTTP {status}, which means keep out")
    if 400 <= status < 500 and status != RATE_LIMITED_STATUS:
        return RobotsPolicy()
    return RobotsPolicy(blocked=f"robots.txt answered HTTP {status}, so permission is unknown")


def redirect_target(current: str, reply: RawReply) -> Tuple[str, str]:
    """(next URL, "") for a followable redirect, ("", problem) for a refused one, ("", "") when the reply is final."""
    if reply.status not in REDIRECT_STATUSES or reply.error:
        return "", ""
    location = next((value for name, value in reply.headers if name == "location"), "").strip()
    if not location:
        return "", ""
    try:
        return require_http_url(urljoin(current, location)), ""
    except SeoToolError as error:
        return "", f"redirect from {current} refused: {error}"


def _read_reply(response: Any, status: int, max_bytes: int = MAX_BYTES) -> RawReply:
    headers = tuple((name, value) for name in KEPT_HEADERS for value in [response.headers.get(name)] if value)
    try:
        raw = response.read(max_bytes + 1)
        body, truncated = decode_body(raw, response.headers.get("Content-Encoding") or "", max_bytes)
    except (OSError, http.client.HTTPException, ValueError) as error:
        return RawReply(status, headers, error=f"{type(error).__name__}: {error}")
    return RawReply(status, headers, body=body, truncated=truncated)


def build_result(
    requested: str,
    final_url: str,
    hops: Sequence[RedirectHop],
    reply: Optional[RawReply],
    elapsed_ms: int,
    error: str = "",
    skipped: str = "",
) -> FetchResult:
    status = reply.status if reply else (hops[-1].status if hops else None)
    return FetchResult(
        requested=requested,
        final_url=final_url,
        status=status,
        error=error or (reply.error if reply else ""),
        skipped=skipped,
        headers=reply.headers if reply else (),
        redirects=tuple(hops),
        body=reply.body if reply else b"",
        elapsed_ms=elapsed_ms,
        truncated=reply.truncated if reply else False,
    )


class PoliteFetcher:
    """Fetches URLs one at a time, honouring robots.txt and a pause between requests to the same host."""

    def __init__(
        self,
        opener: Opener,
        delay: float = DEFAULT_DELAY_SECONDS,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
        max_bytes: Optional[int] = None,
    ) -> None:
        self._opener = opener
        self._delay = delay
        self._max_bytes = max_bytes  # None: the page limit, MAX_BYTES, read when a request is made
        self._clock = clock
        self._sleep = sleep
        self._policies: Dict[str, RobotsPolicy] = {}  # origin -> what its robots.txt allows
        self._last_end: Dict[str, float] = {}  # host -> when the last request to it finished

    def fetch(self, url: str) -> FetchResult:
        requested = require_http_url(url)
        current, hops, elapsed_ms = requested, [], 0
        while True:
            refusal = self._policy(current).refusal(current)
            if refusal:
                return build_result(requested, current, hops, None, elapsed_ms, skipped=refusal)
            reply = self._exchange(current)
            elapsed_ms += reply.elapsed_ms
            target, problem = redirect_target(current, reply)
            if not target or len(hops) >= MAX_REDIRECTS:
                too_many = f"too many redirects (more than {MAX_REDIRECTS})" if target else ""
                return build_result(requested, current, hops, reply, elapsed_ms, error=problem or too_many)
            hops.append(RedirectHop(reply.status or 0, current, target))
            current = target

    def _policy(self, url: str) -> RobotsPolicy:
        parts = urlsplit(url)
        origin = f"{parts.scheme.lower()}://{parts.netloc.lower()}"
        if origin not in self._policies:
            self._policies[origin] = self._load_policy(origin)
        return self._policies[origin]

    def _load_policy(self, origin: str) -> RobotsPolicy:
        current = origin + ROBOTS_PATH
        reply = self._exchange(current)
        for _ in range(MAX_REDIRECTS):
            target, problem = redirect_target(current, reply)
            if problem:
                reply = replace(reply, error=problem)
            if not target:
                break
            current = target
            reply = self._exchange(current)
        return policy_from_reply(reply)

    def _exchange(self, url: str) -> RawReply:
        host = urlsplit(url).netloc.lower()
        self._wait_for_turn(host)
        started = self._clock()
        try:
            reply = self._open(url)
        finally:
            self._last_end[host] = self._clock()
        return replace(reply, elapsed_ms=round((self._last_end[host] - started) * 1000))

    def _wait_for_turn(self, host: str) -> None:
        last_end = self._last_end.get(host)
        if last_end is None:
            return
        pause = last_end + self._gap(host) - self._clock()
        if pause > 0:
            self._sleep(pause)

    def _gap(self, host: str) -> float:
        crawl = [p.crawl_delay for origin, p in self._policies.items() if urlsplit(origin).netloc == host]
        return max([self._delay, *crawl])

    def _open(self, url: str) -> RawReply:
        request = urllib.request.Request(url, headers=REQUEST_HEADERS)
        limit = MAX_BYTES if self._max_bytes is None else self._max_bytes
        try:
            with self._opener.open(request, timeout=TIMEOUT_SECONDS) as response:
                return _read_reply(response, response.status, limit)
        except urllib.error.HTTPError as error:
            with error:  # an HTTP error is also the response: it carries the status, headers and body
                return _read_reply(error, error.code, limit)
        except (urllib.error.URLError, OSError, http.client.HTTPException, ValueError) as error:
            return RawReply(None, (), error=f"{type(error).__name__}: {error}")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Never follow a redirect inside urllib: PoliteFetcher follows them itself, one checked hop at a time."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D102, ANN001
        return None


def default_opener() -> Opener:
    return urllib.request.build_opener(_NoRedirect)


def meta_record(result: FetchResult) -> Dict[str, Any]:
    """The .meta.json content: the keys of the research prototype plus skipped and truncated."""
    return {
        "requested": result.requested,
        "final_url": result.final_url,
        "status": result.status,
        "error": result.error or None,
        "skipped": result.skipped or None,
        "headers": dict(result.headers),
        "redirects": [{"status": hop.status, "from": hop.source, "to": hop.target} for hop in result.redirects],
        "bytes": len(result.body),
        "elapsed_ms": result.elapsed_ms,
        "truncated": result.truncated,
    }


def save_result(out_dir: Path, result: FetchResult) -> str:
    """Write the page (when a real answer arrived) and its meta file; returns the file name stem."""
    slug = url_slug(result.requested)
    if result.status is not None and not (result.skipped or result.error):
        write_bytes_file(out_dir / f"{slug}.html", result.body)
    write_json_file(out_dir / f"{slug}.meta.json", meta_record(result))
    return slug


def result_line(index: int, total: int, result: FetchResult) -> str:
    prefix = f"[{index}/{total}]"
    if result.skipped:
        return f"{prefix} skipped ({result.skipped}) {result.requested}"
    if result.error:
        return f"{prefix} ERROR {result.error} {result.requested}"
    hops = ">".join(str(hop.status) for hop in result.redirects) or "-"
    size = f"{len(result.body) / 1024:.1f} KB"
    return f"{prefix} {result.status} hops:{hops} {size} {result.requested} -> {result.final_url}"


def collect_urls(urls: Sequence[str], urls_file: Optional[Path]) -> Tuple[str, ...]:
    """Every URL checked up front (so a typo stops the run before any request), repeats dropped."""
    listed: List[str] = list(urls)
    if urls_file is not None:
        listed.extend(read_list_file(urls_file, "URLs"))
    return tuple(dict.fromkeys(require_http_url(url) for url in listed))


def fetch_all(fetcher: PoliteFetcher, urls: Sequence[str], out_dir: Path) -> int:
    failed = skipped = 0
    for index, url in enumerate(urls, start=1):
        result = fetcher.fetch(url)
        save_result(out_dir, result)
        print(result_line(index, len(urls), result), flush=True)
        failed += 1 if result.error else 0
        skipped += 1 if result.skipped else 0
    log(f"{len(urls) - failed - skipped} fetched, {skipped} skipped, {failed} failed; files are in {out_dir}")
    return 1 if failed else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False
    )
    parser.add_argument("out_dir", type=Path, metavar="OUT_DIR", help="folder for the .html and .meta.json files")
    parser.add_argument("urls", nargs="*", metavar="URL", help="http(s) pages to download")
    parser.add_argument("--urls-file", type=Path, metavar="FILE",
                        help="a list of URLs, one per line (blank lines and # comments are skipped)")
    parser.add_argument("--delay", type=non_negative_float, default=DEFAULT_DELAY_SECONDS, metavar="SECONDS",
                        help=f"least pause between requests to one host (default {DEFAULT_DELAY_SECONDS:g}); "
                             "a longer Crawl-delay in robots.txt wins")
    return parser


def main(
    argv: Optional[Sequence[str]] = None,
    opener: Optional[Opener] = None,
    clock: Callable[[], float] = time.monotonic,
    sleep: Callable[[float], None] = time.sleep,
) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.urls and args.urls_file is None:
        parser.error("give at least one URL, or --urls-file FILE")
    urls = collect_urls(args.urls, args.urls_file)
    fetcher = PoliteFetcher(opener or default_opener(), delay=args.delay, clock=clock, sleep=sleep)
    return fetch_all(fetcher, urls, args.out_dir)


if __name__ == "__main__":
    sys.exit(run_cli(main))
