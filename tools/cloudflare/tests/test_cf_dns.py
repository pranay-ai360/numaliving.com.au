"""Unit tests for the Cloudflare DNS helper. They never use the network or the real keys file.

Run from the tools/cloudflare directory:  python3 -m unittest discover -s tests -v
"""

from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

HELPER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HELPER_DIR))

import cf_dns  # noqa: E402

SECRET = "SECRET-VALUE-that-must-never-be-printed-0123456789"
OTHER_SECRET = "OTHER-SECRET-VALUE-that-must-never-be-printed-9876543210"
ZONE_ID = "z" * 32
ACCOUNT_ID = "a" * 32
EMAIL = "owner@example.com"
ZONE_PATH = f"/zones/{ZONE_ID}"
RECORDS_PATH = f"{ZONE_PATH}/dns_records"


def keys(**extra: str) -> dict[str, str]:
    return {"zone-id": ZONE_ID, "account-id": ACCOUNT_ID, **extra}


def creds(**overrides: str) -> dict[str, str]:
    return {"token": SECRET, "email": "", "zone_id": ZONE_ID, "account_id": ACCOUNT_ID, "via": "test", **overrides}


def record(rtype: str, name: str, content: str, proxied: bool = False, record_id: str = "rec") -> dict:
    return {"id": record_id, "type": rtype, "name": name, "content": content, "proxied": proxied}


def wanted_records() -> list[dict]:
    return [record(*desired, record_id=f"w{index}") for index, desired in enumerate(cf_dns.DESIRED_RECORDS)]


def http_error(status: int, payload: dict) -> urllib.error.HTTPError:
    body = io.BytesIO(json.dumps(payload).encode())
    return urllib.error.HTTPError("https://api.example", status, "error", {}, body)


def fake_response(status: int, payload: dict) -> mock.MagicMock:
    response = mock.MagicMock()
    response.status = status
    response.read.return_value = json.dumps(payload).encode()
    response.__enter__.return_value = response
    return response


@contextlib.contextmanager
def keys_file(text: str):
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "api-keys.json"
        path.write_text(text, encoding="utf-8")
        yield path


def printed(function, *args) -> str:
    buffer = io.StringIO()
    with contextlib.redirect_stdout(buffer):
        function(*args)
    return buffer.getvalue()


class KeyKindTests(unittest.TestCase):
    def test_names_the_documented_prefixes(self):
        self.assertEqual(cf_dns.key_kind("cfk_abc"), "Global API Key")
        self.assertEqual(cf_dns.key_kind("cfut_abc"), "user API token")
        self.assertEqual(cf_dns.key_kind("cfat_abc"), "account API token")

    def test_recognises_the_legacy_shapes(self):
        self.assertEqual(cf_dns.key_kind("A" * 40), "legacy API token")
        self.assertEqual(cf_dns.key_kind("0" * 37), "legacy Global API Key")

    def test_calls_anything_else_unrecognised(self):
        self.assertEqual(cf_dns.key_kind("not a key"), "unrecognised format")


class CredentialsTests(unittest.TestCase):
    def test_prefers_the_zone_token_over_a_global_key_with_an_email(self):
        data = keys(**{"zone-api-key": "tok", "cloudflare-global-api-key": "glob", "cloudflare-email": EMAIL})

        result = cf_dns.credentials_from(data)

        self.assertEqual((result["token"], result["email"]), ("tok", ""))

    def test_uses_the_global_key_with_the_email_when_there_is_no_zone_token(self):
        result = cf_dns.credentials_from(keys(**{"cloudflare-global-api-key": "glob", "cloudflare-email": EMAIL}))

        self.assertEqual((result["token"], result["email"]), ("glob", EMAIL))

    def test_accepts_the_misspelled_key_name_of_older_files(self):
        result = cf_dns.credentials_from(keys(**{"cloudlfare-global-api-key": "glob", "cloudflare-email": EMAIL}))

        self.assertEqual(result["token"], "glob")

    def test_rejects_a_global_key_without_an_email(self):
        with self.assertRaises(cf_dns.CloudflareError):
            cf_dns.credentials_from(keys(**{"cloudflare-global-api-key": "glob"}))

    def test_rejects_a_missing_zone_id(self):
        with self.assertRaisesRegex(cf_dns.CloudflareError, "zone-id"):
            cf_dns.credentials_from({"account-id": ACCOUNT_ID, "zone-api-key": "tok"})

    def test_strips_whitespace_around_values(self):
        self.assertEqual(cf_dns.credentials_from(keys(**{"zone-api-key": "  tok \n"}))["token"], "tok")


class AuthHeadersTests(unittest.TestCase):
    def test_sends_a_scoped_token_as_a_bearer_token(self):
        self.assertEqual(cf_dns.auth_headers(creds()), {"Authorization": f"Bearer {SECRET}"})

    def test_sends_a_global_key_with_the_account_email(self):
        headers = cf_dns.auth_headers(creds(email=EMAIL))

        self.assertEqual(headers, {"X-Auth-Email": EMAIL, "X-Auth-Key": SECRET})


