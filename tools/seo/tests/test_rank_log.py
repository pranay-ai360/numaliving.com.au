"""Tests for the ranking log command: building a snapshot from saved SearXNG and Google files, the CSV log (one
header, one row per date and query, safe to run twice), and the comparison of the last two snapshots."""

from __future__ import annotations

import csv
import json
import os
import shutil
import tempfile
import unittest
from datetime import date
from pathlib import Path
from typing import List, Optional, Tuple
from unittest import mock

from helpers import captured, fixture_path
from test_terminal_safety import unsafe_characters

import rank_log  # noqa: E402
import rank_rows  # noqa: E402
from browse import MAX_SERP_QUERIES, serp_label  # noqa: E402
from rank_rows import COLUMNS, RankRow  # noqa: E402
from seo_common import SeoToolError, read_query_file, run_cli  # noqa: E402

RANK_FIXTURES = fixture_path("rank")
WEEK1, WEEK2 = "2026-10-11", "2026-10-18"
Q_MILLWORK, Q_BRAND, Q_COST = "custom millwork manufacturer", "numa living", "how much does custom millwork cost"
HEADER = ",".join(COLUMNS)


class LogTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.folder = Path(self._tmp.name)
        self.log = self.folder / "rank-log.csv"

    def run_command(self, *argv: str, today: date = date(2026, 10, 18)) -> Tuple[int, str, str]:
        with captured() as (out, err):
            code = run_cli(lambda args: rank_log.main(args, today=lambda: today), list(argv))
        return code, out.getvalue(), err.getvalue()

    def append(self, week: str, *extra: str) -> Tuple[int, str, str]:
        return self.run_command(
            "append", "--serp-dir", str(RANK_FIXTURES / week / "serp"), "--google-dir", str(RANK_FIXTURES / week / "google"),
            "--log", str(self.log), "--date", week, *extra,
        )

    def copy_week(self, week: str, name: str) -> Path:
        target = self.folder / name
        shutil.copytree(RANK_FIXTURES / week, target)
        return target

    def log_lines(self) -> List[str]:
        return self.log.read_text(encoding="utf-8").splitlines()


