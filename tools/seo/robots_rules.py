"""robots.txt parsing and matching as RFC 9309 describes them, so the rules mean the same on every Python.

urllib.robotparser cannot be relied on: before Python 3.14 it ignores the * and $ wildcards and takes the first
matching rule instead of the longest, a byte order mark hides the first group on every version, and it reads
"Crawl-delay: 2.5" as 0. This module is the whole story for the "*" group:

  * rules apply to the path plus the query string, compared after percent-encoding is put in a normal form;
  * the longest matching pattern (in characters) wins, and an Allow beats a Disallow of the same length;
  * "*" matches any run of characters and a trailing "$" ends the match; a rule is otherwise a prefix.

Only the first 512 KiB of a file are read (RFC 9309 asks crawlers for at least 500 KiB). A file that is not
UTF-8 text (UTF-16, UTF-32, a NUL byte) raises UnusableRobots: guessing its rules could mean fetching what the
site asked crawlers to leave alone. Standard library only.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Tuple

from seo_common import safe_urlsplit

MAX_ROBOTS_BYTES = 512 * 1024
MAX_PATTERN_CHARS = 2048
MAX_DELAY_TEXT_CHARS = 20
CRAWL_DELAY_CEILING_SECONDS = 31_536_000.0  # a year: what a number too long to read is taken to mean
STAR_AGENT = "*"
UTF16_MARKS = (b"\xff\xfe", b"\xfe\xff")  # a UTF-32 little-endian mark starts like the first one
LINE_BREAK = re.compile(r"\r\n|\r|\n")
DELAY_NUMBER = re.compile(r"(?:\d+(?:\.\d*)?|\.\d+)", re.ASCII)
ESCAPE = re.compile(r"%([0-9A-Fa-f]{2})")
UNRESERVED = frozenset("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")


class UnusableRobots(ValueError):
    """The file is not UTF-8 text, so what it says cannot be trusted."""


@dataclass(frozen=True)
class Rule:
    allow: bool
    pattern: str  # normalised, at most MAX_PATTERN_CHARS long, never empty


@dataclass(frozen=True)
class RobotsRules:
    """The merged rules of every "*" group, and the longest Crawl-delay among them (0 when there is none)."""

    rules: Tuple[Rule, ...] = ()
    crawl_delay: float = 0.0

    def allows(self, target: str) -> bool:
        """May a crawler fetch this path-and-query? No matching rule means yes."""
        normal = normalise(target) or "/"
        best_length, best_allow = -1, True
        for rule in self.rules:
            length = len(rule.pattern)
            if length < best_length or not pattern_matches(rule.pattern, normal):
                continue
            if length > best_length or rule.allow:
                best_length, best_allow = length, rule.allow
        return best_allow


def _unescape_unreserved(match: "re.Match[str]") -> str:
    character = chr(int(match.group(1), 16))
    return character if character in UNRESERVED else "%" + match.group(1).upper()


def _percent_encode(character: str) -> str:
    return "".join(f"%{byte:02X}" for byte in character.encode("utf-8", "replace"))


def normalise(text: str) -> str:
    """Percent-encode spaces, controls and non-ASCII text (UTF-8); upper-case the hex of escapes that stay."""
    escaped = "".join(
        character if "!" <= character <= "~" else _percent_encode(character)
        for character in text
    )
    return ESCAPE.sub(_unescape_unreserved, escaped)


def pattern_matches(pattern: str, target: str) -> bool:
    """Does the rule pattern match the start of the target? Linear in the sizes: no regex, so no backtracking."""
    anchored = pattern.endswith("$")
    body = pattern[:-1] if anchored else pattern
    first, *rest = body.split("*")
    if not rest:
        return target == first if anchored else target.startswith(first)
    if not target.startswith(first):
        return False
    *middle, last = rest
    position = len(first)
    for piece in middle:
        found = target.find(piece, position)
        if found < 0:
            return False
        position = found + len(piece)
    if anchored:
        return len(target) - len(last) >= position and target.endswith(last)
    return target.find(last, position) >= 0


def request_target(url: str) -> str:
    """The part of a URL that rules are matched against: the path, then ?query. A fragment is never sent."""
    parts = safe_urlsplit(url)
    if parts is None:
        return "/"
    path = parts.path or "/"
    return f"{path}?{parts.query}" if parts.query else path


def parse_delay(value: str) -> float:
    """A Crawl-delay as seconds: decimals are fine, anything that is not a plain number is 0 (ignored)."""
    text = value.strip()
    if not DELAY_NUMBER.fullmatch(text):
        return 0.0
    if len(text) > MAX_DELAY_TEXT_CHARS:
        return CRAWL_DELAY_CEILING_SECONDS
    return min(float(text), CRAWL_DELAY_CEILING_SECONDS)


def _decode(body: bytes) -> str:
    sample = body[:MAX_ROBOTS_BYTES]
    if sample.startswith(UTF16_MARKS) or b"\x00" in sample:
        raise UnusableRobots("robots.txt is not UTF-8 text (UTF-16, UTF-32 or binary), so its rules cannot be trusted")
    return sample.decode("utf-8-sig", errors="replace").lstrip("﻿")


def _lines(text: str) -> List[Tuple[str, str]]:
    """(field name in lower case, value) for every ``Name: value`` line, comments cut off."""
    fields: List[Tuple[str, str]] = []
    for line in LINE_BREAK.split(text):
        name, separator, value = line.split("#", 1)[0].partition(":")
        if separator:
            fields.append((name.strip().lower(), value.strip()))
    return fields


def parse_robots(body: bytes) -> RobotsRules:
    """The rules for the "*" group. Raises UnusableRobots when the bytes are not UTF-8 text."""
    rules: List[Rule] = []
    delay = 0.0
    in_star_group = False
    saw_agent_line = False  # the previous field was a User-agent line: the next one joins the same group
    group_is_open = False
    for name, value in _lines(_decode(body)):
        if name == "user-agent":
            if not saw_agent_line:
                in_star_group = False
            in_star_group = in_star_group or value == STAR_AGENT
            saw_agent_line = group_is_open = True
        elif name in ("allow", "disallow", "crawl-delay") and group_is_open:
            saw_agent_line = False
            if not in_star_group:
                continue
            if name == "crawl-delay":
                delay = max(delay, parse_delay(value))
            elif value:
                rules.append(Rule(name == "allow", normalise(value)[:MAX_PATTERN_CHARS]))
    return RobotsRules(tuple(rules), delay)
