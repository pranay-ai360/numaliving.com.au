#!/usr/bin/env python3
"""Run search queries on the local SearXNG instance and save one compact JSON file per query.

Usage:
    serp_search.py QUERIES_FILE [--out-dir DIR] [--engines NAMES] [--pages N] [--delay SECONDS] [--language LOCALE]

QUERIES_FILE has one query per line; blank lines and lines starting with # are skipped. Each query is saved as
<slug>.json in --out-dir (default: <data folder>/serp/<queries file name>/); serp_report.py reads the folder.

Needs SearXNG running (Docker Desktop started, then `docker compose up -d` in the SearXNG checkout):
  SEARXNG_URL         the instance (default http://localhost:8080)
  SEARXNG_CLIENT_DIR  the folder holding searxng_client.py, a stdlib-only single file from that checkout
                      (default: the SearXNG folder next to this repository). It is imported and run, so only
                      point it at a folder you trust.

--engines takes full engine names, comma separated (default "google cse,duckduckgo": Bing adds dictionary
noise and Brave is throttled on this network); --engines "" uses the instance's default engines.

A search that comes back empty while engines reported being throttled is retried (3 attempts, 25 s apart);
an empty search with no throttled engine genuinely has no matches and is not retried.
Standard library only.
"""

from __future__ import annotations

import argparse
import importlib.util
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType
from typing import Any, Callable, Dict, List, Mapping, Optional, Protocol, Sequence, Tuple, Type

from seo_common import (
    REPO_ROOT,
    SeoToolError,
    data_dir,
    emit,
    hashed_slug,
    log,
    non_negative_float,
    positive_int,
    printable,
    read_query_file,
    require_http_url,
    run_cli,
    safe_urlsplit,
    utc_now,
    write_json_file,
)
from url_guard import Resolver, non_public_reason, resolve_addresses

URL_ENV = "SEARXNG_URL"
CLIENT_DIR_ENV = "SEARXNG_CLIENT_DIR"
DEFAULT_URL = "http://localhost:8080"
CLIENT_FILE = "searxng_client.py"
CLIENT_MODULE = "searxng_client"
CLIENT_TIMEOUT_SECONDS = 90
CLIENT_RETRIES = 2
DEFAULT_ENGINES = "google cse,duckduckgo"
DEFAULT_LANGUAGE = "en-US"
DEFAULT_PAGES = 1
MAX_PAGES = 5
DEFAULT_DELAY_SECONDS = 5.0
MIN_DELAY_SECONDS = 1.0
PAGE_PAUSE_SECONDS = 2.0
RETRY_WAIT_SECONDS = 25.0
MAX_ATTEMPTS = 3
SNIPPET_CHARS = 280
ANSWER_CHARS = 300
INFOBOX_CHARS = 300
INFOBOX_URLS = 5
# The saved JSON schema. serp_report.py (and the baseline kept in the research pack) read exactly these keys.
RECORD_FIELDS = (
    "query", "language", "fetched_at", "attempts", "results", "suggestions", "answers", "corrections",
    "infoboxes", "unresponsive",
)


class SearchResult(Protocol):
    """One hit, as the SearXNG client returns it (the fields this tool saves)."""

    @property
    def url(self) -> str: ...
    @property
    def title(self) -> str: ...
    @property
    def content(self) -> str: ...
    @property
    def engines(self) -> Sequence[str]: ...
    @property
    def score(self) -> float: ...
    @property
    def published_date(self) -> Optional[str]: ...
    @property
    def domain(self) -> str: ...


class EngineProblem(Protocol):
    @property
    def name(self) -> str: ...
    @property
    def reason(self) -> str: ...


class Infobox(Protocol):
    @property
    def title(self) -> str: ...
    @property
    def content(self) -> str: ...
    @property
    def urls(self) -> Sequence[Mapping[str, Any]]: ...


class SearchResponse(Protocol):
    """One page of an answer from the SearXNG client."""

    @property
    def results(self) -> Sequence[SearchResult]: ...
    @property
    def unresponsive_engines(self) -> Sequence[EngineProblem]: ...
    @property
    def suggestions(self) -> Sequence[Any]: ...
    @property
    def answers(self) -> Sequence[Any]: ...
    @property
    def corrections(self) -> Sequence[Any]: ...
    @property
    def infoboxes(self) -> Sequence[Infobox]: ...


class SearxngClientLike(Protocol):
    """The two methods of searxng_client.SearxngClient that this tool calls."""

    def search(self, query: str, **options: Any) -> SearchResponse: ...
    def healthcheck(self) -> bool: ...


@dataclass(frozen=True)
class SearchSettings:
    engines: Tuple[str, ...] = ()
    pages: int = DEFAULT_PAGES
    language: str = DEFAULT_LANGUAGE


@dataclass(frozen=True)
class SearxngConnection:
    client: SearxngClientLike  # the client's search() and healthcheck()
    error_type: Type[BaseException]  # the client's own SearxngError, so a failed query can be told from a bug


