# Numa Living website

The public website for Numa Living, a luxury joinery and millwork manufacturer. It has Home, About, Projects (with a page for each project), Capabilities, Process, Request a Quote and Client Login. It is a Next.js site exported as plain static files and published on GitHub Pages by GitHub Actions. Nothing runs on a server and nothing is stored in a database. Quote Requests are emailed to Numa through FormSubmit.co. Client Login is a design-only page standing in for the future Client Portal.

**Live site:** https://numaliving.us/ (the earlier preview address, https://pranay-ai360.github.io/numaliving.com.au/, now redirects there).

[`CONTEXT.md`](CONTEXT.md) defines the terms used here (Client Portal, Client Login, Quote Request, Drawings, Contact email, Form alias, Custom domain). [`docs/adr/0001-static-hosting-on-github-pages.md`](docs/adr/0001-static-hosting-on-github-pages.md) explains why the site is hosted this way, and [`docs/adr/0002-custom-domain-numaliving-us.md`](docs/adr/0002-custom-domain-numaliving-us.md) why it is served at numaliving.us. [`docs/RUNBOOK.md`](docs/RUNBOOK.md) lists the day-to-day commands (which tool to use, how to install it, what to do without it), and [`CLAUDE.md`](CLAUDE.md) is the short guide for Claude Code.

Built with Next.js 16 (static export), React 19, Tailwind CSS 4 and Zod, and tested with Vitest and Playwright.

## Run it on your Mac

