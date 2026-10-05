#!/usr/bin/env node
/* =====================================================================
   CogniCore coloring ingest: brings new line art (from an image generator,
   a scanner or an illustrator) up to the CogniCore print standard and holds
   it for a person to review before any resident sees it.

   Put PNG or SVG files in assets/coloring/_inbox/ (not published: the
   folder starts with an underscore). A file may have a sidecar with the
   same name and .json, for example sunflower.png + sunflower.json:
     { "title": "Sunflowers by the Fence", "category": "botanical-garden",
       "tier": 2, "tags": ["sunflowers", "summer"], "season": "summer",
       "conversation_prompt": "What grew along a fence you knew?",
       "generator": "midjourney", "prompt": "...", "job_id": "ai-...-t2",
       "license": "Generated under our Midjourney plan", "author": "..." }
   A job file from scripts/coloring_prompts.mjs (--jobs jobs.jsonl) fills
   these in for any image named after its job_id.

   For each picture it:
     1. reads it (PNG of any kind, or SVG) and checks for color, gray
        shading, gradients, text and transparency;
     2. makes it pure black on white: Otsu threshold for PNGs, every color
        to black or white by lightness for SVGs; removes specks;
     3. crops to the drawing and centers it on a 3:4 page with a margin;
     4. thickens lines that print thinner than the tier's weight
        (3, 4.5 or 6 pt at the page's printed width) and closes small gaps;
     5. measures what a person would color (areas, the smallest area,
        line thickness) and suggests the simplest tier it meets;
     6. tags it (category, tier, subject words, era, season) and runs the
        dignity filter on its title, tags, caption and prompt;
     7. writes a 300 DPI 1-bit PNG (or a clean black-and-white SVG) to
        assets/coloring/ingested/<category>/ and records it in
        src/data/coloring_ingested.json as "needs-review", with a checklist.

   Nothing is published by this script. A person looks at each picture and
   approves or rejects it; approved pictures join the catalog on the next
   npm run coloring.

   Run:  node scripts/ingest_coloring_assets.mjs              ingest the inbox
         node scripts/ingest_coloring_assets.mjs --list       what is waiting
         node scripts/ingest_coloring_assets.mjs --approve <id> --reviewer "Name"
         node scripts/ingest_coloring_assets.mjs --reject <id> --reviewer "Name" --reason "..."
   Options: --inbox <dir>  --tier 1|2|3|auto  --category <id>  --jobs <file.jsonl>
            --dry-run (measure and report, write nothing)
   Node built-ins only.
   ===================================================================== */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { loadCogniCore, ROOT, complexityOf } from "./lib/cognicore.mjs";
import { decodePNG, encodeBitPNG } from "./lib/png.mjs";
import { createBitmap, paint, measure, strokeStats, dilate, despeckle } from "./lib/raster.mjs";
import { parseSVG, fitShapes, shapesToSVG } from "./lib/svg-raster.mjs";
import { validate } from "./lib/json-schema.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i < 0 ? def : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true); };
const INBOX = opt("inbox", "assets/coloring/_inbox");
const OUT_DIR = "assets/coloring/ingested";
const STORE = opt("store", "src/data/coloring_ingested.json");
const SCHEMA = "src/data/cognicore_coloring_catalog.schema.json";
const DRY = args.includes("--dry-run"), JSON_OUT = args.includes("--json");      // --json: print the records (with --dry-run, for checks)
const DPI = 300, CANVAS_W = 6, CANVAS_H = 8;             // the stored picture: 6 x 8 in (3:4) at 300 DPI
const abs = f => path.isAbsolute(f) ? f : path.join(ROOT, f);
const rel = f => path.relative(ROOT, abs(f)).split(path.sep).join("/");
const sha256 = b => crypto.createHash("sha256").update(b).digest("hex");
const today = () => new Date().toISOString().slice(0, 10);
const SITE = "https://" + (fs.existsSync(abs("CNAME")) ? fs.readFileSync(abs("CNAME"), "utf8").trim() : "cognicopia.org");

