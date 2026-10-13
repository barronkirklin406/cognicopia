# Stripe setup guide: the facility license

How Cognicopia sells and unlocks a facility license, and exactly what the owner sets up in Stripe. Everything marked **Owner** can only be done by the person who holds the Stripe account and the signing key. Nothing in this guide needs a secret to be written into the repository, and nothing may be.

> **Where things stand (October 13, 2026).** In the live Stripe account the owner now has the product "Cognicopia Facility License", a $39 monthly price, a $349 yearly price and two Payment Links (card only, business name and billing address required, redirecting to `activate.html?session_id={CHECKOUT_SESSION_ID}`). Their addresses are in `PAYMENT_LINKS` in `src/config/license.js`, so the buy buttons open them. The older $129.99 link is switched off. The owner made their own signing key on the license desk, and `PUBLIC_KEYS` holds its public half (the earlier session-only key was removed, so the site trusts only a key the owner holds). Not yet done: the license service (step 4; until `REDEEM_URL` is set, `activate.html` asks a card buyer to email the Stripe receipt and the owner makes the key by hand, step 7). The earlier access code and the promo code keep working.

## What is sold

| Plan | Price | Who it is for |
|---|---|---|
| Monthly | $39.00 per month, per facility | A department that can buy on a purchasing card (P-Card) without a sign-off. Check your own spending policy. |
| Annual (best value) | $349.00 per year, per facility | One payment, easy to budget. $39 × 12 = $468, so $349 saves $119 a year, about 25%. |
| Enterprise / multi-facility | Custom quote | Several buildings, paid by invoice: ACH or check, net-30, a W-9. |

The free trial is **25 packets** on each computer (`FREE_RUNS` in `src/config/license.js`). A license is per facility (one building, any number of computers). These numbers are set once, in `src/config/license.js`, and the pages, the top bar, the research worksheet and the procurement calculator read them from there or are checked against them.

## How the pieces fit

```
Visitor                    cognicopia.org (static)              Stripe            license service (platform/)
  | pricing.html -> Payment Link ------------------------------> checkout
  |                                                               | pays
  | <---- redirect: activate.html?session_id={CHECKOUT_SESSION_ID}
  | activate.html: POST /api/licenses/redeem {session_id} -------------------------> asks Stripe: paid? which price?
  | <---------------------------------------------- COG1.<facility, tier, dates>.<signature> (signed)
  | the key is checked in the browser and kept; from here on, no network is needed
```

- A **license key** looks like `COG1.<payload>.<signature>`. The payload holds the facility's business name, the plan (`monthly_facility`, `annual_facility` or `enterprise`), the date it is paid through, the date it was made and an id. The signature is ECDSA P-256 over SHA-256, made with a private key only the owner holds. The site holds the public key (`PUBLIC_KEYS`) and checks the signature in plain JavaScript, so it works with no internet, on `file://`, and on a plain `http` intranet.
- A key keeps working until its **paid-through date plus 90 days** (`GRACE_DAYS`). A computer that has been offline for months stays unlocked; one that has not renewed locks after the grace days and says whose license ended.
- A key can carry nothing about a resident. It is a business name and two dates.
- `activate.html` is the **only** page that contacts anything, and only after a card payment: it sends the Stripe checkout reference, nothing else, to the license service. The build fails if any other page makes a network request.

## Owner: the steps

Do steps 1 to 4 in Stripe's **test mode** first, buy once with the test card `4242 4242 4242 4242`, and only then repeat them in live mode. Test and live have different keys, prices and links. A Payment Link with `test_` in it is never offered to a visitor.

### 1. Make the signing key (once)

