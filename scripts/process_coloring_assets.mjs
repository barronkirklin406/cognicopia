#!/usr/bin/env node
/* =====================================================================
   Coloring subject processor (Node built-ins only).

   The hybrid coloring engine draws one clean subject (a car, a clock, a
   bird) in the middle of the page and builds the border, title and
   prompt around it. The subjects are SVG files in five folders:

     assets/coloring/vehicles/   assets/coloring/nature/
     assets/coloring/objects/    assets/coloring/animals/
     assets/coloring/nostalgia/

   This script makes every subject safe to print for memory care, then
   rebuilds the list the engine reads:
     1. Hand-drawn sources in src/coloring/subjects/<folder>/ are
        processed into the matching assets folder. A file dropped straight
        into an assets folder (a licensed drawing, say) is processed where
        it is, once.
     2. Every shape becomes a plain black-outlined path: colors, gradients,
        patterns, images, text, styles, filters, masks and clips are
        removed; fills become white (or a small black accent); transforms
        and arcs are flattened into the path points.
     3. Outlines are a uniform 4 px (detail lines 3 px) in a 0 0 800 600
        box, with the subject scaled to fit and centered.
     4. The late stage leaves fine detail out and draws 6 pt lines, so a
        small closed shape (a headlight, a flag, a hub) would leave an area
        too small to color there. The subject is laid out on a late-stage
        page by the engine itself, printed to a bitmap, and the smallest
        shape around any area under 0.1 sq in is marked as detail, left out
        at that stage like the rest. A shape the drawing marks
        data-keep="1" (an eye) is never left out.
     5. assets/coloring/manifest.json lists every subject with its title,
        folder, file, tags (from the file's metadata, its name and its
        folder), the stages it suits, its angle and its minimum line.
     6. assets/coloring/subjects.bundle.js carries the same subjects as
        path data, so the pages work with no network at all, even opened
        straight from a folder.

   Metadata a source may carry on its <svg> element (all optional):
     data-title, data-tags (comma list), data-stages (early,middle,late),
     data-angle (side_profile, three_quarter, front), data-prompt (an
     open conversation prompt), data-word (the word to copy at the middle
     stage), data-completion (the words before it), data-banner (the late
     stage title).

   Usage:
     node scripts/process_coloring_assets.mjs          process and rebuild
     node scripts/process_coloring_assets.mjs --check  stop if anything is out of date
     node scripts/process_coloring_assets.mjs --force  reprocess dropped-in files too
   ===================================================================== */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import vm from "vm";
import { normalize, toProcessedSvg, extractShapes, BOX, STROKE } from "./lib/svg-normalize.mjs";
import { createBitmap, paint } from "./lib/raster.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CATEGORIES = ["vehicles", "nature", "objects", "animals", "nostalgia"];
const SRC = path.join(ROOT, "src", "coloring", "subjects"), OUT = path.join(ROOT, "assets", "coloring");
const STAGES = ["early", "middle", "late"], ANGLES = ["side_profile", "three_quarter", "front"];

const argv = process.argv.slice(2), CHECK = argv.includes("--check"), FORCE = argv.includes("--force");
const hash = s => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
const tagify = s => String(s).trim().toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const titleOf = id => id.split(/[_-]+/).filter(Boolean).map(w => /^\d/.test(w) ? w : w[0].toUpperCase() + w.slice(1)).join(" ");

/* tags from the file's name and folder: "1967_muscle_car" gives 1967, 1960s, muscle, car, muscle_car */
export function tagsFromName(id, category){
  const words = id.split(/[_-]+/).map(tagify).filter(Boolean), out = new Set([category]);
  words.forEach(w => { out.add(w); if (/^(19|20)\d\d$/.test(w)) out.add(w.slice(0, 3) + "0s"); if (/^(19|20)\d0s$/.test(w)) out.add(w); });
  for (let i = 0; i + 1 < words.length; i++) if (!/^\d/.test(words[i]) && !/^\d/.test(words[i + 1])) out.add(words[i] + "_" + words[i + 1]);
  return [...out];
}

