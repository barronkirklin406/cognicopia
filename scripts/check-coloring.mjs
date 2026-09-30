#!/usr/bin/env node
/* =====================================================================
   Checks for the CogniCore coloring library: the engine, every design at
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
import { loadCogniCore, ROOT, svgProblems } from "./lib/cognicore.mjs";
import { validate } from "./lib/json-schema.mjs";
import { createBitmap, paint, shapesFromRender } from "./lib/raster.mjs";
import { encodeRGBPNG } from "./lib/png.mjs";

let pass = 0; const fails = [];
const ok = (cond, msg) => { if (cond) pass++; else fails.push(msg); };
const { C, P } = loadCogniCore();
const run = (script, args) => execFileSync(process.execPath, [path.join(ROOT, "scripts", script), ...args], { encoding:"utf8", stdio:["ignore", "pipe", "pipe"] });

/* 1. the library */
const designs = C.designs(), packs = C.packs();
ok(designs.length >= 100, `${designs.length} designs (want at least 100)`);
ok(packs.length >= 50 && packs.length <= 100, `${packs.length} packs (want 50 to 100)`);
const cats = new Set(designs.map(d => d.cat));
["classic-vehicles", "botanical-garden", "nostalgic-heritage", "wildlife-nature", "bold-easy-patterns", "home-everyday"].forEach(c => ok(cats.has(c) && designs.filter(d => d.cat === c).length >= 10, "category " + c + " has at least 10 designs"));
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
["ultra-bold black line art", "senior coloring book", "3:4", "vector", "white background", "no shading"].forEach(w => ok(P.POSITIVE.toLowerCase().includes(w), "positive template has: " + w));
["shading", "grayscale", "childish", "noise", "thin lines", "cartoon faces", "cluttered background"].forEach(w => ok(P.NEGATIVE.includes(w), "negative template has: " + w));
const j = P.job({ subject:"a 1950s percolator on a stove", category:"nostalgic-heritage", tier:3 });
ok(/^ai-nostalgic-heritage-[a-z0-9-]+-t3$/.test(j.job_id) && j.prompts.midjourney.includes("--ar 3:4 --no ") && j.prompts["stable-diffusion"].includes("Negative prompt:") && j.prompts["dall-e-3"].includes("Avoid:"), "a job carries every generator's prompt");
ok(!/\b(cute|kids|cartoon)\b/.test(j.positive), "positive prompts never ask for childish art");
const jobs = fs.readFileSync(path.join(ROOT, "src", "data", "cognicore_prompt_jobs.jsonl"), "utf8").trim().split("\n").map(l => JSON.parse(l));
ok(jobs.length === designs.length * 3 + P.IDEAS.reduce((n, i) => n + i[3].length, 0), `${jobs.length} prompt jobs`);
ok(new Set(jobs.map(x => x.job_id)).size === jobs.length, "prompt job ids are unique");

/* 4. the catalog, its schema and its files (and that it is current) */
try { run("generate_coloring_manifest.js", ["--check"]); pass++; } catch (e){ fails.push("catalog out of date: " + String(e.stderr || e.message).trim().split("\n")[0]); }
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "cognicore_coloring_catalog.json"), "utf8"));
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "cognicore_coloring_catalog.schema.json"), "utf8"));
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cognicore-ingest-"));
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

if (fails.length){ console.log(`coloring check FAILED: ${fails.length} problem(s), ${pass} passed\n  - ` + fails.slice(0, 30).join("\n  - ")); process.exit(1); }
console.log(`coloring check passed: ${pass} checks (${designs.length} designs, ${designs.length * 3} pages, ${packs.length} packs, ${jobs.length} prompt jobs)`);
