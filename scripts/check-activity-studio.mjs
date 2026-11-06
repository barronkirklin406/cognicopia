#!/usr/bin/env node
/* =====================================================================
   Activity Page Studio: the engine (js/generators/activity-engine.js) and the pipeline (js/generators/coloring-pipeline.js).
     the sheets   every module at every stage and dexterity makes sheets with no problem of its own; the same profile and
                  seed make the same sheets and a new seed makes different ones; stage 3 has fewer items and steps than
                  stage 1; a topic to avoid never appears; nothing quizzes or talks down
     the pages    every sheet in every layout is 3:4, pure black and white, no line under 6 px (3 pt and up on paper), no
                  text under its stage's floor, nothing off the page; cards tile as 4, 6 or 5 to a sheet
     the coloring each of the six styles draws a finished library picture at every stage and dexterity; words choose through
                  the Describe engine; a topic to avoid is honored; the thin lines are as heavy as the stage says
     offline      the three files make no network request and keep nothing
   Node built-ins only. Run: node scripts/check-activity-studio.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const ctx = vm.createContext({ console }); ctx.globalThis = ctx; ctx.window = ctx;
const FILES = ["assets/coloring/subjects.bundle.js", "src/services/ColoringManifest.js", "src/engine/ColoringEngine.js", "src/engine/DescribeCreate.js",
  "js/generators/activity-engine.js", "js/generators/coloring-pipeline.js", "js/generators/activity-modules.js", "js/generators/activity-pages.js"];
for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
const E = ctx.CognicopiaActivityEngine, PL = ctx.CognicopiaColoringPipeline, M = ctx.CognicopiaColoringManifest;
M.loadSync();
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

/* the sheets */
const MODS = ["reminiscence", "exercise", "daily"], DEX = ["steady", "limited", "minimal"], LAY = PL.LAYOUTS.map(l => l.id);
const textOf = sh => JSON.stringify(sh);
const quiz = /do you remember|remember when|what year|who is this|quiz|\btest\b|sweetie|honey|good job|\bdear\b/i;
const counts = {};
for (const stage of [1, 2, 3]) for (const dexterity of DEX) for (const module of MODS) {
  const r = E.generate({ stage, dexterity, decade: 1950, name: "Ruth", interests: "gardening, baking" }, { module, count: 6, seed: 12345 });
  const tag = `${module} stage ${stage} ${dexterity}`;
  ok(r.sheets.length === 6, `${tag}: made ${r.sheets.length} sheets, not 6`);
  ok(r.problems.length === 0, `${tag}: ${r.problems.join("; ")}`);
  ok(!quiz.test(textOf(r.sheets)), `${tag}: a sheet quizzes or talks down`);
  const again = E.generate({ stage, dexterity, decade: 1950, name: "Ruth", interests: "gardening, baking" }, { module, count: 6, seed: 12345 });
  ok(JSON.stringify(again.sheets) === JSON.stringify(r.sheets), `${tag}: the same seed gave different sheets`);
  const other = E.generate({ stage, dexterity, decade: 1950, name: "Ruth", interests: "gardening, baking" }, { module, count: 6, seed: 54321 });
  ok(JSON.stringify(other.sheets) !== JSON.stringify(r.sheets), `${tag}: a new seed gave the same sheets`);
  if (dexterity === "steady") counts[module + stage] = r.sheets.reduce((n, s) => n + (s.items || s.steps || s.pairs || [1]).length, 0);
  for (const sh of r.sheets) for (const layout of LAY) {
    const { pages } = PL.sheetPages(sh, layout);
    ok(pages.length >= 1, `${tag} ${layout}: no page`);
    for (const pg of pages) {
      const v = PL.validate(pg);
      ok(v.length === 0, `${tag} ${sh.kind} ${layout}: ${v.slice(0, 2).join("; ")}`);
      ok(pg.w * 4 === pg.h * 3, `${tag}: not 3:4`);
      const svg = PL.toSVG(pg);
      const colors = (svg.match(/(?:fill|stroke)="([^"]*)"/g) || []).map(s => s.replace(/^(?:fill|stroke)="|"$/g, ""));
      ok(colors.every(c => ["none", "#fff", "#000"].includes(c)), `${tag} ${sh.kind} ${layout}: a color other than black and white`);
    }
  }
}
for (const m of MODS) ok(counts[m + "3"] <= counts[m + "1"], `${m}: stage 3 has more than stage 1 (${counts[m + "3"]} vs ${counts[m + "1"]})`);
ok(E.generate({ stage: 3 }, { module: "daily", count: 6, seed: 7 }).sheets.every(s => s.steps.length <= 4 && s.steps.length >= 3), "stage 3 daily steps are not 3 or 4");
ok(E.generate({ stage: 1, dexterity: "steady" }, { module: "daily", count: 6, seed: 7 }).sheets.every(s => s.steps.length >= 5), "stage 1 daily steps are fewer than 5");
ok(E.generate({ stage: 3 }, { module: "exercise", count: 4, seed: 3 }).sheets.every(s => ["look", "path"].includes(s.kind)), "stage 3 exercises are not look or path");
ok(E.generate({ stage: 1 }, { module: "exercise", count: 6, seed: 3 }).sheets.some(s => s.kind === "match" && s.pairs.length === 5), "stage 1 matching does not use five pairs");

