"""Unit tests for the Cloudflare DNS helper. They never use the network or the real keys file.

Run from the tools/cloudflare directory:  python3 -m unittest discover -s tests -v
"""

from __future__ import annotations

import contextlib
import io
import json
import re
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
ZONE_ID = "1" * 32
ACCOUNT_ID = "2" * 32
ZONE_PATH = f"/zones/{ZONE_ID}"
RECORDS_PATH = f"{ZONE_PATH}/dns_records"
CHALLENGE_CODE = "0123456789abcdef0123456789abcd"  # a made-up code of the shape GitHub shows: 30 lowercase hex characters


def keys(**extra: str) -> dict[str, str]:
    return {"zone-api-key": SECRET, "zone-id": ZONE_ID, "account-id": ACCOUNT_ID, **extra}


def creds() -> dict[str, str]:
    return {"token": SECRET, "zone_id": ZONE_ID, "account_id": ACCOUNT_ID}


def record(rtype: str, name: str, content: str, proxied: bool = False, record_id: str | None = None) -> dict:
    return {"id": record_id or f"{rtype}-{name}-{content}", "type": rtype, "name": name, "content": content,
            "proxied": proxied}


def wanted_records() -> list[dict]:
    return [record(*desired) for desired in cf_dns.DESIRED_RECORDS]


def http_error(status: int, payload: dict) -> urllib.error.HTTPError:
    body = io.BytesIO(json.dumps(payload).encode())
    return urllib.error.HTTPError("https://api.example", status, "error", {}, body)


def fake_response(status: int, body: bytes) -> mock.MagicMock:
    response = mock.MagicMock()
    response.status = status
    response.read.return_value = body
    response.__enter__.return_value = response
    return response


def json_response(status: int, payload: dict) -> mock.MagicMock:
    return fake_response(status, json.dumps(payload).encode())


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


def run_main(*argv: str) -> tuple[int, str]:
    buffer = io.StringIO()
    with contextlib.redirect_stdout(buffer):
        code = cf_dns.main(list(argv))
    return code, buffer.getvalue()


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
    def test_returns_the_token_and_both_ids(self):
        self.assertEqual(cf_dns.credentials_from(keys()), creds())

    def test_strips_whitespace_around_values(self):
        self.assertEqual(cf_dns.credentials_from(keys(**{"zone-api-key": "  tok \n"}))["token"], "tok")

    def test_accepts_the_alternative_token_field_name(self):
        data = {"zone-api-token": "tok", "zone-id": ZONE_ID, "account-id": ACCOUNT_ID}

        self.assertEqual(cf_dns.credentials_from(data)["token"], "tok")

    def test_rejects_a_missing_token(self):
        with self.assertRaisesRegex(cf_dns.CloudflareError, "zone-api-key"):
            cf_dns.credentials_from({"zone-id": ZONE_ID, "account-id": ACCOUNT_ID})

    def test_rejects_a_missing_zone_id(self):
        with self.assertRaisesRegex(cf_dns.CloudflareError, "zone-id"):
            cf_dns.credentials_from({"zone-api-key": "tok", "account-id": ACCOUNT_ID})

    def test_a_global_key_alone_is_not_a_credential(self):
        data = {"cloudflare-global-api-key": OTHER_SECRET, "zone-id": ZONE_ID, "account-id": ACCOUNT_ID}

        with self.assertRaisesRegex(cf_dns.CloudflareError, "zone-api-key"):
            cf_dns.credentials_from(data)

    def test_rejects_a_token_with_spaces_or_line_breaks_without_echoing_it(self):
        for bad in (f"{SECRET} extra", f"{SECRET}\r\nX-Evil: 1"):
            with self.subTest(bad=bad):
                with self.assertRaises(cf_dns.CloudflareError) as caught:
                    cf_dns.credentials_from(keys(**{"zone-api-key": bad}))

                self.assertIn("zone-api-key", str(caught.exception))
                self.assertNotIn(SECRET, str(caught.exception))

    def test_rejects_ids_that_are_not_32_hex_characters(self):
        with self.assertRaisesRegex(cf_dns.CloudflareError, "zone-id, account-id"):
            cf_dns.credentials_from(keys(**{"zone-id": "short", "account-id": "z" * 32}))


