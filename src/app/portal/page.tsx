import type { Metadata } from "next";
import { OverviewView } from "@/components/portal/OverviewView";

export const metadata: Metadata = { title: "Client Portal" };

/**
 * Client portal (DEMO). Runs on the sample data in src/lib/portal/demo.ts.
 * Pages: /portal (this), /portal/approvals, /portal/rfis, /portal/tracking, /portal/team.
 * When Firebase is connected, the same screens read real project data and
 * every page checks sign-in and the person's rights (see firestore.rules).
 */
export default function PortalPage() {
  return <OverviewView />;
}
