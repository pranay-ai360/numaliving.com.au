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
from dataclasses import replace
from email.message import Message
from pathlib import Path
from typing import IO, Any, Callable, Dict, List, Optional, Protocol, Sequence, Tuple
from urllib.parse import urlsplit

from fetch_result import FetchResult, Journey, RedirectHop, meta_record, result_line, save_result  # noqa: F401
from http_reply import (  # noqa: F401  (re-exported: the names other tools and tests import from here)
    KEPT_HEADERS,
    MAX_BYTES,
    REDIRECT_STATUSES,
    Headers,
    RawReply,
    decode_body,
    header_text,
    read_reply,
    redirect_target,
    retry_after_seconds,
)
from robots_policy import (  # noqa: F401
    KEEP_OUT_STATUSES,
    MAX_CRAWL_DELAY_SECONDS,
    ROBOTS_PATH,
    RobotsPolicy,
    parse_policy,
    policy_from_reply,
)
from seo_common import (
    SeoToolError,
    ascii_url,
    assign_stems,
    emit,
    format_seconds,
    log,
    non_negative_float,
    read_list_file,
    require_http_url,
    run_cli,
    safe_urlsplit,
    without_fragment,
)
from url_guard import Resolver, non_public_reason, resolve_addresses

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
TIMEOUT_SECONDS = 30
MAX_REDIRECTS = 10
DEFAULT_DELAY_SECONDS = 1.5
BACKOFF_STATUSES = (429, 503)
DEFAULT_BACKOFF_SECONDS = 10.0
_parse_robots = parse_policy  # the old private names, kept for scripts that import them
_read_reply = read_reply


class Opener(Protocol):
    """Anything that opens a request like urllib's OpenerDirector."""

    def open(self, request: urllib.request.Request, /, *, timeout: float) -> Any: ...


def _netloc(url: str) -> str:
    return urlsplit(url).netloc.lower()


def _hostname(url: str) -> str:
    parts = safe_urlsplit(url)
    return (parts.hostname or "") if parts is not None else ""


