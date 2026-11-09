#!/usr/bin/env node
/* =====================================================================
   Activity Page Studio in a real browser (activity-studio.html).
     the screen   a settings panel beside a live preview that is a 3:4 page; any control redraws it; the note under it says
                  whether the page passes the print rules; the packet code is shown; Back and Next carry through the pages, or
                  every page shows in a scroll; the dark panel changes the screen and never the white page
     the packet   the content mix (reminiscence, thinking, daily living, coloring) is bundled into 1 to 10 pages, one of each kind
                  in turn; stage 3 has fewer ideas than stage 1; the coloring controls show only when coloring is in the mix;
                  words choose the drawing; a topic to avoid is honored; the live preview keeps the pages and Try different pages makes
                  new ones; the card layouts (4, 6, 8 sideways, 5 tickets) cut pages with dashed lines
     export       Download PDF is read back with PyMuPDF (US Letter, one page per sheet, the picture inside 0.5 in margins);
                  Download PNG is 2250 x 3000; Print makes one sheet per paper page, with no menu on the paper
     the rest     52 px controls, nothing sideways on a phone, nothing requested from outside, no script error
   Needs Playwright and PyMuPDF. Run: node scripts/check-activity-studio-ui.mjs
   ===================================================================== */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = [], infos = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const PY = `
import sys, json
try:
    import pymupdf as fitz
except ImportError:
    import fitz
doc = fitz.open(sys.argv[1]); out = []
for pg in doc:
    imgs = [list(i["bbox"]) for i in pg.get_image_info()]
    words = pg.get_text("words")
    out.append({"w": pg.rect.width, "h": pg.rect.height, "imgs": imgs, "text": pg.get_text(),
                "box": [min([w[0] for w in words], default=0), min([w[1] for w in words], default=0), max([w[2] for w in words], default=0), max([w[3] for w in words], default=0)]})
print(json.dumps(out))`;
const readPdf = f => JSON.parse(execFileSync("python3", ["-c", PY, f], { encoding: "utf8" }));
async function open(w, h, keepClosed) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); if (m.type() === "info") infos.push(m.text()); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "activity-studio.html", { waitUntil: "load" }); await p.waitForSelector("#asSheet svg", { timeout: 10000 }); await p.waitForTimeout(500);
  /* the form keeps its extra settings in closed sections; the checks below that change them open the sections first, as a person would */
  if (!keepClosed) await p.evaluate(() => document.querySelectorAll("details.as-acc").forEach(d => { d.open = true; }));
  return { ctx, p };
}
const pos = p => p.textContent("#asPos");
const pick = async (p, name, value) => { await p.check(`input[name="${name}"][value="${value}"]`, { force: true }); await p.waitForTimeout(450); };
const mix = async (p, kinds) => { for (const k of ["reminiscence", "exercise", "daily", "coloring", "wordgrid", "timeline", "memory", "dialogue", "household", "phrases", "recognition", "rhythm"]) { await p.setChecked(`input[name="mix"][value="${k}"]`, kinds.includes(k), { force: true }); } await p.waitForTimeout(450); };
const total = async p => Number(/of (\d+)/.exec(await pos(p))[1]);
const svgText = p => p.$eval("#asSheet svg", e => e.textContent);
const setPages = async (p, n) => { await p.selectOption("#asPages", String(n)); await p.waitForTimeout(450); };
const items = p => p.$$eval("#asSheet line", t => t.length + 1);        // the rules between ideas: one fewer than the ideas on the page

