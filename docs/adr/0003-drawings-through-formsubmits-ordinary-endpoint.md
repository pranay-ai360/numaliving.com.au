# Send Drawings through FormSubmit's ordinary endpoint and read its answer

FormSubmit documents file attachments only for ordinary form posts. On 18 October 2026 a live Quote Request with a PDF, sent to its AJAX endpoint (`https://formsubmit.co/ajax/<alias>`), was answered with success and emailed to Numa **without the PDF**: the "Expect 1 PDF attached" line in the email table showed the loss. The same fields posted as `multipart/form-data` to the ordinary endpoint (`https://formsubmit.co/<alias>`) arrived with the PDF. That endpoint answers with a web page, and the answer carries `access-control-allow-origin: *`, so a script on numaliving.us can read it (checked from the live site's origin).

A request with at least one PDF is therefore posted to the ordinary endpoint, and `judgePageReply` (`src/lib/quotes/reply.ts`) reads the page that comes back. A request without PDFs keeps using the AJAX endpoint and its JSON answer. The visitor stays on the page in both cases.

## Considered options

- **A redirect flow** (the original plan B in the README): a hidden form with `_next` pointing to a new `/contact/thanks/` page. It gives a reliable success signal, because FormSubmit only redirects after it accepts the request. Rejected: the visitor leaves the page and loses the form on any failure, FormSubmit's own error pages would be the only feedback, the files would have to be put back into a form through `DataTransfer`, and it needs a new page.
- **`fetch` with `mode: "no-cors"`.** The answer is unreadable, so every refusal would look like a thank-you and an enquiry could be lost. Rejected.
- **Drop the file picker and ask visitors to email their drawings.** Safe, but it gives up the owner's choice that small PDF drawings are emailed with the enquiry.
- **A relay** (Cloudflare Worker with Turnstile). Still the upgrade path if FormSubmit attracts spam or changes its pages (ADR 0001).

## Consequences

- **The success check is strict and undocumented.** Only a page whose first heading is "Thanks!" and whose first following paragraph starts "The form was submitted successfully" counts as sent (seen on 18 October 2026). The page is parsed with `DOMParser`, never inserted or run, text inside scripts, comments, templates, textareas and `noscript` does not count, and anything over 256 KB is ignored. A page that mentions activation is reported as not activated even if it also says thanks.
- **A reworded page is a soft failure.** Any other page is reported as `invalid-response` ("We could not confirm that your request was received. Please email us"), never as sent and never as refused, so the visitor is asked to email rather than to send the PDFs again. After any change on FormSubmit's side, send a test with a PDF (README, Going live, step 7).
- **The form depends on FormSubmit's CORS header.** If it stopped sending `access-control-allow-origin` on the ordinary endpoint, the mail could still be delivered while the visitor is told `network`. The redirect flow above is then the fallback.
- **Limits are unchanged:** up to 10 PDFs and 9 MB in total (FormSubmit's limit is 10 MB). The files go in as `attachment`, `attachment2`, and so on.
- **Verified live on 18 October 2026** through the form on numaliving.us: three PDFs, a Google Drive link and HTML typed into the notes arrived as reference NL-YBT2KW with all three PDFs attached and openable, the table complete, and the HTML shown as plain text (not bold, not a live link). Earlier posts to this endpoint with one PDF and with three PDFs sent with `curl` had arrived too.
- **FormSubmit silently drops some posts with attachments.** A post with attachments that mentions `example.com` gets the "Thanks!" page and no email (six test posts that day, three of them through the form), while posts without attachments, and posts with attachments and other URLs, arrive. The cause is on FormSubmit's side, and the form cannot see it, because the success page is the same. Other triggers may exist. The thank-you panel therefore tells the visitor to email the reference if no reply comes within two working days, and the README says to keep `example.com` out of test data.
- Redirects are not blocked in advance: a redirected answer is refused after the fact (`isRedirected`), as it is on the AJAX path. FormSubmit is already trusted with the whole request.
