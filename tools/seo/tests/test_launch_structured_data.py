"""Tests for the JSON-LD checks of the launch check: that the blocks parse, name schema.org, declare an Organization
and (on inner pages) a BreadcrumbList, hold no placeholder, and show their phone and address as text on the page."""

from __future__ import annotations

import json
import unittest
from typing import Dict

from launch_support import FakeWeb, ORIGIN, build_web, edit_page

import launch_page_checks  # noqa: E402
import launch_structured_data  # noqa: E402
from launch_crawl import crawl_site  # noqa: E402
from launch_model import CheckResult, Site  # noqa: E402
from launch_structured_data import parse_structured_data  # noqa: E402

HOME, ABOUT, PROJECTS, CONTACT, LOGIN = (f"{ORIGIN}{path}" for path in ("/", "/about/", "/projects/", "/contact/", "/login/"))
ORGANIZATION = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Numa Living","url":"https://numaliving.us/","logo":"https://numaliving.us/og/home.jpg"}</script>'
CONTACT_ORGANIZATION_START = '"logo":"https://numaliving.us/og/home.jpg","telephone":"+1-512-555-0147",'
IDS = ("json-ld-valid", "json-ld-organization", "json-ld-breadcrumbs", "json-ld-placeholders")


def block(data: object) -> str:
    return '<script type="application/ld+json">' + json.dumps(data) + "</script>"


def run_checks(web: FakeWeb, mode: str = "live") -> Dict[str, CheckResult]:
    site = Site.create(ORIGIN + "/", ORIGIN, mode)
    views = launch_page_checks.build_views(site, crawl_site(site, web, [site.base_url], 60))
    return {result.id: result for result in launch_structured_data.structured_data_checks(views)}


def failures_of(result: CheckResult) -> Dict[str, str]:
    return {failure.url: failure.message for failure in result.failures}


def replace_blocks(web: FakeWeb, url: str, replacement: str) -> FakeWeb:
    """Swap every JSON-LD block of the page at ``url`` for ``replacement``."""
    html = web.body_of(url)
    start, end = html.index('<script type="application/ld+json">'), html.rindex("</script>\n</head>") + len("</script>")
    return web.add(url, html[:start] + replacement + html[end:])


