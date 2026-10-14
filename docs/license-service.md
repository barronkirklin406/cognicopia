# The license service

What turns a card payment into a license key in the buyer's email, with nobody in between. It lives in `license-service/`. The static site cannot do this by itself: a web page cannot send email or hold a secret, so one small service has to run on its own and answer when Stripe calls.

## What happens

```
Buyer pays on a Stripe Payment Link
   |-- Stripe sends the buyer to activate.html?session_id=...   (the key is shown on the page, if the service answers)
   |-- Stripe calls the service:  POST /api/licenses/webhook
          the service checks the call is really Stripe's (a signature),
          reads the payment back from Stripe (is it paid? which price? which business? paid through when?),
          signs a license key, and emails it to the address the buyer gave at checkout.
```

The buyer gets the key twice if everything works (on the page and in the email), and once if only one works. Nothing needs the owner.

- **The key is checked in the browser** with the public key in `src/config/license.js` (`PUBLIC_KEYS`). The service only signs.
- **It holds nothing.** No database, no copy of any key. The one place a key goes is the email.
- **It never sees a resident.** What it reads is the buyer's email address and business name, from Stripe. A key carries a business name, a plan and two dates.
- **No dependencies.** Plain JavaScript on the Web Crypto API and `fetch`, so there is nothing to install and nothing to go out of date. The same code runs on Netlify (`license-service/functions/`) and on Cloudflare Workers (`license-service/worker.mjs`).
- **Proved without a network.** `node scripts/check-license-service.mjs` (in `npm test` and `npm run build`) stands in for Stripe and the email service and checks the whole path: a key the service signs is accepted by the real license manager, the webhook believes only Stripe, a paid license is emailed once to the buyer, an unpaid or other payment is not, a failed email makes Stripe try again, and the key is never in a log.

## The addresses

| Address | Who calls it | What it does |
|---|---|---|
| `POST /api/licenses/webhook` | Stripe | Emails the key after a payment. Answers 200 when it has dealt with the event (or has nothing to do), an error when Stripe should try again. |
| `POST /api/licenses/redeem` | `activate.html` on the site | Returns the key for a checkout reference, so the page can show it. Only `cognicopia.org` may read the answer; ten tries a minute from one address. |
| `GET /api/licenses/health` | You | Which settings are present: names only, never values. `ready: true` means every setting is there. |

## The settings

Set in the host's environment, never in the repository (it is public).

| Setting | What it is |
|---|---|
| `STRIPE_RESTRICTED_KEY` | A Stripe key that can only **read**. In the Stripe Dashboard: Developers, API keys, create a restricted key with read access to Checkout Sessions and Subscriptions and nothing else. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...`, shown on the page of the webhook endpoint (below). |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL` | The two price ids of the live product (Product catalog, "Cognicopia Facility License"). |
| `LICENSE_SIGNING_KEY` | The private key that signs license keys, from a **second** key made on `license-desk.html` (see "Two keys" below). |
| `RESEND_API_KEY` | The email service's key. |
| `EMAIL_FROM` | The sender, for example `Cognicopia <licenses@cognicopia.org>`. The domain must be verified with the email service. |
| `EMAIL_REPLY_TO` | Optional: where replies go, for example `cognicopia@outlook.com`. |
| `SITE_URL`, `LICENSE_ALLOWED_ORIGINS` | Optional; both default to `https://cognicopia.org`. |

A setting that is missing breaks only what needs it, and the answer names the setting, never a value.

## Two keys, on purpose

Make the license-signing key **twice** on `license-desk.html`: a **master key** that stays on the owner's computer and makes keys by hand for invoices, and a **server key** whose private half goes into the host's settings. Both public lines go in `PUBLIC_KEYS` (it is a list). If the host were ever broken into, the server key is taken out of the list and the master key still stands. Keys already issued with the server key can be withdrawn by id (`REVOKED_IDS`), or simply replaced.

## Current setup (October 14, 2026)

