#!/usr/bin/env python3
"""Group the URLs of a sitemap by path shape and count how many were last modified each day.

Usage:
    sitemap_report.py SOURCE [--max-children N] [--top N] [--max-days N] [--samples N] [--delay SECONDS]
                      [--allow-private-hosts]

SOURCE is a sitemap file (.xml or .xml.gz) or an http(s) URL, which is fetched politely through fetch_pages
(robots.txt, pauses, a 50 MiB limit). A sitemap must be UTF-8 and without a DOCTYPE or entity declaration. A
sitemap index is followed for at most 10 child sitemaps (--max-children 0 to 10), all on the index's host.

The report shows the lastmod range, the URL groups (first path segment and depth, with sample paths) and a
per-day count with bars. The per-day view is how scaled content stands out: one competitor's sitemap listed
9,488 templated pages that were published at 130 to 350 a day. Standard library only.
"""

from __future__ import annotations

import argparse
import re
import statistics
import sys
import xml.etree.ElementTree as ElementTree
import zlib
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Dict, List, Optional, Sequence, Tuple

from fetch_pages import DEFAULT_DELAY_SECONDS, FetchResult, PoliteFetcher, default_opener
from html_facts import host_of
from seo_common import (
    SeoToolError,
    emit,
    non_negative_float,
    positive_int,
    printable,
    read_bytes_file,
    require_http_url,
    run_cli,
    safe_urlsplit,
)

MAX_CHILD_SITEMAPS = 10
MAX_SITEMAP_BYTES = 52_428_800  # 50 MiB: the limit the sitemap protocol sets for one file
DEFAULT_TOP_GROUPS = 25
DEFAULT_MAX_DAYS = 60
DEFAULT_SAMPLES = 2
BAR_WIDTH = 40
HOME_SEGMENT = "(home)"
GZIP_MAGIC = b"\x1f\x8b"
GZIP_WBITS = zlib.MAX_WBITS | 16
DAY_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")
DOCTYPE_PATTERN = re.compile(r"<!\s*(?:DOCTYPE|ENTITY)", re.IGNORECASE)
UTF16_MARKS = (b"\xff\xfe", b"\xfe\xff")  # a UTF-32 little-endian mark starts like the first one
CHILD_LISTING_LIMIT = 10
FetchFunction = Callable[[str], FetchResult]


@dataclass(frozen=True)
class SitemapEntry:
    loc: str
    lastmod: str  # as written; "" when absent


@dataclass(frozen=True)
class Sitemap:
    source: str
    is_index: bool
    entries: Tuple[SitemapEntry, ...]


@dataclass(frozen=True)
class UrlGroup:
    segment: str
    depth: int
    count: int
    samples: Tuple[str, ...]


@dataclass(frozen=True)
class SitemapReport:
    sitemaps: Tuple[str, ...]
    total_urls: int
    groups: Tuple[UrlGroup, ...]
    days: Tuple[Tuple[str, int], ...]
    undated: int
    first_lastmod: str
    last_lastmod: str
    notes: Tuple[str, ...]

    @property
    def sitemap_count(self) -> int:
        return len(self.sitemaps)


def _inflate(data: bytes, source: str) -> bytes:
    too_large = SeoToolError(f"{source} is too large (more than {MAX_SITEMAP_BYTES} bytes uncompressed)")
    if not data.startswith(GZIP_MAGIC):
        if len(data) > MAX_SITEMAP_BYTES:
            raise too_large
        return data
    try:
        xml = zlib.decompressobj(GZIP_WBITS).decompress(data, MAX_SITEMAP_BYTES + 1)
    except zlib.error as error:
        raise SeoToolError(f"{source} is not a valid gzip file: {error}") from error
    if len(xml) > MAX_SITEMAP_BYTES:
        raise too_large
    return xml


