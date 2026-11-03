"""A real HTTP server on 127.0.0.1 (an ephemeral port) for the tests that must exercise urllib's real opener.

FakeOpener stands in for urllib everywhere else, which means redirect handling, header parsing, gzip and error
bodies of the real stack would otherwise never run. Only loopback sockets are used: nothing leaves the machine.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import List, Mapping, Optional, Sequence, Tuple

Pairs = Sequence[Tuple[str, str]]
POLL_SECONDS = 0.01  # how quickly shutdown() returns


@dataclass(frozen=True)
class Page:
    """What the server answers for one request path. Headers are pairs, so a name may repeat."""

    status: int = 200
    body: bytes = b""
    headers: Pairs = ()


@dataclass(frozen=True)
class Seen:
    path: str
    headers: Mapping[str, str]


class LoopbackServer:
    """Use as a context manager. Unknown paths answer 404 with the body ``not found``."""

    def __init__(self, routes: Mapping[str, Page]) -> None:
        self.routes = dict(routes)
        self.seen: List[Seen] = []
        self._lock = threading.Lock()
        server = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802 - the name http.server looks for
                server._serve(self)

            def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - silence the access log
                return

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._thread: Optional[threading.Thread] = None

    @property
    def port(self) -> int:
        return int(self._server.server_address[1])

    @property
    def base(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def url(self, path: str = "/") -> str:
        return self.base + path

    @property
    def paths(self) -> List[str]:
        with self._lock:
            return [item.path for item in self.seen]

    def count(self, path: str) -> int:
        return self.paths.count(path)

    def _serve(self, handler: BaseHTTPRequestHandler) -> None:
        with self._lock:
            self.seen.append(Seen(handler.path, {name.lower(): value for name, value in handler.headers.items()}))
        page = self.routes.get(handler.path, Page(404, b"not found"))
        try:
            handler.send_response_only(page.status)  # no automatic Server or Date header: the page sets them all
            names = {name.lower() for name, _ in page.headers}
            for name, value in page.headers:
                handler.send_header(name, value)
            if "content-length" not in names:
                handler.send_header("Content-Length", str(len(page.body)))
            handler.end_headers()
            handler.wfile.write(page.body)
        except (BrokenPipeError, ConnectionResetError):  # the client gave up early: nothing to do
            return

    def __enter__(self) -> "LoopbackServer":
        self._thread = threading.Thread(target=lambda: self._server.serve_forever(poll_interval=POLL_SECONDS), daemon=True)
        self._thread.start()
        return self

    def __exit__(self, *exc_info: object) -> None:
        self._server.shutdown()
        self._server.server_close()
        if self._thread is not None:
            self._thread.join(timeout=5)


def free_port() -> int:
    """A port nothing listens on right now (a server is started and stopped to find one)."""
    with LoopbackServer({}) as server:
        return server.port
