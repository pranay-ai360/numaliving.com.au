"""Tests for the per-page checks of the launch check, run over the hand-written good site in tests/fixtures/launch/
with one fault put in at a time. Every failure case checks which page is named and what is said about it."""

from __future__ import annotations

import unittest
from typing import Dict, Optional, Sequence

from launch_support import FakeWeb, HTML_TYPE, ORIGIN, build_web, edit_page

import launch_page_checks  # noqa: E402
from fetch_pages import FetchResult  # noqa: E402
from html_facts import extract_facts  # noqa: E402
from launch_crawl import Crawl, crawl_site  # noqa: E402
from launch_model import CheckResult, Site  # noqa: E402

LOCAL = "http://127.0.0.1:4573"
HOME, ABOUT, PROJECTS, CONTACT, LOGIN = (f"{ORIGIN}{path}" for path in ("/", "/about/", "/projects/", "/contact/", "/login/"))
LIVE_IDS = (
    "status-200", "title-single", "title-unique", "title-length", "description-present", "description-unique",
    "description-length", "canonical", "robots-meta", "html-lang", "h1-single", "heading-order", "open-graph",
    "twitter-card", "images-alt-size", "links-resolve", "no-http-resources",
)
PREVIEW_IDS = tuple(check_id for check_id in LIVE_IDS if check_id != "description-length")


def run_checks(
    web: FakeWeb,
    mode: str = "live",
    base: str = ORIGIN,
    seeds: Optional[Sequence[str]] = None,
    max_pages: int = 60,
) -> Dict[str, CheckResult]:
    site = Site.create(base + "/", ORIGIN, mode)
    crawl = crawl_site(site, web, seeds or [site.base_url], max_pages)
    views = launch_page_checks.build_views(site, crawl)
    return {result.id: result for result in launch_page_checks.page_checks(site, views, crawl)}


def failures_of(result: CheckResult) -> Dict[str, str]:
    return {failure.url: failure.message for failure in result.failures}


def statuses(results: Dict[str, CheckResult]) -> Dict[str, str]:
    return {check_id: result.status for check_id, result in results.items()}


class GoodSiteTests(unittest.TestCase):
    def test_the_good_live_site_passes_every_page_check_in_order(self) -> None:
        results = launch_page_checks.page_checks(*self.parts(build_web()))
        self.assertEqual([result.id for result in results], list(LIVE_IDS))
        self.assertEqual({result.status for result in results}, {"PASS"}, [r for r in results if r.status != "PASS"])

    def test_the_good_preview_site_passes_without_the_description_length(self) -> None:
        results = launch_page_checks.page_checks(*self.parts(build_web(mode="preview"), "preview"))
        self.assertEqual([result.id for result in results], list(PREVIEW_IDS))
        self.assertEqual({result.status for result in results}, {"PASS"}, [r for r in results if r.status != "PASS"])

    def test_a_local_copy_whose_canonicals_name_production_passes(self) -> None:
        results = run_checks(build_web(LOCAL), base=LOCAL)
        self.assertEqual({result.status for result in results.values()}, {"PASS"})

    def test_every_result_is_a_page_check_with_a_title_and_a_count(self) -> None:
        for result in launch_page_checks.page_checks(*self.parts(build_web())):
            with self.subTest(check=result.id):
                self.assertEqual(result.scope, "page")
                self.assertTrue(result.title)
                self.assertRegex(result.summary, r"^\d+ ")

    def test_the_good_site_has_five_pages(self) -> None:
        site, views, _ = self.parts(build_web())
        self.assertEqual([view.path for view in views], ["/", "/about/", "/projects/", "/contact/", "/login/"])

    def parts(self, web: FakeWeb, mode: str = "live"):  # type: ignore[no-untyped-def]
        site = Site.create(ORIGIN + "/", ORIGIN, mode)
        crawl = crawl_site(site, web, [site.base_url], 60)
        return site, launch_page_checks.build_views(site, crawl), crawl


