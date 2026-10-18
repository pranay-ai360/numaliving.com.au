"""Tests for the pure parts of reading an HTTP answer: Retry-After."""

from __future__ import annotations

import unittest
from datetime import datetime, timezone

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
                self.assertIsNotNone(wait)
                self.assertLessEqual(wait, http_reply.MAX_RETRY_AFTER_SECONDS)
                self.assertGreater(wait, 86_400)


if __name__ == "__main__":
    unittest.main()
