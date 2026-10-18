"""Tests for the extra page facts the launch check needs: how many <title> elements a page has, every canonical
link, every robots-style meta tag, the raw JSON-LD text and the URLs of the resources a page loads."""

from __future__ import annotations

import unittest

from helpers import fixture_text

import html_facts  # noqa: E402
import html_links  # noqa: E402
from html_facts import extract_facts  # noqa: E402

BASE = "https://example.test/about/"


def facts_of(html: str) -> html_facts.PageFacts:
    return extract_facts(html, BASE)


class TitleCountTests(unittest.TestCase):
    def test_a_page_without_a_title_has_none(self) -> None:
        self.assertEqual(facts_of("<html><body><p>text</p></body></html>").title_count, 0)

    def test_one_title_is_counted_once(self) -> None:
        self.assertEqual(facts_of("<head><title>Only</title></head>").title_count, 1)

    def test_every_title_element_is_counted_while_only_the_first_gives_the_text(self) -> None:
        facts = facts_of("<head><title>First</title><title>Second</title></head><body><title>Third</title></body>")
        self.assertEqual((facts.title_count, facts.title), (3, "First"))

    def test_an_svg_title_is_not_a_document_title(self) -> None:
        facts = facts_of("<head><title>Page</title></head><body><svg><title>Icon</title></svg></body>")
        self.assertEqual(facts.title_count, 1)

    def test_an_empty_title_still_counts(self) -> None:
        facts = facts_of("<head><title></title></head>")
        self.assertEqual((facts.title_count, facts.title), (1, ""))


class CanonicalLinkTests(unittest.TestCase):
    def test_a_page_without_one_has_none(self) -> None:
        self.assertEqual(facts_of('<head><link rel="stylesheet" href="/a.css"></head>').canonicals, ())

    def test_every_canonical_link_is_listed_in_order(self) -> None:
        html = '<head><link rel="canonical" href="/one/"><link rel="Canonical nofollow" href="/two/"></head>'
        self.assertEqual(facts_of(html).canonicals, ("/one/", "/two/"))

    def test_other_rel_values_and_links_without_an_address_are_not_canonical(self) -> None:
        html = '<head><link rel="alternate" href="/a/"><link rel="canonical"><link rel="next" href="/n/"></head>'
        self.assertEqual(facts_of(html).canonicals, ())

    def test_the_first_one_is_still_the_canonical_of_the_page(self) -> None:
        facts = facts_of('<head><link rel="canonical" href="/one/"><link rel="canonical" href="/two/"></head>')
        self.assertEqual(facts.canonical, "/one/")

    def test_an_empty_address_is_kept_so_a_check_can_see_it(self) -> None:
        self.assertEqual(facts_of('<head><link rel="canonical" href=""></head>').canonicals, ("",))


class RobotsMetaTests(unittest.TestCase):
    def test_a_page_without_any_has_none(self) -> None:
        self.assertEqual(facts_of('<head><meta name="description" content="x"></head>').robots_meta, ())

    def test_robots_googlebot_and_bingbot_tags_are_all_listed(self) -> None:
        html = (
            '<head><meta name="robots" content="index, follow"><meta name="GoogleBot" content="noindex">'
            '<meta name="bingbot" content="nofollow"><meta name="robots" content="max-image-preview:large"></head>'
        )
        self.assertEqual(
            facts_of(html).robots_meta, ("index, follow", "noindex", "nofollow", "max-image-preview:large")
        )

    def test_other_tags_and_tags_without_content_are_left_out(self) -> None:
        html = '<head><meta name="viewport" content="width=device-width"><meta name="robots"><meta name="slurp" content="noindex"></head>'
        self.assertEqual(facts_of(html).robots_meta, ())

    def test_the_first_robots_tag_is_still_the_robots_of_the_page(self) -> None:
        facts = facts_of('<head><meta name="robots" content="noindex"><meta name="robots" content="index"></head>')
        self.assertEqual(facts.robots, "noindex")


