"""Tests for the HTML fact extractor, using a fixture page plus small inline pages for exact counts."""

from __future__ import annotations

import dataclasses
import unittest

from helpers import fixture_text

import html_facts  # noqa: E402
from html_facts import FormInfo, Heading, extract_facts  # noqa: E402

BASE = "https://example.test/services/millwork/"


def facts_of(html: str, base: str = BASE) -> html_facts.PageFacts:
    return extract_facts(html, base)


class HeadTagTests(unittest.TestCase):
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
    @classmethod
    def setUpClass(cls) -> None:
        cls.facts = facts_of(fixture_text("page_rich.html"))

    def test_json_ld_types_are_found_in_graphs_and_lists(self) -> None:
        self.assertEqual(self.facts.jsonld_types, ("Organization", "Product", "Service"))

    def test_invalid_json_ld_is_counted_not_raised(self) -> None:
        self.assertEqual(self.facts.jsonld_blocks, 2)
        self.assertEqual(self.facts.jsonld_errors, 1)

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

    def test_unclosed_and_stray_tags_do_not_raise(self) -> None:
        facts = facts_of("</div></div><p>stray <b>bold <i>italic<h2>heading</p><a href='/x'>open anchor")
        self.assertGreater(facts.words_total, 0)

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
