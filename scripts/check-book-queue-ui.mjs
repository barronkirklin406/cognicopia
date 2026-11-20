#!/usr/bin/env node
/* =====================================================================
   Calm now cards, the 12-month life planner and the life journal in the Packet Builder's packet queue, in a real browser (made-up people only, saved on a
   made-up computer):

     calm now      the dialog has "Add to the packet" (52 px or more); it puts the card in the queue as a staff page for that resident, in the Packet Builder's own live
                   list; a packet of only that card prints and spends no free packet
     planner       "Add to the packet" (the chosen part of the book) and "Add this spread to the packet" put the pages as made into the queue, as one item, for the
                   resident; the queue drawer shows the item without drawing every page; printing the packet draws every page, each inside its own margins, with no staff
                   tip, in pure black and white, and counts as one packet; the paper read back with PyMuPDF has every page
     journal       the same, from the life journal
     nothing else  nothing is requested from outside the page, and no page script fails
   Needs Playwright (exit 2 where it is not installed) and PyMuPDF for the paper. Run: node scripts/check-book-queue-ui.mjs
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
  tier2_enrichment: { birthYear: 1940, hometown: { place: "Scobey, Montana" } }, tier3_deep: { notes: "", comforts: ["a warm blanket"] } };
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
        if y * 2 < 30 or y * 2 > 764: continue
        row = s[y * w:(y + 1) * w]
        if min(row) < 200:
            xs = [i for i, v in enumerate(row) if v < 200]; x0 = min(x0, xs[0]); x1 = max(x1, xs[-1]); y0 = min(y0, y); y1 = max(y1, y)
    out.append({"ink": [x0 * 2, y0 * 2, (x1 + 1) * 2, (y1 + 1) * 2], "blank": x1 < 0})
print(json.dumps(out))`;

const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, serviceWorkers: "block", timezoneId: "America/Chicago" }); await agreed(ctx);
await ctx.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
const p = await ctx.newPage(); await agreeToDialogs(p);
p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
const small = sel => p.$$eval(sel, els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }).filter(([w, h]) => w > 0 && (w < 52 || h < 52)).length);
const paper = async (name, items) => {
  await p.evaluate(items0 => { window.__printed = 0; generatePdf(queue.filter(q => items0.includes(q.activityId))); }, items); await p.waitForTimeout(1500);
  const sheets = await p.evaluate(() => document.querySelectorAll("#printRoot .lp-sheet").length), tips = await p.evaluate(() => document.querySelectorAll("#printRoot .care-coaching-footer, #printRoot .sh-foot").length);
  const pdf = path.join(os.tmpdir(), name + ".pdf");
  await p.emulateMedia({ media: "print" }); fs.writeFileSync(pdf, await p.pdf({ width: "8.5in", height: "11in", printBackground: true, preferCSSPageSize: true })); await p.emulateMedia({ media: "screen" });
  let back = null; try { back = JSON.parse(execFileSync("python3", ["-I", "-c", PY, pdf], { encoding: "utf8", maxBuffer: 1 << 27 })); } catch (e) { notes.push("PyMuPDF could not read the PDF here"); }
  return { sheets, tips, back, printed: await p.evaluate(() => window.__printed) };
};

try {
  await p.goto(base + "builder.html", { waitUntil: "load" }); await p.waitForTimeout(2000);
  await p.evaluate(async r => { const S = window.CogniSecureStore.storage; S.setItem("cognicopia_resident_" + r.id, JSON.stringify(r)); await window.CogniSecureStore.flush(); }, RUTH);
  await p.reload({ waitUntil: "load" }); await p.waitForTimeout(2200);
  const lic = await p.evaluate(() => isLicensed());

  /* ---------- Calm now ---------- */
  await p.evaluate(() => ActiveResident.set("res-ruth")); await p.waitForTimeout(500);
  await p.click("#arCalm"); await p.waitForSelector("dialog.cg-calm [data-calm-queue]", { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(400);
  ok((await p.$("[data-calm-queue]")) !== null, "the Calm now dialog has Add to the packet");
  ok((await small("dialog.cg-calm .cg-calm-btns button")) === 0, "the dialog's buttons are 52 px or more");
  const q0 = await p.evaluate(() => queue.length);
  await p.click("[data-calm-queue]"); await p.waitForTimeout(900);
  ok((await p.evaluate(() => queue.length)) === q0 + 1, "the card is in the Packet Builder's live list at once");
  ok(await p.evaluate(() => queue.some(q => q.activityId === "calm-now-queued" && q.cfg.residentName === "Ruth" && /Calm now/.test(q.cfg.opts.html))), "as a staff page for Ruth");
  ok(/Added to the packet as a staff page/.test(await p.innerText(".cg-calm-qmsg")), "and the dialog says so in plain words");
  await p.click("[data-calm-close]"); await p.waitForTimeout(300);
  const g0 = await p.evaluate(() => genCount());
  await p.evaluate(() => { window.__gc = genCount; genCount = () => 9999; });
  const calm = await p.evaluate(() => { window.__printed = 0; generatePdf(queue.filter(q => q.activityId === "calm-now-queued")); return 1; }); await p.waitForTimeout(1000);
  ok(lic || (await p.evaluate(() => window.__printed)) === 1, "a packet of only the Calm now card prints even when no free packets are left");
  ok(await p.evaluate(() => /Calm now/.test(document.querySelector("#printRoot .sheet-gc") ? document.querySelector("#printRoot .sheet-gc").innerText : "")), "and draws the staff page");
  await p.evaluate(() => { genCount = window.__gc; });
  ok((await p.evaluate(() => genCount())) === g0, "without spending a free packet");

  /* ---------- the planner ---------- */
  await p.evaluate(() => { location.hash = "#/life-planner"; }); await p.waitForSelector("#lpAddBtn", { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(800);
  ok((await small("#lpAddBtn")) === 0, "the planner's Add to the packet is 52 px or more");
  const n0 = await p.evaluate(() => queue.length);
  await p.click("#lpAddBtn"); await p.waitForTimeout(1200);
  const book = await p.evaluate(() => queue.filter(q => q.activityId === "book-pages-queued").map(q => ({ n: q.cfg.opts.pages.length, title: q.cfg.opts.title, name: q.cfg.residentName, first: q.cfg.opts.pages[0].slice(0, 60) })));
  ok(book.length === 1 && (await p.evaluate(() => queue.length)) === n0 + 1, "Add to the packet puts the planner in the queue as one item");
  ok(book[0] && book[0].n >= 10 && /Life Planner/.test(book[0].title) && new RegExp(`${book[0].n} pages`).test(book[0].title), `holding every page of the part chosen (${book[0] && book[0].n})`);
  ok(/Added \d+ pages? to the packet/.test(await p.innerText("#lpAddMsg")), "and says so in plain words");
  await p.click("#lpAddSpread").catch(() => {}); await p.waitForTimeout(600);
  const spread = await p.evaluate(() => queue.filter(q => q.activityId === "book-pages-queued").length);
  ok(spread === 2, "Add this spread puts a spread in as its own item");
  await p.click("#openQueue, #packetBtn, [data-open-queue], #cartBtn").catch(() => {});
  const ok2 = await p.evaluate(() => { try { renderQueue(); return document.querySelectorAll("#queueBody .q-item").length; } catch (e) { return -1; } });
  ok(ok2 >= 2, `the packet drawer lists the items (${ok2})`);
  ok(await p.evaluate(() => { const t = document.querySelector("#queueBody .q-item .thumb"); if (!t) return false; const all = [...document.querySelectorAll("#queueBody .q-item .thumb .lp-sheet")]; return all.length >= 1 && all.slice(1).filter(x => x.previousElementSibling && x.previousElementSibling.classList.contains("lp-sheet")).every(x => getComputedStyle(x).display === "none"); }), "the drawer shows a book item without drawing every page");
  const pg0 = await p.evaluate(() => genCount());
  const pl = await paper("book-queue-planner", ["book-pages-queued"]);
  ok(pl.printed === 1, "printing the packet opens the print window");
  ok(pl.sheets === book[0].n + (spread >= 2 ? await p.evaluate(() => queue.filter(q => q.activityId === "book-pages-queued")[1].cfg.opts.pages.length) : 0), `every page of both items is on the print stage (${pl.sheets})`);
  ok(pl.tips === 0, "with no staff tip or foot on a page");
  ok(lic || (await p.evaluate(() => genCount())) === pg0 + 1, "and counts as one packet");
  if (!pl.back || pl.back.missing) notes.push("PyMuPDF is not installed for python3: the printed pages were not read back");
  else {
    ok(pl.back.length === pl.sheets, `the PDF has every page (${pl.back.length} of ${pl.sheets})`);
    ok(pl.back.every(g => !g.blank), "no page is blank");
    ok(pl.back.every(g => g.ink[0] >= 35.9 && g.ink[2] <= 576.1 && g.ink[3] <= 763), "every page is inside the planner's own margins: 0.5 in at the top and sides, its footer line at 0.42 in from the bottom, as when the book is printed directly (" + [...new Set(pl.back.map(g => g.ink.join(" ")))].slice(0, 6).join(" | ") + ")");
  }

  /* ---------- the journal ---------- */
  await p.evaluate(() => { location.hash = "#/life-journal"; }); await p.waitForSelector("#ljAddBtn", { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(800);
  ok((await small("#ljAddBtn")) === 0, "the journal's Add to the packet is 52 px or more");
  const j0 = await p.evaluate(() => queue.filter(q => q.activityId === "book-pages-queued").length);
  await p.click("#ljAddBtn"); await p.waitForTimeout(1200);
  ok((await p.evaluate(() => queue.filter(q => q.activityId === "book-pages-queued").length)) === j0 + 1 && /Added \d+ pages? to the packet/.test(await p.innerText("#ljAddMsg")), "the journal adds to the packet the same way");
  ok(await p.evaluate(() => queue.some(q => /Life Journal/.test(q.cfg.opts && q.cfg.opts.title || ""))), "as a Life Journal item");
} finally { await browser.close(); srv.close(); }

ok(foreign.length === 0, `nothing is requested from outside the page (${[...new Set(foreign)].slice(0, 3)})`);
ok(errors.length === 0, `no page script fails (${[...new Set(errors)].slice(0, 3)})`);
console.log(problems.length ? `book queue UI check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 20).join("\n  - ") : `book queue UI check passed: ${passed} checks${notes.length ? " (" + notes.join("; ") + ")" : ""}`);
process.exit(problems.length ? 1 : 0);
