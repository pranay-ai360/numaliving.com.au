#!/usr/bin/env python3
"""Cloudflare DNS helper for numaliving.us: the records GitHub Pages needs.

Reads a scoped Cloudflare API token from api-keys.json (git-ignored) and never prints it.

  check                       read-only: validate the credentials and the zone, list the records, show the plan
  apply --yes                 carry out that plan on the live zone
  github-challenge CODE --yes add the TXT record GitHub asks for when the domain is verified in the GitHub
                              profile settings (adds that one record, deletes and replaces nothing)

Only the A, AAAA and CNAME records on the bare domain and on www are managed: any other A, AAAA or
CNAME record on those two names is deleted. Everything else in the zone (mail records, verification
TXT records, other names) is left alone; the one exception, github-challenge, only ever adds its
single TXT record. Standard library only.
"""
from __future__ import annotations

import argparse
import http.client
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
USER_KEYS_FILE = Path.home() / ".config" / "numaliving" / "api-keys.json"
API_BASE = "https://api.cloudflare.com/client/v4"
DOMAIN = "numaliving.us"
WWW_HOST = f"www.{DOMAIN}"
GITHUB_USER = "pranay-ai360"
PAGES_HOST = f"{GITHUB_USER}.github.io"
TOKEN_KEY_NAMES = ("zone-api-key", "zone-api-token")
KNOWN_KEY_NAMES = (*TOKEN_KEY_NAMES, "zone-id", "account-id")
TOKEN_PATTERN = re.compile(r"[A-Za-z0-9_-]+")
ID_PATTERN = re.compile(r"[0-9a-f]{32}")
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
RECORD_COMMENT = f"GitHub Pages ({GITHUB_USER}/numaliving.com.au)"
CHALLENGE_NAME = f"_github-pages-challenge-{GITHUB_USER}.{DOMAIN}"
CHALLENGE_CODE_PATTERN = re.compile(r"[0-9a-f]{20,64}")
CHALLENGE_CODE_RULE = "the code must be 20 to 64 lowercase hex characters, exactly as GitHub shows it."
CHALLENGE_COMMENT = f"GitHub Pages domain verification ({GITHUB_USER})"
CHANGING_COMMANDS = ("apply", "github-challenge")

GITHUB_IPV4 = ("185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153")
GITHUB_IPV6 = ("2606:50c0:8000::153", "2606:50c0:8001::153", "2606:50c0:8002::153", "2606:50c0:8003::153")
DESIRED_RECORDS = (
    *(("A", DOMAIN, ip) for ip in GITHUB_IPV4),
    *(("AAAA", DOMAIN, ip) for ip in GITHUB_IPV6),
    ("CNAME", WWW_HOST, PAGES_HOST),
)
ADDRESS_TYPES = ("A", "AAAA")
MANAGED_TYPES = (*ADDRESS_TYPES, "CNAME")
MANAGED_NAMES = (DOMAIN, WWW_HOST)

Credentials = Mapping[str, str]
Record = Mapping[str, Any]


class CloudflareError(Exception):
    """A failed step. Its message never contains the credentials."""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Never follow a redirect: it would forward the Authorization header to wherever it points."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D102
        return None


OPENER = urllib.request.build_opener(_NoRedirect)


def default_keys_file() -> Path:
    """$NUMA_KEYS_FILE, else a copy in the repository root when there is one, else the file in ~/.config."""
    override = os.environ.get(KEYS_FILE_ENV)
    if override:
        return Path(override)
    in_repository = REPO_ROOT / "api-keys.json"
    return in_repository if in_repository.exists() else USER_KEYS_FILE


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
    """The scoped token and the two ids, checked for shape. Errors never include a value."""
    fields = (
        ("zone-api-key", first_value(data, TOKEN_KEY_NAMES), TOKEN_PATTERN),
        ("zone-id", first_value(data, ("zone-id",)), ID_PATTERN),
        ("account-id", first_value(data, ("account-id",)), ID_PATTERN),
    )
    missing = [name for name, value, _ in fields if not value]
    if missing:
        raise CloudflareError("empty or missing in the keys file: " + ", ".join(missing))
    malformed = [name for name, value, pattern in fields if not pattern.fullmatch(value)]
    if malformed:
        raise CloudflareError(
            "not the expected shape, copy the value again with no spaces or line breaks: " + ", ".join(malformed)
        )
    token, zone_id, account_id = (value for _, value, _ in fields)
    return {"token": token, "zone_id": zone_id, "account_id": account_id}


