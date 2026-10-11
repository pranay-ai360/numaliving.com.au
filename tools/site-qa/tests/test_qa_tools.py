"""Browser-free unit tests for the QA tools (never launches CloakBrowser).

Run from the qa directory:  python3 -m unittest discover -s tests -v
"""

from __future__ import annotations

import http.client
import sys
import tempfile
import threading
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

QA_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(QA_DIR))

import compare  # noqa: E402
import serve_pages  # noqa: E402
from capture import parse_routes, parse_viewports  # noqa: E402
from check_rules import CheckOptions, evaluate_not_found, evaluate_site, internal_links  # noqa: E402
from page_probe import analyse_images, mixed_content, union_by_key, without_document_echo  # noqa: E402
from qa_common import QAError, parse_base_url, parse_viewport_widths, route_slug  # noqa: E402
from site_check import looks_like_page  # noqa: E402

PREFIX = "/site"


def make_tree(root: Path) -> None:
    files = {
        "index.html": "<h1>home</h1>",
        "404.html": "<h1>custom 404</h1>",
        "about/index.html": "<h1>about</h1>",
        "empty-dir/readme.txt": "no index here",
        "img/Photo.JPG": "jpeg-bytes",
        "css/site.css": "body{}",
        "js/app.js": "1",
        "icon.svg": "<svg/>",
        "fonts/a.woff2": "font",
        "data.json": "{}",
        "_next/static/app.js": "next asset",
        "dir with space/index.html": "<h1>spaced</h1>",
    }
    for name, content in files.items():
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")


class ResolveRequestTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name).resolve()
        make_tree(self.root)
        self.config = serve_pages.ServerConfig(root=self.root, prefix=PREFIX)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def resolve(self, target: str, **overrides: object) -> serve_pages.Resolution:
        config = serve_pages.ServerConfig(**{"root": self.root, "prefix": PREFIX, **overrides})  # type: ignore[arg-type]
        return serve_pages.resolve_request(config, target)

    def test_serves_index_for_prefix_directory(self) -> None:
        result = self.resolve(f"{PREFIX}/")
        self.assertEqual(("file", self.root / "index.html"), (result.kind, result.path))

    def test_prefix_without_slash_redirects(self) -> None:
        result = self.resolve(PREFIX)
        self.assertEqual(("redirect", f"{PREFIX}/"), (result.kind, result.location))

    def test_paths_outside_prefix_are_not_found(self) -> None:
        for target in ("/", "/about/", "/robots.txt", f"{PREFIX}x/", "/other/site/"):
            self.assertEqual("not_found", self.resolve(target).kind, target)

    def test_directory_without_slash_redirects_and_keeps_query(self) -> None:
        result = self.resolve(f"{PREFIX}/about?x=1&y=2")
        self.assertEqual(("redirect", f"{PREFIX}/about/?x=1&y=2"), (result.kind, result.location))

    def test_redirect_percent_encodes_spaces(self) -> None:
        result = self.resolve(f"{PREFIX}/dir%20with%20space")
        self.assertEqual(f"{PREFIX}/dir%20with%20space/", result.location)

    def test_lookup_is_case_sensitive(self) -> None:
        self.assertEqual("file", self.resolve(f"{PREFIX}/img/Photo.JPG").kind)
        self.assertEqual("not_found", self.resolve(f"{PREFIX}/img/Photo.jpg").kind)
        self.assertEqual("not_found", self.resolve(f"{PREFIX}/About/").kind)

    def test_directory_without_index_is_not_found(self) -> None:
        self.assertEqual("not_found", self.resolve(f"{PREFIX}/empty-dir/").kind)
        self.assertEqual("not_found", self.resolve(f"{PREFIX}/empty-dir").kind)

    def test_file_with_trailing_slash_is_not_found(self) -> None:
        self.assertEqual("not_found", self.resolve(f"{PREFIX}/icon.svg/").kind)

    def test_path_traversal_is_rejected(self) -> None:
        for target in (f"{PREFIX}/../../etc/passwd", f"{PREFIX}/%2e%2e/%2e%2e/etc/passwd", f"{PREFIX}/a/../../x"):
            self.assertEqual("not_found", self.resolve(target).kind, target)

    def test_no_prefix_serves_from_root(self) -> None:
        result = self.resolve("/about/", prefix="")
        self.assertEqual(self.root / "about" / "index.html", result.path)

    def test_redirect_without_prefix_never_points_at_another_host(self) -> None:
        # "/%2Fabout" decodes to "//about": a Location of "//about/" would send the browser to the host "about".
        cases = {"/%2Fabout": "/about/", "/%2F%2Fabout": "/about/", "/%2fabout?x=1": "/about/?x=1"}
        for target, expected in cases.items():
            result = self.resolve(target, prefix="")
            self.assertEqual(("redirect", expected), (result.kind, result.location), target)

    def test_jekyll_emulation_hides_underscore_paths_unless_nojekyll(self) -> None:
        self.assertEqual("file", self.resolve(f"{PREFIX}/_next/static/app.js").kind)
        self.assertEqual("not_found", self.resolve(f"{PREFIX}/_next/static/app.js", emulate_jekyll=True).kind)
        (self.root / ".nojekyll").write_text("")
        self.assertEqual("file", self.resolve(f"{PREFIX}/_next/static/app.js", emulate_jekyll=True).kind)

    def test_normalize_prefix(self) -> None:
        self.assertEqual("", serve_pages.normalize_prefix(None))
        self.assertEqual("", serve_pages.normalize_prefix("/"))
        self.assertEqual("/a/b", serve_pages.normalize_prefix("a/b/"))
        with self.assertRaises(ValueError):
            serve_pages.normalize_prefix("/a?b")

    def test_content_types(self) -> None:
        expected = {
            "index.html": "text/html; charset=utf-8",
            "css/site.css": "text/css; charset=utf-8",
            "js/app.js": "text/javascript; charset=utf-8",
            "icon.svg": "image/svg+xml",
            "fonts/a.woff2": "font/woff2",
            "data.json": "application/json; charset=utf-8",
            "img/Photo.JPG": "image/jpeg",
        }
        for name, content_type in expected.items():
            self.assertEqual(content_type, serve_pages.guess_content_type(self.root / name), name)


