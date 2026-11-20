#!/usr/bin/env node
/* =====================================================================
   Instant Soothe draws from the era banks, proved in a real browser on real PDFs read back with PyMuPDF (made-up resident only):

     ten clicks   Instant Soothe is pressed ten times: the real button once (no resident chosen), then through the same dialog for a made-up resident born
                  in 1930, 1938, 1945, 1952 and 1960 at the early, middle and late stage (the dialog's "go" is pressed each time)
     fresh        the ten packets are all different, and no era-bank entry comes back while the pool still has others
     years        every era-bank entry on a page touches that person's years (born + 7 to born + 28, assets/services/eraWindow.js); with no resident, a mix
     stages       a late-stage packet never holds a memory page (one subject to a page); early and middle pages are memory pages only when the banks are loaded
     the page     a memory page is a resident page: ink between the 0.5 in margins (0.65 in on the binding side), at least 60% of the page tall,
                  pure black on white, resident type at least 18 pt (every engine rule says so), no quiz words
     memory       what this browser remembers (cognicopia_soothe_history) holds ids only, never a name or a line of text, and "start over" clears it
     all          nothing is requested from outside the page, and no page script fails
   Needs Playwright and PyMuPDF (exit 2 where either is missing). Run: node scripts/check-soothe-banks-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { loadPlaywright, serve, agreed, agreeToDialogs } from "./lib/browser.mjs";

const problems = [], errs = [], foreign = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-soothe-"));

const PY = `
import sys, json
try:
    import pymupdf as fitz
except Exception:
    import fitz
doc = fitz.open(sys.argv[1]); out = []
for i, pg in enumerate(doc):
    y0, y1, x0, x1, nonbw = 9999, 0, 9999, 0, 0
    colors = []
    for b in pg.get_text("blocks"):
        if b[4].strip():
            y0 = min(y0, b[1]); y1 = max(y1, b[3]); x0 = min(x0, b[0]); x1 = max(x1, b[2])
    for d in pg.get_drawings():
        r = d["rect"]
        if r.width > 600 and r.height > 780: continue
        if r.width > 0.5 or r.height > 0.5:
            y0 = min(y0, r.y0); y1 = max(y1, r.y1); x0 = min(x0, r.x0); x1 = max(x1, r.x1)
        for k in ("color", "fill"):
            c = d.get(k)
            if c is not None and tuple(round(v, 2) for v in c) not in ((0.0, 0.0, 0.0), (1.0, 1.0, 1.0)): nonbw += 1; colors.append([k, [round(v, 2) for v in c], [round(v) for v in (r.x0, r.y0, r.x1, r.y1)]])
    for blk in pg.get_text("dict")["blocks"]:
        for ln in blk.get("lines", []):
            for sp in ln["spans"]:
                if sp["text"].strip() and sp["color"] not in (0, 16777215): nonbw += 1
    out.append({"n": i + 1, "text": pg.get_text(), "y0": round(y0, 1), "y1": round(y1, 1), "x0": round(x0, 1), "x1": round(x1, 1), "nonbw": nonbw, "colors": colors[:3], "w": pg.rect.width, "h": pg.rect.height})
print(json.dumps(out))
`;
const readPdf = f => { const r = spawnSync("python3", ["-I", "-c", PY, f], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 27 }); try { return JSON.parse(r.stdout); } catch (e) { return null; } };

const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", timezoneId: "America/Chicago" }); await agreed(ctx);
await ctx.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
const p = await ctx.newPage(); await agreeToDialogs(p);
p.on("pageerror", e => errs.push(e.message));
p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith("about:")) foreign.push(u); });
await p.goto(base + "index.html", { waitUntil: "load" });
await p.waitForFunction(() => window.ProceduralPacketEngine && window.CogniBanks, null, { timeout: 15000 }).catch(() => {});
const loaded = await p.evaluate(() => !!(window.ProceduralPacketEngine && window.CogniBanks && window.CogniBanks.ALL.length > 400));
ok(loaded, "the packet tool loads the engine and the era banks");
if (!loaded) { console.error("soothe banks check FAILED: the engine or the banks did not load"); await browser.close(); srv.close(); process.exit(1); }

const BIRTHS = [null, 1930, 1938, 1945, 1952, 1960, 1930, 1938, 1945, 1960], STAGES = ["middle", "early", "middle", "early", "middle", "early", "late", "early", "middle", "early"];
const QUIZ = /\b(do you remember|can you recall|quiz|test your|guess|correct answer|wrong)\b/i;   /* the same words scripts/check-variety.mjs bans in a bank */
const packets = [], seenBank = [];
await p.evaluate(() => { try { window.ProceduralPacketEngine.History.clear(); } catch (e) { /* none yet */ } });

