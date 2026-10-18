# Owner input pack

What the US SEO programme needs from the owner. It has three parts: ten decisions, the facts each page needs, and the questions about the photos, the sample projects and the claims the pages make. Nothing on a page is invented: a page whose facts are missing is not published, and the launch guard keeps the site `noindex` while placeholder or sample content remains. Every line says **Unlocks:** what your answer lets us do. The plan and its phases are described in [ADR 0003](../adr/0003-us-seo-strategy.md); the proposed URLs are the map in that ADR.

Answer in any form (a reply, a call, this file filled in). A short answer is enough where the options are given.

## Part 1. Ten decisions

### 1. Positioning and first buyer

Who should the first screen speak to: architects and designers, general contractors, developers, or luxury homeowners through designers? Does "custom architectural millwork and FF&E, engineered and made in Dubai, delivered to US projects" describe Numa correctly?

Your answer:

**Unlocks:** the positioning statement, the home page first screen and headline (Phase 2), and the draft titles and descriptions in the [keyword map](keyword-map.md), whose facts need your confirmation.

### 2. US presence

Is there, or will there be: a US phone number, a named US contact and hours, US installation partners, a US representative or office?

Your answer:

**Unlocks:** the Contact page (US phone and hours with time zones, factory address) and the replacement of the placeholder phone and address that keep the site `noindex` (Phase 2); the install-support wording on the import page; and an answer to US buyers' doubts about installation and warranty.

### 3. Verifiable facts (blocks Phase 2)

Please provide, with documents where they exist:

- year founded, legal entity, factory size, machines, headcount;
- certifications: ISO, FSC, AWI/QCP, TSCA Title VI or CARB, fire ratings (or "not certified");
- lead times by scope, ports and Incoterms, warranty, minimum project size;
- real US-delivered projects, with permission to name clients and designers;
- licensing and credit for the 30 photographs.

Your answer:

**Unlocks:** replacing the sample figures (120+ projects, 14 countries, 18,000 m², 250 staff), the "to be confirmed" certifications and the sample projects with real ones; the About, factory, standards and import pages; and the launch guard going green. Page-by-page needs are in Part 2.

### 4. Brand

Has a trademark check been done for "Numa Living" in the US, and which descriptor should follow the name in titles (for example "Numa Living millwork")? Is there a link or document that proves "A Conqueror Group company"?

Your answer:

**Unlocks:** the name and descriptor used in titles and in the Organization schema; `sameAs` links for profiles that are live (Phase 4); the verifiable parent-group line on the About page; and one of the launch gates (the trademark question answered).

### 5. Analytics and Search Console

Cloudflare Web Analytics or GA4? For Search Console, a DNS TXT record (needs your approval in Cloudflare) or an HTML tag? (Bing Webmaster Tools too.)

Your answer:

**Unlocks:** the analytics setup (Phase 1), a verified Search Console property and submitted sitemap at launch (Phase 5), and the measurement of the 90-day loop (Phase 6).

### 6. Who writes and approves, and interviews

Who writes and approves the copy? Can two or three interviews of about an hour be held with engineering, logistics and sales?

Your answer:

**Unlocks:** the guides and service pages: each starts from an interview, so it carries real detail instead of generic advice (Phase 3).

### 7. URL map sign-off

Is the proposed URL map in [ADR 0003](../adr/0003-us-seo-strategy.md) acceptable? Static hosting cannot redirect, so this is a one-way door.

Your answer:

**Unlocks:** the start of Phase 3 (new pages), and removing `/capabilities/` in favour of `/architectural-millwork/`.

### 8. Who reviews duty and compliance statements

Which customs broker or compliance adviser will review statements about duties, HS codes, TSCA Title VI and CARB?

Your answer:

**Unlocks:** the Wave B guides on TSCA and CARB, duties and HS codes. They are published only after review, with source links and a date.

### 9. Budget for memberships and listings

Is there budget for optional memberships and listings: AWI, ARCAT, Houzz Pro?

Your answer:

**Unlocks:** the trade listings and profiles of Phase 4 (AWI membership or QCP only if pursued), which build the links and entity signals a new domain lacks.

### 10. Client portal

Keep the Client Login messaging as "opens soon", or remove it?

Your answer:

**Unlocks:** the Client Portal wording. Phase 2 already reworded every page to say the portal "opens soon" and nothing that implies it works today (a test keeps it so); your answer says whether to keep that, or to remove the portal messaging and the Client Login links. The login notice ("Project teams will be invited by email when their project starts. Until then, please contact your Numa project manager.") is the earlier wording and still needs your confirmation. `/login/` stays `noindex` either way.

## Part 2. Facts each page needs

