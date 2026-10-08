#!/usr/bin/env node
/* =====================================================================
   Checks for the clinical rulebook and the activity engine behind both packet tools
   (src/engine/ClinicalMatrix.js and src/engine/ClinicalActivities.js), and for the way
   index.html and builder.html use them.  Node built-ins only; nothing is fetched.

     1. the matrix: type floors, line floors, grid limits, the safe area and the page shell
     2. every activity, at every stage it is made for, over many names and days:
        it draws, it passes the matrix's own page check, it is the same page for the same
        name and day, a different page for another day, and nothing in it is undefined or
        talks down to an adult
     3. what each kind promises: word-search sizes and directions, hidden words that are
        really there, ladders that change one letter at a time, anagrams that unscramble,
        mazes that can be solved, paths that do not cross themselves
     4. the two engine files make no request, read no clock and draw no random number
     5. index.html and builder.html: script order, no network call, nothing unseeded in the
        packet code, every activity wired in, the offline cache holds the engine
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0; const problems = [];
const ok = (cond, msg) => { if (cond) passed++; else problems.push(msg); };
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---------- load the engine the way a page does ---------- */
const ctx = vm.createContext({ console, Date, Math, JSON, Object, Array, String, Number, RegExp, Map, Set, WeakMap, Error, Intl, parseInt, parseFloat, isFinite, isNaN });
ctx.globalThis = ctx; ctx.window = ctx;
["assets/pcg/pcg-data.bundle.js", "src/pcg/prng.js", "src/pcg/matrix.js", "src/pcg/grammar.js", "src/pcg/puzzles.js", "src/pcg/packet.js",
 "src/engine/ClinicalMatrix.js", "src/services/ColoringManifest.js", "assets/coloring/subjects.bundle.js", "src/engine/ColoringEngine.js", "src/engine/ClinicalActivities.js"]
  .forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
const CM = ctx.CognicopiaClinicalMatrix, CA = ctx.CognicopiaClinicalActivities;
ok(!!CM && !!CA, "the matrix and the activity engine load");
if (!CM || !CA) { console.error("clinical check FAILED: the engine did not load"); process.exit(1); }

const STAGES = ["early", "middle", "late"];
const FLOOR = { early: 14, middle: 18, late: 24 }, LINE = { early: 2.25, middle: 3, late: 4.5 };

/* ---------- 1. the matrix ---------- */
STAGES.forEach(st => {
  const S = CM.STAGES[st];
  ok(S.type.floor === FLOOR[st], `${st}: the type floor is ${FLOOR[st]} pt`);
  ok(S.stroke.min === LINE[st], `${st}: the line floor is ${LINE[st]} pt`);
  ok(S.type.bold === (st === "late"), `${st}: bold type ${st === "late" ? "is" : "is not"} required`);
  ["title", "instruction", "body", "label", "clue", "word"].forEach(k => ok(S.type[k] >= FLOOR[st], `${st}: the ${k} size is at least the floor`));
  ok(S.stroke.art >= S.stroke.min && S.stroke.rule >= S.stroke.min && S.stroke.motor >= S.stroke.min, `${st}: every stroke role is at least the floor`);
  ok(CM.floorFor(st) === FLOOR[st], `${st}: floorFor agrees`);
});
ok(Math.max.apply(null, CM.STAGES.middle.limits.wordsearch.sizes) <= 8, "the middle stage's word search is 8 square at most");
ok(CM.STAGES.early.limits.wordsearch.sizes.every(n => n === 12 || n === 15), "the early stage's word search is 12 or 15 square");
ok(CM.SAFE.edge >= 36 && CM.SAFE.left >= 54 && CM.SAFE.right >= 54, "the safe area is 0.5 in all round, with the 0.75 in binding side");
ok(CM.SHELL.header.y <= 54 && CM.SHELL.body.top >= 54 && CM.SHELL.body.bottom <= CM.SHELL.tip.y && CM.SHELL.tip.y < CM.SHELL.footer.ruleY && CM.SHELL.footer.y <= 792 - 36, "the page shell fits the paper without crossing the body");
ok(CM.SHELL.footer.rule >= 2.25 && CM.SHELL.header.rule >= 2.25, "the shell's rules are at least 2.25 pt");
ok(CM.allowed("early", "search-large") && !CM.allowed("middle", "search-large") && !CM.allowed("late", "search-large"), "the large word search is for the early stage only");
ok(CM.allowed("middle", "search-guided") && !CM.allowed("early", "search-guided"), "the guided word search starts at the middle stage");
ok(!CM.allowed("late", "word-search", "builder"), "the older builder word search is not offered at the late stage");
ok(CM.allowed("late", "maze-motor", "builder") && CM.allowed("late", "orientation", "builder") && CM.allowed("late", "silhouette", "builder"), "the late stage keeps the maze, the orientation sheet and the shape to look at");
["early", "middle", "late"].forEach(st => ok(CM.suggested(st, "builder").length > 0, `${st}: the builder has suggested activities`));

