#!/usr/bin/env node
/* =====================================================================
   Checks for the Cognicopia Coloring library: the engine, every design at
   every tier, the packs, the dignity filter, the prompt engine, the
   catalog and its files, and the ingest pipeline end to end (on pictures
   made on the spot, in a temporary inbox, nothing written to the site).
   Node built-ins only.
   ===================================================================== */
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { loadCognicopiaColoring, ROOT, svgProblems } from "./lib/cognicopia-coloring.mjs";
import { validate } from "./lib/json-schema.mjs";
import { createBitmap, paint, shapesFromRender } from "./lib/raster.mjs";
import { encodeRGBPNG } from "./lib/png.mjs";
import { parseSVG, shapesToSVG } from "./lib/svg-raster.mjs";

let pass = 0; const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };
const { C, P } = loadCognicopiaColoring();
const run = (script, args) => execFileSync(process.execPath, [path.join(ROOT, "scripts", script), ...args], { encoding:"utf8", stdio:["ignore", "pipe", "pipe"] });

/* 1. the library */
const designs = C.designs(), packs = C.packs();
ok(designs.length >= 100, `${designs.length} designs (want at least 100)`);
ok(packs.length >= 50 && packs.length <= 100, `${packs.length} packs (want 50 to 100)`);
const cats = new Set(designs.map(d => d.cat));
["classic-vehicles", "botanical-garden", "nostalgic-heritage", "wildlife-nature", "bold-easy-patterns", "home-everyday", "zentangle-mandalas", "vintage-americana", "seasons-holidays"].forEach(c => ok(cats.has(c) && designs.filter(d => d.cat === c).length >= 10, "category " + c + " has at least 10 designs"));
ok(new Set(designs.map(d => d.id)).size === designs.length, "design ids are unique");
const inPack = new Set(); packs.forEach(p => p.designs.forEach(id => { ok(!!C.design(id), `pack ${p.id} lists unknown design ${id}`); inPack.add(id); }));
designs.forEach(d => ok(inPack.has(d.id), `${d.id} is in no pack`));
packs.forEach(p => ok(p.designs.length >= 3 && new Set(p.designs).size === p.designs.length, `pack ${p.id} has 3+ distinct pages`));
for (const d of designs) for (const t of [1, 2, 3]){
  const r = C.render(d.id, t);
  ok(r.items.length > 0, `${d.id} T${t} draws nothing`);
  const svg = C.toSVG(r, { standalone:true });
  ok(!svgProblems(svg).length, `${d.id} T${t}: ` + svgProblems(svg).join("; "));
}

/* 2. dignity: every word a resident or family member will read */
const texts = [];
designs.forEach(d => texts.push([d.id, [d.title, d.talk, d.tags.join(" ")].join(" | ")]));
packs.forEach(p => texts.push(["pack " + p.id, p.title + " | " + p.about]));
texts.forEach(([who, t]) => { const hits = P.dignityCheck(t); ok(!hits.length, `${who}: ${hits.map(h => h.term).join(", ")}`); });
ok(P.dignityCheck("A cute cartoon kitty for kids").length >= 3, "the filter catches juvenile words");
ok(P.dignityCheck("Do you remember what year was this?").some(h => h.kind === "memory-test"), "the filter catches memory quizzing");
ok(P.dignityCheck("Good job, sweetie").some(h => h.kind === "elderspeak"), "the filter catches elderspeak");
ok(!P.dignityCheck("Tell me about a garden you loved.").length, "an open invitation passes");

