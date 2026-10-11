"use client";

import { useState } from "react";
import type { QuoteRequest, SubmissionResult } from "@/lib/types";
import { submitQuote, UPLOAD_LIMITS, validateFiles } from "@/lib/services/quotes";
import { SketchPad } from "./SketchPad";

const roles: QuoteRequest["role"][] = ["Owner / developer", "Architect / designer", "Main contractor", "Other"];
const types: QuoteRequest["projectType"][] = ["Residences", "Office", "Multifamily", "Hospitality", "Other"];

const field = "mt-1.5 w-full rounded-sm border border-line bg-paper px-3.5 py-2.5 text-ink outline-none transition-colors focus:border-gold";
const label = "block text-sm font-medium";

export function QuoteForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [sketch, setSketch] = useState<Blob | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files, ...Array.from(list)];
    const err = validateFiles(next);
    setFileError(err);
    if (!err) setFiles(next);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const request: QuoteRequest = {
      name: get("name"),
      company: get("company") || undefined,
      email: get("email"),
      phone: get("phone") || undefined,
      role: get("role") as QuoteRequest["role"],
      projectType: get("projectType") as QuoteRequest["projectType"],
      location: get("location"),
      timeline: get("timeline"),
      message: get("message"),
    };
    setSending(true);
    setResult(null);
    const res = await submitQuote(request, files, sketchOpen ? sketch : null);
    setSending(false);
    setResult(res);
    if (res.ok) {
      form.reset();
      setFiles([]);
      setSketch(null);
      setSketchOpen(false);
    }
  }

  if (result?.ok) {
    return (
      <div role="status" className="border border-gold bg-gold-soft p-8">
        <p className="display text-lg text-gold">Thank You</p>
        <p className="mt-4 text-lg">We have your request. Our team will reply within two working days.</p>
        <p className="mt-2 text-sm text-ink-muted">Reference: {result.reference}</p>
        {result.demo && (
          <p className="mt-4 text-sm text-ink-muted">
            Preview mode: nothing was stored. Submissions are saved once Firebase is connected.
          </p>
        )}
        <button type="button" onClick={() => setResult(null)} className="mt-6 text-sm font-medium text-gold hover:text-gold-dark">
          Send another request →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate={false}>
      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="eyebrow mb-4">About you</legend>
        <label className={label}>
          Full name *
          <input name="name" required autoComplete="name" className={field} />
        </label>
        <label className={label}>
          Company
          <input name="company" autoComplete="organization" className={field} />
        </label>
        <label className={label}>
          Email *
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
        <label className={label}>
          Phone / WhatsApp
          <input name="phone" type="tel" autoComplete="tel" className={field} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Your role *
          <select name="role" required defaultValue="" className={field}>
            <option value="" disabled>
              Select…
            </option>
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2">
        <legend className="eyebrow mb-4">The project</legend>
        <label className={label}>
          Project type *
          <select name="projectType" required defaultValue="" className={field}>
            <option value="" disabled>
              Select…
            </option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Site location (city, country) *
          <input name="location" required className={field} placeholder="e.g. Dubai, UAE" />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Timeline *
          <select name="timeline" required defaultValue="" className={field}>
            <option value="" disabled>
              Select…
            </option>
            <option>Tendering now</option>
            <option>Start within 3 months</option>
            <option>Start in 3 to 6 months</option>
            <option>Later / exploring</option>
          </select>
        </label>
        <label className={`${label} sm:col-span-2`}>
          Scope and notes *
          <textarea name="message" required rows={5} className={field} placeholder="What needs to be made, approximate quantities, finishes, anything else." />
        </label>
      </fieldset>

      <fieldset>
        <legend className="eyebrow mb-4">Drawings and sketches</legend>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-sm border border-dashed border-gold/60 bg-linen px-6 py-8 text-center transition-colors hover:border-gold">
          <span className="font-medium">Attach drawings or BOQ (PDF)</span>
          <span className="mt-1 text-sm text-ink-muted">
            Up to {UPLOAD_LIMITS.maxFiles} files, {UPLOAD_LIMITS.maxFileMb} MB each
          </span>
          <input type="file" accept={UPLOAD_LIMITS.accept} multiple className="sr-only" onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }} />
        </label>
        {fileError && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {fileError}
          </p>
        )}
        {files.length > 0 && (
          <ul className="mt-3 divide-y divide-line border border-line">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="truncate">{f.name}</span>
                <span className="flex shrink-0 items-center gap-4 text-ink-muted">
                  {(f.size / 1024 / 1024).toFixed(1)} MB
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-gold hover:text-gold-dark">
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          
        </div>
      </fieldset>

      {result && !result.ok && (
        <p role="alert" className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {result.error}
        </p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-sm bg-gold px-8 py-3.5 font-medium tracking-wide text-white transition-colors hover:bg-gold-dark disabled:opacity-60 sm:w-auto"
      >
        {sending ? "Sending…" : "Send Request"}
      </button>
    </form>
  );
}