/* prompts dealt onto cards together: every card sheet but the last is full */
for (const stage of [1, 2, 3]) for (const dexterity of DEX) for (const layout of ["cards4", "cards6", "cards8", "strips"]) {
  const r = E.generate({ stage, dexterity, decade: 1960 }, { module: "reminiscence", count: 24, seed: 8 });
  const pages = PL.packPrompts(r.sheets, layout), per = PL.LAYOUTS.find(l => l.id === layout).per;
  const cards = r.sheets.reduce((n, sh) => n + sh.items.length, 0);
  ok(pages.length === Math.ceil(cards / per), `${layout} stage ${stage} ${dexterity}: ${cards} cards make ${pages.length} pages, not ${Math.ceil(cards / per)}`);
  ok(pages.every(pg => PL.validate(pg).length === 0), `${layout} stage ${stage} ${dexterity}: a packed page fails the print check`);
}

/* a batch never repeats a page (the facility validator found two ways it did: a single-idea sheet overwritten by the same interest, and more daily sheets than tasks) */
for (const stage of [1, 2, 3]) for (const dexterity of DEX) for (const module of MODS) {
  const r = E.generate({ stage, dexterity, decade: 1950, interests: "gardening" }, { module, count: 8, seed: 11 });
  const keys = r.sheets.map(sh => JSON.stringify([sh.title, sh.items || sh.steps || sh.pairs || sh.words || [sh.word, sh.pic, sh.from, sh.to]]));
  ok(new Set(keys).size === keys.length, `${module} stage ${stage} ${dexterity}: a batch repeats a sheet`);
}
ok(E.generate({ stage: 2 }, { module: "daily", count: 12, seed: 1 }).sheets.length === E.TASKS.length, "daily living makes each task once");

/* care: topics to avoid, decades */
{
  const r = E.generate({ stage: 1, decade: 1940, avoid: "truck, streetcar" }, { module: "reminiscence", count: 12, seed: 99 });
  ok(!/truck|streetcar/i.test(textOf(r.sheets)), "a topic to avoid appeared");
  for (const d of E.DECADES) ok(E.generate({ stage: 2, decade: d }, { module: "reminiscence", count: 3, seed: 1 }).sheets.every(s => s.title === "The " + d + "s"), "decade " + d + " is not used");
  ok(E.decadeFor(1938) === 1950 && E.decadeFor(1945) === 1960 && E.decadeFor(0) === 1950, "the reminiscence decade is wrong (" + [1938, 1945].map(E.decadeFor) + ")");
  ok(E.toneProblems("Do you remember this?").length === 1 && E.toneProblems("Tell me about the Philco radio.").length === 0, "the tone filter is wrong");
  ok(E.generate({ name: "A<b>&\"" }, {}).profile.name.indexOf("<") < 0, "a name was not cleaned");
}

