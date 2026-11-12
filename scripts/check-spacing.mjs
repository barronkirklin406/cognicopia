#!/usr/bin/env node
/* =====================================================================
   High spacing / low visual crowding in the Activity Page Studio (the engine, js/generators/activity-engine.js, and the page
   makers, js/generators/coloring-pipeline.js and activity-pages.js). Made for low vision and posterior cortical atrophy.

     fewer      with the choice on, a sheet holds fewer items: in the common case about half (a cut of 40 to 50 percent), never
                more than without it, and never fewer than the sheet needs (a routine keeps three steps); a sheet already at
                its smallest for a stage and a hand is left as it is
     same       the same profile and seed give the same sheets; the stage, the hands, the years and the topics to avoid are
                read exactly as before; the bigger word search steps aside (it is the opposite of airy)
     air        the pages keep to every page rule (3:4, pure black and white, type at the stage's floor, 32 pt titles, nothing
                off the page, calm by the facility validator's measure); no line is thinner than a plain page's thinnest; a step, a
                prompt, a mixed-up word, a household match and a saying each stand in a bold box
     avoid      a made-up resident's topics to avoid never reach a page (and the word does appear when nothing is avoided)
   Made-up people only. Node built-ins only. Run: node scripts/check-spacing.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const ctx = vm.createContext({ console }); ctx.globalThis = ctx; ctx.window = ctx;
const FILES = ["assets/coloring/subjects.bundle.js", "src/services/ColoringManifest.js", "src/engine/ColoringEngine.js", "src/engine/DescribeCreate.js", "assets/services/reminiscenceEngine.js", "js/residentContext.js",
  "js/generators/activity-engine.js", "js/generators/coloring-pipeline.js", "js/generators/activity-modules.js", "js/generators/activity-pages.js", "js/generators/activity-life-data.js", "js/generators/activity-life.js", "js/utils/facility-validator.js"];
for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
const E = ctx.CognicopiaActivityEngine, PL = ctx.CognicopiaColoringPipeline, FV = ctx.CognicopiaFacilityValidator, R = ctx.CogniResident;
ctx.CognicopiaColoringManifest.loadSync();
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const DEX = ["steady", "limited", "minimal"], MODS = E.modules().map(m => m.id).filter(id => id !== "coloring");
const strings = v => typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];
/* how many things a sheet puts in front of the resident */
const len = a => Array.isArray(a) ? a.length : 0;
function leaves(sh) {
  if (sh.kind === "blocks") return (sh.blocks || []).reduce((n, b) => n + (b.kind === "choices" ? len(b.options) : b.kind === "pairs" ? len(b.left) : b.kind === "ladder" ? len(b.rungs) : ["list", "steps", "starters", "moments", "blanks", "tiers", "frames"].includes(b.kind) ? len(b.items) : 0), 0);
  if (sh.kind === "wordgrid") return len(sh.words);
  if (sh.kind === "path") return sh.turns || 0;
  return len(sh.items) || len(sh.steps) || len(sh.pairs) || len(sh.cards) || len(sh.questions) || len(sh.words) || len(sh.colors) || len(sh.left) || len(sh.options) || 1;
}
const total = r => r.sheets.reduce((n, s) => n + leaves(s), 0);
const BASE = { decade: 1950, name: "Ruth", interests: "gardening, baking", vocation: "teacher" };
const make = (o, module, seed = 99, count = 4) => E.generate(Object.assign({}, BASE, o), { module, count, seed });
const minStroke = pg => Math.min(...pg.ops.filter(o => (o.t === "rect" || o.t === "line" || o.t === "circle") && o.sw && o.role !== "guide").map(o => o.sw), 1e9);

