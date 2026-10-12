"use client";

import { useState } from "react";
import type { PortalModule } from "@/lib/types";
import { designUploads, modules, people, samples, shopDrawings, type ReviewItem } from "@/lib/portal/demo";
import { useDemo } from "./DemoContext";
import { Badge, PortalTitle } from "./PortalShell";

type Tab = "shop" | "samples" | "design";

export function ApprovalsView() {
  const { can } = useDemo();
  const tabs: { key: Tab; label: string; module: PortalModule }[] = [
    { key: "shop", label: "Shop drawings", module: "shopDrawings" },
    { key: "samples", label: "Samples", module: "samples" },
    { key: "design", label: "Design drawings", module: "designDrawings" },
  ];
  const visible = tabs.filter((t) => can(t.module, 1));
  const [tab, setTab] = useState<Tab>(visible[0]?.key ?? "shop");
  const current = visible.find((t) => t.key === tab) ?? visible[0];

  return (
    <>
      <PortalTitle eyebrow="Approvals" title="Drawings & Samples" />
      <div role="tablist" aria-label="Approval type" className="mb-6 flex flex-wrap gap-1 border-b border-line">
        {visible.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={current?.key === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px min-h-11 px-4 text-sm ${current?.key === t.key ? "border-b-2 border-gold font-bold text-ink" : "text-ink-muted hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {!current && <p className="text-ink-muted">You do not have access to drawings or samples on this project.</p>}
      {current?.key === "shop" && <Review key="shop" items={shopDrawings} module="shopDrawings" />}
      {current?.key === "samples" && <Review key="samples" items={samples} module="samples" />}
      {current?.key === "design" && <DesignDrawings />}
    </>
  );
}

const statusLabel = { waiting: "Waiting", approved: "Approved", revising: "Numa revising" } as const;
const statusTone = { waiting: "waiting", approved: "ok", revising: "warn" } as const;

function Review({ items, module }: { items: ReviewItem[]; module: PortalModule }) {
  const { can, done, markDone, rights } = useDemo();
  const [selectedId, setSelectedId] = useState(items[0].id);
  const [note, setNote] = useState("");
  const selected = items.find((i) => i.id === selectedId) ?? items[0];
  const decided = done[selected.id];
  const canApprove = can(module, 3);
  const mi = modules.findIndex((m) => m.key === module);
  const approvers = people.filter((_, pi) => rights[pi][mi] === 3).map((p) => p.name);

  function decide(outcome: string) {
    markDone(selected.id, outcome);
    setNote("");
  }

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <ul aria-label="Items" className="border border-line bg-paper">
        {items.map((it) => {
          const d = done[it.id];
          const active = it.id === selected.id;
          return (
            <li key={it.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedId(it.id)}
                className={`flex w-full items-center gap-3 border-b border-[#efeae1] px-4 py-3.5 text-left ${active ? "bg-[#faf6ee] shadow-[inset_3px_0_0_var(--brand-gold)]" : "bg-paper hover:bg-[#fcfaf6]"}`}
              >
                {it.swatch && <span aria-hidden="true" className="h-9 w-9 shrink-0" style={{ background: it.swatch }} />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{it.code}</span>
                  <span className="block text-xs text-ink-muted">{it.title}</span>
                </span>
                {d ? <Badge tone={d.startsWith("Revise") ? "warn" : "ok"}>{d.startsWith("Revise") ? "Sent back" : "Approved"}</Badge> : <Badge tone={statusTone[it.status]}>{statusLabel[it.status]}</Badge>}
              </button>
            </li>
          );
        })}
      </ul>

      <section aria-label="Review" className="border border-line bg-paper">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-bold">
              {selected.code} · {selected.title}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">{selected.sub}</p>
          </div>
          <span className="text-sm font-semibold text-gold-dark">{selected.kind === "shop" ? "Open full PDF" : "See all photos"}</span>
        </div>

        {selected.kind === "shop" ? <DrawingPreview label={`${selected.code}, ${selected.title}`} /> : <SamplePreview item={selected} />}

        <div className="flex flex-col gap-3 p-5">
          {decided && (
            <p role="status" className="bg-gold-soft px-4 py-3 text-sm font-semibold">
              {decided}. Numa has been notified{decided.startsWith("Revise") ? " and will issue the next revision." : "."}
            </p>
          )}
          {!decided && selected.status === "waiting" && canApprove && (
            <>
              <label htmlFor="note" className="text-sm font-semibold">
                Comments (optional)
              </label>
              <textarea
                id="note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Increase the overhang to 300 mm on the seating side."
                className="w-full border border-[#cfc7b8] px-3 py-2.5 text-sm outline-none focus:border-gold"
              />
              <div className="flex flex-wrap gap-2.5">
                <button type="button" onClick={() => decide(note ? "Approved with comments" : "Approved")} className="min-h-11 bg-gold px-5 text-sm font-semibold text-white hover:bg-gold-dark">
                  Approve
                </button>
                <button type="button" onClick={() => decide("Revise & resubmit")} className="min-h-11 border border-[#cfc7b8] px-5 text-sm font-semibold hover:border-ink">
                  Revise &amp; resubmit
                </button>
              </div>
            </>
          )}
          {!decided && selected.status === "waiting" && !canApprove && (
            <p className="bg-[#faf8f4] px-4 py-3 text-sm text-ink-muted">
              You can view this. Approval sits with {approvers.length ? approvers.join(" and ") : "nobody yet (set it on Team & access)"}.
            </p>
          )}
          {!decided && selected.status !== "waiting" && <p className="text-sm text-ink-muted">No action needed.</p>}
        </div>
      </section>
    </div>
  );
}

function DrawingPreview({ label }: { label: string }) {
  return (
    <div className="mx-5 mt-5 flex h-56 items-center justify-center border border-line bg-[#fbfaf7]">
      <svg role="img" aria-label={`Preview of shop drawing ${label}`} viewBox="0 0 500 220" className="h-auto w-[82%] text-ink-muted">
        <g fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="40" y="60" width="400" height="120" />
          <line x1="40" y1="78" x2="440" y2="78" />
          <line x1="140" y1="78" x2="140" y2="180" />
          <line x1="240" y1="78" x2="240" y2="180" />
          <line x1="340" y1="78" x2="340" y2="180" />
          <line x1="128" y1="120" x2="128" y2="140" />
          <line x1="152" y1="120" x2="152" y2="140" />
          <line x1="328" y1="120" x2="328" y2="140" />
          <line x1="352" y1="120" x2="352" y2="140" />
          <line x1="40" y1="200" x2="440" y2="200" strokeDasharray="4 4" />
          <line x1="460" y1="60" x2="460" y2="180" strokeDasharray="4 4" />
        </g>
        <text x="240" y="214" textAnchor="middle" fontSize="11" fill="currentColor">3200</text>
        <text x="464" y="124" fontSize="11" fill="currentColor">920</text>
        <text x="40" y="40" fontSize="11" fill="var(--brand-gold-dark)">ELEVATION A · 1:20 · SAMPLE</text>
      </svg>
    </div>
  );
}

function SamplePreview({ item }: { item: ReviewItem }) {
  return (
    <div className="mx-5 mt-5 flex flex-wrap gap-5">
      <div role="img" aria-label={`Photo of the ${item.code} sample`} className="h-56 min-w-[200px] flex-1" style={{ background: item.swatch }} />
      <dl className="grid flex-1 grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
        <dt className="text-ink-muted">Sample</dt>
        <dd>{item.code}</dd>
        <dt className="text-ink-muted">Where</dt>
        <dd>{item.title}</dd>
        <dt className="text-ink-muted">Physical</dt>
        <dd>Delivered to site office</dd>
      </dl>
    </div>
  );
}

function DesignDrawings() {
  const { can, person } = useDemo();
  const [files, setFiles] = useState(designUploads);
  const canUpload = can("designDrawings", 2);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length) {
      setFiles((prev) => [...picked.map((f) => ({ name: f.name, version: "v1", by: people[person].name, date: "Just now" })), ...prev]);
    }
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-5">
      {canUpload ? (
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 border-[1.5px] border-dashed border-gold bg-paper px-4 text-center">
          <span className="font-semibold">Choose PDF drawings to upload</span>
          <span className="text-xs text-ink-muted">PDF only · versioned, nothing is overwritten · demo: the file stays on your computer</span>
          <input type="file" accept="application/pdf" multiple onChange={onPick} className="text-xs" />
        </label>
      ) : (
        <p className="bg-paper px-4 py-3 text-sm text-ink-muted">You can view design drawings. Uploading is set on Team &amp; access.</p>
      )}
      <div className="overflow-x-auto border border-line bg-paper">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-muted">
              <th scope="col" className="border-b border-line px-5 py-3 font-semibold">Drawing</th>
              <th scope="col" className="border-b border-line px-2 py-3 font-semibold">Version</th>
              <th scope="col" className="border-b border-line px-2 py-3 font-semibold">Uploaded by</th>
              <th scope="col" className="border-b border-line px-5 py-3 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f, i) => (
              <tr key={`${f.name}-${i}`}>
                <td className="border-b border-[#efeae1] px-5 py-3 font-semibold">{f.name}</td>
                <td className="border-b border-[#efeae1] px-2 py-3">{f.version}</td>
                <td className="border-b border-[#efeae1] px-2 py-3 text-ink-muted">{f.by}</td>
                <td className="border-b border-[#efeae1] px-5 py-3 text-ink-muted">{f.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
