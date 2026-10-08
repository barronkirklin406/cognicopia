#!/usr/bin/env node
/* =====================================================================
   Cognicopia Coloring library: writes the printed library from the
   line-art engine (assets/cognicopia-coloring/*.js):
     - one SVG per design and tier:
         assets/coloring/<category>/cc-<design>-t<tier>.svg
     - the catalog, checked against its schema:
         src/data/cognicopia_coloring_catalog.json
         src/data/cognicopia_coloring_catalog.schema.json
     - the browser bundle the Packet Builder and packet tool load:
         assets/cognicopia-coloring/cognicopia-coloring.js (engine, designs, packs, prompt
         engine and the measured catalog numbers, in one file)
     - prompt jobs for AI vector pipelines, one per library page and per
       new-subject idea, with the strict positive and negative prompts:
         src/data/cognicopia_coloring_prompt_jobs.jsonl

   Every page is also printed to a bitmap at its smallest printed size and
   measured: the areas there are to color, the smallest of them, line
   thickness, ink. Those numbers go into the catalog (visual complexity for
   the filters), and a page that breaks its tier's rule stops the run:
   pure black on white, strokes of the tier's weight, and no more small
   areas than the tier allows (docs/cognicopia-coloring-standards.md).

   Approved pictures from the ingest pipeline (src/data/coloring_ingested.json,
   scripts/ingest_coloring_assets.mjs) are added to the catalog as they are.

   Run:  node scripts/generate_coloring_manifest.js           write it all
         node scripts/generate_coloring_manifest.js --import  first ingest
             whatever waits in assets/coloring/_inbox/ (held for review)
         node scripts/generate_coloring_manifest.js --check   verify the
             committed files match the engine (used by npm run build)
   Node built-ins only.
   ===================================================================== */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { loadCognicopiaColoring, sourceFiles, ROOT, SRC_DIR, BANDS, complexityOf, svgProblems } from "./lib/cognicopia-coloring.mjs";
import { createBitmap, paint, shapesFromRender, measure } from "./lib/raster.mjs";
import { validate } from "./lib/json-schema.mjs";

const CHECK = process.argv.includes("--check");
const QUIET = process.argv.includes("--quiet");
const SVG_DIR = "assets/coloring";
const CATALOG = "src/data/cognicopia_coloring_catalog.json";
const SCHEMA = "src/data/cognicopia_coloring_catalog.schema.json";
const INGESTED = "src/data/coloring_ingested.json";
const BUNDLE = "assets/cognicopia-coloring/cognicopia-coloring.js";
const PROMPT_JOBS = "src/data/cognicopia_coloring_prompt_jobs.jsonl";
const SCHEMA_VERSION = "1.0.0";
const MEASURE_DPI = 100, NOISE_SQ_IN = .003;

const abs = f => path.join(ROOT, f);
const read = f => fs.existsSync(abs(f)) ? fs.readFileSync(abs(f), "utf8") : null;
const sha256 = s => crypto.createHash("sha256").update(s).digest("hex");
const SITE = "https://" + (read("CNAME") || "cognicopia.org").trim();
const log = (...a) => { if (!QUIET) console.log(...a); };

if (process.argv.includes("--import") && !CHECK){
  const { execFileSync } = await import("child_process");
  execFileSync(process.execPath, [path.join(ROOT, "scripts", "ingest_coloring_assets.mjs")], { stdio:"inherit" });
}

/* ---------- 1. every page, drawn, written and measured ---------- */
const { C, P } = loadCognicopiaColoring();
const problems = [];
const packsOf = {};
C.packs().forEach(p => p.designs.forEach(id => { (packsOf[id] = packsOf[id] || []).push(p.id); }));
C.packs().forEach(p => p.designs.forEach(id => { if (!C.design(id)) problems.push(`pack ${p.id} lists unknown design ${id}`); }));