/* 3. the prompt engine: the strict templates */
["professional print-ready", "crisp continuous paths", "mechanically and anatomically coherent proportions", "enclosing every colorable region", "pure black ink on pure white", "0% grayscale shading", "3:4"].forEach(w => ok(P.POSITIVE.toLowerCase().includes(w), "positive template has: " + w));
["shading", "grayscale", "childish", "noise", "thin or broken lines", "cartoon faces", "cluttered background", "sketchy lines", "stray strokes", "bleeding lines", "open or unclosed contours", "floating line artifacts", "distorted geometry", "overlapping messy strokes", "complex hatch shading"].forEach(w => ok(P.NEGATIVE.includes(w), "negative template has: " + w));
const j = P.job({ subject:"a 1950s percolator on a stove", category:"nostalgic-heritage", tier:3 });
ok(/^ai-nostalgic-heritage-[a-z0-9-]+-t3$/.test(j.job_id) && j.prompts.midjourney.includes("--ar 3:4 --no ") && j.prompts["stable-diffusion"].includes("Negative prompt:") && j.prompts["dall-e-3"].includes("Avoid:"), "a job carries every generator's prompt");
ok(j.positive.includes("recognizable era-appropriate object proportions") && j.expect.minimum_dpi === 300 && j.expect.color_mode === "1-bit black and white", "generation job carries category guidance and print expectations");
const carPrompt = P.job({ subject:"a vintage sedan", category:"classic-vehicles", tier:1 });
const plantPrompt = P.job({ subject:"an iris", category:"botanical-garden", tier:1 });
const latePrompt = P.job({ subject:"a flower", category:"botanical-garden", tier:3 });
const middlePrompt = P.job({ subject:"a percolator", category:"nostalgic-heritage", tier:2 });
ok(carPrompt.positive.includes("clean hubs") && plantPrompt.positive.includes("continuous unbroken leaf veins"), "vehicle and botanical prompts add category-specific fidelity guidance");
ok(carPrompt.positive.includes("Early Tier") && middlePrompt.positive.includes("Middle Tier") && middlePrompt.positive.includes("clear figure-ground separation") && latePrompt.positive.includes("Late Tier") && latePrompt.positive.includes("one iconic focal subject only"), "tier-specific clinical prompt constraints remain explicit");
ok(!/\b(cute|kids|cartoon)\b/.test(j.positive), "positive prompts never ask for childish art");
const noisySvg = parseSVG('<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80"/><path d="M 20 20 L 20 20"/><line x1="500" y1="500" x2="510" y2="510"/></svg>');
ok(noisySvg.shapes.length === 1 && noisySvg.notes.some(n => n.includes("removed 2")), "SVG ingest removes degenerate and wholly off-canvas paths");
ok(shapesToSVG([], { w:600, h:800 }).includes('stroke-linejoin="round"'), "SVG writer retains round stroke joins");
const jobs = fs.readFileSync(path.join(ROOT, "src", "data", "cognicopia_coloring_prompt_jobs.jsonl"), "utf8").trim().split("\n").map(l => JSON.parse(l));
ok(jobs.length === designs.length * 3 + P.IDEAS.reduce((n, i) => n + i[3].length, 0), `${jobs.length} prompt jobs`);
ok(new Set(jobs.map(x => x.job_id)).size === jobs.length, "prompt job ids are unique");

/* 4. the catalog, its schema and its files (and that it is current) */
try { run("generate_coloring_manifest.js", ["--check"]); pass++; } catch (e){ fails.push("catalog out of date: " + String(e.stderr || e.message).trim().split("\n")[0]); }
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "cognicopia_coloring_catalog.json"), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "cognicopia_coloring_catalog.schema.json"), "utf8"));
const errs = validate(catalog, schema);
ok(!errs.length, "catalog schema: " + errs.slice(0, 5).join("; "));
ok(catalog.assets.length === designs.length * 3 + catalog.counts.ingested, "one asset per design and tier");
const REQUIRED = ["id", "title", "category", "cognitive_tier", "tags", "line_weight", "aspect_ratio", "svg_path"];
for (const a of catalog.assets){
  REQUIRED.forEach(k => ok(a[k] != null && a[k] !== "", `${a.id} lacks ${k}`));
  ok(["3:4", "8.5x11"].includes(a.aspect_ratio), `${a.id} aspect ${a.aspect_ratio}`);
  ok(/^Tier [123] - /.test(a.cognitive_tier) && ["thick", "ultra-bold", "extra-bold-sensory"].includes(a.line_weight), `${a.id} tier/weight`);
  const f = a.svg_path || a.png_path, buf = fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f)) : null;
  ok(buf && crypto.createHash("sha256").update(buf).digest("hex") === a.sha256, `${a.id}: ${f} missing or changed`);
  ok(a.metrics.tiny_regions <= C.TIERS[a.tier].maxTiny, `${a.id}: ${a.metrics.tiny_regions} small areas`);
}

