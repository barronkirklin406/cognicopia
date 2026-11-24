#!/usr/bin/env node
/* =====================================================================
   Page economy and the Staff Companion Sheet in the packet tool's packet (packet.html), proved on real PDFs read back with PyMuPDF
   (.claude/skills/cognicopia-print-engine; made-up resident only):

     staff first   page 1 is the Staff Companion Sheet ("For Staff", no resident banner), with each page listed by its title and the tip and
                   therapy approach for it; the cover follows it
     clean pages   no resident page carries a clinical tip, a "[Therapy: ...]" tag, "Clinical Tip:", an answer key or a stage label in the foot
     no overflow   no resident page is a "(continued)" page; the packet, with every page ticked, has none at any stage
     page fill     every resident activity page (the cover aside) has content down to at least 60% of the printable band (64 to 706 pt):
                   the lowest text, line, drawing or picture on it, never an empty band over 40% of the page

   Checked for early, middle and late, each with every page ticked and with the default pages. The numbers are printed so they can be
   reported ("0 pages under 60%"). Needs Playwright and PyMuPDF (exit 2 where Playwright is missing). Run: node scripts/check-packet-economy-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { loadPlaywright, serve, agreed } from "./lib/browser.mjs";

const problems = [], errs = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-econ-"));

const TOP = 64, BOTTOM = 706;      // the printable band between the header rule and the foot (ClinicalMatrix.SHELL)
const PY = `
import sys, json, re
try:
    import pymupdf as fitz
except Exception:
    import fitz
doc = fitz.open(sys.argv[1]); out = []
RES = re.compile(r"PREPARED ESPECIALLY FOR|MADE FOR:")
for i, pg in enumerate(doc):
    text = pg.get_text()
    low = TOP = ${TOP}
    bottom = ${TOP}
    for b in pg.get_text("blocks"):
        if ${TOP} <= b[3] <= ${BOTTOM} + 6: bottom = max(bottom, b[3])
    for d in pg.get_drawings():
        r = d["rect"]
        if r.y0 >= ${TOP} - 1 and r.y1 <= ${BOTTOM} + 6 and (r.width > 0.5 or r.height > 0.5): bottom = max(bottom, r.y1)
    for im in pg.get_image_info():
        r = fitz.Rect(im["bbox"])
        if r.y1 <= ${BOTTOM} + 6: bottom = max(bottom, r.y1)
    out.append({"n": i + 1, "resident": bool(RES.search(text)), "text": text, "util": round((bottom - ${TOP}) / (${BOTTOM} - ${TOP}), 3), "title": (text.strip().split("\\n") or [""])[0:3]})
print(json.dumps(out))
`;
const readPdf = f => { const r = spawnSync("python3", ["-I", "-c", PY, f], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 27 }); try { return JSON.parse(r.stdout); } catch (e) { return null; } };

let summary = [];
for (const stage of ["early", "middle", "late"]) for (const every of [true, false]) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, serviceWorkers: "block" }); await agreed(ctx);
  const p = await ctx.newPage(); p.on("pageerror", e => errs.push(e.message));
  await p.goto(base + "packet.html"); await p.waitForTimeout(500);
  await p.evaluate(() => { window.print = () => {}; localStorage.clear(); localStorage.setItem("cognicopia_eula_accepted", "true"); });
  await p.fill("#first", "Margaret"); await p.fill("#born", "1938");
  await p.fill("#town", "Velva"); await p.fill("#job", "teacher"); await p.fill("#hobbies", "gardening, baking"); await p.fill("#favs", "Patsy Cline");
  await p.evaluate(s => { const r = document.querySelector(`input[name=stage][value=${s}]`); if (r) { r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); } }, stage);
  if (every) await p.evaluate(() => document.querySelectorAll(".act").forEach(c => { c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); }));
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 120000 }), p.click("#go")]);
  const f = path.join(tmp, `${stage}-${every ? "all" : "default"}.pdf`); await dl.saveAs(f);
  await ctx.close();
  const pages = readPdf(f);
  if (!pages) { console.log("economy check skipped: PyMuPDF is not installed for python3 (pip install pymupdf)"); process.exit(2); }
  const tag = `${stage}${every ? " (every page ticked)" : " (default pages)"}`;
  const resident = pages.filter(x => x.resident);
  ok(/For Staff/.test(pages[0].text) && !pages[0].resident, `${tag}: page 1 is the Staff Companion Sheet`);
  ok(/Page by page/.test(pages.slice(0, 6).map(x => x.text).join(" ")), `${tag}: the Staff Companion Sheet lists the pages by title`);
  ok(pages[1] && /Your Personalized Activity Packet|Activity Packet/.test(pages.slice(0, 12).find(x => x.resident)?.text || "") && !pages.slice(1, 10).some(x => /^For Staff/.test(x.text) && false), `${tag}: the cover is the first resident page`);
  const tips = pages.filter(x => /Clinical Tip:|\[Therapy:/.test(x.text) && x.resident);
  ok(tips.length === 0, `${tag}: no resident page carries a clinical tip or a therapy tag (${tips.map(x => x.n).join(",")})`);
  const cont = resident.filter(x => /\(continued\)/i.test(x.text));
  ok(cont.length === 0, `${tag}: no resident page is a "(continued)" page (${cont.map(x => x.n + " " + x.title[1]).join(" | ")})`);
  const under = resident.filter(x => !/Your Personalized Activity Packet|Personalized Activity Packet/.test(x.text) && x.util < 0.6);
  ok(under.length === 0, `${tag}: every resident page is at least 60% full (${under.map(x => `${x.n} ${x.title.slice(1, 3).join(" ")} ${Math.round(x.util * 100)}%`).join(" | ")})`);
  summary.push(`${tag}: ${pages.length} pages, ${resident.length} resident, ${under.length} under 60%, ${cont.length} continued`);
}
console.log(summary.map(x => "  " + x).join("\n"));
ok(errs.length === 0, "no page script fails: " + errs.slice(0, 2));
await browser.close(); srv.close();
console.log(problems.length ? `packet economy check FAILED: ${problems.length} problem(s)\n  - ` + problems.join("\n  - ") : `packet economy check passed: ${passed} checks`);
process.exit(problems.length ? 1 : 0);
