#!/usr/bin/env node
/* =====================================================================
   Cognicopia Coloring ingest: brings new line art (from an image generator,
   a scanner or an illustrator) into the library as crisp vector art, and
   holds it for a person to review before any resident sees it.

   One picture serves all three tiers. The script traces the picture's
   center lines, works out which lines each tier shows and rounds the
   outlines of the heavier tiers to the width of their lines, so the page
   is drawn by the same engine as every other (CognicopiaColoring), at the
   print standard's weights (3, 4.5 and 7.9 pt, never under 3 pt), and
   flows through the Packet Builder, the PDFs and the catalog unchanged.

   Put the masters in assets/coloring/_inbox/ (not published: the folder
   starts with an underscore):
     sunflower.png          the master for the library design "sunflower":
                            when approved it replaces that design's drawing;
     sunflower.t3.png       optional: a drawing made for Tier 3 (or .t2.png),
                            used as it is instead of working the tier out;
     sunflower.json         optional sidecar, see below;
     porch-geranium.png     a name that is not a library design adds a new
                            design: it needs a category (sidecar or --category) and
                            should have a title in its sidecar.
   A sidecar has the same name and .json:
     { "title": "Sunflowers by the Fence", "category": "botanical-garden",
       "conversation_prompt": "What grew along a fence you knew?",
       "tags": ["sunflowers", "summer"], "season": "summer", "era": "1950s",
       "generator": "midjourney", "prompt": "...", "job_id": "sunflower",
       "license": "Generated under our Midjourney plan", "author": "...",
       "fit": "subject", "pad": 0.05 }
   A jobs file from scripts/coloring_prompts.mjs (--jobs jobs.jsonl) fills
   these in for any image named after its job_id.

   For each picture it:
     1. reads it (PNG of any kind, or SVG) and checks for color, gray
        shading and gradients;
     2. makes it pure black on white (Otsu threshold), removes specks,
        crops to the drawing and centers it on a 3:4 page with a margin;
     3. traces the center lines, closes small gaps, keeps solid black
        accents and fits smooth curves (scripts/lib/trace.mjs);
     4. works out what each tier shows and redraws the outlines of Tiers 2
        and 3 from the merged areas (scripts/lib/tiers.mjs);
     5. draws every tier through the engine and measures it: the areas to
        color, the smallest of them, the subject's size;
     6. checks the trace against the master, the file size and the words
        (dignity filter);
     7. writes src/data/coloring_art/<design>.json as "needs-review".

   Nothing is published by this script. A person looks at each picture
   (npm run coloring:review writes the sheets) and approves or rejects it;
   approved art joins the library on the next npm run coloring.

   Run:  node scripts/ingest_coloring_assets.mjs              ingest the inbox
         node scripts/ingest_coloring_assets.mjs --list       what is waiting
         node scripts/ingest_coloring_assets.mjs --approve <design> --reviewer "Name"
         node scripts/ingest_coloring_assets.mjs --reject <design> --reviewer "Name" --reason "..."
   Options: --inbox <dir>  --category <id>  --jobs <file.jsonl>  --only <name>  --root <dir> (keep the art files under another folder)
            --redo (trace again what was already ingested)
            --dry-run (trace and report, write nothing)  --json (print the records)
   Node built-ins only.
   ===================================================================== */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { loadCognicopiaColoring, ROOT } from "./lib/cognicopia-coloring.mjs";
import { prepareMaster } from "./lib/master.mjs";
import { buildArt, itemsHash, readArt, writeArt, listArt, ART_DIR } from "./lib/art.mjs";
import { validate } from "./lib/json-schema.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i < 0 ? def : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true); };
const INBOX = opt("inbox", "assets/coloring/_inbox");
const SCHEMA = "src/data/cognicopia_coloring_art.schema.json";
const DRY = args.includes("--dry-run"), JSON_OUT = args.includes("--json"), REDO = args.includes("--redo");
const abs = f => path.isAbsolute(f) ? f : path.join(ROOT, f);
const rel = f => path.relative(ROOT, abs(f)).split(path.sep).join("/");
const sha256 = b => crypto.createHash("sha256").update(b).digest("hex");
const today = () => new Date().toISOString().slice(0, 10);

const { C, P } = loadCognicopiaColoring({ art: false });
const schema = JSON.parse(fs.readFileSync(abs(SCHEMA), "utf8"));
const root = opt("root") !== true && opt("root") ? path.resolve(String(opt("root"))) : ROOT;      // where the art files go (tests use another folder)

