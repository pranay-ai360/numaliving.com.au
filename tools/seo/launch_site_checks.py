"""The site-level checks of the launch check that are not about one page or about robots.txt and the sitemap:
/index.html, the 404 page, the login page, the share images, the http and www redirects, and whether the crawl got
through the whole site.

Only the site's own origin is ever requested (the base URL and the canonical host). A share image on another host is
reported, not fetched. Standard library only.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Sequence, Tuple

from fetch_result import FetchResult
from launch_crawl import Crawl, FetchFunction, Fetched, fetch_item, fetch_problem, is_html, read_facts, url_key
from launch_model import (
    INDEX_FILE_PATH, LOGIN_PATH, MISSING_PAGE_PATH, SITE_SCOPE, CheckResult, Failure, Site, counted, failing, judge,
    listed, origin_of, passing, skipped,
)
from launch_page_checks import PageView, canonical_problem, has_noindex, normal, robots_tokens

IMAGE_TYPE_PREFIX = "image/"
PERMANENT_REDIRECTS = (301, 308)
MAX_UNVISITED_LISTED = 50
REDIRECT_IDS = ("redirect-https", "redirect-www")
TITLES = {
    "index-html-canonical": "/index.html names the home page as its canonical",
    "missing-page-404": "a missing page answers 404, noindex, with a title of its own",
    "login-noindex": "the login page is noindex in both modes",
    "share-images": "og:image and twitter:image answer 200 with an image content type",
    "redirect-https": "http:// redirects to https:// in one permanent hop",
    "redirect-www": "www redirects to the apex in one permanent hop",
    "crawl-complete": "the crawl got through every internal address it found",
}


def _lookup_or_fetch(site: Site, fetch: FetchFunction, crawl: Crawl, url: str) -> Fetched:
    return crawl.lookup(url) or fetch_item(site, fetch, url)


def _kept_out_or_failed(result: FetchResult) -> str:
    return result.skipped or result.error


def _result(check_id: str, url: str, problem: str, passed: str) -> CheckResult:
    if problem:
        return failing(check_id, SITE_SCOPE, TITLES[check_id], [Failure(url, problem)], "1 problem")
    return passing(check_id, SITE_SCOPE, TITLES[check_id], passed)


def _index_html_problem(site: Site, item: Fetched) -> str:
    problem = fetch_problem(site, item.result)
    if problem or item.facts is None:
        return problem or "answers 200 but is not an HTML page"
    home = site.canonical_of(site.base_url)
    view = PageView(item.final_url, site.path_of(item.final_url), item.facts, item.result.headers, home, False)
    return canonical_problem(view)


def _index_html_check(site: Site, fetch: FetchFunction, crawl: Crawl) -> CheckResult:
    url = site.url_for(INDEX_FILE_PATH)
    item = _lookup_or_fetch(site, fetch, crawl, url)
    if not _kept_out_or_failed(item.result) and item.result.status == 404:
        return passing("index-html-canonical", SITE_SCOPE, TITLES["index-html-canonical"],
                       "answers 404, so there is no second copy of the home page")
    problem = _index_html_problem(site, item)
    return _result("index-html-canonical", url, problem, "the canonical link names the home page")


def _missing_page_problem(result: FetchResult, views: Sequence[PageView]) -> str:
    if _kept_out_or_failed(result):
        return _kept_out_or_failed(result)
    if result.status != 404:
        return f"answers HTTP {result.status}, expected 404 (a missing page must not look like a real one)"
    if not is_html(result):
        return "the 404 answer is not an HTML page"
    facts = read_facts(result)
    if not has_noindex(robots_tokens(facts, result.headers)):
        return "the 404 page is indexable; it needs a noindex robots tag"
    if not facts.title:
        return "the 404 page has no title"
    twin = next((view.url for view in views if normal(view.facts.title) == normal(facts.title)), "")
    return f"the 404 page has the same title as {twin}; it needs its own" if twin else ""


def _missing_page_check(site: Site, fetch: FetchFunction, views: Sequence[PageView]) -> CheckResult:
    url = site.url_for(MISSING_PAGE_PATH)
    problem = _missing_page_problem(fetch_item(site, fetch, url).result, views)
    return _result("missing-page-404", url, problem, "answers 404, noindex, with its own title")


def _login_problem(site: Site, item: Fetched) -> str:
    problem = fetch_problem(site, item.result)
    if problem or item.facts is None:
        return problem or "answers 200 but is not an HTML page"
    tokens = robots_tokens(item.facts, item.result.headers)
    if has_noindex(tokens):
        return ""
    shown = "; ".join(item.facts.robots_meta) or "no robots tag"
    return f"the login page is indexable (robots: {shown})"


def _login_check(site: Site, fetch: FetchFunction, crawl: Crawl) -> CheckResult:
    url = site.url_for(LOGIN_PATH)
    item = _lookup_or_fetch(site, fetch, crawl, url)
    if not _kept_out_or_failed(item.result) and item.result.status == 404:
        reason = f"{LOGIN_PATH} answers 404: there is no page to keep out of the index"
        return skipped("login-noindex", SITE_SCOPE, TITLES["login-noindex"], reason)
    return _result("login-noindex", url, _login_problem(site, item), "noindex")


# -- share images --------------------------------------------------------------------------------------------------


def _share_images(views: Sequence[PageView]) -> Dict[str, List[str]]:
    """Every og:image and twitter:image address, in the order met, with the pages that name it."""
    found: Dict[str, List[str]] = {}
    for view in views:
        for value in (dict(view.facts.og).get("og:image", ""), dict(view.facts.twitter).get("twitter:image", "")):
            address = value.strip()
            users = found.setdefault(address, []) if address else []
            if address and view.url not in users:
                users.append(view.url)
    return found


def _image_problem(site: Site, fetch: FetchFunction, address: str) -> str:
    if not origin_of(address):
        return "not an absolute URL"
    if not site.is_own(address):
        return f"on another host; the launch check requests only {site.canonical_origin}"
    result = fetch_item(site, fetch, site.fetch_url(address)).result
    problem = fetch_problem(site, result, "image")
    if problem:
        return problem
    kind = dict(result.headers).get("content-type", "").split(";")[0].strip().lower()
    if not kind.startswith(IMAGE_TYPE_PREFIX):
        return f"content type is {kind or 'missing'}, expected {IMAGE_TYPE_PREFIX}*"
    return "" if result.body else "the image is empty"


def _share_image_check(site: Site, fetch: FetchFunction, views: Sequence[PageView]) -> CheckResult:
    found = _share_images(views)

    def problem(address: str) -> str:
        found_problem = _image_problem(site, fetch, address)
        return f"{found_problem} (used by {listed(found[address], ', ')})" if found_problem else ""

    return judge("share-images", SITE_SCOPE, TITLES["share-images"], list(found), problem, lambda address: address,
                 "image URL")


# -- redirects -----------------------------------------------------------------------------------------------------


def _redirect_problem(result: FetchResult, home: str) -> str:
    if _kept_out_or_failed(result):
        return _kept_out_or_failed(result)
    if not result.redirects:
        return f"answers HTTP {result.status} without redirecting; expected a permanent redirect to {home}"
    if len(result.redirects) > 1:
        chain = " > ".join([hop.source for hop in result.redirects] + [result.final_url])
        return f"{len(result.redirects)} redirects in a row ({chain}); one is allowed"
    status = result.redirects[0].status
    if status not in PERMANENT_REDIRECTS:
        return f"redirects with HTTP {status}, which is temporary; use 301 or 308"
    if url_key(result.final_url) != url_key(home):
        return f"redirects to {result.final_url}, expected {home}"
    return "" if result.status == 200 else f"the page it redirects to answers HTTP {result.status}"


def redirect_checks(site: Site, fetch: FetchFunction) -> Tuple[CheckResult, ...]:
    """http:// and www to the canonical home page. They exist only on the real https host, so a copy is skipped."""
    if not site.is_canonical_https:
        reason = f"the base URL is not the https canonical host ({site.canonical_origin}); only the real host has these"
        return tuple(skipped(check_id, SITE_SCOPE, TITLES[check_id], reason) for check_id in REDIRECT_IDS)
    home = site.canonical_origin + "/"
    http_url = "http://" + home.partition("://")[2]
    first = _redirect_problem(fetch_item(site, fetch, http_url).result, home)
    results = [_result("redirect-https", http_url, first, "one permanent hop")]
    if not site.www_origin:
        reason = "the canonical host has no www form"
        results.append(skipped("redirect-www", SITE_SCOPE, TITLES["redirect-www"], reason))
        return tuple(results)
    www_url = site.www_origin + "/"
    second = _redirect_problem(fetch_item(site, fetch, www_url).result, home)
    results.append(_result("redirect-www", www_url, second, "one permanent hop"))
    return tuple(results)


def _crawl_check(crawl: Crawl) -> CheckResult:
    check_id = "crawl-complete"
    if not crawl.unvisited:
        return passing(check_id, SITE_SCOPE, TITLES[check_id], f"{len(crawl.fetched)} fetched, none left over")
    fetched = counted(len(crawl.fetched), "address", "addresses")
    note = f"not fetched: the crawl stopped after {fetched}; raise --max-pages"
    failures = [Failure(url, note) for url in crawl.unvisited[:MAX_UNVISITED_LISTED]]
    return failing(check_id, SITE_SCOPE, TITLES[check_id], failures, f"{len(crawl.unvisited)} found but not fetched")


def site_checks(
    site: Site, fetch: FetchFunction, crawl: Crawl, views: Sequence[PageView]
) -> Tuple[CheckResult, ...]:
    """The checks that need the rest of the site, in the order the report shows them."""
    return (
        _index_html_check(site, fetch, crawl),
        _missing_page_check(site, fetch, views),
        _login_check(site, fetch, crawl),
        _share_image_check(site, fetch, views),
        *redirect_checks(site, fetch),
        _crawl_check(crawl),
    )