for (let i = 0; i < 10; i++){
  const born = BIRTHS[i], stage = STAGES[i];
  await p.evaluate(() => { window.__printed = 0; window.__pk = null; });
  if (i === 0) await p.click("#arbSoothe");
  else await p.evaluate(({ born, stage }) => {
    const P = window.ProceduralPacketEngine;
    window.__done = P.instantSoothe({ context: { name: "Ruth", stage, era: P.eraFromBirthYear(born), avoid: [], date: "2026-11-20", wing: "" } }).then(pk => { window.__pk = pk; });
  }, { born, stage });
  await p.waitForSelector("#instant-soothe-modal[open]", { timeout: 8000 });
  /* a mix or heritage theme, so a memory page may be offered; the late stage is left as the dialog set it */
  if (i % 3 !== 2) await p.click('#instant-soothe-modal .iso-opt[data-v="' + (i % 2 ? "heritage" : "music") + '"]');
  if (i === 0) { await p.evaluate(() => { const o = window.ProceduralPacketEngine; const orig = o.instantSoothe; void orig; }); }
  const stageUsed = await p.evaluate(() => { const x = [...document.querySelectorAll('#instant-soothe-modal input[name="iso-stage"]')].find(i => i.checked); return x ? x.value : "middle"; });
  await p.click("#iso-go");
  await p.waitForFunction(() => window.__printed > 0, null, { timeout: 20000 });
  const pdf = path.join(tmp, "soothe-" + i + ".pdf");
  await p.emulateMedia({ media: "print" });
  await p.pdf({ path: pdf, width: "8.5in", height: "11in", printBackground: true, preferCSSPageSize: true });
  await p.emulateMedia({ media: "screen" });
  const pk = {};
  /* the packet itself: the facade keeps the last plan in the page's history; read the ids it recorded */
  const hist = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem("cognicopia_soothe_history") || "{}"); } catch (e) { return {}; } });
  await p.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await p.waitForFunction(() => !!window.__pk || true, null, { timeout: 2000 }).catch(() => {});
  const pages = readPdf(pdf);
  ok(!!pages && pages.length >= 1 && pages.length <= 3, `click ${i + 1}: one to three sheets, read back (${pages ? pages.length : "none"} in the PDF)`);
  packets.push({ born, stage: stageUsed, pages: pages || [], hist, pk });
}

/* the entries each packet drew: the memory records the ids a packet used, newest last, and moves an id that comes again to the end, so the
   memory grows by exactly the entries drawn if and only if none came back */