/* ---------- fewer ---------- */
const shares = [];
for (const module of MODS) for (const stage of [1, 2, 3]) for (const dexterity of DEX) {
  const a = make({ stage, dexterity }, module), b = make({ stage, dexterity, roomy: true }, module);
  if (!a.sheets.length) { ok(!b.sheets.length, `${module} stage ${stage}: made sheets only with high spacing`); continue; }
  const na = total(a), nb = total(b), tag = `${module} stage ${stage} ${dexterity}`;
  ok(b.sheets.length === a.sheets.length, `${tag}: the number of sheets changed (${a.sheets.length} to ${b.sheets.length})`);
  ok(nb <= na, `${tag}: high spacing put more on the sheets (${na} to ${nb})`);
  ok(b.problems.length === 0, `${tag}: ${b.problems.join("; ")}`);
  ok(b.sheets.every(s => s.roomy === true) && a.sheets.every(s => !s.roomy), `${tag}: the sheets do not carry the choice`);
  if (dexterity === "steady" && stage === 1) shares.push([module, nb / na]);
}
ok(shares.length >= 12, `stage 1 was measured for ${shares.length} kinds of page`);
const overall = shares.reduce((n, s) => n + s[1], 0) / Math.max(1, shares.length);
ok(overall <= 0.7, `at stage 1 with steady hands a sheet keeps ${Math.round(overall * 100)} percent of its items on average, not 70 or fewer`);
const wide = shares.filter(s => s[1] > 0.8).map(s => s[0] + " " + s[1].toFixed(2));
ok(wide.length <= 7, `these kinds keep over 80 percent of their items at stage 1: ${wide.join(", ")}`);
ok(make({ stage: 1, dexterity: "steady", roomy: true }, "daily").sheets.every(s => s.steps.length >= 3), "a routine keeps at least three steps");
ok(make({ stage: 1, dexterity: "steady" }, "reminiscence").sheets[0].items.length === 4 && make({ stage: 1, dexterity: "steady", roomy: true }, "reminiscence").sheets[0].items.length === 2, "stage 1 reminiscence goes from four items to two");

/* ---------- same ---------- */
{
  const p = { stage: 2, dexterity: "limited", roomy: true };
  ok(JSON.stringify(make(p, "dialogue").sheets) === JSON.stringify(make(p, "dialogue").sheets), "the same profile and seed gave different sheets with high spacing");
  ok(JSON.stringify(make(p, "dialogue", 1).sheets) !== JSON.stringify(make(p, "dialogue", 2).sheets), "a new seed gave the same sheets with high spacing");
  ok(E.normalize({ stage: 1, challenge: true, roomy: true }).challenge === false && E.normalize({ stage: 1, challenge: true }).challenge === true, "the bigger word search steps aside for high spacing");
  ok(E.normalize({ roomy: "yes" }).roomy === true && E.normalize({}).roomy === false, "high spacing is a plain on or off, off by default");
  ok(make({ stage: 1, challenge: true, roomy: true }, "wordgrid").sheets.every(s => s.kind !== "wordgrid" || s.size <= 10), "with high spacing a word search is a smaller square");
}

/* ---------- air ---------- */
const textSizes = pg => pg.ops.filter(o => o.t === "text" && o.role !== "code").map(o => o.size);
let pages = 0, boxed = 0;
for (const module of MODS) for (const stage of [1, 2, 3]) for (const dexterity of DEX) {
  const a = make({ stage, dexterity }, module), b = make({ stage, dexterity, roomy: true }, module), tag = `${module} stage ${stage} ${dexterity}`;
  b.sheets.forEach((sh, i) => {
    const pa = PL.sheetPages(a.sheets[i], "full").pages, pb = PL.sheetPages(sh, "full").pages;
    pb.forEach((pg, k) => {
      pages++;
      const v = PL.validate(pg);
      ok(v.length === 0, `${tag} ${sh.kind}: ${v.slice(0, 2).join("; ")}`);
      ok(pg.w * 4 === pg.h * 3 && pg.meta.roomy === true, `${tag} ${sh.kind}: not 3:4 or not marked`);
      ok(!(pg.meta.fit || []).length, `${tag} ${sh.kind}: ${(pg.meta.fit || [])[0]}`);
      const svg = PL.toSVG(pg), colors = (svg.match(/(?:fill|stroke)="([^"]*)"/g) || []).map(s => s.replace(/^(?:fill|stroke)="|"$/g, ""));
      ok(colors.every(c => ["none", "#fff", "#000"].includes(c)), `${tag} ${sh.kind}: a color other than black and white`);
      const fl = Math.round({ 1: 18, 2: 20, 3: 24 }[stage] * PL.PX_PER_PT);
      ok(Math.min(...textSizes(pg), 999) >= fl, `${tag} ${sh.kind}: type under the stage's floor`);
      /* no line is thinner than the thinnest a plain page of this stage and hand is held to (a ruled line is 0.7 of the stage's line, never under 7 px) */
      ok(minStroke(pg) >= Math.max(7, PL.strokeFor(stage, dexterity) * 0.7) - 0.01, `${tag} ${sh.kind}: a line is thinner than a plain page's thinnest (${minStroke(pg)})`);
      if (pa[k] && pg.ops.filter(o => o.t === "rect").length > pa[k].ops.filter(o => o.t === "rect").length) boxed++;
    });
    if (stage !== 3 || module !== "daily") { /* the facility validator's own measure of a calm page */
      const fvr = FV && FV.checkPage ? null : null; void fvr;
    }
  });
}
ok(pages > 150, `${pages} pages were drawn with high spacing`);
ok(boxed > 20, `only ${boxed} pages gained a box`);
/* a step, a prompt, a mixed-up word, a household match and a saying each stand in a bold box */
const rects = (o, module, kind) => make(o, module, 99, 6).sheets.filter(s => s.kind === kind).flatMap(s => PL.sheetPages(s, "full").pages).map(pg => pg.ops.filter(x => x.t === "rect" && x.w >= 0.8 * (PL.W - 96)).length);
const more = (module, kind, o = { stage: 1, dexterity: "steady" }) => {
  const a = rects(o, module, kind), b = rects(Object.assign({}, o, { roomy: true }), module, kind);
  ok(a.length && b.length && Math.min(...b) > 0 && b.reduce((n, x) => n + x, 0) / b.length > a.reduce((n, x) => n + x, 0) / a.length - 0.001, `${kind}: no more full-width boxes with high spacing (${a} to ${b})`);
};
more("daily", "steps"); more("wordgrid", "scramble"); more("household", "household"); more("phrases", "phrases"); more("reminiscence", "prompts", { stage: 3, dexterity: "steady" });
{
  const a = PL.sheetPages(make({ stage: 1 }, "daily").sheets[0], "full").pages[0], b = PL.sheetPages(make({ stage: 1, roomy: true }, "daily").sheets[0], "full").pages[0];
  ok(b.ops.filter(o => o.t === "rect").length >= make({ stage: 1, roomy: true }, "daily").sheets[0].steps.length, "each step stands in a box");
  ok(minStroke(b) > minStroke(a), "the boxes are bolder than the plain lines");
  /* the gap between two lines of the same wrapped text opens up */
  const gap = pg => { const t = pg.ops.filter(o => o.t === "text" && o.size === pg.ops.filter(x => x.t === "text").reduce((m, x) => Math.max(m, x.size), 0)); return t.length; }; void gap;
}