def _decode_utf8(xml: bytes, source: str) -> str:
    """The sitemap as text. The protocol requires UTF-8, and the DOCTYPE guard has to read what the parser will read."""
    if xml.startswith(UTF16_MARKS) or b"\x00" in xml:
        raise SeoToolError(f"{source} is not UTF-8 text (sitemaps must be UTF-8; UTF-16 and UTF-32 files are refused)")
    try:
        return xml.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise SeoToolError(f"{source} is not valid UTF-8 ({error.reason} at byte {error.start})") from error


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child_text(item: ElementTree.Element, name: str) -> str:
    for child in item:
        if _local_name(child.tag) == name:
            return (child.text or "").strip()
    return ""


def parse_sitemap(data: bytes, source: str) -> Sitemap:
    """Parse a sitemap or sitemap index (plain or gzip, UTF-8 only). A DOCTYPE or entity declaration is refused."""
    text = _decode_utf8(_inflate(data, source), source)
    if DOCTYPE_PATTERN.search(text):
        raise SeoToolError(f"{source} has a DOCTYPE or entity declaration, which sitemaps do not need; not parsing it")
    try:
        root = ElementTree.fromstring(text)
    except ElementTree.ParseError as error:
        raise SeoToolError(f"{source} is not valid XML: {error}") from error
    kind = _local_name(root.tag)
    if kind not in ("urlset", "sitemapindex"):
        raise SeoToolError(f"{source} is not a sitemap (its root element is <{kind}>)")
    item_name = "sitemap" if kind == "sitemapindex" else "url"
    entries = tuple(
        SitemapEntry(loc, _child_text(item, "lastmod"))
        for item in root
        if _local_name(item.tag) == item_name
        for loc in [_child_text(item, "loc")]
        if loc
    )
    return Sitemap(source=source, is_index=kind == "sitemapindex", entries=entries)


def group_entries(entries: Sequence[SitemapEntry], samples: int = DEFAULT_SAMPLES) -> Tuple[UrlGroup, ...]:
    """Group by first path segment and depth; biggest first, then shallower, then by name.

    An address that urlsplit refuses (http://[::1/) belongs to no group; build_report counts and mentions those."""
    buckets: Dict[Tuple[str, int], List[str]] = {}
    for entry in entries:
        parts = safe_urlsplit(entry.loc)
        if parts is None:
            continue
        path = parts.path
        segments = [part for part in path.split("/") if part]
        key = (segments[0] if segments else HOME_SEGMENT, len(segments))
        buckets.setdefault(key, []).append(path or "/")
    groups = [
        UrlGroup(segment, depth, len(paths), tuple(paths[:samples])) for (segment, depth), paths in buckets.items()
    ]
    return tuple(sorted(groups, key=lambda group: (-group.count, group.depth, group.segment)))


def _day_of(lastmod: str) -> str:
    """The calendar day of a lastmod value, or "" when it does not start with a real date."""
    match = DAY_PATTERN.match(lastmod)
    if not match:
        return ""
    try:
        datetime.strptime(match.group(0), "%Y-%m-%d")
    except ValueError:
        return ""
    return match.group(0)


def daily_counts(entries: Sequence[SitemapEntry]) -> Tuple[Tuple[Tuple[str, int], ...], int]:
    """((day, URLs last modified that day) in date order, how many entries have no usable lastmod)."""
    counts: Dict[str, int] = {}
    undated = 0
    for entry in entries:
        day = _day_of(entry.lastmod)
        if day:
            counts[day] = counts.get(day, 0) + 1
        else:
            undated += 1
    return tuple(sorted(counts.items())), undated


def _size(count: int) -> str:
    return f"{count / 1e6:.1f} MB" if count >= 1_000_000 else f"{count:,} bytes"


def fetch_problem(result: FetchResult) -> str:
    """Why a fetch gave nothing usable, or "" when it answered 200."""
    if result.skipped:
        return result.skipped
    if result.error:
        return result.error
    if result.status != 200:
        return f"HTTP {result.status}"
    if result.truncated:
        return f"the download was truncated at {_size(len(result.body))}, so the sitemap is incomplete"
    return ""


