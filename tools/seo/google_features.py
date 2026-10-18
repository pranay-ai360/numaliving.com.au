#!/usr/bin/env python3
"""Summarise Google SERP features from captured page text.

Usage:
    google_features.py CAPTURES_DIR

CAPTURES_DIR holds the *.txt files that `browse.py serp` saves (the visible text of each results page). For each
capture the report says whether an AI Overview, a local pack and ads were present, which sources the AI Overview
cites, the People-also-ask questions and the related searches.

The parser works on lines of text, so it is a heuristic that follows Google's current wording and needs a look
whenever the page layout changes. An AI Overview source is a name followed by a "+N" line; a source cited alone
(no "+N") cannot be told from ordinary text and is not listed. Standard library only.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional, Sequence, Tuple

from seo_common import SeoToolError, emit, read_text_file, run_cli

AI_OVERVIEW = "AI Overview"
AI_OVERVIEW_END = "AI responses may include mistakes"
AI_OVERVIEW_MAX_LINES = 120
LOCAL_PACK_MARKERS = ("Local Results", "Places")
ADS_MARKERS = ("Sponsored", "Sponsored results")
PEOPLE_ALSO_ASK = "People also ask"
RELATED_MARKERS = ("Searches related to", "Related searches", "People also search for")
SECTION_STOPS = frozenset(
    marker.lower()
    for marker in (
        "Web results", "Feedback", "People also search for", "Related searches", "Searches related to",
        "Page Navigation", "Videos", "Images", "Short videos", "Forums", "Things to know", "People also ask",
    )
)
SECTION_LIMIT = 8
SECTION_SCAN_FACTOR = 3  # a section is looked for in the next SECTION_LIMIT * 3 lines
ITEM_MIN_CHARS = 3  # an item is longer than this ...
ITEM_MAX_CHARS = 140  # ... and shorter than this
CITED_LIMIT_CHARS = 300
SOURCE_COUNT = re.compile(r"\+\d+")


@dataclass(frozen=True)
class GoogleFeatures:
    name: str
    has_ai_overview: bool
    ai_overview_sources: Tuple[str, ...]
    people_also_ask: Tuple[str, ...]
    related_searches: Tuple[str, ...]
    has_local_pack: bool
    has_ads: bool


def _ai_overview_sources(lines: Sequence[str]) -> Tuple[str, ...]:
    """Names that are followed by a "+N" line inside the AI Overview block."""
    if AI_OVERVIEW not in lines:
        return ()
    start = lines.index(AI_OVERVIEW) + 1
    block = []
    for line in lines[start : start + AI_OVERVIEW_MAX_LINES]:
        if line.startswith(AI_OVERVIEW_END):
            break
        block.append(line)
    names = [line for line, following in zip(block, block[1:]) if SOURCE_COUNT.fullmatch(following)]
    return tuple(dict.fromkeys(names))


def _items_after(lines: Sequence[str], marker: str, questions_only: bool) -> Tuple[str, ...]:
    """The short lines after the first line that is (or starts with) ``marker``, up to the next section heading."""
    start = next((index for index, line in enumerate(lines) if line == marker or line.startswith(marker)), None)
    if start is None:
        return ()
    items = []
    for line in lines[start + 1 : start + 1 + SECTION_LIMIT * SECTION_SCAN_FACTOR]:
        if line.lower() in SECTION_STOPS:
            break
        if not ITEM_MIN_CHARS < len(line) < ITEM_MAX_CHARS or (questions_only and not line.endswith("?")):
            continue
        items.append(line)
        if len(items) >= SECTION_LIMIT:
            break
    return tuple(items)


def parse_capture(text: str, name: str = "") -> GoogleFeatures:
    lines = tuple(line.strip() for line in text.splitlines() if line.strip())
    related = next((items for marker in RELATED_MARKERS for items in [_items_after(lines, marker, False)] if items), ())
    return GoogleFeatures(
        name=name,
        has_ai_overview=AI_OVERVIEW in lines,
        ai_overview_sources=_ai_overview_sources(lines),
        people_also_ask=_items_after(lines, PEOPLE_ALSO_ASK, True),
        related_searches=related,
        has_local_pack=any(marker in lines for marker in LOCAL_PACK_MARKERS),
        has_ads=any(marker in lines for marker in ADS_MARKERS),
    )


def load_captures(folder: Path) -> Tuple[GoogleFeatures, ...]:
    if not folder.is_dir():
        raise SeoToolError(f"{folder} is not a folder of Google captures")
    paths = sorted(folder.glob("*.txt"))
    if not paths:
        raise SeoToolError(f"no *.txt captures in {folder} (run `browse.py serp` first)")
    return tuple(parse_capture(read_text_file(path), path.stem) for path in paths)


def summary_counts(features: Sequence[GoogleFeatures]) -> Dict[str, int]:
    return {
        "captures": len(features),
        "ai_overview": len([item for item in features if item.has_ai_overview]),
        "local_pack": len([item for item in features if item.has_local_pack]),
        "ads": len([item for item in features if item.has_ads]),
        "people_also_ask": len([item for item in features if item.people_also_ask]),
    }


def _yes(flag: bool) -> str:
    return "YES" if flag else "no"


def render_features(features: GoogleFeatures) -> str:
    lines = [
        f"### {features.name}",
        f"  AI Overview: {_yes(features.has_ai_overview)} | local pack: {_yes(features.has_local_pack)}"
        f" | ads: {_yes(features.has_ads)}",
    ]
    if features.ai_overview_sources:
        lines.append("  AIO cites: " + "; ".join(features.ai_overview_sources)[:CITED_LIMIT_CHARS])
    if features.people_also_ask:
        lines.append("  PAA: " + " | ".join(features.people_also_ask))
    if features.related_searches:
        lines.append("  related: " + " | ".join(features.related_searches))
    return "\n".join(lines)


def render_summary(counts: Dict[str, int]) -> str:
    total = counts["captures"]
    return (
        f"AI Overview on {counts['ai_overview']} of {total} captures | local pack on {counts['local_pack']} "
        f"| ads on {counts['ads']} | People also ask on {counts['people_also_ask']}"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False
    )
    parser.add_argument("captures_dir", type=Path, metavar="CAPTURES_DIR", help="folder of Google capture text files")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    features = load_captures(args.captures_dir)
    emit("\n\n".join(render_features(item) for item in features))
    emit("\n" + render_summary(summary_counts(features)))
    return 0


if __name__ == "__main__":
    sys.exit(run_cli(main))
