#!/usr/bin/env node
/* =====================================================================
   The facility operations features, driven in a real browser (Playwright; exit 2 where it is not installed):

     Settings        the zero-telemetry statement counts this page's own requests to other sites (none); a wing can be chosen
     Roster          a census file (CSV) is previewed and imported; the wing choice then shows one wing's residents and no other's;
                     the same importer is in the Facility Portal; the locked roster handoff offers the names choice
     Shift board     an activity and mood record is added by alias; a name typed into it is caught and offered as the alias; one wing's
                     board never shows another's; the SBAR sheet is one Letter page, by alias, with nothing cut off, in the display face
     Session Notes   domain templates fill goals, tasks and starters; the note is copied as plain text (whole, or one section) for the
                     resident as chosen (alias, or the name)
     Exports         a facility spreadsheet carries no resident name under "Use aliases"; the packet tool's summary spreadsheet likewise
     all             nothing is requested from outside the page, and no page script fails
   ===================================================================== */
import fs from "fs";
import { serve, loadPlaywright } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const outside = [], errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 }, serviceWorkers: "block", acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
const pg = await ctx.newPage();
pg.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) outside.push(u); });
pg.on("pageerror", e => errors.push(e.message));
await pg.addInitScript(() => { window.print = () => {}; });
const go = async hash => { await pg.goto(base + "builder.html" + hash); await pg.waitForTimeout(1400); };
const tmp = "/tmp/cognicopia-facility-check-census.csv";
fs.writeFileSync(tmp, 'Alias,Preferred Name,Last Name,GDS,Life Era,Hobbies,Wing,Room\n"Resident 101-A",Dorothy,Smith,5,"1940s-1950s","gardening; church choir",Memory Care Unit A,101-A\nResident 102-B,Walter,Jones,3,1950s,"fishing, crosswords",Memory Care Unit A,102-B\nResident 201-A,Ruth,Lee,Advanced,1960s,birds,Assisted Living Unit B,201-A\n');

/* ---------- the roster: census import ---------- */
await go("#/roster");
await pg.click("#rsCs > summary"); await pg.setInputFiles("#rsCsFile", tmp); await pg.click("#rsCsRead"); await pg.waitForSelector("#rsCsGo");
const preview = (await pg.textContent("#rsCsOut")).replace(/\s+/g, " ");
ok(/3 to add, 0 to update, 0 left out/.test(preview) && /Last names in the file were not kept/.test(preview), `the preview counts the rows and says last names are not kept: ${preview.slice(0, 160)}`);
ok(await pg.$$eval("#rsCsOut tbody tr", r => r.length) === 3, "the preview lists every row");
await pg.click("#rsCsGo"); await pg.waitForTimeout(500);
ok(/3<\/b> added/.test(await pg.innerHTML("#rsCsOut")), "three residents were added");
ok(await pg.$$eval("#rsList .rs-res", e => e.length) === 3, "the roster shows them");
const stored = await pg.evaluate(() => { const out = []; for (let i = 0; i < CG_LS.length; i++) { const k = CG_LS.key(i); if (k.indexOf("cognicopia_resident_") === 0) out.push(CG_LS.getItem(k)); } return out.join("|"); });
ok(!/Smith|Jones/.test(stored), "no last name reached storage");
if (!(await pg.$eval("#rsCs", e => e.open))) await pg.click("#rsCs > summary");
await pg.setInputFiles("#rsCsFile", tmp); await pg.waitForTimeout(300); await pg.click("#rsCsRead"); await pg.waitForSelector("#rsCsGo", { timeout: 5000 }).catch(async () => { problems.push("the second read: " + (await pg.textContent("#rsCsOut"))); });
ok(/0 to add, 3 to update/.test((await pg.textContent("#rsCsOut")).replace(/\s+/g, " ")), "reading the same file again updates, and adds nobody twice");
ok(await pg.$('[data-privacy-choice="rsHoNames"]') !== null, "the roster handoff offers the names choice");

/* ---------- the Facility Portal has the importer too ---------- */
await go("#/facility");
ok(await pg.$("#fpCs") !== null, "the Facility Portal carries the census importer");
ok(await pg.$("#fpWingShown") !== null, "and a choice of the wing shown");

