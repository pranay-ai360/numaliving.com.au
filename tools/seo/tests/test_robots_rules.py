"""Tests for the robots.txt parser and matcher (RFC 9309), which the tool carries itself.

Python's own urllib.robotparser behaves differently on every release (first match instead of longest match,
no wildcards before 3.14, a byte order mark hides the first group), so these tests run on every interpreter.
"""

from __future__ import annotations

import math
import time
import unittest
from typing import Union

import helpers  # noqa: F401  (puts tools/seo on sys.path)
import robots_rules  # noqa: E402
from robots_rules import RobotsRules, UnusableRobots, parse_robots, pattern_matches, request_target  # noqa: E402


def rules_of(text: Union[str, bytes]) -> RobotsRules:
    return parse_robots(text.encode("utf-8") if isinstance(text, str) else text)


def star(*lines: str) -> RobotsRules:
    return rules_of("User-agent: *\n" + "\n".join(lines) + "\n")


class GroupTests(unittest.TestCase):
    def test_only_the_star_group_applies(self) -> None:
        rules = rules_of("User-agent: Googlebot\nDisallow: /g/\n\nUser-agent: *\nDisallow: /s/\n")
        self.assertTrue(rules.allows("/g/a"))
        self.assertFalse(rules.allows("/s/a"))

    def test_a_file_without_a_star_group_allows_everything(self) -> None:
        rules = rules_of("User-agent: BadBot\nDisallow: /\n")
        self.assertTrue(rules.allows("/anything"))
        self.assertEqual(rules.crawl_delay, 0.0)

    def test_consecutive_user_agent_lines_share_one_group(self) -> None:
        rules = rules_of("User-agent: bingbot\nUser-agent: *\nDisallow: /x\n")
        self.assertFalse(rules.allows("/x"))

    def test_a_user_agent_line_after_rules_starts_a_new_group(self) -> None:
        rules = rules_of("User-agent: a\nDisallow: /a\nUser-agent: *\nDisallow: /b\n")
        self.assertTrue(rules.allows("/a"))
        self.assertFalse(rules.allows("/b"))

    def test_two_star_groups_are_merged(self) -> None:
        rules = rules_of("User-agent: *\nDisallow: /one\n\nUser-agent: other\nDisallow: /two\n\nUser-agent: *\nDisallow: /three\n")
        self.assertEqual([rules.allows(path) for path in ("/one", "/two", "/three")], [False, True, False])

    def test_field_names_are_not_case_sensitive(self) -> None:
        rules = rules_of("USER-AGENT: *\nDISALLOW: /x\nallow: /x/ok\n")
        self.assertFalse(rules.allows("/x/no"))
        self.assertTrue(rules.allows("/x/ok"))

    def test_rules_before_any_user_agent_line_are_ignored(self) -> None:
        rules = rules_of("Disallow: /x\nUser-agent: *\nDisallow: /y\n")
        self.assertTrue(rules.allows("/x"))
        self.assertFalse(rules.allows("/y"))

    def test_comments_blank_lines_and_other_fields_do_not_matter(self) -> None:
        text = "# hello\nSitemap: https://a.test/s.xml\nUser-agent: * # everyone\n\nHost: a.test\nDisallow: /x # no\n"
        self.assertFalse(rules_of(text).allows("/x"))

    def test_line_endings_may_be_lf_crlf_or_cr(self) -> None:
        for newline in ("\n", "\r\n", "\r"):
            with self.subTest(newline=repr(newline)):
                rules = rules_of(f"User-agent: *{newline}Disallow: /x{newline}")
                self.assertFalse(rules.allows("/x"))

    def test_a_line_that_is_not_a_field_is_skipped(self) -> None:
        rules = rules_of("User-agent: *\nthis line has no colon\nDisallow: /x\n")
        self.assertFalse(rules.allows("/x"))


