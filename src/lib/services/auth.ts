/**
 * Client portal sign-in.
 *
 * Accounts are invite-only: Numa creates them when a project starts
 * (Phase 2). Until Firebase is configured and the portal is built,
 * the login page explains that the portal is coming soon.
 */
import { getFirebaseApp, isFirebaseConfigured } from "@/lib/firebase";

/** Flip to true when the Phase 2 portal is ready to receive users. */
export const PORTAL_LIVE = false;

/**
 * While the portal is not live, the login page offers a clickable demo
 * on sample data instead (see src/lib/portal/demo.ts). Set to false to hide it.
 */
export const PORTAL_DEMO = true;

export const portalAvailable = () => PORTAL_LIVE && isFirebaseConfigured;

export type AuthResult = { ok: true } | { ok: false; error: string };

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!portalAvailable()) return { ok: false, error: "The client portal is not open yet." };
  try {
    const { getAuth, signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(getAuth(getFirebaseApp()), email, password);
    return { ok: true };
  } catch {
    return { ok: false, error: "That email and password do not match an account." };
  }
}

export async function sendReset(email: string): Promise<AuthResult> {
  if (!portalAvailable()) return { ok: false, error: "The client portal is not open yet." };
  try {
    const { getAuth, sendPasswordResetEmail } = await import("firebase/auth");
    await sendPasswordResetEmail(getAuth(getFirebaseApp()), email);
    return { ok: true };
  } catch {
    // Same message either way, so the form never reveals which emails have accounts.
    return { ok: true };
  }
}