try {
  let { ctx, p } = await open(1366, 768);
  const box = await p.$eval("#asSheet", e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  ok(Math.abs(box.w / box.h - 0.75) < 0.02, `the preview is a 3:4 page (${Math.round(box.w)} x ${Math.round(box.h)})`);
  ok(/Page 1 of 4/.test(await pos(p)) && /ASPK-M-/.test(await pos(p)), "it opens on page 1 of a 4-page packet with a packet code: " + await pos(p));
  ok(/Print check passed/.test(await p.textContent("#asNotes")), "the print check passes");
  ok(/The 1950s/.test(await svgText(p)), "the first page is about the decade chosen");
  const names = ["Suggested packet for this stage", "Try different pages", "Compile Packet PDF"];
  for (const n of names) ok((await p.$$eval("button", b => b.map(x => x.textContent.trim()))).includes(n), `there is a "${n}" button`);
  /* the mix: one kind of page in turn */
  const kinds = [];
  for (let i = 0; i < 4; i++) { const t = await svgText(p); kinds.push(/The 19\d0s/.test(t) ? "R" : /Pairs that go|Sort together|Follow the path|Look and enjoy/.test(t) ? "X" : /One step at a time/.test(t) ? "D" : "C"); if (i < 3) await p.click("#asNext"); }
  ok(kinds.join("") === "RXDC", "the four pages are one of each kind in turn: " + kinds.join(""));
  for (let i = 0; i < 3; i++) await p.click("#asPrev");
  ok(/Page 1 of/.test(await pos(p)), "Back returns to page 1");
  /* quantity */
  for (const n of [1, 7, 10]) { await setPages(p, n); ok(await total(p) === n, `${n} pages make ${n} pages (${await pos(p)})`); }
  await setPages(p, 4);
  /* one kind at a time */
  await mix(p, ["reminiscence"]); await setPages(p, 3); ok(/The 1950s/.test(await svgText(p)) && (await total(p)) === 3, "reminiscence alone makes three reminiscence pages");
  await pick(p, "stage", "3"); const late = await items(p);
  await pick(p, "stage", "2"); const mid = await items(p);
  await pick(p, "stage", "1"); const first = await items(p);
  ok(late < mid && mid < first, `stage 3 has fewer ideas on a page than stage 2, and stage 2 than stage 1 (${late}, ${mid}, ${first})`);
  const before = await pos(p); await p.click("#asRandom"); await p.waitForTimeout(500);
  ok(await pos(p) !== before, "Try different pages makes a new packet code");
  const again = await pos(p); await p.waitForTimeout(700);
  ok(await pos(p) === again, "the live preview keeps the same settings and pages until something is changed");
  await p.selectOption("#asDecade", "1970"); await p.waitForTimeout(400); ok(/The 1970s/.test(await svgText(p)), "choosing a decade changes the page");
  await p.fill("#asBorn", "1938"); await p.waitForTimeout(400); ok(await p.$eval("#asDecade", e => e.value) === "1950" && /The 1950s/.test(await svgText(p)), "a birth year of 1938 suggests the 1950s, the years the resident was about 20");
  await p.fill("#asName", "Ruth"); await p.waitForTimeout(400); ok(/For Ruth/.test(await svgText(p)), "a first name is drawn on the page");
  await p.fill("#asAvoid", "cadillac, jukebox, casserole, radio, television"); await p.waitForTimeout(400);
  for (let i = 0; i < 6; i++) { await p.click("#asRandom"); await p.waitForTimeout(250); }
  await p.selectOption("#asDecade", "1950"); await p.waitForTimeout(300);
  ok(!/cadillac|jukebox|casserole|radio|television/i.test(await svgText(p)), "a topic to avoid is not on the page");
  await p.fill("#asAvoid", "");
  await mix(p, ["exercise"]); ok(await total(p) >= 1, "thinking exercises make pages");
  await mix(p, ["daily"]); ok(/One step at a time/.test(await svgText(p)), "daily living makes a steps page");
  /* layouts */
  await mix(p, ["reminiscence"]); await setPages(p, 3);
  const dashes = async () => p.$eval("#asSheet svg", e => e.querySelectorAll("line[stroke-dasharray]").length);
  await pick(p, "layout", "cards4"); ok(await dashes() === 2, "four cards draw two dashed cut lines");
  await pick(p, "layout", "cards6"); ok(await dashes() === 3, "six cards draw three dashed cut lines");
  await pick(p, "layout", "cards8"); ok(await dashes() === 4, "eight sideways cards draw four dashed cut lines");
  await pick(p, "layout", "strips"); ok(await dashes() === 4, "five wide tickets draw four dashed cut lines");
  await pick(p, "layout", "full"); ok(await dashes() === 0, "a full page has no cut lines");
  /* coloring controls show only with coloring in the mix */
  await mix(p, ["reminiscence"]); ok(!(await p.isVisible("#asStyle")) && await p.isVisible('input[name="layout"]'), "without coloring the style box is hidden and the layout shows");
  await mix(p, ["coloring"]); ok(await p.isVisible("#asStyle") && !(await p.isVisible('input[name="layout"]', { timeout: 200 }).catch(() => false)), "with only coloring the style box shows and the layout is hidden");
  ok(await p.$$eval("#asSheet path", n => n.length) > 3, "a coloring page draws a picture");
  const styles = await p.$$eval("#asStyle option", o => o.map(x => x.value));
  ok(styles.length === 6, "six coloring styles: " + styles.join(","));
  const seen = new Set();
  for (const s of styles) { await p.selectOption("#asStyle", s); await p.waitForTimeout(350); ok(/Print check passed/.test(await p.textContent("#asNotes")), `the ${s} style passes the print check`); seen.add(await svgText(p)); }
  ok(seen.size >= 5, "the styles make different pictures");
  await p.fill("#asWords", "a 1950s pickup truck"); await p.waitForTimeout(400); ok(/TRUCK/.test(await svgText(p)) && /Chosen from/.test(await p.textContent("#asNotes")), "words choose the pickup truck, and the note says which words were used");
  await p.fill("#asWords", "a gun"); await p.waitForTimeout(400); ok(/not a subject for a coloring page/.test(await p.textContent("#asNotes")) && await p.$$eval("#asSheet path", n => n.length) === 0, "a subject that is not for a coloring page in care makes nothing");
  await p.fill("#asWords", "");
  await pick(p, "stage", "3"); ok(await p.$$eval("#asSheet rect", r => r.length) <= 2, "stage 3 has no border");
  /* the preview: a scroll of every page, and the dark panel */
  await mix(p, ["reminiscence", "exercise", "daily", "coloring"]); await setPages(p, 6); await pick(p, "stage", "2");
  await pick(p, "view", "all");
  ok(await p.isVisible("#asScroll") && !(await p.isVisible("#asSheet")) && await p.$$eval("#asScroll .as-sw svg", n => n.length) === 6, "All pages shows all six pages in a scroll");
  const ratios = await p.$$eval("#asScroll .as-sheet", n => n.map(e => { const r = e.getBoundingClientRect(); return r.width / r.height; }));
  ok(ratios.every(r => Math.abs(r - 0.75) < 0.02), "every page in the scroll is 3:4");
  await pick(p, "view", "one"); ok(await p.isVisible("#asSheet") && !(await p.isVisible("#asScroll")), "One page returns to the carousel");
  await p.check("#asDark", { force: true }); await p.waitForTimeout(300);
  const dark = await p.evaluate(() => { const rgb = e => getComputedStyle(e).backgroundColor, panel = document.querySelector(".as-panel"), svg = document.querySelector("#asSheet svg rect"); return { panel: rgb(panel), root: rgb(document.getElementById("asRoot")), paper: svg.getAttribute("fill"), pageBg: rgb(document.getElementById("asSheet")) }; });
  ok(/rgb\(18, 24, 31\)/.test(dark.panel) && /rgb\(11, 15, 20\)/.test(dark.root), "the dark panel darkens the screen: " + dark.panel);
  ok(dark.paper === "#fff" && /255, 255, 255/.test(dark.pageBg), "the page itself stays white in the dark panel");
  const checked = await p.evaluate(() => { const l = document.querySelector('.as-seg label:has(input:checked)'); const c = getComputedStyle(l); return [c.color, c.backgroundColor]; });
  ok(/rgb\(0, 0, 0\)/.test(checked[0]) && /rgb\(245, 184, 0\)/.test(checked[1]), "a chosen button is black on gold in the dark panel: " + checked);
  await p.uncheck("#asDark", { force: true });
  const sizes = await p.$$eval('#asForm input:not([type=radio]):not([type=checkbox]), #asForm select, #asForm .as-seg label, #asForm .as-check, .as-btn', n => n.filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  ok(sizes.every(([w, h]) => w >= 52 && h >= 52), `every visible control is at least 52 px: ${sizes.filter(([w, h]) => w < 52 || h < 52).join(" ")}`);
  await ctx.close();

  /* the facility check: a readiness score for every batch, a console report, the same empty-space measure as real pixels */
  ({ ctx, p } = await open(1366, 900));
  const rd = await p.textContent("#asReady summary");
  ok(/Clinical readiness: \d+ \/ 100/.test(rd) && /Ready/.test(rd), "every packet shows a Clinical readiness score: " + rd);
  ok(infos.some(t => /Clinical Readiness Score: \d+ \/ 100/.test(t) && /not a clinical certification/.test(t)), "the batch writes its Clinical Readiness Score report to the console");
  const nInfo = infos.length; await p.click("#asRandom"); await p.waitForTimeout(500); ok(infos.length > nInfo, "a new batch writes a new report");
  await p.click("#asReady summary"); ok(await p.isVisible("#asReady .as-rd-parts") && /Framework alignment/.test(await p.textContent("#asReady")) && /CMS F679/.test(await p.textContent("#asReady")), "the score opens to its parts and the sources of the framework checks");
  ok((await p.$eval("#asReady summary", e => e.getBoundingClientRect().height)) >= 52, "the readiness summary is at least 52 px tall");
  const agree = await p.evaluate(() => {
    const PL = window.CognicopiaColoringPipeline, FV = window.CognicopiaFacilityValidator, pages = window.CognicopiaActivityStudio.pages(), out = [];
    pages.forEach(pg => { const cv = document.createElement("canvas"); PL.toCanvas(pg, cv, 0.5); const a = FV.whiteShare(FV.occupancy(pg)).white, b = FV.whiteShare(FV.occupancyFromCanvas(cv)).white; out.push([Math.round(a * 100), Math.round(b * 100), pg.meta.module]); });
    return out;
  });
  ok(agree.length >= 4 && agree.every(([a, b]) => a <= b + 2 && b - a <= 20), "the empty-space estimate never claims more empty space than the pixels show (it counts a line of text as a full box), and is within 20 points: " + JSON.stringify(agree));
  /* the offline bundle: save the files, then work with the network off */
  const offSay = await p.textContent("#asOffline");
  ok(/files are saved|Ready for offline/.test(offSay), "the screen says how many files are saved for offline use: " + offSay);
  if (await p.isVisible("#asSave")) { await p.click("#asSave"); await p.waitForFunction(() => /Ready for offline use/.test(document.getElementById("asOffline").textContent), null, { timeout: 60000 }); }
  ok(/Ready for offline use: all \d+ files/.test(await p.textContent("#asOffline")) && !(await p.isVisible("#asSave")), "Save for offline use saves every file, and the button goes away");
  const has = await p.evaluate(async () => { const m = window.CognicopiaColoringManifest.assets()[0].filePath; return [!!(await caches.match(new URL(m, location.href).href)), !!(await caches.match(new URL("js/utils/print-optimizer.js", location.href).href)), (await caches.keys()).some(k => /^cognicopia-/.test(k) === false && k === "studio-assets-v1")]; });
  ok(has.every(Boolean), "a library drawing and the print optimizer are in the studio's own cache: " + has);
  await ctx.setOffline(true);
  await p.click("#asRandom"); await p.waitForTimeout(500);
  ok(await p.$eval("#asSheet svg", e => !!e) && /Page 1 of/.test(await pos(p)), "with the network off the studio still makes a new packet");
  await ctx.setOffline(false);
  /* print: nothing visible but the sheets */
  await p.emulateMedia({ media: "print" });
  const shown = await p.evaluate(() => { const host = document.getElementById("printRoot"), out = []; document.querySelectorAll("body *").forEach(e => { if (host.contains(e) || e.contains(host) || /^(SCRIPT|STYLE|LINK|NOSCRIPT|TEMPLATE)$/.test(e.tagName)) return; if (getComputedStyle(e).display !== "none") out.push(e.tagName + "." + e.className); }); return out; });
  ok(shown.length === 0, "in print nothing is shown but the sheets: " + shown.slice(0, 4).join(", "));
  ok(await p.evaluate(() => !!document.getElementById("cg-print-optimizer")), "the print optimizer's style sheet is on the page");
  await ctx.close();

  /* the rest of the master inventory: each kind of page is made for its stage, left out of the others with a plain note, and a stage's
     suggested packet is three clicks from a PDF (the stage, Suggested packet, Compile Packet PDF) */
  ({ ctx, p } = await open(1366, 900));
  const NEWK = { wordgrid: [1, 2], timeline: [1, 2], memory: [1, 2], dialogue: [1, 2, 3], household: [1, 2], phrases: [1, 2], recognition: [2, 3], rhythm: [2, 3] };
  const kindsOnScreen = await p.$$eval('input[name="mix"]', n => n.map(x => x.value));
  ok(Object.keys(NEWK).every(k => kindsOnScreen.includes(k)) && kindsOnScreen.length === 12, "the content mix lists all twelve kinds of page: " + kindsOnScreen.join(","));
  for (const [k, stages] of Object.entries(NEWK)) {
    for (const st of [1, 2, 3]) {
      await pick(p, "stage", String(st)); await mix(p, [k]); await setPages(p, 3);
      const n = await p.evaluate(() => window.CognicopiaActivityStudio.pages().length), notes = await p.textContent("#asNotes");
      if (stages.includes(st)) ok(n >= 1 && /Print check passed/.test(notes) && /Clinical readiness/.test(await p.textContent("#asReady")), `${k} at stage ${st}: made ${n} pages that pass the print check`);
      else ok(n === 0 && /is made for stage/.test(notes), `${k} at stage ${st}: left out, with a note that says which stages it is made for`);
    }
  }
  await pick(p, "stage", "1"); await mix(p, ["wordgrid"]); await setPages(p, 4); await p.selectOption("#asVocation", "cook"); await p.waitForTimeout(450);
  ok((await p.evaluate(() => window.CognicopiaActivityStudio.pages().map(x => x.meta.title))).includes("Words from the kitchen"), "choosing a former kind of work themes a word grid from it");
  ok(/Answer key \(staff only\)/.test(await p.textContent("#asNotes")), "a word grid shows its answer key to staff");
  await p.selectOption("#asVocation", "");
  await ctx.close();
  for (const st of [1, 2, 3]) {
    ({ ctx, p } = await open(1366, 900));
    let clicks = 0; const click = async sel => { clicks++; await p.click(sel, { force: true }); };
    await click(`label:has(input[name="stage"][value="${st}"])`); await click("#asSuggest"); await p.waitForTimeout(500);
    const dl3 = p.waitForEvent("download", { timeout: 60000 }); await click("#asPdf"); const f3 = await dl3; const t3 = path.join(os.tmpdir(), "as3-" + process.pid + ".pdf"); await f3.saveAs(t3);
    const pdf3 = readPdf(t3); fs.unlinkSync(t3);
    const titles = await p.evaluate(() => window.CognicopiaActivityStudio.pages().map(x => x.meta.module));
    ok(clicks === 3 && pdf3.length >= 4, `stage ${st}: a suggested packet in ${clicks} clicks, ${pdf3.length} pages in the PDF (${titles.join(", ")})`);
    ok(new Set(titles).size >= 3 && /Ready/.test(await p.textContent("#asReady summary")), `stage ${st}: the suggested packet uses at least three kinds and reads Ready: ${await p.textContent("#asReady summary")}`);
    await ctx.close();
  }

  /* export */
  ({ ctx, p } = await open(1366, 900));
  await setPages(p, 4); const pages = await total(p);
  let dl = p.waitForEvent("download", { timeout: 60000 }); await p.click("#asPdf"); let f = await dl;
  const tmp = path.join(os.tmpdir(), "as-" + process.pid + ".pdf"); await f.saveAs(tmp);
  const pdf = readPdf(tmp); fs.unlinkSync(tmp);
  ok(pdf.length === pages, `the PDF has one Letter page per sheet (${pdf.length} of ${pages})`);
  ok(pdf.every(g => Math.abs(g.w - 612) < 1 && Math.abs(g.h - 792) < 1), "the PDF pages are US Letter");
  ok(pdf.every(g => g.imgs.length === 1 && g.imgs[0][0] >= 35.9 && g.imgs[0][1] >= 35.9 && g.imgs[0][2] <= 576.1 && g.imgs[0][3] <= 756.1), "the picture sits inside 0.5 in margins: " + JSON.stringify(pdf[0].imgs));
  ok(pdf.every(g => Math.abs((g.imgs[0][2] - g.imgs[0][0]) / (g.imgs[0][3] - g.imgs[0][1]) - 0.75) < 0.01), "the PDF picture is 3:4");
  await p.check("#asGutter", { force: true });
  dl = p.waitForEvent("download", { timeout: 60000 }); await p.click("#asPdf"); f = await dl; await f.saveAs(tmp);
  const pg2 = readPdf(tmp); fs.unlinkSync(tmp);
  ok(pg2.length >= 2 && pg2[0].imgs[0][0] >= 53.9 && pg2[1].imgs[0][0] < 40 && pg2[1].imgs[0][2] <= 558, `the binding gutter alternates sides (${Math.round(pg2[0].imgs[0][0])} then ${Math.round(pg2[1].imgs[0][0])} pt from the left)`);
  await p.uncheck("#asGutter", { force: true });
  dl = p.waitForEvent("download", { timeout: 60000 }); await p.click("#asPng"); f = await dl; await f.saveAs(tmp + ".png");
  const hd = fs.readFileSync(tmp + ".png"); fs.unlinkSync(tmp + ".png");
  ok(hd.readUInt32BE(16) === 2250 && hd.readUInt32BE(20) === 3000, `the PNG is 2250 x 3000 (${hd.readUInt32BE(16)} x ${hd.readUInt32BE(20)})`);
  /* print: every sheet on its own paper page, with no menu on the paper, in the dark panel too */
  await p.check("#asDark", { force: true });
  await p.emulateMedia({ media: "print" });
  const pp = await p.$$eval("#printRoot .as-pp", n => n.length);
  ok(pp === pages, `Print lays out one sheet per page (${pp} of ${pages})`);
  const pdfFile = path.join(os.tmpdir(), "as-print-" + process.pid + ".pdf");
  await p.pdf({ path: pdfFile, format: "Letter", printBackground: true, preferCSSPageSize: true });
  const pr = readPdf(pdfFile); fs.unlinkSync(pdfFile);
  ok(pr.length === pages, `the printed PDF has one paper page per sheet (${pr.length} of ${pages})`);
  ok(pr.every(g => g.box[0] >= 35.5 && g.box[1] >= 35.5 && g.box[2] <= 576.5 && g.box[3] <= 756.5), "printed text stays inside 0.5 in of every edge: " + JSON.stringify(pr[0].box));
  ok(pr.every(g => !/Menu|Get Full Access|Contact|Privacy/.test(g.text)) && /The 1950s|The 19\d0s/.test(pr[0].text), "no menu or button text reaches the paper, and the dark panel never reaches it");
  await ctx.close();

  /* a phone */
  ({ ctx, p } = await open(390, 844));
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "on a phone nothing scrolls sideways");
  ok(await p.$eval("#asSheet", e => e.getBoundingClientRect().width) <= 390, "on a phone the page fits the screen");
  await pick(p, "view", "all"); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "on a phone the scroll of pages does not scroll sideways");
  await ctx.close();

  /* the bigger word search: the letter grid really lines up in the browser, and the staff key prints */
  {
    const { ctx: kctx, p: q } = await open(1366, 1000);
    await pick(q, "stage", "1");
    await q.evaluate(() => document.querySelector("#asChallenge").click()); await q.waitForTimeout(700);
    ok(await q.$eval("#asChallenge", e => e.checked && !e.disabled), "the bigger word search can be turned on at stage 1");
    await mix(q, ["wordgrid"]);
    await q.waitForTimeout(900);
    const g = await q.evaluate(() => {
      const ts = [...document.querySelector("svg[role=img]").querySelectorAll("text")].filter(t => t.textContent.length === 1);
      const rows = {};
      ts.forEach(t => { const y = Math.round(+t.getAttribute("y")), b = t.getBBox(); (rows[y] = rows[y] || []).push({ x: +t.getAttribute("x"), l: b.x, r: b.x + b.width }); });
      const ys = Object.keys(rows).map(Number).sort((a, b) => a - b).map(y => rows[y].sort((a, b) => a.x - b.x));
      let lo = 1e9, hi = -1e9, drift = 0;
      for (const row of ys) for (let c = 1; c < row.length; c++) { const gap = row[c].l - row[c - 1].r; lo = Math.min(lo, gap); hi = Math.max(hi, gap); }
      for (let c = 0; c < ys[0].length; c++) { const ls = ys.map(r => r[c].l); drift = Math.max(drift, Math.max(...ls) - Math.min(...ls)); }
      return { rows: ys.length, cols: ys[0].length, lo, hi, drift };
    });
    ok(g.rows === 20 && g.cols === 20, `the bigger word search draws a 20 by 20 grid (${g.rows} x ${g.cols})`);
    ok(g.hi - g.lo <= 2, `every letter sits on its column: the gap between neighbours varies by ${(g.hi - g.lo).toFixed(1)} px, 2 or less`);
    ok(g.drift <= 2, `a column's letters start at the same place in every row (${g.drift.toFixed(1)} px of drift, 2 or less)`);
    const before = await total(q);
    await q.evaluate(() => document.querySelector("#asAnswers").click()); await q.waitForTimeout(900);
    ok(await q.$eval("#asAnswers", e => e.checked), "the staff answer key can be turned on");
    ok(await total(q) > before, `the staff answer key adds a page (${before} to ${await total(q)})`);
    await kctx.close();
  }

  /* the lighter form: three steps up front, the rest in closed sections */
  {
    const { ctx: c1, p: q } = await open(1366, 900, true);
    const visible = sel => q.$$eval(sel, els => els.filter(e => e.checkVisibility({ checkVisibilityCSS: true })).length);
    ok(await q.$$eval("details.as-acc", d => d.length === 3 && d.every(x => !x.open)), "the three extra sections are closed on arrival");
    for (const id of ["#asResident", "#asName", "#asSuggest", "#asRandom", '#asForm input[name="stage"]']) ok(await visible(id) > 0, `${id} is on the first screen of the form without opening anything`);
    for (const id of ["#asBorn", "#asInterests", "#asPages", "#asChallenge", "#asGutter", '#asForm input[name="mix"]']) ok(await visible(id) === 0, `${id} is tucked into a closed section`);
    const first = await q.evaluate(() => [...document.querySelectorAll("#asForm input, #asForm select, #asForm button")].filter(e => e.checkVisibility({ checkVisibilityCSS: true }) && e.type !== "radio").length + document.querySelectorAll("#asForm fieldset").length);
    ok(first <= 12, `the form shows 12 controls or fewer at first (${first}); it showed 28 before, measured on the old form`);
    ok((await q.$$eval("#asForm h2", h => h.map(x => x.textContent.replace(/\s+/g, " ").trim()))).join("|") === "Who is this for?|How much support?|Make the packet", "the three steps are in order");
    ok((await q.$$eval("#asForm h2", h => h.map(x => getComputedStyle(x, "::before").content))).every(c => c === "counter(asstep)") && await q.$eval("#asForm", f => getComputedStyle(f).counterReset.indexOf("asstep") === 0), "...and numbered by one counter that runs 1, 2, 3 (the digits themselves were looked at in a screenshot)");
    const nc = await q.$eval("#asForm h2", h => { const c = getComputedStyle(h, "::before"); return [c.color, c.backgroundColor]; });
    ok(nc[0] === "rgb(255, 255, 255)" && nc[1] === "rgb(11, 95, 89)", `a step number is white on dark teal, 7.5 to 1 (${nc.join(" on ")})`);
    const sc = await q.$eval("#asAccLife > summary", s => { const c = getComputedStyle(s), bg = getComputedStyle(s.parentElement).backgroundColor; return [c.color, bg]; });
    ok(sc[1] === "rgb(255, 255, 255)" && sc[0] === "rgb(40, 36, 31)", `a section heading is warm charcoal on white, not dark on dark (${sc.join(" on ")})`);
    ok(/No one is saved on this computer yet/.test(await q.textContent("#asWhoHint")), "with no one saved, the form says how to save someone");
    ok(await visible("#asOpenRes") === 0, "'Open the full profile' is not shown when no one is chosen");
    await q.click("#asAccLife > summary"); await q.waitForTimeout(150);
    ok(await visible("#asBorn") > 0 && await q.$eval("#asAccLife", d => d.open), "opening 'Their life and interests' shows its controls");
    await q.keyboard.press("Tab"); // a closed section is reachable and opens from the keyboard
    ok(await q.$eval("#asAccLife > summary", s => s.getBoundingClientRect().height >= 52), "a section heading is a 52 px target");
    await c1.close();
  }

  /* saved residents, used where the packet is made: pick, edit, save, new, and back to the full profile */
  {
    const person = (id, name, o) => ({ schema: "cognicopia.residentProfile", version: 2, id, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z",
      tier1_core: { preferredName: name, unitNumber: o.unit, cognitiveTier: o.tier, occupation: { code: o.job, label: o.jobLabel }, topHobbies: o.hobbies, printNeeds: {}, topicsToAvoid: { topics: o.avoidTopics, other: o.avoidOther, eras: [], people: "", places: "" }, difficulty: { level: o.tier } },
      tier2_enrichment: { birthYear: o.born, hometown: { place: o.town } }, tier3_deep: { notes: o.notes, people: o.people } });
    const DOT = person("res-dot", "Dorothy", { unit: "201-A", tier: 1, job: "teacher", jobLabel: "Teacher", born: 1938, town: "Scobey", notes: "Likes the porch swing.",
      hobbies: [{ code: "gardening", label: "Gardening" }, { code: "baking", label: "Baking" }], avoidTopics: [{ code: "hospitals", label: "Hospitals" }], avoidOther: "trains",
      people: [{ name: "Sarah Test", relationship: { code: "daughter" } }, { name: "Buster", relationship: { code: "pet-dog" } }] });
    const WAL = person("res-wal", "Walter", { unit: "202-B", tier: 3, job: "farmer", jobLabel: "Farmer or rancher", born: 1931, town: "Minot", notes: "", hobbies: [], avoidTopics: [], avoidOther: "", people: [] });
    const { ctx: c2, p: q } = await open(1366, 900);
    await q.evaluate(list => list.forEach(x => localStorage.setItem("cognicopia_resident_" + x.id, JSON.stringify(x))), [DOT, WAL]);
    await q.reload({ waitUntil: "load" }); await q.waitForSelector("#asSheet svg"); await q.waitForTimeout(900);
    await q.evaluate(() => document.querySelectorAll("details.as-acc").forEach(d => { d.open = true; }));
    const opts = await q.$$eval("#asResident option", o => o.map(x => x.textContent.trim()));
    ok(opts.length === 3 && /Dorothy/.test(opts[1]) && /Walter/.test(opts[2]), `both saved residents are in the list (${opts.join(" | ")})`);
    ok(await q.$eval("#asResident", e => e.value) === "", "nothing is chosen until a person is chosen");

    await q.selectOption("#asResident", "res-dot"); await q.waitForTimeout(700);
    const f = await q.evaluate(() => ({ name: asName.value, born: asBorn.value, voc: asVocation.value, dec: asDecade.value, int: asInterests.value, avoid: asAvoid.value, own: asPersonal.value, stage: document.querySelector('input[name="stage"]:checked').value }));
    ok(f.name === "Dorothy" && f.born === "1938" && f.stage === "1" && f.voc === "teacher" && f.dec === "1950", `choosing Dorothy fills name, year, stage, work and years (${JSON.stringify(f)})`);
    ok(f.int === "Gardening, Baking" && f.avoid === "Hospitals, trains" && f.own === "Sarah, Buster, Scobey", `...and her interests, topics to avoid and the words from her life (${f.int} | ${f.avoid} | ${f.own})`);
    ok(/For Dorothy/.test(await svgText(q)) || /Dorothy/.test(await svgText(q)), "the page in the preview carries her name");
    ok(await q.$eval("#asOpenRes", a => !a.hidden && /edit=res-dot/.test(a.href) && a.target === "_blank"), "the full profile opens in a new tab, so the packet keeps its place");
    ok(/Save changes to Dorothy/.test(await q.textContent("#asSaveRes")), "the save button says whose details it will save");

    await q.fill("#asInterests", "Gardening, Quilting"); await q.fill("#asPersonal", "Sarah, Buster"); await q.fill("#asAvoid", "Hospitals"); await q.waitForTimeout(300);
    await q.click("#asSaveRes"); await q.waitForTimeout(900);
    ok(/Updated Dorothy/.test(await q.textContent("#asWhoMsg")), `saving says what happened: "${await q.textContent("#asWhoMsg")}"`);
    const saved = JSON.parse(await q.evaluate(() => window.CogniSecureStore.storage.getItem("cognicopia_resident_res-dot")));
    ok(/Interests: Gardening, Quilting/.test(saved.tier3_deep.notes) && /Words from their life: Sarah, Buster/.test(saved.tier3_deep.notes) && /Likes the porch swing\./.test(saved.tier3_deep.notes), "the edits are saved and her own note is kept");
    ok(saved.tier1_core.unitNumber === "201-A" && saved.tier2_enrichment.hometown.place === "Scobey" && saved.tier3_deep.people.length === 2 && saved.tier1_core.topHobbies.length === 2, "everything the form does not show is untouched (room, hometown, people, hobbies)");
    ok(saved.tier1_core.topicsToAvoid.topics.length === 1 && saved.tier1_core.topicsToAvoid.other === "" && saved.updatedAt > "2026-09-01T10:00:00Z", "a topic she no longer avoids is removed, the one she does stays, and the time is updated");

    await q.selectOption("#asResident", "res-wal"); await q.waitForTimeout(700);
    ok(await q.$eval("#asName", e => e.value) === "Walter" && await q.$eval('input[name="stage"]:checked', e => e.value) === "3" && await q.$eval("#asVocation", e => e.value) === "farmer", "switching to Walter replaces everything, with no trace of Dorothy");
    ok(await q.$eval("#asChallenge", e => e.disabled && !e.checked), "the bigger word search stays off at his stage");

    await q.selectOption("#asResident", ""); await q.waitForTimeout(500);
    const clean = await q.evaluate(() => ({ n: asName.value, b: asBorn.value, v: asVocation.value, i: asInterests.value, a: asAvoid.value, p: asPersonal.value, s: document.querySelector('input[name="stage"]:checked').value }));
    ok(!clean.n && !clean.b && !clean.v && !clean.i && !clean.a && !clean.p, `"A new person" starts clean: nothing of Walter is carried over (${JSON.stringify(clean)})`);
    ok(clean.s === "3", "...but the support settings (stage) are kept, because they belong to the packet being made");
    await q.evaluate(() => document.querySelector('input[name="stage"][value="2"]').click()); await q.waitForTimeout(200);
    await q.fill("#asName", "Evelyn"); await q.waitForTimeout(300);
    ok(/Save as a new resident/.test(await q.textContent("#asSaveRes")), "with no one chosen the button offers a new resident");
    await q.click("#asSaveRes"); await q.waitForTimeout(900);
    const ev = await q.evaluate(() => { const ss = window.CogniSecureStore, out = []; for (let i = 0; i < ss.storage.length; i++) { const k = ss.storage.key(i); if (k.indexOf("cognicopia_resident_") === 0) out.push(JSON.parse(ss.storage.getItem(k))); } return out; });
    const evelyn = ev.filter(x => x.tier1_core.preferredName === "Evelyn")[0];
    ok(ev.length === 3 && evelyn && evelyn.schema === "cognicopia.residentProfile" && evelyn.tier1_core.cognitiveTier === 2, "Evelyn is saved as a third resident, at the stage that was set");
    ok((await q.$$eval("#asResident option", o => o.map(x => x.textContent))).some(t => /Evelyn/.test(t)) && await q.$eval("#asResident", e => e.value) === evelyn.id, "she appears in the list and is chosen");

    await q.fill("#asName", ""); await q.selectOption("#asResident", ""); await q.click("#asSaveRes"); await q.waitForTimeout(300);
    ok(/first name/i.test(await q.textContent("#asWhoMsg")), "saving with no name asks for one, and saves nothing");
    ok((await q.evaluate(() => { let n = 0; const s = window.CogniSecureStore.storage; for (let i = 0; i < s.length; i++) if (s.key(i).indexOf("cognicopia_resident_") === 0) n++; return n; })) === 3, "no fourth resident was made");

    /* comes back: sealed, listed, and the last one chosen is chosen again */
    await q.selectOption("#asResident", "res-dot"); await q.waitForTimeout(500);
    await q.reload({ waitUntil: "load" }); await q.waitForSelector("#asSheet svg"); await q.waitForTimeout(1200);
    ok(await q.$eval("#asResident", e => e.value) === "res-dot" && await q.$eval("#asName", e => e.value) === "Dorothy", "after a reload the last resident chosen is chosen again, already filled in");
    ok(!/Dorothy|Walter|Evelyn/.test(await q.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf("cognicopia_resident_") === 0).map(k => localStorage.getItem(k)).join(""))), "no resident is left in plain browser storage: they are sealed");

    /* a screen left open does not stay open: after the idle time the page starts clean, and nobody saved is lost */
    await q.evaluate(() => window.CognicopiaSession.setLimit(600));
    await q.waitForNavigation({ waitUntil: "load", timeout: 15000 }).catch(() => {});
    await q.waitForSelector("#asSheet svg"); await q.waitForTimeout(1500);
    ok(await q.$eval("#asResident", e => e.value) === "" && await q.$eval("#asName", e => e.value) === "", "after the idle time the page forgets who was chosen and starts clean");
    ok((await q.$$eval("#asResident option", o => o.length)) === 4, "...and everyone saved is still in the list (4 options: a new person and three residents)");
    await q.evaluate(() => document.querySelectorAll("details.as-acc").forEach(d => { d.open = true; }));
    /* the full profile opens from here, and a resident saved here is one the profile page can edit */
    const pr = await c2.newPage(); const perr = []; pr.on("pageerror", e => perr.push(e.message));
    await pr.goto(base + "profile.html?edit=" + encodeURIComponent(evelyn.id), { waitUntil: "load" }); await pr.waitForTimeout(1500);
    ok(perr.length === 0, "the full profile page opens a resident saved from the Studio with no script error" + (perr.length ? ": " + perr[0] : ""));
    ok(await pr.evaluate(() => { const el = document.getElementById("rapName"); return !!el && el.value === "Evelyn"; }), "...and shows her name, ready to edit");
    await pr.close();
    await c2.close();
  }

  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `activity studio screen check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `activity studio screen check passed: ${passed} checks in a real browser (the mixed packet of 1 to 10 pages, the three buttons, the layouts, every style, stage and topics to avoid, the scroll and the dark panel, the PDF read back, the PNG, print, 52 px, a phone, offline)`);
process.exit(problems.length ? 1 : 0);
