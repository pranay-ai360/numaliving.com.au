"use client";

import { production, shipments, shipmentSteps, shippingDocs } from "@/lib/portal/demo";
import { useDemo } from "./DemoContext";
import { Badge, PortalTitle } from "./PortalShell";

export function TrackingView() {
  const { person, done, markDone } = useDemo();
  const isContractor = person === 3;

  return (
    <>
      <PortalTitle eyebrow="Tracking" title="Production & Shipping" />

      <section aria-label="Production" className="border border-line bg-paper">
        <div className="flex flex-wrap justify-between gap-2 border-b border-line px-5 py-4">
          <h2 className="font-semibold">In the factory</h2>
          <span className="text-xs text-ink-muted">Machining → Veneer → Finishing → QC → Packed</span>
        </div>
        {production.map((p) => (
          <div key={p.name} className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#efeae1] px-5 py-4 last:border-b-0">
            <div className="min-w-[200px] flex-1">
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="text-xs text-ink-muted">{p.ref}</p>
            </div>
            <div className="min-w-[220px] flex-[2]">
              <div className="h-2 bg-[#ece8e1]">
                <div className="h-full bg-gold" style={{ width: `${p.pct}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-xs">
                <span className="font-semibold">{p.stage}</span>
                <span className="text-ink-muted">{p.pct}%</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-gold-dark">{p.photos} photos</span>
          </div>
        ))}
      </section>

      <section aria-label="Shipments" className="mt-5 grid gap-4 md:grid-cols-3">
        {shipments.map((s) => (
          <div key={s.id} className="flex flex-col gap-3 border border-line bg-paper p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">{s.name}</h2>
              <Badge tone={s.done === 4 ? "ok" : s.done > 0 ? "waiting" : "muted"}>{s.status}</Badge>
            </div>
            <p className="text-xs leading-relaxed text-ink-muted">
              {s.line1}
              <br />
              {s.line2}
            </p>
            <ol className="grid grid-cols-4 gap-1">
              {shipmentSteps.map((label, i) => (
                <li key={label} className="flex flex-col gap-1.5">
                  <div className={`h-1.5 ${i < s.done ? "bg-gold" : "bg-line"}`} />
                  <span className="text-[10px] text-ink-muted">{label}</span>
                </li>
              ))}
            </ol>
            {s.needsSite &&
              (done[s.id] ? (
                <p role="status" className="bg-gold-soft px-3 py-2 text-xs font-semibold">Site confirmed ready. Numa will book delivery.</p>
              ) : isContractor ? (
                <button type="button" onClick={() => markDone(s.id, "Site confirmed ready")} className="min-h-11 bg-gold text-sm font-semibold text-white hover:bg-gold-dark">
                  Confirm site is ready
                </button>
              ) : (
                <p className="text-xs text-ink-muted">Waiting for the main contractor to confirm the site is ready.</p>
              ))}
          </div>
        ))}
      </section>

      <section aria-label="Shipping documents" className="mt-5 flex flex-wrap items-center gap-2.5 border border-line bg-paper px-5 py-4">
        <h2 className="mr-2 text-sm font-semibold">Shipping documents</h2>
        {shippingDocs.map((d) => (
          <span key={d} className="border border-line px-3 py-1.5 text-xs font-semibold">
            PDF · {d}
          </span>
        ))}
      </section>
    </>
  );
}