class KeysFileTests(unittest.TestCase):
    def test_reads_a_valid_file(self):
        with keys_file('{"zone-id": "abc"}') as path:
            self.assertEqual(cf_dns.read_keys_file(path), {"zone-id": "abc"})

    def test_reports_a_missing_file_and_says_where_the_example_is(self):
        with self.assertRaisesRegex(cf_dns.CloudflareError, "api-keys.example.json"):
            cf_dns.read_keys_file(Path("/nonexistent/api-keys.json"))

    def test_invalid_json_never_echoes_the_contents(self):
        with keys_file('{"zone-api-key": "' + SECRET + '"  oops') as path:
            with self.assertRaises(cf_dns.CloudflareError) as caught:
                cf_dns.read_keys_file(path)

        self.assertNotIn(SECRET, str(caught.exception))

    def test_rejects_a_file_that_is_not_an_object(self):
        with keys_file("[]") as path:
            with self.assertRaisesRegex(cf_dns.CloudflareError, "JSON object"):
                cf_dns.read_keys_file(path)

    def test_default_path_follows_the_environment_override(self):
        with mock.patch.dict("os.environ", {cf_dns.KEYS_FILE_ENV: "/elsewhere/keys.json"}):
            self.assertEqual(cf_dns.default_keys_file(), Path("/elsewhere/keys.json"))

    def test_default_path_is_the_file_in_the_repository_root(self):
        with mock.patch.dict("os.environ", clear=True):
            self.assertEqual(cf_dns.default_keys_file(), cf_dns.REPO_ROOT / "api-keys.json")


class DescribeKeysFileTests(unittest.TestCase):
    def test_prints_shapes_but_never_values(self):
        data = keys(**{"zone-api-key": SECRET, "cloudflare-global-api-key": OTHER_SECRET, "cloudflare-email": EMAIL})

        output = printed(cf_dns.describe_keys_file, data)

        for secret in (SECRET, OTHER_SECRET, EMAIL, ZONE_ID, ACCOUNT_ID):
            self.assertNotIn(secret, output)
        self.assertIn("zone-api-key: filled in", output)
        self.assertIn("characters, format:", output)

    def test_flags_an_empty_value(self):
        self.assertIn("zone-api-key: EMPTY", printed(cf_dns.describe_keys_file, keys(**{"zone-api-key": ""})))


class BuildPlanTests(unittest.TestCase):
    def test_an_empty_zone_needs_every_record_created(self):
        plan = cf_dns.build_plan([])

        self.assertEqual(plan["create"], list(cf_dns.DESIRED_RECORDS))
        self.assertEqual((plan["delete"], plan["unproxy"]), ([], []))

    def test_a_zone_that_already_matches_needs_nothing(self):
        plan = cf_dns.build_plan(wanted_records())

        self.assertEqual(plan, {"create": [], "delete": [], "unproxy": []})

    def test_registrar_parking_records_on_the_bare_domain_and_www_are_deleted(self):
        parking_a = record("A", cf_dns.DOMAIN, "3.33.130.190", record_id="p1")
        www_to_apex = record("CNAME", cf_dns.WWW_HOST, cf_dns.DOMAIN, record_id="p2")

        plan = cf_dns.build_plan([parking_a, www_to_apex])

        self.assertEqual(plan["delete"], [parking_a, www_to_apex])
        self.assertEqual(len(plan["create"]), len(cf_dns.DESIRED_RECORDS))

    def test_mail_records_and_other_names_are_left_alone(self):
        others = [
            record("MX", cf_dns.DOMAIN, "mx1.forwardemail.net"),
            record("TXT", cf_dns.DOMAIN, "v=spf1 include:spf.forwardemail.net ~all"),
            record("CNAME", f"fe-bounces.{cf_dns.DOMAIN}", "forwardemail.net"),
            record("A", f"mail.{cf_dns.DOMAIN}", "203.0.113.7"),
        ]

        plan = cf_dns.build_plan([*wanted_records(), *others])

        self.assertEqual(plan, {"create": [], "delete": [], "unproxy": []})

    def test_a_proxied_record_is_switched_to_dns_only(self):
        proxied = record("A", cf_dns.DOMAIN, cf_dns.GITHUB_IPV4[0], proxied=True, record_id="px")
        rest = [r for r in wanted_records() if r["content"] != cf_dns.GITHUB_IPV4[0]]

        plan = cf_dns.build_plan([proxied, *rest])

        self.assertEqual(plan["unproxy"], [proxied])
        self.assertEqual(plan["create"], [])