class MatchingTests(unittest.TestCase):
    def test_a_rule_matches_the_start_of_the_path(self) -> None:
        rules = star("Disallow: /private")
        self.assertEqual(
            [rules.allows(path) for path in ("/private", "/private/x", "/privateer", "/public", "/a/private")],
            [False, False, False, True, True],
        )

    def test_paths_are_case_sensitive(self) -> None:
        rules = star("Disallow: /Private")
        self.assertTrue(rules.allows("/private"))
        self.assertFalse(rules.allows("/Private/x"))

    def test_an_allow_all_rule_listed_first_does_not_hide_a_longer_disallow(self) -> None:
        rules = star("Allow: /", "Disallow: /private/")
        self.assertFalse(rules.allows("/private/secret"))
        self.assertTrue(rules.allows("/public"))

    def test_the_longest_matching_rule_wins_whatever_the_order(self) -> None:
        for lines in (("Disallow: /a", "Allow: /a/b/"), ("Allow: /a/b/", "Disallow: /a")):
            with self.subTest(lines=lines):
                rules = star(*lines)
                self.assertTrue(rules.allows("/a/b/c"))
                self.assertFalse(rules.allows("/a/x"))

    def test_an_allow_beats_a_disallow_of_the_same_length(self) -> None:
        for lines in (("Disallow: /page", "Allow: /page"), ("Allow: /page", "Disallow: /page")):
            with self.subTest(lines=lines):
                self.assertTrue(star(*lines).allows("/page"))

    def test_an_empty_disallow_allows_everything_and_an_empty_allow_is_ignored(self) -> None:
        self.assertTrue(star("Disallow:").allows("/anything"))
        rules = star("Disallow: /a", "Allow:")
        self.assertFalse(rules.allows("/a"))

    def test_a_lone_slash_blocks_everything(self) -> None:
        rules = star("Disallow: /")
        self.assertFalse(rules.allows("/"))
        self.assertFalse(rules.allows("/a/b?c=d"))

    def test_star_matches_any_run_of_characters_including_none(self) -> None:
        rules = star("Disallow: /private*", "Disallow: /*/draft")
        self.assertFalse(rules.allows("/private"))
        self.assertFalse(rules.allows("/private-area/x"))
        self.assertFalse(rules.allows("/blog/draft"))
        self.assertFalse(rules.allows("/a/b/draft/c"))
        self.assertTrue(rules.allows("/blog/final"))

    def test_a_trailing_dollar_anchors_the_end_of_the_target(self) -> None:
        rules = star("Disallow: /*.pdf$")
        self.assertFalse(rules.allows("/a.pdf"))
        self.assertFalse(rules.allows("/dir/b.pdf"))
        self.assertFalse(rules.allows("/.pdf"))
        self.assertTrue(rules.allows("/a.pdfx"))
        self.assertTrue(rules.allows("/a.pdf?x=1"))  # the query is part of what is matched

    def test_a_dollar_inside_a_rule_is_an_ordinary_character(self) -> None:
        rules = star("Disallow: /a$b")
        self.assertFalse(rules.allows("/a$b/x"))
        self.assertTrue(rules.allows("/a"))

    def test_the_query_string_is_part_of_the_target(self) -> None:
        rules = star("Disallow: /*?session=")
        self.assertFalse(rules.allows("/page?session=abc"))
        self.assertTrue(rules.allows("/page"))
        self.assertTrue(rules.allows("/page?x=1"))
        self.assertTrue(rules.allows("/page?x=1&session=abc"))  # the rule says "?session=", not "&session="

    def test_a_star_then_question_mark_blocks_every_url_with_a_query(self) -> None:
        rules = star("Disallow: /*?")
        self.assertFalse(rules.allows("/p?utm=1"))
        self.assertTrue(rules.allows("/p"))

    def test_an_anchored_rule_needs_its_ending_after_the_earlier_parts(self) -> None:
        rules = star("Disallow: /a*a$")
        self.assertTrue(rules.allows("/a"))  # one "a" cannot serve as both the start and the end
        self.assertFalse(rules.allows("/aa"))
        self.assertFalse(rules.allows("/abca"))

    def test_percent_escapes_are_compared_in_their_normal_form(self) -> None:
        rules = star("Disallow: /caf%c3%a9", "Disallow: /%7Efoo", "Disallow: /a%2Fb")
        self.assertFalse(rules.allows("/caf%C3%A9/menu"))
        self.assertFalse(rules.allows("/~foo"))
        self.assertFalse(rules.allows("/a%2fb"))  # a reserved character stays escaped, with upper-case hex
        self.assertTrue(rules.allows("/a/b"))

    def test_raw_non_ascii_text_matches_its_percent_encoded_form(self) -> None:
        rules = star("Disallow: /café/")
        self.assertFalse(rules.allows("/caf%C3%A9/x"))
        self.assertFalse(rules.allows("/café/x"))
        self.assertTrue(rules.allows("/cafe/x"))

    def test_many_stars_do_not_cause_catastrophic_backtracking(self) -> None:
        pattern = "/" + "a*" * 60 + "b"
        started = time.perf_counter()
        self.assertFalse(pattern_matches(pattern, "/" + "a" * 6000))
        self.assertLess(time.perf_counter() - started, 1.0)

    def test_pattern_matches_directly(self) -> None:
        self.assertTrue(pattern_matches("/a", "/abc"))
        self.assertTrue(pattern_matches("/a*c", "/abxc/d"))
        self.assertFalse(pattern_matches("/a*c$", "/abxc/d"))
        self.assertTrue(pattern_matches("*", "/anything"))
        self.assertTrue(pattern_matches("/a$", "/a"))
        self.assertFalse(pattern_matches("/a$", "/ab"))


