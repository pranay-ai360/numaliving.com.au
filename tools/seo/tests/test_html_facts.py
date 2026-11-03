"""Tests for the HTML fact extractor, using a fixture page plus small inline pages for exact counts."""

from __future__ import annotations

import dataclasses
import time
import unittest
from typing import Dict
from unittest import mock

from helpers import fixture_text

import html_facts  # noqa: E402
import html_links  # noqa: E402
from html_facts import FormInfo, Heading, extract_facts  # noqa: E402

BASE = "https://example.test/services/millwork/"


def facts_of(html: str, base: str = BASE) -> html_facts.PageFacts:
    return extract_facts(html, base)


class HeadTagTests(unittest.TestCase):
    facts: html_facts.PageFacts
    @classmethod
    def setUpClass(cls) -> None:
        cls.facts = facts_of(fixture_text("page_rich.html"))

    def test_lang_title_and_description(self) -> None:
        self.assertEqual(self.facts.lang, "en-US")
        self.assertEqual(self.facts.title, "Custom Millwork for US Projects | Example Millwork")
        self.assertEqual(self.facts.description, "Example Millwork builds custom architectural millwork for US projects.")

    def test_robots_canonical_and_hreflang(self) -> None:
        self.assertEqual(self.facts.robots, "index, follow")
        self.assertEqual(self.facts.canonical, "https://example.test/services/millwork/")
        self.assertEqual(self.facts.hreflang, ("en-us", "en-gb"))

    def test_viewport_and_generator(self) -> None:
        self.assertTrue(self.facts.has_viewport)
        self.assertEqual(self.facts.generator, "Example Generator 2.1")

    def test_open_graph_and_twitter_tags(self) -> None:
        self.assertEqual(
            dict(self.facts.og),
            {
                "og:title": "Custom Millwork for US Projects",
                "og:type": "website",
                "og:image": "https://example.test/og/millwork.jpg",
            },
        )
        self.assertEqual(dict(self.facts.twitter), {"twitter:card": "summary_large_image", "twitter:title": "Custom Millwork"})

    def test_a_page_without_head_tags_has_empty_values(self) -> None:
        facts = facts_of("<html><body><p>Just text</p></body></html>")
        self.assertIsNone(facts.lang)
        self.assertEqual(facts.title, "")
        self.assertEqual(facts.description, "")
        self.assertIsNone(facts.robots)
        self.assertIsNone(facts.canonical)
        self.assertFalse(facts.has_viewport)
        self.assertEqual((facts.hreflang, facts.og, facts.twitter), ((), (), ()))

    def test_canonical_is_found_when_rel_has_several_tokens(self) -> None:
        facts = facts_of('<head><link rel="Canonical nofollow" href="https://example.test/x/"></head>')
        self.assertEqual(facts.canonical, "https://example.test/x/")

    def test_a_stylesheet_link_is_not_a_canonical(self) -> None:
        self.assertIsNone(facts_of('<head><link rel="stylesheet" href="/a.css"></head>').canonical)

    def test_first_meta_with_a_name_wins(self) -> None:
        facts = facts_of('<meta name="description" content="first"><meta name="description" content="second">')
        self.assertEqual(facts.description, "first")

    def test_title_decodes_entities_and_collapses_whitespace(self) -> None:
        self.assertEqual(facts_of("<title>  Fish &amp;\n   Chips </title>").title, "Fish & Chips")

    def test_only_the_first_title_counts_and_svg_titles_are_ignored(self) -> None:
        html = "<head><title>Real</title></head><body><svg><title>Icon</title></svg><title>Second</title></body>"
        self.assertEqual(facts_of(html).title, "Real")
        self.assertEqual(facts_of("<body><svg><title>Icon</title></svg></body>").title, "")


