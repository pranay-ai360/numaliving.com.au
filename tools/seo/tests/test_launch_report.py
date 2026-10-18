"""Tests for the launch check's report: the readable table, the verdict and the JSON file."""

from __future__ import annotations

import json
import unittest
from typing import Any, Dict, Sequence

from launch_support import ORIGIN, build_web
from test_terminal_safety import unsafe_characters

import launch_crawl  # noqa: E402
import launch_page_checks  # noqa: E402
import launch_report  # noqa: E402
from launch_model import CheckResult, Failure, Site, failing, passing, skipped  # noqa: E402
from launch_report import Report  # noqa: E402

ESC, RLO = "\x1b", "‮"
NOW = "2026-10-18T12:00:00+00:00"


def report_of(*results: CheckResult, mode: str = "live", pages: Sequence[Dict[str, Any]] = ()) -> Report:
    return Report(mode, ORIGIN + "/", ORIGIN, 60, NOW, len(pages), tuple(pages), tuple(results))


def page_check(check_id: str = "title-single", status: str = "PASS", failures: Sequence[Failure] = (), summary: str = "5 pages") -> CheckResult:
    if status == "FAIL":
        return failing(check_id, "page", f"title of {check_id}", failures, summary)
    if status == "SKIP":
        return skipped(check_id, "page", f"title of {check_id}", summary)
    return passing(check_id, "page", f"title of {check_id}", summary)


def site_check(check_id: str = "robots-txt", status: str = "PASS", failures: Sequence[Failure] = (), summary: str = "ok") -> CheckResult:
    result = page_check(check_id, status, failures, summary)
    return CheckResult(result.id, "site", result.title, result.status, result.summary, result.failures)


class VerdictTests(unittest.TestCase):
    def test_a_report_with_only_passes_and_skips_passes(self) -> None:
        report = report_of(page_check(), site_check(status="SKIP", summary="not the real host"))
        self.assertTrue(report.passed)

    def test_one_failure_fails_the_report(self) -> None:
        self.assertFalse(report_of(page_check(), page_check("canonical", "FAIL", [Failure("u", "m")], "1 of 5 pages")).passed)

    def test_the_counts_cover_every_status(self) -> None:
        report = report_of(page_check("a"), page_check("b"), page_check("c", "FAIL", [Failure("u", "m")]), site_check(status="SKIP"))
        self.assertEqual(report.counts, {"PASS": 2, "FAIL": 1, "SKIP": 1})

    def test_a_report_with_no_checks_does_not_pass_by_default(self) -> None:
        self.assertFalse(report_of().passed)


