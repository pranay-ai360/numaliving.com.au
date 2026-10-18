"""The stop rules around Google captures, kept free of any browser so they can be tested.

browse.py serp asks Google for results pages, which Google's terms restrict. The rules here keep that small and
make it stop early: a block page ends the run and leaves a marker that refuses new runs for six hours, and two
failed captures in a row end it too. Standard library only.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence, Tuple

from seo_common import EXIT_FAILURE, SeoToolError, data_dir, log, safe_urlsplit, write_text_file

MAX_CONSECUTIVE_ERRORS = 2
BLOCK_COOLDOWN_SECONDS = 6 * 3600
BLOCK_MARKER_NAME = "blocked-at"
GOOGLE_HOST = re.compile(r"(?:^|\.)google\.(?:com|co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$")
Record = Mapping[str, Any]


@dataclass(frozen=True)
class CaptureRun:
    """What happened to a list of queries: every record, and why the run stopped early (if it did)."""

    records: Tuple[Record, ...]
    blocked: bool
    gave_up: bool  # stopped after MAX_CONSECUTIVE_ERRORS failed captures in a row

    @property
    def captured(self) -> int:
        return len([record for record in self.records if not record.get("blocked") and not record.get("error")])


def capture_queries(
    queries: Sequence[str],
    delay: float,
    capture: Callable[[str], Record],
    sleep: Callable[[float], None] = time.sleep,
) -> CaptureRun:
    """Capture each query in order, ``delay`` seconds apart. Stops at the first block page and after two
    failed captures in a row; a failure here and there does not stop the run."""
    records = []
    errors_in_a_row = 0
    blocked = gave_up = False
    for index, query in enumerate(queries):
        log(f"google: {query!r}")
        record = capture(query)
        records.append(record)
        if record.get("blocked"):
            blocked = True
            log("Google showed a block page: stopping here. This tool never tries to get past it; "
                "wait a good while before another run, and keep the runs small.")
            break
        errors_in_a_row = errors_in_a_row + 1 if record.get("error") else 0
        if errors_in_a_row >= MAX_CONSECUTIVE_ERRORS:
            gave_up = True
            log(f"{errors_in_a_row} captures in a row failed: stopping here instead of asking Google again.")
            break
        if index < len(queries) - 1:
            sleep(delay)
    return CaptureRun(tuple(records), blocked, gave_up)


def exit_code(run: CaptureRun) -> int:
    """0 only when every query was captured; 1 after a block, a give-up or any failed capture."""
    return 0 if run.captured == len(run.records) and not run.blocked and not run.gave_up else EXIT_FAILURE


def default_marker() -> Path:
    return data_dir() / "browse" / BLOCK_MARKER_NAME


def record_block(marker: Path) -> None:
    """Note that Google showed a block page now (the file's modification time is what counts)."""
    write_text_file(marker, datetime.now(timezone.utc).isoformat(timespec="seconds") + "\n")


def seconds_until_allowed(marker: Path, now: float) -> float:
    """How long `serp` must wait because of an earlier block page; 0 when it may run."""
    try:
        blocked_at = marker.stat().st_mtime
    except FileNotFoundError:
        return 0.0
    except OSError as error:
        raise SeoToolError(f"cannot check {marker} ({error.strerror or error}); not asking Google until that is fixed") from error
    return max(0.0, blocked_at + BLOCK_COOLDOWN_SECONDS - now)


def refuse_while_blocked(marker: Path, now: float) -> None:
    wait = seconds_until_allowed(marker, now)
    if wait > 0:
        raise SeoToolError(
            f"Google showed a block page recently, so `serp` will not run for another {wait / 3600:.1f} hours "
            f"(it waits {BLOCK_COOLDOWN_SECONDS // 3600} hours after a block). "
            f"If you are sure the block is over, delete {marker}"
        )


def is_google_host(host: str) -> bool:
    """google.com, any subdomain of it, and the country sites such as google.co.uk and google.com.au."""
    return bool(GOOGLE_HOST.search(host.lower().rstrip(".")))


def reject_google_urls(urls: Sequence[str]) -> None:
    """`shots` has no limits and no block check, so it must not be used to fetch Google pages."""
    for url in urls:
        parts = safe_urlsplit(url)
        if parts is not None and parts.hostname and is_google_host(parts.hostname):
            raise SeoToolError(
                f"shots does not capture Google addresses ({url}): use `serp` for results pages; it keeps to "
                "15 queries, 10 seconds apart, and stops at a block page"
            )

