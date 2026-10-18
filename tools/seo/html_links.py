"""Links found in a page: which kind each one is (same site, another site, tel:, mailto: or other) and where it goes."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urljoin

from seo_common import ALLOWED_URL_SCHEMES, safe_urlsplit

BROWSER_IGNORED = re.compile(r"[\t\r\n]")  # a browser drops these from inside an address


@dataclass(frozen=True)
class Link:
    url: str
    text: str
    kind: str  # internal, external, tel, mailto or other
    rel: str = ""
    in_boilerplate: bool = False


@dataclass(frozen=True)
class Anchor:
    href: str
    rel: str
    text: str
    in_boilerplate: bool



def host_of(url: str) -> str:
    """The site a URL belongs to: lower-case host and port, without a user name or a leading www."""
    parts = safe_urlsplit(url)
    netloc = parts.netloc.lower().rpartition("@")[2] if parts is not None else ""
    return netloc[4:] if netloc.startswith("www.") else netloc


def classify_link(anchor: Anchor, base_url: str) -> Optional[Link]:
    """A Link for the anchor, or None for empty, fragment-only and javascript: links."""
    target = BROWSER_IGNORED.sub("", anchor.href).strip()  # "Java\tScript:" is javascript: to a browser
    lowered = target.lower()
    if not target or target.startswith("#") or lowered.startswith("javascript:"):
        return None

    def link(url: str, kind: str) -> Link:
        return Link(url, anchor.text, kind, anchor.rel, anchor.in_boilerplate)

    if lowered.startswith(("tel:", "mailto:")):
        return link(target, lowered.split(":", 1)[0])
    try:
        absolute = urljoin(base_url, target)
        parts = safe_urlsplit(absolute)
        if parts is None:  # a malformed URL such as an unclosed IPv6 bracket
            return link(target, "other")
        if parts.scheme.lower() not in ALLOWED_URL_SCHEMES:
            return link(absolute, "other")
        return link(absolute, "internal" if host_of(absolute) == host_of(base_url) else "external")
    except ValueError:  # urljoin itself can refuse an address
        return link(target, "other")
