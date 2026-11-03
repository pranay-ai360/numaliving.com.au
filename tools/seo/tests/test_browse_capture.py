"""Tests for the functions of browse.py that talk to a page, with fake browser, context and page objects.

They stand in for CloakBrowser's Playwright objects, so what the code does with a page (the screenshots it asks
for, the text it saves, how it records a failure, that it always closes the context) is tested without a browser.
"""

from __future__ import annotations

import tempfile
import types
import unittest
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest import mock

from helpers import captured

import browse  # noqa: E402

ESC = "\x1b"
SERP_DATA = {
    "url": "https://www.google.com/search?q=custom+millwork", "title": "custom millwork - Google Search",
    "organicTitles": ["Alpha", "Beta"], "hasAds": False, "text": "AI Overview\nBody text\n",
}


class FakePage:
    def __init__(self, status: Optional[int] = 200, text: str = "visible text", serp: Optional[Dict[str, Any]] = None,
                 goto_error: Optional[BaseException] = None, no_response: bool = False) -> None:
        self.status, self.text, self.serp = status, text, serp or SERP_DATA
        self.goto_error, self.no_response = goto_error, no_response
        self.visited: List[str] = []
        self.shots: List[tuple] = []

    def goto(self, url: str, wait_until: str, timeout: int) -> Any:
        self.visited.append(url)
        if self.goto_error is not None:
            raise self.goto_error
        return None if self.no_response else types.SimpleNamespace(status=self.status)

    def wait_for_timeout(self, milliseconds: int) -> None:
        return None

    def screenshot(self, path: str, full_page: bool) -> None:
        Path(path).write_bytes(b"PNG")
        self.shots.append((Path(path).name, full_page))

    def evaluate(self, script: str) -> Any:
        return self.text if script == browse.JS_TEXT else self.serp


class FakeContext:
    def __init__(self, page: FakePage, settings: Dict[str, Any]) -> None:
        self._page, self.settings, self.closed = page, settings, False

    def new_page(self) -> FakePage:
        return self._page

    def close(self) -> None:
        self.closed = True


class FakeBrowser:
    def __init__(self, page: FakePage) -> None:
        self.page = page
        self.contexts: List[FakeContext] = []

    def new_context(self, **settings: Any) -> FakeContext:
        context = FakeContext(self.page, settings)
        self.contexts.append(context)
        return context


class FakeQA:
    """The launcher helpers browse.py uses besides open_browser."""

    def __init__(self, prepare_error: Optional[BaseException] = None) -> None:
        self.prepare_error = prepare_error
        self.prepared = 0

    def new_context(self, browser: FakeBrowser, width: int, height: int) -> FakeContext:
        return browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)

    def prepare_page(self, page: FakePage) -> None:
        self.prepared += 1
        if self.prepare_error is not None:
            raise self.prepare_error


class CaptureViewTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.out = Path(self._tmp.name)

    def capture(self, page: FakePage, name: str = "desktop", mobile: bool = False, full_page: bool = False,
                qa: Optional[FakeQA] = None):
        browser = FakeBrowser(page)
        launcher = mock.patch.object(browse, "load_launcher", return_value=qa or FakeQA())
        with launcher, captured() as (_, err):
            result = browse._capture_view(browser, "https://a.test/x/", self.out, "a.test_x", name, mobile, full_page)
        return result, browser, err.getvalue()

    def test_a_desktop_view_saves_a_first_screen_shot_and_the_visible_text(self) -> None:
        page = FakePage(text="Headline\nBody")
        result, browser, _ = self.capture(page)
        self.assertEqual(result, {"status": 200, "shots": ["a.test_x-desktop-fold.png"], "text": True, "error": None})
        self.assertEqual((self.out / "a.test_x.txt").read_text(encoding="utf-8"), "Headline\nBody")
        self.assertEqual(page.shots, [("a.test_x-desktop-fold.png", False)])
        self.assertEqual(browser.contexts[0].settings["viewport"], {"width": browse.DESKTOP[0], "height": browse.DESKTOP[1]})
        self.assertTrue(browser.contexts[0].closed)

    def test_a_mobile_view_is_a_small_touch_screen_and_saves_no_text(self) -> None:
        page = FakePage()
        result, browser, _ = self.capture(page, name="mobile", mobile=True, full_page=True)
        self.assertEqual(result["shots"], ["a.test_x-mobile-fold.png"])  # no full-height shot on mobile
        self.assertFalse(result["text"])
        self.assertFalse((self.out / "a.test_x.txt").exists())
        settings = browser.contexts[0].settings
        self.assertEqual(settings["viewport"], {"width": browse.MOBILE[0], "height": browse.MOBILE[1]})
        self.assertEqual((settings["device_scale_factor"], settings["is_mobile"], settings["has_touch"]), (2, True, True))

    def test_the_full_height_shot_is_taken_on_desktop_when_asked(self) -> None:
        page = FakePage()
        result, _, _ = self.capture(page, full_page=True)
        self.assertEqual(result["shots"], ["a.test_x-desktop-fold.png", "a.test_x-desktop-full.png"])
        self.assertEqual([full for _, full in page.shots], [False, True])

    def test_the_visible_text_is_saved_in_its_safe_form(self) -> None:
        page = FakePage(text=f"title{ESC}]0;pwned\x07")
        self.capture(page)
        saved = (self.out / "a.test_x.txt").read_text(encoding="utf-8")
        self.assertNotIn(ESC, saved)
        self.assertIn("\\x1b]0;pwned\\x07", saved)

    def test_a_page_that_fails_to_load_is_recorded_and_the_context_is_still_closed(self) -> None:
        page = FakePage(goto_error=TimeoutError("page took too long"))
        result, browser, log = self.capture(page)
        self.assertEqual(result["error"], "TimeoutError: page took too long")
        self.assertEqual((result["shots"], result["text"]), ([], False))
        self.assertTrue(browser.contexts[0].closed)
        self.assertIn("failed", log)

    def test_a_missing_response_leaves_the_status_empty(self) -> None:
        result, _, _ = self.capture(FakePage(no_response=True))
        self.assertIsNone(result["status"])

    def test_a_problem_while_preparing_the_page_does_not_stop_the_capture(self) -> None:
        qa = FakeQA(prepare_error=RuntimeError("strict CSP"))
        result, _, log = self.capture(FakePage(), qa=qa)
        self.assertEqual(qa.prepared, 1)
        self.assertIsNone(result["error"])
        self.assertEqual(result["shots"], ["a.test_x-desktop-fold.png"])
        self.assertIn("strict CSP", log)


class CaptureSerpTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.out = Path(self._tmp.name)

    def capture(self, page: FakePage, query: str = "custom millwork"):
        browser = FakeBrowser(page)
        record = browse._capture_serp(browser, query, self.out)
        return record, browser

    def test_a_results_page_is_saved_as_text_and_a_screenshot_named_by_the_query(self) -> None:
        page = FakePage()
        record, browser = self.capture(page)
        label = browse.serp_label("custom millwork")
        self.assertEqual((self.out / f"{label}.txt").read_text(encoding="utf-8"), SERP_DATA["text"])
        self.assertEqual((self.out / f"{label}.png").read_bytes(), b"PNG")
        self.assertEqual(page.visited, [browse.google_search_url("custom millwork")])
        self.assertFalse(record["blocked"])
        self.assertIsNone(record["error"])
        self.assertEqual(record["organicTitles"], ["Alpha", "Beta"])
        self.assertFalse(record["hasAds"])
        self.assertTrue(browser.contexts[0].closed)

    def test_a_block_page_is_flagged_and_nothing_is_saved(self) -> None:
        sorry = {**SERP_DATA, "url": "https://www.google.com/sorry/index?continue=x", "text": "unusual traffic"}
        record, browser = self.capture(FakePage(serp=sorry))
        self.assertTrue(record["blocked"])
        self.assertEqual(list(self.out.iterdir()), [])
        self.assertTrue(browser.contexts[0].closed)

    def test_an_http_429_is_a_block(self) -> None:
        record, _ = self.capture(FakePage(status=429))
        self.assertTrue(record["blocked"])
        self.assertEqual(list(self.out.iterdir()), [])

    def test_a_results_page_text_is_saved_in_its_safe_form(self) -> None:
        dirty = {**SERP_DATA, "text": f"AI Overview{ESC}[2J\n"}
        self.capture(FakePage(serp=dirty))
        saved = (self.out / f"{browse.serp_label('custom millwork')}.txt").read_text(encoding="utf-8")
        self.assertNotIn(ESC, saved)

    def test_a_failed_load_is_recorded_not_raised(self) -> None:
        record, browser = self.capture(FakePage(goto_error=ConnectionError("network down")))
        self.assertEqual(record["error"], "ConnectionError: network down")
        self.assertFalse(record["blocked"])
        self.assertTrue(browser.contexts[0].closed)

    def test_a_missing_response_is_not_a_block(self) -> None:
        record, _ = self.capture(FakePage(no_response=True))
        self.assertFalse(record["blocked"])

    def test_the_context_is_a_us_english_desktop_window(self) -> None:
        _, browser = self.capture(FakePage())
        settings = browser.contexts[0].settings
        self.assertEqual(settings["viewport"], {"width": browse.DESKTOP[0], "height": browse.DESKTOP[1]})
        self.assertEqual(settings["locale"], "en-US")


class OpenSeatTests(unittest.TestCase):
    def test_open_seat_checks_the_package_loads_the_launcher_and_takes_the_seat(self) -> None:
        sentinel = object()
        with mock.patch.object(browse, "require_cloakbrowser") as require, \
                mock.patch.object(browse, "load_launcher", return_value=sentinel) as load, \
                mock.patch.object(browse, "seat", return_value="SEAT") as seat:
            self.assertEqual(browse.open_seat(), "SEAT")
        require.assert_called_once_with()
        load.assert_called_once_with()
        seat.assert_called_once_with(sentinel)

    def test_a_missing_package_stops_before_the_launcher_is_loaded(self) -> None:
        with mock.patch.object(browse, "require_cloakbrowser", side_effect=RuntimeError("no package")), \
                mock.patch.object(browse, "load_launcher") as load:
            with self.assertRaises(RuntimeError):
                browse.open_seat()
        load.assert_not_called()


if __name__ == "__main__":
    unittest.main()