class ViewTests(unittest.TestCase):
    def views(self, web: FakeWeb, mode: str = "live", base: str = ORIGIN, seeds: Optional[Sequence[str]] = None):  # type: ignore[no-untyped-def]
        site = Site.create(base + "/", ORIGIN, mode)
        crawl = crawl_site(site, web, seeds or [site.base_url], 60)
        return launch_page_checks.build_views(site, crawl)

    def test_a_view_knows_its_path_expected_canonical_and_noindex_expectation(self) -> None:
        views = {view.path: view for view in self.views(build_web(LOCAL), base=LOCAL)}
        self.assertEqual(views["/about/"].url, LOCAL + "/about/")
        self.assertEqual(views["/about/"].expected_canonical, ORIGIN + "/about/")
        self.assertFalse(views["/about/"].noindex_expected)
        self.assertTrue(views["/login/"].noindex_expected)

    def test_a_preview_expects_noindex_everywhere(self) -> None:
        self.assertEqual({view.noindex_expected for view in self.views(build_web(mode="preview"), "preview")}, {True})

    def test_pages_that_do_not_answer_200_html_are_not_views(self) -> None:
        web = build_web()
        web.add(HOME + "gone/", "x", status=404).add(HOME + "data.json", "{}", content_type="application/json")
        edit_page(web, HOME, '<a href="/about/">About</a>', '<a href="/gone/">G</a><a href="/data.json">D</a><a href="/about/">About</a>')
        paths = [view.path for view in self.views(web)]
        self.assertNotIn("/gone/", paths)
        self.assertNotIn("/data.json", paths)
        self.assertIn("/about/", paths)

    def test_two_addresses_that_end_at_one_page_make_one_view(self) -> None:
        web = build_web().redirect(HOME + "about", ABOUT)
        edit_page(web, HOME, '<a href="/about/">About</a>', '<a href="/about">About</a><a href="/about/">Again</a>')
        views = self.views(web)
        self.assertEqual([view.path for view in views].count("/about/"), 1)

    def test_a_page_that_redirects_off_the_site_is_not_a_view(self) -> None:
        web = build_web().redirect(HOME + "away/", "https://other.example.test/").add("https://other.example.test/", "<title>x</title>")
        edit_page(web, HOME, '<a href="/about/">About</a>', '<a href="/away/">Away</a><a href="/about/">About</a>')
        self.assertNotIn("/away/", [view.path for view in self.views(web)])


class RobotsTokenTests(unittest.TestCase):
    def tokens(self, html: str, headers=()):  # type: ignore[no-untyped-def]
        return launch_page_checks.robots_tokens(extract_facts(html, ORIGIN + "/"), headers)

    def test_meta_tags_are_split_on_commas_and_lower_cased(self) -> None:
        self.assertEqual(self.tokens('<meta name="robots" content="NoIndex , Follow">'), {"noindex", "follow"})

    def test_every_robots_style_tag_and_the_x_robots_tag_header_count(self) -> None:
        html = '<meta name="robots" content="index"><meta name="googlebot" content="nofollow">'
        self.assertEqual(self.tokens(html, (("x-robots-tag", "noarchive"),)), {"index", "nofollow", "noarchive"})

    def test_a_user_agent_in_front_of_a_header_directive_is_ignored(self) -> None:
        self.assertEqual(self.tokens("", (("x-robots-tag", "googlebot: noindex, nosnippet"),)), {"noindex", "nosnippet"})

    def test_directives_with_a_value_keep_their_name_and_value(self) -> None:
        self.assertEqual(self.tokens('<meta name="robots" content="max-image-preview:large">'), {"max-image-preview:large"})

    def test_noindex_and_none_mean_noindex_and_nofollow_and_none_mean_nofollow(self) -> None:
        self.assertTrue(launch_page_checks.has_noindex(frozenset({"noindex"})))
        self.assertTrue(launch_page_checks.has_noindex(frozenset({"none"})))
        self.assertFalse(launch_page_checks.has_noindex(frozenset({"index", "nofollow"})))
        self.assertTrue(launch_page_checks.has_nofollow(frozenset({"none"})))
        self.assertFalse(launch_page_checks.has_nofollow(frozenset({"noindex"})))

    def test_a_page_without_any_directive_gives_an_empty_set(self) -> None:
        self.assertEqual(self.tokens("<p>hi</p>"), frozenset())


