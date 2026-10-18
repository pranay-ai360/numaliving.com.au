"""Tests for the robots.txt and sitemap.xml checks of the launch check, over the hand-written good site with one
fault put in at a time. Both modes are covered: a live site opens itself to search engines, a preview does not."""

from __future__ import annotations

import unittest
from typing import Dict, List, Optional, Tuple

from launch_support import FakeWeb, ORIGIN, build_web, launch_text, swap

import launch_documents  # noqa: E402
import launch_page_checks  # noqa: E402
from fetch_pages import FetchResult  # noqa: E402
from launch_crawl import crawl_site  # noqa: E402
from launch_model import CheckResult, Site  # noqa: E402

LOCAL = "http://127.0.0.1:4573"
ROBOTS_URL = ORIGIN + "/robots.txt"
SITEMAP_URL = ORIGIN + "/sitemap.xml"
HOME, ABOUT, PROJECTS, CONTACT, LOGIN = (f"{ORIGIN}{path}" for path in ("/", "/about/", "/projects/", "/contact/", "/login/"))
ROBOTS_IDS = ("robots-txt",)
LIVE_SITEMAP_IDS = ("sitemap-valid", "sitemap-locations", "sitemap-duplicates", "sitemap-lastmod", "sitemap-no-noindex", "sitemap-complete")
PREVIEW_SITEMAP_IDS = ("sitemap-valid", "sitemap-empty")
SITEMAP_ROW = '<url><loc>https://numaliving.us/contact/</loc><lastmod>2026-10-18</lastmod></url>\n'


def run_checks(web: FakeWeb, mode: str = "live", base: str = ORIGIN) -> Dict[str, CheckResult]:
    site = Site.create(base + "/", ORIGIN, mode)
    documents = launch_documents.fetch_documents(site, web)
    crawl = crawl_site(site, web, [site.base_url, *launch_documents.sitemap_seeds(site, documents)], 60)
    views = launch_page_checks.build_views(site, crawl)
    return {result.id: result for result in launch_documents.document_checks(site, documents, views)}


def failures_of(result: CheckResult) -> Dict[str, str]:
    return {failure.url: failure.message for failure in result.failures}


def with_robots(text: str, mode: str = "live") -> Dict[str, CheckResult]:
    return run_checks(build_web(mode=mode).add(ROBOTS_URL, text, content_type="text/plain"), mode)


def with_sitemap(text: str, mode: str = "live") -> Dict[str, CheckResult]:
    return run_checks(build_web(mode=mode).add(SITEMAP_URL, text, content_type="application/xml"), mode)


def live_sitemap(*rows: str) -> str:
    return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "".join(rows) + "</urlset>"


def row(loc: str, lastmod: Optional[str] = "2026-10-18") -> str:
    return f"<url><loc>{loc}</loc>" + (f"<lastmod>{lastmod}</lastmod>" if lastmod is not None else "") + "</url>"


def all_rows(*skip: str, lastmod: str = "2026-10-18") -> Tuple[str, ...]:
    return tuple(row(ORIGIN + path, lastmod) for path in ("/", "/about/", "/projects/", "/contact/") if path not in skip)


class GoodSiteTests(unittest.TestCase):
    def test_the_good_live_site_passes_every_document_check_in_order(self) -> None:
        results = run_checks(build_web())
        self.assertEqual(tuple(results), ROBOTS_IDS + LIVE_SITEMAP_IDS)
        self.assertEqual({result.status for result in results.values()}, {"PASS"}, results)

    def test_the_good_preview_site_passes_with_an_empty_sitemap(self) -> None:
        results = run_checks(build_web(mode="preview"), "preview")
        self.assertEqual(tuple(results), ROBOTS_IDS + PREVIEW_SITEMAP_IDS)
        self.assertEqual({result.status for result in results.values()}, {"PASS"}, results)

    def test_the_results_are_site_checks_with_titles(self) -> None:
        for result in run_checks(build_web()).values():
            self.assertEqual(result.scope, "site")
            self.assertTrue(result.title)

    def test_a_local_copy_names_the_canonical_host_in_both_files_and_passes(self) -> None:
        results = run_checks(build_web(LOCAL), base=LOCAL)
        self.assertEqual({result.status for result in results.values()}, {"PASS"}, results)


