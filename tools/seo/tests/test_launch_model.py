"""Tests for the launch check's vocabulary: the site being checked, the address mapping and the check results."""

from __future__ import annotations

import dataclasses
import unittest
from typing import List

from launch_support import ORIGIN

import launch_model  # noqa: E402
from launch_model import CheckResult, Failure, Site  # noqa: E402
from seo_common import SeoToolError  # noqa: E402

LOCAL = "http://127.0.0.1:4573"


def live_site(base: str = ORIGIN + "/", canonical: str = ORIGIN) -> Site:
    return Site.create(base, canonical, "live")


class SiteCreationTests(unittest.TestCase):
    def test_the_base_url_always_ends_in_a_slash_and_has_a_lower_case_host(self) -> None:
        self.assertEqual(Site.create("https://NumaLiving.us", ORIGIN, "live").base_url, "https://numaliving.us/")
        self.assertEqual(Site.create("http://127.0.0.1:4573/", ORIGIN, "preview").base_url, LOCAL + "/")

    def test_a_base_path_is_kept(self) -> None:
        site = Site.create("https://user.github.io/numaliving.com.au", ORIGIN, "preview")
        self.assertEqual((site.base_url, site.base_path), ("https://user.github.io/numaliving.com.au/", "/numaliving.com.au/"))

    def test_the_canonical_host_is_an_origin_without_a_trailing_slash(self) -> None:
        self.assertEqual(live_site(canonical=ORIGIN + "/").canonical_origin, ORIGIN)
        self.assertEqual(live_site(canonical="HTTPS://NumaLiving.us").canonical_origin, ORIGIN)

    def test_the_canonical_host_may_not_have_a_path_query_or_fragment(self) -> None:
        for bad in (ORIGIN + "/about/", ORIGIN + "/?a=1", ORIGIN + "/#top"):
            with self.subTest(canonical=bad), self.assertRaises(SeoToolError) as caught:
                live_site(canonical=bad)
            self.assertIn("--canonical-host", str(caught.exception))

    def test_a_base_url_with_a_query_or_fragment_is_refused(self) -> None:
        for bad in (ORIGIN + "/?a=1", ORIGIN + "/#top"):
            with self.subTest(base=bad), self.assertRaises(SeoToolError) as caught:
                live_site(base=bad)
            self.assertIn("--base-url", str(caught.exception))

    def test_only_web_addresses_with_a_host_and_no_password_are_accepted(self) -> None:
        for bad in ("file:///etc/hosts", "ftp://numaliving.us/", "numaliving.us", "https://user:pw@numaliving.us/", ""):
            with self.subTest(base=bad), self.assertRaises(SeoToolError):
                live_site(base=bad)
        with self.assertRaises(SeoToolError):
            live_site(canonical="javascript:alert(1)")

    def test_an_unknown_mode_is_refused(self) -> None:
        with self.assertRaises(SeoToolError) as caught:
            Site.create(ORIGIN, ORIGIN, "staging")
        self.assertIn("preview", str(caught.exception))

    def test_the_site_is_immutable(self) -> None:
        with self.assertRaises(dataclasses.FrozenInstanceError):
            live_site().mode = "preview"  # type: ignore[misc]


class SitePathTests(unittest.TestCase):
    def test_the_path_of_an_address_on_the_site(self) -> None:
        site = live_site()
        self.assertEqual(site.path_of(ORIGIN + "/"), "/")
        self.assertEqual(site.path_of(ORIGIN), "/")
        self.assertEqual(site.path_of(ORIGIN + "/about/"), "/about/")
        self.assertEqual(site.path_of(ORIGIN + "/about/?a=1#top"), "/about/")

    def test_a_base_path_is_taken_off(self) -> None:
        site = Site.create("https://user.github.io/repo/", ORIGIN, "live")
        self.assertEqual(site.path_of("https://user.github.io/repo/"), "/")
        self.assertEqual(site.path_of("https://user.github.io/repo/about/"), "/about/")
        self.assertEqual(site.path_of("https://user.github.io/elsewhere/"), "/elsewhere/")

    def test_an_address_that_cannot_be_read_is_the_root(self) -> None:
        self.assertEqual(live_site().path_of("http://[::1/x"), "/")

    def test_the_canonical_address_of_a_page_names_the_canonical_host_and_the_path(self) -> None:
        site = Site.create(LOCAL + "/", ORIGIN, "live")
        self.assertEqual(site.canonical_of(LOCAL + "/"), ORIGIN + "/")
        self.assertEqual(site.canonical_of(LOCAL + "/about/?utm=1"), ORIGIN + "/about/")

    def test_url_for_joins_a_site_path_to_the_base(self) -> None:
        self.assertEqual(live_site().url_for("/robots.txt"), ORIGIN + "/robots.txt")
        site = Site.create("https://user.github.io/repo/", ORIGIN, "live")
        self.assertEqual(site.url_for("/robots.txt"), "https://user.github.io/repo/robots.txt")


