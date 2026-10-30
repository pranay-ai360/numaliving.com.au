"""Tests for the ranking log comparison: what changed between the last two snapshots, and how it reads."""

from __future__ import annotations

import dataclasses
import unittest
from typing import Dict, List, Optional, Sequence

from helpers import fixture_path

import rank_diff  # noqa: E402
import rank_rows  # noqa: E402
import serp_report  # noqa: E402
from browse import serp_label  # noqa: E402
from rank_rows import OwnSite, RankRow  # noqa: E402
from test_terminal_safety import unsafe_characters  # noqa: E402

RANK_FIXTURES = fixture_path("rank")
Q_MILLWORK, Q_BRAND, Q_COST = "custom millwork manufacturer", "numa living", "how much does custom millwork cost"


def week(date: str) -> List[RankRow]:
    records = serp_report.load_records(RANK_FIXTURES / date / "serp")
    captures: Dict[str, str] = {}
    for item in records:
        path = RANK_FIXTURES / date / "google" / f"{serp_label(str(item['query']))}.txt"
        if path.is_file():
            captures[str(item["query"])] = path.read_text(encoding="utf-8")
    return list(rank_rows.build_rows(records, captures, date, OwnSite()))


def log_of(*snapshots: Sequence[RankRow]) -> List[RankRow]:
    return [row for snapshot in snapshots for row in snapshot]


def change_for(comparison: rank_diff.Comparison, query: str) -> rank_diff.QueryChange:
    return next(change for change in comparison.changes if change.query == query)


def bare(date: str, query: str, **fields: object) -> RankRow:
    """A row with no Google data and the given fields."""
    base = RankRow(date, query, None, None, None, None, None, None, (), (), ())
    return dataclasses.replace(base, **fields)  # type: ignore[arg-type]


def google(date: str, query: str, **fields: object) -> RankRow:
    """A row with Google data (nothing special on the page) and the given fields."""
    base = RankRow(date, query, None, False, False, False, 0, False, (), (), ())
    return dataclasses.replace(base, **fields)  # type: ignore[arg-type]


class SnapshotTests(unittest.TestCase):
    def test_the_dates_of_a_log_are_listed_oldest_first_without_repeats(self) -> None:
        rows = log_of(week("2026-10-18"), week("2026-10-11"))
        self.assertEqual(rank_diff.snapshot_dates(rows), ("2026-10-11", "2026-10-18"))

    def test_an_empty_log_has_no_dates(self) -> None:
        self.assertEqual(rank_diff.snapshot_dates([]), ())

    def test_one_snapshot_has_nothing_to_compare_with(self) -> None:
        self.assertIsNone(rank_diff.compare(week("2026-10-11")))
        self.assertIsNone(rank_diff.compare([]))

    def test_the_last_two_snapshots_are_compared_whatever_the_order_of_the_rows(self) -> None:
        old = [bare("2026-09-01", Q_BRAND, own_rank=9)]
        comparison = rank_diff.compare(log_of(week("2026-10-18"), old, week("2026-10-11")))
        assert comparison is not None
        self.assertEqual((comparison.previous_date, comparison.latest_date), ("2026-10-11", "2026-10-18"))

    def test_a_third_snapshot_moves_the_comparison_forward(self) -> None:
        later = [dataclasses.replace(row, date="2026-10-25") for row in week("2026-10-18")]
        comparison = rank_diff.compare(log_of(week("2026-10-11"), week("2026-10-18"), later))
        assert comparison is not None
        self.assertEqual((comparison.previous_date, comparison.latest_date), ("2026-10-18", "2026-10-25"))
        self.assertEqual(comparison.changes, ())
        self.assertEqual(comparison.unchanged, 3)