function metaFrom(root, id, category, norm){
  const list = v => String(v || "").split(",").map(s => s.trim()).filter(Boolean);
  const tags = new Set(tagsFromName(id, category));
  list(root["data-tags"]).map(tagify).filter(Boolean).forEach(t => { tags.add(t); if (/^(19|20)\d\d$/.test(t)) tags.add(t.slice(0, 3) + "0s"); });
  let stages = list(root["data-stages"]).map(s => s.toLowerCase()).filter(s => STAGES.indexOf(s) >= 0);
  if (!stages.length) stages = STAGES.slice();
  const angle = ANGLES.indexOf(String(root["data-angle"] || "").toLowerCase()) >= 0 ? String(root["data-angle"]).toLowerCase() : "side_profile";
  const title = String(root["data-title"] || "").trim() || titleOf(id);
  const word = String(root["data-word"] || "").trim() || title.split(" ").slice(-1)[0].toLowerCase();
  return {
    title, tags:[...tags].sort(), stages, angle,
    prompt:String(root["data-prompt"] || "").trim(),
    word, completion:String(root["data-completion"] || "").trim(),
    banner:String(root["data-banner"] || "").trim() || word.toUpperCase()
  };
}

function listSvgs(dir){ return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /\.svg$/i.test(f)).sort() : []; }
function idOf(file){ return path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }

