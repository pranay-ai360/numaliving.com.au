/**
 * Quote requests from the Contact page.
 *
 * Demo mode (no Firebase keys): validates and returns a sample reference.
 * Firebase mode: uploads PDFs and the sketch to Cloud Storage, then
 * writes one document to the `quoteRequests` collection with
 * status "new". The Numa back office (Phase 2) reads that collection
 * and can turn a request into a portal project.
 */
import type { QuoteRequest, SubmissionResult } from "@/lib/types";
import { getFirebaseApp, isFirebaseConfigured, paths } from "@/lib/firebase";

export const UPLOAD_LIMITS = {
  maxFiles: 10,
  maxFileMb: 25,
  accept: "application/pdf",
} as const;

export function validateFiles(files: File[]): string | null {
  if (files.length > UPLOAD_LIMITS.maxFiles) return `Please attach up to ${UPLOAD_LIMITS.maxFiles} files.`;
  for (const f of files) {
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return `${f.name} is not a PDF. Drawings must be PDF files.`;
    if (f.size > UPLOAD_LIMITS.maxFileMb * 1024 * 1024) return `${f.name} is larger than ${UPLOAD_LIMITS.maxFileMb} MB.`;
  }
  return null;
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

export async function submitQuote(request: QuoteRequest, files: File[], sketch: Blob | null): Promise<SubmissionResult> {
  const fileError = validateFiles(files);
  if (fileError) return { ok: false, error: fileError };

  if (!isFirebaseConfigured) {
    await new Promise((r) => setTimeout(r, 600));
    return { ok: true, demo: true, reference: `DEMO-${Date.now().toString(36).toUpperCase()}` };
  }

  try {
    const app = getFirebaseApp();
    const { getFirestore, collection, doc, setDoc, serverTimestamp } = await import("firebase/firestore");
    const { getStorage, ref, uploadBytes } = await import("firebase/storage");
    const db = getFirestore(app);
    const storage = getStorage(app);

    const docRef = doc(collection(db, paths.quoteRequests));
    const folder = `${paths.quoteUploads}/${docRef.id}`;

    const uploaded: { name: string; path: string; size: number }[] = [];
    for (const f of files) {
      const path = `${folder}/${safeName(f.name)}`;
      await uploadBytes(ref(storage, path), f, { contentType: "application/pdf" });
      uploaded.push({ name: f.name, path, size: f.size });
    }

    let sketchPath: string | null = null;
    if (sketch) {
      sketchPath = `${folder}/sketch.png`;
      await uploadBytes(ref(storage, sketchPath), sketch, { contentType: "image/png" });
    }

    await setDoc(docRef, {
      ...request,
      files: uploaded,
      sketchPath,
      status: "new",
      source: "website",
      createdAt: serverTimestamp(),
    });

    return { ok: true, reference: docRef.id.slice(0, 8).toUpperCase() };
  } catch (err) {
    console.error("Quote submission failed", err);
    return { ok: false, error: "Something went wrong sending your request. Please try again or email us directly." };
  }
}
