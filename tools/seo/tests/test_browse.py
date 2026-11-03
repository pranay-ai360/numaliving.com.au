"""Tests for the pure helpers in browse.py: URL building, block detection, argument limits and the launcher import.

The browser itself is never started here: test_browse_capture.py and test_browse_runs.py drive the capture code
with fake pages, and nothing in browse.py is excluded from coverage.
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from helpers import captured

import browse  # noqa: E402
import seo_common  # noqa: E402
from seo_common import SeoToolError, run_cli  # noqa: E402


class SearchUrlTests(unittest.TestCase):
    def test_builds_a_us_english_google_search_url(self) -> None:
        url = browse.google_search_url("custom millwork manufacturer")
        self.assertEqual(url, "https://www.google.com/search?q=custom+millwork+manufacturer&hl=en&gl=us&pws=0")

    def test_special_characters_are_encoded(self) -> None:
        url = browse.google_search_url("FF&E site:millwork-usa.com \"exact\"")
        self.assertIn("q=FF%26E+site%3Amillwork-usa.com+%22exact%22", url)
        self.assertEqual(url.count("&hl=en"), 1)


class BlockDetectionTests(unittest.TestCase):
    def test_known_block_pages_are_detected(self) -> None:
        for text in (
            "Our systems have detected unusual traffic from your computer network.",
            "Please confirm you are not a robot",
            "Solve this CAPTCHA to continue",
            "UNUSUAL TRAFFIC",
        ):
            with self.subTest(text=text):
                self.assertTrue(browse.is_block_page("https://www.google.com/search?q=x", text))

    def test_the_sorry_url_is_a_block_page(self) -> None:
        self.assertTrue(browse.is_block_page("https://www.google.com/sorry/index?continue=x", "anything"))

    def test_http_429_is_a_block_page(self) -> None:
        self.assertTrue(browse.is_block_page("https://www.google.com/search?q=x", "results", status=429))

    def test_a_normal_results_page_is_not_a_block_page(self) -> None:
        self.assertFalse(browse.is_block_page("https://www.google.com/search?q=x", "AI Overview\nPeople also ask\n", status=200))

    def test_only_the_top_of_the_page_is_checked_so_a_long_article_about_captchas_passes(self) -> None:
        text = "x" * (browse.BLOCK_CHECK_CHARS + 10) + " captcha"
        self.assertFalse(browse.is_block_page("https://www.google.com/search?q=x", text))


class SerpRequestTests(unittest.TestCase):
    def test_up_to_fifteen_queries_ten_seconds_apart_is_accepted(self) -> None:
        queries = tuple(f"query {n}" for n in range(15))
        self.assertEqual(browse.validate_serp_request(queries, 10.0), queries)
        self.assertEqual((browse.MAX_SERP_QUERIES, browse.MIN_SERP_DELAY_SECONDS), (15, 10.0))

    def test_more_than_fifteen_queries_is_rejected_not_truncated(self) -> None:
        with self.assertRaises(SeoToolError) as caught:
            browse.validate_serp_request(tuple(f"query {n}" for n in range(16)), 15.0)
        self.assertIn("15", str(caught.exception))

    def test_a_delay_under_ten_seconds_is_rejected(self) -> None:
        for delay in (0.0, 5.0, 9.99):
            with self.subTest(delay=delay), self.assertRaises(SeoToolError) as caught:
                browse.validate_serp_request(("one",), delay)
            self.assertIn("10", str(caught.exception))

    def test_no_queries_is_rejected(self) -> None:
        with self.assertRaises(SeoToolError):
            browse.validate_serp_request((), 15.0)

    def test_repeated_queries_are_run_once(self) -> None:
        self.assertEqual(browse.validate_serp_request(("a", "b", "a"), 15.0), ("a", "b"))

    def test_the_default_delay_is_polite(self) -> None:
        self.assertGreaterEqual(browse.DEFAULT_SERP_DELAY_SECONDS, browse.MIN_SERP_DELAY_SECONDS)


class LabelTests(unittest.TestCase):
    def test_labels_read_like_host_and_path(self) -> None:
        self.assertEqual(browse.shot_label("https://numaliving.us/capabilities/"), "numaliving.us_capabilities")

    def test_serp_files_are_named_by_the_query_and_a_hash_of_it(self) -> None:
        self.assertEqual(browse.serp_label("custom millwork manufacturer"), "custom-millwork-manufacturer-1f04d3")
        self.assertEqual(browse.serp_label("site:millwork-usa.com"), "site-millwork-usa-com-59f6fa")

    def test_queries_that_differ_only_in_case_or_punctuation_get_different_files(self) -> None:
        labels = {browse.serp_label(query) for query in ("Custom Millwork", "custom millwork", "custom-millwork!", "custom millwork ")}
        self.assertEqual(len(labels), 4)

    def test_non_latin_and_symbol_queries_get_distinct_names(self) -> None:
        labels = [browse.serp_label(query) for query in ("\u6728\u5de5", "\u5bb6\u5177", "???", "!!!")]
        self.assertEqual(len(set(labels)), 4)
        for label in labels:
            self.assertRegex(label, r"^[a-z0-9-]+$")

    def test_long_queries_with_the_same_start_get_different_files(self) -> None:
        self.assertNotEqual(browse.serp_label("x" * 70 + "A"), browse.serp_label("x" * 70 + "B"))

    def test_the_label_is_the_same_hashed_name_serp_search_uses(self) -> None:
        self.assertEqual(browse.serp_label("Custom Millwork"), seo_common.hashed_slug("Custom Millwork", browse.SERP_LABEL_LENGTH))


class ParserTests(unittest.TestCase):
    def test_serp_arguments(self) -> None:
        args = browse.build_parser().parse_args(["serp", "one", "two", "--delay", "12"])
        self.assertEqual((args.command, args.queries, args.delay), ("serp", ["one", "two"], 12.0))

    def test_shots_arguments(self) -> None:
        args = browse.build_parser().parse_args(["shots", "https://a.test/", "--full-page"])
        self.assertEqual((args.command, args.urls, args.full_page), ("shots", ["https://a.test/"], True))

    def test_a_subcommand_is_required(self) -> None:
        with captured(), self.assertRaises(SystemExit) as caught:
            browse.build_parser().parse_args([])
        self.assertEqual(caught.exception.code, 2)

    def test_help_exits_zero(self) -> None:
        with captured(), self.assertRaises(SystemExit) as caught:
            browse.build_parser().parse_args(["--help"])
        self.assertEqual(caught.exception.code, 0)


class RunValidationTests(unittest.TestCase):
    """main() must refuse bad requests before it looks for the browser, so these never need CloakBrowser."""

    def test_too_many_serp_queries_exit_2_without_touching_the_browser(self) -> None:
        argv = ["serp", *[f"query {n}" for n in range(16)]]
        with captured(), mock.patch.object(browse, "load_launcher", side_effect=AssertionError("browser touched")):
            self.assertEqual(run_cli(browse.main, argv), 2)

    def test_a_short_delay_exits_2_without_touching_the_browser(self) -> None:
        with captured(), mock.patch.object(browse, "load_launcher", side_effect=AssertionError("browser touched")):
            self.assertEqual(run_cli(browse.main, ["serp", "one", "--delay", "3"]), 2)

    def test_a_bad_url_exits_2_without_touching_the_browser(self) -> None:
        with captured(), mock.patch.object(browse, "load_launcher", side_effect=AssertionError("browser touched")):
            self.assertEqual(run_cli(browse.main, ["shots", "file:///etc/passwd"]), 2)

    def test_a_google_address_in_shots_exits_2_without_touching_the_browser(self) -> None:
        with captured() as (_, err), mock.patch.object(browse, "load_launcher", side_effect=AssertionError("browser touched")):
            code = run_cli(browse.main, ["shots", "https://numaliving.us/", "https://www.google.com/search?q=custom+millwork"])
        self.assertEqual(code, 2)
        self.assertIn("serp", err.getvalue())

    def test_google_addresses_in_a_urls_file_are_refused_too(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            listing = Path(folder) / "urls.txt"
            listing.write_text("https://numaliving.us/\nhttps://www.google.co.uk/search?q=x\n", encoding="utf-8")
            with captured(), mock.patch.object(browse, "load_launcher", side_effect=AssertionError("browser touched")):
                self.assertEqual(run_cli(browse.main, ["shots", "--urls-file", str(listing)]), 2)

    def test_shots_without_urls_is_a_usage_error(self) -> None:
        with captured(), self.assertRaises(SystemExit) as caught:
            browse.main(["shots"])
        self.assertEqual(caught.exception.code, 2)

    def test_the_seat_error_has_the_documented_exit_code(self) -> None:
        self.assertEqual(browse.EXIT_SEAT_TAKEN, 76)
        self.assertEqual(browse.BrowserSeatError.exit_code, 76)
        with captured():
            code = run_cli(lambda argv: (_ for _ in ()).throw(browse.BrowserSeatError("seat taken")), [])
        self.assertEqual(code, 76)

    def test_a_missing_cloakbrowser_package_is_a_usage_error_not_a_seat_error(self) -> None:
        with mock.patch("importlib.util.find_spec", return_value=None), self.assertRaises(SeoToolError) as caught:
            browse.require_cloakbrowser()
        self.assertNotIsInstance(caught.exception, browse.BrowserSeatError)
        self.assertIn("python3.14", str(caught.exception))


class MainDispatchTests(unittest.TestCase):
    def test_shots_hands_the_checked_urls_to_run_shots(self) -> None:
        with mock.patch.object(browse, "run_shots", return_value=0) as run_shots:
            code = browse.main(["shots", "https://a.test/", "https://a.test/#frag", "https://b.test/"])
        self.assertEqual(code, 0)
        self.assertEqual(run_shots.call_args.args[1], ("https://a.test/", "https://b.test/"))

    def test_serp_without_a_query_is_a_usage_error(self) -> None:
        with captured(), self.assertRaises(SystemExit) as caught:
            browse.main(["serp"])
        self.assertEqual(caught.exception.code, 2)


class LauncherImportTests(unittest.TestCase):
    def test_the_launcher_is_the_site_qa_one_and_is_found_by_path(self) -> None:
        self.assertEqual(browse.QA_DIR, Path(browse.__file__).resolve().parent.parent / "site-qa")
        module = browse.load_launcher()
        self.assertTrue(callable(module.open_browser))
        self.assertTrue(issubclass(module.QAError, Exception))

    def test_loading_the_launcher_leaves_sys_path_alone(self) -> None:
        before = list(sys.path)
        browse.load_launcher()
        self.assertEqual(sys.path, before)

    def test_a_missing_launcher_is_a_tool_error(self) -> None:
        with tempfile.TemporaryDirectory() as folder, mock.patch.object(browse, "QA_DIR", Path(folder)):
            with self.assertRaises(SeoToolError) as caught:
                browse.load_launcher()
        self.assertIn("qa_common.py", str(caught.exception))

    def test_a_launcher_that_fails_to_import_is_reported_and_forgotten(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / "qa_common.py").write_text("raise RuntimeError('boom')\n", encoding="utf-8")
            with mock.patch.object(browse, "QA_DIR", Path(folder)), self.assertRaises(SeoToolError) as caught:
                browse.load_launcher()
        self.assertIn("RuntimeError: boom", str(caught.exception))
        self.assertNotIn(browse.LAUNCHER_MODULE, sys.modules)

    def test_a_launcher_file_python_cannot_load_is_reported(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / "qa_common.py").write_text("x = 1\n", encoding="utf-8")
            with mock.patch.object(browse, "QA_DIR", Path(folder)):
                with mock.patch("importlib.util.spec_from_file_location", return_value=None):
                    with self.assertRaises(SeoToolError) as caught:
                        browse.load_launcher()
        self.assertIn("cannot load", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
