import type { Metadata } from "next";
import { pageMetadata } from "@/app/pageMetadata";
import { LegalPage } from "@/components/LegalPage";
import { websiteTerms } from "@/content/legal";

export const metadata: Metadata = pageMetadata("/terms");

export default function TermsPage() {
  return <LegalPage legal={websiteTerms} />;
}
