#!/usr/bin/env node
/* =====================================================================
   The Packet Builder's house styles on its printed sheets (builder.html style#sheet-looks, sheetLook; the activity engine's
   decorations in src/engine/ClinicalActivities.js toSVG), in a real browser, printed to PDF and read back with PyMuPDF.
     the choice   one look per packet, from the resident and the month: the same packet always prints the same, a dozen residents use
                  all four looks, calm mode keeps the plain look; printing a packet puts the look on the print area
     no shifts    the same sheets printed in each look keep every title band's height and every body where it was, and the same
                  number of pages; nothing runs outside its sheet
     both kinds   the HTML sheets and the sheets the engine draws as one picture both take the look: the serif looks set the title in
                  Fraunces, the engine sheets show exactly their own look's rule, frame or bar and no other
     print        black on white only; the late stage (advanced) keeps the plain look on both kinds of sheet
   Needs Playwright and PyMuPDF. Run: node scripts/check-builder-looks-ui.mjs
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
doc = fitz.open(sys.argv[1])
print(json.dumps({"pages": len(doc), "colored": sum(1 for p in doc for b in p.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"] if s["text"].strip() and s["color"] != 0)}))`;
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
await ctx.addInitScript(() => { try { localStorage.setItem("cognicopia_eula_accepted", "true"); } catch (e) { /* ignore */ } window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
const p = await ctx.newPage();
p.on("pageerror", e => errors.push(e.message));
await p.goto(base + "builder.html#/", { waitUntil: "load" }); await p.waitForTimeout(1500);
await p.evaluate(() => document.fonts.load('700 26pt "Fraunces"'));
const ACTS = ["word-search", "anagram", "choose-ending", "oddone", "sequence", "matching", "search-guided"];

async function printed(look, level) {
  await p.evaluate(({ look, level, ACTS }) => {
    const root = document.getElementById("printRoot"); printReady = true;
    root.className = "pure-bw res-clean" + (look !== "ledger" ? " look-" + look : "");
    root.innerHTML = ACTS.filter(id => ACT_INDEX[id]).map((id, k) => sheetHtml({ uid: "t" + k, activityId: id, cfg: { residentName: "Ruth", date: todayISO(), difficulty: level, era: "general" }, batchSeed: 777 + k, count: 1, index: 0 }, false)).join("");
    numberSheets(root);
  }, { look, level, ACTS });
  await p.emulateMedia({ media: "print" });
  const m = await p.evaluate(() => [...document.querySelectorAll("#printRoot .sheet")].map(s => {
    const r = s.getBoundingClientRect(), hd = s.querySelector(".sh-head"), bd = s.querySelector(".sh-body"), svg = s.querySelector(":scope > svg");
    let worst = 0; s.querySelectorAll("*").forEach(c => { if (c.closest("svg") && c.tagName !== "svg") return; const q = c.getBoundingClientRect(); if (q.width && q.height) worst = Math.max(worst, q.bottom - r.bottom, q.right - r.right); });
    const shown = svg ? [...svg.querySelectorAll("[data-look]")].filter(g => getComputedStyle(g).display !== "none").map(g => g.getAttribute("data-look")) : null;
    const title = hd ? hd.querySelector("h1") : svg ? svg.querySelector('text[data-role="title"]') : null;
    return { kind: hd ? "html" : svg ? "eng" : "other", head: hd ? Math.round(hd.getBoundingClientRect().height) : null, body: bd ? Math.round(bd.getBoundingClientRect().top - r.top) : null,
      font: title ? getComputedStyle(title).fontFamily : "", shown, worst: Math.round(worst), late: s.classList.contains("lvl-advanced") || s.classList.contains("eng-late") };
  }));
  const tmp = path.join(os.tmpdir(), "cognicopia-blooks-" + process.pid + "-" + Date.now() + ".pdf");
  await p.pdf({ path: tmp, preferCSSPageSize: true, printBackground: true });
  await p.emulateMedia({ media: "screen" });
  try { return { m, pdf: JSON.parse(execFileSync("python3", ["-c", PY, tmp], { encoding: "utf8" })) }; } finally { fs.unlinkSync(tmp); }
}

