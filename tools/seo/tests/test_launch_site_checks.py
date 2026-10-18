"""Tests for the site-level checks of the launch check: /index.html, the 404 page, the login page, the share images,
the http and www redirects, and whether the crawl got through the whole site."""

from __future__ import annotations

import unittest
from typing import Dict

from launch_support import FakeWeb, MISSING_PAGE_PATH, ORIGIN, build_web, edit_page, launch_text

import launch_page_checks  # noqa: E402
import launch_site_checks  # noqa: E402
from launch_crawl import crawl_site  # noqa: E402
from launch_model import CheckResult, Site  # noqa: E402

LOCAL = "http://127.0.0.1:4573"
HOME, ABOUT, PROJECTS, CONTACT, LOGIN = (f"{ORIGIN}{path}" for path in ("/", "/about/", "/projects/", "/contact/", "/login/"))
INDEX_URL = ORIGIN + "/index.html"
MISSING_URL = ORIGIN + MISSING_PAGE_PATH
IDS = (
    "index-html-canonical", "missing-page-404", "login-noindex", "share-images", "redirect-https", "redirect-www",
    "crawl-complete",
)
HTTP_HOME = "http://numaliving.us/"
WWW_HOME = "https://www.numaliving.us/"


def run_checks(web: FakeWeb, mode: str = "live", base: str = ORIGIN, max_pages: int = 60) -> Dict[str, CheckResult]:
    site = Site.create(base + "/", ORIGIN, mode)
    crawl = crawl_site(site, web, [site.base_url], max_pages)
    views = launch_page_checks.build_views(site, crawl)
    return {result.id: result for result in launch_site_checks.site_checks(site, web, crawl, views)}


def failures_of(result: CheckResult) -> Dict[str, str]:
    return {failure.url: failure.message for failure in result.failures}


class GoodSiteTests(unittest.TestCase):
    def test_the_good_live_site_passes_every_site_check_in_order(self) -> None:
        results = run_checks(build_web())
        self.assertEqual(tuple(results), IDS)
        self.assertEqual({result.status for result in results.values()}, {"PASS"}, results)

    def test_the_good_preview_site_passes_too(self) -> None:
        results = run_checks(build_web(mode="preview"), "preview")
        self.assertEqual({result.status for result in results.values()}, {"PASS"}, results)

    def test_a_local_copy_passes_except_for_the_two_redirects_that_only_the_real_host_has(self) -> None:
        results = run_checks(build_web(LOCAL), base=LOCAL)
        self.assertEqual({check_id for check_id, result in results.items() if result.status == "SKIP"}, {"redirect-https", "redirect-www"})
        self.assertEqual({result.status for check_id, result in results.items() if not check_id.startswith("redirect")}, {"PASS"})

    def test_every_result_is_a_site_check_with_a_title(self) -> None:
        for result in run_checks(build_web()).values():
            self.assertEqual(result.scope, "site")
            self.assertTrue(result.title)


class IndexHtmlTests(unittest.TestCase):
    def test_index_html_that_names_the_home_page_as_canonical_passes(self) -> None:
        self.assertEqual(run_checks(build_web())["index-html-canonical"].summary, "the canonical link names the home page")

    def test_index_html_without_a_canonical_fails(self) -> None:
        web = build_web()
        edit_page(web, INDEX_URL, '<link rel="canonical" href="https://numaliving.us/"/>', "")
        self.assertEqual(failures_of(run_checks(web)["index-html-canonical"]), {INDEX_URL: "no canonical link"})

    def test_index_html_that_is_its_own_canonical_fails(self) -> None:
        web = build_web()
        edit_page(web, INDEX_URL, 'href="https://numaliving.us/"/>\n<meta property="og:title"', 'href="https://numaliving.us/index.html"/>\n<meta property="og:title"')
        self.assertEqual(failures_of(run_checks(web)["index-html-canonical"]),
                         {INDEX_URL: f"canonical is {ORIGIN}/index.html, expected {ORIGIN}/"})

    def test_a_host_that_has_no_index_html_has_no_second_copy_to_worry_about(self) -> None:
        result = run_checks(build_web().remove(INDEX_URL))["index-html-canonical"]
        self.assertEqual((result.status, result.summary), ("PASS", "answers 404, so there is no second copy of the home page"))

    def test_a_redirect_to_the_home_page_is_fine(self) -> None:
        self.assertEqual(run_checks(build_web().redirect(INDEX_URL, HOME))["index-html-canonical"].status, "PASS")

    def test_a_server_error_fails(self) -> None:
        self.assertEqual(failures_of(run_checks(build_web().add(INDEX_URL, "oops", status=500))["index-html-canonical"]), {INDEX_URL: "HTTP 500"})

    def test_a_fetch_error_fails_with_the_reason(self) -> None:
        self.assertEqual(failures_of(run_checks(build_web().add(INDEX_URL, error="timed out"))["index-html-canonical"]), {INDEX_URL: "timed out"})

    def test_a_file_that_is_not_html_fails(self) -> None:
        web = build_web().add(INDEX_URL, "plain", content_type="text/plain")
        self.assertIn("not an HTML page", failures_of(run_checks(web)["index-html-canonical"])[INDEX_URL])

    def test_a_local_copy_must_name_the_canonical_host_home_page(self) -> None:
        self.assertEqual(run_checks(build_web(LOCAL), base=LOCAL)["index-html-canonical"].status, "PASS")


