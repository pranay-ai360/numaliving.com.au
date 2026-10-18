"""The @type values of the JSON-LD blocks in a page. The blocks come from the web, so nothing in them is trusted."""

from __future__ import annotations

import json
from typing import Any, List, Tuple

JSON_LD_TYPE = "application/ld+json"
MAX_TYPE_CHARS = 100


def json_ld_types(blobs: Tuple[str, ...]) -> Tuple[Tuple[str, ...], int]:
    """The @type values found in the JSON-LD blocks, and how many blocks were not usable JSON.

    Only text values count (a list like [1, null, {"x": 1}] names no type) and each is cut at MAX_TYPE_CHARS.
    A block that is not valid JSON, is nested too deeply, or holds a number with thousands of digits (a plain
    ValueError since Python 3.11) is counted as an error, never raised.
    """
    found: List[str] = []
    errors = 0
    for blob in blobs:
        try:
            pending: List[Any] = [json.loads(blob)]
        except (ValueError, RecursionError):
            errors += 1
            continue
        while pending:  # a loop, not recursion: JSON-LD from the web can be nested very deep
            node = pending.pop()
            if isinstance(node, dict):
                kind = node.get("@type")
                declared = [kind] if isinstance(kind, str) else kind if isinstance(kind, list) else []
                found.extend(item[:MAX_TYPE_CHARS] for item in declared if isinstance(item, str))
                pending.extend(node.values())
            elif isinstance(node, list):
                pending.extend(node)
    return tuple(sorted(set(found))), errors
