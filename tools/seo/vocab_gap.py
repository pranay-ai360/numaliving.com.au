#!/usr/bin/env python3
"""Compare the vocabulary of ranking pages with the site's own pages.

Usage:
    vocab_gap.py --ranking PATH [PATH ...] --own PATH [PATH ...] [--min-share F] [--min-pages N] [--limit N] [--no-terms]

A PATH is a page text file written by audit_pages.py, a folder of them, or a pattern such as "pages/own_*.txt".
Only the headings and main text count: the nav, header, footer and aside text of each page is left out, and so are
pages whose file name suggests a login, 404, robots.txt, sitemap or /index.html copy (when found through a folder
or a pattern).

The report has three parts:
  1. the plan's US-versus-UK term table (see TERM_TABLE): how many pages on each side contain each term, next to
     the figures the plan recorded from 33 ranking US pages and 7 Numa pages;
  2. phrases (1 to 3 words, none starting or ending with a stop word, none crossing a line or punctuation mark)
     that appear on many ranking pages and on no page of the site: the core vocabulary gaps;
  3. phrases the site uses on several pages that ranking pages hardly use.
Standard library only.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import FrozenSet, Iterator, List, Mapping, Optional, Sequence, Tuple

from seo_common import SeoToolError, emit, positive_int, read_text_file, run_cli

STOP_WORDS = frozenset(
    """
    a about above after again all also am an and any are as at be because been before being below between both but by
    can could did do does doing down during each few for from further had has have having he her here hers him his how
    i if in into is it its just me more most my no nor not now of off on once only or other our ours out over own same
    she should so some such than that the their theirs them then there these they this those through to too under until
    up us very was we were what when where which while who whom why will with would you your yours get got make made
    see one two new need needs want view read learn home menu skip content contact privacy policy terms cookie cookies
    copyright rights reserved login search cart account email phone call click submit send name message sign subscribe
    follow facebook instagram linkedin twitter youtube pinterest tiktok whatsapp inc llc ltd
    """.split()
)
TOKEN = re.compile(r"[a-z][a-z'&-]{2,}")
NOT_PHRASE_CHARS = re.compile(r"[^\w\s'&-]+")
MAX_PHRASE_WORDS = 3
MIN_WORD_CHARS = 3
TEXT_HEADING = "# TEXT"
BOILERPLATE_HEADING = "# BOILERPLATE"
BOILERPLATE_PAGE_MARKERS = ("login", "no-such", "robots", "sitemap", "index.html")
DEFAULT_MIN_SHARE = 0.3
DEFAULT_MIN_PAGES = 4
DEFAULT_LIMIT = 90
OWN_ONLY_LIMIT = 60
OWN_ONLY_MIN_OWN_PAGES = 2
OWN_ONLY_MAX_RANKING_PAGES = 1
OWN_ONLY_MIN_CHARS = 5  # the term is longer than four characters
PLAN_RANKING_PAGES = 33
PLAN_OWN_PAGES = 7
TERM_LABEL_WIDTH = 34


@dataclass(frozen=True)
class GapRow:
    term: str
    ranking_pages: int
    own_pages: int


@dataclass(frozen=True)
class TermGroup:
    """One term (or a set of spellings that count as one) from the plan's table."""

    label: str
    patterns: Tuple[str, ...]  # a page counts when it contains any of these words or phrases
    plan_ranking_pages: int  # of the 33 ranking US pages, according to the plan
    plan_own_pages: int  # of the 7 Numa pages, according to the plan


@dataclass(frozen=True)
class TermRow:
    groups: Tuple[TermGroup, ...]
    action: str


@dataclass(frozen=True)
class TermCount:
    group: TermGroup
    ranking_pages: int
    own_pages: int


def _row(action: str, *groups: TermGroup) -> TermRow:
    return TermRow(groups, action)


def _group(label: str, patterns: Sequence[str], ranking: int, own: int) -> TermGroup:
    return TermGroup(label, tuple(patterns), ranking, own)


# Findings, section 4 of the US SEO plan (18 October 2026): ranking US pages (33) versus Numa pages (7).
TERM_TABLE: Tuple[TermRow, ...] = (
    _row("add everywhere it is true", _group("custom millwork", ["custom millwork"], 22, 0)),
    _row("paneling", _group("paneling", ["paneling"], 15, 0), _group("panelling", ["panelling"], 1, 4)),
    _row("add", _group("cabinetry", ["cabinetry"], 14, 0)),
    _row('replace "architraves"', _group("casing / trim", ["casing", "trim"], 14, 0)),
    _row("add", _group("casework", ["casework"], 13, 0)),
    _row(
        "add",
        _group("architectural millwork", ["architectural millwork"], 12, 0),
        _group("architectural woodwork", ["architectural woodwork"], 9, 0),
    ),
    _row("add (import hub)", _group("import / overseas / international", ["import", "overseas", "international"], 9, 0)),
    _row("only if true", _group("AWI / AWS standards", ["awi", "aws"], 5, 0)),
    _row("only if true", _group("licensed / insured", ["licensed", "insured"], 7, 0), _group("warranty", ["warranty"], 4, 0)),
    _row(
        "add (audiences)",
        _group("general contractors", ["general contractors"], 5, 0),
        _group("interior designers", ["interior designers"], 5, 0),
    ),
    _row("drop from public copy", _group("joinery", ["joinery"], 1, 7)),
    _row(
        "closets, dressing rooms",
        _group("wardrobe(s)", ["wardrobe", "wardrobes"], 3, 4),
        _group("closet(s)", ["closet", "closets"], 6, 0),
    ),
    _row("schedule", _group("programme", ["programme"], 1, 4), _group("schedule", ["schedule"], 10, 0)),
    _row("feet, inches and sq ft (dual)", _group("m² / metres", ["m²", "metres"], 1, 4)),
)


