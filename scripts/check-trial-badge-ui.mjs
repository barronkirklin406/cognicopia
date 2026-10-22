#!/usr/bin/env node
/* =====================================================================
   The free-trial badge, the hero button and the "all used" window, in a real browser.
   Run: node scripts/check-trial-badge-ui.mjs  (needs Playwright; exits 2 where it is missing)

     badge    "Free Trial: 25 / 25 Generations Remaining" in the action bar under the navigation (and the packet tool's wood bar),
              on a new computer, on a page that is not the front page, and counting down as packets are made (24 / 25), live and
              with no reload; the number is also kept in localStorage under cognicopia_trial_generations (25 on a first visit);
              a licensed computer sees no badge; at none left it says 0 / 25; clearing that one number does not give packets back
     hero     "Start Free Trial - 25 Free Activity Generations" with "No credit card required. Pure high-contrast B&W printables &
              interactive tablet games." directly beneath it; both fit a phone (390 px) with no sideways scroll
     window   with the 25 used, making a packet opens a window titled "You've used all 25 Free Trial Generations!" that explains
              the card (Stripe) and the Net-30 purchase-order routes and has "Activate Annual / Monthly License" and
              "Request Net-30 Invoice", 52 px tall, Escape closes it; the Packet Builder's gate says the same
   ===================================================================== */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadPlaywright, serve } from "./lib/browser.mjs";
import { issue } from "./issue-license.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const BADGE = "Free Trial: 25 / 25 Generations Remaining";

async function open(ctx, file, vp) {
  const p = await ctx.newPage(); if (vp) await p.setViewportSize(vp);
  p.on("pageerror", e => errors.push(file + ": " + e.message));
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + file); await p.waitForTimeout(900);
  return p;
}
const badge = (p, sel = "[data-cg-trial]") => p.evaluate(s => [...document.querySelectorAll(s)].filter(e => !e.hidden && e.getBoundingClientRect().width > 0).map(e => e.textContent.replace(/\s+/g, " ").trim()), sel);