class StatusTests(unittest.TestCase):
    def test_a_missing_home_page_fails_and_the_other_checks_have_nothing_to_judge(self) -> None:
        web = build_web()
        web.add(HOME, "gone", status=404)
        results = run_checks(web)
        self.assertEqual(results["status-200"].status, "FAIL")
        self.assertEqual(failures_of(results["status-200"]), {HOME: "HTTP 404"})
        self.assertEqual(results["title-single"].status, "SKIP")

    def test_a_failed_fetch_and_a_robots_block_are_named(self) -> None:
        web = build_web().add(ABOUT, error="Connection refused").add(PROJECTS, skipped="robots.txt disallows this URL")
        results = run_checks(web, seeds=[HOME, ABOUT, PROJECTS])
        self.assertEqual(failures_of(results["status-200"]), {ABOUT: "Connection refused", PROJECTS: "robots.txt disallows this URL"})

    def test_a_seeded_address_that_is_not_an_html_page_fails(self) -> None:
        web = build_web().add(HOME + "sitemap.json", "{}", content_type="application/json")
        results = run_checks(web, seeds=[HOME, HOME + "sitemap.json"])
        self.assertIn("not an HTML page", failures_of(results["status-200"])[HOME + "sitemap.json"])

    def test_a_seeded_address_that_ends_on_another_site_fails(self) -> None:
        web = build_web().redirect(ABOUT, "https://other.example.test/").add("https://other.example.test/", "<title>x</title>")
        results = run_checks(web, seeds=[HOME, ABOUT])
        self.assertIn("other.example.test", failures_of(results["status-200"])[ABOUT])

    def test_only_the_seeded_addresses_are_judged(self) -> None:
        web = build_web()
        edit_page(web, HOME, '<a href="/about/">About</a>', '<a href="/gone/">G</a><a href="/about/">About</a>')
        results = run_checks(web)
        self.assertEqual(results["status-200"].status, "PASS")
        self.assertEqual(results["status-200"].summary, "1 pages")


class TitleTests(unittest.TestCase):
    def test_a_page_without_a_title_fails(self) -> None:
        web = edit_page(build_web(), ABOUT, "<title>About the Millwork Factory | Numa Living</title>", "")
        self.assertEqual(failures_of(run_checks(web)["title-single"]), {ABOUT: "no <title> element"})

    def test_two_title_elements_fail(self) -> None:
        web = edit_page(build_web(), ABOUT, "</head>", "<title>Second</title></head>")
        self.assertEqual(failures_of(run_checks(web)["title-single"]), {ABOUT: "2 <title> elements"})

    def test_an_empty_title_fails_title_single(self) -> None:
        web = edit_page(build_web(), ABOUT, "<title>About the Millwork Factory | Numa Living</title>", "<title> </title>")
        self.assertEqual(failures_of(run_checks(web)["title-single"]), {ABOUT: "the <title> is empty"})

    def test_a_title_inside_an_svg_is_not_a_second_title(self) -> None:
        web = edit_page(build_web(), ABOUT, "<h1>About Numa Living</h1>", "<h1>About Numa Living</h1><svg><title>Icon</title></svg>")
        self.assertEqual(run_checks(web)["title-single"].status, "PASS")

    def test_two_pages_with_the_same_title_both_fail_title_unique(self) -> None:
        about_title = "About the Millwork Factory | Numa Living"
        web = edit_page(build_web(), PROJECTS, "<title>Millwork Projects and Case Studies | Numa Living</title>", f"<title>{about_title}</title>")
        failures = failures_of(run_checks(web)["title-unique"])
        self.assertEqual(sorted(failures), [ABOUT, PROJECTS])
        self.assertIn(PROJECTS, failures[ABOUT])
        self.assertIn(ABOUT, failures[PROJECTS])

    def test_titles_that_differ_only_in_case_or_spacing_are_the_same(self) -> None:
        web = edit_page(build_web(), PROJECTS, "<title>Millwork Projects and Case Studies | Numa Living</title>",
                        "<title>  about the millwork   factory | NUMA LIVING </title>")
        self.assertEqual(sorted(failures_of(run_checks(web)["title-unique"])), [ABOUT, PROJECTS])

    def test_three_pages_with_one_title_all_fail(self) -> None:
        web = build_web()
        for url, old in ((PROJECTS, "Millwork Projects and Case Studies"), (CONTACT, "Contact and Quote Requests")):
            edit_page(web, url, f"<title>{old} | Numa Living</title>", "<title>About the Millwork Factory | Numa Living</title>")
        self.assertEqual(sorted(failures_of(run_checks(web)["title-unique"])), [ABOUT, CONTACT, PROJECTS])

    def test_a_title_of_sixty_characters_passes_and_sixty_one_fails(self) -> None:
        old = "<title>About the Millwork Factory | Numa Living</title>"
        sixty = "x" * 60
        self.assertEqual(run_checks(edit_page(build_web(), ABOUT, old, f"<title>{sixty}</title>"))["title-length"].status, "PASS")
        failures = failures_of(run_checks(edit_page(build_web(), ABOUT, old, f"<title>{sixty}y</title>"))["title-length"])
        self.assertIn("61 characters", failures[ABOUT])

    def test_the_length_counts_the_title_as_rendered_not_as_written(self) -> None:
        old = "<title>About the Millwork Factory | Numa Living</title>"
        written = "<title>" + "Fish &amp; " * 6 + "chips</title>"  # 71 characters of source, 47 once shown
        self.assertEqual(len("Fish & " * 6 + "chips"), 47)
        self.assertEqual(run_checks(edit_page(build_web(), ABOUT, old, written))["title-length"].status, "PASS")


