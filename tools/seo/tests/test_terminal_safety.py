"""Page text, search results and server answers are data from elsewhere. None of it may reach the terminal or a
saved text file with raw control characters in it: an escape sequence can set the window title, clear the screen
or, on some terminals, write to the clipboard. Right-to-left overrides can make a line read backwards."""

from __future__ import annotations

import ast
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path

from helpers import FakeClock, FakeOpener, Reply, TOOLS_DIR, captured, fixture_path

import audit_pages  # noqa: E402
import fetch_pages  # noqa: E402
import google_features  # noqa: E402
import seo_common  # noqa: E402
import serp_report  # noqa: E402
import serp_search  # noqa: E402
import sitemap_report  # noqa: E402
from seo_common import run_cli  # noqa: E402

ESC, BEL, CSI, RLO = "\x1b", "\x07", "\x9b", "\u202e"
HOSTILE = f"Acme{ESC}]0;pwned{BEL} Co{ESC}[2J{CSI}31m{RLO}reversed"
ALLOWED_WHITESPACE = "\n\t"


def unsafe_characters(text: str) -> list:
    """Every character that would act on a terminal or reorder text, as hex codes."""
    return sorted({
        hex(ord(ch)) for ch in text
        if (ord(ch) < 0x20 and ch not in ALLOWED_WHITESPACE) or 0x7F <= ord(ch) <= 0x9F
        or ch in "\u061c\u200e\u200f\u2028\u2029" or "\u202a" <= ch <= "\u202e" or "\u2066" <= ch <= "\u2069"
        or "\ud800" <= ch <= "\udfff"
    })


class PrintableTests(unittest.TestCase):
    def test_ordinary_text_is_unchanged(self) -> None:
        for text in ("plain words, digits 123 and punctuation: !?&", "caf\u00e9 \u6728\u5de5 \u0434\u0430 \U0001f600",
                     "tabs\tand\nnewlines stay", "", "back\\slash"):
            with self.subTest(text=text):
                self.assertEqual(seo_common.printable(text), text)

    def test_control_characters_are_shown_as_escapes(self) -> None:
        self.assertEqual(seo_common.printable(f"a{ESC}[2Jb"), "a\\x1b[2Jb")
        self.assertEqual(seo_common.printable(f"x{BEL}y\x00z\x7f"), "x\\x07y\\x00z\\x7f")
        self.assertEqual(seo_common.printable("line\roverwrite"), "line\\roverwrite")

    def test_eight_bit_controls_are_escaped_too(self) -> None:
        self.assertEqual(seo_common.printable(f"{CSI}31m\x85"), "\\x9b31m\\x85")

    def test_direction_overrides_and_line_separators_are_escaped(self) -> None:
        self.assertEqual(seo_common.printable(f"a{RLO}b\u202d\u2066\u2069\u200e\u200f\u061c"),
                         "a\\u202eb\\u202d\\u2066\\u2069\\u200e\\u200f\\u061c")
        self.assertEqual(seo_common.printable("a\u2028b\u2029c"), "a\\u2028b\\u2029c")

    def test_a_lone_surrogate_cannot_break_printing(self) -> None:
        self.assertEqual(seo_common.printable("a\ud800b"), "a\\ud800b")

    def test_nothing_unsafe_survives(self) -> None:
        self.assertEqual(unsafe_characters(seo_common.printable(HOSTILE + "\ud800\u2028\x00\x1f")), [])

    def test_escaping_twice_changes_nothing(self) -> None:
        once = seo_common.printable(HOSTILE)
        self.assertEqual(seo_common.printable(once), once)

    def test_emit_prints_the_safe_form_to_stdout(self) -> None:
        with captured() as (out, err):
            seo_common.emit(f"row {ESC}[2J")
        self.assertEqual(out.getvalue(), "row \\x1b[2J\n")
        self.assertEqual(err.getvalue(), "")

    def test_log_writes_the_safe_form_to_stderr(self) -> None:
        with captured() as (out, err):
            seo_common.log(f"note {ESC}]52;c;ZXZpbA=={BEL}")
        self.assertEqual(err.getvalue(), "[seo] note \\x1b]52;c;ZXZpbA==\\x07\n")
        self.assertEqual(out.getvalue(), "")

    def test_an_error_message_with_page_text_in_it_is_safe_too(self) -> None:
        def broken(argv):
            raise ValueError(f"bad {HOSTILE}")

        with captured() as (_, err):
            run_cli(broken, [])
        self.assertEqual(unsafe_characters(err.getvalue()), [])


class ToolOutputTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.folder = Path(self._tmp.name)

    def test_audit_pages_prints_and_saves_safe_text(self) -> None:
        page = self.folder / "evil.html"
        page.write_text(
            f'<html lang="en"><head><title>{HOSTILE}</title><meta name="description" content="{ESC}]52;c;ZXZpbA=={BEL}clip">'
            f'<meta name="robots" content="{ESC}[31mred"></head><body><h1>Head{ESC}[1;1H{ESC}[2Kspoof</h1>'
            f"<p>Body {HOSTILE} text</p></body></html>",
            encoding="utf-8",
        )
        with captured() as (out, err):
            code = audit_pages.main([str(page)])
        self.assertEqual(code, 0)
        self.assertEqual(unsafe_characters(out.getvalue() + err.getvalue()), [])
        self.assertIn("\\x1b]0;pwned\\x07", out.getvalue())
        self.assertEqual(unsafe_characters(page.with_suffix(".txt").read_text(encoding="utf-8")), [])

    def test_audit_pages_table_is_safe(self) -> None:
        data = json.loads((fixture_path("analysis") / "example.test_alpha.analysis.json").read_text(encoding="utf-8"))
        data["final_url"] = f"https://example.test/{ESC}[2J{RLO}"
        data["jsonld_types"] = [f"Type{ESC}[0m"]
        (self.folder / "x.analysis.json").write_text(json.dumps(data), encoding="utf-8")
        with captured() as (out, _):
            audit_pages.main(["--table", str(self.folder)])
        self.assertEqual(unsafe_characters(out.getvalue()), [])

    def test_fetch_pages_result_lines_are_safe(self) -> None:
        url = f"https://site.test/x\x7f{RLO}"
        routes = {"https://site.test/robots.txt": Reply(404), url: urllib.error.URLError(f"{ESC}[31mboom{BEL}")}
        clock = FakeClock()
        opener = FakeOpener(routes, clock=clock)
        with captured() as (out, err):
            code = run_cli(lambda argv: fetch_pages.main(argv, opener=opener, clock=clock, sleep=clock.sleep),
                           [str(self.folder / "out"), url])
        self.assertEqual(code, 1)
        self.assertIn("boom", out.getvalue())
        self.assertEqual(unsafe_characters(out.getvalue() + err.getvalue()), [])

    def test_sitemap_report_is_safe(self) -> None:
        sitemap = self.folder / "sitemap.xml"
        sitemap.write_text(
            f'<urlset><url><loc>https://a.test/x{RLO}{CSI}y/z</loc><lastmod>2026-10-01</lastmod></url></urlset>', encoding="utf-8"
        )
        with captured() as (out, err):
            code = sitemap_report.main([str(sitemap)])
        self.assertEqual(code, 0)
        self.assertEqual(unsafe_characters(out.getvalue() + err.getvalue()), [])

    def test_serp_report_is_safe(self) -> None:
        record = {"query": f"q {ESC}[2J{RLO}", "results": [{"url": "https://a.test/", "domain": f"a{ESC}[0m.test"}]}
        (self.folder / "q.json").write_text(json.dumps(record), encoding="utf-8")
        with captured() as (out, _):
            code = serp_report.main([str(self.folder)])
        self.assertEqual(code, 0)
        self.assertEqual(unsafe_characters(out.getvalue()), [])

    def test_serp_report_url_list_is_safe(self) -> None:
        record = {"query": "q", "results": [{"url": f"https://a.test/x\x7f{CSI}{RLO}", "domain": "a.test"}]}
        (self.folder / "q.json").write_text(json.dumps(record), encoding="utf-8")
        with captured() as (out, _):
            serp_report.main([str(self.folder), "--urls", "5"])
        self.assertEqual(unsafe_characters(out.getvalue()), [])

    def test_serp_search_error_lines_are_safe(self) -> None:
        class Failing(Exception):
            pass

        class Client:
            def search(self, *args, **kwargs):
                raise Failing(f"{ESC}[31mHTTP 500{BEL}")

        queries = self.folder / "queries.txt"
        queries.write_text(f"first{ESC}query\n", encoding="utf-8")
        connection = serp_search.SearxngConnection(Client(), Failing)
        clock = FakeClock()
        with captured() as (out, err):
            code = serp_search.main([str(queries), "--out-dir", str(self.folder / "out")],
                                    connect=lambda url, folder: connection, sleep=clock.sleep)
        self.assertEqual(code, 1)
        self.assertEqual(unsafe_characters(out.getvalue() + err.getvalue()), [])

    def test_google_features_output_is_safe(self) -> None:
        capture = f"AI Overview\nSource {ESC}[2J\n+2\nPeople also ask\nWhat is {RLO}this?\nAI responses may include mistakes. Learn more\n"
        (self.folder / "q.txt").write_text(capture, encoding="utf-8")
        with captured() as (out, _):
            code = google_features.main([str(self.folder)])
        self.assertEqual(code, 0)
        self.assertEqual(unsafe_characters(out.getvalue()), [])


class NoRawPrintTests(unittest.TestCase):
    def test_only_seo_common_calls_print(self) -> None:
        """Every tool prints through emit() or log(), which make the text safe; a plain print() would not."""
        offenders = []
        for path in sorted(TOOLS_DIR.glob("*.py")):
            if path.name == "seo_common.py":
                continue
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "print":
                    offenders.append(f"{path.name}:{node.lineno}")
        self.assertEqual(offenders, [])


if __name__ == "__main__":
    unittest.main()
