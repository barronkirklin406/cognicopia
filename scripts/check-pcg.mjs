#!/usr/bin/env node
/* =====================================================================
   Procedural content engine check.  Run: node scripts/check-pcg.mjs
   (part of npm test and npm run build)

   The engine (src/pcg/*.js) and its content bundle are loaded the way a
   page loads them, in a sandbox with no fetch, no XMLHttpRequest and a
   Math.random that throws, so every check here also proves the engine
   makes every choice from its seed and uses no network. Checked:
     1. the content bundle is current, and the engine's files hold no
        network call, no Math.random, no clock other than the date asked for;
     2. the seeded generator: known answers that must never change, the
        rotation (no repeat within a cycle, never the same two days running),
        the daily seed (names, dates, time zones, versions);
     3. reading a profile: topics from typed words, plurals, misspellings,
        decades named outright, the avoid list;
     4. for ten residents at their stages over many days: the layout is
        the same every day, the same resident gets byte-identical packets
        however often and however they ask, and every packet obeys its
        stage's clinical rules (grid size and directions, completions with a
        word box, sensory cards of ten words or fewer);
     5. freshness: the next day's featured items and puzzle words are all
        different, a pool is never repeated within its cycle;
     6. one step away and no further, cross-pollination (a 1950s Ford
        pickup reaches a farmer), eras, and the avoid list on every word;
     7. dignity: no sentence breaks a rule in safety.json, over thousands of
        packets;
     8. the word searches are solvable, show only the words on the list,
        hold nothing on the blocklist; the crosswords are sound;
     9. the caregiver prompts name a page and an item that is on that page;
    10. mandalas obey the coloring rules at every stage, and the late stage
        has no area to color smaller than a tenth of a square inch;
    11. at least a million different packets per resident, and fast;
    12. the packet tool loads the files in order, offline, and shows the
        daily packet.
   Node built-ins only. Exits non-zero on any failure.
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { createBitmap, paint, strokeStats, measure } from "./lib/raster.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };
const t0 = Date.now();
let tl = t0; const lap = name => { if (process.env.PCG_TIMING){ console.log(`  ${String(Date.now() - tl).padStart(6)} ms  ${name}`); tl = Date.now(); } };

const FILES = ["src/pcg/prng.js", "src/pcg/matrix.js", "src/pcg/grammar.js", "src/pcg/puzzles.js", "src/pcg/packet.js"];

/* ---------- 1. the files themselves ---------- */
try { execFileSync(process.execPath, [path.join(ROOT, "scripts/build_pcg.mjs"), "--check"], { encoding: "utf8" }); ok(true, ""); }
catch (e){ ok(false, "the content bundle is not current: " + ((e.stdout || "") + (e.stderr || "")).trim().split("\n")[0]); }
for (const f of FILES){
  const src = read(f);
  for (const [what, re] of Object.entries({ "Math.random": /Math\.random/, "fetch": /\bfetch\s*\(/, "XMLHttpRequest": /XMLHttpRequest/, "sendBeacon": /sendBeacon/, "WebSocket": /WebSocket/, "Date.now": /Date\.now/, "storage": /localStorage|sessionStorage|indexedDB/ }))
    ok(!re.test(src), `${f} uses ${what}`);
}

/* ---------- the engine, in a sandbox ---------- */
function sandbox(){
  const ctx = vm.createContext({ console });
  vm.runInContext("Math.random = function(){ throw new Error('Math.random was called'); };", ctx);
  ["assets/pcg/pcg-data.bundle.js", ...FILES, "src/engine/ColoringEngine.js"].forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
  return ctx;
}
const ctx = sandbox();
const PCG = ctx.CognicopiaPCG, P = PCG.prng, Mx = PCG.matrix, G = PCG.grammar, Z = PCG.puzzles, E = ctx.CognicopiaColoringEngine, DATA = ctx.CognicopiaPCGData;
const gen = (raw, o) => PCG.generate(raw, o);
const day0 = P.dateParts("2026-10-06");
const dayAt = n => P.addDays(day0, n);

/* ---------- 2. the generator ---------- */
{
  ok(JSON.stringify(P.cyrb128("cognicopia")) === "[4035756780,3172174344,3393295916,3017461536]", "cyrb128 changed: every saved seed would move");
  const r = P.create("walter|2026-10-06"), a = [r.next(), r.next(), r.next()].map(x => x.toFixed(10)).join(" ");
  ok(a === "0.1743279481 0.7709941661 0.3393957647", "sfc32 stream changed: " + a);
  ok([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => P.rotationIndex("walter|F", 7, 20000 + d)).join(",") === "0,2,4,6,1,3,2,6,3,0", "rotation changed");
  ok(P.dateParts("2026-10-06").day === 20732 && P.dateParts("1970-01-01").day === 0 && P.fromDay(20000).iso === "2024-10-04", "day numbers are wrong");
  const s1 = P.create("a"), s2 = P.create("a"), s3 = P.create("b");
  ok(Array.from({ length: 50 }, () => s1.next()).join() === Array.from({ length: 50 }, () => s2.next()).join(), "the same seed gives different streams");
  ok(P.create("a").next() !== s3.next(), "different seeds give the same number");
  ok(P.create("a").fork("x").next() === P.create("a").fork("x").next() && P.create("a").fork("x").next() !== P.create("a").fork("y").next(), "forks are not independent");
  let sum = 0; const u = P.create("mean"); for (let i = 0; i < 20000; i++) sum += u.next();
  ok(Math.abs(sum / 20000 - 0.5) < 0.01, "the stream is not uniform: " + sum / 20000);
  const sh = P.create("shuffle").shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
  ok(sh.slice().sort().join() === "1,2,3,4,5,6,7,8", "a shuffle lost an item");
  for (const n of [2, 3, 4, 5, 7, 10, 23, 48, 90]){
    const start = n * 900, seq = Array.from({ length: n * 60 }, (_, d) => P.rotationIndex("res|slot", n, start + d));
    ok(seq.every((x, i) => i === 0 || x !== seq[i - 1]), `rotation of ${n}: the same item two days running`);
    let blocks = true; for (let c = 0; c < 60; c++) if (new Set(seq.slice(c * n, c * n + n)).size !== n) blocks = false;
    ok(blocks, `rotation of ${n}: a cycle does not use every item exactly once`);
    const last = {}, need = n >= 3 ? Math.floor(n / 4) + 1 : 2; let gap = 1e9;
    seq.forEach((x, i) => { if (last[x] !== undefined) gap = Math.min(gap, i - last[x]); last[x] = i; });
    ok(gap >= need, `rotation of ${n}: an item came back after ${gap} days (needs ${need})`);
  }
  ok(P.rotationIndex("x", 1, 5) === 0 && P.rotationWindow("w", 10, 4, 77).length === 4 && new Set(P.rotationWindow("w", 10, 4, 77)).size === 4, "rotationWindow is wrong");
  /* the daily seed */
  ok(P.dailySeed("  WÄLTER ", "2026-10-06", 0) === "walter|2026-10-06" && P.dailySeed("walter", new Date(2026, 9, 6, 3), 2) === "walter|2026-10-06|v2", "the daily seed is not name|date|version");
  ok(P.dailySeed("José", "2026-10-06") === P.dailySeed("jose", "2026-10-06") && P.nameKey("") === "friend", "names are not folded");
  ok(P.dateParts(new Date(2026, 9, 6, 0, 0, 1)).iso === P.dateParts(new Date(2026, 9, 6, 23, 59, 59)).iso, "a day changes during the day");
  for (const bad of ["2026-02-30", "2026-13-01", "tomorrow"]){ let threw = false; try { P.dateParts(bad); } catch (e){ threw = true; } ok(threw, `${bad} was accepted as a date`); }
  ok(P.dateParts("2028-02-29").iso === "2028-02-29" && P.addDays(P.dateParts("2026-12-31"), 1).iso === "2027-01-01" && P.addDays(P.dateParts("2026-03-01"), -1).iso === "2026-02-28", "calendar arithmetic is wrong");
  /* the same local date, wherever the computer is */
  const child = `const fs=require("fs"),vm=require("vm"),c=vm.createContext({console});` +
    `["assets/pcg/pcg-data.bundle.js",${FILES.map(f => JSON.stringify(f)).join(",")}].forEach(f=>vm.runInContext(fs.readFileSync(${JSON.stringify(ROOT + "/")}+f,"utf8"),c));` +
    `const p=c.CognicopiaPCG.generate({first:"Walter",born:1941,job:"dairy farmer",stage:"early"},{date:new Date(2026,9,6,23,30)});console.log(p.seed+"|"+JSON.stringify(p.pages));`;
  const outs = ["UTC", "America/Los_Angeles", "Pacific/Auckland", "Asia/Kolkata"].map(tz => execFileSync(process.execPath, ["-e", child], { env: { ...process.env, TZ: tz }, encoding: "utf8", maxBuffer: 1 << 24 }));
  ok(outs.every(o => o === outs[0]) && outs[0].startsWith("walter|2026-10-06|"), "the packet depends on the time zone");
}

lap('engine setup + generator');
/* ---------- the residents ---------- */
const PROFILES = {
  farmer:    { first: "Walter", born: 1941, job: "dairy farmer", hobbies: "fishing, gardening", pets: "Rusty (dog)", town: "Fargo", pronoun: "he", stages: ["early", "middle", "late"] },
  teacher:   { first: "Ruth", born: 1938, job: "schoolteacher", hobbies: "knitting, reading", pronoun: "she", stages: ["early", "middle"] },
  dogs:      { first: "Bea", born: 1945, favs: "dogs, long walks", pets: "Rusty (dog)", pronoun: "she", stages: ["early", "late"] },
  mechanic:  { first: "Al", born: 1936, job: "auto mechanic", hobbies: "fishing", firstcar: "Ford pickup", pronoun: "he", stages: ["early", "middle"] },
  homemaker: { first: "Dorothy", born: 1930, job: "homemaker", hobbies: "baking, sewing, church choir", pronoun: "she", stages: ["middle", "late"] },
  sparse:    { first: "June", born: 1936, pronoun: "she", stages: ["early", "middle", "late"] },
  typo:      { first: "Marguerite", born: 1933, hobbies: "gardning, bakeing", pronoun: "she", stages: ["early"] },
  musician:  { first: "José", born: 1948, hobbies: "piano, dancing, 1950s music", kids: "Ana, Luis", pronoun: "he", stages: ["early", "middle"] },
  nurse:     { first: "Pat", born: 1942, job: "nurse", favs: "the fifties, bingo", pronoun: "they", stages: ["middle", "late"] },
  office:    { first: "Helen", born: 1939, job: "secretary", hobbies: "reading, jigsaw puzzles", firstjob: "typist", pronoun: "she", stages: ["early", "late"] }
};
const forEachResident = fn => { for (const [k, p] of Object.entries(PROFILES)) for (const stage of p.stages) fn(k, { ...p, stage }, stage); };

lap('residents');
/* ---------- 3. reading a profile ---------- */
{
  const topics = raw => Mx.readProfile(raw).ownTopics.map(o => o.id);
  const farm = topics({ first: "W", born: 1941, job: "dairy farmer", hobbies: "fishing, gardening" });
  ok(["farming", "farm-animals", "fishing", "gardening"].every(t => farm.includes(t)), "a farmer's topics: " + farm.join());
  ok(topics({ first: "x", hobbies: "tractors" }).includes("farming"), "a plural does not match");
  ok(topics({ first: "x", hobbies: "gardning" }).includes("gardening") && topics({ first: "x", hobbies: "bakeing" }).includes("cooking"), "a misspelling does not match");
  ok(topics({ first: "x", favs: "model t" }).includes("cars"), "a phrase does not match");
  ok(topics({ first: "x", job: "retired" }).length > 0 && Mx.readProfile({ first: "x" }).generic === true, "a sparse profile has no everyday topics to fall back on");
  const fif = Mx.readProfile({ first: "x", favs: "the fifties" });
  ok(fif.era.weights["1950s"] === 1, "a decade named outright is not read");
  ok(Mx.readProfile({ first: "x", born: 1941 }).era.weights["1950s"] > 0.9 && Mx.readProfile({ first: "x", born: 1941 }).era.weights["1920s"] === 0, "the teens and twenties are not weighted");
  const av = Mx.readProfile({ first: "x", born: 1941, job: "farmer", hobbies: "dogs, fishing", avoid: "fishing, the war" });
  ok(!av.ownTopics.some(o => o.id === "fishing") && av.avoid.tokens.has("war"), "the avoid list is not applied to the profile");
  ok(Mx.readProfile({ first: "Rusty's friend", pets: "Rusty (dog)", town: "Rapid City" }).anchors.join() === "RUSTY,RAPIDCITY", "personal words: " + Mx.readProfile({ first: "x", pets: "Rusty (dog)", town: "Rapid City" }).anchors.join());
}

lap('profile reading');
/* ---------- 4. every packet, every stage ---------- */
const RULES = {
  early:  { maxLen: 11, size: 15, dirs: [[1, 0], [0, 1], [1, 1], [1, -1]], minWords: 11, style: "open", puzzle: "crossword", maxCw: 13, minCw: 5 },
  middle: { maxLen: 7, size: 8, dirs: [[1, 0], [0, 1]], minWords: 5, style: "complete", puzzle: "crossword", maxCw: 8, minCw: 4 },
  late:   { maxLen: 6, size: 6, dirs: [[1, 0]], minWords: 3, style: "sense", puzzle: "look", maxCw: 0, minCw: 0 }
};
const manifestIds = new Set(JSON.parse(read("assets/coloring/manifest.json")).assets.map(a => a.id));
const BLOCK = DATA.safety.blocklist;
const leaves = pk => {
  const out = [];
  const add = s => { if (typeof s === "string" && s) out.push(s); };
  pk.pages.forEach(p => {
    add(p.title); add(p.instruction); add(p.note); add(p.bankLabel); add(p.directions);
    (p.items || []).forEach(x => { add(x.text); add(x.follow); add(x.lead); add(x.answer); });
    (p.bank || []).forEach(add); (p.cards || []).forEach(c => { add(c.text); add(c.label); });
    if (p.look){ add(p.look.label); (p.look.lines || []).forEach(add); }
    if (p.crossword) p.crossword.entries.forEach(e => { add(e.clue); });
    (p.prompts || []).forEach(x => add(x.text)); (p.why || []).forEach(w => add(w.why));
    if (p.answers){ Object.values(p.answers).forEach(l => l.forEach(add)); }
  });
  pk.why.forEach(w => add(w.why));
  return out;
};
const stats = { diag: 0, packets: 0, subjects: 0, mandalas: 0, facts: 0, strings: 0, lintFail: 0, cards: 0, prompts: 0, minPrompts: 99 };
const lintFailures = [];
function checkPacket(pk, tag){
  const R = RULES[pk.stage], pg = pk.pages;
  stats.packets++;
  /* the layout is an anchor */
  ok(pg.map(p => p.type).join() === "wordsearch,talk,puzzle,coloring,staff" && pg.every((p, i) => p.n === i + 1), `${tag}: the layout moved`);
  ok(pg[0].title === "Word Search" && pg[3].title === "Color Page" && pg[4].title === "For Staff: Today's Packet", `${tag}: a page title changed`);
  /* page 1 */
  const ws = pg[0], inDirs = (p, dirs) => dirs.some(d => d[0] === p.dx && d[1] === p.dy);
  ok(ws.size === R.size && ws.rows.length === R.size && ws.rows.every(r => /^[A-Z]+$/.test(r) && r.length === R.size), `${tag}: the grid is not ${R.size} x ${R.size} capital letters`);
  ok(ws.placed.length >= R.minWords && ws.placed.length === ws.list.length, `${tag}: only ${ws.placed.length} words placed`);
  ok(ws.placed.every(p => inDirs(p, R.dirs)), `${tag}: a word goes a way this stage does not allow`);
  if (ws.placed.some(p => p.dx !== 0 && p.dy !== 0)) stats.diag++;
  const mine = new Set();
  ws.placed.forEach(p => { for (let i = 0; i < p.word.length; i++) mine.add((p.r + p.dy * i) + "," + (p.c + p.dx * i)); });
  for (const p of ws.placed){
    ok(Z.findWord(ws.rows, p.word, R.dirs).length === 1, `${tag}: ${p.word} is not found exactly once`);
    const cellSets = new Set(Z.findWord(ws.rows, p.word, Z.EIGHT).map(f => { const k = []; for (let i = 0; i < p.word.length; i++) k.push((f.r + f.dy * i) * 100 + (f.c + f.dx * i)); return k.sort((x, y) => x - y).join(); }));
    ok(cellSets.size === 1, `${tag}: ${p.word} reads somewhere else too`);
    ok(ws.list.includes(p.word), `${tag}: ${p.word} is not on the list`);
    ok(ws.words.some(w => w.word === p.word), `${tag}: ${p.word} has no source`);
  }
  for (const b of BLOCK) for (const f of Z.findWord(ws.rows, b, Z.EIGHT)){
    const cells = []; for (let i = 0; i < b.length; i++) cells.push((f.r + f.dy * i) + "," + (f.c + f.dx * i));
    ok(cells.every(c => mine.has(c)), `${tag}: the filler spells ${b}`);
  }
  /* no letter three times running in the filler: it reads as a printing error */
  for (let r = 0; r < ws.size; r++) for (let c = 0; c < ws.size; c++) for (const [dx, dy] of Z.EIGHT.slice(0, 4)){
    const cs = [0, 1, 2].map(k => [r + dy * k, c + dx * k]);
    if (cs.some(([y, x]) => y < 0 || y >= ws.size || x < 0 || x >= ws.size)) continue;
    const l = cs.map(([y, x]) => ws.rows[y][x]);
    if (l[0] === l[1] && l[1] === l[2]) ok(cs.every(([y, x]) => mine.has(y + "," + x)), `${tag}: ${l[0]}${l[1]}${l[2]} in the filler`);
  }
  /* a name is an anchor when it fits the grid; one that cannot (two letters, or longer than the stage's grid) is never cut short */
  const nm = P.fold(pk.resident.first).split(" ")[0].toUpperCase(), fits = /^[A-Z]{3,}$/.test(nm) && nm.length <= R.maxLen;
  ok(ws.words.some(w => w.src === "name") === fits, `${tag}: the name ${nm} ${fits ? "should be" : "should not be"} in the word search`);
  if (!fits) ok(!pk.prompts.some(p => p.template === "cg-hook-name"), `${tag}: a prompt points to a name that is not in the grid`);
  /* page 2 */
  const t = pg[1];
  ok(t.style === R.style, `${tag}: page 2 is ${t.style}`);
  if (pk.stage === "early"){
    ok(t.items.length >= 4 && t.items.every(x => x.text && x.refs.length), `${tag}: too few open questions`);
    if (t.items.some(x => x.kind === "fact")) stats.facts++;
    ok(t.items.every(x => x.kind === "fact" || /[?.]$/.test(x.text)), `${tag}: a question has no end`);
  } else if (pk.stage === "middle"){
    ok(t.items.length === 5 && t.bank.length === 5 && new Set(t.bank).size === 5, `${tag}: five completions and a box of five words`);
    ok(t.items.every(c => t.bank.includes(c.answer) && c.lead && !c.lead.toLowerCase().split(/\W+/).includes(c.answer)), `${tag}: a completion's word is not in the box`);
  } else {
    ok(t.cards.length >= 3, `${tag}: ${t.cards.length} sensory cards`);
    t.cards.forEach(c => { stats.cards++; ok(G.wordCount(c.text) <= 10 && c.text && c.label, `${tag}: a card has ${G.wordCount(c.text)} words: ${c.text}`); });
  }
  /* page 3 */
  const p3 = pg[2];
  ok(p3.style === R.puzzle, `${tag}: page 3 is ${p3.style}`);
  if (p3.style === "crossword"){
    const cw = p3.crossword;
    ok(cw.rows <= R.maxCw && cw.cols <= R.maxCw, `${tag}: the crossword is ${cw.rows} x ${cw.cols}`);
    ok(cw.entries.length >= R.minCw, `${tag}: only ${cw.entries.length} crossword words`);
    ok(Z.checkCrossword(cw).length === 0, `${tag}: crossword: ${Z.checkCrossword(cw).join("; ")}`);
    ok(cw.crossings >= cw.entries.length - 1, `${tag}: the crossword is not connected`);
    ok(p3.bank.length === cw.entries.length && cw.entries.every(e => e.clue && p3.bank.includes(e.word)), `${tag}: the box of words does not match`);
    ok(p3.firstLetters === (pk.stage === "middle"), `${tag}: first letters are wrong for the stage`);
  } else ok(p3.look && p3.look.lines.length >= 1 && p3.look.lines.every(l => G.wordCount(l) <= 10), `${tag}: the look page`);
  /* page 4 */
  const p4 = pg[3];
  ok(pk.stage !== "late" || p4.style === "mandala", `${tag}: the late stage color page is not a mandala`);
  if (p4.style === "subject"){ stats.subjects++; ok(manifestIds.has(p4.subject) && pk.refs[4].includes(p4.ref), `${tag}: the picture is not a real subject`); }
  else { stats.mandalas++; ok(E.validate(E.composeMandala({ stage: pk.stage, seed: p4.seed, frame: { x: 61, y: 190, w: 490, h: 500 } })).length === 0, `${tag}: the mandala breaks a coloring rule`); }
  /* page 5 and the prompts */
  const st = pg[4];
  ok(st.prompts.length === pk.prompts.length && st.prompts.length >= 5, `${tag}: ${st.prompts.length} action prompts`);
  stats.minPrompts = Math.min(stats.minPrompts, pk.prompts.length); stats.prompts += pk.prompts.length;
  for (const pr of pk.prompts){
    ok(pr.text.length <= 260 && /[.?]$/.test(pr.text), `${tag}: a prompt is badly formed: ${pr.text}`);
    if (pr.page) ok(pr.text.includes("Page " + pr.page), `${tag}: the prompt does not name its page ${pr.page}: ${pr.text}`);
    else ok(!/\bPage \d\b/.test(pr.text), `${tag}: a prompt names a page but has none: ${pr.text}`);
    if (pr.ref){
      const it = DATA.items.find(i => i.id === pr.ref);
      ok(pk.refs[pr.page] && pk.refs[pr.page].includes(pr.ref), `${tag}: the prompt sends staff to ${pr.ref} on page ${pr.page}, which is not there`);
      ok(it && pr.text.toLowerCase().includes(it.name.toLowerCase()), `${tag}: the prompt does not name ${pr.ref}: ${pr.text}`);
    }
    ok(!/\{|\}|undefined|null|NaN/.test(pr.text), `${tag}: an unfilled slot: ${pr.text}`);
  }
  ok(new Set(pk.prompts.map(p => p.role)).size === pk.prompts.length, `${tag}: two prompts have the same role`);
  /* every word printed is clean, and nothing is left unfilled */
  for (const s of leaves(pk)){
    stats.strings++;
    const bad = G.lint(s, DATA);
    if (bad){ stats.lintFail++; if (lintFailures.length < 8) lintFailures.push(`${tag}: "${s}" breaks ${bad}`); }
    if (/\{|\}|undefined|\bnull\b|NaN/.test(s)) ok(false, `${tag}: an unfilled slot in "${s}"`);
  }
  ok(!/\b(remember|recall|quiz|wrong|test your)\b/i.test(leaves(pk).join(" ")), `${tag}: memory or test language`);
  ok(pk.stats.permutations.log10 > 0 && pk.theme === pk.focus.feature.name, `${tag}: the theme is not the featured item`);
}

const DAYS = 10, cache = {};
forEachResident((k, raw, stage) => {
  for (let d = 0; d < DAYS; d++){
    const pk = gen(raw, { date: dayAt(d * 3) }); cache[`${k}|${stage}|${d}`] = pk;
    checkPacket(pk, `${k} ${stage} day ${d}`);
  }
});
ok(stats.diag > 20, `diagonal words appear in only ${stats.diag} early packets`);
ok(stats.facts > 10, `"Did you know" appears in only ${stats.facts} early packets`);
ok(stats.subjects > 20 && stats.mandalas > 20, `coloring pages: ${stats.subjects} pictures, ${stats.mandalas} mandalas`);
ok(stats.lintFail === 0, `${stats.lintFail} of ${stats.strings} generated sentences break a dignity rule: ${lintFailures.join(" | ")}`);
ok(stats.minPrompts >= 5, `a packet had only ${stats.minPrompts} action prompts`);

lap('every packet');
/* ---------- the same packet, however it is asked for ---------- */
forEachResident((k, raw, stage) => {
  const a = JSON.stringify(gen(raw, { date: "2026-10-06" }));
  gen({ first: "Someone Else", born: 1930, job: "baker", stage: "late" }, { date: "2026-10-06" });
  ok(a === JSON.stringify(gen(raw, { date: "2026-10-06" })), `${k} ${stage}: asking twice (with another packet between) gives a different packet`);
  ok(a === JSON.stringify(gen(raw, { date: new Date(2026, 9, 6, 8, 0) })) && a === JSON.stringify(gen(raw, { date: new Date(2026, 9, 6, 14, 5) })), `${k} ${stage}: 8 AM and 2 PM differ`);
  ok(a === JSON.stringify(gen(raw, { date: { y: 2026, m: 10, d: 6 }, variant: 0 })), `${k} ${stage}: a date written another way differs`);
  ok(a !== JSON.stringify(gen(raw, { date: "2026-10-07" })), `${k} ${stage}: tomorrow is today`);
});
{
  const w = PROFILES.farmer, resident = first => JSON.stringify(gen({ ...w, first, stage: "early" }, { date: "2026-10-06" }).pages.slice(0, 4)), base = resident("Walter");
  ok(base === resident(" WALTER ") && base === resident("Wälter"), "capitals, spaces and accents in the name change the packet");
  ok(base !== resident("Walt"), "two residents get the same packet");
  const v0 = gen({ ...w, stage: "early" }, { date: "2026-10-06" }), v1 = gen({ ...w, stage: "early" }, { date: "2026-10-06", variant: 1 }), v1b = gen({ ...w, stage: "early" }, { date: "2026-10-06", variant: 1 });
  const ids = p => [p.focus.feature.id, p.focus.companion.id, p.focus.surprise.id];
  ok(JSON.stringify(v1) === JSON.stringify(v1b), "a second version of the day is not stable");
  ok(ids(v0).every(id => !ids(v1).includes(id)), "a second version repeats an item from the first");
  ok(v1.seed === "walter|2026-10-06|v1" && v1.variant === 1, "the second version has the wrong seed");
  checkPacket(v1, "variant 1");
  const fs2 = new Set([0, 1, 2, 3, 4, 5].map(v => gen({ ...w, stage: "early" }, { date: "2026-10-06", variant: v }).focus.feature.id));
  ok(fs2.size >= 5, "versions of one day keep featuring the same thing");
}

lap('same packet however asked');
/* ---------- 5. freshness ---------- */
const wordsOfDay = pk => new Set(pk.pages[0].words.filter(w => w.src !== "name" && w.src !== "personal").map(w => w.word));
forEachResident((k, raw, stage) => {
  if (stage !== PROFILES[k].stages[0] && k !== "farmer") return;
  const pr = Mx.readProfile(raw), healthy = !pr.health.thin;
  const seqs = [["2026-12-18", 30], ["2026-02-24", 12]];   // across New Year, and across the end of February
  for (const [from, n] of seqs){
    const start = P.dateParts(from), packs = [];
    for (let d = 0; d < n; d++) packs.push(gen(raw, { date: P.addDays(start, d) }));
    for (let d = 1; d < n; d++){
      const a = packs[d - 1], b = packs[d];
      const ia = [a.focus.feature.id, a.focus.companion.id, a.focus.surprise.id], ib = [b.focus.feature.id, b.focus.companion.id, b.focus.surprise.id];
      ok(ia[0] !== ib[0], `${k} ${stage} ${b.date.iso}: the same featured item two days running`);
      if (healthy) ok(ib.every(id => !ia.includes(id)), `${k} ${stage} ${b.date.iso}: today shares an item with yesterday (${ia} / ${ib})`);
      if (healthy){
        const wa = wordsOfDay(a), shared = [...wordsOfDay(b)].filter(w => wa.has(w));
        ok(shared.length === 0, `${k} ${stage} ${b.date.iso}: a puzzle word repeats from yesterday: ${shared}`);
        const key = x => x.text || (x.lead + " ... " + x.answer), ta = new Set((a.pages[1].items || a.pages[1].cards).map(key)), tb = (b.pages[1].items || b.pages[1].cards).map(key);
        ok(tb.every(x => !ta.has(x)), `${k} ${stage} ${b.date.iso}: a sentence repeats from yesterday`);
      }
    }
    /* a featured item is not used again for at least a quarter of its pool's cycle */
    const n0 = pr.slots.F.length, need = Math.floor(n0 / 4) + 1;
    if (healthy && n0 >= 3){
      const last = {}; let gap = 1e9;
      packs.forEach((p, i) => { const id = p.focus.feature.id; if (last[id] !== undefined) gap = Math.min(gap, i - last[id]); last[id] = i; });
      ok(gap >= need, `${k} ${stage}: a featured item came back after ${gap} days (needs ${need}, pool of ${n0})`);
    }
  }
});

lap('freshness');
/* ---------- 6. one step away, cross-pollination, eras, the avoid list ---------- */
{
  const run = (raw, days, from = "2026-03-01") => { const s = P.dateParts(from); return Array.from({ length: days }, (_, d) => gen(raw, { date: P.addDays(s, d) })); };
  const item = id => DATA.items.find(i => i.id === id);
  /* a schoolteacher gets playground games and packed lunches, never aviation */
  const tr = { ...PROFILES.teacher, stage: "early" }, tp = Mx.readProfile(tr), tpk = run(tr, 90);
  const picked = new Set(); tpk.forEach(p => [p.focus.feature, p.focus.companion, p.focus.surprise].forEach(r => picked.add(r.id)));
  ok([...picked].every(id => Mx.oneDegree(tp, item(id))), "a teacher was offered something more than one step from school: " + [...picked].filter(id => !Mx.oneDegree(tp, item(id))));
  ok([...picked].every(id => !item(id).topics.includes("aviation")), "a teacher was offered aviation");
  ok(["jump-rope", "hopscotch", "marbles", "kickball", "jacks", "yo-yo"].some(id => picked.has(id)), "a teacher never gets playground games");
  ok(["metal-lunch-box", "thermos-bottle", "wax-paper-sandwich", "paper-lunch-bag"].some(id => picked.has(id)), "a teacher never gets packed lunches");
  const tText = tpk.map(p => JSON.stringify(p.pages.slice(0, 4))).join(" ");
  ok(!/\b(biplane|airliner|propeller|cockpit|runway|windsock)\b/i.test(tText), "aviation words reach a teacher's pages");
  /* a dog lover: cats, the veterinarian and parks come round */
  const dr = { ...PROFILES.dogs, stage: "early" }, dpk = run(dr, 90), dTopics = new Set();
  dpk.forEach(p => [p.focus.feature, p.focus.companion, p.focus.surprise].forEach(r => item(r.id).topics.forEach(t => dTopics.add(t))));
  ok(["dogs", "cats", "veterinarian", "parks"].every(t => dTopics.has(t)), "dogs do not reach cats, the veterinarian and parks: " + [...dTopics]);
  const dOwn = dpk.filter(p => item(p.focus.feature.id).topics.includes("dogs") || item(p.focus.feature.id).topics.includes("parks")).length;
  ok(dOwn >= dpk.length * 0.8, `a dog lover is featured dogs or parks on only ${dOwn} of ${dpk.length} days`);
  /* a farmer, born in 1941: the 1950s Ford pickup is brought in through its tags */
  const fr = { first: "Walter", born: 1941, job: "dairy farmer", hobbies: "fishing, gardening", stage: "early" }, fpk = run(fr, 100), fp = Mx.readProfile(fr);
  const withPickup = fpk.filter(p => [p.focus.feature, p.focus.companion, p.focus.surprise].some(r => r.id === "ford-pickup"));
  ok(withPickup.length >= 1, "a farmer never gets the Ford pickup (pools: " + JSON.stringify(fp.health) + ")");
  ok(withPickup.every(p => p.pages[0].words.some(w => w.ref === "ford-pickup")), "the pickup is chosen but none of its words reach the word search");
  ok(withPickup.some(p => p.pages[1].items.some(l => l.refs.includes("ford-pickup"))), "the pickup is chosen but never reaches the conversation");
  ok(fpk.filter(p => p.pages[3].ref === "ford-pickup").every(p => p.pages[3].subject === "1950s_pickup_truck"), "the pickup's coloring page draws something else");
  /* eras */
  const old = run({ first: "Emma", born: 1925, stage: "early", job: "homemaker" }, 60), op = Mx.readProfile({ first: "Emma", born: 1925, job: "homemaker" });
  const young = run({ first: "Tom", born: 1955, stage: "early", job: "homemaker" }, 60);
  const eraIds = ps => { const s = new Set(); ps.forEach(p => [p.focus.feature, p.focus.companion, p.focus.surprise].forEach(r => s.add(r.id))); return s; };
  ok([...eraIds(old)].every(id => Mx.eraFit(item(id), op.era, op.ix) >= 0.25), "a resident born in 1925 gets something from an era they never lived");
  ok(!eraIds(young).has("model-t") && !eraIds(young).has("steamer-trunk"), "a resident born in 1955 gets the Model T");
  ok(!eraIds(old).has("cassette-player") && !eraIds(old).has("video-recorder"), "a resident born in 1925 gets a video recorder");
  /* the avoid list reaches every word */
  const everyText = ps => ps.map(p => leaves(p).join(" ") + " " + p.pages[0].rows.join("") + " " + p.pages[0].list.join(" ")).join(" \n ");
  for (const [avoid, re, label] of [["cars, tractors", /\b(cars?|tractors?)\b/i, "cars and tractors"], ["dogs", /\bdogs?\b|RUSTY/i, "dogs"], ["fishing", /\b(fish|fishing|tackle|bobber)\b/i, "fishing"], ["Vietnam war", /\b(vietnam|wars?)\b/i, "the war"]]){
    for (const stage of ["early", "middle", "late"]){
      const ps = run({ ...PROFILES.farmer, stage, avoid }, 25);
      const text = everyText(ps);
      ok(!re.test(text), `avoiding ${label}: it still appears (${stage}): ${(text.match(re) || [])[0]}`);
      ps.forEach(p => ok(p.stats.pools && p.focus.feature.id, `avoiding ${label}: no packet`));
    }
  }
  const heavy = run({ ...PROFILES.farmer, stage: "early", avoid: "farm, school, home, music, church, dogs, cats, cars, trains, garden, kitchen, radio, weather, family, money" }, 20);
  ok(heavy.length === 20 && heavy.every(p => p.pages.length === 5), "a long avoid list stops the packet");
  /* the avoid list holds 24 entries; each entry may name several things */
  const firsts = DATA.topics.map(t => t.keywords[0]), everyTopicWord = firsts.map((w, i) => i % 2 ? null : w + " " + (firsts[i + 1] || "")).filter(Boolean).join(", ");
  let err = null; try { gen({ first: "Sam", born: 1940, avoid: everyTopicWord }, { date: "2026-10-06" }); } catch (e){ err = e; }
  ok(err && err.code === "PCG_NO_CONTENT" && /avoid list/.test(err.message), "avoiding everything does not say so plainly");
  ok(!everyText(run({ first: "Sam", born: 1940, hobbies: "dogs", pets: "Rusty (dog)", avoid: "dogs", stage: "early" }, 10)).includes("RUSTY"), "an avoided pet's name is still printed");
}

lap('one step/eras/avoid');
/* ---------- the stages are different in kind, not only in size ---------- */
{
  const raw = PROFILES.farmer, e = gen({ ...raw, stage: "early" }, { date: "2026-10-06" }), m = gen({ ...raw, stage: "middle" }, { date: "2026-10-06" }), l = gen({ ...raw, stage: "late" }, { date: "2026-10-06" });
  ok(e.pages[0].size === 15 && m.pages[0].size === 8 && l.pages[0].size === 6, "word search sizes are not 15, 8 and 6");
  ok(e.pages[0].directions === "across, down and slanted" && m.pages[0].directions === "across and down" && l.pages[0].directions === "across", "the directions are not described by stage");
  ok(e.pages[1].style === "open" && m.pages[1].style === "complete" && l.pages[1].style === "sense", "page 2 does not change voice with the stage");
  ok(e.pages[1].items.some(x => /\?$/.test(x.text)) && m.pages[1].items.every(x => !/\?/.test(x.lead)), "open questions and completions are mixed up");
  ok(l.pages[1].cards.every(c => G.wordCount(c.text) <= 10) && l.pages[1].cards.some(c => /^(Look|See|Take a slow look)/.test(c.text)), "late cards are not short sensory cards");
  ok(e.pages[2].style === "crossword" && m.pages[2].style === "crossword" && l.pages[2].style === "look", "page 3 does not change with the stage");
  ok(l.pages[3].style === "mandala", "the late coloring page is not a mandala");
  ok([e, m, l].every(p => p.pages.map(x => x.n).join() === "1,2,3,4,5"), "page numbers moved");
  /* the same day and resident, three stages: the same theme and the same items (the stage filters difficulty, not topic) */
  ok(e.focus.feature.id === m.focus.feature.id && m.focus.feature.id === l.focus.feature.id, "the stage changes what the day is about");
  /* page titles never change from day to day at one stage */
  for (const stage of ["early", "middle", "late"]){
    const titles = new Set(); for (let d = 0; d < 25; d++) titles.add(gen({ ...raw, stage }, { date: dayAt(d) }).pages.map(p => p.title).join("|"));
    ok(titles.size === 1, `${stage}: the page titles change from day to day`);
  }
}

lap('stages differ');
/* ---------- 10. mandalas ---------- */
{
  const shapes = (page, dpi) => {
    const k = dpi / 72;
    return page.items.map(it => {
      const subs = []; let cur = null, pos = null, start = null;
      E.parse(it.d).forEach(s => {
        if (s.op === "M"){ cur = { pts: [[s.p[0] * k, s.p[1] * k]], closed: false }; subs.push(cur); pos = start = s.p; }
        else if (s.op === "L"){ cur.pts.push([s.p[0] * k, s.p[1] * k]); pos = s.p; }
        else if (s.op === "C"){ for (let i = 1; i <= 10; i++){ const tt = i / 10, u = 1 - tt; cur.pts.push([(u * u * u * pos[0] + 3 * u * u * tt * s.c1[0] + 3 * u * tt * tt * s.c2[0] + tt * tt * tt * s.p[0]) * k, (u * u * u * pos[1] + 3 * u * u * tt * s.c1[1] + 3 * u * tt * tt * s.c2[1] + tt * tt * tt * s.p[1]) * k]); } pos = s.p; }
        else if (cur){ cur.closed = true; pos = start; }
      });
      return { subpaths: subs, fill: it.fill === "#fff" ? 0 : it.fill === "#000" ? 1 : null, stroke: it.w * k };
    });
  };
  const raster = (page, dpi) => paint(createBitmap(Math.round(page.w * dpi / 72), Math.round(page.h * dpi / 72)), shapes(page, dpi));
  for (const stage of ["early", "middle", "late"]){
    let problems = 0;
    for (let s = 1; s <= 150; s++) problems += E.validate(E.composeMandala({ stage, seed: s * 104729, frame: s % 2 ? undefined : { x: 61, y: 190, w: 490, h: 500 } })).length;
    ok(problems === 0, `${stage} mandalas break a coloring rule ${problems} times`);
    ok(E.composeMandala({ stage, seed: 77 }).items.map(i => i.d).join() === E.composeMandala({ stage, seed: 77 }).items.map(i => i.d).join(), `${stage}: a mandala is not repeatable from its seed`);
    ok(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(s => E.composeMandala({ stage, seed: s * 7919 }).items.map(i => i.d).join())).size >= 6, `${stage}: mandalas look alike`);
    for (let s = 1; s <= 3 + (stage === "late" ? 1 : 0); s++){
      const page = E.composeMandala({ stage, seed: s * 6007, frame: { x: 61, y: 190, w: 490, h: 500 } });
      const dpi = s === 4 ? 300 : 150, st = strokeStats(raster(page, dpi), dpi);
      ok(st.stroke_pt_p10 >= E.STAGES[stage].min * 0.95, `${stage} mandala at ${dpi} dpi: lines measure ${st.stroke_pt_p10} pt`);
      ok(page.items.every(i => i.fill === "#fff" || i.fill === "none") && page.items.every(i => i.w >= E.STAGES[stage].min), `${stage} mandala is not black outlines on white`);
      if (stage === "late"){
        const m = measure(raster(page, 100), { dpi: 100, noiseSqIn: .01, minSqIn: .1, strokes: false });
        ok(m.tiny_regions === 0, `late mandala: ${m.tiny_regions} areas under a tenth of a square inch (smallest ${m.smallest_region_sq_in})`);
      }
    }
  }
}

