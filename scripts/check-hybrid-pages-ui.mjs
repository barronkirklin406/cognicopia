#!/usr/bin/env node
/* =====================================================================
   Every click makes a new, varied sheet, proved on real PDFs read back with PyMuPDF (made-up resident only; Quick Print styles name nobody):

     quick print    three clicks on one style give three different packets, each with two hybrid ("trace and ...") pages whose layouts are
                    not all alike, and the same two never twice in a row
     main packet    three clicks on "Make the packet" give three different packets, each with a hybrid page for a resident born in 1942
     every page     a hybrid page is a resident page: at least 60% full (64 to 706 pt), pure black and white, no clinical tip, no therapy tag,
                    no "(continued)"; its title is one of the six layout titles
     staff sheet    page 1 is the Staff Companion Sheet and lists each hybrid page by its title with two or three tips, one that says
                    hand-under-hand, none that says hand-over-hand
     memory         what this browser remembers (cognicopia_variety) holds ids and numbers only, never the name typed, and "Clear" forgets it
     all            nothing is requested from outside the page, and no page script fails
   Needs Playwright and PyMuPDF (exit 2 where either is missing). Run: node scripts/check-hybrid-pages-ui.mjs
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-hybrid-"));
const TITLES = ["Trace and Sing", "Trace and Talk", "Match and Color", "Look, Hold and Talk", "Hum Along", "A Look Back"];
const TOP = 64, BOTTOM = 706;

const PY = `
import sys, json, re
try:
    import pymupdf as fitz
except Exception:
    import fitz
doc = fitz.open(sys.argv[1]); out = []
RES = re.compile(r"PREPARED ESPECIALLY FOR|MADE FOR:")
for i, pg in enumerate(doc):
    text = pg.get_text(); bottom = ${TOP}; nonbw = 0
    for b in pg.get_text("blocks"):
        if ${TOP} <= b[3] <= ${BOTTOM} + 6: bottom = max(bottom, b[3])
    for d in pg.get_drawings():
        r = d["rect"]
        if r.y0 >= ${TOP} - 1 and r.y1 <= ${BOTTOM} + 6 and (r.width > 0.5 or r.height > 0.5): bottom = max(bottom, r.y1)
        for k in ("color", "fill"):
            c = d.get(k)
            if c is not None and tuple(round(x, 2) for x in c) not in ((0.0, 0.0, 0.0), (1.0, 1.0, 1.0)): nonbw += 1
    for blk in pg.get_text("dict")["blocks"]:
        for ln in blk.get("lines", []):
            for sp in ln["spans"]:
                if sp["text"].strip() and sp["color"] != 0: nonbw += 1
    out.append({"n": i + 1, "resident": bool(RES.search(text)), "text": text, "util": round((bottom - ${TOP}) / (${BOTTOM} - ${TOP}), 3), "nonbw": nonbw, "first": text.strip().split("\\n")[0] if text.strip() else ""})
print(json.dumps(out))
`;
const readPdf = f => { const r = spawnSync("python3", ["-I", "-c", PY, f], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 27 }); try { return JSON.parse(r.stdout); } catch (e) { return null; } };

const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", acceptDownloads: true, timezoneId: "America/Chicago" }); await agreed(ctx);
const p = await ctx.newPage(); await agreeToDialogs(p);
p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
await p.goto(base + "index.html", { waitUntil: "load" }); await p.waitForTimeout(1200);
await p.evaluate(() => { window.print = () => {}; });

const isStaff = x => /^For Staff/.test(x.text.trim());
const has = (text, t) => ("\n" + text).includes("\n" + t + "\n");
const judge = (tag, pages, want) => {
  ok(isStaff(pages[0]), `${tag}: page 1 is the Staff Companion Sheet`);
  const hy = pages.filter(x => !isStaff(x) && TITLES.some(t => has(x.text, t)));
  ok(hy.length >= want, `${tag}: ${hy.length} hybrid page(s) (need ${want})`);
  for (const h of hy) {
    ok(h.util >= 0.6, `${tag}: hybrid page ${h.n} is ${Math.round(h.util * 100)}% full (need 60%)`);
    ok(h.nonbw === 0, `${tag}: hybrid page ${h.n} has ${h.nonbw} piece(s) that are not pure black on white`);
    ok(!/Clinical Tip:|\[Therapy:|\(continued\)|GDS|Staff/.test(h.text), `${tag}: hybrid page ${h.n} carries a tip, a tag or a continued mark`);
  }
  const staff = pages.filter(isStaff).map(x => x.text).join("\n");
  const titles = hy.map(h => TITLES.find(t => has(h.text, t)));
  for (const t of titles) {
    const i = staff.indexOf(t); const after = i < 0 ? "" : staff.slice(i, i + 700);
    const bullets = (after.match(/•/g) || []).length;
    ok(i >= 0 && bullets >= 2 && /hand-under-hand/i.test(after) && !/hand-over-hand/i.test(after), `${tag}: the staff sheet lists "${t}" with tips (${bullets}) including hand-under-hand`);
  }
  return titles;
};

/* ---------- Quick Print: three clicks on one style ---------- */
const quick = [];
for (let i = 0; i < 3; i++) {
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 40000 }), p.evaluate(() => { document.getElementById("guestPresetToggle").click(); document.querySelector('[data-guest-preset="homemaker"]').click(); })]);
  const f = path.join(tmp, `quick${i}.pdf`); await dl.saveAs(f);
  const pages = readPdf(f);
  if (!pages) { console.log("hybrid pages check skipped: PyMuPDF is not installed for python3 (pip install pymupdf)"); process.exit(2); }
  quick.push({ pages, titles: judge(`quick print click ${i + 1}`, pages, 2), text: pages.map(x => x.text).join("\n") });
  await p.waitForTimeout(400);
}
ok(new Set(quick.map(q => q.text)).size === 3, "quick print: three clicks gave three different packets");
ok(quick.every((q, i) => i === 0 || q.titles.join("|") !== quick[i - 1].titles.join("|")), "quick print: the same two hybrid layouts never came twice in a row: " + quick.map(q => q.titles.join("+")).join(" / "));
ok(new Set(quick.flatMap(q => q.titles)).size >= 4, "quick print: three clicks used at least four different layouts: " + [...new Set(quick.flatMap(q => q.titles))].join(", "));

