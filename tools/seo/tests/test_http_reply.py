"""Tests for the pure parts of reading an HTTP answer: Retry-After."""

from __future__ import annotations

import http.client
import unittest
from datetime import datetime, timezone
from email.message import Message
from typing import List

import helpers  # noqa: F401  (puts tools/seo on sys.path)
import http_reply  # noqa: E402

NOW = datetime(2026, 10, 21, 7, 28, 0, tzinfo=timezone.utc)


class RetryAfterTests(unittest.TestCase):
    def test_a_number_of_seconds(self) -> None:
        self.assertEqual(http_reply.retry_after_seconds("120", NOW), 120.0)
        self.assertEqual(http_reply.retry_after_seconds(" 7 ", NOW), 7.0)
        self.assertEqual(http_reply.retry_after_seconds("0", NOW), 0.0)

    def test_an_http_date_is_the_seconds_from_now(self) -> None:
        self.assertEqual(http_reply.retry_after_seconds("Wed, 21 Oct 2026 07:28:30 GMT", NOW), 30.0)

    def test_a_date_in_the_past_is_no_wait(self) -> None:
        self.assertEqual(http_reply.retry_after_seconds("Wed, 21 Oct 2026 07:00:00 GMT", NOW), 0.0)

    def test_anything_else_is_not_understood(self) -> None:
        for value in ("", "soon", "-5", "1.5", "٥", "12 seconds", "Wed, 99 Foo 2026"):
            with self.subTest(value=value):
                self.assertIsNone(http_reply.retry_after_seconds(value, NOW))

    def test_a_huge_number_is_a_long_wait_not_an_error(self) -> None:
        for digits in (12, 400, 5000):
            with self.subTest(digits=digits):
                wait = http_reply.retry_after_seconds("9" * digits, NOW)
                assert wait is not None
                self.assertLessEqual(wait, http_reply.MAX_RETRY_AFTER_SECONDS)
                self.assertGreater(wait, 86_400)


class Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


class Dribbler:
    """A response that hands out ``size`` bytes per read1() call, each call taking ``seconds`` on the fake clock."""

    def __init__(self, clock: Clock, total: int, size: int, seconds: float, length: object = None) -> None:
        self.clock, self.left, self.size, self.seconds = clock, total, size, seconds
        self.length = length
        self.headers = Message()
        self.requested: List[int] = []

    def read1(self, amount: int) -> bytes:
        self.requested.append(amount)
        self.clock.now += self.seconds
        chunk = min(self.size, self.left, amount)
        self.left -= chunk
        return b"x" * chunk


class ReadDeadlineTests(unittest.TestCase):
    def test_a_server_that_dribbles_bytes_is_cut_off_when_the_download_takes_too_long(self) -> None:
        clock = Clock()
        response = Dribbler(clock, total=10_000, size=1, seconds=29.0)  # a byte every 29 s keeps a socket timeout quiet
        reply = http_reply.read_reply(response, 200, max_bytes=1_000_000, deadline_seconds=120.0, clock=clock)
        self.assertIn("took longer than 120 s", reply.error)
        self.assertEqual((reply.status, reply.body), (200, b""))
        self.assertLess(clock.now, 120.0 + 29.0 + 1)  # it stopped at the first check after the deadline

    def test_a_download_within_the_deadline_arrives_whole(self) -> None:
        clock = Clock()
        response = Dribbler(clock, total=200_000, size=65_536, seconds=0.1)
        reply = http_reply.read_reply(response, 200, max_bytes=1_000_000, deadline_seconds=120.0, clock=clock)
        self.assertEqual((len(reply.body), reply.error, reply.truncated), (200_000, "", False))

    def test_reads_are_made_in_chunks_never_larger_than_the_limit_allows(self) -> None:
        clock = Clock()
        response = Dribbler(clock, total=1_000, size=1_000, seconds=0.0)
        reply = http_reply.read_reply(response, 200, max_bytes=100, deadline_seconds=120.0, clock=clock)
        self.assertEqual((len(reply.body), reply.truncated), (100, True))
        self.assertLessEqual(max(response.requested), 101)  # limit + 1 is enough to know the body is too long

    def test_a_body_the_server_cut_short_is_an_error(self) -> None:
        clock = Clock()
        response = Dribbler(clock, total=10, size=10, seconds=0.0, length=90)  # 90 more bytes were promised
        reply = http_reply.read_reply(response, 200, max_bytes=1_000, deadline_seconds=120.0, clock=clock)
        self.assertIn("IncompleteRead", reply.error)

    def test_a_response_without_read1_is_read_with_read(self) -> None:
        class Plain:
            headers = Message()

            def __init__(self) -> None:
                self.parts = [b"abc", b"def", b""]

            def read(self, amount: int) -> bytes:
                return self.parts.pop(0)

        reply = http_reply.read_reply(Plain(), 200, max_bytes=100)
        self.assertEqual(reply.body, b"abcdef")

    def test_the_default_deadline_is_a_few_minutes(self) -> None:
        self.assertGreaterEqual(http_reply.READ_DEADLINE_SECONDS, 60)
        self.assertLessEqual(http_reply.READ_DEADLINE_SECONDS, 900)
        self.assertIsInstance(http.client.IncompleteRead(b"", 1), http.client.HTTPException)


if __name__ == "__main__":
    unittest.main()
