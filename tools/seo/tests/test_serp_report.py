"""Tests for the SERP report: domain frequency, the noise list, URL export, and compatibility with saved baselines."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from helpers import captured, fixture_path

import serp_report  # noqa: E402
import serp_search  # noqa: E402
from seo_common import SeoToolError, run_cli  # noqa: E402


def record(query: str, *domains: str) -> dict:
    """A minimal record in the baseline schema, one result per domain."""
    results = [
        {"rank": index, "url": f"https://{domain}/page", "domain": domain, "title": "t", "snippet": "s",
         "engines": ["google cse"], "score": 1.0, "published": None}
        for index, domain in enumerate(domains, start=1)
    ]
    return {"query": query, "language": "en-US", "fetched_at": "2026-10-18T00:00:00+00:00", "attempts": 1,
            "results": results, "suggestions": [], "answers": [], "corrections": [], "infoboxes": [], "unresponsive": []}


class LoadTests(unittest.TestCase):
    def test_reads_every_record_in_a_folder_in_name_order(self) -> None:
        records = serp_report.load_records(fixture_path("serp"))
        self.assertEqual([item["query"] for item in records], ["how much do widgets cost", "widget makers"])

    def test_skips_files_that_are_not_records_and_says_so(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "good.json").write_text(json.dumps(record("q", "a.test")), encoding="utf-8")
            (root / "broken.json").write_text("{not json", encoding="utf-8")
            (root / "other.json").write_text(json.dumps({"hello": "world"}), encoding="utf-8")
            (root / "notes.txt").write_text("ignored", encoding="utf-8")
            with captured() as (_, err):
                records = serp_report.load_records(root)
        self.assertEqual([item["query"] for item in records], ["q"])
        self.assertIn("broken.json", err.getvalue())
        self.assertIn("other.json", err.getvalue())

    def test_hostile_json_files_are_skipped_aloud_and_the_rest_are_read(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "good.json").write_text(json.dumps(record("q", "a.test")), encoding="utf-8")
            (root / "deep.json").write_text("[" * 100_000 + "]" * 100_000, encoding="utf-8")
            (root / "bigint.json").write_text('{"n": ' + "1" * 5000 + "}", encoding="utf-8")
            with captured() as (_, err):
                records = serp_report.load_records(root)
        self.assertEqual([item["query"] for item in records], ["q"])
        self.assertIn("deep.json", err.getvalue())
        self.assertIn("bigint.json", err.getvalue())

    def test_results_that_are_not_objects_are_dropped_and_the_record_is_kept(self) -> None:
        good = record("q", "a.test")
        mixed = {**good, "results": [5, "text", None, ["x"], *good["results"]]}
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / "mixed.json").write_text(json.dumps(mixed), encoding="utf-8")
            with captured() as (_, err):
                records = serp_report.load_records(Path(folder))
        self.assertEqual(records[0]["results"], good["results"])
        self.assertIn("mixed.json", err.getvalue())

    def test_a_folder_without_records_is_a_tool_error(self) -> None:
        with tempfile.TemporaryDirectory() as folder, self.assertRaises(SeoToolError):
            serp_report.load_records(Path(folder))

    def test_a_missing_folder_is_a_tool_error(self) -> None:
        with self.assertRaises(SeoToolError):
            serp_report.load_records(Path("/no/such/folder"))

    def test_records_written_by_serp_search_are_readable(self) -> None:
        """The schema is shared: whatever serp_search saves, serp_report must read."""
        written = {
            "query": "round trip", "language": "en-US", "fetched_at": "x", "attempts": 1,
            "results": [{"rank": 1, "url": "https://a.test/", "domain": "a.test", "title": "t", "snippet": "s",
                         "engines": ["google cse"], "score": 1.0, "published": None}],
            "suggestions": [], "answers": [], "corrections": [], "infoboxes": [], "unresponsive": [],
        }
        self.assertEqual(list(written), [
            "query", "language", "fetched_at", "attempts", "results", "suggestions", "answers", "corrections",
            "infoboxes", "unresponsive",
        ])
        self.assertEqual(serp_search.RECORD_FIELDS, tuple(written))
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / "x.json").write_text(json.dumps(written), encoding="utf-8")
            self.assertEqual(serp_report.load_records(Path(folder)), (written,))


class DomainTests(unittest.TestCase):
    def test_domains_are_lower_cased_and_lose_www(self) -> None:
        self.assertEqual(serp_report.normalise_domain("WWW.Example.TEST"), "example.test")
        self.assertEqual(serp_report.normalise_domain("shop.example.test"), "shop.example.test")

    def test_noise_matches_the_site_and_its_subdomains_only(self) -> None:
        for noisy in ("yelp.com", "www.yelp.com", "m.youtube.com", "en.wikipedia.org", "dictionary.cambridge.org",
                      "linkedin.com", "facebook.com", "instagram.com", "reddit.com", "quora.com", "pinterest.com"):
            with self.subTest(domain=noisy):
                self.assertTrue(serp_report.is_noise_domain(noisy))
        for clean in ("notyelp.com", "yelp.com.example.test", "alpha-fab.example", "awinet.org"):
            with self.subTest(domain=clean):
                self.assertFalse(serp_report.is_noise_domain(clean))

    def test_top_domains_keep_order_and_drop_repeats_within_the_window(self) -> None:
        item = record("q", "a.test", "www.a.test", "b.test", "c.test", "d.test")
        self.assertEqual(serp_report.top_domains(item, top=3), ("a.test", "b.test"))
        self.assertEqual(serp_report.top_domains(item, top=10), ("a.test", "b.test", "c.test", "d.test"))


class FrequencyTests(unittest.TestCase):
    def records(self):
        return (
            record("one", "a.test", "yelp.com", "b.test"),
            record("two", "b.test", "a.test"),
            record("three", "c.test", "a.test", "a.test"),
        )

    def test_counts_the_queries_in_which_a_domain_appears(self) -> None:
        stats = {stat.domain: stat for stat in serp_report.domain_frequency(self.records(), top=10)}
        self.assertEqual(stats["a.test"].queries, 3)
        self.assertEqual(stats["b.test"].queries, 2)
        self.assertEqual(stats["c.test"].queries, 1)

    def test_average_first_rank_uses_the_first_hit_in_each_query(self) -> None:
        stats = {stat.domain: stat for stat in serp_report.domain_frequency(self.records(), top=10)}
        self.assertAlmostEqual(stats["a.test"].average_first_rank, (1 + 2 + 2) / 3)
        self.assertAlmostEqual(stats["b.test"].average_first_rank, (3 + 1) / 2)

    def test_sorted_by_queries_then_rank_then_name(self) -> None:
        domains = [stat.domain for stat in serp_report.domain_frequency(self.records(), top=10)]
        self.assertEqual(domains, ["a.test", "b.test", "c.test", "yelp.com"])

    def test_the_top_window_limits_what_counts(self) -> None:
        stats = {stat.domain: stat for stat in serp_report.domain_frequency(self.records(), top=1)}
        self.assertEqual(set(stats), {"a.test", "b.test", "c.test"})
        self.assertEqual(stats["a.test"].queries, 1)

    def test_noise_is_flagged(self) -> None:
        stats = {stat.domain: stat for stat in serp_report.domain_frequency(self.records(), top=10)}
        self.assertTrue(stats["yelp.com"].is_noise)
        self.assertFalse(stats["a.test"].is_noise)

    def test_www_and_bare_domain_count_as_one_site(self) -> None:
        stats = serp_report.domain_frequency((record("q", "www.a.test"), record("r", "a.test")), top=10)
        self.assertEqual([(stat.domain, stat.queries) for stat in stats], [("a.test", 2)])

    def test_results_without_a_domain_are_ignored(self) -> None:
        item = record("q", "a.test")
        item["results"].append({"rank": 2, "url": "", "domain": ""})
        self.assertEqual([stat.domain for stat in serp_report.domain_frequency((item,), top=10)], ["a.test"])


class HostileResultTests(unittest.TestCase):
    """Saved SERP files are data from elsewhere: odd values must not abort a report."""

    def odd_record(self) -> dict:
        odd = [{"url": "http://[", "domain": ""}, {"url": 5, "domain": None}, {"url": "http://a\u2100.test/", "domain": ""}]
        return {"query": "q", "results": odd + record("q", "good.test")["results"]}

    def test_domain_views_skip_results_with_unreadable_addresses(self) -> None:
        odd = self.odd_record()
        self.assertEqual(serp_report.top_domains(odd, 10), ("good.test",))
        self.assertEqual([stat.domain for stat in serp_report.domain_frequency([odd], 10)], ["good.test"])

    def test_the_url_export_skips_addresses_fetch_pages_would_refuse(self) -> None:
        odd = self.odd_record()
        odd["results"] += [{"url": "javascript:alert(1)"}, {"url": "ftp://files.test/x"}, 5]
        self.assertEqual(serp_report.top_result_urls([odd], 10), ("https://good.test/page",))

    def test_clean_url_leaves_an_unreadable_address_alone(self) -> None:
        self.assertEqual(serp_report.clean_url("http://["), "http://[")


class OddValueTests(unittest.TestCase):
    def test_a_result_that_is_not_an_object_has_no_domain(self) -> None:
        self.assertEqual(serp_report._result_domain("not a dict"), "")
        self.assertEqual(serp_report._result_domain(None), "")


class ExportUrlTests(unittest.TestCase):
    def test_clean_url_drops_tracking_parameters_and_the_fragment(self) -> None:
        cleaned = serp_report.clean_url("https://alpha-fab.example/about/?srsltid=TRACK&utm_source=x&keep=1#team")
        self.assertEqual(cleaned, "https://alpha-fab.example/about/?keep=1")
        self.assertEqual(serp_report.clean_url("https://a.test/p?gclid=1&fbclid=2"), "https://a.test/p")
        self.assertEqual(serp_report.clean_url("https://a.test/p"), "https://a.test/p")

    def test_top_result_urls_skip_noise_clean_and_deduplicate(self) -> None:
        records = serp_report.load_records(fixture_path("serp"))
        urls = serp_report.top_result_urls(records, count=3)
        self.assertEqual(
            urls,
            (
                "https://alpha-fab.example/widgets/cost/",
                "https://www.beta-works.example/blog/prices",
                "https://www.alpha-fab.example/widgets/",
                "https://beta-works.example/",
            ),
        )
        self.assertFalse([url for url in urls if "yelp.com" in url or "wikipedia" in url])

    def test_noise_can_be_kept(self) -> None:
        records = serp_report.load_records(fixture_path("serp"))
        urls = serp_report.top_result_urls(records, count=2, skip_noise=False)
        self.assertIn("https://en.wikipedia.org/wiki/Widget", urls)


class RenderAndMainTests(unittest.TestCase):
    def test_report_lists_each_query_with_its_top_domains_and_a_frequency_table(self) -> None:
        text = serp_report.render_report(serp_report.load_records(fixture_path("serp")), top=10, limit=45)
        self.assertIn("2 queries, top 10 results each", text)
        self.assertIn("=== per query: top domains ===", text)
        self.assertIn("- widget makers", text)
        self.assertIn("alpha-fab.example | yelp.com | beta-works.example | gamma-co.example", text)
        self.assertIn("=== domain frequency", text)
        self.assertRegex(text, r"\s2\s+alpha-fab\.example\s+avg first-rank")

    def test_noise_domains_are_tagged_and_can_be_hidden(self) -> None:
        records = serp_report.load_records(fixture_path("serp"))
        shown = serp_report.render_report(records, top=10, limit=45)
        hidden = serp_report.render_report(records, top=10, limit=45, hide_noise=True)
        self.assertRegex(shown, r"yelp\.com\s+avg first-rank\s+[\d.]+\s+\[noise\]")
        table = hidden.split("=== domain frequency")[1]
        self.assertNotRegex(table, r"(?m)^\s*\d+\s+yelp\.com\s")  # notyelp.com is a different site and stays
        self.assertIn("notyelp.com", table)
        self.assertNotIn("[noise]", table)

    def test_the_table_is_cut_at_the_limit(self) -> None:
        records = serp_report.load_records(fixture_path("serp"))
        table = serp_report.render_report(records, top=10, limit=2).split("=== domain frequency")[1]
        self.assertEqual(len([line for line in table.splitlines() if "avg first-rank" in line]), 2)

    def test_main_prints_the_report(self) -> None:
        with captured() as (out, _):
            code = serp_report.main([str(fixture_path("serp")), "--top", "5"])
        self.assertEqual(code, 0)
        self.assertIn("2 queries, top 5 results each", out.getvalue())

    def test_main_can_print_only_the_urls(self) -> None:
        with captured() as (out, _):
            code = serp_report.main([str(fixture_path("serp")), "--urls", "3"])
        self.assertEqual(code, 0)
        lines = out.getvalue().splitlines()
        self.assertEqual(lines[0], "https://alpha-fab.example/widgets/cost/")
        self.assertTrue(all(line.startswith("https://") for line in lines))

    def test_main_with_a_missing_folder_exits_2(self) -> None:
        with captured():
            self.assertEqual(run_cli(serp_report.main, ["/no/such/folder"]), 2)

    def test_bad_options_are_rejected(self) -> None:
        for extra in (["--top", "0"], ["--limit", "0"], ["--urls", "0"]):
            with self.subTest(extra=extra), captured(), self.assertRaises(SystemExit) as caught:
                serp_report.main([str(fixture_path("serp")), *extra])
            self.assertEqual(caught.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
