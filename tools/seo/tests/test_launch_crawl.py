"""Tests for the launch check's crawl: which addresses are fetched, in which order, and what is recorded for each."""

from __future__ import annotations

import unittest
from typing import List, Sequence

from launch_support import FakeWeb, ORIGIN

import launch_crawl  # noqa: E402
from fetch_pages import FetchResult  # noqa: E402
from launch_crawl import Crawl, Fetched  # noqa: E402
from launch_model import Site  # noqa: E402
from seo_common import SeoToolError  # noqa: E402

LOCAL = "http://127.0.0.1:4573"


def page(*hrefs: str, title: str = "T") -> str:
    links = "".join(f'<a href="{href}">link</a>' for href in hrefs)
    return f"<html><head><title>{title}</title></head><body><h1>H</h1>{links}</body></html>"


def run(web: FakeWeb, seeds: Sequence[str] = (ORIGIN + "/",), max_pages: int = 60, base: str = ORIGIN + "/") -> Crawl:
    return launch_crawl.crawl_site(Site.create(base, ORIGIN, "live"), web, seeds, max_pages)


def requested(crawl: Crawl) -> List[str]:
    return [item.requested for item in crawl.fetched]


class UrlKeyTests(unittest.TestCase):
    def test_a_fragment_is_not_part_of_the_address(self) -> None:
        self.assertEqual(launch_crawl.url_key("https://a.test/x/#top"), "https://a.test/x/")

    def test_scheme_and_host_ignore_case_but_the_path_does_not(self) -> None:
        self.assertEqual(launch_crawl.url_key("HTTPS://A.Test/About/"), "https://a.test/About/")

    def test_an_empty_path_is_the_root(self) -> None:
        self.assertEqual(launch_crawl.url_key("https://a.test"), "https://a.test/")

    def test_the_query_is_kept(self) -> None:
        self.assertEqual(launch_crawl.url_key("https://a.test/x?a=1&b=2#f"), "https://a.test/x?a=1&b=2")

    def test_text_that_cannot_be_read_as_an_address_is_only_cut_at_the_fragment(self) -> None:
        self.assertEqual(launch_crawl.url_key("http://[::1/x#f"), "http://[::1/x")


class IsHtmlTests(unittest.TestCase):
    def result(self, content_type: str, body: bytes = b"") -> FetchResult:
        headers = (("content-type", content_type),) if content_type else ()
        return FetchResult(requested="u", final_url="u", status=200, headers=headers, body=body)

    def test_html_content_types(self) -> None:
        for kind in ("text/html", "text/html; charset=utf-8", "TEXT/HTML", "application/xhtml+xml"):
            with self.subTest(kind=kind):
                self.assertTrue(launch_crawl.is_html(self.result(kind)))

    def test_other_content_types_are_not_html_whatever_the_body_looks_like(self) -> None:
        for kind in ("application/json", "image/jpeg", "application/pdf", "text/plain", "application/xml"):
            with self.subTest(kind=kind):
                self.assertFalse(launch_crawl.is_html(self.result(kind, b"<!DOCTYPE html><html>")))

    def test_without_a_content_type_the_start_of_the_body_decides(self) -> None:
        self.assertTrue(launch_crawl.is_html(self.result("", b"\n  <!DOCTYPE html><html></html>")))
        self.assertTrue(launch_crawl.is_html(self.result("", b"<HTML><body>")))
        self.assertFalse(launch_crawl.is_html(self.result("", b'{"a": 1}')))
        self.assertFalse(launch_crawl.is_html(self.result("", b"")))