class RankMovementTests(unittest.TestCase):
    def compare_ranks(self, before: Optional[int], after: Optional[int]) -> rank_diff.Comparison:
        rows = [bare("2026-10-11", "q", own_rank=before), bare("2026-10-18", "q", own_rank=after)]
        comparison = rank_diff.compare(rows)
        assert comparison is not None
        return comparison

    def test_a_rank_that_improves_is_a_change_with_the_places_gained(self) -> None:
        comparison = self.compare_ranks(14, 4)
        self.assertEqual((comparison.changes[0].rank_before, comparison.changes[0].rank_after), (14, 4))
        self.assertIn("own rank: 14 -> 4 (up 10)", rank_diff.render_comparison(comparison))

    def test_a_rank_that_falls_is_a_change_with_the_places_lost(self) -> None:
        self.assertIn("own rank: 3 -> 8 (down 5)", rank_diff.render_comparison(self.compare_ranks(3, 8)))

    def test_entering_the_results_and_dropping_out_of_them(self) -> None:
        self.assertIn("own rank: not in the results -> 12 (entered)", rank_diff.render_comparison(self.compare_ranks(None, 12)))
        self.assertIn("own rank: 5 -> not in the results (dropped out)", rank_diff.render_comparison(self.compare_ranks(5, None)))

    def test_the_same_rank_is_no_change(self) -> None:
        comparison = self.compare_ranks(7, 7)
        self.assertEqual((comparison.changes, comparison.unchanged), ((), 1))

    def test_absent_in_both_is_no_change(self) -> None:
        self.assertEqual(self.compare_ranks(None, None).changes, ())


class DomainTests(unittest.TestCase):
    def comparison(self) -> rank_diff.Comparison:
        comparison = rank_diff.compare(log_of(week("2026-10-11"), week("2026-10-18")))
        assert comparison is not None
        return comparison

    def test_domains_that_entered_and_left_the_top_ten(self) -> None:
        change = change_for(self.comparison(), Q_MILLWORK)
        self.assertEqual(change.entered, ("numaliving.us", "woodworkingnetwork.com"))
        self.assertEqual(change.left, ("buildersfirstsource.com", "downtobid.com"))

    def test_the_site_moving_from_14_to_4_is_the_rank_change_of_that_query(self) -> None:
        change = change_for(self.comparison(), Q_MILLWORK)
        self.assertEqual((change.rank_before, change.rank_after), (14, 4))

    def test_a_domain_that_only_changes_place_has_not_entered_or_left(self) -> None:
        change = change_for(self.comparison(), Q_COST)
        self.assertEqual((change.entered, change.left), (("bobvila.com",), ()))

    def test_similar_looking_domains_are_different_domains(self) -> None:
        change = change_for(self.comparison(), Q_BRAND)
        self.assertEqual((change.entered, change.left), (("numaliving.co.uk",), ("numaliving.com.ar",)))

    def test_domains_are_listed_in_the_order_of_the_latest_results(self) -> None:
        rows = [bare("2026-10-11", "q", top10_domains=("a.test",)), bare("2026-10-18", "q", top10_domains=("a.test", "z.test", "b.test", "m.test"))]
        comparison = rank_diff.compare(rows)
        assert comparison is not None
        self.assertEqual(comparison.changes[0].entered, ("z.test", "b.test", "m.test"))


