"use client";

import { useMemo, useState } from "react";
import type { ShowcaseProject } from "@/lib/types";
import { ProjectCard, type CardPhotoLoading } from "./ui";

/** The cards in the first row on a wide screen (three columns), which are in view on arrival. */
const FIRST_ROW_CARD_COUNT = 3;

/** The first row's photos load at once; the rest as they near the screen. */
function photoLoadingFor(cardIndex: number): CardPhotoLoading {
  return cardIndex < FIRST_ROW_CARD_COUNT ? "eager" : "lazy";
}

type ProjectsGalleryProps = {
  projects: readonly ShowcaseProject[];
};

export function ProjectsGallery({ projects }: ProjectsGalleryProps) {
  const [sector, setSector] = useState("All");
  const [country, setCountry] = useState("All");

  const sectors = useMemo(() => ["All", ...new Set(projects.map((p) => p.sector))], [projects]);
  const countries = useMemo(() => ["All", ...new Set(projects.map((p) => p.country))].sort((a, b) => (a === "All" ? -1 : b === "All" ? 1 : a.localeCompare(b))), [projects]);
  const shown = projects.filter((p) => (sector === "All" || p.sector === sector) && (country === "All" || p.country === country));

  return (
    <>
      <div className="flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Filter by sector" className="flex flex-wrap gap-2">
          {sectors.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sector === s}
              onClick={() => setSector(s)}
              className={`rounded-sm border px-4 py-2 text-sm transition-colors ${sector === s ? "border-gold bg-gold text-white" : "border-line text-ink hover:border-gold"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-3 text-sm text-ink-muted">
          Country
          <select value={country} onChange={(e) => setCountry(e.target.value)} className="rounded-sm border border-line bg-paper px-3 py-2 text-ink">
            {countries.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-6 text-sm text-ink-muted" aria-live="polite">
        {shown.length} {shown.length === 1 ? "project" : "projects"}
      </p>
      <div className="mt-6 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((p, index) => (
          <ProjectCard key={p.slug} project={p} photoLoading={photoLoadingFor(index)} />
        ))}
      </div>
      {shown.length === 0 && <p className="py-16 text-center text-ink-muted">No projects match these filters yet.</p>}
    </>
  );
}