/* coloring */
for (const st of PL.STYLES) for (const stage of [1, 2, 3]) for (const dex of DEX) {
  const c = PL.chooseSubject({ style: st.id, stage, seed: 5, avoid: [] });
  ok(c.asset && st.ids.includes(c.asset.id), `${st.id} stage ${stage}: no picture from the style`);
  if (!c.asset) continue;
  const code = `ASX-${st.id}-${stage}`;
  const pg = PL.composeColoring(c.asset, PL.subjectPaths(c.asset.id), { stage, dexterity: dex, code });
  const v = PL.validate(pg);
  ok(v.length === 0, `${st.id} stage ${stage} ${dex}: ${v.slice(0, 2).join("; ")}`);
  const thin = Math.min(...pg.ops.filter(o => o.t === "path" && o.stroke === "#000").map(o => o.sw * o.k));
  ok(thin >= 6, `${st.id} stage ${stage}: a line is ${thin} px`);
  const want = PL.strokeFor(stage, dex);
  ok(Math.max(...pg.ops.filter(o => o.t === "path").map(o => o.sw * o.k)) <= want + 0.5, `${st.id} stage ${stage}: a line is heavier than ${want}`);
  if (stage === 3) ok(pg.ops.filter(o => o.t === "path").length <= (PL.subjectPaths(c.asset.id).filter(p => !p[2]).length), `${st.id}: stage 3 kept fine detail`);
}
ok(PL.strokeFor(1, "steady") >= 6 && PL.strokeFor(3, "minimal") > PL.strokeFor(3, "steady"), "stroke widths do not rise with stage and dexterity");
{
  const a = PL.chooseSubject({ text: "a 1950s pickup truck", stage: 2 }), b = PL.chooseSubject({ text: "a rose in a jug", stage: 1 });
  ok(a.asset && a.asset.id === "1950s_pickup_truck", "words did not choose the pickup truck");
  ok(b.asset && /rose|flower/.test(b.asset.id), "words did not choose a rose");
  ok(!PL.chooseSubject({ text: "a gun and a skeleton", stage: 2 }).asset, "a refused subject was drawn");
  const avoid = PL.chooseSubject({ style: "kitchen", stage: 2, seed: 0, avoid: ["tea"] });
  ok(!avoid.asset || !/tea/.test(avoid.asset.id), "an avoided topic was drawn");
}