class JsonLdBlobTests(unittest.TestCase):
    def test_the_raw_text_of_each_block_is_kept_even_when_it_is_not_json(self) -> None:
        html = (
            '<script type="application/ld+json">{"@type":"Organization"}</script>'
            '<script type="application/ld+json">{"@type":</script>'
            "<script>var x = 1;</script>"
        )
        self.assertEqual(facts_of(html).jsonld_blobs, ('{"@type":"Organization"}', '{"@type":'))

    def test_escapes_inside_the_block_are_not_decoded(self) -> None:
        html = '<script type="application/ld+json">{"name":"a \\u003c b &amp; c"}</script>'
        self.assertEqual(facts_of(html).jsonld_blobs, ('{"name":"a \\u003c b &amp; c"}',))

    def test_a_page_without_json_ld_has_none(self) -> None:
        self.assertEqual(facts_of("<p>nothing</p>").jsonld_blobs, ())

    def test_the_block_count_matches_the_blobs(self) -> None:
        facts = facts_of(fixture_text("page_rich.html"))
        self.assertEqual(len(facts.jsonld_blobs), facts.jsonld_blocks)


class ResourceUrlTests(unittest.TestCase):
    def test_scripts_stylesheets_and_icons_are_resources(self) -> None:
        html = (
            '<head><script src="/a.js"></script><link rel="stylesheet" href="/b.css">'
            '<link rel="icon" href="/c.ico"><link rel="shortcut icon" href="/d.ico">'
            '<link rel="preload" as="font" href="/e.woff2"><link rel="manifest" href="/f.json"></head>'
        )
        self.assertEqual(
            facts_of(html).resource_urls, ("/a.js", "/b.css", "/c.ico", "/d.ico", "/e.woff2", "/f.json")
        )

    def test_images_and_picture_sources_list_every_candidate_address(self) -> None:
        html = (
            '<img src="/one.jpg" srcset="/one-480.jpg 480w, /one-800.jpg 800w" data-src="/lazy.jpg">'
            '<picture><source type="image/webp" srcset="/two.webp 1x,/two@2x.webp 2x"><img src="/two.jpg"></picture>'
        )
        self.assertEqual(
            facts_of(html).resource_urls,
            ("/one.jpg", "/one-480.jpg", "/one-800.jpg", "/lazy.jpg", "/two.webp", "/two@2x.webp", "/two.jpg"),
        )

    def test_frames_media_and_embedded_objects_are_resources(self) -> None:
        html = (
            '<iframe src="/frame/"></iframe><video src="/v.mp4" poster="/v.jpg"><track src="/v.vtt"></video>'
            '<audio src="/a.mp3"></audio><embed src="/e.swf"><object data="/o.pdf"></object>'
        )
        self.assertEqual(
            facts_of(html).resource_urls, ("/frame/", "/v.mp4", "/v.jpg", "/v.vtt", "/a.mp3", "/e.swf", "/o.pdf")
        )

    def test_navigation_links_and_hints_are_not_resources(self) -> None:
        html = (
            '<head><link rel="canonical" href="/c/"><link rel="alternate" hreflang="en" href="/en/">'
            '<link rel="next" href="/n/"><link rel="dns-prefetch" href="//cdn.example.test"></head>'
            '<body><a href="http://other.example/">other</a></body>'
        )
        self.assertEqual(facts_of(html).resource_urls, ())

    def test_empty_values_are_skipped(self) -> None:
        self.assertEqual(facts_of('<script src=""></script><img src="  "><link rel="stylesheet">').resource_urls, ())

    def test_absolute_http_addresses_are_kept_as_written(self) -> None:
        html = '<script src="http://cdn.example.test/x.js"></script><img srcset="http://i.example.test/a.jpg 1x">'
        self.assertEqual(
            facts_of(html).resource_urls, ("http://cdn.example.test/x.js", "http://i.example.test/a.jpg")
        )

    def test_the_function_works_on_a_tag_and_its_attributes_alone(self) -> None:
        self.assertEqual(html_links.resource_urls("script", {"src": "/a.js", "async": ""}), ["/a.js"])
        self.assertEqual(html_links.resource_urls("link", {"rel": "Stylesheet", "href": "/b.css"}), ["/b.css"])
        self.assertEqual(html_links.resource_urls("link", {"rel": "canonical", "href": "/c/"}), [])
        self.assertEqual(html_links.resource_urls("div", {"src": "/nope"}), [])


class NewFieldsAreImmutableTests(unittest.TestCase):
    def test_the_new_fields_are_tuples_and_default_to_empty(self) -> None:
        facts = facts_of(fixture_text("page_rich.html"))
        for name in ("canonicals", "robots_meta", "jsonld_blobs", "resource_urls"):
            self.assertIsInstance(getattr(facts, name), tuple, name)
        self.assertIsInstance(facts.title_count, int)
        self.assertEqual(facts_of("").resource_urls, ())


if __name__ == "__main__":
    unittest.main()
