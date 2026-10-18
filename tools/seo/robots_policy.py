"""What a site's robots.txt answer means for this tool: which URLs it may fetch, and how long to pause.

The rules themselves (parsing and matching) are in robots_rules.py. This module reads the HTTP side: a missing file
means no rules, 401 and 403 mean keep out, and a file that cannot be read or trusted means the whole site is skipped
with a reason. Standard library only.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from http_reply import RawReply
from robots_rules import RobotsRules, UnusableRobots, parse_robots, request_target
from seo_common import format_seconds, safe_urlsplit

ROBOTS_PATH = "/robots.txt"
MAX_CRAWL_DELAY_SECONDS = 60.0
KEEP_OUT_STATUSES = (401, 403)
RATE_LIMITED_STATUS = 429


@dataclass(frozen=True)
class RobotsPolicy:
    """What robots.txt allows for one origin. ``blocked`` set means every page there is skipped."""

    rules: Optional[RobotsRules] = None
    crawl_delay: float = 0.0
    blocked: str = ""

    def refusal(self, url: str) -> str:
        """Why this URL must not be fetched, or "" when it may be. robots.txt itself is always fetchable."""
        parts = safe_urlsplit(url)
        if parts is None:
            return "not a valid URL"
        if parts.path == ROBOTS_PATH:
            return ""
        if self.blocked:
            return self.blocked
        if self.rules is not None and not self.rules.allows(request_target(url)):
            return "robots.txt disallows this URL"
        return ""


def parse_policy(body: bytes) -> RobotsPolicy:
    """The policy for a robots.txt that was read successfully."""
    try:
        rules = parse_robots(body)
    except UnusableRobots as error:
        return RobotsPolicy(blocked=str(error))
    if rules.crawl_delay > MAX_CRAWL_DELAY_SECONDS:
        return RobotsPolicy(
            blocked=f"robots.txt asks for a Crawl-delay of {format_seconds(rules.crawl_delay)} s, longer than the "
            f"{format_seconds(MAX_CRAWL_DELAY_SECONDS)} s this tool will wait"
        )
    return RobotsPolicy(rules=rules, crawl_delay=rules.crawl_delay)


def policy_from_reply(reply: RawReply) -> RobotsPolicy:
    if reply.error:
        return RobotsPolicy(blocked=f"robots.txt could not be read ({reply.error})")
    status = reply.status or 0
    if 200 <= status < 300:
        return parse_policy(reply.body)
    if status in KEEP_OUT_STATUSES:
        return RobotsPolicy(blocked=f"robots.txt answered HTTP {status}, which means keep out")
    if 400 <= status < 500 and status != RATE_LIMITED_STATUS:
        return RobotsPolicy()
    return RobotsPolicy(blocked=f"robots.txt answered HTTP {status}, so permission is unknown")
