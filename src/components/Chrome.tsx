import Link from "next/link";
import { site, showSampleNotice } from "@/config/site";
import { Wordmark } from "./Brand";

export function Footer() {
  return (
    <footer className="mt-auto bg-ink text-white/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60">{site.description}</p>
          <p className="mt-4 text-xs uppercase tracking-[0.25em] text-gold">{site.group}</p>
        </div>
        <div>
          <p className="eyebrow">Explore</p>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {site.nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-gold">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/login" className="hover:text-gold">
                Client Login
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">Contact</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a href={`mailto:${site.contact.email}`} className="hover:text-gold">
                {site.contact.email}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-white/50 sm:px-6">
          © {new Date().getFullYear()} {site.name}. {site.group}.
        </p>
      </div>
    </footer>
  );
}

/** "Enquire Now" side tab plus phone and WhatsApp buttons, as on the Condor site. */
export function FloatingActions() {
  return (
    <>
      <Link
        href="/contact"
        className="fixed left-0 top-1/2 z-30 hidden -translate-y-1/2 bg-gold px-2.5 py-5 text-sm font-medium tracking-wide text-white transition-colors hover:bg-gold-dark md:block"
        style={{ writingMode: "vertical-rl", transform: "translateY(-50%) rotate(180deg)" }}
      >
        Enquire Now
      </Link>
      <div className="fixed bottom-5 left-4 z-30 flex flex-col gap-2">
        
      </div>
    </>
  );
}

export function SampleNotice() {
  if (!showSampleNotice) return null;
  return (
    <div className="bg-gold-soft px-4 py-1.5 text-center text-xs text-ink-muted">
      Preview: projects, figures and photos on this site are sample content.
    </div>
  );
}
