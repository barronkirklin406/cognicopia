#!/usr/bin/env node
/* =====================================================================
   Licensing and pricing, in a real browser. (scripts/check-license.mjs
   proves the key logic in a sandbox; this proves what a person sees and
   what happens when they do it.)

   Checked, with a test key pair made on the spot and swapped in for the
   site's public key (the real one is the owner's): the top bar's two buttons
   on a tool page and a resource page; the 25-packet limit and the upgrade
   screen with monthly, annual and invoice choices in both packet tools; a
   pasted key unlocking the gate, the top-bar window and the builder's
   settings; a key arriving in the address (?license_key=, #license_key=)
   and a checkout reference (?session_id=) being passed to activate.html;
   activate.html turning a checkout into a key through a stand-in license
   service (and what it says when the payment is unpaid, the network is gone
   or the service is not set up); a license surviving a reload, and still
   working four months after its date but not seven (a fake clock); the
   pricing page and the invoice request; that no page but activate.html
   contacts anything; and that every button here is at least 52 px.

   Needs Playwright. Where it is not installed this exits 2 and says so, and
   npm run build skips it. Serves the repository on a free local port.
   Run: node scripts/check-license-ui.mjs
   ===================================================================== */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { loadPlaywright, serve, ROOT } from "./lib/browser.mjs";
import { issue } from "./issue-license.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = []; let passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };

/* a key pair for the test, and the site's config with its public key and two Payment Links filled in */
const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }), jwk = publicKey.export({ format: "jwk" });
const hx = b => Buffer.from(b, "base64url").toString("hex").padStart(64, "0");
const PUB = "04" + hx(jwk.x) + hx(jwk.y);
const REAL_CFG = fs.readFileSync(path.join(ROOT, "src/config/license.js"), "utf8");
/* keys on, links and service not set up: the real config now holds the live Payment Links, so the test puts the placeholders back before it fills in its own */
const CFG_BARE = REAL_CFG.replace(/PUBLIC_KEYS: Object\.freeze\(\[[^\]]*\]\)/, `PUBLIC_KEYS: Object.freeze(["${PUB}"])`)
  .replace(/(monthly:\s*)"https:\/\/buy\.stripe\.com\/[^"]*"/, '$1"https://buy.stripe.com/REPLACE_ME_MONTHLY_39"')
  .replace(/(annual:\s*)"https:\/\/buy\.stripe\.com\/[^"]*"/, '$1"https://buy.stripe.com/REPLACE_ME_ANNUAL_349"')
  .replace(/REDEEM_URL:\s*"[^"]*"/, 'REDEEM_URL: "https://REPLACE_ME.example/api/licenses/redeem"')   // the tests set the service and email states themselves,
  .replace(/EMAIL_DELIVERY:\s*(true|false)/, "EMAIL_DELIVERY: false");                                // so they do not depend on what the live config says;
const MONTHLY = "https://buy.stripe.com/aEU1234abcd", ANNUAL = "https://buy.stripe.com/bFV5678efgh", SERVICE = "https://license.example.test/api/licenses/redeem";
const CFG_FULL = CFG_BARE.replace("https://buy.stripe.com/REPLACE_ME_MONTHLY_39", MONTHLY).replace("https://buy.stripe.com/REPLACE_ME_ANNUAL_349", ANNUAL).replace("https://REPLACE_ME.example/api/licenses/redeem", SERVICE);

const KEY = issue({ facility: "Maple Court", tier: "annual_facility", until: "2027-10-31", id: "lic_ui_test" }, pem).token;
const KEY_OLD = issue({ facility: "Maple Court", tier: "monthly_facility", until: "2026-12-31", id: "lic_ui_old" }, pem).token;
const REF = "cs_live_a1B2c3D4e5F6g7H8i9J0";

