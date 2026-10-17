# Numa Living Website

The public website for Numa Living, a luxury joinery and millwork manufacturer, and the front door to a future Client Portal.

## Language

**Client Portal**:
The planned members-only area where a client's project team follows drawings, approvals and production for their project. It does not exist yet.
_Avoid_: Dashboard, customer area, extranet

**Client Login**:
The website's sign-in page and the links that lead to it, standing in for the Client Portal until it exists. Visitors can see it, but nobody can sign in.
_Avoid_: Portal page, sign-in screen

**Quote Request**:
A visitor's enquiry about a prospective project, submitted through the "Request a Quote" form on the Contact page and delivered to Numa by email.
_Avoid_: Contact form message, lead

**Drawings**:
The PDF drawings or bill of quantities (BOQ) a visitor supplies with a Quote Request, either attached or by link.
_Avoid_: Plans, uploads

**Contact email**:
The public address printed on the site and used by every "email us instead" link and error message: `projects@numaliving.us`. It is set in `site.contact.email` (`src/config/site.ts`), and `src/config/site.test.ts` pins it. Mail sent to it is received through Forward Email.
_Avoid_: Enquiries address, info address

**Form alias**:
The random-string id FormSubmit issues once the owner has confirmed the Contact email. The Quote Request form posts to it, and it is kept in the repository variable `FORMSUBMIT_ID`. It is public by design; the Contact email itself is never used in its place.
_Avoid_: Form key, form token, mailbox id

**Custom domain**:
`numaliving.us`, the address the site is served at. Three services each own one part of it: GitHub Pages serves the site and issues its HTTPS certificate, Cloudflare holds the DNS records, and Forward Email handles mail.
_Avoid_: Live URL, production domain