def page_text(text: str) -> str:
    """The main text of a page text file: after "# TEXT", before "# BOILERPLATE" (old files have no such parts)."""
    return text.split(BOILERPLATE_HEADING, 1)[0].split(TEXT_HEADING, 1)[-1]


def _segments(text: str) -> Iterator[str]:
    for line in text.lower().splitlines():
        yield from NOT_PHRASE_CHARS.split(line)


def page_ngrams(text: str) -> FrozenSet[str]:
    """Every 1 to 3 word phrase of the text that does not start or end with a stop word."""
    found = set()
    for segment in _segments(text):
        words = [word.strip("'-&") for word in TOKEN.findall(segment)]
        for size in range(1, MAX_PHRASE_WORDS + 1):
            for start in range(len(words) - size + 1):
                phrase = words[start : start + size]
                if phrase[0] in STOP_WORDS or phrase[-1] in STOP_WORDS or any(len(w) < MIN_WORD_CHARS for w in phrase):
                    continue
                found.add(" ".join(phrase))
    return frozenset(found)


def document_frequency(pages: Sequence[FrozenSet[str]]) -> Mapping[str, int]:
    """In how many pages each phrase appears (a page counts a phrase once)."""
    counts: Counter = Counter()
    for phrases in pages:
        counts.update(phrases)
    return counts


def find_core_gaps(
    ranking: Mapping[str, int],
    own: Mapping[str, int],
    ranking_total: int,
    min_pages: int = DEFAULT_MIN_PAGES,
    min_share: float = DEFAULT_MIN_SHARE,
    limit: int = DEFAULT_LIMIT,
) -> Tuple[GapRow, ...]:
    """Phrases on at least max(min_pages, min_share of the ranking pages) of them and on no own page."""
    threshold = max(min_pages, int(ranking_total * min_share))
    rows = [GapRow(term, count, 0) for term, count in ranking.items() if count >= threshold and own.get(term, 0) == 0]
    return tuple(sorted(rows, key=lambda row: (-row.ranking_pages, row.term))[:limit])


def find_own_only_terms(
    ranking: Mapping[str, int],
    own: Mapping[str, int],
    min_own_pages: int = OWN_ONLY_MIN_OWN_PAGES,
    max_ranking_pages: int = OWN_ONLY_MAX_RANKING_PAGES,
    limit: int = OWN_ONLY_LIMIT,
) -> Tuple[GapRow, ...]:
    """Phrases used on several own pages that at most a page or so of the ranking pages use."""
    rows = [
        GapRow(term, ranking.get(term, 0), count)
        for term, count in own.items()
        if count >= min_own_pages and ranking.get(term, 0) <= max_ranking_pages and len(term) >= OWN_ONLY_MIN_CHARS
    ]
    return tuple(sorted(rows, key=lambda row: (-row.own_pages, row.term))[:limit])


def count_pages_with(texts: Sequence[str], group: TermGroup) -> int:
    """How many texts contain any pattern of the group as whole words, ignoring case."""
    regexes = [re.compile(r"(?<![a-z0-9])" + re.escape(pattern.lower()) + r"(?![a-z0-9])") for pattern in group.patterns]
    return len([text for text in texts if any(regex.search(text.lower()) for regex in regexes)])


def term_counts(ranking_texts: Sequence[str], own_texts: Sequence[str]) -> Tuple[TermCount, ...]:
    return tuple(
        TermCount(group, count_pages_with(ranking_texts, group), count_pages_with(own_texts, group))
        for row in TERM_TABLE
        for group in row.groups
    )


def render_term_table(counts: Sequence[TermCount], ranking_total: int, own_total: int) -> str:
    by_label = {count.group.label: count for count in counts}
    width = TERM_LABEL_WIDTH
    heading = f"{'term':<{width}} {'ranking':>8} {'own':>7} {'plan US':>8} {'plan own':>9}  action"
    sizes = [f"(of {total})" for total in (ranking_total, own_total, PLAN_RANKING_PAGES, PLAN_OWN_PAGES)]
    lines = [heading, f"{'':<{width}} {sizes[0]:>8} {sizes[1]:>7} {sizes[2]:>8} {sizes[3]:>9}"]
    for row in TERM_TABLE:
        for index, group in enumerate(row.groups):
            count = by_label[group.label]
            ranking_cell, own_cell = f"{count.ranking_pages}/{ranking_total}", f"{count.own_pages}/{own_total}"
            action = row.action if index == 0 else ""
            lines.append(
                f"{group.label:<{width}} {ranking_cell:>8} {own_cell:>7} {group.plan_ranking_pages:>8} "
                f"{group.plan_own_pages:>9}  {action}".rstrip()
            )
    return "\n".join(lines)


