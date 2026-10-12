import type { Metadata } from "next";
import { TrackingView } from "@/components/portal/TrackingView";

export const metadata: Metadata = { title: "Production & Shipping" };

export default function TrackingPage() {
  return <TrackingView />;
}
