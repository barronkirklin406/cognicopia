#!/usr/bin/env node
/* =====================================================================
   Facility validator and print optimizer (js/utils/facility-validator.js, js/utils/print-optimizer.js).
     the score     contrast is computed from the colors (black on white 21:1, a light gray fails); a line thinner than 3 pt, a page
                   crowded with ink, text under its stage's floor, a repeated page, one kind of page across a long batch, a late-stage
                   match or sort page, quiz words and a missing staff note each lower the score and name the fault; every batch the
                   studio makes at every stage, hand setting and layout scores 90 or more with no finding; the weights add to 100
     the library   every drawing in assets/coloring is read as SVG: black and white only, no line under the minimum once scaled to a page
     the report    one console block per batch, headed "Clinical Readiness Score", that says it is not a clinical certification
     the cache     the list of files the studio needs holds the page, its scripts, its type and all the library's drawings, every one
                   is a real file, the service worker keeps the new scripts, and where there is no Cache Storage it says so
     print         the style sheet is US Letter with 0.5 in margins, hides everything but the sheets, one sheet to a page, with a
                   gutter that alternates sides
     offline       neither file makes a request or keeps anything
   Node built-ins only. Run: node scripts/check-facility-validator.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const ctx = vm.createContext({ console }); ctx.globalThis = ctx; ctx.window = ctx;
const FILES = ["assets/coloring/subjects.bundle.js", "src/services/ColoringManifest.js", "src/engine/DescribeCreate.js", "assets/services/reminiscenceEngine.js", "js/residentContext.js", "js/generators/activity-engine.js", "js/generators/coloring-pipeline.js", "js/generators/activity-modules.js", "js/generators/activity-pages.js", "js/generators/activity-life-data.js", "js/generators/activity-life.js", "js/utils/facility-validator.js", "js/utils/print-optimizer.js"];
for (const f of FILES) vm.runInContext(read(f), ctx, { filename: f });
const E = ctx.CognicopiaActivityEngine, PL = ctx.CognicopiaColoringPipeline, FV = ctx.CognicopiaFacilityValidator, PO = ctx.CognicopiaPrintOptimizer, M = ctx.CognicopiaColoringManifest;
M.loadSync();
let passed = 0; const problems = [];
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

/* a packet the way the studio builds one */
function packet(stage, dexterity, layout, mods, n) {
  const lists = mods.map((m, i) => {
    if (m === "coloring") {
      const out = []; for (let v = 0; v < n; v++) { const c = PL.chooseSubject({ style: "botanical", stage, seed: 5 + i, variant: v }); if (!c.asset) break; const pg = PL.composeColoring(c.asset, PL.subjectPaths(c.asset.id), { stage, dexterity, code: "X" + v }); pg.meta.module = "coloring"; if (!out.some(o => o.meta.subject === pg.meta.subject)) out.push(pg); } return out;
    }
    const r = E.generate({ stage, dexterity, decade: 1950, interests: "gardening" }, { module: m, count: 8, seed: 11 + i });
    return r.sheets.flatMap(sh => PL.sheetPages(sh, layout).pages.map(pg => { pg.meta.module = m; pg.meta.staff = sh.staffNote; return pg; }));
  });
  const pages = [], at = mods.map(() => 0);
  while (pages.length < n && lists.some((l, i) => at[i] < l.length)) lists.forEach((l, i) => { if (pages.length < n && at[i] < l.length) pages.push(l[at[i]++]); });
  return pages;
}

/* contrast, from the colors */
ok(FV.contrastOnWhite("#000") === 21 && FV.contrastOnWhite("#fff") === 1, "black on white is 21:1 and white on white 1:1");
ok(FV.contrastOnWhite("#999999") < 4 && FV.contrastOnWhite("#595959") >= 7, "a light gray fails and #595959 reaches 7:1");

