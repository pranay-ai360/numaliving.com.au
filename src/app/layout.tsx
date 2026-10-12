import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { site } from "@/config/site";
import { Header } from "@/components/Header";
import { Footer, FloatingActions, SampleNotice } from "@/components/Chrome";
import { HideOnPortal } from "@/components/HideOnPortal";

// Fonts are self-hosted from src/fonts (both are free Google Fonts, SIL Open Font License).
// Michroma: wide display face close to the Condor headings. Montserrat: body text.
const display = localFont({ src: "../fonts/michroma-400.woff2", variable: "--font-display", weight: "400" });
const body = localFont({
  src: [
    { path: "../fonts/montserrat-variable.woff2", style: "normal", weight: "100 900" },
    { path: "../fonts/montserrat-variable-italic.woff2", style: "italic", weight: "100 900" },
  ],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: { default: `${site.name} | ${site.tagline}`, template: `%s | ${site.name}` },
  description: site.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:p-2">
          Skip to content
        </a>
        <SampleNotice />
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <HideOnPortal>
          <FloatingActions />
        </HideOnPortal>
      </body>
    </html>
  );
}
