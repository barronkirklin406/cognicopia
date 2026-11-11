#!/usr/bin/env node
/* =====================================================================
   The packet's house styles (index.html, Doc.setLook / Doc.headLook), in a real browser, with the PDFs read back by PyMuPDF.
     variety     four looks for the page titles (ledger, editorial, framed, margin); the look is chosen from the resident and the
                 month, so the same packet always looks the same and a dozen residents use every look
     one piece   a packet keeps one look on every page
     no shifts   the same resident's packet made in each of the four looks has the same number of pages, and its titles sit at
                 the same height: a look never moves a page break
     print       every look is black on white (no colored text), the serif looks set their titles in a serif, the plain look in the
                 sans; the late stage and a simplified layout always use the plain look
     new pages   Your years, My memory map and Sensory memory cards (src/engine/ReminiscencePages.js) print from the form: the timeline
                 on one sheet from the year they were born, the map holding what the form knows, the cards for staff with no name
                 banner, a scent and its safety line, two to a sheet; the late stage keeps them short; the avoid list leaves a topic out
   Needs Playwright and PyMuPDF. Run: node scripts/check-packet-looks-ui.mjs
   ===================================================================== */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const problems = [], errors = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const PY = `
import sys, json
try:
    import pymupdf as fitz
except ImportError:
    import fitz
doc = fitz.open(sys.argv[1]); out = {"pages": len(doc), "titles": [], "colored": 0}
for i, pg in enumerate(doc):
    for b in pg.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                if s["text"].strip() and s["color"] != 0: out["colored"] += 1
    # the page's title: the first large line under the name banner (the resident's own name, also large, is the banner). Titles are
    # 32 pt, shrinking for a long one; in the framed look a long title may shrink to 22 pt to stay inside its box, so 21 pt and up counts.
    big = sorted([(s["origin"][1], s["font"], s["text"].strip()) for b in pg.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]
                  if s["size"] >= 21 and s["text"].strip() and s["text"].strip() != sys.argv[2] and "PREPARED" not in s["text"] and "MADE FOR" not in s["text"]])
    if big: out["titles"].append([i, round(big[0][0]), big[0][1], big[0][2][:30]])
print(json.dumps(out))`;
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", acceptDownloads: true });
await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } });
const p = await ctx.newPage();
p.on("pageerror", e => errors.push(e.message));
await p.goto(base + "index.html", { waitUntil: "load" }); await p.waitForTimeout(1500);
async function packet(first, stage, force, simplified) {
  await p.evaluate(f => { window.__look = f; if (!Doc.prototype.__real) Doc.prototype.__real = Doc.prototype.setLook;
    // force a look for this one packet, the way setLook would choose it: never past the late stage's or a simplified layout's plain look
    Doc.prototype.setLook = function (s) { this.__real(s); if (window.__look && !(this.stage === "late" || this.simplifiedLayout)) this.look = window.__look; return this; }; }, force || "");
  await p.fill("#first", first); await p.fill("#born", "1938"); await p.fill("#hobbies", "gardening, baking");
  await p.check(`input[name="stage"][value="${stage}"]`);
  const box = await p.$("#simplifiedLayout"); if (box) { if (simplified) await box.check(); else await box.uncheck(); }
  const dl = p.waitForEvent("download", { timeout: 90000 });
  await p.click("#go");
  const file = await dl, tmp = path.join(os.tmpdir(), "cognicopia-looks-" + process.pid + "-" + Date.now() + ".pdf");
  await file.saveAs(tmp);
  try { return JSON.parse(execFileSync("python3", ["-c", PY, tmp, first], { encoding: "utf8" })); } finally { fs.unlinkSync(tmp); }
}
const fontOf = r => { const t = r.titles.filter(x => x[0] > 0); return t.length ? t[0][2] : ""; };

