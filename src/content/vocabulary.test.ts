import { describe, expect, it } from "vitest";
import { PRIVACY_NOTE } from "@/components/quote-form/constants";
import { site } from "@/config/site";
import { about, capabilities, craft, delivery, factory, factoryPhoto, home, process } from "@/content/pages";
import { projects } from "@/content/projects";
import { pageRegistry } from "@/content/seo";
import { PROJECT_TYPE_OPTIONS, ROLE_OPTIONS, TIMELINE_OPTIONS } from "@/lib/quotes/fields";
import { sendFailureMessage, UNEXPECTED_FAILURE_MESSAGE } from "@/lib/quotes/messages";
import type { SendFailureReason } from "@/lib/types";
import { findUkTerms } from "@/lib/vocabulary";

type Phrase = Readonly<{ path: string; text: string }>;

const SEND_FAILURE_REASONS: readonly SendFailureReason[] = ["not-configured", "not-activated", "network", "timeout", "too-large", "rejected", "invalid-response"];

/** Every string in a piece of content, however deeply nested, with the path that leads to it. */
function phrasesIn(value: unknown, path: string): readonly Phrase[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => phrasesIn(item, `${path}[${index}]`));
  if (typeof value === "object" && value !== null) return Object.entries(value).flatMap(([key, item]) => phrasesIn(item, `${path}.${key}`));
  return [];
}

/** The copy that lives in code rather than in a page's HTML: some of it only shows after a visitor acts (an error, a filled form). */
const COPY: Readonly<Record<string, unknown>> = {
  home,
  about,
  capabilities,
  factory,
  process,
  delivery,
  craft,
  factoryPhoto,
  projects,
  site,
  pageRegistry,
  roleOptions: ROLE_OPTIONS,
  projectTypeOptions: PROJECT_TYPE_OPTIONS,
  timelineOptions: TIMELINE_OPTIONS,
  privacyNote: PRIVACY_NOTE,
  sendFailureMessages: SEND_FAILURE_REASONS.map(sendFailureMessage),
  unexpectedFailureMessage: UNEXPECTED_FAILURE_MESSAGE,
};

describe("the site's copy in code", () => {
  it.each(Object.entries(COPY))("is written in US English: %s", (name, content) => {
    // Arrange
    const phrases = phrasesIn(content, name);

    // Act
    const offenders = phrases.flatMap(({ path, text }) => findUkTerms(text).map((found) => `${path}: "${found.match}" (${found.term}): write "${found.us}"`));

    // Assert
    expect(offenders).toEqual([]);
  });

  it("reaches real copy, so the check above is not passing on empty content", () => {
    // Arrange
    const phrases = Object.entries(COPY).flatMap(([name, content]) => phrasesIn(content, name));

    // Act
    const words = phrases.reduce((total, { text }) => total + text.split(/\s+/).length, 0);

    // Assert
    expect(words).toBeGreaterThan(1500);
  });
});