class HeadingTests(unittest.TestCase):
    def test_headings_keep_level_text_and_order(self) -> None:
        facts = facts_of(fixture_text("page_rich.html"))
        self.assertEqual(
            facts.headings,
            (
                Heading(1, "Custom millwork for US projects"),
                Heading(2, "What we make"),
                Heading(3, "Request a quote"),
            ),
        )
        self.assertEqual(facts.heading_texts(1), ("Custom millwork for US projects",))
        self.assertEqual(facts.heading_texts(2), ("What we make",))
        self.assertEqual(facts.heading_texts(4), ())

    def test_nested_markup_inside_a_heading_is_joined(self) -> None:
        facts = facts_of("<h2>Hello <em>big</em>\n world</h2>")
        self.assertEqual(facts.headings, (Heading(2, "Hello big world"),))


class LinkTests(unittest.TestCase):
    facts: html_facts.PageFacts
    by_text: Dict[str, html_facts.Link]
    @classmethod
    def setUpClass(cls) -> None:
        cls.facts = facts_of(fixture_text("page_rich.html"))
        cls.by_text = {link.text: link for link in cls.facts.links}

    def test_kinds(self) -> None:
        kinds = {text: link.kind for text, link in self.by_text.items()}
        self.assertEqual(kinds["Home"], "internal")
        self.assertEqual(kinds["our projects"], "internal")
        self.assertEqual(kinds["Social"], "external")
        self.assertEqual(kinds["standards guide"], "external")
        self.assertEqual(kinds["(212) 555-0123"], "tel")
        self.assertEqual(kinds["projects@example.test"], "mailto")

    def test_www_and_the_bare_domain_are_the_same_site(self) -> None:
        self.assertEqual(self.by_text["About us"].kind, "internal")
        self.assertEqual(self.by_text["About us"].url, "https://www.example.test/about/")

    def test_relative_links_are_resolved_against_the_base_url(self) -> None:
        self.assertEqual(self.by_text["Home"].url, "https://example.test/")
        self.assertEqual(self.by_text["our projects"].url, "https://example.test/projects/")

    def test_fragment_only_and_javascript_links_are_skipped(self) -> None:
        self.assertNotIn("top", self.by_text)
        self.assertNotIn("Script link", self.by_text)
        self.assertEqual(len(self.facts.links), 10)

    def test_boilerplate_means_nav_header_footer_or_aside(self) -> None:
        for text in ("Home", "Services", "About us", "Social", "Resources", "Privacy"):
            self.assertTrue(self.by_text[text].in_boilerplate, text)
        for text in ("our projects", "standards guide", "(212) 555-0123"):
            self.assertFalse(self.by_text[text].in_boilerplate, text)

    def test_rel_is_kept(self) -> None:
        self.assertEqual(self.by_text["standards guide"].rel, "nofollow")

    def test_links_of_filters_by_kind_and_boilerplate(self) -> None:
        self.assertEqual(len(self.facts.links_of("internal")), 6)
        self.assertEqual([link.text for link in self.facts.links_of("internal", include_boilerplate=False)], ["our projects"])
        self.assertEqual(len(self.facts.links_of("external")), 2)

    def test_anchor_text_joins_nested_elements(self) -> None:
        facts = facts_of('<a href="/x"><span>Hello</span> world</a>')
        self.assertEqual(facts.links[0].text, "Hello world")

    def test_a_port_is_part_of_the_site_identity(self) -> None:
        html = '<a href="http://127.0.0.1:4302/y">same</a><a href="http://127.0.0.1:9999/y">other</a>'
        facts = facts_of(html, "http://127.0.0.1:4302/x/")
        kinds = {link.text: link.kind for link in facts.links}
        self.assertEqual(kinds, {"same": "internal", "other": "external"})

    def test_other_schemes_are_labelled_other(self) -> None:
        facts = facts_of('<a href="sms:+15550100">text us</a>')
        self.assertEqual(facts.links[0].kind, "other")