class DescriptionTests(unittest.TestCase):
    ABOUT_DESCRIPTION = (
        "How the Numa Living team plans, builds and finishes architectural millwork for US projects, "
        "from shop drawings through factory finishing to delivery."
    )

    def with_description(self, text: str, mode: str = "live") -> Dict[str, CheckResult]:
        web = build_web(mode=mode)
        old = f'<meta name="description" content="{self.ABOUT_DESCRIPTION}"/>'
        return run_checks(edit_page(web, ABOUT, old, f'<meta name="description" content="{text}"/>'), mode)

    def test_a_page_without_a_description_fails(self) -> None:
        web = edit_page(build_web(), ABOUT, f'<meta name="description" content="{self.ABOUT_DESCRIPTION}"/>', "")
        self.assertEqual(failures_of(run_checks(web)["description-present"]), {ABOUT: "no meta description"})

    def test_an_empty_description_fails(self) -> None:
        self.assertEqual(failures_of(self.with_description("  ")["description-present"]), {ABOUT: "no meta description"})

    def test_two_pages_sharing_a_description_both_fail(self) -> None:
        web = build_web()
        old = 'name="description" content="Browse architectural millwork projects built by Numa Living: wall paneling, casework, doors and built-ins for residential and hospitality interiors."'
        edit_page(web, PROJECTS, old, f'name="description" content="{self.ABOUT_DESCRIPTION}"')
        self.assertEqual(sorted(failures_of(run_checks(web)["description-unique"])), [ABOUT, PROJECTS])

    def test_a_description_of_120_and_160_characters_passes_and_119_and_161_fail(self) -> None:
        for length, expected in ((120, "PASS"), (160, "PASS"), (119, "FAIL"), (161, "FAIL")):
            with self.subTest(length=length):
                result = self.with_description("d" * length)["description-length"]
                self.assertEqual(result.status, expected)
                if expected == "FAIL":
                    self.assertIn(f"{length} characters", failures_of(result)[ABOUT])

    def test_the_length_is_measured_after_entities_are_decoded(self) -> None:
        self.assertEqual(self.with_description("&amp;" * 120)["description-length"].status, "PASS")

    def test_the_length_range_belongs_to_live_mode_only(self) -> None:
        results = self.with_description("short", mode="preview")
        self.assertNotIn("description-length", results)
        self.assertEqual(results["description-present"].status, "PASS")