class SiteMappingTests(unittest.TestCase):
    def test_an_address_on_the_canonical_host_is_fetched_from_the_base(self) -> None:
        site = Site.create(LOCAL + "/", ORIGIN, "live")
        self.assertEqual(site.fetch_url(ORIGIN + "/og/home.jpg"), LOCAL + "/og/home.jpg")
        self.assertEqual(site.fetch_url(ORIGIN + "/a/?b=1"), LOCAL + "/a/?b=1")
        self.assertEqual(site.fetch_url(ORIGIN), LOCAL + "/")

    def test_other_addresses_are_left_alone(self) -> None:
        site = Site.create(LOCAL + "/", ORIGIN, "live")
        for url in (LOCAL + "/x/", "https://cdn.example.test/x.jpg", "/relative.jpg", "http://[::1/x"):
            with self.subTest(url=url):
                self.assertEqual(site.fetch_url(url), url)

    def test_with_the_same_origin_nothing_changes(self) -> None:
        self.assertEqual(live_site().fetch_url(ORIGIN + "/x/"), ORIGIN + "/x/")

    def test_a_base_path_is_put_in_front_of_the_mapped_path(self) -> None:
        site = Site.create("http://127.0.0.1:4573/repo/", ORIGIN, "live")
        self.assertEqual(site.fetch_url(ORIGIN + "/about/"), LOCAL + "/repo/about/")

    def test_with_one_origin_a_base_path_does_not_move_the_canonical_addresses(self) -> None:
        site = Site.create("https://user.github.io/repo/", "https://user.github.io", "live")
        self.assertEqual(site.fetch_url("https://user.github.io/repo/about/"), "https://user.github.io/repo/about/")
        self.assertEqual(site.fetch_url("https://user.github.io/about/"), "https://user.github.io/about/")

    def test_the_host_comparison_ignores_case(self) -> None:
        site = Site.create(LOCAL + "/", ORIGIN, "live")
        self.assertEqual(site.fetch_url("HTTPS://NUMALIVING.US/x/"), LOCAL + "/x/")

    def test_is_own_means_the_base_origin_or_the_canonical_origin(self) -> None:
        site = Site.create(LOCAL + "/", ORIGIN, "live")
        self.assertTrue(site.is_own(LOCAL + "/x/"))
        self.assertTrue(site.is_own(ORIGIN + "/x/"))
        self.assertFalse(site.is_own("https://www.numaliving.us/x/"))
        self.assertFalse(site.is_own("https://other.example.test/"))
        self.assertFalse(site.is_own("http://[::1/x"))

    def test_the_transport_is_the_live_one_only_when_the_base_is_the_https_canonical_host(self) -> None:
        self.assertTrue(live_site().is_canonical_https)
        self.assertFalse(Site.create(LOCAL + "/", ORIGIN, "live").is_canonical_https)
        self.assertFalse(Site.create("http://numaliving.us/", "http://numaliving.us", "live").is_canonical_https)

    def test_the_www_form_of_the_canonical_host(self) -> None:
        self.assertEqual(live_site().www_origin, "https://www.numaliving.us")
        self.assertEqual(live_site(canonical="https://www.numaliving.us", base="https://www.numaliving.us/").www_origin, "")
        self.assertEqual(Site.create(LOCAL + "/", LOCAL, "live").www_origin, "")


class NoindexExpectationTests(unittest.TestCase):
    def test_a_preview_expects_noindex_on_every_page(self) -> None:
        site = Site.create(ORIGIN, ORIGIN, "preview")
        self.assertTrue(site.expects_noindex("/"))
        self.assertTrue(site.expects_noindex("/about/"))

    def test_a_live_site_expects_noindex_on_the_login_page_only(self) -> None:
        site = live_site()
        self.assertTrue(site.expects_noindex(launch_model.LOGIN_PATH))
        self.assertFalse(site.expects_noindex("/"))
        self.assertFalse(site.expects_noindex("/about/"))


