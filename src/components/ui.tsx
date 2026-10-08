import Link from "next/link";
import type { Material, ShowcaseProject } from "@/lib/types";
import { LineArt } from "./Brand";

/** Section title with the large outlined ghost word behind it. */
export function SectionTitle({ ghost, title, eyebrow, align = "left" }: { ghost?: string; title: string; eyebrow?: string; align?: "left" | "center" }) {
  return (
    <div className={`relative ${align === "center" ? "text-center" : ""}`}>
      {ghost && (
        <span
          aria-hidden="true"
          className={`ghost-word absolute hidden sm:block -top-6 text-[4.5rem] sm:-top-10 sm:text-[7.5rem] ${align === "center" ? "left-1/2 -translate-x-1/2" : "-left-1"}`}
        >
          {ghost}
        </span>
      )}
      <div className="relative">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h2 className="display text-2xl sm:text-3xl">{title}</h2>
      </div>
    </div>
  );
}

/** Inner-page hero: linen band, gold line-art, title. */
export function PageHero({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return (
    <section className="linen relative overflow-hidden">
      <LineArt className="pointer-events-none absolute inset-x-0 bottom-0 h-full w-full text-gold/25" />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display mt-4 max-w-3xl text-3xl sm:text-5xl">{title}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted">{lead}</p>
      </div>
    </section>
  );
}

export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-7xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function ButtonLink({ href, children, variant = "solid" }: { href: string; children: React.ReactNode; variant?: "solid" | "outline" }) {
  const base = "inline-flex items-center justify-center rounded-sm px-6 py-3 text-sm font-medium tracking-wide transition-colors";
  const style = variant === "solid" ? "bg-gold text-white hover:bg-gold-dark" : "border border-gold text-gold hover:bg-gold hover:text-white";
  return (
    <Link href={href} className={`${base} ${style}`}>
      {children}
    </Link>
  );
}

const MATERIAL_FILL: Record<Material, string> = {
  walnut:
    "repeating-linear-gradient(96deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 9px), repeating-linear-gradient(88deg, rgba(0,0,0,0.12) 0 1px, transparent 1px 14px), linear-gradient(160deg, #6b4a32, #4a3121 60%, #5c3d29)",
  oak:
    "repeating-linear-gradient(92deg, rgba(120,90,50,0.18) 0 1px, transparent 1px 7px), repeating-linear-gradient(89deg, rgba(255,255,255,0.15) 0 3px, transparent 3px 16px), linear-gradient(160deg, #d9c4a2, #c4a97f)",
  lacquer: "linear-gradient(150deg, #efe9e1 0%, #ddd5ca 55%, #cfc6ba 100%)",
  stone:
    "linear-gradient(125deg, transparent 40%, rgba(150,140,130,0.35) 41%, transparent 43%), linear-gradient(60deg, transparent 62%, rgba(150,140,130,0.25) 63%, transparent 64%), linear-gradient(160deg, #f4f2ee, #e3dfd8)",
  brass: "linear-gradient(135deg, #c9a965, #ac8f50 45%, #8a713b 70%, #b89a5a)",
  linen:
    "repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0 1px, transparent 1px 3px), #e9e3d9",
};

/**
 * Placeholder visual built from a project's material palette.
 * Shown until real photos are added to the project's `images`.
 */
export function MaterialVisual({ palette, className = "" }: { palette: Material[]; className?: string }) {
  const [a, b, c] = [palette[0] ?? "oak", palette[1] ?? "linen", palette[2] ?? "brass"];
  return (
    <div className={`relative grid grid-cols-[3fr_2fr] grid-rows-[3fr_1fr] gap-1.5 bg-paper ${className}`} aria-hidden="true">
      <div className="row-span-2" style={{ background: MATERIAL_FILL[a] }} />
      <div style={{ background: MATERIAL_FILL[b] }} />
      <div style={{ background: MATERIAL_FILL[c] }} />
    </div>
  );
}

export function ProjectVisual({ project, className = "" }: { project: ShowcaseProject; className?: string }) {
  if (project.images.length > 0) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={project.images[0]} alt={project.name} className={`object-cover ${className}`} />;
  }
  return <MaterialVisual palette={project.palette} className={className} />;
}

export function ProjectCard({ project }: { project: ShowcaseProject }) {
  return (
    <Link href={`/projects/${project.slug}`} className="group block">
      <div className="overflow-hidden">
        <ProjectVisual project={project} className="aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-[1.03]" />
      </div>
      <p className="eyebrow mt-5">
        {project.sector} · {project.city}, {project.country}
      </p>
      <h3 className="mt-2 text-lg font-semibold transition-colors group-hover:text-gold">{project.name}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">{project.summary}</p>
    </Link>
  );
}