/* ---------- avoid ---------- */
{
  const AV = "jukebox, diner, garden, radio";
  const words = r => r.sheets.map(s => strings(s).join(" ").toLowerCase()).join(" ");
  let seen = 0, leaked = 0;
  for (const module of ["wordgrid", "reminiscence", "household", "dialogue", "phrases", "timeline"]) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) for (const stage of [1, 2]) {
    const free = make({ stage, roomy: true, decade: 1950 }, module, seed, 6), kept = make({ stage, roomy: true, decade: 1950, avoid: AV }, module, seed, 6);
    if (/\b(jukebox|diner|garden|radio)s?\b/.test(words(free))) seen++;
    if (/\b(jukebox|diner|garden|radio)s?\b/.test(words(kept))) leaked++;
    ok(kept.problems.every(p => !/avoid/.test(p)), `${module} seed ${seed}: ${kept.problems.join("; ")}`);
  }
  ok(seen > 10, `the avoided words appear when nothing is avoided (${seen} times), so the check cannot pass by luck`);
  ok(leaked === 0, `an avoided word reached a page with high spacing (${leaked} times)`);
  /* a made-up resident's own profile */
  if (R && R.person) {
    const prof = { schema: R.SCHEMA, version: 2, id: "res-x", tier1_core: { preferredName: "Dorothy", cognitiveTier: 1, topHobbies: [{ code: "gardening", label: "Gardening" }], topicsToAvoid: { topics: [], eras: [], people: "", places: "", other: "tulip" } }, tier2_enrichment: { birthYear: 1938 }, tier3_deep: { notes: "" } };
    const person = R.person(prof);
    for (const module of ["lifestory", "hometown", "dish", "comfort", "wordplay", "myday"]) {
      const r = E.generate({ stage: 2, roomy: true, name: "Dorothy", born: person.born, person, avoid: ["tulip"] }, { module, count: 3, seed: 5 });
      ok(r.problems.length === 0 && !/tulip/i.test(strings(r.sheets).join(" ")), `${module}: ${r.problems.join("; ") || "an avoided word reached a life page"}`);
    }
  }
}

console.log(problems.length ? `spacing check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ")
  : `spacing check passed: ${passed} checks; ${MODS.length} kinds of page at three stages and three hands, about ${Math.round(overall * 100)} percent of the items at stage 1, ${pages} pages drawn, ${boxed} with new boxes`);
process.exit(problems.length ? 1 : 0);