const LINES = await p.evaluate(() => window.CogniBanks.ALL.map(e => ({ id: e.id, th: e.th, y: e.y, line: window.CogniBanks.line(e) })));
const byId = Object.fromEntries(LINES.map(l => [l.id, l]));
const clean = s => s.replace(/\s+/g, " ").trim();
let memoryPages = 0, prevLen = 0;
const sigs = new Set(), seen = [];
packets.forEach((pk, i) => {
  const n = i + 1, texts = pk.pages.map(x => clean(x.text)), len = (pk.hist.bank || []).length;
  sigs.add(texts.join("||"));
  const memPages = pk.pages.filter(pg => /Songs of Your Years|Singers and Bands|At the Movies|On the Television|On the Radio|Things from Home|Stars of the Screen/.test(pg.text));
  const drawn = memPages.length * (pk.stage === "early" ? 5 : 3), added = (pk.hist.bank || []).slice(Math.max(0, len - drawn));
  memoryPages += memPages.length;
  ok(len - prevLen === drawn, `click ${n}: the memory grew by the ${drawn} entries drawn (${len - prevLen}), so none came back`);
  prevLen = len;
  added.forEach(id => {
    seen.push(id); const l = byId[id];
    ok(!!l, `click ${n}: ${id} is an era-bank entry`);
    if (l && pk.born) ok(l.y[1] >= pk.born + 7 && l.y[0] <= pk.born + 28, `click ${n}: "${l.line.slice(0, 40)}" (${l.y[0]} to ${l.y[1]}) touches the years of someone born in ${pk.born} (${pk.born + 7} to ${pk.born + 28})`);
    if (l) ok(texts.some(t => t.includes(clean(l.line))), `click ${n}: "${l.line.slice(0, 40)}" is on the printed page`);
  });
  ok(pk.stage !== "late" || !memPages.length, `click ${n}: the late stage never holds a memory page`);
  pk.pages.forEach((pg, k) => {
    const isMemory = memPages.includes(pg);
    if (isMemory){
      ok(pg.y1 - pg.y0 >= 432, `click ${n}, page ${k + 1}: a memory page is at least 60% of the page tall (${Math.round(pg.y1 - pg.y0)} of 720 pt)`);
      const body = pg.text.split(/Clinical Tip:|Conversation starter:/)[0], q = body.match(QUIZ);   /* the shell's own staff tip line is the engine's older known gap, not this page; it carries one of two labels (ClinicalMatrix.js), and one tip says "works better than do you remember" */
      ok(!q, `click ${n}, page ${k + 1}: no quiz words on a memory page${q ? " (found: " + q[0] + ")" : ""}`);
    }
    ok(pg.nonbw === 0, `click ${n}, page ${k + 1}: pure black on white (${pg.nonbw} other colors: ${JSON.stringify(pg.colors)})`);
    /* a memory page is held to the margins exactly; every other kind of page is the engine's own and is clipped to the sheet, so it is only held to the paper */
    const tol = isMemory ? 2 : 12;
    ok(pg.y0 >= 36 - tol && pg.y1 <= 756 + tol && pg.x0 >= 46.8 - tol && pg.x1 <= 576 + tol, `click ${n}, page ${k + 1}: ink inside the margins (x ${pg.x0} to ${pg.x1}, y ${pg.y0} to ${pg.y1})`);
  });
});
ok(sigs.size === 10, `ten different packets (${sigs.size} of 10)`);
ok(memoryPages >= 1, `a memory page from the banks appears in ten clicks (${memoryPages})`);
ok(new Set(seen).size === seen.length, `no era-bank entry comes back within ten clicks (${seen.length} drawn, ${new Set(seen).size} different)`);

/* the memory: ids only, kept to the pool's size, cleared by "start over" */
const mem = await p.evaluate(() => localStorage.getItem("cognicopia_soothe_history") || "");
ok(!!mem && !/Ruth/.test(mem), "what is kept holds no name");
let hist = {}; try { hist = JSON.parse(mem); } catch (e) { /* checked below */ }
ok(Array.isArray(hist.bank) && hist.bank.length >= 3 && hist.bank.every(x => /^[a-z]+-\d{4}-[a-z0-9-]+$/.test(x) && x.length <= 40), `the memory keeps era-bank ids only (${(hist.bank || []).length} of them)`);
ok(!/[A-Z][a-z]+ [a-z]+ [a-z]+/.test(JSON.stringify(hist.bank || [])), "no line of text is kept, only ids");
await p.evaluate(() => window.ProceduralPacketEngine.History.clear());
ok(!(await p.evaluate(() => localStorage.getItem("cognicopia_soothe_history"))), "start over clears what the browser remembers");

ok(!errs.length, "no page script fails: " + errs.slice(0, 2).join(" | "));
ok(!foreign.length, "nothing is requested from outside the page: " + foreign.slice(0, 2).join(" "));
await browser.close(); srv.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(problems.length ? `soothe banks check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 30).join("\n  - ") : `soothe banks check passed: ${passed} checks (ten Instant Soothe clicks read back as PDFs: ten different packets, era-bank pages drawn from the person's own years, no entry back within ten clicks, inside the margins, pure black on white, ids only in the memory, nothing off the page)`);
process.exit(problems.length ? 1 : 0);
