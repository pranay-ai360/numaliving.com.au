#!/usr/bin/env python3
"""Pixel comparison of two screenshot directories produced by capture.py.

Files are matched by name (``<route-slug>-<width>.png``). A pixel counts as
different when ANY channel differs by more than ``--tolerance`` (default 8/255).
Any area present in only one image of a pair (size mismatch) counts as different.

Writes ``parity.md``, ``parity.json`` and ``diff/<name>.png`` (faded candidate,
differences in red, main regions boxed in magenta) for every pair above
``--threshold`` percent (default 0.1) or with a size mismatch.

Example:
    python3 compare.py --baseline parity/baseline --candidate parity/candidate \
        --out-dir parity/report

Exit status: 0 = PASS, 1 = FAIL, 2 = usage error.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
import sys
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw

from qa_common import QAError, log, utc_now, write_json

DEFAULT_TOLERANCE = 8
DEFAULT_THRESHOLD_PERCENT = 0.1
DEFAULT_EXPECT_MISSING = ["portal-*"]
BAND_ROWS = 512
REGION_GAP_ROWS = 40
MAX_REGIONS = 5
FADE_FACTOR = 0.3
BOX_PADDING = 6
BOX_COLOR = (255, 0, 255)
DIFF_COLOR = (255, 0, 0)
NAME_PATTERN = re.compile(r"^(?P<slug>.+)-(?P<width>\d+)\.png$")


def list_pngs(directory: Path) -> dict[str, Path]:
    if not directory.is_dir():
        raise QAError(f"not a directory: {directory}")
    return {path.name: path for path in sorted(directory.glob("*.png"))}


def load_rgb(path: Path) -> np.ndarray:
    """Load as H x W x 3 uint8; transparency is composited over white."""
    with Image.open(path) as image:
        if "A" in image.getbands():
            background = Image.new("RGBA", image.size, (255, 255, 255, 255))
            return np.asarray(Image.alpha_composite(background, image.convert("RGBA")).convert("RGB"))
        return np.asarray(image.convert("RGB"))


def pixel_mask(baseline: np.ndarray, candidate: np.ndarray, tolerance: int) -> np.ndarray:
    """Boolean mask on the union canvas: True where the images differ (or only one exists)."""
    height = max(baseline.shape[0], candidate.shape[0])
    width = max(baseline.shape[1], candidate.shape[1])
    overlap_height = min(baseline.shape[0], candidate.shape[0])
    overlap_width = min(baseline.shape[1], candidate.shape[1])
    mask = np.ones((height, width), dtype=bool)
    for top in range(0, overlap_height, BAND_ROWS):
        bottom = min(top + BAND_ROWS, overlap_height)
        delta = np.abs(
            baseline[top:bottom, :overlap_width].astype(np.int16)
            - candidate[top:bottom, :overlap_width].astype(np.int16)
        )
        mask[top:bottom, :overlap_width] = (delta > tolerance).any(axis=2)
    return mask


def diff_regions(mask: np.ndarray) -> list[dict[str, int]]:
    """Largest vertical bands containing differences (rows closer than the gap are merged)."""
    row_counts = mask.sum(axis=1)
    rows = np.flatnonzero(row_counts)
    if rows.size == 0:
        return []
    regions = []
    for chunk in np.split(rows, np.flatnonzero(np.diff(rows) > REGION_GAP_ROWS) + 1):
        top, bottom = int(chunk[0]), int(chunk[-1])
        columns = np.flatnonzero(mask[top : bottom + 1].any(axis=0))
        regions.append(
            {
                "x0": int(columns[0]),
                "y0": top,
                "x1": int(columns[-1]),
                "y1": bottom,
                "pixels": int(row_counts[top : bottom + 1].sum()),
            }
        )
    return sorted(regions, key=lambda region: region["pixels"], reverse=True)[:MAX_REGIONS]


def render_diff(candidate: np.ndarray, mask: np.ndarray, regions: list[dict[str, int]]) -> Image.Image:
    height, width = mask.shape
    canvas = np.full((height, width, 3), 255, dtype=np.uint8)
    faded = (255 - (255 - candidate.mean(axis=2)) * FADE_FACTOR).astype(np.uint8)
    canvas[: candidate.shape[0], : candidate.shape[1]] = faded[..., None]
    canvas[mask] = DIFF_COLOR
    image = Image.fromarray(canvas)
    draw = ImageDraw.Draw(image)
    for region in regions:
        box = (
            region["x0"] - BOX_PADDING,
            region["y0"] - BOX_PADDING,
            region["x1"] + BOX_PADDING,
            region["y1"] + BOX_PADDING,
        )
        draw.rectangle(box, outline=BOX_COLOR, width=3)
    return image


def classify(size_match: bool, differing: int, percent: float, threshold: float) -> str:
    if not size_match:
        return "SIZE"
    if differing == 0:
        return "identical"
    return "DIFF" if percent > threshold else "ok"


def compare_pair(
    name: str, baseline_path: Path, candidate_path: Path, tolerance: int, threshold: float, diff_dir: Path
) -> dict[str, Any]:
    """Compare one pair of screenshots; unreadable files yield an ERROR result, not an exception."""
    try:
        baseline, candidate = load_rgb(baseline_path), load_rgb(candidate_path)
    except (OSError, ValueError) as error:
        return {"name": name, "result": "ERROR", "error": f"{type(error).__name__}: {error}"}
    mask = pixel_mask(baseline, candidate, tolerance)
    differing = int(mask.sum())
    percent = differing / mask.size * 100
    size_match = baseline.shape == candidate.shape
    result = classify(size_match, differing, percent, threshold)
    regions = diff_regions(mask) if result in ("DIFF", "SIZE") else []
    diff_image = None
    if result in ("DIFF", "SIZE"):
        diff_dir.mkdir(parents=True, exist_ok=True)
        render_diff(candidate, mask, regions).save(diff_dir / name)
        diff_image = f"{diff_dir.name}/{name}"
    return {
        "name": name,
        "result": result,
        "baseline_size": [baseline.shape[1], baseline.shape[0]],
        "candidate_size": [candidate.shape[1], candidate.shape[0]],
        "differing_pixels": differing,
        "total_pixels": int(mask.size),
        "percent": round(percent, 4),
        "regions": regions,
        "diff_image": diff_image,
        "error": None,
    }


def sort_key(name: str) -> tuple[str, int]:
    match = NAME_PATTERN.match(name)
    return (match.group("slug"), int(match.group("width"))) if match else (name, 0)


def split_missing(only_baseline: list[str], expect_missing: list[str]) -> tuple[list[str], list[str]]:
    expected = [name for name in only_baseline if any(fnmatch.fnmatch(name, pattern) for pattern in expect_missing)]
    return expected, [name for name in only_baseline if name not in expected]


def load_manifest(directory: Path) -> dict[str, Any]:
    try:
        return json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def provenance_notes(baseline: dict[str, Any], candidate: dict[str, Any]) -> list[str]:
    """Warn when the two captures cannot be assumed to share browser and fingerprint seed.

    CloakBrowser perturbs text metrics per --fingerprint seed, so captures from different
    seeds differ by several percent even for an unchanged site.
    """
    seeds = (baseline.get("fingerprint_seed"), candidate.get("fingerprint_seed"))
    notes = []
    if None in seeds:
        notes.append("a manifest.json with fingerprint_seed is missing: if the captures came from launches with different random seeds, expect false differences of several percent")
    elif seeds[0] != seeds[1]:
        notes.append(f"captures used different fingerprint seeds ({seeds[0]} vs {seeds[1]}): differences of several percent are expected noise; recapture with the same seed")
    versions = (baseline.get("browser_version"), candidate.get("browser_version"))
    if versions[0] != versions[1]:
        notes.append(f"browser versions differ ({versions[0]} vs {versions[1]})")
    return notes


def build_report(args: argparse.Namespace) -> dict[str, Any]:
    baseline_files, candidate_files = list_pngs(Path(args.baseline)), list_pngs(Path(args.candidate))
    out_dir = Path(args.out_dir)
    matched = sorted(set(baseline_files) & set(candidate_files), key=sort_key)
    pairs = []
    for name in matched:
        pair = compare_pair(name, baseline_files[name], candidate_files[name], args.tolerance, args.threshold, out_dir / "diff")
        log(f"{name:<44} {pair['result']:<9} {pair.get('percent', '')}")
        pairs.append(pair)
    only_baseline = sorted(set(baseline_files) - set(candidate_files), key=sort_key)
    expected_missing, unexpected_missing = split_missing(only_baseline, args.expect_missing)
    failing = [pair for pair in pairs if pair["result"] in ("DIFF", "SIZE", "ERROR")]
    verdict = "PASS" if pairs and not failing and not unexpected_missing else "FAIL"
    baseline_manifest, candidate_manifest = load_manifest(Path(args.baseline)), load_manifest(Path(args.candidate))
    return {
        "generated_at": utc_now(),
        "provenance": {
            "baseline": {key: baseline_manifest.get(key) for key in ("base_url", "captured_at", "browser_version", "fingerprint_seed")},
            "candidate": {key: candidate_manifest.get(key) for key in ("base_url", "captured_at", "browser_version", "fingerprint_seed")},
            "warnings": provenance_notes(baseline_manifest, candidate_manifest),
        },
        "baseline_dir": str(Path(args.baseline).resolve()),
        "candidate_dir": str(Path(args.candidate).resolve()),
        "tolerance": args.tolerance,
        "threshold_percent": args.threshold,
        "verdict": verdict,
        "pairs": pairs,
        "missing_in_candidate_expected": expected_missing,
        "missing_in_candidate_unexpected": unexpected_missing,
        "only_in_candidate": sorted(set(candidate_files) - set(baseline_files), key=sort_key),
    }


def format_row(pair: dict[str, Any]) -> str:
    if pair["result"] == "ERROR":
        return f"| {pair['name']} | - | - | - | - | ERROR: {pair['error']} | - |"
    baseline_size = "x".join(str(value) for value in pair["baseline_size"])
    candidate_size = "x".join(str(value) for value in pair["candidate_size"])
    result = f"**{pair['result']}**" if pair["result"] in ("DIFF", "SIZE") else pair["result"]
    diff = pair["diff_image"] or "-"
    return f"| {pair['name']} | {baseline_size} | {candidate_size} | {pair['differing_pixels']} | {pair['percent']:.3f} | {result} | {diff} |"


def format_regions(pair: dict[str, Any]) -> list[str]:
    lines = [f"- `{pair['name']}`:"]
    for region in pair["regions"]:
        lines.append(
            f"  - rows {region['y0']}-{region['y1']}, columns {region['x0']}-{region['x1']}: {region['pixels']} differing px"
        )
    return lines


def verdict_line(report: dict[str, Any]) -> str:
    pairs = report["pairs"]
    failing = [pair for pair in pairs if pair["result"] in ("DIFF", "SIZE", "ERROR")]
    worst = max((pair.get("percent", 0.0) for pair in pairs), default=0.0)
    if not pairs:
        return "FAIL - no matching screenshot names in the two directories"
    if report["verdict"] == "PASS":
        return f"PASS - {len(pairs)} matched screenshot(s) within {report['threshold_percent']}% (worst {worst:.3f}%)"
    reasons = []
    if failing:
        reasons.append(f"{len(failing)} of {len(pairs)} matched screenshot(s) differ (worst {worst:.3f}%)")
    if report["missing_in_candidate_unexpected"]:
        reasons.append(f"{len(report['missing_in_candidate_unexpected'])} unexpected missing file(s)")
    return "FAIL - " + "; ".join(reasons)


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# Visual parity report",
        "",
        f"- Baseline: `{report['baseline_dir']}`",
        f"- Candidate: `{report['candidate_dir']}`",
        f"- Equal pixel: every channel within {report['tolerance']}/255; threshold {report['threshold_percent']}% differing pixels",
        f"- Generated: {report['generated_at']}",
        "",
        f"## Verdict: {verdict_line(report)}",
        "",
        *[f"**WARNING:** {note}" for note in report["provenance"]["warnings"]],
        *([""] if report["provenance"]["warnings"] else []),
        f"- Baseline capture: {report['provenance']['baseline']}",
        f"- Candidate capture: {report['provenance']['candidate']}",
        "",
        "## Matched screenshots",
        "",
        "| Image | Baseline | Candidate | Differing px | % | Result | Diff image |",
        "| --- | --- | --- | ---: | ---: | --- | --- |",
        *[format_row(pair) for pair in report["pairs"]],
        "",
    ]
    flagged = [pair for pair in report["pairs"] if pair.get("regions")]
    if flagged:
        lines += ["## Where the differences are (largest bands first)", ""]
        for pair in flagged:
            lines += format_regions(pair)
        lines.append("")
    lines += ["## Missing files", ""]
    sections = [
        ("In baseline only, expected to be missing", report["missing_in_candidate_expected"]),
        ("In baseline only, UNEXPECTED (counts as FAIL)", report["missing_in_candidate_unexpected"]),
        ("In candidate only (informational)", report["only_in_candidate"]),
    ]
    for title, names in sections:
        lines.append(f"- {title}: " + (", ".join(f"`{name}`" for name in names) if names else "none"))
    return "\n".join(lines) + "\n"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Pixel comparison of two screenshot directories.")
    parser.add_argument("--baseline", required=True, help="directory with baseline PNGs")
    parser.add_argument("--candidate", required=True, help="directory with candidate PNGs")
    parser.add_argument("--out-dir", required=True, help="where parity.md, parity.json and diff/ are written")
    parser.add_argument("--tolerance", type=int, default=DEFAULT_TOLERANCE, help="per-channel difference treated as equal (default 8)")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD_PERCENT, help="percent of differing pixels that fails a pair (default 0.1)")
    parser.add_argument(
        "--expect-missing",
        action="append",
        help="glob of baseline files allowed to be absent from the candidate (repeatable; default: portal-*)",
    )
    args = parser.parse_args(argv)
    args.expect_missing = args.expect_missing if args.expect_missing is not None else list(DEFAULT_EXPECT_MISSING)
    return args


def main(argv: list[str] | None = None) -> int:
    try:
        args = parse_args(argv)
        report = build_report(args)
    except QAError as error:
        print(f"compare: {error}", file=sys.stderr)
        return 2
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "parity.md").write_text(render_markdown(report), encoding="utf-8")
    write_json(out_dir / "parity.json", report)
    log(f"verdict: {verdict_line(report)}")
    log(f"report written to {out_dir / 'parity.md'}")
    return 0 if report["verdict"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
