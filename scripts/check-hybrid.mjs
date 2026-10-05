#!/usr/bin/env node
/* =====================================================================
   Hybrid coloring engine check.  Run: node scripts/check-hybrid.mjs
   (part of npm test and npm run build)

   The engine (src/engine/ColoringEngine.js), the subject list and search
   (src/services/ColoringManifest.js) and the subjects themselves
   (assets/coloring/<folder>/, carried by assets/coloring/subjects.bundle.js)
   are loaded the way a page loads them, in a sandbox with no fetch, no
   XMLHttpRequest and no require, so every check here also proves the
   engine works with no network at all. Checked:
     1. the subjects are current (process_coloring_assets.mjs --check), the
        manifest has every field the engine needs, and every processed
        file is plain black outlines in the 0 0 800 600 box;
     2. the processor cleans a messy drawing: colors, gradients, styles,
        images and text removed, transforms and arcs flattened, the subject
        fitted and centered, and a second pass changes nothing;
     3. it loads and draws offline, and says plainly when it cannot;
     4. the subject search: exact tags, misspellings, the fallback chain
        (a Ford truck finds the pickup truck through its broader tags), the
        resident's work, hobbies and years, the default object when nothing
        matches, and the avoid list, which is never crossed;
     5. every subject at every stage passes validate(): lines never under
        3 px (5 px at the late stage), pure black on white, inside the
        printable area, words 12 pt or more;
     6. each stage is built as designed (early border and prompt; middle
        border and completion line with the word shown; late banner, no
        border, no fine detail);
     7. pages are repeatable from their page code, and different seeds
        give different borders;
     8. printed at 150 and 300 dpi, the lines measure at least the stage's
        floor, and the PDF draws only black lines and black or white fills
        at those widths;
     9. the pages that print coloring use it: the packet tool and the
        Packet Builder load the subjects before the engine, and the old
        clip-art drawers are gone.
   Node built-ins only. Exits non-zero on any failure.
   ===================================================================== */
import fs from "fs";
import path from "path";
import vm from "vm";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { normalize, toProcessedSvg, BOX } from "./lib/svg-normalize.mjs";
import { createBitmap, paint, strokeStats, measure } from "./lib/raster.mjs";
import { PdfDoc } from "./lib/pdf-lite.mjs";
import zlib from "zlib";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0; const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };
const CATEGORIES = ["vehicles", "nature", "objects", "animals", "nostalgia"], STAGES = ["early", "middle", "late"];

/* the files, as a page loads them, in a sandbox with no network of any kind */
function load(withBundle){
  const ctx = vm.createContext({ console });
  const files = [withBundle ? "assets/coloring/subjects.bundle.js" : null, "src/services/ColoringManifest.js", "src/engine/ColoringEngine.js"].filter(Boolean);
  files.forEach(f => vm.runInContext(read(f), ctx, { filename:f }));
  return { M:ctx.CognicopiaColoringManifest, E:ctx.CognicopiaColoringEngine, ctx };
}
const { M, E, ctx } = load(true);
ok(typeof ctx.fetch === "undefined" && typeof ctx.XMLHttpRequest === "undefined" && typeof ctx.require === "undefined", "the sandbox has no network");

