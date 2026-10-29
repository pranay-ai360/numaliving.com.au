"use client";

import { useState } from "react";
import { levelHelp, levelNames, modules, people, type Level } from "@/lib/portal/demo";
import { useDemo } from "./DemoContext";
import { PortalTitle } from "./PortalShell";

const looks = [
  "bg-[#ece8e1] text-ink-muted",
  "bg-paper text-ink shadow-[inset_0_0_0_1px_#d9d3c8]",
  "bg-gold-soft text-ink font-medium",
  "bg-gold text-ink font-bold",
];

export function TeamView() {
  const { rights, setRight, resetRights, person, mainContact, setMainContact } = useDemo();
  const [notice, setNotice] = useState("");
  const isMain = person === mainContact;

  return (
    <>
      <PortalTitle eyebrow="Team & access" title="Responsibility Form">
        {isMain && (
          <button type="button" onClick={() => setNotice("Demo: in the live portal this sends an invite email.")} className="min-h-11 bg-gold px-5 text-sm font-semibold text-white hover:bg-gold-dark">
            + Invite a person
          </button>
        )}
      </PortalTitle>

      <p className="-mt-4 mb-5 max-w-3xl text-sm leading-relaxed text-ink-muted">
        The first step on every project: the client appoints a client admin. It can be the owner, architect, contractor or project manager. The client admin decides, for
        each person, what they can see, act on and approve. {isMain ? "You are the client admin: click any box to change it, then switch roles above to see the effect." : `Only the client admin (${people[mainContact].name}) can change it.`}
      </p>
      {notice && (
        <p role="status" className="mb-4 bg-gold-soft px-4 py-2.5 text-sm">
          {notice}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-4 text-xs text-ink-muted">
        {levelNames.map((n, i) => (
          <span key={n} className="flex items-center gap-1.5">
            <span className={`px-2 py-1 ${looks[i]}`}>{n}</span>
            {levelHelp[i]}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto border border-line bg-paper">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-ink-muted">
              <th scope="col" className="border-b border-line px-5 py-3 font-semibold">Person</th>
              {modules.map((m) => (
                <th key={m.key} scope="col" className="border-b border-line px-2 py-3 font-semibold">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p, pi) => (
              <tr key={p.name}>
                <th scope="row" className="border-b border-[#efeae1] px-5 py-3 text-left font-normal">
                  <span className="block font-semibold">
                    {p.name}
                    {pi === mainContact && <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.12em] text-gold-dark">Client admin</span>}
                  </span>
                  <span className="block text-xs text-ink-muted">{p.org}</span>
                </th>
                {modules.map((m, mi) => {
                  const lvl = rights[pi][mi];
                  return (
                    <td key={m.key} className="border-b border-[#efeae1] p-1.5">
                      <button
                        type="button"
                        disabled={!isMain}
                        onClick={() => setRight(pi, mi, ((lvl + 1) % 4) as Level)}
                        aria-label={`${p.name}, ${m.label}: ${levelNames[lvl]}${isMain ? ". Click to change." : ""}`}
                        className={`min-h-10 w-full min-w-[84px] text-xs ${looks[lvl]} ${isMain ? "cursor-pointer" : "cursor-default"}`}
                      >
                        {levelNames[lvl]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isMain && (
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <label className="text-sm font-semibold">
            Hand over client admin to
            <select
              value={mainContact}
              onChange={(e) => setMainContact(Number(e.target.value))}
              className="ml-3 min-h-11 border border-[#cfc7b8] bg-paper px-3 font-normal outline-none focus:border-gold"
            >
              {people.map((p, i) => (
                <option key={p.name} value={i}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={resetRights} className="min-h-11 border border-gold px-5 text-sm font-semibold text-gold-dark hover:bg-gold hover:text-white">
            Reset form
          </button>
        </div>
      )}
    </>
  );
}