class TextTests(unittest.TestCase):
    def test_the_header_names_the_mode_the_hosts_and_the_numbers(self) -> None:
        text = launch_report.render_report(report_of(page_check(), pages=[{}] * 5))
        lines = text.splitlines()
        self.assertEqual(lines[0], f"Launch check, live mode: {ORIGIN}/")
        self.assertIn(f"canonical host {ORIGIN}", lines[1])
        self.assertIn("5 pages read", lines[1])
        self.assertIn("limit 60", lines[1])

    def test_the_mode_is_explained_in_a_line(self) -> None:
        live = launch_report.render_report(report_of(page_check(), mode="live"))
        preview = launch_report.render_report(report_of(page_check(), mode="preview"))
        self.assertIn("pages must be indexable", live)
        self.assertIn("every page must be noindex", preview)

    def test_checks_are_grouped_by_scope_in_the_order_given(self) -> None:
        text = launch_report.render_report(report_of(page_check("b-page"), page_check("a-page"), site_check("z-site"), site_check("y-site")))
        order = [text.index(marker) for marker in ("PAGE CHECKS", "b-page", "a-page", "SITE CHECKS", "z-site", "y-site")]
        self.assertEqual(order, sorted(order))

    def test_a_passing_line_shows_status_id_title_and_summary(self) -> None:
        text = launch_report.render_report(report_of(page_check("title-single", summary="5 pages")))
        self.assertIn("PASS  title-single  title of title-single  [5 pages]", text)

    def test_ids_are_padded_to_one_column(self) -> None:
        text = launch_report.render_report(report_of(page_check("a"), page_check("longer-id")))
        self.assertIn("PASS  a          title of a", text)
        self.assertIn("PASS  longer-id  title of longer-id", text)

    def test_a_failing_check_lists_the_failing_addresses_under_it(self) -> None:
        failures = [Failure("https://a.test/x/", "no canonical link"), Failure("https://a.test/y/", "2 canonical links")]
        text = launch_report.render_report(report_of(page_check("canonical", "FAIL", failures, "2 of 5 pages")))
        lines = text.splitlines()
        start = next(index for index, line in enumerate(lines) if line.startswith("FAIL  canonical"))
        self.assertTrue(lines[start].endswith("[2 of 5 pages]"))
        self.assertEqual(lines[start + 1], "        https://a.test/x/  no canonical link")
        self.assertEqual(lines[start + 2], "        https://a.test/y/  2 canonical links")

    def test_more_than_eight_failures_are_cut_and_counted(self) -> None:
        failures = [Failure(f"https://a.test/{number}/", "bad") for number in range(11)]
        text = launch_report.render_report(report_of(page_check("canonical", "FAIL", failures, "11 of 11 pages")))
        self.assertIn("https://a.test/7/  bad", text)
        self.assertNotIn("https://a.test/8/", text)
        self.assertIn("... and 3 more (the --json report lists them all)", text)

    def test_a_skipped_check_shows_its_reason(self) -> None:
        text = launch_report.render_report(report_of(site_check("redirect-https", "SKIP", summary="only the real host has these")))
        self.assertIn("SKIP  redirect-https  title of redirect-https  [only the real host has these]", text)

    def test_the_closing_lines_count_and_decide(self) -> None:
        failing_report = report_of(page_check("a"), page_check("b", "FAIL", [Failure("u", "m")]), site_check(status="SKIP"))
        text = launch_report.render_report(failing_report)
        self.assertTrue(text.endswith("3 checks: 1 passed, 1 failed, 1 skipped\nResult: FAIL"), text[-120:])

    def test_a_pass_with_skips_says_so(self) -> None:
        text = launch_report.render_report(report_of(page_check(), site_check(status="SKIP")))
        self.assertTrue(text.endswith("2 checks: 1 passed, 0 failed, 1 skipped\nResult: PASS (1 check was skipped; see the SKIP lines)"), text[-120:])

    def test_a_clean_pass_has_no_such_note(self) -> None:
        text = launch_report.render_report(report_of(page_check(), site_check()))
        self.assertTrue(text.endswith("2 checks: 2 passed, 0 failed, 0 skipped\nResult: PASS"), text[-120:])

    def test_page_text_cannot_write_to_the_terminal(self) -> None:
        hostile = Failure(f"https://a.test/{ESC}[2J{RLO}", f"title {ESC}]0;pwned\x07 {RLO}reversed")
        report = report_of(page_check("title-length", "FAIL", [hostile], f"1 of 1 pages {ESC}"))
        text = launch_report.render_report(report)
        self.assertEqual(unsafe_characters(text), [])
        self.assertIn("\\x1b]0;pwned\\x07", text)


class ClipTests(unittest.TestCase):
    def test_short_text_is_untouched_and_long_text_is_cut_with_dots(self) -> None:
        self.assertEqual(launch_report.clip("x" * 300), "x" * 300)
        self.assertEqual(launch_report.clip("x" * 301), "x" * 297 + "...")
        self.assertEqual(launch_report.clip(""), "")

    def test_a_huge_title_cannot_flood_the_table(self) -> None:
        failure = Failure("https://a.test/" + "u" * 5000, "title " + "t" * 100_000)
        text = launch_report.render_report(report_of(page_check("title-length", "FAIL", [failure], "1 of 1 page")))
        self.assertLess(max(len(line) for line in text.splitlines()), 700)
        self.assertIn("...", text)

    def test_a_huge_title_cannot_flood_the_json_file_either(self) -> None:
        failure = Failure("https://a.test/", "title " + "t" * 100_000)
        data = json.loads(launch_report.report_json(report_of(page_check("title-length", "FAIL", [failure], "x"))))
        self.assertEqual(len(data["checks"][0]["failures"][0]["message"]), 300)


