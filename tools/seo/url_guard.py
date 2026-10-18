"""Keeps redirects from leading this tool to the owner's own machine or network.

A public page can answer ``302 Location: http://192.168.1.1/...`` (or 127.0.0.1, a link-local address such as
169.254.169.254, a name that resolves to one of those, or a spelling like http://2130706433/). The tool would
send a GET there. fetch_pages.py therefore checks every redirect target that is on a different host from the URL
it was asked for, and refuses the ones whose address is loopback, private, link-local, shared (100.64.0.0/10),
multicast or unspecified. --allow-private-hosts switches the check off, for the owner's own local preview.

The check resolves the name once, before the request. A hostile DNS server could answer differently when the
connection is made (DNS rebinding); the tool is for research on public sites and does not defend against that.
Standard library only.
"""

from __future__ import annotations

import ipaddress
import socket
from typing import Callable, Sequence, Tuple

Resolver = Callable[[str], Sequence[str]]


def resolve_addresses(host: str) -> Tuple[str, ...]:
    """The addresses the operating system gives for a host name, the way a connection would read it.

    Numeric shorthand such as 2130706433 or 0x7f.0.0.1 is expanded by the system, which is why this asks it
    instead of parsing the text. A name that does not resolve gives ().
    """
    try:
        answers = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except (OSError, ValueError):  # gaierror is an OSError; a NUL byte or a lone surrogate is a ValueError
        return ()
    return tuple(dict.fromkeys(str(answer[4][0]).split("%", 1)[0] for answer in answers))


def is_public_address(text: str) -> bool:
    """True for an ordinary internet address. An IPv4 address wrapped in IPv6 (::ffff:127.0.0.1) counts as IPv4."""
    try:
        address = ipaddress.ip_address(text)
    except ValueError:
        return False
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped is not None:
        address = address.ipv4_mapped
    return address.is_global and not address.is_multicast


def non_public_reason(host: str, resolve: Resolver = resolve_addresses) -> str:
    """"" when the host is public or cannot be found at all (the request will fail by itself); else why not."""
    try:
        ipaddress.ip_address(host)
        addresses: Sequence[str] = (host,)
        is_literal = True
    except ValueError:
        addresses = tuple(resolve(host))
        is_literal = False
    for address in addresses:
        if not is_public_address(address):
            if is_literal:
                return f"{host} is a local or private address"
            return f"{host} points to {address}, a local or private address"
    return ""