class GoogleTests(unittest.TestCase):
    def comparison(self) -> rank_diff.Comparison:
        comparison = rank_diff.compare(log_of(week("2026-10-11"), week("2026-10-18")))
        assert comparison is not None
        return comparison

    def test_an_ai_overview_that_appeared_and_one_that_disappeared(self) -> None:
        appeared = change_for(self.comparison(), Q_MILLWORK).google
        gone = change_for(self.comparison(), Q_BRAND).google
        assert appeared is not None and gone is not None
        self.assertEqual((appeared.aio, gone.aio), ("appeared", "disappeared"))

    def test_the_overview_that_disappeared_had_cited_the_site(self) -> None:
        gone = change_for(self.comparison(), Q_BRAND).google
        assert gone is not None
        self.assertEqual(gone.aio_cites_own, "lost")

    def test_people_also_ask_questions_added_and_removed(self) -> None:
        google_change = change_for(self.comparison(), Q_MILLWORK).google
        assert google_change is not None
        self.assertEqual(google_change.paa_added, ("What does custom millwork mean?", "Are custom cabinets millwork?"))
        self.assertEqual(google_change.paa_removed, ("How much does custom millwork cost?",))

    def test_the_local_pack_and_the_site_on_the_page(self) -> None:
        google_change = change_for(self.comparison(), Q_MILLWORK).google
        assert google_change is not None
        self.assertEqual((google_change.local_pack, google_change.own_on_page), ("appeared", "appeared"))

    def test_a_query_google_was_not_captured_for_in_one_snapshot_is_not_compared(self) -> None:
        change = change_for(self.comparison(), Q_COST)
        self.assertIsNone(change.google)
        self.assertEqual(change.google_note, "no Google capture on 2026-10-11, so nothing to compare")

    def test_no_capture_in_the_latest_snapshot_either_way_is_noted(self) -> None:
        rows = [google("2026-10-11", "q", google_aio=True), bare("2026-10-18", "q", own_rank=1)]
        comparison = rank_diff.compare(rows)
        assert comparison is not None
        self.assertEqual(comparison.changes[0].google_note, "no Google capture on 2026-10-18, so nothing to compare")

    def test_a_query_with_no_capture_on_either_day_has_no_note(self) -> None:
        rows = [bare("2026-10-11", "q", own_rank=3), bare("2026-10-18", "q", own_rank=2)]
        comparison = rank_diff.compare(rows)
        assert comparison is not None
        self.assertEqual(comparison.changes[0].google_note, "")

    def test_the_site_starting_to_be_cited(self) -> None:
        rows = [google("2026-10-11", "q", google_aio=True), google("2026-10-18", "q", google_aio=True, google_aio_cites_own=True)]
        comparison = rank_diff.compare(rows)
        assert comparison is not None and comparison.changes[0].google is not None
        self.assertEqual((comparison.changes[0].google.aio, comparison.changes[0].google.aio_cites_own), ("", "gained"))

    def test_the_site_leaving_the_page_and_the_local_pack_going(self) -> None:
        rows = [google("2026-10-11", "q", own_in_google_top10=True, local_pack=True), google("2026-10-18", "q")]
        comparison = rank_diff.compare(rows)
        assert comparison is not None and comparison.changes[0].google is not None
        self.assertEqual((comparison.changes[0].google.own_on_page, comparison.changes[0].google.local_pack), ("disappeared", "disappeared"))

    def test_identical_google_data_is_no_change(self) -> None:
        rows = [google("2026-10-11", "q", paa_questions=("a?",), paa_count=1), google("2026-10-18", "q", paa_questions=("a?",), paa_count=1)]
        comparison = rank_diff.compare(rows)
        assert comparison is not None
        self.assertEqual((comparison.changes, comparison.unchanged), ((), 1))


class QueryCoverageTests(unittest.TestCase):
    def test_queries_in_only_one_snapshot_are_listed_not_compared(self) -> None:
        rows = [bare("2026-10-11", "kept", own_rank=1), bare("2026-10-11", "old only", own_rank=2),
                bare("2026-10-18", "kept", own_rank=1), bare("2026-10-18", "new only", own_rank=3)]
        comparison = rank_diff.compare(rows)
        assert comparison is not None
        self.assertEqual((comparison.only_previous, comparison.only_latest, comparison.unchanged), (("old only",), ("new only",), 1))
        text = rank_diff.render_comparison(comparison)
        self.assertIn("only in 2026-10-11: old only", text)
        self.assertIn("only in 2026-10-18: new only", text)

    def test_when_a_day_has_two_rows_for_a_query_the_last_one_counts(self) -> None:
        rows = [bare("2026-10-11", "q", own_rank=9), bare("2026-10-18", "q", own_rank=8), bare("2026-10-18", "q", own_rank=2)]
        comparison = rank_diff.compare(rows)
        assert comparison is not None
        self.assertEqual((comparison.changes[0].rank_before, comparison.changes[0].rank_after), (9, 2))

    def test_the_changes_follow_the_order_of_the_latest_snapshot(self) -> None:
        comparison = rank_diff.compare(log_of(week("2026-10-11"), week("2026-10-18")))
        assert comparison is not None
        self.assertEqual([change.query for change in comparison.changes], [Q_MILLWORK, Q_COST, Q_BRAND])