class CanonicalTests(unittest.TestCase):
    ABOUT_CANONICAL = '<link rel="canonical" href="https://numaliving.us/about/"/>'

    def with_canonical(self, replacement: str, base: str = ORIGIN) -> Dict[str, str]:
        web = edit_page(build_web(base), base + "/about/", self.ABOUT_CANONICAL, replacement)
        return failures_of(run_checks(web, base=base)["canonical"])

    def test_a_missing_canonical_fails_and_names_the_page(self) -> None:
        self.assertEqual(self.with_canonical(""), {ABOUT: "no canonical link"})

    def test_an_empty_canonical_fails(self) -> None:
        self.assertEqual(self.with_canonical('<link rel="canonical" href=""/>'), {ABOUT: "no canonical link"})

    def test_a_relative_canonical_fails(self) -> None:
        self.assertIn("not an absolute URL", self.with_canonical('<link rel="canonical" href="/about/"/>')[ABOUT])

    def test_a_canonical_on_another_host_fails_and_shows_both_addresses(self) -> None:
        message = self.with_canonical('<link rel="canonical" href="https://example.test/about/"/>')[ABOUT]
        self.assertIn("https://example.test/about/", message)
        self.assertIn(ORIGIN + "/about/", message)

    def test_a_canonical_to_another_page_of_the_site_fails(self) -> None:
        self.assertIn("expected", self.with_canonical('<link rel="canonical" href="https://numaliving.us/projects/"/>')[ABOUT])

    def test_a_canonical_without_the_trailing_slash_fails(self) -> None:
        self.assertIn("expected", self.with_canonical('<link rel="canonical" href="https://numaliving.us/about"/>')[ABOUT])

    def test_a_canonical_on_http_fails(self) -> None:
        self.assertIn("expected", self.with_canonical('<link rel="canonical" href="http://numaliving.us/about/"/>')[ABOUT])

    def test_two_canonical_links_fail_even_when_equal(self) -> None:
        self.assertEqual(self.with_canonical(self.ABOUT_CANONICAL * 2), {ABOUT: "2 canonical links"})

    def test_a_local_copy_must_still_name_the_canonical_host(self) -> None:
        message = self.with_canonical('<link rel="canonical" href="http://127.0.0.1:4573/about/"/>', base=LOCAL)
        self.assertEqual(sorted(message), [LOCAL + "/about/"])
        self.assertIn(ORIGIN + "/about/", message[LOCAL + "/about/"])


class RobotsMetaTests(unittest.TestCase):
    def page_fault(self, mode: str, url: str, old: str, new: str) -> Dict[str, str]:
        web = edit_page(build_web(mode=mode), url, old, new)
        return failures_of(run_checks(web, mode)["robots-meta"])

    def test_noindex_on_a_live_page_fails(self) -> None:
        failures = self.page_fault("live", ABOUT, 'content="index, follow"', 'content="noindex, follow"')
        self.assertEqual(sorted(failures), [ABOUT])
        self.assertIn("noindex", failures[ABOUT])

    def test_none_and_nofollow_on_a_live_page_fail(self) -> None:
        for content in ("none", "index, nofollow"):
            with self.subTest(content=content):
                self.assertEqual(sorted(self.page_fault("live", ABOUT, 'content="index, follow"', f'content="{content}"')), [ABOUT])

    def test_a_googlebot_tag_that_says_noindex_fails_a_live_page(self) -> None:
        failures = self.page_fault("live", ABOUT, '<meta name="robots" content="index, follow"/>',
                                   '<meta name="robots" content="index, follow"/><meta name="googlebot" content="noindex"/>')
        self.assertEqual(sorted(failures), [ABOUT])

    def test_an_x_robots_tag_header_that_says_noindex_fails_a_live_page(self) -> None:
        web = build_web()
        web.add(ABOUT, web.body_of(ABOUT), headers=(("x-robots-tag", "noindex"),))
        self.assertEqual(sorted(failures_of(run_checks(web)["robots-meta"])), [ABOUT])

    def test_a_page_without_any_robots_tag_is_indexable_and_passes_live(self) -> None:
        web = edit_page(build_web(), ABOUT, '<meta name="robots" content="index, follow"/>', "")
        self.assertEqual(run_checks(web)["robots-meta"].status, "PASS")

    def test_the_login_page_must_stay_noindex_on_a_live_site(self) -> None:
        failures = self.page_fault("live", LOGIN, 'content="noindex, nofollow"', 'content="index, follow"')
        self.assertEqual(sorted(failures), [LOGIN])
        self.assertIn("noindex", failures[LOGIN])

    def test_an_indexable_page_in_preview_mode_fails(self) -> None:
        failures = self.page_fault("preview", ABOUT, 'content="noindex, nofollow"', 'content="index, follow"')
        self.assertEqual(sorted(failures), [ABOUT])
        self.assertIn("indexable", failures[ABOUT])

    def test_a_preview_page_without_a_robots_tag_fails(self) -> None:
        failures = self.page_fault("preview", ABOUT, '<meta name="robots" content="noindex, nofollow"/>', "")
        self.assertEqual(sorted(failures), [ABOUT])

    def test_a_preview_page_that_is_noindex_by_header_alone_passes(self) -> None:
        web = edit_page(build_web(mode="preview"), ABOUT, '<meta name="robots" content="noindex, nofollow"/>', "")
        web.add(ABOUT, web.body_of(ABOUT), headers=(("x-robots-tag", "noindex"),))
        self.assertEqual(run_checks(web, "preview")["robots-meta"].status, "PASS")

    def test_every_preview_page_noindex_passes(self) -> None:
        self.assertEqual(run_checks(build_web(mode="preview"), "preview")["robots-meta"].status, "PASS")


