"""Test doubles and fixture loaders shared by the SEO tool tests. Nothing here uses the network or really sleeps.

Importing this module also puts tools/seo on sys.path, so the tests can import the tools directly.
"""

from __future__ import annotations

import contextlib
import io
import sys
import urllib.error
from dataclasses import dataclass, field
from email.message import Message
from pathlib import Path
from typing import Dict, Iterator, List, Mapping, Optional, Sequence, Tuple, Union

TESTS_DIR = Path(__file__).resolve().parent
TOOLS_DIR = TESTS_DIR.parent
FIXTURES_DIR = TESTS_DIR / "fixtures"

if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))


def fixture_path(*parts: str) -> Path:
    return FIXTURES_DIR.joinpath(*parts)


def fixture_text(*parts: str) -> str:
    return fixture_path(*parts).read_text(encoding="utf-8")


def fixture_bytes(*parts: str) -> bytes:
    return fixture_path(*parts).read_bytes()


@contextlib.contextmanager
def captured() -> Iterator[Tuple[io.StringIO, io.StringIO]]:
    """Capture stdout and stderr: yields (stdout, stderr)."""
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        yield out, err


class FakeClock:
    """A clock whose sleep() only moves time forward (and remembers each pause), so tests never wait."""

    def __init__(self, start: float = 1000.0) -> None:
        self.now = start
        self.sleeps: List[float] = []

    def __call__(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


@dataclass(frozen=True)
class Reply:
    """What the fake server answers for one URL."""

    status: int = 200
    body: bytes = b""
    headers: Mapping[str, str] = field(default_factory=dict)


Step = Union[Reply, BaseException]
Route = Union[Reply, BaseException, Sequence[Step]]


def headers_message(headers: Mapping[str, str]) -> Message:
    message = Message()
    for name, value in headers.items():
        message[name] = value
    return message


class FakeResponse:
    """The parts of an HTTP response the fetcher uses."""

    def __init__(self, url: str, reply: Reply) -> None:
        self.status = reply.status
        self.headers = headers_message(reply.headers)
        self._url = url
        self._body = io.BytesIO(reply.body)

    def read(self, amount: int = -1) -> bytes:
        return self._body.read(amount)

    def geturl(self) -> str:
        return self._url

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *exc_info: object) -> bool:
        self._body.close()
        return False


class FakeOpener:
    """Stands in for urllib's opener. Unknown URLs answer 404; non-2xx answers raise HTTPError like the real one.

    A route can be one Reply, an exception to raise, or a list of those used one after another (the last repeats).
    Every request is logged as (url, time on the fake clock) and its User-Agent is kept.
    """

    def __init__(self, routes: Mapping[str, Route], clock: Optional[FakeClock] = None, seconds_per_request: float = 0.0):
        self._routes = dict(routes)
        self._clock = clock
        self._seconds = seconds_per_request
        self._served: Dict[str, int] = {}
        self.requests: List[Tuple[str, float]] = []
        self.user_agents: List[str] = []
        self.request_headers: List[Dict[str, str]] = []

    @property
    def urls(self) -> List[str]:
        return [url for url, _ in self.requests]

    def times_for(self, host_prefix: str) -> List[float]:
        return [when for url, when in self.requests if url.startswith(host_prefix)]

    def open(self, request: object, timeout: Optional[float] = None) -> FakeResponse:
        url = request.full_url  # type: ignore[attr-defined]
        now = self._clock() if self._clock else 0.0
        self.requests.append((url, now))
        self.user_agents.append(request.get_header("User-agent"))  # type: ignore[attr-defined]
        self.request_headers.append(dict(request.header_items()))  # type: ignore[attr-defined]
        step = self._next_step(url)
        if self._clock:
            self._clock.now += self._seconds
        if isinstance(step, BaseException):
            raise step
        if 200 <= step.status < 300:
            return FakeResponse(url, step)
        raise urllib.error.HTTPError(url, step.status, "status", headers_message(step.headers), io.BytesIO(step.body))

    def _next_step(self, url: str) -> Step:
        route = self._routes.get(url)
        if route is None:
            return Reply(404, b"not found")
        if isinstance(route, (Reply, BaseException)):
            return route
        index = self._served.get(url, 0)
        self._served[url] = index + 1
        return route[min(index, len(route) - 1)]