try {
  /* ---------- variety, chosen from the resident and the month ---------- */
  const looks = await p.evaluate(() => ["Ruth", "Walter", "Margaret", "Harold", "Evelyn", "Frank", "Lucille", "Arthur", "Dorothy", "Edna", "Clara", "Howard"]
    .map(n => { const D = new Doc().setStage("middle"); D.setLook([n, "1938", "November 2026"].join("|")); return D.look; }));
  ok(new Set(looks).size === 4, `a dozen residents use all four looks (${[...new Set(looks)].join(", ")})`);
  const again = await p.evaluate(() => { const a = new Doc().setStage("middle").setLook("Ruth|1938|November 2026").look, b = new Doc().setStage("middle").setLook("Ruth|1938|November 2026").look, c = new Doc().setStage("middle").setLook("Ruth|1938|December 2026").look; return [a, b, c]; });
  ok(again[0] === again[1], "the same resident and month always get the same look");
  const late = await p.evaluate(() => { const D = new Doc().setStage("late"); return ["Ruth", "Walter", "Margaret", "Harold"].every(n => D.setLook(n + "|1938|November 2026").look === "ledger"); });
  ok(late, "the late stage always uses the plain look");
  const simple = await p.evaluate(() => { const D = new Doc().setStage("middle"); D.simplifiedLayout = true; return ["Ruth", "Walter", "Margaret", "Harold"].every(n => D.setLook(n + "|1938|November 2026").look === "ledger"); });
  ok(simple, "a simplified layout always uses the plain look");

  /* ---------- the same packet in each look: same pages, same title heights, black on white ---------- */
  const made = {};
  for (const look of ["ledger", "editorial", "framed", "margin"]) made[look] = await packet("Ruth", "middle", look, false);
  const counts = Object.values(made).map(r => r.pages);
  ok(new Set(counts).size === 1 && counts[0] > 5, `the same packet has the same number of pages in every look (${counts.join(", ")})`);
  const ys = Object.values(made).map(r => r.titles.filter(x => x[0] > 0).map(x => x[0] + ":" + x[1]).join(","));
  ok(new Set(ys).size === 1, "and its titles sit on the same pages at the same heights");
  ok(Object.values(made).every(r => r.colored === 0), "every look prints its words in black");
  ok(/Times/.test(fontOf(made.editorial)) && /Times/.test(fontOf(made.margin)) && !/Times/.test(fontOf(made.ledger)) && !/Times/.test(fontOf(made.framed)),
    `the editorial and margin looks set their titles in a serif, the ledger and framed looks in the sans (${["ledger", "editorial", "framed", "margin"].map(k => k + " " + fontOf(made[k])).join("; ")})`);
  const one = made.editorial.titles.filter(x => x[0] > 0 && !/Staff|Notes|About Your/.test(x[3]));
  ok(one.length > 3 && one.every(x => /Times/.test(x[2])), "a packet keeps one look on every resident page");
  const lateMade = await packet("Ruth", "late", "editorial", false);
  ok(!/Times/.test(fontOf(lateMade)), "a late-stage packet prints in the plain look even when another is chosen");
  /* ---------- the three reminiscence pages ---------- */
  const PAGES = `
import sys, json
try:
    import pymupdf as fitz
except ImportError:
    import fitz
doc = fitz.open(sys.argv[1]); print(json.dumps({"pages": [p.get_text() for p in doc], "colored": sum(1 for p in doc for b in p.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"] if s["text"].strip() and s["color"] != 0)}))`;
  async function withPages(stage, avoid) {
    await p.evaluate(() => { window.__look = ""; });
    for (const [id, v] of Object.entries({ first: "Ruth", born: "1938", job: "teacher", town: "Dubuque", state: "Iowa", hobbies: "gardening, baking", favs: "roses, coffee", kids: "Susan, David", spouse: "Walter", pets: "Rusty", avoid: avoid || "" })) { if (await p.$("#" + id)) await p.fill("#" + id, v); }
    await p.check(`input[name="stage"][value="${stage}"]`);
    const box = await p.$("#simplifiedLayout"); if (box) await box.uncheck();
    await p.evaluate(() => document.querySelectorAll("input.act").forEach(c => { c.checked = ["sensorycards", "youryears", "memorymap"].includes(c.value); }));
    const dl = p.waitForEvent("download", { timeout: 90000 });
    await p.click("#go");
    const file = await dl, tmp = path.join(os.tmpdir(), "cognicopia-rpages-" + process.pid + "-" + Date.now() + ".pdf");
    await file.saveAs(tmp);
    try { return JSON.parse(execFileSync("python3", ["-c", PAGES, tmp], { encoding: "utf8" })); } finally { fs.unlinkSync(tmp); }
  }
  const mid = await withPages("middle");
  const pageOf = (r, re) => r.pages.filter(x => re.test(x));
  const years = pageOf(mid, /Your Years/), map = pageOf(mid, /My Memory Map/), cards = pageOf(mid, /Sensory Memory Cards/);
  ok(years.length === 1 && /1938/.test(years[0]) && /1968/.test(years[0]) && /Born/.test(years[0]) && /Midwest/.test(years[0]), "Your years prints on one sheet, from the year they were born to thirty, with their region");
  ok(map.length === 1 && /Dubuque/.test(map[0]) && /Walter/.test(map[0]) && /gardening/.test(map[0]) && /Every answer is welcome/.test(map[0]), "the memory map holds what the form knows, and invites without testing");
  ok(cards.length >= 1 && cards.length <= 2 && cards.every(x => !/PREPARED ESPECIALLY FOR/.test(x)) && /To smell/.test(cards.join(" ")) && /never to eat/.test(cards.join(" ")) && /To hold/.test(cards.join(" ")),
    `the sensory cards are for staff (no name banner), with a thing to hold and a scent with its safety line, two to a sheet (${cards.length} sheets for 4 cards)`);
  ok(mid.colored === 0, "the three pages print in black");
  ok(years.concat(map).every(x => /PREPARED ESPECIALLY FOR/.test(x)), "the resident's two pages open with their name");
  const lateR = await withPages("late");
  const lateYears = pageOf(lateR, /Your Years/)[0] || "";
  ok(pageOf(lateR, /My Memory Map/).length === 1 && !/Friends and pets/.test(pageOf(lateR, /My Memory Map/)[0]) && (lateYears.match(/\b19\d\d\b/g) || []).length <= 5, "the late stage keeps them short: four parts on the map, a few years on the timeline");
  const noRadio = await withPages("middle", "radio");
  ok(!/radio/i.test(pageOf(noRadio, /Sensory Memory Cards/).join(" ")), "with radio on the avoid list, no card mentions a radio");
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `packet looks check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `packet looks check passed: ${passed} checks in a real browser (four looks chosen by resident and month, one look per packet, the same pages and title heights in every look, black on white, the plain look at the late stage; Your years, My memory map and Sensory memory cards from the form; PDFs read back with PyMuPDF)`);
process.exit(problems.length ? 1 : 0);
