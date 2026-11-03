"""The rows of the ranking log: where the site stands in the saved SearXNG results, what the saved Google page shows,
and how a row becomes (and comes back from) the cells of one CSV line.

A row says what was known on one day for one query. What was not captured is left empty (``None``), never
guessed as "no": a Google capture that was blocked or never made is different from a page without an AI Overview.
The functions here are pure; rank_log.py reads and writes the files. Standard library only.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from typing import Any, FrozenSet, List, Mapping, Optional, Sequence, Tuple

from google_features import parse_capture
from seo_common import SeoToolError
from serp_report import normalise_domain, result_domain, top_domains

OWN_DOMAIN = "numaliving.us"
OWN_BRAND = "Numa Living"
COLUMNS = (
    "date", "query", "own_rank", "own_in_google_top10", "google_aio", "google_aio_cites_own", "paa_count", "local_pack",
    "top3_domains", "top10_domains", "paa_questions",
)
SHORT_LIST = 3
LONG_LIST = 10
LIST_SEPARATOR = " | "
YES, NO = "yes", "no"
GUARD = "'"
FORMULA_START = re.compile(r"'*[=+\-@\t\r]")  # what a spreadsheet may run as a formula (behind any guard quotes)
DAY = re.compile(r"\d{4}-\d{2}-\d{2}")
NOT_ALPHANUMERIC = re.compile(r"[^a-z0-9]")


@dataclass(frozen=True)
class OwnSite:
    """The site whose place is logged: its domain and the name Google's AI Overview may use for it."""

    domain: str = OWN_DOMAIN
    brand: str = OWN_BRAND


@dataclass(frozen=True)
class GoogleColumns:
    """What a Google results page shows about the site and the page's features."""

    own_in_top10: bool
    aio: bool
    aio_cites_own: bool
    paa_questions: Tuple[str, ...]
    local_pack: bool


@dataclass(frozen=True)
class RankRow:
    date: str
    query: str
    own_rank: Optional[int]
    own_in_google_top10: Optional[bool]
    google_aio: Optional[bool]
    google_aio_cites_own: Optional[bool]
    paa_count: Optional[int]
    local_pack: Optional[bool]
    top3_domains: Tuple[str, ...]
    top10_domains: Tuple[str, ...]
    paa_questions: Tuple[str, ...]


def parse_day(text: str) -> Optional[date]:
    """The calendar day written as YYYY-MM-DD, or None for anything else (a real day, nothing more)."""
    if not DAY.fullmatch(text):
        return None
    try:
        return date(int(text[:4]), int(text[5:7]), int(text[8:]))
    except ValueError:
        return None


def valid_date(text: str) -> str:
    if parse_day(text) is None:
        raise SeoToolError(f"{text!r} is not a date (use YYYY-MM-DD, for example 2026-10-18)")
    return text


# -- the site's place in the SearXNG results ---------------------------------------------------------------------


def is_own_domain(domain: str, own_domain: str) -> bool:
    name = normalise_domain(domain)
    wanted = own_domain.lower()
    return name == wanted or name.endswith("." + wanted)


def own_rank(record: Mapping[str, Any], own: OwnSite) -> Optional[int]:
    """The place of the first result from the site (1 is the top), or None when it is not among the results."""
    for position, result in enumerate(record.get("results") or [], start=1):
        if is_own_domain(result_domain(result), own.domain):
            return position
    return None


# -- the site on the Google page ---------------------------------------------------------------------------------


@lru_cache(maxsize=None)
def host_pattern(domain: str) -> "re.Pattern[str]":
    """The domain written as a host: alone or after subdomains, never inside another name or before more labels."""
    return re.compile(r"(?<![\w.-])(?:[\w-]+\.)*" + re.escape(domain) + r"(?![\w-])(?!\.\w)", re.IGNORECASE)


def _compact(text: str) -> str:
    return NOT_ALPHANUMERIC.sub("", text.lower())


def _own_names(own: OwnSite) -> FrozenSet[str]:
    return frozenset({_compact(own.domain), _compact(own.brand)})


def _names_the_site(name: str, own: OwnSite) -> bool:
    """Whether an AI Overview source is the site: named as the brand or the domain, or written with the host."""
    return _compact(name) in _own_names(own) or bool(host_pattern(own.domain).search(name))


def google_columns(text: str, own: OwnSite) -> Optional[GoogleColumns]:
    """What the capture shows, or None when it is empty (an empty page is no capture)."""
    if not text.strip():
        return None
    features = parse_capture(text)
    cited = any(_names_the_site(name, own) for name in features.ai_overview_sources)
    return GoogleColumns(
        own_in_top10=bool(host_pattern(own.domain).search(text)),
        aio=features.has_ai_overview,
        aio_cites_own=features.has_ai_overview and cited,
        paa_questions=features.people_also_ask,
        local_pack=features.has_local_pack,
    )


