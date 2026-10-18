"""Test doubles for the launch check: a small in-memory web that answers like a static host, and loaders for the
hand-written site in tests/fixtures/launch/. Nothing here uses the network.

FakeWeb stands in for PoliteFetcher.fetch: it takes a URL and returns a FetchResult, following redirects the way the
real fetcher records them (every hop in ``redirects``, the last address in ``final_url``).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple, Union

from helpers import fixture_text

from fetch_pages import FetchResult, RedirectHop  # noqa: E402

ORIGIN = "https://numaliving.us"
HTML_TYPE = "text/html; charset=utf-8"
MAX_FAKE_HOPS = 10
MISSING_PAGE_PATH = "/launch-check-missing-page-7f3a9c/"
PAGE_PATHS = ("/", "/about/", "/projects/", "/contact/", "/login/")
SITEMAP_PATHS = ("/", "/about/", "/projects/", "/contact/")  # login stays out of the sitemap
Headers = Tuple[Tuple[str, str], ...]
Body = Union[str, bytes]


@dataclass(frozen=True)
class Entry:
    """What the fake web answers for one URL."""

    status: int = 200
    body: bytes = b""
    headers: Headers = ()
    target: str = ""  # set: this URL redirects there
    error: str = ""
    skipped: str = ""
    raises: Optional[BaseException] = None


NOT_FOUND = Entry(404, b"not found", (("content-type", "text/plain"),))


class FakeWeb:
    """Add pages by URL, then call the object like a fetch function. Unknown URLs answer 404 without a title."""

    def __init__(self) -> None:
        self._entries: Dict[str, Entry] = {}
        self.requests: List[str] = []

    def add(
        self,
        url: str,
        body: Body = "",
        status: int = 200,
        content_type: str = HTML_TYPE,
        headers: Sequence[Tuple[str, str]] = (),
        error: str = "",
        skipped: str = "",
    ) -> "FakeWeb":
        raw = body.encode("utf-8") if isinstance(body, str) else body
        kept: Headers = (("content-type", content_type),) if content_type else ()
        self._entries[url] = Entry(status, raw, kept + tuple(headers), error=error, skipped=skipped)
        return self

    def redirect(self, url: str, target: str, status: int = 301) -> "FakeWeb":
        self._entries[url] = Entry(status, target=target)
        return self

    def fail_with(self, url: str, error: BaseException) -> "FakeWeb":
        self._entries[url] = Entry(raises=error)
        return self

    def remove(self, url: str) -> "FakeWeb":
        self._entries.pop(url, None)
        return self

    def has(self, url: str) -> bool:
        return url in self._entries

    def body_of(self, url: str) -> str:
        return self._entries[url].body.decode("utf-8")

    def count(self, url: str) -> int:
        return self.requests.count(url)

    def __call__(self, url: str) -> FetchResult:
        self.requests.append(url)
        current: str = url
        hops: List[RedirectHop] = []
        for _ in range(MAX_FAKE_HOPS):
            entry = self._entries.get(current, NOT_FOUND)
            if entry.raises is not None:
                raise entry.raises
            if not entry.target:
                return FetchResult(
                    requested=url,
                    final_url=current,
                    status=None if (entry.error or entry.skipped) else entry.status,
                    error=entry.error,
                    skipped=entry.skipped,
                    headers=entry.headers,
                    redirects=tuple(hops),
                    body=entry.body,
                )
            hops.append(RedirectHop(entry.status, current, entry.target))
            current = entry.target
        return FetchResult(requested=url, final_url=current, status=hops[-1].status, error="too many redirects",
                           redirects=tuple(hops))


def launch_text(name: str) -> str:
    return fixture_text("launch", name)


def swap(text: str, old: str, new: str) -> str:
    """text with ``old`` replaced by ``new``; fails loudly when ``old`` is not there, so a test cannot go vacuous."""
    assert old in text, f"the fixture no longer contains {old!r}"
    return text.replace(old, new, 1)


def edit_page(web: FakeWeb, url: str, old: str, new: str) -> FakeWeb:
    """Change the HTML served at ``url``: ``old`` must be in it."""
    return web.add(url, swap(web.body_of(url), old, new))


def page_file(path: str) -> str:
    """The fixture file that holds the page at this site path."""
    return "home.html" if path == "/" else path.strip("/") + ".html"


def build_web(base: str = ORIGIN, mode: str = "live") -> FakeWeb:
    """The whole good site at ``base``: every page, robots.txt, sitemap.xml, share images and the 404 page.

    The fixtures are written for live mode and name their canonical addresses on ORIGIN, whatever ``base`` is.
    A preview site is the same pages with every robots tag set to noindex, no Sitemap line and an empty sitemap.
    """
    web = FakeWeb()
    for path in PAGE_PATHS:
        html = launch_text(page_file(path))
        web.add(base + path, html if mode == "live" else html.replace("index, follow", "noindex, nofollow"))
    web.add(base + "/index.html", web.body_of(base + "/"))
    web.add(base + "/robots.txt", launch_text(f"robots-{mode}.txt"), content_type="text/plain; charset=utf-8")
    web.add(base + "/sitemap.xml", launch_text(f"sitemap-{mode}.xml"), content_type="application/xml; charset=utf-8")
    web.add(base + MISSING_PAGE_PATH, launch_text("not-found.html"), status=404)
    for name in ("home", "default"):
        web.add(f"{base}/og/{name}.jpg", b"\xff\xd8\xff\xe0 jpeg bytes", content_type="image/jpeg")
    return web
