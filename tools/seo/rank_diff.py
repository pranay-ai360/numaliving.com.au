"""What changed between the last two snapshots of the ranking log, and how it reads.

A snapshot is the rows of one date. For each query that both snapshots hold, the comparison looks at the site's
rank, the domains that entered or left the top 10 and, when Google was captured on both days, the AI Overview, the
People-also-ask questions, the local pack and whether the site is on the page. A query whose Google page was not
captured on one of the days is compared on rank and domains only, and says so. Standard library only.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

from rank_rows import OWN_DOMAIN, RankRow
from seo_common import counted, printable

APPEARED, DISAPPEARED = "appeared", "disappeared"
GAINED, LOST = "gained", "lost"


@dataclass(frozen=True)
class GoogleChange:
    """What changed on the Google page of one query. An empty text means no change."""

    own_on_page: str  # appeared / disappeared
    aio: str  # appeared / disappeared
    aio_cites_own: str  # gained / lost
    local_pack: str  # appeared / disappeared
    paa_added: Tuple[str, ...]
    paa_removed: Tuple[str, ...]

    @property
    def has_changes(self) -> bool:
        parts = (self.own_on_page, self.aio, self.aio_cites_own, self.local_pack, self.paa_added, self.paa_removed)
        return any(parts)


@dataclass(frozen=True)
class QueryChange:
    query: str
    rank_before: Optional[int]
    rank_after: Optional[int]
    entered: Tuple[str, ...]
    left: Tuple[str, ...]
    google: Optional[GoogleChange]  # None: not compared
    google_note: str  # why it was not compared, or ""

    @property
    def has_changes(self) -> bool:
        moved = self.rank_before != self.rank_after or bool(self.entered or self.left)
        return moved or (self.google is not None and self.google.has_changes)


@dataclass(frozen=True)
class Comparison:
    previous_date: str
    latest_date: str
    changes: Tuple[QueryChange, ...]
    unchanged: int
    only_previous: Tuple[str, ...]  # queries in the earlier snapshot only
    only_latest: Tuple[str, ...]  # queries in the later snapshot only


def snapshot_dates(rows: Sequence[RankRow]) -> Tuple[str, ...]:
    """Every date in the log, oldest first (an ISO date sorts as a date)."""
    return tuple(sorted({row.date for row in rows}))


def _flip(before: Optional[bool], after: Optional[bool]) -> str:
    if after and not before:
        return APPEARED
    return DISAPPEARED if before and not after else ""


def _cites(before: Optional[bool], after: Optional[bool]) -> str:
    if after and not before:
        return GAINED
    return LOST if before and not after else ""


def _google_change(before: RankRow, after: RankRow) -> Tuple[Optional[GoogleChange], str]:
    if before.google_aio is None and after.google_aio is None:
        return None, ""
    for row in (before, after):
        if row.google_aio is None:
            return None, f"no Google capture on {row.date}, so nothing to compare"
    return GoogleChange(
        own_on_page=_flip(before.own_in_google_top10, after.own_in_google_top10),
        aio=_flip(before.google_aio, after.google_aio),
        aio_cites_own=_cites(before.google_aio_cites_own, after.google_aio_cites_own),
        local_pack=_flip(before.local_pack, after.local_pack),
        paa_added=tuple(question for question in after.paa_questions if question not in before.paa_questions),
        paa_removed=tuple(question for question in before.paa_questions if question not in after.paa_questions),
    ), ""


def _change(before: RankRow, after: RankRow) -> QueryChange:
    google, note = _google_change(before, after)
    return QueryChange(
        query=after.query,
        rank_before=before.own_rank,
        rank_after=after.own_rank,
        entered=tuple(domain for domain in after.top10_domains if domain not in before.top10_domains),
        left=tuple(domain for domain in before.top10_domains if domain not in after.top10_domains),
        google=google,
        google_note=note,
    )


def _snapshot(rows: Sequence[RankRow], day: str) -> Dict[str, RankRow]:
    """The rows of one date by query, in order of first appearance; a later row for a query replaces the earlier."""
    snapshot: Dict[str, RankRow] = {}
    for row in rows:
        if row.date == day:
            snapshot[row.query] = row
    return snapshot


def compare(rows: Sequence[RankRow]) -> Optional[Comparison]:
    """The last two snapshots of the log compared, or None when the log has fewer than two dates."""
    dates = snapshot_dates(rows)
    if len(dates) < 2:
        return None
    previous, latest = _snapshot(rows, dates[-2]), _snapshot(rows, dates[-1])
    both = [_change(previous[query], row) for query, row in latest.items() if query in previous]
    changes = tuple(change for change in both if change.has_changes)
    return Comparison(
        previous_date=dates[-2],
        latest_date=dates[-1],
        changes=changes,
        unchanged=len(both) - len(changes),
        only_previous=tuple(query for query in previous if query not in latest),
        only_latest=tuple(query for query in latest if query not in previous),
    )


# -- reading ------------------------------------------------------------------------------------------------------


def _rank_line(change: QueryChange) -> str:
    before, after = change.rank_before, change.rank_after
    if before is None:
        return f"not in the results -> {after} (entered)"
    if after is None:
        return f"{before} -> not in the results (dropped out)"
    gap = abs(before - after)
    return f"{before} -> {after} (up {gap})" if after < before else f"{before} -> {after} (down {gap})"


def _quoted(questions: Sequence[str]) -> str:
    return ", ".join(f'"{question}"' for question in questions)


def _overview_part(google: GoogleChange, domain: str) -> str:
    cites = google.aio_cites_own
    if google.aio == APPEARED:
        return f"AI Overview appeared (and cites {domain})" if cites == GAINED else "AI Overview appeared"
    if google.aio == DISAPPEARED:
        return f"AI Overview disappeared (it had cited {domain})" if cites == LOST else "AI Overview disappeared"
    if cites:
        return f"AI Overview {'now cites' if cites == GAINED else 'no longer cites'} {domain}"
    return ""


def _page_part(google: GoogleChange, domain: str) -> str:
    if not google.own_on_page:
        return ""
    return f"{domain} {'appeared on' if google.own_on_page == APPEARED else 'disappeared from'} the page"


def _google_parts(google: GoogleChange, domain: str) -> List[str]:
    parts = [_page_part(google, domain), _overview_part(google, domain)]
    parts.append(f"local pack {google.local_pack}" if google.local_pack else "")
    return [part for part in parts if part]


def _listed(pairs: Sequence[Tuple[str, str]]) -> str:
    """"entered a, b; left c": the pairs (label, text) that have text, joined."""
    return "; ".join(f"{label} {text}" for label, text in pairs if text)


def _block(change: QueryChange, domain: str) -> List[str]:
    lines = ["", change.query]
    if change.rank_before != change.rank_after:
        lines.append(f"  own rank: {_rank_line(change)}")
    if change.entered or change.left:
        moved = _listed([("entered", ", ".join(change.entered)), ("left", ", ".join(change.left))])
        lines.append(f"  top 10 domains: {moved}")
    if change.google is not None:
        parts = _google_parts(change.google, domain)
        if parts:
            lines.append(f"  Google: {'; '.join(parts)}")
        asked = _listed([("added", _quoted(change.google.paa_added)), ("removed", _quoted(change.google.paa_removed))])
        if asked:
            lines.append(f"  People also ask: {asked}")
    if change.google_note:
        lines.append(f"  Google: {change.google_note}")
    return lines


def render_comparison(comparison: Comparison, domain: str = OWN_DOMAIN) -> str:
    """The comparison as text: a heading, then a block for each query that changed."""
    compared = len(comparison.changes) + comparison.unchanged
    lines = [
        f"Ranking log: {comparison.previous_date} -> {comparison.latest_date}",
        f"{counted(compared, 'query', 'queries')} in both snapshots: {len(comparison.changes)} changed, "
        f"{comparison.unchanged} unchanged",
    ]
    if not comparison.changes:
        lines += ["", "No changes."]
    for change in comparison.changes:
        lines += _block(change, domain)
    only = ((comparison.previous_date, comparison.only_previous), (comparison.latest_date, comparison.only_latest))
    for day, queries in only:
        if queries:
            lines += ["", f"only in {day}: {', '.join(queries)}"]
    return printable("\n".join(lines))