**The easy way, in a web browser (no terminal, nothing to install).** Open `license-desk.html` on the live site (`https://cognicopia.org/license-desk.html`; it is not linked from any page and robots.txt asks search engines to skip it) and press **Make my key**. The page makes the key pair inside the browser, saves the secret file `cognicopia-license-private.pem` to the Downloads folder, and shows the one safe line to send. The page cannot send anything out (its content security policy forbids connections, forms and frames), never shows the secret key, and stores nothing. The file it saves is the same kind of file `scripts/issue-license.mjs` reads. Back it up the same way. The same page makes a license key for a facility (step 2 on the page) and checks whether the site accepts a key (step 3), so step 7 below can be done there too. `scripts/check-license-desk-ui.mjs` proves, in a real browser, that what the page makes is what Node and the license manager accept.

**The command-line way**, if you prefer it:

On your own computer, from the repository folder:

```
node scripts/license-keygen.mjs
```

It writes the private key to `~/.cognicopia/license-private.pem` (never inside the repository; `.gitignore` refuses `*.pem` as a second guard) and prints one line:

```
PUBLIC_KEYS: Object.freeze(["04..."]),
```

Paste that line over `PUBLIC_KEYS: Object.freeze([]),` in `src/config/license.js`. **Back the private key up** in a password manager. If it is lost, every license has to be issued again under a new pair; if it leaks, make a new pair, put the new public key in the array, take the old one out, and issue fresh keys. To rotate without ending existing licenses, add the new public key and keep the old one until the old licenses run out.

### 2. Make the product and the two prices

Dashboard, Product catalog, **Add product**:

| Field | Value |
|---|---|
| Name | `Cognicopia - Memory Care Facility License` |
| Description | One building. Unlimited packets, prints and exports for every computer in the facility. Resident details stay on your computers. |
| Price 1 | **$39.00 USD**, recurring, **monthly**. Lookup key `cognicopia_facility_monthly`. |
| Price 2 | **$349.00 USD**, recurring, **yearly**. Lookup key `cognicopia_facility_annual`. |

Copy the two **Price IDs** (`price_...`). They go in the license service's environment as `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL` (the same names `platform/` already uses for its own checkout). The service only turns a payment into a key when the payment is for one of these two prices.

