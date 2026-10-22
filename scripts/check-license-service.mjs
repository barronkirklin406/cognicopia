#!/usr/bin/env node
/* =====================================================================
   The license service (license-service/): a payment becomes a license key
   in the buyer's email, with nobody in between.  Run: node scripts/check-license-service.mjs
   (part of npm test and npm run build; needs no network, no Stripe and no
   email account: both are stood in for by a fake that records what it is sent)

   Proved:
     1. what the service signs is what the browser accepts: a key made here
        verifies in the real license manager (assets/services/licenseManager.js)
        and with scripts/issue-license.mjs's checker; the private key may be held
        as a PEM, a PEM on one line, or bare base64
     2. a payment for one of our two prices becomes the right key (monthly,
        annual, the old and the new Stripe shape, a cancelled subscription, a
        one-time yearly payment); an unpaid one, another product, a made-up
        reference and a Stripe outage are each refused with the right answer
     3. the Stripe webhook: only a call signed by Stripe, and recent, is believed;
        the event names only WHICH payment, and what it is is read back from
        Stripe; a paid license is emailed once, to the address given at checkout,
        with the key, the one-click link and the plain steps; an unpaid, other or
        address-less payment is not; a failed email makes Stripe try again
     3b. a Net-30 invoice (billed by email, not a card) on one of our two prices
        emails the key with the invoice, or on payment when NET30_KEY_TIMING says so;
        a card invoice, another product, several licenses on one invoice and an
        unsigned call each send nothing
     4. nothing leaks: the key is in that one email and nowhere else (not in the
        webhook's answer, not in any log), the health page shows names never
        values, a missing setting is named without its value
     5. the redeem address answers only the site, only ten tries a minute
     6. the service has no dependencies, holds no secret, and its Netlify and
        Cloudflare entries point at the same handlers; the one-file bundle for
        Cloudflare's web editor is current and answers like the modules do
   ===================================================================== */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";
import { handleHealth, handleRedeem, handleWebhook, route, takeTry } from "../license-service/src/handlers.mjs";
import { derOfKey, signLicense } from "../license-service/src/token.mjs";
import { verifyStripeSignature } from "../license-service/src/stripe.mjs";
import { licenseEmail } from "../license-service/src/email.mjs";
import { check } from "./issue-license.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const problems = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };

/* ---------- a key pair for the test, and the real browser-side checker trusting it ---------- */
const pair = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const PEM = pair.privateKey.export({ type: "pkcs8", format: "pem" });
const jwk = pair.publicKey.export({ format: "jwk" });
const hx = b => Buffer.from(b, "base64url").toString("hex").padStart(64, "0");
const POINT = "04" + hx(jwk.x) + hx(jwk.y);
const CONFIG = read("src/config/license.js").replace(/PUBLIC_KEYS: Object\.freeze\(\[[^\]]*\]\)/, `PUBLIC_KEYS: Object.freeze(["${POINT}"])`);
const sandbox = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, console };
sandbox.globalThis = sandbox; sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(CONFIG, ctx); vm.runInContext(read("assets/services/licenseManager.js"), ctx);
const browser = ctx.CognicopiaLicense;

