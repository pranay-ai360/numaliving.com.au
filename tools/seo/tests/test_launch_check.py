"""Tests for the launch check as a command: arguments, exit codes, the table, the JSON file, every failure case the
brief names, hostile pages, and a whole run over a real HTTP server on 127.0.0.1."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from typing import Any, Dict, Optional, Set
from unittest import mock

from helpers import captured
from launch_support import (
    FakeWeb, HTML_TYPE, MISSING_PAGE_PATH, ORIGIN, PAGE_PATHS, build_web, edit_page, launch_text, page_file, swap,
)
from loopback import LoopbackServer, Page, free_port
from test_terminal_safety import unsafe_characters

import fetch_pages  # noqa: E402
import launch_check  # noqa: E402
from seo_common import run_cli  # noqa: E402

HOME, ABOUT, PROJECTS, CONTACT, LOGIN = (f"{ORIGIN}{path}" for path in ("/", "/about/", "/projects/", "/contact/", "/login/"))
LIVE_CHECKS, PREVIEW_CHECKS = 35, 30
ABOUT_TITLE = "<title>About the Millwork Factory | Numa Living</title>"
ESC = "\x1b"


class RunResult:
    def __init__(self, code: int, out: str, err: str, report: Dict[str, Any]) -> None:
        self.code, self.out, self.err, self.report = code, out, err, report

    @property
    def failed_ids(self) -> Set[str]:
        return {check["id"] for check in self.report["checks"] if check["status"] == "FAIL"}

    def check(self, check_id: str) -> Dict[str, Any]:
        return next(check for check in self.report["checks"] if check["id"] == check_id)


class CommandTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.folder = Path(self._tmp.name)

    def run_command(self, web: Optional[FakeWeb], *extra: str, mode: str = "live", base: str = ORIGIN + "/") -> RunResult:
        report_path = self.folder / "report.json"
        argv = ["--base-url", base, "--mode", mode, "--json", str(report_path), *extra]
        with captured() as (out, err):
            code = run_cli(lambda args: launch_check.main(args, fetch=web), argv)
        report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.exists() else {}
        return RunResult(code, out.getvalue(), err.getvalue(), report)


class ParserTests(unittest.TestCase):
    def test_the_defaults_are_a_preview_of_the_production_host(self) -> None:
        args = launch_check.build_parser().parse_args(["--base-url", "http://127.0.0.1:4573/"])
        self.assertEqual((args.mode, args.canonical_host, args.max_pages, args.delay, args.json),
                         ("preview", "https://numaliving.us", 60, fetch_pages.DEFAULT_DELAY_SECONDS, None))

    def test_every_option_is_read(self) -> None:
        args = launch_check.build_parser().parse_args(
            ["--base-url", "https://a.test/", "--mode", "live", "--canonical-host", "https://b.test", "--max-pages", "9",
             "--delay", "0", "--json", "out/report.json"])
        self.assertEqual((args.mode, args.canonical_host, args.max_pages, args.delay, args.json),
                         ("live", "https://b.test", 9, 0.0, Path("out/report.json")))

    def test_the_base_url_is_required_and_the_other_options_are_checked(self) -> None:
        parser = launch_check.build_parser()
        for argv in ([], ["--base-url", "https://a.test/", "--mode", "staging"], ["--base-url", "https://a.test/", "--max-pages", "0"],
                     ["--base-url", "https://a.test/", "--delay", "-1"], ["--base-url", "https://a.test/", "--max-pages", "many"],
                     ["--base", "https://a.test/"]):
            with self.subTest(argv=argv), captured(), self.assertRaises(SystemExit) as caught:
                parser.parse_args(argv)
            self.assertEqual(caught.exception.code, 2)


class UsageErrorTests(CommandTestCase):
    def test_a_base_url_that_is_not_a_web_address_exits_2_with_one_line(self) -> None:
        result = self.run_command(None, base="ftp://numaliving.us/")
        self.assertEqual(result.code, 2)
        self.assertIn("--base-url", result.err)
        self.assertNotIn("Traceback", result.err)

    def test_a_canonical_host_with_a_path_exits_2(self) -> None:
        with captured() as (out, err):
            code = run_cli(lambda args: launch_check.main(args, fetch=FakeWeb()), ["--base-url", ORIGIN, "--canonical-host", ORIGIN + "/about/"])
        self.assertEqual(code, 2)
        self.assertIn("--canonical-host", err.getvalue())
        self.assertEqual(out.getvalue(), "")

    def test_a_report_file_that_cannot_be_written_exits_2(self) -> None:
        with captured() as (out, err):
            code = run_cli(lambda args: launch_check.main(args, fetch=build_web()), ["--base-url", ORIGIN, "--json", str(self.folder)])
        self.assertEqual(code, 2)
        self.assertIn("cannot write", err.getvalue())
        self.assertIn("Result:", out.getvalue())


class GoodSiteRunTests(CommandTestCase):
    def test_a_good_live_site_exits_0_and_every_check_passes(self) -> None:
        result = self.run_command(build_web())
        self.assertEqual(result.code, 0, result.out)
        self.assertIn("Result: PASS\n", result.out + "\n")
        self.assertEqual(result.report["counts"], {"PASS": LIVE_CHECKS, "FAIL": 0, "SKIP": 0})
        self.assertTrue(result.report["passed"])
        self.assertEqual(len(result.report["pages"]), 5)

    def test_a_good_preview_site_exits_0(self) -> None:
        result = self.run_command(build_web(mode="preview"), mode="preview")
        self.assertEqual(result.code, 0, result.out)
        self.assertEqual(result.report["counts"], {"PASS": PREVIEW_CHECKS, "FAIL": 0, "SKIP": 0})

    def test_a_local_copy_passes_with_the_two_redirect_checks_skipped(self) -> None:
        local = "http://127.0.0.1:4573"
        result = self.run_command(build_web(local), base=local + "/")
        self.assertEqual(result.code, 0, result.out)
        self.assertEqual(result.report["counts"], {"PASS": LIVE_CHECKS - 2, "FAIL": 0, "SKIP": 2})
        self.assertIn("Result: PASS (2 checks were skipped; see the SKIP lines)", result.out)

    def test_the_table_names_the_mode_the_hosts_and_every_check(self) -> None:
        result = self.run_command(build_web())
        self.assertIn(f"Launch check, live mode: {ORIGIN}/", result.out)
        for check in result.report["checks"]:
            self.assertIn(check["id"], result.out)
        self.assertIn("PAGE CHECKS", result.out)
        self.assertIn("SITE CHECKS", result.out)

    def test_progress_goes_to_stderr_and_the_table_to_stdout(self) -> None:
        result = self.run_command(build_web())
        self.assertIn("checking", result.err)
        self.assertIn(f"wrote {self.folder / 'report.json'}", result.err)
        self.assertNotIn("checking", result.out)

    def test_the_report_file_is_stamped_and_lists_the_settings(self) -> None:
        report = self.run_command(build_web(), "--max-pages", "12").report
        self.assertEqual((report["tool"], report["mode"], report["base_url"], report["canonical_host"], report["max_pages"]),
                         ("launch_check", "live", ORIGIN + "/", ORIGIN, 12))
        self.assertRegex(report["generated_at"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")

    def test_the_report_file_may_be_in_a_folder_that_does_not_exist_yet(self) -> None:
        target = self.folder / "deep" / "er" / "report.json"
        with captured():
            code = run_cli(lambda args: launch_check.main(args, fetch=build_web()), ["--base-url", ORIGIN, "--mode", "live", "--json", str(target)])
        self.assertEqual(code, 0)
        self.assertTrue(json.loads(target.read_text(encoding="utf-8"))["passed"])


class FailureCaseTests(CommandTestCase):
    """The failure cases of the brief's acceptance list, then the extra checks from the Phase 1 and 2 reviews.

    Each case puts one fault into the good site and expects exactly the checks that fault should trip.
    """

    def expect(self, web: FakeWeb, failed: Set[str], mode: str = "live") -> RunResult:
        result = self.run_command(web, mode=mode)
        self.assertEqual(result.failed_ids, failed, result.out)
        self.assertEqual(result.code, 1)
        self.assertIn("Result: FAIL", result.out)
        return result

    # -- the brief's acceptance list ------------------------------------------------------------------------------

    def test_a_missing_canonical(self) -> None:
        web = edit_page(build_web(), ABOUT, '<link rel="canonical" href="https://numaliving.us/about/"/>', "")
        result = self.expect(web, {"canonical"})
        self.assertEqual(result.check("canonical")["failures"], [{"url": ABOUT, "message": "no canonical link"}])
        self.assertIn(f"{ABOUT}  no canonical link", result.out)

    def test_a_duplicate_title(self) -> None:
        web = edit_page(build_web(), PROJECTS, "<title>Millwork Projects and Case Studies | Numa Living</title>", ABOUT_TITLE)
        result = self.expect(web, {"title-unique"})
        self.assertEqual({failure["url"] for failure in result.check("title-unique")["failures"]}, {ABOUT, PROJECTS})

    def test_noindex_in_live_mode(self) -> None:
        web = edit_page(build_web(), ABOUT, 'content="index, follow"', 'content="noindex, nofollow"')
        self.expect(web, {"robots-meta", "sitemap-no-noindex"})

    def test_an_indexable_page_in_preview_mode(self) -> None:
        web = edit_page(build_web(mode="preview"), ABOUT, 'content="noindex, nofollow"', 'content="index, follow"')
        self.expect(web, {"robots-meta"}, mode="preview")

    def test_a_sitemap_that_lists_a_noindex_page(self) -> None:
        sitemap = swap(launch_text("sitemap-live.xml"), "</urlset>", "<url><loc>https://numaliving.us/login/</loc><lastmod>2026-10-18</lastmod></url></urlset>")
        web = build_web().add(ORIGIN + "/sitemap.xml", sitemap, content_type="application/xml")
        result = self.expect(web, {"sitemap-no-noindex"})
        self.assertEqual([failure["url"] for failure in result.check("sitemap-no-noindex")["failures"]], [LOGIN])

    def test_bad_json_ld(self) -> None:
        web = edit_page(build_web(), ABOUT, '"@type":"WebSite","name":"Numa Living","url":"https://numaliving.us/"}', '"@type":"WebSite","name":')
        result = self.expect(web, {"json-ld-valid"})
        self.assertIn("not valid JSON", result.check("json-ld-valid")["failures"][0]["message"])

    # -- the extra checks from the Phase 1 and 2 reviews -----------------------------------------------------------

    def test_a_placeholder_phone_in_structured_data(self) -> None:
        web = edit_page(build_web(), CONTACT, '"telephone":"+1-512-555-0147"', '"telephone":"+971 4 000 0000"')
        self.expect(web, {"json-ld-placeholders"})

    def test_a_phone_in_structured_data_that_the_page_does_not_show(self) -> None:
        web = edit_page(build_web(), CONTACT, "+1 (512) 555-0147</a> during", "our office</a> during")
        self.expect(web, {"json-ld-placeholders"})

    def test_a_skipped_heading_level(self) -> None:
        web = edit_page(build_web(), ABOUT, "<h1>About Numa Living</h1>", "<h1>About Numa Living</h1><h3>Too deep</h3>")
        self.expect(web, {"heading-order"})

    def test_two_h1_headings(self) -> None:
        web = edit_page(build_web(), ABOUT, "<h1>About Numa Living</h1>", "<h1>About Numa Living</h1><h1>Again</h1>")
        self.expect(web, {"h1-single"})

    def test_two_title_elements(self) -> None:
        web = edit_page(build_web(), ABOUT, "</head>", "<title>Second</title></head>")
        self.expect(web, {"title-single"})

    def test_a_share_image_that_is_missing(self) -> None:
        result = self.expect(build_web().remove(ORIGIN + "/og/home.jpg"), {"share-images"})
        self.assertIn("HTTP 404", result.check("share-images")["failures"][0]["message"])

    def test_a_share_image_that_is_really_an_html_page(self) -> None:
        web = build_web().add(ORIGIN + "/og/default.jpg", "<html>login</html>", content_type=HTML_TYPE)
        result = self.expect(web, {"share-images"})
        self.assertIn("content type is text/html", result.check("share-images")["failures"][0]["message"])

    def test_the_login_page_indexable_in_a_live_site(self) -> None:
        web = edit_page(build_web(), LOGIN, 'content="noindex, nofollow"', 'content="index, follow"')
        self.expect(web, {"robots-meta", "login-noindex"})

    def test_the_login_page_indexable_in_a_preview(self) -> None:
        web = edit_page(build_web(mode="preview"), LOGIN, 'content="noindex, nofollow"', 'content="index, follow"')
        self.expect(web, {"robots-meta", "login-noindex"}, mode="preview")

    # -- the rest of the list in the brief -------------------------------------------------------------------------

    def test_a_description_that_is_too_short(self) -> None:
        old = 'name="description" content="Send drawings and a bid date to the Numa Living team for a millwork quote, or call during US business hours to talk through scope and schedule."'
        self.expect(edit_page(build_web(), CONTACT, old, 'name="description" content="Too short."'), {"description-length"})

    def test_a_page_with_no_open_graph_image(self) -> None:
        web = edit_page(build_web(), ABOUT, '<meta property="og:image" content="https://numaliving.us/og/default.jpg"/>', "")
        self.expect(web, {"open-graph"})

    def test_an_image_without_alt_text(self) -> None:
        web = edit_page(build_web(), ABOUT, '<img src="/logo.svg" alt="Numa Living" width="120" height="32"/>', '<img src="/logo.svg" width="120" height="32"/>')
        self.expect(web, {"images-alt-size"})

    def test_a_link_to_a_missing_page(self) -> None:
        web = edit_page(build_web(), ABOUT, '<a href="/projects/">shop drawings</a>', '<a href="/missing/">shop drawings</a>')
        self.expect(web, {"links-resolve"})

    def test_a_script_loaded_over_http(self) -> None:
        web = edit_page(build_web(), ABOUT, 'src="/_next/static/chunks/main.js"', 'src="http://cdn.example.test/main.js"')
        self.expect(web, {"no-http-resources"})

    def test_a_page_that_is_not_english_us(self) -> None:
        self.expect(edit_page(build_web(), ABOUT, '<html lang="en-US">', '<html lang="en">'), {"html-lang"})

    def test_an_index_html_without_a_canonical(self) -> None:
        web = build_web()
        web.add(ORIGIN + "/index.html", web.body_of(HOME).replace('<link rel="canonical" href="https://numaliving.us/"/>', ""))
        self.expect(web, {"index-html-canonical"})

    def test_a_404_page_that_can_be_indexed(self) -> None:
        html = launch_text("not-found.html").replace('<meta name="robots" content="noindex, nofollow"/>', "")
        self.expect(build_web().add(ORIGIN + MISSING_PAGE_PATH, html, status=404), {"missing-page-404"})

    def test_a_robots_txt_without_a_sitemap_line(self) -> None:
        self.expect(build_web().add(ORIGIN + "/robots.txt", "User-agent: *\nAllow: /\n", content_type="text/plain"), {"robots-txt"})

    def test_a_robots_txt_that_shuts_everyone_out(self) -> None:
        web = build_web().add(ORIGIN + "/robots.txt", launch_text("robots-live.txt") + "\nUser-agent: *\nDisallow: /\n", content_type="text/plain")
        self.expect(web, {"robots-txt"})

    def test_a_page_missing_from_the_sitemap(self) -> None:
        sitemap = swap(launch_text("sitemap-live.xml"), "<url><loc>https://numaliving.us/contact/</loc><lastmod>2026-10-18</lastmod></url>\n", "")
        self.expect(build_web().add(ORIGIN + "/sitemap.xml", sitemap, content_type="application/xml"), {"sitemap-complete"})

    def test_a_preview_whose_sitemap_lists_pages(self) -> None:
        web = build_web(mode="preview").add(ORIGIN + "/sitemap.xml", launch_text("sitemap-live.xml"), content_type="application/xml")
        self.expect(web, {"sitemap-empty"}, mode="preview")

    def test_http_that_does_not_redirect(self) -> None:
        self.expect(build_web().add("http://numaliving.us/", "<title>x</title>"), {"redirect-https"})

    def test_a_crawl_cut_short_by_the_page_limit_cannot_pass(self) -> None:
        result = self.run_command(build_web(), "--max-pages", "2")
        self.assertEqual(result.code, 1)
        self.assertEqual(result.failed_ids, {"crawl-complete"})
        self.assertIn("raise --max-pages", result.out)

    def test_a_home_page_that_is_down_fails_the_run_without_a_crash(self) -> None:
        web = build_web().add(HOME, error="Connection refused")
        result = self.run_command(web)
        self.assertEqual(result.code, 1)
        self.assertIn("status-200", result.failed_ids)
        self.assertIn(f"{HOME}  Connection refused", result.out)


class HostilePageTests(CommandTestCase):
    def test_page_text_cannot_write_to_the_terminal_or_break_the_report(self) -> None:
        hostile = f"Acme{ESC}]0;pwned\x07 Co{ESC}[2J‮reversed " + "x" * 70
        web = edit_page(build_web(), ABOUT, ABOUT_TITLE, f"<title>{hostile}</title>")
        result = self.run_command(web)
        self.assertEqual(result.code, 1)
        self.assertEqual(unsafe_characters(result.out + result.err), [])
        self.assertIn("\\x1b]0;pwned\\x07", result.out)
        self.assertEqual(result.report["checks"][0]["id"], "status-200")

    def test_broken_markup_odd_addresses_and_huge_pages_are_findings_not_crashes(self) -> None:
        nasty = (
            "<html lang=en-US><head><title>" + "t" * 100_000 + "<meta name=robots content=" + "\x00" * 10
            + "<a href='http://[::1/'>x</a><a href='mailto:'>m</a><a href='/a b/'>space</a><a href='javascript:x'>j</a>"
            + "<div>" * 5000 + "<h1><h3><h1>" + "<script type='application/ld+json'>[[[[[{</script>" * 3
            + "<img src=x><img srcset=',,,'><link rel=canonical href='http://[::1/'>"
        )
        result = self.run_command(build_web().add(ABOUT, nasty))
        self.assertEqual(result.code, 1)
        self.assertNotIn("Traceback", result.err)
        self.assertIn("Result: FAIL", result.out)
        self.assertEqual(unsafe_characters(result.out + result.err), [])

    def test_bytes_that_are_not_utf8_do_not_stop_the_run(self) -> None:
        web = build_web().add(ABOUT, b"<html><head><title>Caf\xe9</title></head><body><h1>Caf\xe9</h1></body></html>")
        result = self.run_command(web)
        self.assertEqual(result.code, 1)
        self.assertEqual(result.check("title-single")["status"], "PASS")

    def test_a_page_that_redirects_forever_is_a_failed_fetch(self) -> None:
        web = build_web().redirect(ABOUT, ABOUT + "?x=1").redirect(ABOUT + "?x=1", ABOUT)
        result = self.run_command(web)
        self.assertEqual(result.code, 1)
        self.assertIn("too many redirects", result.out)


class LoopbackCase(CommandTestCase):
    """A whole run through the real PoliteFetcher and urllib against a server on 127.0.0.1 (nothing leaves the machine)."""

    mode = "live"

    def setUp(self) -> None:
        super().setUp()
        proxies = mock.patch("urllib.request.getproxies", return_value={})  # never send loopback traffic to a proxy
        proxies.start()
        self.addCleanup(proxies.stop)

    def routes(self) -> Dict[str, Page]:
        """The good site of this mode as a server would send it, with production canonicals in the pages."""
        html = [("Content-Type", HTML_TYPE)]
        marker = b"index, follow" if self.mode == "live" else b"noindex, nofollow"
        routes = {path: Page(200, launch_text(page_file(path)).encode().replace(b"index, follow", marker), html) for path in PAGE_PATHS}
        routes["/index.html"] = routes["/"]
        routes["/robots.txt"] = Page(200, launch_text(f"robots-{self.mode}.txt").encode(), [("Content-Type", "text/plain")])
        routes["/sitemap.xml"] = Page(200, launch_text(f"sitemap-{self.mode}.xml").encode(), [("Content-Type", "application/xml")])
        routes[MISSING_PAGE_PATH] = Page(404, launch_text("not-found.html").encode(), html)
        for name in ("home", "default"):
            routes[f"/og/{name}.jpg"] = Page(200, b"\xff\xd8\xff\xe0 jpeg bytes", [("Content-Type", "image/jpeg")])
        routes["/about"] = Page(301, b"", [("Location", "/about/")])
        return routes

    def serve(self, routes: Dict[str, Page]) -> LoopbackServer:
        server = LoopbackServer(routes)
        server.__enter__()
        self.addCleanup(server.__exit__, None, None, None)
        return server

    def run_against(self, server: LoopbackServer) -> RunResult:
        return self.run_command(None, "--delay", "0", mode=self.mode, base=server.url("/"))

    def disallow_about(self, routes: Dict[str, Page]) -> None:
        extra = b"Sitemap: https://numaliving.us/sitemap.xml\n" if self.mode == "live" else b""
        routes["/robots.txt"] = Page(200, b"User-agent: *\nDisallow: /about/\n" + extra, [("Content-Type", "text/plain")])


class LiveLoopbackTests(LoopbackCase):
    def test_a_good_site_passes_over_real_http_with_production_canonicals(self) -> None:
        server = self.serve(self.routes())
        result = self.run_against(server)
        self.assertEqual(result.code, 0, result.out)
        self.assertEqual(result.report["counts"], {"PASS": LIVE_CHECKS - 2, "FAIL": 0, "SKIP": 2})
        self.assertEqual(server.count("/og/home.jpg"), 1)
        self.assertEqual(server.count("/og/default.jpg"), 1)
        self.assertEqual(server.count("/sitemap.xml"), 1)

    def test_a_share_image_with_the_wrong_content_type_fails_over_real_http(self) -> None:
        routes = self.routes()
        routes["/og/default.jpg"] = Page(200, b"<html>not an image</html>", [("Content-Type", "text/html; charset=utf-8")])
        result = self.run_against(self.serve(routes))
        self.assertEqual(result.failed_ids, {"share-images"})
        self.assertIn("content type is text/html", result.check("share-images")["failures"][0]["message"])

    def test_a_share_image_that_is_missing_fails_over_real_http(self) -> None:
        routes = self.routes()
        del routes["/og/home.jpg"]
        self.assertEqual(self.run_against(self.serve(routes)).failed_ids, {"share-images"})

    def test_pages_robots_txt_keeps_out_are_reported_and_never_requested(self) -> None:
        routes = self.routes()
        self.disallow_about(routes)
        server = self.serve(routes)
        result = self.run_against(server)
        self.assertEqual(result.code, 1)
        self.assertIn("status-200", result.failed_ids)
        self.assertIn("links-resolve", result.failed_ids)
        self.assertEqual(server.count("/about/"), 0)

    def test_a_link_that_redirects_is_followed_and_resolves(self) -> None:
        routes = self.routes()
        home = launch_text("home.html").replace('<a href="/about/">About</a>', '<a href="/about">About</a>')
        routes["/"] = Page(200, home.encode(), [("Content-Type", HTML_TYPE)])
        server = self.serve(routes)
        result = self.run_against(server)
        self.assertEqual(result.code, 0, result.out)
        self.assertEqual(server.count("/about"), 1)

    def test_a_dead_port_is_a_failed_run_not_a_crash(self) -> None:
        with captured() as (out, err):
            code = run_cli(lambda args: launch_check.main(args), ["--base-url", f"http://127.0.0.1:{free_port()}/", "--delay", "0"])
        self.assertEqual(code, 1)
        self.assertIn("status-200", out.getvalue())
        self.assertNotIn("Traceback", err.getvalue())


class PreviewLoopbackTests(LoopbackCase):
    mode = "preview"

    def test_a_good_site_passes_over_real_http_with_production_canonicals(self) -> None:
        result = self.run_against(self.serve(self.routes()))
        self.assertEqual(result.code, 0, result.out)
        self.assertEqual(result.report["counts"], {"PASS": PREVIEW_CHECKS - 2, "FAIL": 0, "SKIP": 2})

    def test_an_indexable_page_fails_over_real_http(self) -> None:
        routes = self.routes()
        routes["/about/"] = Page(200, launch_text("about.html").encode(), [("Content-Type", HTML_TYPE)])
        self.assertEqual(self.run_against(self.serve(routes)).failed_ids, {"robots-meta"})

    def test_pages_robots_txt_keeps_out_are_reported_and_never_requested(self) -> None:
        routes = self.routes()
        self.disallow_about(routes)
        server = self.serve(routes)
        result = self.run_against(server)
        self.assertEqual(result.code, 1)
        self.assertEqual(server.count("/about/"), 0)


if __name__ == "__main__":
    unittest.main()
