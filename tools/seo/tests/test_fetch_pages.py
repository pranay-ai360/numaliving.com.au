"""Tests for the polite page fetcher: robots.txt, Crawl-delay, redirects, scheme checks and saved files.

A fake opener and a fake clock stand in for the network and for time, so nothing here waits or goes online.
"""

from __future__ import annotations

import gzip
import json
import socket
import tempfile
import unittest
import urllib.error
import urllib.request
import zlib
from pathlib import Path
from unittest import mock
from urllib.parse import urlsplit

from helpers import FakeClock, FakeOpener, Reply, captured
from loopback import LoopbackServer, Page, free_port

import fetch_pages  # noqa: E402
from fetch_pages import FetchResult, PoliteFetcher, RedirectHop  # noqa: E402
from seo_common import SeoToolError, run_cli  # noqa: E402

SITE = "https://site.test"
ROBOTS = f"{SITE}/robots.txt"
PAGE = f"{SITE}/page/"
ROBOTS_WITH_RULES = b"User-agent: *\nDisallow: /private/\nCrawl-delay: 10\n"
HTML = b"<html><head><title>Hi</title></head><body><p>Hello</p></body></html>"


def make_fetcher(routes, delay=1.5, seconds_per_request=0.25):
    clock = FakeClock()
    opener = FakeOpener(routes, clock=clock, seconds_per_request=seconds_per_request)
    fetcher = PoliteFetcher(opener, delay=delay, clock=clock, sleep=clock.sleep)
    return fetcher, opener, clock


def gaps(times):
    return [later - earlier for earlier, later in zip(times, times[1:])]