class ParseTests(unittest.TestCase):
    def test_one_organization_object(self) -> None:
        data = parse_structured_data(['{"@context":"https://schema.org","@type":"Organization","name":"A"}'])
        self.assertEqual((data.errors, data.types), ((), frozenset({"Organization"})))

    def test_a_json_array_is_a_list_of_blocks_and_a_graph_is_flattened(self) -> None:
        listed = parse_structured_data(['[{"@context":"https://schema.org","@type":"Organization"},'
                                        '{"@context":"https://schema.org","@type":"WebSite"}]'])
        graph = parse_structured_data(['{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":"WebSite"}]}'])
        self.assertEqual(listed.types, frozenset({"Organization", "WebSite"}))
        self.assertEqual(graph.types, frozenset({"Organization", "WebSite"}))
        self.assertEqual((listed.errors, graph.errors), ((), ()))

    def test_a_type_list_gives_every_type(self) -> None:
        data = parse_structured_data(['{"@context":"https://schema.org","@type":["Organization","LocalBusiness"]}'])
        self.assertEqual(data.types, frozenset({"Organization", "LocalBusiness"}))

    def test_a_type_nested_inside_another_entity_is_not_declared_on_the_page(self) -> None:
        data = parse_structured_data(['{"@context":"https://schema.org","@type":"Article","publisher":{"@type":"Organization"}}'])
        self.assertEqual(data.types, frozenset({"Article"}))

    def test_a_graph_that_is_not_a_list_and_members_that_are_not_objects_are_ignored(self) -> None:
        self.assertEqual(parse_structured_data(['{"@context":"https://schema.org","@graph":"x","@type":"Thing"}']).types, frozenset({"Thing"}))
        self.assertEqual(parse_structured_data(['{"@context":"https://schema.org","@graph":[1,null,"x",{"@type":"Thing"}]}']).types, frozenset({"Thing"}))

    def test_types_that_are_not_text_are_ignored(self) -> None:
        data = parse_structured_data(['{"@context":"https://schema.org","@type":[1,null,{"x":1},"Thing"]}'])
        self.assertEqual(data.types, frozenset({"Thing"}))

    def test_text_that_is_not_json_is_an_error_naming_the_block(self) -> None:
        data = parse_structured_data(['{"@context":"https://schema.org","@type":"Thing"}', '{"@type":'])
        self.assertEqual(len(data.errors), 1)
        self.assertTrue(data.errors[0].startswith("block 2 is not valid JSON"), data.errors)

    def test_an_empty_block_is_not_valid_json(self) -> None:
        self.assertIn("block 1 is not valid JSON", parse_structured_data([""]).errors[0])

    def test_json_that_is_not_an_object_is_an_error(self) -> None:
        for text in ('"text"', "42", "null", "[1]"):
            with self.subTest(text=text):
                self.assertIn("is not a JSON-LD object", parse_structured_data([text]).errors[0])

    def test_a_block_without_a_schema_org_context_is_an_error(self) -> None:
        for text in ('{"@type":"Thing"}', '{"@context":"https://example.test/ctx","@type":"Thing"}', '{"@context":5,"@type":"Thing"}'):
            with self.subTest(text=text):
                self.assertEqual(parse_structured_data([text]).errors, ("block 1 has no schema.org @context",))

    def test_every_usual_way_to_name_schema_org_is_accepted(self) -> None:
        for context in ('"https://schema.org"', '"http://schema.org"', '"https://schema.org/"', '["https://schema.org", {"x": "y"}]',
                        '{"@vocab": "https://schema.org/"}', '[{"@vocab": "http://schema.org/"}]'):
            with self.subTest(context=context):
                self.assertEqual(parse_structured_data(['{"@context":' + context + ',"@type":"Thing"}']).errors, ())

    def test_a_block_that_cannot_be_read_does_not_stop_the_others(self) -> None:
        data = parse_structured_data(['nope', '{"@context":"https://schema.org","@type":"Thing"}'])
        self.assertEqual(data.types, frozenset({"Thing"}))
        self.assertEqual(len(data.errors), 1)

    def test_nesting_deeper_than_python_can_read_is_an_error_not_a_crash(self) -> None:
        """json.loads raises RecursionError for this on most Pythons and returns the nested list on 3.15."""
        deep = "[" * 100_000 + "]" * 100_000
        errors = parse_structured_data([deep]).errors
        self.assertEqual(len(errors), 1)
        self.assertRegex(errors[0], r"^block 1 is (not valid JSON: nested too deeply|not a JSON-LD object)$")

    def test_a_deeply_nested_value_inside_a_valid_block_is_walked_without_recursion(self) -> None:
        deep = "[" * 100_000 + '"x"' + "]" * 100_000
        data = parse_structured_data(['{"@context":"https://schema.org","@type":"Thing","deep":' + deep + "}"])
        self.assertEqual(len(data.errors), 0 if "Thing" in data.types else 1)
        self.assertIn(data.types, (frozenset({"Thing"}), frozenset()))

    def test_a_number_with_thousands_of_digits_is_an_error_or_a_number_never_a_crash(self) -> None:
        """From Python 3.11 json.loads refuses 5000 digits with a ValueError; before that it reads them."""
        data = parse_structured_data(['{"@context":"https://schema.org","@type":"Thing","n":' + "1" * 5000 + "}"])
        self.assertEqual(data.types, frozenset() if data.errors else frozenset({"Thing"}))
        self.assertTrue(all(error.startswith("block 1 is not valid JSON") for error in data.errors))

    def test_every_text_value_is_collected_but_no_key_or_number(self) -> None:
        data = parse_structured_data(['{"@context":"https://schema.org","@type":"Thing","a":"one","b":["two",{"c":"three"}],"n":4,"k":null}'])
        self.assertEqual(sorted(data.strings), sorted(["https://schema.org", "Thing", "one", "two", "three"]))

    def test_breadcrumb_lists_are_found_at_the_top_and_in_a_graph(self) -> None:
        top = parse_structured_data(['{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}'])
        graph = parse_structured_data(['{"@context":"https://schema.org","@graph":[{"@type":"BreadcrumbList","itemListElement":[]}]}'])
        self.assertEqual((len(top.breadcrumbs), len(graph.breadcrumbs)), (1, 1))

    def test_telephones_are_found_anywhere_as_text_or_a_list_of_text(self) -> None:
        data = parse_structured_data(['{"@context":"https://schema.org","@type":"Organization","telephone":"+1 512 555 0100",'
                                      '"contactPoint":[{"@type":"ContactPoint","telephone":["+1 512 555 0101", 5]}]}'])
        self.assertEqual(sorted(data.phones), ["+1 512 555 0100", "+1 512 555 0101"])

    def test_addresses_give_the_parts_a_visitor_would_see(self) -> None:
        data = parse_structured_data(['{"@context":"https://schema.org","@type":"Organization","address":'
                                      '[{"@type":"PostalAddress","streetAddress":"1 A Street","addressLocality":"Town","addressRegion":"TX",'
                                      '"postalCode":"75000","addressCountry":"US"},"2 B Road, City",{"addressCountry":"US"},7]}'])
        self.assertEqual(data.addresses, (("1 A Street", "Town", "75000"), ("2 B Road, City",)))

    def test_one_address_object_works_too(self) -> None:
        data = parse_structured_data(['{"@context":"https://schema.org","address":{"streetAddress":"1 A Street"}}'])
        self.assertEqual(data.addresses, (("1 A Street",),))

    def test_the_result_is_immutable_tuples(self) -> None:
        data = parse_structured_data([])
        for name in ("errors", "breadcrumbs", "strings", "phones", "addresses"):
            self.assertIsInstance(getattr(data, name), tuple, name)
        self.assertIsInstance(data.types, frozenset)