class RunningServerTestCase(unittest.TestCase):
    """Serves a fresh copy of the test tree on a free port for the tests of one class (no tests of its own)."""

    prefix = PREFIX

    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory()
        root = Path(cls._tmp.name).resolve()
        make_tree(root)
        config = serve_pages.ServerConfig(root=root, prefix=cls.prefix, quiet=True)
        cls.server = serve_pages.PagesServer(("127.0.0.1", 0), config)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)
        cls._tmp.cleanup()

    def request(self, method: str, path: str, headers: dict[str, str] | None = None) -> tuple[int, dict[str, str], bytes]:
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        try:
            connection.request(method, path, headers=headers or {})
            response = connection.getresponse()
            return response.status, {k.lower(): v for k, v in response.getheaders()}, response.read()
        finally:
            connection.close()


class ServerProtocolTests(RunningServerTestCase):
    def test_not_found_uses_404_html_body_and_status(self) -> None:
        for path in ("/", f"{PREFIX}/nope/", "/robots.txt"):
            status, _, body = self.request("GET", path)
            self.assertEqual((404, b"<h1>custom 404</h1>"), (status, body), path)

    def test_redirect_and_index(self) -> None:
        status, headers, _ = self.request("GET", f"{PREFIX}/about")
        self.assertEqual((301, f"{PREFIX}/about/"), (status, headers["location"]))
        status, headers, body = self.request("GET", f"{PREFIX}/about/")
        self.assertEqual((200, b"<h1>about</h1>"), (status, body))
        self.assertTrue(headers["content-type"].startswith("text/html"))

    def test_head_has_length_but_no_body(self) -> None:
        status, headers, body = self.request("HEAD", f"{PREFIX}/about/")
        self.assertEqual((200, b""), (status, body))
        self.assertEqual("14", headers["content-length"])

    def test_other_methods_are_not_allowed(self) -> None:
        status, headers, _ = self.request("POST", f"{PREFIX}/about/")
        self.assertEqual((405, "GET, HEAD"), (status, headers["allow"]))

    def test_byte_ranges(self) -> None:
        status, headers, body = self.request("GET", f"{PREFIX}/icon.svg", {"Range": "bytes=1-3"})
        self.assertEqual((206, b"svg", "bytes 1-3/6"), (status, body, headers["content-range"]))
        status, _, _ = self.request("GET", f"{PREFIX}/icon.svg", {"Range": "bytes=99-"})
        self.assertEqual(416, status)

    def test_raw_traversal_is_not_found(self) -> None:
        status, _, _ = self.request("GET", f"{PREFIX}/../../../../etc/passwd")
        self.assertEqual(404, status)

    def test_no_response_lets_other_sites_read_it(self) -> None:
        # GitHub Pages sends no Access-Control-Allow-Origin header, so the local server must not either.
        for path in (f"{PREFIX}/about/", f"{PREFIX}/about", f"{PREFIX}/nope/", f"{PREFIX}/icon.svg"):
            _, headers, _ = self.request("GET", path)
            self.assertNotIn("access-control-allow-origin", headers, path)