def describe_keys_file(data: Mapping[str, Any]) -> None:
    print("== keys file (values are never printed)")
    for name in KNOWN_KEY_NAMES:
        if name not in data:
            continue
        value = str(data[name]).strip()
        detail = f", format: {key_kind(value)}" if value and name in TOKEN_KEY_NAMES else ""
        print(f"  {name}: {'filled in' if value else 'EMPTY'}, {len(value)} characters{detail}")
    others = [name for name in data if name not in KNOWN_KEY_NAMES]
    if others:
        print(f"  {len(others)} other field(s) ignored by this helper")
    if any("global" in str(name).lower() for name in others):
        print("  note: a Global API Key field is present but unused. Delete it from the file and roll that key")
        print("        in the Cloudflare dashboard (My Profile > API Tokens > Global API Key).")


def auth_headers(creds: Credentials) -> dict[str, str]:
    return {"Authorization": f"Bearer {creds['token']}"}


def call(
    method: str, path: str, creds: Credentials, body: Mapping[str, Any] | None = None
) -> tuple[int, dict[str, Any]]:
    """Return (HTTP status, parsed JSON body). Every other failure raises CloudflareError."""
    headers = {**auth_headers(creds), "Content-Type": "application/json", "User-Agent": USER_AGENT}
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(f"{API_BASE}{path}", data=data, method=method, headers=headers)
    try:
        with OPENER.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        with error:  # releases the response body
            try:
                return error.code, json.load(error)
            except ValueError:
                return error.code, {}
    except urllib.error.URLError as error:
        raise CloudflareError(f"network error: {error.reason}") from None
    except (OSError, http.client.HTTPException, ValueError) as error:
        # Only the type is shown: the message of a bad-header error can contain the token itself.
        raise CloudflareError(f"the request failed ({type(error).__name__})") from None


def error_text(payload: Mapping[str, Any]) -> str:
    errors = payload.get("errors") or []
    return "; ".join(f"{item.get('code')}: {item.get('message')}" for item in errors) or "no error detail"


def require_ok(status: int, payload: Mapping[str, Any], action: str) -> Mapping[str, Any]:
    if status != HTTP_OK or not payload.get("success"):
        raise CloudflareError(f"{action} failed: HTTP {status} ({error_text(payload)})")
    return payload


def verify_credentials(creds: Credentials) -> str:
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
    """Return the zone, or None when the token may not read zone details (no Zone > Zone > Read).

    A zone that is readable but belongs to another domain is refused outright."""
    status, payload = call("GET", f"/zones/{creds['zone_id']}", creds)
    if status == HTTP_FORBIDDEN:
        print(f"  note: the token cannot read zone details ({error_text(payload)})")
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


def belongs_to_domain(records: Sequence[Record]) -> bool:
    """True when there are records and every one of them is named after the domain."""
    return bool(records) and all(r["name"] == DOMAIN or r["name"].endswith(f".{DOMAIN}") for r in records)


def blocks_creation(stale: Record, creates: Sequence[tuple[str, str, str]]) -> bool:
    """A CNAME cannot share a name with another record, so a stale record on a name that gets a new
    CNAME (or a stale CNAME on a name that gets new address records) must be deleted before the create."""
    return any(
        name == stale["name"] and not (rtype in ADDRESS_TYPES and stale["type"] in ADDRESS_TYPES)
        for rtype, name, _ in creates
    )


def build_plan(records: Sequence[Record]) -> dict[str, list[Any]]:
    wanted = set(DESIRED_RECORDS)
    present = {record_key(record) for record in records}
    creates = [record for record in DESIRED_RECORDS if record not in present]
    stale = [
        record for record in records
        if record["type"] in MANAGED_TYPES and record["name"] in MANAGED_NAMES and record_key(record) not in wanted
    ]
    blocking = [record for record in stale if blocks_creation(record, creates)]
    return {
        "create": creates,
        "delete_first": blocking,
        "delete_after": [record for record in stale if record not in blocking],
        "unproxy": [record for record in records if record_key(record) in wanted and record.get("proxied")],
    }