class LanguageTests(unittest.TestCase):
    def lang_failures(self, new: str) -> Dict[str, str]:
        return failures_of(run_checks(edit_page(build_web(), ABOUT, '<html lang="en-US">', new))["html-lang"])

    def test_another_language_tag_fails(self) -> None:
        self.assertEqual(self.lang_failures('<html lang="en">'), {ABOUT: 'lang is "en", expected "en-US"'})
        self.assertEqual(self.lang_failures('<html lang="en-AU">'), {ABOUT: 'lang is "en-AU", expected "en-US"'})

    def test_a_missing_lang_fails(self) -> None:
        self.assertEqual(self.lang_failures("<html>"), {ABOUT: 'no lang attribute on <html>, expected "en-US"'})


class HeadingTests(unittest.TestCase):
    H1 = "<h1>About Numa Living</h1>"

    def about_with(self, replacement: str) -> Dict[str, CheckResult]:
        return run_checks(edit_page(build_web(), ABOUT, self.H1, replacement))

    def test_a_missing_h1_fails(self) -> None:
        self.assertEqual(failures_of(self.about_with("")["h1-single"]), {ABOUT: "no H1 heading"})

    def test_two_h1_headings_fail(self) -> None:
        self.assertEqual(failures_of(self.about_with(self.H1 + "<h1>Again</h1>")["h1-single"]), {ABOUT: "2 H1 headings"})

    def test_an_empty_h1_fails(self) -> None:
        self.assertEqual(failures_of(self.about_with("<h1> </h1>")["h1-single"]), {ABOUT: "the H1 is empty"})

    def test_a_heading_that_skips_a_level_fails(self) -> None:
        failures = failures_of(self.about_with(self.H1 + "<h3>Too deep</h3>")["heading-order"])
        self.assertEqual(failures, {ABOUT: "H3 follows H1 and skips H2: Too deep"})

    def test_a_page_that_starts_below_h1_fails(self) -> None:
        failures = failures_of(self.about_with("<h2>Early</h2>" + self.H1)["heading-order"])
        self.assertEqual(failures, {ABOUT: "H2 comes first and skips H1: Early"})

    def test_going_back_up_any_number_of_levels_is_fine(self) -> None:
        results = self.about_with(self.H1 + "<h2>A</h2><h3>B</h3><h4>C</h4><h2>D</h2>")
        self.assertEqual(results["heading-order"].status, "PASS")

    def test_only_the_first_problem_of_a_page_is_reported(self) -> None:
        failures = failures_of(self.about_with(self.H1 + "<h3>One</h3><h6>Two</h6>")["heading-order"])
        self.assertIn("One", failures[ABOUT])
        self.assertNotIn("Two", failures[ABOUT])


