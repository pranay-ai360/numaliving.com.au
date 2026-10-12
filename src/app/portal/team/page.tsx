import type { Metadata } from "next";
import { TeamView } from "@/components/portal/TeamView";

export const metadata: Metadata = { title: "Team & Access" };

export default function TeamPage() {
  return <TeamView />;
}