/* ---------- the late stage: no area too small to color ---------- */
let engine = null;
function lateEngine(){
  if (!engine){ const ctx = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(ROOT, "src", "engine", "ColoringEngine.js"), "utf8"), ctx); engine = ctx.CognicopiaColoringEngine; }
  return engine;
}
const LATE = { dpi:100, smallSqIn:.1, noiseSqIn:.01, shapeMaxIn:.9, shapeMaxSqIn:.4 };
function flatten(E, d, k){
  const subs = []; let cur = null, pos = null, start = null;
  E.parse(d).forEach(sg => {
    if (sg.op === "M"){ cur = { pts:[[sg.p[0] * k, sg.p[1] * k]], closed:false }; subs.push(cur); pos = start = sg.p; }
    else if (sg.op === "L"){ cur.pts.push([sg.p[0] * k, sg.p[1] * k]); pos = sg.p; }
    else if (sg.op === "C"){ for (let i = 1; i <= 10; i++){ const t = i / 10, u = 1 - t;
        cur.pts.push([(u * u * u * pos[0] + 3 * u * u * t * sg.c1[0] + 3 * u * t * t * sg.c2[0] + t * t * t * sg.p[0]) * k, (u * u * u * pos[1] + 3 * u * u * t * sg.c1[1] + 3 * u * t * t * sg.c2[1] + t * t * t * sg.p[1]) * k]); }
      pos = sg.p; }
    else if (cur){ cur.closed = true; pos = start; }
  });
  return subs;
}
const inPoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){ const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
/* the enclosed white areas of a bitmap under the limit, with their centers */
function smallAreas(bmp, dpi){
  const { w, h, px } = bmp, lab = new Int32Array(w * h), stack = new Int32Array(w * h), out = [];
  for (let i = 0, id = 0; i < w * h; i++){
    if (px[i] || lab[i]) continue;
    let top = 0, area = 0, edge = false, sx = 0, sy = 0; stack[top++] = i; lab[i] = ++id;
    while (top){
      const j = stack[--top], x = j % w, y = (j / w) | 0; area++; sx += x; sy += y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (x > 0 && !px[j - 1] && !lab[j - 1]){ lab[j - 1] = id; stack[top++] = j - 1; }
      if (x < w - 1 && !px[j + 1] && !lab[j + 1]){ lab[j + 1] = id; stack[top++] = j + 1; }
      if (y > 0 && !px[j - w] && !lab[j - w]){ lab[j - w] = id; stack[top++] = j - w; }
      if (y < h - 1 && !px[j + w] && !lab[j + w]){ lab[j + w] = id; stack[top++] = j + w; }
    }
    const sq = area / (dpi * dpi);
    if (!edge && sq >= LATE.noiseSqIn && sq < LATE.smallSqIn) out.push({ sq, c:[sx / area + .5, sy / area + .5] });
  }
  return out;
}
/* Mark as detail the small shapes that leave an area too small to color on
   the late-stage page. Returns how many were marked and the areas left. */
export function simplifyForLate(paths){
  const E = lateEngine(), k = LATE.dpi / 72;
  let marked = 0, left = [];
  for (let round = 0; round < 16; round++){
    const page = E.compose({ asset:{ id:"x", title:"X", banner:"X" }, paths:paths.map(p => [p.d, p.fill, p.detail ? 1 : 0]), stage:"late", seed:1 });
    const subj = page.items.filter(it => it.role === "subject"), main = paths.filter(p => !p.detail);
    const shapes = subj.map(it => ({ subpaths:flatten(E, it.d, k), fill:it.fill === "#fff" ? 0 : it.fill === "#000" ? 1 : null, stroke:it.w * k }));
    left = smallAreas(paint(createBitmap(Math.round(page.w * k), Math.round(page.h * k)), shapes), LATE.dpi);
    let changed = false;
    for (const a of left){
      // the smallest closed shape around this area that is small itself and may be left out
      let best = -1, bestArea = Infinity;
      shapes.forEach((sh, i) => {
        const p = main[i]; if (p.detail || p.keep || p.fill === "#000" || !p.closed) return;
        const pts = sh.subpaths.flatMap(sp => sp.pts), xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
        const wIn = (Math.max(...xs) - Math.min(...xs)) / LATE.dpi, hIn = (Math.max(...ys) - Math.min(...ys)) / LATE.dpi;
        if (Math.max(wIn, hIn) > LATE.shapeMaxIn || wIn * hIn > LATE.shapeMaxSqIn * 1.6) return;
        if (!sh.subpaths.some(sp => sp.closed && inPoly(a.c, sp.pts))) return;
        if (wIn * hIn < bestArea){ bestArea = wIn * hIn; best = i; }
      });
      if (best >= 0 && !main[best].detail){ main[best].detail = true; main[best].lateOnly = true; marked++; changed = true; }
    }
    if (!changed) break;
  }
  return { marked, left };
}

/* one subject: the processed file, its manifest entry and its paths for the bundle */
export function processOne(text, id, category){
  const norm = normalize(text);
  const late = simplifyForLate(norm.paths);
  if (late.marked) norm.notes.push(`${late.marked} small shape${late.marked === 1 ? "" : "s"} left out at the late stage`);
  if (late.left.length) norm.notes.push(`${late.left.length} small area${late.left.length === 1 ? "" : "s"} still at the late stage`);
  const meta = metaFrom(norm.root, id, category, norm);
  const svg = toProcessedSvg(norm, meta);
  const main = norm.paths.filter(p => !p.detail);
  const entry = {
    id, title:meta.title, category,
    filePath:`assets/coloring/${category}/${id}.svg`,
    tags:meta.tags,
    dementiaStageCompatibility:meta.stages,
    recommendedAngle:meta.angle,
    strokeWidthMin:3,
    prompt:meta.prompt, word:meta.word, completion:meta.completion, banner:meta.banner,
    paths:norm.paths.length, detailPaths:norm.paths.length - main.length,
    hash:hash(svg)
  };
  return { svg, entry, paths:norm.paths.map(p => [p.d, p.fill, p.detail ? 1 : 0]), notes:norm.notes, skipped:norm.skipped };
}
/* a file that is already processed: read its paths back as they are */
function readProcessed(text, id, category){
  const { shapes, root } = extractShapes(text);
  const meta = metaFrom(root, id, category);
  const paths = [...text.matchAll(/<path d="([^"]*)" fill="([^"]*)"[^>]*?(data-detail="1")?\s*\/>/g)].map(m => [m[1], m[2], m[3] ? 1 : 0]);
  if (!paths.length || paths.length !== shapes.length) throw new Error("the processed file could not be read back");
  return { svg:text, entry:{ id, title:meta.title, category, filePath:`assets/coloring/${category}/${id}.svg`, tags:meta.tags, dementiaStageCompatibility:meta.stages,
    recommendedAngle:meta.angle, strokeWidthMin:3, prompt:meta.prompt, word:meta.word, completion:meta.completion, banner:meta.banner,
    paths:paths.length, detailPaths:paths.filter(p => p[2]).length, hash:hash(text) }, paths, notes:[], skipped:[] };
}

export function buildAll(){
  const files = new Map(), entries = [], bundle = {}, report = [];
  for (const cat of CATEGORIES){
    const srcDir = path.join(SRC, cat), outDir = path.join(OUT, cat), fromSrc = new Set();
    for (const f of listSvgs(srcDir)){
      const id = idOf(f), r = processOne(fs.readFileSync(path.join(srcDir, f), "utf8"), id, cat);
      fromSrc.add(id); files.set(path.join(outDir, id + ".svg"), r.svg); entries.push(r.entry); bundle[id] = r.paths;
      report.push(`${cat}/${id}: ${r.entry.paths} paths (${r.entry.detailPaths} detail)${r.notes.length ? " - " + r.notes.join("; ") : ""}`);
    }
    for (const f of listSvgs(outDir)){
      const id = idOf(f); if (fromSrc.has(id)) continue;
      const text = fs.readFileSync(path.join(outDir, f), "utf8");
      const done = /data-cg-processed="1"/.test(text) && !FORCE;
      const r = done ? readProcessed(text, id, cat) : processOne(text, id, cat);
      if (path.basename(f) !== id + ".svg" && !CHECK) fs.unlinkSync(path.join(outDir, f));
      files.set(path.join(outDir, id + ".svg"), r.svg); entries.push(r.entry); bundle[id] = r.paths;
      report.push(`${cat}/${id}: ${done ? "already processed" : "processed in place"}${r.skipped.length ? " - removed " + r.skipped.join(", ") : ""}`);
    }
  }
  const ids = new Set(); entries.forEach(e => { if (ids.has(e.id)) throw new Error("two subjects share the id " + e.id); ids.add(e.id); });
  entries.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.id.localeCompare(b.id));
  const version = hash(entries.map(e => e.hash).join());
  const manifest = { schema:"cognicopia-coloring-subjects/1", version, box:{ width:BOX.w, height:BOX.h }, stroke:STROKE, categories:CATEGORIES, assets:entries };
  files.set(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const order = entries.map(e => e.id), compact = {}; order.forEach(id => { compact[id] = bundle[id]; });
  files.set(path.join(OUT, "subjects.bundle.js"),
    "/* Cognicopia coloring subjects: the manifest and every subject's paths, built by\n   scripts/process_coloring_assets.mjs from assets/coloring/<folder>/*.svg. Loaded by\n   the pages so subjects draw with no network at all. Do not edit by hand. */\n" +
    "(function(root){ root.CognicopiaSubjects = " + JSON.stringify({ manifest, paths:compact }) + "; })(typeof globalThis !== \"undefined\" ? globalThis : this);\n");
  return { files, manifest, report };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain){
  const { files, manifest, report } = buildAll();
  if (CHECK){
    const stale = [...files].filter(([f, s]) => !fs.existsSync(f) || fs.readFileSync(f, "utf8") !== s).map(([f]) => path.relative(ROOT, f));
    if (stale.length){ console.error("Coloring subjects are out of date; run node scripts/process_coloring_assets.mjs:\n  " + stale.join("\n  ")); process.exit(1); }
    console.log(`Coloring subjects are current: ${manifest.assets.length} subjects.`);
  } else {
    for (const [f, s] of files){ fs.mkdirSync(path.dirname(f), { recursive:true }); if (!fs.existsSync(f) || fs.readFileSync(f, "utf8") !== s) fs.writeFileSync(f, s); }
    report.forEach(l => console.log("  " + l));
    console.log(`Processed ${manifest.assets.length} subjects in ${CATEGORIES.length} folders (manifest ${manifest.version}).`);
  }
}
