"""Tests for the check that keeps redirects away from loopback, private and link-local addresses."""

from __future__ import annotations

import socket
import unittest
from typing import Dict, Tuple
from unittest import mock

import helpers  # noqa: F401  (puts tools/seo on sys.path)
import url_guard  # noqa: E402

PUBLIC = "93.184.216.34"


def resolver(table: Dict[str, Tuple[str, ...]]):
    """Stands in for DNS: names not in the table do not resolve."""
    return lambda host: table.get(host, ())


class PublicAddressTests(unittest.TestCase):
    def test_ordinary_internet_addresses_are_public(self) -> None:
        for text in (PUBLIC, "8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"):
            with self.subTest(address=text):
                self.assertTrue(url_guard.is_public_address(text))

    def test_loopback_private_link_local_and_unspecified_addresses_are_not(self) -> None:
        for text in (
            "127.0.0.1", "127.8.9.10", "10.0.0.5", "172.16.0.1", "172.31.255.254", "192.168.1.1", "169.254.169.254",
            "0.0.0.0", "100.64.0.1", "255.255.255.255", "224.0.0.1", "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1",
        ):
            with self.subTest(address=text):
                self.assertFalse(url_guard.is_public_address(text))

    def test_an_ipv4_address_wrapped_in_ipv6_is_judged_by_the_ipv4_address(self) -> None:
        self.assertFalse(url_guard.is_public_address("::ffff:127.0.0.1"))
        self.assertFalse(url_guard.is_public_address("::ffff:7f00:1"))
        self.assertFalse(url_guard.is_public_address("::ffff:10.1.2.3"))
        self.assertTrue(url_guard.is_public_address("::ffff:" + PUBLIC))

    def test_text_that_is_not_an_address_is_not_public(self) -> None:
        for text in ("", "example.test", "999.1.1.1", "1.2.3"):
            with self.subTest(text=text):
                self.assertFalse(url_guard.is_public_address(text))


class NonPublicReasonTests(unittest.TestCase):
    def test_a_literal_private_address_is_named_without_asking_dns(self) -> None:
        def no_dns(host: str):
            raise AssertionError("DNS must not be asked for an address literal")

        for host in ("127.0.0.1", "10.0.0.5", "::1", "::ffff:7f00:1", "169.254.169.254"):
            with self.subTest(host=host):
                reason = url_guard.non_public_reason(host, no_dns)
                self.assertIn(host, reason)

    def test_a_name_that_resolves_to_a_private_address_is_refused(self) -> None:
        lookup = resolver({"localhost": ("127.0.0.1", "::1"), "intranet.test": ("10.1.2.3",)})
        self.assertIn("127.0.0.1", url_guard.non_public_reason("localhost", lookup))
        self.assertIn("10.1.2.3", url_guard.non_public_reason("intranet.test", lookup))

    def test_one_private_answer_among_public_ones_is_enough_to_refuse(self) -> None:
        lookup = resolver({"mixed.test": (PUBLIC, "192.168.0.7")})
        self.assertIn("192.168.0.7", url_guard.non_public_reason("mixed.test", lookup))

    def test_odd_spellings_of_loopback_are_caught_through_the_resolver(self) -> None:
        lookup = resolver({"2130706433": ("127.0.0.1",), "0x7f.0.0.1": ("127.0.0.1",), "0": ("0.0.0.0",)})
        for host in ("2130706433", "0x7f.0.0.1", "0"):
            with self.subTest(host=host):
                self.assertTrue(url_guard.non_public_reason(host, lookup))

    def test_public_names_and_names_that_do_not_resolve_pass(self) -> None:
        lookup = resolver({"example.test": (PUBLIC,)})
        self.assertEqual(url_guard.non_public_reason("example.test", lookup), "")
        self.assertEqual(url_guard.non_public_reason("no-such-host.test", lookup), "")  # the request itself will fail

    def test_a_public_literal_passes(self) -> None:
        self.assertEqual(url_guard.non_public_reason(PUBLIC), "")


class RealResolverTests(unittest.TestCase):
    """The default resolver asks the operating system (no network is needed for these names)."""

    def test_localhost_and_literals_resolve_to_loopback(self) -> None:
        self.assertIn("127.0.0.1", url_guard.resolve_addresses("localhost") + url_guard.resolve_addresses("127.0.0.1"))
        self.assertEqual(url_guard.resolve_addresses("127.0.0.1"), ("127.0.0.1",))

    def test_a_name_that_cannot_be_resolved_gives_no_addresses(self) -> None:
        self.assertEqual(url_guard.resolve_addresses("no-such-host.invalid"), ())
        self.assertEqual(url_guard.resolve_addresses(""), ())
        self.assertEqual(url_guard.resolve_addresses("a℀.test"), ())

    def test_numeric_shorthand_is_read_the_way_the_connection_will_read_it(self) -> None:
        resolved = url_guard.resolve_addresses("2130706433")
        if not resolved:
            self.skipTest("this system's resolver does not read a bare integer as an IPv4 address")
        self.assertEqual(resolved, ("127.0.0.1",))
        self.assertTrue(url_guard.non_public_reason("2130706433"))

    def test_scope_ids_are_dropped_from_ipv6_answers(self) -> None:
        answer = [(socket.AF_INET6, socket.SOCK_STREAM, 6, "", ("fe80::1%en0", 0, 0, 1))]
        with mock.patch("socket.getaddrinfo", return_value=answer):
            self.assertEqual(url_guard.resolve_addresses("anything.test"), ("fe80::1",))


if __name__ == "__main__":
    unittest.main()
