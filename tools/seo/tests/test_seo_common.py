"""Tests for the shared helpers: errors, the data folder, slugs, list files, URL checks and the CLI wrapper."""

from __future__ import annotations

import argparse
import os
import re
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from helpers import captured

import seo_common  # noqa: E402
from seo_common import SeoToolError  # noqa: E402


class DataDirTests(unittest.TestCase):
    def test_defaults_to_data_folder_next_to_the_tools(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop(seo_common.DATA_DIR_ENV, None)
            self.assertEqual(seo_common.data_dir(), seo_common.TOOLS_DIR / "data")

    def test_environment_variable_overrides_the_default(self) -> None:
        with mock.patch.dict(os.environ, {seo_common.DATA_DIR_ENV: "/somewhere/else"}):
            self.assertEqual(seo_common.data_dir(), Path("/somewhere/else"))

    def test_blank_environment_variable_falls_back_to_the_default(self) -> None:
        with mock.patch.dict(os.environ, {seo_common.DATA_DIR_ENV: "   "}):
            self.assertEqual(seo_common.data_dir(), seo_common.TOOLS_DIR / "data")


class SlugTests(unittest.TestCase):
    def test_slugify_keeps_letters_and_digits_only(self) -> None:
        self.assertEqual(
            seo_common.slugify("FF&E manufacturer custom furniture hospitality"),
            "ff-e-manufacturer-custom-furniture-hospitality",
        )

    def test_slugify_collapses_runs_and_trims_the_ends(self) -> None:
        self.assertEqual(seo_common.slugify('  "numa living" -- joinery!  '), "numa-living-joinery")

    def test_slugify_truncates_without_a_trailing_dash(self) -> None:
        slug = seo_common.slugify("alpha beta gamma delta", max_length=11)
        self.assertEqual(slug, "alpha-beta")

    def test_slugify_of_symbols_only_is_empty(self) -> None:
        self.assertEqual(seo_common.slugify("?!&"), "")

    def test_hashed_slug_matches_the_file_names_of_the_saved_baseline(self) -> None:
        self.assertEqual(seo_common.hashed_slug("custom millwork manufacturer"), "custom-millwork-manufacturer-1f04d3")
        self.assertEqual(seo_common.hashed_slug("site:millwork-usa.com"), "site-millwork-usa-com-59f6fa")

    def test_hashed_slug_tells_apart_queries_with_the_same_words(self) -> None:
        self.assertNotEqual(seo_common.hashed_slug("a b"), seo_common.hashed_slug("a-b"))

    def test_hashed_slug_of_symbols_only_is_just_the_hash(self) -> None:
        slug = seo_common.hashed_slug("?!")
        self.assertRegex(slug, r"^[0-9a-f]{6}$")

    def test_url_slug_reads_like_host_and_path(self) -> None:
        self.assertEqual(seo_common.url_slug("https://numaliving.us/about/"), "numaliving.us_about")
        self.assertEqual(seo_common.url_slug("https://numaliving.us/projects/golf-links"), "numaliving.us_projects_golf-links")

    def test_url_slug_of_the_home_page_is_index(self) -> None:
        self.assertEqual(seo_common.url_slug("https://numaliving.us/"), "numaliving.us_index")
        self.assertEqual(seo_common.url_slug("https://numaliving.us"), "numaliving.us_index")

    def test_url_slug_adds_a_hash_for_a_query_string(self) -> None:
        plain = seo_common.url_slug("https://x.test/p")
        first = seo_common.url_slug("https://x.test/p?a=1")
        second = seo_common.url_slug("https://x.test/p?a=2")
        self.assertTrue(first.startswith(plain + "_"))
        self.assertNotEqual(first, second)

    def test_url_slug_replaces_a_port_colon_and_odd_characters(self) -> None:
        slug = seo_common.url_slug("http://127.0.0.1:4302/a b/%C3%A9?x=1")
        self.assertNotIn(":", slug)
        self.assertNotIn(" ", slug)
        self.assertNotIn("/", slug)
        self.assertRegex(slug, r"^[A-Za-z0-9._-]+$")

    def test_url_slug_stays_short_and_unique_for_very_long_paths(self) -> None:
        first = seo_common.url_slug("https://x.test/" + "a" * 300 + "/one")
        second = seo_common.url_slug("https://x.test/" + "a" * 300 + "/two")
        self.assertLessEqual(len(first), seo_common.URL_SLUG_MAX_LENGTH + 7)
        self.assertNotEqual(first, second)


class AsciiUrlTests(unittest.TestCase):
    """http.client can only send ASCII; browsers percent-encode the rest, and so must this tool."""

    def test_non_ascii_path_and_query_are_percent_encoded_as_utf8(self) -> None:
        self.assertEqual(seo_common.ascii_url("https://a.test/caf\u00e9?q=\u6728"), "https://a.test/caf%C3%A9?q=%E6%9C%A8")

    def test_existing_escapes_are_not_encoded_twice(self) -> None:
        self.assertEqual(seo_common.ascii_url("https://a.test/caf%C3%A9?q=a%20b"), "https://a.test/caf%C3%A9?q=a%20b")

    def test_spaces_become_percent_20(self) -> None:
        self.assertEqual(seo_common.ascii_url("https://a.test/a b/c"), "https://a.test/a%20b/c")

    def test_the_host_becomes_punycode(self) -> None:
        self.assertEqual(seo_common.ascii_url("https://b\u00fccher.test/x"), "https://xn--bcher-kva.test/x")

    def test_ports_userless_ipv6_and_fragments(self) -> None:
        self.assertEqual(seo_common.ascii_url("http://127.0.0.1:8080/x#frag"), "http://127.0.0.1:8080/x")
        self.assertEqual(seo_common.ascii_url("http://[::1]:8000/caf\u00e9"), "http://[::1]:8000/caf%C3%A9")

    def test_an_ascii_address_is_unchanged(self) -> None:
        for url in ("https://a.test/", "https://a.test/a/b.html?x=1&y=2", "https://a.test/a;b/c,d(e)!*'~-._"):
            with self.subTest(url=url):
                self.assertEqual(seo_common.ascii_url(url), url)

    def test_the_result_is_always_ascii(self) -> None:
        self.assertTrue(seo_common.ascii_url("https://a\u00e9.test/\u6728?\u00fc").isascii())

    def test_a_host_that_cannot_be_encoded_is_left_for_the_request_to_refuse(self) -> None:
        url = "https://" + "\u00e9" * 80 + ".test/"  # a label over 63 characters has no IDNA form
        self.assertEqual(seo_common.ascii_url(url), url)


class AssignStemsTests(unittest.TestCase):
    """Two different URLs must never be saved under one name (the second used to replace the first)."""

    def stems(self, *urls: str):
        return seo_common.assign_stems(urls)

    def test_ordinary_urls_keep_their_plain_readable_names(self) -> None:
        stems = self.stems("https://a.test/", "https://a.test/about/", "https://b.test/x/y")
        self.assertEqual(stems, {
            "https://a.test/": "a.test_index", "https://a.test/about/": "a.test_about", "https://b.test/x/y": "b.test_x_y",
        })

    def test_urls_that_would_share_a_name_get_a_hash_of_the_whole_address(self) -> None:
        pairs = (
            ("https://a.test/x", "https://a.test/x/"),
            ("http://a.test/", "https://a.test/"),
            ("https://a.test/x/y", "https://a.test/x_y"),
            ("https://a.test/About", "https://a.test/about"),
            ("https://a.test/", "https://a.test/index"),
        )
        for first, second in pairs:
            with self.subTest(first=first, second=second):
                stems = self.stems(first, second)
                self.assertEqual(stems[first], seo_common.url_slug(first))  # the first keeps the readable name
                self.assertRegex(stems[second], rf"^{re.escape(seo_common.url_slug(second))}-[0-9a-f]{{6}}$")
                self.assertEqual(len({stem.lower() for stem in stems.values()}), 2)  # also distinct on a case-insensitive disk

    def test_the_hash_of_a_name_does_not_depend_on_the_other_addresses_in_the_run(self) -> None:
        alone = self.stems("https://a.test/x", "https://a.test/x/")["https://a.test/x/"]
        crowded = self.stems("https://a.test/other", "https://a.test/x", "https://a.test/x/")["https://a.test/x/"]
        self.assertEqual(alone, crowded)

    def test_a_repeated_url_is_one_entry_with_one_name(self) -> None:
        stems = self.stems("https://a.test/x", "https://a.test/x")
        self.assertEqual(len(stems), 1)
        self.assertEqual(stems["https://a.test/x"], "a.test_x")

    def test_fragments_do_not_make_a_different_page(self) -> None:
        stems = self.stems("https://a.test/x#one", "https://a.test/x#two")
        self.assertEqual(len(stems), 2)  # both are keys, but they share the one name: the page is the same
        self.assertEqual(set(stems.values()), {"a.test_x"})

    def test_names_are_safe_file_names(self) -> None:
        stems = self.stems("https://a.test/a b/%C3%A9", "https://a.test/a-b/%C3%A9", "http://[::1]:80/x", "https://a.test/\u00e9")
        for stem in stems.values():
            self.assertRegex(stem, r"^[A-Za-z0-9._-]+$")

    def test_an_address_that_cannot_be_split_still_gets_a_name(self) -> None:
        self.assertRegex(seo_common.url_slug("http://["), r"^[A-Za-z0-9._-]+$")


class LeftoverBranchTests(unittest.TestCase):
    def test_ascii_url_leaves_an_unsplittable_address_alone(self) -> None:
        self.assertEqual(seo_common.ascii_url("http://["), "http://[")
        self.assertEqual(seo_common.ascii_url("https:///path"), "https:///path")

    def test_a_hash_clash_between_names_still_never_shares_a_file(self) -> None:
        with mock.patch.object(seo_common, "_short_hash", return_value="abc123"):
            stems = seo_common.assign_stems(["https://a.test/x/y", "https://a.test/x_y", "https://a.test/x_y/"])
        self.assertEqual(stems["https://a.test/x/y"], "a.test_x_y")
        self.assertEqual(stems["https://a.test/x_y"], "a.test_x_y-abc123")
        self.assertEqual(stems["https://a.test/x_y/"], "a.test_x_y-abc123-2")

    def test_removing_a_file_that_cannot_be_removed_is_a_tool_error(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / "dir").mkdir()
            with self.assertRaises(SeoToolError):
                seo_common.remove_file(Path(folder) / "dir")

    def test_removing_a_file_that_is_not_there_is_fine(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            seo_common.remove_file(Path(folder) / "nope.html")


class ListFileTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.folder = Path(self._tmp.name)

    def write(self, text: str) -> Path:
        path = self.folder / "list.txt"
        path.write_text(text, encoding="utf-8")
        return path

    def test_skips_comments_and_blank_lines_and_trims_whitespace(self) -> None:
        path = self.write("# heading\n\n  first query  \n   # indented comment\nsecond query\n\n")
        self.assertEqual(seo_common.read_query_file(path), ("first query", "second query"))

    def test_repeated_lines_are_kept_once_in_order(self) -> None:
        path = self.write("b\na\nb\na\n")
        self.assertEqual(seo_common.read_query_file(path), ("b", "a"))

    def test_returns_a_tuple(self) -> None:
        self.assertIsInstance(seo_common.read_query_file(self.write("x\n")), tuple)

    def test_a_file_with_nothing_in_it_is_an_error(self) -> None:
        with self.assertRaises(SeoToolError) as caught:
            seo_common.read_query_file(self.write("# only a comment\n\n"))
        self.assertIn("no queries", str(caught.exception))

    def test_a_missing_file_is_an_error_not_a_traceback(self) -> None:
        with self.assertRaises(SeoToolError) as caught:
            seo_common.read_query_file(self.folder / "missing.txt")
        self.assertIn("missing.txt", str(caught.exception))

    def test_the_word_for_the_error_message_can_be_changed(self) -> None:
        with self.assertRaises(SeoToolError) as caught:
            seo_common.read_list_file(self.write("\n"), "URLs")
        self.assertIn("no URLs", str(caught.exception))

    def test_the_repository_query_lists_are_valid(self) -> None:
        queries_dir = seo_common.TOOLS_DIR / "queries"
        study = seo_common.read_query_file(queries_dir / "us-study-2026-10.txt")
        brand = seo_common.read_query_file(queries_dir / "brand-2026-10.txt")
        self.assertEqual(len(study), 45)
        self.assertEqual(len(brand), 8)


class RequireHttpUrlTests(unittest.TestCase):
    def test_accepts_http_and_https(self) -> None:
        self.assertEqual(seo_common.require_http_url("https://numaliving.us/about/"), "https://numaliving.us/about/")
        self.assertEqual(seo_common.require_http_url("HTTP://Example.test:8080/x?y=1#z"), "HTTP://Example.test:8080/x?y=1#z")

    def test_strips_surrounding_whitespace(self) -> None:
        self.assertEqual(seo_common.require_http_url("  https://x.test/  \n"), "https://x.test/")

    def test_rejects_every_other_scheme(self) -> None:
        for url in (
            "file:///etc/passwd",
            "ftp://x.test/file",
            "javascript:alert(1)",
            "data:text/html,<p>hi</p>",
            "gopher://x.test/",
            "FILE:///etc/hosts",
        ):
            with self.subTest(url=url), self.assertRaises(SeoToolError) as caught:
                seo_common.require_http_url(url)
            self.assertIn("http", str(caught.exception))

    def test_rejects_a_missing_scheme_or_host(self) -> None:
        for url in ("example.test/page", "//example.test/page", "https://", "http:///path", ""):
            with self.subTest(url=url), self.assertRaises(SeoToolError):
                seo_common.require_http_url(url)

    def test_rejects_embedded_credentials(self) -> None:
        with self.assertRaises(SeoToolError) as caught:
            seo_common.require_http_url("https://user:secret@x.test/")
        self.assertNotIn("secret", str(caught.exception))

    def test_rejects_whitespace_and_control_characters_inside_the_url(self) -> None:
        for url in ("https://x.test/a b", "https://x.test/a\nb", "https://x.test/\x00"):
            with self.subTest(url=url), self.assertRaises(SeoToolError):
                seo_common.require_http_url(url)

    def test_rejects_a_bad_port(self) -> None:
        with self.assertRaises(SeoToolError):
            seo_common.require_http_url("https://x.test:notaport/")


class SafeUrlSplitTests(unittest.TestCase):
    """urlsplit raises ValueError for some hostile or broken addresses; safe_urlsplit answers None instead."""

    def test_a_normal_url_is_split(self) -> None:
        parts = seo_common.safe_urlsplit("https://a.test/x?y=1#z")
        self.assertIsNotNone(parts)
        self.assertEqual((parts.netloc, parts.path, parts.query, parts.fragment), ("a.test", "/x", "y=1", "z"))

    def test_an_unclosed_ipv6_bracket_gives_none(self) -> None:
        self.assertIsNone(seo_common.safe_urlsplit("http://[::1/"))
        self.assertIsNone(seo_common.safe_urlsplit("http://["))

    def test_a_host_that_changes_shape_under_unicode_normalisation_gives_none(self) -> None:
        # U+2100 normalises to "a/c" and U+FF0F to "/": urlsplit refuses both with a ValueError.
        self.assertIsNone(seo_common.safe_urlsplit("http://a℀.test/"))
        self.assertIsNone(seo_common.safe_urlsplit("http://／／evil.test/"))

    def test_a_value_that_is_not_text_gives_none(self) -> None:
        for value in (None, 5, ["http://a.test/"], b"http://a.test/"):
            with self.subTest(value=value):
                self.assertIsNone(seo_common.safe_urlsplit(value))  # type: ignore[arg-type]


class FileHelperTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.folder = Path(self._tmp.name)

    def test_write_json_creates_parent_folders_and_ends_with_a_newline(self) -> None:
        target = self.folder / "a" / "b" / "data.json"
        seo_common.write_json_file(target, {"b": 1, "a": "é"})
        text = target.read_text(encoding="utf-8")
        self.assertTrue(text.endswith("\n"))
        self.assertEqual(seo_common.read_json_file(target), {"b": 1, "a": "é"})

    def test_write_text_and_bytes_create_parent_folders(self) -> None:
        seo_common.write_text_file(self.folder / "x" / "t.txt", "hello")
        seo_common.write_bytes_file(self.folder / "y" / "b.bin", b"\x00\x01")
        self.assertEqual((self.folder / "x" / "t.txt").read_text(), "hello")
        self.assertEqual((self.folder / "y" / "b.bin").read_bytes(), b"\x00\x01")

    def test_read_json_reports_invalid_json_with_the_file_name(self) -> None:
        bad = self.folder / "bad.json"
        bad.write_text("{not json", encoding="utf-8")
        with self.assertRaises(SeoToolError) as caught:
            seo_common.read_json_file(bad)
        self.assertIn("bad.json", str(caught.exception))

    def test_read_json_turns_every_json_failure_into_a_tool_error(self) -> None:
        """Deep nesting raises RecursionError and, from Python 3.11, a huge integer raises ValueError."""
        for label, text in (("deep nesting", "[" * 100_000 + "]" * 100_000), ("5000-digit integer", '{"n": ' + "1" * 5000 + "}")):
            bad = self.folder / "hostile.json"
            bad.write_text(text, encoding="utf-8")
            with self.subTest(label=label):
                try:
                    seo_common.read_json_file(bad)
                except SeoToolError as error:
                    self.assertIn("hostile.json", str(error))

    def test_read_text_replaces_undecodable_bytes_instead_of_failing(self) -> None:
        odd = self.folder / "odd.html"
        odd.write_bytes(b"caf\xe9 <b>ok</b>")
        self.assertIn("ok", seo_common.read_text_file(odd))

    def test_read_bytes_returns_the_exact_bytes_and_reports_a_missing_file(self) -> None:
        raw = self.folder / "raw.bin"
        raw.write_bytes(b"\x1f\x8b\x00caf\xe9")
        self.assertEqual(seo_common.read_bytes_file(raw), b"\x1f\x8b\x00caf\xe9")
        with self.assertRaises(SeoToolError):
            seo_common.read_bytes_file(self.folder / "nope.bin")

    def test_read_text_reports_a_missing_file(self) -> None:
        with self.assertRaises(SeoToolError):
            seo_common.read_text_file(self.folder / "nope.txt")

    def test_write_failure_becomes_a_tool_error(self) -> None:
        blocker = self.folder / "file"
        blocker.write_text("x", encoding="utf-8")
        with self.assertRaises(SeoToolError):
            seo_common.write_text_file(blocker / "child.txt", "data")


class LogAndCliTests(unittest.TestCase):
    def test_log_goes_to_stderr_with_a_prefix(self) -> None:
        with captured() as (out, err):
            seo_common.log("hello")
        self.assertEqual(out.getvalue(), "")
        self.assertEqual(err.getvalue(), "[seo] hello\n")

    def test_run_cli_returns_the_exit_code_of_the_tool(self) -> None:
        self.assertEqual(seo_common.run_cli(lambda argv: 7, ["x"]), 7)

    def test_run_cli_passes_the_arguments_through(self) -> None:
        seen = []
        seo_common.run_cli(lambda argv: seen.append(list(argv)) or 0, ["a", "b"])
        self.assertEqual(seen, [["a", "b"]])

    def test_run_cli_prints_a_tool_error_without_a_traceback_and_exits_2(self) -> None:
        def failing(argv):
            raise SeoToolError("something the user can fix")

        with captured() as (out, err):
            code = seo_common.run_cli(failing, [])
        self.assertEqual(code, 2)
        self.assertIn("something the user can fix", err.getvalue())
        self.assertNotIn("Traceback", err.getvalue())
        self.assertEqual(out.getvalue(), "")

    def test_a_tool_error_can_carry_its_own_exit_code(self) -> None:
        class Seat(SeoToolError):
            exit_code = 76

        def failing(argv):
            raise Seat("seat taken")

        with captured():
            self.assertEqual(seo_common.run_cli(failing, []), 76)

    def test_run_cli_reports_an_interrupt_with_exit_130(self) -> None:
        def interrupted(argv):
            raise KeyboardInterrupt

        with captured() as (_, err):
            self.assertEqual(seo_common.run_cli(interrupted, []), 130)
        self.assertIn("interrupted", err.getvalue())

    def test_run_cli_turns_an_unexpected_error_into_one_line_and_exit_1(self) -> None:
        def broken(argv):
            raise ZeroDivisionError("bug")

        with captured() as (out, err):
            code = seo_common.run_cli(broken, [])
        self.assertEqual(code, 1)
        self.assertEqual(err.getvalue(), "[seo] error: ZeroDivisionError: bug\n")
        self.assertEqual(out.getvalue(), "")

    def test_the_last_resort_covers_the_errors_hostile_input_causes(self) -> None:
        for error in (ValueError("Invalid IPv6 URL"), OverflowError("int too large"), RecursionError("too deep")):
            with self.subTest(error=type(error).__name__):
                def broken(argv, error=error):
                    raise error

                with captured() as (_, err):
                    code = seo_common.run_cli(broken, [])
                self.assertEqual(code, 1)
                self.assertNotIn("Traceback", err.getvalue())
                self.assertEqual(len(err.getvalue().splitlines()), 1)

    def test_a_long_or_multi_line_message_stays_on_one_short_line(self) -> None:
        def broken(argv):
            raise ValueError("first line\nsecond line " + "x" * 2000)

        with captured() as (_, err):
            seo_common.run_cli(broken, [])
        self.assertEqual(len(err.getvalue().splitlines()), 1)
        self.assertLess(len(err.getvalue()), 400)

    def test_seo_debug_lets_the_traceback_through_for_people_fixing_a_bug(self) -> None:
        def broken(argv):
            raise ZeroDivisionError("bug")

        with mock.patch.dict(os.environ, {seo_common.DEBUG_ENV: "1"}), self.assertRaises(ZeroDivisionError):
            seo_common.run_cli(broken, [])


class ArgumentTypeTests(unittest.TestCase):
    def test_non_negative_float(self) -> None:
        self.assertEqual(seo_common.non_negative_float("0"), 0.0)
        self.assertEqual(seo_common.non_negative_float("2.5"), 2.5)
        for bad in ("-1", "abc", "nan", "inf"):
            with self.subTest(value=bad), self.assertRaises(argparse.ArgumentTypeError):
                seo_common.non_negative_float(bad)

    def test_positive_int(self) -> None:
        self.assertEqual(seo_common.positive_int("3"), 3)
        for bad in ("0", "-2", "1.5", "x"):
            with self.subTest(value=bad), self.assertRaises(argparse.ArgumentTypeError):
                seo_common.positive_int(bad)


if __name__ == "__main__":
    unittest.main()