| Page | What to provide | Unlocks |
| --- | --- | --- |
| Import hub (`/overseas-millwork-manufacturer/`) | lead times by scope, ports and Incoterms, freight and customs partners, documents supplied with each shipment, compliance paperwork, install support model, warranty, inspection photos, one real US-delivered project | the first target of the plan: overseas and import millwork for US projects |
| Standards (`/standards/`) | certificates and their numbers (or "not certified") | a standards page that states only what is verified; AWI alignment only if true |
| Factory (`/factory/`) | area, machines, headcount, finishing and QC steps, packing method, photos with permission | the factory and quality page, and the plain facts that AI Overviews quote |
| Sector pages (`/sectors/multifamily/`, `/hospitality/`, `/luxury-residential/`) | two real projects each, typical scope and quantities, repeatability and QC method | the three Wave A sector pages |
| About (`/about/`) | legal entity, founders and leaders with LinkedIn, year founded, parent group proof, factory area, headcount, certifications with their documents | the Company Facts block on the About page. The seven facts go in `src/content/company.ts`; each one shows once it is set, and each one missing keeps the site `noindex`. If a fact cannot be published (for example, no certifications), say so and its row is removed instead of guessed |
| Guides (`/resources/<slug>/`) | answers to the interviewer's questions: what do buyers get wrong, one real example with numbers, what surprised you, who should not buy | the four launch guides: cost, AWI Premium versus Custom grade, importing to the US, shop drawings and submittals |
| Privacy and Terms (`/privacy/`, `/terms/`) | how long Quote Requests are kept; which privacy laws apply (US states, the Australian Privacy Act, the UAE PDPL, the GDPR) and the rights they give visitors; the legal name of the company that receives the requests; a postal address; a lawyer's review of both drafts | the two drafts written in Phase 2 from what the site does today. Deleting their entries in `legalDrafts` (`src/content/legal.ts`) clears the blockers `legal.privacy needs legal review` and `legal.terms needs legal review` |
| Contact (`/contact/`) | a US phone number, office hours and their time zone, the factory address | `site.contact.hours` and `site.contact.timezone` (the Contact page shows them once set), and the placeholder phone and address that keep the site `noindex` |
| Home first screen (`/`) | a yes or a rewrite for "Custom millwork, engineered in Dubai. Built for US projects." and "Made in our Dubai factory. Shipped to US job sites." (they state what the factory can do, not projects delivered); confirmation that Numa ships to US job sites | the first-screen wording. It is the plan's starting draft and rests on decision 1 |
| Capabilities (`/capabilities/`) | certificates for "Fire-rated doors", or a word that the line should go (fire ratings are listed in decision 3 and no certificate is known) | a capability list that states only what Numa can back |

Where a fact cannot be provided, say so. The page will then leave the claim out rather than guess.

## Part 3. Photos, the sample project text and the claims the pages make (found while building Phases 1 and 2)

The 30 project photos, the six sample projects and some sentences on the pages raise questions only the owner can answer. Until they are answered, the guard keeps the site `noindex` (every project is marked `sample: true`, and every claim below is listed in `unconfirmedClaims`), and no new fact is written about them.

1. **Who owns the photos, and may Numa publish them?** The credit "Photo by Intelier" on the golf-links photos comes only from old file names. Please say who took each set, who owns it, and what the photographers allow (web, social, print).
2. **Other companies' logos and signage.** The three `sonate-*` photos carry "Condor Developers / Sonate Residences" logos and two `golf-links-*` photos show "Condor Golflinks" signage. They are not used for the home page photo or any share image. Is permission needed (or given) to show them?
3. **The sample texts do not match several pictures.** The golf-links summary describes a duplex penthouse (curved stair cladding, a smoked oak bar, dressing rooms) but its photos show a lobby, a gym and apartments; the sonate summary describes a family-office build-out (a reception desk, a boardroom) but its photos show an apartment. The text is invented and flagged as sample, so it was changed only in vocabulary and units. Please send the real facts for each project (name, place, year, scope, materials, size, duration, who may be named) or tell us which photos belong to which project.
4. **Which project photos are US-deliverable references?** None of the six sample projects is in the US; a real US-delivered project (with permission to name the client and designer) is the strongest single proof the site can carry.

5. **Claims the pages make that nothing in the repository backs.** Each sentence below is on a page now. Each one is an entry in `unconfirmedClaims` (`src/content/claims.ts`) and blocks launch until you answer. For each, say yes, give the wording that is true, or say the sentence should go. On a yes the entry is deleted; on a change or a no the sentence is changed or removed first.

   | Id | The pages say | What you confirm |
   | --- | --- | --- |
   | `claims.usShipping` | "Shipped to US job sites" (home first screen) | that Numa ships to job sites in the United States |
   | `claims.positioning` | "Built for US projects." (home first screen; the home title, the home description and the site description say it too) | that Numa builds for US projects and wants to be described that way (decision 1) |
   | `claims.fireRatedDoors` | "Fire-rated doors" (Capabilities) | that Numa makes fire-rated doors, with certificates (decision 3 and the Capabilities row of Part 2) |
   | `claims.support247` | "We provide 24/7 support to your local install team until installation is complete." (Process, last step) | that the support really runs around the clock, in US time zones too |
   | `claims.warrantyPeriod` | "a warranty period on every project" (Door to Site, After care) | that every project has a warranty period, and how long it lasts (no number is written until you give one) |
   | `claims.companyHistory` | "a family enterprise with decades of experience in contracting, development and hospitality" (About; the About search description says "family enterprise" too) | that Numa's parent is a family enterprise and has decades of that experience |
   | `claims.responseTime` | "We review your scope within two business days." (Contact; the Thank You panel and the Contact search description say it too) | that Numa reviews every request within two business days |
   | `claims.portalInvites` | "Project teams will be invited by email when their project starts." (Client Login) | how project teams get portal access |
   | `claims.portalOpening` | "The client portal opens soon." (Client Login; the Contact, Process and About pages say it too) | that the portal opens soon (decision 10) |
   | `claims.pdfAttachments` | "Attach drawings as PDFs, or paste a link to larger files." (Contact) | nothing from you: the live test with real PDFs (README, Going live, step 7) must pass first, otherwise the line changes to links only |
   | `claims.worldwideDelivery` | "delivered worldwide" (the About search description; "around the world" and "anywhere in the world" on the About and home pages; the tagline "built for the world") | that Numa delivers worldwide and not only to the United States, or the wording to use instead |

**Unlocks:** replacing the sample projects and figures; using more photos for share images and the home page; the claims leaving the launch guard's list; and the project pages going live.
