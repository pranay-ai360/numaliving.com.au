"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PORTAL_DEMO, portalAvailable, sendReset, signIn } from "@/lib/services/auth";
import { rememberDemoRole } from "@/components/portal/DemoContext";
import { roles } from "@/lib/portal/demo";

const field = "mt-1.5 w-full rounded-sm border border-line bg-paper px-3.5 py-2.5 outline-none focus:border-gold disabled:bg-linen";

export function LoginForm() {
  const router = useRouter();
  const live = portalAvailable();
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  // Demo mode: no real accounts yet, so let visitors step into the portal as one of the sample people.
  if (!live && PORTAL_DEMO) {
    return (
      <div className="space-y-4">
        <p className="text-center text-sm text-ink-muted">Preview the portal with sample project data. Choose who to sign in as:</p>
        {roles.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => {
              rememberDemoRole(r.key);
              router.push("/portal/");
            }}
            className="w-full rounded-sm border border-gold py-3 font-medium text-gold-dark transition-colors hover:bg-gold hover:text-white"
          >
            Enter as {r.label}
          </button>
        ))}
        <p className="pt-2 text-center text-xs text-ink-muted">Demo only. Nothing you do is saved.</p>
      </div>
    );
  }

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