class FetchTests(unittest.TestCase):
    def test_both_documents_are_fetched_from_the_base_url(self) -> None:
        web = build_web(LOCAL)
        documents = launch_documents.fetch_documents(Site.create(LOCAL + "/", ORIGIN, "live"), web)
        self.assertEqual(web.requests, [LOCAL + "/robots.txt", LOCAL + "/sitemap.xml"])
        self.assertEqual((documents.robots.status, documents.sitemap.status), (200, 200))

    def test_the_sitemap_entries_are_read_once(self) -> None:
        documents = launch_documents.fetch_documents(Site.create(ORIGIN + "/", ORIGIN, "live"), build_web())
        assert documents.entries is not None
        self.assertEqual([entry.loc for entry in documents.entries], [ORIGIN + path for path in ("/", "/about/", "/projects/", "/contact/")])
        self.assertEqual(documents.sitemap_problem, "")

    def test_an_unusable_sitemap_has_no_entries_and_says_why(self) -> None:
        documents = launch_documents.fetch_documents(Site.create(ORIGIN + "/", ORIGIN, "live"), FakeWeb())
        self.assertIsNone(documents.entries)
        self.assertEqual(documents.sitemap_problem, "HTTP 404")


class SeedTests(unittest.TestCase):
    def seeds(self, web: FakeWeb, mode: str = "live", base: str = ORIGIN) -> List[str]:
        site = Site.create(base + "/", ORIGIN, mode)
        return list(launch_documents.sitemap_seeds(site, launch_documents.fetch_documents(site, web)))

    def test_a_live_site_is_crawled_from_its_sitemap_too(self) -> None:
        self.assertEqual(self.seeds(build_web()), [ORIGIN + path for path in ("/", "/about/", "/projects/", "/contact/")])

    def test_a_local_copy_reads_the_pages_from_the_base_url(self) -> None:
        self.assertEqual(self.seeds(build_web(LOCAL), base=LOCAL)[:2], [LOCAL + "/", LOCAL + "/about/"])

    def test_a_preview_sitemap_gives_no_seeds(self) -> None:
        self.assertEqual(self.seeds(build_web(mode="preview"), "preview"), [])

    def test_an_unusable_sitemap_gives_no_seeds(self) -> None:
        self.assertEqual(self.seeds(FakeWeb()), [])

    def test_addresses_on_other_hosts_are_never_seeds(self) -> None:
        sitemap = live_sitemap(row("https://elsewhere.example.test/x/"), row(ORIGIN + "/about/"), row("not a url"))
        web = build_web().add(SITEMAP_URL, sitemap, content_type="application/xml")
        self.assertEqual(self.seeds(web), [ORIGIN + "/about/"])


