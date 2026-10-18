"""One HTTP answer as this tool keeps it: status, the headers worth keeping, and a body that can never grow past
a limit (a gzip bomb is cut at the limit, not expanded). Standard library only.
"""

from __future__ import annotations

import http.client
import re
import zlib
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Optional, Tuple
from urllib.parse import urljoin

from seo_common import SeoToolError, require_http_url

MAX_BYTES = 6_000_000
REDIRECT_STATUSES = (301, 302, 303, 307, 308)
KEPT_HEADERS = (
    "content-type", "server", "cache-control", "x-robots-tag", "link", "content-language", "x-powered-by",
    "strict-transport-security", "content-security-policy", "age", "via", "cf-cache-status", "x-cache",
    "last-modified", "etag", "location", "retry-after",
)
GZIP_WBITS = zlib.MAX_WBITS | 16
MAX_RETRY_AFTER_SECONDS = 31_536_000.0  # a year: what a number too long to read is taken to mean
MAX_RETRY_AFTER_DIGITS = 15
SECONDS = re.compile(r"\d+", re.ASCII)
Headers = Tuple[Tuple[str, str], ...]


@dataclass(frozen=True)
class RawReply:
    """One HTTP exchange: what came back (or why nothing did)."""

    status: Optional[int]
    headers: Headers
    body: bytes = b""
    error: str = ""
    truncated: bool = False
    elapsed_ms: int = 0


def decode_body(raw: bytes, encoding: str, limit: int = MAX_BYTES) -> Tuple[bytes, bool]:
    """Undo gzip or deflate without ever producing more than ``limit`` bytes. Returns (body, truncated)."""
    name = encoding.strip().lower()
    if name in ("", "identity"):
        return raw[:limit], len(raw) > limit
    window_sizes: Tuple[int, ...]
    if name in ("gzip", "x-gzip"):
        window_sizes = (GZIP_WBITS,)
    elif name == "deflate":
        window_sizes = (zlib.MAX_WBITS, -zlib.MAX_WBITS)  # with and without the zlib header: servers differ
    else:
        raise ValueError(f"unsupported Content-Encoding {name!r}")
    failure = ""
    for wbits in window_sizes:
        decompressor = zlib.decompressobj(wbits)
        try:
            out = decompressor.decompress(raw, limit + 1)
        except zlib.error as error:
            failure = str(error)
            continue
        return out[:limit], len(out) > limit or not decompressor.eof
    raise ValueError(f"could not decode the {name} body: {failure}")


def header_text(value: str) -> str:
    """http.client reads header bytes as Latin-1; a server that sent UTF-8 (a Location with an é) needs re-reading."""
    try:
        return value.encode("latin-1").decode("utf-8")
    except UnicodeError:
        return value


def redirect_target(current: str, reply: RawReply) -> Tuple[str, str]:
    """(next URL, "") for a followable redirect, ("", problem) for a refused one, ("", "") when the reply is final."""
    if reply.status not in REDIRECT_STATUSES or reply.error:
        return "", ""
    location = header_text(next((value for name, value in reply.headers if name == "location"), "")).strip()
    if not location:
        return "", ""
    try:
        return require_http_url(urljoin(current, location)), ""
    except (SeoToolError, ValueError) as error:  # urljoin raises ValueError for addresses such as http://[::1/
        return "", f"redirect from {current} refused: {error}"


def kept_headers(response: Any) -> Headers:
    """The headers worth keeping. A header sent more than once (two Link lines, X-Robots-Tag: all plus a
    per-robot one) is joined with ", ", as HTTP allows, so that no value is lost."""
    kept = []
    for name in KEPT_HEADERS:
        joined = ", ".join(value for value in response.headers.get_all(name) or [] if value)
        if joined:
            kept.append((name, joined))
    return tuple(kept)


def read_reply(response: Any, status: int, max_bytes: int = MAX_BYTES) -> RawReply:
    """Read an open response (or an HTTPError, which is one too) into a RawReply; read problems become ``error``."""
    headers = kept_headers(response)
    try:
        raw = response.read(max_bytes + 1)
        body, truncated = decode_body(raw, response.headers.get("Content-Encoding") or "", max_bytes)
    except (OSError, http.client.HTTPException, ValueError) as error:
        return RawReply(status, headers, error=f"{type(error).__name__}: {error}")
    return RawReply(status, headers, body=body, truncated=truncated)


def retry_after_seconds(value: str, now: Optional[datetime] = None) -> Optional[float]:
    """How long a server asked clients to wait: ``Retry-After: 120`` or an HTTP date. None when not understood."""
    text = value.strip()
    if SECONDS.fullmatch(text):
        too_long = len(text) > MAX_RETRY_AFTER_DIGITS
        return MAX_RETRY_AFTER_SECONDS if too_long else min(float(text), MAX_RETRY_AFTER_SECONDS)
    try:
        when = parsedate_to_datetime(text)
    except (TypeError, ValueError, IndexError, OverflowError):
        return None
    when = when if when.tzinfo is not None else when.replace(tzinfo=timezone.utc)
    seconds = (when - (now or datetime.now(timezone.utc))).total_seconds()
    return max(0.0, min(seconds, MAX_RETRY_AFTER_SECONDS))
