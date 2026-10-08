import type { Metadata } from "next";
import { ButtonLink, Container } from "@/components/ui";

export const metadata: Metadata = { title: "Client Portal", robots: { index: false } };

/**
 * PHASE 2 ENTRY POINT — the client portal.
 *
 * Planned structure (see README "Connecting the portal"):
 *   /portal                    → My projects (projects the signed-in user is a member of)
 *   /portal/project?id=…       → Project dashboard
 *     tabs: drawings · shop drawings · RFIs · samples · production · updates · commercials
 *   /portal/admin              → Numa back office: create projects, run the responsibility form,
 *                                invite people, review incoming quote requests
 *
 * Every page under /portal must check sign-in and the member's rights for that
 * project (types in src/lib/types.ts). The database rules in firestore.rules
 * enforce the same rights on the server side.
 */
export default function PortalPage() {
  return (
    <section className="py-32">
      <Container className="max-w-2xl text-center">
        <p className="eyebrow">Client portal</p>
        <h1 className="display mt-4 text-2xl sm:text-3xl">Coming Soon</h1>
        <p className="mt-6 text-lg text-ink-muted">
          Project dashboards, drawings, shop drawing approvals, RFIs, samples and production tracking will live here.
        </p>
        <div className="mt-10">
          <ButtonLink href="/">Back to the Website</ButtonLink>
        </div>
      </Container>
    </section>
  );
}
