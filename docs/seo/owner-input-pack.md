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
| Privacy and Terms (`/privacy/`, `/terms/`) | how long Quote Requests are kept (`legal.privacy.retention`); the rights visitors have (`legal.privacy.rights`); which privacy laws apply, US states, the Australian Privacy Act, the UAE PDPL, the GDPR (`legal.privacy.jurisdictions`); a postal address (`legal.privacy.postalAddress`); the legal name of the company that receives the requests (`legal.privacy.controller`); the name of the service that holds the mailbox `projects@` forwards to, and links to the current FormSubmit, Forward Email and GitHub privacy notices (`legal.privacy.notices`); a lawyer's review of both drafts (`legal.privacy`, `legal.terms`) | the two drafts written in Phase 2 from what the site does today. Each id is its own entry in `legalDrafts` (`src/content/legal.ts`) and its own launch blocker, for example `legal.privacy.retention needs the owner to say how long Quote Requests are kept`; an entry is deleted once its point is settled and written into the page |
| Contact (`/contact/`) | a US phone number, office hours and their time zone, the factory address | `site.contact.phone`, `.whatsapp`, `.address` (street, city, region, postal code, country), `.hours` and `.timezone` (the Contact page shows each once it is real or set, and the structured data publishes the phone number and address with it), and the placeholder phone and address that keep the site `noindex` |
| Home first screen (`/`) | a yes or a rewrite for "Custom millwork, engineered in Dubai. Built for US projects." and "Made in our Dubai factory. Shipped to US job sites." (they state what the factory can do, not projects delivered); confirmation that Numa ships to US job sites | the first-screen wording. It is the plan's starting draft and rests on decision 1 |
| Capabilities (`/capabilities/`) | certificates for "Fire-rated doors", or a word that the line should go (fire ratings are listed in decision 3 and no certificate is known); photos for the craft gallery (five) and the factory floor (one), with permission to publish them | a capability list that states only what Numa can back, and the end of the wood-tone placeholders (`craft` and `factory.photo` in `sampleContent` keep the site `noindex` until real photos replace them) |

Where a fact cannot be provided, say so. The page will then leave the claim out rather than guess.

## Part 3. Photos, the sample project text and the claims the pages make (found while building Phases 1 and 2)

The 86 project photos, the nine projects and some sentences on the pages raise questions only the owner can answer. Until they are answered, the guard keeps the site `noindex` (every project is marked `sample: true`, and every claim below is listed in `unconfirmedClaims`), and no new fact is written about them.

1. **Who owns the photos, and may Numa publish them?** The credit "Photo by Intelier" on the golf-links photos comes only from old file names. Please say who took each set, who owns it, and what the photographers allow (web, social, print). The 13 marina-villa and penthouse25 files also carry a photographer's name as artist and copyright holder inside the file, and that party is not the one the site's credit names for the golf-links photos; say whether it is right to credit them. A photographer is credited only with permission.
2. **Other companies' logos and signage.** The three `sonate-*` photos carry "Condor Developers / Sonate Residences" logos and two `golf-links-*` photos show "Condor Golflinks" signage. They are not used for the home page photo or any share image. Is permission needed (or given) to show them?
3. **The sample texts do not match several pictures.** The golf-links summary describes a duplex penthouse (curved stair cladding, a smoked oak bar, dressing rooms) but its photos show a lobby, a gym and apartments; the sonate summary describes a family-office build-out (a reception desk, a boardroom) but its photos show an apartment. The text is invented and flagged as sample, so it was changed only in vocabulary and units. Please send the real facts for each project (name, place, year, scope, materials, size, duration, who may be named) or tell us which photos belong to which project.
4. **Which project photos are US-deliverable references?** Five of the nine projects (Amherst Ct, Estacada, Poppy 11, Poppy 16, Sandy Ct) are in the US, from the owner team's update: each is a claim below, and each needs your word that it is Numa's work and that its photos may be published. A real US-delivered project (with permission to name the client and designer) is the strongest single proof the site can carry.

5. **The original photos carry private details.** All 30 original JPEGs hold the Lightroom edit history and settings inside the file, and 13 hold the camera's and lens's serial numbers; anyone who downloads an original can read them. They are not stripped yet, because some photos may be replaced and the orientation must survive. Before launch every published original is cleaned (serial numbers, edit history and settings removed, orientation kept) and the launch guard lists any file that still has them as `photos.metadata`. From you: the final photos, and whose name (if anyone's) goes in the credit.
6. **Claims the pages make that nothing in the repository backs.** Each sentence below is on a page now. Each one is an entry in `unconfirmedClaims` (`src/content/claims.ts`) and blocks launch until you answer. For each, say yes, give the wording that is true, or say the sentence should go. On a yes the entry is deleted; on a change or a no the sentence is changed or removed first.

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
   | `claims.seaFreight` | "Sea freight through established logistics partners, with tracking shared with you." (Door to Site, Freight; the owner team's update says sea freight only) | that Numa ships by sea only, through logistics partners, and what tracking clients get |
   | `claims.factoryMachining` | "Panel saws, edgebanders and boring machines for repeatable precision." (Capabilities, the factory step Machining; the update removed the CNC claims) | that the Dubai factory runs these machines |
   | `claims.factoryVeneer` | "Veneer selection, laying and hot pressing onto panels." (Capabilities, the factory step Veneer) | that the factory lays veneer onto panels and presses it hot in house |
   | `claims.factoryFinishing` | "Spray booths for lacquer and paint finishes, matched to approved samples." (Capabilities, the factory step Finishing) | that the factory has spray booths and matches each finish to an approved sample |
   | `claims.projectAmherst` | "Amherst Ct" (Los Altos Hills, USA, 2023: the Projects page and its project page) | that Numa made the millwork for this project, that the place and year are right, and that Numa may publish its photos |
   | `claims.projectEstacada` | "Estacada" (Los Altos Hills, USA, 2024: the Projects page and its project page) | that Numa made the millwork for this project, that the place and year are right, and that Numa may publish its photos |
   | `claims.projectPoppy11` | "Poppy 11" (Pebble Beach, USA, 2025: the Projects page and its project page) | that Numa made the millwork for this project, that the place and year are right, and that Numa may publish its photos |
   | `claims.projectPoppy16` | "Poppy 16" (Pebble Beach, USA, 2025: the Projects page and its project page) | that Numa made the millwork for this project, that the place and year are right, and that Numa may publish its photos |
   | `claims.projectSandy` | "Sandy Ct" (Morgan Hill, USA, 2023: the Projects page and its project page) | that Numa made the millwork for this project, that the place and year are right, and that Numa may publish its photos |

**Unlocks:** replacing the sample projects and figures; using more photos for share images and the home page; the claims leaving the launch guard's list; and the project pages going live.
