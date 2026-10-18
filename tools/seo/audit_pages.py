#!/usr/bin/env python3
"""Summarise saved HTML pages for an SEO audit.

Usage:
    audit_pages.py FILE.html [FILE.html ...] [--base-url URL]   write FILE.analysis.json and FILE.txt, print a summary
    audit_pages.py --table DIR                                   one comparison row per *.analysis.json in DIR

Reads the page and, when present, the FILE.meta.json that fetch_pages.py saved next to it (status, redirect hops,
headers and the final URL, which decides what counts as an internal link). Without a meta file, --base-url
(default https://example.invalid/) plays that part. FILE.txt holds the headings, the main text and the
boilerplate text (nav, header, footer, aside) for vocab_gap.py. The pages are parsed, never executed.
Standard library only.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional, Sequence
from urllib.parse import urlsplit

from html_facts import PageFacts, extract_facts, host_of
from seo_common import (
    SeoToolError,
    read_json_file,
    read_text_file,
    require_http_url,
    run_cli,
    write_json_file,
    write_text_file,
)

DEFAULT_BASE_URL = "https://example.invalid/"
PREVIEW_WORDS = 80
NAV_LABEL_LIMIT = 40
ALT_SAMPLE_LIMIT = 6
PHONE_LIMIT = 6
MODERN_IMAGE_TYPES = ("image/webp", "image/avif")
TABLE_KEYS = (
    "final_url", "status", "title_len", "description_len", "h1", "h2", "words_main", "images",
    "images_alt_missing", "images_alt_empty", "canonical", "og", "jsonld_types",
)
TABLE_PAGE_WIDTH = 46
TABLE_TYPES_WIDTH = 60


def read_fetch_meta(html_path: Path) -> Dict[str, Any]:
    meta_path = html_path.with_suffix(".meta.json")
    if not meta_path.is_file():
        return {}
    data = read_json_file(meta_path)
    if not isinstance(data, dict):
        raise SeoToolError(f"{meta_path} must hold a JSON object")
    return data


def _head_summary(facts: PageFacts) -> Dict[str, Any]:
    return {
        "lang": facts.lang,
        "title": facts.title,
        "title_len": len(facts.title),
        "description": facts.description,
        "description_len": len(facts.description),
        "robots": facts.robots,
        "canonical": facts.canonical,
        "hreflang": list(facts.hreflang),
        "viewport": facts.has_viewport,
        "og": dict(facts.og),
        "twitter": dict(facts.twitter),
        "generator": facts.generator,
        "h1": list(facts.heading_texts(1)),
        "h2": list(facts.heading_texts(2)),
        "h3_count": len(facts.heading_texts(3)),
        "headings": [[f"h{heading.level}", heading.text] for heading in facts.headings],
        "words_main": facts.words_main,
        "words_total": facts.words_total,
    }


def _link_summary(facts: PageFacts) -> Dict[str, Any]:
    internal, external = facts.links_of("internal"), facts.links_of("external")
    return {
        "links_internal": len(internal),
        "links_external": len(external),
        "links_internal_main": len([link for link in internal if not link.in_boilerplate]),
        "tel_links": len(facts.links_of("tel")),
        "mailto_links": len(facts.links_of("mailto")),
        "nav_labels": sorted({link.text for link in internal if link.in_boilerplate and link.text})[:NAV_LABEL_LIMIT],
        "internal_urls": sorted({link.url.split("#")[0] for link in internal}),
        "external_domains": sorted({host_of(link.url) for link in external}),
    }


def _image_summary(facts: PageFacts) -> Dict[str, Any]:
    images = facts.images
    return {
        "images": len(images),
        "images_alt_missing": len([image for image in images if image.alt is None]),
        "images_alt_empty": len([image for image in images if image.alt == ""]),
        "images_with_size": len([image for image in images if image.has_size]),
        "images_lazy": len([image for image in images if image.loading == "lazy"]),
        "image_exts": sorted({Path(urlsplit(image.src).path).suffix.lower() for image in images if image.src}),
        "modern_image_sources": sorted({kind for kind in facts.image_source_types if kind in MODERN_IMAGE_TYPES}),
        "alt_samples": [image.alt for image in images if image.alt][:ALT_SAMPLE_LIMIT],
    }


def _page_summary(facts: PageFacts) -> Dict[str, Any]:
    return {
        "jsonld_types": list(facts.jsonld_types),
        "jsonld_blocks": facts.jsonld_blocks,
        "jsonld_errors": facts.jsonld_errors,
        "forms": [{"action": form.action, "method": form.method} for form in facts.forms],
        "scripts_external": facts.scripts_external,
        "scripts_inline": facts.scripts_inline,
        "phones": list(facts.phones[:PHONE_LIMIT]),
        "platform": list(facts.platforms),
        "text_preview": " ".join(" ".join(facts.main_lines).split()[:PREVIEW_WORDS]),
    }


def summarize_page(facts: PageFacts, meta: Mapping[str, Any], file_name: str, html_bytes: int) -> Dict[str, Any]:
    """The flat analysis record (the keys of the research prototype) for one page and its fetch details."""
    fetched = {
        "file": file_name,
        "requested": meta.get("requested"),
        "final_url": meta.get("final_url"),
        "status": meta.get("status"),
        "redirects": list(meta.get("redirects") or []),
        "headers": dict(meta.get("headers") or {}),
        "html_bytes": html_bytes,
    }
    return {**fetched, **_head_summary(facts), **_link_summary(facts), **_image_summary(facts), **_page_summary(facts)}


def render_text_file(facts: PageFacts) -> str:
    """Headings, then the main text, then the boilerplate text: the input of vocab_gap.py."""
    outline = [f"H{heading.level}: {heading.text}" for heading in facts.headings]
    sections = ["# HEADINGS", *outline, "", "# TEXT", *facts.main_lines, "", "# BOILERPLATE", *facts.boilerplate_lines]
    return "\n".join(sections) + "\n"


def audit_file(html_path: Path, fallback_base_url: str = DEFAULT_BASE_URL) -> Dict[str, Any]:
    """Analyse one saved page and write FILE.analysis.json and FILE.txt next to it."""
    html = read_text_file(html_path)
    meta = read_fetch_meta(html_path)
    base_url = meta.get("final_url") or meta.get("requested") or fallback_base_url
    facts = extract_facts(html, base_url)
    summary = summarize_page(facts, {**meta, "final_url": base_url}, html_path.name, html_path.stat().st_size)
    write_json_file(html_path.with_suffix(".analysis.json"), summary)
    write_text_file(html_path.with_suffix(".txt"), render_text_file(facts))
    return summary


def _joined(items: Sequence[str], limit: int) -> str:
    return " | ".join(items)[:limit]


def format_summary(summary: Mapping[str, Any]) -> str:
    """The printed summary of one page, in the layout of the research prototype."""
    r, headers = summary, summary.get("headers") or {}
    hops = ">".join(str(hop["status"]) for hop in r["redirects"]) or "-"
    lines = [
        f"== {r['final_url']}  [{r['status']}] hops:{hops}  {r['html_bytes'] / 1024:.0f} KB  lang={r['lang']}",
        f" title ({r['title_len']}): {r['title']}",
        f" desc  ({r['description_len']}): {r['description'][:170] or '-'}",
        f" canonical: {r['canonical'] or '-'} | robots: {r['robots'] or '-'} | hreflang: {len(r['hreflang'])}",
        f" x-robots-tag: {headers.get('x-robots-tag', '-')} | cache-control: {headers.get('cache-control', '-')}",
        f" og: {', '.join(r['og']) or 'none'} | twitter: {', '.join(r['twitter']) or 'none'}",
        f" h1 ({len(r['h1'])}): {_joined(r['h1'], 200)}",
        f" h2 ({len(r['h2'])}): {_joined(r['h2'], 260)}",
        f" words main {r['words_main']} / total {r['words_total']} | links int {r['links_internal']} "
        f"(main {r['links_internal_main']}) ext {r['links_external']} | tel {r['tel_links']} "
        f"mailto {r['mailto_links']} phones {r['phones']}",
        f" images {r['images']} (alt missing {r['images_alt_missing']}, empty {r['images_alt_empty']}, "
        f"sized {r['images_with_size']}, lazy {r['images_lazy']}) exts {r['image_exts']} "
        f"modern {r['modern_image_sources']}",
        f" jsonld: {', '.join(r['jsonld_types']) or 'none'} ({r['jsonld_blocks']} blocks, {r['jsonld_errors']} errors) "
        f"| forms {len(r['forms'])} | platform: {', '.join(r['platform']) or '?'}",
    ]
    return "\n".join(lines)


def read_analysis(path: Path) -> Dict[str, Any]:
    data = read_json_file(path)
    missing = [key for key in TABLE_KEYS if not isinstance(data, dict) or key not in data]
    if missing:
        raise SeoToolError(f"{path} is not an analysis file (missing {', '.join(missing)})")
    return data


def format_table(rows: Sequence[Mapping[str, Any]]) -> str:
    header = (
        f"{'page':<{TABLE_PAGE_WIDTH}} {'st':>3} {'title':>5} {'desc':>4} {'h1':>2} {'h2':>3} {'words':>5} "
        f"{'img':>3} {'alt-':>4} {'can':>3} {'og':>2} ld types"
    )
    lines: List[str] = [header, "-" * len(header)]
    for r in rows:
        parts = urlsplit(str(r["final_url"] or ""))
        page = (parts.netloc + parts.path)[:TABLE_PAGE_WIDTH]
        lines.append(
            f"{page:<{TABLE_PAGE_WIDTH}} {str(r['status']):>3} {r['title_len']:>5} {r['description_len']:>4} "
            f"{len(r['h1']):>2} {len(r['h2']):>3} {r['words_main']:>5} {r['images']:>3} "
            f"{r['images_alt_missing'] + r['images_alt_empty']:>4} {'y' if r['canonical'] else '-':>3} "
            f"{len(r['og']):>2} {','.join(r['jsonld_types'])[:TABLE_TYPES_WIDTH]}"
        )
    return "\n".join(lines)


def table_for(directory: Path) -> str:
    paths = sorted(directory.glob("*.analysis.json"))
    if not paths:
        raise SeoToolError(f"no *.analysis.json files in {directory} (run audit_pages.py on the saved pages first)")
    return format_table([read_analysis(path) for path in paths])


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False
    )
    parser.add_argument("files", nargs="*", type=Path, metavar="FILE.html", help="saved HTML pages to analyse")
    parser.add_argument("--table", type=Path, metavar="DIR", help="compare the *.analysis.json files in DIR instead")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL,
                        help=f"site address for pages saved without a meta file (default {DEFAULT_BASE_URL})")
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.table and args.files:
        parser.error("give either HTML files or --table DIR, not both")
    if args.table:
        print(table_for(args.table))
        return 0
    if not args.files:
        parser.error("give one or more HTML files, or --table DIR")
    base_url = require_http_url(args.base_url)
    for html_path in args.files:
        print(format_summary(audit_file(html_path, base_url)))
    return 0


if __name__ == "__main__":
    sys.exit(run_cli(main))
