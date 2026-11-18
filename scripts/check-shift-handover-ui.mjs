#!/usr/bin/env node
/* =====================================================================
   The one-page shift handover on the Shift board (builder.html#/shift, "One-page handover for the next shift"), in a real browser.

     button     it sits with the board's other print buttons, 52 px, by day and in Night Shift, at 1366 x 768 and 390 x 844
     page       it prints ONE US Letter page, a staff sheet (type 16 pt or more, pure black, 0.75 in binding side), read back with PyMuPDF
     content    the words staff recorded (keep an eye on, what worked, still to do), the calming approaches, and who is coming on the NEXT
                shift from the staffing calendar (initials only, how many of how many are needed)
     names      a resident's name typed into a note is swapped for the alias before it reaches the page; the page holds no resident name
     private    nothing is stored by the button; nothing is requested from outside the page
   Made-up people only. Needs Playwright (and PyMuPDF for the page). Run: node scripts/check-shift-handover-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0; const notes = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const resident = (id, name, unit) => ({ schema: "cognicopia.residentProfile", version: 2, id, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z",
  tier1_core: { preferredName: name, unitNumber: unit, cognitiveTier: 2, occupation: { code: "teacher", label: "Teacher" }, topHobbies: [], printNeeds: {}, topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: "" } },
  tier2_enrichment: { birthYear: 1936, hometown: { place: "Test City" } }, tier3_deep: { notes: "", people: [] } });
const PY = `
import sys, json
try:
    import pymupdf as fitz
except Exception:
    try:
        import fitz
    except Exception:
        print(json.dumps({"missing": True})); sys.exit(0)
doc = fitz.open(sys.argv[1]); pages = []
for pg in doc:
    d = pg.get_text("dict"); sizes = []; colors = set(); x0 = 9999
    for b in d["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                if s["text"].strip() and "Not Medical Advice" not in s["text"]: sizes.append(round(s["size"], 1)); colors.add(s["color"]); x0 = min(x0, s["bbox"][0])
    pages.append({"text": pg.get_text(), "minsize": min(sizes) if sizes else 0, "colors": sorted(colors), "left": round(x0, 1)})
print(json.dumps(pages))
`;
async function open(w, h, night) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block" });
  await ctx.addInitScript(n => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); if (n) localStorage.setItem("cognicopia_night_shift", "1"); } catch (e) { /* ignore */ } window.print = () => { window.__printed = (window.__printed || 0) + 1; }; }, !!night);
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("dialog", d => d.accept());
  p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "builder.html#/shift", { waitUntil: "load" }); await p.waitForSelector("#view h1", { timeout: 8000 }); await p.waitForTimeout(400);
  if (await p.$("#shcOpenBoard")) { if (await p.$eval("#shcDrawer", e => !e.hidden).catch(() => false) === false) { await p.click("#shcOpenBoard"); } }
  await p.waitForSelector("#shfRoot", { state: "visible", timeout: 8000 }); await p.waitForTimeout(300);
  return { ctx, p };
}
const text = (p, sel) => p.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim());

