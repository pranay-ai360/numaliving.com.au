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
A visitor's inquiry about a prospective project, submitted through the "Request a Quote" form on the Contact page and delivered to Numa by email.
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
The list in `src/content/seo.ts` with one entry per page: its title (without the brand), description, share image and the day it last changed. The page metadata, the sitemap and the tests all read it.
_Avoid_: SEO file, meta file

**Photo copies**:
The AVIF and WebP files, at 480, 800, 1200 and 1600 px wide, that `npm run images:build` writes next to each source JPEG in `public/projects/`, together with the 1200 x 630 share images in `public/og/`. Pages load the copies; the original JPEG is only the fallback.
_Avoid_: thumbnails, resized images, optimized images

**Sample content**:
Invented figures, lists and projects the site still shows while it is a preview (marked `sample: true` or `SAMPLE`, and the figures named in `sampleContent` in `src/content/pages.ts`). The launch guard keeps the site out of search engines until none is left.
_Avoid_: dummy content, placeholder text