/* good batches score well */
const log = [];
for (const stage of [1, 2, 3]) for (const dex of ["steady", "limited", "minimal"]) for (const layout of ["full", "cards4", "cards6", "cards8", "strips"]) {
  const pages = packet(stage, dex, layout, ["reminiscence", "exercise", "daily", "coloring"], 6);
  const r = FV.validateBatch(pages, { stage, interests: "gardening" });
  ok(r.score >= 90 && r.findings.length === 0 && r.level === "Ready", `stage ${stage} ${dex} ${layout}: scored ${r.score} (${r.level}) ${r.findings.slice(0, 2).join(" | ")}`);
  log.push(r);
}
/* the page engine measures its own white space to keep a page calm; its measure is the validator's, cell for cell, on every page of words */
{
  let n = 0, off = 0, worst = 0;
  for (const stage of [1, 2, 3]) for (const dex of ["steady", "limited", "minimal"]) for (const m of ["reminiscence", "exercise", "dialogue", "phrases", "rhythm"]) {
    if (!E.modules().some(x => x.id === m && (!x.stages || x.stages.includes(stage)))) continue;
    for (const sh of E.generate({ stage, dexterity: dex, decade: 1950 }, { module: m, count: 4, seed: 21 }).sheets) for (const pg of PL.sheetPages(sh, "full").pages) {
      if (pg.ops.some(o => o.t === "path")) continue;                    // drawings are measured by the validator alone
      const a = PL.whiteShare(pg), b = FV.validatePage(pg, { stage }).whitespace.ratio; n++; worst = Math.max(worst, Math.abs(a - b)); if (Math.abs(a - b) > 0.002) off++;
    }
  }
  ok(n > 100 && off === 0, `the engine's own white-space measure agrees with the validator's on ${n} pages of words (${off} differ; the largest gap is ${worst.toFixed(4)})`);
  ok(JSON.stringify(PL.CALM_WHITE) === JSON.stringify(FV.LIMITS.minWhite.text), "and it aims for the validator's own numbers");
}
/* the suggested packet for each stage (three of the master inventory and a coloring page) also scores well */
for (const [stage, mods] of [[1, ["wordgrid", "timeline", "memory", "dialogue", "coloring"]], [2, ["dialogue", "household", "phrases", "coloring"]], [3, ["coloring", "recognition", "rhythm", "dialogue"]]])
  for (const dex of ["steady", "limited", "minimal"]) for (const layout of ["full", "cards8"]) {
    const pages = packet(stage, dex, layout, FV.interleave(mods), 4), r = FV.validateBatch(pages, { stage, interests: "gardening" });
    ok(pages.length === 4 && r.score >= 90 && r.findings.length === 0, `suggested packet, stage ${stage} ${dex} ${layout}: ${pages.length} pages, scored ${r.score} ${r.findings.slice(0, 2).join(" | ")}`);
  }
ok(Object.values(FV.WEIGHTS).reduce((a, b) => a + b, 0) === 100, "the weights add to 100");