lap('mandalas');
/* ---------- 11. how many, and how fast ---------- */
{
  const typical = gen({ ...PROFILES.farmer, stage: "early" }, { date: "2026-10-06" });
  ok(typical.stats.permutations.log10 >= 6 && /\S/.test(typical.stats.permutations.text), "a typical resident has fewer than a million packets: " + typical.stats.permutations.text);
  ok(typical.stats.focusTriples >= 1000, `only ${typical.stats.focusTriples} featured trios for a farmer`);
  for (const [k, p] of Object.entries(PROFILES)) for (const stage of p.stages) ok(gen({ ...p, stage }, { date: "2026-10-06" }).stats.permutations.log10 >= 6, `${k} ${stage}: under a million different packets`);
  const sp = gen({ first: "June", born: 1936, stage: "late" }, { date: "2026-10-06" });
  ok(sp.stats.permutations.log10 >= 6, "a resident with nothing in the profile has under a million packets: " + sp.stats.permutations.text);
  const t1 = Date.now(); let n = 0;
  for (let d = 0; d < 300; d++){ gen({ ...PROFILES.farmer, stage: ["early", "middle", "late"][d % 3] }, { date: dayAt(d) }); n++; }
  const per = (Date.now() - t1) / n;
  ok(per < 60, `a packet takes ${per.toFixed(1)} ms`);
  ok(PCG.packet.bigText(2.5) === "316" && PCG.packet.bigText(6.3) === "2 million" && PCG.packet.bigText(9.5) === "3.2 billion", "bigText: " + [PCG.packet.bigText(2.5), PCG.packet.bigText(6.3), PCG.packet.bigText(9.5)]);
}

