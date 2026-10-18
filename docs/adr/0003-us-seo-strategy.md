# Aim the site at US buyers of overseas millwork, and grow it without programmatic pages

numaliving.us is a clean, fast preview that is `noindex` by design and has almost no SEO surface: no canonical, Open Graph, JSON-LD or sitemap, one meta description reused on 8 URLs, 130 to 295 words a page, and copy in UK/AU vocabulary ("joinery", "wardrobes", "programme") that no ranking US page uses. The research of 18 October 2026 (summarised in [`docs/seo/`](../seo/README.md), repeatable with [`tools/seo/`](../../tools/seo/README.md)) found a fragmented US market, won on head terms by local fabricators, with an AI Overview on every real query captured. The winnable ground is overseas and import millwork for US projects (the ranking pages are thin and weakly optimised), sector and product pages, and the questions buyers actually ask (cost, AWI grades, shop drawings, importing). The owner approved the plan as written, Phases 0 to 6, which includes the decisions below and the URL map at the end. The site stays `noindex` until the launch gates pass.

## Decision

- **Positioning (to confirm with the owner):** custom architectural millwork and FF&E, engineered and made in Dubai, delivered to US projects, for architects, designers, general contractors and developers. The goal of a visit is a quote request with drawings.
- **Targets, in order.** Timelines are the heuristics of the SEO skills (Easy 3 to 6, Moderate 6 to 12, Hard 12 to 24 months), not promises, and the difficulty is a reading of each results page, not a tool score.

  | Target | URL | Read | Why |
  | --- | --- | --- | --- |
  | Overseas, international or import millwork for US projects | `/overseas-millwork-manufacturer/` | Easy to Moderate | weak ranking pages, the AI Overview cites import firms |
  | Buyer questions: cost, AWI grades, shop drawings, lead times, importing | `/resources/*` | Moderate (AWI itself owns "what is") | real People-also-ask questions |
  | Multifamily, hospitality and FF&E, luxury residential | `/sectors/*` | Moderate | fragmented results, no specialist |
  | Wall paneling, kitchens, closets, vanities | `/architectural-millwork/*` | Moderate to Hard | retail brands and big closet companies |
  | Head terms | `/architectural-millwork/`, `/` | Hard | local packs and AI Overviews; supported by the cluster, not a launch KPI |

- **Trust first.** Named people, real projects, dated facts, certifications only with documents, and duty and compliance content reviewed by a customs broker and dated. No invented numbers: a page without first-party facts is not written.
- **Answer-engine readiness.** Facts as plain text and as JSON-LD, question headings with 40 to 60 word answers, a consistent name and `sameAs`. FAQ markup no longer earns rich results for most commercial sites, so FAQs are written for readers and answer engines; the markup is optional.
- **One gate.** The launch guard (`src/config/launchGuard.test.ts`) stays the single switch for `isIndexable`; Phase 1 extends it with blockers for missing `site.url` values, sample figures, duplicate descriptions and missing alt text.
- **The URL map below is PROPOSED** and becomes final when the owner signs it off (open decision 7), before Phase 3 starts.
- **Launch gates** (Phase 5): the launch guard is green (real contact details, no sample content, no sample figures); form delivery is proven by a real test submission; Search Console is verified; the sitemap is valid; the Rich Results Test passes; mobile LCP is at most 2.5 s on the home page and on a project page and CLS is under 0.1; a live crawl is clean; the privacy page is live; and the trademark question is answered. Then one pull request, `feat: open the site to search engines`, flips `isIndexable`; it is merged and deployed only with the owner's approval. Rollback is setting `isIndexable` back to `false`, though noindex takes days to weeks to drop pages.

## Considered options

