#!/usr/bin/env node
/* =====================================================================
   Checks for Instant Soothe and the shared packet engine:
     src/engine/SoothingArt.js, SoothingContent.js, SoothingPacketEngine.js, ProceduralPacketEngine.js
   and for the way index.html, builder.html and sw.js use them.  Node built-ins only; nothing is fetched.

     1. the library: 100+ reminiscence prompts (1901-1989, every decade), 20+ line-art motifs, 30+ puzzles, 15+ tracing paths;
        every word a resident reads passes the adult-dignity filter and the quiz-word ban
     2. every stage and theme, over many seeds: a packet of one to three pages that passes the rulebook (type, lines,
        margins, black on white), reads 18 pt or more, and is the same drawing for the same plan
     3. the same choices twice give different packets, and sequential prints never repeat while anything unused is left
     4. the facility around it: the history is ids only and is kept to the pool's size, the seed is new each time, the era
        window is 1901-1989
     5. the engine files make no request, read no clock (the facade needs one for a fresh seed) and use no random function
        but the browser's secure one
     6. the pages: Letter sheets with 0.65 in on the binding side and 0.5 in on the others, a hidden #print-stage, an
        @media print rule that shows nothing else, the print window and the clean-up afterward
     7. the dialog: #instant-soothe-modal, the two pickers, the button; index.html and builder.html open it and never print
        straight away; the gate still counts; no static PDF links
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0; const problems = [];
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------- load it the way a page does ---------- */
const store = {};
const fakeStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const ctx = vm.createContext({ console, Date, Math, JSON, Object, Array, String, Number, RegExp, Map, Set, WeakMap, Error, Intl, Promise, Uint32Array, parseInt, parseFloat, isFinite, isNaN, setTimeout, clearTimeout });
ctx.globalThis = ctx; ctx.window = ctx; ctx.localStorage = fakeStorage;
ctx.crypto = { getRandomValues: a => { for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 4294967296) >>> 0; return a; } };
const FILES = ["assets/pcg/pcg-data.bundle.js", "src/pcg/prng.js", "src/pcg/matrix.js", "src/pcg/grammar.js", "src/pcg/puzzles.js", "src/pcg/packet.js",
  "src/engine/ClinicalMatrix.js", "src/services/ColoringManifest.js", "assets/coloring/subjects.bundle.js", "src/engine/ColoringEngine.js", "src/engine/ClinicalActivities.js",
  "src/engine/SoothingArt.js", "src/engine/SoothingContent.js", "src/engine/SoothingPacketEngine.js", "src/engine/ProceduralPacketEngine.js"];
FILES.forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
const CM = ctx.CognicopiaClinicalMatrix, CA = ctx.CognicopiaClinicalActivities, PCG = ctx.CognicopiaPCG;
const Art = ctx.CognicopiaSoothingArt, C = ctx.CognicopiaSoothingContent, E = ctx.CognicopiaSoothingEngine, P = ctx.CognicopiaProceduralPacketEngine;
ok(!!(CM && CA && Art && C && E && P), "the library, the engine and the facade load");
if (!(CM && CA && Art && C && E && P)) { console.error("soothing check FAILED: the engine did not load"); process.exit(1); }
ok(ctx.ProceduralPacketEngine === P, "the facade is also window.ProceduralPacketEngine");

const STAGES = ["early", "middle", "late"], THEMES = ["nature", "heritage", "music", "mix"];
const FLOOR = { early: 14, middle: 18, late: 24 }, LINE = { early: 2.25, middle: 3, late: 4.5 };

/* ---------- 1. the library ---------- */
ok(C.PROMPTS.length >= 100, `at least 100 reminiscence prompts (${C.PROMPTS.length})`);
ok(Art.MOTIFS.length >= 20, `at least 20 line-art motifs (${Art.MOTIFS.length})`);
ok(C.PUZZLES.length >= 30, `at least 30 calming puzzles (${C.PUZZLES.length})`);
ok(Art.PATHS.length >= 15, `at least 15 tracing paths (${Art.PATHS.length})`);
ok(new Set(C.PROMPTS.map(p => p.id)).size === C.PROMPTS.length && new Set(C.PUZZLES.map(p => p.id)).size === C.PUZZLES.length &&
   new Set(Art.MOTIFS.map(p => p.id)).size === Art.MOTIFS.length && new Set(Art.PATHS.map(p => p.id)).size === Art.PATHS.length, "every id is unique");
