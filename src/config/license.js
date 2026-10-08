/* =====================================================================
   Cognicopia licensing configuration: the one place the codes live.

   Nothing here is a secret that can be kept in a web page, so nothing
   here pretends to be. What this file holds is a SHA-256 of each code,
   never the code itself: someone reading the page source sees only a
   64-character string, and has to guess the code to get past it. That
   keeps a casual visitor out; it does not stop someone who guesses a
   short or obvious code, so choose codes that are long and unguessable.

   PROMO_SHA256   the master promo code, hashed after the page trims it and
                  upper-cases it. To change it:
                    node scripts/promo-hash.mjs "YOUR-NEW-CODE"
                  and paste the result below. (The build checks that this
                  value is well formed and that the promo works end to end.)
   ACCESS_SHA256  the paid access code from the Stripe receipt. The same
                  value is used by index.html and builder.html; the build
                  checks the three agree.
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
      paid: "cognicopia_license"
    })
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