lap('how many');
/* ---------- 12. the packet tool ---------- */
{
  const h = read("index.html"), at = f => h.indexOf(`<script src="${f}"></script>`);
  const order = ["assets/pcg/pcg-data.bundle.js", ...FILES];
  ok(order.every(f => at(f) > 0) && order.every((f, i) => i === 0 || at(f) > at(order[i - 1])), "index.html does not load the engine files in order");
  const sw = read("sw.js");
  [...order, "src/engine/ColoringEngine.js"].forEach(f => ok(sw.includes(`"${f}"`), `the offline worker does not keep ${f}`));
  ok(/id="pcgCard"/.test(h) && /id="pcgPrompts"/.test(h) && /id="pcgPrint"/.test(h) && /id="pcgAnother"/.test(h) && /id="pcgCopy"/.test(h), "the Today's Packet card is missing its parts");
  ok(/function pcgPdf\(/.test(h) && /PCG\.generate\(/.test(h) && /composeMandala/.test(h), "the Today's Packet PDF is not drawn");
}

console.log(`PCG engine: ${pass} checks passed (${stats.packets} packets, ${stats.strings} sentences, ${Date.now() - t0} ms)`);
if (fails.length){
  console.log(`${fails.length} FAILED:`);
  fails.slice(0, 40).forEach(f => console.log("  - " + f));
  if (fails.length > 40) console.log(`  ... and ${fails.length - 40} more`);
  process.exit(1);
}