class AuthHeadersTests(unittest.TestCase):
    def test_sends_the_scoped_token_as_a_bearer_token(self):
        self.assertEqual(cf_dns.auth_headers(creds()), {"Authorization": f"Bearer {SECRET}"})


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

    def test_default_path_is_the_copy_in_the_repository_root_when_there_is_one(self):
        with tempfile.TemporaryDirectory() as folder, mock.patch.dict("os.environ", clear=True):
            (Path(folder) / "api-keys.json").write_text("{}", encoding="utf-8")
            with mock.patch.object(cf_dns, "REPO_ROOT", Path(folder)):
                self.assertEqual(cf_dns.default_keys_file(), Path(folder) / "api-keys.json")

    def test_default_path_is_the_file_in_the_home_folder_when_the_repository_has_none(self):
        with tempfile.TemporaryDirectory() as folder, mock.patch.dict("os.environ", clear=True):
            with mock.patch.object(cf_dns, "REPO_ROOT", Path(folder)):
                self.assertEqual(cf_dns.default_keys_file(), cf_dns.USER_KEYS_FILE)

    def test_the_home_folder_file_is_under_dot_config_numaliving(self):
        self.assertEqual(cf_dns.USER_KEYS_FILE, Path.home() / ".config" / "numaliving" / "api-keys.json")

    def test_the_environment_override_beats_a_copy_in_the_repository_root(self):
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / "api-keys.json").write_text("{}", encoding="utf-8")
            with mock.patch.object(cf_dns, "REPO_ROOT", Path(folder)):
                with mock.patch.dict("os.environ", {cf_dns.KEYS_FILE_ENV: "/elsewhere/keys.json"}):
                    self.assertEqual(cf_dns.default_keys_file(), Path("/elsewhere/keys.json"))


class DescribeKeysFileTests(unittest.TestCase):
    def test_prints_shapes_but_never_values(self):
        output = printed(cf_dns.describe_keys_file, keys())

        for secret in (SECRET, ZONE_ID, ACCOUNT_ID):
            self.assertNotIn(secret, output)
        self.assertIn("zone-api-key: filled in", output)
        self.assertIn("characters, format:", output)

    def test_flags_an_empty_value(self):
        self.assertIn("zone-api-key: EMPTY", printed(cf_dns.describe_keys_file, keys(**{"zone-api-key": ""})))

    def test_warns_about_an_unused_global_key_without_naming_or_showing_it(self):
        output = printed(cf_dns.describe_keys_file, keys(**{"cloudlfare-global-api-key": OTHER_SECRET}))

        self.assertIn("Global API Key field is present but unused", output)
        self.assertNotIn(OTHER_SECRET, output)
        self.assertNotIn("cloudlfare-global-api-key", output)

    def test_counts_other_fields_without_naming_them(self):
        output = printed(cf_dns.describe_keys_file, keys(**{"mystery-field": OTHER_SECRET}))

        self.assertIn("1 other field(s) ignored", output)
        self.assertNotIn("mystery-field", output)