class AppendTests(LogTestCase):
    def test_the_first_run_writes_the_header_once_and_one_row_per_query(self) -> None:
        code, out, err = self.append(WEEK1)
        self.assertEqual(code, 0, err)
        lines = self.log_lines()
        self.assertEqual(lines[0], HEADER)
        self.assertEqual(len(lines), 4)
        self.assertEqual([row.query for row in rank_log.read_log(self.log)], [Q_MILLWORK, Q_COST, Q_BRAND])

    def test_the_log_is_plain_utf8_csv_with_unix_line_ends_and_a_final_newline(self) -> None:
        self.append(WEEK1)
        raw = self.log.read_bytes()
        self.assertFalse(raw.startswith(b"\xef\xbb\xbf"))
        self.assertNotIn(b"\r", raw)
        self.assertTrue(raw.endswith(b"\n"))

    def test_running_it_again_for_the_same_date_changes_nothing(self) -> None:
        self.append(WEEK1)
        first = self.log.read_bytes()
        code, out, err = self.append(WEEK1)
        self.assertEqual(code, 0, err)
        self.assertEqual(self.log.read_bytes(), first)
        self.assertEqual(len(self.log_lines()), 4)

    def test_a_second_run_for_the_same_date_replaces_the_rows_it_has_new_data_for(self) -> None:
        self.append(WEEK1)
        serp = self.copy_week(WEEK1, "again") / "serp"
        record_path = serp / "numa-living-2ad871.json"
        data = json.loads(record_path.read_text(encoding="utf-8"))
        data["results"] = data["results"][2:]  # the site is no longer in the results
        record_path.write_text(json.dumps(data), encoding="utf-8")
        code, out, err = self.run_command("append", "--serp-dir", str(serp), "--log", str(self.log), "--date", WEEK1)
        self.assertEqual(code, 0, err)
        rows = {row.query: row for row in rank_log.read_log(self.log)}
        self.assertEqual(len(rows), 3)
        self.assertIsNone(rows[Q_BRAND].own_rank)
        self.assertIsNone(rows[Q_BRAND].google_aio)  # this run had no Google folder: replaced rows have no Google data
        self.assertEqual(rows[Q_MILLWORK].own_rank, 14)

    def test_a_new_date_adds_rows_and_leaves_the_old_ones_as_they_were(self) -> None:
        self.append(WEEK1)
        before = self.log.read_text(encoding="utf-8")
        code, out, err = self.append(WEEK2)
        self.assertEqual(code, 0, err)
        self.assertTrue(self.log.read_text(encoding="utf-8").startswith(before))
        rows = rank_log.read_log(self.log)
        self.assertEqual(len(rows), 6)
        self.assertEqual([row.date for row in rows], [WEEK1] * 3 + [WEEK2] * 3)

    def test_a_run_for_an_earlier_date_goes_after_the_rows_already_there(self) -> None:
        self.append(WEEK2)
        self.append(WEEK1)
        self.assertEqual([row.date for row in rank_log.read_log(self.log)], [WEEK2] * 3 + [WEEK1] * 3)

    def test_the_rows_in_the_log_are_the_rows_that_were_built(self) -> None:
        self.append(WEEK1)
        self.append(WEEK2)
        row = next(item for item in rank_log.read_log(self.log) if item.date == WEEK2 and item.query == Q_MILLWORK)
        self.assertEqual((row.own_rank, row.own_in_google_top10, row.google_aio, row.paa_count, row.local_pack), (4, True, True, 3, True))

    def test_without_a_google_folder_the_google_columns_stay_empty(self) -> None:
        code, out, err = self.run_command("append", "--serp-dir", str(RANK_FIXTURES / WEEK2 / "serp"), "--log", str(self.log), "--date", WEEK2)
        self.assertEqual(code, 0, err)
        rows = rank_log.read_log(self.log)
        self.assertEqual({(row.google_aio, row.paa_count, row.local_pack) for row in rows}, {(None, None, None)})
        self.assertEqual(rows[0].own_rank, 4)

    def test_the_date_defaults_to_today(self) -> None:
        code, out, err = self.run_command("append", "--serp-dir", str(RANK_FIXTURES / WEEK2 / "serp"), "--log", str(self.log), today=date(2026, 11, 2))
        self.assertEqual(code, 0, err)
        self.assertEqual({row.date for row in rank_log.read_log(self.log)}, {"2026-11-02"})

    def test_a_date_that_is_not_a_real_day_is_refused_before_anything_is_written(self) -> None:
        for text in ("18/10/2026", "2026-02-30", "yesterday", "2026-10-18T00:00"):
            with self.subTest(text=text):
                code, out, err = self.run_command("append", "--serp-dir", str(RANK_FIXTURES / WEEK2 / "serp"), "--log", str(self.log), "--date", text)
                self.assertEqual(code, 2)
                self.assertIn("not a date", err)
                self.assertFalse(self.log.exists())

    def test_the_default_log_is_in_the_data_folder(self) -> None:
        with mock.patch.dict(os.environ, {"SEO_DATA_DIR": str(self.folder / "data")}):
            code, out, err = self.run_command("append", "--serp-dir", str(RANK_FIXTURES / WEEK2 / "serp"))
        self.assertEqual(code, 0, err)
        self.assertTrue((self.folder / "data" / "rank-log.csv").is_file())

    def test_the_log_folder_is_made_when_it_is_missing(self) -> None:
        target = self.folder / "deep" / "er" / "log.csv"
        code, out, err = self.run_command("append", "--serp-dir", str(RANK_FIXTURES / WEEK2 / "serp"), "--log", str(target))
        self.assertEqual(code, 0, err)
        self.assertTrue(target.is_file())

    def test_an_empty_file_counts_as_no_log_and_gets_its_header(self) -> None:
        self.log.write_text("", encoding="utf-8")
        self.append(WEEK1)
        self.assertEqual(self.log_lines()[0], HEADER)

    def test_the_table_lists_every_query_with_its_numbers(self) -> None:
        code, out, err = self.append(WEEK2)
        lines = out.splitlines()
        self.assertTrue(lines[0].startswith(f"Ranking log, snapshot {WEEK2}: 3 rows written to "), lines[0])
        self.assertIn("3 new, 0 replaced", lines[0])
        table = "\n".join(lines[1:])
        self.assertRegex(table, r"custom millwork manufacturer\s+4\s+yes\s+yes\s+no\s+3\s+yes")
        self.assertRegex(table, r"how much does custom millwork cost\s+-\s+no\s+yes\s+no\s+4\s+no")
        self.assertRegex(table, r"numa living\s+1\s+yes\s+no\s+no\s+0\s+no")

    def test_what_was_not_captured_shows_as_a_question_mark(self) -> None:
        code, out, err = self.append(WEEK1)
        self.assertRegex(out, r"how much does custom millwork cost\s+-\s+\?\s+\?\s+\?\s+\?\s+\?")

    def test_a_second_run_says_how_many_rows_it_replaced(self) -> None:
        self.append(WEEK1)
        code, out, err = self.append(WEEK1)
        self.assertIn("0 new, 3 replaced", out.splitlines()[0])