class ImageTests(unittest.TestCase):
    facts: html_facts.PageFacts
    by_src: Dict[str, html_facts.Image]
    @classmethod
    def setUpClass(cls) -> None:
        cls.facts = facts_of(fixture_text("page_rich.html"))
        cls.by_src = {image.src: image for image in cls.facts.images}

    def test_there_are_five_images(self) -> None:
        self.assertEqual(len(self.facts.images), 5)

    def test_alt_text_states_are_told_apart(self) -> None:
        self.assertEqual(self.by_src["/img/lobby.jpg"].alt, "Oak wall paneling in a hotel lobby")
        self.assertEqual(self.by_src["/img/decorative.jpg"].alt, "")
        self.assertIsNone(self.by_src["/img/unlabelled.jpg"].alt)

    def test_size_loading_and_srcset(self) -> None:
        lobby = self.by_src["/img/lobby.jpg"]
        self.assertTrue(lobby.has_size)
        self.assertEqual(lobby.loading, "lazy")
        self.assertTrue(lobby.has_srcset)
        plain = self.by_src["/img/unlabelled.jpg"]
        self.assertEqual((plain.has_size, plain.loading, plain.has_srcset), (False, "", False))
        self.assertEqual(self.by_src["/img/door.jpg"].loading, "eager")

    def test_images_in_the_header_are_boilerplate(self) -> None:
        self.assertTrue(self.by_src["/logo.svg"].in_boilerplate)
        self.assertFalse(self.by_src["/img/lobby.jpg"].in_boilerplate)

    def test_only_one_of_width_and_height_is_not_sized(self) -> None:
        facts = facts_of('<img src="/a.jpg" alt="a" width="10">')
        self.assertFalse(facts.images[0].has_size)

    def test_data_src_is_used_when_there_is_no_src(self) -> None:
        facts = facts_of('<img data-src="/lazy.jpg" alt="lazy">')
        self.assertEqual(facts.images[0].src, "/lazy.jpg")

    def test_picture_source_types_are_collected(self) -> None:
        self.assertEqual(self.facts.image_source_types, ("image/webp", "image/avif"))


class StructuredDataAndScriptTests(unittest.TestCase):
    facts: html_facts.PageFacts
    @classmethod
    def setUpClass(cls) -> None:
        cls.facts = facts_of(fixture_text("page_rich.html"))

    def test_json_ld_types_are_found_in_graphs_and_lists(self) -> None:
        self.assertEqual(self.facts.jsonld_types, ("Organization", "Product", "Service"))

    def test_invalid_json_ld_is_counted_not_raised(self) -> None:
        self.assertEqual(self.facts.jsonld_blocks, 2)
        self.assertEqual(self.facts.jsonld_errors, 1)

    def test_only_text_values_are_types(self) -> None:
        html = '<script type="application/ld+json">{"@type":[1,null,{"x":1},[2],"Product"],"n":NaN}</script>'
        self.assertEqual(facts_of(html).jsonld_types, ("Product",))

    def test_a_huge_integer_in_json_ld_cannot_crash_extraction(self) -> None:
        """From Python 3.11 json.loads raises a plain ValueError for 5000 digits; before that it parses them."""
        facts = facts_of('<script type="application/ld+json">{"@type":"Thing","n":' + "1" * 5000 + "}</script>")
        self.assertEqual(facts.jsonld_blocks, 1)
        self.assertEqual(facts.jsonld_types + (("Thing",) if facts.jsonld_errors else ()), ("Thing",))

    def test_a_deeply_nested_type_list_cannot_crash_extraction(self) -> None:
        deep = "[" * 100_000 + "]" * 100_000
        facts = facts_of('<script type="application/ld+json">{"@type":' + deep + "}</script>")
        self.assertEqual(facts.jsonld_types, ())
        self.assertEqual(facts.jsonld_blocks, 1)

    def test_a_very_long_type_is_cut(self) -> None:
        facts = facts_of('<script type="application/ld+json">{"@type":"' + "T" * 5000 + '"}</script>')
        self.assertLessEqual(len(facts.jsonld_types[0]), html_facts.MAX_TYPE_CHARS)

    def test_json_ld_without_any_type_gives_no_types(self) -> None:
        facts = facts_of('<script type="application/ld+json">{"name": "x"}</script>')
        self.assertEqual((facts.jsonld_types, facts.jsonld_blocks, facts.jsonld_errors), ((), 1, 0))

    def test_script_counts_leave_json_ld_out(self) -> None:
        self.assertEqual(self.facts.scripts_external, 2)
        self.assertEqual(self.facts.scripts_inline, 1)

    def test_forms(self) -> None:
        self.assertEqual(self.facts.forms, (FormInfo(action="/contact/", method="post"),))
        self.assertEqual(facts_of("<form></form>").forms, (FormInfo(action="", method="get"),))


