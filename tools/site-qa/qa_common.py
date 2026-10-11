"""Shared helpers for the QA tools: CloakBrowser launch, URL handling, page settling.

Imported by site_check.py and capture.py (and unit-tested without a browser).
"""

from __future__ import annotations

import contextlib
import json
import re
import signal
import sys
import threading
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import urljoin, urlsplit

DEFAULT_PORTS = {"http": 80, "https": 443}
FONT_TIMEOUT_MS = 5_000
IMAGE_TIMEOUT_MS = 15_000
SCROLL_STEP_DELAY_MS = 100
SCROLL_MAX_STEPS = 400
SCROLL_MAX_TOTAL_MS = 30_000
SETTLE_MS = 400
SIGTERM_EXIT_CODE = 143
# CloakBrowser picks a random --fingerprint seed per launch and the seed perturbs text metrics,
# which shifts layout by 1-2px between launches. Every QA run pins the same seed so that
# screenshots (and measurements) taken in different runs are comparable.
FINGERPRINT_SEED = 41337

# Finish animations/transitions instantly (not "none": elements that rely on a
# `forwards` fill must still reach their end state), keep the caret out of shots.
FREEZE_CSS = """
*, *::before, *::after {
  animation-duration: 0.001s !important;
  animation-delay: 0s !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001s !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
  caret-color: transparent !important;
}
"""

# Constructable stylesheet: adds no DOM node (no React hydration noise) and is not
# blocked by a strict style-src CSP.
JS_FREEZE = """
(css) => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}
"""

JS_WAIT_FONTS = """
async ({ timeoutMs }) => {
  if (!document.fonts || !document.fonts.ready) return true;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs));
  return Promise.race([document.fonts.ready.then(() => true), timeout]);
}
"""

JS_SCROLL_THROUGH = """
async ({ stepDelayMs, maxSteps, maxMs }) => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pageHeight = () => Math.max(
    document.documentElement.scrollHeight,
    document.body ? document.body.scrollHeight : 0,
  );
  const jump = (top) => window.scrollTo({ top, left: 0, behavior: 'instant' });
  const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
  const deadline = Date.now() + maxMs;
  let y = 0;
  let steps = 0;
  while (steps < maxSteps && Date.now() < deadline && y + window.innerHeight < pageHeight()) {
    y += step;
    steps += 1;
    jump(y);
    await sleep(stepDelayMs);
  }
  jump(pageHeight());
  await sleep(stepDelayMs * 2);
  jump(0);
  await sleep(stepDelayMs);
  return { height: pageHeight(), steps };
}
"""

# Resolves to the URLs of rendered <img> elements that are still not `complete`.
JS_WAIT_IMAGES = """
async ({ timeoutMs }) => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const rendered = () => Array.from(document.images).filter((img) => img.getClientRects().length > 0);
  const pending = () => rendered().filter((img) => !img.complete);
  const deadline = Date.now() + timeoutMs;
  while (pending().length > 0 && Date.now() < deadline) await sleep(100);
  const decodes = rendered()
    .filter((img) => img.complete && img.naturalWidth > 0)
    .map((img) => img.decode().catch(() => undefined));
  await Promise.race([Promise.all(decodes), sleep(Math.max(0, deadline - Date.now()))]);
  return pending().map((img) => img.currentSrc || img.src);
}
"""


class QAError(Exception):
    """A user-facing failure; the CLIs print it without a traceback."""


@dataclass(frozen=True)
class BaseUrl:
    """A normalised site base URL such as http://127.0.0.1:4302/numaliving.com.au/."""

    url: str
    scheme: str
    hostname: str
    netloc: str
    path: str  # "/" or "/numaliving.com.au/"

    @property
    def origin(self) -> str:
        return f"{self.scheme}://{self.netloc}"

    def same_origin(self, url: str) -> bool:
        parts = urlsplit(url)
        return parts.scheme == self.scheme and normalize_netloc(parts.scheme, parts.netloc) == self.netloc

    def contains(self, url: str) -> bool:
        """True when ``url`` is same-origin and under the base path."""
        return self.same_origin(url) and urlsplit(url).path.startswith(self.path)

    def resolve(self, route: str) -> str:
        """Absolute URL for a route; routes are relative to the base path (leading '/' ignored)."""
        if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", route):
            return route
        return urljoin(self.url, route.lstrip("/"))

    def route_of(self, url: str) -> str:
        """Path of ``url`` relative to the base path, always starting with '/'."""
        path = urlsplit(url).path or "/"
        if self.same_origin(url) and path.startswith(self.path):
            path = "/" + path[len(self.path):]
        return path


