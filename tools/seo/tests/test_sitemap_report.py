"""Tests for the sitemap report: parsing, indexes, grouping by path shape, and per-day lastmod counts."""

from __future__ import annotations

import dataclasses
import gzip
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from helpers import captured, fixture_bytes, fixture_path

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

    def test_options_are_validated(self) -> None:
        for argv in (["x.xml", "--max-children", "-1"], ["x.xml", "--top", "0"], ["x.xml", "--max-days", "0"]):
            with self.subTest(argv=argv), captured(), self.assertRaises(SystemExit) as caught:
                sitemap_report.main(argv)
            self.assertEqual(caught.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