@dataclass(frozen=True)
class PageOutcome:
    response: SearchResponse
    attempts: int
    unresponsive: Tuple[Tuple[str, str], ...]


def client_dir() -> Path:
    override = os.environ.get(CLIENT_DIR_ENV, "").strip()
    return Path(override).expanduser() if override else REPO_ROOT.parent / "SearXNG"


def searxng_url() -> str:
    raw = os.environ.get(URL_ENV, "").strip() or DEFAULT_URL
    try:
        return require_http_url(raw, hint=f"for example {DEFAULT_URL}")
    except SeoToolError as error:
        raise SeoToolError(f"{URL_ENV} is not usable: {error}") from error


def remote_instance_warning(url: str, resolve: Resolver = resolve_addresses) -> str:
    """A sentence when the SearXNG instance is on the internet, "" when it is local or on a private network."""
    parts = safe_urlsplit(url)
    host = (parts.hostname or "") if parts is not None else ""
    if not host or non_public_reason(host, resolve):
        return ""
    return f"SearXNG is at {host}, on the internet: the queries in this run are sent to that server"


def parse_engines(text: str) -> Tuple[str, ...]:
    return tuple(name.strip() for name in text.split(",") if name.strip())


def load_client_module(folder: Path) -> ModuleType:
    """Import searxng_client.py from ``folder`` without touching sys.path."""
    source = folder / CLIENT_FILE
    if not source.is_file():
        raise SeoToolError(
            f"cannot find {CLIENT_FILE} in {folder}. Set {CLIENT_DIR_ENV} to the folder that holds it "
            "(by default the SearXNG checkout next to this repository)."
        )
    spec = importlib.util.spec_from_file_location(CLIENT_MODULE, source)
    if spec is None or spec.loader is None:
        raise SeoToolError(f"cannot load {source}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[CLIENT_MODULE] = module  # the client defines dataclasses, which look their module up here
    try:
        spec.loader.exec_module(module)
    except (Exception, SystemExit) as error:  # someone else's file: report whatever it raises while loading
        sys.modules.pop(CLIENT_MODULE, None)
        raise SeoToolError(f"cannot load {source}: {type(error).__name__}: {error}") from error
    return module


def connect_searxng(base_url: str, folder: Path) -> SearxngConnection:
    """A client for the instance, or a SeoToolError that says how to start it."""
    module = load_client_module(folder)
    log(f"using the SearXNG client {folder / CLIENT_FILE} (it is run, not just read)")
    try:
        client = module.SearxngClient(base_url, timeout=CLIENT_TIMEOUT_SECONDS, max_retries=CLIENT_RETRIES)
        error_type = module.SearxngError
        reachable = client.healthcheck()
    except AttributeError as error:
        raise SeoToolError(f"{folder / CLIENT_FILE} does not look like the SearXNG client: {error}") from error
    if not reachable:
        raise SeoToolError(
            f"SearXNG is not reachable at {base_url}. Start Docker Desktop, then run `docker compose up -d` in the "
            f"SearXNG checkout ({folder}), and try again."
        )
    return SearxngConnection(client, error_type)


def _search(client: SearxngClientLike, query: str, page: int, settings: SearchSettings) -> SearchResponse:
    if settings.engines:
        return client.search(query, engines=list(settings.engines), language=settings.language, pageno=page)
    return client.search(query, categories="general", language=settings.language, pageno=page)


def search_page(
    client: SearxngClientLike, query: str, page: int, settings: SearchSettings, sleep: Callable[[float], None]
) -> PageOutcome:
    """One result page. Empty with throttled engines is transient and retried; empty alone is a real answer."""
    attempt = 1
    seen: List[Tuple[str, str]] = []
    while True:
        response = _search(client, query, page, settings)
        seen.extend((engine.name, engine.reason) for engine in response.unresponsive_engines)
        if response.results or not response.unresponsive_engines or attempt >= MAX_ATTEMPTS:
            return PageOutcome(response, attempt, tuple(seen))
        sleep(RETRY_WAIT_SECONDS)
        attempt += 1


def collect_results(responses: Sequence[SearchResponse]) -> List[Dict[str, Any]]:
    seen: set = set()
    results: List[Dict[str, Any]] = []
    for response in responses:
        for result in response.results:
            if not result.url or result.url in seen:
                continue
            seen.add(result.url)
            results.append(
                {
                    "rank": len(results) + 1,
                    "url": result.url,
                    "domain": result.domain,
                    "title": result.title,
                    "snippet": result.content[:SNIPPET_CHARS],
                    "engines": list(result.engines),
                    "score": round(result.score, 3),
                    "published": result.published_date,
                }
            )
    return results


def _infobox(box: Infobox) -> Dict[str, Any]:
    return {
        "title": box.title,
        "content": box.content[:INFOBOX_CHARS],
        "urls": [link.get("url") for link in box.urls][:INFOBOX_URLS],
    }


def run_query(
    client: SearxngClientLike,
    query: str,
    settings: SearchSettings,
    sleep: Callable[[float], None] = time.sleep,
    now: Callable[[], str] = utc_now,
) -> Dict[str, Any]:
    """Search ``settings.pages`` result pages and return the record that is saved as JSON."""
    outcomes: List[PageOutcome] = []
    for page in range(1, settings.pages + 1):
        outcomes.append(search_page(client, query, page, settings, sleep))
        if page < settings.pages:
            sleep(PAGE_PAUSE_SECONDS)
    responses = [outcome.response for outcome in outcomes]
    throttled = sorted({pair for outcome in outcomes for pair in outcome.unresponsive})
    return {
        "query": query,
        "language": settings.language,
        "fetched_at": now(),
        "attempts": sum(outcome.attempts for outcome in outcomes),
        "results": collect_results(responses),
        "suggestions": list(dict.fromkeys(str(item) for r in responses for item in r.suggestions)),
        "answers": [str(item)[:ANSWER_CHARS] for r in responses for item in r.answers],
        "corrections": [str(item) for r in responses for item in r.corrections],
        "infoboxes": [_infobox(box) for r in responses for box in r.infoboxes],
        "unresponsive": [list(pair) for pair in throttled],
    }


def status_line(prefix: str, query: str, record: Dict[str, Any]) -> str:
    throttled = ", ".join(f"{name}({reason})" for name, reason in record["unresponsive"]) or "none"
    status = "ok" if record["results"] else "EMPTY"
    return printable(
        f"{prefix} {status} {len(record['results'])} results, {len(record['suggestions'])} suggestions"
        f" | throttled: {throttled} | {query!r}"
    )


def run_queries(
    connection: SearxngConnection,
    queries: Sequence[str],
    settings: SearchSettings,
    delay: float,
    out_dir: Path,
    sleep: Callable[[float], None],
) -> int:
    failures = 0
    for index, query in enumerate(queries, start=1):
        prefix = f"[{index}/{len(queries)}]"
        try:
            record = run_query(connection.client, query, settings, sleep=sleep)
        except connection.error_type as error:
            failures += 1
            emit(f"{prefix} ERROR {error} | {query!r}")
        else:
            write_json_file(out_dir / f"{hashed_slug(query)}.json", record)
            emit(status_line(prefix, query, record))
        if index < len(queries):
            sleep(delay)
    return 1 if failures else 0


def _pages(text: str) -> int:
    value = positive_int(text)
    if value > MAX_PAGES:
        raise argparse.ArgumentTypeError(f"{text!r} must be {MAX_PAGES} or less")
    return value


def _delay(text: str) -> float:
    value = non_negative_float(text)
    if value < MIN_DELAY_SECONDS:
        raise argparse.ArgumentTypeError(f"{text!r} is too short: queries must be at least {MIN_DELAY_SECONDS:g} second apart")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False
    )
    parser.add_argument("queries_file", type=Path, metavar="QUERIES_FILE", help="one query per line")
    parser.add_argument("--out-dir", type=Path, metavar="DIR",
                        help="where to save the JSON files (default: <data folder>/serp/<queries file name>)")
    parser.add_argument("--engines", default=DEFAULT_ENGINES, metavar="NAMES",
                        help=f'comma-separated full engine names (default "{DEFAULT_ENGINES}"; "" = instance defaults)')
    parser.add_argument("--pages", type=_pages, default=DEFAULT_PAGES, metavar="N",
                        help=f"result pages per query, 1 to {MAX_PAGES} (default {DEFAULT_PAGES})")
    parser.add_argument("--delay", type=_delay, default=DEFAULT_DELAY_SECONDS, metavar="SECONDS",
                        help=f"pause between queries, at least {MIN_DELAY_SECONDS:g} (default {DEFAULT_DELAY_SECONDS:g})")
    parser.add_argument("--language", default=DEFAULT_LANGUAGE, metavar="LOCALE",
                        help=f"search locale (default {DEFAULT_LANGUAGE})")
    return parser


def main(
    argv: Optional[Sequence[str]] = None,
    connect: Callable[[str, Path], SearxngConnection] = connect_searxng,
    sleep: Callable[[float], None] = time.sleep,
) -> int:
    args = build_parser().parse_args(argv)
    queries = read_query_file(args.queries_file)
    settings = SearchSettings(parse_engines(args.engines), args.pages, args.language)
    out_dir = args.out_dir or data_dir() / "serp" / args.queries_file.stem
    url = searxng_url()
    warning = remote_instance_warning(url)
    if warning:
        log(f"warning: {warning}")
    connection = connect(url, client_dir())
    code = run_queries(connection, queries, settings, args.delay, out_dir, sleep)
    log(f"results are in {out_dir}")
    return code


if __name__ == "__main__":
    sys.exit(run_cli(main))