def print_zone(zone: Mapping[str, Any] | None, creds: Credentials) -> None:
    print("== zone")
    if zone is None:
        print("  (zone details not readable with this token)")
        return
    print(f"  name: {zone['name']}   status: {zone.get('status')}   paused: {zone.get('paused')}")
    print(f"  name servers: {', '.join(zone.get('name_servers') or [])}")
    print(f"  account id matches the keys file: {(zone.get('account') or {}).get('id') == creds['account_id']}")


def print_records(records: Sequence[Record]) -> None:
    print(f"== DNS records now ({len(records)})")
    for record in records:
        print(f"  {record['type']:<6}{record['name']:<28} {record['content']}  proxied={record.get('proxied')}")


def print_plan(plan: Mapping[str, Sequence[Any]]) -> None:
    print("== change plan")
    for rtype, name, content in plan["create"]:
        print(f"  create  {rtype:<6}{name:<28} {content}  (DNS only)")
    for record in [*plan["delete_first"], *plan["delete_after"]]:
        print(f"  delete  {record['type']:<6}{record['name']:<28} {record['content']}  (conflicts with GitHub Pages)")
    for record in plan["unproxy"]:
        print(f"  unproxy {record['type']:<6}{record['name']:<28} {record['content']}")
    if not any(plan.values()):
        print("  nothing to do: the records are already as wanted")


def check(keys_file: Path) -> None:
    data = read_keys_file(keys_file)
    describe_keys_file(data)
    creds = credentials_from(data)
    print("== credentials")
    print("  " + verify_credentials(creds))
    print_zone(fetch_zone(creds), creds)
    records = list_records(creds)
    print_records(records)
    print_plan(build_plan(records))


def delete_record(creds: Credentials, record: Record) -> None:
    path = f"/zones/{creds['zone_id']}/dns_records/{record['id']}"
    require_ok(*call("DELETE", path, creds), f"deleting {record['type']} {record['name']}")
    print(f"  deleted   {record['type']:<6}{record['name']:<28} {record['content']}")


def unproxy_record(creds: Credentials, record: Record) -> None:
    path = f"/zones/{creds['zone_id']}/dns_records/{record['id']}"
    action = f"switching proxy off for {record['type']} {record['name']}"
    require_ok(*call("PATCH", path, creds, {"proxied": False}), action)
    print(f"  unproxied {record['type']:<6}{record['name']:<28} {record['content']}")


def create_record(creds: Credentials, rtype: str, name: str, content: str, comment: str = RECORD_COMMENT) -> None:
    body = {
        "type": rtype, "name": name, "content": content,
        "ttl": AUTO_TTL, "proxied": False, "comment": comment,
    }
    require_ok(*call("POST", f"/zones/{creds['zone_id']}/dns_records", creds, body), f"creating {rtype} {name}")
    print(f"  created   {rtype:<6}{name:<28} {content}")


def run_plan(creds: Credentials, plan: Mapping[str, Sequence[Any]]) -> None:
    """Blocking deletes first, then the creates, then the rest of the deletes: the domain keeps answering."""
    for record in plan["delete_first"]:
        delete_record(creds, record)
    for record in plan["unproxy"]:
        unproxy_record(creds, record)
    for rtype, name, content in plan["create"]:
        create_record(creds, rtype, name, content)
    for record in plan["delete_after"]:
        delete_record(creds, record)


def confirm_zone_is_ours(zone: Mapping[str, Any] | None, records: Sequence[Record]) -> None:
    """Refuse to write when nothing shows that the zone-id belongs to numaliving.us."""
    if zone is None and not belongs_to_domain(records):
        raise CloudflareError(
            "cannot confirm that the zone-id belongs to numaliving.us: the token cannot read zone details and the "
            "zone does not hold only numaliving.us records. Give the token Zone > Zone > Read."
        )


def open_zone(keys_file: Path) -> tuple[Credentials, list[Record]]:
    """Read the keys, make sure the zone is numaliving.us's, and return the credentials and every record."""
    creds = credentials_from(read_keys_file(keys_file))
    zone = fetch_zone(creds)
    records = list_records(creds)
    confirm_zone_is_ours(zone, records)
    return creds, records


def apply(keys_file: Path) -> None:
    creds, records = open_zone(keys_file)
    plan = build_plan(records)
    print_plan(plan)
    try:
        run_plan(creds, plan)
    except CloudflareError:
        print("The zone may be partly changed: run `check`, then `apply --yes` again to finish.")
        raise
    print_records(list_records(creds))


