#!/usr/bin/env node
/* =====================================================================
   Printed type and the Quick-Print name, proved in a real browser.
     1. The printed sheets (the Quick-Print and Profile Packet pages) at every vision tier (standard, large,
        extra-large) and every stage: no sheet overflows, no resident text is under 18 pt, every word is pure
        black (rgb 0,0,0), and large print really is larger.
     2. The main PDF packet at each stage, with and without Extra-Large Print, read back with PyMuPDF: no text
        off the safe area, no two pieces of text on top of each other, nothing but black ink, and the resident
        pages' text never under the stage's floor, and page titles at 32 pt (a long one shrinks to fit).
     3. Quick-Print: the first-name field. A name makes "Activity Packet for <name>"; a blank field makes
        "Personalized Activity Packet"; markup and stray symbols are stripped; the word "Guest" never prints.
   Needs Playwright (and PyMuPDF for part 2/3 PDF reading; without it those parts are skipped with a note).
   Exits 2 where Playwright is missing, and npm run build skips it. Run: node scripts/check-print-type-ui.mjs
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { loadPlaywright, serve } from "./lib/browser.mjs";

const problems = [], notes = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };
const { chromium } = loadPlaywright();
const { srv, base } = await serve();
const browser = await chromium.launch();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-print-"));
const errs = [];

const PY = `
import sys, json, re
try:
    import pymupdf as fitz
except Exception:
    try:
        import fitz
    except Exception:
        print(json.dumps({"missing": True})); sys.exit(0)
doc = fitz.open(sys.argv[1]); out = {"pages": len(doc), "off": [], "overlap": 0, "color": 0, "texts": [], "small": [], "kinds": {"staff": 0, "resident": 0}, "titles": []}
FLOOR = float(sys.argv[2]) if len(sys.argv) > 2 else 0
RESIDENT = re.compile(r"PREPARED ESPECIALLY FOR|MADE FOR:")     # every page a resident works on opens with their name under one of these lines (index.html, heading())
for i, pg in enumerate(doc):
    sp = []; spans_of_page = []
    for b in pg.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                t = s["text"].strip()
                if not t: continue
                r = fitz.Rect(s["bbox"]); sp.append(r)
                out["texts"].append(t)
                if r.x0 < 35 or r.x1 > 612 - 35 or r.y1 > 792 - 30: out["off"].append([i + 1, t[:24]])
                if s["color"] != 0: out["color"] += 1
                spans_of_page.append([s["size"], r.y0, r.y1, t])
    # The size of the type, read back. A page has three bands (src/engine/ClinicalMatrix.js, SHELL): the header above 64 pt
    # (the name 13 pt, the date 12 pt, and the non-medical line 8 pt in the margin above them), the body from 64 to 706 pt,
    # and the tip and the foot below it (12 pt, for the person beside the resident). In the body a resident's page holds
    # nothing under the stage's floor and a staff page nothing under 16 pt; a number inside a puzzle cell is a mark, not text.
    body = [x for x in spans_of_page if x[1] >= 60 and x[2] <= 712]
    staff = not RESIDENT.search(" ".join(x[3] for x in body))
    out["kinds"]["staff" if staff else "resident"] += 1
    # the page's title: the first line of 21 pt or more under the header, the resident's name banner aside
    heads = sorted([x for x in body if x[0] >= 20.95 and "PREPARED" not in x[3] and "MADE FOR" not in x[3] and x[3] != "Margaret"], key=lambda x: x[1])
    if heads: out["titles"].append(round(heads[0][0]))
    need = 16 if staff else FLOOR
    for size, y0, y1, t in spans_of_page:
        if y1 <= 34: lo = 7.95                      # the non-medical line
        elif y0 < 60: lo = 11.95                    # the header
        elif y1 > 712: lo = 11.95                   # the tip and the foot
        else:
            lo = need - 0.05
            if size < 9 and re.fullmatch(r"[0-9]{1,3}[.)]?", t): continue
        if FLOOR and size < lo: out["small"].append([i + 1, round(size, 1), round(lo, 1), "staff" if staff else "resident", t[:40]])
    for a in range(len(sp)):
        for c in range(a + 1, len(sp)):
            x = sp[a] & sp[c]
            if x.width > 2 and x.height > 4: out["overlap"] += 1
print(json.dumps(out))
`;
const readPdf = (file, floor) => {
  const r = spawnSync("python3", ["-I", "-c", PY, file, String(floor || 0)], { encoding: "utf8", timeout: 60000 });
  try { return JSON.parse(r.stdout); } catch (e) { return { missing: true }; }
};

/* ---------- 1. the printed sheets, every tier and stage ---------- */
const sheetMin = {};
for (const vision of ["standard", "large", "xl"]) for (const stage of ["early", "middle", "late"]) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" }); const p = await ctx.newPage();
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(base + "index.html"); await p.waitForTimeout(400);
  await p.evaluate(([v, s]) => {
    window.getActiveResidentContext = () => ({ isGeneric: true, name: "", stage: s, difficulty: { level: 3, label: "Moderate" },
      print: { vision: v, readingLevel: "short", motorSkills: "", paper: "letter", ink: "bw", highContrast: true },
      avoid: { topics: ["war", "death", "medical"], words: [] }, decades: ["1940s", "1950s", "1960s"], hobbies: [], people: [], music: { artists: [], genres: [], favoriteSong: "" }, screen: [], military: { okToMention: false } });
  }, [vision, stage]);
  await p.click("#qpbGenerate"); await p.waitForTimeout(1200);
  const r = await p.evaluate(() => {
    const sheets = [...document.querySelectorAll("#qpbPreview .qp-sheet")];
    let minPt = 99, gray = 0, inst = 0;
    sheets.forEach(sh => sh.querySelectorAll("*").forEach(el => {
      if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
      const cs = getComputedStyle(el), pt = parseFloat(cs.fontSize) * 0.75;
      if (cs.color !== "rgb(0, 0, 0)") gray++;
      if (el.closest(".qp-staff,.qp-foot,.qp-cut")) return;
      if (pt < minPt) minPt = pt;
    }));
    const i = document.querySelector("#qpbPreview .qp-inst"); if (i) inst = parseFloat(getComputedStyle(i).fontSize) * 0.75;
    return { n: sheets.length, over: sheets.filter(s => s.classList.contains("qp-overflow")).length, minPt, gray, inst };
  });
  const tag = `${vision}/${stage}`;
  ok(r.n >= 4, `${tag}: the packet has its pages (${r.n})`);
  ok(r.over === 0, `${tag}: ${r.over} sheet(s) overflow`);
  ok(r.minPt >= 17.95, `${tag}: resident text goes down to ${r.minPt.toFixed(1)} pt (18 pt is the floor)`);
  ok(r.gray === 0, `${tag}: ${r.gray} piece(s) of printed text are not pure black`);
  sheetMin[tag] = r.inst;
  await ctx.close();
}
ok(sheetMin["large/middle"] > sheetMin["standard/middle"] && sheetMin["xl/middle"] > sheetMin["large/middle"],
  `the instruction line grows with the vision tier (${["standard", "large", "xl"].map(v => (sheetMin[v + "/middle"] || 0).toFixed(1)).join(" < ")} pt)`);