1. Install Node.js 24 (the LTS version) from [nodejs.org](https://nodejs.org).
2. Open Terminal in this folder and run:

   ```bash
   cp .env.example .env.local   # first time only; .env.local is never committed
   npm ci                       # installs the exact versions in package-lock.json
   npm run dev
   ```

3. Open http://localhost:3000 in your browser. Pages refresh as you edit files.

`.env.local` holds two settings. Both are explained in `.env.example`:

| Setting | On your Mac | On GitHub Pages |
| --- | --- | --- |
| `NEXT_PUBLIC_FORMSUBMIT_ID` | Leave it empty and the quote form tells visitors to email instead. Put the FormSubmit alias here to send real Quote Requests from your Mac. Never put the mailbox address itself here (see [Going live](#going-live), step 2). | The deploy workflow fills it from the repository variable `FORMSUBMIT_ID`. |
| `NEXT_PUBLIC_BASE_PATH` | Leave it empty. | The deploy workflow sets it from `actions/configure-pages`: empty on the custom domain (numaliving.us), `/numaliving.com.au` on the GitHub Pages project address. |

Every `NEXT_PUBLIC_` value ends up in the public site, so never put a password or secret key in one.

`NEXT_PUBLIC_BASE_PATH` is either empty or a path such as `/numaliving.com.au`: it starts with `/`, does not end with `/`, and uses only letters, digits, `-`, `.`, `_` and `~` between the slashes. Anything else stops the build with a message that names the setting. The build and the photo paths share this one rule (`src/lib/basePath.ts`).

`npm run build` writes the finished site to `out/`. `npm run build:e2e` builds it the way GitHub Pages serves a project site, below `/numaliving.com.au`, but with the made-up form id `e2e-form-id` that the end-to-end tests expect. Never publish that build: the form could not deliver anything, and the deploy workflow refuses that id. To look at the build in a browser, run `npm run serve:pages` and open http://127.0.0.1:4173/numaliving.com.au/. Opening the files in `out/` directly does not work, because every link starts with `/numaliving.com.au/`.

## Where to change things

| To change… | Where |
| --- | --- |
| Colours (Condor gold, backgrounds, text) | `src/app/globals.css` (top block) |
| Name, contact details, menu | `src/config/site.ts` |
| The "Preview: … sample content" ribbon | `showSampleNotice` in `src/config/site.ts` |
| Whether search engines may index the site | `isIndexable` in `src/config/site.ts` (see [Search engines and the preview](#search-engines-and-the-preview)) |
| Page text, stats, capabilities, factory, process steps, delivery | `src/content/pages.ts` |
| Projects | `src/content/projects.ts` |
| The factory and destinations on the About page map | `src/content/locations.ts` |
| Fonts | `src/app/layout.tsx` and `src/fonts/` |
| Quote Request choices (role, project type, timeline) and field length limits | `src/lib/quotes/schema.ts` |
| Drawings limits (number of files, total size; keep the total under FormSubmit's 10 MB cap) | `src/lib/quotes/drawings.ts` |
| Messages shown when a Quote Request cannot be sent | `src/lib/quotes/messages.ts` |
| The mailbox that receives Quote Requests | The repository variable `FORMSUBMIT_ID`, set to the mailbox's FormSubmit alias, never the address itself (see [Going live](#going-live), steps 2 and 3) |

**Adding project photos:** put the images in `public/projects/<project-slug>/`, then list them in that project's `images`, for example `images: ["/projects/marina-villa/Marina-View-0001.jpg"]`. The first image is the cover. Name new files in lowercase with hyphens and no spaces (for example `kitchen-01.jpg`). GitHub Pages treats capitals as different letters, so a path must match its file name exactly. Keep each path starting with `/`: the site adds the base path in front when it shows the photo (empty on numaliving.us, `/numaliving.com.au` on the old project address) (through `withBasePath()` in `src/lib/assetPath.ts`). Projects with no photos show a material-swatch placeholder.

Everything marked `sample: true`, `SAMPLE` or `TODO(Ramya)` is placeholder content to replace.

## How the Request a Quote form works

The form is on the Contact page (`/contact/`). The site has no server, so the visitor's browser sends the Quote Request straight to FormSubmit, and FormSubmit emails it to Numa. A request without Drawings goes to FormSubmit's AJAX address, `https://formsubmit.co/ajax/<id>`, which answers in JSON. A request with PDFs goes to its ordinary address, `https://formsubmit.co/<id>`, because only that address carries attachments (the AJAX address drops them, as a live test on 18 October 2026 showed); it answers with a web page, and only FormSubmit's "Thanks!" page counts as sent. `<id>` is `NEXT_PUBLIC_FORMSUBMIT_ID`, fixed into the site when it is built. The website keeps no copy. The checking and sending code is in `src/lib/quotes/`; the form itself is `src/components/QuoteForm.tsx` and `src/components/quote-form/`.

**What Numa receives.** One email per Quote Request:

- The subject carries the reference, project type and site location, and the number of attached PDFs when there are any, for example `Quote Request NL-7K3QX9: Residences, Dubai, UAE [2 PDFs]`.
- A table with full name, company, email, phone, role, project type, site location, timeline, scope and notes, drawings link, the attached Drawings ("Expect 2 PDFs attached:" followed by their names and sizes, so a missing attachment is noticed), and the reference.
- The Drawings, attached as PDFs.
- Reply-To is set to the visitor's email address, so pressing Reply answers the visitor.

**Drawings.** PDF only, up to 10 files and 9 MB in total. FormSubmit accepts at most 10 MB of attachments per submission, and the 9 MB limit leaves room for the rest of the request. The form refuses anything else and says why. For larger sets the visitor pastes a Google Drive, Dropbox or WeTransfer link into the optional "Link to larger drawings" field. It must start with `https://`: a plain `http://` link would send the drawings unencrypted. A real test with PDFs is part of [Going live](#going-live).

**Reference.** Every Quote Request gets a reference such as `NL-7K3QX9`. The visitor sees it on the Thank You panel and Numa sees it in the email subject, so both sides can quote it. It avoids characters that are easy to confuse (no I, O, 0 or 1).

**Spam controls.**

- A hidden "honeypot" field (`_honey`) that people never see. Form-filling robots tend to fill it in. The visitor's browser checks it: when it is filled, the form shows "Thank You" and sends nothing. The field itself is never sent to FormSubmit.
- A 2-second minimum: if Send is pressed less than 2 seconds after the form appears, the form sends nothing and says "Please take a moment to review your details, then send again."
- That is all the protection there is, and all of it runs in the visitor's browser. The form reads FormSubmit's answer itself, so FormSubmit's captcha page cannot be used and is switched off (`_captcha=false`), and FormSubmit cannot limit submissions to this website. Anyone who reads the alias in the page source can post to it directly and skip every check above. See [Security notes](#security-notes).

**What the visitor sees.**

- **Sent:** a Thank You panel with the reference: "We have your request. Our team will reply within two working days." Under it, a line asks the visitor to email Numa, quoting the reference, if no reply comes within two working days; the address in that line opens an email with the reference in the subject, for example "Quote Request NL-7K3QX9". No confirmation email goes to the visitor, because FormSubmit's `_autoresponse` does not work over AJAX.
- **A problem with the details** (a missing or invalid field, a file that is not a PDF, too many or too large files): a message saying what to fix. Nothing is sent.
- **Sending did not work out** (including a site built without a form id): one of the messages in the table below, with an "Email us instead" link. The details stay in the form so the visitor can try again. The form only says "Thank You" once FormSubmit confirms it has the request; it never pretends to send.
- Under the Send button, the privacy note (`PRIVACY_NOTE` in `src/components/quote-form/constants.ts`): "Your details and drawings are sent to Numa Living by email through FormSubmit.co and used only to reply to your enquiry."

The messages are in `src/lib/quotes/messages.ts`; `{email}` stands for the email address in `src/config/site.ts`. The "Email us instead" link opens an email to that address whose subject carries the short code from the first column, for example "Quote Request (website error: rejected)" (`src/lib/quotes/emailLinks.ts`), so Numa can see what went wrong without asking the visitor.

| Code | When | What the visitor reads |
| --- | --- | --- |
| `not-configured` | The site has no usable form id: `NEXT_PUBLIC_FORMSUBMIT_ID` is empty (for example on your Mac without `.env.local`, or on GitHub Pages before the `FORMSUBMIT_ID` variable is set) or not a valid id | "Online requests are not available right now. Please email your details and drawings to {email}." |
| `not-activated` | FormSubmit answers that the form still has to be activated (step 2 of [Going live](#going-live)) | "Online requests are still being set up. Please email your details and drawings to {email} for now." |
| `network` | FormSubmit could not be reached: no connection, or an ad blocker or privacy extension stopped the request | "We could not reach our form service. Please check that you are online and that no ad blocker or privacy extension is blocking the form, then try again, or email us at {email}." |
| `timeout` | No answer within 60 seconds | "Sending took too long, which can happen with large drawings on a slow connection. Please try again, or email us at {email}." |
| `too-large` | FormSubmit refused the request as too large (HTTP 413) | "Your drawings were too large to send through the form. Please remove some files and paste a share link to them instead, or email them to us at {email}." |
| `rejected` | FormSubmit answered with an error, or said no | "Our form service did not accept your request. Please try again in a few minutes, or email us at {email}." |
| `invalid-response` | FormSubmit's answer was unclear (no plain yes, a page other than its "Thanks!" page, or a redirect), so delivery is unconfirmed | "We could not confirm that your request was received. Please email us at {email} so we can check." |
| `unexpected` | Anything else, for example the sending code failed to load | "Something went wrong while sending your request. Please try again, or email us at {email}." |

## Going live

Publishing is automatic once it is set up. Every push to `main` runs the workflow `.github/workflows/deploy.yml`, which has three jobs:

- `verify` runs the checks (see [Tests and quality checks](#tests-and-quality-checks)).
- `build` builds the site with the base path from `actions/configure-pages` and the FormSubmit alias from the `FORMSUBMIT_ID` variable, and uploads `out/`. It may only read the repository and the Pages settings.
- `deploy` publishes that upload to GitHub Pages. It is the only job allowed to write to Pages, and it runs no code from the repository.

Pull requests run only the `verify` job. Before building, the `build` job checks `FORMSUBMIT_ID`: when it is empty, the deploy goes ahead with a warning and the form shows its "Email us instead" fallback; when it is the test id `e2e-form-id`, or contains `@` (a mailbox address, which the site would publish in its JavaScript), the deploy fails.

The one-time steps below are the publishing gates P2 to P9 (gate P1, reviewing and committing the changes, comes first). Run the commands in Terminal in this folder, with the GitHub CLI (`gh`) signed in as an admin of `pranay-ai360/numaliving.com.au`. Replace anything shown as `you@example.com` or `paste-the-alias-here`.

These were the steps of the first publish (11 October 2026). Today a change ships through a pull request (`gh pr create`, `gh pr checks --watch`, `gh pr merge --merge`; see [`docs/RUNBOOK.md`](docs/RUNBOOK.md)). Steps 2, 3, 7 and 8 still apply whenever the mailbox or the FormSubmit alias changes.

1. **Push the branch and open a pull request (P2).**

   ```bash
   git push -u origin pages
   gh pr create --base main --head pages --fill
   gh pr checks --watch
   ```

   The `verify` job audits the packages that ship to visitors (`npm audit --omit=dev --audit-level=high`), then runs lint, typecheck, unit tests with coverage, the build and the end-to-end tests. It must pass before you merge.

2. **Activate FormSubmit from Terminal (P3).** FormSubmit only delivers to a mailbox after its owner confirms it once. Do this with `curl` against the mailbox address, as below, and never by putting the mailbox address into `FORMSUBMIT_ID` (or `NEXT_PUBLIC_FORMSUBMIT_ID`), not even for a quick test: the site would publish the address in its JavaScript for anyone to read. The deploy fails when `FORMSUBMIT_ID` contains `@`.
   1. Choose the mailbox that should receive Quote Requests, ideally one used only for them (see [Security notes](#security-notes)). For numaliving.us it is `projects@numaliving.us` (mail for the domain is handled by Forward Email).
   2. In Terminal, send it a first test, with `you@example.com` replaced by the mailbox:

      ```bash
      curl -sS https://formsubmit.co/ajax/you@example.com \
        -H "Accept: application/json" \
        -H "Content-Type: application/json" \
        -H "Referer: https://numaliving.us/" \
        -d '{"name":"Activation test","message":"Activating the Numa Living Quote Request form"}'
      ```

      The Referer line tells FormSubmit which website the form is for. FormSubmit replies with a short message and emails an activation link to the mailbox.
   3. Open FormSubmit's email and click the activation link.
   4. FormSubmit then emails you a random-string alias for the mailbox. Copy it. The site uses the alias instead of the address, so the form's own code does not name it. (numaliving.us prints its contact email on every page anyway, so the alias hides nothing while the form's mailbox is that same public address: see [Security notes](#security-notes).)

3. **Save the alias as a repository variable (P3).**

   ```bash
   gh variable set FORMSUBMIT_ID --body "paste-the-alias-here" --repo pranay-ai360/numaliving.com.au
   gh variable list --repo pranay-ai360/numaliving.com.au
   ```

   It is a variable, not a secret, on purpose: the value ends up in the site's public JavaScript anyway. Set it before you merge. The alias is fixed into the site when it is built, so a later change only takes effect at the next deploy. Never set it to `e2e-form-id`, the made-up id of the end-to-end tests, or to the mailbox address: the deploy refuses both. If a mailbox address ever gets in by mistake, fix the variable and then delete the failed run (`gh run delete <run-id>`), because a run's log lists the settings each step was given.

4. **Turn on GitHub Pages (P4).** Do this before you merge: the `build` job's `actions/configure-pages` step fails while Pages is off. Turning Pages on publishes nothing by itself.

   ```bash
   gh api -X POST repos/pranay-ai360/numaliving.com.au/pages -f build_type=workflow
   ```

   Or in the browser: the repository's Settings > Pages > Build and deployment > Source: **GitHub Actions**.

5. **Merge and watch the deploy (P5).**

   ```bash
   gh pr merge pages --merge
   gh run watch
   ```

   When `gh run watch` asks, pick the run for `main`. It runs `verify` again, then `build` and `deploy`. If it fails at `configure-pages`, Pages was not on: do step 4, then re-run the failed jobs from the Actions tab (or `gh run rerun <run-id> --failed`).

6. **Check the live site (P6).**

   ```bash
   gh api repos/pranay-ai360/numaliving.com.au/pages --jq '{html_url, https_enforced, build_type}'   # expect "html_url": "https://numaliving.us/" and "https_enforced": true
   curl -sI http://numaliving.us/ | grep -iE '^(HTTP|location)'   # expect 301 and a location starting https://
   curl -sI https://numaliving.us/ | head -1   # expect HTTP/2 200
   curl -sI https://www.numaliving.us/ | grep -iE '^(HTTP|location)'   # expect 301 and a location of https://numaliving.us/
   curl -s https://numaliving.us/ | grep -o '<meta name="robots"[^>]*>'   # expect noindex, nofollow
   curl -s https://numaliving.us/robots.txt   # expect User-Agent: * and Allow: / (see "Search engines and the preview")
   ```

   `https_enforced` should be `true`. On a custom domain GitHub allows it only once the certificate is approved (`gh api -X PUT repos/pranay-ai360/numaliving.com.au/pages -F https_enforced=true`), and it sends no `strict-transport-security` (HSTS) header there, so the 301 from `http` to `https` is what keeps visitors on HTTPS.

   Check that only `main` can publish to the site's `github-pages` environment:

   ```bash
   gh api repos/pranay-ai360/numaliving.com.au/environments/github-pages --jq '.deployment_branch_policy'   # expect "custom_branch_policies": true
   gh api repos/pranay-ai360/numaliving.com.au/environments/github-pages/deployment-branch-policies --jq '[.branch_policies[].name]'   # expect ["main"]
   ```

   If the first command prints `null` (every branch may deploy) or the second lists anything besides `main`, open the repository's Settings > Environments > github-pages > Deployment branches and tags, choose "Selected branches and tags" and allow only `main`.

   Then open the site and click through every page: Home, About, Projects and each project page, Capabilities, Process, Contact and Client Login. Check that every photo loads, and that a made-up address such as https://numaliving.us/nope/ shows the "Page Not Found" page.

   For a full check, crawl the live site with the browser QA tools (see [Tests and quality checks](#tests-and-quality-checks)). It visits every linked page at four screen widths and reports broken links and images, console errors, insecure requests, missing noindex tags and a wrong 404 page; it exits with 1 when anything fails:

   ```bash
   python3.14 tools/site-qa/site_check.py --base-url https://numaliving.us/ \
     --out-dir "${TMPDIR:-/tmp}/numa-live-check" --expect-https --expect-noindex
   ```

   The verdict is at the top of `report.md` in that folder.

7. **Send real Quote Requests with PDFs (P7).** On the live Contact page, fill in the form with your own details and send two Quote Requests. Then check the mailbox:
   - **One small PDF** (under 1 MB): the email arrives, its subject has the reference shown on the Thank You panel and ends with `[1 PDF]`, and the PDF is attached and opens.
   - **Three PDFs totalling about 8.5 MB** (about 2.8 MB each, just under the 9 MB limit): all three are attached and open. The email's "Attached drawings" row says "Expect 3 PDFs attached:" followed by their names and sizes, and the subject ends with `[3 PDFs]`, so a missing file stands out.
   - **Reply-To is the visitor:** pressing Reply addresses the email you typed into the form.
   - **HTML is shown as text:** in one of the requests, type `<b>bold</b> <a href="https://example.com">link</a>` into "Scope and notes". The email must show those characters as typed, not bold text or a working link. If FormSubmit turns them into formatting, anyone can put convincing links into Numa's inbox through the form, so treat links in Quote Requests with care until a relay (see [Security notes](#security-notes)) cleans them first.

   If the form says the service did not accept the request and FormSubmit sends another activation email, click the link and send again. FormSubmit may ask once more to confirm the live website.

   **Optional abuse check.** Anyone can post to the alias directly, so check whether FormSubmit also obeys a `_cc` field (a copy to another address) sent by a stranger. Use a second mailbox of your own in place of `second-mailbox@example.com`:

   ```bash
   curl -sS https://formsubmit.co/ajax/paste-the-alias-here \
     -H "Accept: application/json" \
     -H "Content-Type: application/json" \
     -H "Referer: https://numaliving.us/" \
     -d '{"name":"CC check","message":"Does FormSubmit honour _cc from a direct post?","_cc":"second-mailbox@example.com"}'
   ```

   If the second mailbox gets a copy, anyone can use the form to send email to any address: bring the Turnstile relay forward (see [Security notes](#security-notes)).

8. **Keep Quote Requests out of spam (P7).** Look in the spam or junk folder as well. If the test landed there, mark it as not spam. Then add a filter for mail from `formsubmit.co`. In Gmail: Settings > See all settings > Filters and Blocked Addresses > Create a new filter, From `formsubmit.co`, then tick "Never send it to Spam". In Outlook: add `formsubmit.co` to Safe senders.

9. **Plan B for the PDFs (P8): done.** On 18 October 2026 a live test through FormSubmit's AJAX address delivered the email without its PDF (the file name was listed under "Attached drawings", so the loss was noticed). The same fields sent as an ordinary multipart form post to `https://formsubmit.co/<alias>`, the way FormSubmit documents attachments, did arrive with the PDF, so a request with Drawings is now sent that way. The browser may read FormSubmit's answer to it (the page allows any origin), so the visitor stays on the page and no thank-you page or redirect is needed: only the "Thanks!" page with "The form was submitted successfully" counts as sent, and any other page is reported as a failure with the email fallback. Requests without files keep using AJAX. If a PDF ever fails to arrive again, the file names are still in the email, and visitors can use the "Link to larger drawings" field.

10. **Record the live URL (P9).** Done: the live-site line at the top of this README gives https://numaliving.us/.

## Tests and quality checks

```bash
npm audit --omit=dev --audit-level=high   # known security problems in the packages that ship to visitors
npm run lint            # ESLint
npm run typecheck       # next typegen && tsc --noEmit
npm test                # Vitest unit and component tests (src/**/*.test.ts and .tsx)
npm run test:coverage   # the same, but fails below 80% coverage of src/lib/**
npm run build:e2e       # static build below /numaliving.com.au, with the test form id e2e-form-id
npm run test:e2e        # Playwright, against that build served like GitHub Pages
```

The deploy workflow's `verify` job runs these same commands on every pull request and every push to `main`.

**End-to-end tests.** `npm run test:e2e` starts `scripts/serve-pages.mjs`, a small server that behaves like GitHub Pages (the site only below `/numaliving.com.au/`, a redirect that adds a missing trailing slash, the site's own 404 page with status 404, file names matched case-sensitively), and runs the specs in `e2e/` against `out/` at desktop and phone sizes. Build first with `npm run build:e2e`: the tests expect the base path and the test form id it bakes in. They intercept every request to FormSubmit, so nothing is ever emailed, and a test fails when a page throws, logs a console error, fails to load a file or calls any other host. To test a build for another base path, give both commands the same `PAGES_BASE_PATH`, for example `PAGES_BASE_PATH=/other npm run build:e2e`, then `PAGES_BASE_PATH=/other npm run test:e2e` (an empty value means the root of a domain).

**With CloakBrowser's Chromium.** Playwright needs a Chromium browser. Point it at CloakBrowser's binary with `CHROMIUM_EXECUTABLE_PATH`:

```bash
CHROMIUM_EXECUTABLE_PATH="$HOME/.cloakbrowser/chromium-154.0.8037.57.1-pro/Chromium.app/Contents/MacOS/Chromium" npm run test:e2e
```

Without that variable (as in CI), Playwright uses its own Chromium, which you install once with `npx playwright install chromium`. Three things to know about CloakBrowser:

- **One session at a time.** The free CloakBrowser licence allows one browser session at a time, so Playwright runs one test at a time. Close other CloakBrowser windows and scripts first, the `tools/site-qa/` scripts included. `cloakbrowser info` shows `Sessions: 0/1 in use` when the seat is free.
- **No console events.** CloakBrowser does not pass the page's own console messages and uncaught errors on to Playwright, so `e2e/fixtures.ts` records them inside the page instead (`e2e/guard.spec.ts` proves this still catches problems).
- **A random fingerprint on every launch.** It shifts text rendering by a pixel or two, so screenshots from two launches never match exactly. The end-to-end tests compare no screenshots; the `tools/site-qa/` scripts pin the fingerprint seed so theirs do.

**Browser QA tools.** `tools/site-qa/` holds CloakBrowser-based Python tools: `serve_pages.py` (a GitHub-Pages-like server), `site_check.py` (crawls every linked page at four screen widths and checks links, images, console errors, insecure requests, noindex tags, sideways scrolling, headings and the 404 page), and `capture.py` with `compare.py` (screenshots and a pixel comparison for before-and-after visual checks). `tools/site-qa/README.md` explains how to install and run them. After each deploy, crawl the live site (step 6 of [Going live](#going-live)):

```bash
python3.14 tools/site-qa/site_check.py --base-url https://numaliving.us/ \
  --out-dir "${TMPDIR:-/tmp}/numa-live-check" --expect-https --expect-noindex
```

**DNS helper.** `tools/cloudflare/` keeps the Cloudflare DNS records for numaliving.us in line (`check` is read-only; `apply --yes` changes the live zone). Its README explains the token and where to keep the keys file. Its unit tests need no network: `python3 -m unittest discover -s tools/cloudflare/tests`.

**ESLint and the coverage report (waiting for the owner).** After `npm run test:coverage`, `npm run lint` also scans the generated report in `coverage/` and prints a warning about `coverage/block-navigation.js`. The fix is to add `coverage/**`, `playwright-report/**` and `test-results/**` to the `globalIgnores` list in `eslint.config.mjs`. That file is protected in this setup, so the change waits for the owner's decision. CI is not affected, because its lint step runs before the report exists.

## Search engines and the preview

While the site is a preview, `isIndexable` in `src/config/site.ts` is `false`, and every page carries `<meta name="robots" content="noindex, nofollow">`, which asks search engines not to list the page or follow its links. **This tag is what keeps the preview out of search results.**

The generated `robots.txt` (`src/app/robots.ts`, rules in `src/lib/robots.ts`) allows crawling (`User-Agent: *`, `Allow: /`) whether or not the site is indexable. That is deliberate:

- A crawler has to fetch a page to see its noindex tag. If `robots.txt` blocked the page, its address could still appear in search results (found through links elsewhere), just without a description.
- On the old GitHub Pages address (now a redirect), `robots.txt` had no effect. Crawlers only read it at the root of a host (`https://pranay-ai360.github.io/robots.txt`, which this repository does not control), so `/numaliving.com.au/robots.txt` was ignored. On numaliving.us it sits at the root and counts, and it already lets crawlers in to read the tag.

To make the site public, set `isIndexable = true` (step 4 in the next section): the noindex tag then disappears from every page. Keep it `false` for as long as the site should stay out of search results, on numaliving.us or any other domain. A unit test (`src/config/launchGuard.test.ts`) fails while `isIndexable` is `true` and the site still has placeholder or sample content: the placeholder contact details in `src/config/site.ts`, the "Preview" ribbon (`showSampleNotice`), or any project marked `sample: true` in `src/content/projects.ts`. The tests, and with them the deploy, stop until all of that is real, and the failure names each item.

## Custom domain: numaliving.us

The site is served at https://numaliving.us/ (set up on 16 October 2026). The bare domain is the main address; `www.numaliving.us` and the old GitHub Pages address redirect to it. The domain is registered at GoDaddy and its DNS is on Cloudflare, with every site record set to "DNS only" (grey cloud): proxying through Cloudflare can stop GitHub checking the domain and issuing its certificate. GitHub issues and renews the certificate itself (Let's Encrypt, free), and mail for the domain is handled by Forward Email. [`docs/adr/0002-custom-domain-numaliving-us.md`](docs/adr/0002-custom-domain-numaliving-us.md) gives the reasons, [`docs/RUNBOOK.md`](docs/RUNBOOK.md) the commands, and `tools/cloudflare/` keeps the DNS records in line.

The steps below are how it was done, and how to repeat it for another domain. They follow GitHub's guide [Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site). In short:

1. **Verify the domain with GitHub first.** This stops anyone else's GitHub Pages site from taking the domain over. Open your profile picture > Settings > Pages (your profile settings, not the repository's) > Add a domain. GitHub shows a TXT record named `_github-pages-challenge-pranay-ai360.<your-domain>`. Add it at your DNS provider (for numaliving.us: `python3 -I tools/cloudflare/cf_dns.py github-challenge <the-code> --yes`), wait (up to 24 hours, usually seconds on Cloudflare) and click Verify. Keep the TXT record afterwards. Do this before anything else, and before ever clearing a domain from the repository: while it is cleared, another GitHub account could claim it.
2. **Add the domain to the site.** In the repository's Settings > Pages > Custom domain, enter `www.<your-domain>` (or the bare domain) and save. GitHub recommends doing this before adding the DNS records. No `CNAME` file is needed: GitHub ignores it for sites published by a GitHub Actions workflow.
3. **Add the DNS records** at your DNS provider:
   - for the bare domain, four `A` records (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) and four `AAAA` records (`2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`);
   - for `www`, a `CNAME` record pointing to `pranay-ai360.github.io` (without the repository name).

   With both in place, GitHub redirects one to the other. Do not add wildcard records such as `*.<your-domain>`: GitHub warns they allow takeovers even on a verified domain.
4. **Make the site public in one change and merge it to `main` straight away.** Until the next deploy, the domain serves the old build, which was made for `/numaliving.com.au`.
   - Set `isIndexable = true` in `src/config/site.ts`. The real contact details and projects must be in place first, with no project marked `sample: true` and `showSampleNotice = false`, or the launch guard test fails. To keep the new domain out of search results for a while, leave it `false` for now: the domain still works, and `robots.txt` already lets crawlers read the noindex tag.
   - Add canonical and Open Graph URLs (`metadataBase` in `src/app/layout.tsx`) and a sitemap (`src/app/sitemap.ts`). These are developer tasks.
   - Update the live URL at the top of this README.

   The base path clears itself: with a custom domain, `actions/configure-pages` reports an empty base path, so the deploy builds the site for the domain root with no code change.
5. **Tick "Enforce HTTPS"** in Settings > Pages, or run `gh api -X PUT repos/pranay-ai360/numaliving.com.au/pages -F https_enforced=true` once `gh api repos/pranay-ai360/numaliving.com.au/pages --jq .https_certificate.state` says `approved`. GitHub says it can take up to 24 hours; if the certificate has not started about 30 minutes after the DNS is right, clear the domain and set it again (see the runbook). Never delete the Pages site itself.
6. **Check the form.** FormSubmit keeps working with the same alias. Send one test Quote Request from the new address. If FormSubmit emails an activation link for it, click it. To activate a new mailbox, use `Referer: https://numaliving.us/` in the `curl` of [Going live](#going-live), step 2.

## Client Portal status

- **Client Login is design-only.** The page at `/login/` is linked from the header (desktop and mobile menus), the footer, the home page and the Process page. It shows "The client portal opens soon." Every field and button is disabled, and nothing is sent anywhere. The page has no form at all, so even fields switched back on in the browser's developer tools cannot send a password anywhere or put it in the address bar. Screen readers hear the notice as the description of the disabled sign-in group. The old `/portal` page and the Firebase sign-in code have been removed.
- **The Client Portal (Phase 2) needs its own hosting with a backend.** GitHub Pages serves static files only and cannot run server code. The Client Portal will need sign-in, a database, file storage for Drawings, and permissions per person, per project and per module. When it exists, the Client Login links can point to it.
- **Already in place:** the shared types in `src/lib/types.ts` (`PortalProject`, `ProjectMember`, `PortalModule`, `Permission`). Rights are set per person, per project and per module by the client's main contact, not by fixed roles. `PortalProject.showcaseSlug` links a finished project to its public page. `quoteRequestId` will link a project to the Quote Request it started from, once there is a back office to keep Quote Requests. All Drawings are PDFs, so no CAD viewer is needed.

## Security notes

- **The form id is a public channel.** The FormSubmit alias is in the page source, so anyone can post to `https://formsubmit.co/ajax/<alias>` or `https://formsubmit.co/<alias>` directly, from anywhere, without opening the site. Every check the form makes (the honeypot, the 2-second minimum, PDF only, the size limits, `https://` links) runs in the visitor's browser, and a direct post skips them all. Treat every Quote Request and every attachment as untrusted:
  - Send Quote Requests to a mailbox used only for them (for example `quotes@` on Numa's own domain), not to a personal or admin mailbox.
  - Make sure that mailbox scans attachments for malware (Gmail and Microsoft 365 do by default), and open attached drawings with care.
  - Never put the mailbox address itself into `FORMSUBMIT_ID`: the deploy refuses it (step 2 of [Going live](#going-live)).
  - For numaliving.us the FormSubmit mailbox is `projects@numaliving.us`, which is also printed on every page. Anyone can therefore post to FormSubmit with the address itself, skipping the alias and every check in the browser. If the form is abused, activate a separate unpublished mailbox for FormSubmit (for example `quotes-<random>@numaliving.us`, forwarding to the same inbox) and switch `FORMSUBMIT_ID` to its alias, or bring in the Turnstile relay (F6, below).
- **Follow-ups** (F6 and F9 to F12):
  - **Turnstile relay (F6):** a small Cloudflare Worker that checks Cloudflare Turnstile (a free challenge) before it passes a Quote Request on, so the FormSubmit alias no longer has to be public. Or Web3Forms Pro, a paid form service with stronger spam controls.
  - **Content Security Policy (F9):** GitHub Pages cannot send security headers, but a `<meta http-equiv="Content-Security-Policy">` tag can still limit where scripts load from and where the page may send data (its own address and `formsubmit.co`). Next.js puts a few scripts inline in each page, so the policy needs their hashes and a careful test.
  - **Photo metadata (F10):** all 30 project photos carry camera metadata (camera and lens model, the date taken, the editing software), and 13 of them also carry camera and lens serial numbers and a photographer's name as artist and copyright holder. None has a GPS position. Strip the camera details before launch, but keep the artist and copyright fields until the photo rights (see below) are settled.
  - **Pinned actions and Dependabot (F11):** pin every action in `.github/workflows/deploy.yml` to a full commit SHA, and let Dependabot propose updates for those actions and for the npm packages.
  - **Branch protection (F12):** protect `main` (changes only through pull requests, and the `verify` check must pass), and keep the `github-pages` environment limited to `main` (step 6 of [Going live](#going-live)).

## Known limitations and follow-ups

- **Placeholder contact details** (`TODO(Ramya)` in `src/config/site.ts`): the phone `+971 4 000 0000`, WhatsApp number and address. Replace them before launch. The email is real: `projects@numaliving.us`, which the quote form's "Email us instead" link and its error messages use. The launch guard test fails if `isIndexable` is set to `true` before the placeholders are replaced.
- **Sample content and photo rights:** projects, figures and map locations marked `sample: true` or `SAMPLE` are invented. Confirm that Numa may publish the golf-links photos (credited to Intelier and Condor) and the other project photos. Set `showSampleNotice = false` once the content is real. The launch guard test also fails if `isIndexable` is `true` while the ribbon is on or any project is still marked `sample: true`.
- **Privacy policy page:** needed before the real launch, and ideally before FormSubmit is activated (step 2 of [Going live](#going-live)), because visitors' details and Drawings pass through FormSubmit, a third party. Check the Australian Privacy Act, the UAE PDPL and the GDPR as they apply.
- **Image weight:** the photos add up to about 15 MB of JPGs. Photos below the fold already load lazily, as they near the screen; the first row of cards on the Projects page and a project page's main photo load straight away. They should still be resized, served as AVIF or WebP, and given explicit dimensions.
- **Home links cost one redirect.** Because the base path contains dots (`/numaliving.com.au`), Next.js reads `.au` as a file extension and writes Home links without a trailing slash (`/numaliving.com.au`). On GitHub Pages each of them costs one 301 redirect to `/numaliving.com.au/`, and a very fast click, before the router has prefetched the page, can turn into a full page reload (with a 404 for `/numaliving.com.au.txt` in the browser console). Every other link is unaffected. It is gone on numaliving.us (the base path is empty there); it still applies to `npm run build:e2e` and to the old project address.
- **Spam hardening, if the form is abused:** see the Turnstile relay in [Security notes](#security-notes).
- **FormSubmit has no service guarantee and no domain lock.** Send a test Quote Request now and then, and act on GitHub Actions failure emails. Dependabot is still to be set up (see [Security notes](#security-notes)).