def is_boilerplate_page(name: str) -> bool:
    return any(marker in name for marker in BOILERPLATE_PAGE_MARKERS)


def collect_text_files(arguments: Sequence[str]) -> Tuple[Path, ...]:
    """Page text files from files, folders (their *.txt) and patterns, in order, without repeats."""
    found: List[Path] = []
    for argument in arguments:
        path = Path(argument).expanduser()
        if path.is_dir():
            found.extend(item for item in sorted(path.glob("*.txt")) if not is_boilerplate_page(item.name))
        elif any(char in argument for char in "*?["):
            found.extend(item for item in sorted(path.parent.glob(path.name)) if item.is_file() and not is_boilerplate_page(item.name))
        elif path.is_file():
            found.append(path)
        else:
            raise SeoToolError(f"{argument} is not a folder, a file or a pattern that matches files")
    if not found:
        raise SeoToolError(f"no page text files (*.txt) found in: {', '.join(arguments)}")
    return tuple(dict.fromkeys(found))


def _gap_lines(rows: Sequence[GapRow], ranking_total: int, own_total: int, own_first: bool) -> List[str]:
    if own_first:
        return [f"{row.own_pages:>3} of {own_total} own pages, {row.ranking_pages} ranking  {row.term}" for row in rows]
    return [f"{row.ranking_pages:>3}/{ranking_total}  {row.term}" for row in rows]


def render_report(
    ranking_texts: Sequence[str],
    own_texts: Sequence[str],
    min_share: float = DEFAULT_MIN_SHARE,
    min_pages: int = DEFAULT_MIN_PAGES,
    limit: int = DEFAULT_LIMIT,
    with_terms: bool = True,
) -> str:
    ranking = document_frequency([page_ngrams(text) for text in ranking_texts])
    own = document_frequency([page_ngrams(text) for text in own_texts])
    lines = [f"ranking pages: {len(ranking_texts)} | own pages: {len(own_texts)}"]
    if with_terms:
        lines += ["", f"=== US-versus-UK terms (pages containing the term; plan figures: {PLAN_RANKING_PAGES} "
                      f"ranking US pages, {PLAN_OWN_PAGES} Numa pages) ===",
                  render_term_table(term_counts(ranking_texts, own_texts), len(ranking_texts), len(own_texts))]
    gaps = find_core_gaps(ranking, own, len(ranking_texts), min_pages, min_share, limit)
    threshold = max(min_pages, int(len(ranking_texts) * min_share))
    lines += ["", f"=== terms on at least {threshold} ranking pages and on NO own page (core vocabulary gaps) ==="]
    lines += _gap_lines(gaps, len(ranking_texts), len(own_texts), own_first=False) or ["  (none: try a lower --min-pages)"]
    lines += ["", f"=== Numa vocabulary that ranking pages rarely use (on {OWN_ONLY_MIN_OWN_PAGES}+ own pages, "
                  f"at most {OWN_ONLY_MAX_RANKING_PAGES} ranking page) ==="]
    lines += _gap_lines(find_own_only_terms(ranking, own), len(ranking_texts), len(own_texts), own_first=True) or ["  (none)"]
    return "\n".join(lines)


def _share(text: str) -> float:
    try:
        value = float(text)
    except ValueError:
        raise argparse.ArgumentTypeError(f"{text!r} is not a number") from None
    if not 0.0 <= value <= 1.0:
        raise argparse.ArgumentTypeError(f"{text!r} must be between 0 and 1")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False
    )
    parser.add_argument("--ranking", nargs="+", required=True, metavar="PATH", help="text files of the ranking pages")
    parser.add_argument("--own", nargs="+", required=True, metavar="PATH", help="text files of the site's own pages")
    parser.add_argument("--min-share", type=_share, default=DEFAULT_MIN_SHARE, metavar="F",
                        help=f"share of ranking pages a phrase must be on, 0 to 1 (default {DEFAULT_MIN_SHARE})")
    parser.add_argument("--min-pages", type=positive_int, default=DEFAULT_MIN_PAGES, metavar="N",
                        help=f"least number of ranking pages (default {DEFAULT_MIN_PAGES}); the larger of the two applies")
    parser.add_argument("--limit", type=positive_int, default=DEFAULT_LIMIT, metavar="N",
                        help=f"phrases to list in the gap section (default {DEFAULT_LIMIT})")
    parser.add_argument("--no-terms", action="store_true", help="leave out the US-versus-UK term table")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    ranking_files = collect_text_files(args.ranking)
    own_files = collect_text_files(args.own)
    ranking_texts = [page_text(read_text_file(path)) for path in ranking_files]
    own_texts = [page_text(read_text_file(path)) for path in own_files]
    emit(render_report(ranking_texts, own_texts, args.min_share, args.min_pages, args.limit, not args.no_terms))
    return 0


if __name__ == "__main__":
    sys.exit(run_cli(main))
