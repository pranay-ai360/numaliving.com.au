"""Tests for the stop rules around Google captures: the capture loop and the block marker. No browser is involved."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from typing import Dict, List
from unittest import mock

from helpers import captured

import serp_guard  # noqa: E402
from seo_common import SeoToolError  # noqa: E402

OK, BLOCK, ERROR = "ok", "blocked", "error"


class Scripted:
    """A capture function answering from a list of OK / BLOCK / ERROR, one entry per call."""

    def __init__(self, outcomes: List[str]) -> None:
        self._outcomes = list(outcomes)
        self.queries: List[str] = []

    def __call__(self, query: str) -> Dict[str, object]:
        outcome = self._outcomes[len(self.queries)]
        self.queries.append(query)
        return {"query": query, "blocked": outcome == BLOCK, "error": "boom" if outcome == ERROR else None}


class Sleeps:
    def __init__(self) -> None:
        self.calls: List[float] = []

    def __call__(self, seconds: float) -> None:
        self.calls.append(seconds)


def run(outcomes: List[str], delay: float = 15.0):
    capture, sleep = Scripted(outcomes), Sleeps()
    queries = [f"q{index}" for index in range(len(outcomes))]
    with captured() as (_, err):
        result = serp_guard.capture_queries(queries, delay, capture, sleep)
    return result, capture, sleep, err.getvalue()


class CaptureLoopTests(unittest.TestCase):
    def test_every_query_is_captured_with_a_pause_between_them(self) -> None:
        result, capture, sleep, _ = run([OK, OK, OK])
        self.assertEqual(capture.queries, ["q0", "q1", "q2"])
        self.assertEqual(sleep.calls, [15.0, 15.0])  # between queries, not after the last
        self.assertEqual((result.blocked, result.gave_up, result.captured), (False, False, 3))
        self.assertEqual(serp_guard.exit_code(result), 0)

    def test_the_pause_is_the_delay_that_was_asked_for(self) -> None:
        _, _, sleep, _ = run([OK, OK], delay=42.5)
        self.assertEqual(sleep.calls, [42.5])

    def test_a_block_page_stops_the_run_at_once(self) -> None:
        result, capture, sleep, log = run([OK, OK, BLOCK, OK, OK])
        self.assertEqual(capture.queries, ["q0", "q1", "q2"])  # three attempted, the last two never asked
        self.assertTrue(result.blocked)
        self.assertEqual(sleep.calls, [15.0, 15.0])  # no pause after the block
        self.assertEqual(serp_guard.exit_code(result), 1)
        self.assertIn("block page", log)

    def test_the_first_query_can_be_the_blocked_one(self) -> None:
        result, capture, sleep, _ = run([BLOCK, OK])
        self.assertEqual(capture.queries, ["q0"])
        self.assertEqual(sleep.calls, [])
        self.assertTrue(result.blocked)

    def test_two_errors_in_a_row_stop_the_run(self) -> None:
        result, capture, _, log = run([OK, ERROR, ERROR, ERROR, OK])
        self.assertEqual(capture.queries, ["q0", "q1", "q2"])
        self.assertTrue(result.gave_up)
        self.assertFalse(result.blocked)
        self.assertEqual(serp_guard.exit_code(result), 1)
        self.assertIn("in a row", log)

    def test_errors_that_are_not_in_a_row_do_not_stop_the_run(self) -> None:
        result, capture, _, _ = run([ERROR, OK, ERROR, OK, ERROR, OK])
        self.assertEqual(len(capture.queries), 6)
        self.assertFalse(result.gave_up)
        self.assertEqual(result.captured, 3)
        self.assertEqual(serp_guard.exit_code(result), 1)  # a capture failed, so the run did not fully succeed

    def test_the_limit_is_two_consecutive_errors(self) -> None:
        self.assertEqual(serp_guard.MAX_CONSECUTIVE_ERRORS, 2)

    def test_the_summary_counts_successes_only(self) -> None:
        result, _, _, _ = run([OK, OK, BLOCK, OK, OK])
        self.assertEqual(result.captured, 2)
        self.assertEqual(len(result.records), 3)
        result, _, _, _ = run([OK, ERROR, OK])
        self.assertEqual((result.captured, len(result.records)), (2, 3))

    def test_the_result_does_not_change_after_the_run(self) -> None:
        result, _, _, _ = run([OK])
        self.assertIsInstance(result.records, tuple)
        with self.assertRaises(Exception):
            result.blocked = True  # type: ignore[misc]


class BlockMarkerTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.marker = Path(self._tmp.name) / "browse" / "blocked-at"

    def age(self, seconds: float, now: float = 1_000_000.0) -> None:
        os.utime(self.marker, (now - seconds, now - seconds))

    def test_without_a_marker_nothing_is_refused(self) -> None:
        serp_guard.refuse_while_blocked(self.marker, now=1_000_000.0)

    def test_recording_a_block_writes_a_readable_marker_and_creates_the_folder(self) -> None:
        serp_guard.record_block(self.marker)
        self.assertRegex(self.marker.read_text(encoding="utf-8"), r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")

    def test_a_recent_block_refuses_a_new_run_and_says_until_when(self) -> None:
        serp_guard.record_block(self.marker)
        self.age(60.0)
        with self.assertRaises(SeoToolError) as caught:
            serp_guard.refuse_while_blocked(self.marker, now=1_000_000.0)
        message = str(caught.exception)
        self.assertIn("block page", message)
        self.assertIn("6 hours", message)
        self.assertIn(str(self.marker), message)

    def test_the_refusal_lasts_six_hours(self) -> None:
        self.assertEqual(serp_guard.BLOCK_COOLDOWN_SECONDS, 6 * 3600)
        serp_guard.record_block(self.marker)
        self.age(6 * 3600 - 1)
        with self.assertRaises(SeoToolError):
            serp_guard.refuse_while_blocked(self.marker, now=1_000_000.0)
        self.age(6 * 3600 + 1)
        serp_guard.refuse_while_blocked(self.marker, now=1_000_000.0)

    def test_a_marker_that_cannot_be_checked_refuses_instead_of_guessing(self) -> None:
        with mock.patch.object(Path, "stat", side_effect=PermissionError(13, "Permission denied")):
            with self.assertRaises(SeoToolError) as caught:
                serp_guard.refuse_while_blocked(self.marker, now=1_000_000.0)
        self.assertIn(str(self.marker), str(caught.exception))

    def test_seconds_until_allowed_is_zero_without_a_marker(self) -> None:
        self.assertEqual(serp_guard.seconds_until_allowed(self.marker, now=5.0), 0.0)


class GoogleHostTests(unittest.TestCase):
    def test_google_addresses_are_recognised(self) -> None:
        for host in ("google.com", "www.google.com", "maps.google.com", "google.co.uk", "www.google.com.au", "google.de",
                     "GOOGLE.COM", "google.com."):
            with self.subTest(host=host):
                self.assertTrue(serp_guard.is_google_host(host))

    def test_other_hosts_are_not(self) -> None:
        for host in ("example.com", "notgoogle.com", "google.com.evil.test", "google.evil", "googleusercontent.com",
                     "google", "", "numaliving.us"):
            with self.subTest(host=host):
                self.assertFalse(serp_guard.is_google_host(host))

    def test_reject_google_urls_names_the_offending_address(self) -> None:
        with self.assertRaises(SeoToolError) as caught:
            serp_guard.reject_google_urls(("https://numaliving.us/", "https://www.google.com/search?q=x"))
        self.assertIn("google.com/search", str(caught.exception))
        self.assertIn("serp", str(caught.exception))

    def test_other_addresses_pass(self) -> None:
        serp_guard.reject_google_urls(("https://numaliving.us/", "http://localhost:3000/"))

    def test_an_unreadable_address_is_not_a_google_address(self) -> None:
        serp_guard.reject_google_urls(("http://[",))


if __name__ == "__main__":
    unittest.main()
