# Conversion pages and findability

What a buyer sees before they pay, and what a search engine or a shared link sees. Everything here is static and offline-safe: no page below makes a network request of its own.

## The pages

| Page | Address | What it is for |
|---|---|---|
| Pilot | `pilot.html` | A 30-day plan an Activity Director can follow before anyone approves a purchase: what a pilot is, four weeks of things to try, what to write down, answers for an administrator or IT, and a button that opens an email with a checklist (`contact.html?subject=Start+a+pilot`). |
| Referral | `referral.html` | A note a colleague can forward, an editable text box with **Copy the note** and **Open it in my email**, and the sample packet. It sends nothing itself. There is no reward promised; see "Decisions for the owner". |
| Pricing | `pricing.html` | Gains a line under the annual plan ("under $1 a day for your whole building": $349 / 365 = $0.96), and links to the sample packet and the pilot plan. |
| FAQ | `resources/caregiver-faq/` | A new category, **Buying & Approving** (eight questions): privacy and HIPAA, trying it first, why add it to what we have, internet and network limits, one license per building, cost and invoices, who owns the data, staff turnover. The FAQPage JSON-LD in that page carries the same questions. |

Both new pages are in the Facility hub of the navigation (`HUBS` in `scripts/site-nav.mjs`).

Wording rules that held here: "supports", never "ensures", for privacy and regulation; "No resident data leaves the device"; the pilot page says outright that Cognicopia does not claim a clinical result from a month of use.

## The sample packet

`assets/samples/cognicopia-sample-packet.pdf` is five pages, made by the real **Download Today's Packet (PDF)** button on the front page for a made-up resident (Ruth, born 1938, who likes gardening and big-band music) at the middle stage on 1 October 2026. Nothing in it is drawn by hand.

`scripts/sample-packet.mjs` makes it: it opens `index.html` in a real browser with the clock and the random numbers held still (so the PDF is the same each time), fills the form, presses the button and keeps the file the page makes.

```
node scripts/sample-packet.mjs           write the PDF
node scripts/sample-packet.mjs --check   fail if the tool would now make a different PDF (part of npm run build)
```

If the packet engine or the PDF layout changes, the check fails. Run the script without a flag and commit the new PDF.

The sample is linked from the pilot page, the referral page and the pricing page, and not from `index.html`: `scripts/check-soothing.mjs` keeps static PDF links off the front page and the Packet Builder, on purpose, so that packets stay something the tool makes.

## Findability (`scripts/seo.mjs`)

```
node scripts/seo.mjs           write sitemap.xml, robots.txt and each page's head block
node scripts/seo.mjs --check   fail if any of it is out of date or wrong (part of npm test and npm run build)
```

- **`sitemap.xml`** lists every public page and nothing else: no tool screen (`builder.html`, `profile.html`), no purchase page (`activate.html`), no redirect stub. It carries no "last modified" date, because none would be true.
- **`robots.txt`** allows everything except `activate.html` and `builder.html`, and names the sitemap.
- **The head block** (between `seo:start` and `seo:end`) gives each handwritten page a canonical address and the Open Graph and Twitter card tags a shared link shows. The Research Center's pages write their own canonical address in `scripts/research-pages.mjs`.
- **JSON-LD** on the front page is a `SoftwareApplication` with three offers: the free start (25 packets, price 0), the monthly license and the annual license. The two prices are read from `src/config/license.js`, the one place prices live. The check fails if they differ, and fails on any rating or review claim.
- **Meta descriptions**: every public page has its own title and its own description of 70 to 320 characters. The check fails on a missing or shared one, and on a page in the repository root that is neither in the sitemap nor explained in `NOT_PUBLIC`.

To add a public page: write it, add it to `HAND` in `scripts/seo.mjs` (and `PAGES` in `scripts/site-nav.mjs` if it carries the navigation), then run `node scripts/seo.mjs`.

## Decisions for the owner

- **Referral reward.** The referral page is a share kit only. A reward (a free month, a discount) is a money decision for the owner, and a page that promises one needs a way to honor it. Not added.
- **A call with a person.** The pilot page says "we will reply by email" and promises no call or onboarding session.
- **Search engines.** Pages are ready to be found, but nothing is submitted anywhere. The owner can add the site to a search engine's webmaster tools and give it `https://cognicopia.org/sitemap.xml`.
