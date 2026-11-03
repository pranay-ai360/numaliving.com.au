"""Shared helpers for the SEO research tools: errors, logging, the data folder, slugs, list files and URL checks.

Every tool in this folder imports this module, so keep them side by side. Standard library only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Sequence, Tuple
from urllib.parse import SplitResult, quote, urlsplit, urlunsplit

TOOLS_DIR = Path(__file__).resolve().parent
REPO_ROOT = TOOLS_DIR.parents[1]
DATA_DIR_ENV = "SEO_DATA_DIR"
DEBUG_ENV = "SEO_DEBUG"
DEFAULT_DATA_DIR = TOOLS_DIR / "data"
ALLOWED_URL_SCHEMES = ("http", "https")
EXIT_FAILURE = 1
EXIT_USAGE = 2
EXIT_INTERRUPTED = 130
SLUG_MAX_LENGTH = 60
URL_SLUG_MAX_LENGTH = 120
HASH_LENGTH = 6
ERROR_LINE_MAX_CHARS = 300


class SeoToolError(Exception):
    """A problem the user can fix. The CLIs print the message without a traceback and exit with ``exit_code``."""

    exit_code = EXIT_USAGE


UNSAFE_CHARACTERS = re.compile(
    "[\x00-\x08\x0b-\x1f\x7f-\x9f"  # C0 controls (tab and newline stay), DEL and the C1 controls
    "\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069"  # direction marks and overrides, line separators
    "\ud800-\udfff]"  # lone surrogates, which a UTF-8 terminal cannot be sent
)


def _escape(match: "re.Match[str]") -> str:
    code = ord(match.group(0))
    return f"\\x{code:02x}" if code < 0x100 else f"\\u{code:04x}"


def printable(text: str) -> str:
    """The text with control characters, direction overrides and line separators shown as \\x1b or \\u202e escapes.

    Page text, search results and server answers are data from elsewhere: raw, they can set the window title,
    clear the screen, write to the clipboard on some terminals, or reorder the line. Tab and newline stay.
    """
    return UNSAFE_CHARACTERS.sub(_escape, text)


def emit(text: str) -> None:
    """Print a tool's own output (a table, a result line) to stdout in its safe form."""
    print(printable(text), flush=True)


def log(message: str) -> None:
    """Diagnostics go to stderr, so a tool's own output (tables, URL lists) stays clean to pipe."""
    print(f"[seo] {printable(message)}", file=sys.stderr, flush=True)


def format_seconds(value: float) -> str:
    """61 -> "61", 2.5 -> "2.5", 31536000 -> "31,536,000": a duration for a message."""
    return f"{value:,.1f}".rstrip("0").rstrip(".")


def counted(number: int, noun: str, plural: str = "") -> str:
    """"1 page", "2 pages": the noun is singular and gets an s unless there is exactly one (or ``plural`` is given)."""
    return f"{number} {noun}" if number == 1 else f"{number} {plural or noun + 's'}"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def data_dir() -> Path:
    """Where the tools keep their output: $SEO_DATA_DIR, else the git-ignored tools/seo/data folder."""
    override = os.environ.get(DATA_DIR_ENV, "").strip()
    return Path(override).expanduser() if override else DEFAULT_DATA_DIR


def _short_hash(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8"), usedforsecurity=False).hexdigest()[:HASH_LENGTH]


def slugify(text: str, max_length: int = SLUG_MAX_LENGTH) -> str:
    """Lower-case letters and digits joined by single dashes, cut to ``max_length``."""
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:max_length].strip("-")


def hashed_slug(text: str, max_length: int = SLUG_MAX_LENGTH) -> str:
    """A readable slug plus a short hash of the original text, so different queries never share a file name."""
    readable = slugify(text, max_length)
    digest = _short_hash(text)
    return f"{readable}-{digest}" if readable else digest


PATH_SAFE = "/%:@!$&'()*+,;=~"  # RFC 3986: what may stay as it is in a path; % keeps existing escapes
QUERY_SAFE = PATH_SAFE + "?"


