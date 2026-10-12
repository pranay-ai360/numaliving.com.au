import type { Metadata } from "next";
import { RfisView } from "@/components/portal/RfisView";

export const metadata: Metadata = { title: "RFIs" };

export default function RfisPage() {
  return <RfisView />;
}