def _child_urls(index: Sitemap, origin: str, limit: int) -> Tuple[Tuple[str, ...], List[str]]:
    """The child sitemap URLs to read (same host, at most ``limit``) and notes about the others."""
    valid: List[str] = []
    notes: List[str] = []
    for entry in index.entries:
        try:
            valid.append(require_http_url(entry.loc, hint=""))
        except SeoToolError as error:
            notes.append(f"ignored sitemap location {entry.loc}: {error}")
    host = host_of(origin) if "://" in origin else (host_of(valid[0]) if valid else "")
    same = list(dict.fromkeys(url for url in valid if host_of(url) == host))  # a child listed twice is read once
    elsewhere = sorted({host_of(url) for url in valid if host_of(url) != host})
    if elsewhere:
        notes.append(f"skipped sitemaps on another host ({', '.join(elsewhere)}): only the index's own host is read")
    if limit == 0 and same:
        listing = ", ".join(same[:CHILD_LISTING_LIMIT])
        notes.append(f"the index lists {len(same)} sitemap(s); none were read (--max-children 0): {listing}")
    elif len(same) > limit:
        notes.append(f"the index lists {len(same)} sitemaps; only the first {limit} were read")
    return tuple(same[:limit]), notes


def _read_child(url: str, fetch: FetchFunction) -> Tuple[Optional[Sitemap], str]:
    result = fetch(url)
    problem = fetch_problem(result)
    if problem:
        return None, f"could not read {url}: {problem}"
    try:
        child = parse_sitemap(result.body, url)
    except SeoToolError as error:
        return None, f"could not read {url}: {error}"
    if child.is_index:
        return None, f"{url} is a nested sitemap index; it was not followed"
    return child, ""


def build_report(
    sitemap: Sitemap,
    origin: str,
    fetch: FetchFunction,
    max_children: int = MAX_CHILD_SITEMAPS,
    samples: int = DEFAULT_SAMPLES,
) -> SitemapReport:
    """Report on a sitemap, following an index for up to ``max_children`` (never more than 10) child sitemaps."""
    documents: List[Sitemap] = [sitemap]
    notes: List[str] = []
    if sitemap.is_index:
        urls, notes = _child_urls(sitemap, origin, max(0, min(max_children, MAX_CHILD_SITEMAPS)))
        children = [_read_child(url, fetch) for url in urls]
        documents = [child for child, _ in children if child is not None]
        notes = notes + [note for _, note in children if note]
    entries = tuple(entry for document in documents for entry in document.entries)
    unreadable = len([entry for entry in entries if safe_urlsplit(entry.loc) is None])
    if unreadable:
        notes.append(
            f"{unreadable} of {len(entries)} listed URLs are not valid web addresses and are not in the groups"
        )
    days, undated = daily_counts(entries)
    sources = (origin, *(document.source for document in documents)) if sitemap.is_index else (sitemap.source,)
    return SitemapReport(
        sitemaps=sources,
        total_urls=len(entries),
        groups=group_entries(entries, samples),
        days=days,
        undated=undated,
        first_lastmod=days[0][0] if days else "",
        last_lastmod=days[-1][0] if days else "",
        notes=tuple(notes),
    )


def _number(value: float) -> str:
    return f"{value:g}"


