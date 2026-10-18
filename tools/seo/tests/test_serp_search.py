"""Tests for the SearXNG runner, with a fake client: retry rules, merging pages, the saved JSON schema and the CLI."""

from __future__ import annotations

import json
import os
import tempfile
import unittest
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
from unittest import mock
from urllib.parse import urlparse

from helpers import FakeClock, captured

import serp_search  # noqa: E402
from seo_common import SeoToolError, hashed_slug, run_cli  # noqa: E402
from serp_search import SearchSettings, SearxngConnection  # noqa: E402

RECORD_KEYS = [
    "query", "language", "fetched_at", "attempts", "results", "suggestions", "answers", "corrections",
    "infoboxes", "unresponsive",
]
RESULT_KEYS = ["rank", "url", "domain", "title", "snippet", "engines", "score", "published"]
FIXED_TIME = "2026-10-18T00:00:00+00:00"


@dataclass(frozen=True)
class FakeResult:
    url: str
    title: str = "A title"
    content: str = "A snippet"
    engines: Tuple[str, ...] = ("google cse",)
    score: float = 1.0
    published_date: Optional[str] = None

    @property
    def domain(self) -> str:
        return urlparse(self.url).netloc


@dataclass(frozen=True)
class FakeEngine:
    name: str
    reason: str


@dataclass(frozen=True)
class FakeInfobox:
    title: str
    content: str
    urls: Tuple[Dict[str, str], ...] = ()


@dataclass(frozen=True)
class FakeResponse:
    results: Tuple[FakeResult, ...] = ()
    unresponsive_engines: Tuple[FakeEngine, ...] = ()
    suggestions: Tuple[Any, ...] = ()
    answers: Tuple[Any, ...] = ()
    corrections: Tuple[Any, ...] = ()
    infoboxes: Tuple[FakeInfobox, ...] = ()


class FakeSearxngError(Exception):
    pass


class FakeClient:
    """Answers search() calls from a script, one entry per call (the last repeats); exceptions are raised."""

    def __init__(self, script: Sequence[Any] = (FakeResponse(),)) -> None:
        self._script = list(script)
        self.calls: List[Dict[str, Any]] = []

    def search(self, query: str, **kwargs: Any) -> FakeResponse:
        self.calls.append({"query": query, **kwargs})
        step = self._script[min(len(self.calls) - 1, len(self._script) - 1)]
        if isinstance(step, BaseException):
            raise step
        return step

    def healthcheck(self) -> bool:
        return True


def throttled(name: str = "duckduckgo", reason: str = "CAPTCHA") -> FakeResponse:
    return FakeResponse(unresponsive_engines=(FakeEngine(name, reason),))


def hits(*urls: str, **extra: Any) -> FakeResponse:
    return FakeResponse(results=tuple(FakeResult(url) for url in urls), **extra)


def run(client: FakeClient, query: str = "widget makers", pages: int = 1, engines: Tuple[str, ...] = ("google cse", "duckduckgo")):
    clock = FakeClock()
    settings = SearchSettings(engines=engines, pages=pages, language="en-US")
    record = serp_search.run_query(client, query, settings, sleep=clock.sleep, now=lambda: FIXED_TIME)
    return record, clock


