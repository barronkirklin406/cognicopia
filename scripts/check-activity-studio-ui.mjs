#!/usr/bin/env node
/* =====================================================================
   Activity Page Studio in a real browser (activity-studio.html).
     the screen   a settings panel beside a live preview that is a 3:4 page; any control redraws it; the note under it says
                  whether the page passes the print rules; the page code is shown; Back and Next move through the pages
     the modules  reminiscence, thinking, daily living and coloring each make a page; stage 3 has fewer items than stage 1;
                  coloring shows the style and words boxes and hides the layout; words choose the drawing; a topic to avoid is
                  honored; the layouts change the number of pages
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
const problems = [], errors = [], foreign = []; let passed = 0;
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
async function open(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p.goto(base + "activity-studio.html", { waitUntil: "load" }); await p.waitForSelector("#asSheet svg", { timeout: 10000 }); await p.waitForTimeout(500);
  return { ctx, p };
}
const pos = p => p.textContent("#asPos");
const pick = async (p, name, value) => { await p.check(`input[name="${name}"][value="${value}"]`, { force: true }); await p.waitForTimeout(450); };
const total = async p => Number(/of (\d+)/.exec(await pos(p))[1]);
const svgText = p => p.$eval("#asSheet svg", e => e.textContent);

try {
  let { ctx, p } = await open(1366, 768);
  const box = await p.$eval("#asSheet", e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  ok(Math.abs(box.w / box.h - 0.75) < 0.02, `the preview is a 3:4 page (${Math.round(box.w)} x ${Math.round(box.h)})`);
  ok(/Page 1 of 3/.test(await pos(p)) && /ASM-R-/.test(await pos(p)), "it opens on page 1 of 3 with a page code: " + await pos(p));
  ok(/Print check passed/.test(await p.textContent("#asNotes")), "the print check passes on the first page");
  ok(/The 1950s/.test(await svgText(p)), "the first sheet is about the decade chosen");
  const items = () => p.$$eval("#asSheet line", t => t.length + 1);        // the rules between ideas: one fewer than the ideas on the page
  const early = await items();
  await pick(p, "stage", "3"); const late = await items();
  ok(late < early, `stage 3 puts fewer ideas on the page than stage 2 (${late} vs ${early})`);
  await pick(p, "stage", "1"); const first = await items();
  ok(first > early, `stage 1 puts more ideas on the page than stage 2 (${first} vs ${early})`);
  await p.click("#asNext"); ok(/Page 2 of/.test(await pos(p)), "Next goes to page 2"); await p.click("#asPrev"); ok(/Page 1 of/.test(await pos(p)), "Back returns");
  const before = await p.textContent("#asPos"); await p.click("#asNew"); await p.waitForTimeout(400);
  ok(await p.textContent("#asPos") !== before, "New variation makes a new page code");
  await p.selectOption("#asDecade", "1970"); await p.waitForTimeout(400); ok(/The 1970s/.test(await svgText(p)), "choosing a decade changes the page");
  await p.fill("#asBorn", "1938"); await p.waitForTimeout(400); ok(await p.$eval("#asDecade", e => e.value) === "1950" && /The 1950s/.test(await svgText(p)), "a birth year of 1938 suggests the 1950s, the years the resident was about 20");
  await p.fill("#asName", "Ruth"); await p.waitForTimeout(400); ok(/For Ruth/.test(await svgText(p)), "a first name is drawn on the page");
  await p.fill("#asAvoid", "cadillac, jukebox, casserole, radio, television"); await p.waitForTimeout(400);
  for (let i = 0; i < 6; i++) { await p.click("#asNew"); await p.waitForTimeout(250); }
  ok(!/cadillac|jukebox|casserole|radio|television/i.test(await svgText(p)), "a topic to avoid is not on the page");
  await p.fill("#asAvoid", "");
  await pick(p, "module", "exercise"); ok(await total(p) >= 1, "thinking exercises make pages");
  await pick(p, "module", "daily"); ok(/ASM-D-|ASE-D-/.test(await pos(p)) && /One step at a time/.test(await svgText(p)), "daily living makes a steps page");
  await pick(p, "layout", "cards4"); const t4 = await total(p);
  await pick(p, "layout", "strips"); const ts = await total(p);
  ok(await p.$eval("#asSheet svg", e => e.querySelectorAll("line[stroke-dasharray]").length) > 0, "tickets draw dashed cut lines");
  await pick(p, "layout", "cards4"); ok(await p.$eval("#asSheet svg", e => e.querySelectorAll("line[stroke-dasharray]").length) === 2, "four cards draw two dashed cut lines");
  await pick(p, "layout", "full"); const tf = await total(p);
  ok(tf === 3 && t4 >= 3 && ts >= 3, `three sheets make three full pages and at least as many card pages (${tf}, ${t4}, ${ts})`);
  /* coloring */
  await pick(p, "module", "coloring");
  ok(await p.isVisible("#asStyle") && !(await p.isVisible('input[name="layout"]', { timeout: 200 }).catch(() => false)), "coloring shows the style box and hides the layout");
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
  const sizes = await p.$$eval('#asForm input:not([type=radio]):not([type=checkbox]), #asForm select, #asForm .as-seg label, .as-btn', n => n.filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
  ok(sizes.every(([w, h]) => w >= 52 && h >= 52), `every visible control is at least 52 px: ${sizes.filter(([w, h]) => w < 52 || h < 52).join(" ")}`);
  await ctx.close();

  /* export */
  ({ ctx, p } = await open(1366, 900));
  await pick(p, "module", "reminiscence"); await pick(p, "stage", "2"); const pages = await total(p);
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
  /* print */
  await p.click("#asPrint", { noWaitAfter: true }).catch(() => {}); await p.waitForTimeout(600);
  await p.emulateMedia({ media: "print" });
  const pp = await p.$$eval("#printRoot .as-pp", n => n.length);
  ok(pp === pages, `Print lays out one sheet per page (${pp} of ${pages})`);
  const pdfFile = path.join(os.tmpdir(), "as-print-" + process.pid + ".pdf");
  await p.pdf({ path: pdfFile, format: "Letter", printBackground: true, preferCSSPageSize: true });
  const pr = readPdf(pdfFile); fs.unlinkSync(pdfFile);
  ok(pr.length === pages, `the printed PDF has one paper page per sheet (${pr.length} of ${pages})`);
  ok(pr.every(g => g.box[0] >= 35.5 && g.box[1] >= 35.5 && g.box[2] <= 576.5 && g.box[3] <= 756.5), "printed text stays inside 0.5 in of every edge: " + JSON.stringify(pr[0].box));
  ok(pr.every(g => !/Menu|Get Full Access|Contact|Privacy/.test(g.text)) && /The 1950s|The 19\d0s/.test(pr[0].text), "no menu or button text reaches the paper");
  await ctx.close();

  /* a phone */
  ({ ctx, p } = await open(390, 844));
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "on a phone nothing scrolls sideways");
  ok(await p.$eval("#asSheet", e => e.getBoundingClientRect().width) <= 390, "on a phone the page fits the screen");
  await pick(p, "module", "coloring"); ok(await p.$$eval("#asSheet path", n => n.length) > 3, "on a phone a coloring page draws");
  await ctx.close();

  ok(foreign.length === 0, "nothing is requested from outside the page" + (foreign.length ? ": " + foreign.slice(0, 2).join(", ") : ""));
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `activity studio screen check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `activity studio screen check passed: ${passed} checks in a real browser (3:4 live preview, every module and style, stage and topics to avoid, the PDF read back, the PNG, print, 52 px, a phone, offline)`);
process.exit(problems.length ? 1 : 0);
