#!/usr/bin/env python3
"""Summarise saved SERP files: the top domains per query, and which domains turn up across queries.

Usage:
    serp_report.py SERP_DIR [--top N] [--limit N] [--hide-noise]
    serp_report.py SERP_DIR --urls N

SERP_DIR holds the JSON files serp_search.py wrote (or the saved baseline with the same schema). The report lists,
for each query, the domains in its top N results, then a frequency table: in how many queries each domain was in
the top N, and its average first rank. Noise domains (review sites, social networks, dictionaries) are tagged
[noise], or left out with --hide-noise.

--urls N prints, one per line, the URLs of the top N results of every query (noise domains skipped, tracking
parameters and fragments removed, repeats dropped): the list to give to fetch_pages.py --urls-file.
Standard library only.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple
from urllib.parse import urlunsplit

from seo_common import (
    SeoToolError,
    emit,
    log,
    positive_int,
    read_text_file,
    require_http_url,
    run_cli,
    safe_urlsplit,
)

NOISE_DOMAINS = (
    "yelp.com", "instagram.com", "linkedin.com", "youtube.com", "facebook.com", "wikipedia.org", "reddit.com",
    "quora.com", "pinterest.com", "dictionary.cambridge.org", "merriam-webster.com", "dictionary.com",
    "vocabulary.com",
)
TRACKING_PARAMS = ("srsltid", "gclid", "fbclid")
TRACKING_PREFIXES = ("utm_",)
DEFAULT_TOP = 10
DEFAULT_LIMIT = 45
QUERY_COLUMN_WIDTH = 52
DOMAIN_COLUMN_WIDTH = 38
Record = Mapping[str, Any]


@dataclass(frozen=True)
class DomainStat:
    domain: str
    queries: int
    average_first_rank: float
    is_noise: bool


def load_records(directory: Path) -> Tuple[Record, ...]:
    """Every *.json record in the folder, in file-name order. Files that are not SERP records are skipped aloud."""
    if not directory.is_dir():
        raise SeoToolError(f"{directory} is not a folder of SERP files")
    records: List[Record] = []
    for path in sorted(directory.glob("*.json")):
        try:
            data = json.loads(read_text_file(path))
        except (ValueError, RecursionError, SeoToolError) as error:  # bad syntax, too deep, a huge integer
            log(f"skipping {path.name}: {type(error).__name__}: {str(error)[:120]}")
            continue
        if not isinstance(data, dict) or "query" not in data or not isinstance(data.get("results"), list):
            log(f"skipping {path.name}: not a SERP record (needs a query and a results list)")
            continue
        records.append(_with_object_results(data, path.name))
    if not records:
        raise SeoToolError(f"no SERP records in {directory} (run serp_search.py first)")
    return tuple(records)


def _with_object_results(data: Record, name: str) -> Record:
    """The record with only its object-shaped results; says so when it had to drop any."""
    results = [item for item in data["results"] if isinstance(item, dict)]
    if len(results) != len(data["results"]):
        log(f"{name}: ignored {len(data['results']) - len(results)} result(s) that are not objects")
        return {**data, "results": results}
    return data


def normalise_domain(domain: str) -> str:
    lowered = domain.strip().lower()
    return lowered[4:] if lowered.startswith("www.") else lowered


def is_noise_domain(domain: str) -> bool:
    name = normalise_domain(domain)
    return any(name == noise or name.endswith("." + noise) for noise in NOISE_DOMAINS)


def _result_domain(result: Any) -> str:
    """The result's site, from its domain field or its URL; "" for anything unreadable."""
    if not isinstance(result, Mapping):
        return ""
    explicit = result.get("domain")
    if isinstance(explicit, str) and explicit.strip():
        return normalise_domain(explicit)
    parts = safe_urlsplit(result.get("url"))
    return normalise_domain(parts.netloc) if parts is not None else ""


def top_domains(record: Record, top: int) -> Tuple[str, ...]:
    """The distinct domains among the first ``top`` results, in rank order."""
    found = (_result_domain(result) for result in record["results"][:top])
    return tuple(dict.fromkeys(domain for domain in found if domain))