class SafetyTests(LogTestCase):
    def test_queries_with_commas_quotes_newlines_and_accents_survive_the_file(self) -> None:
        serp = self.folder / "serp"
        serp.mkdir()
        queries = ['millwork, "custom" cabinets', "line one\nline two", "café 木工", "a;b|c"]
        for number, query in enumerate(queries):
            record = {"query": query, "results": [{"domain": "a.test", "url": "https://a.test/"}]}
            (serp / f"q{number}.json").write_text(json.dumps(record), encoding="utf-8")
        code, out, err = self.run_command("append", "--serp-dir", str(serp), "--log", str(self.log), "--date", WEEK2)
        self.assertEqual(code, 0, err)
        self.assertEqual([row.query for row in rank_log.read_log(self.log)], queries)
        self.assertIn("line one line two", out)  # the table keeps a query on one line
        with self.log.open(newline="", encoding="utf-8") as handle:
            self.assertEqual(len(list(csv.reader(handle))), len(queries) + 1)

    def test_a_query_a_spreadsheet_would_run_is_defused_in_the_file_and_restored_on_reading(self) -> None:
        serp = self.folder / "serp"
        serp.mkdir()
        (serp / "q.json").write_text(json.dumps({"query": "=HYPERLINK(\"http://evil.test\")", "results": []}), encoding="utf-8")
        self.run_command("append", "--serp-dir", str(serp), "--log", str(self.log), "--date", WEEK2)
        self.assertIn("'=HYPERLINK", self.log.read_text(encoding="utf-8"))
        self.assertNotIn(',=HYPERLINK', self.log.read_text(encoding="utf-8"))
        self.assertNotIn('"=HYPERLINK', self.log.read_text(encoding="utf-8"))
        self.assertEqual(rank_log.read_log(self.log)[0].query, "=HYPERLINK(\"http://evil.test\")")

    def test_text_from_the_files_cannot_write_to_the_terminal(self) -> None:
        serp = self.folder / "serp"
        serp.mkdir()
        hostile = "q\x1b]0;pwned\x07 ‮"
        (serp / "q.json").write_text(json.dumps({"query": hostile, "results": [{"domain": "a\x1b[2J.test"}]}), encoding="utf-8")
        code, out, err = self.run_command("append", "--serp-dir", str(serp), "--log", str(self.log), "--date", WEEK2)
        self.assertEqual(code, 0, err)
        self.assertEqual(unsafe_characters(out + err), [])
        self.assertIn("\\x1b]0;pwned\\x07", out)

    def test_a_failure_while_saving_leaves_the_old_log_and_no_stray_file(self) -> None:
        self.append(WEEK1)
        before = self.log.read_bytes()
        with mock.patch.object(rank_log.os, "replace", side_effect=OSError(28, "No space left on device")):
            code, out, err = self.append(WEEK2)
        self.assertEqual(code, 2)
        self.assertIn("cannot write", err)
        self.assertEqual(self.log.read_bytes(), before)
        self.assertEqual(sorted(path.name for path in self.folder.iterdir()), ["rank-log.csv"])

    def test_a_log_with_another_header_is_refused_and_left_alone(self) -> None:
        self.log.write_text("date,query\n2026-10-11,x\n", encoding="utf-8")
        code, out, err = self.append(WEEK1)
        self.assertEqual(code, 2)
        self.assertIn("header", err)
        self.assertEqual(self.log.read_text(encoding="utf-8"), "date,query\n2026-10-11,x\n")

    def test_a_log_with_a_row_that_cannot_be_read_is_refused_and_left_alone(self) -> None:
        self.append(WEEK1)
        broken = self.log.read_text(encoding="utf-8") + "2026-10-11,only three,cells\n"
        self.log.write_text(broken, encoding="utf-8")
        code, out, err = self.append(WEEK2)
        self.assertEqual(code, 2)
        self.assertIn("line 5", err)
        self.assertEqual(self.log.read_text(encoding="utf-8"), broken)

    def test_a_log_saved_by_a_spreadsheet_with_a_byte_order_mark_and_windows_line_ends_is_read(self) -> None:
        self.append(WEEK1)
        text = self.log.read_text(encoding="utf-8")
        self.log.write_bytes(b"\xef\xbb\xbf" + text.replace("\n", "\r\n").encode("utf-8"))
        self.assertEqual(len(rank_log.read_log(self.log)), 3)
        code, out, err = self.append(WEEK2)
        self.assertEqual(code, 0, err)
        self.assertEqual(len(rank_log.read_log(self.log)), 6)

    def test_a_cell_too_big_for_the_csv_reader_is_a_tool_error_not_a_crash(self) -> None:
        self.log.write_text(HEADER + "\n2026-10-11," + "q" * 200_000 + ",,,,,,,,,\n", encoding="utf-8")
        with self.assertRaises(SeoToolError) as caught:
            rank_log.read_log(self.log)
        self.assertIn("line 2", str(caught.exception))

    def test_a_blank_line_in_the_log_is_ignored(self) -> None:
        self.append(WEEK1)
        self.log.write_text(self.log.read_text(encoding="utf-8") + "\n\n", encoding="utf-8")
        self.assertEqual(len(rank_log.read_log(self.log)), 3)