class RobotsTests(unittest.TestCase):
    EXPECTED = "Sitemap: https://numaliving.us/sitemap.xml"

    def test_a_missing_robots_txt_fails_in_both_modes(self) -> None:
        for mode in ("live", "preview"):
            with self.subTest(mode=mode):
                web = build_web(mode=mode).remove(ROBOTS_URL)
                self.assertEqual(failures_of(run_checks(web, mode)["robots-txt"]), {ROBOTS_URL: "HTTP 404"})

    def test_a_robots_txt_that_cannot_be_fetched_fails_with_the_reason(self) -> None:
        web = build_web().add(ROBOTS_URL, error="timed out")
        self.assertEqual(failures_of(run_checks(web)["robots-txt"]), {ROBOTS_URL: "timed out"})

    def test_a_live_site_needs_a_sitemap_line(self) -> None:
        failures = failures_of(with_robots("User-agent: *\nAllow: /\n")["robots-txt"])
        self.assertEqual(failures, {ROBOTS_URL: f"no Sitemap line (expected {self.EXPECTED})"})

    def test_the_sitemap_line_must_point_at_the_canonical_sitemap(self) -> None:
        for wrong in ("http://numaliving.us/sitemap.xml", "https://www.numaliving.us/sitemap.xml", "https://numaliving.us/sitemap.xml?x=1",
                      "https://example.test/sitemap.xml", "/sitemap.xml"):
            with self.subTest(line=wrong):
                failures = failures_of(with_robots(f"User-agent: *\nAllow: /\nSitemap: {wrong}\n")["robots-txt"])
                self.assertEqual(failures, {ROBOTS_URL: f"Sitemap line is {wrong}, expected https://numaliving.us/sitemap.xml"})

    def test_two_sitemap_lines_fail_even_when_one_is_right(self) -> None:
        failures = failures_of(with_robots(f"User-agent: *\nAllow: /\n{self.EXPECTED}\nSitemap: https://numaliving.us/other.xml\n")["robots-txt"])
        self.assertIn("2 Sitemap lines", failures[ROBOTS_URL])

    def test_the_sitemap_line_is_found_whatever_its_case_spacing_or_comments(self) -> None:
        text = "# robots\nUSER-AGENT: *\nallow : /\n\nSITEMAP :   https://numaliving.us/sitemap.xml   # the sitemap\n"
        self.assertEqual(with_robots(text)["robots-txt"].status, "PASS")

    def test_a_byte_order_mark_does_not_hide_the_first_line(self) -> None:
        web = build_web().add(ROBOTS_URL, b"\xef\xbb\xbf" + launch_text("robots-live.txt").encode(), content_type="text/plain")
        self.assertEqual(run_checks(web)["robots-txt"].status, "PASS")

    def test_a_blanket_disallow_for_every_crawler_fails_a_live_site(self) -> None:
        for rule in ("Disallow: /", "Disallow: /*", "disallow:/"):
            with self.subTest(rule=rule):
                failures = failures_of(with_robots(f"User-agent: *\n{rule}\n{self.EXPECTED}\n")["robots-txt"])
                self.assertEqual(failures, {ROBOTS_URL: "disallows the whole site for *"})

    def test_a_blanket_disallow_for_googlebot_or_bingbot_fails_too(self) -> None:
        text = f"User-agent: Googlebot\nUser-agent: Bingbot\nDisallow: /\n\nUser-agent: *\nAllow: /\n{self.EXPECTED}\n"
        self.assertEqual(failures_of(with_robots(text)["robots-txt"]), {ROBOTS_URL: "disallows the whole site for googlebot, bingbot"})

    def test_other_crawlers_may_be_shut_out_and_paths_may_be_disallowed(self) -> None:
        text = f"User-agent: SemrushBot\nDisallow: /\n\nUser-agent: *\nDisallow: /private/\nDisallow:\n{self.EXPECTED}\n"
        self.assertEqual(with_robots(text)["robots-txt"].status, "PASS")

    def test_a_disallow_in_a_later_group_does_not_belong_to_an_earlier_agent(self) -> None:
        text = f"User-agent: *\nAllow: /\n\nUser-agent: other\nDisallow: /\n{self.EXPECTED}\n"
        self.assertEqual(with_robots(text)["robots-txt"].status, "PASS")

    def test_a_preview_must_not_have_a_sitemap_line(self) -> None:
        failures = failures_of(with_robots(f"User-agent: *\nAllow: /\n{self.EXPECTED}\n", "preview")["robots-txt"])
        self.assertEqual(failures, {ROBOTS_URL: "has a Sitemap line (https://numaliving.us/sitemap.xml) while the site is noindex"})

    def test_a_preview_may_say_what_it_likes_about_disallow(self) -> None:
        self.assertEqual(with_robots("User-agent: *\nDisallow: /\n", "preview")["robots-txt"].status, "PASS")

    def test_every_problem_is_listed_separately(self) -> None:
        failures = with_robots("User-agent: *\nDisallow: /\nSitemap: https://example.test/s.xml\n")["robots-txt"].failures
        self.assertEqual(len(failures), 2)