class BuildPlanTests(unittest.TestCase):
    def test_an_empty_zone_needs_every_record_created(self):
        plan = cf_dns.build_plan([])

        self.assertEqual(plan["create"], list(cf_dns.DESIRED_RECORDS))
        self.assertEqual((plan["delete_first"], plan["delete_after"], plan["unproxy"]), ([], [], []))

    def test_a_zone_that_already_matches_needs_nothing(self):
        plan = cf_dns.build_plan(wanted_records())

        self.assertEqual(plan, {"create": [], "delete_first": [], "delete_after": [], "unproxy": []})

    def test_a_stale_cname_is_deleted_before_the_create_and_a_stale_address_after_it(self):
        parking_a = record("A", cf_dns.DOMAIN, "3.33.130.190")
        www_to_apex = record("CNAME", cf_dns.WWW_HOST, cf_dns.DOMAIN)

        plan = cf_dns.build_plan([parking_a, www_to_apex])

        self.assertEqual(plan["delete_first"], [www_to_apex])
        self.assertEqual(plan["delete_after"], [parking_a])
        self.assertEqual(len(plan["create"]), len(cf_dns.DESIRED_RECORDS))

    def test_a_stale_address_on_www_blocks_the_cname_that_replaces_it(self):
        stale = record("A", cf_dns.WWW_HOST, "203.0.113.9")

        plan = cf_dns.build_plan([stale])

        self.assertEqual(plan["delete_first"], [stale])

    def test_a_stale_cname_on_the_bare_domain_blocks_the_address_records(self):
        stale = record("CNAME", cf_dns.DOMAIN, "somewhere.example")

        plan = cf_dns.build_plan([stale])

        self.assertEqual(plan["delete_first"], [stale])

    def test_mail_records_and_other_names_are_left_alone(self):
        others = [
            record("MX", cf_dns.DOMAIN, "mx1.forwardemail.net"),
            record("TXT", cf_dns.DOMAIN, "v=spf1 include:spf.forwardemail.net ~all"),
            record("CNAME", f"fe-bounces.{cf_dns.DOMAIN}", "forwardemail.net"),
            record("A", f"mail.{cf_dns.DOMAIN}", "203.0.113.7"),
        ]

        plan = cf_dns.build_plan([*wanted_records(), *others])

        self.assertEqual(plan, {"create": [], "delete_first": [], "delete_after": [], "unproxy": []})

    def test_a_proxied_record_is_switched_to_dns_only(self):
        proxied = record("A", cf_dns.DOMAIN, cf_dns.GITHUB_IPV4[0], proxied=True)
        rest = [r for r in wanted_records() if r["content"] != cf_dns.GITHUB_IPV4[0]]

        plan = cf_dns.build_plan([proxied, *rest])

        self.assertEqual(plan["unproxy"], [proxied])
        self.assertEqual(plan["create"], [])


class CallTests(unittest.TestCase):
    def call_with(self, **opener_behaviour):
        with mock.patch.object(cf_dns, "OPENER") as opener:
            opener.open.configure_mock(**opener_behaviour)
            result = cf_dns.call("GET", "/x", creds())
            return result, opener

    def test_returns_the_status_and_json_and_sends_the_bearer_header(self):
        (status, payload), opener = self.call_with(return_value=json_response(200, {"success": True}))

        sent = {name.lower(): value for name, value in opener.open.call_args[0][0].header_items()}
        self.assertEqual((status, payload), (200, {"success": True}))
        self.assertEqual(sent["authorization"], f"Bearer {SECRET}")

    def test_an_http_error_is_returned_with_its_json_body(self):
        failure = http_error(401, {"errors": [{"code": 1000, "message": "Invalid API Token"}]})

        (status, payload), _ = self.call_with(side_effect=failure)

        self.assertEqual(status, 401)
        self.assertEqual(cf_dns.error_text(payload), "1000: Invalid API Token")

    def assert_fails_without_the_secret(self, behaviour, expected_text):
        with self.assertRaises(cf_dns.CloudflareError) as caught:
            self.call_with(**behaviour)

        self.assertIn(expected_text, str(caught.exception))
        self.assertNotIn(SECRET, str(caught.exception))

    def test_a_network_failure_becomes_an_error_without_the_credentials(self):
        self.assert_fails_without_the_secret({"side_effect": urllib.error.URLError("no route")}, "no route")

    def test_a_non_json_answer_becomes_an_error(self):
        self.assert_fails_without_the_secret({"return_value": fake_response(200, b"<html>maintenance</html>")},
                                             "JSONDecodeError")

    def test_a_timeout_becomes_an_error_that_shows_only_its_type(self):
        self.assert_fails_without_the_secret({"side_effect": TimeoutError(SECRET)}, "TimeoutError")

    def test_a_bad_header_error_that_quotes_the_token_is_not_repeated(self):
        quoting = ValueError(f"Invalid header value b'Bearer {SECRET}'")

        self.assert_fails_without_the_secret({"side_effect": quoting}, "ValueError")

    def test_redirects_are_never_followed(self):
        handler = cf_dns._NoRedirect()

        result = handler.redirect_request(None, None, 302, "Found", {}, "https://evil.example/")

        self.assertIsNone(result)


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

    def test_a_token_that_cannot_read_the_zone_gets_none_not_a_crash(self):
        forbidden = (403, {"errors": [{"code": 9109, "message": "Unauthorized"}]})
        with mock.patch.object(cf_dns, "call", return_value=forbidden):
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertIsNone(cf_dns.fetch_zone(creds()))

    def test_only_records_named_after_the_domain_count_as_this_zone(self):
        inside = [record("A", cf_dns.DOMAIN, "1.1.1.1"), record("TXT", f"x.{cf_dns.DOMAIN}", "v")]

        self.assertTrue(cf_dns.belongs_to_domain(inside))
        self.assertFalse(cf_dns.belongs_to_domain([]))
        self.assertFalse(cf_dns.belongs_to_domain([*inside, record("A", "other.example", "1.1.1.1")]))
        self.assertFalse(cf_dns.belongs_to_domain([record("A", f"evil{cf_dns.DOMAIN}", "1.1.1.1")]))