- **Programmatic city or service pages.** Rejected. The competitor Millwork USA has 9,488 templated resource pages (service, city, angle, audience), published at roughly 130 to 350 a day from 23 August to 5 October 2026. The sampled page's local section is generic advice with the city swapped in. That is a spam-policy risk and tied to California, and Numa has no US location. The same goes for "near me" and city-modifier pages.
- **A Google Business Profile with a US address or a virtual office.** Rejected: Numa has no US location, so such a profile would claim one it does not have. City-modifier searches return local fabricators plus Yelp, Houzz and Instagram, so the plan builds no location pages and no "near me" pages either.
- **Copying competitors' claims.** Rejected, together with claims no one can verify, bought links and pages written without first-party facts. What to copy instead from the teardown: what, where and for whom in the first screen, a facts-and-Q&A page, B2B calls to action and schema on every page. What to exceed: photography (Numa has 30 professional photos), named projects and designers, standards, and clarity about importing.
- **Turning the Cloudflare proxy on** to get the redirects, headers and image optimisation that static hosting lacks. Rejected for now, for the reasons in [ADR 0002](0002-custom-domain-numaliving-us.md). Indexing control stays in the meta tags, images are pre-generated, and the URL map is settled up front.
- **Chasing the head terms first** ("custom millwork manufacturer", "architectural millwork manufacturer"). Rejected as launch targets: they are held by small regional fabricators, building-supply firms, directories and AWI, with an AI Overview and a local pack, and a new Dubai domain should expect 12 to 24 months there.

## Consequences

- **The URL map is a one-way door.** GitHub Pages and a static export cannot redirect, so the URLs are final before Phase 3. `/capabilities/` is replaced by `/architectural-millwork/` (nothing is indexed yet).
- **Owner facts gate the work.** Phase 2 cannot start until the verifiable facts exist (open decision 3), and the guard blocks launch while placeholder or sample content remains. [`docs/seo/owner-input-pack.md`](../seo/owner-input-pack.md) lists every decision and fact, and what each unlocks.
- **Entity and trade links come before launch.** The domain is days old, "Numa Living" is crowded with other brands (`numacreations.com` ranks first for "numa living millwork"), and "A Conqueror Group company" cannot be corroborated by search, so the site needs a verifiable link. The `.us` domain already geotargets the US. Phase 4 builds profiles, trade listings and earned links; it skips a US Business Profile, Wikidata without notability, press-wire spam and Yelp or YellowPages.
- **Content is built in waves.** Wave A (about 16 launch-critical pages) before launch, Wave B (2 to 3 pages a month) in the first 90 days. Each page starts from first-party facts and an interview, with at least 30% first-party detail.
- **Risks to watch:** brand collision, US buyers' distrust of a Dubai factory (lead time, duties, compliance, installation, warranty), head terms staying out of reach for 12 to 24 months, a new-domain ramp-up of 3 to 6 months, and duty or compliance statements that are wrong or out of date (broker review, source links, dates, no rates unless verified). The quote form must deliver, or the traffic is wasted.
- **The data is directional.** The search results came from an Australian IP with no search volumes, backlink data or Search Console data. Re-run from a US IP and use Search Console after launch. Google captures are low volume, stop at a block page and never bypass one.
- **The study can be repeated.** `tools/seo/` holds the scripts and `docs/seo/` the curated findings, keyword map, owner input pack and baseline.
- **Open owner decisions** (details in the owner input pack): 1 positioning and first buyer; 2 US presence; 3 verifiable facts (blocks Phase 2); 4 brand and the Conqueror Group link; 5 analytics and Search Console; 6 who writes and approves, plus 2 to 3 interviews; 7 URL map sign-off; 8 who reviews duty and compliance statements; 9 budget for memberships and listings; 10 the client portal message.

## Proposed URL map (Appendix A of the plan)

`[A]` is a Wave A page (launch-critical), `[B]` is Wave B (first 90 days).

```text
/                                         Home
/architectural-millwork/                  hub (replaces /capabilities/)
/architectural-millwork/wall-paneling/    [B]   /architectural-millwork/kitchens-closets-vanities/  [B]
/overseas-millwork-manufacturer/          US import hub  [A]
/sectors/multifamily/  /sectors/hospitality/  /sectors/luxury-residential/  [A]   /sectors/workplace/  [B]
/standards/   /factory/   /process/   /about/   /faq/   /contact/   /privacy/   /terms/
/projects/   /projects/<slug>/
/resources/   /resources/<slug>/
/login/                                   noindex, not in the sitemap
```
