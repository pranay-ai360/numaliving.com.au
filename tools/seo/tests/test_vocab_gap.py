"""Tests for the vocabulary gap analysis and the plan's US-versus-UK term table."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from helpers import captured, fixture_path, fixture_text

import vocab_gap  # noqa: E402
from seo_common import SeoToolError, run_cli  # noqa: E402


def audit_text(main: str, boilerplate: str = "", headings: str = "H1: Heading") -> str:
    """A page text file in the format audit_pages writes."""
    return f"# HEADINGS\n{headings}\n\n# TEXT\n{main}\n\n# BOILERPLATE\n{boilerplate}\n"


def grams(text: str) -> frozenset:
    return vocab_gap.page_ngrams(text)


class PageTextTests(unittest.TestCase):
    def test_reads_the_headings_and_main_text_but_not_the_boilerplate(self) -> None:
        text = vocab_gap.page_text(fixture_text("vocab", "audit-format.txt"))
        self.assertIn("Custom millwork for architects", text)
        self.assertIn("wall paneling for general contractors", text)
        self.assertNotIn("Privacy policy", text)
        self.assertNotIn("# TEXT", text)

    def test_a_file_without_sections_is_all_content(self) -> None:
        self.assertEqual(vocab_gap.page_text("just some words\nmore words").strip(), "just some words\nmore words")

    def test_old_files_without_a_boilerplate_section_are_read_whole(self) -> None:
        text = vocab_gap.page_text("# HEADINGS\nH1: Title\n\n# TEXT\nbody words here\n")
        self.assertIn("body words here", text)


class NgramTests(unittest.TestCase):
    def test_one_two_and_three_word_phrases_are_found(self) -> None:
        found = grams("We build custom millwork and casework for architects")
        self.assertIn("custom", found)
        self.assertIn("custom millwork", found)
        self.assertIn("build custom millwork", found)

    def test_phrases_do_not_start_or_end_with_a_stop_word(self) -> None:
        found = grams("We build custom millwork and casework for architects")
        self.assertNotIn("millwork and", found)
        self.assertNotIn("and casework", found)
        self.assertNotIn("for architects", found)
        self.assertNotIn("and", found)

    def test_a_stop_word_inside_a_phrase_is_fine(self) -> None:
        self.assertIn("millwork and casework", grams("custom millwork and casework"))

    def test_short_words_and_numbers_are_ignored(self) -> None:
        found = grams("an ox 12345 ab cd millwork")
        self.assertEqual(found, frozenset({"millwork"}))

    def test_case_and_punctuation_are_normalised(self) -> None:
        found = grams("Custom, MILLWORK; (Casework)!")
        self.assertIn("custom", found)
        self.assertIn("millwork", found)
        self.assertIn("casework", found)

    def test_apostrophes_and_ampersands_inside_words_are_kept(self) -> None:
        self.assertIn("ff&e", grams("custom ff&e pieces"))

    def test_each_page_counts_a_phrase_once(self) -> None:
        self.assertIsInstance(grams("millwork millwork millwork"), frozenset)
        self.assertEqual(grams("millwork millwork millwork") & {"millwork"}, frozenset({"millwork"}))


def pages(*texts: str):
    return [grams(text) for text in texts]


class PhraseQualityTests(unittest.TestCase):
    """A phrase must be words that sit next to each other on the page, not words that merely survive filtering."""

    def test_short_words_and_us_break_a_phrase_instead_of_being_skipped(self) -> None:
        found = grams("Custom millwork in Dubai for US projects")
        self.assertEqual(found, frozenset({"custom", "millwork", "custom millwork", "dubai", "projects"}))
        for phantom in ("millwork dubai", "custom millwork dubai", "dubai for projects"):
            self.assertNotIn(phantom, found)

    def test_numbers_and_words_that_start_with_a_digit_break_a_phrase(self) -> None:
        self.assertEqual(grams("4x8 sheets and 3D models, 2026 bids"), frozenset({"sheets", "models", "bids"}))

    def test_punctuation_and_separators_break_a_phrase(self) -> None:
        for text in ("millwork. dubai", "millwork, dubai", "millwork (dubai)", "millwork | dubai", "millwork - dubai",
                     "millwork & dubai", "millwork: dubai", "millwork / dubai", "millwork\ndubai", "millwork \u2014 dubai",
                     "millwork \u2022 dubai", "millwork; dubai", "millwork \"dubai\""):
            with self.subTest(text=text):
                found = grams(text)
                self.assertNotIn("millwork dubai", found)
                self.assertEqual(found, frozenset({"millwork", "dubai"}))

    def test_hyphens_ampersands_and_apostrophes_inside_a_word_stay_in_it(self) -> None:
        self.assertEqual(grams("fire-rated doors"), frozenset({"fire-rated", "doors", "fire-rated doors"}))
        self.assertIn("r&d", grams("our r&d team"))

    def test_curly_and_straight_apostrophes_give_the_same_phrases(self) -> None:
        straight = grams("Don't worry, it's fine. We won't mind, isn't it?")
        curly = grams("Don\u2019t worry, it\u2019s fine. We won\u2019t mind, isn\u2019t it?")
        self.assertEqual(straight, curly)
        for fragment in ("don", "isn", "won", "it", "worry it"):
            self.assertNotIn(fragment, curly)

    def test_contractions_and_possessives_never_start_or_end_a_phrase(self) -> None:
        found = grams("Don't build the client's casework; it's cabinetry we're proud of")
        self.assertNotIn("don't", found)
        self.assertNotIn("client's", found)
        self.assertNotIn("it's", found)
        self.assertIn("casework", found)
        self.assertIn("cabinetry", found)

    def test_accents_are_folded(self) -> None:
        self.assertEqual(grams("D\u00e9cor and caf\u00e9"), frozenset({"decor", "cafe", "decor and cafe"}))
        self.assertEqual(grams("D\u00e9cor"), grams("Decor"))

    def test_letters_outside_the_latin_alphabet_break_a_phrase_and_are_not_words(self) -> None:
        self.assertEqual(grams("millwork \u6728\u5de5 dubai"), frozenset({"millwork", "dubai"}))

    def test_the_stop_words_are_all_long_enough_to_matter(self) -> None:
        self.assertEqual([word for word in vocab_gap.STOP_WORDS if len(word) < vocab_gap.MIN_WORD_CHARS], [])
        self.assertIn("the", vocab_gap.STOP_WORDS)


class HeadingTextTests(unittest.TestCase):
    def test_a_heading_that_is_only_in_the_header_still_counts(self) -> None:
        """A hero H1 inside <header> is boilerplate text, so it is not under # TEXT: the heading block carries it."""
        text = "# HEADINGS\nH1: Overseas millwork\nH2: Paneling\n\n# TEXT\nBody words.\n\n# BOILERPLATE\nOverseas millwork\nmenu\n"
        content = vocab_gap.page_text(text)
        self.assertIn("Overseas millwork", content)
        self.assertIn("Paneling", content)
        self.assertIn("Body words.", content)
        self.assertNotIn("menu", content)
        self.assertNotIn("H1:", content)
        self.assertIn("overseas millwork", grams(content))

    def test_audit_pages_output_round_trips_a_header_heading_into_the_analysis(self) -> None:
        import audit_pages
        from html_facts import extract_facts

        facts = extract_facts("<header><h1>Overseas millwork</h1></header><main><p>Body words here</p></main>", "https://a.test/")
        content = vocab_gap.page_text(audit_pages.render_text_file(facts))
        self.assertIn("overseas millwork", grams(content))
        self.assertNotIn("body words here overseas", grams(content))

    def test_a_file_in_the_old_format_is_still_read_whole(self) -> None:
        self.assertEqual(vocab_gap.page_text("# TEXT\nonly text\n").strip(), "only text")


