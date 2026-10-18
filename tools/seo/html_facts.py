"""Facts about one HTML page: head tags, headings, links, images, structured data, words and platform hints.

extract_facts(html, base_url) returns an immutable PageFacts; audit_pages.py turns it into reports. Standard
library only. The page is parsed, never executed, but it is still untrusted data.

Words and text lines: text inside nav, header, footer or aside is "boilerplate", everything else is "main".
Words are counted from the rebuilt text lines, so a headline split into one span per letter is still one word.
Platform signatures only look at markup (attributes, scripts, styles and comments), never at the words a
visitor reads, and each pattern says whether it ignores case.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlsplit

from seo_common import ALLOWED_URL_SCHEMES

VOID_TAGS = frozenset("area base br col embed hr img input link meta param source track wbr".split())
SKIP_TEXT_TAGS = frozenset("script style noscript template svg head iframe title".split())
BOILERPLATE_TAGS = frozenset("nav header footer aside".split())
BLOCK_TAGS = frozenset(
    "p div section article li ul ol h1 h2 h3 h4 h5 h6 tr td th table br dt dd dl form figure figcaption "
    "blockquote main nav header footer aside details summary".split()
)
HEADING_LEVELS = {"h1": 1, "h2": 2, "h3": 3, "h4": 4, "h5": 5, "h6": 6}
PHONE_PATTERN = re.compile(r"(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)")
JSON_LD_TYPE = "application/ld+json"


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
        r"googletagmanager\.com/gtag/js|\bgtag\(\s*['\"](?:config|js|event|set|consent)['\"]|['\"]G-[A-Z0-9]{8,12}['\"]",
    ),
    _signature("meta-pixel", r"fbevents\.js|\bfbq\("),
    _signature("hubspot", r"hubspot|hs-scripts", ignore_case=True),
    _signature("callrail", r"callrail", ignore_case=True),
    _signature("cloudflare", r"cdn-cgi|cloudflare", ignore_case=True),
)


@dataclass(frozen=True)
class Heading:
    level: int
    text: str


@dataclass(frozen=True)
class Link:
    url: str
    text: str
    kind: str  # internal, external, tel, mailto or other
    rel: str = ""
    in_boilerplate: bool = False


@dataclass(frozen=True)
class Image:
    src: str
    alt: Optional[str]  # None: no alt attribute; "": empty alt (decorative); otherwise the text
    has_size: bool  # both width and height are set
    loading: str
    has_srcset: bool
    in_boilerplate: bool


@dataclass(frozen=True)
class _Anchor:
    href: str
    rel: str
    text: str
    in_boilerplate: bool


@dataclass(frozen=True)
class FormInfo:
    action: str
    method: str


@dataclass(frozen=True)
class PageFacts:
    lang: Optional[str]
    title: str
    description: str
    robots: Optional[str]
    canonical: Optional[str]
    hreflang: Tuple[str, ...]
    has_viewport: bool
    generator: Optional[str]
    og: Tuple[Tuple[str, str], ...]
    twitter: Tuple[Tuple[str, str], ...]
    headings: Tuple[Heading, ...]
    links: Tuple[Link, ...]
    images: Tuple[Image, ...]
    image_source_types: Tuple[str, ...]
    jsonld_types: Tuple[str, ...]
    jsonld_blocks: int
    jsonld_errors: int
    forms: Tuple[FormInfo, ...]
    scripts_external: int
    scripts_inline: int
    words_main: int
    words_total: int
    phones: Tuple[str, ...]
    platforms: Tuple[str, ...]
    main_lines: Tuple[str, ...]
    boilerplate_lines: Tuple[str, ...]

    def heading_texts(self, level: int) -> Tuple[str, ...]:
        return tuple(heading.text for heading in self.headings if heading.level == level)

    def links_of(self, kind: str, include_boilerplate: bool = True) -> Tuple[Link, ...]:
        return tuple(
            link for link in self.links if link.kind == kind and (include_boilerplate or not link.in_boilerplate)
        )


def detect_platforms(markup: str) -> Tuple[str, ...]:
    return tuple(signature.name for signature in PLATFORM_SIGNATURES if signature.pattern.search(markup))


def host_of(url: str) -> str:
    """The site a URL belongs to: lower-case host and port, without a user name or a leading www."""
    netloc = urlsplit(url).netloc.lower().rpartition("@")[2]
    return netloc[4:] if netloc.startswith("www.") else netloc


def json_ld_types(blobs: Tuple[str, ...]) -> Tuple[Tuple[str, ...], int]:
    """The @type values found in the JSON-LD blocks, and how many blocks were not valid JSON."""
    found: List[str] = []
    errors = 0
    for blob in blobs:
        try:
            pending: List[Any] = [json.loads(blob)]
        except (json.JSONDecodeError, RecursionError):
            errors += 1
            continue
        while pending:  # a loop, not recursion: JSON-LD from the web can be nested very deep
            node = pending.pop()
            if isinstance(node, dict):
                kind = node.get("@type")
                if isinstance(kind, str):
                    found.append(kind)
                elif isinstance(kind, list):
                    found.extend(str(item) for item in kind)
                pending.extend(node.values())
            elif isinstance(node, list):
                pending.extend(node)
    return tuple(sorted(set(found))), errors


def _clean(text: str) -> str:
    return " ".join(text.split())


class _FactsParser(HTMLParser):
    """Collects raw facts while parsing. It is a builder, so it mutates itself; extract_facts freezes the result."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: List[str] = []
        self.lang: Optional[str] = None
        self.title_parts: List[str] = []
        self.meta: Dict[str, str] = {}
        self.link_tags: List[Dict[str, str]] = []
        self.headings: List[Heading] = []
        self.anchors: List[_Anchor] = []
        self.images: List[Image] = []
        self.forms: List[FormInfo] = []
        self.source_types: List[str] = []
        self.jsonld_blobs: List[str] = []
        self.external_scripts = 0
        self.inline_scripts = 0
        self.main_lines: List[str] = []
        self.boilerplate_lines: List[str] = []
        self.markup: List[str] = []
        self._buffer: List[str] = []
        self._buffer_is_boilerplate = False
        self._heading: Optional[Tuple[int, List[str]]] = None
        self._anchor: Optional[Dict[str, Any]] = None
        self._jsonld: Optional[List[str]] = None
        self._in_title = False
        self._title_done = False

    def _in_boilerplate(self) -> bool:
        return any(tag in BOILERPLATE_TAGS for tag in self.stack)

    def _in_skipped_text(self) -> bool:
        return any(tag in SKIP_TEXT_TAGS for tag in self.stack)

    def _flush_line(self) -> None:
        text = _clean("".join(self._buffer))
        if text:
            (self.boilerplate_lines if self._buffer_is_boilerplate else self.main_lines).append(text)
        self._buffer = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        values = {name: (value if value is not None else "") for name, value in attrs}
        self.markup.extend(f"{name}={value}" for name, value in values.items())
        if tag in BLOCK_TAGS:
            self._flush_line()
        if tag == "html" and self.lang is None:
            self.lang = values.get("lang")
        if tag not in VOID_TAGS:
            self.stack.append(tag)
        self._record_start(tag, values)

    def _record_start(self, tag: str, values: Dict[str, str]) -> None:
        if tag == "title":
            self._in_title = not self._title_done and "svg" not in self.stack[:-1]
        elif tag == "meta":
            key = values.get("name") or values.get("property") or values.get("http-equiv")
            if key and "content" in values:
                self.meta.setdefault(key.lower(), values["content"])
        elif tag == "link":
            self.link_tags.append({key: values[key] for key in ("rel", "href", "hreflang") if key in values})
        elif tag == "script":
            self._start_script(values)
        elif tag == "a" and "href" in values:
            self._anchor = {"href": values["href"], "rel": values.get("rel", ""), "parts": [],
                            "in_boilerplate": self._in_boilerplate()}
        elif tag == "img":
            self.images.append(self._image(values))
        elif tag == "source" and values.get("type"):
            self.source_types.append(values["type"])
        elif tag == "form":
            self.forms.append(FormInfo(values.get("action", ""), values.get("method", "get").lower()))
        elif tag in HEADING_LEVELS:
            self._heading = (HEADING_LEVELS[tag], [])

    def _start_script(self, values: Dict[str, str]) -> None:
        if values.get("type", "").strip().lower() == JSON_LD_TYPE:
            self._jsonld = []
        elif values.get("src"):
            self.external_scripts += 1
        else:
            self.inline_scripts += 1

    def _image(self, values: Dict[str, str]) -> Image:
        return Image(
            src=values.get("src") or values.get("data-src") or "",
            alt=values.get("alt"),
            has_size=bool(values.get("width") and values.get("height")),
            loading=values.get("loading", "").strip().lower(),
            has_srcset=bool(values.get("srcset")),
            in_boilerplate=self._in_boilerplate(),
        )

    def handle_endtag(self, tag: str) -> None:
        if tag in VOID_TAGS:
            return
        if tag in BLOCK_TAGS:
            self._flush_line()
        if tag in self.stack:
            while self.stack and self.stack.pop() != tag:
                pass
        self._record_end(tag)

    def _record_end(self, tag: str) -> None:
        if tag == "title" and self._in_title:
            self._in_title = False
            self._title_done = True
        elif tag == "script" and self._jsonld is not None:
            self.jsonld_blobs.append("".join(self._jsonld))
            self._jsonld = None
        elif tag == "a" and self._anchor is not None:
            anchor = self._anchor
            text = _clean("".join(anchor["parts"]))
            self.anchors.append(_Anchor(anchor["href"], anchor["rel"], text, anchor["in_boilerplate"]))
            self._anchor = None
        elif tag in HEADING_LEVELS and self._heading is not None and self._heading[0] == HEADING_LEVELS[tag]:
            self.headings.append(Heading(self._heading[0], _clean("".join(self._heading[1]))))
            self._heading = None

    def handle_data(self, data: str) -> None:
        if self._jsonld is not None:
            self._jsonld.append(data)
        elif self._in_title:
            self.title_parts.append(data)
        elif self.stack and self.stack[-1] in ("script", "style"):
            self.markup.append(data)
        elif not self._in_skipped_text():
            self._add_text(data)

    def _add_text(self, data: str) -> None:
        """Whitespace between inline elements is kept inside a line and dropped at the start of one."""
        for parts in (self._buffer, self._heading[1] if self._heading else None, self._anchor["parts"] if self._anchor else None):
            if parts is not None and (parts or data.strip()):
                parts.append(data)
        if len(self._buffer) == 1:
            self._buffer_is_boilerplate = self._in_boilerplate()

    def handle_comment(self, data: str) -> None:
        self.markup.append(data)

    def close(self) -> None:
        super().close()
        if self._jsonld is not None:
            self.jsonld_blobs.append("".join(self._jsonld))
            self._jsonld = None
        self._flush_line()