const svgFiles = new Map();          // path -> content
const assets = [];
const tierStats = { 1: [], 2: [], 3: [] };
for (const d of C.designs()){
  const cat = C.CAT[d.cat];
  if (!cat){ problems.push(`${d.id}: unknown category ${d.cat}`); continue; }
  for (const t of [1, 2, 3]){
    const T = C.TIERS[t], wt = C.weightFor(t);
    const L = C.pageLayout(C.smallestLayout(t));                                    // the smallest the picture ever prints
    const r = C.render(d.id, t);
    const svg = C.toSVG(r, { widthIn:L.artW, standalone:true }) + "\n";
    const id = C.assetId(d, t), rel = `${SVG_DIR}/${d.cat}/${id}.svg`;
    svgFiles.set(rel, svg);
    svgProblems(svg).forEach(p => problems.push(`${id}: ${p}`));

    const bmp = paint(createBitmap(Math.round(L.artW * MEASURE_DPI), Math.round(L.artH * MEASURE_DPI)), shapesFromRender(C, r, { widthIn:L.artW, dpi:MEASURE_DPI }));
    const m = measure(bmp, { dpi:MEASURE_DPI, noiseSqIn:NOISE_SQ_IN, minSqIn:T.minArea });
    if (m.tiny_regions > T.maxTiny) problems.push(`${id}: ${m.tiny_regions} areas under ${T.minArea} sq in (Tier ${t} allows ${T.maxTiny})`);
    if (!m.regions) problems.push(`${id}: nothing to color`);
    if (m.stroke_pt_median < wt.pt * .75) problems.push(`${id}: lines print at ${m.stroke_pt_median} pt, under the tier's ${wt.pt} pt`);
    tierStats[t].push(m.regions);

    assets.push({
      id, design_id:d.id, title:d.title, category:cat.label, category_id:cat.id,
      cognitive_tier:T.label, tier:t, tags:C.tagsFor(d, t),
      line_weight:wt.id, stroke_pt:wt.pt, stroke_px:wt.px, aspect_ratio:"3:4", page_size:"8.5x11",
      print_width_in:L.artW, print_height_in:L.artH, format:"svg",
      svg_path:rel, asset_url:`${SITE}/${rel}`, sha256:sha256(svg), bytes:Buffer.byteLength(svg),
      era:d.era || "", season:d.season || "", sensitive_topics:d.sensitive.slice(), conversation_prompt:d.talk,
      source:"cognicopia-coloring-engine", review_status:"approved", packs:(packsOf[d.id] || []).slice(),
      visual_complexity:complexityOf(m.regions), metrics:m
    });
  }
}

/* ---------- 2. approved pictures from the ingest pipeline ---------- */
let ingested = [];
const ingestText = read(INGESTED);
if (ingestText){
  const inbox = JSON.parse(ingestText);
  ingested = (inbox.assets || []).filter(a => a.review_status === "approved");
  ingested.forEach(a => {
    const f = a.png_path || a.svg_path;
    if (!f || !fs.existsSync(abs(f))) problems.push(`ingested ${a.id}: file ${f} is missing`);
    else if (sha256(fs.readFileSync(abs(f))) !== a.sha256) problems.push(`ingested ${a.id}: ${f} changed after it was approved (re-run the ingest)`);
  });
}

