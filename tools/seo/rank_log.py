#!/usr/bin/env python3
"""A ranking log: where numaliving.us stands for the tracked queries, week by week, and what changed.

Usage:
    rank_log.py append --serp-dir DIR [--google-dir DIR] [--log FILE] [--date YYYY-MM-DD]
    rank_log.py diff [--log FILE]

append  turns the folder of SearXNG JSON files that serp_search.py saved (and, if you have them, the folder of
        Google captures that `browse.py serp` saved) into one CSV row per query: the site's rank in the SearXNG
        results (empty when it is not there), whether the site is on the captured Google page, whether an AI
        Overview is there and cites the site, the number of People-also-ask questions, the local pack, and the top
        domains. What was not captured is left empty, not written as "no". The rows go into the log (default
        <data folder>/rank-log.csv, git-ignored) under the date (default today). Running it twice for one date
        and query keeps one row, the newest.
diff    compares the last two dates in the log: domains that entered or left the top 10, an AI Overview that
        appeared or disappeared, People-also-ask questions added or removed, the movement of the site's rank.

A Google capture is used only if the folder's manifest.json lists its query as captured (an old file left in the
folder is not used); without a manifest every capture file is used. Standard library only.
"""

from __future__ import annotations

import argparse
import contextlib
import csv
import io
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any, Callable, Dict, FrozenSet, List, Mapping, Optional, Sequence, Tuple

from browse import serp_label
from rank_diff import compare, render_comparison, snapshot_dates
from rank_rows import COLUMNS, RankRow, build_rows, parse_day, row_cells, row_from_cells, valid_date
from seo_common import SeoToolError, counted, data_dir, emit, log, read_json_file, read_text_file, run_cli
from serp_report import load_records

LOG_NAME = "rank-log.csv"
FETCH_TOLERANCE_DAYS = 3
QUERY_WIDTH = 44
MANIFEST = "manifest.json"
BOM = "﻿"


def default_log_path() -> Path:
    return data_dir() / LOG_NAME


# -- the log file --------------------------------------------------------------------------------------------------


def read_log(path: Path) -> Tuple[RankRow, ...]:
    """The rows of a log. A foreign header or a line that is not a row is a SeoToolError: nothing is guessed."""
    text = read_text_file(path)
    reader = csv.reader(io.StringIO(text[1:] if text.startswith(BOM) else text, newline=""))
    rows: List[RankRow] = []
    header_seen = False
    try:
        for cells in reader:
            if not cells:
                continue
            if not header_seen:
                header_seen = True
                if cells != list(COLUMNS):
                    raise SeoToolError(f"{path} has an unexpected header; it should be: {','.join(COLUMNS)}")
                continue
            try:
                rows.append(row_from_cells(cells, reader.line_num))
            except SeoToolError as error:
                raise SeoToolError(f"{path}: {error}") from error
    except csv.Error as error:
        raise SeoToolError(f"{path}: line {reader.line_num}: {error}") from error
    return tuple(rows)


