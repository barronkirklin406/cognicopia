/* =====================================================================
   Cognicopia licensing configuration: the one place prices, links and
   keys live.

   Nothing here is a secret that can be kept in a web page, so nothing
   here pretends to be. Three kinds of thing are in this file:

   1. PUBLIC_KEYS   the public half of the license-signing key. A license
                    key (COG1.<facility and dates>.<signature>) is signed by
                    the owner with the private half, which is never in this
                    repository, and checked here in the browser with no
                    server and no internet. A public key can only check a
                    signature, never make one, so it is safe to publish.
                    Make the pair once with
                        node scripts/license-keygen.mjs
                    and paste the one line it prints into PUBLIC_KEYS. Until
                    you do, signed keys are refused with a plain message and
                    the older codes below keep working.
   2. PRICES and PAYMENT_LINKS
                    what the site says, and where the buy buttons go. The
                    two Stripe Payment Links are made in the Stripe
                    dashboard (docs/stripe-setup-guide.md) and pasted here.
                    A value that still holds REPLACE_ME, or has "test_" in
                    it, is treated as "not set up yet": the buy button then
                    sends the visitor to the invoice request instead of a
                    dead page or a link that takes pretend cards.
   3. PROMO_SHA256 and ACCESS_SHA256
                    the older, shared codes, each kept as a SHA-256 hash
                    and never as the code itself. They keep a casual
                    visitor out and nothing more: anyone who guesses a short
                    code gets in, and a code that has been shared cannot be
                    taken back. ACCESS_SHA256 is the code on the receipt of
                    the earlier single-price licence, kept so those
                    customers are not locked out. New purchases get a
                    signed key instead.

   PROMO_SHA256   the master promo code, hashed after the page trims it and
                  upper-cases it. To change it:
                    node scripts/promo-hash.mjs "YOUR-NEW-CODE"
                  and paste the result below. (The build checks that this
                  value is well formed and that the promo works end to end.)
   ACCESS_SHA256  the earlier paid access code. The same value is used by
                  index.html and builder.html; the build checks the three
                  agree.
   KEYS           the browser-storage names the activation is kept under.
   ===================================================================== */
(function (root) {
  "use strict";
  root.CognicopiaLicenseConfig = Object.freeze({
    PROMO_SHA256: "243979e8974c33d1d320adaa25470f59db051582d3a728da0dcd69bfea861cbd",
    ACCESS_SHA256: "97c0fcc2e7143e13c6b104d93ad47c1e57670a24576df965b1a9eb745d6217da",
    PROMO_TYPE: "promo",
    KEYS: Object.freeze({
      active: "cognicopia_license_active",
      type: "cognicopia_license_type",
      date: "cognicopia_activation_date",
      proof: "cognicopia_license_proof",
      paid: "cognicopia_license",
      license: "cognicopia_license_v2",
      ref: "cognicopia_license_ref"
    }),

    /* The signed license keys. See "1. PUBLIC_KEYS" above. Each entry is an
       uncompressed P-256 public key as 130 hex characters (04 + x + y), as
       printed by scripts/license-keygen.mjs. More than one is allowed so a
       key can be replaced without ending the licenses signed by the old one. */
    PUBLIC_KEYS: Object.freeze([
      /* the master key: the owner's computer only, for keys made by hand */
      "0497ddfd60b746ae28145d7309e39f5e698f42f541149dd280e6c21e301a578c6876d3690d664f3013e270b0ff2644cd5c7e567a1e51571ca3364a0a775e782412",
      /* the service key: its private half is a secret setting on the host that emails keys to buyers */
      "04bb2651669e1318f01a2ef5c5b4e9e194c5098313470a07bc0160c958c9d1dbf9614918c7dc158dc00f0997b0f66b1188712192ff709230caf20e356215960cde"
    ]),
    /* Ids (the "id" shown by scripts/issue-license.mjs) of keys that have
       been withdrawn, for example after a chargeback. A page checks this list
       every time it starts, so a withdrawal reaches a computer the next time
       it loads a fresh copy of the site. */
    REVOKED_IDS: Object.freeze([]),
    /* Days a license keeps working after the date it was paid through, so a
       late invoice or a computer that has been offline does not stop a unit
       in the middle of a week. The signed date is the truth; this is added. */
    GRACE_DAYS: 90,

    /* What the site says it costs. Per facility, per building. */
    FREE_RUNS: 25,
    PRICES: Object.freeze({
      monthly: Object.freeze({ amount: 39, per: "month", text: "$39 a month", tier: "monthly_facility" }),
      annual: Object.freeze({ amount: 349, per: "year", text: "$349 a year", tier: "annual_facility", saves: 119, savesPercent: 25 }),
      enterprise: Object.freeze({ text: "Custom quote", tier: "enterprise" })
    }),
    /* The three kinds of license a signed key can carry. */
    TIERS: Object.freeze({
      monthly_facility: "Monthly facility license",
      annual_facility: "Annual facility license",
      enterprise: "Enterprise license"
    }),

    /* Stripe Payment Links (docs/stripe-setup-guide.md, step 4). Paste the
       two buy.stripe.com addresses over the REPLACE_ME text. */
    PAYMENT_LINKS: Object.freeze({
      monthly: "https://buy.stripe.com/6oUdRa5pB5djcAFfFtew802",
      annual: "https://buy.stripe.com/6oU28sdW7fRXcAF0Kzew803"
    }),
    /* Where "Request Corporate Invoice / W-9" goes (a page on this site; it
       fills in the subject and a checklist for accounts payable). */
    INVOICE_PATH: "contact.html?subject=Corporate+Invoice+Request",
    PRICING_PATH: "pricing.html",
    /* The one page that talks to the internet, and only to turn a Stripe
       checkout into a key. REDEEM_URL is the address of the license service
       (license-service/, POST /api/licenses/redeem). Leave it REPLACE_ME until
       that service is running; the page then asks for the key by hand. */
    ACTIVATE_PATH: "activate.html",
    REDEEM_URL: "https://REPLACE_ME.example/api/licenses/redeem",
    /* True only once the license service is running AND can send email (its
       webhook emails the key to the address the buyer gave at checkout). The
       page then tells a buyer to check their email; while it is false the page
       says only what is true today: the key is sent by hand. */
    EMAIL_DELIVERY: false
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