/* the rest of the master inventory: wordgrid, timeline, memory, dialogue, household, phrases, recognition, rhythm */
const NEW = ["wordgrid", "timeline", "memory", "dialogue", "household", "phrases", "recognition", "rhythm"];
const FIT = { wordgrid: [1, 2], timeline: [1, 2], memory: [1, 2], dialogue: [1, 2, 3], household: [1, 2], phrases: [1, 2], recognition: [2, 3], rhythm: [2, 3] };
const sorted = a => a.split("").sort().join("");
const found = (rows, w) => { const n = rows.length; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1]]) { let k = 0; while (k < w.length && r + dr * k < n && c + dc * k < n && rows[r + dr * k][c + dc * k] === w[k]) k++; if (k === w.length) return true; } return false; };
const SHEET_KEYS = sh => JSON.stringify(Object.assign({}, sh, { index: 0, code: "" }));
for (const m of NEW) for (const stage of [1, 2, 3]) for (const dexterity of DEX) {
  const tag = `${m} stage ${stage} ${dexterity}`;
  const r = E.generate({ stage, dexterity, decade: 1960, vocation: "mechanic", name: "Ruth", interests: "gardening" }, { module: m, count: 12, seed: 77 });
  if (!FIT[m].includes(stage)) { ok(r.sheets.length === 0 && r.notFitting === true, `${tag}: made sheets at a stage it is not made for`); continue; }
  ok(r.sheets.length >= 1 && r.problems.length === 0, `${tag}: ${r.sheets.length} sheets, ${r.problems.join("; ")}`);
  ok(!quiz.test(textOf(r.sheets.map(sh => Object.assign({}, sh, { staffNote: "", keyLines: [] })))), `${tag}: a sheet quizzes or talks down`);
  const again = E.generate({ stage, dexterity, decade: 1960, vocation: "mechanic", name: "Ruth", interests: "gardening" }, { module: m, count: 12, seed: 77 });
  ok(JSON.stringify(again.sheets) === JSON.stringify(r.sheets), `${tag}: the same seed gave different sheets`);
  const keys = r.sheets.map(SHEET_KEYS); ok(new Set(keys).size === keys.length, `${tag}: a batch repeats a sheet`);
  ok(r.sheets.every(sh => sh.staffNote && sh.staffNote.length > 40), `${tag}: a sheet has no note for staff`);
  for (const sh of r.sheets) for (const layout of LAY) {
    const { pages } = PL.sheetPages(sh, layout);
    for (const pg of pages) { const v = PL.validate(pg); ok(v.length === 0, `${tag} ${sh.kind} ${layout}: ${v.slice(0, 2).join("; ")}`); ok(pg.w * 4 === pg.h * 3, `${tag}: not 3:4`);
      const svg = PL.toSVG(pg); ok((svg.match(/(?:fill|stroke)="([^"]*)"/g) || []).every(c => /"(none|#fff|#000)"/.test(c)), `${tag}: a color other than black and white`); }
  }
  for (const sh of r.sheets) {
    if (sh.kind === "wordgrid") {
      ok(sh.rows.length === sh.size && sh.rows.every(x => x.length === sh.size && /^[A-Z]+$/.test(x)), `${tag}: the grid is not ${sh.size} x ${sh.size} capital letters`);
      ok(sh.words.length >= 4 && sh.words.every(w => found(sh.rows, w)), `${tag}: a word on the list is not in the grid (${sh.words.filter(w => !found(sh.rows, w)).join(",")})`);
      ok(sh.size === (stage === 1 ? (dexterity === "steady" ? 10 : 8) : (dexterity === "steady" ? 8 : 7)), `${tag}: grid size ${sh.size}`);
    }
    if (sh.kind === "scramble") sh.items.forEach((it, i) => { const w = sh.keyLines[i]; ok(sorted(it.scr) === sorted(w) && it.scr !== w && it.scr[0] === w[0] && it.len === w.length, `${tag}: a mixed-up word is not made of its word (${it.scr} / ${w})`); });
    if (sh.kind === "timeline") {
      ok(new Set(sh.cards.map(c => c.id)).size === sh.cards.length && sh.keyLines.length === sh.cards.length, `${tag}: timeline cards and key do not match`);
      ok(sh.cards.length === (stage === 1 ? (dexterity === "steady" ? 5 : 4) : 3), `${tag}: ${sh.cards.length} timeline cards`);
      const years = sh.keyLines.map(l => (/\((\d{4})\)/.exec(l) || [])[1]).filter(Boolean).map(Number);
      ok(years.every((y, i) => i === 0 || y > years[i - 1]), `${tag}: the timeline key is not in order (${years})`);
    }
    if (sh.kind === "memory") {
      const count = {}; sh.cards.forEach(c => { count[c.pic] = (count[c.pic] || 0) + 1; });
      ok(Object.values(count).every(n => n === 2) && sh.cards.length === 2 * sh.keyLines.length, `${tag}: a memory card has no partner`);
      ok(sh.cards.every(c => PL.subjectPaths(c.pic)), `${tag}: a memory card has no drawing`);
      ok(sh.cols * Math.ceil(sh.cards.length / sh.cols) >= sh.cards.length && sh.keyLines.length === Math.max(3, (stage === 1 ? 6 : 4) - DEX.indexOf(dexterity)), `${tag}: ${sh.keyLines.length} pairs`);
    }
    if (sh.kind === "dialogue") ok(sh.questions.length === (stage === 1 ? (dexterity === "steady" ? 3 : 2) : stage === 2 ? (dexterity === "steady" ? 2 : 1) : (dexterity === "steady" ? 2 : 1)) && sh.log.length === 4, `${tag}: ${sh.questions.length} questions`);
    if (sh.kind === "household") ok(sh.right.length === sh.left.length && sorted(sh.right.join("")) === sorted(sh.keyLines.map(l => l.replace(/^.* to /, "")).join("")), `${tag}: the names on the right are not the names that belong`);
    if (sh.kind === "phrases") {
      const ends = sh.items.map(x => x.end); ok(new Set(ends).size === ends.length, `${tag}: two lines end the same way`);
      ok(stage === 1 ? sh.bank === null : sh.bank && sorted(sh.bank.join("|")) === sorted(ends.join("|")), `${tag}: the ending box is wrong (stage 1 has none; stage 2 holds exactly the endings)`);
      ok(sh.items.every(x => x.year == null || x.year <= 1928), `${tag}: a song line is from after 1928`);
    }
    if (sh.kind === "shapes") {
      if (sh.mode === "match") ok(sorted(sh.left.join("|")) === sorted(sh.right.join("|")) && stage === 2, `${tag}: every shape on the right must have its partner on the left`);
      if (sh.mode === "point") ok(sh.options.filter(o => o === sh.target).length === 1 && sh.options.length === 2 && sh.options.some(o => o !== sh.target) && stage === 3, `${tag}: the same shape must be one of exactly two very different choices`);
      if (sh.mode === "colors") ok(sh.colors.every(c => /^[A-Z]+$/.test(c.word) && c.thing), `${tag}: a color card is incomplete`);
    }
    if (m === "rhythm") ok(sh.items.every(it => (it.kind === "feel" || (it.kind === "verse" && it.year <= 1928)) && (stage !== 3 || it.thing.length < 33)), `${tag}: a ticket is not a feel word or an early verse (late-stage lines are short)`);
  }
}
/* everything printed is old enough to print freely, and every dated fact is a date that can be looked up in a minute */
{
  const PD = E.PUBLIC_DOMAIN;
  ok(PD.verse.length >= 8 && PD.verse.every(v => v[2] <= 1928 && v[1].endsWith(String(v[2]))), "every verse carries its author and a year of 1928 or earlier");
  ok(PD.lyrics.length >= 8 && PD.lyrics.every(l => l[2] <= 1928), "every song line is from a work published in 1928 or earlier");
  ok(PD.events.length >= 24 && PD.events.every(e => e.y >= 1900 && e.y <= 1989 && e.t.length > 15) && [1940, 1950, 1960, 1970, 1980].every(d => PD.events.filter(e => e.y >= d && e.y < d + 10).length >= 2), "the dated facts cover each decade from the 1940s with at least two");
  ok(E.VOCATIONS.length === 10, "ten former kinds of work theme the word grids");
  ok(E.modules().filter(m => NEW.includes(m.id)).length === 8 && E.modules().every(m => m.id && m.label), "the router lists all eight added modules");
}
ok(E.generate({ stage: 2 }, { module: "no-such-module", count: 2, seed: 1 }).module === "reminiscence", "an unknown module falls back to reminiscence");

/* offline */
for (const f of FILES.slice(4)) {
  const s = read(f);
  ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|https?:\/\/[^\s"')]*\.(?:com|org|net)/i.test(s.replace(/https?:\/\/www\.w3\.org\/2000\/svg/g, "")), f + " reaches the network or keeps something");
}

if (problems.length) { console.error("Activity Studio check FAILED (" + problems.length + "):"); problems.slice(0, 25).forEach(p => console.error("  - " + p)); process.exit(1); }
console.log("activity studio check passed: " + passed + " checks (3 modules x 3 stages x 3 dexterities x 4 layouts, six coloring styles, words, topics to avoid, 3:4, black and white, nothing off the page, offline)");