/* ---------- 2. the main PDF packet, with and without Extra-Large Print ---------- */
let pdfSeen = 0;
for (const stage of ["early", "middle", "late"]) for (const xl of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, serviceWorkers: "block" }); const p = await ctx.newPage();
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(base + "index.html"); await p.waitForTimeout(400);
  await p.evaluate(() => { window.print = () => {}; localStorage.clear(); });
  await p.fill("#first", "Margaret"); await p.fill("#born", "1938");
  await p.evaluate(s => { const r = document.querySelector(`input[name=stage][value=${s}]`); if (r) { r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); } }, stage);
  if (xl) await p.evaluate(() => { const c = document.getElementById("extraLargePrint"); c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); });
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 90000 }), p.click("#go")]);
  const f = path.join(tmp, `${stage}-${xl ? "xl" : "std"}.pdf`); await dl.saveAs(f);
  const floor = { early: 18, middle: 18, late: 24 }[stage];                    // the stage's floor (src/engine/ClinicalMatrix.js, STAGES[stage].type.floor)
  const r = readPdf(f, floor);
  if (r.missing) { if (!notes.length) notes.push("PyMuPDF is not installed for python3: the PDF packets were not read back (pip install pymupdf)"); await ctx.close(); continue; }
  pdfSeen++;
  const tag = `${stage}${xl ? " extra-large" : ""} packet`;
  ok(r.off.length === 0, `${tag}: text outside the safe area (${JSON.stringify(r.off.slice(0, 2))})`);
  ok(r.overlap === 0, `${tag}: ${r.overlap} overlapping pieces of text`);
  ok(r.color === 0, `${tag}: ${r.color} pieces of text are not black`);
  ok(r.texts.some(t => /Margaret/.test(t)), `${tag}: carries the resident's name`);
  const t32 = r.titles.filter(x => x >= 32).length;
  ok(r.titles.length >= 5 && t32 * 4 >= r.titles.length * 3 && Math.min(...r.titles) >= 22, `${tag}: page titles are 32 pt, a long one shrinking to fit (${t32} of ${r.titles.length} at 32 pt, the smallest ${Math.min(...r.titles)} pt)`);
  ok(r.kinds.resident >= 5 && r.kinds.resident > r.kinds.staff, `${tag}: most pages are the resident's own, each opening with their name (${r.kinds.resident} of ${r.pages}; ${r.kinds.staff} for staff)`);
  ok(r.small.length === 0, `${tag}: ${r.small.length} pieces of text are under their floor (${floor} pt on a resident's page, 16 pt on a staff page, 12 pt in the header and foot): ` + r.small.slice(0, 5).map(x => `page ${x[0]} ${x[3]} ${x[1]} pt "${x[4]}"`).join("; "));
  await ctx.close();
}