/* the dignity filter */
["Do you remember when you were a kid?", "Good girl, sweetie!", "Test your memory", "Which answer is wrong?"].forEach(t => ok(CM.dignity.lint(t).length > 0, `the dignity filter stops "${t}"`));
["Find the words in the grid.", "Put the steps in order.", "Circle the shape you like best."].forEach(t => ok(CM.dignity.lint(t).length === 0, `the dignity filter lets "${t}" through`));

/* the daily seed */
const r1 = CM.dailyRng("Margaret", "2026-10-06", 0, "x"), r2 = CM.dailyRng("Margaret", "2026-10-06", 0, "x"), r3 = CM.dailyRng("Margaret", "2026-10-07", 0, "x"), r4 = CM.dailyRng("Walter", "2026-10-06", 0, "x");
const draw = r => [r.next(), r.next(), r.next()].join(",");
const d1 = draw(r1);
ok(d1 === draw(r2), "the same name and day draw the same numbers");
ok(d1 !== draw(r3) && d1 !== draw(r4), "another day or another name draws other numbers");

/* ---------- 2 and 3. every activity ---------- */
const names = ["Margaret", "Walter", "Dorothy", "Harold", "Eleanor", "Frank", "Ruth", "Arthur"];
const DAYS = 14;
const BAD = /undefined|\bnull\b|\bNaN\b|\[object|Infinity|\{\{|\}\}|\bTODO\b/;
const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; };
const sig = p => hash(JSON.stringify([p.texts.map(t => t.text), p.items.map(i => i.d)]));
const segs = pts => pts.slice(1).map((p, i) => [pts[i], p]);
const cross = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
const oneLetter = (a, b) => a.length === b.length && [...a].filter((ch, i) => ch !== b[i]).length === 1;

