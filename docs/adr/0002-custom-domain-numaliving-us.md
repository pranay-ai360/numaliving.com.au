# Serve the site at numaliving.us, with GitHub-issued HTTPS and Cloudflare DNS

The site was first published at `https://pranay-ai360.github.io/numaliving.com.au/`. On 16 October 2026 it moved to its own domain, `https://numaliving.us/`. GitHub Pages still serves the site and issues its certificate (Let's Encrypt, free, renewed automatically); the domain's DNS is on Cloudflare with every record set to "DNS only"; mail is handled by Forward Email. The bare domain is the main address, and `www.numaliving.us` and the old GitHub Pages address redirect to it.

## Considered options

- **Proxy the site through Cloudflare (orange cloud) with SSL mode Full (strict).** Would add a CDN, a firewall and an HSTS switch. Rejected for now: GitHub's own DNS check reads a proxied domain as "proxied" and can fail to issue or renew its certificate, and a small static site gains little from it. If it is ever turned on, use Full (strict), never Flexible (it loops with Enforce HTTPS).
- **`www.numaliving.us` as the main address.** GitHub redirects either name to the other when both records exist. The bare domain won, because it is what people type and what the contact email uses.
- **Stay on the GitHub Pages project address.** It forced a base path ending in `.au`, which made every Home link cost a redirect, and it is not a name Numa can put on a business card.
- **DNS at the registrar (GoDaddy).** Works, but Cloudflare gives free DNS, scoped API tokens and easy automation (`tools/cloudflare/`).

## Consequences

- **DNS records for the site** (all "DNS only"): four `A` records (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) and four `AAAA` records (`2606:50c0:8000::153` to `2606:50c0:8003::153`) on the bare domain, and a `CNAME` for `www` pointing to `pranay-ai360.github.io`. Never add a wildcard (`*`) record: GitHub warns it allows takeovers. The Forward Email records (MX, SPF, DKIM, DMARC and three `CNAME`s) share the zone and are managed separately.
- **The custom domain is set on the repository** (Settings > Pages, or `gh api -X PUT repos/pranay-ai360/numaliving.com.au/pages -f cname=numaliving.us`). No `CNAME` file is needed for a site published by GitHub Actions.
- **The deploy builds for the domain root.** `actions/configure-pages` reports an empty base path once a custom domain is set, so no code changed. A build made before the domain was set has `/numaliving.com.au` baked in and must be redeployed (`gh workflow run deploy.yml --ref main`).
- **HTTPS.** Enforce HTTPS is switched on with `gh api -X PUT repos/pranay-ai360/numaliving.com.au/pages -F https_enforced=true` once `https_certificate.state` is `approved`. GitHub sends no `Strict-Transport-Security` header on a custom domain, so the 301 from `http` to `https` is the protection.
- **A stalled certificate.** GitHub's DNS check can keep a "no records" answer for up to 30 minutes (Cloudflare's SOA minimum is 1800 seconds). The first attempt stalled this way; clearing the domain and setting it again started the certificate within seconds (`docs/RUNBOOK.md` has the commands). Never use `gh api -X DELETE .../pages`: it deletes the whole Pages site.
- **Mail.** DMARC is `p=reject` and SPF allows only Forward Email, so mail sent from an `@numaliving.us` address must go through Forward Email's SMTP. Sending as that address from another service is rejected by recipients.
- **Still to do.** Verify the domain with GitHub (profile Settings > Pages > Add a domain, then the `_github-pages-challenge-pranay-ai360` TXT record) so no other GitHub Pages site can claim it. The site stays `noindex` until the launch guard passes (`src/config/launchGuard.test.ts`).