class WordAndTextTests(unittest.TestCase):
    PAGE = (
        "<html><body><header>one two</header><nav>three</nav>"
        "<main><h1>four five</h1><p>six seven eight</p></main>"
        "<aside>nine</aside><footer>ten eleven</footer></body></html>"
    )

    def test_main_words_exclude_nav_header_footer_and_aside(self) -> None:
        facts = facts_of(self.PAGE)
        self.assertEqual(facts.words_main, 5)
        self.assertEqual(facts.words_total, 11)

    def test_text_lines_are_split_into_main_and_boilerplate(self) -> None:
        facts = facts_of(self.PAGE)
        self.assertEqual(facts.main_lines, ("four five", "six seven eight"))
        self.assertEqual(facts.boilerplate_lines, ("one two", "three", "nine", "ten eleven"))

    def test_scripts_styles_noscript_and_svg_text_are_not_words(self) -> None:
        html = (
            "<p>visible</p><script>var hidden = 'a b c d';</script><style>.x { color: red }</style>"
            "<noscript>no script words</noscript><svg><text>icon words</text></svg>"
        )
        self.assertEqual(facts_of(html).words_total, 1)

    def test_inline_markup_does_not_split_a_line(self) -> None:
        facts = facts_of("<p>Hello <b>bold</b> and <a href='/x'>linked</a> text</p>")
        self.assertEqual(facts.main_lines, ("Hello bold and linked text",))

    def test_us_phone_numbers_are_found_in_common_formats(self) -> None:
        html = "<p>Call (212) 555-0123, 212-555-0124, 212.555.0125 or +1 212 555 0126.</p>"
        self.assertEqual(
            facts_of(html).phones,
            ("(212) 555-0123", "+1 212 555 0126", "212-555-0124", "212.555.0125"),
        )

    def test_dates_and_long_numbers_are_not_phone_numbers(self) -> None:
        self.assertEqual(facts_of("<p>On 2026-10-18 we shipped 2125550123 parts, ref 12345-67890.</p>").phones, ())


class ImpliedEndTagTests(unittest.TestCase):
    """HTML lets authors and minifiers leave out end tags; the extractor must read such pages as a browser does."""

    def test_an_omitted_head_end_tag_does_not_hide_the_body_text(self) -> None:
        html = "<html><head><title>T</title><body><h1>Hello big world</h1><p>Some body text here</p></body></html>"
        facts = facts_of(html)
        self.assertEqual(facts.title, "T")
        self.assertEqual(facts.heading_texts(1), ("Hello big world",))
        self.assertEqual(facts.main_lines, ("Hello big world", "Some body text here"))
        self.assertEqual(facts.words_main, 7)

    def test_content_without_a_body_tag_ends_the_head_too(self) -> None:
        facts = facts_of("<head><title>T</title><meta charset=utf-8><div>Body words</div>")
        self.assertEqual((facts.title, facts.words_main), ("T", 2))

    def test_the_usual_head_children_stay_in_the_head(self) -> None:
        html = (
            "<head><title>T</title><meta name=description content=d><link rel=canonical href=/c>"
            "<script src=/a.js></script><style>x{}</style><noscript>no js</noscript><template>t</template></head>"
            "<body>real</body>"
        )
        facts = facts_of(html)
        self.assertEqual((facts.words_main, facts.description, facts.canonical), (1, "d", "/c"))

    def test_a_new_anchor_finishes_the_open_one(self) -> None:
        facts = facts_of('<body><a href="/one">one<a href="/two">two</a> <a href="/three">three</body>')
        self.assertEqual([(link.url, link.text) for link in facts.links], [
            ("https://example.test/one", "one"), ("https://example.test/two", "two"), ("https://example.test/three", "three"),
        ])

    def test_an_anchor_left_open_at_the_end_of_the_page_is_kept(self) -> None:
        facts = facts_of('<p>text</p><a href="/x">open anchor')
        self.assertEqual([(link.url, link.text) for link in facts.links], [("https://example.test/x", "open anchor")])

    def test_a_heading_end_tag_of_another_level_closes_the_open_heading(self) -> None:
        facts = facts_of("<h1>Title</h2><p>text</p><h2>Second</h2>")
        self.assertEqual(facts.headings, (Heading(1, "Title"), Heading(2, "Second")))
        self.assertEqual(facts.main_lines, ("Title", "text", "Second"))

    def test_a_heading_left_open_at_the_end_of_the_page_is_kept(self) -> None:
        self.assertEqual(facts_of("<p>x</p><h1>Never closed").headings, (Heading(1, "Never closed"),))

    def test_a_new_heading_finishes_the_open_one(self) -> None:
        self.assertEqual(facts_of("<h1>One<h2>Two</h2>").headings, (Heading(1, "One"), Heading(2, "Two")))

    def test_an_end_tag_also_closes_the_elements_left_open_inside_it(self) -> None:
        facts = facts_of("<div><nav>menu</div><p>after</p>")
        self.assertEqual(facts.main_lines, ("after",))
        self.assertEqual(facts.boilerplate_lines, ("menu",))

    def test_an_end_tag_with_nothing_open_to_close_changes_nothing(self) -> None:
        facts = facts_of("<nav>menu</div><p>still the nav</p>")
        self.assertEqual(facts.boilerplate_lines, ("menu", "still the nav"))

    def test_a_byte_order_mark_at_the_start_is_not_text(self) -> None:
        facts = facts_of("\ufeff<!doctype html><html><body><p>Hello</p></body></html>")
        self.assertEqual(facts.main_lines, ("Hello",))
        self.assertEqual(facts.words_total, 1)