def unquoted(content: str) -> str:
    """Cloudflare may hand a TXT value back wrapped in one pair of double quotes."""
    text = content.strip()
    return text[1:-1] if len(text) >= 2 and text.startswith('"') and text.endswith('"') else text


def on_challenge_name(record: Record, rtype: str) -> bool:
    """DNS names and types are case-insensitive, and a name may be written with a trailing dot."""
    return record["type"].upper() == rtype and record["name"].rstrip(".").lower() == CHALLENGE_NAME


def challenge_record_present(records: Sequence[Record], code: str) -> bool:
    """True when GitHub's TXT record is already there, False when it is missing.

    A TXT record with another value, or a CNAME (which cannot sit beside a TXT record), is an error:
    nothing is ever replaced or deleted here, so the owner removes it in the dashboard."""
    if any(on_challenge_name(record, "CNAME") for record in records):
        raise CloudflareError(
            f"{CHALLENGE_NAME} has a CNAME record, which cannot sit beside a TXT record. Delete the CNAME in "
            "the Cloudflare dashboard (DNS > Records), then run this again."
        )
    existing = [record for record in records if on_challenge_name(record, "TXT")]
    if any(unquoted(record["content"]) == code for record in existing):
        return True
    if existing:
        raise CloudflareError(
            f"{CHALLENGE_NAME} already has a different TXT value. Delete that record in the Cloudflare "
            "dashboard (DNS > Records), then run this again."
        )
    return False


def github_challenge(keys_file: Path, code: str) -> None:
    """Add the one TXT record GitHub wants for verifying the domain. Nothing is deleted or replaced."""
    if not CHALLENGE_CODE_PATTERN.fullmatch(code):
        raise CloudflareError(CHALLENGE_CODE_RULE)
    creds, records = open_zone(keys_file)
    if challenge_record_present(records, code):
        print(f"  already in place: TXT {CHALLENGE_NAME}")
    else:
        try:
            create_record(creds, "TXT", CHALLENGE_NAME, code, comment=CHALLENGE_COMMENT)
        except CloudflareError:
            print("The record may or may not exist now: run `check`, then run this again (it is safe to repeat).")
            raise
    print("Next: open github.com/settings/pages and press Verify next to numaliving.us.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter, allow_abbrev=False
    )
    parser.add_argument("--keys-file", type=Path, default=None,
                        help=f"credentials file, given before the command (default: ${KEYS_FILE_ENV}, "
                             "else api-keys.json in the repository root)")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("check", allow_abbrev=False, help="read-only: validate, list the records, show the change plan")
    apply_parser = commands.add_parser("apply", allow_abbrev=False, help="change the zone to match the plan")
    apply_parser.add_argument("--yes", action="store_true", help="confirm that the live zone may be changed")
    challenge_parser = commands.add_parser(
        "github-challenge", allow_abbrev=False,
        help="add the TXT record GitHub asks for to verify the domain (adds one record, deletes nothing)",
    )
    challenge_parser.add_argument("code", help="the TXT value as GitHub shows it: 20 to 64 lowercase hex characters")
    challenge_parser.add_argument("--yes", action="store_true", help="confirm that the live zone may be changed")
    return parser


def run_command(args: argparse.Namespace, keys_file: Path) -> None:
    if args.command == "check":
        check(keys_file)
    elif args.command == "apply":
        apply(keys_file)
    elif args.command == "github-challenge":
        github_challenge(keys_file, args.code)
    else:
        raise CloudflareError(f"unknown command {args.command!r}")


def main(argv: Sequence[str]) -> int:
    args = build_parser().parse_args(argv)
    keys_file = args.keys_file or default_keys_file()
    if args.command == "github-challenge" and not CHALLENGE_CODE_PATTERN.fullmatch(args.code):
        # A rejected value is not echoed: whatever was pasted here is not known to be safe to print.
        print(CHALLENGE_CODE_RULE)
        return EXIT_USAGE
    if args.command in CHANGING_COMMANDS and not args.yes:
        print(f"{args.command} changes the live Cloudflare zone: run `check` first, then add --yes to confirm.")
        return EXIT_USAGE
    try:
        run_command(args, keys_file)
    except CloudflareError as error:
        print(f"ERROR: {error}")
        return EXIT_FAILURE
    except Exception as error:
        # Nothing unexpected may leak: show the type only, because a message could contain a credential.
        print(f"ERROR: unexpected {type(error).__name__}; details are hidden because they could hold credentials")
        return EXIT_FAILURE
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