class PoliteFetcher:
    """Fetches URLs one at a time, honouring robots.txt and a pause between requests to the same host."""

    def __init__(
        self,
        opener: Opener,
        delay: float = DEFAULT_DELAY_SECONDS,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
        max_bytes: Optional[int] = None,
        allow_private_hosts: bool = False,
        resolver: Resolver = resolve_addresses,
    ) -> None:
        self._opener = opener
        self._delay = delay
        self._max_bytes = max_bytes  # None: the page limit, MAX_BYTES, read when a request is made
        self._allow_private_hosts = allow_private_hosts  # follow redirects to local and private addresses too
        self._resolve = resolver
        self._clock = clock
        self._sleep = sleep
        self._policies: Dict[str, RobotsPolicy] = {}  # origin -> what its robots.txt allows
        self._last_end: Dict[str, float] = {}  # host -> when the last request to it finished
        self._backoff_until: Dict[str, float] = {}  # host -> not before this time (a 429 or 503 asked for a wait)
        self._gave_up: Dict[str, str] = {}  # host -> why no more requests go there

    def fetch(self, url: str) -> FetchResult:
        requested = require_http_url(url)
        journey = Journey(requested, requested)
        while True:
            refusal = self._gave_up.get(_netloc(journey.current)) or self._policy(journey.current).refusal(journey.current)
            if refusal:
                return journey.result(skipped=refusal)
            reply = self._exchange(journey.current)
            journey = journey.after(reply)
            target, problem = self._next_hop(requested, journey.current, reply)
            if not target or len(journey.hops) >= MAX_REDIRECTS:
                too_many = f"too many redirects (more than {MAX_REDIRECTS})" if target else ""
                return journey.result(reply, error=problem or too_many)
            journey = journey.moved_to(target, reply.status)

    def _policy(self, url: str) -> RobotsPolicy:
        parts = urlsplit(url)
        origin = f"{parts.scheme.lower()}://{parts.netloc.lower()}"
        if origin not in self._policies:
            self._policies[origin] = self._load_policy(origin)
        return self._policies[origin]

    def _next_hop(self, start: str, current: str, reply: RawReply) -> Tuple[str, str]:
        """redirect_target, plus the check that the target is not a local or private address (see url_guard).

        A target on the same host as ``start`` is never checked: that host was asked for (it may be the owner's
        own preview server), and a redirect such as /about -> /about/ must keep working there.
        """
        target, problem = redirect_target(current, reply)
        if not target or self._allow_private_hosts or _hostname(target) == _hostname(start):
            return target, problem
        reason = non_public_reason(_hostname(target), self._resolve)
        if reason:
            return "", f"redirect from {current} refused: {reason} (--allow-private-hosts follows it)"
        return target, problem

    def _load_policy(self, origin: str) -> RobotsPolicy:
        current = origin + ROBOTS_PATH
        reply = self._exchange(current)
        for _ in range(MAX_REDIRECTS):
            target, problem = self._next_hop(origin + ROBOTS_PATH, current, reply)
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
        self._note_rate_limit(host, reply)
        return replace(reply, elapsed_ms=round((self._last_end[host] - started) * 1000))

    def _note_rate_limit(self, host: str, reply: RawReply) -> None:
        """After a 429 or 503, wait as long as Retry-After says (10 s without it); a longer ask ends the visit."""
        if reply.status not in BACKOFF_STATUSES:
            return
        asked = retry_after_seconds(dict(reply.headers).get("retry-after", ""))
        wait = DEFAULT_BACKOFF_SECONDS if asked is None else asked
        if wait > MAX_CRAWL_DELAY_SECONDS:
            self._gave_up[host] = (
                f"{host} answered HTTP {reply.status} and asked clients to wait {format_seconds(wait)} s (Retry-After), "
                f"longer than the {format_seconds(MAX_CRAWL_DELAY_SECONDS)} s this tool will wait"
            )
        else:
            self._backoff_until[host] = max(self._backoff_until.get(host, 0.0), self._clock() + wait)

    def _wait_for_turn(self, host: str) -> None:
        last_end = self._last_end.get(host)
        if last_end is None:
            return
        pause = max(last_end + self._gap(host), self._backoff_until.get(host, 0.0)) - self._clock()
        if pause > 0:
            self._sleep(pause)

    def _gap(self, host: str) -> float:
        crawl = [p.crawl_delay for origin, p in self._policies.items() if urlsplit(origin).netloc == host]
        return max([self._delay, *crawl])

    def _open(self, url: str) -> RawReply:
        request = urllib.request.Request(ascii_url(url), headers=REQUEST_HEADERS)
        limit = MAX_BYTES if self._max_bytes is None else self._max_bytes
        try:
            with self._opener.open(request, timeout=TIMEOUT_SECONDS) as response:
                return read_reply(response, response.status, limit)
        except urllib.error.HTTPError as error:
            with error:  # an HTTP error is also the response: it carries the status, headers and body
                return read_reply(error, error.code, limit)
        except (urllib.error.URLError, OSError, http.client.HTTPException, ValueError) as error:
            return RawReply(None, (), error=f"{type(error).__name__}: {error}")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Never follow a redirect inside urllib: PoliteFetcher follows them itself, one checked hop at a time."""

    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: IO[bytes],
        code: int,
        msg: str,
        headers: Message,
        newurl: str,
    ) -> Optional[urllib.request.Request]:
        return None


def default_opener() -> Opener:
    """urllib's opener with only what this tool needs: proxies from the environment, http and https, no redirects.

    build_opener() would add the file:, ftp: and data: handlers too (and its own redirect handler).
    """
    opener = urllib.request.OpenerDirector()
    for handler in (
        urllib.request.ProxyHandler(),
        urllib.request.UnknownHandler(),
        urllib.request.HTTPHandler(),
        urllib.request.HTTPSHandler(),
        urllib.request.HTTPDefaultErrorHandler(),
        _NoRedirect(),
        urllib.request.HTTPErrorProcessor(),
    ):
        opener.add_handler(handler)
    return opener


def collect_urls(urls: Sequence[str], urls_file: Optional[Path]) -> Tuple[str, ...]:
    """Every URL checked up front (so a typo stops the run before any request), without #fragments, repeats dropped."""
    listed: List[str] = list(urls)
    if urls_file is not None:
        listed.extend(read_list_file(urls_file, "URLs"))
    return tuple(dict.fromkeys(without_fragment(require_http_url(url)) for url in listed))


def fetch_all(fetcher: PoliteFetcher, urls: Sequence[str], out_dir: Path) -> int:
    failed = skipped = 0
    stems = assign_stems(urls)
    for index, url in enumerate(urls, start=1):
        result = fetcher.fetch(url)
        save_result(out_dir, result, stems[url])
        emit(result_line(index, len(urls), result))
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
    parser.add_argument("--allow-private-hosts", action="store_true",
                        help="also follow redirects to local and private addresses (127.0.0.1, 192.168.x.x, "
                             "169.254.x.x, ...), for your own local preview server; refused by default")
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
    fetcher = PoliteFetcher(
        opener or default_opener(), delay=args.delay, clock=clock, sleep=sleep,
        allow_private_hosts=args.allow_private_hosts,
    )
    return fetch_all(fetcher, urls, args.out_dir)


if __name__ == "__main__":
    sys.exit(run_cli(main))