class SocialTagTests(unittest.TestCase):
    def og_failures(self, old: str, new: str) -> Dict[str, str]:
        return failures_of(run_checks(edit_page(build_web(), ABOUT, old, new))["open-graph"])

    def test_each_missing_open_graph_tag_is_named(self) -> None:
        for key in ("title", "description", "url", "image", "type", "locale"):
            with self.subTest(tag=key):
                web = build_web()
                text = web.body_of(ABOUT)
                line = next(line for line in text.splitlines() if line.startswith(f'<meta property="og:{key}"'))
                edit_page(web, ABOUT, line, "")
                self.assertEqual(failures_of(run_checks(web)["open-graph"]), {ABOUT: f"missing og:{key}"})

    def test_several_missing_tags_are_listed_together(self) -> None:
        web = build_web()
        for key in ("type", "locale"):
            line = next(line for line in web.body_of(ABOUT).splitlines() if line.startswith(f'<meta property="og:{key}"'))
            edit_page(web, ABOUT, line, "")
        self.assertEqual(failures_of(run_checks(web)["open-graph"]), {ABOUT: "missing og:type, og:locale"})

    def test_an_empty_tag_counts_as_missing(self) -> None:
        failures = self.og_failures('<meta property="og:type" content="website"/>', '<meta property="og:type" content=" "/>')
        self.assertEqual(failures, {ABOUT: "missing og:type"})

    def test_og_url_must_equal_the_canonical_address(self) -> None:
        failures = self.og_failures('content="https://numaliving.us/about/"/>\n<meta property="og:site_name"',
                                    'content="https://numaliving.us/about"/>\n<meta property="og:site_name"')
        self.assertEqual(failures, {ABOUT: f"og:url is {ORIGIN}/about, expected {ORIGIN}/about/"})

    def test_a_missing_twitter_card_fails(self) -> None:
        web = edit_page(build_web(), ABOUT, '<meta name="twitter:card" content="summary_large_image"/>', "")
        self.assertEqual(failures_of(run_checks(web)["twitter-card"]), {ABOUT: "missing twitter:card"})


class ImageTests(unittest.TestCase):
    LOGO = '<img src="/logo.svg" alt="Numa Living" width="120" height="32"/>'

    def image_failures(self, replacement: str) -> Dict[str, str]:
        return failures_of(run_checks(edit_page(build_web(), ABOUT, self.LOGO, replacement))["images-alt-size"])

    def test_an_image_without_an_alt_attribute_fails(self) -> None:
        self.assertEqual(self.image_failures('<img src="/logo.svg" width="120" height="32"/>'), {ABOUT: "/logo.svg: no alt attribute"})

    def test_an_empty_alt_is_a_decorative_image_and_passes(self) -> None:
        self.assertEqual(self.image_failures('<img src="/logo.svg" alt="" width="120" height="32"/>'), {})

    def test_an_image_without_width_and_height_fails(self) -> None:
        self.assertEqual(self.image_failures('<img src="/logo.svg" alt="Logo"/>'), {ABOUT: "/logo.svg: no width and height"})
        self.assertEqual(self.image_failures('<img src="/logo.svg" alt="Logo" width="120"/>'), {ABOUT: "/logo.svg: no width and height"})

    def test_several_problems_on_one_page_are_summarised(self) -> None:
        images = "".join(f'<img src="/i{number}.jpg">' for number in range(5))
        message = self.image_failures(images)[ABOUT]
        self.assertTrue(message.startswith("/i0.jpg: no alt attribute; /i0.jpg: no width and height; /i1.jpg:"))
        self.assertTrue(message.endswith("(+7 more)"))

    def test_an_image_without_a_source_is_named_as_such(self) -> None:
        self.assertIn("(no src)", self.image_failures('<img alt="x" width="1" height="1" data-x="">  <img alt="y">')[ABOUT])


