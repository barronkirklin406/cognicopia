#!/usr/bin/env node
/* =====================================================================
   The Activity Page Studio and the free trial, in a real browser.

   The Studio used to show "50 of 50 free packets left" and then never count a packet or stop anyone, so
   anyone could make unlimited free packets there. It now behaves like the Packet Builder:

     count      printing or making a PDF uses one free packet (the count the badge and the other tools share);
                the preview, changing a setting and "Try different pages" use none
     shared     the badge in the action bar and the line by the buttons show the same number
     gate       when the free packets are used up, print, the PDF and the page image open a window that
                offers plans and a license key, and make nothing
     licensed   a real signed license key means no limit, no counting and no window
     private    nothing was requested from outside the page
   Needs Playwright. Run: node scripts/check-studio-trial-ui.mjs
   ===================================================================== */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { loadPlaywright, serve, ROOT } from "./lib/browser.mjs";
import { issue } from "./issue-license.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

/* a key pair for the test: the site's config trusts the test's public half, so a key made here is a real signed key to the page */
const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }), jwk = publicKey.export({ format: "jwk" });
const hx = b => Buffer.from(b, "base64url").toString("hex").padStart(64, "0");
const PUB = "04" + hx(jwk.x) + hx(jwk.y);
const CFG = fs.readFileSync(path.join(ROOT, "src/config/license.js"), "utf8").replace(/PUBLIC_KEYS: Object\.freeze\(\[[^\]]*\]\)/, `PUBLIC_KEYS: Object.freeze(["${PUB}"])`);
const KEY = issue({ facility: "Maple Court", tier: "annual_facility", until: "2099-10-31", id: "lic_studio_test" }, pem).token;

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
  await ctx.route("**/src/config/license.js", r => r.fulfill({ contentType: "text/javascript", body: CFG }));
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "activity-studio.html", { waitUntil: "load" }); await p.waitForSelector("#asSheet svg", { timeout: 10000 }); await p.waitForTimeout(900);
  return { ctx, p };
}
const left = p => p.$eval("#asLeft", e => e.textContent.trim());
const badge = p => p.$eval("[data-cg-trial]", e => e.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const gateOpen = p => p.$eval("#asGate", d => d.open);
async function makePdf(p) { const dl = p.waitForEvent("download", { timeout: 7000 }).catch(() => null); await p.click("#asPdf"); return dl; }
/* the page's own ledger, so the test can put the count where a person would have taken it */
const setUsed = (p, n) => p.evaluate(async n => { const l = window.CogniTrialLedger.forBrowser(window.CogniSecureStore.storage); await l.ready(); while (l.count() < n) l.record(); }, n);

try {
  /* ----- counting ----- */
  const a = await open();
  ok(/50 of 50 free packets left/.test(await left(a.p)), `a fresh computer starts with 50 free packets (${await left(a.p)})`);
  ok(/50 of 50/.test(await badge(a.p)), `the action bar badge agrees (${await badge(a.p)})`);
  await a.p.click("#asRandom"); await a.p.waitForTimeout(500);
  await a.p.evaluate(() => document.querySelector('input[name="stage"][value="1"]').click()); await a.p.waitForTimeout(500);
  ok(/50 of 50/.test(await left(a.p)), "previewing, changing a setting and trying different pages use none");
  const dl1 = await makePdf(a.p);
  ok(!!dl1, "a PDF is made while free packets remain");
  await a.p.waitForTimeout(900);
  ok(/49 of 50/.test(await left(a.p)), `making a PDF uses one (${await left(a.p)})`);
  ok(/49 of 50/.test(await badge(a.p)), `the badge moved too, from the same count (${await badge(a.p)})`);
  await a.p.reload({ waitUntil: "load" }); await a.p.waitForSelector("#asSheet svg"); await a.p.waitForTimeout(1200);
  ok(/49 of 50/.test(await left(a.p)), "the count survives a reload");

  /* print uses one too (the browser's own print window is stubbed so the test can count it) */
  await a.p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await a.p.click("#asPrint"); await a.p.waitForTimeout(1200);
  ok(await a.p.evaluate(() => window.__printed) === 1 && /48 of 50/.test(await left(a.p)), `printing uses one (${await left(a.p)})`);

  /* ----- the gate ----- */
  await setUsed(a.p, 50); await a.p.waitForTimeout(500);
  ok(/0 of 50/.test(await left(a.p)), `with all 50 used the line says so (${await left(a.p)})`);
  const none = await makePdf(a.p); await a.p.waitForTimeout(600);
  ok(!none && await gateOpen(a.p), "the PDF button opens the license window and makes nothing");
  ok(/used all 50 free packets/.test(await a.p.textContent("#asGateT")) && await a.p.$eval("#asGatePlans", e => /pricing\.html$/.test(e.href)), "the window says what happened and offers the plans");
  ok((await a.p.$$eval("#asGate .as-btn", b => b.map(x => x.getBoundingClientRect().height))).every(h => h >= 52), "its buttons are 52 px tall");
  await a.p.click("#asGateClose"); await a.p.waitForTimeout(200);
  ok(!(await gateOpen(a.p)), "'Not now' closes it");
  await a.p.evaluate(() => { window.__printed = 0; });
  await a.p.click("#asPrint"); await a.p.waitForTimeout(600);
  ok(await a.p.evaluate(() => window.__printed) === 0 && await gateOpen(a.p), "print is stopped the same way");
  await a.p.click("#asGateClose");
  await a.p.click("#asPng"); await a.p.waitForTimeout(600);
  ok(await gateOpen(a.p), "so is the page image");
  await a.p.click("#asGateClose");
  ok(/50 of 50|0 of 50/.test(await left(a.p)) && (await a.p.evaluate(() => window.CogniTrialLedger.forBrowser(window.CogniSecureStore.storage).count())) === 50, "a refused try does not use another packet");
  await a.p.click("#asRandom"); await a.p.waitForTimeout(400);
  ok(await a.p.$$eval("#asSheet svg", s => s.length) > 0, "the preview still works with the free packets used up: only the output is held");
  await a.ctx.close();

  /* ----- a real license key means no limit ----- */
  const b = await open();
  await setUsed(b.p, 50);
  const r = await b.p.evaluate(k => window.CognicopiaLicense.activateKey(k), KEY);
  await b.p.waitForTimeout(600);
  ok(r && (r.ok === true || r.success === true || r.status === "ok" || r.valid === true || r.facilityName) , `a real signed key is accepted (${JSON.stringify(r).slice(0, 90)})`);
  ok(await b.p.evaluate(() => window.CognicopiaLicense.isLicensed()), "the page now counts as licensed");
  ok(/Licensed: unlimited/.test(await left(b.p)), `the line says so (${await left(b.p)})`);
  const dl2 = await makePdf(b.p);
  ok(!!dl2 && !(await gateOpen(b.p)), "a licensed computer makes the PDF with all 50 used, and no window opens");
  await b.p.waitForTimeout(700);
  ok((await b.p.evaluate(() => window.CogniTrialLedger.forBrowser(window.CogniSecureStore.storage).count())) === 50, "and a licensed packet is not counted");
  await b.ctx.close();

  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `studio trial check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `studio trial check passed: ${passed} checks in a real browser (a packet uses one free packet, the badge and the line agree, the gate stops print, PDF and image when all 50 are used, a real signed key means no limit, nothing leaves the page)`);
process.exit(problems.length ? 1 : 0);