class NoPrefixServerTests(RunningServerTestCase):
    prefix = ""

    def test_encoded_slashes_never_redirect_to_another_host(self) -> None:
        for path in ("/%2Fabout", "/%2F%2Fabout", "//about"):
            status, headers, _ = self.request("GET", path)
            self.assertEqual((301, "/about/"), (status, headers["location"]), path)


class UrlHelperTests(unittest.TestCase):
    def test_parse_base_url_normalises(self) -> None:
        base = parse_base_url("HTTPS://Example.com:443/numaliving.com.au")
        self.assertEqual("https://example.com/numaliving.com.au/", base.url)
        self.assertEqual("https://example.com", base.origin)

    def test_parse_base_url_rejects_relative(self) -> None:
        for bad in ("example.com", "ftp://x/", "/path"):
            with self.assertRaises(QAError):
                parse_base_url(bad)

    def test_resolve_and_route_of_respect_the_base_path(self) -> None:
        base = parse_base_url("http://127.0.0.1:4302/numaliving.com.au/")
        self.assertEqual("http://127.0.0.1:4302/numaliving.com.au/about/", base.resolve("/about/"))
        self.assertEqual("http://127.0.0.1:4302/numaliving.com.au/", base.resolve("/"))
        self.assertEqual("https://other.test/x", base.resolve("https://other.test/x"))
        self.assertEqual("/about/", base.route_of("http://127.0.0.1:4302/numaliving.com.au/about/"))
        self.assertEqual("/about/", base.route_of("http://127.0.0.1:4302/about/"))

    def test_contains_and_same_origin(self) -> None:
        base = parse_base_url("http://127.0.0.1:4302/site/")
        self.assertTrue(base.contains("http://127.0.0.1:4302/site/about/"))
        self.assertFalse(base.contains("http://127.0.0.1:4302/about/"))
        self.assertTrue(base.same_origin("http://127.0.0.1:4302/about/"))
        self.assertFalse(base.same_origin("http://localhost:4302/site/"))
        self.assertFalse(base.same_origin("https://127.0.0.1:4302/site/"))

    def test_route_slug(self) -> None:
        self.assertEqual("home", route_slug("/"))
        self.assertEqual("projects-golf-links", route_slug("/projects/golf-links/"))
        self.assertEqual("definitely-not-a-page", route_slug("/definitely-not-a-page/"))
        self.assertEqual("about", route_slug("/about/?utm=1"))

    def test_viewport_parsing(self) -> None:
        self.assertEqual([320, 1440], parse_viewport_widths("320, 1440,320"))
        for bad in ("", "abc", "100", "9000"):
            with self.assertRaises(QAError):
                parse_viewport_widths(bad)
        self.assertEqual(["320x800", "1440x900"], [v.label for v in parse_viewports("320x800,1440x900")])
        with self.assertRaises(QAError):
            parse_viewports("320x800,320x1000")

    def test_route_parsing_accepts_spaces_and_commas(self) -> None:
        self.assertEqual(["/", "/a/", "/b/"], parse_routes(["/", "/a/,/b/"], ["/a/"]))

    def test_looks_like_page(self) -> None:
        self.assertTrue(looks_like_page("http://h/a/"))
        self.assertTrue(looks_like_page("http://h/a"))
        self.assertTrue(looks_like_page("http://h/a.html"))
        self.assertFalse(looks_like_page("http://h/a/photo.JPG"))
        self.assertFalse(looks_like_page("http://h/brochure.pdf"))