class CrawlOrderTests(unittest.TestCase):
    def test_the_seed_is_fetched_first_then_its_links_in_the_order_they_appear(self) -> None:
        web = FakeWeb()
        web.add(ORIGIN + "/", page("/b/", "/a/"))
        web.add(ORIGIN + "/a/", page("/c/"))
        web.add(ORIGIN + "/b/", page())
        web.add(ORIGIN + "/c/", page())
        self.assertEqual(requested(run(web)), [ORIGIN + p for p in ("/", "/b/", "/a/", "/c/")])

    def test_every_address_is_fetched_once_however_often_it_is_linked(self) -> None:
        web = FakeWeb()
        web.add(ORIGIN + "/", page("/a/", "/a/#top", "/b/", f"{ORIGIN}/a/"))
        web.add(ORIGIN + "/a/", page("/", "/b/"))
        web.add(ORIGIN + "/b/", page("/a/"))
        crawl = run(web)
        self.assertEqual(requested(crawl), [ORIGIN + p for p in ("/", "/a/", "/b/")])
        self.assertEqual([web.count(ORIGIN + p) for p in ("/", "/a/", "/b/")], [1, 1, 1])

    def test_seeds_come_first_and_repeats_are_dropped(self) -> None:
        web = FakeWeb()
        for path in ("/", "/x/", "/y/"):
            web.add(ORIGIN + path, page("/z/"))
        web.add(ORIGIN + "/z/", page())
        crawl = run(web, seeds=[ORIGIN + "/", ORIGIN + "/x/", ORIGIN + "/y/", ORIGIN + "/x/#again"])
        self.assertEqual(requested(crawl), [ORIGIN + p for p in ("/", "/x/", "/y/", "/z/")])
        self.assertEqual([item.is_seed for item in crawl.fetched], [True, True, True, False])

    def test_the_page_that_linked_first_is_remembered(self) -> None:
        web = FakeWeb()
        web.add(ORIGIN + "/", page("/a/", "/b/"))
        web.add(ORIGIN + "/a/", page("/b/", "/c/"))
        web.add(ORIGIN + "/b/", page())
        web.add(ORIGIN + "/c/", page())
        crawl = run(web)
        self.assertEqual({item.requested: item.source for item in crawl.fetched},
                         {ORIGIN + "/": "", ORIGIN + "/a/": ORIGIN + "/", ORIGIN + "/b/": ORIGIN + "/", ORIGIN + "/c/": ORIGIN + "/a/"})

    def test_relative_links_are_resolved_against_the_page_they_are_on(self) -> None:
        web = FakeWeb()
        web.add(ORIGIN + "/", page("/projects/"))
        web.add(ORIGIN + "/projects/", page("one/", "../about/"))
        web.add(ORIGIN + "/projects/one/", page())
        web.add(ORIGIN + "/about/", page())
        self.assertEqual(requested(run(web))[2:], [ORIGIN + "/projects/one/", ORIGIN + "/about/"])


class WhatIsNotFetchedTests(unittest.TestCase):
    def test_other_hosts_and_non_web_links_are_never_requested(self) -> None:
        web = FakeWeb()
        web.add(ORIGIN + "/", page("https://other.example.test/", "mailto:a@b.test", "tel:+15125550100", "javascript:void(0)", "#top", "/a/"))
        web.add(ORIGIN + "/a/", page())
        run(web)
        self.assertEqual(web.requests, [ORIGIN + "/", ORIGIN + "/a/"])

    def test_with_a_local_base_the_canonical_host_is_another_site_for_links(self) -> None:
        web = FakeWeb()
        web.add(LOCAL + "/", page(ORIGIN + "/about/", "/a/"))
        web.add(LOCAL + "/a/", page())
        crawl = run(web, seeds=[LOCAL + "/"], base=LOCAL + "/")
        self.assertEqual(requested(crawl), [LOCAL + "/", LOCAL + "/a/"])


