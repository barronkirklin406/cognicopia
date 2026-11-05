#!/usr/bin/env node
/* =====================================================================
   The Shift board as a calendar (builder.html#/shift), in a real browser.
     the calendar is the page: Month, Week and Day, the board is in a slide-out opened by "Notes & tasks" (Escape closes it and
     the keyboard goes back); staff are initials only and kept in one small record; coverage and the badges (Staffed, open,
     Memory) read from what was planned and recorded; the shift and skill filters; the staffing insight counts the board's
     records and only flags what they show; the weekly schedule PDF is read back with PyMuPDF (one Letter page, black text,
     the initials and the open marks); Ctrl+K finds a resident (aliases only on this screen, names elsewhere); every control
     is 52 px; nothing sideways on a phone; nothing leaves the page.
   Needs Playwright and PyMuPDF. Run: node scripts/check-shift-calendar-ui.mjs
   ===================================================================== */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const resident = (id, name) => ({ schema: "cognicopia.residentProfile", version: 2, id, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z",
  tier1_core: { preferredName: name, unitNumber: "302-B", cognitiveTier: 2, visualNeeds: null, occupation: { code: "teacher", label: "Teacher" }, topHobbies: [{ code: "gardening", label: "Gardening" }], printNeeds: {}, topicsToAvoid: { topics: [], other: "" }, difficulty: { level: 3 } },
  tier2_enrichment: { birthYear: 1936, hometown: { place: "Test City" } }, tier3_deep: { notes: "", people: [] } });

async function open(w, h, hash = "#/shift") {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "builder.html" + hash, { waitUntil: "load" }); await p.waitForSelector("#shcRoot", { timeout: 8000 }); await p.waitForTimeout(300);
  return { ctx, p };
}
const staff = p => p.evaluate(() => JSON.parse(localStorage.getItem("cognicopia_shiftcal") || "null"));
const idOf = async (p, ini) => (await staff(p)).staff.find(s => s.initials === ini).id;
const add = async (p, shift, ini) => { await p.selectOption("#add-" + shift, await idOf(p, ini)); await p.waitForTimeout(50); };
const text = (p, sel) => p.$eval(sel, e => e.textContent.replace(/\s+/g, " ").trim());
const PY = `
import sys, json
try:
    import pymupdf as fitz
except ImportError:
    import fitz
doc = fitz.open(sys.argv[1]); out = {"pages": len(doc), "size": [round(doc[0].rect.width), round(doc[0].rect.height)], "text": "", "colored": 0}
for pg in doc:
    out["text"] += pg.get_text()
    for b in pg.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                if s["text"].strip() and s["color"] != 0: out["colored"] += 1
print(json.dumps(out))`;

