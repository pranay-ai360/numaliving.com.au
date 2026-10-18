"""Tests for the sitemap report: parsing, indexes, grouping by path shape, and per-day lastmod counts."""

from __future__ import annotations

import dataclasses
import gzip
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from helpers import FakeOpener, Reply, captured, fixture_bytes, fixture_path

import fetch_pages  # noqa: E402
import sitemap_report  # noqa: E402
from fetch_pages import FetchResult  # noqa: E402
from sitemap_report import SitemapEntry  # noqa: E402
from seo_common import SeoToolError, run_cli  # noqa: E402

PAGES_URL = "https://example.test/sitemap-pages.xml"
POSTS_URL = "https://example.test/sitemap-posts.xml"


def fake_fetch(table, calls=None):
    """A fetch function answering from {url: bytes | FetchResult}; unknown URLs are 404."""

    def fetch(url: str) -> FetchResult:
        if calls is not None:
            calls.append(url)
        reply = table.get(url)
        if isinstance(reply, FetchResult):
            return reply
        if reply is None:
            return FetchResult(requested=url, final_url=url, status=404, body=b"missing")
        return FetchResult(requested=url, final_url=url, status=200, body=reply)

    return fetch


def urlset(*locs_with_dates) -> bytes:
    rows = "".join(
        f"<url><loc>{loc}</loc>" + (f"<lastmod>{date}</lastmod>" if date else "") + "</url>"
        for loc, date in locs_with_dates
    )
    return f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{rows}</urlset>'.encode()


class ParseTests(unittest.TestCase):
    def test_urlset_entries_with_and_without_lastmod(self) -> None:
        sitemap = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "urlset.xml"), "urlset.xml")
        self.assertFalse(sitemap.is_index)
        self.assertEqual(len(sitemap.entries), 8)
        self.assertEqual(sitemap.entries[0], SitemapEntry("https://example.test/", "2026-10-01"))
        self.assertEqual(sitemap.entries[6], SitemapEntry("https://example.test/projects/two/", ""))

    def test_xml_entities_in_urls_are_decoded_and_whitespace_is_trimmed(self) -> None:
        sitemap = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "urlset.xml"), "urlset.xml")
        self.assertEqual(sitemap.entries[7].loc, "https://example.test/projects/three/?a=1&b=2")

    def test_image_locations_are_not_page_urls(self) -> None:
        sitemap = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "urlset.xml"), "urlset.xml")
        self.assertNotIn("https://example.test/img/one.jpg", [entry.loc for entry in sitemap.entries])

    def test_sitemap_index(self) -> None:
        sitemap = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "index.xml"), "index.xml")
        self.assertTrue(sitemap.is_index)
        self.assertEqual([entry.loc for entry in sitemap.entries], [PAGES_URL, POSTS_URL, "https://elsewhere.test/sitemap.xml"])

    def test_gzip_compressed_sitemaps_are_read(self) -> None:
        plain = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "urlset.xml"), "plain")
        packed = sitemap_report.parse_sitemap(gzip.compress(fixture_bytes("sitemaps", "urlset.xml")), "packed.xml.gz")
        self.assertEqual(plain.entries, packed.entries)

    def test_a_gzip_bomb_is_refused(self) -> None:
        bomb = gzip.compress(b"<urlset>" + b" " * 5000 + b"</urlset>")
        with mock.patch.object(sitemap_report, "MAX_SITEMAP_BYTES", 1000), self.assertRaises(SeoToolError) as caught:
            sitemap_report.parse_sitemap(bomb, "bomb.xml.gz")
        self.assertIn("too large", str(caught.exception))

    def test_a_doctype_or_entity_declaration_is_refused(self) -> None:
        with self.assertRaises(SeoToolError) as caught:
            sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "entity-bomb.xml"), "entity-bomb.xml")
        self.assertIn("DOCTYPE", str(caught.exception))

    def test_a_utf8_byte_order_mark_is_accepted(self) -> None:
        sitemap = sitemap_report.parse_sitemap(b"\xef\xbb\xbf" + urlset(("https://a.test/x", "2026-10-01")), "bom.xml")
        self.assertEqual([entry.loc for entry in sitemap.entries], ["https://a.test/x"])

    def test_non_ascii_text_in_a_utf8_sitemap_is_kept(self) -> None:
        sitemap = sitemap_report.parse_sitemap(urlset(("https://a.test/caf\u00e9", "")), "x.xml")
        self.assertEqual(sitemap.entries[0].loc, "https://a.test/caf\u00e9")

    def test_a_declared_encoding_does_not_override_the_utf8_bytes(self) -> None:
        xml = '<?xml version="1.0" encoding="ISO-8859-1"?><urlset><url><loc>https://a.test/x</loc></url></urlset>'
        sitemap = sitemap_report.parse_sitemap(xml.encode("utf-8"), "declared.xml")
        self.assertEqual([entry.loc for entry in sitemap.entries], ["https://a.test/x"])

    def test_invalid_xml_is_a_tool_error_naming_the_source(self) -> None:
        with self.assertRaises(SeoToolError) as caught:
            sitemap_report.parse_sitemap(b"<urlset><url>", "broken.xml")
        self.assertIn("broken.xml", str(caught.exception))

    def test_a_page_that_is_not_a_sitemap_is_a_tool_error(self) -> None:
        with self.assertRaises(SeoToolError) as caught:
            sitemap_report.parse_sitemap(b"<html><body>404</body></html>", "x")
        self.assertIn("not a sitemap", str(caught.exception))

    def test_entries_without_a_loc_are_ignored(self) -> None:
        data = b'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><lastmod>2026-01-01</lastmod></url></urlset>'
        self.assertEqual(sitemap_report.parse_sitemap(data, "x").entries, ())

    def test_a_sitemap_without_a_namespace_is_read(self) -> None:
        sitemap = sitemap_report.parse_sitemap(b"<urlset><url><loc>https://a.test/x</loc></url></urlset>", "x")
        self.assertEqual([entry.loc for entry in sitemap.entries], ["https://a.test/x"])