class SitemapValidTests(unittest.TestCase):
    def valid_failures(self, web: FakeWeb, mode: str = "live") -> Dict[str, str]:
        return failures_of(run_checks(web, mode)["sitemap-valid"])

    def test_a_missing_sitemap_fails_and_the_checks_that_need_it_are_skipped(self) -> None:
        results = run_checks(build_web().remove(SITEMAP_URL))
        self.assertEqual(failures_of(results["sitemap-valid"]), {SITEMAP_URL: "HTTP 404"})
        for check_id in LIVE_SITEMAP_IDS[1:]:
            with self.subTest(check=check_id):
                self.assertEqual(results[check_id].status, "SKIP")
                self.assertIn("sitemap.xml is not usable", results[check_id].summary)

    def test_a_sitemap_that_cannot_be_fetched_fails_with_the_reason(self) -> None:
        self.assertEqual(self.valid_failures(build_web().add(SITEMAP_URL, error="timed out")), {SITEMAP_URL: "timed out"})

    def test_invalid_xml_fails_and_names_the_file(self) -> None:
        message = self.valid_failures(build_web().add(SITEMAP_URL, "<urlset><url>", content_type="application/xml"))[SITEMAP_URL]
        self.assertIn("not valid XML", message)

    def test_an_html_page_served_as_the_sitemap_fails(self) -> None:
        message = self.valid_failures(build_web().add(SITEMAP_URL, "<html><body>Not found</body></html>"))[SITEMAP_URL]
        self.assertIn("not a sitemap", message)

    def test_a_doctype_is_refused_before_parsing(self) -> None:
        bomb = '<?xml version="1.0"?><!DOCTYPE urlset [<!ENTITY a "aaaa">]><urlset><url><loc>&a;</loc></url></urlset>'
        self.assertIn("DOCTYPE", self.valid_failures(build_web().add(SITEMAP_URL, bomb, content_type="application/xml"))[SITEMAP_URL])

    def test_a_sitemap_index_fails_because_the_check_reads_one_file(self) -> None:
        index = '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://numaliving.us/s1.xml</loc></sitemap></sitemapindex>'
        self.assertIn("sitemap index", self.valid_failures(build_web().add(SITEMAP_URL, index, content_type="application/xml"))[SITEMAP_URL])

    def test_a_sitemap_that_ends_on_another_site_fails(self) -> None:
        web = build_web().redirect(SITEMAP_URL, "https://elsewhere.example.test/sitemap.xml")
        web.add("https://elsewhere.example.test/sitemap.xml", launch_text("sitemap-live.xml"), content_type="application/xml")
        self.assertIn("ends on another site", self.valid_failures(web)[SITEMAP_URL])

    def test_a_cut_off_sitemap_is_called_a_sitemap_not_a_page(self) -> None:
        site = Site.create(ORIGIN + "/", ORIGIN, "live")
        good = build_web()

        def fetch(url: str) -> FetchResult:
            result = good(url)
            if not url.endswith("/sitemap.xml"):
                return result
            return FetchResult(requested=url, final_url=url, status=200, headers=result.headers, body=result.body, truncated=True)

        documents = launch_documents.fetch_documents(site, fetch)
        self.assertEqual(documents.sitemap_problem, "the sitemap is larger than the download limit")


class PreviewSitemapTests(unittest.TestCase):
    def test_a_preview_sitemap_with_pages_in_it_fails(self) -> None:
        results = with_sitemap(live_sitemap(*all_rows()), "preview")
        self.assertEqual(failures_of(results["sitemap-empty"]), {SITEMAP_URL: "lists 4 URLs while the site is noindex; it must be empty"})

    def test_one_url_is_counted_in_the_singular(self) -> None:
        message = failures_of(with_sitemap(live_sitemap(row(ORIGIN + "/")), "preview")["sitemap-empty"])[SITEMAP_URL]
        self.assertTrue(message.startswith("lists 1 URL while"), message)

    def test_an_unusable_preview_sitemap_skips_the_emptiness_check(self) -> None:
        results = run_checks(build_web(mode="preview").remove(SITEMAP_URL), "preview")
        self.assertEqual((results["sitemap-valid"].status, results["sitemap-empty"].status), ("FAIL", "SKIP"))