def normalize_netloc(scheme: str, netloc: str) -> str:
    """Lower-case the host and drop an explicit default port."""
    host, separator, port = netloc.lower().rpartition(":")
    if separator and port.isdigit() and int(port) == DEFAULT_PORTS.get(scheme):
        return host
    return netloc.lower()


def parse_base_url(raw: str) -> BaseUrl:
    parts = urlsplit(raw.strip())
    if parts.scheme not in DEFAULT_PORTS or not parts.netloc:
        raise QAError(f"--base-url must be an absolute http(s) URL, got {raw!r}")
    path = parts.path or "/"
    if not path.endswith("/"):
        path += "/"
    netloc = normalize_netloc(parts.scheme, parts.netloc)
    return BaseUrl(
        url=f"{parts.scheme}://{netloc}{path}",
        scheme=parts.scheme,
        hostname=(parts.hostname or "").lower(),
        netloc=netloc,
        path=path,
    )


def route_slug(route: str) -> str:
    """File-name slug for a route: '/' -> 'home', '/projects/golf-links/' -> 'projects-golf-links'."""
    path = urlsplit(route).path
    slug = re.sub(r"[^A-Za-z0-9]+", "-", path).strip("-").lower()
    return slug or "home"


def parse_viewport_widths(text: str) -> list[int]:
    try:
        widths = [int(part) for part in text.split(",") if part.strip()]
    except ValueError as error:
        raise QAError(f"--viewports must be comma-separated widths, got {text!r}") from error
    if not widths or any(width < 200 or width > 4000 for width in widths):
        raise QAError(f"--viewports widths must be between 200 and 4000, got {text!r}")
    return list(dict.fromkeys(widths))


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def log(message: str) -> None:
    print(f"[qa] {message}", file=sys.stderr, flush=True)


def _exit_on_sigterm() -> None:
    """Turn SIGTERM into SystemExit so `finally` blocks close the browser."""
    if threading.current_thread() is threading.main_thread():
        signal.signal(signal.SIGTERM, lambda _signum, _frame: sys.exit(SIGTERM_EXIT_CODE))


@contextlib.contextmanager
def open_browser(headless: bool = True, fingerprint_seed: int = FINGERPRINT_SEED) -> Iterator[Any]:
    """Launch exactly one CloakBrowser (free tier = one concurrent session); always close it."""
    try:
        from cloakbrowser import launch
    except ImportError as error:
        raise QAError(f"cannot import cloakbrowser with {sys.executable}: {error}") from error
    _exit_on_sigterm()
    try:
        browser = launch(headless=headless, args=[f"--fingerprint={fingerprint_seed}"])
    except Exception as error:  # Playwright/licence errors have no common base class
        raise QAError(
            "CloakBrowser failed to launch (the free tier allows ONE concurrent browser; "
            f"is another session running?): {error}"
        ) from error
    log(f"CloakBrowser {browser.version} launched (headless={headless}, fingerprint seed {fingerprint_seed})")
    try:
        yield browser
    finally:
        try:
            browser.close()
        except Exception as error:
            log(f"warning: browser.close() failed: {error}")


def new_context(browser: Any, width: int, height: int) -> Any:
    """Context with deterministic rendering settings (DPR 1, reduced motion, light scheme)."""
    return browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=1,
        reduced_motion="reduce",
        color_scheme="light",
    )


def prepare_page(page: Any, settle_ms: int = SETTLE_MS) -> dict[str, Any]:
    """Freeze animations, wait for fonts, scroll through the page, wait for images, settle.

    Returns ``{"fonts_ready", "page_height", "pending_images"}``; pending images are
    rendered <img> elements that never became ``complete`` within the timeout.
    """
    page.evaluate(JS_FREEZE, FREEZE_CSS)
    fonts_ready = page.evaluate(JS_WAIT_FONTS, {"timeoutMs": FONT_TIMEOUT_MS})
    scroll = page.evaluate(
        JS_SCROLL_THROUGH,
        {"stepDelayMs": SCROLL_STEP_DELAY_MS, "maxSteps": SCROLL_MAX_STEPS, "maxMs": SCROLL_MAX_TOTAL_MS},
    )
    pending = page.evaluate(JS_WAIT_IMAGES, {"timeoutMs": IMAGE_TIMEOUT_MS})
    page.wait_for_timeout(settle_ms)
    return {"fonts_ready": bool(fonts_ready), "page_height": scroll["height"], "pending_images": pending}