class RecordSchemaTests(unittest.TestCase):
    def test_record_keys_match_the_saved_baseline_schema_in_order(self) -> None:
        record, _ = run(FakeClient([hits("https://a.test/")]))
        self.assertEqual(list(record), RECORD_KEYS)
        self.assertEqual(list(record["results"][0]), RESULT_KEYS)

    def test_record_values(self) -> None:
        record, _ = run(FakeClient([hits("https://a.test/x")]), query="my query")
        self.assertEqual((record["query"], record["language"], record["fetched_at"], record["attempts"]), ("my query", "en-US", FIXED_TIME, 1))
        first = record["results"][0]
        self.assertEqual(first["rank"], 1)
        self.assertEqual(first["domain"], "a.test")
        self.assertEqual(first["engines"], ["google cse"])
        self.assertEqual(first["published"], None)

    def test_scores_are_rounded_and_snippets_cut(self) -> None:
        long_text = "x" * 500
        response = FakeResponse(results=(FakeResult("https://a.test/", content=long_text, score=1.23456),))
        record, _ = run(FakeClient([response]))
        self.assertEqual(record["results"][0]["score"], 1.235)
        self.assertEqual(len(record["results"][0]["snippet"]), serp_search.SNIPPET_CHARS)
        self.assertEqual(serp_search.SNIPPET_CHARS, 280)

    def test_results_without_a_url_are_dropped(self) -> None:
        record, _ = run(FakeClient([FakeResponse(results=(FakeResult(""), FakeResult("https://a.test/")))]))
        self.assertEqual([item["url"] for item in record["results"]], ["https://a.test/"])
        self.assertEqual(record["results"][0]["rank"], 1)

    def test_extras_are_carried_over_and_cut(self) -> None:
        response = hits(
            "https://a.test/",
            suggestions=("near me", "near me", "price"),
            answers=("x" * 400,),
            corrections=("widgets",),
            infoboxes=(FakeInfobox("Widget", "y" * 400, tuple({"url": f"https://w.test/{n}"} for n in range(8))),),
        )
        record, _ = run(FakeClient([response]))
        self.assertEqual(record["suggestions"], ["near me", "price"])
        self.assertEqual(len(record["answers"][0]), serp_search.ANSWER_CHARS)
        self.assertEqual(record["corrections"], ["widgets"])
        box = record["infoboxes"][0]
        self.assertEqual((box["title"], len(box["content"]), len(box["urls"])), ("Widget", serp_search.INFOBOX_CHARS, 5))

    def test_the_record_is_json_serialisable(self) -> None:
        record, _ = run(FakeClient([hits("https://a.test/", unresponsive_engines=(FakeEngine("brave", "too many requests"),))]))
        self.assertEqual(json.loads(json.dumps(record)), record)


class RetryTests(unittest.TestCase):
    def test_retries_while_the_response_is_empty_and_engines_were_throttled(self) -> None:
        client = FakeClient([throttled(), throttled(), hits("https://a.test/")])
        record, clock = run(client)
        self.assertEqual(record["attempts"], 3)
        self.assertEqual(len(client.calls), 3)
        self.assertEqual(clock.sleeps, [25.0, 25.0])
        self.assertEqual(len(record["results"]), 1)

    def test_an_empty_response_without_throttled_engines_is_not_retried(self) -> None:
        client = FakeClient([FakeResponse()])
        record, clock = run(client)
        self.assertEqual(record["attempts"], 1)
        self.assertEqual(clock.sleeps, [])
        self.assertEqual(record["results"], [])
        self.assertEqual(record["unresponsive"], [])

    def test_gives_up_after_three_attempts_without_a_last_pause(self) -> None:
        client = FakeClient([throttled()])
        record, clock = run(client)
        self.assertEqual(record["attempts"], serp_search.MAX_ATTEMPTS)
        self.assertEqual(serp_search.MAX_ATTEMPTS, 3)
        self.assertEqual(serp_search.RETRY_WAIT_SECONDS, 25)
        self.assertEqual(clock.sleeps, [25.0, 25.0])
        self.assertEqual(record["results"], [])
        self.assertEqual(record["unresponsive"], [["duckduckgo", "CAPTCHA"]])

    def test_results_from_a_partly_throttled_search_are_not_retried(self) -> None:
        client = FakeClient([hits("https://a.test/", unresponsive_engines=(FakeEngine("brave", "too many requests"),))])
        record, clock = run(client)
        self.assertEqual(record["attempts"], 1)
        self.assertEqual(clock.sleeps, [])
        self.assertEqual(record["unresponsive"], [["brave", "too many requests"]])

    def test_throttled_engines_seen_in_any_attempt_are_listed_once_and_sorted(self) -> None:
        client = FakeClient([throttled("duckduckgo", "CAPTCHA"), throttled("brave", "too many requests"), throttled("duckduckgo", "CAPTCHA")])
        record, _ = run(client)
        self.assertEqual(record["unresponsive"], [["brave", "too many requests"], ["duckduckgo", "CAPTCHA"]])

    def test_a_client_error_is_not_swallowed(self) -> None:
        with self.assertRaises(FakeSearxngError):
            run(FakeClient([FakeSearxngError("HTTP 403")]))


