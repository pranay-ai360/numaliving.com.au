# Cloudflare DNS helper

`cf_dns.py` keeps the DNS records that point numaliving.us at GitHub Pages: four `A` and four `AAAA` records on the bare domain and a `CNAME` for `www`, all "DNS only". It needs nothing installed beyond Python 3.9 or newer (standard library only).

It touches only those two names and three record types. **`apply` deletes any other `A`, `AAAA` or `CNAME` record on the bare domain and on `www`** (for example a registrar's parking record). Mail records (Forward Email), verification TXT records and every other name in the zone are left alone. The one exception is `github-challenge`, which only ever adds a single TXT record (GitHub's domain-verification record) and never deletes or replaces anything. The reasons for the setup are in [`docs/adr/0002-custom-domain-numaliving-us.md`](../../docs/adr/0002-custom-domain-numaliving-us.md).

## Set up the credentials

1. In Cloudflare: My Profile > API Tokens > Create Token > "Edit zone DNS". Give it Zone > DNS > Edit and Zone > Zone > Read, limit Zone Resources to the `numaliving.us` zone, and set an expiry. Without Zone > Zone > Read the helper cannot confirm which zone it is talking to, and `apply` then refuses unless every record in the zone belongs to numaliving.us. Copy the token.
2. Make the keys file from the example and fill it in. The safest place is **outside** the repository, and it is the first place the helper looks after `NUMA_KEYS_FILE` and a copy in the repository root:

   ```bash
   mkdir -p ~/.config/numaliving
   cp tools/cloudflare/api-keys.example.json ~/.config/numaliving/api-keys.json
   chmod 600 ~/.config/numaliving/api-keys.json
   ```

   The helper picks the file in this order: the path in `NUMA_KEYS_FILE`, then `api-keys.json` in the repository root if it exists, then `~/.config/numaliving/api-keys.json`. Use `NUMA_KEYS_FILE` (or `--keys-file`) only for some other location. A copy in the repository root works too: it is git-ignored there, together with copies, backups and editor swap files named `api-keys*`, but a public repository is one `git add -f` away from a leak, so prefer the home folder. Never commit, paste, print or send the file.

   | Field | What goes in it |
   | --- | --- |
   | `zone-api-key` | The scoped token from step 1. |
   | `zone-id`, `account-id` | 32-character ids from the zone's Overview page in the Cloudflare dashboard. |

3. The helper does not use a Global API Key, because it cannot be limited to one zone and never expires. If the file has one, delete it and roll that key in the dashboard (My Profile > API Tokens > Global API Key); `check` reminds you.

## Use it

```bash
python3 -I tools/cloudflare/cf_dns.py check          # read-only: the zone, its records, and what would change
python3 -I tools/cloudflare/cf_dns.py apply --yes    # change the live zone to match
python3 -I tools/cloudflare/cf_dns.py github-challenge <code> --yes   # add GitHub's domain-verification TXT record
```

`apply` and `github-challenge` do nothing without `--yes`. To use another keys file, pass `--keys-file <path>` before the command (`cf_dns.py --keys-file <path> check`) or set `NUMA_KEYS_FILE`.

What it promises:

- It prints the shape of each credential (filled in or empty, length, kind) but never a value, and it reports failures by type only, because an error message could contain a credential.
- It refuses a `zone-id` that belongs to any other domain. When the token cannot read zone details it refuses unless the zone holds only numaliving.us records.
- It never follows a redirect, so the token cannot be forwarded to another host.
- It makes the changes in an order that keeps the domain answering (a blocking record first, then the new ones, then the stale ones). If a request fails half way it says so; run `check`, then `apply --yes` again to finish.

## Verify the domain with GitHub

Verifying numaliving.us stops any other GitHub Pages site from claiming it, above all while the domain is briefly cleared from this repository.

1. On GitHub open your profile Settings > Pages (your profile settings, not the repository's) > Add a domain, and enter `numaliving.us`. GitHub shows the TXT record's name (`_github-pages-challenge-pranay-ai360.numaliving.us`) and a code made of 20 to 64 lowercase hex characters.
2. Add the record with the code (the name is built by the helper, so only the code goes on the command line):

   ```bash
   python3 -I tools/cloudflare/cf_dns.py github-challenge <the-code> --yes
   ```

   It is safe to run twice: when the record is already there it changes nothing. If a record with a different value already sits on that name it stops and tells you to delete the old one in the dashboard, because it never deletes anything itself.
3. Press Verify on the same GitHub page (Cloudflare answers within seconds) and keep the TXT record afterwards.

## Tests

They never use the network or the real keys file:

```bash
python3 -m unittest discover -s tools/cloudflare/tests -v
```

## Without this helper

Add the records in the Cloudflare dashboard (DNS > Records), set to "DNS only", or use the official `cf` CLI (`npm install --global cf`, then `cf auth login` and `cf dns records ...`; it is still a beta). The record values are in the ADR.