class MissingPageTests(unittest.TestCase):
    def missing_failures(self, web: FakeWeb, mode: str = "live") -> Dict[str, str]:
        return failures_of(run_checks(web, mode)["missing-page-404"])

    def test_a_404_page_with_noindex_and_its_own_title_passes_in_both_modes(self) -> None:
        for mode in ("live", "preview"):
            with self.subTest(mode=mode):
                self.assertEqual(run_checks(build_web(mode=mode), mode)["missing-page-404"].status, "PASS")

    def test_the_request_goes_to_a_path_nothing_can_live_at(self) -> None:
        web = build_web()
        run_checks(web)
        self.assertIn(MISSING_URL, web.requests)
        self.assertTrue(MISSING_PAGE_PATH.startswith("/launch-check-missing-page-"))

    def test_a_missing_page_that_answers_200_fails(self) -> None:
        web = build_web().add(MISSING_URL, launch_text("not-found.html"), status=200)
        self.assertIn("answers HTTP 200, expected 404", self.missing_failures(web)[MISSING_URL])

    def test_a_missing_page_that_redirects_to_the_home_page_fails(self) -> None:
        web = build_web().redirect(MISSING_URL, HOME)
        self.assertIn("answers HTTP 200, expected 404", self.missing_failures(web)[MISSING_URL])

    def test_a_404_page_that_is_indexable_fails(self) -> None:
        web = build_web().add(MISSING_URL, launch_text("not-found.html").replace('<meta name="robots" content="noindex, nofollow"/>', ""), status=404)
        self.assertIn("indexable", self.missing_failures(web)[MISSING_URL])

    def test_a_404_page_that_is_noindex_by_header_alone_passes(self) -> None:
        html = launch_text("not-found.html").replace('<meta name="robots" content="noindex, nofollow"/>', "")
        web = build_web().add(MISSING_URL, html, status=404, headers=(("x-robots-tag", "noindex"),))
        self.assertEqual(run_checks(web)["missing-page-404"].status, "PASS")

    def test_a_404_page_without_a_title_fails(self) -> None:
        web = build_web().add(MISSING_URL, launch_text("not-found.html").replace("<title>Page Not Found | Numa Living</title>", ""), status=404)
        self.assertEqual(self.missing_failures(web), {MISSING_URL: "the 404 page has no title"})

    def test_a_404_page_with_the_title_of_a_real_page_fails_and_names_that_page(self) -> None:
        html = launch_text("not-found.html").replace("Page Not Found | Numa Living", "  about the MILLWORK factory | numa living ")
        failures = self.missing_failures(build_web().add(MISSING_URL, html, status=404))
        self.assertEqual(failures, {MISSING_URL: f"the 404 page has the same title as {ABOUT}; it needs its own"})

    def test_a_plain_text_404_fails_because_it_is_not_a_page(self) -> None:
        web = build_web().remove(MISSING_URL)
        self.assertEqual(self.missing_failures(web), {MISSING_URL: "the 404 answer is not an HTML page"})

    def test_a_fetch_error_fails_with_the_reason(self) -> None:
        self.assertEqual(self.missing_failures(build_web().add(MISSING_URL, error="timed out")), {MISSING_URL: "timed out"})

    def test_a_robots_block_is_reported_as_it_is(self) -> None:
        web = build_web().add(MISSING_URL, skipped="robots.txt disallows this URL")
        self.assertEqual(self.missing_failures(web), {MISSING_URL: "robots.txt disallows this URL"})


