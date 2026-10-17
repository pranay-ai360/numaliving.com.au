# Runbook

Day-to-day commands for the Numa Living website: which tool to use, how to install it, and what to do when it is missing. The big picture is in [`README.md`](../README.md), the vocabulary in [`CONTEXT.md`](../CONTEXT.md), the reasons in [`docs/adr/`](adr/). Nothing secret belongs in this file.

## 1. Ship a change

A change reaches the site through a pull request. Merging to `main` starts the build and deploy.

```bash
git switch -c <type>/<short-name> origin/main      # for example fix/footer-link
# edit, then run the checks in section 3
git add <the files you changed>
git commit -m "<type>: <description>"              # types: feat, fix, refactor, docs, test, chore, perf, ci
git push -u origin HEAD
gh pr create --base main --fill
gh pr checks --watch                               # the verify job must pass
gh pr merge --merge --delete-branch                # starts build and deploy on main
gh run watch                                       # pick the run for main
```

A push straight to `main` deploys as well, and `verify` still has to pass before `build` and `deploy` run. Commit messages carry no attribution lines.

## 2. Which tool for what

| Job | Use | Commands |
| --- | --- | --- |
| Pull requests, CI, redeploys | `gh` | `gh pr create`, `gh pr checks --watch`, `gh pr merge --merge`, `gh run list`, `gh run watch`, `gh workflow run deploy.yml --ref main` |
| The form's destination | `gh` | `gh variable set FORMSUBMIT_ID --body "<alias>" --repo pranay-ai360/numaliving.com.au`, `gh variable list` |
| Custom domain and HTTPS | `gh api` | `gh api repos/pranay-ai360/numaliving.com.au/pages --jq '{cname, https_enforced, certificate: .https_certificate.state}'`, `gh api -X PUT repos/pranay-ai360/numaliving.com.au/pages -f cname=numaliving.us`, `gh api -X PUT repos/pranay-ai360/numaliving.com.au/pages -F https_enforced=true`, `gh api repos/pranay-ai360/numaliving.com.au/pages/health` |
| Commits and pushes | `git` (or Tower) | the commands in section 1 |
| Lint, types, tests, build | `npm` | section 3 |
| Cloudflare DNS records | the Python helper in `tools/cloudflare/` (no install needed), or `cf`, or the dashboard | `python3 -I tools/cloudflare/cf_dns.py check`, then `apply --yes` (which deletes other A, AAAA and CNAME records on the bare domain and `www`) |
| Mail addresses | the Forward Email dashboard (no command line) | add or change the `projects@` alias there |
| Activating the form | `curl` | README, Going live, step 2 |
| Checking the live site | `curl`, `dig`, `openssl`, then the CloakBrowser crawl | section 9 |

`gh` handles everything on GitHub. For Cloudflare, the helper is the first choice: it needs only Python's standard library, reads the key file itself and prints no secrets. `cf` (the official Cloudflare CLI) is still a beta; it is installed here but optional.

## 3. Checks before you push

```bash
npm ci
npm run lint
npm run typecheck
npm run test:coverage                              # keep coverage at 80% or more
npm run build:e2e && npm run test:e2e              # static build below /numaliving.com.au, then Playwright
python3 -m unittest discover -s tools/cloudflare/tests    # the DNS helper's tests; no network
```

Nothing runs the Python tests automatically (CI only runs the npm checks), so run them when you touch `tools/`.

CI uses Playwright's own Chromium. Locally, set `CHROMIUM_EXECUTABLE_PATH` to any Chrome-family browser; the installed Google Chrome works:

```bash
CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:e2e
```

CloakBrowser's Chromium also works, but only while its single free licence seat is free (section 10).

## 4. Install the tools (macOS with Homebrew)

| Tool | Installed here (17 October 2026) | Install | Sign in and check |
| --- | --- | --- | --- |
| git | 2.56 | `brew install git` (or `xcode-select --install`) | `git --version` |
| gh | 2.102 | `brew install gh` | `gh auth login` (GitHub.com, scope `repo`), then `gh auth status` |
| Node and npm | Node 24, npm 11, through nvm | `brew install nvm`, then `nvm install 24` | `node -v` |
| Python and CloakBrowser | Python 3.14 and cloakbrowser 0.5.11, installed into Homebrew's `python3.14` itself, so `python3.14 tools/site-qa/...` works here | On a fresh machine use a virtual environment: `brew install python@3.14`, then `python3.14 -m venv tools/site-qa/.venv && tools/site-qa/.venv/bin/pip install -r tools/site-qa/requirements.txt && tools/site-qa/.venv/bin/cloakbrowser install`, and run the tools with `tools/site-qa/.venv/bin/python` wherever this runbook says `python3.14` | `cloakbrowser info` |
| cf (Cloudflare CLI, beta) | 1.0.0-beta.17, not signed in | `npm install --global cf` | `cf auth login`, then `cf auth whoami` |
| Google Chrome (local E2E) | installed | `brew install --cask google-chrome` | none |
| curl, dig, openssl | built in | none | none |