class WhatIsRecordedTests(unittest.TestCase):
    def test_an_html_page_that_answers_200_carries_its_facts(self) -> None:
        web = FakeWeb().add(ORIGIN + "/", page(title="Home"))
        item = run(web).fetched[0]
        assert item.facts is not None
        self.assertEqual((item.facts.title, item.final_url, item.result.status), ("Home", ORIGIN + "/", 200))

    def test_the_facts_use_the_final_address_as_their_base(self) -> None:
        web = FakeWeb().redirect(ORIGIN + "/old", ORIGIN + "/new/").add(ORIGIN + "/new/", page("rel/"))
        web.add(ORIGIN + "/new/rel/", page())
        crawl = run(web, seeds=[ORIGIN + "/old"])
        self.assertEqual(requested(crawl), [ORIGIN + "/old", ORIGIN + "/new/rel/"])

    def test_a_file_that_is_not_html_is_fetched_but_not_read(self) -> None:
        web = FakeWeb().add(ORIGIN + "/", page("/brochure.pdf"))
        web.add(ORIGIN + "/brochure.pdf", b"%PDF-1.4 <a href='/hidden/'>", content_type="application/pdf")
        crawl = run(web)
        self.assertIsNone(crawl.fetched[1].facts)
        self.assertEqual(requested(crawl), [ORIGIN + "/", ORIGIN + "/brochure.pdf"])

    def test_a_missing_page_is_recorded_and_its_own_links_are_not_followed(self) -> None:
        web = FakeWeb().add(ORIGIN + "/", page("/gone/")).add(ORIGIN + "/gone/", page("/hidden/"), status=404)
        crawl = run(web)
        self.assertEqual((crawl.fetched[1].result.status, crawl.fetched[1].facts), (404, None))
        self.assertEqual(requested(crawl), [ORIGIN + "/", ORIGIN + "/gone/"])

    def test_a_failed_fetch_is_recorded_and_the_crawl_goes_on(self) -> None:
        web = FakeWeb().add(ORIGIN + "/", page("/down/", "/up/")).add(ORIGIN + "/down/", error="timed out").add(ORIGIN + "/up/", page())
        crawl = run(web)
        self.assertEqual([item.result.error for item in crawl.fetched], ["", "timed out", ""])
        self.assertIsNone(crawl.fetched[1].facts)

    def test_a_page_robots_txt_keeps_out_is_recorded_as_skipped(self) -> None:
        web = FakeWeb().add(ORIGIN + "/", page("/private/")).add(ORIGIN + "/private/", skipped="robots.txt disallows this URL")
        self.assertEqual(run(web).fetched[1].result.skipped, "robots.txt disallows this URL")

    def test_an_address_the_fetcher_refuses_becomes_an_error_result(self) -> None:
        web = FakeWeb().add(ORIGIN + "/", page("/with space/", "/a/")).add(ORIGIN + "/a/", page())
        web.fail_with(ORIGIN + "/with space/", SeoToolError("not a usable URL: 'x'"))
        crawl = run(web)
        self.assertEqual(requested(crawl), [ORIGIN + "/", ORIGIN + "/with space/", ORIGIN + "/a/"])
        self.assertEqual(crawl.fetched[1].result.error, "not a usable URL: 'x'")
        self.assertEqual(crawl.fetched[1].result.final_url, ORIGIN + "/with space/")

    def test_a_cut_off_page_is_not_read(self) -> None:
        web = FakeWeb().add(ORIGIN + "/", page("/a/"))
        original = web(ORIGIN + "/")
        cut = FetchResult(requested=original.requested, final_url=original.final_url, status=200,
                          headers=original.headers, body=original.body, truncated=True)
        crawl = launch_crawl.crawl_site(Site.create(ORIGIN, ORIGIN, "live"), lambda url: cut, [ORIGIN + "/"], 60)
        self.assertIsNone(crawl.fetched[0].facts)

    def test_bytes_that_are_not_utf8_do_not_stop_the_crawl(self) -> None:
        body = b"<html><head><title>Caf\xe9</title></head><body><a href='/a/'>a</a></body></html>"
        web = FakeWeb().add(ORIGIN + "/", body).add(ORIGIN + "/a/", page())
        crawl = run(web)
        assert crawl.fetched[0].facts is not None
        self.assertEqual(crawl.fetched[0].facts.title, "Caf�")
        self.assertEqual(len(crawl.fetched), 2)