class LoginTests(unittest.TestCase):
    def test_a_noindex_login_page_passes_in_both_modes_and_is_not_fetched_twice(self) -> None:
        for mode in ("live", "preview"):
            with self.subTest(mode=mode):
                web = build_web(mode=mode)
                self.assertEqual(run_checks(web, mode)["login-noindex"].status, "PASS")
                self.assertEqual(web.count(LOGIN), 1)

    def test_an_indexable_login_page_fails_in_both_modes(self) -> None:
        for mode in ("live", "preview"):
            with self.subTest(mode=mode):
                web = build_web(mode=mode)
                text = web.body_of(LOGIN).replace("noindex, nofollow", "index, follow")
                failures = failures_of(run_checks(web.add(LOGIN, text), mode)["login-noindex"])
                self.assertEqual(failures, {LOGIN: "the login page is indexable (robots: index, follow)"})

    def test_a_login_page_the_crawl_did_not_reach_is_fetched_by_the_check(self) -> None:
        web = build_web()
        results = run_checks(web, max_pages=1)
        self.assertEqual(results["login-noindex"].status, "PASS")
        self.assertEqual(web.count(LOGIN), 1)

    def test_a_noindex_header_is_enough(self) -> None:
        web = build_web()
        web.add(LOGIN, web.body_of(LOGIN).replace('<meta name="robots" content="noindex, nofollow"/>', ""), headers=(("x-robots-tag", "noindex"),))
        self.assertEqual(run_checks(web)["login-noindex"].status, "PASS")

    def test_a_site_without_a_login_page_has_nothing_to_keep_out(self) -> None:
        result = run_checks(build_web().remove(LOGIN))["login-noindex"]
        self.assertEqual(result.status, "SKIP")
        self.assertIn("/login/ answers 404", result.summary)

    def test_a_login_page_that_cannot_be_fetched_fails_with_the_reason(self) -> None:
        self.assertEqual(failures_of(run_checks(build_web().add(LOGIN, error="timed out"))["login-noindex"]), {LOGIN: "timed out"})

    def test_a_login_address_that_is_not_html_fails(self) -> None:
        web = build_web().add(LOGIN, "{}", content_type="application/json")
        self.assertIn("not an HTML page", failures_of(run_checks(web)["login-noindex"])[LOGIN])


