"""The per-page checks of the launch check: status, title, description, canonical, robots tags, language, headings,
social tags, images, internal links and insecure resources.

Each rule looks at one page and returns "" when it is fine, else one line about what is wrong; ``judge`` turns the
rules into PASS/FAIL results with the failing addresses. A page is only judged when it answered 200 with HTML on the
site itself: a page that did not is reported once, by ``status-200`` or ``links-resolve``, not by every rule.
Standard library only.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, FrozenSet, List, Sequence, Set, Tuple

from html_facts import PageFacts
from http_reply import Headers
from launch_crawl import Crawl, Fetched, fetch_problem, is_html, url_key
from launch_model import MODE_LIVE, PAGE_SCOPE, CheckResult, Site, judge, listed
from seo_common import safe_urlsplit, without_fragment

TITLE_MAX_CHARS = 60
DESCRIPTION_MIN_CHARS = 120
DESCRIPTION_MAX_CHARS = 160
EXPECTED_LANG = "en-US"
OPEN_GRAPH_KEYS = ("og:title", "og:description", "og:url", "og:image", "og:type", "og:locale")
TWITTER_CARD_KEY = "twitter:card"
NOINDEX_TOKENS = frozenset({"noindex", "none"})
NOFOLLOW_TOKENS = frozenset({"nofollow", "none"})
VALUED_DIRECTIVES = frozenset({"max-snippet", "max-image-preview", "max-video-preview", "unavailable_after"})
X_ROBOTS_TAG = "x-robots-tag"
Rule = Callable[["PageView"], str]


@dataclass(frozen=True)
class PageView:
    """One page the checks can read: its final address, its facts and what the site says it should look like."""

    url: str
    path: str
    facts: PageFacts
    headers: Headers
    expected_canonical: str
    noindex_expected: bool


def build_views(site: Site, crawl: Crawl) -> Tuple[PageView, ...]:
    """The pages that answered 200 with HTML on the site, once each however many addresses led to them."""
    views: Dict[str, PageView] = {}
    for item in crawl.fetched:
        key = url_key(item.final_url)
        if item.facts is None or key in views:
            continue
        path = site.path_of(item.final_url)
        views[key] = PageView(
            item.final_url, path, item.facts, item.result.headers, site.canonical_of(item.final_url),
            site.expects_noindex(path),
        )
    return tuple(views.values())


def _directive(token: str) -> str:
    """"googlebot: noindex" -> "noindex"; "max-image-preview:large" keeps its value."""
    text = token.strip().lower()
    name, separator, rest = text.partition(":")
    return rest.strip() if separator and name.strip() not in VALUED_DIRECTIVES else text


def _robots_contents(facts: PageFacts, headers: Headers) -> Tuple[str, ...]:
    return facts.robots_meta + tuple(value for name, value in headers if name == X_ROBOTS_TAG)


def robots_tokens(facts: PageFacts, headers: Headers) -> FrozenSet[str]:
    """Every robots directive that applies to the page: from its robots, googlebot and bingbot tags and the header."""
    tokens = (_directive(token) for content in _robots_contents(facts, headers) for token in content.split(","))
    return frozenset(token for token in tokens if token)


def has_noindex(tokens: FrozenSet[str]) -> bool:
    return bool(tokens & NOINDEX_TOKENS)


def has_nofollow(tokens: FrozenSet[str]) -> bool:
    return bool(tokens & NOFOLLOW_TOKENS)


def _normal(text: str) -> str:
    return " ".join(text.split()).casefold()


def _shared(views: Sequence[PageView], value_of: Callable[[PageView], str], label: str) -> Dict[str, str]:
    """For every page whose title or description another page has too: which other page it is."""
    groups: Dict[str, List[str]] = {}
    for view in views:
        text = _normal(value_of(view))
        if text:
            groups.setdefault(text, []).append(view.url)
    return {
        url: f"same {label} as {next(other for other in urls if other != url)}"
        for urls in groups.values() if len(urls) > 1 for url in urls
    }


# -- rules: one page in, "" or one line out ----------------------------------------------------------------------


def _title_problem(view: PageView) -> str:
    count = view.facts.title_count
    if count == 0:
        return "no <title> element"
    if count > 1:
        return f"{count} <title> elements"
    return "" if view.facts.title else "the <title> is empty"


def _title_length_problem(view: PageView) -> str:
    length = len(view.facts.title)
    return f"{length} characters: {view.facts.title}" if length > TITLE_MAX_CHARS else ""


def _description_missing(view: PageView) -> str:
    return "" if view.facts.description else "no meta description"


def _description_length_problem(view: PageView) -> str:
    length = len(view.facts.description)
    if not length or DESCRIPTION_MIN_CHARS <= length <= DESCRIPTION_MAX_CHARS:
        return ""
    return f"{length} characters (allowed {DESCRIPTION_MIN_CHARS} to {DESCRIPTION_MAX_CHARS})"


def _canonical_problem(view: PageView) -> str:
    found = view.facts.canonicals
    if not any(link.strip() for link in found):
        return "no canonical link"
    if len(found) > 1:
        return f"{len(found)} canonical links"
    value = found[0].strip()
    parts = safe_urlsplit(value)
    if parts is None or parts.scheme not in ("http", "https") or not parts.netloc:
        return f"canonical is not an absolute URL: {value}"
    return "" if value == view.expected_canonical else f"canonical is {value}, expected {view.expected_canonical}"


def _robots_problem(view: PageView) -> str:
    tokens = robots_tokens(view.facts, view.headers)
    shown = "; ".join(_robots_contents(view.facts, view.headers)) or "no robots tag"
    if view.noindex_expected:
        return "" if has_noindex(tokens) else f"expected noindex, but the page is indexable (robots: {shown})"
    if has_noindex(tokens):
        return f"expected an indexable page, but robots says {shown}"
    return f"links are not followed (robots: {shown})" if has_nofollow(tokens) else ""


def _lang_problem(view: PageView) -> str:
    lang = view.facts.lang
    if lang == EXPECTED_LANG:
        return ""
    if not lang:
        return f'no lang attribute on <html>, expected "{EXPECTED_LANG}"'
    return f'lang is "{lang}", expected "{EXPECTED_LANG}"'


def _h1_problem(view: PageView) -> str:
    h1s = view.facts.heading_texts(1)
    if not h1s:
        return "no H1 heading"
    if len(h1s) > 1:
        return f"{len(h1s)} H1 headings"
    return "" if h1s[0] else "the H1 is empty"


def _heading_order_problem(view: PageView) -> str:
    previous = 0
    for heading in view.facts.headings:
        if heading.level > previous + 1:
            where = f"follows H{previous}" if previous else "comes first"
            return f"H{heading.level} {where} and skips H{previous + 1}: {heading.text}"
        previous = heading.level
    return ""


def _open_graph_problem(view: PageView) -> str:
    tags = dict(view.facts.og)
    missing = [key for key in OPEN_GRAPH_KEYS if not tags.get(key, "").strip()]
    if missing:
        return "missing " + ", ".join(missing)
    url = tags["og:url"].strip()
    return "" if url == view.expected_canonical else f"og:url is {url}, expected {view.expected_canonical}"


def _twitter_card_problem(view: PageView) -> str:
    return "" if dict(view.facts.twitter).get(TWITTER_CARD_KEY, "").strip() else f"missing {TWITTER_CARD_KEY}"


def _image_problem(view: PageView) -> str:
    problems: List[str] = []
    for image in view.facts.images:
        label = image.src or "(no src)"
        if image.alt is None:
            problems.append(f"{label}: no alt attribute")
        if not image.has_size:
            problems.append(f"{label}: no width and height")
    return listed(problems, "; ")


def _insecure_resource_problem(view: PageView) -> str:
    insecure = [url.strip() for url in view.facts.resource_urls if url.strip().lower().startswith("http://")]
    return f"loads over http://: {listed(insecure, ', ')}" if insecure else ""


# -- checks that need the crawl --------------------------------------------------------------------------------------


def _seed_problem(site: Site, item: Fetched) -> str:
    problem = fetch_problem(site, item.result)
    if problem or is_html(item.result):
        return problem
    kind = dict(item.result.headers).get("content-type", "no content type")
    return f"answers 200 but is not an HTML page ({kind})"


def _status_check(site: Site, crawl: Crawl) -> CheckResult:
    seeds = [item for item in crawl.fetched if item.is_seed]
    title = "the home page and every sitemap URL answer 200 with an HTML page"
    return judge("status-200", PAGE_SCOPE, title, seeds, lambda item: _seed_problem(site, item), lambda i: i.requested)


def _broken_links(site: Site, crawl: Crawl, view: PageView) -> str:
    problems: List[str] = []
    seen: Set[str] = set()
    for link in view.facts.links_of("internal"):
        key = url_key(link.url)
        target = crawl.lookup(link.url) if key not in seen else None
        seen.add(key)
        problem = fetch_problem(site, target.result) if target is not None else ""
        if problem:
            problems.append(f"{without_fragment(link.url)}: {problem}")
    return listed(problems, "; ")


def page_checks(site: Site, views: Sequence[PageView], crawl: Crawl) -> Tuple[CheckResult, ...]:
    """All the per-page checks, in the order the report shows them."""

    def check(check_id: str, title: str, rule: Rule) -> CheckResult:
        return judge(check_id, PAGE_SCOPE, title, views, rule, lambda view: view.url)

    titles = _shared(views, lambda view: view.facts.title, "title")
    descriptions = _shared(views, lambda view: view.facts.description, "description")
    results = [
        _status_check(site, crawl),
        check("title-single", "exactly one non-empty <title>", _title_problem),
        check("title-unique", "no two pages share a title", lambda view: titles.get(view.url, "")),
        check("title-length", f"the title is at most {TITLE_MAX_CHARS} characters as shown", _title_length_problem),
        check("description-present", "every page has a meta description", _description_missing),
        check("description-unique", "no two pages share a description", lambda view: descriptions.get(view.url, "")),
    ]
    if site.mode == MODE_LIVE:
        title = f"the description is {DESCRIPTION_MIN_CHARS} to {DESCRIPTION_MAX_CHARS} characters"
        results.append(check("description-length", title, _description_length_problem))
    results += [
        check("canonical", "one absolute canonical link: the canonical host plus the page path", _canonical_problem),
        check("robots-meta", "robots tags match the mode: noindex only where it is expected", _robots_problem),
        check("html-lang", f'<html lang="{EXPECTED_LANG}">', _lang_problem),
        check("h1-single", "exactly one non-empty H1", _h1_problem),
        check("heading-order", "heading levels never skip (H1, then H2, then H3)", _heading_order_problem),
        check("open-graph", "Open Graph title, description, url, image, type and locale; og:url is the canonical",
              _open_graph_problem),
        check("twitter-card", f"{TWITTER_CARD_KEY} is present", _twitter_card_problem),
        check("images-alt-size", "every image has an alt attribute, a width and a height", _image_problem),
        check("links-resolve", "every internal link ends on a page that answers 200",
              lambda view: _broken_links(site, crawl, view)),
        check("no-http-resources", "no script, style, image or frame is loaded over http://",
              _insecure_resource_problem),
    ]
    return tuple(results)