class LinkTests(unittest.TestCase):
    def link_failures(self, web: FakeWeb) -> Dict[str, str]:
        return failures_of(run_checks(web)["links-resolve"])

    def add_home_link(self, web: FakeWeb, href: str) -> FakeWeb:
        return edit_page(web, HOME, '<a href="/about/">About</a>', f'<a href="{href}">Extra</a><a href="/about/">About</a>')

    def test_a_link_to_a_missing_page_fails_on_the_page_that_carries_it(self) -> None:
        failures = self.link_failures(self.add_home_link(build_web(), "/nowhere/"))
        self.assertEqual(failures, {HOME: f"{ORIGIN}/nowhere/: HTTP 404"})

    def test_a_link_that_cannot_be_fetched_fails_with_the_reason(self) -> None:
        web = self.add_home_link(build_web().add(HOME + "slow/", error="timed out"), "/slow/")
        self.assertEqual(self.link_failures(web), {HOME: f"{ORIGIN}/slow/: timed out"})

    def test_a_link_that_redirects_to_a_working_page_resolves(self) -> None:
        web = self.add_home_link(build_web().redirect(HOME + "old/", ABOUT), "/old/")
        self.assertEqual(self.link_failures(web), {})

    def test_a_link_to_a_file_that_is_not_html_resolves_when_it_answers_200(self) -> None:
        web = self.add_home_link(build_web().add(HOME + "brochure.pdf", b"%PDF", content_type="application/pdf"), "/brochure.pdf")
        self.assertEqual(self.link_failures(web), {})

    def test_every_page_carrying_a_broken_link_is_named(self) -> None:
        web = self.add_home_link(build_web(), "/nowhere/")
        edit_page(web, ABOUT, '<a href="/projects/">shop drawings</a>', '<a href="/nowhere/">shop drawings</a>')
        self.assertEqual(sorted(self.link_failures(web)), [HOME, ABOUT])

    def test_several_broken_links_on_one_page_are_listed_once_each(self) -> None:
        web = edit_page(build_web(), HOME, '<a href="/about/">About</a>',
                        '<a href="/a/">A</a><a href="/b/">B</a><a href="/a/">A again</a><a href="/about/">About</a>')
        self.assertEqual(self.link_failures(web), {HOME: f"{ORIGIN}/a/: HTTP 404; {ORIGIN}/b/: HTTP 404"})

    def test_links_the_crawl_did_not_reach_are_left_to_the_crawl_check(self) -> None:
        results = run_checks(self.add_home_link(build_web(), "/nowhere/"), max_pages=1)
        self.assertEqual(results["links-resolve"].status, "PASS")

    def test_external_mail_and_phone_links_are_not_judged(self) -> None:
        self.assertEqual(self.link_failures(build_web()), {})


class HttpResourceTests(unittest.TestCase):
    def resource_failures(self, new: str) -> Dict[str, str]:
        web = edit_page(build_web(), ABOUT, '<script src="/_next/static/chunks/main.js" async=""></script>', new)
        return failures_of(run_checks(web)["no-http-resources"])

    def test_a_script_over_http_fails(self) -> None:
        failures = self.resource_failures('<script src="http://cdn.example.test/x.js"></script>')
        self.assertEqual(failures, {ABOUT: "loads over http://: http://cdn.example.test/x.js"})

    def test_http_in_a_stylesheet_image_or_srcset_fails(self) -> None:
        new = ('<link rel="stylesheet" href="http://cdn.example.test/a.css"/>'
               '<img src="/p.jpg" srcset="/p-1.jpg 1x, http://cdn.example.test/p-2.jpg 2x" alt="p" width="1" height="1"/>')
        self.assertEqual(self.resource_failures(new)[ABOUT],
                         "loads over http://: http://cdn.example.test/a.css, http://cdn.example.test/p-2.jpg")

    def test_https_and_relative_and_protocol_relative_addresses_pass(self) -> None:
        new = '<script src="https://cdn.example.test/x.js"></script><script src="//cdn.example.test/y.js"></script>'
        self.assertEqual(self.resource_failures(new), {})

    def test_a_link_to_an_http_page_is_not_a_resource(self) -> None:
        web = edit_page(build_web(), ABOUT, "</main>", '<a href="http://other.example.test/">x</a></main>')
        self.assertEqual(run_checks(web)["no-http-resources"].status, "PASS")

    def test_the_scheme_is_matched_without_regard_to_case(self) -> None:
        self.assertEqual(sorted(self.resource_failures('<script src="HTTP://cdn.example.test/x.js"></script>')), [ABOUT])

    def test_many_addresses_on_one_page_are_cut_after_three(self) -> None:
        scripts = "".join(f'<script src="http://c.test/{number}.js"></script>' for number in range(6))
        message = self.resource_failures(scripts)[ABOUT]
        self.assertTrue(message.endswith("http://c.test/2.js (+3 more)"))


class SinglePageTests(unittest.TestCase):
    def test_a_site_of_one_page_has_one_view(self) -> None:
        def fetch(url: str) -> FetchResult:
            return FetchResult(requested=url, final_url=url, status=200, headers=(("content-type", HTML_TYPE),), body=b"<title>x</title>")

        site = Site.create(HOME, ORIGIN, "live")
        crawl: Crawl = crawl_site(site, fetch, [HOME], 5)
        self.assertEqual([view.facts.title for view in launch_page_checks.build_views(site, crawl)], ["x"])


if __name__ == "__main__":
    unittest.main()