try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } window.print = () => {}; });

  /* ---- a new computer ---- */
  let p = await open(ctx, "index.html");
  ok((await badge(p)).includes(BADGE), "index.html: a new computer shows " + BADGE + " (" + JSON.stringify(await badge(p)) + ")");
  ok(await p.evaluate(() => localStorage.getItem("cognicopia_trial_generations")) === "25", "and keeps 25 under cognicopia_trial_generations");
  const hero = await p.evaluate(() => { const b = document.getElementById("heroTrial"), s = document.getElementById("heroTrialSub"), r = b.getBoundingClientRect(), q = s.getBoundingClientRect(); return { b: b.textContent.trim(), s: s.textContent.trim(), below: q.top >= r.bottom - 1, h: r.height, href: b.getAttribute("href") }; });
  ok(hero.b === "Start Free Trial — 25 Free Activity Generations", "the hero button says: " + hero.b);
  ok(hero.s === "No credit card required. Pure high-contrast B&W printables & interactive tablet games.", "and its subtitle: " + hero.s);
  ok(hero.below && hero.h >= 52 && hero.href === "#make", `the subtitle is directly beneath it, the button is ${Math.round(hero.h)} px tall and goes to the packet tool`);

  /* ---- another page: the action bar ---- */
  const q = await open(ctx, "pricing.html");
  ok((await badge(q)).includes(BADGE), "pricing.html: the action bar under the navigation shows the same badge");
  const box = await q.evaluate(() => { const e = document.querySelector("[data-cg-trial]"), r = e.getBoundingClientRect(), t = document.querySelector(".cg-topbar").getBoundingClientRect(); return { h: r.height, inBar: r.top >= t.top - 1 && r.bottom <= t.bottom + 1 }; });
  ok(box.h >= 52 && box.inBar, `it sits inside the navigation's bar and is ${Math.round(box.h)} px tall`);

  /* ---- counting down, live ---- */
  await p.evaluate(() => { bumpGen(); });
  await p.waitForTimeout(500);
  ok((await badge(p)).includes("Free Trial: 24 / 25 Generations Remaining"), "after one packet the front page says 24 / 25 with no reload (" + JSON.stringify(await badge(p)) + ")");
  ok(await p.evaluate(() => localStorage.getItem("cognicopia_trial_generations")) === "24", "and the kept number is 24");
  await q.reload(); await q.waitForTimeout(900);
  ok((await badge(q)).includes("Free Trial: 24 / 25 Generations Remaining"), "another page reads the same count (24 / 25)");
  await p.evaluate(() => localStorage.setItem("cognicopia_trial_generations", "25")); await p.reload(); await p.waitForTimeout(1200);
  ok((await badge(p)).some(t => /24 \/ 25/.test(t)), "typing 25 into the kept number gives nothing back: the ledger's count still says 24");

  /* ---- a real packet from the packet tool counts ---- */
  for (const [id, v] of [["first", "Test"], ["born", "1938"], ["town", "Minot"], ["state", "North Dakota"]]) await p.fill("#" + id, v);
  await p.evaluate(() => document.getElementById("qpbGenerate").scrollIntoView({ block: "center", behavior: "instant" }));
  await p.click("#qpbGenerate"); await p.waitForSelector("#qpbPreview .qp-sheet", { timeout: 30000 });
  await p.click("#qpbPrint"); await p.waitForTimeout(700);
  ok((await badge(p)).some(t => /23 \/ 25/.test(t)), "printing a packet from the packet tool takes one more: 23 / 25 (" + JSON.stringify(await badge(p)) + ")");

  /* ---- low and none ---- */
  await p.evaluate(() => { for (let i = 0; i < 20; i++) bumpGen(); }); await p.waitForTimeout(500);
  ok((await badge(p)).some(t => /3 \/ 25/.test(t)) && await p.evaluate(() => document.querySelector("[data-cg-trial]").classList.contains("cg-trial-low")), "at 3 left the badge turns amber");
  await p.evaluate(() => { for (let i = 0; i < 3; i++) bumpGen(); }); await p.waitForTimeout(500);
  ok((await badge(p)).some(t => /0 \/ 25/.test(t)), "at the end it says 0 / 25");

  /* ---- the window ---- */
  await p.evaluate(() => document.getElementById("qpbGenerate").scrollIntoView({ block: "center", behavior: "instant" }));
  await p.click("#qpbGenerate").catch(() => {}); await p.waitForTimeout(600);
  if (!(await p.evaluate(() => document.getElementById("gate").style.display === "block"))) { await p.click("#qpbPrint").catch(() => {}); await p.waitForTimeout(600); }
  const gate = await p.evaluate(() => { const g = document.getElementById("gate"), r = g.getBoundingClientRect(), a = document.getElementById("gateActivate"), n = document.getElementById("gateNet30");
    return { open: g.style.display === "block", title: document.getElementById("gateTitle").textContent.trim(), text: document.getElementById("gateText").textContent, fixed: getComputedStyle(g).position === "fixed", fit: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight + 1, aText: a && a.textContent.trim(), nText: n && n.textContent.trim(), aH: a && a.getBoundingClientRect().height, nH: n && n.getBoundingClientRect().height, aHref: a && a.getAttribute("href"), nHref: n && n.getAttribute("href"), modal: g.getAttribute("role") === "dialog" && g.getAttribute("aria-modal") === "true" }; });
  ok(gate.open && gate.fixed && gate.modal && gate.fit, "with the 25 used the window opens over the page, inside the screen: " + JSON.stringify({ open: gate.open, fixed: gate.fixed, fit: gate.fit }));
  ok(gate.title === "You’ve used all 25 Free Trial Generations!", "its title: " + gate.title);
  ok(/annual or monthly license/.test(gate.text) && /credit card/.test(gate.text) && /Stripe/.test(gate.text) && /Net-30/.test(gate.text) && /purchase-order/.test(gate.text), "its words explain the card (Stripe) and the Net-30 purchase-order routes");
  ok(gate.aText === "Activate Annual / Monthly License" && gate.nText === "Request Net-30 Invoice" && gate.aH >= 52 && gate.nH >= 52, "its two buttons: " + gate.aText + " | " + gate.nText + ` (${Math.round(gate.aH)} and ${Math.round(gate.nH)} px)`);
  ok(/pricing\.html#plans$/.test(gate.aHref) && /pricing\.html#invoice$/.test(gate.nHref), "and they go to the plans and to the invoice form on the pricing page");
  await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.getElementById("gate").style.display === "none"), "Escape closes it");

  /* ---- licensed: no badge ---- */
  const { privateKey, publicKey } = crypto.generateKeyPair ? crypto.generateKeyPairSync("ec", { namedCurve: "P-256" }) : {};
  const jwk = publicKey.export({ format: "jwk" }), hx = b => Buffer.from(b, "base64url").toString("hex").padStart(64, "0");
  const PUB = "04" + hx(jwk.x) + hx(jwk.y);
  const cfg = fs.readFileSync(path.join(process.cwd(), "src/config/license.js"), "utf8").replace(/PUBLIC_KEYS: Object\.freeze\(\[[^\]]*\]\)/, `PUBLIC_KEYS: Object.freeze(["${PUB}"])`);
  const KEY = issue({ facility: "Maple Court", tier: "annual_facility", until: "2099-10-31", id: "lic_trial_test" }, privateKey.export({ type: "pkcs8", format: "pem" })).token;
  const lc = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  await lc.route("**/src/config/license.js", r => r.fulfill({ contentType: "text/javascript", body: cfg }));
  const lic = await lc.newPage();
  await lic.goto(base + "pricing.html"); await lic.waitForTimeout(500);
  ok((await badge(lic)).length === 1, "before a license the badge shows on the pricing page");
  await lic.evaluate(k => window.CognicopiaLicense.activateKey(k), KEY); await lic.waitForTimeout(800);
  ok((await badge(lic)).length === 0, "a licensed computer sees no badge");

  /* ---- the phone ---- */
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await m.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } window.print = () => {}; });
  const mp = await open(m, "index.html"); await mp.waitForTimeout(500);
  const ph = await mp.evaluate(() => ({ wide: document.documentElement.scrollWidth - innerWidth, btn: document.getElementById("heroTrial").getBoundingClientRect().right <= innerWidth, sub: document.getElementById("heroTrialSub").getBoundingClientRect().right <= innerWidth }));
  ok(ph.wide <= 1 && ph.btn && ph.sub, "at 390 px the hero button and subtitle fit with no sideways scroll");
  await mp.screenshot({ path: "/tmp/trial-hero-390.png" });

  /* ---- the Packet Builder's own window ---- */
  const bp = await open(ctx, "builder.html"); await bp.waitForSelector("#gateTitle", { state: "attached" });
  ok((await badge(bp)).length === 1, "builder.html: the badge is in the strip under the top bar (" + JSON.stringify(await badge(bp)) + ")");
  ok((await bp.textContent("#gateTitle")).trim() === "You’ve used all 25 Free Trial Generations!", "builder.html: the gate carries the same title");
} finally { await browser.close(); srv.close(); }

ok(foreign.length === 0, "nothing was requested from outside the site" + (foreign.length ? ": " + foreign.slice(0, 3).join(", ") : ""));
ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
console.log(problems.length ? `trial badge check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ") : `trial badge check passed: ${passed} checks in a real browser (the badge counting down on every page, the hero button, the window when the 25 are used)`);
process.exit(problems.length ? 1 : 0);
