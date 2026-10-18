import type { Metadata } from "next";
import { pageMetadata } from "@/app/pageMetadata";
import { LegalPage } from "@/components/LegalPage";
import { privacyNotice } from "@/content/legal";

export const metadata: Metadata = pageMetadata("/privacy");

export default function PrivacyPage() {
  return <LegalPage legal={privacyNotice} />;
}
