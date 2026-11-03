"""Tests for the Google capture parser. The fixtures are written by hand in the shape of real text captures."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from helpers import captured, fixture_path, fixture_text

import google_features  # noqa: E402
from google_features import GoogleFeatures, parse_capture  # noqa: E402
from seo_common import SeoToolError, run_cli  # noqa: E402


class AiOverviewTests(unittest.TestCase):
    def test_detects_an_ai_overview_and_the_sources_it_cites(self) -> None:
        features = parse_capture(fixture_text("google", "with-features.txt"), "with-features")
        self.assertTrue(features.has_ai_overview)
        self.assertEqual(features.ai_overview_sources, ("Alpha Fabrication", "Beta Works", "Gamma Co"))

    def test_sources_are_the_names_that_precede_a_plus_count(self) -> None:
        features = parse_capture(fixture_text("google", "ads-and-single-source.txt"))
        self.assertEqual(features.ai_overview_sources, ("Gamma Co",))

    def test_no_ai_overview_means_no_sources(self) -> None:
        features = parse_capture(fixture_text("google", "plain.txt"))
        self.assertFalse(features.has_ai_overview)
        self.assertEqual(features.ai_overview_sources, ())

    def test_a_plus_count_outside_the_overview_is_not_a_source(self) -> None:
        text = "Web results\nSome Site\n+3\nAI Overview\nOnly text here\nAI responses may include mistakes. Learn more\nOther\n+2\n"
        self.assertEqual(parse_capture(text).ai_overview_sources, ())

    def test_an_overview_without_the_closing_line_is_still_bounded(self) -> None:
        lines = ["AI Overview", "Cited One", "+1"] + [f"filler line {n}" for n in range(200)] + ["Late Name", "+9"]
        self.assertEqual(parse_capture("\n".join(lines)).ai_overview_sources, ("Cited One",))

    def test_sources_are_unique_in_order(self) -> None:
        text = "AI Overview\nBody\nSame Source\n+1\nMore body\nSame Source\n+2\nAI responses may include mistakes. Learn more\n"
        self.assertEqual(parse_capture(text).ai_overview_sources, ("Same Source",))


class QuestionAndRelatedTests(unittest.TestCase):
    def test_people_also_ask_collects_the_questions(self) -> None:
        features = parse_capture(fixture_text("google", "with-features.txt"))
        self.assertEqual(
            features.people_also_ask,
            ("How much do widgets cost?", "What is a widget maker?", "Why are widgets expensive?"),
        )

    def test_lines_that_are_not_questions_are_skipped(self) -> None:
        features = parse_capture(fixture_text("google", "ads-and-single-source.txt"))
        self.assertEqual(features.people_also_ask, ("Are widgets reusable?", "How are widgets sized?"))

    def test_related_searches_from_people_also_search_for(self) -> None:
        features = parse_capture(fixture_text("google", "with-features.txt"))
        self.assertEqual(
            features.related_searches,
            ("Widget maker near me", "Widget maker reviews", "Widget maker usa", "Alpha Fabrication", "Widget photos"),
        )

    def test_related_searches_from_searches_related_to(self) -> None:
        features = parse_capture(fixture_text("google", "plain.txt"))
        self.assertEqual(features.related_searches, ("gamma widgets price", "gamma widgets sizes", "gamma widgets for sale"))

    def test_related_searches_from_a_related_searches_heading(self) -> None:
        features = parse_capture(fixture_text("google", "ads-and-single-source.txt"))
        self.assertEqual(features.related_searches, ("widget sizes chart", "widget gauge"))

    def test_a_section_stops_at_the_next_heading(self) -> None:
        text = "People also ask\nIs this one?\nWeb results\nIs that one?\n"
        self.assertEqual(parse_capture(text).people_also_ask, ("Is this one?",))

    def test_a_section_is_limited_to_eight_items(self) -> None:
        text = "People also ask\n" + "\n".join(f"Question number {n}?" for n in range(20)) + "\n"
        self.assertEqual(len(parse_capture(text).people_also_ask), google_features.SECTION_LIMIT)
        self.assertEqual(google_features.SECTION_LIMIT, 8)

    def test_very_short_and_very_long_lines_are_not_items(self) -> None:
        long_line = "x" * 200
        text = f"Related searches\nab\n{long_line}\nreal item\n"
        self.assertEqual(parse_capture(text).related_searches, ("real item",))


class LocalPackAndAdsTests(unittest.TestCase):
    def test_local_pack(self) -> None:
        self.assertTrue(parse_capture(fixture_text("google", "with-features.txt")).has_local_pack)
        self.assertFalse(parse_capture(fixture_text("google", "plain.txt")).has_local_pack)

    def test_ads(self) -> None:
        self.assertTrue(parse_capture(fixture_text("google", "ads-and-single-source.txt")).has_ads)
        self.assertFalse(parse_capture(fixture_text("google", "with-features.txt")).has_ads)

    def test_a_sentence_that_contains_a_marker_word_is_not_a_marker(self) -> None:
        text = "We offer Sponsored results for brands and AI Overview tips and Local Results training\n"
        features = parse_capture(text)
        self.assertEqual((features.has_ai_overview, features.has_ads, features.has_local_pack), (False, False, False))


class ParseCaptureTests(unittest.TestCase):
    def test_empty_text_has_no_features(self) -> None:
        features = parse_capture("", "empty")
        self.assertEqual(
            features,
            GoogleFeatures(name="empty", has_ai_overview=False, ai_overview_sources=(), people_also_ask=(),
                           related_searches=(), has_local_pack=False, has_ads=False),
        )

    def test_blank_lines_and_tabs_do_not_matter(self) -> None:
        text = "\n\t AI Overview \t\n\n  Body\n\nName One\n\t+2\n\nAI responses may include mistakes. Learn more\n"
        features = parse_capture(text)
        self.assertTrue(features.has_ai_overview)
        self.assertEqual(features.ai_overview_sources, ("Name One",))

    def test_the_result_is_immutable(self) -> None:
        features = parse_capture(fixture_text("google", "with-features.txt"))
        with self.assertRaises(Exception):
            features.has_ads = True  # type: ignore[misc]
        self.assertIsInstance(features.people_also_ask, tuple)


class SummaryAndMainTests(unittest.TestCase):
    def features(self):
        return tuple(
            parse_capture(fixture_text("google", name), name.replace(".txt", ""))
            for name in ("with-features.txt", "plain.txt", "ads-and-single-source.txt")
        )

    def test_summary_counts(self) -> None:
        counts = google_features.summary_counts(self.features())
        self.assertEqual(counts, {"captures": 3, "ai_overview": 2, "local_pack": 1, "ads": 1, "people_also_ask": 2})

    def test_render_shows_each_capture(self) -> None:
        text = google_features.render_features(self.features()[0])
        self.assertIn("### with-features", text)
        self.assertIn("AI Overview: YES | local pack: YES | ads: no", text)
        self.assertIn("AIO cites: Alpha Fabrication; Beta Works; Gamma Co", text)
        self.assertIn("PAA: How much do widgets cost? | What is a widget maker? | Why are widgets expensive?", text)
        self.assertIn("related: Widget maker near me | Widget maker reviews", text)

    def test_render_of_a_plain_capture_has_no_optional_lines(self) -> None:
        text = google_features.render_features(self.features()[1])
        self.assertIn("AI Overview: no | local pack: no | ads: no", text)
        self.assertNotIn("AIO cites", text)
        self.assertNotIn("PAA", text)

    def test_main_reads_a_folder_of_text_captures_and_prints_a_summary(self) -> None:
        with captured() as (out, _):
            code = google_features.main([str(fixture_path("google"))])
        self.assertEqual(code, 0)
        text = out.getvalue()
        self.assertIn("### with-features", text)
        self.assertIn("### plain", text)
        self.assertIn("AI Overview on 2 of 3 captures", text)
        self.assertIn("local pack on 1", text)

    def test_main_with_a_folder_without_captures_exits_2(self) -> None:
        with tempfile.TemporaryDirectory() as folder, captured():
            self.assertEqual(run_cli(google_features.main, [folder]), 2)

    def test_main_with_a_missing_folder_exits_2(self) -> None:
        with captured():
            self.assertEqual(run_cli(google_features.main, ["/no/such/folder"]), 2)

    def test_load_captures_ignores_other_files(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "a.txt").write_text("AI Overview\nBody\n", encoding="utf-8")
            (root / "a.png").write_bytes(b"\x89PNG")
            (root / "manifest.json").write_text("{}", encoding="utf-8")
            captures = google_features.load_captures(root)
        self.assertEqual([item.name for item in captures], ["a"])


if __name__ == "__main__":
    unittest.main()