const kinds = CA.kinds();
ok(kinds.length >= 13, "the engine has its activity kinds (" + kinds.length + ")");
const seen = {};
for (const k of kinds) for (const st of STAGES) {
  if (!CM.allowed(st, k.id)) continue;
  const tag = `${k.id}/${st}`, sigs = new Set(); seen[tag] = true;
  let diag = 0, made = 0;
  for (let i = 0; i < DAYS; i++) {
    const date = new Date(Date.UTC(2026, 0, 1 + i * 9)).toISOString().slice(0, 10), name = names[i % names.length];
    const r = CA.tryGenerate(k.id, { stage: st, name, date });
    if (!r.page) { ok(false, `${tag}: could not draw for ${name} on ${date}: ${r.error}`); continue; }
    made++;
    const p = r.page, bad = CM.validatePage(p);
    ok(bad.length === 0, `${tag}: ${name} ${date}: ${bad[0] || ""}`);
    const again = CA.generate(k.id, { stage: st, name, date });
    ok(JSON.stringify(again) === JSON.stringify(p), `${tag}: the same name and day make the same page`);
    sigs.add(sig(p));
    p.texts.forEach(t => {
      ok(!BAD.test(t.text), `${tag}: text "${t.text}" has a stray token`);
      ok(CM.dignity.lint(t.text).length === 0, `${tag}: "${t.text}" fails the dignity filter (${CM.dignity.lint(t.text).join(", ")})`);
      if (!CM.RESIDENT_ROLES || CM.RESIDENT_ROLES.indexOf(t.role) >= 0) {
        if (!(t.color === "#fff" || t.color === "#ffffff")) ok(t.size >= FLOOR[st] - 0.01, `${tag}: "${t.text}" is ${t.size} pt, under ${FLOOR[st]}`);
        if (st === "late") ok(t.bold, `${tag}: "${t.text}" is not bold at the late stage`);
      }
    });
    p.items.forEach(it => ok(it.fill === "none" || it.w >= LINE[st] - 0.01 || it.role === "fill" || it.role === "shell", `${tag}: a ${it.role} line is ${it.w} pt, under ${LINE[st]}`));
    const m = p.meta, key = m.key || {};
    /* what each kind promises */
    if (k.id === "search-large" || k.id === "search-guided") {
      const rows = key.rows, n = rows.length;
      ok(rows.every(row => row.length === n), `${tag}: the grid is square`);
      if (k.id === "search-large") ok(n === 12 || n === 15, `${tag}: the grid is ${n} square`);
      else ok(n <= 8, `${tag}: the guided grid is ${n} square (8 at most)`);
      key.placed.forEach(w => {
        let s = ""; for (let j = 0; j < w.word.length; j++) s += (rows[w.r + w.dy * j] || "")[w.c + w.dx * j] || "?";
        ok(s === w.word, `${tag}: ${w.word} is really in the grid`);
        if (k.id === "search-guided") ok(w.dx >= 0 && w.dy >= 0 && (w.dx === 0 || w.dy === 0) && (w.dx + w.dy) === 1, `${tag}: ${w.word} runs across or down only`);
        if (w.dx !== 0 && w.dy !== 0) diag++;
      });
      ok(new Set(key.placed.map(w => w.word)).size === key.placed.length, `${tag}: no word is hidden twice`);
    }
    if (k.id === "ladder") {
      const c = key.chain;
      ok(c.length >= 3 && new Set(c).size === c.length, `${tag}: the ladder has distinct rungs`);
      ok(c.slice(1).every((w, j) => oneLetter(c[j], w)), `${tag}: each rung changes one letter`);
    }
    if (k.id === "anagram") key.items.forEach(a => {
      const rest = a.tiles.length === a.word.length - 1 ? a.word.slice(1) : a.word;      // the middle stage gives the first letter
      ok([...a.tiles].sort().join("") === [...rest].sort().join("") && a.tiles !== a.word, `${tag}: ${a.tiles} unscrambles to ${a.word}`);
      ok(!!a.clue, `${tag}: ${a.word} has a clue`);
    });
    if (k.id === "sorting") {
      ok(key.groups.length === 2, `${tag}: two groups`);
      ok(key.rows.every(r => r.col === 0 || r.col === 1) && key.rows.some(r => r.col === 0) && key.rows.some(r => r.col === 1), `${tag}: items fall into both groups`);
    }
    if (k.id === "maze") {
      const s = key.solution;
      ok(s.length >= 2 && s[0][0] === 0 && s[0][1] === 0 && s[s.length - 1][0] === key.cols - 1 && s[s.length - 1][1] === key.rows - 1, `${tag}: the way runs corner to corner`);
      ok(s.slice(1).every((c, j) => Math.abs(c[0] - s[j][0]) + Math.abs(c[1] - s[j][1]) === 1), `${tag}: the way is a chain of neighbouring cells`);
      ok(new Set(s.map(c => c.join(","))).size === s.length, `${tag}: the way never crosses itself`);
    }
    if (k.id === "pathtrace") {
      const c = key.center, sg = segs(c); let hit = 0;
      for (let a = 0; a < sg.length && !hit; a++) for (let b = a + 3; b < sg.length; b++) if (cross(sg[a][0], sg[a][1], sg[b][0], sg[b][1])) { hit = 1; break; }
      ok(!hit, `${tag}: the path does not cross itself`);
    }
  }
  ok(made === DAYS, `${tag}: drew on all ${DAYS} test days`);
  ok(sigs.size >= Math.min(DAYS - 3, 8), `${tag}: ${sigs.size} different pages over ${DAYS} days`);
  if (k.id === "search-large") ok(diag > 0, `${tag}: some words run on a diagonal`);
  /* another version for the same day */
  const a0 = CA.generate(k.id, { stage: st, name: "Margaret", date: "2026-10-06", variant: 0 }), a1 = CA.generate(k.id, { stage: st, name: "Margaret", date: "2026-10-06", variant: 1 });
  ok(sig(a0) !== sig(a1) || k.id === "orientation", `${tag}: another version is a different page`);
}
["search-large/early", "search-guided/middle", "ladder/early", "anagram/early", "sorting/early", "oddone/early", "sequence/late", "choose-ending/late", "matching/late", "maze/late", "pathtrace/middle", "orientation/late", "silhouette/middle"]
  .forEach(t => ok(seen[t], `${t} is made`));
