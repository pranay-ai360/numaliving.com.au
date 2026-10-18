"""Facts about one HTML page: head tags, headings, links, images, structured data, words and platform hints.

extract_facts(html, base_url) returns an immutable PageFacts; audit_pages.py turns it into reports. Standard
library only. The page is parsed, never executed, but it is still untrusted data.

Words and text lines: text inside nav, header, footer or aside is "boilerplate", everything else is "main".
Words are counted from the rebuilt text lines, so a headline split into one span per letter is still one word;
only tokens with a letter or digit count (a lone dash or bullet is not a word), and the text of dropdown lists,
text areas and scripts is left out. Platform hints come from markup the page itself uses (platform_signatures).

The parser reads pages as a browser does where it matters for these numbers: a missing </head> ends at the first
body tag, a new <a> or heading closes the open one, an end tag closes what was left open inside it, and nesting
stops at 512 levels. Counters instead of stack scans keep it linear, however deep a hostile page nests.
html.parser itself differs slightly between Python releases on broken markup (see tools/seo/README.md).
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Any, DefaultDict, Dict, List, Optional, Tuple

from html_links import Anchor, Link, classify_link, host_of
from json_ld import JSON_LD_TYPE, MAX_TYPE_CHARS, json_ld_types
from platform_signatures import PLATFORM_SIGNATURES, Signature, detect_platforms, signature_markup

__all__ = [
    "PLATFORM_SIGNATURES", "MAX_TYPE_CHARS", "Signature", "detect_platforms", "json_ld_types",  # re-exported
    "Anchor", "Link", "classify_link", "host_of",  # re-exported from html_links
    "FormInfo", "Heading", "Image", "PageFacts", "extract_facts",
]
_Anchor = Anchor  # the old private name, kept for code that imports it

VOID_TAGS = frozenset("area base br col embed hr img input link meta param source track wbr".split())
SKIP_TEXT_TAGS = frozenset(
    "script style noscript template svg head iframe title select option optgroup datalist textarea".split()
)
BOILERPLATE_TAGS = frozenset("nav header footer aside".split())
HEAD_TAGS = frozenset("title meta link script style noscript base template".split())  # may sit inside <head>
BLOCK_TAGS = frozenset(
    "p div section article li ul ol h1 h2 h3 h4 h5 h6 tr td th table br dt dd dl form figure figcaption "
    "blockquote main nav header footer aside details summary button".split()
)
HEADING_LEVELS = {"h1": 1, "h2": 2, "h3": 3, "h4": 4, "h5": 5, "h6": 6}
MAX_STACK_DEPTH = 512
WORD_CHARACTER = re.compile(r"[^\W_]")  # a letter or digit in any script
PHONE_PATTERN = re.compile(r"(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)")


@dataclass(frozen=True)
class Heading:
    level: int
    text: str


@dataclass(frozen=True)
class Image:
    src: str
    alt: Optional[str]  # None: no alt attribute; "": empty alt (decorative); otherwise the text
    has_size: bool  # both width and height are set
    loading: str
    has_srcset: bool
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


def _clean(text: str) -> str:
    return " ".join(text.split())


def _word_count(lines: Tuple[str, ...]) -> int:
    return sum(1 for line in lines for token in line.split() if WORD_CHARACTER.search(token))


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
        self.anchors: List[Anchor] = []
        self.images: List[Image] = []
        self.forms: List[FormInfo] = []
        self.source_types: List[str] = []
        self.jsonld_blobs: List[str] = []
        self.external_scripts = 0
        self.inline_scripts = 0
        self.main_lines: List[str] = []
        self.boilerplate_lines: List[str] = []
        self.markup: List[str] = []
        self._open: DefaultDict[str, int] = defaultdict(int)  # tag -> how many are on the stack
        self._skip_depth = 0  # open elements whose text is not page text
        self._boilerplate_depth = 0  # open nav, header, footer or aside elements
        self._buffer: List[str] = []
        self._buffer_is_boilerplate = False
        self._heading: Optional[Tuple[int, List[str]]] = None
        self._anchor: Optional[Dict[str, Any]] = None
        self._jsonld: Optional[List[str]] = None
        self._in_title = False
        self._title_done = False

    # -- the stack of open elements ------------------------------------------------------------------------

    def _push(self, tag: str) -> None:
        if len(self.stack) >= MAX_STACK_DEPTH:
            return  # like a browser, stop nesting here; the element's end tag will find nothing to close
        self.stack.append(tag)
        self._open[tag] += 1
        self._skip_depth += tag in SKIP_TEXT_TAGS
        self._boilerplate_depth += tag in BOILERPLATE_TAGS

    def _pop(self) -> str:
        tag = self.stack.pop()
        self._open[tag] -= 1
        self._skip_depth -= tag in SKIP_TEXT_TAGS
        self._boilerplate_depth -= tag in BOILERPLATE_TAGS
        return tag

    def _close_through(self, tag: str) -> None:
        """Close the nearest open ``tag`` and everything left open inside it; nothing happens if none is open."""
        if self._open[tag] <= 0:
            return
        while self.stack and self._pop() != tag:
            pass

    def _in_boilerplate(self) -> bool:
        return self._boilerplate_depth > 0

    # -- text lines ------------------------------------------------------------------------------------------

    def _flush_line(self) -> None:
        """End the current text line. A block boundary also separates the words of an open heading or link."""
        text = _clean("".join(self._buffer))
        if text:
            (self.boilerplate_lines if self._buffer_is_boilerplate else self.main_lines).append(text)
        self._buffer = []
        for parts in (self._heading[1] if self._heading else None, self._anchor["parts"] if self._anchor else None):
            if parts:
                parts.append(" ")

    def _add_text(self, data: str) -> None:
        """Whitespace between inline elements is kept inside a line and dropped at the start of one."""
        heading_parts = self._heading[1] if self._heading else None
        anchor_parts = self._anchor["parts"] if self._anchor else None
        targets = (self._buffer, heading_parts, anchor_parts)
        for parts in targets:
            if parts is not None and (parts or data.strip()):
                parts.append(data)
        if len(self._buffer) == 1:
            self._buffer_is_boilerplate = self._in_boilerplate()

    # -- start tags --------------------------------------------------------------------------------------------

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        values: Dict[str, str] = {}
        for name, value in attrs:
            values.setdefault(name, value if value is not None else "")  # a repeated attribute: the first one wins
        self.markup.extend(signature_markup(tag, values))
        self._end_implied(tag)
        if tag in BLOCK_TAGS:
            self._flush_line()
        if tag == "html" and self.lang is None:
            self.lang = values.get("lang")
        if tag not in VOID_TAGS:
            self._push(tag)
        self._record_start(tag, values)

    def _end_implied(self, tag: str) -> None:
        """Close what this start tag ends without an end tag: the head, an open anchor, an open heading."""
        if self._open["head"] and tag not in HEAD_TAGS:
            self._close_through("head")
        if tag == "a":
            self._finish_anchor()
            self._close_through("a")
        elif tag in HEADING_LEVELS and self._heading is not None:
            self._close_through(f"h{self._heading[0]}")
            self._finish_heading()

    def _record_start(self, tag: str, values: Dict[str, str]) -> None:
        if tag == "title":
            self._in_title = not self._title_done and self._open["svg"] == 0
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

    # -- end tags, text, end of input ----------------------------------------------------------------------------

    def handle_endtag(self, tag: str) -> None:
        if tag in VOID_TAGS:
            return
        if tag in BLOCK_TAGS:
            self._flush_line()
        self._close_through(tag)
        self._record_end(tag)

    def _record_end(self, tag: str) -> None:
        if tag == "title" and self._in_title:
            self._in_title = False
            self._title_done = True
        elif tag == "script" and self._jsonld is not None:
            self.jsonld_blobs.append("".join(self._jsonld))
            self._jsonld = None
        elif tag == "a":
            self._finish_anchor()
        elif tag in HEADING_LEVELS:  # an end tag of any level closes the open heading, as in a browser
            self._finish_heading()

    def _finish_anchor(self) -> None:
        if self._anchor is not None:
            anchor = self._anchor
            text = _clean("".join(anchor["parts"]))
            self.anchors.append(Anchor(anchor["href"], anchor["rel"], text, anchor["in_boilerplate"]))
            self._anchor = None

    def _finish_heading(self) -> None:
        if self._heading is not None:
            level, parts = self._heading
            self.headings.append(Heading(level, _clean("".join(parts))))
            self._heading = None

    def handle_data(self, data: str) -> None:
        if self._jsonld is not None:
            self._jsonld.append(data)
        elif self._in_title:
            self.title_parts.append(data)
        elif self.stack and self.stack[-1] in ("script", "style"):
            self.markup.append(data)
        elif self._skip_depth == 0:
            self._add_text(data)

    def handle_comment(self, data: str) -> None:
        self.markup.append(data)

    def close(self) -> None:
        super().close()
        if self._jsonld is not None:
            self.jsonld_blobs.append("".join(self._jsonld))
            self._jsonld = None
        self._finish_anchor()
        self._finish_heading()
        self._flush_line()


def _links(anchors: List[Anchor], base_url: str) -> Tuple[Link, ...]:
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
    parser.feed(html[1:] if html.startswith("\ufeff") else html)  # a byte order mark is not text
    parser.close()
    meta = parser.meta
    types, errors = json_ld_types(tuple(parser.jsonld_blobs))
    main = tuple(parser.main_lines)
    lines = main + tuple(parser.boilerplate_lines)
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
        words_main=_word_count(main),
        words_total=_word_count(lines),
        phones=tuple(sorted({phone for line in lines for phone in PHONE_PATTERN.findall(line)})),
        platforms=detect_platforms("\n".join(parser.markup)),
        main_lines=main,
        boilerplate_lines=tuple(parser.boilerplate_lines),
    )
