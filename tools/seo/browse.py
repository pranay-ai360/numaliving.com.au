#!/usr/bin/env python3
"""Screenshots and Google results pages, through the repository's single-seat CloakBrowser launcher.

Run it with python3.14 (the interpreter that has cloakbrowser; see tools/site-qa/README.md):

    python3.14 tools/seo/browse.py shots URL [URL ...] [--urls-file FILE] [--out-dir DIR] [--full-page] [--delay S]
    python3.14 tools/seo/browse.py serp QUERY [QUERY ...] [--queries-file FILE] [--out-dir DIR] [--delay S]

shots  for each page: a desktop screenshot of the first screen (1440x900), a mobile one (390x844, 2x), the page's
       visible text, and with --full-page a full-height desktop screenshot. Default folder: <data>/browse/shots.
serp   for each query: the text and a screenshot of Google's results page (English, US: hl=en, gl=us, no
       personalisation). google_features.py reads the text files. Default folder: <data>/browse/serp.

The free CloakBrowser licence has ONE seat, shared with the other tools. If it is taken the launch fails and this
script exits with code 76: find out whose browser it is before closing it (see docs/RUNBOOK.md).

Google's terms restrict automated queries, so `serp` is for small research runs only. It refuses more than 15
queries in one run and a --delay under 10 seconds, it stops at the first block page (unusual traffic, a captcha,
a /sorry/ address, HTTP 429) and it never tries to get past one.
"""

from __future__ import annotations

import argparse
import contextlib
import importlib.util
import re
import sys
import time
from pathlib import Path
from types import ModuleType
from typing import Any, Dict, Iterator, List, Optional, Sequence, Tuple
from urllib.parse import quote_plus

from fetch_pages import collect_urls
from seo_common import (
    SeoToolError,
    data_dir,
    log,
    non_negative_float,
    read_query_file,
    run_cli,
    slugify,
    url_slug,
    write_json_file,
    write_text_file,
)

QA_DIR = Path(__file__).resolve().parent.parent / "site-qa"
LAUNCHER_MODULE = "qa_common"
EXIT_SEAT_TAKEN = 76
EXIT_BLOCKED = 1
MAX_SERP_QUERIES = 15
MIN_SERP_DELAY_SECONDS = 10.0
DEFAULT_SERP_DELAY_SECONDS = 15.0
DEFAULT_SHOTS_DELAY_SECONDS = 3.0
BLOCK_CHECK_CHARS = 1500
BLOCK_PATTERN = re.compile(r"unusual traffic|not a robot|/sorry/|captcha", re.IGNORECASE)
HTTP_TOO_MANY_REQUESTS = 429
GOOGLE_SEARCH = "https://www.google.com/search"
NAV_TIMEOUT_MS = 45_000
SETTLE_MS = 1_500
SERP_SETTLE_MS = 3_000
DESKTOP = (1440, 900)
MOBILE = (390, 844)
MOBILE_SCALE = 2
TEXT_LIMIT = 30_000
SERP_TEXT_LIMIT = 20_000
SERP_LABEL_LENGTH = 70

JS_TEXT = f"() => (document.body ? document.body.innerText : '').slice(0, {TEXT_LIMIT})"
JS_SERP = f"""
() => {{
  const text = document.body ? document.body.innerText : "";
  return {{
    url: location.href,
    title: document.title,
    organicTitles: Array.from(document.querySelectorAll('a h3')).map((h) => h.textContent || '').slice(0, 20),
    hasAds: !!document.querySelector('#tads, #tadsb, [data-text-ad]'),
    text: text.slice(0, {SERP_TEXT_LIMIT}),
  }};
}}
"""


class BrowserSeatError(SeoToolError):
    """The browser could not be launched, most likely because another process holds the single seat."""

    exit_code = EXIT_SEAT_TAKEN


def google_search_url(query: str) -> str:
    return f"{GOOGLE_SEARCH}?q={quote_plus(query)}&hl=en&gl=us&pws=0"


def is_block_page(url: str, text: str, status: Optional[int] = None) -> bool:
    """True for Google's "unusual traffic" / captcha / /sorry/ pages and for HTTP 429."""
    return status == HTTP_TOO_MANY_REQUESTS or bool(BLOCK_PATTERN.search(f"{url} {text[:BLOCK_CHECK_CHARS]}"))