def classify_link(anchor: _Anchor, base_url: str) -> Optional[Link]:
    """A Link for the anchor, or None for empty, fragment-only and javascript: links."""
    target = anchor.href.strip()
    lowered = target.lower()
    if not target or target.startswith("#") or lowered.startswith("javascript:"):
        return None

    def link(url: str, kind: str) -> Link:
        return Link(url, anchor.text, kind, anchor.rel, anchor.in_boilerplate)

    if lowered.startswith(("tel:", "mailto:")):
        return link(target, lowered.split(":", 1)[0])
    try:
        absolute = urljoin(base_url, target)
        if urlsplit(absolute).scheme.lower() not in ALLOWED_URL_SCHEMES:
            return link(absolute, "other")
        return link(absolute, "internal" if host_of(absolute) == host_of(base_url) else "external")
    except ValueError:  # a malformed URL such as an unclosed IPv6 bracket
        return link(target, "other")


def _links(anchors: List[_Anchor], base_url: str) -> Tuple[Link, ...]:
    classified = (classify_link(anchor, base_url) for anchor in anchors)
    return tuple(link for link in classified if link is not None)


def _canonical(link_tags: List[Dict[str, str]]) -> Optional[str]:
    for tag in link_tags:
        if "canonical" in tag.get("rel", "").lower().split():
            return tag.get("href")
    return None