const { C, P } = loadCogniCore();
const schema = JSON.parse(fs.readFileSync(abs(SCHEMA), "utf8"));
const loadStore = () => fs.existsSync(abs(STORE)) ? JSON.parse(fs.readFileSync(abs(STORE), "utf8"))
  : { $schema:"./cognicore_coloring_catalog.schema.json", name:"CogniCore Ingested Coloring Pages", schema_version:"1.0.0",
      about:"Pictures brought in by scripts/ingest_coloring_assets.mjs. Each waits as needs-review until a person approves it; approved pictures join the catalog on the next npm run coloring.", assets:[] };
const saveStore = s => { if (!DRY) fs.writeFileSync(abs(STORE), JSON.stringify(s, null, 1) + "\n"); };

/* What a reviewer confirms by eye. The first four are measured here. */
const CHECKS = [
  { id:"pure-black-white", label:"Pure black lines on white: no color, gray, shading or gradients", auto:true },
  { id:"line-weight", label:"Lines print at the tier's weight or heavier", auto:true },
  { id:"area-size", label:"Areas to color are large enough for the tier", auto:true },
  { id:"fills-page", label:"A 3:4 portrait page with the subject filling it", auto:true },
  { id:"dignity-words", label:"Title, tags, caption and prompt pass the dignity filter", auto:true },
  { id:"adult-style", label:"Adult and dignified: no cartoon faces, no childish style, nothing cute or silly", auto:false },
  { id:"true-to-life", label:"The subject is right and easy to recognize: no extra limbs, warped hands, melted objects or impossible machines", auto:false },
  { id:"no-text", label:"No letters, numbers, signatures or watermarks anywhere in the picture", auto:false },
  { id:"gentle-subject", label:"Nothing frightening, sad or likely to upset (check the resident avoid-topics list)", auto:false },
  { id:"rights", label:"We may use it: our own work, or generated under terms that allow it", auto:false }
];

/* ---------- list, approve, reject ---------- */
function statusLine(a){
  const fails = (a.ingest.checks || []).filter(c => c.result === "fail").map(c => c.id);
  return `${a.review_status.padEnd(12)} ${a.id.padEnd(46)} T${a.tier} ${a.category_id.padEnd(20)} ${fails.length ? "fails: " + fails.join(", ") : "auto checks pass"}`;
}
if (args.includes("--list")){
  const s = loadStore();
  if (!s.assets.length) console.log("Nothing ingested yet. Put PNG or SVG files in " + INBOX + " and run this script.");
  s.assets.forEach(a => console.log(statusLine(a)));
  process.exit(0);
}
for (const verb of ["approve", "reject"]){
  const id = opt(verb);
  if (!id) continue;
  const s = loadStore(), a = s.assets.find(x => x.id === id);
  if (!a){ console.error(`No ingested picture ${id}. See --list.`); process.exit(1); }
  const reviewer = opt("reviewer");
  if (!reviewer || reviewer === true){ console.error(`--${verb} needs --reviewer "Name": a person signs off every picture.`); process.exit(1); }
  if (verb === "approve"){
    const fails = a.ingest.checks.filter(c => c.result === "fail");
    const override = opt("override");
    if (fails.length && (!override || override === true)){
      console.error(`${id} fails ${fails.map(c => c.id).join(", ")}. Fix the picture and ingest it again, or approve with --override "why it is acceptable".`);
      process.exit(1);
    }
    a.ingest.checks.forEach(c => { if (c.result === "human") c.result = "confirmed"; });
    if (override && override !== true) a.ingest.override = String(override);
  } else {
    const reason = opt("reason");
    if (!reason || reason === true){ console.error("--reject needs --reason \"...\""); process.exit(1); }
    a.ingest.decision_note = String(reason);
  }
  a.review_status = verb === "approve" ? "approved" : "rejected";
  a.ingest.reviewer = String(reviewer); a.ingest.reviewed = today();
  saveStore(s);
  console.log(statusLine(a) + (verb === "approve" ? "\nRun npm run coloring to add it to the catalog and the Packet Builder." : ""));
  process.exit(0);
}