class ThresholdTests(unittest.TestCase):
    def test_thirty_percent_of_thirty_three_pages_is_ten_pages(self) -> None:
        rows = vocab_gap.find_core_gaps({"nine pages": 9, "ten pages": 10}, {}, ranking_total=33, min_pages=1, min_share=0.3)
        self.assertEqual([row.term for row in rows], ["ten pages"])
        self.assertEqual(vocab_gap.core_threshold(33, 1, 0.3), 10)

    def test_floating_point_noise_does_not_raise_the_bar(self) -> None:
        self.assertEqual(vocab_gap.core_threshold(10, 1, 0.3), 3)  # 10 * 0.3 is 3.0000000000000004
        self.assertEqual(vocab_gap.core_threshold(100, 1, 0.07), 7)
        self.assertEqual(vocab_gap.core_threshold(7, 1, 1.0), 7)
        self.assertEqual(vocab_gap.core_threshold(7, 1, 0.0), 1)

    def test_the_report_names_the_same_threshold_the_gaps_use(self) -> None:
        texts = [f"millwork word{n}" for n in range(33)]
        report = vocab_gap.render_report(texts, ["unrelated"], with_terms=False)
        self.assertIn("on at least 10 ranking pages", report)


class GapTests(unittest.TestCase):
    RANKING = [
        "custom millwork casework architects zzcommon",
        "custom millwork casework architects zzcommon",
        "custom millwork casework zzcommon",
        "custom millwork zzcommon",
        "custom millwork",
    ]
    OWN = ["joinery wardrobes architects", "joinery wardrobes zzcommon"]

    def frequencies(self):
        ranking = vocab_gap.document_frequency(pages(*self.RANKING))
        own = vocab_gap.document_frequency(pages(*self.OWN))
        return ranking, own

    def test_document_frequency_counts_pages_not_occurrences(self) -> None:
        ranking, own = self.frequencies()
        self.assertEqual(ranking["custom millwork"], 5)
        self.assertEqual(ranking["casework"], 3)
        self.assertEqual(own["joinery"], 2)

    def test_core_gaps_are_terms_on_many_ranking_pages_and_no_own_page(self) -> None:
        ranking, own = self.frequencies()
        rows = vocab_gap.find_core_gaps(ranking, own, ranking_total=5, min_pages=3, min_share=0.3)
        terms = {row.term: row.ranking_pages for row in rows}
        self.assertEqual(terms["custom millwork"], 5)
        self.assertEqual(terms["casework"], 3)
        self.assertNotIn("architects", terms)  # Numa uses it
        self.assertNotIn("zzcommon", terms)  # Numa uses it on one page
        self.assertTrue(all(row.own_pages == 0 for row in rows))

    def test_core_gaps_are_sorted_by_page_count_then_name(self) -> None:
        ranking, own = self.frequencies()
        rows = vocab_gap.find_core_gaps(ranking, own, ranking_total=5, min_pages=3, min_share=0.3)
        counts = [row.ranking_pages for row in rows]
        self.assertEqual(counts, sorted(counts, reverse=True))

    def test_the_threshold_is_the_larger_of_min_pages_and_the_share(self) -> None:
        ranking, own = self.frequencies()
        strict = vocab_gap.find_core_gaps(ranking, own, ranking_total=5, min_pages=4, min_share=0.3)
        self.assertNotIn("casework", {row.term for row in strict})
        share = vocab_gap.find_core_gaps(ranking, own, ranking_total=5, min_pages=1, min_share=0.9)
        self.assertEqual({row.term for row in share}, {"custom", "millwork", "custom millwork"})

    def test_core_gaps_respect_the_limit(self) -> None:
        ranking, own = self.frequencies()
        self.assertEqual(len(vocab_gap.find_core_gaps(ranking, own, 5, min_pages=1, min_share=0.0, limit=2)), 2)

    def test_numa_only_terms_are_used_on_two_own_pages_and_at_most_one_ranking_page(self) -> None:
        ranking, own = self.frequencies()
        rows = vocab_gap.find_own_only_terms(ranking, own)
        terms = {row.term: (row.own_pages, row.ranking_pages) for row in rows}
        self.assertEqual(terms["joinery"], (2, 0))
        self.assertEqual(terms["wardrobes"], (2, 0))
        self.assertNotIn("architects", terms)

    def test_short_terms_are_not_listed_as_numa_only(self) -> None:
        own = vocab_gap.document_frequency(pages("abcd xyzzy", "abcd xyzzy"))
        terms = {row.term for row in vocab_gap.find_own_only_terms({}, own)}
        # "abcd" alone has only four letters (the prototype's bar is more than four); the pair and "xyzzy" pass.
        self.assertEqual(terms, {"xyzzy", "abcd xyzzy"})

    def test_text_in_the_boilerplate_section_does_not_count(self) -> None:
        text = audit_text("custom millwork here", boilerplate="zzboiler zzboiler menu")
        self.assertNotIn("zzboiler", grams(vocab_gap.page_text(text)))


