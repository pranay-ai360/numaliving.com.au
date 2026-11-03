import { Fragment } from "react";
import { Photo } from "@/components/Photo";
import { ButtonLink } from "@/components/ui";
import type { ShowcasePhoto } from "@/lib/types";

/**
 * The dark layer between the photo and the text. It is the brand's ink color (--brand-ink in
 * src/app/globals.css), strongest where the text starts and never weaker than `weakestOpacity`: at
 * that opacity even a pure white pixel of the photo gives white text a contrast of about 6.3:1, and
 * the cream eyebrow about 5.3:1, above the 4.5:1 WCAG asks for (src/components/HomeHero.test.tsx
 * checks this against the layer as drawn).
 */
export const HERO_OVERLAY = { color: [28, 27, 25], strongestOpacity: 0.9, weakestOpacity: 0.7 } as const;

const HEADING_ID = "home-hero-heading";

function overlayBackground(): string {
  const [red, green, blue] = HERO_OVERLAY.color;
  const layer = (opacity: number): string => `rgba(${red}, ${green}, ${blue}, ${opacity})`;
  return `linear-gradient(90deg, ${layer(HERO_OVERLAY.strongestOpacity)}, ${layer(HERO_OVERLAY.weakestOpacity)})`;
}

type HomeHeroProps = {
  /** What Numa makes, in a few words. */
  eyebrow: string;
  /** The heading, one string per line: what Numa makes, where it is engineered, who it is built for. Read together, with spaces, they are the page's one sentence. */
  title: readonly string[];
  /** What the factory can do, in one line. It must not claim projects delivered. */
  statement: string;
  /** Who the site is for, and what to do next. */
  audience: string;
  /** A project photo that shows no other company's logo. */
  photo: ShowcasePhoto;
};

/**
 * The home page's first screen: a photograph under a dark layer, with the page's one heading, a line
 * of capability and the two ways in. The photo is the largest thing in view on arrival, so it loads
 * first and at high priority; it fills the section from behind the text (absolute, with the width and
 * height it was cut at), so it never moves the page. Nothing here moves, so there is nothing to
 * switch off for people who prefer reduced motion.
 */
export function HomeHero({ eyebrow, title, statement, audience, photo }: HomeHeroProps) {
  return (
    <section aria-labelledby={HEADING_ID} className="relative isolate overflow-hidden bg-ink">
      {/* From 768 px the fixed "Inquire Now" tab (src/components/Chrome.tsx) is 60 px wide at the left edge, so the text starts 5rem in; from 1380 px the centered container already leaves that room. */}
      <div className="relative mx-auto flex min-h-[560px] max-w-7xl flex-col justify-center px-4 py-20 sm:min-h-[640px] sm:px-6 md:pl-20 min-[1380px]:pl-6">
        <span aria-hidden="true" className="block h-px w-16 bg-gold" />
        <p className="eyebrow mt-6 text-gold-soft">{eyebrow}</p>
        <h1 id={HEADING_ID} className="display mt-5 text-xl text-paper sm:text-3xl lg:text-4xl xl:text-5xl">
          {title.map((line, index) => (
            <Fragment key={line}>
              {index > 0 && " "}
              <span className="block">{line}</span>
            </Fragment>
          ))}
        </h1>
        <p className="display mt-6 text-sm text-paper sm:text-lg">{statement}</p>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper">{audience}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/contact">Request a Quote</ButtonLink>
          <ButtonLink href="/projects" variant="light">
            View Projects
          </ButtonLink>
        </div>
      </div>
      {/*
        The photo and its dark layer come last in the page so a screen reader reads the heading and the text
        before the long description of the photo (it is a backdrop). They are still drawn behind the text:
        the section is its own stacking context (isolate) and their negative z-index puts them under it.
      */}
      <Photo photo={photo} sizes="100vw" loading="priority" className="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_55%]" />
      <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ backgroundImage: overlayBackground() }} />
    </section>
  );
}
