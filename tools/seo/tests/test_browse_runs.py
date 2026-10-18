"""Tests for the parts of browse.py that run a capture session, with the browser replaced by fakes.

seat() takes the qa launcher module as an argument, and run_serp() and run_shots() take the launch and capture
functions, so none of these tests needs CloakBrowser, a display or the network.
"""

from __future__ import annotations

import contextlib
import json
import os
import tempfile
import types
import unittest
from pathlib import Path
from typing import Any, Dict, Iterator, List
from unittest import mock

from helpers import captured

import browse  # noqa: E402
import serp_guard  # noqa: E402
from seo_common import SeoToolError, run_cli  # noqa: E402

OK, BLOCK, ERROR = "ok", "blocked", "error"


class FakeQA:
    """The parts of tools/site-qa/qa_common.py that seat() uses."""

    class QAError(Exception):
        pass

    def __init__(self, fail_launch: bool = False) -> None:
        self.fail_launch = fail_launch
        self.events: List[str] = []

    @contextlib.contextmanager
    def open_browser(self) -> Iterator[str]:
        self.events.append("launch")
        if self.fail_launch:
            raise self.QAError("CloakBrowser failed to launch (the free tier allows ONE concurrent browser): taken")
        try:
            yield "BROWSER"
        finally:
            self.events.append("closed")


class SeatTests(unittest.TestCase):
    def test_a_failed_launch_becomes_the_seat_error_with_exit_code_76(self) -> None:
        qa = FakeQA(fail_launch=True)
        with self.assertRaises(browse.BrowserSeatError) as caught, browse.seat(qa):  # type: ignore[arg-type]
            self.fail("the body must not run when the launch failed")
        self.assertEqual(caught.exception.exit_code, 76)
        self.assertIn("ONE concurrent browser", str(caught.exception))

    def test_a_failed_launch_exits_76_through_run_cli(self) -> None:
        def entry(argv):
            with browse.seat(FakeQA(fail_launch=True)):  # type: ignore[arg-type]
                return 0

        with captured():
            self.assertEqual(run_cli(entry, []), 76)

    def test_the_browser_is_handed_over_and_closed_afterwards(self) -> None:
        qa = FakeQA()
        with browse.seat(qa) as browser:  # type: ignore[arg-type]
            self.assertEqual(browser, "BROWSER")
            self.assertEqual(qa.events, ["launch"])
        self.assertEqual(qa.events, ["launch", "closed"])

    def test_a_qa_error_raised_inside_the_body_is_not_reported_as_a_taken_seat(self) -> None:
        qa = FakeQA()
        with self.assertRaises(FakeQA.QAError) as caught:
            with browse.seat(qa):  # type: ignore[arg-type]
                raise FakeQA.QAError("the page never loaded")
        self.assertNotIsInstance(caught.exception, browse.BrowserSeatError)
        self.assertEqual(qa.events, ["launch", "closed"])

    def test_other_errors_inside_the_body_pass_through_and_the_browser_is_closed(self) -> None:
        qa = FakeQA()
        with self.assertRaises(ZeroDivisionError):
            with browse.seat(qa):  # type: ignore[arg-type]
                raise ZeroDivisionError("bug")
        self.assertEqual(qa.events, ["launch", "closed"])


class SessionFixture(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.folder = Path(self._tmp.name)
        self.out = self.folder / "out"
        environment = mock.patch.dict(os.environ, {"SEO_DATA_DIR": str(self.folder / "data")})
        environment.start()
        self.addCleanup(environment.stop)
        self.slept: List[float] = []
        self.launches = 0

    @contextlib.contextmanager
    def launch(self) -> Iterator[str]:
        self.launches += 1
        yield "BROWSER"

    def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)

    def args(self, **extra: Any) -> types.SimpleNamespace:
        return types.SimpleNamespace(out_dir=self.out, delay=15.0, full_page=False, **extra)

    def manifest(self) -> Dict[str, Any]:
        return json.loads((self.out / "manifest.json").read_text(encoding="utf-8"))


