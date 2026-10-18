"""Tests for the ranking log rows: where numaliving.us stands in the SearXNG results, what the Google capture shows,
and how a row becomes (and comes back from) the cells of a CSV line."""

from __future__ import annotations

import unittest
from typing import Any, Dict, List, Sequence

from helpers import fixture_path

import rank_rows  # noqa: E402
import serp_report  # noqa: E402
from browse import serp_label  # noqa: E402
from rank_rows import COLUMNS, OwnSite, RankRow  # noqa: E402
from seo_common import SeoToolError  # noqa: E402

RANK_FIXTURES = fixture_path("rank")
Q_MILLWORK, Q_BRAND, Q_COST = "custom millwork manufacturer", "numa living", "how much does custom millwork cost"
OWN = OwnSite()


def record(query: str, *domains: str) -> Dict[str, Any]:
    results = [{"rank": index, "url": f"https://{domain}/page", "domain": domain, "title": "t"}
               for index, domain in enumerate(domains, start=1)]
    return {"query": query, "results": results}


def capture(*lines: str) -> str:
    return "\n".join(("Skip to main content", "Search Results", *lines, "Page Navigation", "1", "2", "Next")) + "\n"


def week(date: str) -> List[RankRow]:
    """The rows of one fixture snapshot (see tests/fixtures/rank/<date>/), built the way the CLI builds them."""
    records = serp_report.load_records(RANK_FIXTURES / date / "serp")
    captures = {}
    for item in records:
        path = RANK_FIXTURES / date / "google" / f"{serp_label(str(item['query']))}.txt"
        if path.is_file():
            captures[str(item["query"])] = path.read_text(encoding="utf-8")
    return list(rank_rows.build_rows(records, captures, date, OWN))


def row_for(rows: Sequence[RankRow], query: str) -> RankRow:
    return next(row for row in rows if row.query == query)


class OwnRankTests(unittest.TestCase):
    def test_the_rank_is_the_position_of_the_first_result_from_the_domain(self) -> None:
        self.assertEqual(rank_rows.own_rank(record("q", "a.test", "numaliving.us", "b.test", "numaliving.us"), OWN), 2)

    def test_a_site_that_is_not_there_has_no_rank(self) -> None:
        self.assertIsNone(rank_rows.own_rank(record("q", "a.test", "b.test"), OWN))
        self.assertIsNone(rank_rows.own_rank(record("q"), OWN))

    def test_www_subdomains_and_case_do_not_matter(self) -> None:
        for domain in ("www.numaliving.us", "blog.numaliving.us", "NUMALIVING.US", "www.Blog.NumaLiving.us"):
            with self.subTest(domain=domain):
                self.assertEqual(rank_rows.own_rank(record("q", "a.test", domain), OWN), 2)

    def test_other_sites_with_a_similar_name_are_not_the_site(self) -> None:
        for domain in ("numaliving.it", "numaliving.com.ar", "numaliving.co.uk", "numaliving.us.evil.test", "notnumaliving.us",
                       "xnumaliving.us", "numaliving.usa", "numa-living.us", "numaliving.us-shop.test"):
            with self.subTest(domain=domain):
                self.assertIsNone(rank_rows.own_rank(record("q", domain), OWN))

    def test_a_rank_beyond_ten_is_still_a_rank(self) -> None:
        domains = [f"site{number}.test" for number in range(13)] + ["numaliving.us"]
        self.assertEqual(rank_rows.own_rank(record("q", *domains), OWN), 14)

    def test_the_domain_is_read_from_the_url_when_the_field_is_missing(self) -> None:
        item = {"query": "q", "results": [{"url": "https://other.test/"}, {"url": "https://www.numaliving.us/about/"}]}
        self.assertEqual(rank_rows.own_rank(item, OWN), 2)

    def test_a_result_that_is_not_an_object_is_skipped_and_still_counts_as_a_place(self) -> None:
        item = {"query": "q", "results": ["text", None, {"domain": "numaliving.us"}]}
        self.assertEqual(rank_rows.own_rank(item, OWN), 3)

    def test_another_own_domain_can_be_given(self) -> None:
        self.assertEqual(rank_rows.own_rank(record("q", "a.test", "example.org"), OwnSite("example.org", "Example")), 2)


