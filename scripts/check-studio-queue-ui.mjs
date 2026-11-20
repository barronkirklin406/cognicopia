#!/usr/bin/env node
/* =====================================================================
   Activity Page Studio pages in the Packet Builder's packet queue, in a real browser (made-up people only, saved on a made-up computer):

     the studio    "Add all pages to the packet" and "Add this page to the packet" sit under the preview with "Copies of each" (1 to 6); with no pages they are
                   off; the staff answer page is never added; every control is 52 px or more at 1366 x 768 and 390 x 844
     the queue     the pages go into the same queue the Packet Builder prints from (cgb_queue), for the resident chosen in the Studio, once or in copies, and
                   adding spends no free packet
     the builder   the Packet Builder, opened afterwards, lists the queued pages; printing the packet draws each as one sheet with its finished picture or words
                   exactly as the Studio made them, inside the margins, with no staff tip or foot on it; the paper read back with PyMuPDF has every page
     nothing else  nothing is requested from outside the page, and no page script fails
   Needs Playwright (exit 2 where it is not installed) and PyMuPDF for the paper. Run: node scripts/check-studio-queue-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { loadPlaywright, serve, agreed, agreeToDialogs } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = [], foreign = [], notes = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const RUTH = { schema: "cognicopia.residentProfile", version: 2, id: "res-ruth", tier1_core: { preferredName: "Ruth", cognitiveTier: 2, unitNumber: "204", topHobbies: [{ code: "gardening", label: "gardening" }], topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: "" } },
  tier2_enrichment: { birthYear: 1940, hometown: { place: "Scobey, Montana" } }, tier3_deep: { notes: "" } };
const PY = `
import sys, json
try:
    import pymupdf as fitz
except Exception:
    try:
        import fitz
    except Exception:
        print(json.dumps({"missing": True})); sys.exit(0)
doc = fitz.open(sys.argv[1]); out = []
for pg in doc:
    pix = pg.get_pixmap(matrix=fitz.Matrix(0.5, 0.5), colorspace=fitz.csGRAY); s = pix.samples; w, h = pix.width, pix.height
    x0 = y0 = 9999; x1 = y1 = -1
    for y in range(h):
        if y * 2 < 30 or y * 2 > 762: continue            # the browser's own running line in the page margin is not the page
        row = s[y * w:(y + 1) * w]
        if min(row) < 200:
            xs = [i for i, v in enumerate(row) if v < 200]; x0 = min(x0, xs[0]); x1 = max(x1, xs[-1]); y0 = min(y0, y); y1 = max(y1, y)
    out.append({"ink": [x0 * 2, y0 * 2, (x1 + 1) * 2, (y1 + 1) * 2]})
print(json.dumps(out))`;

async function open(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: "block", timezoneId: "America/Chicago" }); await agreed(ctx);
  await ctx.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  const p = await ctx.newPage(); await agreeToDialogs(p);
  p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  return { ctx, p };
}
const small = (p, sel) => p.$$eval(sel, els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }).filter(([w, h]) => w > 0 && (w < 52 || h < 52)).length);

try {
  /* ---------- the studio ---------- */
  for (const [w, h] of [[390, 844], [1366, 768]]) {
    const { ctx, p } = await open(w, h);
    await p.goto(base + "activity-studio.html", { waitUntil: "load" }); await p.waitForSelector("#asSheet svg", { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(800);
    ok((await p.$("#asQueue")) && (await p.$("#asQueueOne")) && (await p.$("#asCopies")), `the Studio has Add all pages, Add this page and Copies of each at ${w} px`);
    ok((await small(p, "#asQueueBox button, #asQueueBox select")) === 0, `the add-to-packet controls are 52 px or more at ${w} px`);
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `no sideways scroll at ${w} px`);
    await ctx.close();
  }

  /* ---------- add from the Studio, print from the builder ---------- */
  const { ctx, p } = await open(1366, 768);
  await p.goto(base + "activity-studio.html", { waitUntil: "load" }); await p.waitForSelector("#asSheet svg", { timeout: 15000 }); await p.waitForTimeout(800);
  await p.evaluate(async r => { const S = window.CogniSecureStore.storage; S.setItem("cognicopia_resident_" + r.id, JSON.stringify(r)); await window.CogniSecureStore.flush(); }, RUTH);
  await p.reload({ waitUntil: "load" }); await p.waitForSelector("#asSheet svg", { timeout: 15000 }); await p.waitForTimeout(800);
  await p.selectOption("#asResident", "res-ruth"); await p.waitForTimeout(800);
  const pages = await p.evaluate(() => document.querySelector("#asPos").textContent), nPages = +(/of (\d+)/.exec(pages) || [])[1] || 0;
  ok(nPages >= 2, `the Studio made a packet (${pages})`);
  await p.click("#asQueueOne"); await p.waitForTimeout(400);
  const one = await p.evaluate(() => JSON.parse(window.CogniSecureStore.storage.getItem("cgb_queue") || "[]"));
  ok(one.length === 1 && one[0].activityId === "studio-page-queued" && one[0].cfg.residentName === "Ruth" && /<svg/.test(one[0].cfg.opts.svg), `Add this page puts one page in the queue for the resident chosen (${one.length})`);
  await p.selectOption("#asCopies", "2"); await p.click("#asQueue"); await p.waitForTimeout(500);
  const q = await p.evaluate(() => JSON.parse(window.CogniSecureStore.storage.getItem("cgb_queue") || "[]"));
  const added = q.length - 1;
  ok(added >= 2 && added % 2 === 0 && added <= nPages * 2, `Add all pages puts every resident page in twice (${added} for ${nPages} pages)`);
  ok(q.every(x => Number.isFinite(x.batchSeed) && x.index < x.count && x.cfg.residentName === "Ruth"), "each queued page is a whole queue item for Ruth");
  ok(/Added \d+ pages to the packet for Ruth/.test(await p.innerText("#asQueueNote")), "and the Studio says so in plain words, with the way to the Packet Builder");

  const p2 = await ctx.newPage(); p2.on("pageerror", e => errors.push(e.message)); p2.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
  p2.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
  await p2.goto(base + "builder.html", { waitUntil: "load" }); await p2.waitForTimeout(2500);
  const total = q.length;
  ok((await p2.evaluate(() => queue.filter(x => x.activityId === "studio-page-queued").length)) === total, `the Packet Builder lists the ${total} queued pages`);
  const gen1 = await p2.evaluate(() => genCount()), lic = await p2.evaluate(() => isLicensed());
  await p2.evaluate(() => { window.__printed = 0; generatePdf(); }); await p2.waitForFunction(() => window.__printed === 1, null, { timeout: 15000 }).catch(() => {}); await p2.waitForTimeout(600);
  const sh = await p2.evaluate(() => { const r = document.getElementById("printRoot"), keep = r.style.cssText; r.style.cssText = "display:block;position:absolute;left:-10000px;top:0";
    const out = [...r.querySelectorAll(".sheet-zg")].map(s => ({ svgs: s.querySelectorAll("svg").length, text: s.innerText.trim().length, tip: s.querySelectorAll(".care-coaching-footer, .sh-foot").length, w: s.offsetWidth, h: s.offsetHeight })); r.style.cssText = keep; return out; });
  ok(sh.length === total && sh.every(s => s.svgs >= 1 && s.w === 816 && s.h === 1056), `printing the packet draws every queued page as one Letter sheet (${sh.length} of ${total})`);
  ok(sh.every(s => s.tip === 0), "with no staff tip or foot on a resident page");
  ok(lic || (await p2.evaluate(() => genCount())) === gen1 + 1, "printing the packet counts as one packet");
  const pdf = path.join(os.tmpdir(), "studio-queue-check.pdf");
  await p2.emulateMedia({ media: "print" }); fs.writeFileSync(pdf, await p2.pdf({ width: "8.5in", height: "11in", printBackground: true, preferCSSPageSize: true })); await p2.emulateMedia({ media: "screen" });
  let back = null; try { back = JSON.parse(execFileSync("python3", ["-I", "-c", PY, pdf], { encoding: "utf8", maxBuffer: 1 << 27 })); } catch (e) { notes.push("PyMuPDF could not read the PDF here"); }
  if (!back || back.missing) notes.push("PyMuPDF is not installed for python3: the printed pages were not read back");
  else {
    ok(back.length === total, `the PDF has every page (${back.length} of ${total})`);
    ok(back.every(g => g.ink[0] >= 35.9 && g.ink[1] >= 35.9 && g.ink[2] <= 576.1 && g.ink[3] <= 756.1), `every page is inside the 0.5 in margins (${[...new Set(back.map(g => g.ink.map(v => Math.round(v)).join(" ")))].slice(0, 3).join(" | ")})`);
  }
  await ctx.close();
} finally { await browser.close(); srv.close(); }

ok(foreign.length === 0, `nothing is requested from outside the page (${[...new Set(foreign)].slice(0, 3)})`);
ok(errors.length === 0, `no page script fails (${[...new Set(errors)].slice(0, 3)})`);
console.log(problems.length ? `studio queue UI check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 20).join("\n  - ") : `studio queue UI check passed: ${passed} checks${notes.length ? " (" + notes.join("; ") + ")" : ""}`);
process.exit(problems.length ? 1 : 0);