/* ---------- 3. Quick-Print: the first-name field ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, serviceWorkers: "block" }); const p = await ctx.newPage();
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(base + "index.html"); await p.waitForTimeout(400);
  const q = await p.evaluate(() => ["Margaret", "  <b>Bo</b>  b-by ' 123 ", "", "   ", "12345", "Mary-Ann O’Neil", "x".repeat(60)].map(v => window.quickPrintName(v)));
  ok(q[0] === "Margaret", "a plain first name is kept");
  ok(!/[<>]/.test(q[1]) && /Bo/.test(q[1]) && !/\d/.test(q[1]), `markup and digits are stripped (${JSON.stringify(q[1])})`);
  ok(q[2] === "" && q[3] === "" && q[4] === "", "a blank or number-only field counts as blank");
  ok(q[5] === "Mary-Ann O’Neil", "hyphens, apostrophes and spaces in a name are kept");
  ok(q[6].length <= 30, "a name is cut at 30 characters");
  ok(await p.$("#guestFirstName") !== null && await p.$("label.arb-guest-name") !== null, "the Resident first name field exists, with its label");
  const html = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "..", "index.html"), "utf8");
  ok(!/>\s*Guest\s*</.test(html.replace(/<script[\s\S]*?<\/script>/g, "")), "the word Guest is not shown as a label anywhere on the page");
  for (const [tag, name, want, never] of [["named", "Margaret", /Activity Packet for/, null], ["blank", "", /Personalized Activity Packet/, /Activity Packet for\s*Guest/]]) {
    await p.reload(); await p.waitForTimeout(400);
    await p.click("#guestPresetToggle"); await p.waitForSelector("#guestFirstName", { state: "visible" });
    if (name) await p.fill("#guestFirstName", name);
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 60000 }), p.click('[data-guest-preset="homemaker"]')]);
    const f = path.join(tmp, `quick-${tag}.pdf`); await dl.saveAs(f);
    const r = readPdf(f);
    if (r.missing) { if (!notes.some(n => /PyMuPDF/.test(n))) notes.push("PyMuPDF is not installed for python3: the Quick-Print PDF was not read back"); continue; }
    const all = r.texts.join(" ");
    ok(want.test(all), `Quick-Print ${tag}: the cover reads ${want}`);
    if (name) ok(all.includes(name), `Quick-Print ${tag}: the name is on the page`);
    ok(!/\bGuest\b/i.test(all), `Quick-Print ${tag}: the word Guest does not print`);
    if (never) ok(!never.test(all), `Quick-Print ${tag}: no "for Guest" header`);
  }
  await ctx.close();
}

await browser.close(); srv.close();
fs.rmSync(tmp, { recursive: true, force: true });
if (errs.length) problems.push("page errors: " + errs.slice(0, 3).join(" | "));
if (problems.length) { console.error("print type check FAILED: " + problems.length + " problem(s)\n  - " + problems.slice(0, 25).join("\n  - ")); process.exit(1); }
console.log(`print type check passed: ${passed} checks (9 tier and stage combinations on the printed sheets, ${pdfSeen} PDF packets read back, Quick-Print name)${notes.length ? "; " + notes.join("; ") : ""}`);