try {
  const { ctx, p } = await open(1366, 1000);
  await p.evaluate(list => { list.forEach(x => localStorage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))); }, [resident("res-a", "Margaret", "302-B")]);
  await p.reload({ waitUntil: "load" }); await p.waitForSelector("#shfRoot", { state: "visible", timeout: 8000 }).catch(async () => { await p.click("#shcOpenBoard"); await p.waitForSelector("#shfRoot", { state: "visible" }); }); await p.waitForTimeout(400);
  ok(await p.$eval("#shfOne", b => /One-page handover for the next shift/.test(b.textContent)), "the Shift board has \"One-page handover for the next shift\"");
  /* a note (with a resident's name, swapped for the alias), a task, and a calendar for the evening */
  await p.fill("#shfInit", "mr"); await p.click("#shfMeForm button[type=submit]"); await p.waitForTimeout(100);
  await p.click('label:has(input[name=shfKind][value="watch"])'); await p.selectOption("#shfNAbout", "Resident 302-B"); await p.fill("#shfNText", "Pacing after lunch, settled with music"); await p.click("#shfNote button[type=submit]"); await p.waitForTimeout(200);
  await p.click('label:has(input[name=shfKind][value="worked"])'); await p.fill("#shfNText", "Margaret enjoyed the garden pictures"); await p.click("#shfNote button[type=submit]"); await p.waitForTimeout(200);
  if (await p.$("[data-fix=note]")) { await p.click("[data-fix=note]"); await p.click("#shfNote button[type=submit]"); await p.waitForTimeout(200); }
  await p.fill("#shfTWhat", "Bring the music cart to the lounge"); await p.click("#shfTask button[type=submit]"); await p.waitForTimeout(200);
  const cur = await p.evaluate(() => { const D = window.CogniDailyOps, C = window.CogniShiftCal, slot = D.slotAt(new Date()), order = ["day", "evening", "night"], next = order[(order.indexOf(slot.shift) + 1) % 3], nextDay = slot.shift === "night" ? C.addDays(slot.day, 1) : slot.day;
    let cal = C.emptyCalendar(); for (const [i, s] of [["AB", ["dementia"]], ["CD", []]]) cal = C.addStaff(cal, { initials: i, role: "aide", skills: s });
    for (const i of ["AB", "CD"]) cal = C.assign(cal, nextDay, next, cal.staff.find(x => x.initials === i).id);
    CG_LS.setItem(C.STORE_KEY, JSON.stringify(cal)); window.CogniSecureStore.flush(); return { shift: slot.shift, next: (C.SHIFTS.find(x => x.id === next) || {}).label }; });
  await p.click(`input[name=shfShift][value="${cur.shift}"]`, { force: true }); await p.waitForTimeout(300);
  const keys = () => p.evaluate(() => JSON.stringify(Object.keys(localStorage).filter(k => !/trial|gen_count/.test(k)).sort())), lsBefore = await keys(), boardBefore = await p.evaluate(() => CG_LS.getItem("cognicopia_dailyops"));
  await p.click("#shfOne"); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => window.__printed === 1), "the button opens the print window once");
  const html = await p.evaluate(() => document.getElementById("printRoot").innerText.replace(/\s+/g, " "));
  ok(/Shift handover/.test(html) && new RegExp("Coming on: " + cur.next + " shift").test(html) && /AB, CD/.test(html), "the page names the team coming on from the calendar");
  ok(!/Margaret/.test(html) && /Resident 302-B/.test(html), "the resident is shown by alias and the name is not on the page");
  ok(/Keep an eye on/.test(html) && /Pacing after lunch/.test(html) && /What worked/.test(html) && /garden pictures/.test(html) && /Still to do/.test(html) && /music cart/.test(html), "it has what staff recorded");
  ok((await keys()) === lsBefore && (await p.evaluate(() => CG_LS.getItem("cognicopia_dailyops"))) === boardBefore, "pressing the button stores no resident, note or calendar data");
  await p.emulateMedia({ media: "print" });
  const pdf = path.join(os.tmpdir(), "shift-handover-check.pdf"); fs.writeFileSync(pdf, await p.pdf({ width: "8.5in", height: "11in", printBackground: true, preferCSSPageSize: true }));
  await p.emulateMedia({ media: "screen" });
  let back = null; try { back = JSON.parse(execFileSync("python3", ["-I", "-c", PY, pdf], { encoding: "utf8" }).trim()); } catch (e) { notes.push("PyMuPDF could not read the page here"); }
  if (!back || back.missing) notes.push("PyMuPDF is not installed for python3: the page was not read back");
  else {
    ok(back.length === 1, `it is one page (${back.length})`);
    ok(back[0].colors.every(c => c === 0), `pure black type (${back[0].colors})`);
    ok(back[0].minsize >= 16, `type 16 pt or more (smallest ${back[0].minsize}; the site's own one-line notice in the page margin is not counted)`);
    ok(back[0].left >= 0.7 * 72 - 2, `the binding side is kept (${back[0].left} pt from the left edge)`);
    ok(!/Margaret/.test(back[0].text) && /Resident 302-B/.test(back[0].text) && /Coming on/.test(back[0].text), "the printed page holds the alias, the team and no name");
  }
  /* the next shift after Night is the next day's Day shift, and after Day is Evening: the other shift choices read the same calendar */
  await p.click('input[name=shfShift][value="all"]', { force: true }); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__printed = 0; }); await p.click("#shfOne"); await p.waitForTimeout(1000);
  ok(!/Coming on/.test(await p.evaluate(() => document.getElementById("printRoot").innerText)), "for all shifts there is no \"coming on\" line, as nothing is next");
  await ctx.close();

  /* fingers and eyes */
  for (const [vw, vh, night] of [[1366, 768, false], [390, 844, false], [1366, 768, true], [390, 844, true]]) {
    const c = await open(vw, vh, night), r = await c.p.$eval("#shfOne", b => { const q = b.getBoundingClientRect(), cs = getComputedStyle(b); return { h: q.height, w: q.width, color: cs.color, bg: cs.backgroundColor }; });
    const lum = col => { const m = col.match(/[\d.]+/g).map(Number); const [R, G, B] = m.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * R + .7152 * G + .0722 * B; };
    const a = lum(r.color), b = lum(r.bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    ok(r.h >= 52 && r.w >= 52, `${vw}${night ? " night" : ""}: the button is 52 px (${Math.round(r.w)} x ${Math.round(r.h)})`);
    ok(ratio >= 7, `${vw}${night ? " night" : ""}: its label reads at 7:1 (${ratio.toFixed(2)})`);
    ok(!(await c.p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `${vw}${night ? " night" : ""}: no sideways scroll`);
    await c.ctx.close();
  }
} finally { await browser.close(); srv.close(); }

ok(!foreign.length, `nothing requested from outside the page: ${foreign.slice(0, 3).join(", ")}`);
ok(!errors.length, `no script errors: ${errors.slice(0, 3).join(" | ")}`);
console.log(problems.length ? `shift handover check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ") : `shift handover check passed: ${passed} checks` + (notes.length ? "\n  note: " + notes.join("; ") : ""));
process.exit(problems.length ? 1 : 0);
