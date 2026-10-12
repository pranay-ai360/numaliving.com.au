"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { people, project, roles } from "@/lib/portal/demo";
import { DemoProvider, useDemo } from "./DemoContext";

export function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <DemoProvider>
      <Shell>{children}</Shell>
    </DemoProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, setRole, person, can, myTasks, mainContact } = useDemo();

  const count = (prefix: string) => myTasks.filter((t) => t.href.startsWith(prefix)).length;
  const nav = [
    { href: "/portal/", label: "Overview", show: true, n: 0 },
    { href: "/portal/approvals/", label: "Approvals", show: can("designDrawings", 1) || can("shopDrawings", 1) || can("samples", 1), n: count("/portal/approvals") },
    { href: "/portal/rfis/", label: "RFIs", show: can("rfis", 1), n: count("/portal/rfis") },
    { href: "/portal/tracking/", label: "Production & shipping", show: can("production", 1), n: count("/portal/tracking") },
    { href: "/portal/team/", label: "Team & access", show: true, n: 0 },
  ].filter((i) => i.show);
  const isActive = (href: string) => (href === "/portal/" ? pathname === "/portal" || pathname === "/portal/" : pathname.startsWith(href.slice(0, -1)));

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col bg-linen md:flex-row">
      <aside className="bg-ink text-white md:w-64 md:shrink-0">
        <div className="flex flex-col gap-6 p-5 md:sticky md:top-0 md:p-6">
          <div className="border border-white/15 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">Project</p>
            <p className="mt-1.5 font-semibold">{project.name}</p>
            <p className="text-xs text-white/70">{project.location}</p>
          </div>
          <nav aria-label="Portal" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {nav.map((i) => {
              const active = isActive(i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 shrink-0 items-center gap-3 px-3 text-sm transition-colors ${
                    active ? "border-l-2 border-gold bg-white/10 font-semibold text-white" : "text-white/75 hover:text-white"
                  }`}
                >
                  {i.label}
                  {i.n > 0 && <span className="ml-auto bg-gold px-1.5 py-0.5 text-[11px] font-bold text-ink">{i.n}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="hidden border-t border-white/15 pt-4 text-xs leading-relaxed text-white/70 md:block">
            Your Numa project manager
            <br />
            <span className="font-semibold text-white">[PM NAME]</span> · WhatsApp
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-5 py-3 sm:px-8">
          <p className="text-sm text-ink-muted">
            Signed in as <span className="font-semibold text-ink">{people[person].name}</span> · {people[person].org}
            {mainContact === person && <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gold-dark">Main contact</span>}
          </p>
          <div role="group" aria-label="Demo: view the portal as" className="flex flex-wrap items-center gap-1 border border-dashed border-gold p-1">
            <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-dark">Demo: view as</span>
            {roles.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={role === r.key}
                onClick={() => setRole(r.key)}
                className={`min-h-9 px-3 text-sm transition-colors ${role === r.key ? "bg-ink font-semibold text-white" : "text-ink hover:bg-gold-soft"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 py-8 sm:px-8 lg:px-10">{children}</div>
        <p className="px-5 pb-8 text-xs text-ink-muted sm:px-8 lg:px-10">
          Demo with sample data. Nothing is saved: refreshing the page starts over.
        </p>
      </div>
    </div>
  );
}

/** Page heading used on every portal screen. */
export function PortalTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display mt-2 text-2xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

/** Small status label. */
export function Badge({ tone, children }: { tone: "waiting" | "ok" | "warn" | "muted"; children: React.ReactNode }) {
  const tones = {
    waiting: "bg-gold-soft text-ink",
    ok: "bg-[#e3eadc] text-[#33502a]",
    warn: "bg-[#f6e3dc] text-[#8a3a22]",
    muted: "bg-[#ece8e1] text-ink-muted",
  };
  return <span className={`whitespace-nowrap px-2 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}