class JsonTests(unittest.TestCase):
    def load(self, report: Report) -> Dict[str, Any]:
        loaded: Dict[str, Any] = json.loads(launch_report.report_json(report))
        return loaded

    def test_the_top_level_keys(self) -> None:
        data = self.load(report_of(page_check(), pages=[{"url": "u"}]))
        self.assertEqual(
            data,
            {
                "tool": "launch_check", "mode": "live", "base_url": ORIGIN + "/", "canonical_host": ORIGIN, "max_pages": 60,
                "generated_at": NOW, "addresses_fetched": 1, "passed": True, "counts": {"PASS": 1, "FAIL": 0, "SKIP": 0}, "pages": [{"url": "u"}],
                "checks": [{"id": "title-single", "scope": "page", "title": "title of title-single", "status": "PASS",
                            "summary": "5 pages", "failures": []}],
            },
        )

    def test_every_failure_is_listed_whatever_the_table_shows(self) -> None:
        failures = [Failure(f"https://a.test/{number}/", "bad") for number in range(11)]
        data = self.load(report_of(page_check("canonical", "FAIL", failures, "11 of 11 pages")))
        self.assertEqual(len(data["checks"][0]["failures"]), 11)
        self.assertEqual(data["checks"][0]["failures"][0], {"url": "https://a.test/0/", "message": "bad"})
        self.assertFalse(data["passed"])

    def test_the_text_is_plain_ascii_so_any_page_text_can_be_saved(self) -> None:
        lone = "\ud800"
        text = launch_report.report_json(report_of(page_check("t", "FAIL", [Failure("u", f"café {lone} ‮ {ESC}")], "x")))
        self.assertTrue(text.isascii())
        self.assertEqual(json.loads(text)["checks"][0]["failures"][0]["message"], f"café {lone} ‮ {ESC}")

    def test_the_file_ends_with_a_newline(self) -> None:
        self.assertTrue(launch_report.report_json(report_of(page_check())).endswith("}\n"))


class PageRecordTests(unittest.TestCase):
    def views(self) -> Sequence[launch_page_checks.PageView]:
        site = Site.create(ORIGIN + "/", ORIGIN, "live")
        return launch_page_checks.build_views(site, launch_crawl.crawl_site(site, build_web(), [site.base_url], 60))

    def test_a_record_holds_what_a_reader_needs_to_find_the_page_again(self) -> None:
        record = launch_report.page_record(self.views()[1])
        self.assertEqual(record["url"], ORIGIN + "/about/")
        self.assertEqual(record["path"], "/about/")
        self.assertEqual(record["title"], "About the Millwork Factory | Numa Living")
        self.assertEqual(record["title_length"], 40)
        self.assertEqual(record["description_length"], 149)
        self.assertEqual(record["canonical"], ORIGIN + "/about/")
        self.assertEqual(record["robots"], ["index, follow"])
        self.assertEqual(record["lang"], "en-US")
        self.assertEqual(record["h1"], ["About Numa Living"])
        self.assertEqual(record["json_ld_types"], ["BreadcrumbList", "Organization", "WebSite"])
        self.assertEqual(record["images"], 1)
        self.assertEqual(record["internal_links"], 8)

    def test_long_text_in_a_record_is_cut(self) -> None:
        site = Site.create(ORIGIN + "/", ORIGIN, "live")
        web = build_web().add(ORIGIN + "/", "<title>" + "t" * 5000 + "</title><h1>" + "h" * 5000 + "</h1>")
        view = launch_page_checks.build_views(site, launch_crawl.crawl_site(site, web, [site.base_url], 1))[0]
        record = launch_report.page_record(view)
        self.assertEqual((len(record["title"]), record["title_length"], len(record["h1"][0])), (300, 5000, 300))

    def test_the_record_is_json_ready(self) -> None:
        for view in self.views():
            json.dumps(launch_report.page_record(view))

    def test_a_page_without_head_tags_has_none_values(self) -> None:
        site = Site.create(ORIGIN + "/", ORIGIN, "live")
        web = build_web().add(ORIGIN + "/", "<p>bare</p>")
        view = launch_page_checks.build_views(site, launch_crawl.crawl_site(site, web, [site.base_url], 1))[0]
        record = launch_report.page_record(view)
        self.assertEqual((record["title"], record["canonical"], record["lang"], record["h1"]), ("", None, None, []))


if __name__ == "__main__":
    unittest.main()
