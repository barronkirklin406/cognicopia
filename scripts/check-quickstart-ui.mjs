#!/usr/bin/env node
/* =====================================================================
   The packet tool's quick start (packet.html), in a real browser (the owner's playbook, Phase 2: "ask for only three facts up front").
     three      step 1 opens with three boxes and one button: first name, year of birth, one joy; then "Make my first packet"
     joy        the one joy becomes their first pastime (the hobbies box in step 4) without being typed twice
     packet     those three alone make a whole packet, read back as a real PDF download
     next       once it is saved, the page offers "Add more life details (6-step profile)", going to the profile form
     look       52 px controls and text at 7:1 or better, by day and in Night Shift, on a laptop and a phone, nothing sideways
   Needs Playwright. Run: node scripts/check-quickstart-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const measure = p => p.evaluate(() => {
  const lum = c => { const m = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > .5)) return c; } return "rgb(255,255,255)"; };
  const box = document.getElementById("qs"), low = [], small = [];
  [box, ...box.querySelectorAll("*")].forEach(el => {
    if ([...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && el.getBoundingClientRect().width) {
      const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)), r = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
      if (r < 7) low.push(r.toFixed(1) + " " + el.textContent.trim().slice(0, 24));
    }
    if (el.matches("input, button")) { const r = el.getBoundingClientRect(); if (r.height < 52) small.push(Math.round(r.height) + " " + (el.id || el.textContent.trim())); }
  });
  return { low, small, side: document.documentElement.scrollWidth <= innerWidth + 1 };
});

try {
  for (const [w, h, night] of [[1366, 900, false], [390, 844, false], [1366, 900, true], [390, 844, true]]) {
    const tag = `${w} px${night ? ", Night Shift" : ""}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", acceptDownloads: true });
    await ctx.addInitScript(on => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (on) localStorage.setItem("cognicopia_night_shift", "1"); } catch (e) { /* ignore */ } }, night);
    const p = await ctx.newPage(); p.on("pageerror", e => errors.push(e.message));
    await p.goto(base + "packet.html"); await p.waitForTimeout(1500);
    if (night) { await p.evaluate(() => { document.documentElement.classList.add("cg-night-shift"); document.body.classList.add("cg-night-shift"); }); await p.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})))); await p.waitForTimeout(200); }
    const m = await measure(p);
    ok(m.low.length === 0, `${tag}: the quick start's words read at 7:1 or better` + (m.low.length ? ": " + m.low.slice(0, 3).join("; ") : ""));
    ok(m.small.length === 0, `${tag}: its boxes and button are at least 52 px` + (m.small.length ? ": " + m.small.join("; ") : ""));
    ok(m.side, `${tag}: nothing scrolls sideways`);
    if (night) { await ctx.close(); continue; }
    const order = await p.$$eval("#qs input, #qs button", e => e.map(x => x.id));
    ok(order.join(",") === "first,born,joy,goQuick", `${tag}: step 1 opens with three boxes and one button: first name, year of birth, one joy, Make my first packet (${order.join(", ")})`);
    await p.fill("#first", "Ruthanne"); await p.fill("#born", "1941"); await p.fill("#joy", "baking pies");
    ok(await p.inputValue("#hobbies") === "baking pies", `${tag}: the one joy becomes their first pastime in step 4, typed once`);
    const dl = p.waitForEvent("download", { timeout: 90000 }).catch(() => null);
    await p.click("#goQuick");
    const d = await dl;
    ok(!!d && /Ruthanne/.test(await d.suggestedFilename()), `${tag}: the three facts alone make a whole packet (${d ? await d.suggestedFilename() : "no download"})`);
    await p.waitForTimeout(500);
    const next = await p.evaluate(() => { const a = document.getElementById("qsMore"); const r = a.getBoundingClientRect(); return { text: a.textContent.trim(), href: a.getAttribute("href"), h: r.height, shown: !!a.offsetParent }; });
    ok(next.shown && /^Add more life details \(6-step profile\)/.test(next.text) && next.href === "profile.html" && next.h >= 52, `${tag}: once it is saved the page offers Add more life details (6-step profile), going to the profile (${JSON.stringify(next)})`);
    await ctx.close();
  }
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `quick start check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `quick start check passed: ${passed} checks in a real browser (three boxes and one button first, the joy typed once, a whole packet from three facts, the offer of the full profile, 52 px and 7:1 by day and in Night Shift, laptop and phone)`);
process.exit(problems.length ? 1 : 0);