On Windows or Linux, the same tools come from `winget install GitHub.cli`, `apt install gh` (see cli.github.com/packages), and the vendors' installers.

## 5. When a tool is missing

| Missing | Do this instead |
| --- | --- |
| `gh` | Install it (section 4). Without it, `git push` to `main` still deploys. In the browser: Settings > Secrets and variables > Actions > Variables for `FORMSUBMIT_ID`; Actions > Deploy to GitHub Pages > Run workflow to redeploy; Settings > Pages for the domain and HTTPS. Or call the REST API with `curl` and a fine-grained token, for example `printf 'Authorization: Bearer %s\n' "$GITHUB_TOKEN" | curl -X PUT -H @- https://api.github.com/repos/pranay-ai360/numaliving.com.au/pages -d '{"cname":"numaliving.us"}'` (the header is read from stdin, so the token stays out of the process list). |
| `git` | GitHub's web editor (press `.` on the repository page) commits to a branch and opens a pull request. Tower and GitHub Desktop work too. |
| Node and npm | Skip the local checks: open the pull request and let the `verify` job run lint, types, tests and E2E. |
| `cf` | Use `tools/cloudflare/cf_dns.py`, or the Cloudflare dashboard (DNS > Records), or `curl` against `https://api.cloudflare.com/client/v4/` with the scoped token (pass the header the same way, from stdin). |
| CloakBrowser, or its seat is taken | Check with `curl`, `dig` and `openssl` (section 9) and the Playwright suite, then click through the live site by hand. Do not close another project's browser without asking. |
| Everything (for example on a phone) | github.com in a browser: press `.` to edit and commit to a branch, open the pull request, watch the Checks tab and merge. GitHub's runners do the install, tests, build and deploy. |

## 6. Change the contact email or where Quote Requests go

1. Edit `email` in `src/config/site.ts` and update its pin in `src/config/site.test.ts`. Nothing else holds the address: the footer, Contact page, Thank You panel, `mailto:` links and error messages all read it.
2. Make sure the mailbox exists and receives mail (a Forward Email alias for `numaliving.us`).
3. Activate it with FormSubmit: README, Going live, step 2 (the `curl` uses `Referer: https://numaliving.us/`). Click the link in FormSubmit's email, then copy the random alias it sends.
4. `gh variable set FORMSUBMIT_ID --body "<alias>" --repo pranay-ai360/numaliving.com.au`. Never the address itself: the deploy refuses a value with an `@`, and refuses `e2e-form-id`.
5. Deploy: merge the pull request, or `gh workflow run deploy.yml --ref main` when only the variable changed (the alias is fixed into the site at build time).
6. Send one Quote Request from https://numaliving.us/contact/ and check the inbox and the spam folder. README, Going live, steps 7 and 8, list what to look for.

Replies "from" `projects@numaliving.us` must go through Forward Email's SMTP. DMARC is `p=reject` and SPF allows only Forward Email, so Gmail's "send as" without it is rejected.

Because `projects@numaliving.us` is also the public contact email, the FormSubmit alias hides nothing: anyone can post to FormSubmit with the address itself. If the form is abused, activate a separate unpublished mailbox for FormSubmit (for example `quotes-<random>@numaliving.us`, forwarding to the same inbox) and switch `FORMSUBMIT_ID` to its alias, or add the Turnstile relay (README, Security notes).

## 7. Domain, DNS and HTTPS

The reasons are in [`docs/adr/0002-custom-domain-numaliving-us.md`](adr/0002-custom-domain-numaliving-us.md). Every site record stays "DNS only" (grey cloud).