/* faults are found and named */
const base = () => packet(2, "steady", "full", ["reminiscence", "exercise", "daily", "coloring"], 4);
const clone = o => JSON.parse(JSON.stringify(o));
{
  let b = clone(base()); b[3].ops.forEach(o => { if (o.t === "path") o.sw = 3 / o.k; });
  let r = FV.validateBatch(b, { stage: 2 }); ok(r.parts.stroke < 100 && r.findings.some(f => /under the 6 px minimum|lighter than the stage|main lines/.test(f)), "a thin line is found (" + r.parts.stroke + ")");
  b = clone(base()); b[0].ops.push({ t: "line", x1: 0, y1: 0, x2: 600, y2: 600, sw: 3, dash: "", role: "" });
  r = FV.validateBatch(b, { stage: 2 }); ok(r.parts.stroke < 100 && r.findings.some(f => /Page 1: A line of 3 px/.test(f)), "a 3 px line on a text page is found");
  b = clone(base()); b[1].ops.push({ t: "rect", x: 100, y: 100, w: 300, h: 300, r: 0, sw: 8, fill: "#999", dash: "" });
  r = FV.validateBatch(b, { stage: 2 }); ok(r.parts.contrast < 100 && r.findings.some(f => /other than black on white|contrast under/.test(f)), "a gray fill is found");
  b = clone(base()); for (let i = 0; i < 400; i++) b[2].ops.push({ t: "line", x1: (i * 37) % 1200, y1: 0, x2: (i * 61) % 1200, y2: 1600, sw: 8, dash: "", role: "" });
  r = FV.validateBatch(b, { stage: 2 }); ok(r.parts.whitespace < 100 && r.findings.some(f => /left empty/.test(f)), "a crowded page is found (" + r.parts.whitespace + ")");
  b = clone(base()); b[0].ops.forEach(o => { if (o.t === "text" && o.role !== "code") o.size = 30; });
  r = FV.validateBatch(b, { stage: 2 }); ok(r.findings.some(f => /floor/.test(f)), "small text is found");
  b = clone(base()); b.push(clone(b[0]));
  r = FV.validateBatch(b, { stage: 2 }); ok(r.parts.variety < 100 && r.findings.some(f => /repeats/.test(f)), "a repeated page is found");
  b = packet(2, "steady", "full", ["reminiscence"], 6);
  r = FV.validateBatch(b, { stage: 2, interests: "x" }); ok(r.parts.variety < 100 && r.framework.find(f => f.id === "variety").pass === false, "six pages of one kind are called out");
  b = clone(base()); b[0].meta.sheetKind = "match"; r = FV.validateBatch(b, { stage: 3 });
  ok(r.framework.find(f => f.id === "errorless").pass === false, "a matching page at stage 3 is not errorless");
  b = clone(base()); b[0].ops.push({ t: "text", x: 600, y: 900, size: 60, str: "Do you remember this?", bold: false, anchor: "middle", role: "" }); r = FV.validateBatch(b, { stage: 2 });
  ok(r.framework.find(f => f.id === "errorless").pass === false, "quiz words are not errorless");
  b = clone(base()); delete b[0].meta.staff; r = FV.validateBatch(b, { stage: 2 });
  ok(r.framework.find(f => f.id === "guidance").pass === false && r.score < 100, "a page with no staff note fails guidance");
  b = packet(1, "steady", "full", ["daily"], 3); b.forEach(pg => { pg.meta.steps = 3; }); r = FV.validateBatch(b, { stage: 1 });
  ok(r.framework.find(f => f.id === "stage-fit").pass === false, "three steps at stage 1 is not the whole task");
  b = packet(3, "steady", "full", ["daily"], 3); b.forEach(pg => { pg.meta.steps = 6; }); r = FV.validateBatch(b, { stage: 3 });
  ok(r.framework.find(f => f.id === "stage-fit").pass === false, "six steps at stage 3 is too many");
  ok(FV.validateBatch([], {}).score >= 0, "an empty batch does not break the validator");
}
/* the empty-space measure agrees with itself and sees ink */
{
  const blank = { w: 1200, h: 1600, meta: { stage: 2 }, ops: [] }, full = { w: 1200, h: 1600, meta: { stage: 2 }, ops: [{ t: "rect", x: 0, y: 0, w: 1200, h: 1600, r: 0, sw: 8, fill: "#000", dash: "" }] };
  ok(FV.whiteShare(FV.occupancy(blank)).white === 1 && FV.whiteShare(FV.occupancy(full)).white < 0.05, "a blank page is all empty and a black page is not");
  ok(FV.pathPoints("M10 10 L20 20 h5 v5 z").length === 5, "path points read M L h v z");
}

/* the library's own drawings */
for (const a of M.assets()) {
  const svg = read(a.filePath), r = FV.scanSvg(svg, { pageWidth: 1040, minStrokePx: 6 });
  ok(Object.keys(r.colors).every(c => ["#000", "#000000", "#fff", "#ffffff", "black", "white"].includes(c)), `${a.id}: a color other than black and white (${Object.keys(r.colors).join(",")})`);
}
ok(FV.scanSvg('<svg viewBox="0 0 800 600"><path d="M0 0L9 9" stroke="#bbb" stroke-width="1"/></svg>', { pageWidth: 800 }).findings.length === 2, "scanSvg names a thin gray line");