class GoodSiteTests(unittest.TestCase):
    def test_the_good_site_passes_all_four_checks(self) -> None:
        results = run_checks(build_web())
        self.assertEqual(tuple(results), IDS)
        self.assertEqual({result.status for result in results.values()}, {"PASS"}, results)

    def test_each_check_is_a_page_check_with_a_title(self) -> None:
        for result in run_checks(build_web()).values():
            self.assertEqual(result.scope, "page")
            self.assertTrue(result.title)

    def test_breadcrumbs_are_judged_on_the_inner_pages_only(self) -> None:
        self.assertEqual(run_checks(build_web())["json-ld-breadcrumbs"].summary, "3 inner pages")

    def test_a_site_with_no_readable_page_has_nothing_to_judge(self) -> None:
        web = build_web().add(HOME, "gone", status=404)
        self.assertEqual({result.status for result in run_checks(web).values()}, {"SKIP"})


class ValidTests(unittest.TestCase):
    def test_invalid_json_on_a_page_fails_and_names_the_block(self) -> None:
        web = edit_page(build_web(), ABOUT, '"@type":"WebSite","name":"Numa Living","url":"https://numaliving.us/"}', '"@type":"WebSite","name":')
        failures = failures_of(run_checks(web)["json-ld-valid"])
        self.assertEqual(sorted(failures), [ABOUT])
        self.assertIn("block 2 is not valid JSON", failures[ABOUT])

    def test_a_page_without_any_block_fails(self) -> None:
        web = replace_blocks(build_web(), ABOUT, "")
        self.assertEqual(failures_of(run_checks(web)["json-ld-valid"]), {ABOUT: "no JSON-LD block"})

    def test_a_missing_context_fails(self) -> None:
        web = edit_page(build_web(), ABOUT, '{"@context":"https://schema.org","@type":"WebSite"', '{"@type":"WebSite"')
        self.assertEqual(failures_of(run_checks(web)["json-ld-valid"]), {ABOUT: "block 2 has no schema.org @context"})

    def test_several_errors_are_listed_together(self) -> None:
        web = replace_blocks(build_web(), ABOUT, '<script type="application/ld+json">{"a"</script><script type="application/ld+json">[1]</script>')
        message = failures_of(run_checks(web)["json-ld-valid"])[ABOUT]
        self.assertIn("block 1 is not valid JSON", message)
        self.assertIn("block 2 is not a JSON-LD object", message)


