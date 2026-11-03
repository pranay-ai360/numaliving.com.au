# Entity and link-building runbook

This runbook is for building the Numa Living entity and earning links for numaliving.us. It is adapted to a Dubai factory that sells business to business into the United States. It says what we do and what we skip, which trade listings and platforms US professionals use, which earned-link plays are honest for Numa, a month-by-month rhythm, the guard rails, and how to log every link.

Status: draft for owner review, 18 Oct 2026

Companion files: [brand-and-profiles.md](brand-and-profiles.md) (naming, same-name businesses, trademark checklist, profile copy, structured data) and [link-log.csv](link-log.csv) (the log).

Nothing here is done by Claude on its own. Accounts, forms and emails are done by people at Numa. Claude or a future session can draft copy, pitches and the benchmark page, and can check the log.

## Next actions for the owner

1. Choose a descriptor ([brand-and-profiles.md](brand-and-profiles.md), section 2).
2. Brief a US trademark attorney to run the search ([brand-and-profiles.md](brand-and-profiles.md), section 4).
3. Supply the facts in section 9 below: real phone and address, legal name, year founded, proof of the parent-group wording, real projects with permission to name people, photo licences, shipment records.
4. Decide the budget question for AWI, Material Bank and Sweets (section 3), and who at Numa sends the outreach.
5. Open ARCAT, the Woodwork Institute, Woodworking Network and Instagram's business setup page in a browser (our tools could not read them) and note what they say, so the rows marked unverified can be updated.
6. Publish nothing until the gates in section 2 pass.

## How to read this document

| Label | Meaning |
| --- | --- |
| checked 18 Oct 2026, URL | We read that page on that date with a fetch tool that returns a summary of the page. Short quotes come from that summary. Re-read the page before you rely on a price or a rule. |
| unverified | We could not read the source (for example the site returned HTTP 403). It is not a recommendation until someone reads it in a browser. |
| skill heuristic, not a measured rule | A number from the playbooks of the linkbuilding skill we used. Those playbooks are unverified marketing claims. Use them as guard rails, not as promises. |
| Owner supplies: | A fact only the owner has. We do not invent it. |
| research SERPs | The 45 US queries run on 17 and 18 Oct 2026 through a local SearXNG (Google custom search and DuckDuckGo) from an Australian IP, with no search volumes. Directional only. The research files are kept outside version control, so the evidence we use is quoted here. |
| Phase n | A step of the US SEO programme: 0 foundations and tools, 1 technical SEO base, 2 US wording and trust copy, 3 new pages, 4 this document (authority, entity and links), 5 launch gate, 6 the 90-day loop. |

## 1. Goals and rules

### 1.1 Goals

1. **Entity.** Search engines and buyers can tell who Numa Living is, that it makes millwork in Dubai, and that the website, the profiles and the listings are one company.
2. **Links.** A small number of relevant, earned links from places US architects, designers, general contractors and developers actually look.
3. **Evidence.** A log of every link we asked for and every link we found, so we can see what worked and stop if something looks wrong.

We promise no rankings. The domain is days old, the site is `noindex` while it is a preview, and the research found no independent coverage of Numa Living the millwork maker.

### 1.2 Where we start

- The domain is days old. `isIndexable` in [src/config/site.ts](../../src/config/site.ts) was `false` until 3 November 2026, when the owner had every page indexed ([ADR 0006](../adr/0006-index-every-page-before-the-launch-blockers-are-cleared.md)).
- `site.contact.phone` and `site.contact.address` are placeholders, the "Preview" ribbon is on, and every project is marked `sample: true`. The launch guard in [src/config/launchGuard.test.ts](../../src/config/launchGuard.test.ts) lists them as blockers; the owner accepted them on 3 November 2026.
- The brand searches ("numa living", "numa living millwork", "numa living dubai") return other businesses with the same name. See [brand-and-profiles.md](brand-and-profiles.md), section 3.
- The parent-group line "A Conqueror Group company" could not be corroborated by search. The brand search for it returned directory listings for a Dubai building-materials trading company and a business-setup consultancy, and nothing that names Numa Living. We do not know whether either is related.

### 1.3 The rules we follow

