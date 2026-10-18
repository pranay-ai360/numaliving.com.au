"""The JSON-LD checks of the launch check: the blocks parse and name schema.org, every page declares an Organization,
inner pages declare a BreadcrumbList, nothing is a placeholder, and the phone and address in the markup are shown as
text on the same page (structured data must match what a visitor can read).

The blocks come from the web, so nothing in them is trusted: parsing never raises, and the walk over the parsed JSON
is a loop, not recursion, so a deeply nested block cannot exhaust the stack. Standard library only.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, FrozenSet, List, Mapping, Sequence, Tuple

from launch_model import HOME_PATH, LOGIN_PATH, PAGE_SCOPE, CheckResult, judge, listed
from launch_page_checks import PageView
from seo_common import safe_urlsplit

PLACEHOLDER_MARKERS = ("+971", "Factory address", "000 0000")  # what the stub contact details are made of
SCHEMA_ORG_HOSTS = ("schema.org", "www.schema.org")
ORGANIZATION = "Organization"
BREADCRUMB_LIST = "BreadcrumbList"
ADDRESS_PARTS = ("streetAddress", "addressLocality", "postalCode")  # what a visitor sees; region and country are codes
MIN_PHONE_DIGITS = 7
NATIONAL_NUMBER_LENGTH = 10  # a longer number starts with a country code that a page may leave off
NATIONAL_TAIL_LENGTHS = (10, 9, 8)
REASON_CHARS = 80
Rule = Callable[[PageView, "StructuredData"], str]
NOT_DIGITS = re.compile(r"\D")
NOT_WORD = re.compile(r"[\W_]+")


@dataclass(frozen=True)
class StructuredData:
    """What the JSON-LD blocks of one page say, read once for all the checks."""

    errors: Tuple[str, ...]  # a line for each block that is unusable or does not name schema.org
    types: FrozenSet[str]  # the @type of each block and of each @graph member, not of entities nested inside
    breadcrumbs: Tuple[Mapping[str, Any], ...]  # the BreadcrumbList entities
    strings: Tuple[str, ...]  # every text value anywhere in the blocks
    phones: Tuple[str, ...]  # every telephone value
    addresses: Tuple[Tuple[str, ...], ...]  # for each address, the parts that must be visible


def _reason(error: Exception) -> str:
    return "nested too deeply" if isinstance(error, RecursionError) else str(error)[:REASON_CHARS]


def _read_roots(blobs: Sequence[str]) -> Tuple[List[Tuple[int, Dict[str, Any]]], List[str]]:
    """The JSON objects in the blocks (a block may hold an array of them), and a line for each block that fails."""
    roots: List[Tuple[int, Dict[str, Any]]] = []
    errors: List[str] = []
    for number, blob in enumerate(blobs, start=1):
        try:
            value = json.loads(blob)
        except (ValueError, RecursionError) as error:  # bad syntax, too deep, a number with thousands of digits
            errors.append(f"block {number} is not valid JSON: {_reason(error)}")
            continue
        for root in value if isinstance(value, list) else [value]:
            if isinstance(root, dict):
                roots.append((number, root))
            else:
                errors.append(f"block {number} is not a JSON-LD object")
    return roots, errors


def _names_schema_org(context: Any) -> bool:
    pending = [context]
    while pending:
        item = pending.pop()
        if isinstance(item, str):
            parts = safe_urlsplit(item.strip())
            if parts is not None and (parts.hostname or "") in SCHEMA_ORG_HOSTS:
                return True
        elif isinstance(item, list):
            pending.extend(item)
        elif isinstance(item, dict):
            pending.extend(item.values())
    return False


def _types_of(node: Mapping[str, Any]) -> List[str]:
    kind = node.get("@type")
    declared = [kind] if isinstance(kind, str) else kind if isinstance(kind, list) else []
    return [item for item in declared if isinstance(item, str)]


def _top_nodes(root: Dict[str, Any]) -> List[Dict[str, Any]]:
    graph = root.get("@graph")
    return [root] + ([member for member in graph if isinstance(member, dict)] if isinstance(graph, list) else [])


def _texts(value: Any) -> List[str]:
    if isinstance(value, str):
        return [value]
    return [item for item in value if isinstance(item, str)] if isinstance(value, list) else []


def _address_groups(value: Any) -> List[Tuple[str, ...]]:
    """For each address (a text, an object, or a list of those), the pieces of it a visitor would see."""
    groups: List[Tuple[str, ...]] = []
    for item in value if isinstance(value, list) else [value]:
        if isinstance(item, dict):
            parts = tuple(text for key in ADDRESS_PARTS for text in _texts(item.get(key)) if text.strip())
        else:
            parts = tuple(text for text in _texts(item) if text.strip())
        if parts:
            groups.append(parts)
    return groups


def _collect(roots: Sequence[Dict[str, Any]]) -> Tuple[List[str], List[str], List[Tuple[str, ...]]]:
    """Every text, telephone and address in the blocks, in document order, by a loop over the parsed JSON."""
    strings: List[str] = []
    phones: List[str] = []
    addresses: List[Tuple[str, ...]] = []
    pending: List[Any] = list(reversed(roots))
    while pending:
        node = pending.pop()
        if isinstance(node, str):
            strings.append(node)
        elif isinstance(node, list):
            pending.extend(reversed(node))
        elif isinstance(node, dict):
            phones.extend(_texts(node.get("telephone")))
            addresses.extend(_address_groups(node.get("address")))
            pending.extend(reversed(list(node.values())))
    return strings, phones, addresses


def parse_structured_data(blobs: Sequence[str]) -> StructuredData:
    """Read the JSON-LD blocks of a page. Problems become lines in ``errors``; nothing is raised."""
    roots, errors = _read_roots(blobs)
    nodes: List[Dict[str, Any]] = []
    for number, root in roots:
        if not _names_schema_org(root.get("@context")):
            errors.append(f"block {number} has no schema.org @context")
        nodes.extend(_top_nodes(root))
    strings, phones, addresses = _collect([root for _, root in roots])
    return StructuredData(
        errors=tuple(errors),
        types=frozenset(kind for node in nodes for kind in _types_of(node)),
        breadcrumbs=tuple(node for node in nodes if BREADCRUMB_LIST in _types_of(node)),
        strings=tuple(strings),
        phones=tuple(phones),
        addresses=tuple(addresses),
    )


def words(text: str) -> str:
    """Lower-case words separated by single spaces: punctuation and line breaks are gone."""
    return " ".join(NOT_WORD.sub(" ", text.casefold()).split())


def shows(visible_words: str, value: str) -> bool:
    """Whether ``value`` appears in the page text (given as ``words(...)``) as whole words."""
    wanted = words(value)
    return bool(wanted) and f" {wanted} " in f" {visible_words} "


def _phone_forms(phone: str) -> Tuple[str, ...]:
    """The digits a page may show: the whole number, or only its last 10, 9 or 8 digits when it has a country code."""
    digits = NOT_DIGITS.sub("", phone).lstrip("0")
    if len(digits) < MIN_PHONE_DIGITS:
        return ()
    longer = len(digits) > NATIONAL_NUMBER_LENGTH
    return (digits,) + tuple(digits[-length:] for length in NATIONAL_TAIL_LENGTHS if longer)


def phone_is_shown(phone: str, lines: Sequence[str]) -> bool:
    """Whether a line of the page shows the phone, however its digits are spaced or punctuated.

    Lines are compared one at a time, so digits in two places are never joined into a number. A number with a
    country code may be shown without it (and a national number with a leading 0 may be shown with one).
    """
    shown = [NOT_DIGITS.sub("", line) for line in lines]
    return any(form in digits for form in _phone_forms(phone) for digits in shown)


def _placeholder_problem(view: PageView, data: StructuredData) -> str:
    lowered = [text.casefold() for text in data.strings]
    problems = [
        f'structured data contains the placeholder "{marker}"'
        for marker in PLACEHOLDER_MARKERS if any(marker.casefold() in text for text in lowered)
    ]
    lines = view.facts.main_lines + view.facts.boilerplate_lines
    problems += [f'telephone "{phone}" is not shown as text on the page' for phone in data.phones
                 if not phone_is_shown(phone, lines)]
    visible = words("\n".join(lines))
    problems += [f'address "{part}" is not shown as text on the page'
                 for group in data.addresses for part in group if not shows(visible, part)]
    return listed(problems, "; ")


def _valid_problem(view: PageView, data: StructuredData) -> str:
    if not view.facts.jsonld_blobs:
        return "no JSON-LD block"
    return listed(data.errors, "; ")


def _organization_problem(view: PageView, data: StructuredData) -> str:
    return "" if ORGANIZATION in data.types else "no Organization in the JSON-LD"


def _crumb_name(crumb: Mapping[str, Any]) -> str:
    name = crumb.get("name")
    nested = crumb.get("item")
    if not isinstance(name, str) and isinstance(nested, dict):
        name = nested.get("name")
    return name.strip() if isinstance(name, str) else ""


def _breadcrumb_list_problem(node: Mapping[str, Any]) -> str:
    items = node.get("itemListElement")
    if not isinstance(items, list) or not items:
        return "BreadcrumbList has no itemListElement"
    for expected, crumb in enumerate(items, start=1):
        if not isinstance(crumb, dict):
            return f"breadcrumb {expected} is not an object"
        position = crumb.get("position")
        if type(position) is not int or position != expected:
            return f"breadcrumb {expected} has position {position!r}, expected {expected}"
        if not _crumb_name(crumb):
            return f"breadcrumb {expected} has no name"
    return ""


def _breadcrumb_problem(view: PageView, data: StructuredData) -> str:
    if not data.breadcrumbs:
        return "no BreadcrumbList in the JSON-LD"
    problems = [problem for node in data.breadcrumbs for problem in [_breadcrumb_list_problem(node)] if problem]
    return problems[0] if problems else ""


def structured_data_checks(views: Sequence[PageView]) -> Tuple[CheckResult, ...]:
    """The four JSON-LD checks. Breadcrumbs are judged on inner pages only: not the home page, not the login page."""
    parsed = {view.url: parse_structured_data(view.facts.jsonld_blobs) for view in views}
    inner = [view for view in views if view.path not in (HOME_PATH, LOGIN_PATH)]

    def check(check_id: str, title: str, rule: Rule, subjects: Sequence[PageView], noun: str = "page") -> CheckResult:
        return judge(check_id, PAGE_SCOPE, title, subjects, lambda view: rule(view, parsed[view.url]),
                     lambda view: view.url, noun)

    return (
        check("json-ld-valid", "JSON-LD parses and names schema.org as its @context", _valid_problem, views),
        check("json-ld-organization", "an Organization is declared on every page", _organization_problem, views),
        check("json-ld-breadcrumbs", "inner pages declare a well-formed BreadcrumbList", _breadcrumb_problem, inner,
              "inner page"),
        check("json-ld-placeholders", "no placeholder in structured data; its phone and address are on the page",
              _placeholder_problem, views),
    )