/* ---------- image work ---------- */
function otsu(gray){
  const hist = new Float64Array(256); for (const v of gray) hist[v]++;
  const total = gray.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, t = 128;
  for (let i = 0; i < 256; i++){
    wB += hist[i]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best){ best = between; t = i; }
  }
  return Math.min(200, Math.max(60, t + 1));
}
/* The share of the page in mid grays: shading, soft gradients, gray fills. */
function grayShare(gray){ let n = 0; for (const v of gray) if (v > 70 && v < 185) n++; return n / gray.length; }
function inkBox(bmp){
  const { w, h, px } = bmp; let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[y * w + x]){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}
/* Resample the gray picture's box into a w x h canvas (3:4), centered with a
   margin, then threshold: area averaging when shrinking, bilinear when growing. */
function placeGray(src, box, w, h, margin, thr){
  const bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1;
  const k = Math.min(w * (1 - 2 * margin) / bw, h * (1 - 2 * margin) / bh);
  const ox = (w - bw * k) / 2, oy = (h - bh * k) / 2, out = createBitmap(w, h), inv = 1 / k;
  const at = (x, y) => (x < 0 || y < 0 || x >= src.w || y >= src.h) ? 255 : src.gray[y * src.w + x];
  for (let y = 0; y < h; y++){
    const sy = (y + .5 - oy) * inv + box.y0 - .5;
    for (let x = 0; x < w; x++){
      const sx = (x + .5 - ox) * inv + box.x0 - .5;
      let v;
      if (inv > 1){                                           // shrinking: average the source pixels under this one
        let s = 0, n = 0; const r = inv / 2;
        for (let yy = Math.floor(sy - r + .5); yy <= Math.floor(sy + r + .5); yy++) for (let xx = Math.floor(sx - r + .5); xx <= Math.floor(sx + r + .5); xx++){ s += at(xx, yy); n++; }
        v = s / n;
      } else {
        const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
        v = at(x0, y0) * (1 - fx) * (1 - fy) + at(x0 + 1, y0) * fx * (1 - fy) + at(x0, y0 + 1) * (1 - fx) * fy + at(x0 + 1, y0 + 1) * fx * fy;
      }
      if (v < thr) out.px[y * w + x] = 1;
    }
  }
  return out;
}
const refWidth = t => C.pageLayout(C.smallestLayout(t)).artW;                               // the smallest the page prints
/* Printed line weight at the page's reference width, from the 300 DPI canvas. */
const printedPt = (bmp, t) => +(strokeStats(bmp, DPI).stroke_pt_median * refWidth(t) / CANVAS_W).toFixed(2);
function measureAt(bmp, t){
  const scale = refWidth(t) / CANVAS_W, dpiAtPrint = DPI / scale;          // pixels per printed inch
  return measure(bmp, { dpi:dpiAtPrint, minSqIn:C.TIERS[t].minArea });
}
/* Bring the lines up to tier t's weight; returns the bitmap and what was done. */
function toTier(base, t){
  const fixes = [], want = C.WEIGHTS[C.TIERS[t].weight].pt, have = printedPt(base, t);
  let bmp = { w:base.w, h:base.h, px:new Uint8Array(base.px) };
  if (have < want * .92){
    const r = Math.max(1, Math.round((want - have) / 2 / 72 * DPI * CANVAS_W / refWidth(t)));
    bmp = despeckle(dilate(bmp, r), Math.round(DPI * DPI * .0006));
    fixes.push(`thickened lines from ${have} pt to about ${want} pt`);
  }
  return { bmp, fixes, m:measureAt(bmp, t), pt:printedPt(bmp, t) };
}
/* A vector picture keeps its paths: strokes are raised to the tier's weight
   (at least), colors go to black or white, and it stays an SVG. Drawings made
   of filled outlines cannot be thickened that way, so they fall back to the
   bitmap route above. */
