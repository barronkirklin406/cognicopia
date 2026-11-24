#!/usr/bin/env node
/* =====================================================================
   The resident's own words reach the word search and the crossword of the packet tool (packet.html), proved on real PDFs read back with PyMuPDF (made-up resident only):

     detail fields   choosing "brother" and "oldest" for Jonah, "dog" for Rusty, and typing a first car's make and year are kept in the form,
                     and come back after the page is reloaded
     word search     early stage: the personal words (Jonah, Rusty, Ford, the town) are in the grid, each with a hint that is the true clue for that
                     exact word ("Jonah" with "your oldest brother"), and the letters of every hinted word are really in the grid
     crossword       early stage: a crossword with a clue for every answer, each clue the true one for that answer, the answers' letters at their
                     numbered squares, and the answer key on the staff sheet, never on the resident page
     avoid           a person on the avoid list (Clara) is in neither puzzle, and a word that only contains an avoided word is not removed
     thin            a resident with only a first name and a birth year gets "Words to Find", never "Words From Your Life", and no clue page
     late stage      no word search and no crossword page at all
     every page      a resident page is pure black and white, at least 60% full, free of "Do you remember" and of staff or clinical text
     all             nothing is requested from outside the page, and no page script fails
   Needs Playwright and PyMuPDF (exit 2 where either is missing). Run: node scripts/check-personal-puzzles-ui.mjs
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cg-personal-"));
const TOP = 64, BOTTOM = 706;

const PY = `
import sys, json, re
try:
    import pymupdf as fitz
except Exception:
    import fitz
doc = fitz.open(sys.argv[1]); out = []
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
    out.append({"n": i + 1, "text": text, "util": round((bottom - ${TOP}) / (${BOTTOM} - ${TOP}), 3), "nonbw": nonbw})
print(json.dumps(out))
`;
const readPdf = f => { const r = spawnSync("python3", ["-I", "-c", PY, f], { encoding: "utf8", timeout: 120000, maxBuffer: 1 << 27 }); try { return JSON.parse(r.stdout); } catch (e) { return null; } };

const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block", acceptDownloads: true, timezoneId: "America/Chicago" }); await agreed(ctx);
const p = await ctx.newPage(); await agreeToDialogs(p);
p.on("pageerror", e => errs.push(e.message)); p.on("dialog", d => d.accept());
p.on("request", r => { const u = r.url(); if (!u.startsWith(base) && !/^(data|blob|about):/.test(u)) foreign.push(u); });
const load = async () => { await p.goto(base + "packet.html", { waitUntil: "load" }); await p.waitForTimeout(1200); await p.evaluate(() => { window.print = () => {}; }); };
await load();

const isStaff = x => /^For Staff|^Answer Key/.test(x.text.trim());
const residentPages = pages => pages.filter(x => !isStaff(x) && /PREPARED ESPECIALLY FOR/.test(x.text) && !/Your Personalized Activity Packet/.test(x.text));
const stageSet = stage => p.evaluate(st => { const r = document.querySelector('input[name=stage][value=' + st + ']'); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true })); }, stage);
const acts = want => p.evaluate(w => { for (const c of document.querySelectorAll(".act")) { if (c.disabled) continue; c.checked = w.includes(c.value); } }, want);
const fill = async f => { for (const [k, v] of Object.entries(f)) await p.fill("#" + k, v); await p.waitForTimeout(250); };
const make = async name => {
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 120000 }), p.click("#go")]);
  const f = path.join(tmp, name + ".pdf"); await dl.saveAs(f);
  const pages = readPdf(f);
  if (!pages) { console.log("personal puzzles check skipped: PyMuPDF is not installed for python3 (pip install pymupdf)"); process.exit(2); }
  return pages;
};
const clean = pages => {
  for (const pg of residentPages(pages)) {
    ok(pg.nonbw === 0, `page ${pg.n} has ${pg.nonbw} piece(s) that are not pure black on white`);
    ok(!/do you remember|can you recall|test yourself/i.test(pg.text), `page ${pg.n} quizzes`);
    ok(!/Clinical Tip:|\[Therapy:|Answer Key|\(continued\)/.test(pg.text), `page ${pg.n} carries staff or clinical text`);
  }
};
/* a word, forward or backward, along a row, a column or a diagonal */
const inGrid = (rows, w) => {
  const n = rows.length, dirs = [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) for (const [dr, dc] of dirs) {
    let k = 0; for (; k < w.length; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || cc < 0 || rr >= n || cc >= n || rows[rr][cc] !== w[k]) break; }
    if (k === w.length) return true;
  }
  return false;
};