class FakeZone:
    """A tiny in-memory Cloudflare zone that answers the calls the helper makes and records its writes."""

    def __init__(self, records, zone_name=cf_dns.DOMAIN, zone_readable=True, page_size=100, post_status=200):
        self.records = list(records)
        self.zone_name = zone_name
        self.zone_readable = zone_readable
        self.page_size = page_size
        self.post_status = post_status
        self.writes: list[tuple[str, str, object]] = []

    def __call__(self, method, path, _creds, body=None):
        if method == "GET" and "/tokens/verify" in path:
            return 200, {"success": True, "result": {"status": "active"}}
        if method == "GET" and path == ZONE_PATH:
            return self.zone_answer()
        if method == "GET" and path.startswith(RECORDS_PATH):
            return self.page_answer(path)
        self.writes.append((method, path, body))
        if method == "POST" and self.post_status != 200:
            return self.post_status, {"success": False, "errors": [{"code": 971, "message": "rate limited"}]}
        return 200, {"success": True, "result": {}}

    def zone_answer(self):
        if not self.zone_readable:
            return 403, {"success": False, "errors": [{"code": 9109, "message": "Unauthorized"}]}
        zone = {"name": self.zone_name, "status": "active", "paused": False, "account": {"id": ACCOUNT_ID},
                "name_servers": ["a.ns.example", "b.ns.example"]}
        return 200, {"success": True, "result": zone}

    def page_answer(self, path):
        page = int(re.search(r"[?&]page=(\d+)", path).group(1))
        start = (page - 1) * self.page_size
        total_pages = max(1, -(-len(self.records) // self.page_size))
        return 200, {"success": True, "result": self.records[start:start + self.page_size],
                     "result_info": {"total_pages": total_pages}}


class ApplyTests(unittest.TestCase):
    def run_apply(self, zone: FakeZone) -> tuple[int, str]:
        with keys_file(json.dumps(keys())) as path, mock.patch.object(cf_dns, "call", zone):
            return run_main("--keys-file", str(path), "apply", "--yes")

    @staticmethod
    def steps(zone: FakeZone) -> list[str]:
        return [
            f"delete {path.rsplit('/', 1)[1]}" if method == "DELETE" else f"{method.lower()} {body}"
            for method, path, body in zone.writes
        ]

    def test_creates_every_wanted_record_dns_only_with_the_right_content(self):
        zone = FakeZone([])

        code, _ = self.run_apply(zone)

        created = [body for method, _, body in zone.writes if method == "POST"]
        self.assertEqual(code, 0)
        self.assertEqual({(b["type"], b["name"], b["content"]) for b in created}, set(cf_dns.DESIRED_RECORDS))
        self.assertTrue(all(b["proxied"] is False and b["ttl"] == cf_dns.AUTO_TTL and b["comment"] for b in created))

    def test_deletes_only_the_conflicts_never_mail_records(self):
        parking = record("A", cf_dns.DOMAIN, "3.33.130.190", record_id="old-a")
        mail = record("MX", cf_dns.DOMAIN, "mx1.forwardemail.net", record_id="mail")
        zone = FakeZone([parking, mail])

        self.run_apply(zone)

        deletes = [path for method, path, _ in zone.writes if method == "DELETE"]
        self.assertEqual(deletes, [f"{RECORDS_PATH}/old-a"])

    def test_a_blocking_cname_goes_before_its_replacement_and_a_stale_address_after_the_new_ones(self):
        zone = FakeZone([record("CNAME", cf_dns.WWW_HOST, cf_dns.DOMAIN, record_id="old-www"),
                         record("A", cf_dns.DOMAIN, "3.33.130.190", record_id="old-a")])

        self.run_apply(zone)

        posts = [(method, body["type"], body["name"]) for method, _, body in zone.writes if method == "POST"]
        order = [("DELETE", path.rsplit("/", 1)[1]) if method == "DELETE" else ("POST", body["type"], body["name"])
                 for method, path, body in zone.writes]
        www_create = order.index(("POST", "CNAME", cf_dns.WWW_HOST))
        last_address_create = max(i for i, step in enumerate(order) if step[0] == "POST" and step[1] in ("A", "AAAA"))
        self.assertEqual(len(posts), len(cf_dns.DESIRED_RECORDS))
        self.assertLess(order.index(("DELETE", "old-www")), www_create)
        self.assertGreater(order.index(("DELETE", "old-a")), last_address_create)

    def test_switches_proxying_off_with_the_right_request(self):
        proxied = record("A", cf_dns.DOMAIN, cf_dns.GITHUB_IPV4[0], proxied=True, record_id="px")
        zone = FakeZone([proxied, *[r for r in wanted_records() if r["content"] != cf_dns.GITHUB_IPV4[0]]])

        self.run_apply(zone)

        self.assertEqual(zone.writes, [("PATCH", f"{RECORDS_PATH}/px", {"proxied": False})])

    def test_reads_every_page_of_records_before_deciding(self):
        stale_on_the_last_page = record("A", cf_dns.DOMAIN, "3.33.130.190", record_id="old-a")
        zone = FakeZone([*wanted_records(), stale_on_the_last_page], page_size=3)

        self.run_apply(zone)

        self.assertEqual([step for step in self.steps(zone)], ["delete old-a"])

    def test_changes_nothing_when_the_zone_already_matches(self):
        zone = FakeZone(wanted_records())

        self.assertEqual(self.run_apply(zone)[0], 0)
        self.assertEqual(zone.writes, [])

    def test_a_zone_of_another_domain_is_refused_with_no_writes(self):
        zone = FakeZone([], zone_name="other.example")

        code, output = self.run_apply(zone)

        self.assertEqual(code, cf_dns.EXIT_FAILURE)
        self.assertIn("refusing", output)
        self.assertEqual(zone.writes, [])

    def test_an_unreadable_zone_with_nothing_to_confirm_it_is_refused(self):
        for records in ([], [record("A", "other.example", "1.1.1.1")]):
            with self.subTest(records=len(records)):
                zone = FakeZone(records, zone_readable=False)

                code, output = self.run_apply(zone)

                self.assertEqual(code, cf_dns.EXIT_FAILURE)
                self.assertIn("Zone > Zone > Read", output)
                self.assertEqual(zone.writes, [])

    def test_an_unreadable_zone_whose_records_are_all_ours_is_allowed(self):
        zone = FakeZone([record("MX", cf_dns.DOMAIN, "mx1.forwardemail.net")], zone_readable=False)

        code, _ = self.run_apply(zone)

        self.assertEqual(code, 0)
        self.assertEqual(len(zone.writes), len(cf_dns.DESIRED_RECORDS))

    def test_a_failed_create_stops_and_says_how_to_finish(self):
        zone = FakeZone([], post_status=429)

        code, output = self.run_apply(zone)

        self.assertEqual(code, cf_dns.EXIT_FAILURE)
        self.assertIn("partly changed", output)
        self.assertEqual(len(zone.writes), 1)


class CheckTests(unittest.TestCase):
    def test_lists_the_zone_and_the_plan_and_writes_nothing(self):
        zone = FakeZone(wanted_records())
        with keys_file(json.dumps(keys())) as path, mock.patch.object(cf_dns, "call", zone):
            code, output = run_main("--keys-file", str(path), "check")

        self.assertEqual(code, 0)
        self.assertIn(f"name: {cf_dns.DOMAIN}", output)
        self.assertIn("nothing to do", output)
        self.assertNotIn(SECRET, output)
        self.assertEqual(zone.writes, [])


class ChallengeActionTests(unittest.TestCase):
    def test_the_record_name_is_the_one_github_asks_for(self):
        self.assertEqual(cf_dns.CHALLENGE_NAME, "_github-pages-challenge-pranay-ai360.numaliving.us")

    def test_a_missing_record_is_not_present(self):
        self.assertFalse(cf_dns.challenge_record_present([], CHALLENGE_CODE))

    def test_a_record_with_the_same_value_is_present(self):
        existing = [record("TXT", cf_dns.CHALLENGE_NAME, CHALLENGE_CODE)]

        self.assertTrue(cf_dns.challenge_record_present(existing, CHALLENGE_CODE))

    def test_a_value_that_cloudflare_returns_in_one_pair_of_quotes_is_present(self):
        existing = [record("TXT", cf_dns.CHALLENGE_NAME, f'"{CHALLENGE_CODE}"')]

        self.assertTrue(cf_dns.challenge_record_present(existing, CHALLENGE_CODE))

    def test_only_one_matching_pair_of_quotes_is_removed(self):
        for stored in (f'"{CHALLENGE_CODE}', f'{CHALLENGE_CODE}"', f'""{CHALLENGE_CODE}""'):
            with self.subTest(stored=stored):
                existing = [record("TXT", cf_dns.CHALLENGE_NAME, stored)]

                with self.assertRaisesRegex(cf_dns.CloudflareError, "different TXT value"):
                    cf_dns.challenge_record_present(existing, CHALLENGE_CODE)

    def test_a_different_value_is_an_error_never_a_replacement(self):
        existing = [record("TXT", cf_dns.CHALLENGE_NAME, "0" * 30)]

        with self.assertRaisesRegex(cf_dns.CloudflareError, "different TXT value"):
            cf_dns.challenge_record_present(existing, CHALLENGE_CODE)

    def test_the_name_and_type_are_compared_the_way_dns_does(self):
        spellings = (("TXT", cf_dns.CHALLENGE_NAME.upper()), ("txt", cf_dns.CHALLENGE_NAME),
                     ("TXT", f"{cf_dns.CHALLENGE_NAME}."))
        for rtype, name in spellings:
            with self.subTest(rtype=rtype, name=name):
                existing = [record(rtype, name, CHALLENGE_CODE)]

                self.assertTrue(cf_dns.challenge_record_present(existing, CHALLENGE_CODE))

    def test_the_same_value_on_another_name_does_not_count(self):
        elsewhere = [record("TXT", f"other.{cf_dns.DOMAIN}", CHALLENGE_CODE), record("TXT", cf_dns.DOMAIN, CHALLENGE_CODE)]

        self.assertFalse(cf_dns.challenge_record_present(elsewhere, CHALLENGE_CODE))

    def test_an_address_record_on_the_name_does_not_count(self):
        other_type = [record("A", cf_dns.CHALLENGE_NAME, "203.0.113.5")]

        self.assertFalse(cf_dns.challenge_record_present(other_type, CHALLENGE_CODE))

    def test_a_cname_on_the_name_is_reported_because_it_cannot_sit_beside_a_txt_record(self):
        blocking = [record("CNAME", cf_dns.CHALLENGE_NAME, "somewhere.example")]

        with self.assertRaisesRegex(cf_dns.CloudflareError, "CNAME"):
            cf_dns.challenge_record_present(blocking, CHALLENGE_CODE)

    def test_the_plan_for_the_managed_records_keeps_the_challenge_record(self):
        plan = cf_dns.build_plan([*wanted_records(), record("TXT", cf_dns.CHALLENGE_NAME, CHALLENGE_CODE)])

        self.assertEqual(plan, {"create": [], "delete_first": [], "delete_after": [], "unproxy": []})


class OpenZoneTests(unittest.TestCase):
    def open_with(self, zone: FakeZone):
        with keys_file(json.dumps(keys())) as path, mock.patch.object(cf_dns, "call", zone):
            with contextlib.redirect_stdout(io.StringIO()):
                return cf_dns.open_zone(path)

    def test_returns_the_credentials_and_every_page_of_records(self):
        found_creds, records = self.open_with(FakeZone(wanted_records(), page_size=3))

        self.assertEqual(found_creds, creds())
        self.assertEqual(len(records), len(cf_dns.DESIRED_RECORDS))

    def test_a_zone_of_another_domain_is_refused(self):
        with self.assertRaisesRegex(cf_dns.CloudflareError, "refusing"):
            self.open_with(FakeZone([], zone_name="other.example"))

    def test_an_unreadable_zone_with_nothing_to_confirm_it_is_refused(self):
        for records in ([], [record("A", "other.example", "1.1.1.1")]):
            with self.subTest(records=len(records)):
                with self.assertRaisesRegex(cf_dns.CloudflareError, "Zone > Zone > Read"):
                    self.open_with(FakeZone(records, zone_readable=False))

    def test_an_unreadable_zone_whose_records_are_all_ours_is_allowed(self):
        self.open_with(FakeZone([record("MX", cf_dns.DOMAIN, "mx1.forwardemail.net")], zone_readable=False))


class GithubChallengeCommandTests(unittest.TestCase):
    def run_challenge(self, zone: FakeZone, code: str = CHALLENGE_CODE) -> tuple[int, str]:
        with keys_file(json.dumps(keys())) as path, mock.patch.object(cf_dns, "call", zone):
            return run_main("--keys-file", str(path), "github-challenge", code, "--yes")

    def test_creates_only_the_txt_record_whatever_else_is_wrong_with_the_zone(self):
        messy_zone = FakeZone([
            record("A", cf_dns.DOMAIN, "3.33.130.190", record_id="parking"),  # `apply` would delete this
            record("A", cf_dns.DOMAIN, cf_dns.GITHUB_IPV4[0], proxied=True, record_id="proxied"),  # and un-proxy this
            record("MX", cf_dns.DOMAIN, "mx1.forwardemail.net"),
        ])

        code, _ = self.run_challenge(messy_zone)

        self.assertEqual(code, 0)
        self.assertEqual(len(messy_zone.writes), 1)
        method, path, body = messy_zone.writes[0]
        self.assertEqual((method, path), ("POST", RECORDS_PATH))
        self.assertEqual((body["type"], body["name"], body["content"]), ("TXT", cf_dns.CHALLENGE_NAME, CHALLENGE_CODE))
        self.assertEqual((body["ttl"], body["proxied"]), (cf_dns.AUTO_TTL, False))
        self.assertIn("domain verification", body["comment"])

    def test_says_what_to_do_next_keeps_the_name_and_code_apart_and_never_prints_the_token(self):
        _, output = self.run_challenge(FakeZone(wanted_records()))

        self.assertIn("Verify", output)
        self.assertRegex(output, re.escape(cf_dns.CHALLENGE_NAME) + r"\s+" + CHALLENGE_CODE)
        self.assertNotIn(SECRET, output)

    def test_changes_nothing_when_the_record_is_already_there(self):
        zone = FakeZone([*wanted_records(), record("TXT", cf_dns.CHALLENGE_NAME, CHALLENGE_CODE)])

        code, output = self.run_challenge(zone)

        self.assertEqual(code, 0)
        self.assertIn("already in place", output)
        self.assertEqual(zone.writes, [])

    def test_a_record_that_cloudflare_returns_in_quotes_is_not_created_twice(self):
        zone = FakeZone([record("TXT", cf_dns.CHALLENGE_NAME, f'"{CHALLENGE_CODE}"')])

        self.assertEqual(self.run_challenge(zone)[0], 0)
        self.assertEqual(zone.writes, [])

    def test_a_different_value_is_reported_and_nothing_is_deleted_or_replaced(self):
        zone = FakeZone([record("TXT", cf_dns.CHALLENGE_NAME, "0" * 30, record_id="old-challenge")])

        code, output = self.run_challenge(zone)

        self.assertEqual(code, cf_dns.EXIT_FAILURE)
        self.assertIn("different TXT value", output)
        self.assertEqual(zone.writes, [])

    def test_reads_every_page_of_records_before_deciding(self):
        on_the_last_page = record("TXT", cf_dns.CHALLENGE_NAME, CHALLENGE_CODE)
        zone = FakeZone([*wanted_records(), on_the_last_page], page_size=3)

        self.assertEqual(self.run_challenge(zone)[0], 0)
        self.assertEqual(zone.writes, [])

    def test_a_zone_of_another_domain_is_refused_with_no_writes(self):
        zone = FakeZone([], zone_name="other.example")

        code, output = self.run_challenge(zone)

        self.assertEqual(code, cf_dns.EXIT_FAILURE)
        self.assertIn("refusing", output)
        self.assertEqual(zone.writes, [])

    def test_a_failed_create_is_reported_and_says_it_is_safe_to_repeat(self):
        zone = FakeZone(wanted_records(), post_status=429)

        code, output = self.run_challenge(zone)

        self.assertEqual(code, cf_dns.EXIT_FAILURE)
        self.assertIn("creating TXT", output)
        self.assertIn("safe to repeat", output)

    def test_the_function_checks_the_code_itself_before_any_request(self):
        with keys_file(json.dumps(keys())) as path:
            with mock.patch.object(cf_dns, "call", side_effect=AssertionError("must not be called")):
                with self.assertRaisesRegex(cf_dns.CloudflareError, "lowercase hex"):
                    cf_dns.github_challenge(path, "not hex")


class MainTests(unittest.TestCase):
    def setUp(self):
        # A regression that got past a guard must not be able to open the real keys file.
        patcher = mock.patch.object(cf_dns, "default_keys_file", return_value=Path("/nonexistent/none.json"))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_apply_without_yes_does_not_touch_the_api(self):
        with mock.patch.object(cf_dns, "call", side_effect=AssertionError("must not be called")):
            code, _ = run_main("apply")

        self.assertEqual(code, cf_dns.EXIT_USAGE)

    def test_an_abbreviated_flag_is_not_accepted_as_yes(self):
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as caught:
                cf_dns.main(["apply", "--y"])

        self.assertEqual(caught.exception.code, 2)

    def test_check_reports_a_missing_keys_file_as_a_failure(self):
        code, output = run_main("--keys-file", "/nonexistent/api-keys.json", "check")

        self.assertEqual(code, cf_dns.EXIT_FAILURE)
        self.assertIn("ERROR:", output)

    def test_an_unexpected_error_shows_only_its_type(self):
        with mock.patch.object(cf_dns, "check", side_effect=RuntimeError(SECRET)):
            code, output = run_main("check")

        self.assertEqual(code, cf_dns.EXIT_FAILURE)
        self.assertIn("RuntimeError", output)
        self.assertNotIn(SECRET, output)

    def test_github_challenge_without_yes_does_not_touch_the_api(self):
        with mock.patch.object(cf_dns, "call", side_effect=AssertionError("must not be called")):
            code, _ = run_main("github-challenge", CHALLENGE_CODE)

        self.assertEqual(code, cf_dns.EXIT_USAGE)

    def test_a_code_that_is_not_lowercase_hex_is_refused_before_any_request_and_never_echoed(self):
        bad_codes = ("", "xyz", "7fc2", CHALLENGE_CODE.upper(), f"{CHALLENGE_CODE} extra", f"{CHALLENGE_CODE}\n",
                     "a" * 65, "g" * 30, f"{CHALLENGE_CODE}.numaliving.us")
        for bad in bad_codes:
            with self.subTest(bad=bad):
                with mock.patch.object(cf_dns, "call", side_effect=AssertionError("must not be called")):
                    code, output = run_main("github-challenge", bad, "--yes")

                self.assertEqual(code, cf_dns.EXIT_USAGE)
                if bad.strip():
                    self.assertNotIn(bad.strip(), output)

    def test_the_code_length_limits_are_20_and_64_characters(self):
        for length, accepted in ((19, False), (20, True), (64, True), (65, False)):
            with self.subTest(length=length):
                code, _ = run_main("github-challenge", "a" * length, "--yes")

                # An accepted code gets as far as the (missing) keys file, which is a failure, not a usage error.
                self.assertEqual(code == cf_dns.EXIT_USAGE, not accepted)


if __name__ == "__main__":
    unittest.main()