/* What a reviewer confirms by eye. The first eight are measured here. */
const CHECKS = [
  { id: "pure-black-white", label: "Pure black lines on white: no color, gray, shading or gradients" },
  { id: "line-weight", label: "Lines are drawn by the engine at each tier's weight (3, 4.5 and 7.9 pt), never under 3 pt" },
  { id: "area-size", label: "Areas to color are large enough at every tier" },
  { id: "fills-page", label: "A 3:4 portrait page with the subject filling it" },
  { id: "traced-faithfully", label: "The traced lines follow the master: no line lost, none made up" },
  { id: "solid-black", label: "Solid black areas are small accents, not large fills" },
  { id: "file-size", label: "The art is small enough to ship in the library bundle" },
  { id: "dignity-words", label: "Title, tags, caption and prompt pass the dignity filter" },
  { id: "closed-shapes", label: "Shapes are closed: every line that stops near another is meant to" },
  { id: "tier-look", label: "Tiers 2 and 3 look right on the review sheet: the subject is still clear and nothing looks torn" },
  { id: "adult-style", label: "Adult and dignified: no cartoon faces, no childish style, nothing cute or silly" },
  { id: "true-to-life", label: "The subject is right and easy to recognize: no extra limbs, warped hands, melted objects or impossible machines" },
  { id: "no-text", label: "No letters, numbers, signatures or watermarks anywhere in the picture" },
  { id: "gentle-subject", label: "Nothing frightening, sad or likely to upset (check the resident avoid-topics list)" },
  { id: "rights", label: "We may use it: our own work, or generated under terms that allow it" }
];
const FILE_BUDGET = 60000;                       // bytes of path data for one design (all three tiers); the tracer aims for 45000 and loosens its curves to get there

/* ---------- list, approve, reject ---------- */
const statusLine = a => {
  const fails = (a.checks || []).filter(c => c.result === "fail").map(c => c.id);
  return `${a.review.status.padEnd(12)} ${a.id.padEnd(34)} ${a.mode.padEnd(8)} ${a.category_id.padEnd(20)} ${fails.length ? "fails: " + fails.join(", ") : "auto checks pass"}`;
};
if (args.includes("--list")){
  const all = listArt(root);
  if (!all.length) console.log("Nothing ingested yet. Put PNG or SVG masters in " + INBOX + " and run this script.");
  all.forEach(a => console.log(statusLine(a)));
  process.exit(0);
}
for (const verb of ["approve", "reject"]){
  const id = opt(verb);
  if (!id) continue;
  const a = readArt(root, String(id));
  if (!a){ console.error(`No ingested art for ${id}. See --list.`); process.exit(1); }
  const reviewer = opt("reviewer");
  if (!reviewer || reviewer === true){ console.error(`--${verb} needs --reviewer "Name": a person signs off every picture.`); process.exit(1); }
  if (verb === "approve"){
    const fails = a.checks.filter(c => c.result === "fail"), override = opt("override");
    if (fails.length && (!override || override === true)){
      console.error(`${id} fails ${fails.map(c => c.id).join(", ")}. Fix the picture and ingest it again, or approve with --override "why it is acceptable".`);
      process.exit(1);
    }
    if (itemsHash(a.items) !== a.items_sha256){ console.error(`${id}: the art changed after it was traced. Ingest it again with --redo.`); process.exit(1); }
    a.checks.forEach(c => { if (c.result === "human") c.result = "confirmed"; });
    if (override && override !== true) a.review.override = String(override);
    a.review.approved_sha256 = a.items_sha256;
  } else {
    const reason = opt("reason");
    if (!reason || reason === true){ console.error("--reject needs --reason \"...\""); process.exit(1); }
    a.review.decision_note = String(reason);
  }
  a.review.status = verb === "approve" ? "approved" : "rejected";
  a.review.reviewer = String(reviewer); a.review.reviewed = today();
  const errs = validate(a, schema);
  if (errs.length){ console.error("The record no longer fits its schema:\n  " + errs.join("\n  ")); process.exit(1); }
  writeArt(root, a);
  console.log(statusLine(a) + (verb === "approve" ? "\nRun npm run coloring to add it to the library, the catalog and the Packet Builder." : ""));
  process.exit(0);
}

