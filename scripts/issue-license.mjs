#!/usr/bin/env node
/* =====================================================================
   Issue a signed license key: for an invoice, a purchase order, an
   enterprise agreement, or a card customer whose automatic key did not
   arrive. Run by the owner, with the private key made by
   scripts/license-keygen.mjs.

     node scripts/issue-license.mjs --facility "Maple Court" \
          --tier annual_facility --until 2027-10-31

   Options
     --facility  the name printed on the license (required, up to 120 characters)
     --tier      monthly_facility | annual_facility | enterprise   (required)
     --until     the date it is paid through, YYYY-MM-DD (required); the site
                 keeps working a further 90 days (GRACE_DAYS) offline
     --key       the private key file (default ~/.cognicopia/license-private.pem,
                 or the LICENSE_SIGNING_KEY environment variable holding its text)
     --site      the site address for the activation link (default https://cognicopia.org)
     --verify    check a key instead of making one:  --verify COG1.xxxx.yyyy

   It prints the key, a one-click activation link (the key is after a #, so
   it never reaches a server log), and a short email to paste. The "id" is
   what to add to REVOKED_IDS in src/config/license.js to withdraw a key.
   Node built-ins only.
   ===================================================================== */
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

const args = process.argv.slice(2);
const flag = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const TIERS = ["monthly_facility", "annual_facility", "enterprise"];
const b64u = b => Buffer.from(b).toString("base64url");

/* Sign a payload the way the browser expects: COG1.<payload>.<r||s>. Exported for the tests. */
export function issue({ facility, tier, until, issued, id }, privatePem) {
  if (typeof facility !== "string" || !facility.trim() || facility.length > 120) throw new Error("The facility name must be 1 to 120 characters.");
  if (!TIERS.includes(tier)) throw new Error("The tier must be one of: " + TIERS.join(", "));
  if (!/^\d{4}-\d\d-\d\d$/.test(until) || isNaN(Date.parse(until))) throw new Error("The paid-through date must look like 2027-10-31.");
  const payload = { v: 1, f: facility.trim(), t: tier, e: until, i: issued || new Date().toISOString().slice(0, 10), n: id || "lic_" + crypto.randomBytes(8).toString("hex") };
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.sign("sha256", Buffer.from("COG1." + body, "ascii"), { key: privatePem, dsaEncoding: "ieee-p1363" });
  return { token: `COG1.${body}.${b64u(sig)}`, payload };
}

/* Check a key against a public key (130 hex characters), as the browser does. Exported for the tests. */
export function check(token, publicHex) {
  const m = /^COG1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{86})$/.exec(String(token).replace(/\s+/g, ""));
  if (!m) return { ok: false, reason: "format" };
  const pub = crypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: Buffer.from(publicHex.slice(2, 66), "hex").toString("base64url"), y: Buffer.from(publicHex.slice(66), "hex").toString("base64url") }, format: "jwk" });
  const ok = crypto.verify("sha256", Buffer.from("COG1." + m[1], "ascii"), { key: pub, dsaEncoding: "ieee-p1363" }, Buffer.from(m[2], "base64url"));
  return ok ? { ok: true, payload: JSON.parse(Buffer.from(m[1], "base64url").toString("utf8")) } : { ok: false, reason: "signature" };
}

function main() {
  if (args.includes("--help") || args.includes("-h") || !args.length) {
    const src = fs.readFileSync(new URL(import.meta.url), "utf8");
    console.log(src.slice(src.indexOf("/*") + 2, src.indexOf("*/")).replace(/^[= \n]+|[= \n]+$/g, ""));
    return;
  }
  const keyFile = (flag("--key") || path.join(os.homedir(), ".cognicopia", "license-private.pem")).replace(/^~(?=$|\/)/, os.homedir());
  const pem = process.env.LICENSE_SIGNING_KEY && !flag("--key") ? process.env.LICENSE_SIGNING_KEY : fs.existsSync(keyFile) ? fs.readFileSync(keyFile, "utf8") : null;
  if (!pem) { console.error(`No private key found at ${keyFile}. Make one with: node scripts/license-keygen.mjs`); process.exit(1); }

  const pub = crypto.createPublicKey(crypto.createPrivateKey(pem)).export({ format: "jwk" });
  const hex = b => Buffer.from(b, "base64url").toString("hex").padStart(64, "0");
  const point = "04" + hex(pub.x) + hex(pub.y);

  if (flag("--verify")) {
    const r = check(flag("--verify"), point);
    console.log(r.ok ? "Good signature. " + JSON.stringify(r.payload) : "NOT valid: " + r.reason);
    process.exit(r.ok ? 0 : 1);
  }
  let made;
  try { made = issue({ facility: flag("--facility") || "", tier: flag("--tier") || "", until: flag("--until") || "" }, pem); }
  catch (e) { console.error(e.message); process.exit(1); }

  const site = (flag("--site") || "https://cognicopia.org").replace(/\/+$/, "");
  const tierName = { monthly_facility: "monthly facility license", annual_facility: "annual facility license", enterprise: "enterprise license" }[made.payload.t];
  console.log(`id        ${made.payload.n}`);
  console.log(`facility  ${made.payload.f}`);
  console.log(`license   ${tierName}, paid through ${made.payload.e}`);
  console.log("");
  console.log("KEY");
  console.log(made.token);
  console.log("");
  console.log("ONE-CLICK LINK (opens the site and turns it on; the key stays after the #)");
  console.log(`${site}/activate.html#license_key=${made.token}`);
  console.log("");
  console.log("EMAIL");
  console.log(`Subject: Your Cognicopia license for ${made.payload.f}`);
  console.log("");
  console.log(`Thank you. Your ${tierName} for ${made.payload.f} is paid through ${made.payload.e}.`);
  console.log("");
  console.log("To turn it on: open Cognicopia on any computer in your building, choose \"License Key / Promo\" at the top, paste this key, and choose Activate Access:");
  console.log("");
  console.log(made.token);
  console.log("");
  console.log("It is checked on the computer itself, so it works with no internet and keeps working after a restart. Use it on every computer in your building. Keep this email: it is also your receipt for the license.");
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
