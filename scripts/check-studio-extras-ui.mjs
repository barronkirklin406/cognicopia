#!/usr/bin/env node
/* The Studio extras on the Packet Builder page, in a real browser (Playwright; exit 2 where it is not installed): the index-card and hardcover
   pages go through the builder's print stage to PDFs whose pages really are 4 x 6 in, 5 x 7 in and 8.25 x 11 in; the QR code on a printed card is
   read back by a decoder (where OpenCV is installed); the progress report prints as two Letter pages; the sound page plays with no outside
   request; and the new buttons are there. */
import { loadPlaywright, serve } from "./lib/browser.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
let passed = 0; const problems = []; const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright(); const { srv, base } = await serve(); const browser = await chromium.launch();
const py = `import pypdfium2 as pdfium,json,sys
pdf=pdfium.PdfDocument(sys.argv[1]); out=[]
for i in range(len(pdf)):
    w,h=pdf[i].get_size(); out.append([round(w,1),round(h,1)])
print(json.dumps(out))`;
const sizes = (file) => JSON.parse(execFileSync("python3", ["-c", py, file], { encoding: "utf8" }));
const decode = (file, page) => { try { return execFileSync("python3", ["-c", `import pypdfium2 as pdfium,cv2,numpy as np,sys
pdf=pdfium.PdfDocument(sys.argv[1]); im=pdf[int(sys.argv[2])].render(scale=4).to_numpy(); g=cv2.cvtColor(im,cv2.COLOR_RGB2GRAY) if im.shape[2]==3 else cv2.cvtColor(im,cv2.COLOR_RGBA2GRAY)
t,_,_=cv2.QRCodeDetector().detectAndDecode(g); print(t)`, file, String(page)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch (e) { return null; } };
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (x) { /* ignore */ } });
  const p = await ctx.newPage(), errs = [], outside = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 160))); p.on("request", (r) => { if (!r.url().startsWith(base) && !/^(data|blob|about):/.test(r.url())) outside.push(r.url()); });
  await p.goto(base + "builder.html#/reminiscence"); await p.waitForSelector("#rmIdx4", { timeout: 15000 }); await p.waitForTimeout(500);
  const btn = await p.evaluate(() => ({ four: !!document.querySelector("#rmIdx4"), five: !!document.querySelector("#rmIdx5"), deck: !!document.querySelector("#rmDeck"), h: [...document.querySelectorAll("#rmIdx4,#rmIdx5")].map((b) => b.getBoundingClientRect().height) }));
  ok(btn.four && btn.five && btn.deck && btn.h.every((h) => h >= 52), "the 4 x 6 and 5 x 7 index-card buttons are on the Conversational Decks screen at 52 px or taller (" + btn.h + ")");
  const route = async (h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(600); };
  const printTo = async (pages, opts) => {
    await p.evaluate(async ({ pages, opts }) => { window.print = () => {}; BookUI.print(pages, "extras test", null, opts || {}); await new Promise((r) => setTimeout(r, 700)); }, { pages, opts });
    await p.emulateMedia({ media: "print" }); const f = path.join(os.tmpdir(), "ex-" + process.pid + "-" + Math.random().toString(36).slice(2) + ".pdf"); fs.writeFileSync(f, await p.pdf({ preferCSSPageSize: true, printBackground: true })); await p.emulateMedia({ media: "screen" }); return f;
  };
  for (const [size, w, h] of [["4x6", 288, 432], ["5x7", 360, 504]]) {
    const pages = await p.evaluate(async (size) => { const F = await import("/js/deck-formats.js"); return F.indexCardPages([{ kind: "era", title: "The radio years", invite: "What music was playing at home?" }, { kind: "work", title: "A first job", invite: "Tell me about the work you did." }], { size, tier: 2 }).map((x) => ({ html: x.html })); }, size);
    const f = await printTo(pages); const s = sizes(f);
    ok(s.length === 4 && s.every(([a, b]) => Math.abs(a - w) < 1.5 && Math.abs(b - h) < 1.5), size + ": the PDF has four pages (front and back of two cards), each " + w + " x " + h + " pt (" + JSON.stringify(s) + ")");
    const got = decode(f, 0); if (got === null) console.log("  (QR decode skipped for " + size + ": OpenCV or PyPDFium is not installed)"); else ok(/^builder\.html#\/audio\/[a-z]+$/.test(got), size + ": the QR code printed on the first card reads back as a sound address (" + got + ")");
    fs.unlinkSync(f);
  }
  const kdp = await p.evaluate(async () => { const L = await import("/js/legacy-book.js"), today = new Date("2026-11-10T12:00:00"); const b = await L.compile({ profile: () => ({ tier1_core: { preferredName: "Margaret" }, tier2_enrichment: { birthYear: 1938 } }), keeper: () => ({ entries: [{ date: "2026-10-20", kind: "journal", title: "Garden", text: "I planted the beans by the fence.", share: true }] }), journal: () => ({ entries: [] }), tracking: () => ({ entries: [] }), engagement: () => [] }, "r1", { today, kdp: true }); return { n: b.pages.length, pages: b.pages.map((x) => ({ html: x.html })) }; });
  const fk = await printTo(kdp.pages, { twoSided: true }); const sk = sizes(fk);
  ok(sk.length === kdp.n && sk.every(([a, b]) => Math.abs(a - 594) < 1.5 && Math.abs(b - 792) < 1.5), "the hardcover edition prints " + kdp.n + " pages of 8.25 x 11 in (594 x 792 pt) (first " + JSON.stringify(sk[0]) + ", count " + sk.length + ")");
  fs.unlinkSync(fk);
  const rep = await p.evaluate(async () => { const R = await import("/js/tracking-report.js"), C = await import("/js/studio-core.js"), today = new Date("2026-11-10T12:00:00"); const entries = ["2026-08", "2026-09", "2026-10"].map((m, i) => C.normalizeEntry({ month: m, stage: "middle", engagement: 1 + i, frustration: 2 - i, fatigue: 1, triggers: ["Noise"], note: "Note " + m })); return R.reportPages({ name: "Margaret", entries, today }).map((x) => ({ html: x.html })); });
  const fr = await printTo(rep); const sr = sizes(fr);
  ok(sr.length === 2 && sr.every(([a, b]) => Math.abs(a - 612) < 1.5 && Math.abs(b - 792) < 1.5), "the progress report prints as two Letter pages (" + JSON.stringify(sr) + ")");
  fs.unlinkSync(fr);
  /* the Studio controls: report buttons, climate and stress chips, dictation and names found in a note */
  await route("#/tracking"); await p.waitForSelector("#stRes", { timeout: 15000 });
  await p.evaluate(() => { CG_LS.setItem("cognicopia_resident_p1", JSON.stringify({ schema: "cognicopia.residentProfile", id: "p1", tier1_core: { preferredName: "Peggy" }, tier2_enrichment: { birthYear: 1938 }, tier3_deep: { people: [] } })); });
  await route("#/planner"); await route("#/tracking"); await p.waitForSelector("#stRes"); await p.selectOption("#stRes", "p1"); await p.waitForSelector("#stReport");
  const rb = await p.$$eval("#stReport, #stReportPdf", (b) => b.map((x) => Math.round(x.getBoundingClientRect().height)));
  ok(rb.length === 2 && rb.every((h) => h >= 52), "the tracking tool has the print and PDF progress-report buttons at 52 px or taller (" + rb + ")");
  await p.evaluate(() => { window.__pdf = null; });
  const dl = p.waitForEvent("download", { timeout: 15000 }).catch(() => null); await p.click("#stReportPdf"); const d = await dl;
  if (d) { const f = path.join(os.tmpdir(), "rp-" + process.pid + ".pdf"); await d.saveAs(f); const head = fs.readFileSync(f).subarray(0, 5).toString(); const sz = sizes(f); fs.unlinkSync(f); ok(head === "%PDF-" && sz.length >= 1 && Math.abs(sz[0][0] - 612) < 1.5, "the PDF button downloads a real Letter-size PDF (" + JSON.stringify(sz[0]) + ")"); }
  else ok(false, "the PDF button did not start a download (" + (await p.textContent("#stReportMsg")) + ")");
  await route("#/planner"); await p.waitForSelector("#plClimate"); await p.click("#plDefaults"); await p.waitForTimeout(300);
  const before = await p.$$eval('[data-f="milestone"]', (e) => e.filter((x) => x.value).length);
  await p.selectOption("#plClimate", "cold"); await p.waitForTimeout(300);
  const jan = await p.$eval('tr[data-m="01"] [data-f="season"]', (e) => e.value); ok(jan === "Long winter", "choosing a cold climate renames January's season (" + jan + ")");
  await p.click("#plStressAll"); await p.waitForTimeout(300);
  const after = await p.$$eval('[data-f="milestone"]', (e) => e.filter((x) => x.value).length), chips = await p.$$eval("[data-stress]", (c) => c.map((x) => Math.round((x.closest("label") || x).getBoundingClientRect().height)));
  ok(after < before && chips.length === 6 && chips.every((h) => h >= 52), "one click leaves out every stress-trigger holiday (" + before + " months with a holiday, then " + after + "); the six chips are 52 px or taller");
  await route("#/journal"); await p.waitForSelector("#jnRes"); await p.selectOption("#jnRes", "p1"); await p.waitForSelector("#jnForm");
  const mic = await p.$eval("#jnMic", (b) => Math.round(b.getBoundingClientRect().height)); ok(mic >= 52, "the journal has a dictation button of 52 px or taller (" + mic + ")");
  await p.fill("#jnText", "Her granddaughter Lily visited with the dog named Biscuit."); await p.click("#jnForm button[type=submit]");
  await p.waitForFunction(() => /Lily|Biscuit/.test(document.querySelector("#jnFeed").textContent + document.querySelector("#jnMicMsg").textContent + document.querySelector("#view").textContent), null, { timeout: 5000 }); await p.waitForTimeout(400);
  const ppl = await p.evaluate(() => JSON.parse(CG_LS.getItem("cognicopia_resident_p1")).tier3_deep.people.map((x) => x.name + (x.isPet ? " (pet)" : "")).sort().join(", "));
  ok(ppl === "Biscuit (pet), Lily", "names and pets in a saved note are added to the resident's profile (" + ppl + ")");
  await p.goto(base + "builder.html#/audio/train"); await p.waitForSelector("#auPlay:not([disabled])", { timeout: 8000 });
  const au = await p.evaluate(() => ({ text: document.querySelector("#auText").textContent, h: document.querySelector("#auPlay").getBoundingClientRect().height }));
  ok(/Train whistle|steam whistle/i.test(au.text) && /no internet/.test(au.text) && au.h >= 52, "the sound page for a QR code names the sound, says it needs no internet and has a large Play button");
  await p.click("#auPlay"); await p.waitForTimeout(300); ok(!(await p.evaluate(() => document.querySelector("#auStop").disabled)), "pressing Play starts the sound and enables Stop");
  await p.goto(base + "builder.html#/audio/zzz"); await p.waitForSelector("#auText", { timeout: 8000 }); await p.waitForTimeout(600);
  ok(/not on this device/.test(await p.evaluate(() => document.querySelector("#auText").textContent)), "an unknown sound address gives a plain message, not an error");
  ok(outside.length === 0 && errs.length === 0, "no outside request and no script error (" + outside.concat(errs).slice(0, 2).join("; ") + ")");
  await ctx.close();
} finally { await browser.close(); srv.close(); }
if (problems.length) { console.error("studio extras UI check FAILED: " + problems.length + ", " + passed + " passed"); problems.forEach((x) => console.error("  - " + x)); process.exit(1); }
console.log("studio extras UI check passed: " + passed + " checks in a real browser (index-card page sizes, QR on a printed card, hardcover 8.25 x 11 in, progress report, sound page)");