class EncodingGuardTests(unittest.TestCase):
    """The DOCTYPE/entity guard must see the text the XML parser will see, whatever the byte encoding."""

    def setUp(self) -> None:
        self.bomb = fixture_bytes("sitemaps", "entity-bomb.xml").decode("utf-8")
        patcher = mock.patch.object(sitemap_report.ElementTree, "fromstring", side_effect=AssertionError("parser reached"))
        self.parser = patcher.start()
        self.addCleanup(patcher.stop)

    def declared(self, encoding: str) -> str:
        return self.bomb.replace('<?xml version="1.0"?>', f'<?xml version="1.0" encoding="{encoding}"?>')

    def test_utf16_and_utf32_versions_of_the_entity_bomb_never_reach_the_parser(self) -> None:
        variants = {
            "utf-16 with BOM and declaration": self.declared("UTF-16").encode("utf-16"),
            "utf-16-le without BOM": self.bomb.encode("utf-16-le"),
            "utf-16-be without BOM": self.bomb.encode("utf-16-be"),
            "utf-32 with BOM": self.bomb.encode("utf-32"),
            "utf-16 inside gzip": gzip.compress(self.declared("UTF-16").encode("utf-16")),
        }
        for label, data in variants.items():
            with self.subTest(label=label), self.assertRaises(SeoToolError) as caught:
                sitemap_report.parse_sitemap(data, "bomb.xml")
            self.assertIn("UTF-8", str(caught.exception))
        self.parser.assert_not_called()

    def test_a_nul_byte_means_the_file_is_not_utf8_text(self) -> None:
        with self.assertRaises(SeoToolError) as caught:
            sitemap_report.parse_sitemap(b"<urlset>\x00</urlset>", "nul.xml")
        self.assertIn("UTF-8", str(caught.exception))

    def test_bytes_that_are_not_valid_utf8_are_refused_by_name(self) -> None:
        with self.assertRaises(SeoToolError) as caught:
            sitemap_report.parse_sitemap(b"<urlset><url><loc>https://a.test/caf\xe9</loc></url></urlset>", "latin.xml")
        self.assertIn("latin.xml", str(caught.exception))
        self.assertIn("UTF-8", str(caught.exception))

    def test_the_guard_is_not_fooled_by_case_or_spacing(self) -> None:
        for marker in ("<!doctype urlset []>", "<! DOCTYPE urlset []>", "<!ENTITY x 'y'>", "<!entity x 'y'>"):
            with self.subTest(marker=marker), self.assertRaises(SeoToolError) as caught:
                sitemap_report.parse_sitemap(f"<?xml version='1.0'?>{marker}<urlset/>".encode(), "x.xml")
            self.assertIn("DOCTYPE", str(caught.exception))


