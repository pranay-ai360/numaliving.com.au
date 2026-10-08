/**
 * Firebase connection — the single place the site talks to Google Cloud.
 *
 * Until the NEXT_PUBLIC_FIREBASE_* values are set in `.env.local`
 * (see `.env.example`), the site runs in demo mode: forms validate and
 * show a confirmation, but nothing is stored and login is disabled.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.storageBucket);

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured. Add the NEXT_PUBLIC_FIREBASE_* values to .env.local.");
  }
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/** Firestore collection and Storage folder names, shared with the security rules. */
export const paths = {
  quoteRequests: "quoteRequests",
  quoteUploads: "quote-uploads",
  // Phase 2 (portal) — see firestore.rules for the planned structure
  projects: "projects",
  users: "users",
} as const;