const external = [];   // every request that left the local server (the stand-in service is expected on activate.html only)
async function context({ cfg = CFG_FULL, service, viewport = { width: 1280, height: 900 }, storageState, clock } = {}) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: "block", storageState });
  await ctx.route("**/src/config/license.js", r => r.fulfill({ contentType: "text/javascript", body: cfg }));
  await ctx.route(url => !url.href.startsWith(base) && !url.href.startsWith("data:") && !url.href.startsWith("blob:"), async route => {
    const req = route.request(), u = new URL(req.url());
    external.push({ page: req.frame().url(), url: req.url(), method: req.method() });
    const cors = { "access-control-allow-origin": new URL(base).origin, "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" };
    if (u.host !== "license.example.test" || !service) return route.abort();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const answer = await service(JSON.parse(req.postData() || "{}"));
    return route.fulfill({ status: answer.status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(answer.body) });
  });
  if (clock) await ctx.addInitScript(`(() => { const T = ${clock}, D = Date; globalThis.Date = class extends D { constructor(...a){ if (a.length) super(...a); else super(T); } static now(){ return T; } }; })();`);
  return ctx;
}
const open = async (ctx, url) => { const p = await ctx.newPage(); p.on("pageerror", e => errors.push(url + ": " + e.message)); await p.goto(base + url); await p.waitForTimeout(350); return p; };
const tall = async (p, sel) => { const b = await p.locator(sel).first().boundingBox(); return b ? Math.min(b.height, b.width) : 0; };
const visible = (p, sel) => p.locator(sel).first().isVisible().catch(() => false);
const SHOT = process.env.SHOTS;   // set SHOTS=dir to save pictures of the screens, for a person to look at
const shot = async (p, name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await p.screenshot({ path: path.join(SHOT, name + ".png"), fullPage: false }); } };

