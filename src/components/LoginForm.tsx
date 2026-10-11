import Link from "next/link";
import { useId, type ReactElement } from "react";

const field = "mt-1.5 w-full rounded-sm border border-line bg-paper px-3.5 py-2.5 outline-none focus:border-gold disabled:bg-linen";

/**
 * Client Login, design only: the Client Portal does not exist yet, so nobody can
 * sign in. The fieldset disables every control inside it, and each control is also
 * disabled on its own. There is deliberately no <form>: even with the controls
 * switched back on in the browser's developer tools, nothing here can be submitted,
 * so a password can never end up in a URL.
 *
 * For screen readers the fieldset has a name (a legend shown to them only, so the
 * design is unchanged) and the "opens soon" notice as its description, so they hear
 * why the controls are unavailable.
 */
export function LoginForm(): ReactElement {
  const noticeId = useId();

  return (
    <div>
      <div id={noticeId} className="mb-8 border-l-2 border-gold bg-gold-soft px-5 py-4 text-sm leading-relaxed">
        <p className="font-medium">The client portal opens soon.</p>
        <p className="mt-1 text-ink-muted">
          Project teams will be invited by email when their project starts. Until then, please contact your Numa project manager.
        </p>
      </div>

      <div>
        <fieldset disabled aria-describedby={noticeId} className="space-y-5">
          <legend className="sr-only">Sign in to the client portal</legend>
          <label className="block text-sm font-medium">
            Email
            <input name="email" type="email" required autoComplete="email" disabled className={field} />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input name="password" type="password" required autoComplete="current-password" disabled className={field} />
          </label>
          <button type="button" disabled className="w-full rounded-sm bg-gold py-3 font-medium text-white transition-colors hover:bg-gold-dark disabled:opacity-50">
            Sign In
          </button>
        </fieldset>
      </div>

      <div className="mt-6 flex justify-between text-sm">
        <button type="button" disabled className="text-gold hover:text-gold-dark disabled:opacity-50">
          Forgot password?
        </button>
        <Link href="/contact" className="text-ink-muted hover:text-gold">
          New project? Get in touch
        </Link>
      </div>
    </div>
  );
}
