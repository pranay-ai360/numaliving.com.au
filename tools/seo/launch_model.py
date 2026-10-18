"""The vocabulary of the launch check: the site being checked, how its addresses map, and what a check reports.

The *base URL* is where the pages are fetched from: production, or a local build. The *canonical host* is where the
site says it lives: canonical links, Open Graph addresses and the sitemap must name it. For a live site the two are
the same; for a local build made for production they differ, and an address on the canonical host is fetched from
the base URL instead. Standard library only.
"""

from __future__ import annotations

import ipaddress
from dataclasses import dataclass
from typing import Callable, Sequence, Tuple, TypeVar
from urllib.parse import SplitResult, urlsplit

from robots_policy import ROBOTS_PATH  # noqa: F401  (re-exported: the path the launch check reads)
from seo_common import SeoToolError, require_http_url, safe_urlsplit

PASS, FAIL, SKIP = "PASS", "FAIL", "SKIP"
PAGE_SCOPE, SITE_SCOPE = "page", "site"
MODE_PREVIEW, MODE_LIVE = "preview", "live"
MODES = (MODE_PREVIEW, MODE_LIVE)
DEFAULT_CANONICAL_HOST = "https://numaliving.us"
DEFAULT_MAX_PAGES = 60
LOGIN_PATH = "/login/"
INDEX_FILE_PATH = "/index.html"
SITEMAP_PATH = "/sitemap.xml"
MISSING_PAGE_PATH = "/launch-check-missing-page-7f3a9c/"  # nothing can live here: a hash keeps it off real paths
WWW_PREFIX = "www."

T = TypeVar("T")


@dataclass(frozen=True)
class Failure:
    """One address that failed a check, and why."""

    url: str
    message: str


@dataclass(frozen=True)
class CheckResult:
    """The outcome of one check over the whole site: PASS, FAIL (with the failing addresses) or SKIP."""

    id: str
    scope: str
    title: str
    status: str
    summary: str = ""
    failures: Tuple[Failure, ...] = ()


def passing(check_id: str, scope: str, title: str, summary: str = "") -> CheckResult:
    return CheckResult(check_id, scope, title, PASS, summary)


def failing(check_id: str, scope: str, title: str, failures: Sequence[Failure], summary: str = "") -> CheckResult:
    return CheckResult(check_id, scope, title, FAIL, summary, tuple(failures))


def skipped(check_id: str, scope: str, title: str, reason: str) -> CheckResult:
    return CheckResult(check_id, scope, title, SKIP, reason)


def judge(
    check_id: str,
    scope: str,
    title: str,
    subjects: Sequence[T],
    test: Callable[[T], str],
    url_of: Callable[[T], str],
    noun: str = "page",
) -> CheckResult:
    """Run ``test`` on every subject: it returns "" when the subject is fine, else what is wrong with it.

    ``noun`` is singular ("page"); the summary pluralises it. With nothing to judge the check is skipped, never
    passed: a pass would claim something was verified.
    """
    if not subjects:
        return skipped(check_id, scope, title, f"no {noun}s to check")
    problems = [(subject, test(subject)) for subject in subjects]
    failures = tuple(Failure(url_of(subject), problem) for subject, problem in problems if problem)
    if failures:
        return failing(check_id, scope, title, failures, f"{len(failures)} of {counted(len(subjects), noun)}")
    return passing(check_id, scope, title, counted(len(subjects), noun))


def counted(number: int, noun: str) -> str:
    """"1 page", "2 pages": the noun is singular and gets an s unless there is exactly one."""
    return f"{number} {noun}" if number == 1 else f"{number} {noun}s"


def origin_of(url: str) -> str:
    """scheme://host[:port] in lower case; "" for text that is not an absolute address."""
    parts = safe_urlsplit(url)
    if parts is None or not parts.netloc:
        return ""
    return f"{parts.scheme.lower()}://{parts.netloc.lower()}"


def _split(url: str, option: str) -> SplitResult:
    try:
        return urlsplit(require_http_url(url))
    except SeoToolError as error:
        raise SeoToolError(f"{option}: {error}") from error


def _is_ip_address(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
    except ValueError:
        return False
    return True


@dataclass(frozen=True)
class Site:
    """The site under test: where to fetch from, what it calls itself, and which mode it is checked in."""

    base_url: str  # always ends in "/"
    canonical_origin: str  # scheme://host, no trailing "/"
    mode: str

    @classmethod
    def create(cls, base_url: str, canonical_host: str, mode: str) -> "Site":
        if mode not in MODES:
            raise SeoToolError(f"--mode must be one of {', '.join(MODES)}, not {mode!r}")
        base, canonical = _split(base_url, "--base-url"), _split(canonical_host, "--canonical-host")
        if canonical.path not in ("", "/") or canonical.query or canonical.fragment:
            raise SeoToolError(
                f"--canonical-host must be an origin such as {DEFAULT_CANONICAL_HOST}, "
                f"without a path, query or fragment: {canonical_host!r}"
            )
        if base.query or base.fragment:
            raise SeoToolError(f"--base-url must not have a query or fragment: {base_url!r}")
        path = base.path if base.path.endswith("/") else base.path + "/"
        return cls(
            f"{base.scheme.lower()}://{base.netloc.lower()}{path}",
            f"{canonical.scheme.lower()}://{canonical.netloc.lower()}",
            mode,
        )

    @property
    def base_origin(self) -> str:
        return origin_of(self.base_url)

    @property
    def base_path(self) -> str:
        return urlsplit(self.base_url).path

    @property
    def is_canonical_https(self) -> bool:
        """True when the pages are fetched from the https canonical host itself (the real site, not a local copy)."""
        return self.base_origin == self.canonical_origin and self.canonical_origin.startswith("https://")

    @property
    def www_origin(self) -> str:
        """The www form of the canonical host, or "" when it has none (it starts with www., is an IP or has no dot)."""
        parts = urlsplit(self.canonical_origin)
        host = parts.hostname or ""
        if host.startswith(WWW_PREFIX) or "." not in host or _is_ip_address(host):
            return ""
        return f"{parts.scheme}://{WWW_PREFIX}{parts.netloc}"

    def url_for(self, path: str) -> str:
        """The address of a site path ("/robots.txt") on the base URL."""
        return self.base_url.rstrip("/") + path

    def path_of(self, url: str) -> str:
        """The site path of an address: no host, query or fragment, and without the base path."""
        parts = safe_urlsplit(url)
        path = (parts.path if parts is not None else "") or "/"
        if self.base_path != "/" and path.startswith(self.base_path):
            return "/" + path[len(self.base_path):]
        return path

    def canonical_of(self, url: str) -> str:
        """The address the page at ``url`` must name as its canonical."""
        return self.canonical_origin + self.path_of(url)

    def fetch_url(self, url: str) -> str:
        """Where to fetch ``url`` from: an address on the canonical host is read from the base URL, others as is."""
        parts = safe_urlsplit(url)
        if parts is None or self.base_origin == self.canonical_origin or origin_of(url) != self.canonical_origin:
            return url
        query = f"?{parts.query}" if parts.query else ""
        return self.base_url.rstrip("/") + (parts.path or "/") + query

    def is_own(self, url: str) -> bool:
        return origin_of(url) in (self.base_origin, self.canonical_origin)

    def expects_noindex(self, path: str) -> bool:
        """A preview is noindex everywhere; a live site only on the login page (and the 404 page, which has no path)."""
        return self.mode == MODE_PREVIEW or path == LOGIN_PATH
