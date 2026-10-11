#!/usr/bin/env python3
"""GitHub-Pages-like static file server for local QA (standard library only).

Behaviour (mirrors what GitHub Pages does for a static export):

* ``--prefix /repo``: only URLs under the prefix are served. Everything else,
  including ``/``, answers 404 with the root's ``404.html``.
* A directory URL without a trailing slash gets a 301 to the slash form
  (``/about`` -> ``/about/``); the prefix itself behaves the same way.
* A directory URL with a trailing slash serves its ``index.html``.
* Unknown paths answer status 404 with the body of ``<root>/404.html``.
* Lookups are case-sensitive even on case-insensitive file systems (macOS),
  because GitHub Pages runs on Linux: ``/About/`` must not find ``about/``.
* Only GET and HEAD are allowed (405 otherwise), like a static host.
* ``--emulate-jekyll`` (opt-in): when ``<root>/.nojekyll`` is absent, paths with
  a segment starting with ``_`` or ``.`` answer 404, as Jekyll-built Pages sites
  do. This is the classic reason ``_next/`` assets vanish on GitHub Pages.

Example:
    python3 serve_pages.py --root ./out --prefix /numaliving.com.au --port 4302
"""

from __future__ import annotations

import argparse
import html
import mimetypes
import os
import signal
import sys
import threading
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 4301
NOT_FOUND_PAGE = "404.html"
INDEX_PAGE = "index.html"
HTML_TYPE = "text/html; charset=utf-8"
FALLBACK_404_BODY = b"<!doctype html><title>404</title><h1>404 Not Found</h1>\n"
JEKYLL_HIDDEN_PREFIXES = ("_", ".", "#", "~")
JEKYLL_ALLOWED_SEGMENTS = frozenset({".well-known"})
ALLOWED_METHODS = "GET, HEAD"

MIME_BY_SUFFIX = {
    ".html": HTML_TYPE,
    ".htm": HTML_TYPE,
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".pdf": "application/pdf",
    ".wasm": "application/wasm",
    ".zip": "application/zip",
}


@dataclass(frozen=True)
class ServerConfig:
    root: Path
    prefix: str = ""
    quiet: bool = False
    emulate_jekyll: bool = False


@dataclass(frozen=True)
class Resolution:
    """Outcome of mapping a request target to something to send."""

    kind: str  # "file" | "redirect" | "not_found"
    path: Path | None = None
    location: str | None = None


NOT_FOUND = Resolution("not_found")


class RangeNotSatisfiable(Exception):
    """Raised for a byte range that starts beyond the end of the file."""


def normalize_prefix(raw: str | None) -> str:
    """Return ``""`` or a prefix with a leading slash and no trailing slash."""
    cleaned = (raw or "").strip().strip("/")
    if not cleaned:
        return ""
    if any(char in cleaned for char in "?#"):
        raise ValueError(f"prefix must not contain '?' or '#': {raw!r}")
    return "/" + cleaned