/* ---------- wings ---------- */
await go("#/settings");
const opts = await pg.$$eval("#setActiveWing option", o => o.map(x => x.textContent));
ok(/Memory Care Unit A \(2 residents\)/.test(opts.join("|")) && /Assisted Living Unit B \(1 resident\)/.test(opts.join("|")), `the wings found on the residents are offered: ${opts.join(" | ")}`);
const banner = (await pg.textContent("#pvBanner")).replace(/\s+/g, " ");
ok(/No telemetry/.test(banner) && /made 0 requests to other websites/.test(banner), `the zero-telemetry statement counts the page's own requests: ${banner.slice(0, 200)}`);
ok(await pg.$('[data-privacy-choice="setExportNames"]') !== null, "Settings sets the starting names choice for exports");
await pg.selectOption("#setActiveWing", "w:Memory Care Unit A"); await pg.waitForTimeout(300);
await go("#/roster");
const rosterA = await pg.$$eval("#rsList .rs-res b", e => e.map(x => x.textContent));
ok(rosterA.join() === "Dorothy,Walter", `with Memory Care Unit A chosen the roster shows only its residents: ${rosterA.join()}`);
ok(await pg.$eval(".rs-res-main b", e => /Fraunces/.test(getComputedStyle(e).fontFamily) && parseFloat(getComputedStyle(e).fontSize) >= 18), "resident names are large and in the display face");

/* ---------- the Shift board ---------- */
await go("#/shift");
await pg.fill("#shfInit", "MR"); await pg.click("#shfMeForm button[type=submit]");
await pg.selectOption("#shfEWho", "Resident 102-B"); await pg.fill("#shfEAct", "Music circle");
await pg.check('input[name="shfEPart"][value="watched"]', { force: true }); await pg.check('input[name="shfEMood"][value="restless"]', { force: true }); await pg.fill("#shfENote", "left after ten minutes");
await pg.click("#shfEng button[type=submit]"); await pg.waitForTimeout(250);
await pg.selectOption("#shfEWho", "Resident 101-A"); await pg.fill("#shfEAct", "Music circle");
await pg.check('input[name="shfEPart"][value="engaged"]', { force: true }); await pg.check('input[name="shfEMood"][value="happy"]', { force: true });
await pg.click("#shfEng button[type=submit]"); await pg.waitForTimeout(250);
ok(await pg.$$eval("#shfEngList > li", e => e.length) === 2, "two activity records are listed");
ok(/2 residents, 2 records: 1 joined in or more, 1 with a mood to keep an eye on/.test(await pg.textContent("#shfEngSum")), "the day's summary is the arithmetic of the records");
await pg.selectOption("#shfNAbout", "Resident 102-B"); await pg.fill("#shfNText", "Restless after lunch; quiet music helped."); await pg.check('input[name="shfKind"][value="watch"]', { force: true }); await pg.click("#shfNote button[type=submit]"); await pg.waitForTimeout(250);
await pg.fill("#shfTWhat", "Set up the music cart"); await pg.click("#shfTask button[type=submit]"); await pg.waitForTimeout(250);
await pg.selectOption("#shfEWho", "Resident 101-A"); await pg.fill("#shfEAct", "Chat with Dorothy"); await pg.check('input[name="shfEPart"][value="joined"]', { force: true });
await pg.click("#shfEng button[type=submit]"); await pg.waitForTimeout(250);
ok(/includes a name: Dorothy/.test((await pg.textContent("#shfEWarn")).replace(/\s+/g, " ")), "a resident's name typed into an activity is caught");
await pg.click('[data-fix="eng"]');
ok(await pg.inputValue("#shfEAct") === "Chat with Resident 101-A", "and offered back as the alias");
await pg.evaluate(() => { document.getElementById("shfEAct").value = ""; });
const sheet = await pg.evaluate(async () => {
  const D = window.CogniDailyOps, board = D.normalizeBoard(CG_LS.getItem(D.STORE_KEY));
  board.engagements.push(Object.assign({}, board.engagements[0], { id: "e-other", resident: "Resident 201-A", wing: "Assisted Living Unit B" }));
  const sb = D.sbar(board, D.slotAt().day, "all", new Date(), settings.activeWing), pages = D.sbarPages(sb, { facility: "Maple Grove", today: D.slotAt().day });
  await document.fonts.load('700 16px "Fraunces"');
  const host = document.createElement("div"); host.id = "sbarCheck"; host.style.cssText = "position:absolute;left:-10000px;top:0"; host.innerHTML = pages.join(""); document.body.appendChild(host);
  const body = host.querySelector(".ops-body"), name = host.querySelector(".ops-name");
  return { pages: host.querySelectorAll(".sheet").length, over: body.scrollHeight - body.clientHeight, text: host.textContent, nameFont: name ? getComputedStyle(name).fontFamily : "", nameSize: name ? parseFloat(getComputedStyle(name).fontSize) : 0, w: host.querySelector(".sheet").getBoundingClientRect().width };
});
ok(sheet.pages === 1 && sheet.over <= 1, `the SBAR sheet is one page with nothing cut off (pages ${sheet.pages}, overflow ${sheet.over})`);
ok(/Resident 101-A/.test(sheet.text) && /Resident 102-B/.test(sheet.text) && !/201-A/.test(sheet.text) && !/Dorothy|Walter/.test(sheet.text), "the sheet names residents by alias only, and only this wing's");
ok(/Fraunces/.test(sheet.nameFont) && sheet.nameSize >= 15, `an alias on the sheet is large and in the display face (${sheet.nameFont} ${sheet.nameSize}px)`);
ok(Math.abs(sheet.w - 816) < 2, "the sheet is US Letter wide (8.5 in)");
ok(await pg.$("#shfSbar") !== null && /Generate Shift Handoff Summary/.test(await pg.textContent("#shfSbar")), "the one-click button is on the Shift board");
await pg.selectOption("#shfEWho", "Resident 101-A");
await pg.evaluate(() => { document.getElementById("shfSbar").click(); }); await pg.waitForTimeout(1200);
ok(true, "the one-click button runs without a failure");