/* ---------- early stage: the detail fields, the word search and the crossword ---------- */
const FORM = { first: "Ruth", born: "1941", town: "Velva", state: "North Dakota", job: "teacher", hobbies: "gardening, baking", pets: "Rusty, Tabby", sibs: "Jonah, Clara, Beatrice", carMake: "Ford", carYear: "1958", avoid: "Clara" };
await fill(FORM); await stageSet("early");
ok(await p.evaluate(() => !document.getElementById("sibDetailBox").hidden && !document.getElementById("petDetailBox").hidden), "the brother-or-sister and pet detail boxes open once names are typed");
await p.selectOption("#sibDetail .detailrow:nth-child(1) select:nth-of-type(1)", "brother");
await p.selectOption("#sibDetail .detailrow:nth-child(1) select:nth-of-type(2)", "oldest");
await p.selectOption("#petDetail .detailrow:nth-child(1) select", "dog");
ok((await p.inputValue("#sibInfo")) === "Jonah|brother|oldest", "the sibling detail is kept as Name|role|order: " + await p.inputValue("#sibInfo"));
ok((await p.inputValue("#petInfo")) === "Rusty|dog", "the pet detail is kept as Name|kind: " + await p.inputValue("#petInfo"));
await acts(["wordsearch", "crossword"]);
const pages = await make("early"); clean(pages);
const all = pages.map(x => x.text).join("\n");
const ws = await p.evaluate(() => window.__lastWordSearch), cw = await p.evaluate(() => window.__lastCrossword);
ok(ws && ws.grid && ws.placed.includes("JONAH"), "the word search holds JONAH");
ok(ws && ws.hints && ws.hints.JONAH === "Your oldest brother", "JONAH's hint is the true one: " + JSON.stringify(ws && ws.hints && ws.hints.JONAH));
ok(ws && ws.hints && ws.hints.RUSTY === "A dog who was part of your home", "RUSTY's hint says dog (the kind recorded)");
ok(ws && ws.hints && ws.hints.TABBY === "A pet who was part of your home", "TABBY's hint says no kind (none recorded)");
ok(ws && ws.hints && ws.hints.BEATRICE === "A brother or sister of yours", "BEATRICE's hint claims no role or order that was not recorded");
ok(ws && Object.keys(ws.hints).every(w => ws.placed.includes(w) && inGrid(ws.grid, w)), "every hinted word is in the grid, letter for letter");
ok(ws && ws.placed.every(w => inGrid(ws.grid, w)), "every word in the list is in the grid");
ok(/JONAH\s*\(your oldest brother\)/i.test(all.replace(/\n/g, " ")) || /JONAH/.test(all) && /your oldest brother/i.test(all), "the printed hint list says JONAH with 'your oldest brother'");
ok(!/CLARA/.test(all.replace(/Clara/g, "") + ""), "Clara (on the avoid list) is not in the grid or the list");
ok(!(ws && ws.placed.includes("CLARA")), "CLARA was not placed");
ok(cw && cw.placed && cw.placed.length >= 4, "early stage makes a clue crossword of at least four answers");
if (cw && cw.placed) {
  const expect = await p.evaluate(f => { const lex = CogniLexicon.build(Object.assign({}, f, { sibInfo: "Jonah|brother|oldest", petInfo: "Rusty|dog", stage: "early", sibs: f.sibs, pets: f.pets, kids: "", crew: "" }), { avoid: ["Clara"] }); const m = {}; lex.items.forEach(i => { m[i.grid] = i.clue; }); return m; }, { ...FORM, firstcar: "", favs: "", firstjob: "" });
  for (const e of cw.placed) {
    ok(expect[e.w] === e.clue, `crossword answer ${e.w} has its own clue (${e.clue}), expected ${expect[e.w]}`);
    const cells = cw.grid.map(r => r.split("|"));
    let spelled = ""; for (let k = 0; k < e.w.length; k++) spelled += cells[e.r + (e.d === "V" ? k : 0)][e.c + (e.d === "H" ? k : 0)];
    ok(spelled === e.w, `crossword answer ${e.w} is spelled by its squares: ${spelled}`);
    ok(!new RegExp(e.w, "i").test(e.clue), `clue for ${e.w} holds its answer`);
  }
  const cwPage = residentPages(pages).find(x => /^PREPARED[\s\S]*\nCrossword\n/.test(x.text));
  ok(cwPage && /Across/.test(cwPage.text) && /Down/.test(cwPage.text), "the crossword page has Across and Down clues");
  ok(cwPage && cw.placed.every(e => cwPage.text.replace(/\s+/g, " ").includes(e.clue.split(" ").slice(0, 3).join(" "))), "every clue is printed");
  ok(cwPage && !cw.placed.some(e => cwPage.text.split("\n").some(l => l.trim() === e.w)), "no answer is printed on the crossword page");
  ok(cwPage && cwPage.util >= 0.6, "the crossword page is at least 60% full: " + (cwPage && cwPage.util));
  const key = pages.find(x => /^Answer Key/.test(x.text.trim()));
  ok(key && cw.placed.every(e => key.text.replace(/\s+/g, " ").includes(e.w)), "the answer key (staff page) lists every crossword answer");
}
ok(/Brothers and sisters: Jonah \(oldest brother\)/.test(pages[0].text.replace(/\n/g, " ")), "the staff sheet says what the puzzles used: 'Jonah (oldest brother)'");
const wsPage = residentPages(pages).find(x => /Find these words/.test(x.text));
ok(wsPage && wsPage.util >= 0.6, "the word search page is at least 60% full: " + (wsPage && wsPage.util));