class GroupingTests(unittest.TestCase):
    def entries(self):
        return sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "urlset.xml"), "x").entries

    def test_groups_by_first_path_segment_and_depth(self) -> None:
        groups = {(group.segment, group.depth): group.count for group in sitemap_report.group_entries(self.entries())}
        self.assertEqual(groups, {("(home)", 0): 1, ("about", 1): 1, ("resources", 2): 3, ("projects", 2): 3})

    def test_biggest_group_first_then_shallower_then_by_name(self) -> None:
        groups = sitemap_report.group_entries(self.entries())
        self.assertEqual([group.segment for group in groups], ["projects", "resources", "(home)", "about"])

    def test_samples_are_paths_and_limited(self) -> None:
        groups = sitemap_report.group_entries(self.entries(), samples=2)
        resources = next(group for group in groups if group.segment == "resources")
        self.assertEqual(resources.samples, ("/resources/a-b-c", "/resources/d-e-f"))

    def test_trailing_slash_does_not_change_the_depth(self) -> None:
        entries = (SitemapEntry("https://a.test/x/y/", ""), SitemapEntry("https://a.test/x/z", ""))
        groups = sitemap_report.group_entries(entries)
        self.assertEqual([(group.segment, group.depth, group.count) for group in groups], [("x", 2, 2)])


class DailyCountTests(unittest.TestCase):
    def test_counts_per_day_and_undated_entries(self) -> None:
        sitemap = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "urlset.xml"), "x")
        days, undated = sitemap_report.daily_counts(sitemap.entries)
        self.assertEqual(days, (("2026-09-15", 1), ("2026-10-01", 2), ("2026-10-02", 3)))
        self.assertEqual(undated, 2)

    def test_empty_input(self) -> None:
        self.assertEqual(sitemap_report.daily_counts(()), ((), 0))