class RedirectTests(unittest.TestCase):
    def test_a_redirect_is_followed_and_both_addresses_find_the_page(self) -> None:
        web = FakeWeb().add(ORIGIN + "/", page("/about")).redirect(ORIGIN + "/about", ORIGIN + "/about/")
        web.add(ORIGIN + "/about/", page())
        crawl = run(web)
        self.assertEqual(requested(crawl), [ORIGIN + "/", ORIGIN + "/about"])
        found = crawl.lookup(ORIGIN + "/about")
        assert found is not None
        self.assertEqual((found.final_url, len(found.result.redirects)), (ORIGIN + "/about/", 1))
        self.assertIs(crawl.lookup(ORIGIN + "/about/"), found)

    def test_an_address_an_earlier_fetch_already_ended_at_is_not_fetched_again(self) -> None:
        web = FakeWeb().add(ORIGIN + "/", page("/about", "/about/")).redirect(ORIGIN + "/about", ORIGIN + "/about/")
        web.add(ORIGIN + "/about/", page())
        crawl = run(web)
        self.assertEqual(web.requests, [ORIGIN + "/", ORIGIN + "/about"])
        self.assertEqual(len(crawl.fetched), 2)
        self.assertEqual(crawl.unvisited, ())

    def test_an_alias_met_after_its_page_is_fetched_too_and_the_first_visit_keeps_the_final_address(self) -> None:
        web = FakeWeb().add(ORIGIN + "/", page("/about/", "/about")).redirect(ORIGIN + "/about", ORIGIN + "/about/")
        web.add(ORIGIN + "/about/", page())
        crawl = run(web)
        self.assertEqual(requested(crawl), [ORIGIN + "/", ORIGIN + "/about/", ORIGIN + "/about"])
        first, alias = crawl.lookup(ORIGIN + "/about/"), crawl.lookup(ORIGIN + "/about")
        assert first is not None and alias is not None
        self.assertEqual((first.requested, alias.requested), (ORIGIN + "/about/", ORIGIN + "/about"))
        self.assertEqual(alias.final_url, ORIGIN + "/about/")


class LimitTests(unittest.TestCase):
    def test_the_crawl_stops_at_the_page_limit_and_lists_what_it_left(self) -> None:
        web = FakeWeb().add(ORIGIN + "/", page("/a/", "/b/", "/c/"))
        for name in "abc":
            web.add(f"{ORIGIN}/{name}/", page())
        crawl = run(web, max_pages=2)
        self.assertEqual(requested(crawl), [ORIGIN + "/", ORIGIN + "/a/"])
        self.assertEqual(crawl.unvisited, (ORIGIN + "/b/", ORIGIN + "/c/"))

    def test_nothing_is_left_when_the_limit_is_exactly_enough(self) -> None:
        web = FakeWeb().add(ORIGIN + "/", page("/a/")).add(ORIGIN + "/a/", page())
        crawl = run(web, max_pages=2)
        self.assertEqual((len(crawl.fetched), crawl.unvisited), (2, ()))

    def test_a_page_with_thousands_of_links_cannot_make_the_crawl_endless(self) -> None:
        links = [f"/p{number}/" for number in range(5000)]
        web = FakeWeb().add(ORIGIN + "/", page(*links))
        crawl = run(web, max_pages=10)
        self.assertEqual(len(crawl.fetched), 10)
        self.assertEqual(len(web.requests), 10)
        self.assertEqual(len(crawl.unvisited), 4991)

    def test_a_query_string_that_changes_forever_is_bounded_by_the_limit(self) -> None:
        class Endless(FakeWeb):
            def __call__(self, url: str) -> FetchResult:
                number = len(self.requests)
                self.requests.append(url)
                body = page(f"/?page={number + 1}").encode()
                return FetchResult(requested=url, final_url=url, status=200, headers=(("content-type", "text/html"),), body=body)

        crawl = run(Endless(), max_pages=7)
        self.assertEqual(len(crawl.fetched), 7)


class LookupTests(unittest.TestCase):
    def test_an_address_is_found_with_a_fragment_and_in_any_case_of_scheme_and_host(self) -> None:
        crawl = run(FakeWeb().add(ORIGIN + "/", page()))
        self.assertIsNotNone(crawl.lookup(ORIGIN + "/#top"))
        self.assertIsNotNone(crawl.lookup("HTTPS://NUMALIVING.US/"))

    def test_an_address_that_was_never_fetched_is_not_found(self) -> None:
        crawl = run(FakeWeb().add(ORIGIN + "/", page()))
        self.assertIsNone(crawl.lookup(ORIGIN + "/nowhere/"))

    def test_the_crawl_and_its_items_are_immutable(self) -> None:
        crawl = run(FakeWeb().add(ORIGIN + "/", page()))
        self.assertIsInstance(crawl.fetched, tuple)
        self.assertIsInstance(crawl.unvisited, tuple)
        self.assertIsInstance(crawl.fetched[0], Fetched)


if __name__ == "__main__":
    unittest.main()
