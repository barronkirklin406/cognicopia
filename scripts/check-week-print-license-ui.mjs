#!/usr/bin/env node
/* =====================================================================
   Printing a week or a month for a whole wing needs a facility license or a 30-day pilot key (CLAUDE.md: "Printing for a whole building"),
   in a real browser on the Packet Builder's Facility Portal (the example community, made-up people only).

     unlicensed   "Print the week" and "Print the month" open the license window with the reason, print nothing, and spend no free packet
     licensed     with a signed key, the same buttons print, and still spend no free packet
     all          nothing is requested from outside the page, and no page script fails

   Needs Playwright (exit 2 where it is not installed). Run: node scripts/check-week-print-license-ui.mjs
   ===================================================================== */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { loadPlaywright, serve, ROOT, agreed, agreeToDialogs } from "./lib/browser.mjs";
import { issue } from "./issue-license.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

/* a key pair for the test, and the site's config holding its public key (the same way scripts/check-license-ui.mjs does it) */
const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }), jwk = publicKey.export({ format: "jwk" });
const hx = b => Buffer.from(b, "base64url").toString("hex").padStart(64, "0");
const PUB = "04" + hx(jwk.x) + hx(jwk.y);
const CFG = fs.readFileSync(path.join(ROOT, "src/config/license.js"), "utf8").replace(/PUBLIC_KEYS: Object\.freeze\(\[[^\]]*\]\)/, `PUBLIC_KEYS: Object.freeze(["${PUB}"])`);
const KEY = issue({ facility: "Maple Court", tier: "annual_facility", until: "2027-10-31", id: "lic_week_test" }, pem).token;

try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", timezoneId: "America/Chicago" }); await agreed(ctx);
  await ctx.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await ctx.route("**/src/config/license.js", r => r.fulfill({ contentType: "text/javascript", body: CFG }));
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("dialog", d => d.accept()); await agreeToDialogs(p);
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "builder.html#/facility", { waitUntil: "load" }); await p.waitForTimeout(1800);
  await p.click("#fpTab-w-mcw"); await p.waitForTimeout(500);
  const auto = p.locator("button", { hasText: /Auto-populate/ }).first();
  if (await auto.count()) { await auto.click(); await p.waitForTimeout(800); }   // the month is empty until it is filled
  await p.click("#fpSub-print"); await p.waitForTimeout(500);
  /* pick a week that has pages: the print button is switched off for an empty week */
  for (const v of await p.$$eval("#fpWeek option", o => o.map(x => x.value))) {
    if (!(await p.locator('[data-act="print-week"]').isDisabled())) break;
    await p.selectOption("#fpWeek", v); await p.waitForTimeout(400);
  }

  const printed = () => p.evaluate(() => window.__printed || 0);
  const count = () => p.evaluate(() => genCount());
  const open = () => p.locator("#cgPromoModal").isVisible().catch(() => false);
  const said = async () => ((await p.locator("#cgPromoModal").textContent().catch(() => "")) || "").replace(/\s+/g, " ");
  const close = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(300); };

  ok(await p.locator('[data-act="print-week"]').count() === 1 && !(await p.locator('[data-act="print-week"]').isDisabled()), "the week print button is there and has pages to print");
  const before = await count();

  /* ---------- no license ---------- */
  await p.click('[data-act="print-week"]'); await p.waitForTimeout(500);
  ok(await open(), "no license: the week print opens the license window");
  ok(/Printing a week of packets for a whole wing is for facilities/.test(await said()), "no license: the window says why: " + (await said()).slice(0, 160));
  ok(await printed() === 0, "no license: the week print did not print");
  ok(await count() === before, "no license: the week print spent no free packet");
  await close();

  if (await p.locator('[data-act="print-month"]').count()) {
    await p.click('[data-act="print-month"]'); await p.waitForTimeout(500);
    ok(await open(), "no license: the month print opens the license window");
    ok(/Printing a month of calendars for a whole wing is for facilities/.test(await said()), "no license: the window says why for the month: " + (await said()).slice(0, 160));
    ok(await printed() === 0, "no license: the month print did not print");
    ok(await count() === before, "no license: the month print spent no free packet");
    await close();
  } else problems.push("the month print button is not on the screen");

  /* ---------- a signed key ---------- */
  const r = await p.evaluate(k => window.CognicopiaLicense.activateKey(k), KEY);
  ok(r && r.ok, "the test key is accepted: " + JSON.stringify(r));
  await close(); await p.waitForTimeout(300);
  await p.click("#fpSub-print"); await p.waitForTimeout(400);
  await p.click('[data-act="print-week"]'); await p.waitForTimeout(1200);
  ok(!(await open()), "licensed: the week print does not open the license window");
  ok(await printed() >= 1, "licensed: the week print prints");
  ok(await count() === before, "licensed: the week print spends no free packet");

  ok(foreign.length === 0, "nothing was requested from outside the page: " + foreign.slice(0, 3));
  ok(errors.length === 0, "no page script fails: " + errors.slice(0, 3));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `week-print license check FAILED: ${problems.length} problem(s)\n  - ` + problems.join("\n  - ") : `week-print license check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