class HostileAddressTests(unittest.TestCase):
    """A <loc> that urlsplit refuses must not abort the report."""

    HOSTILE = ("http://[", "http://[::1/", "http://a\u2100.test/", "http://\uff0f\uff0fevil.test/")

    def test_grouping_skips_unreadable_addresses(self) -> None:
        entries = tuple(SitemapEntry(url, "") for url in self.HOSTILE) + (SitemapEntry("https://a.test/x/y", ""),)
        groups = sitemap_report.group_entries(entries)
        self.assertEqual([(group.segment, group.depth, group.count) for group in groups], [("x", 2, 1)])

    def test_the_report_counts_them_and_says_they_were_left_out_of_the_groups(self) -> None:
        data = urlset(*[(url, "2026-10-01") for url in self.HOSTILE], ("https://a.test/x/y", "2026-10-02"))
        sitemap = sitemap_report.parse_sitemap(data, "x.xml")
        report = sitemap_report.build_report(sitemap, "x.xml", fake_fetch({}))
        self.assertEqual(report.total_urls, 5)
        self.assertEqual(sum(group.count for group in report.groups), 1)
        self.assertTrue(any("4" in note and "address" in note for note in report.notes), report.notes)
        self.assertIn("5 URLs", sitemap_report.render_report(report))

    def test_main_prints_the_report_for_a_sitemap_with_such_addresses(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "sitemap.xml"
            path.write_bytes(urlset(("http://[", ""), ("https://a.test/ok", "")))
            with captured() as (out, _):
                code = run_cli(sitemap_report.main, [str(path)])
        self.assertEqual(code, 0)
        self.assertIn("2 URLs", out.getvalue())


class PoliteFetcherSettingsTests(unittest.TestCase):
    """main() builds the fetcher itself unless a fetch function is given: check how."""

    URL = "https://example.test/sitemap.xml"

    def settings(self, *flags: str) -> dict:
        with mock.patch.object(sitemap_report, "PoliteFetcher") as fetcher_class, mock.patch.object(sitemap_report, "default_opener"):
            fetcher_class.return_value.fetch = fake_fetch({self.URL: fixture_bytes("sitemaps", "urlset.xml")})
            with captured():
                sitemap_report.main([self.URL, *flags])
        return fetcher_class.call_args.kwargs

    def test_redirects_to_private_addresses_are_refused_by_default(self) -> None:
        self.assertFalse(self.settings()["allow_private_hosts"])

    def test_the_flag_allows_them(self) -> None:
        self.assertTrue(self.settings("--allow-private-hosts")["allow_private_hosts"])

    def test_the_delay_and_the_sitemap_size_limit_are_passed_on(self) -> None:
        settings = self.settings("--delay", "4")
        self.assertEqual((settings["delay"], settings["max_bytes"]), (4.0, sitemap_report.MAX_SITEMAP_BYTES))


class CalendarTests(unittest.TestCase):
    """A lastmod must start with a real calendar day; anything else is "undated", not a day of its own."""

    def test_impossible_dates_are_not_days(self) -> None:
        for value in ("2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "0000-01-01", "2026-10-00"):
            with self.subTest(value=value):
                self.assertEqual(sitemap_report._day_of(value), "")

    def test_real_dates_including_a_leap_day_are_days(self) -> None:
        self.assertEqual(sitemap_report._day_of("2024-02-29"), "2024-02-29")
        self.assertEqual(sitemap_report._day_of("2026-10-18T23:59:59-08:00"), "2026-10-18")

    def test_a_value_that_only_looks_like_a_date_is_undated(self) -> None:
        for value in ("", "2026-10", "20261018", "2026-1-5", "yesterday"):
            with self.subTest(value=value):
                self.assertEqual(sitemap_report._day_of(value), "")

    def test_an_impossible_date_is_counted_as_undated(self) -> None:
        entries = (SitemapEntry("https://a.test/a", "2026-02-30"), SitemapEntry("https://a.test/b", "2026-10-01"))
        days, undated = sitemap_report.daily_counts(entries)
        self.assertEqual((days, undated), ((("2026-10-01", 1),), 1))


class TruncationTests(unittest.TestCase):
    """A sitemap the download cut short must be reported as cut short, not as invalid XML."""

    URL = "https://example.test/sitemap.xml"

    def cut(self, body: bytes = b"<urlset><url><loc>https://a.test/p</loc></url") -> FetchResult:
        return FetchResult(requested=self.URL, final_url=self.URL, status=200, body=body, truncated=True)

    def test_fetch_problem_says_the_download_was_truncated(self) -> None:
        problem = sitemap_report.fetch_problem(self.cut(b"x" * 6_000_000))
        self.assertIn("truncated", problem)
        self.assertIn("6.0 MB", problem)

    def test_a_complete_answer_has_no_problem(self) -> None:
        ok = FetchResult(requested=self.URL, final_url=self.URL, status=200, body=b"<urlset/>")
        self.assertEqual(sitemap_report.fetch_problem(ok), "")

    def test_the_main_sitemap_that_was_cut_off_is_a_tool_error_that_says_so(self) -> None:
        with captured() as (_, err):
            code = run_cli(lambda argv: sitemap_report.main(argv, fetch=lambda url: self.cut()), [self.URL])
        self.assertEqual(code, 2)
        self.assertIn("truncated", err.getvalue())
        self.assertNotIn("not valid XML", err.getvalue())

    def test_a_child_sitemap_that_was_cut_off_is_noted(self) -> None:
        sitemap = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "index.xml"), "index.xml")
        table = {PAGES_URL: self.cut(), POSTS_URL: fixture_bytes("sitemaps", "child-posts.xml")}
        report = sitemap_report.build_report(sitemap, "https://example.test/i.xml", fake_fetch(table))
        self.assertTrue(any(PAGES_URL in note and "truncated" in note for note in report.notes))
        self.assertEqual(report.total_urls, 3)