def guess_content_type(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in MIME_BY_SUFFIX:
        return MIME_BY_SUFFIX[suffix]
    guessed, _ = mimetypes.guess_type(path.name)
    if guessed is None:
        return "application/octet-stream"
    return f"{guessed}; charset=utf-8" if guessed.startswith("text/") else guessed


def has_exact_child(directory: Path, name: str) -> bool:
    """Case-sensitive existence check, independent of the file system's rules."""
    try:
        return name in os.listdir(directory)
    except OSError:
        return False


def split_prefix(path: str, prefix: str) -> str | None:
    """Path below ``prefix`` ("" when equal to it); None when outside the prefix."""
    if not prefix:
        return path
    if path == prefix:
        return ""
    if path.startswith(prefix + "/"):
        return path[len(prefix):]
    return None


def clean_segments(inner: str) -> list[str] | None:
    """Split a path into segments, resolving '.' and '..'; None if it escapes the root."""
    segments: list[str] = []
    for segment in inner.split("/"):
        if segment in ("", "."):
            continue
        if segment == "..":
            if not segments:
                return None
            segments = segments[:-1]
            continue
        segments.append(segment)
    return segments


def is_hidden_by_jekyll(config: ServerConfig, segments: list[str]) -> bool:
    if not config.emulate_jekyll or (config.root / ".nojekyll").exists():
        return False
    return any(
        segment.startswith(JEKYLL_HIDDEN_PREFIXES) and segment not in JEKYLL_ALLOWED_SEGMENTS
        for segment in segments
    )


def locate(root: Path, segments: list[str]) -> Path | None:
    """Walk ``segments`` below ``root`` with exact-case matching; None if missing/outside."""
    current = root
    for segment in segments:
        if not has_exact_child(current, segment):
            return None
        current = current / segment
    return current if current.resolve().is_relative_to(root.resolve()) else None


def redirect_to(path: str, query: str) -> Resolution:
    # Exactly one leading slash: "/%2Fabout" decodes to "//about", and a Location starting with "//"
    # is a protocol-relative URL that sends the browser to another host (an open redirect).
    location = quote("/" + path.lstrip("/"), safe="/")
    return Resolution("redirect", location=f"{location}?{query}" if query else location)


def resolve_located(located: Path, wants_directory: bool, path: str, query: str) -> Resolution:
    if located.is_dir():
        index = located / INDEX_PAGE
        if not (has_exact_child(located, INDEX_PAGE) and index.is_file()):
            return NOT_FOUND
        if wants_directory:
            return Resolution("file", path=index)
        return redirect_to(path + "/", query)
    if located.is_file() and not wants_directory:
        return Resolution("file", path=located)
    return NOT_FOUND


def resolve_request(config: ServerConfig, target: str) -> Resolution:
    """Map a raw request target (path + optional query) to a file, redirect or 404."""
    parts = urlsplit(target)
    path = unquote(parts.path)
    inner = split_prefix(path, config.prefix)
    if "\x00" in path or inner is None:
        return NOT_FOUND
    if inner == "":
        return redirect_to(path + "/", parts.query)
    segments = clean_segments(inner)
    if segments is None or is_hidden_by_jekyll(config, segments):
        return NOT_FOUND
    located = locate(config.root, segments)
    if located is None:
        return NOT_FOUND
    wants_directory = inner.endswith("/") or not segments
    return resolve_located(located, wants_directory, path, parts.query)


def parse_byte_range(header: str | None, size: int) -> tuple[int, int] | None:
    """Parse a single ``bytes=a-b`` range into inclusive offsets; None means "send it all"."""
    if not header or not header.startswith("bytes=") or "," in header:
        return None
    start_text, _, end_text = header[len("bytes="):].strip().partition("-")
    try:
        if start_text == "":
            suffix_length = int(end_text)
            if suffix_length <= 0:
                return None
            start, end = max(size - suffix_length, 0), size - 1
        else:
            start = int(start_text)
            end = int(end_text) if end_text else size - 1
    except ValueError:
        return None
    end = min(end, size - 1)
    if size == 0 or start > end:
        raise RangeNotSatisfiable
    return start, end


class PagesHandler(BaseHTTPRequestHandler):
    server_version = "serve_pages/1.0"
    sys_version = ""
    protocol_version = "HTTP/1.1"

    def version_string(self) -> str:
        return self.server_version

    def do_GET(self) -> None:
        self._serve()

    def do_HEAD(self) -> None:
        self._serve()

    def _method_not_allowed(self) -> None:
        self._send(405, b"405 Method Not Allowed\n", "text/plain; charset=utf-8", {"Allow": ALLOWED_METHODS})

    do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = _method_not_allowed

    def _serve(self) -> None:
        config: ServerConfig = self.server.config  # type: ignore[attr-defined]
        resolution = resolve_request(config, self.path)
        if resolution.kind == "redirect":
            self._send_redirect(resolution.location or "/")
        elif resolution.kind == "file" and resolution.path is not None:
            self._send_file(resolution.path)
        else:
            self._send_not_found()

    def _send_redirect(self, location: str) -> None:
        target = html.escape(location, quote=True)
        body = f'<!doctype html><title>301</title><a href="{target}">Moved Permanently</a>\n'.encode()
        self._send(301, body, HTML_TYPE, {"Location": location})

    def _send_not_found(self) -> None:
        config: ServerConfig = self.server.config  # type: ignore[attr-defined]
        try:
            body = (config.root / NOT_FOUND_PAGE).read_bytes()
        except OSError:
            body = FALLBACK_404_BODY
        self._send(404, body, HTML_TYPE)

    def _send_file(self, path: Path) -> None:
        try:
            data = path.read_bytes()
        except OSError:
            self._send_not_found()
            return
        content_type = guess_content_type(path)
        try:
            byte_range = parse_byte_range(self.headers.get("Range"), len(data))
        except RangeNotSatisfiable:
            self._send(416, b"", content_type, {"Content-Range": f"bytes */{len(data)}"})
            return
        if byte_range is None:
            self._send(200, data, content_type, {"Accept-Ranges": "bytes"})
            return
        start, end = byte_range
        headers = {"Content-Range": f"bytes {start}-{end}/{len(data)}", "Accept-Ranges": "bytes"}
        self._send(206, data[start : end + 1], content_type, headers)

    def _send(self, status: int, body: bytes, content_type: str, headers: dict[str, str] | None = None) -> None:
        try:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-cache")
            for name, value in (headers or {}).items():
                self.send_header(name, value)
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - stdlib signature
        config: ServerConfig = self.server.config  # type: ignore[attr-defined]
        if not config.quiet:
            sys.stderr.write(f"{self.log_date_time_string()} {format % args}\n")


class PagesServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], config: ServerConfig) -> None:
        super().__init__(address, PagesHandler)
        self.config = config

    def handle_error(self, request: object, client_address: object) -> None:
        if isinstance(sys.exc_info()[1], (BrokenPipeError, ConnectionResetError, ConnectionAbortedError)):
            return  # the browser cancelled a request; not worth a traceback
        super().handle_error(request, client_address)  # type: ignore[arg-type]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="GitHub-Pages-like static server for QA.")
    parser.add_argument("--root", required=True, help="directory to serve (contains index.html and 404.html)")
    parser.add_argument("--prefix", default="", help="serve only under this URL prefix, e.g. /numaliving.com.au")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="TCP port (0 picks a free one)")
    parser.add_argument("--host", default=DEFAULT_HOST, help=f"bind address (default {DEFAULT_HOST})")
    parser.add_argument("--quiet", action="store_true", help="do not log requests")
    parser.add_argument(
        "--emulate-jekyll",
        action="store_true",
        help="404 paths with '_' or '.' segments unless <root>/.nojekyll exists",
    )
    return parser.parse_args(argv)