class DecodeBodyTests(unittest.TestCase):
    def test_identity_body_is_returned_as_is(self) -> None:
        self.assertEqual(fetch_pages.decode_body(b"plain", ""), (b"plain", False))
        self.assertEqual(fetch_pages.decode_body(b"plain", "identity"), (b"plain", False))

    def test_gzip_and_x_gzip(self) -> None:
        packed = gzip.compress(b"hello gzip")
        self.assertEqual(fetch_pages.decode_body(packed, "gzip"), (b"hello gzip", False))
        self.assertEqual(fetch_pages.decode_body(packed, "x-gzip"), (b"hello gzip", False))

    def test_deflate_with_and_without_the_zlib_header(self) -> None:
        wrapped = zlib.compress(b"hello deflate")
        raw = zlib.compressobj(wbits=-zlib.MAX_WBITS)
        bare = raw.compress(b"hello deflate") + raw.flush()
        self.assertEqual(fetch_pages.decode_body(wrapped, "deflate"), (b"hello deflate", False))
        self.assertEqual(fetch_pages.decode_body(bare, "deflate"), (b"hello deflate", False))

    def test_the_encoding_name_is_case_insensitive(self) -> None:
        self.assertEqual(fetch_pages.decode_body(gzip.compress(b"x"), " GZip "), (b"x", False))

    def test_output_is_capped_and_flagged_as_truncated(self) -> None:
        body, truncated = fetch_pages.decode_body(gzip.compress(b"a" * 1000), "gzip", limit=100)
        self.assertEqual(len(body), 100)
        self.assertTrue(truncated)

    def test_identity_body_over_the_limit_is_cut(self) -> None:
        body, truncated = fetch_pages.decode_body(b"b" * 50, "", limit=10)
        self.assertEqual((len(body), truncated), (10, True))

    def test_an_incomplete_compressed_stream_is_flagged_as_truncated(self) -> None:
        packed = gzip.compress(b"c" * 500)
        body, truncated = fetch_pages.decode_body(packed[: len(packed) // 2], "gzip")
        self.assertTrue(truncated)
        self.assertTrue(set(body) <= {ord("c")})

    def test_unsupported_encoding_is_an_error(self) -> None:
        with self.assertRaises(ValueError) as caught:
            fetch_pages.decode_body(b"x", "br")
        self.assertIn("br", str(caught.exception))

    def test_corrupt_data_is_an_error(self) -> None:
        with self.assertRaises(ValueError):
            fetch_pages.decode_body(b"this is not gzip", "gzip")


class RobotsPolicyTests(unittest.TestCase):
    def reply(self, status=200, body=b"", error=""):
        return fetch_pages.RawReply(status=None if error else status, headers=(), body=body, error=error)

    def test_rules_and_crawl_delay_are_read_from_a_200_answer(self) -> None:
        policy = fetch_pages.policy_from_reply(self.reply(body=ROBOTS_WITH_RULES))
        self.assertEqual(policy.crawl_delay, 10.0)
        self.assertEqual(policy.refusal(f"{SITE}/private/x"), "robots.txt disallows this URL")
        self.assertEqual(policy.refusal(f"{SITE}/public/x"), "")

    def test_a_group_for_another_robot_does_not_apply(self) -> None:
        policy = fetch_pages.policy_from_reply(self.reply(body=b"User-agent: BadBot\nDisallow: /\n"))
        self.assertEqual(policy.refusal(f"{SITE}/anything"), "")
        self.assertEqual(policy.crawl_delay, 0.0)

    def test_robots_txt_itself_is_always_allowed(self) -> None:
        policy = fetch_pages.policy_from_reply(self.reply(body=b"User-agent: *\nDisallow: /\n"))
        self.assertEqual(policy.refusal(ROBOTS), "")
        self.assertNotEqual(policy.refusal(PAGE), "")

    def test_a_missing_robots_file_means_no_rules(self) -> None:
        for status in (404, 410, 400, 451):
            with self.subTest(status=status):
                policy = fetch_pages.policy_from_reply(self.reply(status=status))
                self.assertEqual(policy.refusal(PAGE), "")

    def test_401_and_403_mean_keep_out(self) -> None:
        for status in (401, 403):
            with self.subTest(status=status):
                policy = fetch_pages.policy_from_reply(self.reply(status=status))
                self.assertIn(str(status), policy.refusal(PAGE))

    def test_server_errors_and_rate_limits_mean_unknown_so_skip(self) -> None:
        for status in (429, 500, 503):
            with self.subTest(status=status):
                policy = fetch_pages.policy_from_reply(self.reply(status=status))
                self.assertIn(str(status), policy.refusal(PAGE))

    def test_a_network_error_means_unknown_so_skip(self) -> None:
        policy = fetch_pages.policy_from_reply(self.reply(error="URLError: boom"))
        self.assertIn("boom", policy.refusal(PAGE))

    def test_a_crawl_delay_beyond_the_cap_blocks_the_host(self) -> None:
        body = f"User-agent: *\nCrawl-delay: {int(fetch_pages.MAX_CRAWL_DELAY_SECONDS) + 1}\n".encode()
        policy = fetch_pages.policy_from_reply(self.reply(body=body))
        self.assertIn("Crawl-delay", policy.refusal(PAGE))

    def test_undecodable_bytes_in_robots_txt_do_not_crash(self) -> None:
        policy = fetch_pages.policy_from_reply(self.reply(body=b"User-agent: *\nDisallow: /caf\xe9/\n"))
        self.assertEqual(policy.refusal(f"{SITE}/other"), "")

    def test_a_byte_order_mark_does_not_hide_the_first_group(self) -> None:
        policy = fetch_pages.policy_from_reply(self.reply(body=b"\xef\xbb\xbf" + ROBOTS_WITH_RULES))
        self.assertEqual(policy.refusal(f"{SITE}/private/x"), "robots.txt disallows this URL")
        self.assertEqual(policy.crawl_delay, 10.0)

    def test_rule_order_and_wildcards_are_applied_the_same_way_on_every_python(self) -> None:
        cases = (
            ("allow-all first, then a disallow", b"User-agent: *\nAllow: /\nDisallow: /private/\n", "/private/secret", True),
            ("end anchor", b"User-agent: *\nDisallow: /*.pdf$\n", "/files/brochure.pdf", True),
            ("trailing star", b"User-agent: *\nDisallow: /private*\n", "/private-area/x", True),
            ("query rule", b"User-agent: *\nDisallow: /*?session=\n", "/page?session=abc", True),
            ("longer allow wins", b"User-agent: *\nDisallow: /a\nAllow: /a/b/\n", "/a/b/c", False),
            ("plain rule", b"User-agent: *\nDisallow: /private/\n", "/private/secret", True),
            ("other path is fine", b"User-agent: *\nDisallow: /private/\n", "/public", False),
        )
        for label, body, path, refused in cases:
            with self.subTest(label=label):
                policy = fetch_pages.policy_from_reply(self.reply(body=body))
                self.assertEqual(bool(policy.refusal(f"{SITE}{path}")), refused)

    def test_a_decimal_crawl_delay_is_read_as_a_number(self) -> None:
        policy = fetch_pages.policy_from_reply(self.reply(body=b"User-agent: *\nCrawl-delay: 2.5\n"))
        self.assertEqual(policy.crawl_delay, 2.5)

    def test_hostile_crawl_delay_values_cannot_crash_the_policy(self) -> None:
        for value in ("9" * 400, "9" * 5000, "²", "٥", "1e999", "soon"):
            with self.subTest(value=value[:12]):
                policy = fetch_pages.policy_from_reply(self.reply(body=f"User-agent: *\nCrawl-delay: {value}\n".encode()))
                self.assertIsInstance(policy, fetch_pages.RobotsPolicy)
        huge = fetch_pages.policy_from_reply(self.reply(body=("User-agent: *\nCrawl-delay: " + "9" * 400 + "\n").encode()))
        self.assertIn("Crawl-delay", huge.refusal(PAGE))

    def test_a_utf16_robots_txt_skips_the_site_because_its_rules_cannot_be_trusted(self) -> None:
        policy = fetch_pages.policy_from_reply(self.reply(body="User-agent: *\nDisallow: /\n".encode("utf-16")))
        self.assertIn("UTF-8", policy.refusal(PAGE))

    def test_the_query_string_is_part_of_what_a_rule_is_matched_against(self) -> None:
        policy = fetch_pages.policy_from_reply(self.reply(body=b"User-agent: *\nDisallow: /*?session=\n"))
        self.assertTrue(policy.refusal(f"{SITE}/page?session=1"))
        self.assertEqual(policy.refusal(f"{SITE}/page?x=1"), "")
        self.assertEqual(policy.refusal(f"{SITE}/page#session=1"), "")

    def test_the_decimal_delay_is_shown_in_the_refusal_when_it_is_too_long(self) -> None:
        policy = fetch_pages.policy_from_reply(self.reply(body=b"User-agent: *\nCrawl-delay: 61.5\n"))
        self.assertIn("61.5", policy.refusal(PAGE))


class FetchTests(unittest.TestCase):
    def test_returns_status_body_selected_headers_and_size(self) -> None:
        headers = {"Content-Type": "text/html", "Server": "fake", "X-Unlisted": "dropped"}
        fetcher, _, _ = make_fetcher({ROBOTS: Reply(404), PAGE: Reply(200, HTML, headers)})
        result = fetcher.fetch(PAGE)
        self.assertEqual(result.status, 200)
        self.assertEqual(result.body, HTML)
        self.assertEqual(dict(result.headers), {"content-type": "text/html", "server": "fake"})
        self.assertEqual(result.final_url, PAGE)
        self.assertEqual(result.error, "")
        self.assertEqual(result.skipped, "")

    def test_sends_a_realistic_browser_user_agent(self) -> None:
        fetcher, opener, _ = make_fetcher({ROBOTS: Reply(404), PAGE: Reply(200, HTML)})
        fetcher.fetch(PAGE)
        self.assertEqual(set(opener.user_agents), {fetch_pages.USER_AGENT})
        self.assertIn("Mozilla/5.0", fetch_pages.USER_AGENT)
        self.assertIn("Chrome/", fetch_pages.USER_AGENT)
        self.assertEqual(opener.request_headers[-1]["Accept-encoding"], "gzip, deflate")

    def test_robots_txt_is_read_once_per_host(self) -> None:
        routes = {ROBOTS: Reply(404), f"{SITE}/a": Reply(200, HTML), f"{SITE}/b": Reply(200, HTML), f"{SITE}/c": Reply(200, HTML)}
        fetcher, opener, _ = make_fetcher(routes)
        for name in ("a", "b", "c"):
            fetcher.fetch(f"{SITE}/{name}")
        self.assertEqual(opener.urls.count(ROBOTS), 1)

    def test_each_host_gets_its_own_robots_txt_read(self) -> None:
        other = "https://other.test"
        routes = {ROBOTS: Reply(404), f"{other}/robots.txt": Reply(404), PAGE: Reply(200, HTML), f"{other}/p": Reply(200, HTML)}
        fetcher, opener, _ = make_fetcher(routes)
        fetcher.fetch(PAGE)
        fetcher.fetch(f"{other}/p")
        self.assertEqual(opener.urls.count(ROBOTS), 1)
        self.assertEqual(opener.urls.count(f"{other}/robots.txt"), 1)

    def test_a_disallowed_url_is_recorded_as_skipped_and_never_requested(self) -> None:
        private = f"{SITE}/private/report"
        fetcher, opener, _ = make_fetcher({ROBOTS: Reply(200, ROBOTS_WITH_RULES), private: Reply(200, HTML)})
        result = fetcher.fetch(private)
        self.assertIn("robots.txt", result.skipped)
        self.assertIsNone(result.status)
        self.assertEqual(result.body, b"")
        self.assertNotIn(private, opener.urls)

    def test_wildcard_and_ordering_rules_stop_the_request_itself(self) -> None:
        """The reviewer's inputs: a disallowed page was requested on Python 3.9, 3.11 and 3.14 alike."""
        cases = (
            (b"User-agent: *\nAllow: /\nDisallow: /private/\n", f"{SITE}/private/secret"),
            (b"User-agent: *\nDisallow: /*.pdf$\n", f"{SITE}/files/brochure.pdf"),
            (b"User-agent: *\nDisallow: /private*\n", f"{SITE}/private-area/x"),
            (b"User-agent: *\nDisallow: /*?session=\n", f"{SITE}/page?session=abc"),
            (b"\xef\xbb\xbfUser-agent: *\nDisallow: /secret/\n", f"{SITE}/secret/a"),
        )
        for robots, url in cases:
            with self.subTest(url=url):
                fetcher, opener, _ = make_fetcher({ROBOTS: Reply(200, robots), url: Reply(200, HTML)})
                result = fetcher.fetch(url)
                self.assertIn("robots.txt", result.skipped)
                self.assertNotIn(url, opener.urls)

    def test_allowed_urls_next_to_disallowed_ones_are_still_fetched(self) -> None:
        fetcher, _, _ = make_fetcher({ROBOTS: Reply(200, ROBOTS_WITH_RULES), PAGE: Reply(200, HTML)})
        self.assertEqual(fetcher.fetch(PAGE).status, 200)

    def test_a_longer_crawl_delay_than_the_default_delay_wins(self) -> None:
        routes = {ROBOTS: Reply(200, ROBOTS_WITH_RULES), f"{SITE}/a": Reply(200, HTML), f"{SITE}/b": Reply(200, HTML)}
        fetcher, opener, _ = make_fetcher(routes, delay=1.5)
        fetcher.fetch(f"{SITE}/a")
        fetcher.fetch(f"{SITE}/b")
        spacing = gaps(opener.times_for(SITE))
        self.assertEqual(len(spacing), 2)  # robots.txt counts as a request too
        self.assertTrue(all(gap >= 10 for gap in spacing), spacing)

    def test_a_longer_delay_than_the_crawl_delay_wins(self) -> None:
        routes = {ROBOTS: Reply(200, ROBOTS_WITH_RULES), f"{SITE}/a": Reply(200, HTML), f"{SITE}/b": Reply(200, HTML)}
        fetcher, opener, _ = make_fetcher(routes, delay=30)
        fetcher.fetch(f"{SITE}/a")
        fetcher.fetch(f"{SITE}/b")
        self.assertTrue(all(gap >= 30 for gap in gaps(opener.times_for(SITE))))

    def test_the_default_delay_applies_when_robots_txt_has_no_crawl_delay(self) -> None:
        routes = {ROBOTS: Reply(404), f"{SITE}/a": Reply(200, HTML), f"{SITE}/b": Reply(200, HTML)}
        fetcher, opener, _ = make_fetcher(routes, delay=1.5)
        fetcher.fetch(f"{SITE}/a")
        fetcher.fetch(f"{SITE}/b")
        spacing = gaps(opener.times_for(SITE))
        self.assertTrue(all(gap >= 1.5 for gap in spacing), spacing)
        self.assertTrue(all(gap < 3 for gap in spacing), spacing)

    def test_no_pause_is_needed_between_different_hosts(self) -> None:
        other = "https://other.test"
        routes = {ROBOTS: Reply(404), f"{other}/robots.txt": Reply(404), PAGE: Reply(200, HTML), f"{other}/p": Reply(200, HTML)}
        fetcher, opener, clock = make_fetcher(routes, delay=1.5)
        fetcher.fetch(PAGE)
        fetcher.fetch(f"{other}/p")
        # One pause per host (between its robots.txt and its page), none when switching hosts.
        self.assertEqual(len(clock.sleeps), 2)
        self.assertTrue(all(abs(pause - 1.5) < 1e-9 for pause in clock.sleeps), clock.sleeps)

    def test_zero_delay_never_sleeps_without_a_crawl_delay(self) -> None:
        fetcher, _, clock = make_fetcher({ROBOTS: Reply(404), f"{SITE}/a": Reply(200, HTML), f"{SITE}/b": Reply(200, HTML)}, delay=0)
        fetcher.fetch(f"{SITE}/a")
        fetcher.fetch(f"{SITE}/b")
        self.assertEqual(clock.sleeps, [])

    def test_every_redirect_hop_is_recorded_and_followed(self) -> None:
        routes = {
            "http://site.test/robots.txt": Reply(404),
            ROBOTS: Reply(404),
            "http://site.test/a": Reply(301, b"", {"Location": "https://site.test/a"}),
            f"{SITE}/a": Reply(308, b"", {"Location": "/a/"}),
            f"{SITE}/a/": Reply(200, HTML),
        }
        fetcher, _, _ = make_fetcher(routes)
        result = fetcher.fetch("http://site.test/a")
        self.assertEqual(result.status, 200)
        self.assertEqual(result.final_url, f"{SITE}/a/")
        self.assertEqual(
            result.redirects,
            (RedirectHop(301, "http://site.test/a", f"{SITE}/a"), RedirectHop(308, f"{SITE}/a", f"{SITE}/a/")),
        )
        self.assertEqual(result.requested, "http://site.test/a")

    def test_a_redirect_to_a_file_url_is_refused(self) -> None:
        routes = {ROBOTS: Reply(404), PAGE: Reply(302, b"", {"Location": "file:///etc/hosts"})}
        fetcher, opener, _ = make_fetcher(routes)
        result = fetcher.fetch(PAGE)
        self.assertIn("http", result.error)
        self.assertEqual(result.status, 302)
        self.assertFalse([url for url in opener.urls if url.startswith("file:")])

    def test_a_redirect_to_ftp_is_refused(self) -> None:
        routes = {ROBOTS: Reply(404), PAGE: Reply(301, b"", {"Location": "ftp://files.test/x"})}
        fetcher, opener, _ = make_fetcher(routes)
        self.assertTrue(fetcher.fetch(PAGE).error)
        self.assertFalse([url for url in opener.urls if url.startswith("ftp:")])

    def test_a_redirect_without_a_location_is_the_final_answer(self) -> None:
        fetcher, _, _ = make_fetcher({ROBOTS: Reply(404), PAGE: Reply(302, b"moved")})
        result = fetcher.fetch(PAGE)
        self.assertEqual((result.status, result.error, result.redirects), (302, "", ()))

    def test_a_redirect_loop_gives_up_with_an_error(self) -> None:
        a, b = f"{SITE}/a", f"{SITE}/b"
        routes = {ROBOTS: Reply(404), a: Reply(301, b"", {"Location": b}), b: Reply(301, b"", {"Location": a})}
        fetcher, opener, _ = make_fetcher(routes, delay=0)
        result = fetcher.fetch(a)
        self.assertIn("redirect", result.error)
        self.assertLessEqual(len(opener.urls), fetch_pages.MAX_REDIRECTS + 2)

    def test_a_redirect_into_a_disallowed_path_is_skipped(self) -> None:
        target = f"{SITE}/private/x"
        routes = {
            ROBOTS: Reply(200, ROBOTS_WITH_RULES),
            f"{SITE}/a": Reply(301, b"", {"Location": "/private/x"}),
            target: Reply(200, HTML),
        }
        fetcher, opener, _ = make_fetcher(routes)
        result = fetcher.fetch(f"{SITE}/a")
        self.assertIn("robots.txt", result.skipped)
        self.assertEqual(result.redirects, (RedirectHop(301, f"{SITE}/a", target),))
        self.assertNotIn(target, opener.urls)

    def test_client_and_server_error_pages_keep_their_bodies(self) -> None:
        routes = {ROBOTS: Reply(404), f"{SITE}/gone": Reply(404, b"custom not found page"), f"{SITE}/boom": Reply(500, b"oops")}
        fetcher, _, _ = make_fetcher(routes)
        gone, boom = fetcher.fetch(f"{SITE}/gone"), fetcher.fetch(f"{SITE}/boom")
        self.assertEqual((gone.status, gone.body, gone.error), (404, b"custom not found page", ""))
        self.assertEqual((boom.status, boom.body, boom.error), (500, b"oops", ""))

    def test_network_failures_are_recorded_not_raised(self) -> None:
        for failure in (urllib.error.URLError("no route"), socket.timeout("timed out"), ConnectionResetError("reset")):
            with self.subTest(failure=type(failure).__name__):
                fetcher, _, _ = make_fetcher({ROBOTS: Reply(404), PAGE: failure})
                result = fetcher.fetch(PAGE)
                self.assertIsNone(result.status)
                self.assertIn(type(failure).__name__, result.error)

    def test_gzip_bodies_are_decoded(self) -> None:
        fetcher, _, _ = make_fetcher({ROBOTS: Reply(404), PAGE: Reply(200, gzip.compress(HTML), {"Content-Encoding": "gzip"})})
        self.assertEqual(fetcher.fetch(PAGE).body, HTML)

    def test_an_unsupported_encoding_is_an_error(self) -> None:
        fetcher, _, _ = make_fetcher({ROBOTS: Reply(404), PAGE: Reply(200, b"xx", {"Content-Encoding": "br"})})
        result = fetcher.fetch(PAGE)
        self.assertIn("br", result.error)
        self.assertEqual(result.status, 200)

    def test_the_body_is_capped(self) -> None:
        fetcher, _, _ = make_fetcher({ROBOTS: Reply(404), PAGE: Reply(200, b"z" * 500)})
        with mock.patch.object(fetch_pages, "MAX_BYTES", 100):
            result = fetcher.fetch(PAGE)
        self.assertEqual(len(result.body), 100)
        self.assertTrue(result.truncated)

    def test_elapsed_time_counts_requests_and_not_politeness_pauses(self) -> None:
        fetcher, _, _ = make_fetcher({ROBOTS: Reply(404), PAGE: Reply(200, HTML)}, delay=5, seconds_per_request=0.25)
        self.assertEqual(fetcher.fetch(PAGE).elapsed_ms, 250)

    def test_a_non_http_start_url_is_refused_before_any_request(self) -> None:
        fetcher, opener, _ = make_fetcher({})
        with self.assertRaises(SeoToolError):
            fetcher.fetch("file:///etc/passwd")
        self.assertEqual(opener.urls, [])

    def test_robots_txt_itself_can_be_fetched_even_when_everything_is_disallowed(self) -> None:
        fetcher, _, _ = make_fetcher({ROBOTS: Reply(200, b"User-agent: *\nDisallow: /\n")})
        result = fetcher.fetch(ROBOTS)
        self.assertEqual((result.status, result.skipped), (200, ""))

    def test_a_robots_txt_that_redirects_is_followed(self) -> None:
        routes = {
            "http://site.test/robots.txt": Reply(301, b"", {"Location": ROBOTS}),
            ROBOTS: Reply(200, b"User-agent: *\nDisallow: /private/\n"),
            "http://site.test/private/x": Reply(200, HTML),
        }
        fetcher, opener, _ = make_fetcher(routes)
        result = fetcher.fetch("http://site.test/private/x")
        self.assertIn("robots.txt", result.skipped)
        self.assertNotIn("http://site.test/private/x", opener.urls)

    def test_an_unreadable_robots_txt_skips_the_host_with_a_reason(self) -> None:
        for reply in (Reply(403), Reply(503), urllib.error.URLError("down")):
            with self.subTest(reply=repr(reply)[:30]):
                fetcher, opener, _ = make_fetcher({ROBOTS: reply, PAGE: Reply(200, HTML)})
                result = fetcher.fetch(PAGE)
                self.assertIn("robots.txt", result.skipped)
                self.assertNotIn(PAGE, opener.urls)

    def test_a_missing_robots_txt_allows_everything(self) -> None:
        fetcher, _, _ = make_fetcher({ROBOTS: Reply(404), PAGE: Reply(200, HTML)})
        self.assertEqual(fetcher.fetch(PAGE).status, 200)


ROBOTS_BLOCKING_PRIVATE = b"User-agent: *\nDisallow: /private/\n"
DNS = {
    "localhost": ("127.0.0.1", "::1"), "intranet.test": ("10.1.2.3",), "rebind.test": ("93.184.216.34", "10.0.0.9"),
    "2130706433": ("127.0.0.1",), "0x7f.0.0.1": ("127.0.0.1",), "0": ("0.0.0.0",), "elsewhere.test": ("93.184.216.34",),
}
PRIVATE_TARGETS = (
    "http://127.0.0.1:8080/admin/reboot", "http://localhost:3000/logout", "http://[::1]:9000/",
    "http://169.254.169.254/latest/meta-data/", "http://192.168.1.1/cgi-bin/restart", "http://10.0.0.5/",
    "http://[::ffff:7f00:1]/", "http://2130706433/", "http://0x7f.0.0.1/", "http://0/", "http://intranet.test/",
    "http://rebind.test/x",
)


class PrivateRedirectTests(unittest.TestCase):
    """A public page must not be able to send this tool to the owner's own machine or network."""

    PAGE = "https://public.test/page"
    PUBLIC_ROBOTS = "https://public.test/robots.txt"

    def fetcher(self, routes, allow_private=False, resolver=lambda host: DNS.get(host, ())):
        clock = FakeClock()
        opener = FakeOpener(routes, clock=clock, seconds_per_request=0.1)
        fetcher = PoliteFetcher(
            opener, delay=0, clock=clock, sleep=clock.sleep, allow_private_hosts=allow_private, resolver=resolver
        )
        return fetcher, opener

    def test_a_redirect_to_a_local_or_private_address_is_refused_and_never_requested(self) -> None:
        for target in PRIVATE_TARGETS:
            with self.subTest(target=target):
                routes = {self.PUBLIC_ROBOTS: Reply(404), self.PAGE: Reply(302, b"", {"Location": target}),
                          target: Reply(200, b"INTERNAL")}
                fetcher, opener = self.fetcher(routes)
                result = fetcher.fetch(self.PAGE)
                self.assertEqual(result.status, 302)
                self.assertIn("refused", result.error)
                self.assertIn("--allow-private-hosts", result.error)
                self.assertEqual(opener.urls, [self.PUBLIC_ROBOTS, self.PAGE])
                self.assertEqual(result.body, b"")

    def test_a_redirect_to_another_public_host_is_followed(self) -> None:
        routes = {self.PUBLIC_ROBOTS: Reply(404), self.PAGE: Reply(301, b"", {"Location": "https://elsewhere.test/landing"}),
                  "https://elsewhere.test/robots.txt": Reply(404), "https://elsewhere.test/landing": Reply(200, HTML)}
        fetcher, _ = self.fetcher(routes)
        self.assertEqual(fetcher.fetch(self.PAGE).status, 200)

    def test_a_redirect_that_stays_on_the_requested_host_is_not_checked_even_when_that_host_is_local(self) -> None:
        """The owner's own local preview: the address was asked for, and /about -> /about/ must keep working."""

        def no_dns(host: str):
            raise AssertionError("no lookup is needed when the host is the one that was asked for")

        def robots_of(url: str) -> str:
            parts = urlsplit(url)
            return f"{parts.scheme}://{parts.netloc.lower()}/robots.txt"

        cases = (
            ("http://127.0.0.1:8000/about", "http://127.0.0.1:8000/about/"),
            ("http://localhost:3000/a", "http://LOCALHOST:3000/a/"),
            ("http://127.0.0.1:8000/a", "http://127.0.0.1:9000/b"),
            ("http://[::1]:8000/a", "http://[::1]:8000/a/"),
        )
        for start, hop in cases:
            with self.subTest(start=start, hop=hop):
                routes = {robots_of(start): Reply(404), robots_of(hop): Reply(404),
                          start: Reply(301, b"", {"Location": hop}), hop: Reply(200, HTML)}
                fetcher, _ = self.fetcher(routes, resolver=no_dns)
                self.assertEqual(fetcher.fetch(start).status, 200)

    def test_the_flag_follows_such_redirects(self) -> None:
        target = "http://127.0.0.1:8080/admin"
        routes = {self.PUBLIC_ROBOTS: Reply(404), self.PAGE: Reply(302, b"", {"Location": target}),
                  "http://127.0.0.1:8080/robots.txt": Reply(404), target: Reply(200, HTML)}
        fetcher, opener = self.fetcher(routes, allow_private=True)
        self.assertEqual(fetcher.fetch(self.PAGE).status, 200)
        self.assertIn(target, opener.urls)

    def test_a_robots_txt_that_redirects_to_a_private_address_skips_the_site(self) -> None:
        target = "http://127.0.0.1:8080/robots.txt"
        routes = {self.PUBLIC_ROBOTS: Reply(301, b"", {"Location": target}), target: Reply(200, b""), self.PAGE: Reply(200, HTML)}
        fetcher, opener = self.fetcher(routes)
        result = fetcher.fetch(self.PAGE)
        self.assertIn("robots.txt could not be read", result.skipped)
        self.assertIn("refused", result.skipped)
        self.assertEqual(opener.urls, [self.PUBLIC_ROBOTS])

    def test_a_name_that_does_not_resolve_is_left_to_fail_by_itself(self) -> None:
        target = "https://nowhere.test/x"
        routes = {self.PUBLIC_ROBOTS: Reply(404), self.PAGE: Reply(302, b"", {"Location": target}),
                  "https://nowhere.test/robots.txt": Reply(404), target: urllib.error.URLError("no such host")}
        fetcher, opener = self.fetcher(routes)
        result = fetcher.fetch(self.PAGE)
        self.assertIn("no such host", result.error)
        self.assertIn(target, opener.urls)

    def test_the_default_resolver_is_the_operating_systems(self) -> None:
        import url_guard

        fetcher = PoliteFetcher(FakeOpener({}))
        self.assertIs(fetcher._resolve, url_guard.resolve_addresses)


class RealOpenerTests(unittest.TestCase):
    """The real urllib opener against a loopback server: redirects, headers, gzip, error bodies and schemes.

    FakeOpener replaces urllib in the other tests, so without these a change such as building the opener with
    plain build_opener() (which follows redirects by itself and skips every per-hop robots.txt check) would pass.
    """

    def setUp(self) -> None:
        proxies = mock.patch("urllib.request.getproxies", return_value={})  # never send loopback traffic to a proxy
        proxies.start()
        self.addCleanup(proxies.stop)

    def serve(self, routes):
        server = LoopbackServer(routes)
        server.__enter__()
        self.addCleanup(server.__exit__, None, None, None)
        return server

    def fetcher(self) -> PoliteFetcher:
        return PoliteFetcher(fetch_pages.default_opener(), delay=0)

    def test_status_headers_and_body_arrive(self) -> None:
        server = self.serve({"/robots.txt": Page(404), "/p": Page(200, HTML, [("Content-Type", "text/html"), ("Server", "loop")])})
        result = self.fetcher().fetch(server.url("/p"))
        self.assertEqual((result.status, result.body, result.error), (200, HTML, ""))
        self.assertEqual(dict(result.headers), {"content-type": "text/html", "server": "loop"})

    def test_repeated_response_headers_are_all_kept(self) -> None:
        page = Page(200, HTML, [
            ("Content-Type", "text/html"),
            ("X-Robots-Tag", "all"), ("X-Robots-Tag", "googlebot: noindex"),
            ("Link", "</a.css>; rel=preload"), ("Link", "<https://x.test/>; rel=canonical"),
        ])
        server = self.serve({"/robots.txt": Page(404), "/p": page})
        headers = dict(self.fetcher().fetch(server.url("/p")).headers)
        self.assertEqual(headers["x-robots-tag"], "all, googlebot: noindex")
        self.assertEqual(headers["link"], "</a.css>; rel=preload, <https://x.test/>; rel=canonical")

    def test_a_redirect_into_a_disallowed_path_is_stopped_before_it_is_requested(self) -> None:
        routes = {
            "/robots.txt": Page(200, ROBOTS_BLOCKING_PRIVATE),
            "/start": Page(302, b"", [("Location", "/private/secret")]),
            "/private/secret": Page(200, b"SECRET"),
        }
        server = self.serve(routes)
        result = self.fetcher().fetch(server.url("/start"))
        self.assertIn("robots.txt", result.skipped)
        self.assertEqual(result.redirects[0].target, server.url("/private/secret"))
        self.assertNotIn("/private/secret", server.paths)

    def test_every_hop_of_a_redirect_chain_is_requested_and_recorded(self) -> None:
        routes = {
            "/robots.txt": Page(404),
            "/a": Page(301, b"", [("Location", "/b")]),
            "/b": Page(307, b"", [("Location", "/c?x=1")]),
            "/c?x=1": Page(200, HTML),
        }
        server = self.serve(routes)
        result = self.fetcher().fetch(server.url("/a"))
        self.assertEqual(result.status, 200)
        self.assertEqual([hop.status for hop in result.redirects], [301, 307])
        self.assertEqual(result.final_url, server.url("/c?x=1"))
        self.assertEqual(server.paths, ["/robots.txt", "/a", "/b", "/c?x=1"])

    def test_a_redirect_to_another_scheme_is_refused(self) -> None:
        for location in ("ftp://127.0.0.1/x", "file:///etc/hosts", "data:text/plain,hi", "javascript:alert(1)"):
            with self.subTest(location=location):
                server = self.serve({"/robots.txt": Page(404), "/go": Page(302, b"", [("Location", location)])})
                result = self.fetcher().fetch(server.url("/go"))
                self.assertIn("refused", result.error)
                self.assertEqual(result.status, 302)

    def test_a_redirect_loop_stops_after_ten_hops(self) -> None:
        server = self.serve({"/robots.txt": Page(404), "/loop": Page(302, b"", [("Location", "/loop")])})
        result = self.fetcher().fetch(server.url("/loop"))
        self.assertIn("too many redirects", result.error)
        self.assertEqual(server.count("/loop"), fetch_pages.MAX_REDIRECTS + 1)

    def test_gzip_and_deflate_bodies_are_decoded(self) -> None:
        routes = {
            "/robots.txt": Page(404),
            "/gz": Page(200, gzip.compress(HTML), [("Content-Encoding", "gzip")]),
            "/df": Page(200, zlib.compress(HTML), [("Content-Encoding", "deflate")]),
        }
        server = self.serve(routes)
        self.assertEqual(self.fetcher().fetch(server.url("/gz")).body, HTML)
        self.assertEqual(self.fetcher().fetch(server.url("/df")).body, HTML)

    def test_a_404_page_keeps_its_body_and_headers(self) -> None:
        page = Page(404, b"custom not found page", [("Content-Type", "text/html"), ("X-Robots-Tag", "noindex")])
        server = self.serve({"/robots.txt": Page(404), "/gone": page})
        result = self.fetcher().fetch(server.url("/gone"))
        self.assertEqual((result.status, result.body, result.error), (404, b"custom not found page", ""))
        self.assertEqual(dict(result.headers)["x-robots-tag"], "noindex")

    def test_an_oversized_body_is_cut_and_marked(self) -> None:
        server = self.serve({"/robots.txt": Page(404), "/big": Page(200, b"z" * 500)})
        with mock.patch.object(fetch_pages, "MAX_BYTES", 100):
            result = self.fetcher().fetch(server.url("/big"))
        self.assertEqual((len(result.body), result.truncated), (100, True))

    def test_the_request_carries_the_fixed_headers_and_nothing_else_of_ours(self) -> None:
        server = self.serve({"/robots.txt": Page(404), "/p": Page(200, HTML)})
        self.fetcher().fetch(server.url("/p"))
        sent = next(item.headers for item in server.seen if item.path == "/p")
        self.assertEqual(sent["user-agent"], fetch_pages.USER_AGENT)
        self.assertEqual(sent["accept-encoding"], "gzip, deflate")
        self.assertEqual(sent["accept-language"], "en-US,en;q=0.9")
        self.assertNotIn("cookie", sent)
        self.assertNotIn("authorization", sent)

    def test_a_server_that_is_not_there_is_recorded_not_raised(self) -> None:
        result = self.fetcher().fetch(f"http://127.0.0.1:{free_port()}/page")
        self.assertIn("could not be read", result.skipped)  # robots.txt is the first thing asked for
        self.assertIsNone(result.status)

    def test_the_opener_only_speaks_http_and_https(self) -> None:
        with tempfile.TemporaryDirectory() as folder:
            local = Path(folder) / "secret.txt"
            local.write_text("local file", encoding="utf-8")
            for url in (local.as_uri(), "ftp://127.0.0.1/x", "data:text/plain,hello"):
                with self.subTest(url=url[:20]), self.assertRaises(urllib.error.URLError):
                    fetch_pages.default_opener().open(urllib.request.Request(url), timeout=2)


HOSTILE_LOCATIONS = (
    "http://[::1/",  # unclosed IPv6 bracket
    "http://[",
    "http://a\u2100.test/",  # the host changes shape under Unicode normalisation
    "http://\uff0f\uff0fevil.test/",  # full-width slashes
)


class HostileRedirectTests(unittest.TestCase):
    """urljoin and urlsplit raise ValueError on addresses like these: they must become recorded skips, not crashes."""

    def test_a_hostile_location_is_a_refused_redirect_not_an_exception(self) -> None:
        for location in HOSTILE_LOCATIONS:
            with self.subTest(location=location):
                fetcher, opener, _ = make_fetcher({ROBOTS: Reply(404), PAGE: Reply(302, b"", {"Location": location})})
                result = fetcher.fetch(PAGE)
                self.assertEqual(result.status, 302)
                self.assertIn("redirect", result.error)
                self.assertIn("refused", result.error)
                self.assertEqual(opener.urls, [ROBOTS, PAGE])

    def test_a_hostile_location_on_robots_txt_skips_the_site_with_a_reason(self) -> None:
        for location in HOSTILE_LOCATIONS:
            with self.subTest(location=location):
                fetcher, opener, _ = make_fetcher({ROBOTS: Reply(301, b"", {"Location": location}), PAGE: Reply(200, HTML)})
                result = fetcher.fetch(PAGE)
                self.assertIn("robots.txt", result.skipped)
                self.assertNotIn(PAGE, opener.urls)


class SaveAndMainTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.out = Path(self._tmp.name) / "pages"

    def run_main(self, argv, routes):
        clock = FakeClock()
        opener = FakeOpener(routes, clock=clock, seconds_per_request=0.1)
        with captured() as (out, err):
            code = run_cli(lambda args: fetch_pages.main(args, opener=opener, clock=clock, sleep=clock.sleep), argv)
        return code, out.getvalue(), err.getvalue(), opener

    def test_writes_html_and_meta_json_per_url(self) -> None:
        code, _, _, _ = self.run_main([str(self.out), PAGE], {ROBOTS: Reply(404), PAGE: Reply(200, HTML, {"Server": "fake"})})
        self.assertEqual(code, 0)
        self.assertEqual((self.out / "site.test_page.html").read_bytes(), HTML)
        meta = json.loads((self.out / "site.test_page.meta.json").read_text(encoding="utf-8"))
        for key in ("requested", "final_url", "status", "error", "headers", "redirects", "bytes", "elapsed_ms"):
            self.assertIn(key, meta)
        self.assertEqual((meta["status"], meta["bytes"], meta["error"], meta["skipped"]), (200, len(HTML), None, None))
        self.assertEqual(meta["headers"], {"server": "fake"})

    def test_meta_records_redirect_hops_in_the_prototype_shape(self) -> None:
        routes = {ROBOTS: Reply(404), f"{SITE}/a": Reply(301, b"", {"Location": "/b"}), f"{SITE}/b": Reply(200, HTML)}
        self.run_main([str(self.out), f"{SITE}/a"], routes)
        meta = json.loads((self.out / "site.test_a.meta.json").read_text(encoding="utf-8"))
        self.assertEqual(meta["redirects"], [{"status": 301, "from": f"{SITE}/a", "to": f"{SITE}/b"}])
        self.assertEqual(meta["final_url"], f"{SITE}/b")

    def test_a_skipped_url_writes_only_the_meta_file(self) -> None:
        private = f"{SITE}/private/x"
        code, out, _, _ = self.run_main([str(self.out), private], {ROBOTS: Reply(200, ROBOTS_WITH_RULES)})
        self.assertEqual(code, 0)
        self.assertIn("skipped", out)
        self.assertFalse((self.out / "site.test_private_x.html").exists())
        meta = json.loads((self.out / "site.test_private_x.meta.json").read_text(encoding="utf-8"))
        self.assertIn("robots.txt", meta["skipped"])
        self.assertIsNone(meta["status"])

    def test_a_failed_fetch_exits_1_and_writes_only_the_meta_file(self) -> None:
        code, out, _, _ = self.run_main([str(self.out), PAGE], {ROBOTS: Reply(404), PAGE: urllib.error.URLError("no route")})
        self.assertEqual(code, 1)
        self.assertIn("ERROR", out)
        self.assertFalse((self.out / "site.test_page.html").exists())
        self.assertIn("no route", json.loads((self.out / "site.test_page.meta.json").read_text(encoding="utf-8"))["error"])

    def test_a_404_page_is_saved_and_is_not_an_error(self) -> None:
        code, _, _, _ = self.run_main([str(self.out), f"{SITE}/gone"], {ROBOTS: Reply(404), f"{SITE}/gone": Reply(404, b"nope")})
        self.assertEqual(code, 0)
        self.assertEqual((self.out / "site.test_gone.html").read_bytes(), b"nope")

    def test_one_hostile_redirect_does_not_stop_the_rest_of_the_batch(self) -> None:
        good, evil, last = f"{SITE}/good", "https://evil.test/x", f"{SITE}/last"
        routes = {
            ROBOTS: Reply(404), "https://evil.test/robots.txt": Reply(404),
            good: Reply(200, HTML), last: Reply(200, HTML),
            evil: Reply(302, b"", {"Location": "http://[::1/"}),
        }
        code, out, _, opener = self.run_main([str(self.out), good, evil, last], routes)
        self.assertEqual(code, 1)  # the refused redirect is recorded as an error
        self.assertIn(last, opener.urls)
        self.assertTrue((self.out / "site.test_last.html").is_file())
        meta = json.loads((self.out / "evil.test_x.meta.json").read_text(encoding="utf-8"))
        self.assertIn("refused", meta["error"])
        self.assertEqual(len(out.strip().splitlines()), 3)

    def test_a_redirect_to_a_private_address_is_an_error_unless_the_flag_is_given(self) -> None:
        target = "http://127.0.0.1:8080/admin"
        routes = {ROBOTS: Reply(404), PAGE: Reply(302, b"", {"Location": target}), "http://127.0.0.1:8080/robots.txt": Reply(404),
                  target: Reply(200, HTML)}
        code, out, _, opener = self.run_main([str(self.out), PAGE], routes)
        self.assertEqual(code, 1)
        self.assertIn("refused", out)
        self.assertNotIn(target, opener.urls)
        code, out, _, opener = self.run_main([str(self.out), PAGE, "--allow-private-hosts"], routes)
        self.assertEqual(code, 0)
        self.assertIn(target, opener.urls)

    def test_urls_file_and_arguments_are_merged_without_repeats(self) -> None:
        urls_file = Path(self._tmp.name) / "urls.txt"
        urls_file.write_text(f"# pages\n{SITE}/a\n{PAGE}\n", encoding="utf-8")
        routes = {ROBOTS: Reply(404), f"{SITE}/a": Reply(200, HTML), PAGE: Reply(200, HTML)}
        code, _, _, opener = self.run_main([str(self.out), PAGE, "--urls-file", str(urls_file)], routes)
        self.assertEqual(code, 0)
        self.assertEqual(opener.urls.count(PAGE), 1)
        self.assertIn(f"{SITE}/a", opener.urls)

    def test_an_invalid_url_exits_2_before_any_request(self) -> None:
        code, _, err, opener = self.run_main([str(self.out), PAGE, "file:///etc/passwd"], {ROBOTS: Reply(404), PAGE: Reply(200, HTML)})
        self.assertEqual(code, 2)
        self.assertIn("http", err)
        self.assertEqual(opener.urls, [])

    def test_no_urls_at_all_is_a_usage_error(self) -> None:
        with captured(), self.assertRaises(SystemExit) as caught:
            fetch_pages.main([str(self.out)], opener=FakeOpener({}))
        self.assertEqual(caught.exception.code, 2)

    def test_negative_delay_is_rejected(self) -> None:
        with captured(), self.assertRaises(SystemExit) as caught:
            fetch_pages.main([str(self.out), PAGE, "--delay", "-1"], opener=FakeOpener({}))
        self.assertEqual(caught.exception.code, 2)

    def test_prints_one_result_line_per_url(self) -> None:
        routes = {ROBOTS: Reply(404), f"{SITE}/a": Reply(301, b"", {"Location": "/b"}), f"{SITE}/b": Reply(200, HTML)}
        _, out, _, _ = self.run_main([str(self.out), f"{SITE}/a"], routes)
        line = out.strip().splitlines()[0]
        self.assertTrue(line.startswith("[1/1] 200 hops:301"), line)
        self.assertIn(f"{SITE}/a -> {SITE}/b", line)

    def test_result_dataclass_is_immutable(self) -> None:
        result = FetchResult(requested=PAGE, final_url=PAGE)
        with self.assertRaises(Exception):
            result.status = 200  # type: ignore[misc]


if __name__ == "__main__":
    unittest.main()
