#!/usr/bin/env node
/* =====================================================================
   "How to use · Clinical tip" (js/helpTips.js) and the Speak button beside a text box (js/dictateField.js), in a real
   browser.

     help       the Activity Page Studio, the Packet Builder's home and the Facility Portal each have a 52 px button that
                opens three steps and one clinical tip (from the vetted staff cues), written in whole sentences;
                "Another tip" gives a different one; it closes again; it stays when the Portal's tabs change
     speak      the resident profile's notes and the Shift board's note have a Speak button. The page never asks the
                browser about speech until it is pressed (this test browser closes a page that asks). With speech that
                stays on the device (a stand-in for the browser's own), pressing it listens, what is said is added to
                the box and the box's counter follows, and pressing again stops; where the browser cannot confirm
                speech stays on the device, the button greys out and says why, and typing works as always
     names      on the Shift board, a resident's name dictated into a note brings up the same warning as a typed one
     fingers    every new control 52 px and readable, by day and in Night Shift, at 1366 x 768 and 390 x 844
     private    nothing is requested from outside the page; no script errors
   What this cannot prove: real on-device speech recognition in the owner's browsers. Made-up people only.
   Needs Playwright. Run: node scripts/check-help-dictation-ui.mjs
   ===================================================================== */
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const DOT = { schema: "cognicopia.residentProfile", version: 2, id: "res-dot", tier1_core: { preferredName: "Dorothy Example", cognitiveTier: 2, unitNumber: "302-B", printNeeds: {}, topicsToAvoid: { topics: [], other: "" } }, tier2_enrichment: { birthYear: 1938 } };

/* speech: "available" (recognized on this device), "unavailable" (the browser cannot say), or "real" (this browser's own) */
async function open(w, h, file, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
  await ctx.addInitScript(a => {
    try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (a.night) localStorage.setItem("cognicopia_night_shift", "1"); } catch (e) { /* ignore */ }
    if (a.speech === "real") return;
    window.__asked = 0;
    class StandIn { static async available() { window.__asked++; return a.speech === "available" ? "available" : "unavailable"; } start() { window.__sr = this; } stop() { const e = this.onend; window.__sr = null; if (e) e(); } }
    window.SpeechRecognition = StandIn; window.webkitSpeechRecognition = StandIn;
    window.__say = t => { const r = window.__sr; if (r && r.onresult) r.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] }); return !!r; };
  }, { speech: o.speech || "available", night: !!o.night });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("crash", () => errors.push("the page crashed: " + file));
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + file, { waitUntil: "load" }); await p.waitForTimeout(1200);
  return { ctx, p };
}
/* the profile's notes are on a later step: fill the first step's name and year, then press Next until they show */
const toNotes = async p => { await p.fill("#rapName", "Dorothy").catch(() => {}); await p.fill("#rapBorn", "1938").catch(() => {});
  for (let i = 0; i < 8 && !(await p.$eval("#rapNotes", e => e.getBoundingClientRect().height > 0)); i++) { await p.click("#rapNext").catch(() => {}); await p.waitForTimeout(250); } };
const seed = (p, list) => p.evaluate(l => { l.forEach(x => window.CogniSecureStore.storage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); return window.CogniSecureStore.flush(); }, list);
const measure = (p, sel) => p.evaluate(s => {
  const lum = c => { const m = c.match(/[\d.]+/g); const [r, g, b] = m.slice(0, 3).map(v => { v = v / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor, m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > .5)) return c; } return "rgb(255,255,255)"; };
  const small = [], low = [], boxes = [...document.querySelectorAll(s)];
  if (!boxes.length) return { small: ["missing " + s], low };
  boxes.forEach(box => {
    box.querySelectorAll("button").forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.height && (r.width < 52 || r.height < 52)) small.push(`${Math.round(r.width)}x${Math.round(r.height)} "${el.textContent.trim().slice(0, 20)}"`); });
    box.querySelectorAll("*").forEach(el => { if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return; const r = el.getBoundingClientRect(); if (!r.width) return;
      const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05); if (ratio < 4.5) low.push(`${ratio.toFixed(2)} "${el.textContent.trim().slice(0, 24)}"`); });
  });
  return { small, low };
}, sel);

