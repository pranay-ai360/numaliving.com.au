"use client";

import { installItems } from "@/lib/portal/demo";
import { Badge, PortalTitle } from "./PortalShell";

export function InstallationView() {
  return (
    <>
      <PortalTitle eyebrow="Installation" title="Installation Videos" />
      <p className="-mt-4 mb-5 max-w-3xl text-sm leading-relaxed text-ink-muted">
        One short video per item, showing your site team how it goes together. Videos are added before each item is delivered.
      </p>
      <div className="overflow-x-auto border border-line bg-paper">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-muted">
              <th scope="col" className="border-b border-line px-5 py-3 font-semibold">Code</th>
              <th scope="col" className="border-b border-line px-2 py-3 font-semibold">Item</th>
              <th scope="col" className="border-b border-line px-2 py-3 font-semibold">Room</th>
              <th scope="col" className="border-b border-line px-2 py-3 font-semibold">Status</th>
              <th scope="col" className="border-b border-line px-5 py-3 font-semibold">Video</th>
            </tr>
          </thead>
          <tbody>
            {installItems.map((i) => (
              <tr key={i.code}>
                <td className="border-b border-[#efeae1] px-5 py-3 font-mono text-xs text-gold-dark">{i.code}</td>
                <td className="border-b border-[#efeae1] px-2 py-3 font-semibold">{i.item}</td>
                <td className="border-b border-[#efeae1] px-2 py-3 text-ink-muted">{i.room}</td>
                <td className="border-b border-[#efeae1] px-2 py-3">
                  <Badge tone={i.stage === "Delivered" ? "ok" : i.stage === "On hold" ? "warn" : "muted"}>{i.stage}</Badge>
                </td>
                <td className="border-b border-[#efeae1] px-5 py-3">
                  {i.video ? (
                    <a href={i.video} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center border border-gold px-3 text-xs font-semibold text-gold-dark hover:bg-gold hover:text-white">
                      Watch video ↗
                    </a>
                  ) : (
                    <span className="text-xs text-ink-muted">Coming before delivery</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