/* ---------- metadata ---------- */
const jobsFile = opt("jobs"), jobs = {};
if (jobsFile && jobsFile !== true) fs.readFileSync(abs(jobsFile), "utf8").split("\n").filter(Boolean).forEach(l => { const j = JSON.parse(l); jobs[j.job_id] = j; });
const STOP = new Set("a an the and or of in on at by for with from to into over under near its his her their our your this that some one two three old new big small large little very page picture coloring drawing line art black white bold adult adults senior seniors vector style".split(" "));
const words = s => String(s || "").toLowerCase().replace(/[^a-z0-9' -]+/g, " ").split(/[\s]+/).map(w => w.replace(/^'+|'+$/g, "")).filter(w => w.length > 2 && !STOP.has(w));
const DEFAULT_TALK = {
  "classic-vehicles": "Where would you like to go in this?", "botanical-garden": "What colors would you choose for these?",
  "nostalgic-heritage": "Where have you seen one like this?", "wildlife-nature": "Where might you see this outdoors?",
  "bold-easy-patterns": "Which colors feel calm to you today?", "home-everyday": "Who did this job in your home?",
  "zentangle-mandalas": "Which colors would you like to start with today?", "vintage-americana": "What does this picture bring to mind for you?",
  "seasons-holidays": "Which season or holiday do you enjoy most, and why?"
};
const slugOf = s => P.slug(String(s).replace(/^ai-[a-z-]+?-(?=[a-z])/, "").replace(/-t[123]$/, "")) || "picture";

/* ---------- ingest the inbox ---------- */
const inboxDir = abs(INBOX);
if (!fs.existsSync(inboxDir)){ console.log(`No inbox at ${INBOX}. Create it and add PNG or SVG masters.`); process.exit(0); }
const MASTER = /^(.+?)(?:\.t([23]))?\.(png|svg)$/i;
const only = opt("only") !== true && opt("only");
const groups = new Map();                                // stem -> { main: file, tiers: { 2: file, 3: file } }
for (const f of fs.readdirSync(inboxDir).sort()){
  const m = MASTER.exec(f); if (!m) continue;
  if (only && m[1] !== only) continue;
  const g = groups.get(m[1]) || groups.set(m[1], { main: null, tiers: {} }).get(m[1]);
  if (m[2]) g.tiers[m[2]] = f; else g.main = f;
}
if (!groups.size){ console.log(`The inbox (${INBOX}) is empty.`); process.exit(0); }

let added = 0, problems = 0;
for (const [stem, g] of groups){
  if (!g.main){ console.log(`skip  ${stem}: has a Tier ${Object.keys(g.tiers).join(" and ")} drawing but no main picture (${stem}.png)`); continue; }
  const read = f => fs.readFileSync(path.join(inboxDir, f));
  const mainBuf = read(g.main), tierBufs = Object.fromEntries(Object.entries(g.tiers).map(([t, f]) => [t, read(f)]));
  const side = fs.existsSync(path.join(inboxDir, stem + ".json")) ? JSON.parse(fs.readFileSync(path.join(inboxDir, stem + ".json"), "utf8")) : {};
  const job = jobs[side.job_id || stem] || {};
  const meta = Object.assign({}, job.job_id ? { title: job.title, category: job.category, tags: job.tags, prompt: job.positive, job_id: job.job_id, conversation_prompt: job.conversation_prompt, sensitive_topics: job.sensitive_topics, generator: job.generator } : {}, side);

  /* which design is this? */
  const lib = C.design(stem), mode = lib ? "replace" : "add";
  const category = lib ? lib.cat : (meta.category || (opt("category") !== true && opt("category")) || null);
  if (!category || !C.CAT[category]){ console.log(`skip  ${g.main}: "${stem}" is not a library design, so it needs a category (${C.CATEGORIES.map(c => c.id).join(", ")}) in its sidecar, its job or --category`); continue; }
  const title = lib ? lib.title : String(meta.title || stem.replace(/^ai-[a-z-]+?-(?=[a-z])/, "").replace(/-t[123]$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase())).trim();
  const id = lib ? lib.id : "ai-" + slugOf(meta.job_id || stem);
  if (!lib && C.design(id)){ console.log(`skip  ${g.main}: ${id} is already a library design`); continue; }

  /* already ingested? */
  const srcHash = sha256(mainBuf), tierHashes = Object.fromEntries(Object.entries(tierBufs).map(([t, b]) => [t, sha256(b)]));
  const old = readArt(root, id);
  if (old && !REDO && old.source.sha256 === srcHash && JSON.stringify(old.source.tier_masters || {}) === JSON.stringify(tierHashes)){ console.log(`skip  ${g.main}: already ingested (${old.review.status}); --redo traces it again`); continue; }

  /* masters */
  const prep = f => { const buf = read(f); return /\.png$/i.test(f) ? prepareMaster({ png: buf }) : prepareMaster({ svg: buf.toString("utf8") }); };
  let m0;
  try { m0 = prep(g.main); } catch (e){ console.log(`skip  ${g.main}: ${e.message}`); problems++; continue; }
  if (m0.error){ console.log(`skip  ${g.main}: ${m0.error}`); continue; }
  const tierMasters = {}, tierNotes = [];
  for (const [t, f] of Object.entries(g.tiers)){
    try { const m = prep(f); if (m.error){ tierNotes.push(`Tier ${t} drawing ${f}: ${m.error}`); continue; } tierMasters[t] = m.bmp; m.notes.forEach(n => tierNotes.push(`Tier ${t} drawing: ${n}`)); }
    catch (e){ tierNotes.push(`Tier ${t} drawing ${f}: ${e.message}`); }
  }

  /* trace and work out the tiers */
  const t0 = Date.now();
  const art = buildArt(m0.bmp, { fit: meta.fit || "subject", pad: meta.pad, tierMasters, trace: meta.trace, rules: meta.rules });
  const ms = Date.now() - t0;

  /* tags and the dignity filter */
  const era = (/\b(1[89]\d0s|20[0-2]0s)\b/.exec([title, (meta.tags || []).join(" "), meta.prompt].join(" ")) || [])[1] || meta.era || (lib ? lib.era : "");
  const season = meta.season || (lib ? lib.season : "") || (["spring", "summer", "fall", "winter"].find(s => words(title + " " + (meta.tags || []).join(" ")).includes(s)) || "");
  const talk = lib ? lib.talk : (meta.conversation_prompt || DEFAULT_TALK[category]);
  const tagWords = lib ? lib.tags : [...new Set([...(meta.tags || []).map(t => String(t).toLowerCase()), ...words(title), meta.generator ? "ai-generated" : "traced"])];
  const dignity = P.dignityCheck([title, tagWords.join(" "), talk, meta.subject || ""].join(" "));

  /* the checks */
  const f = art.fidelity, r0 = art.trace.r0, T1 = art.tiers[1];
  const inkPx = m0.bmp.px.reduce((n, v) => n + v, 0), solidPx = art.graphTrace.blobGeom.reduce((n, b) => n + b.area, 0), solidShare = inkPx ? solidPx / inkPx : 0;
  const bad = m0.notes.filter(n => /color|gray|gradient|transparen|pattern/.test(n));
  const regionGap = Math.abs(f.regions_master - f.regions_traced), regionLimit = Math.max(3, Math.round(f.regions_master * .12));
  const faithful = f.missing_p99_px <= Math.max(10, 2.2 * r0) && f.stray_p99_px <= Math.max(8, 1.4 * r0) && regionGap <= regionLimit;
  const checks = CHECKS.map(c => {
    let result = "human", detail = "";
    if (c.id === "pure-black-white"){ result = bad.length ? "fail" : "pass"; detail = bad.join("; ") || "no color or gray found"; }
    if (c.id === "line-weight"){ result = "pass"; detail = `drawn by the engine at ${[1, 2, 3].map(t => C.weightFor(t).pt + " pt").join(", ")}; the master's own line (${(2 * r0 * 72 / 300).toFixed(1)} pt on a 6 in page) only shows where to draw`; }
    if (c.id === "area-size"){ result = [1, 2, 3].every(t => art.tiers[t].meets_rule) ? "pass" : "fail"; detail = [1, 2, 3].map(t => `Tier ${t}: ${art.tiers[t].regions} areas, ${art.tiers[t].tiny_regions} under ${C.TIERS[t].minArea} sq in (allows ${C.TIERS[t].maxTiny}), smallest ${art.tiers[t].smallest_region_sq_in} sq in`).join("; "); }
    if (c.id === "fills-page"){ result = T1.subject_fill >= .45 ? "pass" : "fail"; detail = `subject fills ${Math.round(T1.subject_fill * 100)}% of the picture box`; }
    if (c.id === "traced-faithfully"){ result = faithful ? "pass" : "fail"; detail = `${f.regions_traced} areas traced of ${f.regions_master} in the master; ink left out reaches ${f.missing_p99_px} px, lines off the ink ${f.stray_p99_px} px (line half-width ${r0} px)`; }
    if (c.id === "solid-black"){ result = solidShare <= .35 ? "pass" : "fail"; detail = `${art.graphTrace.blobGeom.length} solid area(s), ${(solidShare * 100).toFixed(1)}% of the ink`; }
    if (c.id === "file-size"){ result = art.bytes <= FILE_BUDGET ? "pass" : "fail"; detail = `${(art.bytes / 1000).toFixed(1)} KB of path data (limit ${FILE_BUDGET / 1000} KB)`; }
    if (c.id === "dignity-words"){ result = dignity.length ? "fail" : "pass"; detail = dignity.map(d => `"${d.term}" (${d.kind})`).join(", ") || "no flagged words"; }
    if (c.id === "closed-shapes"){ result = art.trace.near_ends ? "human" : "pass"; detail = art.trace.near_ends ? `${art.trace.near_ends} line end(s) stop close to another line (marked on the review sheet): check each is meant to be open` : "no line stops short of another" + (art.trace.stats.gaps_closed ? `; ${art.trace.stats.gaps_closed} small gap(s) were closed` : ""); }
    if (c.id === "no-text" && m0.notes.some(n => /<text>/.test(n))) detail = "the source file had text elements; they were left out of the page, so check what they said";
    return { id: c.id, label: c.label, result, detail };
  });

  const notes = [...m0.notes, ...tierNotes, ...art.notes];
  const record = {
    schema: "cognicopia-coloring-art/1", id, mode, title, category_id: category,
    ...(lib ? {} : { meta: { title, cat: category, talk, tags: tagWords, era, season, sensitive: (meta.sensitive_topics || []).slice() } }),
    fit: art.meta.fit, pad: art.meta.pad, items: art.items, items_sha256: itemsHash(art.items), bytes: art.bytes,
    source: { file: rel(path.join(inboxDir, g.main)), sha256: srcHash, format: m0.format, size: m0.srcSize, ...(Object.keys(tierHashes).length ? { tier_masters: tierHashes } : {}),
      generator: meta.generator || null, prompt: meta.prompt || null, job_id: meta.job_id || null, license: meta.license || null, author: meta.author || null,
      received: today(), notes, auto_fixes: m0.fixes },
    trace: { version: art.trace.version, r0, stats: art.trace.stats, near_ends: art.trace.near_ends, derived: art.derived, notes: art.notes },
    fidelity: { xor_share: f.xor_share, stray_p99_px: f.stray_p99_px, missing_p99_px: f.missing_p99_px, regions_master: f.regions_master, regions_traced: f.regions_traced },
    tiers: Object.fromEntries([1, 2, 3].map(t => [String(t), art.tiers[t]])),
    checks,
    review: { status: "needs-review", reviewer: null, reviewed: null, decision_note: null, override: null, approved_sha256: null }
  };
  const errs = validate(record, schema);
  if (errs.length){ console.error(`fail  ${g.main}: the record does not fit its schema:\n  ${errs.join("\n  ")}`); process.exitCode = 1; problems++; continue; }
  if (!DRY) writeArt(root, record);
  added++;
  if (JSON_OUT){ console.log(JSON.stringify(record)); continue; }
  console.log(`${DRY ? "check" : "added"} ${g.main} -> ${ART_DIR}/${id}.json (${mode}${old ? ", replaces earlier art" + (old.review.status === "approved" ? " that was approved: it needs a new review" : "") : ""}) in ${ms} ms\n      ${statusLine(record)}\n      ` +
    [1, 2, 3].map(t => `Tier ${t}: ${art.tiers[t].regions} areas, smallest ${art.tiers[t].smallest_region_sq_in} sq in`).join("; ") + `; ${(art.bytes / 1000).toFixed(1)} KB; lines ${(2 * r0 * 72 / 300).toFixed(1)} pt in the master` +
    (notes.length ? "\n      notes: " + notes.join("; ") : ""));
}
if (!JSON_OUT) console.log(`\n${added} picture(s) ${DRY ? "checked (dry run, nothing written)" : "ingested and waiting for review"}. Run npm run coloring:review for the sheets, then --approve <design> --reviewer "Name" or --reject.`);
if (problems) process.exitCode = 1;