def solid(width: int, height: int, value: int) -> np.ndarray:
    return np.full((height, width, 3), value, dtype=np.uint8)


class CompareTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def save(self, name: str, array: np.ndarray) -> Path:
        path = self.dir / name
        Image.fromarray(array).save(path)
        return path

    def compare(self, baseline: np.ndarray, candidate: np.ndarray, threshold: float = 0.1) -> dict:
        return compare.compare_pair(
            "x-320.png", self.save("b.png", baseline), self.save("c.png", candidate), 8, threshold, self.dir / "diff"
        )

    def test_difference_of_exactly_tolerance_counts_as_equal(self) -> None:
        result = self.compare(solid(10, 10, 100), solid(10, 10, 108))
        self.assertEqual(("identical", 0), (result["result"], result["differing_pixels"]))

    def test_difference_above_tolerance_in_one_channel_counts(self) -> None:
        candidate = solid(10, 10, 100)
        candidate[0, 0, 2] = 109
        result = self.compare(solid(10, 10, 100), candidate, threshold=5.0)
        self.assertEqual(("ok", 1, 1.0), (result["result"], result["differing_pixels"], result["percent"]))

    def test_percent_above_threshold_is_diff_with_image_and_regions(self) -> None:
        candidate = solid(100, 100, 0)
        candidate[10:20, 10:50] = 255
        result = self.compare(solid(100, 100, 0), candidate)
        self.assertEqual("DIFF", result["result"])
        self.assertEqual(400, result["differing_pixels"])
        self.assertEqual({"x0": 10, "y0": 10, "x1": 49, "y1": 19, "pixels": 400}, result["regions"][0])
        self.assertTrue((self.dir / "diff" / "x-320.png").is_file())

    def test_size_mismatch_counts_extra_area_as_different(self) -> None:
        result = self.compare(solid(10, 10, 5), solid(10, 12, 5))
        self.assertEqual("SIZE", result["result"])
        self.assertEqual(20, result["differing_pixels"])
        self.assertEqual([10, 10], result["baseline_size"])
        self.assertEqual([10, 12], result["candidate_size"])

    def test_transparent_pixels_are_composited_on_white(self) -> None:
        rgba = np.zeros((4, 4, 4), dtype=np.uint8)
        path = self.save("t.png", rgba)
        self.assertTrue((compare.load_rgb(path) == 255).all())

    def test_expected_missing_split(self) -> None:
        expected, unexpected = compare.split_missing(["portal-320.png", "home-320.png"], ["portal-*"])
        self.assertEqual((["portal-320.png"], ["home-320.png"]), (expected, unexpected))

    def test_build_report_verdicts(self) -> None:
        base_dir, cand_dir = self.dir / "base", self.dir / "cand"
        base_dir.mkdir()
        cand_dir.mkdir()
        for directory, extra in ((base_dir, ["portal-320.png"]), (cand_dir, [])):
            Image.fromarray(solid(8, 8, 50)).save(directory / "home-320.png")
            for name in extra:
                Image.fromarray(solid(8, 8, 50)).save(directory / name)

        def run(*extra_args: str) -> dict:
            args = compare.parse_args(["--baseline", str(base_dir), "--candidate", str(cand_dir), "--out-dir", str(self.dir / "out"), *extra_args])
            return compare.build_report(args)

        self.assertEqual("PASS", run()["verdict"])  # portal-* is expected to be missing by default
        self.assertEqual("FAIL", run("--expect-missing", "nothing-*")["verdict"])
        Image.fromarray(solid(8, 8, 200)).save(cand_dir / "home-320.png")
        self.assertEqual("FAIL", run()["verdict"])

    def test_provenance_warns_when_seed_or_browser_differ(self) -> None:
        same = {"fingerprint_seed": 1, "browser_version": "154"}
        self.assertEqual([], compare.provenance_notes(same, dict(same)))
        self.assertIn("different fingerprint seeds", compare.provenance_notes(same, {**same, "fingerprint_seed": 2})[0])
        self.assertIn("missing", compare.provenance_notes({}, same)[0])
        self.assertIn("browser versions differ", compare.provenance_notes(same, {**same, "browser_version": "155"})[0])

    def test_markdown_mentions_verdict_and_missing_files(self) -> None:
        report = {
            "baseline_dir": "b", "candidate_dir": "c", "tolerance": 8, "threshold_percent": 0.1, "generated_at": "now",
            "provenance": {"baseline": {}, "candidate": {}, "warnings": []},
            "verdict": "PASS", "pairs": [], "missing_in_candidate_expected": ["portal-320.png"],
            "missing_in_candidate_unexpected": [], "only_in_candidate": ["new-320.png"],
        }
        text = compare.render_markdown(report)
        self.assertIn("portal-320.png", text)
        self.assertIn("new-320.png", text)
        self.assertIn("FAIL - no matching screenshot names", text)  # empty pair list can never pass


