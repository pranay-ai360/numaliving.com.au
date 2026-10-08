"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { portalAvailable, sendReset, signIn } from "@/lib/services/auth";

const field = "mt-1.5 w-full rounded-sm border border-line bg-paper px-3.5 py-2.5 outline-none focus:border-gold disabled:bg-linen";

export function LoginForm() {
  const router = useRouter();
  const live = portalAvailable();
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    setBusy(true);
    setMessage(null);
    if (mode === "reset") {
      await sendReset(email);
      setMessage({ kind: "info", text: "If that email has an account, a reset link is on its way." });
    } else {
      const res = await signIn(email, String(fd.get("password") ?? ""));
      if (res.ok) router.push("/portal");
      else setMessage({ kind: "error", text: res.error });
    }
    setBusy(false);
  }

  return (
    <div>
      {!live && (
        <div className="mb-8 border-l-2 border-gold bg-gold-soft px-5 py-4 text-sm leading-relaxed">
          <p className="font-medium">The client portal opens soon.</p>
          <p className="mt-1 text-ink-muted">
            Project teams will be invited by email when their project starts. Until then, please contact your Numa project manager.
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        <label className="block text-sm font-medium">
          Email
          <input name="email" type="email" required autoComplete="email" disabled={!live} className={field} />
        </label>
        {mode === "signin" && (
          <label className="block text-sm font-medium">
            Password
            <input name="password" type="password" required autoComplete="current-password" disabled={!live} className={field} />
          </label>
        )}
        {message && (
          <p role={message.kind === "error" ? "alert" : "status"} className={`text-sm ${message.kind === "error" ? "text-red-700" : "text-ink-muted"}`}>
            {message.text}
          </p>
        )}
        <button type="submit" disabled={!live || busy} className="w-full rounded-sm bg-gold py-3 font-medium text-white transition-colors hover:bg-gold-dark disabled:opacity-50">
          {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Send Reset Link"}
        </button>
      </form>

      <div className="mt-6 flex justify-between text-sm">
        <button type="button" disabled={!live} onClick={() => setMode(mode === "signin" ? "reset" : "signin")} className="text-gold hover:text-gold-dark disabled:opacity-50">
          {mode === "signin" ? "Forgot password?" : "Back to sign in"}
        </button>
        <Link href="/contact" className="text-ink-muted hover:text-gold">
          New project? Get in touch
        </Link>
      </div>
    </div>
  );
}
