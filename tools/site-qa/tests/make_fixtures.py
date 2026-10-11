#!/usr/bin/env python3
"""Build tiny fixture sites under qa/fixtures/ used to prove the QA tools detect real problems.

bad-site : many deliberate defects (see comments); served with --prefix /numaliving.com.au
bare-404 : same pages but WITHOUT a 404.html (host default / stub 404 page)
"""

from __future__ import annotations

import base64
import shutil
import sys
from pathlib import Path

PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)

HEAD = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'

INDEX = f"""<!doctype html>
<html lang="en"><head>{HEAD}<title>Bad site home</title>
<meta name="robots" content="noindex">
<link rel="icon" href="/icon.png">
<script>console.error("boom from index"); console.warn("careful from index");</script>
<script src="static/missing.js"></script>
</head><body>
<header><nav><a href="/about/">root-absolute about (breaks under a prefix)</a>
<a href="about/">relative about</a> <a href="about">about without slash (redirects)</a>
<a href="gone/">gone page</a> <a href="multi-h1/">multi h1</a> <a href="#nope">dead anchor</a>
<a href="https://example.com/">external (must not be fetched)</a></nav></header>
<main id="main"><h1>Bad site</h1>
<div style="width:600px;height:20px;background:#c00">wider than a phone</div>
<img src="img/missing.png" alt="broken above the fold">
<img src="img/ok.png">
<img src="img/ok.png" alt="">
<button></button>
<button aria-label="named button">x</button>
<a href="about/"><img src="img/ok.png" alt=""></a>
<a href="about/"><svg aria-hidden="true" width="10" height="10"></svg></a>
<img src="http://localhost:4301/icon.png" alt="local second host (counts as third-party)">
<div style="height:3000px"></div>
<img loading="lazy" src="img/missing-lazy.png" alt="broken far below the fold">
<img loading="lazy" src="img/ok.png" alt="fine lazy image">
</main><footer>footer</footer></body></html>
"""

ABOUT = "<!doctype html><html><head><meta charset=\"utf-8\"></head><body><p>No title, no h1, no lang, no landmarks.</p></body></html>\n"

MULTI_H1 = f"""<!doctype html><html lang="en"><head>{HEAD}<title>Multi h1</title><meta name="robots" content="noindex"></head>
<body><header>h</header><main><h1>One</h1><h1>Two</h1><script>throw new Error("uncaught on multi-h1");</script></main><footer>f</footer></body></html>
"""

NOT_FOUND = f"""<!doctype html><html lang="en"><head>{HEAD}<title>Not found | Bad site</title></head>
<body><header><a href="/numaliving.com.au/">Home</a></header><main><h1>404 Page Not Found</h1></main><footer>f</footer></body></html>
"""


def write(root: Path, relative: str, content: str | bytes) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(content, bytes):
        path.write_bytes(content)
    else:
        path.write_text(content, encoding="utf-8")


def build(target: Path) -> None:
    bad = target / "bad-site"
    shutil.rmtree(target, ignore_errors=True)
    write(bad, "index.html", INDEX)
    write(bad, "about/index.html", ABOUT)
    write(bad, "multi-h1/index.html", MULTI_H1)
    write(bad, "img/ok.png", PNG_1X1)
    write(bad, "404.html", NOT_FOUND)
    shutil.copytree(bad, target / "bare-404")
    (target / "bare-404" / "404.html").unlink()


if __name__ == "__main__":
    destination = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "fixtures"
    build(destination)
    print(f"fixtures written to {destination}")
