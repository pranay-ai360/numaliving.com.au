"""Each tool must start as a script: python3 tools/seo/NAME.py --help prints its usage and exits 0."""

from __future__ import annotations

import contextlib
import io
import runpy
import sys
import unittest
from unittest import mock

from helpers import TOOLS_DIR

SCRIPTS = (
    "audit_pages", "browse", "fetch_pages", "google_features", "launch_check", "rank_log", "serp_report",
    "serp_search", "sitemap_report", "vocab_gap",
)


class EntryPointTests(unittest.TestCase):
    def test_every_tool_prints_its_usage_and_exits_zero_when_run_as_a_script(self) -> None:
        for name in SCRIPTS:
            path = str(TOOLS_DIR / f"{name}.py")
            with self.subTest(tool=name):
                out = io.StringIO()
                with mock.patch.object(sys, "argv", [path, "--help"]), contextlib.redirect_stdout(out):
                    with self.assertRaises(SystemExit) as caught:
                        runpy.run_path(path, run_name="__main__")
                self.assertEqual(caught.exception.code, 0)
                self.assertIn("usage:", out.getvalue())

    def test_a_script_with_a_usage_error_exits_two_without_a_traceback(self) -> None:
        path = str(TOOLS_DIR / "fetch_pages.py")
        err = io.StringIO()
        with mock.patch.object(sys, "argv", [path, "--no-such-option"]), contextlib.redirect_stderr(err):
            with self.assertRaises(SystemExit) as caught:
                runpy.run_path(path, run_name="__main__")
        self.assertEqual(caught.exception.code, 2)
        self.assertNotIn("Traceback", err.getvalue())


if __name__ == "__main__":
    unittest.main()