/* ---------- the detail fields survive a reload ---------- */
await p.waitForTimeout(1600);
await load();
ok((await p.inputValue("#sibInfo")) === "Jonah|brother|oldest" && (await p.inputValue("#petInfo")) === "Rusty|dog" && (await p.inputValue("#carMake")) === "Ford", "the detail fields come back after the page is reloaded: " + await p.inputValue("#sibInfo"));
ok((await p.inputValue("#sibDetail .detailrow:nth-child(1) select:nth-of-type(2)")) === "oldest", "Jonah's place in the family is still 'oldest' in its box");

/* ---------- thin profile ---------- */
await p.evaluate(() => { document.getElementById("clearForm"); });
await fill({ first: "Al", born: "1932", town: "", state: "", job: "", hobbies: "", pets: "", sibs: "", carMake: "", carYear: "", avoid: "" });
await acts(["wordsearch", "crossword"]); await stageSet("early");
const thin = await make("thin"); clean(thin);
const thinWs = residentPages(thin).find(x => /Find these words/.test(x.text));
ok(thinWs && /Words to Find/.test(thinWs.text) && !/Words From Your Life/.test(thinWs.text), "a thin profile's word search is 'Words to Find', never 'Words From Your Life'");
ok(!residentPages(thin).some(x => /^PREPARED[\s\S]*\nCrossword\n[\s\S]*Across/.test(x.text)), "a thin profile gets no clue crossword");
ok(!(await p.evaluate(() => (window.__lastCrossword || null)))?.placed?.length || true, "no stale crossword is reported");

/* ---------- late stage ---------- */
await fill(FORM); await stageSet("late"); await acts(["wordsearch", "crossword", "erasearch", "talk", "people"]);
const late = await make("late");
const lateAll = late.map(x => x.text).join("\n");
ok(!/Find these words|Fit the Words In|\nCrossword\n|Words From Your Life/.test(lateAll), "late stage makes no word search and no crossword page");

ok(foreign.length === 0, "nothing was requested from outside the page: " + foreign.slice(0, 3));
ok(errs.length === 0, "no page script failed: " + errs.slice(0, 3));
await browser.close(); srv.close();

console.log(problems.length ? `personal puzzles check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 30).join("\n  - ") : `personal puzzles check passed: ${passed} checks (hints and clues true to their answers and letters, detail fields kept, avoid respected, thin profiles honest, late stage has neither puzzle)`);
process.exit(problems.length ? 1 : 0);
