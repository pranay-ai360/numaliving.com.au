import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Container, PageHero } from "@/components/ui";
import { LEGAL_LAST_UPDATED, legalDrafts, type LegalDocument, type LegalDraft } from "@/content/legal";

export const DRAFT_NOTICE = "Draft: a lawyer has not reviewed this page yet.";

type LegalPageProps = {
  legal: LegalDocument;
  /** The drafts still waiting for a lawyer (src/content/legal.ts); the page says it is a draft while its own entry is in the list. */
  drafts?: readonly LegalDraft[];
};

/**
 * A legal page (the privacy notice, the website terms): a heading, when it was last updated, a plain
 * notice while it is still a draft, then its sections. The words are in src/content/legal.ts.
 */
export function LegalPage({ legal, drafts = legalDrafts }: LegalPageProps) {
  const isDraft = drafts.some((draft) => draft.id === legal.id);
  return (
    <>
      <Breadcrumbs items={[{ name: legal.title, path: legal.path }]} />
      <PageHero eyebrow="Legal" title={legal.title} lead={legal.lead} />
      <section className="py-16 sm:py-20">
        <Container>
          <div className="max-w-3xl">
            <p className="text-sm text-ink-muted">
              Last updated <time dateTime={LEGAL_LAST_UPDATED.iso}>{LEGAL_LAST_UPDATED.text}</time>
            </p>
            {isDraft && <p className="mt-4 border-l-2 border-gold bg-gold-soft px-5 py-4 text-sm leading-relaxed">{DRAFT_NOTICE}</p>}
            <div className="mt-10 space-y-10">
              {legal.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="display text-lg">{section.heading}</h2>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="mt-4 text-lg leading-relaxed text-ink-muted">
                      {paragraph}
                    </p>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