def validate_serp_request(queries: Sequence[str], delay: float) -> Tuple[str, ...]:
    """The queries to run (repeats dropped), or a SeoToolError when the request is too big or too fast."""
    unique = tuple(dict.fromkeys(query.strip() for query in queries if query.strip()))
    if not unique:
        raise SeoToolError("give at least one query")
    if len(unique) > MAX_SERP_QUERIES:
        raise SeoToolError(
            f"{len(unique)} queries is too many: `serp` runs at most {MAX_SERP_QUERIES} per run "
            "(Google's terms restrict automated queries, so keep these runs small)"
        )
    if delay < MIN_SERP_DELAY_SECONDS:
        raise SeoToolError(f"--delay {delay:g} is too short: queries must be at least {MIN_SERP_DELAY_SECONDS:g} seconds apart")
    return unique


def shot_label(url: str) -> str:
    return url_slug(url)


def serp_label(query: str) -> str:
    return slugify(query, SERP_LABEL_LENGTH) or "query"


def require_cloakbrowser() -> None:
    if importlib.util.find_spec("cloakbrowser") is None:
        raise SeoToolError(
            f"cloakbrowser is not installed for {sys.executable}: run this script with python3.14, which has it "
            "(see tools/site-qa/README.md to install it elsewhere)"
        )