ok(C.PROMPTS.every(p => p.era[0] >= 1901 && p.era[1] <= 1989 && p.era[0] <= p.era[1]), "every prompt's years fall inside 1901 to 1989");
for (let d = 1900; d < 1990; d += 10) ok(C.PROMPTS.filter(p => p.era[0] <= d + 9 && p.era[1] >= Math.max(d, 1901)).length >= 8, `the ${d}s have at least 8 prompts`);
["n", "h", "m"].forEach(code => ok(C.PROMPTS.filter(p => p.themes.indexOf(code) >= 0).length >= 25, `theme ${code} has at least 25 prompts`));
["n", "h", "m"].forEach(code => {
  ok(Art.MOTIFS.filter(m => m.themes.indexOf(code) >= 0).length >= 6, `theme ${code} has at least 6 motifs`);
  ok(Art.PATHS.filter(m => m.themes.indexOf(code) >= 0).length >= 6, `theme ${code} has at least 6 paths`);
  ok(C.PUZZLES.filter(m => m.themes.indexOf(code) >= 0).length >= 10, `theme ${code} has at least 10 puzzles`);
});
ok(C.PROMPTS.filter(p => p.fact).length >= 50, "at least 50 prompts carry a historical fact");
ok(C.GROUNDING.length >= 8 && C.TIPS.length >= 10, "grounding lines and clinical tips are in");
const BAN = /\b(remember(?:s|ed|ing)?|recall(?:s|ed|ing)?|forget(?:s|ting)?|forgot(?:ten)?|quiz(?:zes)?|test(?:ed|ing)?|wrong|score|alone|lonely|hurry|quickly|must|should|patients?|dementia|child(?:ish)?|baby|kids?)\b/i;
const seen = [];
const lint = (label, t) => { if (!t) return; seen.push(t); const l = CM.dignity.lint(t); ok(!l.length, `${label} passes the dignity filter: "${t}" ${l.join(",")}`); ok(!BAN.test(t), `${label} has no banned word: "${t}"`); };
C.PROMPTS.forEach(p => { lint(p.id + " title", p.title); lint(p.id + " cue", p.cue); lint(p.id + " text", p.text); lint(p.id + " fact", p.fact); ok(p.text.length <= 150, `${p.id} reads in a few lines`); });
C.PUZZLES.forEach(p => { lint(p.id + " title", p.title); (p.words || p.items || []).forEach(w => lint(p.id + " " + w, w)); (p.pairs || []).forEach(q => { lint(p.id, q.stem + " " + q.answer); q.others.forEach(o => lint(p.id, o)); }); });
C.GROUNDING.concat(C.RHYTHM).forEach(g => { lint(g.id, g.text); lint(g.id, g.short); });
Object.values(C.INSTRUCTIONS).forEach(o => Object.values(o).forEach(t => lint("instruction", t)));
Art.MOTIFS.forEach(m => lint(m.id, m.name)); Art.PATHS.forEach(m => lint(m.id, m.name));
C.TIPS.forEach(t => { ok(!CM.dignity.lint(t.text.replace(/^Clinical Tip:\s*/, "")).length, `${t.id} passes the dignity filter`); ok(/^Clinical Tip: /.test(t.text), `${t.id} is marked as a clinical tip`); });
/* the pictures: every motif draws at all three levels, every path fits its lane at every stage */
Art.MOTIFS.forEach(m => ["bold", "simple", "detailed"].forEach(lv => {
  let paths = null; try { paths = m.draw(PCG.prng.create("check/" + m.id + "/" + lv), lv); } catch (e) { paths = null; }
  ok(Array.isArray(paths) && paths.length > 0 && paths.every(q => typeof q[0] === "string" && /^M/.test(q[0]) && !/NaN|undefined|Infinity/.test(q[0])), `${m.id} draws at the ${lv} level`);
}));
[17, 23, 30].forEach(hw => Art.PATHS.forEach(def => {
  const r = Art.buildPath(def, () => PCG.prng.create("check/" + def.id + "/" + hw), 420 - 2 * (hw + 10), 410 - 2 * (hw + 10), hw);
  ok(r === null || (r.pts.length > 10 && Art.pathOk(r.pts, hw, r.closed)), `${def.id} is a lane with no fold at half width ${hw}`);
}));
ok([17, 23, 30].every(hw => Art.PATHS.filter(def => Art.buildPath(def, () => PCG.prng.create("check2/" + def.id + "/" + hw), 420 - 2 * (hw + 10), 410 - 2 * (hw + 10), hw)).length >= 15), "at least 15 paths fit the widest lane");