class AttributeAndLinkTests(unittest.TestCase):
    def test_when_an_attribute_is_repeated_the_first_one_wins_like_in_a_browser(self) -> None:
        facts = facts_of('<a href="/first" href="/second">dup</a>')
        self.assertEqual([link.url for link in facts.links], ["https://example.test/first"])

    def test_protocol_relative_links_are_internal_only_on_the_same_site(self) -> None:
        facts = facts_of('<a href="//cdn.other.test/x">cdn</a><a href="//example.test/y">same</a><a href="//www.example.test/z">www</a>')
        self.assertEqual([(link.url, link.kind) for link in facts.links], [
            ("https://cdn.other.test/x", "external"), ("https://example.test/y", "internal"),
            ("https://www.example.test/z", "internal"),
        ])

    def test_javascript_links_are_skipped_whatever_their_spelling(self) -> None:
        for href in ("javascript:void(0)", "JavaScript:void(0)", " JAVASCRIPT:alert(1)", "Java\tScript:alert(1)", "java\nscript:alert(1)"):
            with self.subTest(href=href):
                self.assertEqual(facts_of(f'<a href="{href}">x</a>').links, ())

    def test_mailto_and_tel_links_are_told_apart_in_any_case(self) -> None:
        facts = facts_of('<a href="MAILTO:a@b.c">m</a><a href="Tel: +1 212 555 0100">t</a><a href="mailto:x@y.z">n</a>')
        self.assertEqual([link.kind for link in facts.links], ["mailto", "tel", "mailto"])

    def test_other_schemes_and_broken_addresses_are_other(self) -> None:
        facts = facts_of('<a href="data:text/html,hi">d</a><a href="ftp://example.test/x">f</a><a href="whatsapp://send?text=1">w</a><a href="http://[::1/x">b</a>')
        self.assertEqual({link.kind for link in facts.links}, {"other"})

    def test_empty_and_fragment_only_links_are_skipped(self) -> None:
        self.assertEqual(facts_of('<a href="#top">t</a><a href="#">h</a><a href="">e</a><a>nohref</a>').links, ())


