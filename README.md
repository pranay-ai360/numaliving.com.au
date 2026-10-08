# Numa Living website

The public website for Numa Living: Home, About, Projects (with case pages), Factory, Capabilities, Process, Global Delivery, Request a Quote and Client Login. It is built so the client portal (Phase 2) plugs into it later.

Built with Next.js, Tailwind CSS and Firebase (Google Cloud).

## Run it on your Mac

1. Install Node.js (version 20 or newer) from nodejs.org.
2. Open Terminal in this folder and run:

   ```
   npm install
   npm run dev
   ```

3. Open http://localhost:3000 in your browser. Pages refresh as you edit files.

## Where to change things

| To change… | Edit this file |
| --- | --- |
| Colours (Condor gold, backgrounds, text) | `src/app/globals.css` (top block) |
| Name, contact details, menu | `src/config/site.ts` |
| Page text, stats, capabilities, process steps | `src/content/pages.ts` |
| Projects | `src/content/projects.ts` |
| The "sample content" ribbon | `showSampleNotice` in `src/config/site.ts` |
| Fonts | `src/app/layout.tsx` and `src/fonts/` |

**Adding project photos:** put the images in `public/projects/<project-slug>/`, then list them in that project's `images`, e.g. `images: ["/projects/palm-jumeirah-villa/01.jpg"]`. The first image is the cover. Projects with no photos show a material-swatch placeholder.

Everything marked `sample: true`, `SAMPLE` or `TODO(Ramya)` is placeholder content to replace.

## Demo mode vs live mode

Until Firebase is connected, the site runs in **demo mode**: the quote form checks inputs and shows a confirmation, but nothing is stored, and Client Login shows "opens soon".

To go live:

1. Create a project at console.firebase.google.com and add a **Web app**.
2. Turn on **Firestore Database**, **Storage** and **Authentication** (Email/Password).
3. Copy `.env.example` to `.env.local` and paste in the six values from the web app settings.
4. Install the Firebase tools and deploy:

   ```
   npm install -g firebase-tools
   firebase login
   firebase use --add          (pick your project)
   npm run build
   firebase deploy
   ```

Quote requests then appear in Firestore under `quoteRequests`, with PDFs and sketches in Storage under `quote-uploads/`.

Before launch: turn on **App Check** (reCAPTCHA) in Firebase to block spam on the quote form, and set up an email alert for new requests (the "Trigger Email" Firebase extension is the simplest route).

## Connecting the portal (Phase 2)

These threads are already in place:

- **Shared data types:** `src/lib/types.ts` defines the website types and the portal types (`PortalProject`, `ProjectMember`, per-module `Permission`). Rights are set per person, per project, per module by the client's main contact (the responsibility form), not by fixed roles.
- **One Firebase connection:** `src/lib/firebase.ts`. The portal uses the same project, database and login.
- **Quote → project:** quote requests are stored with `status: "new"`. The back office will list them and convert one into a `PortalProject` (`quoteRequestId` links the two).
- **Showcase ↔ project:** `PortalProject.showcaseSlug` links a finished project to its public case page.
- **Sign-in:** `src/lib/services/auth.ts` already signs in with Firebase. Set `PORTAL_LIVE = true` when the portal is ready.
- **Portal entry:** `src/app/portal/page.tsx` is the placeholder, with the planned page structure in its comments.
- **Security rules:** `firestore.rules` and `storage.rules` lock everything except quote submissions, and sketch how project-member rights will be checked.

All drawings are PDFs; no CAD viewer is needed.

## Hosting

`npm run build` creates a static site in `out/`, which Firebase Hosting serves. No server is needed because the site talks to Firebase from the browser. If the portal later needs server code, remove `output: "export"` from `next.config.ts` and deploy with Firebase App Hosting instead.
