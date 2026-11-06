#!/usr/bin/env node
/* Security and Accessibility in a real browser (Playwright; exit 2 where it is not installed): palettes and OpenDyslexic apply, persist and load from
   this site; the rapid tier worksheet scores, applies a micro-tier to a profile and prints on one page; the access log verifies and shows tampering;
   a full and a differential backup are made, locked and merged back; the daily reminder shows once; the Studio and therapy records are sealed (never
   in plain browser storage); the device lock can be turned on and off. */
import { loadPlaywright, serve } from "./lib/browser.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright(); const { srv, base } = await serve(); const browser = await chromium.launch();
const sizes = (file) => JSON.parse(execFileSync("python3", ["-c", `import pypdfium2 as pdfium,json,sys
pdf=pdfium.PdfDocument(sys.argv[1]); print(json.dumps([[round(pdf[i].get_size()[0],1),round(pdf[i].get_size()[1],1)] for i in range(len(pdf))]))`, file], { encoding: "utf8" }));
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
  const p = await ctx.newPage(), errs = [], outside = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 160))); p.on("request", (r) => { if (!r.url().startsWith(base) && !/^(data|blob|about):/.test(r.url())) outside.push(r.url()); });
  const route = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(700); };
  const fresh = async (h) => { await route("#/roster"); await route(h); };
  const open = async (hash) => { await p.goto("about:blank"); await p.goto(base + "builder.html" + hash); await p.waitForSelector("#view h1", { timeout: 15000 }); await p.waitForTimeout(900); };
  const tab = async (k) => { await p.click('[data-tab="' + k + '"]'); await p.waitForTimeout(500); };
  const flush = () => p.evaluate(() => window.CogniSecureStore.flush());
  await open("#/"); await p.evaluate(() => { window.print = () => {}; });
  ok((await p.$$eval("#sidebar .sb-link", (a) => a.map((x) => x.dataset.route))).includes("safety"), "the sidebar has Security & Accessibility");
  await route("#/safety"); await p.waitForSelector('[name="palette"]');
  /* display */
  await p.check('[name="palette"][value="deuteranopia"]'); await p.waitForTimeout(300);
  const d1 = await p.evaluate(() => ({ cb: document.documentElement.getAttribute("data-cg-cb"), v: document.documentElement.style.getPropertyValue("--cg-cat-hometown"), sw: [...document.querySelectorAll(".sa-swatch")].map((s) => getComputedStyle(s).backgroundColor) }));
  ok(d1.cb === "deuteranopia" && d1.v.trim().toLowerCase() === "#56b4e9" && new Set(d1.sw).size === 4, "choosing deuteranopia sets the palette and shows four different swatches (" + d1.sw.join(" ") + ")");
  await p.check('[name="font"][value="opendyslexic"]'); await p.waitForTimeout(800);
  const f1 = await p.evaluate(async () => { await document.fonts.load('16px "OpenDyslexic"'); return { ff: getComputedStyle(document.body).fontFamily, loaded: document.fonts.check('16px "OpenDyslexic"'), sheet: document.querySelector("#saPrintFont").disabled }; });
  ok(/OpenDyslexic/.test(f1.ff) && f1.loaded && !f1.sheet, "OpenDyslexic is applied to the page, loaded from this site, and the print option becomes available");
  await p.check("#saPrintFont"); await p.waitForTimeout(300);
  const prefs = await p.evaluate(() => JSON.parse(localStorage.getItem("cognicopia_access_prefs"))); ok(prefs.palette === "deuteranopia" && prefs.font === "opendyslexic" && prefs.printFont === true, "the choices are saved");
  await open("#/"); const kept = await p.evaluate(() => ({ cb: document.documentElement.getAttribute("data-cg-cb"), font: document.documentElement.getAttribute("data-cg-font"), pr: document.documentElement.getAttribute("data-cg-font-print") })); ok(kept.cb === "deuteranopia" && kept.font === "opendyslexic" && kept.pr === "1", "after the page is opened again the choices are still applied");
  const fit = await p.evaluate(async () => { const F = await import("/js/deck-formats.js"), K = await import("/js/tracking-report.js"); const root = document.createElement("div"); root.style.cssText = "position:absolute;left:-9999px;top:0"; const cards = [{ kind: "era", title: "The radio years in the evening", invite: "What music was playing at home on a Sunday afternoon?" }]; root.innerHTML = F.indexCardPages(cards, { size: "4x6", tier: 2 }).map((x) => x.html).join("") + K.reportPages({ name: "Margaret", entries: [], today: new Date() }).map((x) => x.html).join(""); document.body.appendChild(root); await document.fonts.ready; const out = [...root.querySelectorAll(".sheet")].map((s) => ({ cls: s.className.slice(0, 30), over: s.scrollHeight - s.clientHeight, w: s.scrollWidth - s.clientWidth })); root.remove(); return out; });
  ok(fit.every((s) => s.over <= 1 && s.w <= 1), "with OpenDyslexic on printed pages, an index card and the progress report still fit their pages (" + JSON.stringify(fit.map((s) => [s.over, s.w])) + ")");
  await route("#/safety"); await p.check('[name="palette"][value="standard"]'); await p.check('[name="font"][value="atkinson"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.documentElement.hasAttribute("data-cg-cb") && !document.documentElement.hasAttribute("data-cg-font")), "choosing standard and the default font removes them");
  /* rapid tier */
  await p.evaluate(() => { CG_LS.setItem("cognicopia_resident_p1", JSON.stringify({ schema: "cognicopia.residentProfile", id: "p1", tier1_core: { preferredName: "Peggy", cognitiveTier: 1, visualNeeds: { contrastMode: "standard", fontSizeScale: 1, lineThicknessPt: 2 } }, tier2_enrichment: {}, tier3_deep: {} })); });
  await fresh("#/safety"); await tab("tier"); await p.selectOption("#saRes", "p1");
  for (const o of ["two-step", "reads", "stays", "sorts", "marks", "sings", "knows", "busy"]) await p.check('[name="obs-' + o + '"][value="2"]');
  ok(/1a Full detail, independent/.test(await p.textContent(".st-banner")) && /16 of 16/.test(await p.textContent(".st-banner")), "all Usually suggests 1a (16 of 16)");
  for (const o of ["two-step", "reads", "stays", "sorts", "marks", "sings", "knows", "busy"]) await p.check('[name="obs-' + o + '"][value="0"]');
  ok(/3b Simplified, sensory/.test(await p.textContent(".st-banner")), "all Not seen suggests 3b");
  await p.click("#saApply"); await p.waitForSelector("#saMsg:not(:empty)"); await p.waitForTimeout(300);
  const pr = await p.evaluate(() => JSON.parse(CG_LS.getItem("cognicopia_resident_p1")).tier1_core); ok(pr.microTier === "3b" && pr.cognitiveTier === 3 && pr.visualNeeds.fontSizeScale === 1.3 && pr.visualNeeds.lineThicknessPt === 4 && pr.preferredName === "Peggy", "applying writes the micro-tier and the print values to the profile and keeps the rest");
  const tp = await p.$$eval("#saRes, #saApply, #saPrintBlank, #saMicro", (e) => e.map((x) => Math.round(x.getBoundingClientRect().height))); const radios = await p.$$eval(".st-matrix .st-opt", (e) => e.map((x) => Math.round(x.getBoundingClientRect().height))); ok(tp.every((h) => h >= 52) && radios.every((h) => h >= 52), "the worksheet's controls are 52 px or taller (" + Math.min(...tp, ...radios) + ")");
  await p.click("#saPrintBlank"); await p.waitForTimeout(500); await p.emulateMedia({ media: "print" }); const wf = path.join(os.tmpdir(), "ws-" + process.pid + ".pdf"); fs.writeFileSync(wf, await p.pdf({ preferCSSPageSize: true, printBackground: true })); await p.emulateMedia({ media: "screen" }); const ws = sizes(wf); fs.unlinkSync(wf);
  ok(ws.length === 1 && Math.abs(ws[0][0] - 612) < 1.5 && Math.abs(ws[0][1] - 792) < 1.5, "the blank worksheet prints as one Letter page (" + JSON.stringify(ws) + ")");
  /* access log */
  await p.evaluate(() => { ActiveResident.set("p1"); }); await fresh("#/safety"); await tab("log");
  const lg = await p.evaluate(() => ({ banner: document.querySelector(".st-banner").textContent, rows: [...document.querySelectorAll(".sa-log tbody tr")].map((r) => r.cells[2].textContent), refs: [...document.querySelectorAll(".sa-log tbody tr")].map((r) => r.cells[4].textContent).filter(Boolean) }));
  ok(/checks out/.test(lg.banner) && lg.rows.includes("Session started") && lg.rows.includes("A resident was opened") && !lg.refs.some((r) => /Peggy/.test(r)), "the log shows the session start and a resident opened by code, with no name (" + lg.refs.join() + ")");
  const csvDl = p.waitForEvent("download"); await p.click("#saCsv"); const csvFile = await csvDl; const csvPath = path.join(os.tmpdir(), "al-" + process.pid + ".csv"); await csvFile.saveAs(csvPath); const csv = fs.readFileSync(csvPath, "utf8"); fs.unlinkSync(csvPath); ok(/^number,time,event/.test(csv) && /Session started/.test(csv) && !/Peggy/.test(csv), "the CSV downloads and holds no name");
  await p.evaluate(() => { const l = JSON.parse(localStorage.getItem("cognicopia_access_log")); l[0].ref = "tampered"; localStorage.setItem("cognicopia_access_log", JSON.stringify(l)); }); await p.click("#saVerify"); await p.waitForTimeout(300);
  ok(/does not check out/.test(await p.textContent(".st-banner")), "an edited entry makes the log say it does not check out");
  p.once("dialog", (d) => d.accept()); await p.click("#saReset"); await p.waitForTimeout(300); ok(/checks out/.test(await p.textContent(".st-banner")) && /started again/.test(await p.textContent(".sa-log tbody")), "starting a new log gives a log that checks out");
  /* sealed records */
  await p.evaluate(async () => { CG_LS.setItem("cognicopia_studio_journal_p1", JSON.stringify({ entries: [{ id: "j1", text: "secret journal words" }] })); CG_LS.setItem("cognicopia_slp_goals_p1", JSON.stringify({ entries: [{ id: "g1", total: { got: 18 } }] })); await window.CogniSecureStore.flush(); });
  const plain = await p.evaluate(() => { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i), v = localStorage.getItem(k) || ""; if (/studio_|slp_goals|cognicopia_resident_|backup_/.test(k) || /secret journal words/.test(v)) out.push(k); } return out; }); ok(plain.length === 0, "Studio, therapy and profile records are not in plain browser storage (" + plain.join() + ")");
  /* backups */
  await fresh("#/safety"); await tab("backup");
  const n0 = await p.textContent(".st-banner"); ok(/no backup has been made yet/.test(n0), "before the first backup the screen says none has been made");
  await p.fill("#saPass", "short"); await p.click("#saBack"); await p.waitForTimeout(200); ok(/at least 10 characters/.test(await p.textContent("#saErr")), "a short passphrase is refused with a plain message");
  await p.fill("#saPass", "a long enough passphrase"); const bk = p.waitForEvent("download"); await p.click("#saBack"); const bf = await bk; const bp = path.join(os.tmpdir(), "bk-" + process.pid + ".cognicopia"); await bf.saveAs(bp); const env = JSON.parse(fs.readFileSync(bp, "utf8"));
  ok(/full backup/.test(bf.suggestedFilename()) && env.format && /cognicopia/i.test(env.format) && !/Peggy|secret journal/.test(JSON.stringify(env)), "the first backup is a full, locked file that holds no readable name or text (" + bf.suggestedFilename() + ")");
  const opened = await p.evaluate(async (e) => { const o = await window.CogniSecureStore.openFile(e, "a long enough passphrase"); return { kind: o.kind, n: o.records.length, keys: o.records.map((r) => r.k).filter((k) => /studio|slp|resident/.test(k)) }; }, env);
  ok(opened.kind === "full" && opened.n >= 3 && opened.keys.some((k) => /studio_journal/.test(k)) && opened.keys.some((k) => /slp_goals/.test(k)), "with the passphrase it opens to the records, including the journal and therapy goals (" + opened.n + ")");
  await tab("backup"); await p.waitForTimeout(300); ok(/0<\/b> record|<b>0<\/b>/.test(await p.innerHTML(".st-banner")) || /\b0\b record/.test(await p.textContent(".st-banner")) || /^0/.test((await p.textContent(".st-banner")).trim()), "right after a backup, nothing is waiting");
  await p.evaluate(async () => { CG_LS.setItem("cognicopia_studio_journal_p1", JSON.stringify({ entries: [{ id: "j1", text: "secret journal words" }, { id: "j2", text: "a second entry" }] })); CG_LS.removeItem("cognicopia_slp_goals_p1"); await window.CogniSecureStore.flush(); });
  await tab("backup"); await fresh("#/safety"); await tab("backup"); ok(/\b2\b record/.test(await p.textContent(".st-banner")), "after a change and a removal, the screen counts two records waiting (" + (await p.textContent(".st-banner")).slice(0, 60) + ")");
  await p.fill("#saPass", "a long enough passphrase"); const bk2 = p.waitForEvent("download"); await p.click("#saBack"); const bf2 = await bk2; const bp2 = path.join(os.tmpdir(), "bk2-" + process.pid + ".cognicopia"); await bf2.saveAs(bp2); const env2 = JSON.parse(fs.readFileSync(bp2, "utf8"));
  const o2 = await p.evaluate(async (e) => { const o = await window.CogniSecureStore.openFile(e, "a long enough passphrase"); return { kind: o.kind, recs: o.records.map((r) => r.k), rem: o.removed.map((r) => r.k) }; }, env2);
  ok(/differential/.test(bf2.suggestedFilename()) && o2.kind === "differential" && o2.recs.length === 1 && /studio_journal/.test(o2.recs[0]) && o2.rem.length === 1 && /slp_goals/.test(o2.rem[0]), "the next backup is differential: one changed record and one removal (" + o2.recs.length + ", " + o2.rem.length + ")");
  /* merge the first (full) backup back: the removed goals come back, the newer journal stays */
  await fresh("#/safety"); await tab("backup"); await p.setInputFiles("#saFile", bp); await p.fill("#saPass2", "wrong passphrase"); await p.click("#saMerge"); await p.waitForTimeout(500); ok(/did not open/.test(await p.textContent("#saErr")), "a wrong passphrase is refused");
  await p.fill("#saPass2", "a long enough passphrase"); await p.click("#saMerge"); await p.waitForSelector("#saOut .msg-ok"); const mo = await p.textContent("#saOut"); await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ goals: CG_LS.getItem("cognicopia_slp_goals_p1"), j: JSON.parse(CG_LS.getItem("cognicopia_studio_journal_p1")).entries.map((e) => e.id).sort().join() }));
  ok(/1<\/b> added|\b1 added/.test(mo) && !!after.goals && after.j === "j1,j2" && !/Peggy/.test(mo), "merging the full backup brings back the removed goals and keeps both journal entries (" + mo.slice(0, 90) + ")");
  fs.unlinkSync(bp); fs.unlinkSync(bp2);
  /* the daily reminder */
  await p.evaluate(async () => { localStorage.removeItem("cognicopia_x"); await window.CogniSecureStore.flush(); });
  await p.evaluate(async () => { CG_LS.removeItem("cognicopia_backup_state"); CG_LS.setItem("cognicopia_resident_p2", JSON.stringify({ schema: "cognicopia.residentProfile", id: "p2", tier1_core: { preferredName: "Walt" } })); await window.CogniSecureStore.flush(); });
  await open("#/"); if (!(await p.waitForSelector("#cgBackupBar", { timeout: 8000 }).catch(() => null))) { console.log("DEBUG", await p.evaluate(async () => { const BD = await import("/js/backup-diff.js"); const st = BD.readState(CG_LS), idx = BD.refresh(CG_LS); return JSON.stringify({ st, r: BD.shouldPrompt(st, idx, new Date()), keys: Object.keys(idx.keys) }); })); }
  await p.waitForSelector("#cgBackupBar", { timeout: 1000 });
  const bar = await p.evaluate(() => ({ t: document.querySelector("#cgBackupBar").textContent, btn: [...document.querySelectorAll("#cgBackupBar .btn")].map((b) => b.textContent + ":" + Math.round(b.getBoundingClientRect().height)) })); ok(/changed and no backup has been made today/.test(bar.t) && bar.btn.length === 3 && bar.btn.every((b) => +b.split(":")[1] >= 52), "the daily reminder appears with three large buttons (" + bar.btn.join(", ") + ")");
  await p.click("#cgBackupBar .btn:nth-of-type(2)"); await p.waitForTimeout(300); await open("#/"); await p.waitForTimeout(2500); ok(!(await p.$("#cgBackupBar")), "after 'Remind me tomorrow' it does not come back the same day");
  /* device lock */
  await route("#/safety"); await tab("device"); await p.waitForSelector("#saLock"); ok(!(await p.$eval("#saLock", (c) => c.checked)) && /tag/.test(await p.textContent(".st-banner")), "the device lock is off by default and shows only a short tag");
  await p.check("#saLock"); await p.waitForTimeout(500); ok((await p.evaluate(() => localStorage.getItem("cognicopia_device_lock"))) === "1" && /is on/.test(await p.textContent("#saMsg")), "turning it on is remembered");
  await p.click("#saRebind"); await p.waitForTimeout(600); ok(/No kept key|Paste the key|nothing/i.test(await p.textContent("#saMsg")), "with no license kept here, 'Use this key on this computer' says so plainly");
  await p.uncheck("#saLock"); await p.waitForTimeout(400); ok((await p.evaluate(() => localStorage.getItem("cognicopia_device_lock"))) === null, "and it can be turned off again");
  ok(outside.length === 0 && errs.length === 0, "no outside request and no script error (" + outside.concat(errs).slice(0, 2).join("; ") + ")");
  await ctx.close();
} finally { await browser.close(); srv.close(); }
if (problems.length) { console.error("safety UI check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("safety UI check passed: " + passed + " checks in a real browser (palettes and fonts, rapid tier worksheet, access log, sealed records, backups and merge, daily reminder, device lock)");