/* ---------- stand-ins for Stripe and the email service ---------- */
const NOW = new Date("2026-11-13T15:00:00Z"), TS = Math.floor(NOW.getTime() / 1000), THROUGH = Math.floor(Date.UTC(2026, 11, 13) / 1000);
const PRICE_M = "price_test_monthly", PRICE_A = "price_test_annual";
const SECRET_WH = "whsec_test_secret_value", RK = "rk_test_restricted_value", RESEND = "re_test_email_key";
const ENV = { STRIPE_RESTRICTED_KEY: RK, STRIPE_WEBHOOK_SECRET: SECRET_WH, STRIPE_PRICE_MONTHLY: PRICE_M, STRIPE_PRICE_ANNUAL: PRICE_A, LICENSE_SIGNING_KEY: PEM, RESEND_API_KEY: RESEND, EMAIL_FROM: "Cognicopia <licenses@example.test>", EMAIL_REPLY_TO: "help@example.test" };
const buyer = { email: "buyer@example.test", name: "Test Buyer" };
const subNew = (status = "active") => ({ id: "sub_test_1", status, items: { data: [{ current_period_end: THROUGH, price: { id: PRICE_M } }] } });
const sessions = {
  cs_test_monthly1: { id: "cs_test_monthly1", status: "complete", payment_status: "paid", mode: "subscription", subscription: subNew(), line_items: { data: [{ price: { id: PRICE_M } }] }, collected_information: { business_name: "Maple Court (example)" }, customer_details: buyer },
  cs_test_oldshape: { id: "cs_test_oldshape", status: "complete", payment_status: "paid", mode: "subscription", subscription: { id: "sub_test_old", status: "active", current_period_end: THROUGH, items: { data: [{ price: { id: PRICE_M } }] } }, line_items: { data: [{ price: { id: PRICE_M } }] }, customer_details: { ...buyer, business_name: "Old Shape Manor" } },
  cs_test_annual11: { id: "cs_test_annual11", status: "complete", payment_status: "paid", mode: "subscription", subscription: { ...subNew(), id: "sub_test_a", items: { data: [{ current_period_end: Math.floor(Date.UTC(2027, 10, 13) / 1000), price: { id: PRICE_A } }] } }, line_items: { data: [{ price: { id: PRICE_A } }] }, collected_information: { business_name: "Annual Acres" }, customer_details: buyer },
  cs_test_cancelled: { id: "cs_test_cancelled", status: "complete", payment_status: "paid", mode: "subscription", subscription: subNew("canceled"), line_items: { data: [{ price: { id: PRICE_M } }] }, collected_information: { business_name: "Cancelled Court" }, customer_details: buyer },
  cs_test_onetime1: { id: "cs_test_onetime1", status: "complete", payment_status: "paid", mode: "payment", created: TS, line_items: { data: [{ price: { id: PRICE_A } }] }, collected_information: { business_name: "One Time Place" }, customer_details: buyer },
  cs_test_unpaid11: { id: "cs_test_unpaid11", status: "open", payment_status: "unpaid", mode: "subscription", subscription: null, line_items: { data: [{ price: { id: PRICE_M } }] }, customer_details: buyer },
  cs_test_otherthing: { id: "cs_test_otherthing", status: "complete", payment_status: "paid", mode: "payment", line_items: { data: [{ price: { id: "price_something_else" } }] }, customer_details: buyer },
  cs_test_noemail11: { id: "cs_test_noemail11", status: "complete", payment_status: "paid", mode: "subscription", subscription: subNew(), line_items: { data: [{ price: { id: PRICE_M } }] }, collected_information: { business_name: "No Email Inn" }, customer_details: { name: "No Email" } },
  cs_test_nofacility: { id: "cs_test_nofacility", status: "complete", payment_status: "paid", mode: "subscription", subscription: subNew(), line_items: { data: [{ price: { id: PRICE_M } }] }, customer_details: { email: buyer.email } },
  cs_test_htmlname11: { id: "cs_test_htmlname11", status: "complete", payment_status: "paid", mode: "subscription", subscription: subNew(), line_items: { data: [{ price: { id: PRICE_M } }] }, collected_information: { business_name: "<script>alert(1)</script> & Sons" }, customer_details: buyer },
};
function world(opts = {}) {
  const w = { sent: [], stripeCalls: [], emailStatus: opts.emailStatus || 200, stripeDown: !!opts.stripeDown };
  w.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith("https://api.stripe.com/v1/checkout/sessions/")) {
      w.stripeCalls.push({ url: u, auth: init.headers?.Authorization });
      if (w.stripeDown) return new Response("down", { status: 503 });
      const id = decodeURIComponent(u.split("/sessions/")[1].split("?")[0]);
      const s = (opts.sessions || sessions)[id];
      return s ? new Response(JSON.stringify(s), { status: 200 }) : new Response(JSON.stringify({ error: { code: "resource_missing" } }), { status: 404 });
    }
    if (u === "https://api.resend.com/emails") {
      const body = JSON.parse(init.body);
      w.sent.push({ headers: init.headers, body });
      return new Response(JSON.stringify({ id: "email_1" }), { status: w.emailStatus });
    }
    throw new Error("the service reached an unexpected address: " + u);
  };
  return w;
}
const deps = w => ({ fetch: w.fetch, now: () => NOW });
const sign = (body, secret = SECRET_WH, ts = TS) => `t=${ts},v1=${crypto.createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")}`;
const event = (type, id) => JSON.stringify({ id: "evt_1", type, data: { object: { id } } });
const hook = (body, header) => new Request("https://svc.example/api/licenses/webhook", { method: "POST", body, headers: header ? { "stripe-signature": header } : {} });
const redeemReq = (ref, origin = "https://cognicopia.org", ip = "203.0.113.9") => new Request("https://svc.example/api/licenses/redeem", { method: "POST", body: JSON.stringify({ session_id: ref }), headers: { "content-type": "application/json", ...(origin ? { origin } : {}), "x-forwarded-for": ip } });
const bodyOf = async res => { const t = await res.text(); try { return JSON.parse(t); } catch { return t; } };