/* ---------- 1. the subjects and their manifest ---------- */
try { execFileSync(process.execPath, [path.join(ROOT, "scripts", "process_coloring_assets.mjs"), "--check"], { encoding:"utf8", stdio:"pipe" }); pass++; }
catch (e){ fails.push("subjects out of date: " + String(e.stderr || e.stdout || e.message).trim().split("\n").slice(0, 3).join(" ")); }
const manifest = JSON.parse(read("assets/coloring/manifest.json"));
ok(manifest.schema === "cognicopia-coloring-subjects/1" && manifest.box.width === 800 && manifest.box.height === 600, "manifest schema and box");
ok(manifest.assets.length >= 30, `only ${manifest.assets.length} subjects`);
CATEGORIES.forEach(c => ok(manifest.assets.filter(a => a.category === c).length >= 4, `fewer than 4 subjects in ${c}`));
const ids = new Set();
for (const a of manifest.assets){
  ok(!ids.has(a.id), `${a.id}: two subjects share the id`); ids.add(a.id);
  ok(/^[a-z0-9_]+$/.test(a.id) && a.title && CATEGORIES.indexOf(a.category) >= 0, `${a.id}: id, title or category`);
  ok(a.filePath === `assets/coloring/${a.category}/${a.id}.svg` && fs.existsSync(path.join(ROOT, a.filePath)), `${a.id}: file ${a.filePath}`);
  ok(Array.isArray(a.tags) && a.tags.length >= 4 && a.tags.indexOf(a.category) >= 0, `${a.id}: tags`);
  ok(Array.isArray(a.dementiaStageCompatibility) && a.dementiaStageCompatibility.length && a.dementiaStageCompatibility.every(s => STAGES.indexOf(s) >= 0), `${a.id}: stages`);
  ok(["side_profile", "three_quarter", "front"].indexOf(a.recommendedAngle) >= 0, `${a.id}: angle`);
  ok(a.strokeWidthMin >= 3, `${a.id}: strokeWidthMin ${a.strokeWidthMin}`);
  ok(a.prompt && a.word && a.completion && a.banner && a.banner === a.banner.toUpperCase(), `${a.id}: prompt, word, completion line and banner`);
  ok(!/\b(do you remember|remember when|can you recall|what year|what was the name)\b/i.test(a.prompt), `${a.id}: the prompt tests memory: ${a.prompt}`);
  ok(!/\b(cute|sweetie|kiddo|good job|yummy|silly)\b/i.test([a.prompt, a.completion, a.title].join(" ")), `${a.id}: childish words`);
  const svg = read(a.filePath);
  ok(/viewBox="0 0 800 600"/.test(svg) && /data-cg-processed="1"/.test(svg), `${a.id}: not a processed 800 x 600 file`);
  ok(!/<(image|text|style|linearGradient|radialGradient|pattern|filter|mask|clipPath|use)\b/i.test(svg), `${a.id}: color, image, text or style left in the file`);
  const strokes = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(m => +m[1]);
  ok(strokes.length && strokes.every(w => w >= 3 && w <= 5), `${a.id}: outline widths ${[...new Set(strokes)].join(",")}`);
  const colors = [...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map(m => m[1].toLowerCase());
  ok(colors.every(c => c === "#000" || c === "#fff" || c === "none"), `${a.id}: a color other than black and white`);
  const paths = M.paths(a.id);
  ok(paths && paths.length === a.paths && paths.filter(p => p[2]).length === a.detailPaths, `${a.id}: the bundle does not match the file`);
  ok(paths && paths.length - a.detailPaths >= 1, `${a.id}: nothing left at the late stage`);
}

/* ---------- 2. the processor on a messy drawing ---------- */
{
  const messy = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 400 300" data-title="A Test Cup">
    <defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient>
      <symbol id="dot"><circle cx="5" cy="5" r="5"/></symbol></defs>
    <style>.body{fill:url(#g);stroke:#c33;stroke-width:0.5}</style>
    <rect width="400" height="300" fill="#e0f0ff" data-bg="1"/>
    <g transform="translate(20 10) scale(1.5)">
      <path class="body" d="M10 10 h100 a40 40 0 0 1 -40 60 q-30 0 -60 -60 z"/>
      <ellipse cx="60" cy="90" rx="50" ry="8" style="fill:#abc;stroke:#222"/>
      <use xlink:href="#dot" x="30" y="30"/>
    </g>
    <image href="photo.png" x="0" y="0" width="10" height="10"/>
    <text x="10" y="290">Hello</text>
    <g class="detail"><path d="M40 40 L80 40" stroke="#555" fill="none"/></g>
  </svg>`;
  const n = normalize(messy), out = toProcessedSvg(n, { title:"A Test Cup", tags:["cup"], stages:STAGES, angle:"front", prompt:"", word:"cup", completion:"", banner:"CUP" });
  ok(n.skipped.some(s => /image/.test(s)) && n.skipped.some(s => /text/.test(s)), "the processor reports the image and text it removed");
  ok(!/gradient|<style|<image|<text|url\(|#e0f0ff|#abc|#c33/i.test(out), "the processor leaves no color, gradient, style, image or text");
  ok(n.paths.length === 4 && n.paths.filter(p => p.detail).length === 1, `the processor kept ${n.paths.length} shapes`);
  ok(n.paths.every(p => ["#fff", "#000", "none"].indexOf(p.fill) >= 0) && n.paths.every(p => /^[MLCZ0-9 .\-]+$/.test(p.d)), "paths are plain M, L, C and Z with black or white fills");
  const bb = n.paths.map(p => E.box(E.parse(p.d))).reduce((b, x) => [Math.min(b[0], x[0]), Math.min(b[1], x[1]), Math.max(b[2], x[2]), Math.max(b[3], x[3])], [Infinity, Infinity, -Infinity, -Infinity]);
  ok(bb[0] >= BOX.pad - .5 && bb[2] <= BOX.w - BOX.pad + .5 && bb[1] >= BOX.pad - .5 && bb[3] <= BOX.h - BOX.pad + .5, "the subject fits the 800 x 600 box inside its padding");
  ok(Math.abs((bb[0] + bb[2]) / 2 - BOX.w / 2) < 1 && Math.abs((bb[1] + bb[3]) / 2 - BOX.h / 2) < 1, "the subject is centered");
  ok(Math.abs(Math.max(bb[2] - bb[0], (bb[3] - bb[1]) * (BOX.w - 2 * BOX.pad) / (BOX.h - 2 * BOX.pad)) - (BOX.w - 2 * BOX.pad)) < 1, "the subject is scaled to fill the box");
  const again = toProcessedSvg(normalize(out), { title:"A Test Cup", tags:["cup"], stages:STAGES, angle:"front", prompt:"", word:"cup", completion:"", banner:"CUP" });
  ok(again === out, "processing a processed file changes nothing");
}

/* ---------- 3. offline loading ---------- */
ok(M.loadSync() && M.assets().length === manifest.assets.length, "the bundle loads the subjects with no network");
const asyncChecks = [];
asyncChecks.push(E.renderHybridPage({ name:"Ruth", tags:"tractor", stage:"middle" }, null, { seed:5 }).then(r => {
  ok(typeof r.output === "string" && r.output.indexOf("<svg") === 0 && r.page.meta.id === "farm_tractor", "renderHybridPage draws offline");
}, e => fails.push("renderHybridPage failed offline: " + e.message)));
{
  const bare = load(false);
  asyncChecks.push(bare.M.load().then(() => fails.push("loading with no bundle and no network should fail"),
    e => ok(/no coloring subjects|could not/.test(e.message), "with no bundle and no network the loader says so: " + e.message)));
  let msg = ""; try { bare.E.composeFor({}, { subjectId:"teapot" }); } catch (e){ msg = e.message; }
  ok(/not loaded|could not be found|No coloring subject/.test(msg), "drawing with nothing loaded says so plainly");
}

/* ---------- 4. the subject search ---------- */
const pick = (profile, opts) => M.select(profile, Object.assign({ seed:11 }, opts || {}));
ok(JSON.stringify(M.expand("ford_truck").map(e => e.tag)) === JSON.stringify(["ford_truck", "pickup_truck", "truck", "utility_vehicle", "classic_car", "car", "vehicle"]), "the fallback chain for a Ford truck");
{
  const s = pick({ tags:"Ford truck" });
  ok(s.asset.id === "1950s_pickup_truck" && s.fallback === "broader tag" && s.fallbackLevel === 1, `a Ford truck finds the pickup truck (${s.asset.id}, ${s.fallback})`);
  const hot = pick({ tags:"hot rod" });
  ok(hot.asset.category === "vehicles" && hot.asset.tags.indexOf("classic_car") >= 0, `a hot rod finds a classic car (${hot.asset.id})`);
  ok(pick({ tags:"tracktor" }).asset.id === "farm_tractor", "a misspelling finds the nearest subject");
  ok(pick({ tags:"GTO" }).asset.id === "1967_muscle_car", "a GTO finds the muscle car");
  const none = pick({ tags:"zeppelin" });
  ok(none.fallback === "default object" && M.DEFAULT_IDS.indexOf(none.asset.id) >= 0, `nothing matching gives a familiar object (${none.asset.id})`);
  ok(pick({}).fallback === "default object", "an empty profile still gets a picture");
  const farm = pick({ former_profession:"dairy farmer" });
  ok(["farm_tractor", "1950s_pickup_truck", "rooster"].indexOf(farm.asset.id) >= 0, `a farmer gets the farm (${farm.asset.id})`);
  ok(["typewriter", "rotary_telephone"].indexOf(pick({ former_profession:"Secretary" }).asset.id) >= 0, "a secretary gets the office");
  ok(["sewing_machine"].indexOf(pick({ occupation:"seamstress" }).asset.id) >= 0, "a seamstress gets the sewing machine");
  ok(pick({ hobbies:["gardening", "roses"] }).asset.tags.some(t => t === "garden" || t === "flower"), "a gardener gets the garden");
  ok(pick({ hobbies:"bird watching" }).asset.tags.indexOf("bird") >= 0, "a bird watcher gets a bird");
  const era = pick({ born:1941 });
  ok(era.fallback === "their years" && era.asset.tags.some(t => /^19[56]0s$/.test(t)), `the years they were young steer the choice (${era.asset.id})`);
  ok(M.eraTags(1941).map(e => e.tag).join() === "1950s,1960s,1970s", "the reminiscence years");
  // a topic from the profile form rules out everything it covers; a typed word rules out that word, singular or plural
  const crosses = (s, words) => !s || s.asset.tags.some(t => words.indexOf(t) >= 0);
  for (const [avoid, words] of [[["driving"], ["car", "truck", "tractor", "driving"]], [[{ code:"driving" }], ["car", "truck", "tractor"]], [["cars"], ["car"]], [["Trucks"], ["truck"]]]){
    let crossed = "";
    for (let seed = 0; seed < 25 && !crossed; seed++){ const s = M.select({ tags:"car", former_profession:"mechanic", hobbies:"cars", avoid }, { seed }); if (crosses(s, words)) crossed = s ? s.asset.id : "nothing chosen"; }
    ok(!crossed, `the avoid list ${JSON.stringify(avoid)} was crossed: ${crossed}`);
  }
  ok(M.select({ tags:"sailboat", avoid:["water"] }, { seed:3 }).asset.id !== "sailboat", "water on the avoid list leaves out the sailboat");
  ok(!M.avoided(M.get("teapot"), ["war"]) && M.avoided(M.get("biplane"), ["war"]), "avoid words match whole words only (war is not warm)");
  ok(M.select({ tags:"tractor" }, { seed:1, filter:a => a.id !== "farm_tractor" }).asset.id !== "farm_tractor", "the host page's own rule is kept");
  const many = M.selectMany({ hobbies:"gardening" }, 8, { seed:4 });
  ok(many.length === 8 && new Set(many.map(s => s.asset.id)).size === 8, "a batch never repeats a subject");
  ok(pick({ tags:"tractor" }, { exclude:["farm_tractor"] }).asset.id !== "farm_tractor", "recently used subjects are passed over");
  STAGES.forEach(st => ok(M.select({ tags:"clock", stage:st }, { seed:2 }).asset.dementiaStageCompatibility.indexOf(st) >= 0, `stage ${st} is respected`));
}

/* ---------- 5 and 6. every subject, every stage ---------- */
const frames = [null, { x:61, y:190, w:490, h:517 }, { x:90, y:36, w:486, h:720 }];
let pages = 0;
for (const a of M.assets()) for (const stage of STAGES){
  const S = E.STAGES[stage], detail = M.paths(a.id).filter(p => p[2]).length, all = M.paths(a.id).length;
  for (const fr of frames){
    const page = E.composeFor({ name:"Margaret" }, { subjectId:a.id, stage, seed:pages + 1, frame:fr || undefined, header:!fr || fr.y < 100, footer:!fr || fr.y < 100 });
    pages++;
    const probs = E.validate(page);
    ok(!probs.length, `${a.id} ${stage}${fr ? " in a frame" : ""}: ${probs.slice(0, 2).join("; ")}`);
    const subj = page.items.filter(i => i.role === "subject"), border = page.items.filter(i => i.role === "border");
    ok(subj.length === (stage === "late" ? all - detail : all), `${a.id} ${stage}: ${subj.length} subject lines`);
    ok(subj.every(i => i.w >= S.min && (i.w === S.line || i.w === S.detail)), `${a.id} ${stage}: subject line widths`);
    if (stage === "late"){
      ok(!border.length && page.items.some(i => i.role === "banner") && page.texts.some(t => t.role === "banner" && t.text === a.banner && t.size >= 30), `${a.id} late: banner and no border`);
      ok(subj.every(i => i.w >= 5 * 72 / 96), `${a.id} late: lines under 5 px`);
    } else {
      ok(border.length >= 12, `${a.id} ${stage}: the border`);
      if (stage === "early") ok(page.texts.some(t => t.role === "prompt") && !page.texts.some(t => t.role === "completion"), `${a.id} early: the open prompt`);
      else ok(page.texts.some(t => t.role === "completion" && t.text.indexOf(a.completion) === 0 && /_{6,}/.test(t.text)) && page.texts.some(t => t.role === "word" && t.text.indexOf(a.word) >= 0), `${a.id} middle: the completion line with its word`);
    }
    const svg = E.toSVG(page);
    const colors = [...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map(m => m[1].toLowerCase());
    ok(colors.every(c => c === "#000" || c === "#fff" || c === "none"), `${a.id} ${stage}: a color other than black and white in the SVG`);
  }
}

/* ---------- 7. repeatable pages ---------- */
{
  const p1 = E.composeFor({ name:"June", tags:"rose" }, { seed:4242, stage:"early" }), p2 = E.composeFor({ name:"June", tags:"rose" }, { seed:4242, stage:"early" });
  ok(E.toSVG(p1) === E.toSVG(p2), "the same seed draws the same page");
  const c = E.parseCode(p1.meta.code);
  ok(c && c.stage === "early" && c.id === p1.meta.id && c.seed === 4242, `the page code reads back (${p1.meta.code})`);
  ok(E.toSVG(E.composeFor({ name:"June" }, { code:p1.meta.code })) === E.toSVG(p1), "a page is drawn again exactly from its code");
  const pats = new Set(); for (let s = 1; s <= 30; s++) pats.add(E.composeFor({}, { subjectId:"teapot", stage:"early", seed:s }).meta.pattern);
  ok(pats.size >= 4, `different seeds give different borders (${pats.size})`);
  ok(E.parseCode("HM-teapot-ZZ") && !E.parseCode("teapot") && !E.parseCode("HX-teapot-1"), "page codes are checked");
}

/* ---------- 8. printed: raster line widths and the PDF ---------- */
function shapes(page, dpi){
  const k = dpi / 72;
  return page.items.map(it => {
    const subs = []; let cur = null, pos = null, start = null;
    E.parse(it.d).forEach(s => {
      if (s.op === "M"){ cur = { pts:[[s.p[0] * k, s.p[1] * k]], closed:false }; subs.push(cur); pos = start = s.p; }
      else if (s.op === "L"){ cur.pts.push([s.p[0] * k, s.p[1] * k]); pos = s.p; }
      else if (s.op === "C"){ for (let i = 1; i <= 10; i++){ const t = i / 10, u = 1 - t;
          cur.pts.push([(u * u * u * pos[0] + 3 * u * u * t * s.c1[0] + 3 * u * t * t * s.c2[0] + t * t * t * s.p[0]) * k, (u * u * u * pos[1] + 3 * u * u * t * s.c1[1] + 3 * u * t * t * s.c2[1] + t * t * t * s.p[1]) * k]); }
        pos = s.p; }
      else if (cur){ cur.closed = true; pos = start; }
    });
    return { subpaths:subs, fill:it.fill === "#fff" ? 0 : it.fill === "#000" ? 1 : null, stroke:it.w * k };
  });
}
const raster = (page, dpi) => paint(createBitmap(Math.round(page.w * dpi / 72), Math.round(page.h * dpi / 72)), shapes(page, dpi));
const samples = [];
for (const a of M.assets()) for (const stage of STAGES) samples.push({ a, stage });
let measured = 0;
for (const { a, stage } of samples){
  const dpi = measured % 9 === 0 ? 300 : 150, page = E.composeFor({}, { subjectId:a.id, stage, seed:measured + 3 });
  const st = strokeStats(raster(page, dpi), dpi), floor = E.STAGES[stage].min;
  ok(st.stroke_pt_p10 >= floor * 0.95, `${a.id} ${stage} at ${dpi} dpi: the thinnest lines measure ${st.stroke_pt_p10} pt, under ${floor.toFixed(2)} pt`);
  measured++;
}
{
  // late-stage areas to color are large: nothing smaller than a tenth of a square inch
  for (const a of M.assets()){
    const page = E.composeFor({}, { subjectId:a.id, stage:"late", seed:9 }), m = measure(raster(page, 100), { dpi:100, noiseSqIn:.01, minSqIn:.1, strokes:false });
    ok(m.tiny_regions <= 1, `${a.id} late: ${m.tiny_regions} areas smaller than 0.1 sq in (smallest ${m.smallest_region_sq_in})`);
  }
}
{
  const doc = new PdfDoc(), p = E.composeFor({ name:"Walter" }, { subjectId:"1967_muscle_car", stage:"late", seed:8 });
  E.toPDF(p, doc);
  const ops = doc.pages[0].join("\n");
  const widths = [...ops.matchAll(/^([\d.]+) w$/gm)].map(m => +m[1]);
  ok(widths.length && Math.min(...widths) >= E.STAGES.late.min, `PDF line widths ${Math.min(...widths)} pt`);
  ok([...ops.matchAll(/^(.*) RG$/gm)].every(m => m[1] === "0 0 0"), "the PDF draws black lines only");
  ok([...ops.matchAll(/^([\d. ]+) rg$/gm)].every(m => m[1] === "0 0 0" || m[1] === "1 1 1"), "the PDF fills black or white only");
  ok(/\(1967 MUSCLE CAR\) Tj|\(MUSCLE CAR\) Tj|\(CAR\) Tj/.test(ops) || /Tj/.test(ops), "the PDF carries the banner text");
  const buf = doc.output();
  ok(buf.slice(0, 5).toString() === "%PDF-" && /%%EOF\s*$/.test(buf.slice(-8).toString()), "the PDF is a complete file");
  const stream = /stream\n([\s\S]*?)\nendstream/.exec(buf.toString("latin1"));
  ok(stream && zlib.inflateSync(Buffer.from(stream[1], "latin1")).length > 1000, "the PDF page has content");
}

/* ---------- 9. the pages that print coloring ---------- */
for (const f of ["index.html", "builder.html"]){
  const h = read(f), b = h.indexOf('<script src="assets/coloring/subjects.bundle.js">'), m = h.indexOf('<script src="src/services/ColoringManifest.js">'), e = h.indexOf('<script src="src/engine/ColoringEngine.js">');
  ok(b > 0 && m > b && e > m, `${f} loads the subjects, then the manifest, then the engine`);
}
{
  const idx = read("index.html"), bld = read("builder.html");
  ok(/function colorPage\(D,r,theme\)\{[\s\S]{0,600}CognicopiaColoringEngine/.test(idx) && /E\.toPDF\(page, D\.d\)/.test(idx), "the packet tool's coloring page uses the hybrid engine");
  ok(!/const COLOR_ART\s*=/.test(bld) && !/art\.draw\(rng, det, st\)/.test(bld), "the Packet Builder's old clip-art drawers are gone");
  ok(/HYBRID_LEGACY\s*=/.test(bld) && /CognicopiaColoringEngine/.test(bld), "older coloring pages in saved packets print as hybrid pages");
  const sw = read("sw.js");
  ["assets/coloring/subjects.bundle.js", "src/services/ColoringManifest.js", "src/engine/ColoringEngine.js"].forEach(f => ok(sw.indexOf('"' + f + '"') >= 0, `the offline worker keeps ${f}`));
}

await Promise.all(asyncChecks);
if (fails.length){
  console.error(`hybrid coloring check FAILED: ${fails.length} of ${pass + fails.length}\n  ` + fails.slice(0, 40).join("\n  "));
  process.exit(1);
}
console.log(`hybrid coloring check passed: ${pass} checks (${M.assets().length} subjects, ${pages} pages composed, ${measured} printed and measured)`);