class SitemapDownloadLimitTests(unittest.TestCase):
    """Sitemaps may be 50 MiB; the page limit (6 MB) must not apply to them."""

    URL = "https://big.test/sitemap.xml"

    def run_main(self, body: bytes):
        routes = {"https://big.test/robots.txt": Reply(404), self.URL: Reply(200, body, {"Content-Type": "application/xml"})}
        with mock.patch.object(sitemap_report, "default_opener", return_value=FakeOpener(routes)), captured() as (out, err):
            code = run_cli(sitemap_report.main, [self.URL, "--delay", "0"])
        return code, out.getvalue(), err.getvalue()

    def big_sitemap(self) -> bytes:
        return urlset(*[(f"https://big.test/p/{n}", "2026-10-01") for n in range(100)])

    def test_a_sitemap_over_the_page_limit_but_within_the_sitemap_limit_is_read(self) -> None:
        body = self.big_sitemap()
        with mock.patch.object(fetch_pages, "MAX_BYTES", 1_000), mock.patch.object(sitemap_report, "MAX_SITEMAP_BYTES", 100_000):
            code, out, _ = self.run_main(body)
        self.assertGreater(len(body), 1_000)
        self.assertEqual(code, 0)
        self.assertIn("100 URLs in 1 sitemap(s)", out)

    def test_a_sitemap_over_the_sitemap_limit_is_reported_as_truncated(self) -> None:
        body = self.big_sitemap()
        with mock.patch.object(fetch_pages, "MAX_BYTES", 1_000), mock.patch.object(sitemap_report, "MAX_SITEMAP_BYTES", 2_000):
            code, _, err = self.run_main(body)
        self.assertEqual(code, 2)
        self.assertIn("truncated", err)


class BuildReportTests(unittest.TestCase):
    def test_a_plain_sitemap_needs_no_fetching(self) -> None:
        sitemap = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "urlset.xml"), "urlset.xml")
        calls = []
        report = sitemap_report.build_report(sitemap, "urlset.xml", fake_fetch({}, calls))
        self.assertEqual(calls, [])
        self.assertEqual(report.total_urls, 8)
        self.assertEqual((report.first_lastmod, report.last_lastmod), ("2026-09-15", "2026-10-02"))
        self.assertEqual(report.sitemap_count, 1)

    def test_an_index_is_followed_for_children_on_the_same_host(self) -> None:
        table = {PAGES_URL: fixture_bytes("sitemaps", "child-pages.xml"), POSTS_URL: fixture_bytes("sitemaps", "child-posts.xml")}
        calls = []
        sitemap = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "index.xml"), PAGES_URL)
        report = sitemap_report.build_report(sitemap, "https://example.test/sitemap.xml", fake_fetch(table, calls))
        self.assertEqual(calls, [PAGES_URL, POSTS_URL])
        self.assertEqual(report.total_urls, 5)
        self.assertEqual(report.sitemap_count, 3)
        self.assertTrue(any("elsewhere.test" in note for note in report.notes))

    def test_a_local_index_file_follows_children_on_the_first_childs_host_only(self) -> None:
        table = {PAGES_URL: fixture_bytes("sitemaps", "child-pages.xml")}
        calls = []
        sitemap = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "index.xml"), "index.xml")
        sitemap_report.build_report(sitemap, "index.xml", fake_fetch(table, calls))
        self.assertNotIn("https://elsewhere.test/sitemap.xml", calls)

    def test_at_most_ten_children_are_followed(self) -> None:
        children = "".join(f"<sitemap><loc>https://example.test/s{n}.xml</loc></sitemap>" for n in range(12))
        index = f'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{children}</sitemapindex>'.encode()
        table = {f"https://example.test/s{n}.xml": urlset((f"https://example.test/p{n}", "2026-10-01")) for n in range(12)}
        calls = []
        sitemap = sitemap_report.parse_sitemap(index, "index.xml")
        report = sitemap_report.build_report(sitemap, "https://example.test/index.xml", fake_fetch(table, calls))
        self.assertEqual(len(calls), sitemap_report.MAX_CHILD_SITEMAPS)
        self.assertEqual(sitemap_report.MAX_CHILD_SITEMAPS, 10)
        self.assertEqual(report.total_urls, 10)
        self.assertTrue(any("12" in note and "10" in note for note in report.notes))

    def test_the_child_limit_can_be_lowered_but_not_raised(self) -> None:
        children = "".join(f"<sitemap><loc>https://example.test/s{n}.xml</loc></sitemap>" for n in range(12))
        index = f"<sitemapindex>{children}</sitemapindex>".encode()
        sitemap = sitemap_report.parse_sitemap(index, "index.xml")
        calls = []
        sitemap_report.build_report(sitemap, "https://example.test/i.xml", fake_fetch({}, calls), max_children=2)
        self.assertEqual(len(calls), 2)
        calls.clear()
        sitemap_report.build_report(sitemap, "https://example.test/i.xml", fake_fetch({}, calls), max_children=99)
        self.assertEqual(len(calls), 10)

    def test_zero_children_only_lists_the_index(self) -> None:
        sitemap = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "index.xml"), "index.xml")
        calls = []
        report = sitemap_report.build_report(sitemap, "https://example.test/i.xml", fake_fetch({}, calls), max_children=0)
        self.assertEqual(calls, [])
        self.assertEqual(report.total_urls, 0)

    def test_a_child_that_cannot_be_fetched_is_noted_and_the_rest_continue(self) -> None:
        table = {PAGES_URL: fixture_bytes("sitemaps", "child-pages.xml")}  # the posts sitemap answers 404
        sitemap = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "index.xml"), "index.xml")
        report = sitemap_report.build_report(sitemap, "https://example.test/i.xml", fake_fetch(table))
        self.assertEqual(report.total_urls, 2)
        self.assertTrue(any(POSTS_URL in note and "404" in note for note in report.notes))

    def test_a_skipped_or_failed_child_is_noted(self) -> None:
        table = {
            PAGES_URL: FetchResult(requested=PAGES_URL, final_url=PAGES_URL, skipped="robots.txt disallows this URL"),
            POSTS_URL: FetchResult(requested=POSTS_URL, final_url=POSTS_URL, error="URLError: down"),
        }
        sitemap = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "index.xml"), "index.xml")
        report = sitemap_report.build_report(sitemap, "https://example.test/i.xml", fake_fetch(table))
        self.assertEqual(report.total_urls, 0)
        self.assertTrue(any("robots.txt" in note for note in report.notes))
        self.assertTrue(any("down" in note for note in report.notes))

    def test_a_nested_index_is_not_followed_further(self) -> None:
        nested = fixture_bytes("sitemaps", "index.xml")
        sitemap = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "index.xml"), "index.xml")
        calls = []
        report = sitemap_report.build_report(
            sitemap, "https://example.test/i.xml", fake_fetch({PAGES_URL: nested, POSTS_URL: nested}, calls)
        )
        self.assertEqual(len(calls), 2)
        self.assertTrue(any("nested" in note for note in report.notes))

    def test_a_child_with_a_non_http_location_is_ignored(self) -> None:
        index = b"<sitemapindex><sitemap><loc>file:///etc/passwd</loc></sitemap></sitemapindex>"
        sitemap = sitemap_report.parse_sitemap(index, "index.xml")
        calls = []
        report = sitemap_report.build_report(sitemap, "index.xml", fake_fetch({}, calls))
        self.assertEqual(calls, [])
        self.assertTrue(any("file:" in note for note in report.notes))