class GoogleColumnsTests(unittest.TestCase):
    def columns(self, text: str) -> Any:
        return rank_rows.google_columns(text, OWN)

    def test_a_capture_with_nothing_in_it_is_not_a_capture(self) -> None:
        self.assertIsNone(self.columns(""))
        self.assertIsNone(self.columns("  \n\t\n"))

    def test_a_plain_page_has_no_features(self) -> None:
        columns = self.columns(capture("Gamma Co", "gamma-co.example", "A description ..."))
        self.assertEqual((columns.own_in_top10, columns.aio, columns.aio_cites_own, columns.local_pack, columns.paa_questions),
                         (False, False, False, False, ()))

    def test_ai_overview_people_also_ask_and_local_pack_are_read(self) -> None:
        text = capture("AI Overview", "Words about millwork.", "A2Z Millwork", "+2", "AI responses may include mistakes. Learn more",
                       "Local Results", "Places", "People also ask", "What is millwork?", "Is millwork wood?", "Web results")
        columns = self.columns(text)
        self.assertEqual((columns.aio, columns.aio_cites_own, columns.local_pack), (True, False, True))
        self.assertEqual(columns.paa_questions, ("What is millwork?", "Is millwork wood?"))

    def test_the_domain_counts_wherever_it_is_written_as_a_host(self) -> None:
        for line in ("numaliving.us", "www.numaliving.us", "NUMALIVING.US", "https://numaliving.us/about/", "numaliving.us › about",
                     "See numaliving.us.", "(numaliving.us)", "Numa Living - numaliving.us/projects", "blog.numaliving.us"):
            with self.subTest(line=line):
                self.assertTrue(self.columns(capture("Result", line)).own_in_top10)

    def test_a_similar_looking_host_is_not_the_domain(self) -> None:
        for line in ("numaliving.it", "numaliving.us.evil.test", "notnumaliving.us", "xnumaliving.us", "numaliving.usa", "numaliving-us",
                     "numa living", "https://numaliving.com.ar/"):
            with self.subTest(line=line):
                self.assertFalse(self.columns(capture("Result", line)).own_in_top10)

    def test_an_overview_source_with_the_brand_or_domain_for_a_name_is_the_site(self) -> None:
        for name in ("Numa Living", "NUMA LIVING", " numa  living ", "numaliving.us", "www.numaliving.us", "numaliving"):
            with self.subTest(name=name):
                text = capture("AI Overview", "Words.", name, "+3", "AI responses may include mistakes. Learn more")
                self.assertTrue(self.columns(text).aio_cites_own)

    def test_a_source_with_only_a_similar_name_is_not_the_site(self) -> None:
        for name in ("Numa Living Room Decor", "Numa Stays", "Numa Living Hotel", "Numa", "numaliving.it", "Living"):
            with self.subTest(name=name):
                text = capture("AI Overview", "Words.", name, "+3", "AI responses may include mistakes. Learn more")
                self.assertFalse(self.columns(text).aio_cites_own)

    def test_a_site_in_the_overview_is_only_cited_when_there_is_an_overview(self) -> None:
        columns = self.columns(capture("Numa Living", "+3", "numaliving.us"))
        self.assertEqual((columns.aio, columns.aio_cites_own, columns.own_in_top10), (False, False, True))