The service runs as the Worker `cognicopia-licenses` on the owner's Cloudflare account, at `https://cognicopia-licenses.barron-kirklin406.workers.dev`. Its seven settings and two optional ones are all set: the two Stripe price ids, a read-only Stripe key (Checkout Sessions and Subscriptions, Read), the webhook signing secret (a Stripe event destination for `checkout.session.completed` and `checkout.session.async_payment_succeeded`), the service's own signing key, a Resend sending key limited to `cognicopia.org`, `EMAIL_FROM` and `EMAIL_REPLY_TO`. `cognicopia.org` is registered at Cloudflare, and Resend's DNS records were added from the Resend page with Cloudflare's one-time approval.

An end-to-end test was run on October 14, 2026 with a one-use 100% off code on a temporary monthly link: the payment completed, the webhook ran and the key arrived by email within about a minute. The test subscription was canceled and the test link switched off. `REDEEM_URL` and `EMAIL_DELIVERY` in `src/config/license.js` are now set, and both live Payment Links say the key is also emailed.

To change the service's code: edit `license-service/src/*.mjs`, run `node license-service/build-worker.mjs`, merge, then paste the new `license-service/dist/worker.js` into the Worker's code editor in Cloudflare and deploy.

## What the owner provides

Three things only the owner can: an account to run the service on, an account to send the email, and the pasted settings. (The setup steps below are written from each provider's documentation, and their screens may differ from the words here.)

1. **A host.** Cloudflare Workers (free plan). The owner does not use Netlify, so the repository has no `netlify.toml`. Cloudflare's web editor takes one file, so `node license-service/build-worker.mjs` joins the modules into `license-service/dist/worker.js` (the build and `npm test` fail if that file is out of date). The owner makes a Worker in the Cloudflare dashboard, pastes that file in and deploys; the address Cloudflare gives (`https://<name>.<account>.workers.dev`) is where the three paths above live. The settings are added to the Worker as secrets. The Netlify entries in `license-service/functions/` remain, tested, in case a different host is ever wanted.
2. **An email sender.** [Resend](https://resend.com) is what the code talks to. Sending from `licenses@cognicopia.org` needs the domain verified: the service gives a few DNS records, added where the domain is registered. A free plan is enough for the volume here (check the provider's current limits).
3. **The settings above**, pasted into the host.
4. **The webhook in Stripe.** Dashboard, Developers, Webhooks, add an endpoint at `https://<host>/api/licenses/webhook`, choosing the events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Its page shows the signing secret (`whsec_...`) for `STRIPE_WEBHOOK_SECRET`.

Then, from here:

- `REDEEM_URL` in `src/config/license.js` is set to `https://<host>/api/licenses/redeem`.
- A first end-to-end test with a real checkout that costs nothing: a one-use 100% off promotion code on one of the two prices, a purchase with it, and the email arriving. (`payment_status: no_payment_required` is accepted.)
- `EMAIL_DELIVERY` in `src/config/license.js` is switched to `true`, which makes `activate.html` tell a buyer to check their email; the two Payment Links' checkout text is updated to say the key is emailed; and the privacy and security pages name the two providers. These wait until the test email has arrived, so no page promises what the service has not yet done.

## Renewals

A monthly license's key is paid through the end of the month it was bought, plus 90 days of grace, and the same purchase always has the same license id. A computer that is still paying renews with **Renew online** in the license window (`activate.html?renew=1`), which asks this service again for a fresh key. Automatic emails on every renewal are not sent: a monthly subscriber would get twelve keys a year, and each would have to be pasted in again. If that turns out to be wanted, the webhook can also handle `invoice.paid`.

## If something goes wrong

| What | Why | What to do |
|---|---|---|
| No email arrives | The email service refused it (an unverified sender domain is the usual cause) | Stripe retries the webhook for days, so fixing the setting is enough; the Stripe webhook page lists each attempt and its answer. The buyer can also paste the key `activate.html` showed. |
| `/api/licenses/health` says `ready: false` | A setting is missing | The list names which. |
| The webhook page in Stripe shows 400 | The signing secret in the host does not match the endpoint's | Copy `whsec_...` again from that endpoint's page. |
| Stripe shows 503 | A setting is missing | The answer names it. |
| A buyer typed the wrong email | The key went to that address | Make a key on `license-desk.html` and send it by hand. |
| A key must be withdrawn | A refund or chargeback | Add its id to `REVOKED_IDS` in `src/config/license.js`. |
