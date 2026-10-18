# Competitor and SERP analysis, October 2026

Curated findings of the US SEO study run on 18 October 2026. It holds figures and our own words only: no competitor page text. The state of numaliving.us itself, and its speed, are in [`baseline-2026-10-18.md`](baseline-2026-10-18.md). The decisions drawn from these findings are in [ADR 0003](../adr/0003-us-seo-strategy.md).

## How the research was done, and its limits

| Source | What | Limit |
| --- | --- | --- |
| SearXNG (Google CSE + DuckDuckGo) | 45 US-locale queries (top 28 results each) + 8 brand queries | Bing excluded (dictionary noise), Brave throttled. No People-also-ask, AI Overview or local pack. `site:` under-reports. Run from an Australian IP, so a few `.com.au` results leak in |
| Live Google through CloakBrowser | 11 queries (`hl=en&gl=us`): AI Overview, People also ask, related searches, local pack | Google said "Can't determine location". Low volume, 15 s apart, no block page. Not a US-IP view |
| HTTP fetch and parse | About 100 pages: numaliving.us (22 URLs), millwork-usa.com (34), vintage-millworks.com (8), the 30 top-ranking pages for 10 core queries (29 readable) | `prestigeartmillwork.com` returned 403 even in the browser: unread, nothing inferred about it |
| Cold mobile traces (Chrome DevTools) | Home and `/projects/golf-links/` at 390 px, Slow 4G, 4x CPU | Lab numbers, not field data |
| Not available | Search volumes and difficulty scores (no keyword tool), backlink data (no Ahrefs or Moz), Search Console data (the site is noindex) | Difficulty is a reading of each results page, not a tool score |

The queries are in [`tools/seo/queries/`](../../tools/seo/queries/us-study-2026-10.txt); the tools that ran the study are in [`tools/seo/`](../../tools/seo/README.md).

## 1. The two named competitors

These two are teardown examples, not the leaders of the results pages.

| | numaliving.us | millwork-usa.com | vintage-millworks.com |
| --- | --- | --- | --- |
| Stack | Next.js static, GitHub Pages | Next.js, Cloudflare | WordPress, Yoast, GTM |
| Scope | Dubai factory, "worldwide" | Morgan Hill CA; Bay Area and Greater LA | Fairview TN; mid-South |
| Indexable pages | none (preview) | 9,510 in the sitemap, 9,488 of them `/resources/*` | 13 pages + 6 projects (last project update 2018; `/test/` and `/sample-page/` in the sitemap) |
| Titles / descriptions | generic; 8 URLs share one | unique; resource titles up to 114 characters | 24 to 44 characters; no meta description |
| Canonical / OG / JSON-LD | none | every page; Organization + Place + PostalAddress; Service on 4 category pages; Article + Breadcrumb on guides | canonical and OG; Yoast WebSite only |
| Words (home / service) | 295 / 290 | 461 / 73 to 140 on core pages; 1,000 to 1,200 on guides | 219 / 422 |
| Trust | none verifiable | Q&A "company facts" page, brand disambiguation, licensed-installer disclosure | "Established 1987", named founder, address, named designer testimonial |
| Conversion | quote form, email, no phone | phone, WhatsApp, email, Instagram, "Invite to Bid", project review, SMS consent | phone, email, address, showroom by appointment |
| Real Google, non-brand | n/a | one programmatic page on page one for "multifamily millwork manufacturer" | none seen |

Millwork USA's 9,488 resource pages follow a template (service, city, angle, audience; for example `dressing-rooms-and-closets-in-santa-monica-budgeting-and-allowances`). They were published at roughly 130 to 350 a day from 23 August to 5 October 2026, and Google lists them for `site:` (SearXNG had suggested otherwise: Google's data wins). The sampled page's "Local project conditions in Del Mar" section is generic advice with the city swapped in. It is a spam-policy risk and is tied to California, so the plan does not copy it.

- **Copy instead:** what, where and for whom in the first screen, a facts-and-Q&A page, B2B calls to action, schema on every page.
- **Exceed with:** photography (Numa has 30 professional photos; Millwork USA has almost none), named projects and designers, standards, and clarity about importing.

The per-day view of a sitemap that exposed this pattern is built into `tools/seo/sitemap_report.py`.

## 2. What the US results look like