class LocationTests(unittest.TestCase):
    def location_failures(self, *rows: str) -> Dict[str, str]:
        return failures_of(with_sitemap(live_sitemap(*rows))["sitemap-locations"])

    def test_a_location_on_another_host_fails(self) -> None:
        failures = self.location_failures(*all_rows(), row("https://example.test/about/"))
        self.assertEqual(failures, {"https://example.test/about/": "must start with https://numaliving.us/"})

    def test_http_www_and_relative_locations_fail(self) -> None:
        wrong = ("http://numaliving.us/about/", "https://www.numaliving.us/about/", "/about/", "about/")
        failures = self.location_failures(*(row(loc) for loc in wrong))
        self.assertEqual(sorted(failures), sorted(wrong))

    def test_a_sitemap_for_the_canonical_host_passes_when_read_from_a_local_copy(self) -> None:
        self.assertEqual(run_checks(build_web(LOCAL), base=LOCAL)["sitemap-locations"].status, "PASS")


class DuplicateTests(unittest.TestCase):
    def test_a_location_listed_twice_fails_once(self) -> None:
        results = with_sitemap(live_sitemap(*all_rows(), row(ORIGIN + "/about/")))
        self.assertEqual(failures_of(results["sitemap-duplicates"]), {ABOUT: "listed 2 times"})

    def test_a_location_listed_three_times_says_so(self) -> None:
        results = with_sitemap(live_sitemap(*all_rows(), row(ORIGIN + "/about/"), row(ORIGIN + "/about/")))
        self.assertEqual(failures_of(results["sitemap-duplicates"]), {ABOUT: "listed 3 times"})

    def test_a_sitemap_without_repeats_passes(self) -> None:
        self.assertEqual(with_sitemap(live_sitemap(*all_rows()))["sitemap-duplicates"].summary, "4 URLs")


class LastmodTests(unittest.TestCase):
    def lastmod_failures(self, value: Optional[str]) -> Dict[str, str]:
        return failures_of(with_sitemap(live_sitemap(*all_rows("/about/"), row(ABOUT, value)))["sitemap-lastmod"])

    def test_a_missing_lastmod_fails(self) -> None:
        self.assertEqual(self.lastmod_failures(None), {ABOUT: "no lastmod"})

    def test_dates_and_date_times_in_iso_8601_pass(self) -> None:
        for value in ("2026-10-18", "2026-10-18T10:30:00Z", "2026-10-18T10:30:00+10:00", "2026-10-18T10:30Z", "2026-10-18T10:30:00.123-05:00"):
            with self.subTest(value=value):
                self.assertEqual(self.lastmod_failures(value), {})

    def test_anything_else_fails_and_is_quoted(self) -> None:
        for value in ("18/10/2026", "2026-10-18 10:30", "2026", "2026-10", "yesterday", "2026-10-18T10:30:00", "2026-1-8"):
            with self.subTest(value=value):
                self.assertEqual(self.lastmod_failures(value), {ABOUT: f"lastmod {value!r} is not an ISO 8601 date (YYYY-MM-DD)"})

    def test_a_date_that_does_not_exist_fails(self) -> None:
        for value in ("2026-02-30", "2026-13-01", "2026-00-10", "2026-10-32"):
            with self.subTest(value=value):
                self.assertEqual(sorted(self.lastmod_failures(value)), [ABOUT])