class FileDiscoveryTests(unittest.TestCase):
    def test_pages_named_like_login_or_not_found_or_robots_or_sitemap_are_skipped(self) -> None:
        for name in ("site_login.txt", "site_no-such-page.txt", "site_robots.txt.txt", "site_sitemap.xml.txt", "site_index.html.txt"):
            with self.subTest(name=name):
                self.assertTrue(vocab_gap.is_boilerplate_page(name))
        for name in ("site_about.txt", "site_index.txt", "site_projects_golf-links.txt"):
            with self.subTest(name=name):
                self.assertFalse(vocab_gap.is_boilerplate_page(name))

    def test_a_folder_gives_its_text_files_without_the_skipped_ones(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ("a_about.txt", "a_login.txt", "a_about.analysis.json", "a_about.html"):
                (root / name).write_text("x", encoding="utf-8")
            found = vocab_gap.collect_text_files([str(root)])
        self.assertEqual([path.name for path in found], ["a_about.txt"])

    def test_single_files_and_globs_are_accepted(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ("one.txt", "two.txt", "three.json"):
                (root / name).write_text("x", encoding="utf-8")
            by_file = vocab_gap.collect_text_files([str(root / "one.txt")])
            by_glob = vocab_gap.collect_text_files([str(root / "*.txt")])
        self.assertEqual([path.name for path in by_file], ["one.txt"])
        self.assertEqual([path.name for path in by_glob], ["one.txt", "two.txt"])

    def test_a_path_that_matches_nothing_is_a_tool_error(self) -> None:
        with self.assertRaises(SeoToolError):
            vocab_gap.collect_text_files(["/no/such/folder"])

    def test_an_explicit_file_is_kept_even_if_its_name_looks_like_boilerplate(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "x_login.txt"
            target.write_text("x", encoding="utf-8")
            self.assertEqual(vocab_gap.collect_text_files([str(target)]), (target,))


class TermTableTests(unittest.TestCase):
    def row(self, label: str):
        for row in vocab_gap.TERM_TABLE:
            if any(group.label == label for group in row.groups):
                return row
        self.fail(f"no row for {label}")

    def test_the_table_has_the_fourteen_rows_of_the_plan(self) -> None:
        self.assertEqual(len(vocab_gap.TERM_TABLE), 14)
        self.assertEqual((vocab_gap.PLAN_RANKING_PAGES, vocab_gap.PLAN_OWN_PAGES), (33, 7))

    def test_plan_figures_and_actions(self) -> None:
        custom = self.row("custom millwork")
        self.assertEqual((custom.groups[0].plan_ranking_pages, custom.groups[0].plan_own_pages), (22, 0))
        self.assertEqual(custom.action, "add everywhere it is true")
        joinery = self.row("joinery")
        self.assertEqual((joinery.groups[0].plan_ranking_pages, joinery.groups[0].plan_own_pages), (1, 7))
        self.assertEqual(joinery.action, "drop from public copy")
        paneling = self.row("paneling")
        self.assertEqual([(g.label, g.plan_ranking_pages, g.plan_own_pages) for g in paneling.groups], [("paneling", 15, 0), ("panelling", 1, 4)])
        self.assertEqual(paneling.action, "paneling")
        programme = self.row("programme")
        self.assertEqual([(g.label, g.plan_ranking_pages, g.plan_own_pages) for g in programme.groups], [("programme", 1, 4), ("schedule", 10, 0)])
        self.assertEqual(self.row("m² / metres").action, "feet, inches and sq ft (dual)")

    def test_every_group_has_patterns_and_every_row_has_an_action(self) -> None:
        for row in vocab_gap.TERM_TABLE:
            self.assertTrue(row.action)
            self.assertTrue(row.groups)
            for group in row.groups:
                self.assertTrue(group.patterns, group.label)

    def test_a_page_counts_when_it_contains_any_pattern_of_the_group(self) -> None:
        group = vocab_gap.TermGroup("casing / trim", ("casing", "trim"), 14, 0)
        texts = ["window casing and baseboard", "crown trim", "nothing here", "trimmed edges"]
        self.assertEqual(vocab_gap.count_pages_with(texts, group), 2)

    def test_matching_ignores_case_and_respects_word_edges(self) -> None:
        group = vocab_gap.TermGroup("joinery", ("joinery",), 1, 7)
        self.assertEqual(vocab_gap.count_pages_with(["Fine JOINERY work", "joineries", "bespoke-joinery"], group), 2)

    def test_phrases_and_symbols_are_matched(self) -> None:
        phrase = vocab_gap.TermGroup("custom millwork", ("custom millwork",), 22, 0)
        square = vocab_gap.TermGroup("m² / metres", ("m²", "metres"), 1, 4)
        self.assertEqual(vocab_gap.count_pages_with(["our custom millwork shop", "custom woodwork"], phrase), 1)
        self.assertEqual(vocab_gap.count_pages_with(["18,000 m² of floor", "12 metres", "square feet"], square), 2)

    def test_term_counts_cover_ranking_and_own_pages_for_every_group(self) -> None:
        counts = vocab_gap.term_counts(["custom millwork and casework"], ["joinery and wardrobes"])
        by_label = {count.group.label: count for count in counts}
        self.assertEqual(by_label["custom millwork"].ranking_pages, 1)
        self.assertEqual(by_label["custom millwork"].own_pages, 0)
        self.assertEqual(by_label["joinery"].own_pages, 1)
        self.assertEqual(by_label["wardrobe(s)"].own_pages, 1)
        total_groups = sum(len(row.groups) for row in vocab_gap.TERM_TABLE)
        self.assertEqual(len(counts), total_groups)

    def test_render_term_table_shows_counts_plan_figures_and_actions(self) -> None:
        counts = vocab_gap.term_counts(["custom millwork"], ["joinery"])
        text = vocab_gap.render_term_table(counts, ranking_total=1, own_total=1)
        self.assertIn("custom millwork", text)
        self.assertIn("add everywhere it is true", text)
        self.assertIn("drop from public copy", text)
        self.assertRegex(text, r"joinery\s+0/1\s+1/1\s+1\s+7")


class MainTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        root = Path(self._tmp.name)
        self.ranking = root / "ranking"
        self.own = root / "own"
        self.ranking.mkdir()
        self.own.mkdir()
        for index, body in enumerate(GapTests.RANKING):
            (self.ranking / f"r{index}.txt").write_text(audit_text(body, boilerplate="zzboiler"), encoding="utf-8")
        for index, body in enumerate(GapTests.OWN):
            (self.own / f"o{index}.txt").write_text(audit_text(body, boilerplate="zzboiler"), encoding="utf-8")

    def test_prints_the_term_table_the_gaps_and_the_numa_only_terms(self) -> None:
        with captured() as (out, _):
            code = vocab_gap.main(["--ranking", str(self.ranking), "--own", str(self.own), "--min-pages", "3"])
        self.assertEqual(code, 0)
        text = out.getvalue()
        self.assertIn("ranking pages: 5 | own pages: 2", text)
        self.assertIn("=== US-versus-UK terms", text)
        self.assertIn("=== terms on at least", text)
        self.assertIn("custom millwork", text)
        self.assertIn("=== Numa vocabulary", text)
        self.assertIn("joinery", text)
        self.assertNotIn("zzboiler", text)

    def test_the_term_table_can_be_left_out(self) -> None:
        with captured() as (out, _):
            vocab_gap.main(["--ranking", str(self.ranking), "--own", str(self.own), "--no-terms"])
        self.assertNotIn("US-versus-UK", out.getvalue())

    def test_missing_input_exits_2(self) -> None:
        with captured():
            self.assertEqual(run_cli(vocab_gap.main, ["--ranking", "/no/such", "--own", str(self.own)]), 2)

    def test_the_options_are_required_and_validated(self) -> None:
        for argv in ([], ["--ranking", "x"], ["--ranking", "x", "--own", "y", "--min-share", "2"], ["--ranking", "x", "--own", "y", "--limit", "0"]):
            with self.subTest(argv=argv), captured(), self.assertRaises(SystemExit) as caught:
                vocab_gap.main(argv)
            self.assertEqual(caught.exception.code, 2)

    def test_the_repository_fixture_is_a_valid_page_text(self) -> None:
        self.assertTrue(vocab_gap.page_ngrams(vocab_gap.page_text(fixture_text("vocab", "audit-format.txt"))))
        self.assertTrue(fixture_path("vocab", "audit-format.txt").is_file())


if __name__ == "__main__":
    unittest.main()