class BuildRowsTests(unittest.TestCase):
    def test_one_row_per_record_in_the_order_given(self) -> None:
        rows = week("2026-10-11")
        self.assertEqual([row.query for row in rows], [Q_MILLWORK, Q_COST, Q_BRAND])
        self.assertEqual({row.date for row in rows}, {"2026-10-11"})

    def test_a_row_that_has_the_site_far_down_and_a_google_capture_without_it(self) -> None:
        row = row_for(week("2026-10-11"), Q_MILLWORK)
        self.assertEqual(row, RankRow(
            date="2026-10-11", query=Q_MILLWORK, own_rank=14, own_in_google_top10=False, google_aio=False,
            google_aio_cites_own=False, paa_count=2, local_pack=False,
            top3_domains=("a2zmillwork.com", "buildersfirstsource.com", "yelp.com"),
            top10_domains=("a2zmillwork.com", "buildersfirstsource.com", "yelp.com", "awinet.org", "carterlumber.com", "ensun.io",
                           "millwork-usa.com", "vintage-millworks.com", "downtobid.com", "houzz.com"),
            paa_questions=("How much does custom millwork cost?", "What is a millwork manufacturer?"),
        ))

    def test_a_row_where_the_site_is_present_in_both_sources(self) -> None:
        row = row_for(week("2026-10-11"), Q_BRAND)
        self.assertEqual((row.own_rank, row.own_in_google_top10, row.google_aio, row.google_aio_cites_own, row.paa_count, row.local_pack),
                         (2, True, True, True, 0, False))
        self.assertEqual(row.top3_domains, ("numaliving.it", "numaliving.us", "numastays.com"))

    def test_a_row_where_the_site_is_absent_and_google_was_not_captured(self) -> None:
        row = row_for(week("2026-10-11"), Q_COST)
        self.assertIsNone(row.own_rank)
        self.assertEqual((row.own_in_google_top10, row.google_aio, row.google_aio_cites_own, row.paa_count, row.local_pack),
                         (None, None, None, None, None))
        self.assertEqual(row.paa_questions, ())
        self.assertEqual(row.top10_domains, ("homeadvisor.com", "angi.com", "houzz.com", "thumbtack.com", "fixr.com"))

    def test_the_next_week_shows_the_changes_in_its_own_rows(self) -> None:
        rows = week("2026-10-18")
        millwork, brand, cost = row_for(rows, Q_MILLWORK), row_for(rows, Q_BRAND), row_for(rows, Q_COST)
        self.assertEqual((millwork.own_rank, millwork.own_in_google_top10, millwork.google_aio, millwork.local_pack, millwork.paa_count),
                         (4, True, True, True, 3))
        self.assertEqual((brand.own_rank, brand.google_aio, brand.google_aio_cites_own), (1, False, False))
        self.assertEqual((cost.own_rank, cost.google_aio, cost.paa_count), (None, True, 4))

    def test_the_domains_are_distinct_normalised_and_cut_at_three_and_ten(self) -> None:
        item = record("q", "www.a.test", "a.test", "b.test", "WWW.C.TEST", "d.test", *[f"s{n}.test" for n in range(12)])
        row = rank_rows.build_rows([item], {}, "2026-10-18", OWN)[0]
        self.assertEqual(row.top3_domains, ("a.test", "b.test", "c.test"))
        self.assertEqual(row.top10_domains, ("a.test", "b.test", "c.test", "d.test", *[f"s{n}.test" for n in range(6)]))

    def test_a_capture_for_another_query_makes_no_row(self) -> None:
        rows = rank_rows.build_rows([record("q", "a.test")], {"other": capture("x")}, "2026-10-18", OWN)
        self.assertEqual([row.query for row in rows], ["q"])
        self.assertIsNone(rows[0].google_aio)

    def test_a_capture_that_is_empty_counts_as_not_captured(self) -> None:
        rows = rank_rows.build_rows([record("q", "a.test")], {"q": "\n\n"}, "2026-10-18", OWN)
        self.assertIsNone(rows[0].own_in_google_top10)

    def test_a_record_without_a_query_text_is_skipped(self) -> None:
        rows = rank_rows.build_rows([{"query": 5, "results": []}, record("q", "a.test")], {}, "2026-10-18", OWN)
        self.assertEqual([row.query for row in rows], ["q"])

    def test_rows_are_immutable(self) -> None:
        row = week("2026-10-11")[0]
        with self.assertRaises(Exception):
            row.query = "changed"  # type: ignore[misc]