class ResultTests(unittest.TestCase):
    def test_a_passing_result_has_no_failures(self) -> None:
        result = launch_model.passing("canonical", launch_model.PAGE_SCOPE, "every page names its canonical", "14 pages")
        self.assertEqual((result.status, result.failures, result.summary), ("PASS", (), "14 pages"))

    def test_a_failing_result_keeps_its_failures_in_order(self) -> None:
        failures = (Failure("https://a.test/", "first"), Failure("https://a.test/b/", "second"))
        result = launch_model.failing("canonical", launch_model.PAGE_SCOPE, "title", failures, "2 of 3 pages")
        self.assertEqual((result.status, result.failures), ("FAIL", failures))

    def test_a_skipped_result_gives_its_reason(self) -> None:
        result = launch_model.skipped("redirect-https", launch_model.SITE_SCOPE, "title", "not the https canonical host")
        self.assertEqual((result.status, result.summary), ("SKIP", "not the https canonical host"))

    def test_results_are_immutable(self) -> None:
        result: CheckResult = launch_model.passing("x", launch_model.SITE_SCOPE, "t", "s")
        with self.assertRaises(dataclasses.FrozenInstanceError):
            result.status = "FAIL"  # type: ignore[misc]


class CountedTests(unittest.TestCase):
    def test_one_is_singular_and_anything_else_is_plural(self) -> None:
        self.assertEqual(launch_model.counted(1, "page"), "1 page")
        self.assertEqual(launch_model.counted(0, "page"), "0 pages")
        self.assertEqual(launch_model.counted(2, "page"), "2 pages")

    def test_an_irregular_plural_can_be_given(self) -> None:
        self.assertEqual(launch_model.counted(1, "address", "addresses"), "1 address")
        self.assertEqual(launch_model.counted(3, "address", "addresses"), "3 addresses")


class ListedTests(unittest.TestCase):
    def test_up_to_three_items_are_all_shown(self) -> None:
        self.assertEqual(launch_model.listed([], "; "), "")
        self.assertEqual(launch_model.listed(["a"], "; "), "a")
        self.assertEqual(launch_model.listed(["a", "b", "c"], ", "), "a, b, c")

    def test_more_than_three_are_cut_and_counted(self) -> None:
        self.assertEqual(launch_model.listed(["a", "b", "c", "d"], "; "), "a; b; c (+1 more)")
        self.assertEqual(launch_model.listed(list("abcdefgh"), ", "), "a, b, c (+5 more)")


class JudgeTests(unittest.TestCase):
    def judge(self, subjects: List[str], noun: str = "page") -> CheckResult:
        def test(subject: str) -> str:
            return "too short" if len(subject) < 3 else ""

        return launch_model.judge("length", launch_model.PAGE_SCOPE, "long enough", subjects, test, lambda s: f"https://a.test/{s}", noun)

    def test_all_good_subjects_pass_and_are_counted(self) -> None:
        result = self.judge(["abc", "abcd"])
        self.assertEqual((result.status, result.summary), ("PASS", "2 pages"))

    def test_each_bad_subject_becomes_a_failure_with_its_address(self) -> None:
        result = self.judge(["abc", "a", "bc"])
        self.assertEqual(result.status, "FAIL")
        self.assertEqual(result.failures, (Failure("https://a.test/a", "too short"), Failure("https://a.test/bc", "too short")))
        self.assertEqual(result.summary, "2 of 3 pages")

    def test_the_noun_comes_from_the_caller_and_is_made_plural_unless_there_is_one(self) -> None:
        self.assertEqual(self.judge(["abc"], "inner page").summary, "1 inner page")
        self.assertEqual(self.judge(["abc", "abc"], "inner page").summary, "2 inner pages")
        self.assertEqual(self.judge(["abc", "a"], "image").summary, "1 of 2 images")
        self.assertEqual(self.judge(["a"], "image").summary, "1 of 1 image")

    def test_nothing_to_judge_is_a_skip_not_a_pass(self) -> None:
        result = self.judge([])
        self.assertEqual(result.status, "SKIP")
        self.assertIn("no pages", result.summary)


if __name__ == "__main__":
    unittest.main()
