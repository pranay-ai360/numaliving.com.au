#!/usr/bin/env python3
"""Deterministic full-page screenshots for visual-parity comparison.

For every route and viewport: fresh page at DPR 1 with reduced motion, injected
CSS that finishes animations/transitions and hides the caret, wait for fonts,
scroll to the bottom in steps and back to the top (so scroll-triggered content
appears), wait for every image to be complete, settle, then one full-page PNG
named ``<route-slug>-<width>.png`` (``/`` -> ``home-320.png``).

Example:
    python3 capture.py --base-url http://127.0.0.1:4301/ --out-dir parity/baseline \
        --extra-route /portal/ --extra-route /definitely-not-a-page/

Compare two capture directories afterwards with compare.py.
"""

from __future__ import annotations

import argparse
import re
import struct
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from qa_common import (
    FINGERPRINT_SEED,
    BaseUrl,
    QAError,
    log,
    new_context,
    open_browser,
    parse_base_url,
    prepare_page,
    route_slug,
    utc_now,
    write_json,
)

DEFAULT_ROUTES = [
    "/",
    "/about/",
    "/capabilities/",
    "/process/",
    "/projects/",
    "/projects/marina-villa/",
    "/projects/golf-links/",
    "/contact/",
    "/login/",
]
DEFAULT_VIEWPORTS = "320x800,768x1024,1024x768,1440x900"
VIEWPORT_PATTERN = re.compile(r"^(\d{3,4})x(\d{3,4})$")
PNG_IHDR_OFFSET = 16


@dataclass(frozen=True)
class Viewport:
    width: int
    height: int

    @property
    def label(self) -> str:
        return f"{self.width}x{self.height}"


def parse_viewports(text: str) -> list[Viewport]:
    viewports: list[Viewport] = []
    for token in (part.strip() for part in text.split(",") if part.strip()):
        match = VIEWPORT_PATTERN.match(token)
        if match is None:
            raise QAError(f"--viewports entries must look like 320x800, got {token!r}")
        viewports.append(Viewport(int(match.group(1)), int(match.group(2))))
    widths = [viewport.width for viewport in viewports]
    if not viewports or len(set(widths)) != len(widths):
        raise QAError("--viewports needs at least one entry and unique widths (file names use the width)")
    return viewports


def parse_routes(tokens: list[str], extras: list[str]) -> list[str]:
    routes = [route.strip() for token in tokens + extras for route in token.split(",") if route.strip()]
    return list(dict.fromkeys(routes))


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        header = handle.read(PNG_IHDR_OFFSET + 8)
    return struct.unpack(">II", header[PNG_IHDR_OFFSET : PNG_IHDR_OFFSET + 8])


def capture_route(page: Any, base: BaseUrl, route: str, viewport: Viewport, out_dir: Path) -> dict[str, Any]:
    """Capture one route at the page's current viewport; never raises for per-page problems."""
    url = base.resolve(route)
    file_name = f"{route_slug(route)}-{viewport.width}.png"
    entry: dict[str, Any] = {"route": route, "url": url, "viewport": viewport.label, "file": file_name}
    try:
        response = page.goto(url, wait_until="load")
        prepared = prepare_page(page)
        page.screenshot(path=str(out_dir / file_name), full_page=True, animations="disabled", caret="hide", scale="css")
        width, height = png_size(out_dir / file_name)
        return {
            **entry,
            "status": response.status if response else None,
            "final_url": page.url,
            "png_size": [width, height],
            "page_height": prepared["page_height"],
            "pending_images": prepared["pending_images"],
            "fonts_ready": prepared["fonts_ready"],
            "error": None,
        }
    except Exception as error:  # keep going: one bad route must not lose the other screenshots
        return {**entry, "status": None, "error": f"{type(error).__name__}: {error}"}


def describe(entry: dict[str, Any]) -> str:
    if entry["error"]:
        return f"{entry['viewport']:>9} {entry['route']:<28} ERROR {entry['error'][:120]}"
    notes = []
    if entry["status"] != 200:
        notes.append(f"status {entry['status']}")
    if entry["pending_images"]:
        notes.append(f"{len(entry['pending_images'])} image(s) not loaded")
    if not entry["fonts_ready"]:
        notes.append("fonts not ready")
    width, height = entry["png_size"]
    suffix = f" [{'; '.join(notes)}]" if notes else ""
    return f"{entry['viewport']:>9} {entry['route']:<28} {entry['file']} {width}x{height}{suffix}"


def capture_all(browser: Any, base: BaseUrl, routes: list[str], viewports: list[Viewport], out_dir: Path) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for viewport in viewports:
        context = new_context(browser, viewport.width, viewport.height)
        try:
            page = context.new_page()
            for route in routes:
                entry = capture_route(page, base, route, viewport, out_dir)
                log(describe(entry))
                entries.append(entry)
        finally:
            context.close()
    return entries


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deterministic full-page screenshots for visual parity.")
    parser.add_argument("--base-url", required=True, help="e.g. http://127.0.0.1:4301/ or http://127.0.0.1:4302/numaliving.com.au/")
    parser.add_argument("--out-dir", required=True, help="directory for the PNGs and manifest.json")
    parser.add_argument("--routes", nargs="+", default=DEFAULT_ROUTES, help="routes relative to the base URL (space or comma separated)")
    parser.add_argument("--extra-route", action="append", default=[], help="route added to --routes (repeatable)")
    parser.add_argument("--viewports", default=DEFAULT_VIEWPORTS, help=f"WxH list, default {DEFAULT_VIEWPORTS}")
    return parser.parse_args(argv)


def run(args: argparse.Namespace) -> int:
    base = parse_base_url(args.base_url)
    viewports = parse_viewports(args.viewports)
    routes = parse_routes(args.routes, args.extra_route)
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    log(f"capturing {len(routes)} route(s) x {len(viewports)} viewport(s) from {base.url} into {out_dir}")

    with open_browser() as browser:
        browser_version = browser.version
        entries = capture_all(browser, base, routes, viewports, out_dir)

    errors = [entry for entry in entries if entry["error"]]
    write_json(
        out_dir / "manifest.json",
        {
            "base_url": base.url,
            "captured_at": utc_now(),
            "browser_version": browser_version,
            "fingerprint_seed": FINGERPRINT_SEED,
            "viewports": [viewport.label for viewport in viewports],
            "routes": routes,
            "entries": entries,
        },
    )
    log(f"done: {len(entries) - len(errors)} screenshot(s), {len(errors)} error(s); manifest at {out_dir / 'manifest.json'}")
    return 1 if errors else 0


def main(argv: list[str] | None = None) -> int:
    try:
        return run(parse_args(argv))
    except QAError as error:
        print(f"capture: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