try {
  /* ---------- the calendar is the page ---------- */
  let { ctx, p } = await open(1366, 900);
  const first = await p.evaluate(() => ({ cal: document.getElementById("shcCal").getBoundingClientRect().top, vh: innerHeight, board: (() => { const r = document.getElementById("shfRoot"); return !r || r.getBoundingClientRect().width === 0; })(), drawerHidden: document.getElementById("shcDrawer").hidden, h1: document.querySelector("#view h1").textContent.trim(), month: document.querySelector('input[name="shcView"][value="month"]').checked }));
  ok(first.h1 === "Shift board" && first.month && first.cal < first.vh, `the Shift board opens on the calendar, in Month view, with the calendar on the first screen (${Math.round(first.cal)} px from the top of ${first.vh})`);
  ok(first.drawerHidden && first.board, "and the notes, tasks and handoff board is not in the way until it is asked for");
  ok(await p.$$eval(".shc-month td", e => e.length) >= 35, "the month is a grid of days");

  /* ---------- staff are initials only ---------- */
  await p.click('[data-act="sample"]'); await p.waitForTimeout(150);
  let rec = await staff(p);
  ok(rec.staff.length === 8 && rec.staff.every(s => /^[A-Z]{1,4}$/.test(s.initials) && Object.keys(s).sort().join() === "id,initials,role,skills"), "the sample staff are initials, a role and skills, and nothing else is kept");
  await p.fill("#shcIni", "x1y"); await p.click('#shcStaffForm button[type=submit]');
  ok(/already|letters|initials/i.test(await text(p, "#shcMsg")) || (await staff(p)).staff.some(s => s.initials === "XY"), "initials are cleaned to letters or refused in words");
  await p.fill("#shcIni", "AB"); await p.click('#shcStaffForm button[type=submit]');
  ok(/already on the list/.test(await text(p, "#shcMsg")), "a duplicate is refused in words");

  /* ---------- planning and the badges ---------- */
  for (const [sh, who] of [["day", ["AB", "CD", "EF", "LM"]], ["evening", ["LM", "QR"]], ["night", ["NP", "GH"]]]) for (const w of who) await add(p, sh, w);
  const today = await p.$eval(".shc-day.is-today", e => ({ label: e.getAttribute("aria-label"), badge: e.querySelector(".shc-b") ? e.querySelector(".shc-b").textContent.trim() : "", mini: e.querySelector(".shc-mini") ? e.querySelector(".shc-mini").textContent.replace(/\s+/g, " ").trim() : "" }));
  ok(/1 open shift/.test(today.label) && today.badge === "1 open" && /D 4\/4/.test(today.mini) && /E 2\/3/.test(today.mini) && /N 2\/2/.test(today.mini), `today's tile says one shift is open and shows each shift's count (${today.badge}; ${today.mini})`);
  ok(await p.$$eval(".shc-day.is-none .shc-b", e => e.length) === 0, "days nobody planned carry no badge to clutter the month");
  await add(p, "evening", "NP"); await add(p, "evening", "JK");
  const full = await p.$eval(".shc-day.is-today", e => ({ label: e.getAttribute("aria-label"), cls: e.className, badge: e.querySelector(".shc-b").textContent.trim() }));
  ok(/Fully staffed/.test(full.label) && full.badge === "Staffed" && /is-full/.test(full.cls), "with the evening filled, today reads Fully staffed");
  ok(/on more than one shift/.test(await text(p, "#shcDayH + p")), "a person on two shifts the same day is named, not blocked");
  await p.click('[data-shift="evening"] [data-act="unassign"] >> nth=0'); await p.waitForTimeout(100);
  await p.click('[data-shift="evening"] [data-act="unassign"] >> nth=0'); await p.waitForTimeout(100);   // four were on a shift that wants three: two off leaves it short
  ok(/open/.test(await p.$eval(".shc-day.is-today", e => e.getAttribute("aria-label"))), "taking someone off puts the day back to open");
  await p.selectOption('[data-shift="evening"] [data-swap] >> nth=0', await idOf(p, "AB")); await p.waitForTimeout(100);
  ok((await p.$$eval('[data-shift="evening"] .shc-who .shc-chip b', e => e.map(x => x.textContent))).includes("AB"), "a swap puts someone else on the shift");

  /* ---------- views and filters ---------- */
  await p.check('input[name="shcView"][value="week"]', { force: true }); await p.waitForTimeout(200);
  ok(await p.$$eval(".shc-wday", e => e.length) === 7 && await p.$$eval(".shc-wday .shc-shift", e => e.length) === 21, "Week shows seven days of three shifts");
  await p.selectOption("#shcShift", "evening"); await p.waitForTimeout(100);
  ok(await p.$$eval(".shc-wday .shc-shift", e => e.length) === 7, "the shift filter keeps one shift a day");
  await p.selectOption("#shcShift", "all"); await p.selectOption("#shcSkill", "dementia"); await p.waitForTimeout(100);
  const chips = await p.$$eval(".shc-wday.is-today .shc-chip b", e => e.map(x => x.textContent));
  ok(chips.length > 0 && chips.every(c => ["AB", "CD", "NP", "JK"].includes(c)), `the staff filter keeps dementia-trained people (${chips.join(",")})`);
  await p.selectOption("#shcSkill", "");
  await p.check('input[name="shcView"][value="day"]', { force: true }); await p.waitForTimeout(200);
  ok(await p.$$eval(".shc-dayshifts .shc-shift", e => e.length) === 3 && /Thursday|Friday|Monday|Tuesday|Wednesday|Saturday|Sunday/.test(await text(p, "#shcTitle")), "Day shows the three shifts of one day");
  await p.click('[data-act="next"]'); await p.waitForTimeout(100);
  const t1 = await text(p, "#shcTitle"); await p.click('[data-act="today"]'); await p.waitForTimeout(100);
  ok(t1 !== (await text(p, "#shcTitle")), "the arrows move the calendar and Today brings it back");
  await p.check('input[name="shcView"][value="month"]', { force: true });

  /* ---------- the keyboard moves through the month ---------- */
  await p.focus(".shc-day.is-sel"); const d0 = await p.$eval(".shc-day.is-sel", e => e.dataset.day);
  await p.keyboard.press("ArrowRight"); await p.waitForTimeout(100);
  const d1 = await p.evaluate(() => document.activeElement.dataset.day);
  ok(d0 && d1 && d1 > d0 && await p.$eval(".shc-day.is-sel", e => e === document.activeElement), `the arrow keys move the chosen day and keep the keyboard on it (${d0} to ${d1})`);
  await p.click('[data-act="today"]');

  /* ---------- the staffing insight counts what was recorded, and only that ---------- */
  ok(/Not enough records yet/.test(await text(p, ".shc-insight")) && !/High/.test(await text(p, ".shc-insight .shc-ins-list")), "with no records the insight says it does not know yet");
  await p.evaluate(() => {
    const d = CogniDailyOps; let b = d.normalizeBoard(CG_LS.getItem(d.STORE_KEY)), td = d.slotAt().day;
    for (let k = 0; k < 9; k++) b = d.withEngagement(b, d.makeEngagement({ day: d.addDays(td, -(k + 1)), time: "16:" + (10 + k), resident: k % 2 ? "Maple 2" : "Resident 302-B", activity: "Music circle", participation: k < 6 ? "joined" : "declined", mood: k < 6 ? "restless" : "calm", by: "MR" }, new Date()).entry);
    b = d.withNote(b, d.makeNote({ day: td, shift: "evening", time: "16:30", kind: "watch", about: "Resident 302-B", text: "Pacing near the door", by: "MR" }, new Date()).note);
    CG_LS.setItem(d.STORE_KEY, JSON.stringify(b));
  });
  await p.reload(); await p.waitForSelector("#shcRoot"); await p.waitForTimeout(300);
  ok(/High/.test(await text(p, ".shc-ins.is-high")) && /records show/.test(await text(p, ".shc-ins.is-high")), "with nine records the evening reads High and says how many records it rests on");
  ok(await p.$eval(".shc-day.is-today", e => !!e.querySelector(".shc-b-mem")) && await p.$$eval(".shc-day:not(.is-today) .shc-b-mem", e => e.length) === 0, "the purple Memory badge shows on the day with a note to watch, not on every day");
  ok(/Resident 302-B|Maple 2/.test(await text(p, ".shc-pairs")), "the pairings name residents by alias");
  ok(!/forecast says|predicts|artificial intelligence/i.test(await text(p, ".shc-insight")), "it describes itself as a count, not a prediction");

  /* ---------- the weekly schedule as a PDF ---------- */
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 15000 }), p.click("#shcPdf")]);
  const file = path.join(os.tmpdir(), "shc-" + Date.now() + ".pdf"); await dl.saveAs(file);
  const pdf = JSON.parse(execFileSync("python3", ["-I", "-c", PY, file], { encoding: "utf8" }));
  ok(/^cognicopia-weekly-shift-schedule-\d{4}-\d{2}-\d{2}\.pdf$/.test(dl.suggestedFilename()) && pdf.pages === 1 && pdf.size.join("x") === "612x792", `one click saves a one-page US Letter PDF (${dl.suggestedFilename()})`);
  ok(/Weekly shift schedule/.test(pdf.text) && /Confidential: staff only/.test(pdf.text) && /AB/.test(pdf.text) && /OPEN/.test(pdf.text) && /Not Medical Advice/.test(pdf.text), "the PDF has the title, the initials, the open marks and the non-medical line");
  ok(pdf.colored === 0, "all the type is pure black");
  fs.unlinkSync(file);

  /* ---------- the board slides out and back ---------- */
  await p.click("#shcOpenBoard"); await p.waitForSelector("#shfRoot", { state: "visible" }); await p.waitForTimeout(300);
  ok(await p.$eval("#shcOpenBoard", e => e.getAttribute("aria-expanded") === "true") && await p.$eval("#shfInit", e => e.getBoundingClientRect().width > 0) && /Notes, tasks/.test(await text(p, "#shcDrawerH")), "Notes & tasks opens the board with all it always had");
  ok(await p.evaluate(() => document.activeElement.id === "shcCloseBoard"), "the keyboard moves into the panel");
  await p.keyboard.press("Escape"); await p.waitForTimeout(450);
  ok(await p.$eval("#shcDrawer", e => e.hidden) && await p.evaluate(() => document.activeElement.id === "shcOpenBoard"), "Escape closes it and the keyboard goes back to the button");

  /* ---------- Ctrl+K: aliases only on the Shift board, names elsewhere ---------- */
  await p.evaluate(list => list.forEach(x => localStorage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))), [resident("res-a", "Dorothy Test"), resident("res-b", "Walter Test")]);
  await p.reload(); await p.waitForSelector("#shcRoot"); await p.waitForTimeout(300);
  await p.keyboard.press("Control+k"); await p.waitForSelector("dialog.ql[open]"); await p.waitForTimeout(150);
  const shown = await text(p, "dialog.ql");
  ok(/Resident 302-B/.test(shown) && !/Dorothy|Walter/.test(shown), "on the Shift board the lookup shows aliases and never names");
  await p.fill("#qlInput", "walt"); await p.waitForTimeout(100);
  ok(await p.$$eval(".ql-row", e => e.length) === 0, "and searching a name there finds nothing, since the board keeps names out");
  await p.fill("#qlInput", "302"); await p.waitForTimeout(100);
  ok(await p.$$eval(".ql-row", e => e.length) === 2 && await p.$$eval(".ql-row", e => e.every(r => r.getBoundingClientRect().height >= 52)), "an alias or unit number finds residents, each row 52 px tall");
  await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
  ok(!(await p.$("dialog.ql[open]")) && await p.evaluate(() => !!sessionStorage.getItem("cgb_active_resident")), "choosing one closes the lookup and makes them the active resident");
  await p.goto(base + "builder.html#/roster"); await p.waitForSelector("#view h1"); await p.waitForTimeout(300);
  await p.keyboard.press("Control+k"); await p.waitForSelector("dialog.ql[open]"); await p.fill("#qlInput", "walt"); await p.waitForTimeout(100);
  ok(await p.$$eval(".ql-row", e => e.length) === 1 && /Walter/.test(await text(p, ".ql-row")), "on the roster the same lookup finds a name");
  await p.keyboard.press("Escape");
  await p.goto(base + "builder.html#/shift"); await p.waitForSelector("#shcRoot"); await p.waitForTimeout(300);

  /* ---------- 52 px ---------- */
  const small = await p.evaluate(() => [...document.querySelectorAll("#shcRoot button, #shcRoot select, #shcRoot .seg label, #shcRoot .shc-check, #shcRoot input[type=text], #shcRoot input:not([type])")].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map(e => { const r = e.getBoundingClientRect(); return { n: (e.id || e.className || e.tagName).toString().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => x.w < 52 || x.h < 52));
  ok(small.length === 0, "every calendar control is at least 52 px tall and wide" + (small.length ? ": " + JSON.stringify(small.slice(0, 5)) : ""));
  await ctx.close();

  /* ---------- a phone ---------- */
  ({ ctx, p } = await open(390, 844));
  await p.click('[data-act="sample"]'); await p.waitForTimeout(150); await add(p, "day", "AB"); await add(p, "day", "CD"); await add(p, "day", "EF"); await add(p, "day", "LM");
  const ph = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth - innerWidth, tiles: [...document.querySelectorAll(".shc-day")].map(e => e.getBoundingClientRect()).filter(r => r.width < 52 || r.height < 52).length }));
  ok(ph.sw <= 1 && ph.tiles === 0, `on a phone the month fits with no sideways scroll and every day is 52 px (${ph.sw} px over, ${ph.tiles} small)`);
  await p.click("#shcOpenBoard"); await p.waitForSelector("#shfRoot", { state: "visible" }); await p.waitForTimeout(300);
  ok(await p.$eval("#shcDrawer", e => e.getBoundingClientRect().width <= innerWidth + 1) && await p.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 1), "and the slide-out fills the screen without spilling over it");
  await ctx.close();
} finally { await browser.close(); srv.close(); }

ok(foreign.length === 0, "nothing was requested from outside the site" + (foreign.length ? ": " + foreign.slice(0, 3).join(", ") : ""));
ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
if (problems.length) { console.error(`shift calendar screen check FAILED: ${problems.length} problem(s), ${passed} passed`); problems.forEach(m => console.error("  - " + m)); process.exit(1); }
console.log(`shift calendar screen check passed: ${passed} checks in a real browser (the calendar first, planning and badges, filters, the keyboard, the staffing insight, the weekly PDF read back, the slide-out board, Ctrl+K, 52 px, a phone)`);