def ascii_url(url: str) -> str:
    """The same address with only ASCII characters, as a browser would send it.

    http.client cannot write a non-ASCII request line, so /caf\u00e9 raised UnicodeEncodeError. The path and query are
    percent-encoded as UTF-8 (existing escapes stay), the host becomes punycode, and the #fragment is dropped.
    A host that has no punycode form is left as it is, for the request to refuse.
    """
    parts = safe_urlsplit(url)
    host = (parts.hostname or "") if parts is not None else ""
    if parts is None or not host:
        return url
    netloc = parts.netloc
    if not netloc.isascii():
        try:
            host = host.encode("idna").decode("ascii")
        except UnicodeError:
            pass  # no punycode form: the request will refuse it
        userinfo = netloc.rpartition("@")[0]
        port = f":{parts.port}" if parts.port else ""
        netloc = (userinfo + "@" if userinfo else "") + (f"[{host}]" if ":" in host else host) + port
    path, query = quote(parts.path, safe=PATH_SAFE), quote(parts.query, safe=QUERY_SAFE)
    return urlunsplit((parts.scheme, netloc, path, query, ""))


def without_fragment(url: str) -> str:
    """The URL without its #fragment: a fragment is never sent, so it does not make a different page."""
    return url.split("#", 1)[0]


def url_slug(url: str) -> str:
    """File-name stem for a URL: host and path joined by underscores, with a hash when a query string is present."""
    parts = safe_urlsplit(url)
    if parts is None:  # an address urlsplit refuses: a readable start and a hash of the whole text
        return hashed_slug(url, URL_SLUG_MAX_LENGTH)
    path = parts.path.strip("/").replace("/", "_") or "index"
    readable = re.sub(r"[^A-Za-z0-9._-]+", "-", f"{parts.netloc}_{path}")
    suffix = "_" + _short_hash(parts.query) if parts.query else ""
    if len(readable) > URL_SLUG_MAX_LENGTH:
        return f"{readable[:URL_SLUG_MAX_LENGTH]}-{_short_hash(url)}{suffix}"
    return readable + suffix


def assign_stems(urls: Sequence[str]) -> Dict[str, str]:
    """A file-name stem for every address; two different pages never get the same one.

    The first page with a given readable name (compared without regard to case, for disks that ignore it) keeps
    it, so ordinary addresses read as before. A later page that would collide, such as /x after /x/, http after
    https, /x_y after /x/y or /About after /about, gets a short hash of its whole address added. Addresses that
    differ only in their #fragment are one page and share a stem.
    """
    by_page: Dict[str, str] = {}
    owner: Dict[str, str] = {}  # lower-case stem -> the page it names
    stems: Dict[str, str] = {}
    for url in urls:
        page = without_fragment(url)
        if page not in by_page:
            stem = url_slug(page)
            if stem.lower() in owner:
                stem = _unused_stem(f"{stem}-{_short_hash(page)}", owner)
            owner[stem.lower()] = page
            by_page[page] = stem
        stems[url] = by_page[page]
    return stems


def _unused_stem(stem: str, owner: Dict[str, str]) -> str:
    candidate, number = stem, 1
    while candidate.lower() in owner:  # a hash clash: vanishingly rare, but never overwrite
        number += 1
        candidate = f"{stem}-{number}"
    return candidate


def remove_file(path: Path) -> None:
    """Delete a file if it is there."""
    try:
        path.unlink()
    except FileNotFoundError:
        return
    except OSError as error:
        raise SeoToolError(f"cannot remove {path}: {error.strerror or error}") from error


def read_text_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError as error:
        raise SeoToolError(f"cannot read {path}: {error.strerror or error}") from error


def read_bytes_file(path: Path) -> bytes:
    try:
        return path.read_bytes()
    except OSError as error:
        raise SeoToolError(f"cannot read {path}: {error.strerror or error}") from error


def read_json_file(path: Path) -> Any:
    """The JSON in a file. Anything json.loads refuses (bad syntax, nesting too deep, a number with thousands of digits)
    becomes a SeoToolError that names the file."""
    try:
        return json.loads(read_text_file(path))
    except (ValueError, RecursionError) as error:  # JSONDecodeError is a ValueError
        raise SeoToolError(f"{path} is not usable JSON: {_one_line(f'{type(error).__name__}: {error}')}") from error


def _write(path: Path, writer: Callable[[], Any]) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        writer()
    except OSError as error:
        raise SeoToolError(f"cannot write {path}: {error.strerror or error}") from error


def write_text_file(path: Path, text: str) -> None:
    _write(path, lambda: path.write_text(text, encoding="utf-8"))


