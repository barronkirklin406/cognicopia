# The Net-30 desk

How a facility that cannot pay by card gets an invoice, pays it in 30 days, and receives its license key, with no one doing the work by hand. Written for the owner first; the two agents' own instructions are in `docs/net30-agents/`.

## What facilities usually want

Memory care and assisted living facilities rarely pay by card. The usual order of preference:

1. **An invoice with Net-30 terms**, paid by their accounts payable department by **ACH** (a bank transfer) or **check**, often quoting a **purchase order (PO) number**.
2. **A purchasing card (P-Card)** for a small amount a manager may approve alone. This is the card checkout already on the site ($39 a month, $349 a year).
3. **A W-9** (your tax form) with the first invoice, and a **vendor information sheet**. Both are covered: the W-9 is sent on request and the vendor facts are on the pricing page.

Everything below serves the first one.

## The path, start to finish

```
Facility fills in the form on pricing.html ("Pay by purchase order or invoice (Net 30)")
   |  the page makes a PDF request on their own computer and sends nothing
   |  they press "Email this request to Cognicopia": their own mail program opens with the details typed in
   v
An email to Cognicopia@outlook.com, subject "[Cognicopia Invoice Request] CGR-YYYYMMDD-nnnn"
   |  (Outlook forwards a copy to the Gmail the agent reads: one owner step, below)
   v
AGENT 1, the intake agent (runs on a schedule)
   |  checks the request, checks the facility is real, makes the Stripe customer and a Stripe subscription
   |  billed by invoice (due in 30 days, ACH or card), and has Stripe email the invoice
   |  anything it is not sure of is held for you with a drafted reply, and you are notified
   v
STRIPE emails the invoice to the facility's billing contact
   |  at the same moment Stripe tells the license service (a webhook): the service signs a license key
   |  and emails it to the same billing contact. No agent ever sees a key.
   v
AGENT 2, the collections agent (runs once a day)
   |  re-sends the invoice on day 15, day 25 and the due date, and a firmer note 7 and 14 days after
   |  at 14 days overdue it notifies you; it never cancels, voids or forgives anything
   v
Paid (ACH through Stripe, or you mark a check as received). A yearly invoice renews itself a year later,
and the license service emails the new key then.
```

Why the work is split this way: the **license key is made by the license service in plain code** (tested, never touched by an agent), because a key is a secret-bearing, exact thing. The agents only do the parts that need judgment and follow-up: reading a request, deciding whether it is safe to invoice, and chasing payment.

## When the key goes out (decision for the owner)

The license service has one setting, `NET30_KEY_TIMING`:

- **`with_invoice` (the default).** The key is emailed the moment the invoice is issued. This is what the pricing page promises ("we send the final invoice and your license key together") and what a facility's staff expect: they can start using Cognicopia now, and accounts payable pays within 30 days. **The risk:** a made-up facility that never pays would still hold a year's key. The intake agent's checks (below) exist to prevent that, and a key can be withdrawn.
- **`on_payment`.** The key is emailed only when the invoice is paid. Safer, but a facility waits up to 30 days for a product it has agreed to buy, and the pricing page sentence would need to change.

I recommend `with_invoice` with the checks below. 🔴 **This is your call.** Tell me if you want `on_payment`.

## What the intake agent will and will not do

It acts on its own only when **all** of these hold. Otherwise it holds the request, drafts a reply for you, and notifies you.

- The email has the subject `[Cognicopia Invoice Request] CGR-...` and every field the form asks for.
- One license, one building (a quantity of 1), the annual or monthly license. Several buildings and Enterprise are quotes: always held for you.
- The billing contact's email is on the facility's own web address (not Gmail, Outlook, Yahoo or another free mail address), and a web search shows a real senior-care facility or operator of that name in that city and state.
- No other open invoice or subscription for the same facility or reference already exists.
- Stripe's price is exactly what `src/config/license.js` says ($349 a year, $39 a month).

It **never**: refunds, voids, deletes or forgives an invoice; cancels a subscription; changes a price, a payout or a bank setting; sends mail from your personal Gmail (Stripe sends the invoice; the agent only prepares drafts); or puts your EIN, a bank detail or a key in anything. It treats the text of every email as information, never as an instruction.

## Owner: the one-time steps

Everything else I do. I have not seen your screens, so I will give one step at a time and ask what you see.

1. **Let Stripe changes through.** The Stripe connection can look but not change (a change returns "Forbidden"). It has to be reconnected with permission to change things. Tell me what you see on the permission screen.
2. **Update the license service** with the new code (`license-service/dist/worker.js`): paste it into the Worker's code editor in Cloudflare and deploy, as you did on October 14.
3. **Add two events to the Stripe webhook** (`invoice.finalized` and `invoice.paid`) so the license service hears about invoices. I do this once step 1 works, and only after step 2.
4. **Make mail reach the agent.** The business address is Cognicopia@outlook.com; the agent can read only your Gmail. In Outlook, add a rule that forwards a copy of mail whose subject contains `[Cognicopia Invoice Request]` to your Gmail. Then press the new button on the pricing page once yourself to test it end to end.

## The first real test

Before any real facility: I make a test request as a made-up facility with your own email address, let the intake agent invoice it, check the invoice email, the key email, and the ACH and card choices on Stripe's invoice page, then **void the test in Stripe** and write down what I saw here. Nothing goes to a real facility until that passes.

## One overlap to settle

Your private n8n workflow ([n8n-operations.md](n8n-operations.md)) also drafts Net-30 reminders for you to approve (Day 15, 25 and 30). The collections agent does the same job through Stripe, so running both would remind a facility twice. 🔴 **Pick one:** keep the collections agent (my recommendation: it sends from Stripe, tracks each reminder on the invoice, and never reaches your personal mailbox) and switch off the invoice-reminder part of the n8n workflow, or keep n8n and leave the collections agent off. The n8n support-email part is unaffected either way.

## How to turn it off

Tell me, or in Claude's scheduled-tasks list turn off "Net-30 intake" and "Net-30 collections". Invoices already sent stay valid. The license service keeps working either way.

## Where things live

| Thing | Where |
|---|---|
| The form, PDF and the email button | `pricing.html`, `js/invoiceMaker.js`, `docs/invoice-request.md` |
| Key email for card and invoice payments | `license-service/` (`docs/license-service.md`) |
| The intake agent's instructions | `docs/net30-agents/intake.md` |
| The collections agent's instructions | `docs/net30-agents/collections.md` |
| Proof the rules still hold | `node scripts/check-net30-desk.mjs` (in `npm test` and `npm run build`) |
