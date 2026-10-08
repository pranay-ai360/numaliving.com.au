"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { site } from "@/config/site";
import { LogoLink } from "./Brand";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 bg-paper/95 shadow-[0_6px_24px_rgba(0,0,0,0.04)] backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:h-24">
        <LogoLink />

        <nav aria-label="Main" className="hidden items-center gap-6 xl:flex">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-[0.95rem] transition-colors hover:text-gold ${isActive(item.href) ? "text-gold" : "text-ink"}`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="rounded-sm border border-gold px-4 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold hover:text-white"
          >
            Client Login
          </Link>
        </nav>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center xl:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative block h-3.5 w-6">
            <span className={`absolute left-0 h-px w-6 bg-ink transition-transform ${open ? "top-1.5 rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 top-1.5 h-px w-6 bg-ink transition-opacity ${open ? "opacity-0" : ""}`} />
            <span className={`absolute left-0 h-px w-6 bg-ink transition-transform ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
          </span>
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-paper px-4 pb-6 xl:hidden">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block border-b border-line py-3.5 ${isActive(item.href) ? "text-gold" : "text-ink"}`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="mt-5 block rounded-sm bg-gold py-3 text-center font-medium text-white"
          >
            Client Login
          </Link>
        </nav>
      )}
    </header>
  );
}