def extract_facts(html: str, base_url: str) -> PageFacts:
    """Parse the page. base_url (the final URL after redirects) decides what is internal and resolves links."""
    parser = _FactsParser()
    parser.feed(html)
    parser.close()
    meta = parser.meta
    types, errors = json_ld_types(tuple(parser.jsonld_blobs))
    lines = parser.main_lines + parser.boilerplate_lines
    return PageFacts(
        lang=parser.lang,
        title=_clean("".join(parser.title_parts)),
        description=_clean(meta.get("description", "")),
        robots=meta.get("robots"),
        canonical=_canonical(parser.link_tags),
        hreflang=tuple(tag["hreflang"] for tag in parser.link_tags if "hreflang" in tag),
        has_viewport="viewport" in meta,
        generator=meta.get("generator"),
        og=tuple((key, value) for key, value in meta.items() if key.startswith("og:")),
        twitter=tuple((key, value) for key, value in meta.items() if key.startswith("twitter:")),
        headings=tuple(parser.headings),
        links=_links(parser.anchors, base_url),
        images=tuple(parser.images),
        image_source_types=tuple(parser.source_types),
        jsonld_types=types,
        jsonld_blocks=len(parser.jsonld_blobs),
        jsonld_errors=errors,
        forms=tuple(parser.forms),
        scripts_external=parser.external_scripts,
        scripts_inline=parser.inline_scripts,
        words_main=sum(len(line.split()) for line in parser.main_lines),
        words_total=sum(len(line.split()) for line in lines),
        phones=tuple(sorted({phone for line in lines for phone in PHONE_PATTERN.findall(line)})),
        platforms=detect_platforms("\n".join(parser.markup)),
        main_lines=tuple(parser.main_lines),
        boilerplate_lines=tuple(parser.boilerplate_lines),
    )