try {
  /* ---------- the top bar: two buttons, on a tool page and on a resource page ---------- */
  let ctx = await context();
  for (const url of ["index.html", "contact.html", "resources/quality-standards/index.html", "profile.html"]) {
    const p = await open(ctx, url), P = "../".repeat(url.split("/").length - 1);
    const main = p.locator("a[data-upgrade-prompt]", { hasText: "Get Full Access ($39/mo or $349/yr)" }).first(), alt = p.locator("a[data-upgrade-prompt]", { hasText: "Request Corporate Invoice / W-9" }).first();
    ok((await main.textContent()).includes("→"), `${url}: the main button ends with the arrow`);
    ok((await main.getAttribute("href")) === P + "pricing.html", `${url}: the main button goes to pricing.html`);
    ok((await alt.getAttribute("href")) === P + "contact.html?subject=Corporate+Invoice+Request", `${url}: the invoice button goes to the invoice request`);
    ok(await tall(p, "a[data-upgrade-prompt]:has-text('Get Full Access')") >= 52 && await tall(p, "a[data-upgrade-prompt]:has-text('Request Corporate')") >= 52, `${url}: both top-bar buttons are at least 52 px`);
    ok(await visible(p, "#cgPromoBtn") && (await p.textContent("#cgPromoBtn")).trim() === "License Key / Promo", `${url}: the license button is in the bar`);
    if (url === "index.html") await shot(p, "index-topbar");
    await p.close();
  }

  /* ---------- the packet tool: the 25-packet limit and the upgrade screen ---------- */
  let p = await open(ctx, "index.html");
  ok(await p.evaluate(() => FREE_RUNS === 25), "index.html: the free trial is 25 packets");
  ok((await p.textContent("#licBadge")).trim() === "25 of 25 free packets left", "index.html: a new computer has 25 free packets: " + (await p.textContent("#licBadge")));
  await p.evaluate(() => localStorage.setItem("cognicopia_gen_count", "24")); await p.reload(); await p.waitForTimeout(300);
  ok((await p.textContent("#licBadge")).trim() === "1 of 25 free packets left", "index.html: after 24 packets one is left");
  await p.evaluate(() => localStorage.setItem("cognicopia_gen_count", "25")); await p.reload(); await p.waitForTimeout(300);
  await p.fill("#first", "Test"); await p.fill("#born", "1940");
  const act = p.locator("input.act").first(); if (await act.count()) await act.check({ force: true });
  await p.click("#go"); await p.waitForTimeout(500);
  ok(await visible(p, "#gate"), "index.html: the 26th packet opens the upgrade screen");
  ok((await p.textContent("#gateTitle")).includes("25 free packets"), "index.html: the screen says 25 free packets");
  for (const id of ["gateMonthly", "gateAnnual", "gateInvoice"]) ok(await visible(p, "#" + id), `index.html: the upgrade screen offers ${id}`);
  ok((await p.getAttribute("#gateMonthly", "href")) === MONTHLY && (await p.getAttribute("#gateAnnual", "href")) === ANNUAL, "index.html: the two plan buttons are the Payment Links from the config");
  ok((await p.getAttribute("#gateInvoice", "href")) === "contact.html?subject=Corporate+Invoice+Request", "index.html: the invoice button goes to the invoice request");
  const gateText = await p.textContent("#gate");
  ok(/\$39 a month/.test(gateText) && /\$349 a year/.test(gateText) && /save about 25%/.test(gateText) && /Best value/.test(gateText) && /Net-30/.test(gateText) && /W-9/.test(gateText), "index.html: the upgrade screen states $39, $349, the saving, best value, net-30 and the W-9");
  for (const id of ["#gateMonthly", "#gateAnnual", "#gateInvoice", "#licGo", "#lic"]) ok(await tall(p, id) >= 52, `index.html: ${id} is at least 52 px`);
  await shot(p, "index-gate");
  /* a pasted key unlocks it */
  await p.fill("#lic", "COG1.not-a-real-key"); await p.click("#licGo");
  ok(/complete|look like|verified/i.test(await p.textContent("#licMsg")), "index.html: a damaged key is refused in words: " + (await p.textContent("#licMsg")));
  await p.fill("#lic", KEY); await p.click("#licGo"); await p.waitForTimeout(500);
  ok(!(await visible(p, "#gate")) && /Licensed/.test(await p.textContent("#licBadge")), "index.html: a good key closes the upgrade screen and the badge says Licensed");
  ok(!(await visible(p, "a[data-upgrade-prompt]")), "index.html: the buy buttons are hidden once licensed");
  ok(await visible(p, "#cgPromoBadge") && (await p.textContent("#cgPromoBadge")).includes("Full Access Active"), "index.html: the top bar shows Full Access Active");
  const state = await ctx.storageState();
  await p.reload(); await p.waitForTimeout(400);
  ok(/Licensed/.test(await p.textContent("#licBadge")), "index.html: still licensed after a reload");
  await p.close();

  /* ---------- the window in the top bar ---------- */
  ctx = await context();
  p = await open(ctx, "contact.html");
  await p.click("#cgPromoBtn"); await p.waitForTimeout(200);
  ok(await visible(p, "#cgPromoInput") && (await p.getAttribute("#cgPromoInput", "id")) === "cgPromoInput" && /License key or promo code/.test(await p.textContent(".cgpromo-card")), "the window asks for a license key or promo code");
  ok(await tall(p, "#cgPromoInput") >= 52 && await tall(p, ".cgpromo-go") >= 52, "the window's box and button are at least 52 px");
  await shot(p, "license-window");
  await p.fill("#cgPromoInput", "nonsense"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
  ok(/Invalid code/.test(await p.textContent("#cgPromoStatus")), "a wrong code gets the plain refusal");
  await p.fill("#cgPromoInput", "Here is your key:\n" + KEY.replace(/(.{70})/g, "$1\n") + "\nThank you"); await p.keyboard.press("Enter"); await p.waitForTimeout(250);
  ok(/License activated for Maple Court/.test(await p.textContent("#cgPromoStatus")), "a key pasted with an email around it and line breaks is accepted: " + (await p.textContent("#cgPromoStatus")));
  await p.waitForTimeout(2200);
  ok(await visible(p, "#cgPromoBadge") && !(await visible(p, "#cgPromoBtn")) && !(await visible(p, "a[data-upgrade-prompt]")), "the bar swaps to the badge and the buy buttons go");
  await p.click("#cgPromoBadge"); await p.waitForTimeout(200);
  const card = await p.textContent(".cgpromo-card");
  ok(/Maple Court/.test(card) && /Annual facility license/.test(card) && /October 31, 2027/.test(card), "the window names the facility, the license and the date it is paid through: " + card.slice(0, 160));
  await p.click(".cgpromo-actions button:has-text('Remove license')"); await p.waitForTimeout(100);
  ok(/Tap again/.test(await p.textContent(".cgpromo-actions")), "removing a license asks for a second tap");
  await p.click(".cgpromo-actions button:has-text('Tap again')"); await p.waitForTimeout(200);
  ok(!(await p.evaluate(() => CognicopiaLicense.isLicensed())), "the license is removed from this computer");
  await p.close();

  /* ---------- a key in the address ---------- */
  ctx = await context();
  p = await open(ctx, "index.html?x=1&license_key=" + encodeURIComponent(KEY));
  ok(await p.evaluate(() => CognicopiaLicense.isLicensed()), "?license_key= turns the license on when the page loads");
  ok(/License activated for Maple Court/.test(await p.textContent(".cgpromo-card")), "and the window says so");
  ok(await p.evaluate(() => !/license_key/.test(location.href) && /x=1/.test(location.search)), "and the key is gone from the address, the rest kept");
  await p.close();
  ctx = await context();
  p = await open(ctx, "builder.html#license_key=" + KEY);
  ok(await p.evaluate(() => CognicopiaLicense.isLicensed() && !/license_key/.test(location.href)), "#license_key= works too, and leaves the address clean");
  await p.close();
  ctx = await context();
  p = await open(ctx, "index.html?license_key=COG1.bad");
  ok(!(await p.evaluate(() => CognicopiaLicense.isLicensed())) && /./.test(await p.textContent("#cgPromoStatus")), "a bad key in the address is refused in words");
  await p.close();
  ctx = await context();
  p = await open(ctx, "index.html?session_id=" + REF);
  ok(p.url().startsWith(base + "activate.html"), "?session_id= on any page is passed to activate.html: " + p.url());
  ok(await p.evaluate(() => !/session_id/.test(location.href)), "and activate.html takes the reference out of the address");
  await p.close();

  /* ---------- activate.html and the license service ---------- */
  let calls = [];
  ctx = await context({ service: async body => { calls.push(body); return { status: 200, body: { license_key: KEY, facility_name: "Maple Court", tier: "annual_facility", expires_at: "2027-10-31" } }; } });
  p = await open(ctx, "activate.html?session_id=" + REF); await p.waitForTimeout(600);
  ok(calls.length === 1 && Object.keys(calls[0]).join() === "session_id" && calls[0].session_id === REF, "activate.html sends the checkout reference, and only that");
  ok(/Full access is on/.test(await p.textContent("#actTitle")) && /Maple Court/.test(await p.textContent("#actText")), "activate.html turns a checkout into a license: " + (await p.textContent("#actText")));
  ok((await p.inputValue("#actKey")) === KEY && await visible(p, "#actCopy") && await visible(p, "#actPrint"), "and shows the key with Copy and Print");
  ok(await p.evaluate(() => CognicopiaLicense.isLicensed() && !!CognicopiaLicense.renewalRef()), "and the license, and a way to renew it, are kept on this computer");
  ok(await p.evaluate(() => !/session_id/.test(location.href)), "and the reference is gone from the address");
  for (const sel of ["#actCopy", "#actPrint"]) ok(await tall(p, sel) >= 52, `activate.html: ${sel} is at least 52 px`);
  await shot(p, "activate-done");
  /* renew: the kept reference is sent again */
  calls = [];
  await p.goto(base + "activate.html?renew=1"); await p.waitForTimeout(600);
  ok(calls.length === 1 && calls[0].session_id === REF, "renewing sends the kept reference again");
  await p.close();
  ctx.setDefaultTimeout(5000);
  for (const [label, service, want] of [
    ["an unpaid checkout", async () => ({ status: 402, body: { error: { code: "not_paid", message: "x" } } }), /Payment not finished/],
    ["an unknown checkout", async () => ({ status: 404, body: { error: { code: "not_found", message: "x" } } }), /could not find that payment/],
    ["too many tries", async () => ({ status: 429, body: { error: { code: "rate_limited", message: "x" } } }), /Too many tries/],
    ["a service that is down", async () => ({ status: 500, body: { error: { code: "internal", message: "x" } } }), /could not help just now/]
  ]) {
    const c = await context({ service });
    const q = await open(c, "activate.html?session_id=" + REF); await q.waitForTimeout(500);
    ok(want.test(await q.textContent("#actTitle")) && !(await q.evaluate(() => CognicopiaLicense.isLicensed())), `activate.html: ${label} is explained and unlocks nothing: ${await q.textContent("#actTitle")}`);
    ok(await visible(q, "#actInput"), `activate.html: ${label} still offers the box to paste a key`);
    await q.close();
  }
  {
    const c = await context({ service: null });   // the connection fails
    const q = await open(c, "activate.html?session_id=" + REF); await q.waitForTimeout(700);
    ok(/No connection/.test(await q.textContent("#actTitle")), "activate.html: no connection is explained: " + (await q.textContent("#actTitle")));
    await q.close();
    const n = await context({ cfg: CFG_BARE });   // the service address is still the placeholder
    const before = external.length;
    const r = await open(n, "activate.html?session_id=" + REF); await r.waitForTimeout(400);
    ok(/not switched on yet/.test(await r.textContent("#actTitle")) && external.length === before, "activate.html: with the service not set up it says so and sends nothing: " + (await r.textContent("#actTitle")));
    await r.fill("#actInput", KEY); await r.click("#actForm button[type=submit]"); await r.waitForTimeout(300);
    ok(await r.evaluate(() => CognicopiaLicense.isLicensed()), "activate.html: a pasted key works with no service at all");
    await r.close();
    /* with email delivery switched on (the license service also emails the key), the page tells a buyer to check their email, and says so even when the service cannot answer */
    const MAIL_CFG = CFG_FULL.replace("EMAIL_DELIVERY: false", "EMAIL_DELIVERY: true");
    ok(MAIL_CFG !== CFG_FULL, "the test could switch email delivery on");
    const mailOk = await context({ cfg: MAIL_CFG, service: async () => ({ status: 200, body: { license_key: KEY, facility_name: "Maple Court", tier: "annual_facility", expires_at: "2027-10-31" } }) });
    const m1 = await open(mailOk, "activate.html?session_id=" + REF); await m1.waitForTimeout(600);
    ok(/Full access is on/.test(await m1.textContent("#actTitle")) && /emailed your license key to the address you used at checkout/.test(await m1.textContent("#actText")), "activate.html: with email on, the page says the key was also emailed: " + (await m1.textContent("#actText")));
    await m1.close();
    const mailDown = await context({ cfg: MAIL_CFG, service: async () => ({ status: 500, body: { error: { code: "internal", message: "x" } } }) });
    const m2 = await open(mailDown, "activate.html?session_id=" + REF); await m2.waitForTimeout(500);
    ok(/Check your email for your license key/.test(await m2.textContent("#actTitle")) && /spam folder/.test(await m2.textContent("#actText")) && /cognicopia@outlook\.com/.test(await m2.textContent("#actText")) && await visible(m2, "#actInput"), "activate.html: with email on and the service down, it still says to check your email, where to look and who to write to: " + (await m2.textContent("#actTitle")));
    await m2.close();
    const mailNone = await context({ cfg: MAIL_CFG.replace(SERVICE, "https://REPLACE_ME.example/api/licenses/redeem") });
    const m3 = await open(mailNone, "activate.html?session_id=" + REF); await m3.waitForTimeout(400);
    ok(/Check your email for your license key/.test(await m3.textContent("#actTitle")), "activate.html: with email on and no service address yet, it says to check your email: " + (await m3.textContent("#actTitle")));
    await m3.close();
    const mailGone = await context({ cfg: MAIL_CFG, service: null });
    const m4 = await open(mailGone, "activate.html?session_id=" + REF); await m4.waitForTimeout(700);
    ok(/Check your email for your license key/.test(await m4.textContent("#actTitle")), "activate.html: with email on and no connection, it says to check your email: " + (await m4.textContent("#actTitle")));
    await m4.close();
    const b = await open(await context(), "activate.html?session_id=not-a-reference");
    ok(!(await b.evaluate(() => CognicopiaLicense.isLicensed())) && external.filter(e => e.page.includes("not-a-reference")).length === 0, "activate.html: a malformed reference is never sent anywhere");
    await b.close();
  }

  /* ---------- months offline: the license, a fake clock, a reload ---------- */
  ctx = await context(); p = await open(ctx, "index.html"); await p.evaluate(k => CognicopiaLicense.activateKey(k), KEY);
  const kept = await ctx.storageState(); await p.close();
  const at = async (iso) => { const c = await context({ storageState: kept, clock: Date.parse(iso) }); const q = await open(c, "index.html"); const r = await q.evaluate(() => ({ lic: CognicopiaLicense.isLicensed(), st: CognicopiaLicense.status(), badge: document.getElementById("licBadge").textContent })); await q.close(); return r; };
  const within = await at("2027-03-01T12:00:00Z"), lateGrace = await at("2028-01-15T12:00:00Z"), over = await at("2028-02-15T12:00:00Z");
  ok(within.lic && !within.st.inGrace, "five months into the year: licensed");
  ok(lateGrace.lic && lateGrace.st.inGrace, "two and a half months after the paid-through date (offline the whole time): still licensed, in its grace days");
  ok(!over.lic && over.st.lapsed && over.st.lapsed.facilityName === "Maple Court" && /free packets/.test(over.badge), "past the grace days: not licensed, and the page knows whose license ended");

  /* ---------- the Packet Builder ---------- */
  ctx = await context();
  p = await open(ctx, "builder.html");
  ok(await p.evaluate(() => FREE_RUNS === 25) && !(await visible(p, "#upgradeBanner")), "builder.html: 25 free packets and no banner at the start");
  await p.evaluate(() => { localStorage.setItem("cognicopia_gen_count", "20"); }); await p.reload(); await p.waitForTimeout(500);
  ok(await visible(p, "#upgradeBanner") && /5 free packets left/.test(await p.textContent("#upgradeBanner")), "builder.html: the banner appears for the last five packets");
  ok(/Get Full Access \(\$39\/mo or \$349\/yr\)/.test(await p.textContent("#upgradeBanner")) && /Request Corporate Invoice \/ W-9/.test(await p.textContent("#upgradeBanner")), "builder.html: the banner carries both buttons");
  ok(await tall(p, "#upgradeBanner a:has-text('Get Full Access')") >= 52 && await tall(p, "#upgradeBanner a:has-text('Request Corporate')") >= 52, "builder.html: the banner's buttons are at least 52 px");
  await shot(p, "builder-banner");
  await p.evaluate(() => { localStorage.setItem("cognicopia_gen_count", "25"); openGate(); }); await p.waitForTimeout(300);
  ok(await visible(p, "#gate") && (await p.textContent("#gateTitle")).includes("25 free packets"), "builder.html: the gate opens at 25");
  ok((await p.getAttribute("#gateMonthly", "href")) === MONTHLY && (await p.getAttribute("#gateAnnual", "href")) === ANNUAL && (await p.getAttribute("#gateInvoice", "href")) === "contact.html?subject=Corporate+Invoice+Request", "builder.html: monthly, annual and invoice buttons");
  ok(/Best value/.test(await p.textContent("#gate")) && /save about 25%/.test(await p.textContent("#gate")) && /Net-30/.test(await p.textContent("#gate")), "builder.html: the gate states best value, the saving and net-30");
  for (const id of ["#gateMonthly", "#gateAnnual", "#gateInvoice", "#gateUnlock", "#gateClose", "#gateCode"]) ok(await tall(p, id) >= 52, `builder.html: ${id} is at least 52 px`);
  await shot(p, "builder-gate");
  await p.fill("#gateCode", KEY); await p.click("#gateUnlock"); await p.waitForTimeout(300);
  ok(await p.evaluate(() => isLicensed()) && !(await visible(p, "#upgradeBanner")), "builder.html: a pasted key unlocks it and hides the banner");
  await p.close();
  /* the placeholder links: no dead page, no test link */
  const bare = await context({ cfg: CFG_BARE });
  p = await open(bare, "index.html"); await p.evaluate(() => { openGate(); });
  ok((await p.getAttribute("#gateMonthly", "href")) === "contact.html?subject=Corporate+Invoice+Request&plan=monthly" && /Request this plan/.test(await p.textContent("#gateMonthly")), "with the Payment Links not set up the plan buttons ask for an invoice instead of opening a dead page");
  await p.close();
  const testLink = await context({ cfg: CFG_FULL.replace(MONTHLY, "https://buy.stripe.com/test_4gwabc1234") });
  p = await open(testLink, "index.html"); await p.evaluate(() => { openGate(); });
  ok(!(await p.getAttribute("#gateMonthly", "href")).includes("buy.stripe.com") && (await p.getAttribute("#gateAnnual", "href")) === ANNUAL, "a Payment Link with test_ in it is never offered");
  await p.close();

  /* ---------- the pricing page ---------- */
  ctx = await context();
  p = await open(ctx, "pricing.html");
  const text = await p.textContent("main");
  ok(/\$39/.test(text) && /\$349/.test(text) && /Save \$119/.test(text) && /Best value/.test(text) && /Custom quote/.test(text) && /first 25 packets/.test(text), "pricing.html: monthly, annual with the saving, best value, enterprise and the 25-packet trial");
  ok((await p.getAttribute("#payMonthly", "href")) === MONTHLY && (await p.getAttribute("#payAnnual", "href")) === ANNUAL && /Pay by card/.test(await p.textContent("#payMonthly")), "pricing.html: the buy buttons are the Payment Links when they are set");
  ok((await p.getAttribute("#quoteEnterprise", "href")) === "contact.html?subject=Enterprise+Multi-Facility+Quote", "pricing.html: the enterprise button asks for a quote");
  for (const sel of ["#payMonthly", "#payAnnual", "#quoteEnterprise", "#invoice .plan-btn", "summary"]) ok(await tall(p, sel) >= 52, `pricing.html: ${sel} is at least 52 px`);
  await shot(p, "pricing");
  await p.close();
  p = await open(await context({ cfg: CFG_BARE }), "pricing.html");
  ok((await p.getAttribute("#payMonthly", "href")) === "contact.html?subject=Corporate+Invoice+Request" && /Request the monthly plan/.test(await p.textContent("#payMonthly")), "pricing.html: until the links are set the buttons ask for an invoice");
  await p.close();
  p = await open(await context({ viewport: { width: 390, height: 844 } }), "pricing.html");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "pricing.html: no sideways scrolling on a phone");
  await shot(p, "pricing-phone");
  await p.close();

  /* ---------- the invoice request ---------- */
  ctx = await context();
  p = await open(ctx, "contact.html?subject=Corporate+Invoice+Request&plan=annual");
  ok(await visible(p, "#requestCard") && /corporate invoice and W-9/i.test(await p.textContent("#requestTitle")), "contact.html: ?subject=Corporate+Invoice+Request shows the request");
  const mail = decodeURIComponent(await p.getAttribute("#requestBtn", "href"));
  ok(/^mailto:cognicopia@outlook\.com\?subject=Cognicopia — Corporate Invoice Request/.test(mail) && /Plan: Annual \(\$349 a year\)/.test(mail) && /W-9|ACH/.test(mail + (await p.textContent("#requestList"))) && /Purchase order/.test(mail), "contact.html: the email is addressed, subject filled in, with a checklist");
  ok((await p.$$("#requestList li")).length >= 5 && await tall(p, "#requestBtn") >= 52, "contact.html: the checklist and a 52 px button");
  await shot(p, "contact-invoice");
  await p.close();
  p = await open(ctx, "contact.html?subject=" + encodeURIComponent("<img src=x onerror=alert(1)>Hello"));
  ok(await p.evaluate(() => !document.querySelector("#requestCard img") && /Hello/.test(document.getElementById("requestTitle").textContent) && !/[<>]/.test(document.getElementById("requestTitle").textContent)), "contact.html: a hostile subject is shown as plain words");
  await p.close();
  p = await open(ctx, "contact.html");
  ok(!(await visible(p, "#requestCard")), "contact.html: with no subject the page is as it was");
  await p.close();

  /* ---------- a licensed computer sees no buy buttons on any kind of page ---------- */
  ctx = await context({ storageState: kept });
  for (const url of ["index.html", "contact.html", "resources/index.html", "resources/research/music-dementia/index.html", "pricing.html"]) {
    const q = await open(ctx, url);
    ok(await visible(q, "#cgPromoBadge") && (await q.locator("a[data-upgrade-prompt]").evaluateAll(a => a.every(x => getComputedStyle(x).display === "none"))), `${url}: licensed, the badge shows and every buy button is hidden`);
    await q.close();
  }

  /* ---------- who talked to the internet ---------- */
  const strangers = external.filter(e => !/activate\.html/.test(e.page));
  ok(strangers.length === 0, "only activate.html contacted anything: " + strangers.slice(0, 3).map(e => e.page + " -> " + e.url).join("; "));
  ok(external.every(e => e.url.startsWith("https://license.example.test/")), "and only the license service: " + external.map(e => e.url).filter(u => !u.startsWith("https://license.example.test/")).join(", "));
  ok(errors.length === 0, "no script errors on any of these pages" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `licensing behavior check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `licensing behavior check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
