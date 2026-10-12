"use client";

import { usePathname } from "next/navigation";

/** Hides its contents inside the client portal (e.g. the floating Enquire and WhatsApp buttons). */
export function HideOnPortal({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname.startsWith("/portal") ? null : <>{children}</>;
}
