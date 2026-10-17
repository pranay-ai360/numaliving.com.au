# Cloudflare DNS helper

`cf_dns.py` keeps the DNS records that point numaliving.us at GitHub Pages: four `A` and four `AAAA` records on the bare domain and a `CNAME` for `www`, all "DNS only". It needs nothing installed beyond Python 3.9 or newer (standard library only).

It manages only those names and types. Mail records (Forward Email), verification TXT records and every other name in the zone are left alone. The reasons for the setup are in [`docs/adr/0002-custom-domain-numaliving-us.md`](../../docs/adr/0002-custom-domain-numaliving-us.md).

## Set up the credentials

1. In Cloudflare: My Profile > API Tokens > Create Token > "Edit zone DNS", limited to the `numaliving.us` zone only. Set an expiry. Copy the token.
2. Copy the example file to the repository root and fill it in. The real file is git-ignored; never commit it, paste it or send it anywhere.

   ```bash
   cp tools/cloudflare/api-keys.example.json api-keys.json
   ```

   | Field | What goes in it |
   | --- | --- |
   | `zone-api-key` | The scoped token from step 1 (used first). |
   | `zone-id`, `account-id` | From the zone's Overview page in the Cloudflare dashboard. |
   | `cloudflare-global-api-key`, `cloudflare-email` | Optional fallback only: a Global API Key must be sent with the account email. Prefer the scoped token. |

   Older copies of the file spell the global-key field `cloudlfare-global-api-key`; the helper accepts both spellings.

## Use it

```bash
python3 tools/cloudflare/cf_dns.py check          # read-only: the zone, its records, and what would change
python3 tools/cloudflare/cf_dns.py apply --yes    # make the zone match
```

`apply` does nothing without `--yes`. The helper prints the shape of each credential (filled in or empty, its length and kind) but never a value. It refuses a `zone-id` that belongs to any domain other than numaliving.us.

To keep the keys file somewhere else, pass `--keys-file <path>` or set `NUMA_KEYS_FILE`.

## Tests

They never use the network or the real keys file:

```bash
cd tools/cloudflare && python3 -m unittest discover -s tests -v
```

## Without this helper

Add the records in the Cloudflare dashboard (DNS > Records), set to "DNS only", or use the official `cf` CLI (`npm install --global cf`, then `cf auth login` and `cf dns records ...`; it is still a beta). The record values are in the ADR.
