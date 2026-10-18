# Owner input pack

What the US SEO programme needs from the owner. It has two parts: ten decisions, and the facts each page needs. Nothing on a page is invented: a page whose facts are missing is not published, and the launch guard keeps the site `noindex` while placeholder or sample content remains. Every line says **Unlocks:** what your answer lets us do. The plan and its phases are described in [ADR 0003](../adr/0003-us-seo-strategy.md); the proposed URLs are the map in that ADR.

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

**Unlocks:** the Client Portal copy repair in Phase 2 (the portal is promoted but not built); `/login/` stays `noindex` either way.

## Part 2. Facts each page needs

| Page | What to provide | Unlocks |
| --- | --- | --- |
| Import hub (`/overseas-millwork-manufacturer/`) | lead times by scope, ports and Incoterms, freight and customs partners, documents supplied with each shipment, compliance paperwork, install support model, warranty, inspection photos, one real US-delivered project | the first target of the plan: overseas and import millwork for US projects |
| Standards (`/standards/`) | certificates and their numbers (or "not certified") | a standards page that states only what is verified; AWI alignment only if true |
| Factory (`/factory/`) | area, machines, headcount, finishing and QC steps, packing method, photos with permission | the factory and quality page, and the plain facts that AI Overviews quote |
| Sector pages (`/sectors/multifamily/`, `/hospitality/`, `/luxury-residential/`) | two real projects each, typical scope and quantities, repeatability and QC method | the three Wave A sector pages |
| About (`/about/`) | legal entity, founders and leaders with LinkedIn, year founded, parent group proof | the facts block, named leadership and a verifiable parent-group link (Phase 2) |
| Guides (`/resources/<slug>/`) | answers to the interviewer's questions: what do buyers get wrong, one real example with numbers, what surprised you, who should not buy | the four launch guides: cost, AWI Premium versus Custom grade, importing to the US, shop drawings and submittals |

Where a fact cannot be provided, say so. The page will then leave the claim out rather than guess.