/* a kind that is not made for a stage says so instead of drawing */
ok(!CA.tryGenerate("search-large", { stage: "late", name: "Ann", date: "2026-10-06" }).page, "a page not made for a stage is refused");
ok(CA.tryGenerate("no-such-kind", { stage: "early" }).error.length > 0, "an unknown kind is refused with a reason");

/* the clinical tip and the shell, drawn on a page */
{
  const body = CA.generate("sequence", { stage: "middle", name: "Margaret", date: "2026-10-06" });
  const cue = CM.cue({ stage: "middle", activity: "sequence", name: "Margaret", rng: CM.dailyRng("Margaret", "2026-10-06", 0, "tip") });
  ok(cue && /^Clinical Tip:|^[A-Z][^:]{2,21}:/.test(cue.text) && CM.dignity.lint(cue.text).length === 0, "the clinical tip is a short labelled sentence that passes the dignity filter");
  const full = CA.withShell(body, { name: "Margaret", date: "2026-10-06", wing: "Maple Wing", page: 1, pages: 3, tip: cue.text });
  const txt = full.texts.map(t => t.text).join("\n");
  ok(/Margaret/.test(txt) && /October 6, 2026/.test(txt) && /Maple Wing/.test(txt), "the header names the resident, the date and the wing");
  ok(/Page 1 of 3/.test(txt), "the footer says \"Page 1 of 3\"");
  ok(full.texts.some(t => t.role === "cue" && t.size >= 10), "the page carries a clinical tip, 10 pt or more");
  ok(CM.validatePage(full).length === 0, "a page with its shell passes the page check");
}