class RunSerpTests(SessionFixture):
    def serp(self, outcomes: List[str], delay: float = 15.0):
        seen: List[str] = []

        def capture(browser: Any, query: str, out_dir: Path) -> Dict[str, Any]:
            self.assertEqual(browser, "BROWSER")
            outcome = outcomes[len(seen)]
            seen.append(query)
            return {"query": query, "blocked": outcome == BLOCK, "error": "boom" if outcome == ERROR else None}

        queries = [f"query {index}" for index in range(len(outcomes))]
        args = types.SimpleNamespace(out_dir=self.out, delay=delay)
        with captured() as (_, err):
            code = browse.run_serp(args, queries, launch=self.launch, capture=capture, sleep=self.sleep)
        return code, seen, err.getvalue()

    def test_a_block_page_stops_the_run_after_three_of_five_and_exits_1(self) -> None:
        code, seen, log = self.serp([OK, OK, BLOCK, OK, OK])
        self.assertEqual(code, 1)
        self.assertEqual(seen, ["query 0", "query 1", "query 2"])
        self.assertIn("done: 2 of 5 queries captured", log)
        self.assertEqual(len(self.manifest()["queries"]), 3)

    def test_the_run_pauses_for_the_delay_between_queries(self) -> None:
        self.serp([OK, OK, OK], delay=21.0)
        self.assertEqual(self.slept, [21.0, 21.0])

    def test_a_clean_run_exits_0_and_leaves_no_marker(self) -> None:
        code, seen, log = self.serp([OK, OK])
        self.assertEqual((code, len(seen)), (0, 2))
        self.assertIn("done: 2 of 2 queries captured", log)
        self.assertFalse(serp_guard.default_marker().exists())

    def test_errors_in_a_row_stop_the_run_and_exit_1(self) -> None:
        code, seen, log = self.serp([OK, ERROR, ERROR, ERROR, OK])
        self.assertEqual((code, len(seen)), (1, 3))
        self.assertIn("done: 1 of 5 queries captured", log)

    def test_a_single_failed_capture_makes_the_exit_code_1(self) -> None:
        code, seen, _ = self.serp([OK, ERROR, OK])
        self.assertEqual((code, len(seen)), (1, 3))

    def test_the_manifest_names_each_queries_files(self) -> None:
        self.serp([OK, OK])
        labels = [record["label"] for record in self.manifest()["queries"]]
        self.assertEqual(labels, [browse.serp_label("query 0"), browse.serp_label("query 1")])

    def test_a_block_writes_the_marker_and_a_second_run_is_refused_before_the_browser_starts(self) -> None:
        self.serp([BLOCK])
        self.assertTrue(serp_guard.default_marker().is_file())
        launches_before = self.launches
        with self.assertRaises(SeoToolError) as caught:
            self.serp([OK])
        self.assertIn("6 hours", str(caught.exception))
        self.assertEqual(self.launches, launches_before)

    def test_the_marker_stops_serp_from_main_without_touching_the_browser(self) -> None:
        serp_guard.record_block(serp_guard.default_marker())
        with captured() as (_, err), mock.patch.object(browse, "load_launcher", side_effect=AssertionError("browser touched")):
            self.assertEqual(run_cli(browse.main, ["serp", "one query"]), 2)
        self.assertIn("block page", err.getvalue())

    def test_a_run_a_day_after_a_block_is_allowed(self) -> None:
        marker = serp_guard.default_marker()
        serp_guard.record_block(marker)
        os.utime(marker, (1.0, 1.0))  # 1970
        code, _, _ = self.serp([OK])
        self.assertEqual(code, 0)


class RunShotsTests(SessionFixture):
    def shots(self, urls: List[str], failing: List[str] = ()):
        seen: List[tuple] = []

        def capture_view(browser: Any, url: str, out_dir: Path, label: str, name: str, mobile: bool, full_page: bool):
            self.assertEqual(browser, "BROWSER")
            seen.append((url, name, mobile))
            error = "TimeoutError: slow" if url in failing and name == "mobile" else None
            return {"status": 200, "shots": [f"{label}-{name}-fold.png"], "text": not mobile, "error": error}

        with captured() as (_, err):
            code = browse.run_shots(self.args(), urls, launch=self.launch, capture_view=capture_view, sleep=self.sleep)
        return code, seen, err.getvalue()

    def test_each_page_is_captured_on_desktop_and_mobile_with_a_pause_between_pages(self) -> None:
        code, seen, log = self.shots(["https://a.test/", "https://b.test/x/"])
        self.assertEqual(code, 0)
        self.assertEqual([(url, name) for url, name, _ in seen],
                         [("https://a.test/", "desktop"), ("https://a.test/", "mobile"),
                          ("https://b.test/x/", "desktop"), ("https://b.test/x/", "mobile")])
        self.assertEqual(self.slept, [15.0])
        self.assertIn("2/2 pages captured", log)

    def test_the_manifest_lists_every_page_with_its_label_and_views(self) -> None:
        self.shots(["https://a.test/"])
        page = self.manifest()["pages"][0]
        self.assertEqual((page["label"], page["url"]), ("a.test_index", "https://a.test/"))
        self.assertEqual([view["error"] for view in page["views"]], [None, None])

    def test_a_failed_view_exits_1_but_later_pages_still_run(self) -> None:
        code, seen, log = self.shots(["https://a.test/", "https://b.test/"], failing=["https://a.test/"])
        self.assertEqual(code, 1)
        self.assertEqual(len(seen), 4)
        self.assertIn("1/2 pages captured", log)


if __name__ == "__main__":
    unittest.main()