/* 5. the ingest pipeline, end to end, on pictures made here */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cognicopia-coloring-ingest-"));
try {
  const aaPNG = (id, tier, wIn, dpi, pt, shade) => {
    const S = 3, W = Math.round(wIn * dpi), H = Math.round(wIn / .75 * dpi), r = C.render(id, tier);
    C.WEIGHTS.__t = { id:"__t", pt, detailPt:pt, px:pt / .75 };
    const big = paint(createBitmap(W * S, H * S), shapesFromRender(C, r, { widthIn:wIn, dpi:dpi * S, weight:"__t" }));
    delete C.WEIGHTS.__t;
    const rgb = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++){
      let s = 0; for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) s += big.px[(y * S + dy) * W * S + x * S + dx];
      let v = 255 - Math.round(255 * s / (S * S));
      if (shade && x > W * .3 && x < W * .6 && y > H * .3 && y < H * .5 && v > 200) v = 140;
      rgb.fill(v, (y * W + x) * 3, (y * W + x) * 3 + 3);
    }
    return encodeRGBPNG({ w:W, h:H, rgb });
  };
  fs.writeFileSync(path.join(tmp, "porch-sunflower.png"), aaPNG("sunflower", 2, 4, 150, 1.2, false));
  fs.writeFileSync(path.join(tmp, "porch-sunflower.json"), JSON.stringify({ title:"Sunflower by the Porch", category:"botanical-garden", tier:2, generator:"stable-diffusion" }));
  fs.writeFileSync(path.join(tmp, "shaded-teapot.png"), aaPNG("teapot-and-cup", 1, 5, 120, 3, true));
  fs.writeFileSync(path.join(tmp, "shaded-teapot.json"), JSON.stringify({ title:"Cute Teapot for Kids", category:"nostalgic-heritage" }));
  fs.copyFileSync(path.join(ROOT, "assets", "coloring", "classic-vehicles", "cc-farm-tractor-t2.svg"), path.join(tmp, "tractor.svg"));
  fs.writeFileSync(path.join(tmp, "tractor.json"), JSON.stringify({ title:"Farm Tractor", category:"classic-vehicles", tier:2 }));
  const out = run("ingest_coloring_assets.mjs", ["--inbox", tmp, "--dry-run", "--json"]);
  const recs = out.trim().split("\n").filter(l => l.startsWith("{")).map(l => JSON.parse(l));
  const by = t => recs.find(r => r.title === t);
  ok(recs.length === 3, `ingest produced ${recs.length} records`);
  recs.forEach(r => ok(!validate(r, { $ref:"#/$defs/asset" }, schema).length, `ingest record ${r.id} fits the schema`));
  recs.forEach(r => ok(r.review_status === "needs-review" && r.source === "ingested", `${r.id} waits for review`));
  const sun = by("Sunflower by the Porch"), tea = by("Cute Teapot for Kids"), tr = by("Farm Tractor");
  ok(sun && sun.format === "png" && sun.png_dpi === 300 && sun.ingest.auto_fixes.some(f => /thickened/.test(f)) && sun.ingest.checks.filter(c => c.result === "fail").length === 0, "thin anti-aliased PNG is thickened to pass");
  ok(tea && tea.ingest.checks.find(c => c.id === "pure-black-white").result === "fail" && tea.ingest.checks.find(c => c.id === "dignity-words").result === "fail", "shading and childish words are flagged");
  ok(tr && tr.format === "svg" && tr.ingest.checks.every(c => c.result !== "fail"), "a clean vector stays vector and passes");
  ok(recs.every(r => r.ingest.checks.some(c => c.result === "human")), "every picture still needs a person's review");
} finally { fs.rmSync(tmp, { recursive:true, force:true }); }