class OrganizationTests(unittest.TestCase):
    def test_a_page_without_an_organization_fails(self) -> None:
        web = edit_page(build_web(), ABOUT, ORGANIZATION, "")
        self.assertEqual(failures_of(run_checks(web)["json-ld-organization"]), {ABOUT: "no Organization in the JSON-LD"})

    def test_an_organization_that_only_appears_inside_another_entity_does_not_count(self) -> None:
        article = block({"@context": "https://schema.org", "@type": "Article", "publisher": {"@type": "Organization", "name": "A"}})
        web = edit_page(build_web(), ABOUT, ORGANIZATION, article)
        self.assertEqual(sorted(failures_of(run_checks(web)["json-ld-organization"])), [ABOUT])

    def test_an_organization_in_a_graph_counts(self) -> None:
        graph = block({"@context": "https://schema.org", "@graph": [{"@type": "Organization", "name": "A"}]})
        web = edit_page(build_web(), ABOUT, ORGANIZATION, graph)
        self.assertEqual(run_checks(web)["json-ld-organization"].status, "PASS")

    def test_a_page_with_no_json_ld_at_all_has_no_organization_either(self) -> None:
        web = replace_blocks(build_web(), ABOUT, "")
        self.assertEqual(sorted(failures_of(run_checks(web)["json-ld-organization"])), [ABOUT])


