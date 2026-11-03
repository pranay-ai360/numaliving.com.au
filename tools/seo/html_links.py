"""Links found in a page: which kind each one is (same site, another site, tel:, mailto: or other) and where it goes.

Also the addresses of the resources a page loads (scripts, styles, images, frames, media), which are not links.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Mapping, Optional
from urllib.parse import urljoin

from seo_common import ALLOWED_URL_SCHEMES, safe_urlsplit

BROWSER_IGNORED = re.compile(r"[\t\r\n]")  # a browser drops these from inside an address
RESOURCE_ATTRIBUTES = {  # tag -> the attributes that hold an address the browser loads
    "script": ("src",),
    "img": ("src", "srcset", "data-src", "data-srcset"),
    "source": ("src", "srcset"),
    "iframe": ("src",),
    "video": ("src", "poster"),
    "audio": ("src",),
    "track": ("src",),
    "embed": ("src",),
    "object": ("data",),
}
LOADED_LINK_RELS = frozenset(  # a <link> loads something only with one of these; canonical, alternate and next do not
    "stylesheet icon apple-touch-icon mask-icon preload modulepreload prefetch manifest".split()
)


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



def _srcset_urls(value: str) -> List[str]:
    """The addresses in a srcset value ("a.jpg 480w, b.jpg 800w"), without their width or density descriptors."""
    return [candidate.split()[0] for candidate in value.split(",") if candidate.split()]


def resource_urls(tag: str, values: Mapping[str, str]) -> List[str]:
    """The addresses, as written, that a start tag asks the browser to load; [] for any other tag."""
    if tag == "link":
        loads = bool(set(values.get("rel", "").lower().split()) & LOADED_LINK_RELS)
        return [values["href"]] if loads and values.get("href", "").strip() else []
    urls: List[str] = []
    for name in RESOURCE_ATTRIBUTES.get(tag, ()):
        value = values.get(name, "").strip()
        if value:
            urls.extend(_srcset_urls(value) if name.endswith("srcset") else [value])
    return urls


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