The earlier $129.99 a year price and its Payment Link should be **archived, not deleted**, once you have decided what to do about the customers who bought it (see [Customers who bought at $129.99](#customers-who-bought-at-12999)).

### 3. Make the two Payment Links

Dashboard, Payment links, **New**. Make one per price (one with Price 1, one with Price 2). For each:

| Setting | Value | Why |
|---|---|---|
| Quantity | Fixed at 1, no adjustable quantity | One license per purchase. |
| Collect customer names | **Business name**, required | The key is printed with the facility's name, and the license service reads it from the checkout. |
| Collect addresses | Billing address, required | Receipts and any tax need it. |
| Tax ID collection | On, optional | A facility can put its tax ID on its receipt. |
| Payment methods | **Cards only** | A purchasing card is a card. ACH Direct Debit is a delayed method (see below). |
| After payment | **Don't show confirmation page**, redirect to `https://cognicopia.org/activate.html?session_id={CHECKOUT_SESSION_ID}` | Stripe replaces `{CHECKOUT_SESSION_ID}` with the real id. This is what turns a payment into a key with no one lifting a finger. |
| Receipts | On | The buyer gets Stripe's receipt by email as a record. |
| Custom text | "Your license key appears on the next page. Copy or print it." | Sets the expectation. |

Open **each** link once in test mode, pay with the test card, and check you land on `activate.html` with a key. Then make the live links and paste the two `https://buy.stripe.com/...` addresses over the `REPLACE_ME` text in `PAYMENT_LINKS` in `src/config/license.js`:

```js
PAYMENT_LINKS: Object.freeze({
  monthly: "https://buy.stripe.com/YOUR_MONTHLY_LINK",
  annual: "https://buy.stripe.com/YOUR_ANNUAL_LINK"
}),
```

A value that still holds `REPLACE_ME`, or has `test_` in it, is treated as not set up: that plan's button then asks for an invoice. `pricing.html`, the upgrade screens in both packet tools and the top bar all read this one place.

> **Why cards only.** ACH Direct Debit (and any bank method) confirms days later. Until it does, the checkout is not paid, so the license service answers "Payment not finished yet" and the buyer waits. Bank payments are handled well by **invoices** (step 6), which is also what accounts payable departments expect.

### 4. Deploy the license service

This is what makes the key arrive in the buyer's email by itself. It is `license-service/`, written up in [license-service.md](license-service.md): what it does, the settings, what the owner provides (a host, an email sender, the pasted settings, and the webhook in Stripe), a free end-to-end test, and what to do when something is wrong. `scripts/check-license-service.mjs` proves its behavior without a network.

**If you would rather not run the service yet,** leave `REDEEM_URL` as the placeholder. `activate.html` then tells a buyer that automatic activation is not switched on and to email the receipt, and you issue the key by hand (step 7, or on `license-desk.html`). Nothing else changes.

(`platform/` also has a `POST /api/licenses/redeem` route from earlier. `license-service/` supersedes it: it needs no database, no framework and no installs, and it also emails the key.)

### 5. Turn on the Customer portal

Dashboard, Settings, Billing, **Customer portal**. Turn it on and allow customers to **update payment methods**, **update billing information (including tax IDs)**, **view invoices**, and **cancel subscriptions at the end of the billing period**. Leave "switch plan" off for now: a key's plan comes from the checkout it was bought in. Stripe's no-code portal gives a login link; share it with customers however you like (an email footer, or your reply to a cancellation request).

### 6. Invoices, net-30, ACH and a W-9 (accounts payable)

For a facility that wants an invoice (the site's **Request Corporate Invoice / W-9** button opens a pre-filled email with the checklist below):

1. **Customer.** Customers, Add customer: the facility's legal name, billing address, the accounts payable email, and its tax ID if it has one.
2. **Invoice.** Invoices, Create: add the product and price (the $349 annual, the $39 monthly, or a custom price for an Enterprise quote), set **Collection method: Send invoice**, **Due: 30 days (net-30)**. Add the purchase order number in the memo or a custom field.
3. **Payment methods.** Turn on **Bank transfer** (ACH credit: Stripe shows a unique virtual account number on the invoice and matches the incoming transfer automatically) and, if you wish, **ACH Direct Debit** and **Card**. Settings, Billing, Invoices has the defaults.
4. **Check.** Stripe has no check payment method. When a check arrives, open the invoice and choose **Mark as paid** (paid outside Stripe).
5. **W-9.** Stripe does not produce a W-9. Attach or send your own, from the IRS form, with the first invoice. `resources/quality-standards/` has a **Vendor Information Sheet and W-9 request** the community can print and complete.
6. **Key.** Make the license key (step 7) and email it with the invoice. Stripe's invoice email is the receipt; the key email is the license.

An Enterprise quote is the same, with a custom price. One key names one facility. For a group of buildings, make one key per building (so each prints its own name), or one key in the group's name used on all of its computers: a key is not tied to a computer or an address.

### 7. Make a key by hand (invoices, enterprise, or a lost key)

```
node scripts/issue-license.mjs --facility "Maple Court" --tier annual_facility --until 2027-10-31
```

`--tier` is `monthly_facility`, `annual_facility` or `enterprise`; `--until` is the date it is paid through. It prints the key, a one-click link (`.../activate.html#license_key=...`, with the key after the `#` so it never reaches a server log) and a short email to paste. To check a key later: `node scripts/issue-license.mjs --verify COG1...`.

A person turns a key on by choosing **License Key / Promo** at the top of any page, pasting it, and choosing **Activate Access**. They can also open the one-click link, or add `?license_key=` to any page's address. The address is cleaned afterward so the key is not left in browser history.

To **withdraw** a key (a chargeback, say): add its `id` (printed when it was made, and inside the key) to `REVOKED_IDS` in `src/config/license.js`. A computer sees it the next time it loads a fresh copy of the site. A key bought through a Payment Link has the same id every time it is renewed, so withdrawing it withdraws every renewal.

## What is placeholder until the owner sets it

| Where | What | Until it is set |
|---|---|---|
| `PUBLIC_KEYS` in `src/config/license.js` | The public half of the signing key | Signed keys are refused with "not switched on for this copy of the site yet" |
| `PAYMENT_LINKS` | Two `buy.stripe.com` addresses | The plan buttons ask for an invoice |
| `REDEEM_URL` | The address of the license service | `activate.html` asks the buyer to email the receipt |
| The service's environment | `LICENSE_SIGNING_KEY`, the Stripe key and price ids | The route answers 503 "not set up yet", naming no value |
| `~/.cognicopia/license-private.pem` | The private key | Only you can make keys, and only you can lose them |

## Customers who bought at $129.99

They bought a **single shared access code** (kept in `ACCESS_SHA256`, hashed). That code keeps working on every computer where it is entered, and the license window still accepts it, so no one is locked out by this change. It cannot be made to expire, because it has no date, and it is not a secret: anyone who learns it can use it. Two decisions are the owner's:

1. **How long to honor it.** The simplest fair rule is "until the year they paid for ends", then invite them to a signed key at the new price (or a one-time discount, which is a Stripe coupon on the first renewal). When you are ready to retire the code, change `ACCESS_SHA256` in `src/config/license.js` **and** the two copies in `index.html` and `builder.html` (the build checks all three agree).
2. **The old Payment Link.** Archive it in Stripe so no one buys at the old price. It is no longer linked from the site.

## Refunds and renewals: policy to confirm

The pages say: **full refund within 30 days of the first payment, no forms**; the monthly plan can be cancelled any time and stays on through the month paid for; the annual plan renews once a year and can be cancelled before the renewal date. Those are the earlier policy carried forward, not new decisions. If you want different terms, change the wording in `index.html` (the legal note), `pricing.html`, `resources/caregiver-faq/index.html` and this guide, and set Stripe's refund and cancellation settings to match.

## Troubleshooting

| What a person sees | Why | What to do |
|---|---|---|
| "Payment not finished yet" on `activate.html` | The checkout is not marked paid (a bank payment pending, or a refreshed page before the card cleared) | Wait a minute and reload. If it persists, check the payment in Stripe. |
| "We could not find that payment" | The address was altered, or it is a test checkout against the live service (or the reverse) | Use the link from the payment page. Make sure test and live keys match the mode. |
| "The license service could not help just now" | The service is down, or the Stripe key lacks read access | Check the service's logs (they name the setting, never its value). Issue the key by hand meanwhile. |
| "License keys are not switched on for this copy of the site yet" | `PUBLIC_KEYS` is empty | Step 1. |
| "This license key could not be verified" | A character was lost in copying, or it was signed by a different private key | Ask them to copy the whole key again; confirm the public key in the config is the pair of your private key. |
| "This license key ended on ..." | Past the paid-through date plus 90 days | Renew, or make a new key with `--until` set forward. |
| The plan buttons say "Request this plan" | That Payment Link is still a placeholder or a test link | Step 3. |

## Sources

Stripe's own documentation was read for this guide on the date of the commit. The points most worth re-checking before going live, because Stripe moves its screens: the **After payment** tab of a Payment Link (redirect with the `{CHECKOUT_SESSION_ID}` placeholder), the Payment Link **name collection** option, the Customer portal's cancellation setting, and the invoice **Bank transfer** payment method.

- [After a payment: redirect to your website with the checkout session id](https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted)
- [Customize checkout for Payment Links (names, addresses, tax IDs)](https://docs.stripe.com/payment-links/customize)
- [Configure the customer portal](https://docs.stripe.com/customer-management/configure-portal)
- [Bank transfer on invoices](https://docs.stripe.com/invoicing/bank-transfer)
- [Invoicing and ACH Direct Debit](https://docs.stripe.com/invoicing/ach-direct-debit)