/* ---------- 2. every stage and theme ---------- */
const sigOf = pk => pk.pages.map(p => p.kind + ":" + p.id).join(" ");
let packets = 0, hasPage = { prompt: 0, motif: 0, path: 0, puzzle: 0 };
const staff = CM.STAFF_ROLES;
STAGES.forEach(st => THEMES.forEach(th => {
  for (let s = 0; s < 18; s++) {
    let pk = null, err = "";
    try { pk = E.generate({ stage: st, theme: th, seed: "chk" + s, name: "Margaret", date: "2026-10-06", wing: "Maple" }); } catch (e) { err = e.message; }
    ok(!!pk, `${st}/${th}/${s} makes a packet ${err}`);
    if (!pk) continue;
    packets++;
    ok(pk.pages.length >= 1 && pk.pages.length <= 3 && (st !== "late" || pk.pages.length <= 2), `${st}/${th}/${s}: one to three pages (${pk.pages.length})`);
    pk.pages.forEach((pg, i) => {
      hasPage[pg.kind]++;
      const probs = CM.validatePage(pg.full, st);
      ok(!probs.length, `${st}/${th}/${s} page ${i + 1} passes the rulebook: ${probs[0] || ""}`);
      const small = pg.full.texts.filter(t => staff.indexOf(t.role) < 0 && t.role !== "number" && t.role !== "mark" && t.size < E.RES_MIN - 1e-9);
      ok(!small.length, `${st}/${th}/${s} page ${i + 1}: every resident line is ${E.RES_MIN} pt or more`);
      if (st === "late") ok(pg.full.texts.filter(t => staff.indexOf(t.role) < 0 && t.role !== "mark").every(t => t.size >= FLOOR.late && t.bold), `${st}/${th}/${s} page ${i + 1}: late-stage words are 24 pt bold`);
      const lines = pg.full.items.filter(it => it.role === "motor" || it.role === "subject").every(it => it.w >= LINE[st] - 1e-9);
      ok(lines, `${st}/${th}/${s} page ${i + 1}: motor and picture lines are at least ${LINE[st]} pt`);
      const svg = CA.toSVG(pg.full, { width: "7.35in", height: "10in", background: "#fff", viewBox: [46.8, 36, 529.2, 720] });
      ok(!/NaN|undefined/.test(svg), `${st}/${th}/${s} page ${i + 1}: the drawing has no NaN`);
      const cols = (svg.match(/(?:fill|stroke)="([^"]*)"/g) || []).map(x => x.replace(/^[a-z]+="/, "").replace(/"$/, ""));
      ok(cols.every(c => /^(#000000|#000|#fff|#ffffff|none|white|black)$/i.test(c)), `${st}/${th}/${s} page ${i + 1}: only black and white`);
      ok(pg.full.frame && pg.full.frame.x >= 46.8 - 1e-9 && pg.full.frame.x + pg.full.frame.w <= 576 + 1e-9, `${st}/${th}/${s} page ${i + 1}: the frame sits inside the printable sheet`);
    });
    if (s < 3) {
      const again = E.compose(pk.plan, { name: "Margaret", date: "2026-10-06", wing: "Maple" });
      ok(JSON.stringify(again.pages.map(p => p.full)) === JSON.stringify(pk.pages.map(p => p.full)), `${st}/${th}/${s}: the same plan draws the same pages`);
    }
  }
}));
ok(packets === STAGES.length * THEMES.length * 18, `all ${packets} packets were made`);
ok(hasPage.prompt > 0 && hasPage.motif > 0 && hasPage.path > 0 && hasPage.puzzle > 0, "all four kinds of page turn up: " + JSON.stringify(hasPage));
/* one page asked for: any kind, and still sound */
STAGES.forEach(st => { const kinds = new Set(); for (let s = 0; s < 30; s++) { const pk = E.compose(E.choose({ stage: st, theme: "mix", seed: "one" + s, count: 1 }), { date: "2026-10-06" }); ok(pk.pages.length === 1 && !CM.validatePage(pk.pages[0].full, st).length, `${st}: one page asked for, one page sound (${s})`); kinds.add(pk.pages[0].kind); } ok(kinds.size >= 3, `${st}: a single page is not always the same kind (${[...kinds]})`); });
/* what each stage gets, by the clinical plan */
{ const early = new Set(), late = new Set();
  for (let s = 0; s < 40; s++) { E.choose({ stage: "early", theme: "mix", seed: "e" + s }).items.forEach(i => early.add(i.type)); E.choose({ stage: "late", theme: "mix", seed: "l" + s }).items.forEach(i => late.add(i.type)); }
  ok(early.has("puzzle") && late.has("path") && !late.has("puzzle"), "puzzles are for the early and middle stages; the late stage gets a path, a picture and a cue"); }
/* the theme chosen is the theme drawn */
["nature", "heritage", "music"].forEach(th => { const code = C.CODE_OF[th]; for (let s = 0; s < 20; s++) { const pl = E.choose({ stage: "middle", theme: th, seed: "th" + s }); pl.items.forEach(it => { ok(it.theme === th, `theme ${th} stays ${th}`);
  if (it.type === "prompt") ok(C.PROMPTS.filter(p => p.id === it.id)[0].themes.indexOf(code) >= 0, `${th}: prompt ${it.id} belongs to the theme`);
  if (it.type === "motif") ok(Art.MOTIFS.filter(p => p.id === it.id)[0].themes.indexOf(code) >= 0, `${th}: motif ${it.id} belongs to the theme`); }); } });
/* the heritage theme stays in the 1940s to 1970s */
for (let s = 0; s < 40; s++) E.choose({ stage: "early", theme: "heritage", seed: "her" + s }).items.filter(i => i.type === "prompt").forEach(i => { const p = C.PROMPTS.filter(q => q.id === i.id)[0]; ok(p.era[0] <= 1979 && p.era[1] >= 1940, `heritage prompt ${i.id} reaches into the 1940s to 1970s`); });
/* the topics to steer around are steered around */
{ const avoid = ["war", "hospital", "church"]; let hits = 0; for (let s = 0; s < 40; s++) { const pl = E.choose({ stage: "early", theme: "mix", seed: "av" + s, avoid }); const re = E.avoider(avoid);
  pl.items.forEach(it => { if (it.type === "prompt") { const p = C.PROMPTS.filter(q => q.id === it.id)[0]; if (re([p.title, p.text, p.cue, p.fact, p.tags.join(" ")].join(" "))) hits++; } }); }
  ok(hits === 0, "a prompt that touches a topic to steer around is never chosen"); }
/* a year of life asked for is leaned toward */
{ let near = 0, far = 0; for (let s = 0; s < 120; s++) E.choose({ stage: "early", theme: "mix", seed: "era" + s, era: [1950, 1959] }).items.filter(i => i.type === "prompt").forEach(i => { const p = C.PROMPTS.filter(q => q.id === i.id)[0]; if (p.era[0] <= 1959 && p.era[1] >= 1950) near++; else far++; });
  ok(near > far, `prompts lean toward the resident's years (${near} near, ${far} far)`); }

/* ---------- 3. different each time, never repeating while anything is unused ---------- */
STAGES.forEach(st => THEMES.forEach(th => { const set = new Set(); for (let s = 0; s < 30; s++) set.add(sigOf(E.generate({ stage: st, theme: th, seed: "var" + s, date: "2026-10-06" }))); ok(set.size >= 22, `${st}/${th}: 30 seeds make at least 22 different packets (${set.size})`); }));
{ /* the same profile twice: different packets */
  let same = 0; for (let s = 0; s < 40; s++) { P.History.clear(); const a = P.generate({ stage: "middle", theme: "mix", name: "Margaret", date: "2026-10-06", record: false }), b = P.generate({ stage: "middle", theme: "mix", name: "Margaret", date: "2026-10-06", record: false }); if (sigOf(a) === sigOf(b)) same++; }
  ok(same <= 1, `the same resident and day twice make different packets (${same} of 40 alike)`); }
STAGES.forEach(st => THEMES.forEach(th => {
  P.History.clear();
  const seq = { prompts: [], motifs: [], puzzles: [], paths: [], grounding: [], tips: [] };
  let broke = "";
  for (let n = 0; n < 60; n++) { let pk; try { pk = P.generate({ stage: st, theme: th, name: "", date: "2026-10-06" }); } catch (e) { broke = e.message; break; } Object.keys(seq).forEach(k => (pk.used[k] || []).forEach(id => seq[k].push(id))); }
  ok(!broke, `${st}/${th}: 60 sequential prints all draw ${broke}`);
  /* within the library's own size, no repeat: the first N uses of a pool are N different ids, N being what the theme can supply */
  const eligible = {
    prompts: C.PROMPTS.filter(p => th === "mix" || (p.themes.indexOf(C.CODE_OF[th]) >= 0 && (th !== "heritage" || (p.era[0] <= 1979 && p.era[1] >= 1940)))).length,
    motifs: Art.MOTIFS.filter(p => th === "mix" || p.themes.indexOf(C.CODE_OF[th]) >= 0).length,
    puzzles: C.PUZZLES.filter(p => th === "mix" || p.themes.indexOf(C.CODE_OF[th]) >= 0).length,
    paths: Art.PATHS.filter(p => th === "mix" || p.themes.indexOf(C.CODE_OF[th]) >= 0).length,
    grounding: C.GROUNDING.length, tips: C.TIPS.length };
  Object.keys(seq).forEach(k => { const first = seq[k].slice(0, Math.min(eligible[k], seq[k].length)); ok(new Set(first).size === first.length, `${st}/${th}: no ${k} repeats in the first ${first.length} uses (library of ${eligible[k]})`); });
}));
{ /* the page texts differ across sequential prints, too: 25 prints, no prompt page twice */
  P.History.clear(); const titles = []; for (let n = 0; n < 25; n++) { const pk = P.generate({ stage: "early", theme: "mix", date: "2026-10-06" }); pk.pages.forEach(pg => { if (pg.kind === "prompt") titles.push(pg.id); }); }
  ok(new Set(titles).size === titles.length, "25 sequential early-stage prints: no reminiscence prompt appears twice"); }

/* ---------- 4. the history, the seed and the years ---------- */
P.History.clear();
ok(Object.keys(P.History.read()).every(k => Array.isArray(P.History.read()[k])), "the history reads as lists");
{ const pk = P.generate({ stage: "middle", theme: "nature", date: "2026-10-06" }); const raw = store[P.KEYS.history];
  ok(typeof raw === "string" && raw.length < 6000, "the history is small (" + (raw || "").length + " characters)");
  ok(!/Margaret|[A-Z][a-z]+ [A-Z][a-z]+|\d{4}-\d{2}-\d{2}/.test(raw), "the history holds ids only: no name, text or date");
  ok(JSON.parse(raw).v === 1 && JSON.parse(raw).prompts.every(id => /^r\d+$/.test(id)), "the history's ids are the library's own");
  for (let n = 0; n < 200; n++) P.generate({ stage: "early", theme: "mix", date: "2026-10-06" });
  const h = JSON.parse(store[P.KEYS.history]); E.POOLS.forEach(k => ok(h[k].length <= Math.max(3, E.counts()[k]), `the ${k} history never outgrows its pool (${h[k].length} of ${E.counts()[k]})`)); }
ok(P.entropy() !== P.entropy() && P.entropy().length >= 12, "the seed is new each time");
{ const a = new Set(); for (let i = 0; i < 200; i++) a.add(P.entropy()); ok(a.size === 200, "200 seeds, 200 different"); }
ok(JSON.stringify(P.eraFromBirthYear(1938)) === "[1948,1973]" && P.eraFromBirthYear("x") === null, "a birth year gives the years they were young");
ok(JSON.stringify(P.eraFromBirthYear(1975)) === "[1985,1989]" && JSON.stringify(P.eraFromBirthYear(1880)) === "[1901,1915]" && P.eraFromBirthYear(1985) === null, "the era window is held to 1901 to 1989, and there is none for someone born after 1979");
store[P.KEYS.history] = "{not json"; ok(Array.isArray(P.History.read().prompts), "a damaged history reads as empty and does no harm");
P.Last.write("early", "music"); ok(P.Last.read().stage === "early" && P.Last.read().theme === "music", "the last choice is remembered");
store[P.KEYS.last] = JSON.stringify({ stage: "<script>", theme: 5 }); ok(P.Last.read().stage === null && P.Last.read().theme === null, "an invalid remembered choice is ignored");
P.History.clear(); delete store[P.KEYS.last];

/* ---------- 5. no request, no clock, no random function ---------- */
const PURE = ["src/engine/SoothingArt.js", "src/engine/SoothingContent.js", "src/engine/SoothingPacketEngine.js"];
PURE.forEach(f => {
  const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  ok(!/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|importScripts|eval|localStorage|sessionStorage|indexedDB|document|window\.)\b|new Function|https?:\/\//.test(src), `${f} makes no request and touches no storage or page`);
  ok(!/Math\.random|new Date|Date\.now|performance\.now|crypto/.test(src), `${f} reads no clock and draws no random number`);
});
{ const src = read("src/engine/ProceduralPacketEngine.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  ok(!/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|importScripts|eval)\b|new Function|https?:\/\/|Math\.random/.test(src), "the facade makes no request and uses no unseeded random function");
  ok(/crypto\.getRandomValues/.test(src) && /localStorage/.test(src), "the facade takes its seed from the browser's secure random source and keeps the history in localStorage"); }

/* ---------- 6. the sheets on paper ---------- */
const css = P.css();
ok(/#print-stage\{display:none\}/.test(css), "the print stage is hidden on screen");
ok(/@media print\{/.test(css), "the print rules are in an @media print block");
ok(/body\[data-print="soothe"\] > \*:not\(#print-stage\)\{display:none!important\}/.test(css), "while printing, everything but the print stage is hidden");
ok(/\.ps-sheet\{[^}]*width:8\.5in;height:11in;[^}]*padding:0\.5in 0\.5in 0\.5in 0\.65in/.test(css), "each sheet is 8.5 x 11 in, 0.65 in on the binding side and 0.5 in on the other three");
ok(/\.ps-sheet:last-child\{break-after:auto/.test(css) && /break-after:page/.test(css), "a page break between sheets and no blank page at the end");
ok(/print-color-adjust:exact/.test(css), "the print stage keeps its black exactly");
ok(P.SHEET.leftIn === 0.65 && P.SHEET.otherIn === 0.5 && P.SHEET.widthIn === 8.5 && P.SHEET.heightIn === 11, "the sheet measures 8.5 x 11 in with a 0.65 in binding gutter");
ok(Math.abs(P.SHEET.view[2] / P.SHEET.view[3] - 7.35 / 10) < 1e-6 && P.SHEET.view[0] === 46.8 && P.SHEET.view[1] === 36, "the drawing is cropped to 7.35 x 10 in, the area inside the margins");
{ const src = read("src/engine/ProceduralPacketEngine.js");
  ok(/@page\{size:" \+ SHEET\.widthIn \+ "in " \+ SHEET\.heightIn \+ "in;margin:0\}/.test(src), "the print window is told Letter, no margin of its own");
  ok(/root\.print\(\)/.test(src) && /afterprint/.test(src) && /removeChild\(l\.stage\)/.test(src), "the print window opens, and the stage is taken down afterward");
  ok(/document\.fonts|doc\.fonts/.test(src) && /Atkinson Hyperlegible/.test(src) && /3000/.test(src), "the print waits (up to 3 seconds) for the embedded print face");
  ok(/text-rendering:geometricPrecision/.test(src), "the print stage measures glyphs unhinted, so a bold label never runs into its sentence");
  ok(!/\.pdf["'?]/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), "the facade links to no static PDF"); }

/* ---------- 7. the dialog and the pages ---------- */
{ const src = read("src/engine/ProceduralPacketEngine.js");
  ok(/DIALOG_ID = "instant-soothe-modal"/.test(src), "the dialog is #instant-soothe-modal");
  ok(/Soothe Intensity \/ Cognitive Level/.test(src) && /Reminiscence Theme/.test(src), "the two pickers are named as asked");
  ok(P.STAGES.map(s => s.key + s.name).join("|") === "AMild / Early|BModerate / Mid|CAcute / Late", "picker 1: A mild / early, B moderate / mid, C acute / late");
  ok(P.THEMES.map(s => s.key + s.name).join("|") === "ACalming Nature & Gardens|BClassic Home & Heritage|CMusic, Crafts & Nostalgia|DRandom / Surprise Mix", "picker 2: A nature, B heritage, C music, D random");
  ok(/Generate & Print Instant Packet/.test(src), "the button reads Generate & Print Instant Packet");
  ok(/aria-labelledby/.test(src) && /type="radio"/.test(src) && /showModal/.test(src) && /preventScroll/.test(src), "the dialog is a real modal with radio groups, a label and a managed focus");
  ok(/is-focus/.test(src) && /outline:5px solid #ffbf00/.test(src), "a clear focus ring on every choice"); }
const index = read("index.html"), builder = read("builder.html"), sw = read("sw.js");
const ORDER = ["src/engine/ClinicalActivities.js", "src/engine/SoothingArt.js", "src/engine/SoothingContent.js", "src/engine/SoothingPacketEngine.js", "src/engine/ProceduralPacketEngine.js"];
[["index.html", index], ["builder.html", builder]].forEach(([n, h]) => {
  const at = f => h.indexOf('<script src="' + f + '">');
  ok(ORDER.every(f => at(f) >= 0), `${n}: the soothing engine is loaded`);
  ok(ORDER.every((f, i) => i === 0 || at(f) > at(ORDER[i - 1])), `${n}: the scripts load in order (activities, art, content, engine, facade)`);
  ok(at("src/pcg/prng.js") >= 0 && at("src/pcg/prng.js") < at("src/engine/SoothingPacketEngine.js"), `${n}: the seeded generator loads first`);
  ok(/ProceduralPacketEngine\.configure\(\{[\s\S]*?licence:\s*\{[\s\S]*?blocked:[\s\S]*?openGate:[\s\S]*?used:/.test(h), `${n}: the free-packet allowance and its gate are handed to the engine`);
  ok(!/href="[^"]*\.pdf"/.test(h), `${n}: no static PDF link`);
});
ORDER.slice(1).concat(["src/engine/ClinicalActivities.js"]).forEach(f => ok(sw.indexOf('"' + f + '"') >= 0, `the offline worker keeps ${f}`));
ok(/id="arbSootheSticky"/.test(index) && /id="arbSoothe"/.test(index), "index.html keeps both Instant Soothe / Print buttons");
ok(/sootheBtn\.addEventListener\("click", function\(\)\{\s*if \(window\.ProceduralPacketEngine\) window\.ProceduralPacketEngine\.instantSoothe\(\);/.test(index), "index.html: the button opens the dialog and does not print or leave the page");
ok(/stickySootheBtn\.addEventListener\("click", function\(\)\{ sootheBtn\.click\(\); \}\)/.test(index), "index.html: the yellow top-bar button goes through the same handler");
ok(/getActiveResidentContext\(\)[\s\S]{0,400}eraFromBirthYear\(c\.birthYear\)/.test(index), "index.html: the active resident's years and level reach the engine");
ok(/\$\("#panicButton"\)\.addEventListener\("click", \(\) => \{ if \(window\.ProceduralPacketEngine\) window\.ProceduralPacketEngine\.instantSoothe\(\)/.test(builder), "builder.html: the rapid de-escalation button opens the dialog");
ok(/emergencyResidentId === "general"\) \{ if \(window\.ProceduralPacketEngine\) window\.ProceduralPacketEngine\.instantSoothe\(\)/.test(builder), "builder.html?emergency=general opens the dialog");
ok(/id:"soothing-set"/.test(builder) && /SOOTHING_SET, ORIENTATION_BOARD/.test(builder) && /act\.freeze/.test(builder) && /recordSoothing\(items\)/.test(builder), "builder.html: the Instant Soothing Set is a packet activity, frozen when added, recorded when printed");
ok(/generateAilmentPDF\(currentAilment, pick\)/.test(index) && /P\.quickStep\(\{ title: A\.packetTitle/.test(index) && /function ailCalming\(/.test(index), "index.html: each ailment packet asks the two quick questions and adds a fresh calming page");
ok(/id="lpCalmBtn"/.test(builder) && /case "lpCalmBtn": calmingPage\(\)/.test(builder), "builder.html: the 12-month planner can print a calming page through the same engine");
{ const sources = [index, builder].map(h => (h.match(/<script(?![^>]*\ssrc)[^>]*>[\s\S]*?<\/script>/g) || []).join("\n"));
  ok(!/Instant Soothe[^\n]{0,80}window\.print\(\)/.test(sources.join("\n")), "no page prints straight from an Instant Soothe click"); }

/* ---------- report ---------- */
if (problems.length) { console.error(`soothing check FAILED: ${problems.length} problem(s) of ${passed + problems.length} checks`); problems.slice(0, 60).forEach(p => console.error(" - " + p)); process.exit(1); }
console.log(`soothing check passed: ${passed} checks (${C.PROMPTS.length} prompts, ${Art.MOTIFS.length} motifs, ${C.PUZZLES.length} puzzles, ${Art.PATHS.length} paths; ${packets} packets drawn)`);