```bash
# what GitHub thinks (the health call sometimes answers with empty fields: ask again)
gh api repos/pranay-ai360/numaliving.com.au/pages --jq '{cname, html_url, https_enforced, certificate: .https_certificate.state}'
gh api repos/pranay-ai360/numaliving.com.au/pages/health --jq '.domain | {is_valid, is_pointed_to_github_pages_ip, is_proxied, is_https_eligible, https_error}'
# what DNS says
dig @1.1.1.1 numaliving.us A +short                # the four GitHub addresses
dig @1.1.1.1 www.numaliving.us CNAME +short        # pranay-ai360.github.io.
python3 -I tools/cloudflare/cf_dns.py check        # records in the Cloudflare zone, and what would change
```

If the certificate does not start about 30 minutes after the DNS is right, GitHub's DNS check has kept an old "no records" answer. Clear the domain and set it again, then switch on HTTPS once the certificate says `approved`. While the domain is cleared another GitHub account could claim it, so verify the domain with GitHub first (profile Settings > Pages > Add a domain, then the `_github-pages-challenge-pranay-ai360` TXT record in Cloudflare) and run the two commands back to back:

```bash
echo '{"cname":null}' | gh api -X PUT repos/pranay-ai360/numaliving.com.au/pages --input - \
  && gh api -X PUT repos/pranay-ai360/numaliving.com.au/pages -f cname=numaliving.us
gh api -X PUT repos/pranay-ai360/numaliving.com.au/pages -F https_enforced=true
```

Roll back the domain with the first command alone (`cname: null`), then redeploy so the build uses the base path again. **Never run `gh api -X DELETE .../pages`**: it deletes the whole Pages site.

## 8. Secrets

- Cloudflare credentials live in a keys file: `api-keys.json` at the repository root, or better a file outside the repository (set `NUMA_KEYS_FILE`; see `tools/cloudflare/README.md`). Start from `tools/cloudflare/api-keys.example.json` and run `chmod 600` on it. Use a scoped token (Zone > DNS > Edit and Zone > Zone > Read on `numaliving.us` only, with an expiry) in `zone-api-key`. The helper does not use a Global API Key: delete any from the file and roll it in the dashboard.
- Never commit, paste, print or send the file. `.gitignore` covers `api-keys*` at any depth, and `.claude/settings.json` blocks the obvious ways for Claude Code to read it (the Read and Edit tools, and any shell command that names it). That is a speed bump, not a boundary: a shell command that does not name the file can still open it, so the safest home for the file is outside the repository. The helper reads it locally and prints no values.
- If a key leaks, delete or roll it in the Cloudflare dashboard (My Profile > API Tokens) and make a new one.
- Every `NEXT_PUBLIC_` value, the FormSubmit alias included, is public by design.

## 9. After a deploy

```bash
curl -sI http://numaliving.us/ | grep -iE '^(HTTP|location)'          # 301 to https://numaliving.us/
curl -sI https://www.numaliving.us/ | grep -iE '^(HTTP|location)'     # 301 to https://numaliving.us/
curl -s https://numaliving.us/contact/ | grep -oE 'projects@numaliving\.[a-z]+' | sort | uniq -c   # only .us
curl -s https://numaliving.us/ | grep -o '<meta name="robots"[^>]*>'  # noindex, nofollow
echo | openssl s_client -connect numaliving.us:443 -servername numaliving.us 2>/dev/null | openssl x509 -noout -issuer -subject -dates
# every page at four screen widths (needs the one free CloakBrowser seat)
python3.14 tools/site-qa/site_check.py --base-url https://numaliving.us/ \
  --out-dir "${TMPDIR:-/tmp}/numa-live-check" --expect-https --expect-noindex
```

The verdict is at the top of `report.md` in that folder. The "request-aborted" warnings are the browser cancelling prefetches and are harmless.

## 10. Known quirks

- **One CloakBrowser session at a time.** The free licence has one seat; `cloakbrowser info` shows `Sessions: 0/1` when it is free. A browser launch that exits with code 76 means another process holds the seat: look with `pgrep -fl 'Chromium.app/Contents/MacOS/Chromium'` (a plain `grep chromium` also matches unrelated processes). Find out whose it is before closing it.
- **Tower stashes for you.** Switching branches in Tower auto-stashes uncommitted work. Look at `git stash list` if something seems to have vanished.
- **A lint warning after the coverage run.** `npm run lint` right after `npm run test:coverage` warns about the generated `coverage/block-navigation.js`. CI is not affected.
- **FormSubmit** is a free third party with no service guarantee. Send a test Quote Request now and then.
- **Placeholders remain** for the phone number, WhatsApp number, address and the sample projects, so the site stays `noindex` with its Preview ribbon (`src/config/launchGuard.test.ts` enforces this).