const minStrokePx = t => C.WEIGHTS[C.TIERS[t].weight].pt / 72 * DPI * CANVAS_W / refWidth(t);
function toTierVector(parsed, t){
  const want = C.WEIGHTS[C.TIERS[t].weight].pt, fit = fitShapes(parsed, CANVAS_W * DPI, CANVAS_H * DPI, { margin:.05, minStrokePx:minStrokePx(t) });
  const bmp = despeckle(paint(createBitmap(CANVAS_W * DPI, CANVAS_H * DPI), fit.shapes), Math.round(DPI * DPI * .0004));
  const pt = printedPt(bmp, t), raised = parsed.shapes.some(s => s.stroke && s.strokeWidth * fit.k < minStrokePx(t) * .99);
  if (pt < want * .92){ const r = toTier(bmp, t); r.fixes.unshift("filled outlines too thin for vector thickening: stored as a 300 DPI bitmap"); return r; }
  return { bmp, fit, vector:true, fixes:raised ? [`raised thin strokes to ${want} pt`] : [], m:measureAt(bmp, t), pt };
}
function passes(res, t){
  const T = C.TIERS[t], want = C.WEIGHTS[T.weight].pt;
  return res.m.tiny_regions <= T.maxTiny && res.pt >= want * .85 && res.m.regions > 0 && res.m.regions <= [0, 200, 45, 15][t];
}