class LeftoverBranchTests(unittest.TestCase):
    def test_an_end_tag_for_a_void_element_is_ignored(self) -> None:
        facts = facts_of("<p>one</br>two</img></p>")
        self.assertEqual(facts.main_lines, ("onetwo",))

    def test_a_json_ld_script_that_never_ends_is_still_counted(self) -> None:
        facts = facts_of('<script type="application/ld+json">{"@type":"Thing"')
        self.assertEqual((facts.jsonld_blocks, facts.jsonld_errors), (1, 1))

    def test_an_address_urljoin_hands_back_unsplittable_is_a_link_of_another_kind(self) -> None:
        anchor = html_links.Anchor("x", "", "text", False)
        with mock.patch.object(html_links, "urljoin", return_value="http://["):
            link = html_facts.classify_link(anchor, BASE)
        assert link is not None
        self.assertEqual((link.kind, link.url), ("other", "x"))


class BlockBoundaryTests(unittest.TestCase):
    def test_a_line_break_inside_a_heading_separates_its_words(self) -> None:
        self.assertEqual(facts_of("<h1>Alpha<br>Beta</h1>").headings, (Heading(1, "Alpha Beta"),))

    def test_block_elements_inside_a_link_separate_its_words(self) -> None:
        facts = facts_of('<a href="/x">One<div>Two</div>Three</a>')
        self.assertEqual(facts.links[0].text, "One Two Three")

    def test_inline_elements_inside_a_heading_or_link_still_join_without_a_space(self) -> None:
        facts = facts_of('<h1>Cus<span>tom</span> <b>mill</b>work</h1><a href="/x">Read<em>ing</em></a>')
        self.assertEqual(facts.headings, (Heading(1, "Custom millwork"),))
        self.assertEqual(facts.links[0].text, "Reading")


class WordCountTests(unittest.TestCase):
    def test_choices_in_a_dropdown_and_a_text_area_are_not_page_words(self) -> None:
        html = (
            "<main><p>Choose a state</p><select><option>Alabama</option><option>Alaska</option></select>"
            "<textarea>Type here</textarea></main>"
        )
        facts = facts_of(html)
        self.assertEqual(facts.main_lines, ("Choose a state",))
        self.assertEqual(facts.words_main, 3)

    def test_an_option_group_and_a_datalist_are_form_controls_too(self) -> None:
        html = "<p>x</p><select><optgroup label=L><option>Texas</option></optgroup></select><datalist><option>Ohio</option></datalist>"
        self.assertEqual(facts_of(html).words_total, 1)

    def test_adjacent_buttons_stay_separate_words(self) -> None:
        facts = facts_of("<button>Save</button><button>Cancel</button><span>A</span><span>B</span>")
        self.assertEqual(facts.main_lines, ("Save", "Cancel", "AB"))
        self.assertEqual(facts.words_main, 3)

    def test_punctuation_alone_is_not_a_word(self) -> None:
        self.assertEqual(facts_of("<p>Fast \u2014 reliable \u2022 tested | proven</p>").words_main, 4)
        self.assertEqual(facts_of("<p>- * / \u00a9 ... </p>").words_main, 0)

    def test_numbers_single_letters_and_mixed_tokens_are_words(self) -> None:
        self.assertEqual(facts_of("<p>4 x 8 sheets, 3D models (2026)</p>").words_main, 7)

    def test_words_in_other_scripts_are_words(self) -> None:
        self.assertEqual(facts_of("<p>caf\u00e9 \u6728\u5de5 \u0434\u0430</p>").words_main, 3)


class DeepMarkupTests(unittest.TestCase):
    """Hostile or sloppy pages with tens of thousands of unclosed elements must not take minutes to read."""

    LIMIT_SECONDS = 5.0

    def timed(self, html: str) -> html_facts.PageFacts:
        started = time.perf_counter()
        facts = facts_of(html)
        self.assertLess(time.perf_counter() - started, self.LIMIT_SECONDS)
        return facts

    def test_twenty_thousand_list_items_without_end_tags(self) -> None:
        facts = self.timed("<ul>" + "<li>item" * 20_000)
        self.assertEqual(facts.words_main, 20_000)

    def test_forty_thousand_unclosed_divs(self) -> None:
        facts = self.timed("<div>x" * 40_000)
        self.assertEqual(facts.words_main, 40_000)

    def test_inline_elements_nested_twenty_thousand_deep(self) -> None:
        facts = self.timed("<i>" * 20_000 + "a<br>" * 20_000)
        self.assertEqual(facts.words_main, 20_000)

    def test_twenty_thousand_anchors_without_end_tags(self) -> None:
        facts = self.timed('<a href="/x">' * 20_000 + "end")
        self.assertEqual(len(facts.links), 20_000)

    def test_text_in_a_deep_nav_is_still_boilerplate(self) -> None:
        facts = self.timed("<nav>" + "<div>" * 300 + "menu word")
        self.assertEqual((facts.words_main, facts.words_total), (0, 2))

    def test_nesting_is_capped_like_a_browser_does(self) -> None:
        self.assertEqual(html_facts.MAX_STACK_DEPTH, 512)
        facts = self.timed("<div>" * 600 + "deep text" + "</div>" * 600 + "<p>after</p>")
        self.assertEqual(facts.main_lines, ("deep text", "after"))