try {
  /* ---------- How to use · Clinical tip ---------- */
  for (const [file, key, words] of [["activity-studio.html", "studio", /Print all pages|Compile Packet PDF/], ["builder.html#/", "builder", /Add to Packet/], ["builder.html#/facility", "facility", /Auto-populate/]]) {
    const { ctx, p } = await open(1366, 768, file);
    const pill = await p.$eval(".ht-pill", e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), t: e.textContent.trim(), x: e.getAttribute("aria-expanded") }; }).catch(() => null);
    ok(pill && pill.w >= 52 && pill.h >= 52 && /How to use · Clinical tip/.test(pill.t) && pill.x === "false", `${key}: a ${pill ? pill.w + " x " + pill.h : "missing"} px "How to use · Clinical tip" button, closed`);
    await p.click(".ht-pill"); await p.waitForTimeout(700);
    const got = await p.evaluate(() => ({ open: document.querySelector(".ht-pill").getAttribute("aria-expanded"), steps: [...document.querySelectorAll(".ht-steps li")].map(l => l.textContent), tip: document.querySelector(".ht-tip").textContent }));
    ok(got.open === "true" && got.steps.length === 3 && got.steps.some(s => words.test(s)), `${key}: it opens three steps that name this screen's own buttons`);
    ok(got.tip.length > 30 && !/\b(them is|them becomes|them has|\{name\}|\{page\})/.test(got.tip) && !/^Clinical Tip:/.test(got.tip), `${key}: and one clinical tip in whole sentences ("${got.tip.slice(0, 70)}…")`);
    const tips = new Set([got.tip]);
    for (let i = 0; i < 6; i++) { await p.click(".ht-more"); await p.waitForTimeout(120); tips.add(await p.textContent(".ht-tip")); }
    ok(tips.size >= 3, `${key}: "Another tip" gives different ones (${tips.size} in seven)`);
    if (key === "facility") {
      const tabs = await p.$$("#fpBar [role=tab]"); if (tabs[1]) { await tabs[1].click(); await p.waitForTimeout(500); }
      ok(!!(await p.$(".ht-pill")), "the Facility Portal keeps it when another tab is opened");
    }
    await p.click(".ht-pill"); await p.waitForTimeout(150);
    ok(await p.$eval(".ht-panel", e => e.hidden), `${key}: pressed again, it closes`);
    await ctx.close();
  }

  /* ---------- Speak: the profile's notes ---------- */
  {
    const real = await open(1366, 768, "profile.html", { speech: "real" });
    ok(!!(await real.p.$("#rapNotes + .dc-row .dc-btn")), "with this browser's own speech recognition, the profile opens with its Speak button, and the page does not ask about speech until it is pressed");
    await real.ctx.close();

    const { ctx, p } = await open(1366, 768, "profile.html", { speech: "available" });
    ok(await p.evaluate(() => window.__asked) === 0, "opening the page asks the browser nothing about speech");
    await toNotes(p);
    await p.fill("#rapNotes", "Grew up on a farm.");
    await p.click("#rapNotes + .dc-row .dc-btn"); await p.waitForTimeout(300);
    ok(await p.evaluate(() => window.__asked) >= 1 && await p.$eval("#rapNotes + .dc-row .dc-btn", b => b.getAttribute("aria-pressed") === "true" && /Stop listening/.test(b.textContent)), "pressed, it asks the browser, and listens on this device");
    const spoke = await p.evaluate(() => window.__say("She loved the county fair."));
    await p.waitForTimeout(200);
    const after = await p.evaluate(() => ({ v: document.getElementById("rapNotes").value, c: (document.getElementById("rapNotesCount") || {}).textContent || "" }));
    ok(spoke && after.v === "Grew up on a farm. She loved the county fair." && /\b45\b/.test(after.c), `what is said is added to the end of the notes, and the counter follows ("${after.c.trim()}")`);
    await p.click("#rapNotes + .dc-row .dc-btn"); await p.waitForTimeout(200);
    ok(await p.$eval("#rapNotes + .dc-row .dc-btn", b => b.getAttribute("aria-pressed") === "false" && /Speak instead of typing/.test(b.textContent)), "pressed again, it stops");
    await ctx.close();

    const n = await open(1366, 768, "profile.html", { speech: "unavailable" });
    await toNotes(n.p);
    await n.p.click("#rapNotes + .dc-row .dc-btn"); await n.p.waitForTimeout(300);
    const why = await n.p.$eval("#rapNotes + .dc-row", r => ({ dis: r.querySelector("button").disabled, t: r.querySelector(".dc-why").textContent }));
    ok(why.dis && /cannot confirm that speech stays on this device/.test(why.t) && /Typing works as always/.test(why.t), `where speech may leave the device, the button greys out and says why ("${why.t.slice(0, 80)}…")`);
    await n.p.fill("#rapNotes", "Typed by hand."); ok(await n.p.$eval("#rapNotes", e => e.value) === "Typed by hand.", "and typing works as always");
    await n.ctx.close();
  }

  /* ---------- Speak: the Shift board's note, and its name check ---------- */
  {
    const { ctx, p } = await open(1366, 768, "builder.html#/shift", { speech: "available" });
    await seed(p, [DOT]); await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1000);
    await p.click("#shcOpenBoard"); await p.waitForSelector("#shfRoot", { state: "visible" }); await p.waitForTimeout(400);
    ok(!!(await p.$("#shfNText + .dc-row .dc-btn")), "the Shift board's note has a Speak button, added when the board is drawn");
    await p.click("#shfNText + .dc-row .dc-btn"); await p.waitForTimeout(300);
    await p.evaluate(() => window.__say("Dorothy Example enjoyed the music today.")); await p.waitForTimeout(700);
    const warn = await p.evaluate(() => (document.querySelector(".shf-warn") || {}).textContent || "");
    ok(/includes a name/.test(warn) && /Dorothy/.test(warn), `a name said into a note brings up the board's own warning, as a typed one does ("${warn.trim().slice(0, 70)}")`);
    await p.click("#shfNText + .dc-row .dc-btn"); await p.waitForTimeout(150);
    await ctx.close();
  }

  /* ---------- 52 px and readable: day and Night Shift, laptop and phone ---------- */
  for (const night of [false, true]) for (const [w, h] of [[1366, 768], [390, 844]]) {
    const tag = `${w} px${night ? ", Night Shift" : ""}`;
    const { ctx, p } = await open(w, h, "builder.html#/", { night, speech: "unavailable" });
    await p.click(".ht-pill"); await p.waitForTimeout(500);
    const m1 = await measure(p, ".ht");
    ok(m1.small.length === 0 && m1.low.length === 0, `${tag}: the help button and its panel are 52 px and readable` + (m1.small.length + m1.low.length ? ": " + m1.small.concat(m1.low).slice(0, 4).join("; ") : ""));
    await p.goto(base + "profile.html", { waitUntil: "load" }); await p.waitForTimeout(1000);
    await toNotes(p);
    const m2 = await measure(p, ".dc-row");
    await p.click("#rapNotes + .dc-row .dc-btn"); await p.waitForTimeout(300);
    const m3 = await measure(p, ".dc-row");
    ok(m2.small.length + m2.low.length + m3.small.length + m3.low.length === 0 && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${tag}: the Speak button is 52 px and readable, also greyed out, nothing sideways` + (m2.small.length + m2.low.length + m3.small.length + m3.low.length ? ": " + m2.small.concat(m2.low, m3.small, m3.low).slice(0, 4).join("; ") : ""));
    await ctx.close();
  }
  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + [...new Set(errors)].slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `help and dictation check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `help and dictation check passed: ${passed} checks in a real browser (How to use and a clinical tip on the Studio, the Packet Builder and the Facility Portal; Speak on the profile and the Shift board, asking the browser only when pressed, listening on the device, greyed out with the reason elsewhere; a dictated name warned of; 52 px and readable by day and in Night Shift; nothing leaving the page. Not proved: real on-device speech in the owner's browsers.)`);
process.exit(problems.length ? 1 : 0);