class RenderTests(unittest.TestCase):
    def report(self):
        sitemap = sitemap_report.parse_sitemap(fixture_bytes("sitemaps", "urlset.xml"), "urlset.xml")
        return sitemap_report.build_report(sitemap, "urlset.xml", fake_fetch({}))

    def test_shows_totals_and_the_lastmod_range(self) -> None:
        text = sitemap_report.render_report(self.report())
        self.assertIn("8 URLs in 1 sitemap(s)", text)
        self.assertIn("lastmod range 2026-09-15 .. 2026-10-02", text)
        self.assertIn("2 without a usable lastmod", text)

    def test_shows_groups_with_samples(self) -> None:
        text = sitemap_report.render_report(self.report())
        self.assertIn("resources", text)
        self.assertIn("depth=2", text)
        self.assertIn("/resources/a-b-c", text)

    def test_shows_per_day_counts_with_a_bar_and_the_daily_range(self) -> None:
        text = sitemap_report.render_report(self.report())
        self.assertIn("2026-10-02", text)
        self.assertRegex(text, r"2026-10-02\s+3 #+")
        self.assertIn("per day: min 1, median 2, max 3", text)

    def test_shows_only_the_latest_days_when_asked(self) -> None:
        text = sitemap_report.render_report(self.report(), max_days=1)
        self.assertRegex(text, r"(?m)^\s+2026-10-02\s+3 #")
        self.assertNotRegex(text, r"(?m)^\s+2026-09-15\s+\d")

    def test_notes_are_printed(self) -> None:
        noted = dataclasses.replace(self.report(), notes=("something odd happened",))
        self.assertIn("something odd happened", sitemap_report.render_report(noted))

    def test_a_sitemap_without_dates_says_so(self) -> None:
        sitemap = sitemap_report.parse_sitemap(urlset(("https://a.test/x", "")), "x")
        text = sitemap_report.render_report(sitemap_report.build_report(sitemap, "x", fake_fetch({})))
        self.assertIn("lastmod range - .. -", text)