class PlatformSignatureScopeTests(unittest.TestCase):
    def test_outbound_links_and_alt_text_are_not_signatures(self) -> None:
        html = (
            '<a href="https://wordpress.com/wp-content/uploads/x.png" title="webflow site">link</a>'
            '<img src="/own.png" alt="Shopify theme, /wp-content/ and woocommerce">'
            '<input placeholder="elementor" value="hubspot"><meta name="description" content="built with squarespace">'
        )
        self.assertEqual(facts_of(html).platforms, ())

    def test_class_names_and_resource_tags_still_reveal_the_platform(self) -> None:
        html = (
            '<div class="elementor-section et_pb_row"><img src="https://cdn.shopify.com/s/files/1/x.png"></div>'
            '<iframe src="https://js.hs-scripts.com/1.js"></iframe><div data-elementor-type="wp-page"></div>'
        )
        self.assertEqual(set(facts_of(html).platforms), {"elementor", "divi", "shopify", "hubspot"})

    def test_the_generator_meta_tag_can_name_the_platform(self) -> None:
        self.assertIn("elementor", facts_of('<meta name="generator" content="Elementor 3.5.6">').platforms)
        self.assertEqual(facts_of('<meta name="author" content="Elementor Fans">').platforms, ())

    def test_inline_styles_that_load_resources_count(self) -> None:
        html = '<div style="background:url(/wp-content/uploads/hero.jpg)"></div>'
        self.assertIn("wordpress", facts_of(html).platforms)

    def test_platform_signatures_live_in_one_module_and_are_reexported(self) -> None:
        import platform_signatures

        self.assertIs(html_facts.PLATFORM_SIGNATURES, platform_signatures.PLATFORM_SIGNATURES)
        self.assertIs(html_facts.detect_platforms, platform_signatures.detect_platforms)