def build_rows(
    records: Sequence[Mapping[str, Any]], captures: Mapping[str, str], day: str, own: OwnSite = OwnSite()
) -> Tuple[RankRow, ...]:
    """One row per SearXNG record, with the Google capture of the same query when there is one."""
    rows: List[RankRow] = []
    for record in records:
        query = record.get("query")
        if not isinstance(query, str) or not query.strip():
            continue
        google = google_columns(captures.get(query, ""), own)
        rows.append(RankRow(
            date=day,
            query=query,
            own_rank=own_rank(record, own),
            own_in_google_top10=google.own_in_top10 if google else None,
            google_aio=google.aio if google else None,
            google_aio_cites_own=google.aio_cites_own if google else None,
            paa_count=len(google.paa_questions) if google else None,
            local_pack=google.local_pack if google else None,
            top3_domains=top_domains(record, SHORT_LIST),
            top10_domains=top_domains(record, LONG_LIST),
            paa_questions=google.paa_questions if google else (),
        ))
    return tuple(rows)


# -- rows as CSV cells -------------------------------------------------------------------------------------------


def _guard(text: str) -> str:
    """Put a quote in front of text a spreadsheet would run as a formula (=, +, -, @, tab, return)."""
    return GUARD + text if FORMULA_START.match(text) else text


def _unguard(cell: str) -> str:
    return cell[1:] if cell.startswith(GUARD) and FORMULA_START.match(cell[1:]) else cell


def _clean(text: str) -> str:
    return text.replace("\x00", "")


def _joined(items: Sequence[str]) -> str:
    return _guard(LIST_SEPARATOR.join(" ".join(_clean(item).replace("|", "/").split()) for item in items))


def _flag(value: Optional[bool]) -> str:
    return "" if value is None else YES if value else NO


def _number(value: Optional[int]) -> str:
    return "" if value is None else str(value)


def row_cells(row: RankRow) -> List[str]:
    return [
        row.date, _guard(_clean(row.query)), _number(row.own_rank), _flag(row.own_in_google_top10),
        _flag(row.google_aio), _flag(row.google_aio_cites_own), _number(row.paa_count), _flag(row.local_pack),
        _joined(row.top3_domains), _joined(row.top10_domains), _joined(row.paa_questions),
    ]


def _problem(line: int, column: str, message: str) -> SeoToolError:
    return SeoToolError(f"line {line}, column {column}: {message}")


def _read_flag(cell: str, line: int, column: str) -> Optional[bool]:
    if cell not in ("", YES, NO):
        raise _problem(line, column, f"{cell!r} is not yes, no or empty")
    return None if cell == "" else cell == YES


def _read_number(cell: str, line: int, column: str, least: int) -> Optional[int]:
    if cell == "":
        return None
    if not (cell.isascii() and cell.isdigit()) or int(cell) < least:
        raise _problem(line, column, f"{cell!r} is not a whole number of {least} or more")
    return int(cell)


def _read_list(cell: str) -> Tuple[str, ...]:
    text = _unguard(cell)
    return tuple(text.split(LIST_SEPARATOR)) if text else ()


def row_from_cells(cells: Sequence[str], line: int) -> RankRow:
    """The row in a CSV line, or a SeoToolError that names the line and the column that is wrong."""
    if len(cells) != len(COLUMNS):
        raise SeoToolError(f"line {line} has {len(cells)} cells, expected {len(COLUMNS)}")
    day, query = cells[0], _unguard(cells[1])
    if parse_day(day) is None:
        raise _problem(line, "date", f"{day!r} is not a date (YYYY-MM-DD)")
    if not query.strip():
        raise _problem(line, "query", "the query is empty")
    return RankRow(
        date=day,
        query=query,
        own_rank=_read_number(cells[2], line, "own_rank", 1),
        own_in_google_top10=_read_flag(cells[3], line, "own_in_google_top10"),
        google_aio=_read_flag(cells[4], line, "google_aio"),
        google_aio_cites_own=_read_flag(cells[5], line, "google_aio_cites_own"),
        paa_count=_read_number(cells[6], line, "paa_count", 0),
        local_pack=_read_flag(cells[7], line, "local_pack"),
        top3_domains=_read_list(cells[8]),
        top10_domains=_read_list(cells[9]),
        paa_questions=_read_list(cells[10]),
    )
