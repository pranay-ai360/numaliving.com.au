import type { Metadata } from "next";
import { LineArt, Wordmark } from "@/components/Brand";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Client Login" };

export default function LoginPage() {
  return (
    <section className="linen relative overflow-hidden">
      <LineArt className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 w-full text-gold/20" />
      <div className="relative mx-auto flex min-h-[640px] max-w-md flex-col justify-center px-4 py-16">
        <div className="bg-paper p-8 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:p-10">
          <div className="text-center">
            <Wordmark />
            <h1 className="display mt-8 text-lg">Client Portal</h1>
            <p className="mt-2 text-sm text-ink-muted">Drawings, approvals, RFIs and production status for your project.</p>
          </div>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </div>
    </section>
  );
}