class ShareImageTests(unittest.TestCase):
    def image_failures(self, web: FakeWeb, base: str = ORIGIN) -> Dict[str, str]:
        return failures_of(run_checks(web, base=base)["share-images"])

    def test_the_good_site_has_two_share_images_each_fetched_once(self) -> None:
        web = build_web()
        result = run_checks(web)["share-images"]
        self.assertEqual((result.status, result.summary), ("PASS", "2 image URLs"))
        self.assertEqual((web.count(ORIGIN + "/og/home.jpg"), web.count(ORIGIN + "/og/default.jpg")), (1, 1))

    def test_a_share_image_that_is_missing_fails_and_names_the_page_that_uses_it(self) -> None:
        web = build_web().remove(ORIGIN + "/og/home.jpg")
        self.assertEqual(self.image_failures(web), {ORIGIN + "/og/home.jpg": f"HTTP 404 (used by {HOME})"})

    def test_a_share_image_served_as_html_fails(self) -> None:
        web = build_web().add(ORIGIN + "/og/default.jpg", "<html>login</html>", content_type="text/html; charset=utf-8")
        failures = self.image_failures(web)
        self.assertEqual(sorted(failures), [ORIGIN + "/og/default.jpg"])
        self.assertTrue(failures[ORIGIN + "/og/default.jpg"].startswith("content type is text/html, expected image/*"))

    def test_a_share_image_without_a_content_type_fails(self) -> None:
        web = build_web().add(ORIGIN + "/og/home.jpg", b"bytes", content_type="")
        self.assertIn("content type is missing", self.image_failures(web)[ORIGIN + "/og/home.jpg"])

    def test_every_image_type_is_accepted(self) -> None:
        for kind in ("image/png", "image/webp", "image/avif", "image/svg+xml", "IMAGE/JPEG; charset=binary"):
            with self.subTest(kind=kind):
                web = build_web().add(ORIGIN + "/og/home.jpg", b"bytes", content_type=kind)
                self.assertEqual(self.image_failures(web), {})

    def test_an_empty_share_image_fails(self) -> None:
        web = build_web().add(ORIGIN + "/og/home.jpg", b"", content_type="image/jpeg")
        self.assertIn("the image is empty", self.image_failures(web)[ORIGIN + "/og/home.jpg"])

    def test_a_twitter_image_of_its_own_is_checked_too(self) -> None:
        web = edit_page(build_web(), ABOUT, '<meta name="twitter:image" content="https://numaliving.us/og/default.jpg"/>',
                        '<meta name="twitter:image" content="https://numaliving.us/og/about-card.jpg"/>')
        self.assertEqual(self.image_failures(web), {ORIGIN + "/og/about-card.jpg": f"HTTP 404 (used by {ABOUT})"})

    def test_a_relative_address_fails(self) -> None:
        web = edit_page(build_web(), ABOUT, 'content="https://numaliving.us/og/default.jpg"/>\n<meta property="og:type"', 'content="/og/default.jpg"/>\n<meta property="og:type"')
        self.assertEqual(self.image_failures(web), {"/og/default.jpg": f"not an absolute URL (used by {ABOUT})"})

    def test_an_image_on_another_host_is_not_requested(self) -> None:
        web = edit_page(build_web(), ABOUT, 'content="https://numaliving.us/og/default.jpg"/>\n<meta property="og:type"',
                        'content="https://cdn.example.test/a.jpg"/>\n<meta property="og:type"')
        failures = self.image_failures(web)
        self.assertIn("on another host", failures["https://cdn.example.test/a.jpg"])
        self.assertNotIn("https://cdn.example.test/a.jpg", web.requests)

    def test_a_local_copy_reads_the_images_from_the_base_url(self) -> None:
        web = build_web(LOCAL)
        self.assertEqual(self.image_failures(web, LOCAL), {})
        self.assertIn(LOCAL + "/og/home.jpg", web.requests)
        self.assertNotIn(ORIGIN + "/og/home.jpg", web.requests)

    def test_a_bad_image_used_by_many_pages_names_a_few(self) -> None:
        failures = self.image_failures(build_web().remove(ORIGIN + "/og/default.jpg"))
        self.assertEqual(failures, {ORIGIN + "/og/default.jpg": f"HTTP 404 (used by {ABOUT}, {PROJECTS}, {CONTACT} (+1 more))"})

    def test_a_site_with_no_share_images_has_nothing_to_check(self) -> None:
        web = build_web()
        for url in (HOME, ABOUT, PROJECTS, CONTACT, LOGIN):
            text = "\n".join(line for line in web.body_of(url).splitlines() if "og:image" not in line and "twitter:image" not in line)
            web.add(url, text)
        result = run_checks(web)["share-images"]
        self.assertEqual((result.status, result.summary), ("SKIP", "no image URLs to check"))