def load_launcher() -> ModuleType:
    """Import tools/site-qa/qa_common.py by path (it holds the single-seat launcher) without touching sys.path."""
    source = QA_DIR / "qa_common.py"
    if not source.is_file():
        raise SeoToolError(f"cannot find the browser launcher {source} (tools/site-qa/qa_common.py)")
    loaded = sys.modules.get(LAUNCHER_MODULE)
    if loaded is not None and Path(getattr(loaded, "__file__", "")).resolve() == source.resolve():
        return loaded
    spec = importlib.util.spec_from_file_location(LAUNCHER_MODULE, source)
    if spec is None or spec.loader is None:
        raise SeoToolError(f"cannot load {source}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[LAUNCHER_MODULE] = module  # its dataclasses look their module up here
    try:
        spec.loader.exec_module(module)
    except Exception as error:  # the launcher is repository code, but report any import failure plainly
        sys.modules.pop(LAUNCHER_MODULE, None)
        raise SeoToolError(f"cannot load {source}: {type(error).__name__}: {error}") from error
    return module


@contextlib.contextmanager
def seat(qa: ModuleType) -> Iterator[Any]:  # pragma: no cover - needs the real browser
    """The single browser seat; a failed launch becomes BrowserSeatError (exit code 76)."""
    try:
        with qa.open_browser() as browser:
            yield browser
    except qa.QAError as error:
        raise BrowserSeatError(str(error)) from error


def _context(qa: ModuleType, browser: Any, viewport: Tuple[int, int], mobile: bool) -> Any:  # pragma: no cover
    width, height = viewport
    if mobile:
        return browser.new_context(
            viewport={"width": width, "height": height}, device_scale_factor=MOBILE_SCALE, is_mobile=True,
            has_touch=True, locale="en-US",
        )
    return qa.new_context(browser, width, height)


def _capture_view(
    qa: ModuleType, browser: Any, url: str, out_dir: Path, label: str, name: str, mobile: bool, full_page: bool
) -> Dict[str, Any]:  # pragma: no cover - needs the real browser
    viewport = MOBILE if mobile else DESKTOP
    context = _context(qa, browser, viewport, mobile)
    result: Dict[str, Any] = {"status": None, "shots": [], "text": False, "error": None}
    try:
        page = context.new_page()
        response = page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
        result["status"] = response.status if response else None
        page.wait_for_timeout(SETTLE_MS)
        try:
            qa.prepare_page(page)
        except Exception as error:  # an odd CSP or a slow page must not stop the batch
            log(f"  prepare_page problem on {label}/{name}: {error}")
        fold = out_dir / f"{label}-{name}-fold.png"
        page.screenshot(path=str(fold), full_page=False)
        result["shots"].append(fold.name)
        if full_page and not mobile:
            whole = out_dir / f"{label}-{name}-full.png"
            page.screenshot(path=str(whole), full_page=True)
            result["shots"].append(whole.name)
        if not mobile:
            write_text_file(out_dir / f"{label}.txt", page.evaluate(JS_TEXT))
            result["text"] = True
    except Exception as error:  # Playwright raises its own error types; record and carry on with the next page
        result["error"] = f"{type(error).__name__}: {error}"
        log(f"  {label}/{name} failed: {result['error'][:160]}")
    finally:
        context.close()
    return result


def run_shots(args: argparse.Namespace, urls: Sequence[str]) -> int:  # pragma: no cover - needs the real browser
    require_cloakbrowser()
    qa = load_launcher()
    out_dir = args.out_dir or data_dir() / "browse" / "shots"
    pages: List[Dict[str, Any]] = []
    with seat(qa) as browser:
        for index, url in enumerate(urls):
            log(f"shots: {url}")
            label = shot_label(url)
            views = [
                _capture_view(qa, browser, url, out_dir, label, name, mobile, args.full_page)
                for name, mobile in (("desktop", False), ("mobile", True))
            ]
            pages.append({"label": label, "url": url, "views": views})
            if index < len(urls) - 1:
                time.sleep(args.delay)
    write_json_file(out_dir / "manifest.json", {"pages": pages})
    failed = [page for page in pages if any(view["error"] for view in page["views"])]
    log(f"done: {len(pages) - len(failed)}/{len(pages)} pages captured in {out_dir}")
    return 1 if failed else 0


def _capture_serp(browser: Any, query: str, out_dir: Path) -> Dict[str, Any]:  # pragma: no cover
    context = browser.new_context(viewport={"width": DESKTOP[0], "height": DESKTOP[1]}, locale="en-US")
    record: Dict[str, Any] = {"query": query, "blocked": False, "error": None}
    try:
        page = context.new_page()
        response = page.goto(google_search_url(query), wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
        page.wait_for_timeout(SERP_SETTLE_MS)
        data = page.evaluate(JS_SERP)
        record["blocked"] = is_block_page(data["url"], data["text"], response.status if response else None)
        record.update({key: data[key] for key in ("title", "organicTitles", "hasAds")})
        if not record["blocked"]:
            label = serp_label(query)
            write_text_file(out_dir / f"{label}.txt", data["text"])
            page.screenshot(path=str(out_dir / f"{label}.png"), full_page=False)
    except Exception as error:  # record it and let the caller decide; a block page is handled by the caller
        record["error"] = f"{type(error).__name__}: {error}"
    finally:
        context.close()
    return record


def run_serp(args: argparse.Namespace, queries: Sequence[str]) -> int:  # pragma: no cover - needs the real browser
    require_cloakbrowser()
    qa = load_launcher()
    out_dir = args.out_dir or data_dir() / "browse" / "serp"
    records: List[Dict[str, Any]] = []
    blocked = False
    with seat(qa) as browser:
        for index, query in enumerate(queries):
            log(f"google: {query!r}")
            records.append(_capture_serp(browser, query, out_dir))
            if records[-1]["blocked"]:
                blocked = True
                log("Google showed a block page: stopping here. This tool never tries to get past it; "
                    "wait a good while before another run, and keep the runs small.")
                break
            if index < len(queries) - 1:
                time.sleep(args.delay)
    write_json_file(out_dir / "manifest.json", {"queries": records})
    log(f"done: {len(records)} of {len(queries)} queries captured in {out_dir}")
    return EXIT_BLOCKED if blocked else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False
    )
    commands = parser.add_subparsers(dest="command", required=True, metavar="{shots,serp}")
    shots = commands.add_parser("shots", allow_abbrev=False, help="screenshots and text of pages")
    shots.add_argument("urls", nargs="*", metavar="URL", help="http(s) pages to capture")
    shots.add_argument("--urls-file", type=Path, metavar="FILE", help="a list of URLs, one per line")
    shots.add_argument("--out-dir", type=Path, metavar="DIR", help="default: <data folder>/browse/shots")
    shots.add_argument("--full-page", action="store_true", help="also take a full-height desktop screenshot")
    shots.add_argument("--delay", type=non_negative_float, default=DEFAULT_SHOTS_DELAY_SECONDS, metavar="SECONDS",
                       help=f"pause between pages (default {DEFAULT_SHOTS_DELAY_SECONDS:g})")
    serp = commands.add_parser("serp", allow_abbrev=False, help="Google results pages (small runs only)")
    serp.add_argument("queries", nargs="*", metavar="QUERY", help=f"at most {MAX_SERP_QUERIES} queries")
    serp.add_argument("--queries-file", type=Path, metavar="FILE", help="a list of queries, one per line")
    serp.add_argument("--out-dir", type=Path, metavar="DIR", help="default: <data folder>/browse/serp")
    serp.add_argument("--delay", type=non_negative_float, default=DEFAULT_SERP_DELAY_SECONDS, metavar="SECONDS",
                      help=f"pause between queries, at least {MIN_SERP_DELAY_SECONDS:g} (default {DEFAULT_SERP_DELAY_SECONDS:g})")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "shots":
        if not args.urls and args.urls_file is None:
            parser.error("shots needs at least one URL, or --urls-file FILE")
        return run_shots(args, collect_urls(args.urls, args.urls_file))
    if not args.queries and args.queries_file is None:
        parser.error("serp needs at least one query, or --queries-file FILE")
    listed = list(args.queries) + (list(read_query_file(args.queries_file)) if args.queries_file else [])
    return run_serp(args, validate_serp_request(listed, args.delay))


if __name__ == "__main__":
    sys.exit(run_cli(main))