/* 6. the Packet Builder's coloring library: page layout and queue pages,
   run from the builder's own script with the same engine files */
{
  const vm = await import("vm");
  const html = fs.readFileSync(path.join(ROOT, "builder.html"), "utf8");
  const ui = (/<script id="cc-ui">([\s\S]*?)<\/script>/.exec(html) || [])[1];
  ok(!!ui, "builder.html has the coloring library script");
  ok(html.includes('<script src="assets/cognicopia-coloring/cognicopia-coloring.js"></script>') && html.includes('<script src="assets/services/vectorEngine.js"></script>'), "builder.html loads the library and the vector engine");
  ok(ui.includes("Cognicopia · Cognicopia Coloring") && ui.includes('title:"Cognicopia Coloring pages"') && ui.includes('subject:"Cognicopia Coloring"'), "coloring PDF footer and metadata use the Cognicopia Coloring brand");
  const sb = { console, settings:{}, store:{ set(){} }, esc:t => String(t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";"), todayISO:() => "2026-01-01", performance:{ now:() => Date.now() }, addEventListener(){} };
  sb.window = sb; sb.globalThis = sb; vm.createContext(sb);
  for (const f of ["assets/cognicopia-coloring/cognicopia-coloring.js", "assets/services/vectorEngine.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sb);
  vm.runInContext(ui + "\nglobalThis.CogniLibrary = CogniLibrary;", sb);
  const L = sb.CogniLibrary, V = sb.CogniVectorEngine;
  const bools = [false, true];
  for (const tier of [1, 2, 3]) for (const header of bools) for (const title of bools) for (const caption of bools) for (const largePrint of bools)
    for (const legend of ["off", "anxiety-reduction", "high-contrast"]) for (const pageNumber of [1, 2]){
      const o = { design:"sunflower", tier, weight:"auto", header, title, caption, largePrint, legend, duplex:true, pageNumber };
      const lay = L.layout(o), b = lay.blocks, F = lay.F, tag = JSON.stringify(o);
      ok(Math.abs(b.art.w / b.art.h - .75) < 1e-9, "art is 3:4 " + tag);
      const inside = r => r.x >= F.content.x - 1e-9 && r.y >= F.content.y - 1e-9 && r.x + r.w <= F.content.x + F.content.w + 1e-9 && r.y + r.h <= F.content.y + F.content.h + 1e-9;
      Object.keys(b).forEach(k => ok(inside(b[k]), `${k} inside the margins ${tag}`));
      ok(b.art.w >= C.pageLayout(C.smallestLayout(tier)).artW - 1e-9, "art never smaller than the size the tier rules are measured at " + tag);
      ok(F.gutterSide === (pageNumber === 2 ? "right" : "left") && F.margins[F.gutterSide] === .75, "gutter on the bound edge " + tag);
      if (b.legend) ok(b.legend.x >= b.art.x + b.art.w || b.legend.x + b.legend.w <= b.art.x, "color guide beside the picture, not over it " + tag);
      const stack = ["header", "title", "art", "caption", "foot"].filter(k => b[k]).map(k => b[k]);
      for (let i = 1; i < stack.length; i++) ok(stack[i].y >= stack[i - 1].y + stack[i - 1].h - 1e-9, "blocks do not overlap " + tag);
    }
  const pg = L.sheet({ design:"farm-tractor", tier:3, weight:"auto", header:true, title:true, caption:true, largePrint:true, legend:"high-contrast", pageNumber:1, pageCount:1, name:"Ruth", facility:"Oak Ridge" });
  const lay = L.layout({ design:"farm-tractor", tier:3, header:true, title:true, caption:true, largePrint:true, legend:"high-contrast" });
  const sw = +/<g [^>]*stroke-width="([0-9.]+)"/.exec(pg.html)[1], ppu = lay.blocks.art.w * 96 / 600;
  ok(Math.abs(sw * ppu - 10.5) < .02, `Tier 3 page lines print at 10.5 px (got ${(sw * ppu).toFixed(3)})`);
  ok(/Prepared especially for <b>Ruth<\/b>/.test(pg.html) && /Oak Ridge/.test(pg.html) && /data-legend="high-contrast"/.test(pg.html) && pg.perf < 150, "sheet carries the name, facility and color guide");
  const act = L.LIBRARY_ACTIVITY, cfg = { residentName:"Ruth", opts:{ pages:["sunflower", "red-barn"], tier:2, header:true, title:true, caption:true, legend:"off" } };
  const plan = act.plan(cfg, null, 2), page = act.generate(cfg, null, plan[1]);
  ok(plan.join() === "sunflower,red-barn" && page.layout === "cc" && /data-design="red-barn"/.test(page.sheet) && /data-tier="2"/.test(page.sheet), "queued library pages rebuild from their recipe");
  // the same pages through the PDF writer, with a recording stand-in for jsPDF
  class Rec { constructor(){ this.calls = []; return new Proxy(this, { get:(t, k) => k in t ? t[k] : (...a) => { t.calls.push(k); return k === "getTextWidth" ? 50 : k === "splitTextToSize" ? [String(a[0])] : t; } }); } }
  const out = L.buildPdf(Rec, [0, 1].map(i => Object.assign(L.pageOpts(i, ["sunflower", "red-barn"]), { tier:1 })));
  ok(out.times.length === 2 && out.times.every(t => t < 150), `PDF pages drawn in ${out.times.map(t => t.toFixed(1)).join(", ")} ms (limit 150)`);
}

if (fails.length){ console.log(`coloring check FAILED: ${fails.length} problem(s), ${pass} passed\n  - ` + fails.slice(0, 30).join("\n  - ")); process.exit(1); }
console.log(`coloring check passed: ${pass} checks (${designs.length} designs, ${designs.length * 3} pages, ${packs.length} packs, ${jobs.length} prompt jobs)`);
