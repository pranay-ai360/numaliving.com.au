"""Page discovery for the launch check: fetch the seed addresses, then follow internal links breadth first.

Every internal link is fetched once, whatever it points at (a page, a PDF, an image), so that "does this link
resolve?" has an answer. Only an HTML page that answered 200 is read for more links. The crawl never leaves the
site: a link is internal when it goes to the same host as the page that carries it. It stops at a page limit and
says which addresses it left unvisited, so a site larger than the limit can never pass by accident.
Standard library only.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field, replace
from typing import Callable, Deque, Dict, List, Mapping, Optional, Sequence, Set, Tuple
from urllib.parse import urlunsplit

from fetch_pages import FetchResult
from html_facts import PageFacts, extract_facts
from launch_model import Site
from seo_common import SeoToolError, safe_urlsplit, without_fragment

FetchFunction = Callable[[str], FetchResult]
HTML_TYPES = ("html", "xhtml")
HTML_SNIFF_BYTES = 512
HTML_STARTS = (b"<!doctype html", b"<html")


def url_key(url: str) -> str:
    """The address as the crawl compares it: no #fragment, lower-case scheme and host, "/" for an empty path."""
    page = without_fragment(url)
    parts = safe_urlsplit(page)
    if parts is None:
        return page
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path or "/", parts.query, ""))


def is_html(result: FetchResult) -> bool:
    """Whether the answer is an HTML page: by its Content-Type, or by the start of the body when it has none."""
    kind = dict(result.headers).get("content-type", "").lower()
    if kind:
        return any(name in kind for name in HTML_TYPES)
    return result.body.lstrip()[:HTML_SNIFF_BYTES].lower().startswith(HTML_STARTS)


@dataclass(frozen=True)
class Fetched:
    """One address the crawl fetched: what was asked for, the answer, and (for a readable page) its facts."""

    requested: str
    result: FetchResult
    facts: Optional[PageFacts] = None  # set only for an HTML page that answered 200
    source: str = ""  # the page that linked here first; "" for a seed
    is_seed: bool = False

    @property
    def final_url(self) -> str:
        return self.result.final_url


@dataclass(frozen=True)
class Crawl:
    """Everything the crawl fetched, in order, and the addresses it found but did not fetch (the page limit)."""

    fetched: Tuple[Fetched, ...]
    unvisited: Tuple[str, ...]
    index: Mapping[str, Fetched] = field(default_factory=dict, repr=False, compare=False)  # by requested and final key

    def lookup(self, url: str) -> Optional[Fetched]:
        """What was fetched for this address: found by the address asked for or the one the answer came from."""
        return self.index.get(url_key(url))


def fetch_problem(site: Site, result: FetchResult, noun: str = "page") -> str:
    """Why an answer is not a good page of the site: kept out by robots.txt, failed, not 200, cut off or elsewhere."""
    if result.skipped:
        return result.skipped
    if result.error:
        return result.error
    if result.status != 200:
        return f"HTTP {result.status}"
    if result.truncated:
        return f"the {noun} is larger than the download limit"
    if not site.is_own(result.final_url):
        return f"ends on another site: {result.final_url}"
    return ""


def read_facts(result: FetchResult) -> PageFacts:
    """The facts of an answer's body, read as UTF-8 (bytes that are not are replaced, never fatal)."""
    return extract_facts(result.body.decode("utf-8", errors="replace"), result.final_url)


def _facts_of(site: Site, result: FetchResult) -> Optional[PageFacts]:
    """The facts of an HTML page that answered 200 on the site itself; a link that ends elsewhere is never read."""
    return None if fetch_problem(site, result) or not is_html(result) else read_facts(result)


def fetch_item(site: Site, fetch: FetchFunction, url: str, source: str = "", is_seed: bool = False) -> Fetched:
    """Fetch one address. An address the fetcher refuses (a space in a link, say) is a finding, not a crash."""
    try:
        result = fetch(url)
    except SeoToolError as error:
        result = FetchResult(requested=url, final_url=url, error=str(error))
    return Fetched(url, result, _facts_of(site, result), source, is_seed)


def crawl_site(site: Site, fetch: FetchFunction, seeds: Sequence[str], max_pages: int) -> Crawl:
    """Fetch the seeds in order, then every internal link they and the pages after them carry, up to ``max_pages``."""
    queue: Deque[Tuple[str, str]] = deque()  # (key, address) in the order found
    sources: Dict[str, str] = {}  # key -> the page that linked to it first
    seed_keys: Set[str] = set()

    def enqueue(url: str, source: str) -> None:
        key = url_key(url)
        if key not in sources:
            sources[key] = source
            queue.append((key, without_fragment(url)))

    for seed in seeds:
        enqueue(seed, "")
        seed_keys.add(url_key(seed))
    fetched: List[Fetched] = []
    index: Dict[str, Fetched] = {}
    while queue and len(fetched) < max_pages:
        key, url = queue.popleft()
        if key in index:  # an earlier fetch already ended at this address
            continue
        item = fetch_item(site, fetch, url, sources[key], key in seed_keys)
        item = replace(item, result=replace(item.result, body=b""))  # the facts are kept; a page is not held in memory
        fetched.append(item)
        index[key] = item
        index.setdefault(url_key(item.final_url), item)
        for link in item.facts.links_of("internal") if item.facts is not None else ():
            enqueue(link.url, item.final_url)
    return Crawl(tuple(fetched), tuple(url for key, url in queue if key not in index), index)