class MainTests(unittest.TestCase):
    def test_reads_a_local_file(self) -> None:
        with captured() as (out, _):
            code = sitemap_report.main([str(fixture_path("sitemaps", "urlset.xml"))])
        self.assertEqual(code, 0)
        self.assertIn("8 URLs", out.getvalue())

    def test_fetches_a_url_through_the_given_fetch_function(self) -> None:
        url = "https://example.test/sitemap.xml"
        with captured() as (out, _):
            code = sitemap_report.main([url], fetch=fake_fetch({url: fixture_bytes("sitemaps", "urlset.xml")}))
        self.assertEqual(code, 0)
        self.assertIn("8 URLs", out.getvalue())

    def test_follows_an_index_from_a_url(self) -> None:
        url = "https://example.test/sitemap.xml"
        table = {
            url: fixture_bytes("sitemaps", "index.xml"),
            PAGES_URL: fixture_bytes("sitemaps", "child-pages.xml"),
            POSTS_URL: fixture_bytes("sitemaps", "child-posts.xml"),
        }
        with captured() as (out, _):
            sitemap_report.main([url], fetch=fake_fetch(table))
        self.assertIn("5 URLs in 3 sitemap(s)", out.getvalue())

    def test_a_url_that_cannot_be_fetched_is_a_tool_error(self) -> None:
        url = "https://example.test/sitemap.xml"
        for result in (
            FetchResult(requested=url, final_url=url, status=404, body=b"x"),
            FetchResult(requested=url, final_url=url, error="URLError: down"),
            FetchResult(requested=url, final_url=url, skipped="robots.txt disallows this URL"),
        ):
            with self.subTest(result=result), captured():
                code = run_cli(lambda argv: sitemap_report.main(argv, fetch=lambda _url: result), [url])
            self.assertEqual(code, 2)

    def test_only_http_and_https_sources_are_urls(self) -> None:
        for source in ("ftp://example.test/sitemap.xml", "file:///etc/passwd"):
            with self.subTest(source=source), captured() as (_, err):
                code = run_cli(sitemap_report.main, [source])
            self.assertEqual(code, 2)
            self.assertIn("http", err.getvalue())

    def test_a_missing_file_exits_2(self) -> None:
        with captured():
            self.assertEqual(run_cli(sitemap_report.main, ["/no/such/sitemap.xml"]), 2)

    def test_a_non_sitemap_file_exits_2(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            page = Path(folder) / "page.html"
            page.write_text("<html></html>", encoding="utf-8")
            with captured():
                self.assertEqual(run_cli(sitemap_report.main, [str(page)]), 2)

    def test_more_children_than_the_limit_is_refused_instead_of_clamped_silently(self) -> None:
        with captured() as (_, err), self.assertRaises(SystemExit) as caught:
            sitemap_report.main(["x.xml", "--max-children", "11"])
        self.assertEqual(caught.exception.code, 2)
        self.assertIn("10", err.getvalue())
        args = sitemap_report.build_parser().parse_args(["x.xml", "--max-children", "10"])
        self.assertEqual(args.max_children, 10)
        self.assertEqual(sitemap_report.build_parser().parse_args(["x.xml", "--max-children", "0"]).max_children, 0)

    def test_the_default_pause_is_the_fetchers_default(self) -> None:
        self.assertEqual(sitemap_report.build_parser().get_default("delay"), fetch_pages.DEFAULT_DELAY_SECONDS)

    def test_options_are_validated(self) -> None:
        for argv in (["x.xml", "--max-children", "-1"], ["x.xml", "--top", "0"], ["x.xml", "--max-days", "0"]):
            with self.subTest(argv=argv), captured(), self.assertRaises(SystemExit) as caught:
                sitemap_report.main(argv)
            self.assertEqual(caught.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