class ProbeAndRuleTests(unittest.TestCase):
    def test_mixed_content_only_on_https_pages(self) -> None:
        result = {"width": 320, "events": {"request_urls": ["http://cdn.test/a.js", "https://ok.test/b.js"]}, "insecure_references": [{"tag": "img", "attr": "src", "url": "http://cdn.test/i.png"}]}
        found = mixed_content("https://site.test/", [result])
        self.assertEqual({"http://cdn.test/a.js", "http://cdn.test/i.png"}, {item["url"] for item in found})
        self.assertEqual([], mixed_content("http://site.test/", [result]))

    def test_image_analysis(self) -> None:
        result = {
            "width": 320,
            "prepared": {"pending_images": ["http://s/slow.png"]},
            "events": {"http_errors": [{"url": "http://s/missing.png", "status": 404}], "ok_images": {"http://s/logo.svg": "image/svg+xml"}},
            "images": [
                {"src": "http://s/missing.png", "complete": True, "naturalWidth": 0, "rendered": True, "alt": "x", "role": None, "ariaHidden": None},
                {"src": "http://s/logo.svg", "complete": True, "naturalWidth": 0, "rendered": True, "alt": "logo", "role": None, "ariaHidden": None},
                {"src": "http://s/slow.png", "complete": False, "naturalWidth": 0, "rendered": True, "alt": "", "role": None, "ariaHidden": None},
                {"src": "http://s/noalt.png", "complete": True, "naturalWidth": 5, "rendered": True, "alt": None, "role": None, "ariaHidden": None},
                {"src": "http://s/deco.png", "complete": True, "naturalWidth": 5, "rendered": True, "alt": None, "role": "presentation", "ariaHidden": None},
            ],
        }
        broken, missing_alt = analyse_images(result)
        self.assertEqual({"http://s/missing.png": "HTTP 404", "http://s/slow.png": "never finished loading"}, {i["src"]: i["reason"] for i in broken})
        self.assertEqual(["http://s/noalt.png"], [i["src"] for i in missing_alt])

    def test_internal_links_skip_self_fragment_and_foreign_links(self) -> None:
        base = parse_base_url("http://127.0.0.1:4302/site/")
        record = {
            "url": "http://127.0.0.1:4302/site/x/",
            "final_url": "http://127.0.0.1:4302/site/x/",
            "links": [
                {"href": "http://127.0.0.1:4302/site/x/#main", "text": "Skip to content"},
                {"href": "http://127.0.0.1:4302/site/a/#top", "text": "a"},
                {"href": "http://127.0.0.1:4302/site/a/", "text": "a again"},
                {"href": "https://elsewhere.test/", "text": "external"},
                {"href": "mailto:hi@example.com", "text": "mail"},
            ],
        }
        self.assertEqual(["http://127.0.0.1:4302/site/a/"], internal_links(record, base))

    def test_union_by_key_records_viewports(self) -> None:
        merged = union_by_key([(320, [{"k": "a"}, {"k": "b"}]), (768, [{"k": "a"}])], lambda item: item["k"])
        self.assertEqual({"a": [320, 768], "b": [320]}, {item["k"]: item["viewports"] for item in merged})

    def test_document_echo_errors_are_dropped(self) -> None:
        errors = [
            {"text": "Failed to load resource: the server responded with a status of 404 ()", "url": "http://s/gone/"},
            {"text": "Failed to load resource: the server responded with a status of 404 ()", "url": "http://s/img.png"},
            {"text": "boom", "url": "http://s/gone/"},
        ]
        kept = without_document_echo(errors, {"http://s/gone/"})
        self.assertEqual(["http://s/img.png", "http://s/gone/"], [item["url"] for item in kept])

    def not_found_inputs(self, status: int = 404, text: str = "404 Page Not Found", landmarks: dict | None = None, sha: str = "abc") -> tuple[dict, dict]:
        api = {"url": "http://s/definitely-not-a-page/", "error": None, "status": status, "body_sha256": sha, "body_text": ""}
        record = {"visible_text": text, "landmarks": landmarks if landmarks is not None else {"header": 1, "main": 1, "footer": 1}}
        return api, record

    def codes(self, issues: list) -> list[str]:
        return [issue.code for issue in issues]

    def test_not_found_accepts_a_custom_404(self) -> None:
        self.assertEqual([], evaluate_not_found(*self.not_found_inputs(), CheckOptions()))

    def test_not_found_flags_soft_404(self) -> None:
        issues = evaluate_not_found(*self.not_found_inputs(status=200, text="Welcome home"), CheckOptions())
        self.assertEqual(["not-found-status", "not-found-content"], self.codes(issues))

    def test_not_found_flags_host_default_and_missing_layout(self) -> None:
        inputs = self.not_found_inputs(text="There isn't a GitHub Pages site here.", landmarks={})
        self.assertEqual(["not-found-generic", "not-found-not-custom"], self.codes(evaluate_not_found(*inputs, CheckOptions())))

    def test_not_found_file_comparison(self) -> None:
        options = CheckOptions(not_found_file_sha256="other")
        self.assertEqual(["not-found-file-mismatch"], self.codes(evaluate_not_found(*self.not_found_inputs(), options)))

    def test_site_rules(self) -> None:
        good_robots = {"origin_root": {"status": 200, "looks_like_html": False, "error": None}}
        bad_robots = {"origin_root": {"status": 404, "looks_like_html": True, "error": None}}
        https_bad = {"url": "http://h/", "final_url": "http://h/", "status": 200, "error": None}
        self.assertEqual([], evaluate_site(good_robots, None, CheckOptions(), 3, []))
        self.assertEqual(["crawl-truncated", "no-robots-txt"], self.codes(evaluate_site(bad_robots, None, CheckOptions(), 3, ["u"])))
        self.assertEqual(["http-not-redirected"], self.codes(evaluate_site(good_robots, https_bad, CheckOptions(expect_https=True), 3, [])))
        self.assertEqual(["no-pages"], self.codes(evaluate_site(good_robots, None, CheckOptions(), 0, [])))


if __name__ == "__main__":
    unittest.main()