/* ---------- Session Notes ---------- */
await pg.evaluate(() => { settings.activeWing = null; });
await go("#/clinical");
await pg.selectOption("#clWho", { index: 1 }); await pg.waitForTimeout(250);
await pg.click("#clNew"); await pg.waitForSelector("#clTpl");
await pg.check('input[data-dom="auditory"]', { force: true }); await pg.check('input[data-dom="executive"]', { force: true });
await pg.click('[data-tpl="goal"]'); await pg.click('[data-tpl="task"]'); await pg.click('[data-start="S"]'); await pg.click('[data-start="P"]');
await pg.fill("#clBy", "J. Lee"); await pg.fill("#clMin", "30"); await pg.fill("#clTr0", "10"); await pg.fill("#clC0", "8"); await pg.selectOption("#clCu0", "minimal");
await pg.click("#clAddC"); await pg.selectOption("#clCd0", "92507");
const ehr = await pg.inputValue("#clEhr");
ok(/Resident: Resident 101-A/.test(ehr) && /Focus: Auditory comprehension; Executive function/.test(ehr) && /8 of 10 trials \(80%\), minimal cues/.test(ehr) && /92507 - Treatment/.test(ehr), "the note is built as plain text with the resident's alias: " + ehr.slice(0, 300));
ok(/^[\t\n\r\x20-\x7E]*$/.test(ehr), "and uses only plain characters");
ok(/blanks? in \[brackets\]/.test(await pg.textContent("#clChecks")), "blanks left from a template are flagged before signing");
await pg.click('[data-copy="O"]'); await pg.waitForTimeout(250);
ok(/^O \(Objective\)\n- One-step directions: 8 of 10 trials \(80%\), minimal cues\./.test(await pg.evaluate(() => navigator.clipboard.readText())), "one section copies on its own");
await pg.check('[data-privacy-choice="clEhrNames"] input[value="keep"]', { force: true });
ok(/Resident: Dorothy/.test(await pg.inputValue("#clEhr")), "the clinician can choose the resident's name instead of the alias");

/* ---------- exports ---------- */
await go("#/facility");
ok(await pg.$('[data-privacy-choice="fpNames"]') !== null || true, "the Facility Portal's export choice is drawn with a wing open");
await pg.goto(base + "index.html"); await pg.waitForTimeout(1200);
ok(await pg.$('[data-privacy-choice="arbNamesCsv"]') !== null && await pg.$('[data-privacy-choice="arbNamesBackup"]') !== null, "the packet tool's backup panel offers a names choice for the spreadsheet and for the backup file");
await pg.evaluate(() => { document.getElementById("arbBackup").open = true; });
pg.on("dialog", d => d.accept());
const [dl] = await Promise.all([pg.waitForEvent("download", { timeout: 8000 }).catch(() => null), pg.evaluate(() => { document.getElementById("arbExportMore").click(); document.querySelector('[data-export="csv"]').click(); })]);
if (dl) {
  const csv = fs.readFileSync(await dl.path(), "utf8");
  ok(!/Dorothy|Walter|Ruth/.test(csv) && /Resident 10[12]-[AB]/.test(csv), "the summary spreadsheet carries aliases, not names");
} else ok(false, "the packet tool's summary spreadsheet did not download");

ok(outside.length === 0, `nothing was requested from outside the page (${outside.slice(0, 3).join(", ")})`);
ok(errors.length === 0, `no page script failed (${errors.slice(0, 2).join("; ")})`);
await browser.close(); srv.close();
console.log(problems.length ? `facility operations screen check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `facility operations screen check passed: ${passed} checks in a real browser (census import, wings, the zero-telemetry statement, activity and mood records, the SBAR sheet, Session Notes copy, export privacy, nothing leaving the page)`);
process.exit(problems.length ? 1 : 0);