class NoindexInSitemapTests(unittest.TestCase):
    def test_the_login_page_in_the_sitemap_fails(self) -> None:
        results = with_sitemap(live_sitemap(*all_rows(), row(LOGIN)))
        self.assertEqual(failures_of(results["sitemap-no-noindex"]), {LOGIN: "listed in the sitemap, but the page is noindex (robots: noindex, nofollow)"})

    def test_a_noindex_content_page_in_the_sitemap_fails_and_names_what_robots_says(self) -> None:
        about = swap(launch_text("about.html"), 'content="index, follow"', 'content="noindex, follow"')
        web = build_web().add(ABOUT, about)
        failures = failures_of(run_checks(web)["sitemap-no-noindex"])
        self.assertEqual(failures, {ABOUT: "listed in the sitemap, but the page is noindex (robots: noindex, follow)"})

    def test_a_noindex_header_counts_too(self) -> None:
        web = build_web()
        web.add(ABOUT, web.body_of(ABOUT), headers=(("x-robots-tag", "noindex"),))
        self.assertEqual(sorted(failures_of(run_checks(web)["sitemap-no-noindex"])), [ABOUT])

    def test_the_login_page_must_stay_out_even_if_it_were_indexable(self) -> None:
        login = swap(launch_text("login.html"), 'content="noindex, nofollow"', 'content="index, follow"')
        web = build_web().add(LOGIN, login).add(SITEMAP_URL, live_sitemap(*all_rows(), row(LOGIN)), content_type="application/xml")
        self.assertEqual(failures_of(run_checks(web)["sitemap-no-noindex"]),
                         {LOGIN: "listed in the sitemap, but this page is meant to stay out of the index"})

    def test_a_location_with_no_crawled_page_is_not_judged_here(self) -> None:
        results = with_sitemap(live_sitemap(*all_rows(), row(ORIGIN + "/unknown/")))
        self.assertEqual(results["sitemap-no-noindex"].status, "PASS")

    def test_locations_that_are_not_on_the_site_are_not_judged_here(self) -> None:
        results = with_sitemap(live_sitemap(*all_rows(), row("https://example.test/x/")))
        self.assertEqual(results["sitemap-no-noindex"].status, "PASS")


class CompletenessTests(unittest.TestCase):
    def test_a_page_missing_from_the_sitemap_fails(self) -> None:
        results = with_sitemap(live_sitemap(*all_rows("/contact/")))
        self.assertEqual(failures_of(results["sitemap-complete"]), {CONTACT: "not listed in the sitemap (expected https://numaliving.us/contact/)"})

    def test_the_login_page_need_not_be_listed(self) -> None:
        self.assertNotIn(LOGIN, failures_of(with_sitemap(live_sitemap(*all_rows()))["sitemap-complete"]))

    def test_an_empty_live_sitemap_lists_none_of_the_pages(self) -> None:
        results = with_sitemap(live_sitemap())
        self.assertEqual(sorted(failures_of(results["sitemap-complete"])), sorted([HOME, ABOUT, PROJECTS, CONTACT]))

    def test_a_noindex_page_need_not_be_listed(self) -> None:
        about = swap(launch_text("about.html"), 'content="index, follow"', 'content="noindex, follow"')
        web = build_web().add(ABOUT, about).add(SITEMAP_URL, live_sitemap(*all_rows("/about/")), content_type="application/xml")
        self.assertEqual(run_checks(web)["sitemap-complete"].status, "PASS")

    def test_a_page_found_only_by_crawling_must_be_listed_too(self) -> None:
        web = build_web().add(ORIGIN + "/extra/", launch_text("about.html"))
        web.add(HOME, swap(web.body_of(HOME), '<a href="/about/">About</a>', '<a href="/extra/">E</a><a href="/about/">About</a>'))
        self.assertEqual(sorted(failures_of(run_checks(web)["sitemap-complete"])), [ORIGIN + "/extra/"])

    def test_the_comparison_uses_the_canonical_address_not_the_address_fetched_from(self) -> None:
        results = run_checks(build_web(LOCAL), base=LOCAL)
        self.assertEqual(results["sitemap-complete"].status, "PASS")


if __name__ == "__main__":
    unittest.main()