class RenderTests(unittest.TestCase):
    def text(self) -> str:
        comparison = rank_diff.compare(log_of(week("2026-10-11"), week("2026-10-18")))
        assert comparison is not None
        return rank_diff.render_comparison(comparison)

    def test_the_heading_names_both_dates_and_the_counts(self) -> None:
        lines = self.text().splitlines()
        self.assertEqual(lines[0], "Ranking log: 2026-10-11 -> 2026-10-18")
        self.assertEqual(lines[1], "3 queries in both snapshots: 3 changed, 0 unchanged")

    def test_each_changed_query_gets_a_block_with_only_what_changed(self) -> None:
        lines = self.text().splitlines()
        self.assertIn("custom millwork manufacturer", lines)
        self.assertIn("  own rank: 14 -> 4 (up 10)", lines)
        self.assertIn("  top 10 domains: entered numaliving.us, woodworkingnetwork.com; left buildersfirstsource.com, downtobid.com", lines)
        self.assertIn("  Google: numaliving.us appeared on the page; AI Overview appeared; local pack appeared", lines)
        self.assertIn('  People also ask: added "What does custom millwork mean?", "Are custom cabinets millwork?"; removed "How much does custom millwork cost?"', lines)

    def test_a_block_is_set_apart_by_a_blank_line_and_only_lists_what_changed(self) -> None:
        lines = self.text().splitlines()
        start = lines.index("numa living")
        self.assertEqual(lines[start - 1], "")
        self.assertEqual(lines[start + 1:start + 4], [
            "  own rank: 2 -> 1 (up 1)",
            "  top 10 domains: entered numaliving.co.uk; left numaliving.com.ar",
            "  Google: AI Overview disappeared (it had cited numaliving.us)",
        ])

    def test_the_overview_that_went_away_says_it_had_cited_the_site(self) -> None:
        self.assertIn("  Google: AI Overview disappeared (it had cited numaliving.us)", self.text().splitlines())

    def test_the_site_gaining_or_losing_a_citation_in_a_standing_overview(self) -> None:
        gained = rank_diff.compare([google("2026-10-11", "q", google_aio=True), google("2026-10-18", "q", google_aio=True, google_aio_cites_own=True)])
        lost = rank_diff.compare([google("2026-10-11", "q", google_aio=True, google_aio_cites_own=True), google("2026-10-18", "q", google_aio=True)])
        appeared = rank_diff.compare([google("2026-10-11", "q"), google("2026-10-18", "q", google_aio=True, google_aio_cites_own=True)])
        assert gained is not None and lost is not None and appeared is not None
        self.assertIn("  Google: AI Overview now cites numaliving.us", rank_diff.render_comparison(gained).splitlines())
        self.assertIn("  Google: AI Overview no longer cites numaliving.us", rank_diff.render_comparison(lost).splitlines())
        self.assertIn("  Google: AI Overview appeared (and cites numaliving.us)", rank_diff.render_comparison(appeared).splitlines())

    def test_the_site_leaving_the_page_and_the_local_pack_going_are_worded(self) -> None:
        comparison = rank_diff.compare([google("2026-10-11", "q", own_in_google_top10=True, local_pack=True), google("2026-10-18", "q")])
        assert comparison is not None
        self.assertIn("  Google: numaliving.us disappeared from the page; local pack disappeared", rank_diff.render_comparison(comparison).splitlines())

    def test_a_missing_capture_is_said_once(self) -> None:
        self.assertIn("  Google: no Google capture on 2026-10-11, so nothing to compare", self.text().splitlines())

    def test_nothing_changed_is_said_plainly(self) -> None:
        comparison = rank_diff.compare([bare("2026-10-11", "q", own_rank=1), bare("2026-10-18", "q", own_rank=1)])
        assert comparison is not None
        text = rank_diff.render_comparison(comparison)
        self.assertEqual(text.splitlines()[1:], ["1 query in both snapshots: 0 changed, 1 unchanged", "", "No changes."])

    def test_page_text_cannot_write_to_the_terminal(self) -> None:
        hostile = "\x1b]0;pwned\x07 q‮"
        rows = [bare("2026-10-11", hostile, top10_domains=("a.test",)), bare("2026-10-18", hostile, top10_domains=("a\x1b[2J.test",),
                paa_count=1, paa_questions=("\x1b[31mred?",))]
        comparison = rank_diff.compare(rows)
        assert comparison is not None
        text = rank_diff.render_comparison(comparison)
        self.assertEqual(unsafe_characters(text), [])
        self.assertIn("\\x1b]0;pwned\\x07", text)


if __name__ == "__main__":
    unittest.main()
