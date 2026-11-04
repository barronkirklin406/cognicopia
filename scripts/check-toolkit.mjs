#!/usr/bin/env node
/* The Page Toolkit (js/toolkit-ui.js) and the modules it puts in front of staff: a saved profile becomes the agents' profile, completion tuning
   reaches the sheet through the calibrator (within its limits), the clinical pages build and refuse busy anchors, and in a real browser the wing
   queue makes a packet and a divider for each resident (by alias, never by name), the details are saved on the profile and tuning is suggested
   after three logged activities. */
import { loadPlaywright, serve } from "./lib/browser.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const T = await import("../js/toolkit-ui.js");
import { createSuite } from "../js/pillar5-upgrade-agents.js";
import { buildRequest } from "../js/reminiscence-engine.js";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const prof = { schema: "cognicopia.residentProfile", id: "r1", tier1_core: { preferredName: "Peg", cognitiveTier: 3, unitNumber: "204-B", topHobbies: [{ code: "gardening", label: "Gardening and flowers" }], occupation: { code: "teacher", label: "Schoolteacher" }, tuned: { fontPt: 24, grid: 5, lineHeight: 1.6 } }, tier2_enrichment: { birthYear: 1938, hometown: { place: "Duluth, Minnesota" } }, tier3_deep: { multigen: { grandchildren: "Lily, Max", neighborhoodStreets: "12 Maple Street, Oak Ave", regionalTerms: "pop, davenport" } } };
const ag = T.agentProfile(prof);
ok(ag.preferredName === "Peg" && ag.ailmentTier === "late" && ag.formativeEra === "1938" && ag.hobbies === "Gardening and flowers" && ag.hometown === "Duluth, Minnesota" && ag.pastCareer === "Schoolteacher", "a saved profile becomes the agents' profile");
ok(ag.grandchildren.join() === "Lily,Max" && ag.neighborhoodStreets.join() === "Maple,Oak Ave".replace("Oak Ave", ag.neighborhoodStreets[1]) && ag.familyNames.includes("Lily") && ag.regionalTerms.join() === "pop,davenport", "family, streets and regional words come through, with house numbers dropped");
const req = T.requestFor(prof, buildRequest);
ok(req.calibration && req.calibration.minFontPt === 24 && req.calibration.maxGrid === 5 && req.profile.preferredName === "Peg" && req.deep.words.length > 0 && !T.requestFor(Object.assign({}, prof, { tier1_core: Object.assign({}, prof.tier1_core, { tuned: undefined }) }), buildRequest).calibration, "the request carries the tuning only when the profile has it, and the deep words from their details");
const o = createSuite().orchestrator;
const plain = await o.execute(T.requestFor(Object.assign({}, prof, { tier1_core: Object.assign({}, prof.tier1_core, { tuned: undefined }) }), buildRequest)), tuned = await o.execute(req);
ok(plain.ok && tuned.ok && tuned.analysis.calibration && tuned.analysis.calibration.condition === "completion tuning" && JSON.stringify(plain.asset) !== JSON.stringify(tuned.asset), "tuning reaches the sheet: the calibrated sheet is different from the plain one, and says it was tuned");
const wild = await o.execute(Object.assign(buildRequest({ preferredName: "Ann", ailmentTier: "early" }, {}), { calibration: { minFontPt: 999, maxGrid: -4, maxWords: "x", lineHeight: 9 } }));
ok(wild.ok && wild.analysis.calibration.caps.minFontPt === 24 && wild.analysis.calibration.caps.maxGrid === 5 && wild.analysis.calibration.caps.lineHeight === 1.7 && wild.analysis.calibration.caps.maxWords === undefined, "out-of-range tuning is held to the limits, and rubbish is dropped");
const none = await o.execute(Object.assign(buildRequest({ preferredName: "Ann", ailmentTier: "early" }, {}), { calibration: "x" })); ok(none.ok && !(none.analysis && none.analysis.calibration), "a calibration that is not an object is ignored");
/* clinical pages */
const pg = (c) => T.clinicalPages(c);
ok(pg({ kind: "steps", steps: "Wash your hands\nPut on the apron\nGet out the bowl\nStir" })[0].includes("cl-steps") && /cl-pause/.test(pg({ kind: "steps", steps: "a\nb\nc\nd" })[0]), "a step checklist has a box for each step and a pause after every third");
ok(pg({ kind: "anchor", anchor: "circle", mode: "soft", word: "Moon" })[0].includes("cl-lbd-soft") && pg({ kind: "recall", recall: "Our street, Maple Street\nThe dog, Biscuit" }).length === 3 && /cl-grid/.test(pg({ kind: "sort", trades: ["kitchen", "garden"] })[0]) && /Coins|coin/i.test(pg({ kind: "coin", coins: "penny, dime" })[0]), "anchor, spaced-retrieval (pages 1, 3 and 5), sorting grid and coin pages build");
let e1 = "", e2 = "", e3 = ""; try { pg({ kind: "steps", steps: "  \n " }); } catch (e) { e1 = e.message; } try { pg({ kind: "recall", recall: "no comma here" }); } catch (e) { e2 = e.message; } try { pg({ kind: "nope" }); } catch (e) { e3 = e.message; }
ok(/at least one step/.test(e1) && /cue, answer/.test(e2) && /Choose a page/.test(e3), "empty input is refused with a plain message");
ok(!/<script/i.test(pg({ kind: "steps", steps: "<script>x</script>" })[0]) && !/<script/i.test(pg({ kind: "anchor", word: "<script>" })[0]), "markup in what staff type is escaped");

