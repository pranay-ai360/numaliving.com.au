import Link from "next/link";
import { site } from "@/config/site";

/** Text wordmark in the Condor style. Swap for an <Image> once a Numa logo file exists. */
export function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <span className="inline-flex flex-col items-center leading-none text-gold">
      <span className={`display font-normal ${big ? "text-5xl sm:text-6xl" : "text-2xl sm:text-3xl"}`} style={{ letterSpacing: "0.08em" }}>
        {site.wordmark}
      </span>
      <span
        className={`font-semibold ${big ? "mt-3 text-xs" : "mt-1.5 text-[0.55rem]"}`}
        style={{ letterSpacing: big ? "0.9em" : "0.75em", marginRight: big ? "-0.9em" : "-0.75em" }}
      >
        {site.wordmarkSub}
      </span>
    </span>
  );
}

export function LogoLink() {
  return (
    <Link href="/" aria-label={`${site.name} home`} className="shrink-0">
      <Wordmark />
    </Link>
  );
}

/**
 * Thin gold line-art of joinery elevations (wall panels, a tall
 * wardrobe, a door), echoing the building line-art on the Condor site.
 */
export function LineArt({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 1200 420" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" preserveAspectRatio="xMidYMax slice">
      {/* fluted wall panel, left */}
      <rect x="20" y="60" width="200" height="360" />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={`f${i}`} x1={40 + i * 20} y1="60" x2={40 + i * 20} y2="420" />
      ))}
      {/* tall wardrobe with shaker doors */}
      <rect x="250" y="20" width="260" height="400" />
      <line x1="380" y1="20" x2="380" y2="420" />
      <rect x="270" y="40" width="90" height="230" />
      <rect x="400" y="40" width="90" height="230" />
      <rect x="270" y="290" width="90" height="110" />
      <rect x="400" y="290" width="90" height="110" />
      <line x1="368" y1="190" x2="368" y2="250" />
      <line x1="392" y1="190" x2="392" y2="250" />
      {/* pivot door with frame, perspective */}
      <polyline points="560,420 560,90 700,60 700,420" />
      <polyline points="580,420 580,110 680,88 680,420" />
      <line x1="590" y1="250" x2="600" y2="248" />
      {/* kitchen run: wall cabinets, island */}
      <rect x="740" y="110" width="420" height="110" />
      {Array.from({ length: 6 }, (_, i) => (
        <line key={`k${i}`} x1={810 + i * 70} y1="110" x2={810 + i * 70} y2="220" />
      ))}
      <polyline points="720,420 760,330 1140,330 1180,420" />
      <line x1="760" y1="330" x2="760" y2="420" />
      <line x1="1140" y1="330" x2="1140" y2="420" />
      <line x1="740" y1="345" x2="1160" y2="345" />
    </svg>
  );
}