/* ---------- the main packet: three clicks ---------- */
await p.fill("#first", "Margaret"); await p.fill("#born", "1942"); await p.fill("#town", "Velva"); await p.fill("#job", "teacher"); await p.fill("#hobbies", "gardening, baking");
await p.evaluate(() => { const r = document.querySelector("input[name=stage][value=middle]"); if (r) { r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); } });
const main = [];
for (let i = 0; i < 3; i++) {
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 120000 }), p.click("#go")]);
  const f = path.join(tmp, `main${i}.pdf`); await dl.saveAs(f);
  const pages = readPdf(f);
  main.push({ titles: judge(`main packet click ${i + 1}`, pages, 1), text: pages.map(x => x.text).join("\n") });
  await p.waitForTimeout(400);
}
ok(new Set(main.map(m => m.text)).size === 3, "main packet: three clicks gave three different packets");
ok(new Set(main.flatMap(m => m.titles)).size >= 2, "main packet: the three clicks used different hybrid layouts: " + main.map(m => m.titles.join("+")).join(" / "));

/* ---------- what is remembered ---------- */
const kept = await p.evaluate(() => localStorage.getItem("cognicopia_variety"));
ok(!!kept && !/Margaret|Velva|teacher/i.test(kept) && /^[\w\[\]{}",:.\-]*$/.test(kept), "memory: it holds ids and numbers, never the name or town typed: " + String(kept).slice(0, 100));
const pools = Object.keys(JSON.parse(kept || '{"pools":{}}').pools || {});
ok(pools.length >= 3, `memory: ${pools.length} pools are being kept (${pools.slice(0, 5).join(", ")})`);
await p.evaluate(() => window.CogniVariety.clear());
ok(await p.evaluate(() => localStorage.getItem("cognicopia_variety")) === null, "memory: clearing forgets it");

ok(foreign.length === 0, "nothing was requested from outside the page: " + foreign.slice(0, 3));
ok(errs.length === 0, "no page script failed: " + errs.slice(0, 3));
await browser.close(); srv.close();

console.log(problems.length ? `hybrid pages check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 30).join("\n  - ") : `hybrid pages check passed: ${passed} checks (three Quick Print clicks and three packets: different every time, hybrid pages full and black on white, tips on the staff sheet, memory holds ids only)`);
process.exit(problems.length ? 1 : 0);