def domain_frequency(records: Sequence[Record], top: int) -> Tuple[DomainStat, ...]:
    """In how many queries each domain is in the top N, and the average of its first rank in those queries."""
    first_ranks: Dict[str, List[int]] = {}
    for record in records:
        seen: Dict[str, int] = {}
        for rank, result in enumerate(record["results"][:top], start=1):
            domain = _result_domain(result)
            if domain:
                seen.setdefault(domain, rank)
        for domain, rank in seen.items():
            first_ranks.setdefault(domain, []).append(rank)
    stats = [
        DomainStat(domain, len(ranks), sum(ranks) / len(ranks), is_noise_domain(domain))
        for domain, ranks in first_ranks.items()
    ]
    return tuple(sorted(stats, key=lambda stat: (-stat.queries, stat.average_first_rank, stat.domain)))


def _is_tracking(parameter: str) -> bool:
    name = parameter.split("=", 1)[0].lower()
    return name in TRACKING_PARAMS or name.startswith(TRACKING_PREFIXES)


def clean_url(url: str) -> str:
    """The URL without tracking parameters (srsltid, utm_*, gclid, fbclid) and without a fragment."""
    parts = safe_urlsplit(url)
    if parts is None:
        return url
    kept = [piece for piece in parts.query.split("&") if piece and not _is_tracking(piece)]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "&".join(kept), ""))


def _web_url(result: Any) -> str:
    """The result's URL when fetch_pages would accept it (http or https, readable), else ""."""
    url = result.get("url") if isinstance(result, Mapping) else None
    if not isinstance(url, str):
        return ""
    try:
        return require_http_url(url)
    except SeoToolError:
        return ""


def top_result_urls(records: Sequence[Record], count: int, skip_noise: bool = True) -> Tuple[str, ...]:
    urls: List[str] = []
    for record in records:
        for result in record["results"][:count]:
            url = _web_url(result)
            if url and not (skip_noise and is_noise_domain(_result_domain(result))):
                urls.append(clean_url(url))
    return tuple(dict.fromkeys(urls))


def render_report(
    records: Sequence[Record], top: int = DEFAULT_TOP, limit: int = DEFAULT_LIMIT, hide_noise: bool = False
) -> str:
    lines = [f"{len(records)} queries, top {top} results each", "", "=== per query: top domains ==="]
    for record in records:
        lines.append(f"- {str(record['query'])[:QUERY_COLUMN_WIDTH]:<{QUERY_COLUMN_WIDTH}} " + " | ".join(top_domains(record, top)))
    lines += ["", f"=== domain frequency (queries in which it appears in the top {top}) ==="]
    shown = [stat for stat in domain_frequency(records, top) if not (hide_noise and stat.is_noise)]
    for stat in shown[:limit]:
        tag = "   [noise]" if stat.is_noise else ""
        lines.append(
            f"{stat.queries:>3}  {stat.domain:<{DOMAIN_COLUMN_WIDTH}} avg first-rank {stat.average_first_rank:4.1f}{tag}"
        )
    return "\n".join(lines)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False
    )
    parser.add_argument("serp_dir", type=Path, metavar="SERP_DIR", help="folder of saved SERP JSON files")
    parser.add_argument("--top", type=positive_int, default=DEFAULT_TOP, metavar="N",
                        help=f"how many results per query to count (default {DEFAULT_TOP})")
    parser.add_argument("--limit", type=positive_int, default=DEFAULT_LIMIT, metavar="N",
                        help=f"rows in the frequency table (default {DEFAULT_LIMIT})")
    parser.add_argument("--hide-noise", action="store_true", help="leave noise domains out of the frequency table")
    parser.add_argument("--urls", type=positive_int, metavar="N",
                        help="instead of the report, print the URLs of each query's top N results, one per line")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    records = load_records(args.serp_dir)
    if args.urls:
        emit("\n".join(top_result_urls(records, args.urls)))
    else:
        emit(render_report(records, args.top, args.limit, args.hide_noise))
    return 0


if __name__ == "__main__":
    sys.exit(run_cli(main))