class RedirectTests(unittest.TestCase):
    def redirect_failures(self, web: FakeWeb, check_id: str, mode: str = "live") -> Dict[str, str]:
        return failures_of(run_checks(web, mode)[check_id])

    def test_one_permanent_hop_each_passes(self) -> None:
        results = run_checks(build_web())
        self.assertEqual((results["redirect-https"].status, results["redirect-www"].status), ("PASS", "PASS"))

    def test_a_308_is_permanent_too(self) -> None:
        web = build_web().redirect(HTTP_HOME, HOME, 308)
        self.assertEqual(run_checks(web)["redirect-https"].status, "PASS")

    def test_the_checks_belong_to_the_host_not_to_the_mode(self) -> None:
        results = run_checks(build_web(mode="preview"), "preview")
        self.assertEqual((results["redirect-https"].status, results["redirect-www"].status), ("PASS", "PASS"))

    def test_http_that_is_served_without_a_redirect_fails(self) -> None:
        web = build_web().add(HTTP_HOME, "<title>x</title>")
        self.assertEqual(self.redirect_failures(web, "redirect-https"),
                         {HTTP_HOME: f"answers HTTP 200 without redirecting; expected a permanent redirect to {HOME}"})

    def test_two_redirects_in_a_row_fail(self) -> None:
        web = build_web().redirect(HTTP_HOME, WWW_HOME)
        message = self.redirect_failures(web, "redirect-https")[HTTP_HOME]
        self.assertEqual(message, f"2 redirects in a row ({HTTP_HOME} > {WWW_HOME} > {HOME}); one is allowed")

    def test_a_temporary_redirect_fails(self) -> None:
        for status in (302, 307):
            with self.subTest(status=status):
                web = build_web().redirect(WWW_HOME, HOME, status)
                self.assertEqual(self.redirect_failures(web, "redirect-www"),
                                 {WWW_HOME: f"redirects with HTTP {status}, which is temporary; use 301 or 308"})

    def test_a_redirect_to_the_wrong_page_fails(self) -> None:
        web = build_web().redirect(HTTP_HOME, ABOUT)
        self.assertEqual(self.redirect_failures(web, "redirect-https"), {HTTP_HOME: f"redirects to {ABOUT}, expected {HOME}"})

    def test_a_redirect_that_lands_on_a_page_that_is_missing_fails(self) -> None:
        web = build_web().redirect(WWW_HOME, ORIGIN + "/", 301).remove(HOME)
        self.assertIn("HTTP 404", self.redirect_failures(web, "redirect-www")[WWW_HOME])

    def test_a_www_name_that_does_not_answer_fails_with_the_reason(self) -> None:
        web = build_web().add(WWW_HOME, error="could not resolve the host")
        self.assertEqual(self.redirect_failures(web, "redirect-www"), {WWW_HOME: "could not resolve the host"})

    def test_a_local_copy_skips_both_and_says_why(self) -> None:
        results = run_checks(build_web(LOCAL), base=LOCAL)
        for check_id in ("redirect-https", "redirect-www"):
            self.assertEqual(results[check_id].status, "SKIP")
            self.assertIn("not the https canonical host", results[check_id].summary)

    def test_a_canonical_host_that_is_already_www_has_no_www_check(self) -> None:
        site = Site.create("https://www.numaliving.us/", "https://www.numaliving.us", "live")
        web = FakeWeb()
        results = {r.id: r for r in launch_site_checks.redirect_checks(site, web)}
        self.assertEqual(results["redirect-www"].status, "SKIP")
        self.assertIn("no www form", results["redirect-www"].summary)
        self.assertEqual(web.requests, ["http://www.numaliving.us/"])


class CrawlCompleteTests(unittest.TestCase):
    def test_a_crawl_that_reached_everything_passes(self) -> None:
        result = run_checks(build_web())["crawl-complete"]
        self.assertEqual((result.status, result.summary), ("PASS", "5 fetched, none left over"))

    def test_a_crawl_that_stopped_at_the_limit_fails_and_lists_what_it_left(self) -> None:
        result = run_checks(build_web(), max_pages=2)["crawl-complete"]
        self.assertEqual(result.status, "FAIL")
        self.assertEqual(result.summary, "3 found but not fetched")
        self.assertEqual(set(failures_of(result)), {PROJECTS, CONTACT, LOGIN})
        self.assertTrue(all("stopped after 2 addresses" in message and "--max-pages" in message for message in failures_of(result).values()))

    def test_only_the_first_fifty_are_listed_but_all_are_counted(self) -> None:
        links = "".join(f'<a href="/p{number}/">p</a>' for number in range(200))
        web = build_web()
        edit_page(web, HOME, '<a href="/about/">About</a>', links + '<a href="/about/">About</a>')
        result = run_checks(web, max_pages=3)["crawl-complete"]
        self.assertEqual(len(result.failures), 50)
        self.assertEqual(result.summary, "202 found but not fetched")


if __name__ == "__main__":
    unittest.main()
