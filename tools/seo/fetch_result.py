"""What fetch_pages found for one URL, and how that is saved and shown: the page, a .meta.json, one output line."""

from __future__ import annotations

from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from http_reply import Headers, RawReply
from seo_common import (
    printable,
    remove_file,
    url_slug,
    write_bytes_file,
    write_json_file,
)


@dataclass(frozen=True)
class RedirectHop:
    status: int
    source: str
    target: str


@dataclass(frozen=True)
class FetchResult:
    """The outcome for one requested URL, after robots.txt and any redirects."""

    requested: str
    final_url: str
    status: Optional[int] = None
    error: str = ""
    skipped: str = ""
    headers: Headers = ()
    redirects: Tuple[RedirectHop, ...] = ()
    body: bytes = b""
    elapsed_ms: int = 0
    truncated: bool = False


@dataclass(frozen=True)
class Journey:
    """Where one request has got to: the address asked for, where it stands now, the hops so far, the time spent."""

    requested: str
    current: str
    hops: Tuple[RedirectHop, ...] = ()
    elapsed_ms: int = 0

    def after(self, reply: RawReply) -> "Journey":
        return replace(self, elapsed_ms=self.elapsed_ms + reply.elapsed_ms)

    def moved_to(self, target: str, status: Optional[int]) -> "Journey":
        return replace(self, current=target, hops=self.hops + (RedirectHop(status or 0, self.current, target),))

    def result(self, reply: Optional[RawReply] = None, error: str = "", skipped: str = "") -> FetchResult:
        """The final result: with a reply when one arrived, without one when the URL was skipped."""
        status = reply.status if reply else (self.hops[-1].status if self.hops else None)
        return FetchResult(
            requested=self.requested,
            final_url=self.current,
            status=status,
            error=error or (reply.error if reply else ""),
            skipped=skipped,
            headers=reply.headers if reply else (),
            redirects=self.hops,
            body=reply.body if reply else b"",
            elapsed_ms=self.elapsed_ms,
            truncated=reply.truncated if reply else False,
        )


def meta_record(result: FetchResult) -> Dict[str, Any]:
    """The .meta.json content: the keys of the research prototype plus skipped and truncated."""
    return {
        "requested": result.requested,
        "final_url": result.final_url,
        "status": result.status,
        "error": result.error or None,
        "skipped": result.skipped or None,
        "headers": dict(result.headers),
        "redirects": [{"status": hop.status, "from": hop.source, "to": hop.target} for hop in result.redirects],
        "bytes": len(result.body),
        "elapsed_ms": result.elapsed_ms,
        "truncated": result.truncated,
    }


def save_result(out_dir: Path, result: FetchResult, stem: Optional[str] = None) -> str:
    """Write the page (when a real answer arrived) and its meta file; returns the file name stem.

    ``stem`` is the name from assign_stems; without it the plain name for the address is used. When nothing
    arrived, a page saved by an earlier run is removed so that it cannot sit beside a record saying it was skipped.
    """
    slug = stem or url_slug(result.requested)
    page = out_dir / f"{slug}.html"
    if result.status is not None and not (result.skipped or result.error):
        write_bytes_file(page, result.body)
    else:
        remove_file(page)
    write_json_file(out_dir / f"{slug}.meta.json", meta_record(result))
    return slug


def result_line(index: int, total: int, result: FetchResult) -> str:
    """One line per URL for the terminal; what servers and redirects said is shown in its safe form."""
    prefix = f"[{index}/{total}]"
    if result.skipped:
        return printable(f"{prefix} skipped ({result.skipped}) {result.requested}")
    if result.error:
        return printable(f"{prefix} ERROR {result.error} {result.requested}")
    hops = ">".join(str(hop.status) for hop in result.redirects) or "-"
    size = f"{len(result.body) / 1024:.1f} KB"
    return printable(f"{prefix} {result.status} hops:{hops} {size} {result.requested} -> {result.final_url}")