def write_log(path: Path, rows: Sequence[RankRow]) -> None:
    """Write the whole log through a temporary file, so a failure leaves the old log as it was."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(COLUMNS)
    writer.writerows(row_cells(row) for row in rows)
    temporary = path.with_name(path.name + ".tmp")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with temporary.open("w", encoding="utf-8", newline="") as handle:
            handle.write(buffer.getvalue())
        os.replace(temporary, path)
    except OSError as error:
        with contextlib.suppress(OSError):
            temporary.unlink()
        raise SeoToolError(f"cannot write {path}: {error.strerror or error}") from error


def merge_rows(existing: Sequence[RankRow], new: Sequence[RankRow]) -> Tuple[Tuple[RankRow, ...], int]:
    """The log with the new rows in it: a row for a date and query already there takes its place, the rest go last."""
    fresh: Dict[Tuple[str, str], RankRow] = {(row.date, row.query): row for row in new}
    merged: List[RankRow] = []
    placed: set = set()
    for row in existing:
        key = (row.date, row.query)
        if key in fresh:
            if key not in placed:
                merged.append(fresh[key])
                placed.add(key)
        else:
            merged.append(row)
    merged.extend(row for key, row in fresh.items() if key not in placed)
    return tuple(merged), len(placed)


# -- the Google captures -------------------------------------------------------------------------------------------


def _is_entry(item: object) -> bool:
    return isinstance(item, dict) and isinstance(item.get("query"), str)


def _manifest_queries(google_dir: Path) -> Tuple[Optional[FrozenSet[str]], str]:
    """(the queries listed as captured, "") or (None, "") without a manifest, or (no queries, why) if unusable."""
    path = google_dir / MANIFEST
    if not path.is_file():
        return None, ""
    try:
        data = read_json_file(path)
    except SeoToolError as error:
        return frozenset(), f"{MANIFEST} in {google_dir} cannot be read ({error}); no Google capture was used"
    entries = data.get("queries") if isinstance(data, dict) else None
    if not isinstance(entries, list) or not all(_is_entry(item) for item in entries):
        return frozenset(), f"{MANIFEST} in {google_dir} is not a list of captured queries; no Google capture was used"
    return frozenset(item["query"] for item in entries if not item.get("blocked") and not item.get("error")), ""


def load_captures(google_dir: Optional[Path], queries: Sequence[str]) -> Tuple[Dict[str, str], Tuple[str, ...]]:
    """The saved Google page text of each query that has one, and notes about files that were left out or left over."""
    if google_dir is None:
        return {}, ()
    if not google_dir.is_dir():
        raise SeoToolError(f"{google_dir} is not a folder of Google captures")
    usable, problem = _manifest_queries(google_dir)
    notes = [problem] if problem else []
    captures: Dict[str, str] = {}
    for query in dict.fromkeys(queries):
        path = google_dir / f"{serp_label(query)}.txt"
        if not path.is_file():
            continue
        if usable is not None and query not in usable:
            if not problem:
                notes.append(f"ignored the Google capture for {query!r}: {MANIFEST} does not list it as captured")
            continue
        captures[query] = read_text_file(path)
    labels = {serp_label(query) for query in queries}
    stray = sorted(path.name for path in google_dir.glob("*.txt") if path.stem not in labels)
    if stray:
        notes.append("Google captures with no matching SearXNG record: " + ", ".join(stray))
    return captures, tuple(notes)


def _stale_notes(records: Sequence[Mapping[str, Any]], day: str) -> List[str]:
    wanted = parse_day(day)
    notes: List[str] = []
    for record in records:
        stamp = record.get("fetched_at")
        fetched = parse_day(stamp[:10]) if isinstance(stamp, str) else None
        if wanted is not None and fetched is not None and abs((fetched - wanted).days) > FETCH_TOLERANCE_DAYS:
            notes.append(
                f"the record for {record.get('query')!r} was fetched on {fetched.isoformat()}, more than "
                f"{FETCH_TOLERANCE_DAYS} days from {day}: is it from an older run?"
            )
    return notes


# -- commands ------------------------------------------------------------------------------------------------------


def _mark(value: object, unknown: str = "?") -> str:
    return unknown if value is None else "yes" if value is True else "no" if value is False else str(value)


def render_table(day: str, path: Path, rows: Sequence[RankRow], replaced: int) -> str:
    shown = [" ".join(row.query.split()) for row in rows]
    width = min(max((len(text) for text in shown), default=5), QUERY_WIDTH)
    lines = [
        f"Ranking log, snapshot {day}: {counted(len(rows), 'row')} written to {path} "
        f"({len(rows) - replaced} new, {replaced} replaced)",
        f"{'query':<{width}}  rank  on Google  AIO  cites  PAA  local",
    ]
    for text, row in zip(shown, rows):
        query = text if len(text) <= width else text[: width - 3] + "..."
        lines.append(
            f"{query:<{width}}  {_mark(row.own_rank, '-'):<4}  {_mark(row.own_in_google_top10):<9}  "
            f"{_mark(row.google_aio):<3}  {_mark(row.google_aio_cites_own):<5}  {_mark(row.paa_count):<3}  "
            f"{_mark(row.local_pack)}"
        )
    return "\n".join(lines)


def append_command(args: argparse.Namespace, today: Callable[[], date]) -> int:
    day = valid_date(args.date) if args.date else today().isoformat()
    path = args.log or default_log_path()
    records = load_records(args.serp_dir)
    queries = [str(record["query"]) for record in records if isinstance(record.get("query"), str)]
    captures, notes = load_captures(args.google_dir, queries)
    for note in [*notes, *_stale_notes(records, day)]:
        log(note)
    rows = build_rows(records, captures, day)
    merged, replaced = merge_rows(read_log(path) if path.is_file() else (), rows)
    write_log(path, merged)
    emit(render_table(day, path, rows, replaced))
    return 0


def diff_command(args: argparse.Namespace) -> int:
    path = args.log or default_log_path()
    if not path.is_file():
        raise SeoToolError(f"no ranking log at {path}; run `rank_log.py append` first")
    rows = read_log(path)
    comparison = compare(rows)
    if comparison is not None:
        emit(render_comparison(comparison))
        return 0
    dates = snapshot_dates(rows)
    if dates:
        emit(f"The log has one snapshot ({dates[0]}); a comparison needs two.\n"
             "Run `rank_log.py append` again on another day, then `rank_log.py diff`.")
    else:
        emit("The log has no snapshot yet. Run `rank_log.py append` first.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False
    )
    commands = parser.add_subparsers(dest="command", required=True, metavar="{append,diff}")
    append = commands.add_parser("append", allow_abbrev=False, help="add today's snapshot to the log")
    append.add_argument("--serp-dir", type=Path, required=True, metavar="DIR", help="folder of SearXNG JSON files")
    append.add_argument("--google-dir", type=Path, metavar="DIR", help="folder of Google captures (browse.py serp)")
    append.add_argument("--log", type=Path, metavar="FILE", help=f"the log (default: <data folder>/{LOG_NAME})")
    append.add_argument("--date", metavar="YYYY-MM-DD", help="the snapshot's date (default: today)")
    diff = commands.add_parser("diff", allow_abbrev=False, help="compare the last two snapshots")
    diff.add_argument("--log", type=Path, metavar="FILE", help=f"the log (default: <data folder>/{LOG_NAME})")
    return parser


def main(argv: Optional[Sequence[str]] = None, today: Optional[Callable[[], date]] = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "append":
        return append_command(args, today or date.today)
    return diff_command(args)


if __name__ == "__main__":
    sys.exit(run_cli(main))
