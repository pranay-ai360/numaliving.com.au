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
            <li>
              <a href={`tel:${site.contact.phone.replace(/\s/g, "")}`} className="hover:text-gold">
                {site.contact.phone}
              </a>
            </li>
            <li className="text-white/60">{site.contact.address}</li>
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
        <a
          href={`tel:${site.contact.phone.replace(/\s/g, "")}`}
          aria-label="Call us"
          className="flex h-11 w-11 items-center justify-center rounded-sm bg-gold text-white shadow-md hover:bg-gold-dark"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8Z" />
          </svg>
        </a>
        <a
          href={`https://wa.me/${site.contact.whatsapp}`}
          aria-label="Message us on WhatsApp"
          className="flex h-11 w-11 items-center justify-center rounded-sm bg-gold text-white shadow-md hover:bg-gold-dark"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8L4 20Z" strokeLinejoin="round" />
            <path d="M9.2 8.6c.2-.4.5-.4.7-.4h.5c.2 0 .4.1.5.4l.6 1.4c.1.2 0 .4-.1.6l-.4.5c.5 1 1.3 1.8 2.3 2.3l.5-.4c.2-.1.4-.2.6-.1l1.4.6c.3.1.4.3.4.5v.5c0 .2 0 .5-.4.7-.6.4-1.4.6-2.4.2a8 8 0 0 1-4.3-4.3c-.4-1-.2-1.8.1-2.5Z" fill="currentColor" stroke="none" />
          </svg>
        </a>
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
