"""Tests for the page audit: the analysis summary, the saved files, the printed summary and the comparison table."""

from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from helpers import captured, fixture_path, fixture_text

import audit_pages  # noqa: E402
from html_facts import extract_facts  # noqa: E402
from seo_common import SeoToolError, run_cli  # noqa: E402

FINAL_URL = "https://example.test/services/millwork/"

# Keys of the analysis files written by the research prototype: the --table view must keep reading them.
PROTOTYPE_KEYS = {
    "file", "requested", "final_url", "status", "redirects", "headers", "html_bytes", "lang", "title", "title_len",
    "description", "description_len", "robots", "canonical", "hreflang", "viewport", "og", "twitter", "generator",
    "h1", "h2", "h3_count", "headings", "words_main", "words_total", "links_internal", "links_external",
    "links_internal_main", "tel_links", "mailto_links", "nav_labels", "internal_urls", "external_domains", "images",
    "images_alt_missing", "images_alt_empty", "images_with_size", "images_lazy", "image_exts",
    "modern_image_sources", "alt_samples", "jsonld_types", "jsonld_blocks", "jsonld_errors", "forms",
    "scripts_external", "scripts_inline", "phones", "platform", "text_preview",
}


def rich_summary() -> dict:
    html = fixture_text("page_rich.html")
    meta = json.loads(fixture_text("page_rich.meta.json"))
    facts = extract_facts(html, FINAL_URL)
    return audit_pages.summarize_page(facts, meta, "page_rich.html", len(html.encode("utf-8")))


class SummaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.summary = rich_summary()

    def test_has_every_key_the_prototype_wrote(self) -> None:
        self.assertEqual(PROTOTYPE_KEYS - set(self.summary), set())

    def test_fetch_details_come_from_the_meta_file(self) -> None:
        self.assertEqual(self.summary["status"], 200)
        self.assertEqual(self.summary["requested"], "http://example.test/services/millwork")
        self.assertEqual(self.summary["final_url"], FINAL_URL)
        self.assertEqual(self.summary["redirects"][0]["status"], 301)
        self.assertEqual(self.summary["headers"]["x-robots-tag"], "noarchive")

    def test_head_values_and_lengths(self) -> None:
        self.assertEqual(self.summary["title"], "Custom Millwork for US Projects | Example Millwork")
        self.assertEqual(self.summary["title_len"], len(self.summary["title"]))
        self.assertEqual(self.summary["description_len"], len(self.summary["description"]))
        self.assertEqual(self.summary["robots"], "index, follow")
        self.assertEqual(self.summary["canonical"], "https://example.test/services/millwork/")
        self.assertEqual(self.summary["hreflang"], ["en-us", "en-gb"])
        self.assertTrue(self.summary["viewport"])
        self.assertEqual(self.summary["og"]["og:type"], "website")
        self.assertEqual(self.summary["twitter"]["twitter:card"], "summary_large_image")

    def test_headings_in_the_prototype_shape(self) -> None:
        self.assertEqual(self.summary["h1"], ["Custom millwork for US projects"])
        self.assertEqual(self.summary["h2"], ["What we make"])
        self.assertEqual(self.summary["h3_count"], 1)
        self.assertEqual(self.summary["headings"][0], ["h1", "Custom millwork for US projects"])

    def test_link_counts_and_lists(self) -> None:
        self.assertEqual(self.summary["links_internal"], 6)
        self.assertEqual(self.summary["links_internal_main"], 1)
        self.assertEqual(self.summary["links_external"], 2)
        self.assertEqual((self.summary["tel_links"], self.summary["mailto_links"]), (1, 1))
        self.assertEqual(self.summary["nav_labels"], ["About us", "Home", "Privacy", "Resources", "Services"])
        self.assertEqual(self.summary["external_domains"], ["other.example.org", "social.example.org"])
        self.assertIn("https://example.test/projects/", self.summary["internal_urls"])

    def test_image_counts(self) -> None:
        self.assertEqual(self.summary["images"], 5)
        self.assertEqual(self.summary["images_alt_missing"], 1)
        self.assertEqual(self.summary["images_alt_empty"], 1)
        self.assertEqual(self.summary["images_with_size"], 2)
        self.assertEqual(self.summary["images_lazy"], 1)
        self.assertEqual(self.summary["image_exts"], [".jpg", ".svg"])
        self.assertEqual(self.summary["modern_image_sources"], ["image/avif", "image/webp"])
        self.assertEqual(self.summary["alt_samples"][0], "Example Millwork logo")

    def test_structured_data_scripts_forms_phones_and_platform(self) -> None:
        self.assertEqual(self.summary["jsonld_types"], ["Organization", "Product", "Service"])
        self.assertEqual((self.summary["jsonld_blocks"], self.summary["jsonld_errors"]), (2, 1))
        self.assertEqual((self.summary["scripts_external"], self.summary["scripts_inline"]), (2, 1))
        self.assertEqual(self.summary["forms"], [{"action": "/contact/", "method": "post"}])
        self.assertEqual(self.summary["phones"], ["(212) 555-0123"])
        self.assertEqual(self.summary["platform"], [])

    def test_word_counts_and_preview_use_the_main_text(self) -> None:
        self.assertGreater(self.summary["words_total"], self.summary["words_main"])
        self.assertTrue(self.summary["text_preview"].startswith("Custom millwork for US projects"))
        self.assertLessEqual(len(self.summary["text_preview"].split()), audit_pages.PREVIEW_WORDS)

    def test_a_summary_without_a_meta_file_still_works(self) -> None:
        facts = extract_facts("<h1>x</h1>", "https://example.invalid/")
        summary = audit_pages.summarize_page(facts, {}, "x.html", 10)
        self.assertIsNone(summary["status"])
        self.assertEqual((summary["redirects"], summary["headers"]), ([], {}))


class AuditFileTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.folder = Path(self._tmp.name)
        self.html = self.folder / "page_rich.html"
        shutil.copy(fixture_path("page_rich.html"), self.html)
        shutil.copy(fixture_path("page_rich.meta.json"), self.folder / "page_rich.meta.json")

    def test_writes_the_analysis_json_and_the_text_file_next_to_the_page(self) -> None:
        summary = audit_pages.audit_file(self.html)
        analysis = json.loads((self.folder / "page_rich.analysis.json").read_text(encoding="utf-8"))
        self.assertEqual(analysis, json.loads(json.dumps(summary)))
        self.assertTrue((self.folder / "page_rich.txt").is_file())

    def test_the_base_url_comes_from_the_meta_file(self) -> None:
        summary = audit_pages.audit_file(self.html)
        self.assertEqual(summary["final_url"], FINAL_URL)
        self.assertEqual(summary["links_internal"], 6)

    def test_without_a_meta_file_the_fallback_base_url_decides_what_is_internal(self) -> None:
        (self.folder / "page_rich.meta.json").unlink()
        summary = audit_pages.audit_file(self.html, fallback_base_url="https://example.test/")
        self.assertEqual(summary["links_internal"], 6)
        self.assertIsNone(summary["status"])
        other = audit_pages.audit_file(self.html, fallback_base_url="https://elsewhere.test/")
        self.assertEqual(other["links_internal"], 5)  # only the five relative links stay on the fallback site

    def test_the_text_file_has_headings_main_text_and_boilerplate_sections(self) -> None:
        audit_pages.audit_file(self.html)
        text = (self.folder / "page_rich.txt").read_text(encoding="utf-8")
        headings, _, rest = text.partition("# TEXT\n")
        main, _, boilerplate = rest.partition("# BOILERPLATE\n")
        self.assertTrue(headings.startswith("# HEADINGS\nH1: Custom millwork for US projects\n"))
        self.assertIn("H2: What we make", headings)
        self.assertIn("We build custom architectural millwork in one factory.", main)
        self.assertNotIn("Example Millwork, Dubai.", main)
        self.assertIn("Example Millwork, Dubai.", boilerplate)
        self.assertIn("Services", boilerplate)

    def test_undecodable_bytes_are_replaced_not_fatal(self) -> None:
        self.html.write_bytes(b"<html><body><h1>caf\xe9</h1><p>text</p></body></html>")
        summary = audit_pages.audit_file(self.html)
        self.assertEqual(len(summary["h1"]), 1)

    def test_a_missing_page_is_a_tool_error(self) -> None:
        with self.assertRaises(SeoToolError):
            audit_pages.audit_file(self.folder / "missing.html")

    def test_a_broken_meta_file_is_a_tool_error_naming_the_file(self) -> None:
        (self.folder / "page_rich.meta.json").write_text("{nope", encoding="utf-8")
        with self.assertRaises(SeoToolError) as caught:
            audit_pages.audit_file(self.html)
        self.assertIn("page_rich.meta.json", str(caught.exception))

    def test_a_skipped_fetch_without_html_is_reported_by_main(self) -> None:
        self.html.unlink()
        with captured() as (_, err):
            code = run_cli(audit_pages.main, [str(self.html)])
        self.assertEqual(code, 1)
        self.assertIn("page_rich.html", err.getvalue())


class HostileInputTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.folder = Path(self._tmp.name)

    def write(self, name: str, html: str) -> Path:
        path = self.folder / name
        path.write_text(html, encoding="utf-8")
        return path

    def test_image_addresses_that_urlsplit_refuses_do_not_stop_the_audit(self) -> None:
        html = '<html><body><img src="http://[" alt="a"><img src="http://a\u2100.test/x.png"><img src="/ok.png"></body></html>'
        summary = audit_pages.audit_file(self.write("imgs.html", html))
        self.assertEqual(summary["images"], 3)
        self.assertIn(".png", summary["image_exts"])

    def test_link_and_form_addresses_that_urlsplit_refuses_do_not_stop_the_audit(self) -> None:
        html = '<html><body><a href="http://[">bad</a><a href="http://a\u2100.test/">nfkc</a><form action="http://["></form></body></html>'
        summary = audit_pages.audit_file(self.write("links.html", html))
        self.assertEqual(summary["links_internal"] + summary["links_external"], 0)

    def test_one_unreadable_file_does_not_stop_the_other_pages(self) -> None:
        first = self.write("first.html", "<html><head><title>First page</title></head><body><h1>One</h1></body></html>")
        last = self.write("last.html", "<html><head><title>Last page</title></head><body><h1>Two</h1></body></html>")
        with captured() as (out, err):
            code = run_cli(audit_pages.main, [str(first), str(self.folder / "missing.html"), str(last)])
        self.assertEqual(code, 1)
        self.assertIn("First page", out.getvalue())
        self.assertIn("Last page", out.getvalue())
        self.assertIn("missing.html", err.getvalue())
        self.assertTrue((self.folder / "last.analysis.json").is_file())

    def test_a_broken_meta_file_only_fails_its_own_page(self) -> None:
        bad = self.write("bad.html", "<html><body><h1>Bad</h1></body></html>")
        (self.folder / "bad.meta.json").write_text("{nope", encoding="utf-8")
        good = self.write("good.html", "<html><head><title>Good page</title></head></html>")
        with captured() as (out, err):
            code = run_cli(audit_pages.main, [str(bad), str(good)])
        self.assertEqual(code, 1)
        self.assertIn("Good page", out.getvalue())
        self.assertIn("bad.meta.json", err.getvalue())

    def test_a_file_that_is_not_html_is_refused_and_left_untouched(self) -> None:
        notes = self.write("notes.txt", "<html><title>my own notes</title></html>")
        with captured() as (_, err):
            code = run_cli(audit_pages.main, [str(notes)])
        self.assertEqual(code, 1)
        self.assertIn("notes.txt", err.getvalue())
        self.assertEqual(notes.read_text(encoding="utf-8"), "<html><title>my own notes</title></html>")
        self.assertFalse((self.folder / "notes.analysis.json").exists())

    def test_htm_and_upper_case_extensions_are_html(self) -> None:
        for name in ("page.htm", "PAGE.HTML"):
            with self.subTest(name=name):
                path = self.write(name, "<html><head><title>T</title></head></html>")
                audit_pages.audit_file(path)
                self.assertTrue(path.with_suffix(".analysis.json").is_file())
                self.assertTrue(path.with_suffix(".txt").is_file())

    def test_the_table_skips_an_unreadable_analysis_file_aloud(self) -> None:
        for source in sorted(fixture_path("analysis").glob("*.analysis.json")):
            shutil.copy(source, self.folder / source.name)
        (self.folder / "broken.analysis.json").write_text('{"final_url": 5}', encoding="utf-8")
        (self.folder / "deep.analysis.json").write_text("[" * 100_000, encoding="utf-8")
        with captured() as (out, err):
            code = audit_pages.main(["--table", str(self.folder)])
        self.assertEqual(code, 0)
        self.assertIn("example.test/alpha/", out.getvalue())
        self.assertIn("broken.analysis.json", err.getvalue())
        self.assertIn("deep.analysis.json", err.getvalue())

    def test_a_folder_where_every_analysis_file_is_unreadable_is_a_tool_error(self) -> None:
        (self.folder / "broken.analysis.json").write_text("{nope", encoding="utf-8")
        with captured(), self.assertRaises(SeoToolError):
            audit_pages.table_for(self.folder)