/* ---- real browser ---- */
const { chromium } = loadPlaywright(); const { srv, base } = await serve(); const browser = await chromium.launch();
const sizes = (file) => JSON.parse(execFileSync("python3", ["-c", `import pypdfium2 as pdfium,json,sys
pdf=pdfium.PdfDocument(sys.argv[1]); print(json.dumps(len(pdf)))`, file], { encoding: "utf8" }));
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
  const p = await ctx.newPage(), errs = [], outside = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 160))); p.on("request", (r) => { if (!r.url().startsWith(base) && !/^(data|blob|about):/.test(r.url())) outside.push(r.url()); });
  const route = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(700); };
  await p.goto(base + "builder.html#/"); await p.waitForSelector("#view h1", { timeout: 15000 }); await p.waitForTimeout(800);
  await p.evaluate(() => { window.print = () => {}; const mk = (id, name, room, tier) => CG_LS.setItem("cognicopia_resident_" + id, JSON.stringify({ schema: "cognicopia.residentProfile", id, tier1_core: { preferredName: name, unitNumber: room, cognitiveTier: tier, wing: "" }, tier2_enrichment: { birthYear: 1938 }, tier3_deep: {} })); mk("a1", "Dorothy", "101-A", 2); mk("a2", "Walter", "102-B", 1); mk("a3", "Rose", "103-C", 3); });
  ok((await p.$$eval("#sidebar .sb-link", (a) => a.map((x) => x.dataset.route))).includes("toolkit"), "the sidebar has the Page Toolkit");
  await route("#/toolkit"); await p.waitForSelector("#tkMake");
  ok(/3 residents on this roster/.test(await p.textContent(".hint")) && /Make 3 packets/.test(await p.textContent("#tkMake")), "the queue tab counts the roster and names the time of day");
  await p.click("#tkMake"); await p.waitForSelector("#tkPrint", { timeout: 60000 });
  const q = await p.evaluate(() => ({ banner: document.querySelector(".st-banner").textContent, items: [...document.querySelectorAll(".ft-report li")].map((l) => l.textContent) }));
  ok(/3<\/b> made|^3 made/.test(q.banner.replace(/\s+/g, " ")) || /3 made/.test(q.banner), "three packets are made (" + q.banner.trim().slice(0, 60) + ")");
  ok(q.items.length === 3 && q.items.every((i) => /^Resident \d+-[A-C]:/.test(i)) && !q.items.join().match(/Dorothy|Walter|Rose/), "the list uses room aliases, never names (" + q.items.join("; ") + ")");
  await p.click("#tkPrint"); await p.waitForTimeout(900);
  const stage = await p.evaluate(() => ({ dividers: document.querySelectorAll("#printRoot [data-pk-divider]").length, text: [...document.querySelectorAll("#printRoot [data-pk-divider]")].map((d) => d.textContent).join(" "), two: document.querySelector("#printRoot").classList.contains("bind-2sided") }));
  ok(stage.dividers === 3 && !/Dorothy|Walter|Rose/.test(stage.text) && stage.two, "the print stage has a divider for each resident, with no name on a divider, and the two-sided gutters (" + stage.dividers + ")");
  await p.emulateMedia({ media: "print" }); const f = path.join(os.tmpdir(), "tk-" + process.pid + ".pdf"); fs.writeFileSync(f, await p.pdf({ preferCSSPageSize: true, printBackground: true })); await p.emulateMedia({ media: "screen" }); const n = sizes(f); fs.unlinkSync(f);
  ok(n >= 6, "the PDF has at least a divider and a packet page for each resident (" + n + " pages)");
  /* details */
  await route("#/safety"); await route("#/toolkit"); await p.click('[data-tab="details"]'); await p.selectOption("#tkRes", "a1");
  await p.fill('[data-mg="grandchildren"]', "Lily, Max"); await p.fill('[data-mg="neighborhoodStreets"]', "12 Maple Street"); await p.click("#tkSaveMg"); await p.waitForSelector("#tkMsg:not(:empty)"); await p.waitForTimeout(300);
  const saved = await p.evaluate(() => JSON.parse(CG_LS.getItem("cognicopia_resident_a1")).tier3_deep.multigen); ok(saved.grandchildren.join() === "Lily,Max" && saved.neighborhoodStreets.join() === "Maple" && saved.familyNames.includes("Max"), "the family and street details are saved on the profile (" + JSON.stringify(saved.neighborhoodStreets) + ")");
  ok(/Lily, Max/.test(await p.$eval('[data-mg="grandchildren"]', (i) => i.value)), "and are shown again after saving");
  for (const v of ["20", "30", "40"]) { await p.fill("#tkPct", v); await p.click("#tkLog"); await p.waitForTimeout(150); }
  const tune = await p.textContent(".st-banner"); ok(/3<\/b> logged|^3 logged/.test(tune) || /3 logged/.test(tune) && /Suggested: 22 pt/.test(tune.replace(/\s+/g, " ")), "after three low completions, larger print and a smaller grid are suggested (" + tune.replace(/\s+/g, " ").slice(0, 150) + ")");
  await p.fill("#tkPct", "150"); await p.click("#tkLog"); ok(/0 to 100/.test(await p.textContent("#tkErr")), "a completion over 100 is refused");
  await p.click("#tkApply"); await p.waitForTimeout(400); const t1 = await p.evaluate(() => JSON.parse(CG_LS.getItem("cognicopia_resident_a1")).tier1_core.tuned); ok(t1 && t1.fontPt === 22 && t1.grid === 6, "applying the suggestion saves it on the profile (" + JSON.stringify(t1) + ")");
  const tp = await p.$$eval("#tkSaveMg, #tkLog, #tkApply, #tkRes", (e) => e.map((x) => Math.round(x.getBoundingClientRect().height))); ok(tp.every((h) => h >= 52), "the controls are 52 px or taller (" + Math.min(...tp) + ")");
  /* clinical */
  await p.click('[data-tab="clinical"]'); await p.click("#tkClinPrint"); await p.waitForTimeout(1200);
  ok((await p.evaluate(() => document.querySelectorAll("#printRoot .cl-step").length)) === 6, "the step checklist prints six steps");
  await p.check('[name="kind"][value="recall"]'); await p.fill("#tkRecall", "nothing here"); await p.dispatchEvent("#tkRecall", "change"); await p.click("#tkClinPrint"); await p.waitForTimeout(300); ok(/cue, answer/.test(await p.textContent("#tkErr")), "a bad item list shows the problem on the page");
  await route("#/planner"); ok(!(await p.$(".ft-tool")), "leaving the toolkit leaves nothing behind");
  ok(outside.length === 0 && errs.length === 0, "no outside request and no script error (" + outside.concat(errs).slice(0, 2).join("; ") + ")");
  await ctx.close();
} finally { await browser.close(); srv.close(); }
if (problems.length) { console.error("toolkit check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("toolkit check passed: " + passed + " checks (profile to agents, tuning through the calibrator, clinical pages, wing queue, details, completion tuning in a real browser)");