try {
  /* ---------- the choice ---------- */
  const choice = await p.evaluate(() => ({ dozen: [...new Set(["Ruth", "Walter", "Margaret", "Harold", "Evelyn", "Frank", "Lucille", "Arthur", "Dorothy", "Edna", "Clara", "Howard"].map(n => sheetLook(n, false)))].length,
    same: sheetLook("Ruth", false) === sheetLook("Ruth", false), calm: ["Ruth", "Walter", "Margaret", "Harold"].every(n => sheetLook(n, true) === "ledger") }));
  ok(choice.dozen === 4, `a dozen residents use all four looks (${choice.dozen})`);
  ok(choice.same && choice.calm, "the same resident and month print the same look, and calm mode keeps the plain look");
  const viaPrint = await p.evaluate(() => {
    const items = [{ uid: "q1", activityId: "word-search", cfg: { residentName: "Walter", date: todayISO(), difficulty: "moderate", era: "general" }, batchSeed: 4242, count: 1, index: 0 }];
    try { generatePdf(items, { calmMode: false }); } catch (e) { return { err: e.message }; }
    const want = sheetLook("Walter", false), cls = document.getElementById("printRoot").className;
    return { want, cls, ok: want === "ledger" ? !/look-/.test(cls) : cls.indexOf("look-" + want) >= 0 };
  });
  await p.waitForTimeout(800);
  ok(viaPrint.ok, `printing a packet puts the resident's look on the print area (${viaPrint.want}: "${viaPrint.cls || viaPrint.err}")`);

  /* ---------- the same sheets in every look ---------- */
  const made = {};
  for (const look of ["ledger", "editorial", "framed", "margin"]) made[look] = await printed(look, "moderate");
  const sig = r => r.m.map(x => x.kind + ":" + x.head + ":" + x.body).join("|");
  ok(Object.values(made).every(r => sig(r) === sig(made.ledger)), "every title band keeps its height and every body stays where it was, in every look");
  ok(Object.values(made).every(r => r.pdf.pages === made.ledger.pdf.pages && r.pdf.pages === r.m.length), `the same number of pages in every look (${Object.values(made).map(r => r.pdf.pages).join(", ")})`);
  ok(Object.values(made).every(r => r.m.every(x => x.worst <= 2)), "nothing runs outside its sheet in any look");
  ok(Object.values(made).every(r => r.pdf.colored === 0), "every look prints black on white");
  const eng = made.ledger.m.filter(x => x.kind === "eng").length, html = made.ledger.m.filter(x => x.kind === "html").length;
  ok(eng >= 3 && html >= 1, `the set has both kinds of sheet (${html} HTML, ${eng} drawn by the engine)`);
  ok(["editorial", "margin"].every(k => made[k].m.filter(x => x.kind !== "other").every(x => /Fraunces/.test(x.font))) && ["ledger", "framed"].every(k => made[k].m.every(x => !/Fraunces/.test(x.font))),
    "the serif looks set every title in Fraunces, the others in the sans");
  ok(["editorial", "framed", "margin"].every(k => made[k].m.filter(x => x.kind === "eng").every(x => x.shown.length === 1 && x.shown[0] === k)) && made.ledger.m.filter(x => x.kind === "eng").every(x => !x.shown.length),
    "each engine sheet shows exactly its own look's rule, frame or bar, and the plain look shows none");

  /* ---------- the late stage keeps the plain look ---------- */
  const late = await printed("editorial", "advanced");
  ok(late.m.length >= 3 && late.m.every(x => x.late || x.kind === "other") && late.m.every(x => !/Fraunces/.test(x.font) && !(x.shown && x.shown.length)), "at the late stage both kinds of sheet keep the plain look under any look");
  ok(errors.length === 0, "no script errors" + (errors.length ? ": " + errors.slice(0, 3).join("; ") : ""));
} finally { await browser.close(); srv.close(); }

console.log(problems.length ? `builder looks check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.join("\n  - ")
  : `builder looks check passed: ${passed} checks in a real browser (four looks by resident and month, calm mode plain, the same sheets in every look with nothing moved, HTML and engine sheets, the late stage plain, black on white; PDFs read back with PyMuPDF)`);
process.exit(problems.length ? 1 : 0);