/* ---------- 3. the catalog ---------- */
const byCat = {}; C.CATEGORIES.forEach(c => { byCat[c.id] = 0; }); C.designs().forEach(d => { byCat[d.cat]++; });
const allAssets = assets.concat(ingested);
const catalog = {
  $schema:"./cognicopia_coloring_catalog.schema.json",
  name:"Cognicopia Coloring Catalog",
  schema_version:SCHEMA_VERSION,
  engine_version:C.version,
  generated_by:"scripts/generate_coloring_manifest.js",
  content_hash:sha256(allAssets.map(a => a.id + ":" + a.sha256).join("\n") + JSON.stringify(C.packs().map(p => [p.id, p.designs]))),
  counts:{ designs:C.designs().length, assets:allAssets.length, packs:C.packs().length, ingested:ingested.length, by_category:byCat },
  standards:{
    colors:{ line:"#000000", background:"#FFFFFF", grayscale:false, shading:false },
    art_aspect_ratio:"3:4",
    page:{ size:"8.5x11", width_in:C.PAGE.w, height_in:C.PAGE.h, binding_gutter_in:C.PAGE.gutter, margin_in:C.PAGE.outer,
      three_hole_punch:{ diameter_in:C.PAGE.holes.diameter, from_edge_in:C.PAGE.holes.fromEdge, centers_in:C.PAGE.holes.centers.slice() } },
    tiers:[1, 2, 3].map(t => { const T = C.TIERS[t], w = C.WEIGHTS[T.weight]; return {
      tier:t, label:T.label, line_weight:T.weight, stroke_pt:w.pt, detail_stroke_pt:w.detailPt, stroke_px_equivalent:w.px,
      min_region_sq_in:T.minArea, max_tiny_regions:T.maxTiny, stage:T.stage, about:T.about }; }),
    line_weights:Object.values(C.WEIGHTS).map(w => ({ id:w.id, label:w.label, stroke_pt:w.pt, detail_stroke_pt:w.detailPt, stroke_px_equivalent:w.px })),
    complexity_bands:BANDS,
    measured_at:{ dpi:MEASURE_DPI, layout:"the smallest printed size: resident header, title and caption all on, in large print", noise_floor_sq_in:NOISE_SQ_IN }
  },
  categories:C.CATEGORIES.map(c => ({ id:c.id, label:c.label, blurb:c.blurb, design_count:byCat[c.id] })),
  packs:C.packs().map(p => ({ id:p.id, title:p.title, theme:p.theme, about:p.about, recommended_tier:p.tier || null, designs:p.designs.slice(), page_count:p.designs.length })),
  assets:allAssets
};
const schema = JSON.parse(read(SCHEMA));
validate(catalog, schema).forEach(p => problems.push("catalog schema: " + p));
const catalogText = JSON.stringify(catalog, null, 1) + "\n";

/* ---------- 4. the browser bundle ---------- */
const metricsById = {};
allAssets.forEach(a => { metricsById[a.id] = [a.metrics.regions, a.metrics.smallest_region_sq_in, a.metrics.median_region_sq_in, a.metrics.tiny_regions, a.visual_complexity]; });
const ingestedForBrowser = ingested.map(a => ({ id:a.id, design_id:a.design_id, title:a.title, category_id:a.category_id, tier:a.tier, tags:a.tags,
  season:a.season, sensitive_topics:a.sensitive_topics, conversation_prompt:a.conversation_prompt, format:a.format, path:a.png_path || a.svg_path }));
const bundle = "/* Cognicopia coloring: the line-art engine, the quality meter, every\n" +
  "   design, the packs, the prompt engine, the infinite page generator with\n" +
  "   its subject families, and the measured catalog, in one file for the\n" +
  "   Packet Builder and the packet tool. Built by\n" +
  "   scripts/generate_coloring_manifest.js from assets/cognicopia-coloring/*.js and\n" +
  "   assets/cognicopia-coloring/generators/*.js: edit those, then run npm run coloring. */\n" +
  sourceFiles().map(f => `\n/* ---------- ${f} ---------- */\n` + fs.readFileSync(path.join(SRC_DIR, f), "utf8").trim() + "\n").join("") +
  "\n/* ---------- measured catalog (generated) ----------\n" +
  "   metrics: asset id -> [areas to color, smallest area sq in, median area sq in, areas under the tier minimum, visual complexity] */\n" +
  "(function(C){\n\"use strict\";\nif (!C) return;\nC.catalog = " + JSON.stringify({
    schema_version:SCHEMA_VERSION, content_hash:catalog.content_hash, bands:BANDS, metrics:metricsById, ingested:ingestedForBrowser
  }) + ";\n})(globalThis.CognicopiaColoring);\n";