class CallTests(unittest.TestCase):
    def test_returns_the_status_and_json_and_sends_the_bearer_header(self):
        with mock.patch("urllib.request.urlopen", return_value=fake_response(200, {"success": True})) as urlopen:
            status, payload = cf_dns.call("GET", "/x", creds())

        sent = {name.lower(): value for name, value in urlopen.call_args[0][0].header_items()}
        self.assertEqual((status, payload), (200, {"success": True}))
        self.assertEqual(sent["authorization"], f"Bearer {SECRET}")

    def test_an_http_error_is_returned_with_its_json_body(self):
        failure = http_error(401, {"errors": [{"code": 1000, "message": "Invalid API Token"}]})
        with mock.patch("urllib.request.urlopen", side_effect=failure):
            status, payload = cf_dns.call("GET", "/x", creds())

        self.assertEqual(status, 401)
        self.assertEqual(cf_dns.error_text(payload), "1000: Invalid API Token")

    def test_a_network_failure_becomes_an_error_without_the_credentials(self):
        with mock.patch("urllib.request.urlopen", side_effect=urllib.error.URLError("no route")):
            with self.assertRaises(cf_dns.CloudflareError) as caught:
                cf_dns.call("GET", "/x", creds())

        self.assertIn("no route", str(caught.exception))
        self.assertNotIn(SECRET, str(caught.exception))


class VerifyAndZoneTests(unittest.TestCase):
    def test_a_rejected_token_stops_with_an_error_that_never_shows_it(self):
        rejection = (401, {"errors": [{"code": 1000, "message": "Invalid API Token"}]})
        with mock.patch.object(cf_dns, "call", return_value=rejection):
            with contextlib.redirect_stdout(io.StringIO()) as buffer:
                with self.assertRaises(cf_dns.CloudflareError) as caught:
                    cf_dns.verify_credentials(creds())

        self.assertNotIn(SECRET, buffer.getvalue() + str(caught.exception))

    def test_a_zone_of_another_domain_is_refused(self):
        other = (200, {"success": True, "result": {"name": "other.example"}})
        with mock.patch.object(cf_dns, "call", return_value=other):
            with self.assertRaisesRegex(cf_dns.CloudflareError, "refusing"):
                cf_dns.fetch_zone(creds())

    def test_a_credential_that_cannot_read_the_zone_gets_none_not_a_crash(self):
        forbidden = (403, {"errors": [{"code": 9109, "message": "Unauthorized"}]})
        with mock.patch.object(cf_dns, "call", return_value=forbidden):
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertIsNone(cf_dns.fetch_zone(creds()))


class FakeZone:
    """A tiny in-memory Cloudflare zone that answers the calls `apply` makes."""

    def __init__(self, records: list[dict]):
        self.records = list(records)
        self.writes: list[tuple[str, str, object]] = []

    def __call__(self, method, path, _creds, body=None):
        if method == "GET" and path == ZONE_PATH:
            return 200, {"success": True, "result": {"name": cf_dns.DOMAIN}}
        if method == "GET" and path.startswith(RECORDS_PATH):
            return 200, {"success": True, "result": list(self.records), "result_info": {"total_pages": 1}}
        self.writes.append((method, path, body))
        return 200, {"success": True, "result": {}}


class ApplyTests(unittest.TestCase):
    def run_apply(self, zone: FakeZone) -> int:
        with keys_file(json.dumps(keys(**{"zone-api-key": SECRET}))) as path:
            with mock.patch.object(cf_dns, "call", zone), contextlib.redirect_stdout(io.StringIO()):
                return cf_dns.main(["--keys-file", str(path), "apply", "--yes"])

    def test_deletes_only_the_conflicts_then_creates_every_wanted_record_dns_only(self):
        parking = record("A", cf_dns.DOMAIN, "3.33.130.190", record_id="p1")
        mail = record("MX", cf_dns.DOMAIN, "mx1.forwardemail.net", record_id="m1")
        zone = FakeZone([parking, mail])

        exit_code = self.run_apply(zone)

        deletes = [path for method, path, _ in zone.writes if method == "DELETE"]
        creates = [body for method, _, body in zone.writes if method == "POST"]
        self.assertEqual(exit_code, 0)
        self.assertEqual(deletes, [f"{RECORDS_PATH}/p1"])
        self.assertEqual(len(creates), len(cf_dns.DESIRED_RECORDS))
        self.assertTrue(all(body["proxied"] is False and body["ttl"] == cf_dns.AUTO_TTL for body in creates))

    def test_changes_nothing_when_the_zone_already_matches(self):
        zone = FakeZone(wanted_records())

        self.assertEqual(self.run_apply(zone), 0)
        self.assertEqual(zone.writes, [])


class MainTests(unittest.TestCase):
    def test_apply_without_yes_does_not_touch_the_api(self):
        with mock.patch.object(cf_dns, "call", side_effect=AssertionError("must not be called")):
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(cf_dns.main(["apply"]), cf_dns.EXIT_USAGE)

    def test_check_reports_a_missing_keys_file_as_a_failure(self):
        with contextlib.redirect_stdout(io.StringIO()) as buffer:
            exit_code = cf_dns.main(["--keys-file", "/nonexistent/api-keys.json", "check"])

        self.assertEqual(exit_code, cf_dns.EXIT_FAILURE)
        self.assertIn("ERROR:", buffer.getvalue())


if __name__ == "__main__":
    unittest.main()
