# How Cognicopia reaches Activity Directors

Written for the owner. No jargon: where a term is needed, it is explained in the same sentence. The tools that back this up are described in [outreach-desk.md](outreach-desk.md); the people and pages it connects to are the ones already built (the pilot page, the sample packet, pricing, the Net-30 desk, the license service).

## The idea in one paragraph

An Activity Director is busy, is usually looking for something suitable for residents with memory loss, and has been burned by tools that feel like sales. So we do not sell. We write four short, plain notes over three weeks, in a person's voice, that do one thing each: say what Cognicopia is, show a sample, offer a small low-risk way to try it, and say goodbye politely. Anyone who answers gets an answer. Anyone who says "no thanks" is removed that minute and never written to again. The product does the selling: 25 free packets, no card and no sign-up, so the first experience is a packet in the person's hands.

## Who to write to, in this order

1. **Activity Directors** (also called Life Enrichment Directors or Memory Care Coordinators). They feel the problem every day and they choose the tools they use.
2. **Executive Directors**, only after an Activity Director shows interest or when a community has no listed activity contact. They sign off on spending.
3. Corporate and purchasing people only for a chain, and only after a conversation. That is a separate, slower track (see the Enterprise quote on the pricing page).

## The path a person takes

```
a public list of communities  ->  four plain notes over 21 days  ->  they reply, or open the sample packet
      ->  they try the 25 free packets  ->  the free packets run out and a window offers a license
      ->  they pay by card (the key arrives by email at once)   or   ask for an invoice (Net-30 desk: the invoice and key follow)
      ->  they are a customer and are never sent the introduction again
```

## What is automated, and what is not yet

| Step | State | What it needs from you |
|---|---|---|
| Finding communities and checking each address | Built (`node scripts/outreach.mjs import`): refuses personal mailboxes and anything with no public source, skips repeats and anyone who opted out | The list itself (see "Where the list comes from") |
| The four notes, with the right footer, the sample link and the pilot link | Written and checked by the build | You read them once and say yes |
| Deciding who gets which note each day, slowly at first | Built: a daily plan with a ramp-up, workdays only, follow-ups first | A real postal address and a sending setup (below) |
| Actually sending the emails | **Not built here, on purpose.** A proper sending tool does it (below) | You open the accounts; I guide each step |
| Reading replies and answering the common ones | Written down (`.claude/agents/outreach.md`); sample, price, privacy and invoice questions get pre-approved answers, everything else waits for you | The one-time Outlook forwarding rule already on the Net-30 list |
| Stopping at "no thanks", bounces and complaints | Built: remembered forever, checked before every batch | Nothing |
| Taking payment and sending the license key | Built and tested in code (card path: Stripe, then the license service, then the key emailed; invoice path: the Net-30 desk) | Your live end-to-end test with a real card, and the Stripe and license-service steps already listed in [net30-desk.md](net30-desk.md) |

## Why not send from Outlook or Gmail directly

Personal and ordinary business mailboxes are made for conversations, not for hundreds of cold messages. Send that many from Cognicopia@outlook.com and the address that customers write to, and that the license key comes from, can be blocked. The key rule: **never send the cold notes from the address customers use.** Use a separate sending address on a second web address, and keep Cognicopia@outlook.com for replies and customers.

The setup that protects you, in plain terms:

- **A second web address** for sending only (for example one that sounds like the company's own, but not the main one), so if its reputation ever suffers, cognicopia.org and the license emails are untouched.
- **Two or three sending mailboxes** on it, so no single address sends too much.
- **A cold-email tool** to do the sending, the slow warm-up, the "stop if they reply" and the unsubscribe handling. There are several well-known ones; features and prices change often, so I will compare the current options with you before you pay for anything.
- **Three technical records** on that web address (called SPF, DKIM and DMARC: they prove the mail really comes from you). Gmail, Yahoo and Outlook now expect them from anyone sending in volume.
- **Replies go to Cognicopia@outlook.com** (set as the reply address), so you and the helper see every answer in one place.

I will not name any button or screen until you tell me what you see, one step at a time.

## The rules we follow (the law and common courtesy)

The U.S. rule for commercial email is the CAN-SPAM Act. In plain words, every note must:

1. Say truthfully who it is from, with a truthful subject line.
2. Include a real **mailing address** (a P.O. box or a mailbox rental is fine).
3. Say clearly that it is an advertisement.
4. Make it easy to opt out, and the opt-out must be honored quickly (ours is a one-line reply, honored at once and forever).

The build fails if any note is missing the address, the advertisement line or the opt-out, so that cannot slip. In addition we hold ourselves to:

- **Business contacts only**, at the community's own address, from a public page. Every contact on the list records the page it was found on. No personal mailboxes, nothing bought from a stranger, no addresses taken from places that forbid it.
- **No resident information, ever.** A contact is a business contact and the community it belongs to. There is no column for a resident, and the real list is never committed to the public repository.
- **Four notes at most**, then silence. One contact per community per day, and if anyone at a community replies or opts out, the rest of that community is left alone.
- **Only true claims.** The notes make no claim the site does not make: no claim that the product meets a privacy law by itself (we say that no resident data leaves the device, and that it supports a community's own privacy practices), no hours saved, no percentages, no survey-result promises. The older sales playbook in this folder has lines like that; they are not used here, and the build would catch them.

## The ramp-up (why we start small)

A new sending address has no reputation. If it suddenly sends thousands of messages, mail providers treat it as spam. So the plan sends a few a day and grows:

| Week | Per sending mailbox | With 2 mailboxes | With 3 |
|---|---|---|---|
| 1 | 10 a day | 20 | 30 |
| 2 | 20 | 40 | 60 |
| 3 | 30 | 60 | 90 |
| 4 on | 40 | 80 | 120 |

Notes go out Monday to Thursday only. With three mailboxes, about 1,000 communities would receive their first note in roughly the first four weeks and all four notes within about seven. That is on purpose: slow and steady is what reaches the inbox. The warm-up numbers are conservative starting points, not measurements; the first 200 sends tell us what to change.

## The numbers to watch (and the two that mean stop)

- **Replies**, and what kind: interested, asking a question, or "no thanks". This is the number that matters.
- **Trials started**: how many open the tool and make packets. (The tool counts these on the person's own computer, so we only know about them if they tell us or buy.)
- **Licenses bought.**
- **Stop signs:** bounces above 3% of what was sent (the list needs cleaning), or spam complaints above 0.1% (we are reaching the wrong people or the notes are wrong). The desk's `report` command prints a warning for both. If either appears, stop sending and fix it before anything else.

I will not predict how many replies or sales to expect: Cognicopia has no sending history to measure from, and a guess would be a made-up number. After the first 200 sends the report gives real figures, and we adjust the notes with them.

## Where the list comes from

- **Public directories:** the federal Care Compare list of nursing homes and each state's licensing list of assisted living and memory care communities give names, cities and phone numbers.
- **The community's own website**, which usually lists an activities or life enrichment contact. Role addresses such as activities@ are fine and often best.
- **Industry association member lists**, where their rules allow it.
- Save each contact with the page it came from (the import requires it). Skip anyone whose only address is personal.

Collecting addresses by hand from websites is slow; a data service that sells verified business contacts is faster. If you use one, read its terms and use only business addresses. I can help set up the list file either way.

## A realistic first 30 days

- **Days 1 to 3:** you confirm the four notes, give a mailing address and choose a name to sign them with.
- **Days 3 to 10:** we open the sending accounts together, set the three technical records, and let the tool warm the new mailboxes quietly for about two weeks before real sending.
- **Days 10 to 14:** build the first list of about 300 communities from public sources; run the import; read the rejected list.
- **Day 14 onward:** the first sends at the week-1 pace; every morning the helper reads the replies and answers the four easy kinds; you see anything unusual.
- **Day 30:** read the report together, fix the notes and the list, and decide whether to raise the pace.

## What I need from you (only these three things)

1. **A mailing address** for the footer (a P.O. box or mailbox rental), and the name you want on the notes.
2. **Your yes** to opening a second web address, two or three sending mailboxes and a cold-email tool, once I have compared the current prices with you.
3. **The reply path:** the forwarding rule from Cognicopia@outlook.com to the Gmail the helper reads (already on the Net-30 list), so every reply reaches it.

Until those are done, nothing leaves the building. The desk can already prepare and check everything, and the build proves the notes are safe to send.