class InputFileTests(LogTestCase):
    def run_week2(self, serp: Path, google: Optional[Path]) -> Tuple[int, str, str]:
        argv = ["append", "--serp-dir", str(serp), "--log", str(self.log), "--date", WEEK2]
        if google is not None:
            argv += ["--google-dir", str(google)]
        return self.run_command(*argv)

    def test_a_missing_or_empty_serp_folder_is_a_usage_error(self) -> None:
        code, out, err = self.run_week2(self.folder / "nowhere", None)
        self.assertEqual(code, 2)
        empty = self.folder / "empty"
        empty.mkdir()
        self.assertEqual(self.run_week2(empty, None)[0], 2)
        self.assertFalse(self.log.exists())

    def test_a_missing_google_folder_is_a_usage_error(self) -> None:
        code, out, err = self.run_week2(RANK_FIXTURES / WEEK2 / "serp", self.folder / "nowhere")
        self.assertEqual(code, 2)
        self.assertIn("Google", err)

    def test_files_in_the_serp_folder_that_are_not_records_are_skipped_aloud(self) -> None:
        week = self.copy_week(WEEK2, "week")
        (week / "serp" / "broken.json").write_text("{not json", encoding="utf-8")
        (week / "serp" / "deep.json").write_text("[" * 100_000, encoding="utf-8")
        code, out, err = self.run_week2(week / "serp", week / "google")
        self.assertEqual(code, 0, err)
        self.assertIn("broken.json", err)
        self.assertEqual(len(rank_log.read_log(self.log)), 3)

    def test_a_google_capture_the_manifest_calls_blocked_is_not_used_even_if_a_file_is_there(self) -> None:
        week = self.copy_week(WEEK2, "week")
        manifest = json.loads((week / "google" / "manifest.json").read_text(encoding="utf-8"))
        for entry in manifest["queries"]:
            if entry["query"] == Q_BRAND:
                entry["blocked"] = True
        (week / "google" / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        code, out, err = self.run_week2(week / "serp", week / "google")
        self.assertEqual(code, 0, err)
        rows = {row.query: row for row in rank_log.read_log(self.log)}
        self.assertIsNone(rows[Q_BRAND].google_aio)
        self.assertEqual(rows[Q_MILLWORK].google_aio, True)
        self.assertIn(Q_BRAND, err)

    def test_a_capture_the_manifest_does_not_list_is_an_old_file_and_is_not_used(self) -> None:
        week = self.copy_week(WEEK2, "week")
        manifest = json.loads((week / "google" / "manifest.json").read_text(encoding="utf-8"))
        manifest["queries"] = [entry for entry in manifest["queries"] if entry["query"] != Q_COST]
        (week / "google" / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        self.run_week2(week / "serp", week / "google")
        rows = {row.query: row for row in rank_log.read_log(self.log)}
        self.assertIsNone(rows[Q_COST].google_aio)

    def test_a_capture_the_manifest_says_failed_is_not_used(self) -> None:
        week = self.copy_week(WEEK2, "week")
        manifest = json.loads((week / "google" / "manifest.json").read_text(encoding="utf-8"))
        for entry in manifest["queries"]:
            if entry["query"] == Q_COST:
                entry["error"] = "TimeoutError: page took too long"
        (week / "google" / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        self.run_week2(week / "serp", week / "google")
        self.assertIsNone({row.query: row for row in rank_log.read_log(self.log)}[Q_COST].google_aio)

    def test_a_manifest_that_cannot_be_read_means_no_Google_data_rather_than_old_data(self) -> None:
        week = self.copy_week(WEEK2, "week")
        for text in ("{not json", "[]", '{"queries": 5}', '{"queries": [5, null, {"query": 7}]}'):
            with self.subTest(text=text):
                (week / "google" / "manifest.json").write_text(text, encoding="utf-8")
                self.log.unlink(missing_ok=True)
                code, out, err = self.run_week2(week / "serp", week / "google")
                self.assertEqual(code, 0, err)
                self.assertEqual({row.google_aio for row in rank_log.read_log(self.log)}, {None})
                self.assertIn("manifest.json", err)

    def test_without_a_manifest_every_capture_file_is_used(self) -> None:
        week = self.copy_week(WEEK2, "week")
        (week / "google" / "manifest.json").unlink()
        code, out, err = self.run_week2(week / "serp", week / "google")
        self.assertEqual(code, 0, err)
        self.assertEqual({row.google_aio for row in rank_log.read_log(self.log)}, {True, False})

    def test_a_capture_with_no_matching_record_is_reported_and_not_logged(self) -> None:
        week = self.copy_week(WEEK2, "week")
        (week / "google" / "someone-elses-query-abc123.txt").write_text("Search Results\nAI Overview\n", encoding="utf-8")
        code, out, err = self.run_week2(week / "serp", week / "google")
        self.assertEqual(code, 0, err)
        self.assertIn("someone-elses-query-abc123.txt", err)
        self.assertEqual(len(rank_log.read_log(self.log)), 3)

    def test_a_record_fetched_long_before_the_snapshot_date_is_called_old(self) -> None:
        week = self.copy_week(WEEK1, "week")  # records from 11 October
        code, out, err = self.run_command("append", "--serp-dir", str(week / "serp"), "--log", str(self.log), "--date", WEEK2)
        self.assertEqual(code, 0, err)
        self.assertIn("was fetched on 2026-10-11", err)
        self.assertEqual(len(rank_log.read_log(self.log)), 3)

    def test_records_fetched_within_a_few_days_of_the_date_raise_no_warning(self) -> None:
        code, out, err = self.run_command("append", "--serp-dir", str(RANK_FIXTURES / WEEK2 / "serp"), "--log", str(self.log), "--date", "2026-10-20")
        self.assertNotIn("was fetched on", err)

    def test_a_record_without_a_usable_fetch_time_raises_no_warning(self) -> None:
        serp = self.folder / "serp"
        serp.mkdir()
        for number, stamp in enumerate((None, 5, "soon", "2026-13-45T00:00:00")):
            (serp / f"q{number}.json").write_text(json.dumps({"query": f"q{number}", "fetched_at": stamp, "results": []}), encoding="utf-8")
        code, out, err = self.run_command("append", "--serp-dir", str(serp), "--log", str(self.log), "--date", WEEK2)
        self.assertEqual(code, 0, err)
        self.assertNotIn("was fetched on", err)


class LoadCapturesTests(LogTestCase):
    def test_captures_are_found_by_the_label_browse_gives_a_query(self) -> None:
        captures, notes = rank_log.load_captures(RANK_FIXTURES / WEEK2 / "google", [Q_MILLWORK, Q_BRAND, Q_COST])
        self.assertEqual(sorted(captures), sorted([Q_MILLWORK, Q_BRAND, Q_COST]))
        self.assertEqual(notes, ())
        self.assertIn("AI Overview", captures[Q_MILLWORK])

    def test_no_folder_means_no_captures_and_no_notes(self) -> None:
        self.assertEqual(rank_log.load_captures(None, [Q_MILLWORK]), ({}, ()))

    def test_a_query_with_an_unusual_text_gets_its_own_file(self) -> None:
        query = "FF&E manufacturer \"custom\" / café?"
        folder = self.folder / "google"
        folder.mkdir()
        (folder / f"{serp_label(query)}.txt").write_text("Search Results\nhello\n", encoding="utf-8")
        captures, notes = rank_log.load_captures(folder, [query, "other"])
        self.assertEqual(list(captures), [query])

    def test_bytes_that_are_not_utf8_are_read_with_replacements(self) -> None:
        folder = self.folder / "google"
        folder.mkdir()
        (folder / f"{serp_label('q')}.txt").write_bytes(b"Search Results\ncaf\xe9\n")
        self.assertIn("caf�", rank_log.load_captures(folder, ["q"])[0]["q"])


class MergeTests(unittest.TestCase):
    def row(self, day: str, query: str, rank: Optional[int] = None) -> RankRow:
        return RankRow(day, query, rank, None, None, None, None, None, (), (), ())

    def test_new_rows_go_after_the_existing_ones(self) -> None:
        merged, replaced = rank_log.merge_rows([self.row("2026-10-11", "a")], [self.row("2026-10-18", "a")])
        self.assertEqual([(row.date, row.query) for row in merged], [("2026-10-11", "a"), ("2026-10-18", "a")])
        self.assertEqual(replaced, 0)

    def test_a_row_for_the_same_date_and_query_replaces_the_old_one_in_place(self) -> None:
        existing = [self.row("2026-10-11", "a", 5), self.row("2026-10-11", "b", 6), self.row("2026-10-18", "a", 7)]
        merged, replaced = rank_log.merge_rows(existing, [self.row("2026-10-11", "a", 1), self.row("2026-10-25", "c", 2)])
        self.assertEqual([(row.date, row.query, row.own_rank) for row in merged],
                         [("2026-10-11", "a", 1), ("2026-10-11", "b", 6), ("2026-10-18", "a", 7), ("2026-10-25", "c", 2)])
        self.assertEqual(replaced, 1)

    def test_duplicates_already_in_the_log_collapse_to_the_new_row(self) -> None:
        existing = [self.row("2026-10-11", "a", 5), self.row("2026-10-11", "a", 6)]
        merged, replaced = rank_log.merge_rows(existing, [self.row("2026-10-11", "a", 1)])
        self.assertEqual([row.own_rank for row in merged], [1])
        self.assertEqual(replaced, 1)

    def test_merging_nothing_changes_nothing(self) -> None:
        existing = [self.row("2026-10-11", "a")]
        self.assertEqual(rank_log.merge_rows(existing, []), (tuple(existing), 0))


class DiffCommandTests(LogTestCase):
    def two_snapshots(self) -> None:
        self.append(WEEK1)
        self.append(WEEK2)

    def test_it_compares_the_last_two_snapshots_and_exits_0(self) -> None:
        self.two_snapshots()
        code, out, err = self.run_command("diff", "--log", str(self.log))
        self.assertEqual(code, 0, err)
        lines = out.splitlines()
        self.assertEqual(lines[0], "Ranking log: 2026-10-11 -> 2026-10-18")
        self.assertIn("own rank: 14 -> 4 (up 10)", out)
        self.assertIn("AI Overview appeared", out)
        self.assertIn("AI Overview disappeared (it had cited numaliving.us)", out)
        self.assertIn("entered numaliving.us, woodworkingnetwork.com", out)

    def test_one_snapshot_is_not_enough_and_says_so_without_failing(self) -> None:
        self.append(WEEK1)
        code, out, err = self.run_command("diff", "--log", str(self.log))
        self.assertEqual(code, 0)
        self.assertIn("The log has one snapshot (2026-10-11); a comparison needs two.", out)
        self.assertIn("rank_log.py append", out)

    def test_a_log_with_only_a_header_has_no_snapshot_to_compare(self) -> None:
        self.log.write_text(HEADER + "\n", encoding="utf-8")
        code, out, err = self.run_command("diff", "--log", str(self.log))
        self.assertEqual(code, 0)
        self.assertIn("The log has no snapshot yet", out)

    def test_a_log_that_does_not_exist_is_a_usage_error(self) -> None:
        code, out, err = self.run_command("diff", "--log", str(self.folder / "missing.csv"))
        self.assertEqual(code, 2)
        self.assertIn("no ranking log", err)
        self.assertIn("append", err)

    def test_a_log_that_cannot_be_read_is_a_usage_error(self) -> None:
        self.log.write_text("not,the,header\n", encoding="utf-8")
        code, out, err = self.run_command("diff", "--log", str(self.log))
        self.assertEqual(code, 2)
        self.assertIn("header", err)

    def test_the_default_log_is_the_one_in_the_data_folder(self) -> None:
        data = self.folder / "data"
        data.mkdir()
        with mock.patch.dict(os.environ, {"SEO_DATA_DIR": str(data)}):
            self.run_command("append", "--serp-dir", str(RANK_FIXTURES / WEEK1 / "serp"), "--date", WEEK1)
            self.run_command("append", "--serp-dir", str(RANK_FIXTURES / WEEK2 / "serp"), "--date", WEEK2)
            code, out, err = self.run_command("diff")
        self.assertEqual(code, 0, err)
        self.assertIn("Ranking log: 2026-10-11 -> 2026-10-18", out)

    def test_two_runs_on_one_day_do_not_make_a_second_snapshot(self) -> None:
        self.append(WEEK1)
        self.append(WEEK1)
        code, out, err = self.run_command("diff", "--log", str(self.log))
        self.assertIn("The log has one snapshot", out)

    def test_hostile_text_in_the_log_cannot_write_to_the_terminal(self) -> None:
        hostile = "q\x1b]0;pwned\x07"
        rows = [RankRow(WEEK1, hostile, 3, None, None, None, None, None, ("a.test",), ("a.test",), ()),
                RankRow(WEEK2, hostile, 2, None, None, None, None, None, ("a.test",), ("a.test", "b\x1b[2J.test"), ())]
        rank_log.write_log(self.log, rows)
        code, out, err = self.run_command("diff", "--log", str(self.log))
        self.assertEqual(code, 0, err)
        self.assertEqual(unsafe_characters(out), [])


class UsageTests(LogTestCase):
    def assert_usage_error(self, argv: List[str]) -> None:
        with captured() as (out, err), self.assertRaises(SystemExit) as caught:
            rank_log.main(argv)
        self.assertEqual(caught.exception.code, 2)
        self.assertIn("usage:", err.getvalue())

    def test_a_command_is_required(self) -> None:
        self.assert_usage_error([])

    def test_append_needs_a_serp_folder(self) -> None:
        self.assert_usage_error(["append", "--log", str(self.log)])

    def test_options_cannot_be_abbreviated(self) -> None:
        self.assert_usage_error(["append", "--serp", str(RANK_FIXTURES / WEEK1 / "serp")])

    def test_the_default_clock_is_the_local_date(self) -> None:
        with mock.patch.object(rank_log, "date") as fake_date:
            fake_date.today.return_value = date(2026, 12, 24)
            code, out, err = self.run_command_with_default_clock()
        self.assertEqual(code, 0, err)
        self.assertEqual({row.date for row in rank_log.read_log(self.log)}, {"2026-12-24"})

    def run_command_with_default_clock(self) -> Tuple[int, str, str]:
        with captured() as (out, err):
            code = run_cli(rank_log.main, ["append", "--serp-dir", str(RANK_FIXTURES / WEEK2 / "serp"), "--log", str(self.log)])
        return code, out.getvalue(), err.getvalue()


class TrackedQueriesTests(unittest.TestCase):
    PATH = Path(rank_log.__file__).resolve().parent / "tracked_queries.txt"

    def queries(self) -> Tuple[str, ...]:
        return read_query_file(self.PATH)

    def test_the_list_is_the_fifteen_queries_the_plan_tracks(self) -> None:
        queries = self.queries()
        self.assertEqual(len(queries), 15)
        self.assertEqual(len(set(queries)), 15)

    def test_it_never_asks_for_more_google_captures_than_one_run_may_take(self) -> None:
        self.assertLessEqual(len(self.queries()), MAX_SERP_QUERIES)

    def test_the_import_the_commercial_the_question_the_paneling_and_the_brand_queries_are_all_there(self) -> None:
        queries = set(self.queries())
        for query in ("overseas millwork manufacturer for US projects", "international millwork supplier for US architects",
                      "import custom millwork from overseas", "architectural millwork manufacturer", "custom millwork manufacturer",
                      "multifamily millwork manufacturer", "hospitality millwork manufacturer", "luxury custom millwork",
                      "how much does custom millwork cost", "AWI premium vs custom grade", "millwork submittals shop drawings process",
                      "custom wood wall paneling", "fluted wood wall panels manufacturer", "numa living millwork", "numa living"):
            self.assertIn(query, queries)

    def test_the_groups_are_named_by_comments_that_serp_search_skips(self) -> None:
        text = self.PATH.read_text(encoding="utf-8")
        comments = [line for line in text.splitlines() if line.startswith("#")]
        self.assertGreaterEqual(len(comments), 5)
        self.assertEqual(len(self.queries()), len([line for line in text.splitlines() if line.strip() and not line.startswith("#")]))

    def test_every_query_is_plain_text_a_search_box_takes(self) -> None:
        for query in self.queries():
            with self.subTest(query=query):
                self.assertEqual(query, " ".join(query.split()))
                self.assertTrue(query.isprintable())

    def test_the_file_is_machine_neutral(self) -> None:
        text = self.PATH.read_text(encoding="utf-8")
        self.assertNotIn("/Volumes", text)
        self.assertNotIn("@", text)


class ModuleTests(unittest.TestCase):
    def test_the_rows_module_and_the_log_agree_on_the_columns(self) -> None:
        self.assertEqual(rank_log.COLUMNS, rank_rows.COLUMNS)

    def test_a_tool_error_is_what_a_bad_log_raises(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "log.csv"
            path.write_text("wrong\n", encoding="utf-8")
            with self.assertRaises(SeoToolError):
                rank_log.read_log(path)


if __name__ == "__main__":
    unittest.main()