class PagingAndOptionsTests(unittest.TestCase):
    def test_pages_are_merged_deduplicated_and_ranked_in_order(self) -> None:
        client = FakeClient([hits("https://a.test/", "https://b.test/"), hits("https://b.test/", "https://c.test/")])
        record, clock = run(client, pages=2)
        self.assertEqual([item["url"] for item in record["results"]], ["https://a.test/", "https://b.test/", "https://c.test/"])
        self.assertEqual([item["rank"] for item in record["results"]], [1, 2, 3])
        self.assertEqual([call["pageno"] for call in client.calls], [1, 2])
        self.assertEqual(clock.sleeps, [serp_search.PAGE_PAUSE_SECONDS])

    def test_attempts_count_every_call_across_pages(self) -> None:
        client = FakeClient([throttled(), hits("https://a.test/"), hits("https://b.test/")])
        record, _ = run(client, pages=2)
        self.assertEqual(record["attempts"], 3)

    def test_engines_are_passed_by_full_name(self) -> None:
        client = FakeClient()
        run(client, engines=("google cse", "duckduckgo"))
        call = client.calls[0]
        self.assertEqual(call["engines"], ["google cse", "duckduckgo"])
        self.assertEqual((call["language"], call["pageno"]), ("en-US", 1))
        self.assertNotIn("categories", call)

    def test_without_engines_the_general_category_is_searched(self) -> None:
        client = FakeClient()
        run(client, engines=())
        self.assertEqual(client.calls[0]["categories"], "general")
        self.assertNotIn("engines", client.calls[0])

    def test_default_engines_leave_out_bing_and_brave(self) -> None:
        self.assertEqual(serp_search.DEFAULT_ENGINES, "google cse,duckduckgo")
        self.assertEqual(serp_search.parse_engines("google cse, duckduckgo ,"), ("google cse", "duckduckgo"))
        self.assertEqual(serp_search.parse_engines(""), ())


FAKE_CLIENT_SOURCE = '''
from __future__ import annotations
from dataclasses import dataclass


class SearxngError(Exception):
    pass


@dataclass(frozen=True)
class Marker:
    value: int = 1


class SearxngClient:
    healthy = True

    def __init__(self, base_url, timeout=60.0, max_retries=2):
        self.base_url = base_url
        self.timeout = timeout
        self.max_retries = max_retries

    def healthcheck(self):
        return SearxngClient.healthy
'''


class ConnectTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.client_dir = Path(self._tmp.name) / "SearXNG"
        self.client_dir.mkdir()
        (self.client_dir / "searxng_client.py").write_text(FAKE_CLIENT_SOURCE, encoding="utf-8")

    def test_loads_the_single_file_client_from_a_folder(self) -> None:
        module = serp_search.load_client_module(self.client_dir)
        self.assertTrue(hasattr(module, "SearxngClient"))
        self.assertTrue(issubclass(module.SearxngError, Exception))

    def test_connects_and_returns_the_client_and_its_error_type(self) -> None:
        connection = serp_search.connect_searxng("http://localhost:8080", self.client_dir)
        self.assertEqual(connection.client.base_url, "http://localhost:8080")
        self.assertEqual(connection.client.timeout, serp_search.CLIENT_TIMEOUT_SECONDS)
        self.assertEqual(connection.client.max_retries, serp_search.CLIENT_RETRIES)
        self.assertEqual(connection.error_type.__name__, "SearxngError")

    def test_a_missing_client_file_says_where_it_looked_and_how_to_point_at_it(self) -> None:
        empty = Path(self._tmp.name) / "elsewhere"
        empty.mkdir()
        with self.assertRaises(SeoToolError) as caught:
            serp_search.load_client_module(empty)
        message = str(caught.exception)
        self.assertIn("searxng_client.py", message)
        self.assertIn(str(empty), message)
        self.assertIn("SEARXNG_CLIENT_DIR", message)

    def test_a_client_file_that_fails_to_load_is_reported(self) -> None:
        (self.client_dir / "searxng_client.py").write_text("def broken(:\n", encoding="utf-8")
        with self.assertRaises(SeoToolError) as caught:
            serp_search.load_client_module(self.client_dir)
        self.assertIn("cannot load", str(caught.exception))

    def test_an_unreachable_instance_says_how_to_start_it(self) -> None:
        unhealthy = FAKE_CLIENT_SOURCE.replace("healthy = True", "healthy = False")
        (self.client_dir / "searxng_client.py").write_text(unhealthy, encoding="utf-8")
        with self.assertRaises(SeoToolError) as caught:
            serp_search.connect_searxng("http://localhost:8080", self.client_dir)
        message = str(caught.exception)
        self.assertIn("http://localhost:8080", message)
        self.assertIn("Docker Desktop", message)
        self.assertIn("docker compose up -d", message)
        self.assertIn(str(self.client_dir), message)

    def test_the_client_folder_defaults_to_the_sibling_checkout(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop(serp_search.CLIENT_DIR_ENV, None)
            expected = serp_search.REPO_ROOT.parent / "SearXNG"
            self.assertEqual(serp_search.client_dir(), expected)

    def test_the_client_folder_can_be_set_with_the_environment(self) -> None:
        with mock.patch.dict(os.environ, {serp_search.CLIENT_DIR_ENV: "/elsewhere/SearXNG"}):
            self.assertEqual(serp_search.client_dir(), Path("/elsewhere/SearXNG"))

    def test_the_instance_url_defaults_to_localhost_and_can_be_set(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop(serp_search.URL_ENV, None)
            self.assertEqual(serp_search.searxng_url(), "http://localhost:8080")
        with mock.patch.dict(os.environ, {serp_search.URL_ENV: "http://127.0.0.1:9999"}):
            self.assertEqual(serp_search.searxng_url(), "http://127.0.0.1:9999")

    def test_the_instance_url_must_be_http(self) -> None:
        with mock.patch.dict(os.environ, {serp_search.URL_ENV: "file:///tmp/x"}), self.assertRaises(SeoToolError):
            serp_search.searxng_url()


class MainTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.folder = Path(self._tmp.name)
        self.queries = self.folder / "my-queries.txt"
        self.queries.write_text("# comment\nfirst query\nsecond query\n", encoding="utf-8")
        self.out_dir = self.folder / "out"

    def run_main(self, client: FakeClient, extra: Sequence[str] = (), queries: Optional[Path] = None):
        clock = FakeClock()
        connection = SearxngConnection(client, FakeSearxngError)
        argv = [str(queries or self.queries), "--out-dir", str(self.out_dir), *extra]
        with captured() as (out, err):
            code = run_cli(lambda args: serp_search.main(args, connect=lambda url, folder: connection, sleep=clock.sleep), argv)
        return code, out.getvalue(), err.getvalue(), clock

    def test_writes_one_json_file_per_query_named_by_the_hashed_slug(self) -> None:
        code, _, _, _ = self.run_main(FakeClient([hits("https://a.test/")]))
        self.assertEqual(code, 0)
        for query in ("first query", "second query"):
            record = json.loads((self.out_dir / f"{hashed_slug(query)}.json").read_text(encoding="utf-8"))
            self.assertEqual(record["query"], query)
            self.assertEqual(list(record), RECORD_KEYS)

    def test_prints_one_status_line_per_query(self) -> None:
        _, out, _, _ = self.run_main(FakeClient([hits("https://a.test/", suggestions=("s",))]))
        lines = out.strip().splitlines()
        self.assertTrue(lines[0].startswith("[1/2] ok 1 results, 1 suggestions | throttled: none | 'first query'"), lines[0])
        self.assertTrue(lines[1].startswith("[2/2] ok"), lines[1])

    def test_an_empty_search_is_flagged_and_the_throttled_engines_are_named(self) -> None:
        _, out, _, _ = self.run_main(FakeClient([throttled()]))
        self.assertIn("EMPTY", out)
        self.assertIn("throttled: duckduckgo(CAPTCHA)", out)

    def test_pauses_between_queries_but_not_after_the_last(self) -> None:
        _, _, _, clock = self.run_main(FakeClient([hits("https://a.test/")]), extra=["--delay", "7"])
        self.assertEqual(clock.sleeps, [7.0])

    def test_a_failing_query_is_reported_and_the_rest_still_run(self) -> None:
        client = FakeClient([FakeSearxngError("HTTP 403"), hits("https://a.test/")])
        code, out, _, _ = self.run_main(client)
        self.assertEqual(code, 1)
        self.assertIn("ERROR", out)
        self.assertIn("HTTP 403", out)
        self.assertFalse((self.out_dir / f"{hashed_slug('first query')}.json").exists())
        self.assertTrue((self.out_dir / f"{hashed_slug('second query')}.json").exists())

    def test_default_engines_pages_and_language_reach_the_client(self) -> None:
        client = FakeClient([hits("https://a.test/")])
        self.run_main(client)
        call = client.calls[0]
        self.assertEqual((call["engines"], call["language"], call["pageno"]), (["google cse", "duckduckgo"], "en-US", 1))

    def test_options_reach_the_client(self) -> None:
        client = FakeClient([hits("https://a.test/")])
        self.run_main(client, extra=["--engines", "duckduckgo", "--language", "en-AU", "--pages", "2"])
        self.assertEqual(client.calls[0]["engines"], ["duckduckgo"])
        self.assertEqual(client.calls[0]["language"], "en-AU")
        self.assertEqual(len(client.calls), 4)  # two queries x two pages

    def test_an_empty_engines_option_uses_the_instance_defaults(self) -> None:
        client = FakeClient([hits("https://a.test/")])
        self.run_main(client, extra=["--engines", ""])
        self.assertEqual(client.calls[0]["categories"], "general")

    def test_the_output_folder_defaults_to_the_data_folder(self) -> None:
        client = FakeClient([hits("https://a.test/")])
        clock = FakeClock()
        connection = SearxngConnection(client, FakeSearxngError)
        with mock.patch.dict(os.environ, {"SEO_DATA_DIR": str(self.folder / "data")}), captured():
            serp_search.main([str(self.queries)], connect=lambda url, folder: connection, sleep=clock.sleep)
        self.assertTrue((self.folder / "data" / "serp" / "my-queries" / f"{hashed_slug('first query')}.json").is_file())

    def test_a_missing_queries_file_exits_2(self) -> None:
        code, _, err, _ = self.run_main(FakeClient(), queries=self.folder / "nope.txt")
        self.assertEqual(code, 2)
        self.assertIn("nope.txt", err)

    def test_an_unreachable_instance_exits_2_with_instructions(self) -> None:
        def unreachable(url: str, folder: Path) -> SearxngConnection:
            raise SeoToolError("SearXNG is not reachable. Start Docker Desktop, then run `docker compose up -d`")

        with captured() as (_, err):
            code = run_cli(lambda args: serp_search.main(args, connect=unreachable), [str(self.queries), "--out-dir", str(self.out_dir)])
        self.assertEqual(code, 2)
        self.assertIn("docker compose up -d", err.getvalue())
        self.assertNotIn("Traceback", err.getvalue())

    def test_bad_numbers_are_rejected_by_the_parser(self) -> None:
        for extra in (["--pages", "0"], ["--delay", "-1"], ["--pages", "x"]):
            with self.subTest(extra=extra), captured(), self.assertRaises(SystemExit) as caught:
                serp_search.main([str(self.queries), *extra], connect=mock.Mock())
            self.assertEqual(caught.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
