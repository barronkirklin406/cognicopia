# The n8n workflow: support triage and invoice follow-ups

`n8n-cognicopia-operations.json` is a workflow you import into your own n8n. **It is the owner's private file and is not in this repository**: the repository is public and its pages are published, so the file was handed to the owner directly. Keep it somewhere private (not in the website folder), and keep a backup. If a copy is lost, ask for a new one. It helps with two chores and **sends nothing to anyone but you until you choose the Send button in an approval email.** `node scripts/check-n8n-workflow.mjs` (in `npm test` and `npm run build`) proves the file's shape, that every customer send is behind an approval, and that no secret is in it.

## What it does not touch

- **Payments and license keys.** `license-service/` already takes Stripe's payment call, signs the key and emails it (see [license-service.md](license-service.md)). This workflow does none of that: it has no Stripe call, no signing key and no license code.
- **Resident information.** None belongs in any email, and the workflow tells senders not to send any.

## Flow 1: a support email arrives

1. A new email in your support mailbox starts it.
2. Gemini 2.5 Flash drafts a short reply using only the approved facts written into the workflow (resident data stays on the facility's computer, the Terms page's wording, offline printing, the free packets, how paying works). It never quotes a price and never says "HIPAA compliant".
3. An automatic check flags a draft that claims HIPAA compliance or FDA approval, promises something, mentions a refund or discount, quotes a price or makes a medical claim, and flags a message that seems to hold resident information.
4. **You get an approval email** showing their message and the drafted reply, with two buttons: send it, or do not. Only "send it" emails the customer. If you would rather answer in your own words, choose not to send, and reply yourself.

**Know where the text goes.** The sender's question is sent to Google's Gemini service to be answered. Check Google AI Studio's current free-tier terms about how it may use what is sent, and do not use this flow if that is not acceptable for your support mailbox.

## Flow 2: Net-30 invoice follow-ups

1. After a facility sends you its invoice request PDF, open the workflow's form and paste in what is on it: facility, accounts payable email, contact name, the reference (like `CGR-20261021-1234`), the invoice date, the PO number and the amount.
2. The workflow waits and drafts three reminders: **Day 15** (friendly), **Day 25** (due in five days) and **Day 30** (due today), each at about 9 in the morning North Dakota time.
3. Each draft is emailed to you first. **If the invoice is already paid, choose not to send.** The reminders never print bank details: they say the details came with the final invoice.

The website sends nothing to n8n by design (the invoice form makes its PDF inside the browser), which is why you paste the details in yourself.

## Setting it up (one step at a time)

These steps come from n8n's and the providers' documentation, not from your screens, and the screens differ between versions. Do one step, and tell me what you see before the next if anything does not match.

1. **Import the file** into your n8n (n8n's menu for workflows has an import-from-file choice).
2. **Add three credentials**, then pick each on the node that names it. Their values live only in n8n, never in this repository:
   - *Cognicopia support mailbox (IMAP)*: your support mailbox's IMAP address, user and password or app password. Some providers refuse plain IMAP passwords; if yours does, tell me and I will change the start of Flow 1 to a webhook fed by a forwarding rule.
   - *Google AI Studio key (header x-goog-api-key)*: a Header Auth credential, header name `x-goog-api-key`, value your Google AI Studio key.
   - *Resend SMTP*: Resend offers SMTP with host `smtp.resend.com`, user `resend` and your Resend API key as the password (the same provider `license-service/` uses). Check Resend's documentation for the current port and security setting. Your sending address must be one Resend allows.
3. **Change the owner address** if it should not be `cognicopia@outlook.com`: it is written in the two Code nodes that prepare the emails and in the four Send Email nodes.
4. **Try it** with a made-up email from your own address (the workflow ignores mail from the owner address, so use another one) and a made-up invoice with a date well in the future. Read the approval emails. Choose "Do not send" on the first tries.
5. **Turn it on** only when you are happy. The file is saved turned off.

If the Send Email node does not show a "Send and Wait" choice, your n8n is too old: update it. If you would rather use Groq than Gemini, the two nodes to change are "Prepare the question" (the request shape) and "Ask Gemini" (the address and key); say so and I will do it.
