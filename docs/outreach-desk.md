# The outreach desk

The tools behind [marketing-strategy.md](marketing-strategy.md). Nothing here sends an email and nothing here touches the internet: it prepares each day's batch for a sending tool and keeps the record of who was written to and who must never be written to again.

## What is in the folder

| File | What it is |
|---|---|
| `outreach/sequences.json` | The four notes (each with two subject lines), the footer and the opt-out line. Plain text. |
| `outreach/replies.json` | The pre-approved answers: a sample, the price, privacy and IT questions, an invoice. |
| `outreach/config.sample.json` | The settings to fill in: the name notes are signed with, the town they say you are from (`sender_place`), the postal address, the sending addresses, the start date. |
| `outreach/leads.sample.csv` | Three made-up contacts, to show the columns. |
| `outreach/data/` | **Your real list, settings and send record. Never committed**: this repository is public. `node scripts/outreach.mjs init` makes it. |
| `scripts/lib/outreach.mjs`, `scripts/outreach.mjs` | The engine and its commands. |
| `scripts/check-outreach.mjs` | Proves the notes are compliant and the engine keeps its rules (in `npm test` and `npm run build`). |
| `.claude/agents/outreach.md` | The reply helper. |

## The commands

```
node scripts/outreach.mjs init                          make outreach/data/ with a settings file to fill in
node scripts/outreach.mjs import leads.csv              add contacts: every row checked, every refusal explained
node scripts/outreach.mjs plan [--date 2026-11-03]      today's batch -> outreach/data/batch-DATE.csv and .json (a preview)
node scripts/outreach.mjs plan --record                 the same, and write it down as sent
node scripts/outreach.mjs sent outreach/data/batch-DATE.json   write a batch down as sent
node scripts/outreach.mjs event someone@x.org replied   replied | unsubscribed | bounced | complaint | customer
node scripts/outreach.mjs events export.csv             a sending tool's export, with email and event columns
node scripts/outreach.mjs suppress @example.org         never write to this address or this whole community again
node scripts/outreach.mjs copy                          the four notes as text with merge tags, to paste into a sending tool
node scripts/outreach.mjs report                        where things stand, and a warning if bounces or complaints are too high
```

## Two ways to use it

1. **With a cold-email tool (recommended).** The tool sends, warms the mailboxes and handles replies. The desk does the parts the tool does not: `import` cleans and checks the list (and refuses personal mailboxes and contacts with no public source); `copy` gives the four notes to paste in; the tool's export of replies, bounces and opt-outs goes back through `events`, so the do-not-contact list stays complete in one place.
2. **By hand (free).** `plan` writes the day's messages (who, from which sending address, the finished subject and body) as a file for a tool, and also as `batch-DATE.html`: open it in a browser for a copy button per subject and message and a link that opens a new, addressed email. Set the warm-up in `outreach/data/config.json` to one step of 10 (`"warmup": [{"week": 1, "perMailbox": 10}]`) and use the business address as the only mailbox, so it can never plan more than 10 a day. After sending, `node scripts/outreach.mjs sent outreach/data/batch-DATE.json` writes it down.

## The rules the engine keeps

- It **refuses to plan anything** until the postal address, the signing name, a real sending address, the start date and the reply address are filled in.
- **A slow ramp-up** by week and by number of sending addresses (10 a day each in week one, up to 40), and **workdays only** (Monday to Thursday).
- **Follow-ups first**, in the order they became due, then people who have not heard from us. The second note waits four days after the first, the third seven days after the second, the fourth ten days after the third.
- **One contact per community per day.** When one person at a community replies, opts out, complains or buys, the rest of that community is left alone.
- **Nobody is written to after** asking to stop, bouncing, complaining, replying or becoming a customer, and an opted-out address can never be imported again.
- **A lead is a business contact.** There is no column for a resident, and no resident information is accepted or stored.

## The reply helper

`.claude/agents/outreach.md` reads replies and sorts them. Four kinds get a pre-approved answer from `outreach/replies.json` (the sample, the price, privacy and IT questions, an invoice or purchase order); a stop request removes the person at once and sends nothing; everything else, including anyone annoyed or unsure, is drafted for the owner and waits. It reads from the Gmail that Outlook forwards to (the forwarding rule on the Net-30 list), and when someone wants an invoice it hands off to the Net-30 desk.

The scheduled version of the helper is not turned on yet. It needs the forwarding rule and the owner's go-ahead to answer on their behalf.

## What this does not do

It does not send mail, warm a new mailbox, set the SPF, DKIM and DMARC records, or find addresses. Those belong to the sending tool and to a person with a list; they are laid out in the strategy.

## What is public and what is private

Everything in this repository is readable on the web, including these guides and the four notes. That is fine: they hold no contact, key or secret. The real list, the settings (with the postal address) and the send record live in `outreach/data/`, which git ignores, so they stay on the owner's computer.

