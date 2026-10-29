import type { Metadata } from "next";
import { InstallationView } from "@/components/portal/InstallationView";

export const metadata: Metadata = { title: "Installation Videos" };

export default function InstallationPage() {
  return <InstallationView />;
}