class PlatformSignatureTests(unittest.TestCase):
    def platforms(self, html: str) -> tuple:
        return facts_of(html).platforms

    def test_next_js_from_a_static_asset_path(self) -> None:
        self.assertIn("next.js", self.platforms('<script src="/_next/static/chunks/main.js"></script>'))

    def test_wordpress_from_a_theme_path(self) -> None:
        self.assertIn("wordpress", self.platforms('<link rel="stylesheet" href="/wp-content/themes/x/style.css">'))

    def test_google_tag_manager_container_does_not_imply_ga4(self) -> None:
        platforms = self.platforms('<script src="https://www.googletagmanager.com/gtm.js?id=GTM-ABCD123"></script>')
        self.assertIn("gtm", platforms)
        self.assertNotIn("ga4", platforms)

    def test_ga4_from_the_gtag_loader_and_a_config_call(self) -> None:
        html = (
            '<script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC1234567"></script>'
            "<script>window.dataLayer = []; function gtag(){dataLayer.push(arguments);} "
            "gtag('config', 'G-ABC1234567');</script>"
        )
        platforms = self.platforms(html)
        self.assertIn("ga4", platforms)
        self.assertNotIn("gtm", platforms)

    def test_ga4_is_not_reported_for_ordinary_text_and_class_names(self) -> None:
        """Regression: the prototype matched its GA4 pattern case-insensitively against the whole page.

        Tailwind class names such as bg-background or ring-offset-background look like a "G-" measurement
        id when case is ignored, and prose that merely mentions Google-Analytics.com or gtag( matched too.
        """
        html = (
            '<body class="bg-background text-foreground"><div class="bg-gradient-to-b ring-offset-background">'
            "<p>We never use Google-Analytics.com, GTAG( or the G-ABCDEFGHIJ sort of tag; G-force is physics.</p>"
            "</div></body>"
        )
        self.assertNotIn("ga4", self.platforms(html))

    def test_code_shown_as_page_text_is_not_a_signature(self) -> None:
        """Only markup is searched: a tutorial that prints the GA4 snippet, or names paths, does not run them."""
        html = (
            "<body><pre>&lt;script async src=\"https://www.googletagmanager.com/gtag/js?id=G-ABC1234567\"&gt;"
            "&lt;/script&gt;\ngtag('config', 'G-ABC1234567');</pre>"
            "<p>Next.js serves /_next/static and WordPress serves /wp-content/ paths.</p></body>"
        )
        self.assertEqual(self.platforms(html), ())

    def test_a_measurement_id_must_be_upper_case_and_quoted(self) -> None:
        self.assertNotIn("ga4", self.platforms("<script>var id = 'g-abc1234567';</script>"))
        self.assertNotIn("ga4", self.platforms("<script>var id = G-ABC1234567;</script>"))
        self.assertIn("ga4", self.platforms("<script>var id = 'G-ABC1234567';</script>"))

    def test_text_that_names_a_platform_is_not_a_signature(self) -> None:
        html = "<p>Our shop runs on Shopify, WordPress, Cloudflare and Webflow; ask about Elementor and HubSpot.</p>"
        self.assertEqual(self.platforms(html), ())

    def test_a_comment_can_carry_a_signature(self) -> None:
        self.assertIn("yoast", self.platforms("<!-- This site is optimized with the Yoast SEO plugin v21.0 -->"))

    def test_meta_pixel_and_hubspot_loaders(self) -> None:
        html = '<script src="https://connect.facebook.net/en_US/fbevents.js"></script><script src="//js.hs-scripts.com/1.js"></script>'
        platforms = self.platforms(html)
        self.assertIn("meta-pixel", platforms)
        self.assertIn("hubspot", platforms)

    def test_detect_platforms_works_on_plain_markup(self) -> None:
        self.assertEqual(html_facts.detect_platforms("href=/wp-content/x"), ("wordpress",))
        self.assertEqual(html_facts.detect_platforms(""), ())


class RobustnessTests(unittest.TestCase):
    def test_empty_input(self) -> None:
        facts = facts_of("")
        self.assertEqual((facts.words_total, facts.links, facts.images, facts.headings), (0, (), (), ()))

    def test_unclosed_and_stray_tags_are_read_as_a_browser_would(self) -> None:
        facts = facts_of("</div></div><p>stray <b>bold <i>italic<h2>heading</p><a href='/x'>open anchor")
        self.assertEqual(facts.main_lines, ("stray bold italic", "heading", "open anchor"))
        self.assertEqual(facts.words_main, 6)
        self.assertEqual(facts.headings, (Heading(2, "heading open anchor"),))  # the h2 was never closed
        self.assertEqual([(link.url, link.text) for link in facts.links], [("https://example.test/x", "open anchor")])

    def test_non_html_text_is_just_text(self) -> None:
        self.assertEqual(facts_of("plain words only").words_total, 3)

    def test_facts_are_frozen_and_use_tuples(self) -> None:
        facts = facts_of(fixture_text("page_rich.html"))
        with self.assertRaises(dataclasses.FrozenInstanceError):
            facts.title = "changed"  # type: ignore[misc]
        for name in ("hreflang", "og", "twitter", "headings", "links", "images", "jsonld_types", "forms", "phones",
                     "platforms", "main_lines", "boilerplate_lines", "image_source_types"):
            self.assertIsInstance(getattr(facts, name), tuple, name)

    def test_the_same_input_gives_equal_facts(self) -> None:
        html = fixture_text("page_rich.html")
        self.assertEqual(facts_of(html), facts_of(html))


if __name__ == "__main__":
    unittest.main()