def install_shutdown_handlers(server: PagesServer) -> None:
    def stop(_signum: int, _frame: object) -> None:
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"serve_pages: --root is not a directory: {root}", file=sys.stderr)
        return 2
    try:
        prefix = normalize_prefix(args.prefix)
    except ValueError as error:
        print(f"serve_pages: {error}", file=sys.stderr)
        return 2
    if not (root / NOT_FOUND_PAGE).is_file():
        print(f"serve_pages: warning: {root / NOT_FOUND_PAGE} is missing; 404s use a stub page", file=sys.stderr)
    if args.emulate_jekyll and not (root / ".nojekyll").exists():
        print("serve_pages: no .nojekyll in root; paths starting with '_' or '.' will 404", file=sys.stderr)

    config = ServerConfig(root=root, prefix=prefix, quiet=args.quiet, emulate_jekyll=args.emulate_jekyll)
    try:
        server = PagesServer((args.host, args.port), config)
    except OSError as error:
        print(f"serve_pages: cannot bind {args.host}:{args.port}: {error}", file=sys.stderr)
        return 2
    install_shutdown_handlers(server)
    port = server.server_address[1]
    print(f"serve_pages: serving {root} at http://{args.host}:{port}{prefix}/", flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        print("serve_pages: stopped", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