/* the report */
{
  const lines = []; const text = FV.report(log[0], { console: { info: s => lines.push(s) } });
  ok(lines.length === 1 && /Clinical Readiness Score: \d+ \/ 100/.test(lines[0]) && /not a clinical certification/.test(lines[0]), "a batch makes one console block that says it is a self-check");
  ok(/contrast and legibility/.test(text) && /\[met\]/.test(text) && FV.format(log[0]) === text, "the report lists the parts and the framework checks");
  ok(FV.report(log[0], { silent: true }) === text, "a silent report still returns its text");
}
ok(FV.FRAMEWORKS.length === 5 && FV.FRAMEWORKS.every(f => f.source && /F679|Montessori|NCCAP|Camp/.test(f.source)), "each framework check names where it comes from");

/* the offline bundle */
{
  const req = PO.required(M), disk = req.filter(p => !fs.existsSync(path.join(ROOT, p)));
  ok(disk.length === 0, "every file the studio needs exists: " + disk.join(", "));
  ok(M.assets().every(a => req.includes(a.filePath)) && req.length === PO.CORE.length + M.assets().length, `the list holds the ${PO.CORE.length} core files and all ${M.assets().length} drawings (${req.length})`);
  const sw = read("sw.js");
  ok(["js/utils/facility-validator.js", "js/utils/print-optimizer.js", "js/generators/activity-engine.js", "activity-studio.html"].every(f => sw.includes('"' + f + '"')), "the service worker keeps the studio's scripts");
  const st = await PO.status(req);
  ok(st.supported === false && st.cached === 0 && /needs the site opened from its web address/.test(PO.say(st)), "with no Cache Storage it says so plainly");
  ok(!/^cognicopia-/.test(PO.CACHE), "the studio's cache name is not one the service worker clears");
  ok(/Ready for offline use: all 49 files/.test(PO.say({ supported: true, total: 49, cached: 49 })) && /12 of 49/.test(PO.say({ supported: true, total: 49, cached: 12 })), "the sentence for the screen reads right");
}

/* print */
{
  const css = PO.css();
  ok(/@page\{size:Letter;margin:\.5in\}/.test(css) && /#printRoot \*\)\{display:none!important\}/.test(css), "the print sheet is Letter with 0.5 in margins and hides everything but the sheets");
  ok(/width:7\.5in;height:9\.9in/.test(css) && /break-after:page/.test(css) && /as-gl\{width:7\.25in;height:9\.66in;margin-left:\.25in\}/.test(css), "one sheet to a page, with a gutter that alternates sides");
  ok(!/https?:|url\(/.test(css), "the print sheet names no outside address");
  const host = { innerHTML: "" }, n = PO.fill(host, ["<svg></svg>", "<svg></svg>", "<svg></svg>"], { gutter: true });
  ok(n === 3 && /as-pp as-gl/.test(host.innerHTML.split("</div>")[0]) && /as-pp as-gr/.test(host.innerHTML.split("</div>")[1]) && /as-pp as-gl/.test(host.innerHTML.split("</div>")[2]), "fill lays out the sheets with the gutter on alternate sides");
  PO.fill(host, ["<svg></svg>"], {}); ok(!/as-gl|as-gr/.test(host.innerHTML), "without a gutter the sheets are plain");
}

/* offline */
for (const f of ["js/utils/facility-validator.js", "js/utils/print-optimizer.js"]) {
  const s = read(f);
  ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|indexedDB|https?:\/\/[^\s"')]*\.(?:com|org|net)/i.test(s), f + " reaches the network or keeps a resident's data");
}

if (problems.length) { console.error("Facility validator check FAILED (" + problems.length + "):"); problems.slice(0, 25).forEach(p => console.error("  - " + p)); process.exit(1); }
console.log("facility validator check passed: " + passed + " checks (the score and its faults, every batch the studio makes, the library's drawings, the report, the offline file list, the print sheet, no network)");