class BreadcrumbTests(unittest.TestCase):
    CRUMBS = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://numaliving.us/"},{"@type":"ListItem","position":2,"name":"About","item":"https://numaliving.us/about/"}]}</script>'

    def about_with(self, replacement: str) -> Dict[str, str]:
        return failures_of(run_checks(edit_page(build_web(), ABOUT, self.CRUMBS, replacement))["json-ld-breadcrumbs"])

    def test_an_inner_page_without_a_breadcrumb_list_fails(self) -> None:
        self.assertEqual(self.about_with(""), {ABOUT: "no BreadcrumbList in the JSON-LD"})

    def test_the_home_and_login_pages_need_none(self) -> None:
        results = run_checks(build_web())
        self.assertNotIn(HOME, failures_of(results["json-ld-breadcrumbs"]))
        self.assertNotIn(LOGIN, failures_of(results["json-ld-breadcrumbs"]))

    def test_a_breadcrumb_list_in_a_graph_counts(self) -> None:
        graph = block({"@context": "https://schema.org", "@graph": [{"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home"}]}]})
        self.assertEqual(self.about_with(graph), {})

    def test_an_empty_list_fails(self) -> None:
        crumbs = block({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": []})
        self.assertEqual(self.about_with(crumbs), {ABOUT: "BreadcrumbList has no itemListElement"})

    def test_a_list_that_is_not_a_list_fails(self) -> None:
        crumbs = block({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": {"position": 1}})
        self.assertEqual(self.about_with(crumbs), {ABOUT: "BreadcrumbList has no itemListElement"})

    def test_positions_must_count_up_from_one(self) -> None:
        items = [{"@type": "ListItem", "position": 2, "name": "Home"}]
        crumbs = block({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items})
        self.assertEqual(self.about_with(crumbs), {ABOUT: "breadcrumb 1 has position 2, expected 1"})

    def test_a_position_that_is_text_fails(self) -> None:
        items = [{"@type": "ListItem", "position": "1", "name": "Home"}]
        crumbs = block({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items})
        self.assertIn("has position '1'", self.about_with(crumbs)[ABOUT])

    def test_every_crumb_needs_a_name_which_may_sit_in_the_item(self) -> None:
        nameless = block({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1}]})
        self.assertEqual(self.about_with(nameless), {ABOUT: "breadcrumb 1 has no name"})
        named_in_item = block({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "item": {"@id": "https://numaliving.us/", "name": "Home"}}]})
        self.assertEqual(self.about_with(named_in_item), {})

    def test_a_crumb_that_is_not_an_object_fails(self) -> None:
        crumbs = block({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": ["Home"]})
        self.assertEqual(self.about_with(crumbs), {ABOUT: "breadcrumb 1 is not an object"})

    def test_it_applies_in_preview_mode_too(self) -> None:
        web = edit_page(build_web(mode="preview"), ABOUT, self.CRUMBS, "")
        self.assertEqual(sorted(failures_of(run_checks(web, "preview")["json-ld-breadcrumbs"])), [ABOUT])


class PlaceholderTests(unittest.TestCase):
    def contact_with(self, old: str, new: str) -> Dict[str, str]:
        return failures_of(run_checks(edit_page(build_web(), CONTACT, old, new))["json-ld-placeholders"])

    def test_the_uae_stub_phone_is_a_placeholder(self) -> None:
        failures = self.contact_with('"telephone":"+1-512-555-0147"', '"telephone":"+971 4 000 0000"')
        self.assertIn('structured data contains the placeholder "+971"', failures[CONTACT])
        self.assertIn('"000 0000"', failures[CONTACT])

    def test_a_stub_phone_changed_a_little_is_still_caught_by_its_country_code(self) -> None:
        failures = self.contact_with('"telephone":"+1-512-555-0147"', '"telephone":"+971 4 000 0001"')
        self.assertIn('"+971"', failures[CONTACT])

    def test_the_stub_address_is_a_placeholder_whatever_its_case(self) -> None:
        for text in ("Factory address, Dubai, UAE.", "FACTORY ADDRESS", "The factory address is here"):
            with self.subTest(text=text):
                failures = self.contact_with('"streetAddress":"100 Example Street"', f'"streetAddress":"{text}"')
                self.assertIn('the placeholder "Factory address"', failures[CONTACT])

    def test_a_placeholder_in_any_text_of_any_page_is_found(self) -> None:
        web = edit_page(build_web(), ABOUT, '"name":"Numa Living","url":"https://numaliving.us/","logo"', '"name":"Numa Living","description":"Call 000 0000","url":"https://numaliving.us/","logo"')
        self.assertEqual(sorted(failures_of(run_checks(web)["json-ld-placeholders"])), [ABOUT])

    def test_a_phone_shown_on_the_page_in_another_format_passes(self) -> None:
        for shown in ("512.555.0147", "(512) 555-0147", "+1 512 555 0147", "1-512-555-0147", "5125550147"):
            with self.subTest(shown=shown):
                failures = self.contact_with("+1 (512) 555-0147</a> during", f"{shown}</a> during")
                self.assertEqual(failures, {})

    def test_a_phone_the_page_does_not_show_fails(self) -> None:
        failures = self.contact_with("+1 (512) 555-0147</a> during", "our office</a> during")
        self.assertEqual(failures, {CONTACT: 'telephone "+1-512-555-0147" is not shown as text on the page'})

    def test_a_phone_that_is_only_in_a_tel_link_is_not_shown(self) -> None:
        failures = self.contact_with('<a href="tel:+15125550147">+1 (512) 555-0147</a>', '<a href="tel:+15125550147">Call us</a>')
        self.assertEqual(sorted(failures), [CONTACT])

    def test_a_different_phone_on_the_page_fails(self) -> None:
        failures = self.contact_with("+1 (512) 555-0147</a> during", "+1 (512) 555-0199</a> during")
        self.assertEqual(sorted(failures), [CONTACT])

    def test_a_phone_with_too_few_digits_is_never_shown(self) -> None:
        failures = self.contact_with('"telephone":"+1-512-555-0147"', '"telephone":"TBD"')
        self.assertIn('telephone "TBD" is not shown', failures[CONTACT])

    def test_each_telephone_of_a_list_must_be_shown(self) -> None:
        failures = self.contact_with('"telephone":"+1-512-555-0147"', '"telephone":["+1-512-555-0147","+1-512-555-0100"]')
        self.assertEqual(failures, {CONTACT: 'telephone "+1-512-555-0100" is not shown as text on the page'})

    def test_a_telephone_inside_a_contact_point_must_be_shown_too(self) -> None:
        failures = self.contact_with('"telephone":"+1-512-555-0147",', '"contactPoint":{"@type":"ContactPoint","telephone":"+1-512-555-0100"},')
        self.assertEqual(sorted(failures), [CONTACT])

    def test_an_address_part_the_page_does_not_show_fails(self) -> None:
        failures = self.contact_with("Office: 100 Example Street, Testville, TX 75000", "Office: by appointment")
        self.assertEqual(failures, {CONTACT: 'address "100 Example Street" is not shown as text on the page; '
                                             'address "Testville" is not shown as text on the page; address "75000" is not shown as text on the page'})

    def test_an_address_shown_with_other_punctuation_and_case_passes(self) -> None:
        failures = self.contact_with("Office: 100 Example Street, Testville, TX 75000", "OFFICE: 100 EXAMPLE STREET - Testville (TX) 75000")
        self.assertEqual(failures, {})

    def test_a_part_of_a_word_is_not_the_word(self) -> None:
        failures = self.contact_with("Office: 100 Example Street, Testville, TX 75000", "Office: 100 Example Street, Testvilleton, TX 750001")
        self.assertIn('"Testville"', failures[CONTACT])
        self.assertIn('"75000"', failures[CONTACT])

    def test_an_address_written_as_one_text_must_be_shown_whole(self) -> None:
        old = '"address":{"@type":"PostalAddress","streetAddress":"100 Example Street","addressLocality":"Testville","addressRegion":"TX","postalCode":"75000","addressCountry":"US"}'
        self.assertEqual(self.contact_with(old, '"address":"100 Example Street, Testville, TX 75000"'), {})
        self.assertEqual(sorted(self.contact_with(old, '"address":"9 Other Road, Elsewhere"')), [CONTACT])

    def test_contact_details_in_the_markup_of_a_page_that_does_not_show_them_fail_there(self) -> None:
        phone = '"logo":"https://numaliving.us/og/home.jpg","telephone":"+1-512-555-0147"'
        web = edit_page(build_web(), HOME, '"logo":"https://numaliving.us/og/home.jpg"', phone)
        self.assertEqual(sorted(failures_of(run_checks(web)["json-ld-placeholders"])), [HOME])

    def test_nothing_is_flagged_when_no_contact_details_are_marked_up(self) -> None:
        web = edit_page(build_web(), CONTACT, CONTACT_ORGANIZATION_START, '"logo":"https://numaliving.us/og/home.jpg",')
        self.assertTrue(web.body_of(CONTACT))
        self.assertEqual(run_checks(web)["json-ld-placeholders"].status, "PASS")


class HelperTests(unittest.TestCase):
    def test_words_lower_case_and_drop_punctuation(self) -> None:
        self.assertEqual(launch_structured_data.words(" 100 Example-Street, (TX)\n75000 "), "100 example street tx 75000")

    def test_text_is_shown_only_as_whole_words(self) -> None:
        shown = launch_structured_data.words("Our office: 100 Example Street, Testville")
        self.assertTrue(launch_structured_data.shows(shown, "100 example street"))
        self.assertFalse(launch_structured_data.shows(shown, "Example Stre"))
        self.assertFalse(launch_structured_data.shows(shown, "  "))

    def test_phone_digits_may_be_split_by_any_separator(self) -> None:
        lines = ("Call +1 (512) 555-0147 today",)
        self.assertTrue(launch_structured_data.phone_is_shown("+1-512-555-0147", lines))
        self.assertTrue(launch_structured_data.phone_is_shown("512 555 0147", lines))
        self.assertFalse(launch_structured_data.phone_is_shown("+1-512-555-0100", lines))
        self.assertFalse(launch_structured_data.phone_is_shown("555", lines))
        self.assertFalse(launch_structured_data.phone_is_shown("", lines))

    def test_a_national_number_with_a_leading_zero_matches_the_international_one(self) -> None:
        self.assertTrue(launch_structured_data.phone_is_shown("+971 4 123 4567", ("Call 04 123 4567",)))

    def test_digits_in_two_lines_are_never_joined(self) -> None:
        self.assertFalse(launch_structured_data.phone_is_shown("512 555 0147", ("Suite 512", "555 0147 ext")))
        self.assertTrue(launch_structured_data.phone_is_shown("555 0147", ("Suite 512", "555 0147 ext")))

    def test_only_the_country_code_may_be_left_off_never_the_area_code(self) -> None:
        self.assertTrue(launch_structured_data.phone_is_shown("+1 512 555 0147", ("512 555 0147",)))
        self.assertFalse(launch_structured_data.phone_is_shown("+1 512 555 0147", ("555 0147",)))
        self.assertFalse(launch_structured_data.phone_is_shown("512 555 0147", ("555 0147",)))

    def test_the_markers_are_the_ones_the_stub_contact_details_use(self) -> None:
        self.assertEqual(launch_structured_data.PLACEHOLDER_MARKERS, ("+971", "Factory address", "000 0000"))


if __name__ == "__main__":
    unittest.main()