def write_bytes_file(path: Path, data: bytes) -> None:
    _write(path, lambda: path.write_bytes(data))


def write_json_file(path: Path, data: Any) -> None:
    write_text_file(path, json.dumps(data, indent=1, ensure_ascii=False) + "\n")


def read_list_file(path: Path, what: str = "queries") -> Tuple[str, ...]:
    """The lines of a list file: blank lines and lines starting with # are skipped and repeats are dropped."""
    lines = (line.strip() for line in read_text_file(path).splitlines())
    wanted = tuple(dict.fromkeys(line for line in lines if line and not line.startswith("#")))
    if not wanted:
        raise SeoToolError(f"no {what} in {path} (blank lines and lines starting with # are skipped)")
    return wanted


def read_query_file(path: Path) -> Tuple[str, ...]:
    return read_list_file(path, "queries")


def safe_urlsplit(url: object) -> Optional[SplitResult]:
    """urlsplit for untrusted text: None for anything that is not text or that urlsplit refuses with a ValueError.

    Pages, sitemaps, redirects and saved JSON all carry addresses such as ``http://[::1/`` or ``http://a℀.test/``
    that make urlsplit raise; callers skip the item (and say so) instead of aborting the whole run.
    """
    if not isinstance(url, str):
        return None
    try:
        return urlsplit(url)
    except ValueError:
        return None


def require_http_url(url: str, hint: str = "start it with https://") -> str:
    """Return the URL trimmed, or raise SeoToolError for anything but a plain http(s) URL.

    urllib would happily open file: and ftp: URLs, so every URL goes through here first. ``hint`` ends the
    message about a wrong scheme; an empty hint leaves it out.
    """
    candidate = url.strip()
    if not candidate or any(ch.isspace() or ord(ch) < 0x20 for ch in candidate):
        raise SeoToolError(f"not a usable URL: {url!r}")
    try:
        parts = urlsplit(candidate)
        parts.port  # noqa: B018 -- raises ValueError for a bad port
    except ValueError as error:
        raise SeoToolError(f"not a valid URL: {url!r} ({error})") from error
    if parts.scheme.lower() not in ALLOWED_URL_SCHEMES:
        raise SeoToolError(f"only http and https URLs are accepted, got {url!r}" + (f" ({hint})" if hint else ""))
    if not parts.hostname:
        raise SeoToolError(f"the URL has no host name: {url!r}")
    if parts.username is not None or parts.password is not None:
        raise SeoToolError("URLs with a user name or password are not accepted")
    return candidate


def non_negative_float(text: str) -> float:
    try:
        value = float(text)
    except ValueError:
        raise argparse.ArgumentTypeError(f"{text!r} is not a number") from None
    if not math.isfinite(value) or value < 0:
        raise argparse.ArgumentTypeError(f"{text!r} must be 0 or more")
    return value


def positive_int(text: str) -> int:
    try:
        value = int(text)
    except ValueError:
        raise argparse.ArgumentTypeError(f"{text!r} is not a whole number") from None
    if value < 1:
        raise argparse.ArgumentTypeError(f"{text!r} must be 1 or more")
    return value


def _one_line(text: str, limit: int = ERROR_LINE_MAX_CHARS) -> str:
    flat = " ".join(text.split())
    return flat if len(flat) <= limit else flat[: limit - 3] + "..."


def run_cli(entry: Callable[[Sequence[str]], int], argv: Optional[Sequence[str]] = None) -> int:
    """Run a tool's main(): an error becomes one line on stderr and an exit code, never a traceback.

    A SeoToolError carries its own exit code. Any other exception is a bug or hostile input nobody planned for:
    it is reported as ``error: Type: message`` with exit code 1, unless SEO_DEBUG is set (then it propagates).
    """
    try:
        return entry(sys.argv[1:] if argv is None else argv)
    except SeoToolError as error:
        log(f"error: {error}")
        return error.exit_code
    except KeyboardInterrupt:
        log("interrupted")
        return EXIT_INTERRUPTED
    except Exception as error:  # last resort, see the docstring
        if os.environ.get(DEBUG_ENV, "").strip():
            raise
        log(f"error: {_one_line(f'{type(error).__name__}: {error}')}")
        return EXIT_FAILURE
