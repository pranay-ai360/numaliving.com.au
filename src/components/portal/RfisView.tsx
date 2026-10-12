"use client";

import { useState } from "react";
import { people, rfis as startingRfis, type Rfi } from "@/lib/portal/demo";
import { useDemo } from "./DemoContext";
import { Badge, PortalTitle } from "./PortalShell";

export function RfisView() {
  const { person, can, done, markDone } = useDemo();
  const [list, setList] = useState<Rfi[]>(startingRfis);
  const [selectedId, setSelectedId] = useState(startingRfis[0].id);
  const [reply, setReply] = useState("");
  const [raising, setRaising] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const canAct = can("rfis", 2);

  const selected = list.find((r) => r.id === selectedId) ?? list[0];
  const isOpen = (r: Rfi) => r.open && !done[r.id];
  const mine = selected.to === person && isOpen(selected);

  function send() {
    if (!reply.trim()) return;
    setList((prev) =>
      prev.map((r) => (r.id === selected.id ? { ...r, messages: [...r.messages, { who: people[person].name, when: "Just now", text: reply.trim(), fromNuma: false }] } : r)),
    );
    markDone(selected.id, "Answered");
    setReply("");
  }

  function raise(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const id = `new-${list.length}`;
    const code = `RFI-${String(15 + list.length - startingRfis.length).padStart(3, "0")}`;
    setList((prev) => [
      { id, code, area: "General", title: newTitle.trim(), to: -1, due: "Numa replies within 2 working days", open: true, messages: [{ who: people[person].name, when: "Just now", text: newText.trim() || newTitle.trim(), fromNuma: false }] },
      ...prev,
    ]);
    setSelectedId(id);
    setRaising(false);
    setNewTitle("");
    setNewText("");
  }

  const status = (r: Rfi) => {
    if (r.to === -1) return <Badge tone="muted">With Numa</Badge>;
    if (!isOpen(r)) return <Badge tone="ok">{done[r.id] ?? "Closed"}</Badge>;
    return r.to === person ? <Badge tone="waiting">Waiting for you</Badge> : <Badge tone="muted">Open</Badge>;
  };

  return (
    <>
      <PortalTitle eyebrow="Requests for information" title="RFIs">
        {canAct && (
          <button type="button" onClick={() => setRaising((v) => !v)} className="min-h-11 bg-gold px-5 text-sm font-semibold text-white hover:bg-gold-dark">
            {raising ? "Cancel" : "+ Raise an RFI"}
          </button>
        )}
      </PortalTitle>

      {raising && (
        <form onSubmit={raise} className="mb-5 flex flex-col gap-3 border border-gold bg-paper p-5">
          <label className="text-sm font-semibold">
            Question
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required className="mt-1.5 w-full border border-[#cfc7b8] px-3 py-2.5 font-normal outline-none focus:border-gold" />
          </label>
          <label className="text-sm font-semibold">
            Details (optional)
            <textarea value={newText} onChange={(e) => setNewText(e.target.value)} rows={2} className="mt-1.5 w-full border border-[#cfc7b8] px-3 py-2.5 font-normal outline-none focus:border-gold" />
          </label>
          <button type="submit" className="min-h-11 self-start bg-ink px-5 text-sm font-semibold text-white">
            Send to Numa
          </button>
        </form>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <ul aria-label="RFI list" className="border border-line bg-paper">
          {list.map((r) => {
            const active = r.id === selected.id;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedId(r.id)}
                  className={`block w-full border-b border-[#efeae1] px-4 py-4 text-left ${active ? "bg-[#faf6ee] shadow-[inset_3px_0_0_var(--brand-gold)]" : "bg-paper hover:bg-[#fcfaf6]"}`}
                >
                  <span className="flex justify-between gap-3 text-xs">
                    <strong className="text-gold-dark">{r.code}</strong>
                    {status(r)}
                  </span>
                  <span className="mt-1.5 block text-sm font-semibold">{r.title}</span>
                  <span className="mt-1 block text-xs text-ink-muted">{r.to >= 0 ? `To ${people[r.to].name} · by ${r.due}` : r.due}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <section aria-label="Conversation" className="border border-line bg-paper">
          <div className="border-b border-line px-5 py-4">
            <p className="text-xs font-bold text-gold-dark">
              {selected.code} · {selected.area}
            </p>
            <h2 className="mt-1 text-lg font-bold">{selected.title}</h2>
          </div>
          <div className="flex flex-col gap-4 p-5">
            {selected.messages.map((m, i) => (
              <div key={i} className={`px-4 py-3.5 ${m.fromNuma ? "mr-10 bg-linen" : "ml-10 bg-gold-soft"}`}>
                <p className="text-xs">
                  <strong>{m.who}</strong> <span className="text-ink-muted">· {m.when}</span>
                </p>
                <p className="mt-1.5 text-sm leading-relaxed">{m.text}</p>
                {m.file && <span className="mt-2 inline-block border border-line bg-paper px-2.5 py-1 text-xs font-semibold">PDF · {m.file}</span>}
              </div>
            ))}
          </div>
          {mine && canAct && (
            <div className="flex flex-col gap-2.5 border-t border-line p-5">
              <label htmlFor="reply" className="text-sm font-semibold">
                Your answer
              </label>
              <textarea
                id="reply"
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your answer, or attach a marked-up PDF."
                className="w-full border border-[#cfc7b8] px-3 py-2.5 text-sm outline-none focus:border-gold"
              />
              <div className="flex flex-wrap gap-2.5">
                <button type="button" onClick={send} className="min-h-11 bg-gold px-5 text-sm font-semibold text-white hover:bg-gold-dark">
                  Send answer
                </button>
                <span className="flex min-h-11 items-center border border-[#cfc7b8] px-5 text-sm font-semibold text-ink-muted">Attach PDF</span>
              </div>
            </div>
          )}
          {isOpen(selected) && selected.to >= 0 && selected.to !== person && (
            <p className="border-t border-line px-5 py-3 text-sm text-ink-muted">Waiting for {people[selected.to].name} to answer.</p>
          )}
        </section>
      </div>
    </>
  );
}
