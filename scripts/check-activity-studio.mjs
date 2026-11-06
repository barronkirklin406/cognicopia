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
  "js/generators/activity-engine.js", "js/generators/coloring-pipeline.js"];
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

/* offline */
for (const f of FILES.slice(4)) {
  const s = read(f);
  ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|https?:\/\/[^\s"')]*\.(?:com|org|net)/i.test(s.replace(/https?:\/\/www\.w3\.org\/2000\/svg/g, "")), f + " reaches the network or keeps something");
}

if (problems.length) { console.error("Activity Studio check FAILED (" + problems.length + "):"); problems.slice(0, 25).forEach(p => console.error("  - " + p)); process.exit(1); }
console.log("activity studio check passed: " + passed + " checks (3 modules x 3 stages x 3 dexterities x 4 layouts, six coloring styles, words, topics to avoid, 3:4, black and white, nothing off the page, offline)");