/* ---------- metadata ---------- */
const jobsFile = opt("jobs");
const jobs = {};
if (jobsFile && jobsFile !== true) fs.readFileSync(abs(jobsFile), "utf8").split("\n").filter(Boolean).forEach(l => { const j = JSON.parse(l); jobs[j.job_id] = j; });
const STOP = new Set("a an the and or of in on at by for with from to into over under near its his her their our your this that some one two three old new big small large little very page picture coloring drawing line art black white bold adult adults senior seniors vector style".split(" "));
function words(s){ return String(s || "").toLowerCase().replace(/[^a-z0-9' -]+/g, " ").split(/[\s]+/).map(w => w.replace(/^'+|'+$/g, "")).filter(w => w.length > 2 && !STOP.has(w)); }
const DEFAULT_TALK = {
  "classic-vehicles":"Where would you like to go in this?", "botanical-garden":"What colors would you choose for these?",
  "nostalgic-heritage":"Where have you seen one like this?", "wildlife-nature":"Where might you see this outdoors?",
  "bold-easy-patterns":"Which colors feel calm to you today?", "home-everyday":"Who did this job in your home?",
  "zentangle-mandalas":"Which colors would you like to start with today?", "vintage-americana":"What does this picture bring to mind for you?",
  "seasons-holidays":"Which season or holiday do you enjoy most, and why?"
};

/* ---------- ingest the inbox ---------- */
const store = loadStore();
const inboxDir = abs(INBOX);
if (!fs.existsSync(inboxDir)){ console.log(`No inbox at ${INBOX}. Create it and add PNG or SVG files.`); process.exit(0); }
const files = fs.readdirSync(inboxDir).filter(f => /\.(png|svg)$/i.test(f)).sort();
if (!files.length){ console.log(`The inbox (${INBOX}) is empty.`); process.exit(0); }
let added = 0;
for (const f of files){
  const full = path.join(inboxDir, f), buf = fs.readFileSync(full), srcHash = sha256(buf), stem = f.replace(/\.(png|svg)$/i, "");
  if (store.assets.some(a => a.ingest.source_sha256 === srcHash)){ console.log(`skip  ${f}: already ingested`); continue; }
  const side = fs.existsSync(path.join(inboxDir, stem + ".json")) ? JSON.parse(fs.readFileSync(path.join(inboxDir, stem + ".json"), "utf8")) : {};
  const job = jobs[side.job_id || stem] || {};
  const meta = Object.assign({}, job.job_id ? { title:job.title, category:job.category, tier:job.tier, tags:job.tags, prompt:job.positive, job_id:job.job_id } : {}, side);
  const category = meta.category || (opt("category") !== true && opt("category")) || null;
  if (!category || !C.CAT[category]){ console.log(`skip  ${f}: needs a category (${C.CATEGORIES.map(c => c.id).join(", ")}) in its sidecar, its job or --category`); continue; }
  const title = String(meta.title || stem.replace(/^ai-[a-z-]+?-(?=[a-z])/, "").replace(/-t[123]$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase())).trim();
  const notes = [], fixes = [];

  /* 1-3: pure black and white on a 3:4 canvas */
  const W = CANVAS_W * DPI, H = CANVAS_H * DPI;
  let base, svgOut = null, parsed = null, srcSize;
  if (/\.png$/i.test(f)){
    const img = decodePNG(buf);
    srcSize = [img.w, img.h];
    if (img.colorFraction > .002) notes.push(`color in ${(img.colorFraction * 100).toFixed(1)}% of the picture`);
    const gs = grayShare(img.gray);
    if (gs > .03) notes.push(`gray shading in ${(gs * 100).toFixed(1)}% of the picture`);
    const thr = otsu(img.gray);
    const bin = createBitmap(img.w, img.h); for (let i = 0; i < img.gray.length; i++) if (img.gray[i] < thr) bin.px[i] = 1;
    despeckle(bin, Math.max(4, Math.round(img.w * img.h * 2e-6)));
    const box = inkBox(bin);
    if (!box){ console.log(`skip  ${f}: no drawing found`); continue; }
    base = placeGray(img, box, W, H, .05, thr);
    fixes.push(`thresholded at ${thr} (Otsu) to pure black and white`, "cropped to the drawing and centered on a 3:4 page");
    if (Math.abs(img.w / img.h - .75) > .02) fixes.push(`reframed from ${img.w} x ${img.h} (${(img.w / img.h).toFixed(2)}) to 3:4`);
  } else {
    const text = buf.toString("utf8");
    parsed = parseSVG(text);
    srcSize = [parsed.viewBox[2], parsed.viewBox[3]];
    parsed.notes.forEach(n => notes.push(n));
    base = null;
    fixes.push("fills set to white (or black where they were near-black) and every line to pure black", "cropped to the drawing and centered on a 3:4 page");
  }
  if (base){ despeckle(base, Math.round(DPI * DPI * .0004)); fixes.push("removed specks and pinholes"); }

  /* 4-5: line weight, measurements, tier */
  const askTier = +(meta.tier || (opt("tier") !== true && opt("tier")) || 0) || 0;
  const tried = {}; [1, 2, 3].forEach(t => { tried[t] = parsed ? toTierVector(parsed, t) : toTier(base, t); });
  const suggested = [3, 2, 1].find(t => passes(tried[t], t)) || 1;
  const tier = [1, 2, 3].includes(askTier) ? askTier : suggested;
  const res = tried[tier];
  fixes.push(...res.fixes);
  let format = "png", outBytes, outRel;
  const slug = P.slug(meta.job_id ? meta.job_id.replace(/^ai-[a-z-]+?-(?=[a-z])/, "").replace(/-t[123]$/, "") : title) || "picture";
  const id = `ai-${category}-${slug}-t${tier}`;
  if (res.vector){ format = "svg"; outBytes = Buffer.from(shapesToSVG(res.fit.shapes, { w:W, h:H, title, widthIn:refWidth(tier) })); }
  else outBytes = encodeBitPNG(res.bmp, DPI);
  outRel = `${OUT_DIR}/${category}/${id}.${format}`;

  /* 6: tags and the dignity filter */
  const era = (/\b(1[89]\d0s|20[0-2]0s)\b/.exec([title, (meta.tags || []).join(" "), meta.prompt].join(" ")) || [])[1] || meta.era || "";
  const season = meta.season || (["spring", "summer", "fall", "winter"].find(s => words(title + " " + (meta.tags || []).join(" ")).includes(s)) || "");
  const tags = C.tagsFor({ cat:category, tags:[...(meta.tags || []), ...words(title), meta.generator ? "ai-generated" : "ingested"], era, season }, tier);
  const talk = meta.conversation_prompt || DEFAULT_TALK[category];
  const dignity = P.dignityCheck([title, tags.join(" "), talk, meta.subject || ""].join(" "));

  /* 7: the record */
  const T = C.TIERS[tier], want = C.WEIGHTS[T.weight].pt;
  const checks = CHECKS.map(c => {
    let result = "human", detail = "";
    if (c.id === "pure-black-white"){ const bad = notes.filter(n => /color|gray|gradient|transparen|pattern/.test(n)); result = bad.length ? "fail" : "pass"; detail = bad.join("; ") || "no color or gray found"; }
    if (c.id === "line-weight"){ result = res.pt >= want * .85 ? "pass" : "fail"; detail = `${res.pt} pt measured, ${want} pt wanted`; }
    if (c.id === "area-size"){ result = res.m.tiny_regions <= T.maxTiny ? "pass" : "fail"; detail = `${res.m.tiny_regions} areas under ${T.minArea} sq in (Tier ${tier} allows ${T.maxTiny}); smallest ${res.m.smallest_region_sq_in} sq in`; }
    if (c.id === "fills-page"){ result = res.m.subject_fill >= .45 ? "pass" : "fail"; detail = `subject fills ${Math.round(res.m.subject_fill * 100)}% of the picture box`; }
    if (c.id === "dignity-words"){ result = dignity.length ? "fail" : "pass"; detail = dignity.map(d => `"${d.term}" (${d.kind})`).join(", ") || "no flagged words"; }
    if (c.id === "no-text" && notes.some(n => /<text>/.test(n))) detail = "the source file had text elements; they were left out of the page, so check what they said";
    return { id:c.id, label:c.label, result, detail };
  });
  const asset = {
    id, design_id:`ai-${slug}`, title, category:C.CAT[category].label, category_id:category,
    cognitive_tier:T.label, tier, tags, line_weight:T.weight, stroke_pt:want, stroke_px:C.WEIGHTS[T.weight].px, aspect_ratio:"3:4", page_size:"8.5x11",
    print_width_in:refWidth(tier), print_height_in:+(refWidth(tier) / .75).toFixed(3), format,
    svg_path:format === "svg" ? outRel : null, png_path:format === "png" ? outRel : null, ...(format === "png" ? { png_dpi:DPI } : {}),
    asset_url:`${SITE}/${outRel}`, sha256:sha256(outBytes), bytes:outBytes.length,
    era, season, sensitive_topics:(meta.sensitive_topics || []).slice(), conversation_prompt:talk,
    source:"ingested", review_status:"needs-review", packs:[], visual_complexity:complexityOf(res.m.regions), metrics:res.m,
    ingest:{ source_file:rel(full), source_sha256:srcHash, source_format:/\.png$/i.test(f) ? "png" : "svg", source_size:srcSize,
      generator:meta.generator || null, prompt:meta.prompt || null, job_id:meta.job_id || null, license:meta.license || null, author:meta.author || null,
      received:today(), asked_tier:askTier || null, suggested_tier:suggested,
      tier_fit:[1, 2, 3].map(t => ({ tier:t, meets_rule:passes(tried[t], t), regions:tried[t].m.regions, tiny_regions:tried[t].m.tiny_regions, stroke_pt:tried[t].pt })),
      notes, auto_fixes:fixes, checks, reviewer:null, reviewed:null }
  };
  const errs = validate(asset, { $ref:"#/$defs/asset" }, schema);
  if (errs.length){ console.error(`fail  ${f}: the record does not fit the catalog schema:\n  ${errs.join("\n  ")}`); process.exitCode = 1; continue; }
  if (!DRY){
    fs.mkdirSync(path.dirname(abs(outRel)), { recursive:true });
    fs.writeFileSync(abs(outRel), outBytes);
    store.assets = store.assets.filter(a => a.id !== id).concat([asset]);
  }
  added++;
  if (JSON_OUT){ console.log(JSON.stringify(asset)); continue; }
  console.log(`${DRY ? "check" : "added"} ${f} -> ${outRel}\n      ${statusLine(asset)}\n      suggested tier ${suggested}; ${res.m.regions} areas, smallest ${res.m.smallest_region_sq_in} sq in, lines ${res.pt} pt` +
    (notes.length ? "\n      notes: " + notes.join("; ") : ""));
}
saveStore(store);
if (!JSON_OUT) console.log(`\n${added} picture(s) ${DRY ? "checked (dry run, nothing written)" : "ingested and waiting for review"}. Review each one, then run --approve <id> --reviewer "Name" or --reject.`);