def render_report(report: SitemapReport, max_days: int = DEFAULT_MAX_DAYS, top: int = DEFAULT_TOP_GROUPS) -> str:
    undated = f"; {report.undated} without a usable lastmod" if report.undated else ""
    lines = [
        f"{report.total_urls} URLs in {report.sitemap_count} sitemap(s); "
        f"lastmod range {report.first_lastmod or '-'} .. {report.last_lastmod or '-'}{undated}",
        "",
        f"URL groups by first path segment and depth (top {min(top, len(report.groups))} of {len(report.groups)}):",
    ]
    for group in report.groups[:top]:
        label = f"{group.segment}  depth={group.depth}"
        lines.append(f"{group.count:>7}  {label:<34} e.g. " + " | ".join(group.samples))
    if report.days:
        counts = [count for _, count in report.days]
        peak = max(counts)
        shown = report.days[-max_days:]
        lines += ["", f"URLs per lastmod day (latest {len(shown)} of {len(report.days)} days):"]
        lines += [f"  {day}  {count:>5} {'#' * max(1, round(count / peak * BAR_WIDTH))}" for day, count in shown]
        lines.append(
            f"per day: min {min(counts)}, median {_number(statistics.median(counts))}, max {peak}"
        )
    if report.notes:
        lines += ["", *(f"note: {note}" for note in report.notes)]
    return printable("\n".join(lines))


def _child_limit(text: str) -> int:
    try:
        value = int(text)
    except ValueError:
        raise argparse.ArgumentTypeError(f"{text!r} is not a whole number") from None
    if not 0 <= value <= MAX_CHILD_SITEMAPS:
        raise argparse.ArgumentTypeError(f"{text!r} must be between 0 and {MAX_CHILD_SITEMAPS}")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False
    )
    parser.add_argument("source", metavar="SOURCE", help="a sitemap file (.xml or .xml.gz) or an http(s) URL")
    parser.add_argument("--max-children", type=_child_limit, default=MAX_CHILD_SITEMAPS, metavar="N",
                        help=f"child sitemaps to read from an index, 0 to {MAX_CHILD_SITEMAPS} "
                             f"(default {MAX_CHILD_SITEMAPS})")
    parser.add_argument("--top", type=positive_int, default=DEFAULT_TOP_GROUPS, metavar="N",
                        help=f"URL groups to show (default {DEFAULT_TOP_GROUPS})")
    parser.add_argument("--max-days", type=positive_int, default=DEFAULT_MAX_DAYS, metavar="N",
                        help=f"latest days to show in the per-day view (default {DEFAULT_MAX_DAYS})")
    parser.add_argument("--samples", type=positive_int, default=DEFAULT_SAMPLES, metavar="N",
                        help=f"sample paths per group (default {DEFAULT_SAMPLES})")
    parser.add_argument("--delay", type=non_negative_float, default=DEFAULT_DELAY_SECONDS, metavar="SECONDS",
                        help="least pause between requests to one host when fetching "
                             f"(default {DEFAULT_DELAY_SECONDS:g})")
    parser.add_argument("--allow-private-hosts", action="store_true",
                        help="also follow redirects to local and private addresses, for your own local preview server")
    return parser


def load_source(source: str, fetch: FetchFunction) -> Tuple[bytes, str]:
    """(the sitemap bytes, where they came from: the final URL, or the file path)."""
    if "://" not in source:
        return read_bytes_file(Path(source)), source
    url = require_http_url(source)
    result = fetch(url)
    problem = fetch_problem(result)
    if problem:
        raise SeoToolError(f"cannot read {url}: {problem}")
    return result.body, result.final_url


def main(argv: Optional[Sequence[str]] = None, fetch: Optional[FetchFunction] = None) -> int:
    args = build_parser().parse_args(argv)
    fetcher = fetch or PoliteFetcher(
        default_opener(), delay=args.delay, max_bytes=MAX_SITEMAP_BYTES, allow_private_hosts=args.allow_private_hosts
    ).fetch
    data, origin = load_source(args.source, fetcher)
    sitemap = parse_sitemap(data, args.source)
    report = build_report(sitemap, origin, fetcher, args.max_children, args.samples)
    emit(render_report(report, max_days=args.max_days, top=args.top))
    return 0


if __name__ == "__main__":
    sys.exit(run_cli(main))
