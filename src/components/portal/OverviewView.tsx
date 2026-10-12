"use client";

import Link from "next/link";
import { project, stages, stats, updates } from "@/lib/portal/demo";
import { useDemo } from "./DemoContext";
import { PortalTitle } from "./PortalShell";

export function OverviewView() {
  const { myTasks, can } = useDemo();

  return (
    <>
      <PortalTitle eyebrow="Overview" title={project.name} />

      <section aria-label="Project stage" className="border border-line bg-paper p-6">
        <div className="mb-4 flex flex-wrap justify-between gap-2 text-sm">
          <h2 className="font-semibold">Project stage</h2>
          <span className="text-ink-muted">Handover planned: {project.handover}</span>
        </div>
        <ol className="grid grid-cols-2 gap-x-2 gap-y-5 sm:grid-cols-4 lg:grid-cols-8">
          {stages.map((s) => (
            <li key={s.name} className="flex flex-col gap-2">
              <div
                className={`h-1.5 ${s.state === "done" ? "bg-gold" : s.state === "next" ? "bg-line" : ""}`}
                style={s.state === "now" ? { background: "linear-gradient(90deg, var(--brand-gold) 60%, var(--brand-line) 60%)" } : undefined}
              />
              <span className="text-xs font-semibold leading-snug">{s.name}</span>
              <span className="text-[11px] text-ink-muted">{s.note}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="border border-line bg-paper px-5 py-4">
            <p className="display normal-case text-xl text-gold-dark">{s.value}</p>
            <p className="mt-1.5 text-sm text-ink-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
        <section aria-label="Waiting for you" className="border border-line bg-paper">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-semibold">Waiting for you</h2>
            <span className="bg-gold px-2 py-0.5 text-xs font-bold text-ink">{myTasks.length}</span>
          </div>
          {myTasks.length === 0 && <p className="px-5 py-6 text-sm text-ink-muted">Nothing waiting. You are all caught up.</p>}
          {myTasks.map((t) => (
            <Link key={t.id} href={t.href} className="flex items-center gap-4 border-b border-[#efeae1] px-5 py-4 transition-colors last:border-b-0 hover:bg-[#faf6ee]">
              <span className="w-24 shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-gold-dark">{t.tag}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t.title}</span>
                <span className="mt-0.5 block text-xs text-ink-muted">{t.meta}</span>
              </span>
              <span className="shrink-0 border border-gold px-3 py-2 text-xs font-semibold text-gold-dark">{t.cta}</span>
            </Link>
          ))}
          {!can("commercials", 1) && (
            <p className="bg-[#faf8f4] px-5 py-3 text-xs text-ink-muted">Commercials are hidden for you. The main contact sets this on Team &amp; access.</p>
          )}
        </section>

        <section aria-label="Latest from the factory" className="border border-line bg-paper">
          <h2 className="border-b border-line px-5 py-4 font-semibold">Latest from the factory</h2>
          {updates.map((u) => (
            <div key={u.title} className="flex gap-4 border-b border-[#efeae1] px-5 py-4 last:border-b-0">
              {u.photo && (
                <div
                  role="img"
                  aria-label={`Photo: ${u.title}`}
                  className="h-16 w-24 shrink-0"
                  style={{ background: "repeating-linear-gradient(96deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 9px), linear-gradient(160deg, #6b4a32, #4a3121)" }}
                />
              )}
              <div>
                <p className="text-sm font-semibold">{u.title}</p>
                <p className="mt-1 text-xs text-ink-muted">{u.meta}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
