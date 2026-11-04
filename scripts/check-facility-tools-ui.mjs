#!/usr/bin/env node
/* The four facility screens in a real browser (Playwright; exit 2 where it is not installed): the EHR import wizard (read, match, choose, preview,
   import, and a second import that updates), therapy goals (read a note, codes, goals, progress, nothing of the note saved, one printed page),
   shift highlights (one Letter page even on a very busy shift), and distress scenario practice (play to the end, certificate, check an ID). */
import { loadPlaywright, serve } from "./lib/browser.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright(); const { srv, base } = await serve(); const browser = await chromium.launch();
const sizes = (file) => JSON.parse(execFileSync("python3", ["-c", `import pypdfium2 as pdfium,json,sys
pdf=pdfium.PdfDocument(sys.argv[1]); print(json.dumps([[round(pdf[i].get_size()[0],1),round(pdf[i].get_size()[1],1)] for i in range(len(pdf))]))`, file], { encoding: "utf8" }));
const csv = `Resident Name,Room/Bed,Unit,Care Level,BIMS,DOB,SSN,MRN,Primary Diagnosis,Responsible Party Phone,Hobbies
"Testwell, Dorothy A.",101-A,MC-A,Moderate,9,03/14/1936,000-00-0000,A123456,F03.90,555-0100,gardening; baking
"Testwell, Walter",102-B,MC-A,,14,1/2/1941,000-00-0001,A123457,I10,555-0101,fishing; baseball
"Example, Rose",201,AL-B,GDS 5,,,,,,,knitting
`;
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
  const p = await ctx.newPage(), errs = [], outside = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 160))); p.on("request", (r) => { if (!r.url().startsWith(base) && !/^(data|blob|about):/.test(r.url())) outside.push(r.url()); });
  const route = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(700); };
  const fresh = async (h) => { await route("#/roster"); await route(h); };
  const printTo = async () => { await p.emulateMedia({ media: "print" }); const f = path.join(os.tmpdir(), "ft-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".pdf"); fs.writeFileSync(f, await p.pdf({ preferCSSPageSize: true, printBackground: true })); await p.emulateMedia({ media: "screen" }); return f; };
  await p.goto(base + "builder.html#/"); await p.waitForSelector("#view h1", { timeout: 15000 }); await p.waitForTimeout(500);
  await p.evaluate(() => { window.print = () => {}; });
  const nav = await p.evaluate(() => [...document.querySelectorAll("#sidebar .sb-link")].map((a) => a.dataset.route).filter((r) => ["ehr-import", "therapy-goals", "highlights", "scenarios"].includes(r)));
  ok(nav.length === 4, "the sidebar has the four new places (" + nav + ")");

  /* ---- EHR wizard ---- */
  await route("#/ehr-import"); await p.waitForSelector("#ehrFile");
  ok((await p.textContent("#view h1")) === "EHR Import Wizard" && /Step 1/.test(await p.textContent(".ft-panel h2")), "#/ehr-import opens at step 1");
  await p.setInputFiles("#ehrFile", { name: "census.csv", mimeType: "text/csv", buffer: Buffer.from(csv) }); await p.waitForTimeout(300);
  await p.click("#ehrRead"); await p.waitForSelector("#ehrNext2");
  const m2 = await p.evaluate(() => ({ sel: Object.fromEntries([...document.querySelectorAll("[data-field]")].map((s) => [s.dataset.field, s.selectedOptions[0].textContent])), banner: document.querySelector(".st-banner").textContent, sys: document.querySelector(".ft-panel p").textContent }));
  ok(m2.sel.name === "Resident Name" && m2.sel.room === "Room/Bed" && m2.sel.wing === "Unit" && m2.sel.tier === "Care Level" && m2.sel.score === "BIMS" && m2.sel.birth === "DOB", "step 2 matches name, room, unit, care level, BIMS and birth date (" + JSON.stringify(m2.sel) + ")");
  ok(/SSN/.test(m2.banner) && /Primary Diagnosis/.test(m2.banner) && /MRN/.test(m2.banner) && /Responsible Party Phone/.test(m2.banner) && /PointClickCare/.test(m2.sys), "the sensitive columns are listed as not used, and the system is recognised (" + m2.sys.slice(0, 90) + ")");
  const tap = await p.$$eval(".ft-panel select, .ft-panel button", (e) => e.map((x) => Math.round(x.getBoundingClientRect().height))); ok(tap.every((h) => h >= 52), "every control on step 2 is 52 px or taller (" + Math.min(...tap) + ")");
  await p.click("#ehrNext2"); await p.waitForSelector("#ehrWing");
  const wingInputs = await p.$$eval("[data-wing]", (e) => e.map((x) => x.dataset.wing)); ok(wingInputs.join() === "AL-B,MC-A", "step 3 offers each wing found in the file to rename (" + wingInputs + ")");
  await p.fill('[data-wing="MC-A"]', "Memory Care Unit A"); await p.dispatchEvent('[data-wing="MC-A"]', "change"); await p.fill('[data-wing="AL-B"]', "Assisted Living Unit B"); await p.dispatchEvent('[data-wing="AL-B"]', "change");
  await p.click("#ehrPreview"); await p.waitForSelector("#ehrGo");
  const pv = await p.evaluate(() => ({ sum: document.querySelector(".st-banner").textContent, rep: document.querySelector(".ft-report").textContent, rows: [...document.querySelectorAll(".st-matrix tbody tr")].map((r) => [...r.cells].map((c) => c.textContent).join("|")), btn: document.querySelector("#ehrGo").textContent }));
  ok(/3.*to add/.test(pv.sum) && /Memory Care Unit A/.test(pv.rep) && /Last names were not kept/.test(pv.rep) && /birth date/.test(pv.rep) && pv.rows[0].startsWith("2|Dorothy|2|Memory Care Unit A|101-A|Add") && !/Testwell|Example/.test(pv.rows.join()), "the preview shows first names, tiers, renamed wings and rooms, and no last name (" + pv.rows[0] + ")");
  await p.click("#ehrGo"); await p.waitForSelector(".msg-ok"); await p.waitForTimeout(300);
  const saved = await p.evaluate(() => { const out = []; for (let i = 0; i < CG_LS.length; i++) { const k = CG_LS.key(i); if (k && k.indexOf("cognicopia_resident_res-") === 0) out.push(JSON.parse(CG_LS.getItem(k))); } return out; });
  ok(saved.length === 3 && saved.every((r) => r.tier1_core.wing && r.tier1_core.unitNumber) && !JSON.stringify(saved).match(/Testwell|Example|000-00|A12345|F03|555-01|03\/14/), "three profiles are saved with wing and room and nothing sensitive (" + saved.length + ")");
  await fresh("#/ehr-import"); await p.setInputFiles("#ehrFile", { name: "census.csv", mimeType: "text/csv", buffer: Buffer.from(csv) }); await p.waitForTimeout(300); await p.click("#ehrRead"); await p.waitForSelector("#ehrNext2"); await p.click("#ehrNext2"); await p.click("#ehrPreview"); await p.waitForSelector("#ehrGo");
  ok(/3.*to update/.test(await p.textContent(".st-banner")), "importing the same file again updates the same three residents");
  await fresh("#/ehr-import"); await p.setInputFiles("#ehrFile", { name: "bad.csv", mimeType: "text/csv", buffer: Buffer.from("Name,Room\n") }); await p.waitForTimeout(200); await p.click("#ehrRead");
  ok(/header row and at least one resident/.test(await p.textContent("#ehrErr")), "a file with no residents gets a plain message and stays on step 1");

  /* ---- therapy goals ---- */
  await p.evaluate(() => { CG_LS.setItem("cognicopia_resident_p1", JSON.stringify({ schema: "cognicopia.residentProfile", id: "p1", tier1_core: { preferredName: "Peggy" }, tier2_enrichment: { birthYear: 1938 }, tier3_deep: {} })); });
  await route("#/therapy-goals"); await p.waitForSelector("#gRes"); await p.selectOption("#gRes", "p1");
  await p.fill("#gNote", "Administered MoCA, total 18/30. Visuospatial/executive 3/5, naming 3/3, attention 4/6, language 2/3, abstraction 1/2, delayed recall 2/5, orientation 5/6. 45 minutes.");
  await p.click("#gRead"); await p.waitForSelector("#gTotal");
  const g1 = await p.evaluate(() => ({ total: document.querySelector("#gTotal").value, recall: document.querySelector('[data-dom="recall"]').value, mins: document.querySelector("#gMin").value, codes: [...document.querySelectorAll("[data-code]")].map((c) => c.dataset.code), goals: [...document.querySelectorAll("[data-goal]")].map((c) => c.dataset.goal) }));
  ok(g1.total === "18" && g1.recall === "2" && g1.mins === "45" && g1.codes.join() === "96125" && g1.goals.length === 3, "the note fills the total, the sub-scores and minutes, suggests 96125 and the three lowest domains (" + JSON.stringify(g1) + ")");
  await p.fill('[data-goal="recall"]', "4"); await p.click("#gSave"); await p.waitForSelector("#gPrint");
  const stored = await p.evaluate(() => { for (let i = 0; i < CG_LS.length; i++) { const k = CG_LS.key(i); if (k && k.indexOf("cognicopia_slp_goals_") === 0) return CG_LS.getItem(k); } return ""; });
  ok(/"recall"/.test(stored) && !/Administered|45 minutes/.test(stored) && /saved/i.test(await p.textContent("#gOk")), "the entry is saved without the note's words");
  ok(/Delayed recall/.test(await p.textContent(".st-matrix")) && /4 \(not yet\)/.test(await p.textContent(".st-matrix")), "the progress table shows the recall goal as not yet met");
  await p.click("#gPrint"); await p.waitForTimeout(400); const f1 = await printTo(); const s1 = sizes(f1); fs.unlinkSync(f1); ok(s1.length === 1 && Math.abs(s1[0][0] - 612) < 1.5, "the therapy summary prints as one Letter page (" + JSON.stringify(s1) + ")");
  const tg = await p.$$eval("#gRead, #gSave, #gRes, #gNote", (e) => e.map((x) => Math.round(x.getBoundingClientRect().height))); ok(tg.every((h) => h >= 52), "the main therapy controls are 52 px or taller");

  /* ---- shift highlights ---- */
  await p.evaluate(() => { const D = window.CogniDailyOps, now = new Date(), day = D.slotAt(now).day; let b = D.emptyBoard(); const add = (r, a, part, mood, time, note) => { const x = D.makeEngagement({ by: "AB", resident: r, activity: a, participation: part, mood, day, time, shift: "day", note }, now); b = D.withEngagement(b, x.entry); };
    add("Resident 101-A", "Instant Soothe, garden pictures", "joined", "calm", "13:10", "Settled with tea."); add("Resident 102-B", "Instant Soothe", "watched", "restless", "14:20", ""); add("Resident 104-D", "Music memories", "engaged", "happy", "10:30", "");
    for (let i = 0; i < 24; i++) add("Resident 3" + String(i).padStart(2, "0"), i % 2 ? "Instant Soothe" : "Bingo", "engaged", i % 2 ? "anxious" : "happy", "12:" + String(i).padStart(2, "0"), "x".repeat(150));
    for (let i = 0; i < 20; i++) { const t = D.makeTask({ by: "AB", what: "Task number " + i + " " + "y".repeat(120), about: "Room " + i, day, shift: "day" }, now); b = D.withTask(b, t.task); }
    CG_LS.setItem(D.STORE_KEY, JSON.stringify(b)); });
  await route("#/highlights"); await p.waitForSelector(".ft-sheet .sheet");
  const hv = await p.evaluate(() => ({ t: document.querySelector(".ft-sheet").textContent, n: document.querySelectorAll(".ft-sheet .sheet").length }));
  ok(hv.n === 1 && /Instant Soothe and calming approaches/.test(hv.t) && /settled/.test(hv.t) && /Fully engaged/.test(hv.t) && /more on the full handoff sheet/.test(hv.t), "the highlights page shows the calming approaches, engagement and counts what does not fit");
  await p.click("#hPrint"); await p.waitForTimeout(500); const f2 = await printTo(); const s2 = sizes(f2); fs.unlinkSync(f2); ok(s2.length === 1 && Math.abs(s2[0][0] - 612) < 1.5 && Math.abs(s2[0][1] - 792) < 1.5, "a very busy shift still prints as exactly one Letter page (" + JSON.stringify(s2) + ")");

  /* ---- scenarios ---- */
  await route("#/scenarios"); await p.waitForSelector("[data-start]");
  await p.fill("#scName", "Sam Example"); await p.fill("#scRole", "Care aide"); await p.click('[data-start="dusk"]'); await p.waitForSelector("[data-choice]");
  const ch = await p.$$eval("[data-choice]", (e) => e.map((x) => Math.round(x.getBoundingClientRect().height))); ok(ch.length === 4 && ch.every((h) => h >= 52), "each choice is a large button (" + ch + ")");
  await p.click('[data-choice="c"]'); ok(/Likely to raise the distress/.test(await p.textContent(".st-banner")), "a less helpful choice is answered with its reason"); await p.click("#scNext");
  for (const c of ["a", "a", "a"]) { await p.waitForSelector("[data-choice]"); await p.click('[data-choice="' + c + '"]'); if (c !== "x") { const nx = await p.$("#scNext"); if (nx) await nx.click(); } }
  await p.waitForSelector("#scSave"); ok(/75%|\b75\b/.test(await p.textContent(".ft-panel")) && /That passes/.test(await p.textContent(".ft-panel")), "one wrong move and then repairs still passes at 75%");
  await p.click("#scSave"); await p.waitForSelector("#scCert"); const certId = (await p.textContent(".msg-ok")).match(/SC-[A-Z0-9]{4}-[A-Z0-9]{4}/)[0];
  await p.click("#scCert"); await p.waitForTimeout(500); const f3 = await printTo(); const s3 = sizes(f3); fs.unlinkSync(f3); ok(s3.length === 1 && Math.abs(s3[0][0] - 612) < 1.5 && Math.abs(s3[0][1] - 792) < 1.5, "the certificate prints as one Letter page (" + JSON.stringify(s3) + ")");
  await p.click("#scBack"); await p.fill("#scCheck", certId.toLowerCase()); await p.click("#scCheckGo"); ok(/Found: Sam Example/.test(await p.textContent("#scCheckOut")), "the certificate ID is found when checked");
  await p.fill("#scCheck", "SC-ZZZZ-ZZZZ"); await p.click("#scCheckGo"); ok(/No certificate/.test(await p.textContent("#scCheckOut")), "a wrong ID is not found");
  ok(/Passed/.test(await p.textContent(".st-list")) && /Sam Example/.test(await p.textContent(".st-matrix")), "the scenario shows as passed and the record table lists it");
  await route("#/planner"); ok(!(await p.$(".ft-tool")) && !(await p.textContent("#view")).includes("Sam Example"), "leaving a facility screen leaves nothing of it behind");
  ok(outside.length === 0 && errs.length === 0, "no outside request and no script error (" + outside.concat(errs).slice(0, 2).join("; ") + ")");
  await ctx.close();
} finally { await browser.close(); srv.close(); }
if (problems.length) { console.error("facility tools UI check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("facility tools UI check passed: " + passed + " checks in a real browser (EHR wizard, therapy goals, shift highlights one page, scenario practice and certificate)");