1. **Real facts only.** Every claim in a profile, listing or pitch is one the live site already makes and the owner can document. No invented numbers, certifications, projects, clients or US presence.
2. **One name.** "Numa Living", written the same way everywhere ([brand-and-profiles.md](brand-and-profiles.md), section 1).
3. **Earn, do not buy.** No payment for links, no discount, free sample or other benefit in exchange for a link (Google's spam policy lists both). If value changes hands for a mention, the link should be marked `rel="sponsored"` or `nofollow`, or treated as advertising.
4. **Useful first.** Every request comes with something the other side can use: an accurate credit line, photographs, data, an article.
5. **Few and relevant.** A short list of named places beats a long list of anything.
6. **Slow and steady.** Stay inside the pace ceilings in section 5. No spikes.
7. **A person sends it.** No bulk email, no automated link creation, no link-building services.
8. **Gate, then publish.** Nothing goes public until the gates in section 2 pass.
9. **Log it.** Every link, requested or live, goes in [link-log.csv](link-log.csv).

Stop and ask the owner if a platform wants payment for a link, if anyone offers to sell links or "packages", or if a form asks for a US address Numa does not have.

### 1.4 What we skip, and why

| Item | Decision | Why | Checked |
| --- | --- | --- | --- |
| Google Business Profile with a US address, a virtual office or a mailbox | Skip | Google's guidelines cover a business with a physical location customers can visit, or one that travels to customers. A rented mailing address where the business does not operate is not eligible, P.O. boxes are not acceptable, and a service-area business cannot list a virtual office unless it is staffed during business hours. The site names no US office or staffed location (California appears only as a sample delivery destination). | checked 18 Oct 2026, https://support.google.com/business/answer/3038177 |
| A Business Profile for the Dubai factory | Owner's choice; default skip for this programme | The same guidelines say the location should be "staffed by your team and able to receive customers during its stated hours". The site says factory tours are welcome, but hours and staffing are the owner's facts. It is a listing for people who can visit; we do not expect it to help with US buyers (our judgement, not verified). | checked 18 Oct 2026, https://support.google.com/business/answer/3038177 |
| Wikidata item | Skip until independent sources exist | An item must meet one of three tests: a valid sitelink to a Wikipedia page (or another listed Wikimedia site); a clearly identifiable entity "that can be described using serious and publicly available references"; or a structural need. The research SERPs show no independent coverage of Numa Living the millwork maker. Re-check after the first trade coverage. Never cite our own website or profiles as the references. | checked 18 Oct 2026, https://www.wikidata.org/wiki/Wikidata:Notability |
| Paid links; swaps of goods or services for links; paid advertorials whose links pass ranking credit | Skip | Google's link-spam examples include "buying or selling links for ranking purposes", exchanging money, goods or services for links, "sending someone a product in exchange for them writing about it and including a link", and advertorials where payment is received for articles with links that pass ranking credit. Qualified links (`rel="sponsored"` or `nofollow`) are allowed. | checked 18 Oct 2026, https://developers.google.com/search/docs/essentials/spam-policies |
| Link networks (PBNs), automated link creation, content made to carry links | Skip | The same policy lists "using automated programs or services to create links to your site", "excessive link exchanges", partner pages "exclusively for the sake of cross-linking", and "creating low-value content primarily for the purposes of manipulating linking and ranking signals". The page does not use the word PBN. | checked 18 Oct 2026, https://developers.google.com/search/docs/essentials/spam-policies |
| Mass directory submission and bookmark sites | Skip | The same policy lists "low-quality directory or bookmark site links". We use a short list of named trade listings instead (section 3). | checked 18 Oct 2026, https://developers.google.com/search/docs/essentials/spam-policies |
| Press-wire releases written for links | Skip (programme decision) | Nothing in our research shows buyers reading them, and paid articles with links fall under the advertorial line above. We checked no wire service. | none |
| Yelp, Yellow Pages and other consumer local directories | Skip (programme decision) | Numa has no US location. In the research SERPs Yelp pages are city lists of local shops, for example "TOP 10 BEST Millwork in Los Angeles, CA" (rank 4 for "custom millwork Los Angeles"). We did not check Yelp's own rules. | none |
| Startup and software directories in the skill's list (Crunchbase, AngelList, Product Hunt, G2, Capterra, GitHub, Medium, About.me) | Skip | The skill itself describes them as for startups, software or tech. Not checked at the source; not needed for a millwork maker. | none |
| Buying an aged domain or redirecting other sites to this one | Skip | The domain stays numaliving.us ([ADR 0002](../adr/0002-custom-domain-numaliving-us.md)). | none |

## 2. Gates: when anything may be published

Names and handles may be checked early. Create a profile only when you can complete it, because a half-empty profile is a weak signal and looks careless (skill heuristic, not a measured rule).

We read "build the entity before launch" as "prepare before launch, publish when the launch conditions are met". A profile that links to a site that says "sample content" tells visitors the company is not ready.

| Gate | What must be true | Today (18 Oct 2026) |
| --- | --- | --- |
| G1 Name | A descriptor is chosen. A trademark search is done and counsel's view is recorded. | Not done |
| G2 Facts | Real phone, factory address, legal name, year founded and opening hours, in `site.contact` and in the profile copy. No placeholders. | Phone and address are placeholders |
| G3 Site | The US-wording and trust copy is live and sample content is gone, which is what the launch guard checks. | Not met: Preview ribbon, sample projects |
| G4 Assets | Logo files, photographs with a licence you can show, and a real video if YouTube is used. | Owner supplies |
| G5 Claims | Every sentence in the profile copy appears on the live site and can be documented. | Check at publish time |

G1 is also a condition for opening the site to search engines (the programme's launch phase).

## 3. Trade listings and platforms

These are the platforms named in the programme plus those the research SERPs showed. Each row says what we could confirm at the source. Anything we could not read is marked unverified and is not a recommendation yet.

**Link type.** Platforms rarely say whether their outbound links carry `nofollow`, and the Search Console links report does not show it either (section 7). The link log records `unknown` until someone reads the live page source (section 8). Do not count on a ranking effect from a profile link. Their job is to make Numa Living a consistent, findable entity and to be where buyers look.

### 3.1 What each platform is

| Platform | What it is (as stated at the source) | Why it matters for this audience | Cost (as stated) | Link type | Checked |
| --- | --- | --- | --- | --- | --- |
| LinkedIn Page | A Page for a company, created from a personal LinkedIn account. The creator ticks a box to confirm the right to act for the company. Creation is not supported in the Android app. | Company Pages of Numa Creations, USA Millwork, Foundation Millwork and Stone and the Woodwork Institute appear in the research SERPs (LinkedIn in 10 of 45 queries). The Numa Creations Page ranks 2nd for "numa living millwork". | Free ("You can create a LinkedIn Page for free") | Not stated | checked 18 Oct 2026, https://www.linkedin.com/help/linkedin/answer/a543852 |
| YouTube channel | A channel profile with a Links section: up to 14 links, the first shown next to the subscribe button. Name and handle can each be changed twice in 14 days; changing the name removes a verification badge. | YouTube appears in 6 of 45 queries, including "millwork lead times" (rank 6) and "custom millwork for luxury homes" (rank 7, a Short). A real factory-tour or lead-time video can sit in that space. | Not stated on the help page | Not stated | checked 18 Oct 2026, https://support.google.com/youtube/answer/2657964 |
| Instagram | Unverified. Three official pages returned no usable text. | Instagram profiles appear in 14 of 45 queries, mostly small US millwork shops in city searches (best rank 2, "millwork usa california"). | Unverified | Unverified | attempted 18 Oct 2026: https://help.instagram.com/502981923235522 (heading only), https://www.facebook.com/business/help/502981923235522 (title only), https://business.instagram.com/ (navigation only) |
| Pinterest | A business account. New ones can be created only from a desktop computer, the profile must be public, and a website URL can be entered when converting in the app. | Pinterest did not appear in any of the 45 research SERPs. Optional. | Free ("Set up a free Pinterest business account") | Not stated | checked 18 Oct 2026, https://help.pinterest.com/en/business/article/get-a-business-account |
| Houzz (Houzz Pro account) | A free account adds the business to the Houzz Find Professionals directory. Sign-up asks for the country where you do business. Whether a US address is required, and whether the website link shows on the public profile, is not stated. | Houzz professional pages appear in 5 of 45 queries, mainly city searches for local shops (best rank 3, "vintage millworks nashville"). Our reading of those pages: more residential than commercial. | Free account; paid plan prices are not on the page | Not stated | checked 18 Oct 2026, https://pro.houzz.com/pro-learn/blog/how-to-create-a-free-houzz-business-account |
| Thomasnet | A directory of industrial suppliers used by engineers and procurement managers. The free subscription covers a supplier profile, team members, analytics and classification in "limited core categories". Paid programs add RFQ delivery and higher placement. A profile can carry website, phone and capabilities. | Thomasnet millwork supplier pages appear in 4 of 45 queries (best rank 16). The buyers it names are engineers and procurement managers, so it sits closer to procurement than to design (our reading). | Free tier; paid prices not stated | A website field exists; whether it is clickable or `nofollow` is not stated | checked 18 Oct 2026, https://business.thomasnet.com/programs |
| Traditional Building Buying Guides | A directory of companies, services and products for the commercial design, building and construction market, run by Traditional Building magazine (publisher Active Interest Media). It has a Woodwork category and a form for "a Free Listing". What a listing contains, any vetting and any country limits are not stated. | The magazine lists its audience as architects, contractors, facility managers, developers, artisans and interior designers. Its "Architectural Millwork Companies" guide ranks 3rd for "architectural millwork manufacturer". The magazine's focus is traditional design, so fit is the owner's call. | Free listing | Not stated | checked 18 Oct 2026, https://www.traditionalbuilding.com/buying-guides and https://www.traditionalbuilding.com/about-traditional-building-magazine |
| Material Bank | A platform where architects and designers search and order material samples from many brands in one order. All orders ship via FedEx; out-of-stock items are fulfilled by the brand directly, in 2 to 5 or more days. Brands become Brand Partners by contacting Material Bank's sales team. "Brand partners do not pay for ranking or placement." | Reaches architects and designers at the sampling stage, which suits veneers, finishes and panel samples. It claims 100,000+ vetted design professionals in the US and Canada (its own figure). It did not appear in the research SERPs, so it is a sales channel, not a link source. | Not stated for brands | Not applicable | checked 18 Oct 2026, https://www.materialbank.com/faqs |
| ARCAT | Unverified. Both fetches returned HTTP 403. The research SERP snippet for its architectural woodwork page (rank 9 for "architectural woodwork manufacturer") reads: "Browse companies that make architectural woodwork and view and download their free cad drawing, revit BIM files, ...". | The snippet suggests architects and specifiers use it for product drawings and BIM files. Unverified. | Unverified | Unverified | attempted 18 Oct 2026: https://business.arcat.com/ (403), https://www.arcat.com/about (403) |
| Sweets (Dodge Construction Network) | "The Building Product Source For The Entire Design and Construction Team": product information, CAD details, BIM objects, specs, catalogs and galleries. The "List Your Products" link goes to an advertising page on construction.com. | Audience named on the page: architects, contractors, subcontractors, designers, engineers, facility managers and building owners. It did not appear in the research SERPs. | Not stated; the route is an advertising page, so expect a paid product | Not stated | checked 18 Oct 2026, https://sweets.construction.com/ |
| Architonic | "The ultimate research and collaboration tool for architects and designers" (its words). It sells marketing services to brands: membership, social media, newsletters, editorial content and event marketing. How brands join, product types and country limits are not stated. | A design-product catalog. It did not appear in any of the 45 research SERPs. Relevance rises only if loose furniture (FF&E) becomes a lead line. | Not stated | Not stated | checked 18 Oct 2026, https://business.architonic.com/ |
| AWI (Architectural Woodwork Institute): membership and Quality Certification Program (QCP) | The body behind the Architectural Woodwork Standards. Membership is priced by category (table below). QCP is a company licence: only woodworking companies are eligible, a manufacturing licence requires that the company "must own or lease a manufacturing facility", and architects register projects. International participation is not stated. | AWI sites rank first for the standards queries in the research SERPs (awiqcp.org in 7 of 45 queries, best rank 1; awinet.org in 3, best rank 2). The research treats AWI as a trust requirement for commercial buyers. | See the AWI cost table below | The QCP page describes no public directory of licensed companies; it links to a general AWI Member Directory. Link type not stated. | checked 18 Oct 2026, https://awinet.org/pricing/ and https://awinet.org/compliance/quality-certification/ |
| Woodwork Institute (WI) | Unverified. The home page fetch returned only its title ("Assurance Through Certification") and the accreditation page returned only its title. | Its Certified Compliance Program and Monitored Compliance Program pages rank 1st and 3rd for "WI certified compliance program millwork" (3 of 45 queries). A search snippet for its accreditation page reads "No less than three years direct full-time experience, or its equivalent, in commercial millwork manufacturing/installation within the previous five years". Region, eligibility for a maker outside the US and cost are unverified. | Unverified | Unverified | attempted 18 Oct 2026: https://woodworkinstitute.com/ and https://woodworkinstitute.com/affiliation/accredited-millwork-company/active-membership |
| AWMAC | The Architectural Woodwork Manufacturers Association of Canada, with chapters across the Canadian provinces. Manufacturer membership is for a person, partnership or corporation that "operates a facility that manufacturers architectural woodwork"; Supplier membership is for those who provide materials or services to manufacturers. Dues, non-Canadian eligibility and directory contents are not stated. | A Canadian body; it appears in 1 of 45 queries (best rank 14). Not a US priority. | Not stated | Not stated | checked 18 Oct 2026, https://awmac.com/membership/membership-categories/ |
| Procore Construction Network | A free public directory of construction businesses (general contractors, owners, specialty contractors, architects, engineers, suppliers). Claiming a profile gives a free Procore company account; bid invitations go to paying Procore accounts. Businesses can list in the United States and in Canada (not Quebec). Other countries are not mentioned. | Reaches general contractors who use Procore. Its pages appear in 2 of 45 queries (city searches). Numa is not a US-located business, so eligibility is doubtful. | Free profile | The page does not say whether a profile shows a website link | checked 18 Oct 2026, https://support.procore.com/products/procore-construction-network |
| BuildingConnected (Autodesk) | Bid-management software. BuildingConnected Pro is for general contractors and owners, Bid Board Pro for subcontractors, TradeTapp for subcontractor qualification. Whether Bid Board is free, and whether suppliers or manufacturers can have profiles, is not stated. | It connects US general contractors and subcontractors around bids. A Dubai manufacturer is not a US subcontractor. | Not stated | Not applicable | checked 18 Oct 2026, https://construction.autodesk.com/products/buildingconnected/ (the help article at support.buildingconnected.com returned 403) |

**AWI costs as stated on its pages.** Confirm with AWI before you budget: the QCP page shows two different figures for annual participation by non-members.

| Item | Amount (USD) | Note |
| --- | --- | --- |
| Woodwork Manufacturer membership | $2,200 a year | $1,100 if gross annual sales are under $500K, with the AWI Small Business Program form |
| Supplier membership | $1,200 a year | |
| Installer and Broker membership (Industry) | $2,200 a year | |
| Associate membership (general contractor, architect, educator, student) | $50 a year | |
| QCP licence application | $2,000 (AWI manufacturing and industry members) or $3,500 (others) | |
| QCP annual participation | $1,250 for those members | For others the page shows $2,650 in one table and $3,500 in another |
| QCP project fee | One half of one percent of the total woodwork contract | Minimum $500, maximum $10,000 |

For a member, the fixed items add up to about $5,450 in a first year ($2,200 + $2,000 + $1,250) before any project fee. That is arithmetic on the page's numbers, not a quote.

### 3.2 What to do about each

Priority labels: **P1** do in the first month after launch; **P2** months 1 to 3; **P3** months 3 to 6 or on demand; **Verify first** a person reads the source in a browser, then updates the row; **Hold** not now, with the trigger to revisit.

| Platform | Priority | Owner supplies | Notes |
| --- | --- | --- | --- |
| LinkedIn Page | P1 | Two people at Numa who can administer it; logo files; the short, medium and long copy ([brand-and-profiles.md](brand-and-profiles.md), section 5); company size and industry choices. | Link the Page from the site footer, and add its URL to `site.social` once Phase 1 has added that field ([brand-and-profiles.md](brand-and-profiles.md), section 8). |
| YouTube channel | P1 if a real video exists, otherwise wait | A factory-tour or process video that shows real work (not stock footage), with permission from anyone filmed; the channel handle. | Do not publish an empty channel. First link in the Links section is the website. |
| Instagram | P2, after someone reads the current business-profile setup page | A handle (see the taken handles in [brand-and-profiles.md](brand-and-profiles.md), section 3); 6 to 9 real photographs with a licence; the short copy as the bio. | Our tools could not read the setup page, so cost and features are unverified. |
| Pinterest | P3, optional | Logo; a few licensed photographs. | No Pinterest results in the research SERPs. |
| Houzz | P3 | Real address and phone; licensed project photographs. | Ask Houzz whether a business based outside the US can list. In the research SERPs its pages lean residential (our reading). |
| Thomasnet | P2 | Description (medium copy), categories, capabilities, website, phone. | Free tier only. Paid programs are advertising. Ask whether a UAE-based supplier can list; the page states no location rule. |
| Traditional Building Buying Guides | P2 | Company details for the free-listing form; the Woodwork category. | The owner judges whether the magazine's traditional focus fits Numa's work. |
| Material Bank | P2, ask for terms first | Which finishes and veneers can be sampled; who ships samples to the US and how long that takes; a budget. | Ask: fees for brands, and how a non-US brand supplies stock. Primarily a sales channel. |
| ARCAT | Verify first | A person reads business.arcat.com in a browser and asks about cost and whether a non-US maker can list. Product data and drawings if available. | Possibly the most relevant listing for architects and specifiers, but nothing about it is verified. |
| Sweets | P3 | A capability statement and drawings. | Ask for a quote after those exist. |
| Architonic | Hold | | Revisit if loose furniture (FF&E) becomes a lead line. |
| AWI membership and QCP | P3, a decision in month 3 | A budget; factory documents; sales figures for the dues tier. | Before paying, ask AWI in writing whether a factory outside North America can hold a licence and be inspected, and what inspection costs. Do not use AWI or QCP wording on the site, profiles or pitches until a licence is granted. The site lists certifications as "to be confirmed". |
| Woodwork Institute | Verify first | A person reads the program pages in a browser: region, who can apply, cost. | The search snippet hints at a requirement of commercial millwork experience; unverified. |
| AWMAC | Hold | | Canada. Revisit only if Canada becomes a target market. |
| Procore Construction Network | Hold | | Revisit if Numa has a US partner or office, and ask Procore whether a foreign company can list. |
| BuildingConnected | Hold | | Revisit if a US installer or partner bids as a subcontractor on Numa's behalf. |

### 3.3 Directories seen in the SERPs and held out

ensun.io ("Top 100 Millwork Manufacturers in 2026", 5 of 45 queries, best rank 4) and Downtobid (contractor lists by city, 1 query, rank 7) appeared in the research SERPs. We did not check either at the source, so neither is a recommendation. If the owner wants one, read its listing page first and apply the rules in section 1.

## 4. Earned-link plays

An earned link comes from someone with a real reason to mention Numa Living. We ask for the mention. We never pay for it. All four plays need something a document cannot create: real projects, real suppliers, real shipment records. Where the fact is missing, the play waits.

### 4.1 Project credits from architects, designers and general contractors

**What.** An architect, interior designer or general contractor credits Numa Living as the millwork maker on a project page, case study, award entry or press item, with a link to the matching project page on numaliving.us.

**The honest angle.** "You get an accurate credit line, a named maker for your own submissions, and photographs and a description you may use. We get named."

**What we bring.** Licensed photographs the partner may use; a three-sentence factual description (scope, materials, location); the exact name "Numa Living"; the project page URL.

**Rules.**

- The credit is for work really done. Ask at close-out, when everyone is pleased.
- Offer nothing in return for the link: no discount, no free sample. Google lists swapping goods or services for links as link spam. If anything of value changes hands, ask for `rel="sponsored"` or `nofollow`.
- Do not ask for keyword anchors. Ask for "Numa Living".

**Today's gap.** The site's six projects are all marked sample (UAE, UK and India) and none is in the US. **Owner supplies:** real completed projects with permission to name the client, architect, designer and general contractor; photo licences and photographer credits; the person at each firm who agreed.

**Start with the easy ones.** Search the web for the real projects and for "Numa Living". Where Numa is already credited without a link, ask for the link.

> Skeleton: "Thank you for working with us on [project]. We have a short description and licensed photographs you are welcome to use on your project page. If you credit the millwork, the name is Numa Living and the page is [URL]."

### 4.2 Supplier and partner pages

**What.** Companies Numa really buys from or works with (veneer, hardware, finishes and lacquer, stone and metal, freight forwarders or customs brokers, US installers) publish "projects", "fabricators", "where to buy", "partners" or case-study pages.

**The honest angle.** A real relationship: "We use your [product] on [project]. Photographs attached. Do you feature customer projects?"

**Rules.** Only real suppliers and partners. No reciprocal link deals: Google lists "excessive link exchanges" and partner pages "exclusively for the sake of cross-linking". One-sided editorial mentions are the target.

**Owner supplies:** the list of suppliers and partners, the product used on which project, the contact at each, and permission to name them. We checked no supplier's website, so none is named here. To check one, look for pages called projects, gallery, case studies, fabricators, dealers or partners.

> Skeleton: "We are a customer of yours and used [product] on [project]. If you feature customer projects, we can send photographs and a short description."

### 4.3 Trade articles

**Verified routes.** Traditional Building's about page says manufacturers and service providers can appear in its Buying Guides ("Get A Free Listing"), and that its blogs are written by leaders in the field. It states no submission guidelines for projects or articles, and lists separate contact routes for editorial, sales, digital inquiries, directory listings and subscriptions. (checked 18 Oct 2026, https://www.traditionalbuilding.com/about-traditional-building-magazine)

**Unverified.** Woodworking Network (woodworkingnetwork.com) appears in 6 of 45 queries, best rank 6 for its "Architectural Products" page on "architectural woodwork manufacturer", and it covers the compliance and multifamily topics buyers search. Both fetches returned HTTP 403, so its contribution route is unverified. A search-tool lookup found only an archived item from about 2010 inviting guest bloggers. That is not a current route and we do not use it. (attempted 18 Oct 2026, https://www.woodworkingnetwork.com/architectural-products and https://www.woodworkingnetwork.com/editors-contributors)

**The honest angle.** A practical article an editor could print, from a named person at Numa with facts only Numa has. Examples: "What to check before you order millwork from overseas", or the measured lead times in 4.4. It is not advertorial. If a publication offers a paid feature, that is advertising and its link should be qualified.

**Before pitching.** Read the publication's contact page in a browser. Read five recent articles. Pitch one idea to one editor. Do not send a finished article unasked. No mass email.

**Do not claim** AWI membership or certification, US projects or ISO status until they are true.

### 4.4 Linkable asset: a Dubai-to-US lead-time and shipping benchmark

**What.** A page on numaliving.us, in the planned `/resources/` area, with a table of measured times from order to site for shipments from the Dubai factory to US ports.

**Why this asset.** "How long does it take?" is a buyer question. One competitor's import page states a lead time as its own claim; ours must be measured, not copied. Pages that state plain facts are the ones the research found quoted in AI overviews.

**It needs Numa's real shipment records.** If there are no US shipments yet, publish nothing for the US. Either wait, or publish the lanes the factory really ships, labelled as such. Do not use forwarder quotes as if they were Numa's measurements.

**Owner supplies:** per shipment, anonymised:

| Field | Note |
| --- | --- |
| Month and year shipped | |
| Scope type | Kitchen, paneling, doors, FF&E and so on |
| Size | Crates or containers, and volume |
| Load port and US discharge port | |
| Incoterm | |
| Production start to ready to ship | Days |
| Ready to ship to vessel departure | Days |
| Vessel departure to arrival | Days |
| Arrival to customs release | Days |
| Customs release to delivery at site | Days |
| Total, and reasons for any delay | |

**Publishing rules.** Show the number of shipments and the date range. Show the median and the range, not only the best case. Say what is excluded. Name the Incoterm. Add a "last updated" date. Name clients only with permission. Keep duty and compliance statements out of the benchmark until a customs broker has reviewed them.

**The honest angle.** "We measured this. Cite it, or tell us if your numbers differ." Offer it to the editors in 4.3, to the freight partners who handled the shipments, and to architects and contractors who asked about lead times. Refresh it every quarter.

### 4.5 Later options

Podcast guesting and conference talks are options the skill suggests for months 7 to 12. We researched no trade podcasts or events, so none is named. Skyscraper-style outreach and guest-post campaigns need authority and content the site does not have yet.

## 5. A 12-month rhythm (skill heuristic, not a measured rule)

Month 1 starts the day the site is opened to search engines. The ranges are the skill's safe pace for new linking domains. For Numa they are ceilings, not targets: the skill's month-1 range of 15 to 25 assumes software and local-business profiles, and Numa has fewer places that fit. Our estimate from the P1 to P3 rows in section 3.2 is five to eight real profiles and listings in month 1, which is fine.

| Month | Focus | What happens | Skill heuristic: new linking domains |
| --- | --- | --- | --- |
| 0 (before launch) | Decide and prepare | Descriptor chosen. Trademark search and counsel's view. Owner facts collected. Logo files and licensed photographs ready. Handles checked. Link log open. Search Console and Bing Webmaster Tools set up. No outreach. | None |
| 1 | Entity foundation | Publish P1 and P2 profiles and free listings that pass the gates, spread over about two weeks. Add the URLs to `site.social`. Verify Ahrefs Webmaster Tools. Log every link. | 15 to 25 |
| 2 | First relationships | Ask for the first 2 to 3 project credits and 2 to 3 supplier pages (real relationships only). Start collecting shipment data. First log review. | 5 to 10 |
| 3 | First asset | Publish the benchmark if the data exists. First trade-press pitch. AWI go or no-go. | 5 to 10 |
| 4 to 6 | Compound | One pitch a month. Credits as projects close. Second anchor review. Refresh the benchmark each quarter. | 8 to 15 a month |
| 7 to 9 | Widen | A second asset if Phase 3 content supports one. More pitches. Consider talks or a podcast. | 10 to 20 a month |
| 10 to 12 | Review | Year-end audit of the log. Decide renewals. Keep what produced enquiries and drop the rest. | 15 to 30 a month |

The skill's summary says "Month 7+: 10 to 30" and its detailed playbook gives the three bands above. Both are heuristics.

## 6. Guard rails: anchors and pace (skill heuristic, not a measured rule)

### 6.1 Anchor-text mix

Anchor text is the clickable words of a link. The ranges below are the skill's safe mix. The skill's summary gives branded as 40 to 50%; its detailed guide gives 40 to 55%.

| Class | What counts | Skill range | Numa example |
| --- | --- | --- | --- |
| branded | The business name or domain | 40 to 55% | "Numa Living", "numaliving.us" |
| naked | The full URL as the anchor | 15 to 20% | "https://numaliving.us/" |
| generic | No topic words | 15 to 20% | "website", "read more", "source" |
| partial | Topic words plus other words | 10 to 15% | "the Dubai-to-US lead-time benchmark" |
| exact | Only a target phrase | 3 to 5% at most; over 5% is the risk line | "custom millwork manufacturer" |

How we apply it:

- On profiles and listings we choose the words, so they are always "Numa Living" or the domain.
- When anyone asks what anchor we want, the answer is "Numa Living". We never ask a partner for a keyword anchor. A keyword anchor someone chooses on their own is natural; we only cap what we request.
- With fewer than about 20 links, one link moves a share by 5 points or more. Read the mix as a direction, not a score.
- Logging rule (ours, not the skill's): `branded` is "Numa Living" with at most the chosen descriptor; `partial` has topic words plus other words; `exact` is only a target phrase.
- If exact match goes over 5%, stop requesting such anchors and add branded links (the skill suggests 10 to 15) before any further outreach.

### 6.2 Pace and red flags

| Flag (skill heuristic) | What it looks like | For Numa |
| --- | --- | --- |
| A spike | 50 or more new links in one month for a new domain | Not a risk at our scale. A sudden jump with no event behind it is. |
| One country or TLD | A cluster of new links from one unrelated country or TLD | A mix of US trade sources with some from the UAE and elsewhere is natural. A pile from one place with no business reason is the flag. |
| Same anchor | Several new links with identical anchor text | Our rule above prevents it. |
| Exact-match spike | Exact-match share jumping within a month | Check the log each month. |
| Template links | Most links in footers, sidebars or comments | Profile and listing links are fine; they should not be all we have. |
| No real traffic | Links from sites nobody visits, however strong they look | Prefer trade sites buyers use. |
| Same-template sites | Several links from sites sharing a theme and registration pattern | A link-network pattern. Do not accept. |
| A long stop | Months of silence after a steady pace | Keep a small steady rhythm rather than bursts. |

**If something looks wrong.** The skill's advice is to pause outreach for 30 days, use only branded anchors for the next 10 to 15 links, and look at the Manual actions report in Search Console. It also mentions disavowing the worst links. We do not use a disavow file here: with a log of links we asked for, there should be nothing to disavow. If unexplained spam links appear, get specialist advice before creating one.

## 7. What a paid backlink tool does, and the free options

**What we cannot do well without one.** List every site that links to a competitor; find domains that link to two or more competitors but not to us (a link-gap analysis); compare link counts or authority scores reliably; get alerts when a competitor wins a new link. The research has no backlink data for any competitor.

**Free options for the site's own links:**

| Tool | What it shows | Limits stated at the source | Checked |
| --- | --- | --- | --- |
| Google Search Console, Links report | Top linked pages, top linking sites and top linking text for your own property, plus internal links | "This report isn't a comprehensive list of every link on your site". Tables are limited to 1,000 rows. Removed links may still appear. It "doesn't specify if a link is marked as nofollow". Sites are grouped by root domain. Export up to 100,000 rows as "Latest links" or "More sample links". | checked 18 Oct 2026, https://support.google.com/webmasters/answer/9049606 |
| Ahrefs Webmaster Tools | Backlinks to sites you verify, in Site Explorer, plus a site audit | Free for verified websites. Up to 1,000 backlinks visible at once. 5,000 crawl credits a month per project for the audit. Its FAQ says paid subscriptions allow analysis of competing (unverified) websites. | checked 18 Oct 2026, https://ahrefs.com/webmaster-tools |
| Bing Webmaster Tools | Bing's blog lists "Backlinks for any sites" among its features and says users can see backlinks for other sites as well as their own | The blog does not state limits, whether the site must be verified, or how deep the data is. The Backlinks help page returned only its title, so it is unverified. | checked 18 Oct 2026, https://blogs.bing.com/webmaster/August-2024/Bing-Webmaster-Tools-or-Google-Search-Console-A-Comparison (help page attempted: https://www.bing.com/webmasters/help/backlinks-c3a334e8) |

**A free manual link-gap check, to be tested.** Once numaliving.us is verified in Bing Webmaster Tools, try the Backlinks report on two or three competitors from the research (Millwork USA, Vintage Millworks, and a regional fabricator that appears in many of the research queries, such as a2zmillwork.com). If it returns data, export it and compare by hand with our own links in a spreadsheet. Treat the result as a sample, not a full index, and record in the log only places that pass the rules in section 1.

**A free manual check without any tool.** The research SERPs already show where US millwork firms are listed: Houzz, Procore Network, the Traditional Building buying guide, Thomasnet, LinkedIn and Instagram. For each competitor, search its name with words like "projects" or "credit" and note where it appears that Numa does not.

**Setup.** Phase 0 of the programme asks the owner to set up Search Console and Bing Webmaster Tools. If verification needs a DNS record or an HTML tag, the owner approves it (see [docs/RUNBOOK.md](../RUNBOOK.md), section 7, and [ADR 0002](../adr/0002-custom-domain-numaliving-us.md)). Ahrefs Webmaster Tools follows once the site is verified. Open each tool's links report monthly and compare it with the log.

## 8. Tracking: the link log

[link-log.csv](link-log.csv) is a plain table with one row per link. It holds the header only until the first link is recorded. Edit a row when its status changes; the date is the date of the latest change and Git keeps the history.

| Column | Meaning | Allowed values |
| --- | --- | --- |
| date | Date of the latest change to this row | YYYY-MM-DD |
| target_url | The page on numaliving.us the link points to | Full https URL |
| source_domain | Domain of the linking page | For example `example.org` |
| source_url | The exact page with the link (for a planned row, the page or form where we hope to get it) | Full URL |
| type | What kind of link | `profile`, `directory`, `editorial`, `partner`, `project-credit`, `other` |
| anchor_text | The clickable words (image links: the alt text; naked URLs: the URL) | Free text |
| anchor_class | The class from section 6.1 | `branded`, `naked`, `generic`, `partial`, `exact` |
| rel | The link attribute on the live page | `follow`, `nofollow`, `unknown`. Use `nofollow` for any of `nofollow`, `sponsored` or `ugc` and put the exact value in notes. |
| status | Where it stands | `planned`, `requested`, `live`, `lost` |
| owner | The role responsible, not a person's name | `owner`, `sales`, `marketing`, `agency` |
| notes | Anything else. Use `country=XX`, `paid=yes` or `paid=no`, and `checked=YYYY-MM-DD`. No secrets or personal data. | Free text |

Format example, with invented values and not a real link:

```csv
2026-11-20,https://numaliving.us/projects/example/,example.org,https://example.org/projects/example/,project-credit,Numa Living,branded,follow,marketing,"country=US; paid=no; checked=2026-11-20"
```

**Reading the `rel` attribute.** For a page that renders its HTML on the server, run `curl -sL "<source_url>" | grep -io '<a [^>]*numaliving\.us[^>]*>'` and read the `rel=` part. For pages built in the browser (LinkedIn and similar), open the page, right-click the link, choose Inspect and read the `rel` attribute. Until someone does, the log says `unknown`.

**Monthly review (about 30 minutes).**

1. Count new `live` rows by month against the ceilings in section 5.
2. Work out the share of each `anchor_class`. Act on section 6.1 if `exact` is over 5%.
3. Look at the mix of `type` and of `country=` in notes for the monocultures in section 6.2.
4. Resolve `unknown` values in `rel`.
5. Mark `lost` links and decide whether to ask again.
6. Compare with the Search Console links report. A linking domain there that is not in the log is either a natural link (good) or one to investigate.

## 9. What the owner supplies

- **Name and brand.** The descriptor choice. Counsel's trademark view. Proof of the parent-group wording ("A Conqueror Group company"): a public page that names Numa Living.
- **Facts.** Legal name, year founded, real factory address, real phone (and a US number if one is planned), opening hours with time zone.
- **Assets.** Logo files. Photographs with a licence you can show and the photographer's credit. A real factory video if YouTube is used.
- **Projects.** Real completed projects with permission to name the client, architect, designer and general contractor. Which of them were delivered to the US.
- **Suppliers and partners.** The list, the product used on which project, a contact at each.
- **Shipments.** The records in 4.4, with permission to publish them anonymised.
- **Money.** A budget answer for AWI, Material Bank and Sweets. Who at Numa sends outreach and who approves it.
- **Reading in a browser.** ARCAT, the Woodwork Institute, Woodworking Network and Instagram's setup page, which our tools could not read.

## 10. Verification log, 18 Oct 2026

Fetched and read:

| Source | Used for |
| --- | --- |
| https://support.google.com/business/answer/3038177 | Business Profile eligibility |
| https://developers.google.com/search/docs/essentials/spam-policies | Link-spam rules |
| https://www.wikidata.org/wiki/Wikidata:Notability | Wikidata tests |
| https://www.linkedin.com/help/linkedin/answer/a543852 | LinkedIn Page |
| https://support.google.com/youtube/answer/2657964 | YouTube channel links |
| https://help.pinterest.com/en/business/article/get-a-business-account | Pinterest business account |
| https://pro.houzz.com/pro-learn/blog/how-to-create-a-free-houzz-business-account | Houzz free account |
| https://business.thomasnet.com/programs | Thomasnet free tier |
| https://www.traditionalbuilding.com/buying-guides | Buying Guides free listing |
| https://www.traditionalbuilding.com/about-traditional-building-magazine | Audience and submissions |
| https://www.materialbank.com/faqs | Material Bank |
| https://sweets.construction.com/ | Sweets |
| https://business.architonic.com/ | Architonic |
| https://awinet.org/pricing/ | AWI dues |
| https://awinet.org/compliance/quality-certification/ | AWI QCP |
| https://awmac.com/membership/membership-categories/ | AWMAC |
| https://support.procore.com/products/procore-construction-network | Procore Construction Network |
| https://construction.autodesk.com/products/buildingconnected/ | BuildingConnected |
| https://support.google.com/webmasters/answer/9049606 | Search Console Links report |
| https://ahrefs.com/webmaster-tools | Ahrefs Webmaster Tools |
| https://blogs.bing.com/webmaster/August-2024/Bing-Webmaster-Tools-or-Google-Search-Console-A-Comparison | Bing backlinks for any sites |

Attempted and not readable (the related rows say unverified): https://business.arcat.com/ (403), https://www.arcat.com/about (403), https://support.buildingconnected.com/hc/en-us/articles/360022339953 (403), https://www.woodworkingnetwork.com/architectural-products (403), https://www.woodworkingnetwork.com/editors-contributors (403), https://woodworkinstitute.com/ (title only), https://woodworkinstitute.com/affiliation/accredited-millwork-company/active-membership (title only), https://help.instagram.com/502981923235522 (heading only), https://www.facebook.com/business/help/502981923235522 (title only), https://business.instagram.com/ (navigation only), https://www.bing.com/webmasters/help/backlinks-c3a334e8 (title only).

Search-engine summaries were used only to find these URLs, never as evidence. The trademark sources are listed in [brand-and-profiles.md](brand-and-profiles.md).
