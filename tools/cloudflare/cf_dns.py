#!/usr/bin/env python3
"""Cloudflare DNS helper for numaliving.us: the records GitHub Pages needs.

Reads Cloudflare credentials from api-keys.json (git-ignored, at the repository root) and never
prints them.

  check        read-only: validate the credentials and the zone, list the records, show the change plan
  apply --yes  carry out that plan: delete conflicting records, switch proxying off, create missing ones

Only the A, AAAA and CNAME records on the bare domain and on www are managed. Everything else in the
zone (mail records, verification TXT records, other names) is left alone. Standard library only.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Mapping, Sequence

REPO_ROOT = Path(__file__).resolve().parents[2]
KEYS_FILE_ENV = "NUMA_KEYS_FILE"
API_BASE = "https://api.cloudflare.com/client/v4"
DOMAIN = "numaliving.us"
WWW_HOST = f"www.{DOMAIN}"
PAGES_HOST = "pranay-ai360.github.io"
ZONE_TOKEN_KEY_NAMES = ("zone-api-key", "zone-api-token")
# Older copies of the keys file spell it "cloudlfare"; the correct spelling is accepted as well.
GLOBAL_KEY_NAMES = (
    "cloudflare-global-api-key",
    "cloudlfare-global-api-key",
    "cloudflare-api-key",
    "cloudlfare-api-key",
)
EMAIL_KEY_NAMES = ("cloudflare-email", "cloudlfare-email", "email")
SECRET_KEY_NAMES = (*ZONE_TOKEN_KEY_NAMES, *GLOBAL_KEY_NAMES)
KEY_PREFIXES = (("cfk_", "Global API Key"), ("cfut_", "user API token"), ("cfat_", "account API token"))
LEGACY_KEY_SHAPES = (
    (re.compile(r"[A-Za-z0-9_-]{40}"), "legacy API token"),
    (re.compile(r"[0-9a-f]{37}"), "legacy Global API Key"),
)
HTTP_OK = 200
HTTP_FORBIDDEN = 403
EXIT_FAILURE = 1
EXIT_USAGE = 2
REQUEST_TIMEOUT_SECONDS = 30
USER_AGENT = "numaliving-dns-helper/1.0"
AUTO_TTL = 1
RECORD_COMMENT = "GitHub Pages (pranay-ai360/numaliving.com.au)"

GITHUB_IPV4 = ("185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153")
GITHUB_IPV6 = ("2606:50c0:8000::153", "2606:50c0:8001::153", "2606:50c0:8002::153", "2606:50c0:8003::153")
DESIRED_RECORDS = (
    *(("A", DOMAIN, ip) for ip in GITHUB_IPV4),
    *(("AAAA", DOMAIN, ip) for ip in GITHUB_IPV6),
    ("CNAME", WWW_HOST, PAGES_HOST),
)
MANAGED_TYPES = ("A", "AAAA", "CNAME")
MANAGED_NAMES = (DOMAIN, WWW_HOST)

Credentials = Mapping[str, str]
Record = Mapping[str, Any]


class CloudflareError(Exception):
    """A failed step. Its message never contains the credentials."""


def default_keys_file() -> Path:
    override = os.environ.get(KEYS_FILE_ENV)
    return Path(override) if override else REPO_ROOT / "api-keys.json"


def read_keys_file(path: Path) -> dict[str, Any]:
    try:
        with open(path, encoding="utf-8") as handle:
            data = json.load(handle)
    except FileNotFoundError:
        raise CloudflareError(f"{path} does not exist (copy tools/cloudflare/api-keys.example.json to it)") from None
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise CloudflareError("the keys file is not valid JSON (is the editor copy saved?)") from None
    if not isinstance(data, dict):
        raise CloudflareError("the keys file must be a JSON object")
    return data


def first_value(data: Mapping[str, Any], names: Sequence[str]) -> str:
    return next((str(data[name]).strip() for name in names if data.get(name)), "")


def key_kind(value: str) -> str:
    """Classify a key by its documented prefix or shape only; nothing else about it is revealed."""
    for prefix, label in KEY_PREFIXES:
        if value.startswith(prefix):
            return label
    return next((label for shape, label in LEGACY_KEY_SHAPES if shape.fullmatch(value)), "unrecognised format")


def credentials_from(data: Mapping[str, Any]) -> dict[str, str]:
    zone_id = first_value(data, ("zone-id",))
    account_id = first_value(data, ("account-id",))
    missing = [name for name, value in (("zone-id", zone_id), ("account-id", account_id)) if not value]
    if missing:
        raise CloudflareError("empty or missing in the keys file: " + ", ".join(missing))
    base = {"zone_id": zone_id, "account_id": account_id}
    zone_token = first_value(data, ZONE_TOKEN_KEY_NAMES)
    if zone_token:  # a scoped API token is sent as a Bearer token and needs no email
        return {**base, "token": zone_token, "email": "", "via": "zone-api-key (Bearer token)"}
    global_key, email = first_value(data, GLOBAL_KEY_NAMES), first_value(data, EMAIL_KEY_NAMES)
    if global_key and email:
        return {**base, "token": global_key, "email": email, "via": "Global API Key + account email"}
    raise CloudflareError(
        "no usable credential: fill in zone-api-key, or add cloudflare-email next to the Global API Key"
    )


def describe_keys_file(data: Mapping[str, Any]) -> None:
    print("== keys file (values are never printed)")
    print("  top-level keys:", ", ".join(sorted(data)) or "(none)")
    for name in (*SECRET_KEY_NAMES, *EMAIL_KEY_NAMES, "zone-id", "account-id"):
        if name not in data:
            continue
        value = str(data[name]).strip()
        detail = f", format: {key_kind(value)}" if value and name in SECRET_KEY_NAMES else ""
        print(f"  {name}: {'filled in' if value else 'EMPTY'}, {len(value)} characters{detail}")


def auth_headers(creds: Credentials) -> dict[str, str]:
    if creds["email"]:  # a Global API Key travels with the account email
        return {"X-Auth-Email": creds["email"], "X-Auth-Key": creds["token"]}
    return {"Authorization": f"Bearer {creds['token']}"}


def call(
    method: str, path: str, creds: Credentials, body: Mapping[str, Any] | None = None
) -> tuple[int, dict[str, Any]]:
    """Return (HTTP status, parsed JSON body). Network failures raise CloudflareError."""
    headers = {**auth_headers(creds), "Content-Type": "application/json", "User-Agent": USER_AGENT}
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(f"{API_BASE}{path}", data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        with error:  # releases the response body
            try:
                return error.code, json.load(error)
            except ValueError:
                return error.code, {}
    except urllib.error.URLError as error:
        raise CloudflareError(f"network error: {error.reason}") from None


def error_text(payload: Mapping[str, Any]) -> str:
    errors = payload.get("errors") or []
    return "; ".join(f"{item.get('code')}: {item.get('message')}" for item in errors) or "no error detail"


def require_ok(status: int, payload: Mapping[str, Any], action: str) -> Mapping[str, Any]:
    if status != HTTP_OK or not payload.get("success"):
        raise CloudflareError(f"{action} failed: HTTP {status} ({error_text(payload)})")
    return payload


def verify_credentials(creds: Credentials) -> str:
    if creds["email"]:
        return "Global API Key with the account email (proved by the zone request below)"
    attempts = (
        ("user token", "/user/tokens/verify"),
        ("account token", f"/accounts/{creds['account_id']}/tokens/verify"),
    )
    for label, path in attempts:
        status, payload = call("GET", path, creds)
        if status == HTTP_OK and payload.get("success"):
            result = payload.get("result") or {}
            return f"{label}, status={result.get('status')}, expires={result.get('expires_on') or 'never'}"
        print(f"  {label} verify: HTTP {status} ({error_text(payload)})")
    raise CloudflareError("Cloudflare does not accept the key as an API token")


def fetch_zone(creds: Credentials) -> Mapping[str, Any] | None:
    """Return the zone, or None when the credentials may not read zone details (no Zone:Read).

    Without the zone name the wrong-zone guard is weaker, but Cloudflare itself rejects a record whose
    name lies outside the zone, and the plan only deletes records named after numaliving.us."""
    status, payload = call("GET", f"/zones/{creds['zone_id']}", creds)
    if status == HTTP_FORBIDDEN:
        print(f"  note: the credentials cannot read zone details ({error_text(payload)})")
        return None
    zone = require_ok(status, payload, "reading the zone")["result"]
    if zone.get("name") != DOMAIN:
        raise CloudflareError(f"zone-id belongs to {zone.get('name')!r}, not {DOMAIN!r}; refusing to continue")
    return zone


def list_records(creds: Credentials) -> list[Record]:
    records: list[Record] = []
    page = 1
    while True:
        path = f"/zones/{creds['zone_id']}/dns_records?per_page=100&page={page}"
        payload = require_ok(*call("GET", path, creds), "listing the DNS records")
        records = [*records, *payload["result"]]
        if page >= (payload.get("result_info") or {}).get("total_pages", 1):
            return records
        page += 1


def record_key(record: Record) -> tuple[str, str, str]:
    return (record["type"], record["name"], record["content"])


def build_plan(records: Sequence[Record]) -> dict[str, list[Any]]:
    wanted = set(DESIRED_RECORDS)
    present = {record_key(record) for record in records}
    return {
        "create": [record for record in DESIRED_RECORDS if record not in present],
        "delete": [
            record for record in records
            if record["type"] in MANAGED_TYPES and record["name"] in MANAGED_NAMES and record_key(record) not in wanted
        ],
        "unproxy": [record for record in records if record_key(record) in wanted and record.get("proxied")],
    }


def print_zone(zone: Mapping[str, Any] | None, creds: Credentials) -> None:
    print("== zone")
    if zone is None:
        print("  (zone details not readable with this credential)")
        return
    print(f"  name: {zone['name']}   status: {zone.get('status')}   paused: {zone.get('paused')}")
    print(f"  name servers: {', '.join(zone.get('name_servers') or [])}")
    print(f"  account id matches the keys file: {(zone.get('account') or {}).get('id') == creds['account_id']}")


def print_records(records: Sequence[Record]) -> None:
    print(f"== DNS records now ({len(records)})")
    for record in records:
        print(f"  {record['type']:<6}{record['name']:<28}{record['content']}  proxied={record.get('proxied')}")


def print_plan(plan: Mapping[str, Sequence[Any]]) -> None:
    print("== change plan")
    for rtype, name, content in plan["create"]:
        print(f"  create  {rtype:<6}{name:<28}{content}  (DNS only)")
    for record in plan["delete"]:
        print(f"  delete  {record['type']:<6}{record['name']:<28}{record['content']}  (conflicts with GitHub Pages)")
    for record in plan["unproxy"]:
        print(f"  unproxy {record['type']:<6}{record['name']:<28}{record['content']}")
    if not any(plan.values()):
        print("  nothing to do: the records are already as wanted")


def check(keys_file: Path) -> None:
    data = read_keys_file(keys_file)
    describe_keys_file(data)
    creds = credentials_from(data)
    print("== credentials")
    print(f"  using: {creds['via']}")
    print("  " + verify_credentials(creds))
    print_zone(fetch_zone(creds), creds)
    records = list_records(creds)
    print_records(records)
    print_plan(build_plan(records))


def apply(keys_file: Path) -> None:
    creds = credentials_from(read_keys_file(keys_file))
    fetch_zone(creds)  # refuses a zone-id that belongs to any other domain, when it can be read
    plan = build_plan(list_records(creds))
    print_plan(plan)
    records_path = f"/zones/{creds['zone_id']}/dns_records"
    for record in plan["delete"]:
        require_ok(*call("DELETE", f"{records_path}/{record['id']}", creds),
                   f"deleting {record['type']} {record['name']}")
        print(f"  deleted   {record['type']:<6}{record['name']:<28}{record['content']}")
    for record in plan["unproxy"]:
        require_ok(*call("PATCH", f"{records_path}/{record['id']}", creds, {"proxied": False}),
                   f"switching proxy off for {record['type']} {record['name']}")
        print(f"  unproxied {record['type']:<6}{record['name']:<28}{record['content']}")
    for rtype, name, content in plan["create"]:
        body = {"type": rtype, "name": name, "content": content, "ttl": AUTO_TTL, "proxied": False,
                "comment": RECORD_COMMENT}
        require_ok(*call("POST", records_path, creds, body), f"creating {rtype} {name}")
        print(f"  created   {rtype:<6}{name:<28}{content}")
    print_records(list_records(creds))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--keys-file", type=Path, default=None,
                        help=f"credentials file (default: ${KEYS_FILE_ENV}, else api-keys.json in the repository root)")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("check", help="read-only: validate, list the records, show the change plan")
    apply_parser = commands.add_parser("apply", help="change the zone to match the plan")
    apply_parser.add_argument("--yes", action="store_true", help="confirm that the zone may be changed")
    return parser


def main(argv: Sequence[str]) -> int:
    args = build_parser().parse_args(argv)
    keys_file = args.keys_file or default_keys_file()
    if args.command == "apply" and not args.yes:
        print("apply changes the live Cloudflare zone: run `check` first, then add --yes to confirm.")
        return EXIT_USAGE
    try:
        (check if args.command == "check" else apply)(keys_file)
    except CloudflareError as error:
        print(f"ERROR: {error}")
        return EXIT_FAILURE
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