class CrawlDelayTests(unittest.TestCase):
    def delay(self, value: str) -> float:
        return rules_of(f"User-agent: *\nCrawl-delay: {value}\nDisallow: /x\n").crawl_delay

    def test_whole_and_decimal_numbers_are_read(self) -> None:
        self.assertEqual(self.delay("10"), 10.0)
        self.assertEqual(self.delay("2.5"), 2.5)
        self.assertEqual(self.delay(".5"), 0.5)
        self.assertEqual(self.delay("5."), 5.0)
        self.assertEqual(self.delay("0"), 0.0)

    def test_anything_else_is_ignored(self) -> None:
        for value in ("soon", "²", "٥", "1e3", "-1", "", "1,5", "inf", "nan", "2 seconds", "0x10"):
            with self.subTest(value=value):
                self.assertEqual(self.delay(value), 0.0)

    def test_a_huge_number_does_not_raise_and_reads_as_very_long(self) -> None:
        for digits in (400, 5000):
            with self.subTest(digits=digits):
                delay = self.delay("9" * digits)
                self.assertTrue(math.isfinite(delay))
                self.assertGreater(delay, 1_000_000)

    def test_only_the_star_group_counts(self) -> None:
        rules = rules_of("User-agent: bot\nCrawl-delay: 30\n\nUser-agent: *\nCrawl-delay: 2\n")
        self.assertEqual(rules.crawl_delay, 2.0)

    def test_the_longest_of_several_delays_is_kept(self) -> None:
        self.assertEqual(rules_of("User-agent: *\nCrawl-delay: 3\nCrawl-delay: 8\nCrawl-delay: 5\n").crawl_delay, 8.0)

    def test_a_delay_before_any_user_agent_line_is_ignored(self) -> None:
        self.assertEqual(rules_of("Crawl-delay: 9\nUser-agent: *\n").crawl_delay, 0.0)


class DecodingTests(unittest.TestCase):
    def test_a_utf8_byte_order_mark_does_not_hide_the_first_group(self) -> None:
        for text in (b"\xef\xbb\xbfUser-agent: *\nDisallow: /secret/\n", "﻿User-agent: *\nDisallow: /secret/\n"):
            with self.subTest(kind=type(text).__name__):
                self.assertFalse(rules_of(text).allows("/secret/a"))

    def test_bytes_that_are_not_utf8_are_replaced_not_fatal(self) -> None:
        rules = rules_of(b"User-agent: *\nDisallow: /caf\xe9/\nDisallow: /other\n")
        self.assertFalse(rules.allows("/other"))

    def test_utf16_and_utf32_files_cannot_be_trusted(self) -> None:
        text = "User-agent: *\nDisallow: /\n"
        for label, body in (
            ("utf-16 with BOM", text.encode("utf-16")),
            ("utf-16-le without BOM", text.encode("utf-16-le")),
            ("utf-16-be without BOM", text.encode("utf-16-be")),
            ("utf-32 with BOM", text.encode("utf-32")),
        ):
            with self.subTest(label=label), self.assertRaises(UnusableRobots):
                parse_robots(body)

    def test_a_nul_byte_anywhere_makes_the_file_untrustworthy(self) -> None:
        with self.assertRaises(UnusableRobots):
            parse_robots(b"User-agent: *\nDisallow: /x\x00y\n")

    def test_only_the_first_part_of_a_very_large_file_is_read(self) -> None:
        padding = b"# " + b"x" * 100 + b"\n"
        body = b"User-agent: *\nDisallow: /early\n" + padding * 6000 + b"Disallow: /late\n"
        self.assertGreater(len(body), robots_rules.MAX_ROBOTS_BYTES)
        rules = parse_robots(body)
        self.assertFalse(rules.allows("/early"))
        self.assertTrue(rules.allows("/late"))

    def test_a_very_long_rule_is_cut_but_still_blocks_what_it_started_to_describe(self) -> None:
        rules = star("Disallow: /" + "a" * 5000)
        self.assertFalse(rules.allows("/" + "a" * 5000))


class RequestTargetTests(unittest.TestCase):
    def test_path_and_query_without_the_fragment(self) -> None:
        self.assertEqual(request_target("https://a.test/x/y?z=1#top"), "/x/y?z=1")

    def test_an_empty_path_is_a_slash(self) -> None:
        self.assertEqual(request_target("https://a.test"), "/")
        self.assertEqual(request_target("https://a.test?x=1"), "/?x=1")

    def test_an_unparseable_url_falls_back_to_the_root(self) -> None:
        self.assertEqual(request_target("http://[::1/"), "/")


if __name__ == "__main__":
    unittest.main()
