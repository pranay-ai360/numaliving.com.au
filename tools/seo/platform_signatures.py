"""Hints about the platform a page was built with (WordPress, Next.js, Shopify, analytics tags and so on).

The search runs over markup the page itself uses, never over the words a visitor reads and never over where its
links point: class and id names, inline styles, data-* attributes, the src or href of the tags that load a
resource (script, link, img, source, iframe, video, audio, embed, object), the content of a generator meta tag,
script and style text, and HTML comments. A link to wordpress.com, an alt text that says "Shopify" or an Open
Graph description does not count. Each pattern says whether it ignores case. Standard library only.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Mapping, Tuple

ANY_TAG_ATTRIBUTES = ("class", "id", "style")
RESOURCE_ATTRIBUTES = {
    "script": ("src",),
    "link": ("href", "rel"),
    "img": ("src", "srcset", "data-src", "data-srcset"),
    "source": ("src", "srcset"),
    "iframe": ("src",),
    "video": ("src", "poster"),
    "audio": ("src",),
    "embed": ("src",),
    "object": ("data",),
}
GENERATOR = "generator"


@dataclass(frozen=True)
class Signature:
    name: str
    pattern: "re.Pattern[str]"


def _signature(name: str, pattern: str, ignore_case: bool = False) -> Signature:
    return Signature(name, re.compile(pattern, re.IGNORECASE if ignore_case else 0))


# Case matters for ids and function names (a "G-" id is upper case), not for vendor words in class names.
PLATFORM_SIGNATURES: Tuple[Signature, ...] = (
    _signature("next.js", r"/_next/static|__NEXT_DATA__"),
    _signature("wordpress", r"/wp-content/|/wp-includes/|wp-json"),
    _signature("elementor", r"elementor", ignore_case=True),
    _signature("divi", r"et_pb_|/themes/Divi"),
    _signature("woocommerce", r"woocommerce", ignore_case=True),
    _signature("wix", r"wixstatic\.com|parastorage\.com", ignore_case=True),
    _signature("squarespace", r"squarespace", ignore_case=True),
    _signature("shopify", r"cdn\.shopify\.com|Shopify\.theme"),
    _signature("webflow", r"webflow", ignore_case=True),
    _signature("yoast", r"yoast", ignore_case=True),
    _signature("rank-math", r"rank-math|rankmath", ignore_case=True),
    _signature("gtm", r"googletagmanager\.com/(?:gtm\.js|ns\.html)|\bGTM-[A-Z0-9]{4,}\b"),
    _signature(
        "ga4",
        r"googletagmanager\.com/gtag/js"
        r"|\bgtag\(\s*['\"](?:config|js|event|set|consent)['\"]"
        r"|['\"]G-[A-Z0-9]{8,12}['\"]",
    ),
    _signature("meta-pixel", r"fbevents\.js|\bfbq\("),
    _signature("hubspot", r"hubspot|hs-scripts", ignore_case=True),
    _signature("callrail", r"callrail", ignore_case=True),
    _signature("cloudflare", r"cdn-cgi|cloudflare", ignore_case=True),
)


def detect_platforms(markup: str) -> Tuple[str, ...]:
    return tuple(signature.name for signature in PLATFORM_SIGNATURES if signature.pattern.search(markup))


def signature_markup(tag: str, values: Mapping[str, str]) -> List[str]:
    """The ``name=value`` pieces of a start tag that may reveal the platform (see the module docstring)."""
    wanted = ANY_TAG_ATTRIBUTES + RESOURCE_ATTRIBUTES.get(tag, ())
    pieces = [f"{name}={values[name]}" for name in wanted if name in values]
    pieces += [f"{name}={value}" for name, value in values.items() if name.startswith("data-") and name not in wanted]
    if tag == "meta" and values.get("name", "").strip().lower() == GENERATOR and "content" in values:
        pieces.append(f"{GENERATOR}={values['content']}")
    return pieces