class PrintingTests(unittest.TestCase):
    def test_summary_lines_follow_the_prototype_layout(self) -> None:
        lines = audit_pages.format_summary(rich_summary()).splitlines()
        self.assertTrue(lines[0].startswith(f"== {FINAL_URL}  [200] hops:301"), lines[0])
        text = "\n".join(lines)
        self.assertIn(" title (50): Custom Millwork for US Projects | Example Millwork", text)
        self.assertIn(" canonical: https://example.test/services/millwork/ | robots: index, follow | hreflang: 2", text)
        self.assertIn(" og: og:title, og:type, og:image | twitter: twitter:card, twitter:title", text)
        self.assertIn(" h1 (1): Custom millwork for US projects", text)
        self.assertIn("images 5 (alt missing 1, empty 1, sized 2, lazy 1)", text)
        self.assertIn("jsonld: Organization, Product, Service (2 blocks, 1 errors)", text)
        self.assertIn("x-robots-tag: noarchive", text)

    def test_summary_shows_dashes_for_missing_values(self) -> None:
        facts = extract_facts("<p>hi</p>", "https://example.invalid/")
        text = audit_pages.format_summary(audit_pages.summarize_page(facts, {}, "x.html", 9))
        self.assertIn("canonical: - | robots: - | hreflang: 0", text)
        self.assertIn("og: none | twitter: none", text)
        self.assertIn("platform: ?", text)

    def test_table_reads_the_prototype_analysis_files(self) -> None:
        rows = [audit_pages.read_analysis(path) for path in sorted(fixture_path("analysis").glob("*.analysis.json"))]
        lines = audit_pages.format_table(rows).splitlines()
        self.assertEqual(len(lines), 4)
        self.assertTrue(lines[0].startswith("page"))
        self.assertTrue(set(lines[1]) == {"-"})
        alpha, beta = lines[2], lines[3]
        self.assertIn("example.test/alpha/", alpha)
        self.assertIn("295", alpha)
        self.assertIn("200", alpha)
        self.assertIn("www.example.test/beta/", beta)
        self.assertIn("404", beta)
        self.assertIn("Organization,WebSite", beta)

    def test_table_for_a_folder_with_no_analysis_files_is_a_tool_error(self) -> None:
        with tempfile.TemporaryDirectory() as empty, self.assertRaises(SeoToolError):
            audit_pages.table_for(Path(empty))


class MainTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.folder = Path(self._tmp.name)
        shutil.copy(fixture_path("page_rich.html"), self.folder / "page_rich.html")
        shutil.copy(fixture_path("page_rich.meta.json"), self.folder / "page_rich.meta.json")

    def test_main_audits_each_file_and_prints_its_summary(self) -> None:
        with captured() as (out, _):
            code = audit_pages.main([str(self.folder / "page_rich.html")])
        self.assertEqual(code, 0)
        self.assertIn(f"== {FINAL_URL}", out.getvalue())
        self.assertTrue((self.folder / "page_rich.analysis.json").is_file())

    def test_main_table_prints_a_comparison_table(self) -> None:
        with captured() as (out, _):
            code = audit_pages.main(["--table", str(fixture_path("analysis"))])
        self.assertEqual(code, 0)
        self.assertIn("example.test/alpha/", out.getvalue())

    def test_table_after_audit_reads_what_audit_wrote(self) -> None:
        with captured():
            audit_pages.main([str(self.folder / "page_rich.html")])
        with captured() as (out, _):
            audit_pages.main(["--table", str(self.folder)])
        self.assertIn("example.test/services/millwork/", out.getvalue())

    def test_main_needs_files_or_table(self) -> None:
        with captured(), self.assertRaises(SystemExit) as caught:
            audit_pages.main([])
        self.assertEqual(caught.exception.code, 2)

    def test_main_rejects_a_bad_base_url(self) -> None:
        with captured():
            code = run_cli(audit_pages.main, [str(self.folder / "page_rich.html"), "--base-url", "file:///x"])
        self.assertEqual(code, 2)


if __name__ == "__main__":
    unittest.main()