class CellTests(unittest.TestCase):
    def test_the_columns_are_the_ones_the_brief_names_plus_the_two_the_diff_needs(self) -> None:
        self.assertEqual(COLUMNS, (
            "date", "query", "own_rank", "own_in_google_top10", "google_aio", "google_aio_cites_own", "paa_count", "local_pack",
            "top3_domains", "top10_domains", "paa_questions",
        ))

    def test_a_row_becomes_cells_that_a_person_can_read(self) -> None:
        cells = rank_rows.row_cells(row_for(week("2026-10-11"), Q_MILLWORK))
        self.assertEqual(cells[:9], [
            "2026-10-11", Q_MILLWORK, "14", "no", "no", "no", "2", "no", "a2zmillwork.com | buildersfirstsource.com | yelp.com",
        ])
        self.assertEqual(cells[10], "How much does custom millwork cost? | What is a millwork manufacturer?")

    def test_what_is_not_known_is_an_empty_cell_not_a_no(self) -> None:
        cells = rank_rows.row_cells(row_for(week("2026-10-11"), Q_COST))
        self.assertEqual(cells[2:8], ["", "", "", "", "", ""])

    def test_every_fixture_row_comes_back_from_its_cells(self) -> None:
        for date in ("2026-10-11", "2026-10-18"):
            for row in week(date):
                with self.subTest(date=date, query=row.query):
                    self.assertEqual(rank_rows.row_from_cells(rank_rows.row_cells(row), 2), row)

    def test_a_bar_inside_an_item_is_written_as_a_slash_so_the_list_stays_readable(self) -> None:
        row = RankRow("2026-10-18", "q", None, None, None, None, None, None, ("a.test",), ("a.test",), ("is a | b?",))
        self.assertEqual(rank_rows.row_cells(row)[10], "is a / b?")

    def test_text_that_a_spreadsheet_would_run_as_a_formula_is_defused_and_restored(self) -> None:
        for text in ("=1+1", "+1 234", "-5", "@SUM(A1)", "\tindent", "\rreturn"):
            with self.subTest(text=text):
                row = RankRow("2026-10-18", text, None, None, None, None, None, None, (), (), (text + "?",))
                cells = rank_rows.row_cells(row)
                self.assertEqual(cells[1], "'" + text)
                self.assertTrue(cells[10].startswith("'"))
                self.assertEqual(rank_rows.row_from_cells(cells, 2), RankRow("2026-10-18", text, None, None, None, None, None, None, (), (), (text + "?",)))

    def test_a_quote_in_front_of_such_text_is_kept_apart_from_the_guard(self) -> None:
        for text in ("'=x", "''+y", "'-1", "'" * 3 + "@z"):
            with self.subTest(text=text):
                row = RankRow("2026-10-18", text, None, None, None, None, None, None, (), (), ())
                cells = rank_rows.row_cells(row)
                self.assertEqual(cells[1], "'" + text)
                self.assertEqual(rank_rows.row_from_cells(cells, 2).query, text)

    def test_a_query_that_starts_with_a_quote_is_left_alone(self) -> None:
        row = RankRow("2026-10-18", "'quoted' millwork", None, None, None, None, None, None, (), (), ())
        self.assertEqual(rank_rows.row_cells(row)[1], "'quoted' millwork")
        self.assertEqual(rank_rows.row_from_cells(rank_rows.row_cells(row), 2), row)

    def test_a_cell_is_never_read_with_a_leading_quote_stripped_unless_it_defused_something(self) -> None:
        cells = rank_rows.row_cells(RankRow("2026-10-18", "q", None, None, None, None, None, None, (), (), ()))
        cells[1] = "'plain"
        self.assertEqual(rank_rows.row_from_cells(cells, 2).query, "'plain")

    def test_cells_that_do_not_make_a_row_are_a_tool_error_naming_the_line(self) -> None:
        good = rank_rows.row_cells(week("2026-10-11")[0])
        bad_cells: Dict[str, List[str]] = {
            "too few": good[:5],
            "too many": good + ["x"],
            "bad date": ["11/10/2026"] + good[1:],
            "impossible date": ["2026-02-30"] + good[1:],
            "bad yes/no": good[:3] + ["maybe"] + good[4:],
            "bad number": good[:2] + ["fourteen"] + good[3:],
            "zero rank": good[:2] + ["0"] + good[3:],
            "negative count": good[:6] + ["-1"] + good[7:],
            "empty query": [good[0], ""] + good[2:],
        }
        for label, cells in bad_cells.items():
            with self.subTest(label=label), self.assertRaises(SeoToolError) as caught:
                rank_rows.row_from_cells(cells, 7)
            self.assertIn("line 7", str(caught.exception))

    def test_a_date_must_be_a_real_day(self) -> None:
        self.assertEqual(rank_rows.valid_date("2026-10-18"), "2026-10-18")
        for text in ("2026-1-8", "18/10/2026", "2026-02-30", "", "2026-10-18T00:00", "today", "2026-10-18 "):
            with self.subTest(text=text), self.assertRaises(SeoToolError):
                rank_rows.valid_date(text)

    def test_rows_hold_tuples_not_lists(self) -> None:
        self.assertIsInstance(week("2026-10-11")[0].top10_domains, tuple)
        self.assertIsInstance(rank_rows.build_rows([], {}, "2026-10-18", OWN), tuple)


if __name__ == "__main__":
    unittest.main()