/* what is written to the logs: captured, so the test can prove the key is never in it */
const logged = []; const realLog = console.log, realErr = console.error;
console.log = (...a) => logged.push(a.join(" ")); console.error = (...a) => logged.push(a.join(" "));

try {
  /* ---------- 1. the key is the browser's key ---------- */
  const made = await signLicense({ facility: "Direct Test House", tier: "annual_facility", until: "2027-10-31", id: "lic_direct" }, PEM);
  const seen = browser.inspectKey(made.token);
  ok(seen.ok && seen.facilityName === "Direct Test House" && seen.licenseTier === "annual_facility" && seen.expiresAt === "2027-10-31" && seen.id === "lic_direct", "a key made by the service verifies in the real license manager: " + JSON.stringify(seen).slice(0, 120));
  ok(check(made.token, POINT).ok, "and with the issue-license checker");
  for (const [label, text] of [["a PEM", PEM], ["a PEM on one line", PEM.trim().replace(/\n/g, "\\n")], ["bare base64", PEM.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")]]) {
    const k = await signLicense({ facility: "Key Form House", tier: "monthly_facility", until: "2027-01-31" }, text);
    ok(browser.inspectKey(k.token).ok, `the signing key can be held as ${label}`);
  }
  ok((() => { try { derOfKey("not a key"); return false; } catch { return true; } })(), "a setting that is not a private key is refused");
  const tampered = made.token.slice(0, -3) + "AAA";
  ok(!browser.inspectKey(tampered).ok, "a changed key is refused by the browser (control)");

  /* ---------- 2. redeem: a payment becomes the right key ---------- */
  const expect = async (ref, status, code, label) => {
    const w = world(); const res = await handleRedeem(redeemReq(ref, "https://cognicopia.org", "198.51.100." + Math.floor(Math.random() * 200)), ENV, deps(w)); const b = await bodyOf(res);
    ok(res.status === status && (code ? b.error?.code === code : true), `${label}: ${res.status} ${code || ""} (${JSON.stringify(b).slice(0, 80)})`);
    return { res, b, w };
  };
  { const { b, w } = await expect("cs_test_monthly1", 200, null, "a paid monthly license");
    const k = browser.inspectKey(b.license_key);
    ok(k.ok && k.licenseTier === "monthly_facility" && k.facilityName === "Maple Court (example)" && k.expiresAt === "2026-12-13" && b.tier === "monthly_facility" && b.facility_name === "Maple Court (example)", "the monthly key names the business, the plan and the date it is paid through: " + JSON.stringify(k).slice(0, 140));
    ok(w.stripeCalls[0].auth === `Bearer ${RK}` && /expand\[\]=subscription/.test(w.stripeCalls[0].url) && w.stripeCalls.length === 1, "it asks Stripe once, with the read-only key"); }
  { const { b } = await expect("cs_test_oldshape", 200, null, "the older Stripe shape (the date on the subscription)"); const k = browser.inspectKey(b.license_key);
    ok(k.ok && k.expiresAt === "2026-12-13" && k.facilityName === "Old Shape Manor", "its date and its business name (from the customer details) are read"); }
  { const { b } = await expect("cs_test_annual11", 200, null, "a paid annual license"); const k = browser.inspectKey(b.license_key);
    ok(k.ok && k.licenseTier === "annual_facility" && k.expiresAt === "2027-11-13", "the annual key is paid through the end of its year"); }
  { const { b } = await expect("cs_test_cancelled", 200, null, "a cancelled subscription"); const k = browser.inspectKey(b.license_key);
    ok(k.ok && k.expiresAt === "2026-12-13", "a cancelled subscription still gets the period it paid for"); }
  { const { b } = await expect("cs_test_onetime1", 200, null, "a one-time yearly payment"); const k = browser.inspectKey(b.license_key);
    ok(k.ok && k.licenseTier === "annual_facility" && k.expiresAt === "2027-11-13", "a one-time yearly payment is paid through a year from the day it was made"); }
  { const a = (await expect("cs_test_monthly1", 200, null, "the same payment again")).b, c = (await expect("cs_test_monthly1", 200, null, "and once more")).b;
    ok(browser.inspectKey(a.license_key).id === browser.inspectKey(c.license_key).id, "the same purchase always gets the same license id, so withdrawing it withdraws every renewal"); }
  { const { b } = await expect("cs_test_nofacility", 200, null, "a payment with no business name"); ok(browser.inspectKey(b.license_key).facilityName === "Your facility", "falls back to a plain name, never blank"); }
  await expect("cs_test_unpaid11", 402, "not_paid", "an unpaid checkout");
  await expect("cs_test_otherthing", 422, "not_a_license", "a payment for something else");
  await expect("cs_test_doesnotexist1", 404, "not_found", "a reference Stripe does not know");
  await expect("hello", 400, "invalid_request", "something that is not a reference");
  { const w = world({ stripeDown: true }); const res = await handleRedeem(redeemReq("cs_test_monthly1", "https://cognicopia.org", "198.51.100.77"), ENV, deps(w)); ok(res.status === 502, "a Stripe outage is a 502, not a made-up key"); }

  /* ---------- 5. redeem: who may ask ---------- */
  { const w = world(); const r = await handleRedeem(redeemReq("cs_test_monthly1", "https://cognicopia.org"), ENV, deps(w));
    ok(r.headers.get("access-control-allow-origin") === "https://cognicopia.org", "the site may read the answer");
    const bad = await handleRedeem(redeemReq("cs_test_monthly1", "https://evil.example"), ENV, deps(w));
    ok(bad.status === 403 && !bad.headers.get("access-control-allow-origin"), "another site is refused");
    const pre = await handleRedeem(new Request("https://svc.example/api/licenses/redeem", { method: "OPTIONS", headers: { origin: "https://cognicopia.org" } }), ENV, deps(w));
    ok(pre.status === 204 && /POST/.test(pre.headers.get("access-control-allow-methods")), "the browser's pre-check is answered");
    const get = await handleRedeem(new Request("https://svc.example/api/licenses/redeem", { method: "GET" }), ENV, deps(w));
    ok(get.status === 405, "only POST"); }
  { let allowed = 0; for (let i = 0; i < 14; i++) if (takeTry("burst-test", 1_000_000 + i)) allowed++;
    ok(allowed === 10 && !takeTry("burst-test", 1_000_020) && takeTry("burst-test", 1_000_000 + 61_000), "ten tries a minute from one address, then it opens again"); }
  { const w = world(); const missing = { ...ENV }; delete missing.LICENSE_SIGNING_KEY;
    const r = await handleRedeem(redeemReq("cs_test_monthly1", "https://cognicopia.org", "198.51.100.5"), missing, deps(w)); const b = await bodyOf(r);
    ok(r.status === 503 && /LICENSE_SIGNING_KEY/.test(b.error.message) && !JSON.stringify(b).includes(RK), "a missing setting is named (never its value)"); }

  /* ---------- 3. the webhook ---------- */
  const fire = async (type, id, opts = {}) => {
    const w = opts.world || world(opts); const body = event(type, id);
    const res = await handleWebhook(hook(body, opts.header ?? sign(body)), opts.env || ENV, deps(w));
    return { res, b: await bodyOf(res), w };
  };
  { const body = event("checkout.session.completed", "cs_test_monthly1"), w = world();
    const noHeader = await handleWebhook(hook(body, null), ENV, deps(w));
    const forged = await handleWebhook(hook(body, sign(body, "whsec_not_the_secret")), ENV, deps(w));
    const stale = await handleWebhook(hook(body, sign(body, SECRET_WH, TS - 3600)), ENV, deps(w));
    const edited = await handleWebhook(hook(body.replace("monthly1", "monthly2"), sign(body)), ENV, deps(w));
    ok([noHeader, forged, stale, edited].every(r => r.status === 400) && w.sent.length === 0 && w.stripeCalls.length === 0, "a call with no signature, a wrong one, an old one or an edited body is refused and does nothing");
    ok(await verifyStripeSignature(body, sign(body), SECRET_WH, { now: NOW.getTime() }) && !(await verifyStripeSignature(body, "t=abc,v1=zz", SECRET_WH, { now: NOW.getTime() })), "the signature check, and garbage in the header, never throws"); }
  { const { res, b, w } = await fire("checkout.session.completed", "cs_test_monthly1");
    ok(res.status === 200 && b.delivered === true && w.sent.length === 1, "a paid license is emailed once");
    const mail = w.sent[0];
    ok(mail.body.to.length === 1 && mail.body.to[0] === "buyer@example.test", "to the address the buyer gave at checkout, and no one else");
    ok(mail.body.from === ENV.EMAIL_FROM && mail.body.reply_to === "help@example.test" && mail.headers.Authorization === `Bearer ${RESEND}` && mail.headers["Idempotency-Key"] === "license-cs_test_monthly1", "from the licence address, with a reply address and a key that stops a retry sending twice");
    const key = (mail.body.text.match(/COG1\.[A-Za-z0-9_.-]+/) || [""])[0];
    const k = browser.inspectKey(key);
    ok(k.ok && k.facilityName === "Maple Court (example)" && k.expiresAt === "2026-12-13", "the key in the email is one the browser accepts");
    ok(mail.body.html.includes(key) && mail.body.text.includes("#license_key=" + key), "the key is in the plain text, the HTML and the one-click link");
    ok(/Maple Court \(example\)/.test(mail.body.subject) && /December 13, 2026/.test(mail.body.text) && /License Key \/ Promo/.test(mail.body.text) && /Activate Access/.test(mail.body.text) && /Stripe also sends your payment receipt/.test(mail.body.text), "the email names the business and the date, and says in plain words how to turn it on");
    const everything = JSON.stringify(b) + logged.join("\n");
    ok(!everything.includes(key) && !everything.includes("buyer@example.test"), "the key and the buyer's address are not in the webhook's answer or in any log");
    ok(!/resident|patient/i.test(mail.body.text), "the email says nothing about residents"); }
  { const { res, w } = await fire("checkout.session.async_payment_succeeded", "cs_test_annual11"); ok(res.status === 200 && w.sent.length === 1, "a bank payment that clears later is emailed when it clears"); }
  { const { res, b, w } = await fire("customer.created", "cs_test_monthly1"); ok(res.status === 200 && b.ignored && w.sent.length === 0, "an event of another kind is acknowledged and ignored"); }
  { const { res, b, w } = await fire("checkout.session.completed", "cs_test_unpaid11"); ok(res.status === 200 && b.ignored && w.sent.length === 0, "an unpaid checkout sends nothing"); }
  { const { res, b, w } = await fire("checkout.session.completed", "cs_test_otherthing"); ok(res.status === 200 && b.ignored && w.sent.length === 0, "a payment for another product sends nothing"); }
  { const { res, b, w } = await fire("checkout.session.completed", "cs_test_noemail11"); ok(res.status === 200 && b.delivered === false && b.reason === "no_email" && w.sent.length === 0, "a payment with no address to write to is noted, not retried forever"); }
  { const liar = { ...sessions, cs_test_monthly1: sessions.cs_test_unpaid11 }; const { w } = await fire("checkout.session.completed", "cs_test_monthly1", { sessions: liar }); ok(w.sent.length === 0, "the event is not believed over Stripe: if Stripe says it is unpaid, nothing is sent"); }
  { const { res, w } = await fire("checkout.session.completed", "cs_test_monthly1", { emailStatus: 500 }); ok(res.status === 502 && w.sent.length === 1, "if the email cannot be sent the answer is an error, so Stripe tries again later"); }
  { const { res } = await fire("checkout.session.completed", "cs_test_monthly1", { stripeDown: true }); ok(res.status === 502, "if Stripe cannot be read the answer is an error, so Stripe tries again later"); }
  { const { w } = await fire("checkout.session.completed", "cs_test_htmlname11");
    const m = w.sent[0]; ok(m && !/<script/i.test(m.body.html) && /Sons/.test(m.body.html), "a business name with markup in it cannot put markup in the email"); }
  { const m = licenseEmail({ licenseKey: "COG1.x.y", facilityName: "Q & A \"Court\"", tier: "enterprise", expiresAt: "2027-01-01", siteUrl: "https://cognicopia.org/" });
    ok(m.html.includes("Q &amp; A &quot;Court&quot;") && m.text.includes("https://cognicopia.org/activate.html#license_key=COG1.x.y"), "names are escaped in the HTML and the link has no double slash"); }
  /* ---------- 3b. a Net-30 invoice: the key goes out with the invoice (or when it is paid), with nobody in between ---------- */
  const YEAR_END = Math.floor(Date.UTC(2027, 10, 13) / 1000);
  const inv = (over = {}) => ({ id: "in_test_net30a", object: "invoice", collection_method: "send_invoice", status: "open", created: TS, customer: "cus_test_1", customer_name: "Net Thirty Gardens (example)", customer_email: "ap@example.test",
    parent: { subscription_details: { subscription: "sub_test_net30" } },
    lines: { data: [{ quantity: 1, period: { start: TS, end: YEAR_END }, pricing: { price_details: { price: PRICE_A } } }] }, ...over });
  const fireInvoice = async (type, invoice, opts = {}) => {
    const w = opts.world || world(opts); const body = JSON.stringify({ id: "evt_inv", type, data: { object: invoice } });
    const res = await handleWebhook(hook(body, sign(body)), opts.env || ENV, deps(w));
    return { res, b: await bodyOf(res), w };
  };
  { const { res, b, w } = await fireInvoice("invoice.finalized", inv());
    ok(res.status === 200 && b.delivered === true && w.sent.length === 1 && w.stripeCalls.length === 0, "a Net-30 invoice that Stripe finalizes emails the key with it, and needs no call back to Stripe");
    const mail = w.sent[0], key = /COG1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.exec(mail.body.text)?.[0], k = browser.inspectKey(key || "");
    ok(mail.body.to.length === 1 && mail.body.to[0] === "ap@example.test" && mail.headers["Idempotency-Key"] === "license-in_test_net30a", "to the billing contact on the invoice only, with a key that stops a retry sending twice");
    ok(k.ok && k.facilityName === "Net Thirty Gardens (example)" && k.licenseTier === "annual_facility" && k.expiresAt === "2027-11-13", "the key names the facility and runs to the end of the period the invoice covers: " + JSON.stringify(k).slice(0, 120));
    const again = await fireInvoice("invoice.finalized", inv({ id: "in_test_net30b", lines: { data: [{ quantity: 1, period: { start: YEAR_END, end: YEAR_END + 365 * 86400 }, pricing: { price_details: { price: PRICE_A } } }] } }), {});
    ok(browser.inspectKey(/COG1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.exec(again.w.sent[0].body.text)[0]).id === k.id, "a renewal invoice for the same subscription gets the same license id, so withdrawing one withdraws every year");
    const everything = JSON.stringify(b) + logged.join("\n"); ok(!everything.includes(key) && !everything.includes("ap@example.test"), "neither the key nor the address is in the webhook's answer or in any log"); }
  { const { res, b, w } = await fireInvoice("invoice.paid", inv({ status: "paid" })); ok(res.status === 200 && b.ignored && w.sent.length === 0, "by default the paid event sends nothing: the key already went with the invoice"); }
  { const env = { ...ENV, NET30_KEY_TIMING: "on_payment" };
    const f = await fireInvoice("invoice.finalized", inv(), { env }); const p = await fireInvoice("invoice.paid", inv({ status: "paid" }), { env });
    ok(f.b.ignored && f.w.sent.length === 0 && p.b.delivered === true && p.w.sent.length === 1, "with NET30_KEY_TIMING=on_payment the key waits for payment (a check marked received counts)");
    const open = await fireInvoice("invoice.paid", inv({ status: "open" }), { env }); ok(open.w.sent.length === 0, "and a paid event for an invoice that is not paid sends nothing"); }
  { const { b, w } = await fireInvoice("invoice.finalized", inv({ collection_method: "charge_automatically" })); ok(b.ignored && w.sent.length === 0, "a card invoice is left to the checkout path: no second email"); }
  { const { b, w } = await fireInvoice("invoice.finalized", inv({ lines: { data: [{ quantity: 1, period: { start: TS, end: YEAR_END }, pricing: { price_details: { price: "price_retired_plan" } } }] } })); ok(b.ignored && w.sent.length === 0, "an invoice for any other product, such as a retired price, sends nothing"); }
  { const two = inv({ lines: { data: [{ quantity: 2, period: { start: TS, end: YEAR_END }, pricing: { price_details: { price: PRICE_A } } }] } });
    const { b, w } = await fireInvoice("invoice.finalized", two); ok(b.delivered === false && b.reason === "needs_a_person" && w.sent.length === 0, "an invoice for two licenses is not guessed at: a person makes those keys");
    const { b: b2 } = await fireInvoice("invoice.finalized", inv({ lines: { data: [{ quantity: 1, period: { start: TS, end: YEAR_END }, pricing: { price_details: { price: PRICE_A } } }, { quantity: 1, period: { start: TS, end: YEAR_END }, pricing: { price_details: { price: PRICE_M } } }] } })); ok(b2.reason === "needs_a_person", "nor two license lines on one invoice"); }
  { const old = inv({ parent: undefined, subscription: "sub_old_shape", lines: { data: [{ quantity: 1, period: { start: TS, end: YEAR_END }, price: { id: PRICE_M } }] } });
    const { b, w } = await fireInvoice("invoice.finalized", old); const k = browser.inspectKey(/COG1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.exec(w.sent[0]?.body.text || "")?.[0] || "");
    ok(b.delivered === true && k.ok && k.licenseTier === "monthly_facility", "the older Stripe shape of an invoice (price and subscription fields) is read too"); }
  { const noPeriod = inv({ lines: { data: [{ quantity: 1, pricing: { price_details: { price: PRICE_A } } }] } }); const { w } = await fireInvoice("invoice.finalized", noPeriod);
    ok(browser.inspectKey(/COG1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.exec(w.sent[0].body.text)[0]).expiresAt === "2027-11-13", "a yearly invoice with no period is paid through a year from the day it was made");
    const m = await fireInvoice("invoice.finalized", inv({ lines: { data: [{ quantity: 1, pricing: { price_details: { price: PRICE_M } } }] } })); ok(m.b.reason === "needs_a_person" && m.w.sent.length === 0, "a monthly invoice that does not say its month is left to a person"); }
  { const { b, w } = await fireInvoice("invoice.finalized", inv({ customer_email: "" })); ok(b.delivered === false && b.reason === "no_email" && w.sent.length === 0, "an invoice with no address to write to is noted, not retried forever"); }
  { const { res } = await fireInvoice("invoice.finalized", inv(), { emailStatus: 500 }); ok(res.status === 502, "if the email cannot be sent the answer is an error, so Stripe tries again later"); }
  { const w = world(); const body = JSON.stringify({ id: "evt_inv", type: "invoice.finalized", data: { object: inv() } }); const res = await handleWebhook(hook(body, sign(body, "whsec_not_the_secret")), ENV, deps(w));
    ok(res.status === 400 && w.sent.length === 0, "an invoice event not signed by Stripe is refused and sends nothing"); }
  { const { res, b, w } = await fireInvoice("invoice.finalized", { id: "x", object: "invoice" }); ok(res.status === 200 && b.ignored && w.sent.length === 0, "a malformed invoice id is ignored"); }

  { const w = world(); const body = event("checkout.session.completed", "cs_test_monthly1"); const missing = { ...ENV }; delete missing.RESEND_API_KEY;
    const r = await handleWebhook(hook(body, sign(body)), missing, deps(w)); const b = await bodyOf(r);
    ok(r.status === 503 && /RESEND_API_KEY/.test(b.error.message) && w.sent.length === 0, "with the email setting missing the webhook says which one, and sends nothing"); }

  /* ---------- 4. health, and routing ---------- */
  { const h = handleHealth(ENV), t = await h.text(), j = JSON.parse(t);
    ok(j.ready === true && Object.values(j.settings).every(v => v === true), "health says every setting is present");
    ok(![PEM.slice(30, 60), SECRET_WH, RK, RESEND, "licenses@example.test"].some(v => t.includes(v)), "and shows names, never values");
    const none = JSON.parse(await handleHealth({}).text()); ok(none.ready === false && Object.values(none.settings).every(v => v === false), "with nothing set it says so"); }
  { const w = world();
    const a = await route(new Request("https://svc.example/api/licenses/health"), ENV, deps(w)), b = await route(new Request("https://svc.example/nothing"), ENV, deps(w)), c = await route(redeemReq("cs_test_monthly1", "https://cognicopia.org", "198.51.100.88"), ENV, deps(w));
    ok(a.status === 200 && b.status === 404 && c.status === 200, "one entry sends the three addresses to their handlers (Cloudflare Workers)"); }

  /* ---------- 6. the files ---------- */
  const files = fs.readdirSync(path.join(ROOT, "license-service/src")).map(f => "license-service/src/" + f).concat(fs.readdirSync(path.join(ROOT, "license-service/functions")).map(f => "license-service/functions/" + f), ["license-service/worker.mjs", "license-service/dist/worker.js"]);
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) ok(/^(\.|node:)/.test(m[1]), `${f} imports ${m[1]}: the service must have no dependencies`);
    ok(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b[sr]k_(live|test)_[A-Za-z0-9]|\bwhsec_[A-Za-z0-9]{8}|\bre_[A-Za-z0-9]{12}/.test(src), `${f} holds a secret`);
    ok(!/console\.(log|error|warn)\([^)]*(licenseKey|token|signingKey|apiKey)/.test(src), `${f} logs something that could be a secret`);
  }
  const pkg = JSON.parse(read("license-service/package.json"));
  ok(!pkg.dependencies && !pkg.devDependencies && pkg.type === "module", "the service's package has no dependencies");
  ok(!fs.existsSync(path.join(ROOT, "netlify.toml")), "there is no netlify.toml: the owner does not use Netlify, and a settings file here could start a build on an old project");
  { const { bundle } = await import("../license-service/build-worker.mjs");
    ok(read("license-service/dist/worker.js") === bundle(), "the one-file bundle for Cloudflare is current (run: node license-service/build-worker.mjs)");
    const mod = await import("../license-service/dist/worker.js");
    const a = await mod.default.fetch(new Request("https://svc.example/api/licenses/health"), ENV), b = await mod.default.fetch(new Request("https://svc.example/nothing"), ENV);
    ok(a.status === 200 && (await a.json()).ready === true && b.status === 404, "the bundle answers health and unknown paths like the modules do"); }
  for (const [f, p] of [["webhook", "/api/licenses/webhook"], ["redeem", "/api/licenses/redeem"], ["health", "/api/licenses/health"]]) ok(read(`license-service/functions/${f}.mjs`).includes(`path: "${p}"`), `the Netlify entry for ${f} serves ${p}`);
  ok(/\/api\/licenses\/redeem/.test(read("src/config/license.js")), "the config's redeem address ends in /api/licenses/redeem, the path the service answers");
  { const cfg = read("src/config/license.js"), url = (cfg.match(/REDEEM_URL:\s*"([^"]*)"/) || [])[1] || "", on = /EMAIL_DELIVERY:\s*true/.test(cfg);
    ok(!on || (/^https:\/\//.test(url) && !/REPLACE_ME/.test(url)), "the site only promises an emailed key when REDEEM_URL is a real address"); }
} finally {
  console.log = realLog; console.error = realErr;
}

if (problems.length) { console.log(`license service check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")); process.exit(1); }
console.log(`license service check passed: ${passed} checks (a payment becomes a key the browser accepts and an email to the buyer; the webhook believes only Stripe; nothing leaks; no dependencies)`);