/* ---------- 5. prompt jobs for AI vector pipelines ----------
   One job per library page (new art for our own subjects) and one per
   idea and suited tier (new subjects), each with the strict positive and
   negative prompts. scripts/coloring_prompts.mjs formats them for a given
   generator; scripts/ingest_coloring_assets.mjs --jobs reads them back. */
const jobLine = (j, assetId) => JSON.stringify({ job_id:j.job_id, source:j.source, design_id:j.design_id, asset_id:assetId || null, title:j.title,
  category:j.category, tier:j.tier, subject:j.subject, positive:j.positive, negative:j.negative.join(", "), expect:j.expect });
const jobs = [];
C.designs().forEach(d => [1, 2, 3].forEach(t => jobs.push([P.job({ subject:P.subjectFor(d), title:d.title, category:d.cat, tier:t, tags:d.tags, source:"library", design_id:d.id }), C.assetId(d, t)])));
P.IDEAS.forEach(i => i[3].forEach(t => jobs.push([P.job({ subject:i[1], category:i[0], tier:t, tags:i[2], source:"idea" }), null])));
jobs.forEach(([j]) => { if (j.dignity.length) problems.push(`prompt job ${j.job_id} fails the dignity filter: ${j.dignity.map(x => x.term).join(", ")}`); });
const seenJobs = new Set(); jobs.forEach(([j]) => { if (seenJobs.has(j.job_id)) problems.push(`prompt job ${j.job_id} is repeated`); seenJobs.add(j.job_id); });
const promptText = jobs.map(([j, a]) => jobLine(j, a)).join("\n") + "\n";

/* ---------- 6. write, or check ---------- */
if (problems.length){
  console.error(`Cognicopia Coloring library has ${problems.length} problem(s):\n  - ` + problems.slice(0, 40).join("\n  - "));
  process.exit(1);
}
const expected = new Map(svgFiles);
expected.set(CATALOG, catalogText);
expected.set(BUNDLE, bundle);
expected.set(PROMPT_JOBS, promptText);
const stale = [];
for (const c of C.CATEGORIES){
  const dir = abs(`${SVG_DIR}/${c.id}`);
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith(".svg") && !svgFiles.has(`${SVG_DIR}/${c.id}/${f}`)) stale.push(`${SVG_DIR}/${c.id}/${f}`);
}
const summary = `${C.designs().length} designs, ${allAssets.length} pages (${ingested.length} ingested), ${C.packs().length} packs, ${jobs.length} prompt jobs`;
if (CHECK){
  const differ = [...expected].filter(([f, text]) => read(f) !== text).map(([f]) => f);
  if (differ.length || stale.length){
    console.error("The Cognicopia Coloring files are out of date. Run: npm run coloring\n" +
      differ.slice(0, 12).map(f => "  changed: " + f).join("\n") + (differ.length > 12 ? `\n  ... and ${differ.length - 12} more` : "") +
      (stale.length ? "\n" + stale.map(f => "  not in the library: " + f).join("\n") : ""));
    process.exit(1);
  }
  console.log(`Cognicopia Coloring library is current: ${summary}.`);
} else {
  let wrote = 0;
  for (const [f, text] of expected){
    if (read(f) === text) continue;
    fs.mkdirSync(path.dirname(abs(f)), { recursive:true });
    fs.writeFileSync(abs(f), text); wrote++;
  }
  stale.forEach(f => fs.unlinkSync(abs(f)));
  log(`Wrote ${wrote} file(s)${stale.length ? `, removed ${stale.length}` : ""}: ${summary}.`);
  for (const t of [1, 2, 3]){
    const a = tierStats[t].slice().sort((x, y) => x - y), q = f => a[Math.floor(f * (a.length - 1))];
    log(`  Tier ${t}: areas to color per page ${a[0]} to ${a[a.length - 1]} (median ${q(.5)})`);
  }
}
