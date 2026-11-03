# Numa Living Website

The public website for Numa Living, a luxury custom millwork manufacturer, and the front door to a future Client Portal.

## Language

**Client Portal**:
The planned members-only area where a client's project team follows drawings, approvals and production for their project. It does not exist yet.
_Avoid_: Dashboard, customer area, extranet

**Client Login**:
The website's sign-in page and the links that lead to it, standing in for the Client Portal until it exists. Visitors can see it, but nobody can sign in.
_Avoid_: Portal page, sign-in screen

**Quote Request**:
A visitor's inquiry about a prospective project, submitted through the "Request a Quote" form on the Contact page and delivered to Numa by email. It carries the site location and, if the visitor has them, a project size and a bid date.
_Avoid_: Contact form message, lead

**Drawings**:
The PDF drawings or quantity takeoff a visitor supplies with a Quote Request, either attached or by link.
_Avoid_: Plans, uploads

**Contact email**:
The public address printed on the site and used by every "email us instead" link and error message: `projects@numaliving.us`. It is set in `site.contact.email` (`src/config/site.ts`), and `src/config/site.test.ts` pins it. Mail sent to it is received through Forward Email.
_Avoid_: Inquiries address, info address

**Form alias**:
The random-string id FormSubmit issues once the owner has confirmed the Contact email. The Quote Request form posts to it, and it is kept in the repository variable `FORMSUBMIT_ID`. It is public by design; the Contact email itself is never used in its place.
_Avoid_: Form key, form token, mailbox id

**Custom domain**:
`numaliving.us`, the address the site is served at. Three services each own one part of it: GitHub Pages serves the site and issues its HTTPS certificate, Cloudflare holds the DNS records, and Forward Email handles mail.
_Avoid_: Live URL, production domain

**Page registry**:
The list in `src/content/seo.ts` with one entry per page: its title (without the brand), description, share image and the day it last changed. The page metadata, the sitemap and the tests all read it, and a test fails when a page in `src/app` has no entry or an entry has no page.
_Avoid_: SEO file, meta file

**Photo copies**:
The AVIF and WebP files, at 480, 800, 1200 and 1600 px wide, that `npm run images:build` writes next to each source JPEG in `public/projects/`, together with the 1200 x 630 share images in `public/og/`. Pages load the copies; the original JPEG is only the fallback.
_Avoid_: thumbnails, resized images, optimized images

**Sample content**:
Invented figures, lists, projects and placeholder photos the site still shows (marked `sample: true` or `SAMPLE`, and the entries named in `sampleContent` in `src/content/pages.ts`). The launch guard lists each one; it kept the site out of search engines until the owner accepted the blockers on 3 November 2026 (ADR 0006).
_Avoid_: dummy content, placeholder text

**Company facts**:
The facts about the company that only the owner can supply (legal name, founding year, factory area, headcount, certifications with their documents, leadership, parent group link), kept in `src/content/company.ts`. The About page shows each one only once it is set; each one still missing blocks launch.
_Avoid_: About data, company info

**Launch blockers**:
The one list, `contentBlockers()` in `src/content/readiness.ts`, of what on the content side the launch guard reports as not ready: Sample content, Company facts not yet supplied, Legal drafts and Unconfirmed claims. It blocked indexing until the owner accepted the blockers on 3 November 2026 (`launchBlockersAccepted`, ADR 0006). The launch guard reads this list and nothing else from the content. A module with blockers of its own adds its function to the list.
_Avoid_: TODO list, checklist

**Legal draft**:
The privacy notice or the website terms while a lawyer has not reviewed it, or while a point only the owner can settle (how long requests are kept, the legal name, a postal address and so on) is open. The page says it is a draft while any entry for it is in `legalDrafts` (`src/content/legal.ts`); each entry is a Launch blocker until it is deleted.
_Avoid_: Policy, final policy

**Unconfirmed claim**:
A sentence on a page that states something about Numa the repository does not back (it ships to US job sites, offers 24/7 support, gives a warranty period). Each is an entry in `unconfirmedClaims` (`src/content/claims.ts`) and so a Launch blocker, deleted only on the owner's word. The owner pack, Part 3, lists them.
_Avoid_: Assumption, TODO claim

**US vocabulary guard**:
The check (`findUkTerms` in `src/lib/vocabulary.ts`) that no page or message uses a word only British, Australian or Gulf readers use (joinery, wardrobe, programme, colour, enquiry, tender, BOQ, labelled, catalogue, litre, fit-out and more), or a metric measure, as a symbol or spelled out, that does not follow a US unit. It runs over the copy modules and over every served page.
_Avoid_: spell check, style check