- **Fragmented.** Across 45 queries no manufacturer appears in more than 4 (a2zmillwork.com). Yelp and AWI's certification site appear in 7 each.
- **Head terms** ("custom millwork manufacturer", "architectural millwork manufacturer") are held by small regional fabricators, building-supply firms (Builders FirstSource, Carter Lumber), directories (ensun.io, Downtobid) and AWI. Google shows an AI Overview and a local pack. A new Dubai domain should expect 12 to 24 months here, so they are not launch targets.
- **City modifiers** return local fabricators plus Yelp, Houzz and Instagram. Numa has no US location: no location pages, no "near me".
- **AI Overview on 10 of 10 real topical queries**, local pack on 4 of 10. The overviews name companies whose pages state plain facts ("established 1983", "70,000 sq ft facility", "AWI QCP-certified"), so facts must be on the page as text.
- **Import and overseas niche.** Served by US sourcing firms (HKP International, House of Imports, IWI Millwork, d-ci.us, Bestmark, Eric Brand). 3 of 6 of those pages have no meta description and one has no H1. House of Imports' 326-word page uses FAQPage + LocalBusiness schema and answers: quality versus a domestic shop, which drawings are needed, lead time (12 to 20 weeks, their claim) and CARB compliance. This is the beachhead.
- **AWI** (awiqcp.org, awinet.org, woodworkinstitute.com) owns the standards and "what is" queries (Premium, Custom and Economy grades). It is a trust requirement for commercial buyers, not a page to outrank.
- **Compliance and cost of importing.** EPA, CARB and customs brokers answer TSCA Title VI and CARB. Real questions: "Are kitchen cabinets subject to tariffs?", "What is the HS code for cabinets?".
- **Product pages** (fluted panels, wall paneling) are retail and e-commerce brands. A made-to-order angle differentiates, but expect Moderate to Hard.
- **On-page norms.** Median 500 to 600 words on ranking service pages; four rank with 166 to 270 words. Most have canonical, OG and JSON-LD. Thin copy is below the median but not decisive: trust and specificity matter more.

## 3. Vocabulary: ranking US pages (33) versus Numa (7 pages)

| Term | US pages | Numa | Action |
| --- | --- | --- | --- |
| custom millwork | 22 | 0 | add everywhere it is true |
| paneling (US) / panelling (UK) | 15 / 1 | 0 / 4 | paneling |
| cabinetry | 14 | 0 | add |
| casing / trim | 14 | 0 | replace "architraves" |
| casework | 13 | 0 | add |
| architectural millwork / woodwork | 12 / 9 | 0 | add |
| import / overseas / international | 9 | 0 | add (import hub) |
| AWI / AWS standards | 5 | 0 | only if true |
| licensed / insured, warranty | 7, 4 | 0 | only if true |
| general contractors, interior designers | 5, 5 | 0 | add (audiences) |
| joinery | 1 | 7 | drop from public copy |
| wardrobe(s) / closet(s) | 3 / 6 | 4 / 0 | closets, dressing rooms |
| programme / schedule | 1 / 10 | 4 / 0 | schedule |
| m² / metres | 1 | 4 | feet, inches and sq ft (dual) |

"Mouldings" is accepted US trade spelling (9 US pages versus 4 for "moldings"): leave it. Numa's own strength worth keeping is the origin story ("we started Numa because the projects we built as developers needed joinery we could not buy"), once it has names and projects behind it.

The same table is data in `tools/seo/vocab_gap.py` (`TERM_TABLE`), which counts the pages containing each term, so Phase 2 can be checked against it. The counts above are the plan's figures; a re-count with the tool can differ slightly because the tool matches whole words in the saved page text.

## 4. Brand and entity

- "Numa Living" is crowded: numaliving.it (an Italian hotel), numaliving.com.ar and .co.uk, Numa Stays (Berlin), Numa Style (outdoor furniture), Dubai holiday-home brands. `numacreations.com` ("Numa Creations | Architectural Woodwork") ranks first for "numa living millwork". Google's "numa living" overview cites "Numa" and "Numa Style".
- "A Conqueror Group company" cannot be corroborated by search: only directory listings for a building-materials trading firm. Absence of evidence is not proof, but the site needs a verifiable link.
- numaliving.us is days old. The `.us` ccTLD already geotargets the US. No `sameAs` profiles exist.

## 5. Baseline scorecard

Scored with the page-audit rubric of the SEO skills. These are judgements, with the evidence above.

| Dimension | Numa home | Millwork USA home | Vintage custom-millwork-3 |
| --- | --- | --- | --- |
| Information gain | 2 | 5 | 3 |
| Semantic depth | 2 | 5 | 3 |
| E-E-A-T | 2 | 5 | 5 |
| Structure and readability | 6 | 7 | 5 |
| Technical on-page (ignoring intentional noindex) | 3 | 8 | 4 |
| Engagement and discoverability | 3 | 6 | 4 |
| Conversion | 5 | 8 | 4 |
| **Total /70** | **23** | **44** | **28** |

## What the research could not show

`prestigeartmillwork.com` returned 403 even in the browser, so its pages were not read and nothing is inferred about it. There are no keyword volumes, backlink counts or Search Console data. The results came from an Australian IP and the Google captures were not a US-IP view, so re-run the study from a US IP and use Search Console after launch.