/* ---------- 4. the engine files are quiet ---------- */
["src/engine/ClinicalMatrix.js", "src/engine/ClinicalActivities.js"].forEach(f => {
  const s = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  [["a network request", /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|\bimport\s*\(/], ["an unseeded random number", /Math\.random/], ["the clock", /Date\.now|new Date\(\s*\)|performance\.now/],
   ["storage", /localStorage|sessionStorage|indexedDB|document\.cookie/]].forEach(([what, re]) => ok(!re.test(s), `${f} uses ${what}`));
});

/* ---------- 5. the pages that use the engine ---------- */
const index = read("index.html"), builder = read("builder.html"), profile = read("profile.html"), sw = read("sw.js");
const scripts = h => [...h.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
[["index.html", index], ["builder.html", builder]].forEach(([n, h]) => {
  const s = scripts(h), at = f => s.indexOf(f);
  ok(at("src/engine/ClinicalMatrix.js") > at("src/pcg/prng.js") && at("src/pcg/prng.js") >= 0, `${n}: the matrix loads after the seeded generator`);
  ok(at("src/engine/ClinicalActivities.js") > at("src/engine/ClinicalMatrix.js") && at("src/engine/ClinicalActivities.js") > at("src/engine/ColoringEngine.js"), `${n}: the activities load after the matrix and the coloring engine`);
});
[["index.html", index], ["builder.html", builder], ["profile.html", profile]].forEach(([n, h]) => {
  const own = h.split("\n").filter(l => l.length < 600).join("\n");                    // the embedded PDF library is one long minified line and is never asked to fetch
  ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|new WebSocket|new EventSource/.test(own), `${n} makes no network request`);
  ok(!/<script[^>]+src="https?:/.test(h) && !/<link[^>]+href="https?:\/\/[^"]+\.css/.test(h) && !/@import\s+url\(\s*['"]?https?:/.test(h), `${n} loads nothing from another site`);
});
["src/engine/ClinicalMatrix.js", "src/engine/ClinicalActivities.js", "src/pcg/prng.js", "assets/pcg/pcg-data.bundle.js", "src/engine/ColoringEngine.js"].forEach(f => ok(sw.indexOf('"' + f + '"') >= 0, `the offline cache holds ${f}`));
ok(/PACKET_RNG/.test(index) && /seedPacket/.test(index) && /dailyVariant/.test(index), "index.html seeds the packet from the name and the day");
{ // the packet's own code draws only from the seeded stream; what is left is the screen (confetti, the trainer's praise) and unique ids
  const lines = index.split("\n").filter(l => l.length < 600 && /Math\.random/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
  const allowed = [/const prand=/, /function newId\(\)/, /sessionId:Date\.now/, /document\.createElement\("span"\), a = Math\.random/, /left\[Math\.floor\(Math\.random/, /PRAISE\[Math\.floor\(Math\.random/];
  const stray = lines.filter(l => !allowed.some(re => re.test(l)));
  ok(stray.length === 0, `index.html draws unseeded random numbers in: ${stray.map(l => l.trim().slice(0, 70)).join(" | ")}`);
}
ok(!/Math\.random/.test(builder.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")) || (builder.match(/Math\.random/g) || []).length <= 3, "builder.html draws almost nothing unseeded");
/* every engine kind is a button in the builder, and every activity in the matrix is in the builder or the packet tool */
kinds.forEach(k => { if (CM.entry("builder", k.id)) ok(new RegExp("[\"']" + k.id + "[\"']").test(builder), `builder.html offers ${k.id}`); });
ok(/Page \d+ of|numberSheets/.test(builder) && /enforceStrokeFloor/.test(builder) && /fitHtml/.test(builder), "builder.html numbers its sheets, floors its lines and fits its pages");
{ // the word searches the quick packet and the monthly bundle make are held to the matrix's grid sizes
  const m = /var WS_LEVELS = \{([\s\S]*?)\};/.exec(index), sz = {};
  if (m) [...m[1].matchAll(/(early|middle|late):\s*\{\s*size:(\d+)/g)].forEach(x => { sz[x[1]] = +x[2]; });
  ok(m && CM.STAGES.early.limits.wordsearch.sizes.indexOf(sz.early) >= 0 && sz.middle <= Math.max.apply(null, CM.STAGES.middle.limits.wordsearch.sizes) && sz.late <= Math.max.apply(null, CM.STAGES.late.limits.wordsearch.sizes), "index.html's word search sizes follow the matrix (" + JSON.stringify(sz) + ")");
  ok(/AIL_PAGE = \{ W: 612, H: 706,/.test(index), "the ailment packets end their pages above the clinical tip");
  ok(/COACHING_REMINDER/.test(index) && /coachingFooter\(\)/.test(index), "a page with no tip of its own carries the coaching reminder");
}
ok(/safePage/.test(index), "index.html draws each page inside an error boundary");
ok(/This page is not ready/.test(builder), "builder.html has a stand-in for a page that cannot be made");

console.log(problems.length ? `clinical check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 60).join("\n  - ") + (problems.length > 60 ? `\n  ... and ${problems.length - 60} more` : "") : `clinical check passed: ${passed} checks (${kinds.length} activity kinds, ${Object.keys(seen).length} kind/stage pairs, ${DAYS} days each)`);
process.exit(problems.length ? 1 : 0);
