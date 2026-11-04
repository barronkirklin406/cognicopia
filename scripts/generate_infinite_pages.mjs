#!/usr/bin/env node
/* =====================================================================
   Cognicopia Infinite Pages: make a batch of new coloring pages.

   For each page it
     1. synthesizes the page from a seed: theme, subject (with its own
        varied details), setting and composition, and fills one of the ten
        prompt templates with {subject}, {setting} and {composition_style};
     2. screens the words (dignity filter, banned subjects, the resident's
        avoid list) before anything is drawn;
     3. draws it, by default with the built-in vector families
        (assets/cognicopia-coloring/generators), or fetches it from an image
        generator you name (--backend http, see below);
     4. checks it: closed shapes, no loose line ends, inside its box,
        black and white only, lines at least 3 pt, and printed at its
        smallest size and measured against its tier (tiny areas, number
        of areas, open white space, line weight). A page that fails is
        drawn again from the next seed; a batch never repeats a page;
     5. writes it: a vector SVG at the exact print width, a 300 DPI 1-bit
        PNG, one print-ready PDF packet (US Letter, binding gutter, title,
        conversation caption, page code), the prompts, and a manifest of
        every choice and every check.

   Run:  node scripts/generate_infinite_pages.mjs --count 12 --tier 2
         node scripts/generate_infinite_pages.mjs --themes vehicles,wildlife --seed "June 2026" --tier 3
         node scripts/generate_infinite_pages.mjs --codes 2NV-K3F9Q1,2WL-1EG8HLW   (print favorites again)
         node scripts/generate_infinite_pages.mjs --list                          (themes, families, templates)
   Options:
     --count <n>        pages in the batch (1-200, default 12)
     --tier <1|2|3>     cognitive tier (default 2)
     --themes <a,b>     theme ids (default: every theme, in turn)
     --seed <text>      the batch's seed (default: today's date); the same
                        seed, tier and themes always make the same pages
     --avoid <a,b>      topics on a resident's avoid list (driving, home, water...)
     --out <dir>        output folder (default out/infinite/<seed>-t<tier>)
     --no-png --no-svg --no-pdf   leave out a kind of file
     --prompts-only     write the prompts for an image generator, nothing drawn
     --generator <id>   prompt format in prompts.csv: midjourney, stable-diffusion, dall-e-3
     --backend http     ask an OpenAI-style image endpoint for each page instead:
                        COGNICOPIA_IMAGE_API_URL (POST, JSON { prompt, size, n,
                        response_format:"b64_json" }; answers { data:[{ b64_json }] }
                        or a PNG) and COGNICOPIA_IMAGE_API_KEY (Bearer token).
                        The images go to <out>/inbox with a jobs file, and the
                        ingest pipeline (scripts/ingest_coloring_assets.mjs)
                        thresholds, thickens, reframes to 3:4, measures and holds
                        them for a person to review. --ingest-dry-run measures
                        them without adding them to the review queue.
   Only --backend http reaches the network; the site itself never does.
   Node built-ins only.
   ===================================================================== */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { loadCognicopiaColoring, ROOT, svgProblems } from "./lib/cognicopia-coloring.mjs";
import { createBitmap, paint, shapesFromRender, measure } from "./lib/raster.mjs";
import { encodeBitPNG } from "./lib/png.mjs";
import { PdfDoc } from "./lib/pdf-lite.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i < 0 ? def : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true); };
const has = name => args.includes("--" + name);
const list = v => (v && v !== true ? String(v) : "").split(",").map(s => s.trim()).filter(Boolean);
const { C, P } = loadCognicopiaColoring();
const I = C.infinite;
const PNG_DPI = 300, CHECK_DPI = 100;

if (has("list")){
  console.log("Themes (--themes):");
  I.THEMES.forEach(t => console.log(`  ${t.id.padEnd(13)} ${t.code}  ${t.label}: ${t.families.map(f => f[0]).join(", ")}`));
  console.log("\nSubject families:");
  Object.values(I.FAMILIES).forEach(f => console.log(`  ${f.id.padEnd(12)} ${f.label}; settings: ${f.settings.join(", ")}`));
  console.log("\nPrompt templates:");
  I.TEMPLATES.forEach(t => console.log(`  ${t.id.padEnd(20)} ${t.label}`));
  process.exit(0);
}

/* ---------- 1. the batch ---------- */
const tier = [1, 2, 3].includes(+opt("tier", 2)) ? +opt("tier", 2) : 2;
const count = Math.max(1, Math.min(200, +opt("count", 12) || 12));
const themes = list(opt("themes"));
const bad = themes.filter(t => !I.THEME[t]);
if (bad.length){ console.error(`Unknown theme(s): ${bad.join(", ")}. See --list.`); process.exit(1); }
const seed = opt("seed") && opt("seed") !== true ? String(opt("seed")) : new Date().toISOString().slice(0, 10);
const avoid = list(opt("avoid"));
const codes = list(opt("codes"));
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "batch";
const outDir = path.resolve(opt("out") && opt("out") !== true ? String(opt("out")) : path.join(ROOT, "out", "infinite", slug(seed) + "-t" + tier));
const generator = P.GENERATORS[opt("generator")] ? opt("generator") : "midjourney";
const backend = opt("backend", "procedural");

let pages = [], rejected = [];
if (codes.length){
  codes.forEach(c => { const pg = I.page(c, { avoid }); if (!pg) rejected.push({ code:c, problems:["not a page code"] }); else if (!pg.check.ok) rejected.push({ code:c, problems:pg.check.problems }); else pages.push(pg); });
} else if (has("prompts-only") || backend === "http"){
  /* prompts only: the same synthesis and word checks, no drawing */
  for (let i = 0, a = 0; pages.length < count && a < count * 20; a++){
    const th = (themes.length ? themes : I.THEMES.map(t => t.id))[i % (themes.length || I.THEMES.length)];
    const sp = I.spec({ seed:I.hashSeed(seed + "#" + i + "#" + a), tier, theme:th });
    const g = I.guard(sp, { avoid });
    if (g.length){ rejected.push({ code:sp.code, problems:g }); continue; }
    if (pages.some(p => p.spec.sig === sp.sig)) continue;
    pages.push({ spec:sp }); i++;
  }
} else {
  const b = I.batch({ seed, count, tier, themes, avoid });
  pages = b.pages; rejected = b.rejected;
}
if (!pages.length){ console.error("No pages passed. Try another seed or fewer topics to avoid."); process.exit(1); }
fs.mkdirSync(outDir, { recursive:true });

/* ---------- 2. prompts for every page ---------- */
const job = (sp, i) => {
  const pr = I.prompt(sp, generator);
  return { job_id:`gen-${sp.code.toLowerCase()}`, page:i + 1, code:sp.code, title:sp.title, category:sp.cat, theme:sp.theme, family:sp.family, tier:sp.tier,
    template:pr.template, slots:pr.slots, subject:sp.slots.subject, tags:sp.tags, sensitive_topics:sp.sensitive, conversation_prompt:sp.talk,
    positive:pr.positive, negative:pr.negative.join(", "), prompts:Object.fromEntries(Object.keys(P.GENERATORS).map(gk => [gk, I.prompt(sp, gk).text])),
    expect:{ aspect_ratio:"3:4", min_stroke_pt:I.MIN_PT, line_weight:C.TIERS[sp.tier].weight, review:"required before use" } };
};
const jobs = pages.map((p, i) => job(p.spec, i));
fs.writeFileSync(path.join(outDir, "prompts.jsonl"), jobs.map(j => JSON.stringify(j)).join("\n") + "\n");
const q = v => '"' + String(v).replace(/"/g, '""') + '"';
fs.writeFileSync(path.join(outDir, "prompts.csv"), ["page", "code", "title", "template", "subject", "setting", "composition_style", generator].join(",") + "\n" +
  jobs.map(j => [j.page, j.code, j.title, j.template, j.slots.subject, j.slots.setting, j.slots.composition_style, j.prompts[generator]].map(q).join(",")).join("\n") + "\n");

/* ---------- 3a. an image generator (optional) ---------- */
if (backend === "http"){
  const url = process.env.COGNICOPIA_IMAGE_API_URL, key = process.env.COGNICOPIA_IMAGE_API_KEY;
  if (!url){ console.error("--backend http needs COGNICOPIA_IMAGE_API_URL (and usually COGNICOPIA_IMAGE_API_KEY)."); process.exit(1); }
  const inbox = path.join(outDir, "inbox");
  fs.mkdirSync(inbox, { recursive:true });
  let got = 0;
  for (const j of jobs){
    try {
      const res = await fetch(url, { method:"POST", headers:Object.assign({ "Content-Type":"application/json" }, key ? { Authorization:"Bearer " + key } : {}),
        body:JSON.stringify({ prompt:j.prompts["dall-e-3"], size:opt("size", "1024x1536"), n:1, response_format:"b64_json", model:process.env.COGNICOPIA_IMAGE_MODEL || undefined }) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const type = res.headers.get("content-type") || "";
      const buf = /image\/png/.test(type) ? Buffer.from(await res.arrayBuffer()) : Buffer.from(((await res.json()).data || [{}])[0].b64_json || "", "base64");
      if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error("the answer was not a PNG");
      fs.writeFileSync(path.join(inbox, j.job_id + ".png"), buf); got++;
      console.log(`fetched ${j.job_id} (${j.title})`);
    } catch (e){ console.error(`could not fetch ${j.job_id}: ${e.message}`); }
  }
  const jobFile = path.join(outDir, "jobs.jsonl");
  fs.writeFileSync(jobFile, jobs.map(j => JSON.stringify({ job_id:j.job_id, title:j.title, category:j.category, tier:j.tier, tags:j.tags, subject:j.subject,
    positive:j.positive, generator:"http", conversation_prompt:j.conversation_prompt, sensitive_topics:j.sensitive_topics })).join("\n") + "\n");
  console.log(`\n${got} of ${jobs.length} image(s) fetched to ${path.relative(ROOT, inbox)}. Checking them with the ingest pipeline...`);
  if (got) execFileSync(process.execPath, [path.join(ROOT, "scripts", "ingest_coloring_assets.mjs"), "--inbox", inbox, "--jobs", jobFile, "--tier", String(tier)]
    .concat(has("ingest-dry-run") ? ["--dry-run"] : []), { stdio:"inherit" });
  process.exit(0);
}
if (has("prompts-only")){
  console.log(`Wrote ${jobs.length} prompt(s) to ${path.relative(ROOT, outDir)}/prompts.jsonl and prompts.csv.`);
  process.exit(0);
}

/* ---------- 3b. draw, check and write ---------- */
/* the full-page picture (title and caption, no name header), at each page's own tier */
const layoutFor = t => C.pageLayout({ tier:t, title:true, caption:true }), L = layoutFor(tier);
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const manifest = { generated_by:"scripts/generate_infinite_pages.mjs", engine_version:I.version, seed, tier, tier_label:C.TIERS[tier].label,
  themes:themes.length ? themes : I.THEMES.map(t => t.id), avoid, count:pages.length, picture_in:{ width:L.artW, height:L.artH }, png_dpi:PNG_DPI,
  rules:Object.assign({ min_stroke_pt:I.MIN_PT, min_area_sq_in:C.TIERS[tier].minArea, max_tiny_areas:C.TIERS[tier].maxTiny }, I.RULES[tier]), pages:[], rejected };
const pdf = has("no-pdf") ? null : new PdfDoc();
let problems = 0;
pages.forEach((pg, i) => {
  const sp = pg.spec, r = pg.r, name = `page-${String(i + 1).padStart(2, "0")}-${sp.code.toLowerCase()}`, files = {}, post = [], L = layoutFor(sp.tier);
  /* the vector page at its exact print width */
  const svg = C.toSVG(r, { widthIn:L.artW, standalone:true, label:sp.title + ", a picture to color" }) + "\n";
  svgProblems(svg).forEach(p => post.push("svg: " + p));
  if (!has("no-svg")){ fs.writeFileSync(path.join(outDir, name + ".svg"), svg); files.svg = name + ".svg"; }
  /* the 300 DPI bitmap, measured again at full size */
  if (!has("no-png")){
    const bmp = paint(createBitmap(Math.round(L.artW * PNG_DPI), Math.round(L.artH * PNG_DPI)), shapesFromRender(C, r, { widthIn:L.artW, dpi:PNG_DPI }));
    if (Math.abs(bmp.w / bmp.h - .75) > .002) post.push(`png: ${bmp.w} x ${bmp.h} is not 3:4`);
    const png = encodeBitPNG(bmp, PNG_DPI);
    fs.writeFileSync(path.join(outDir, name + ".png"), png); files.png = name + ".png"; files.png_px = [bmp.w, bmp.h]; files.png_sha256 = sha(png);
  }
  const big = measure(paint(createBitmap(Math.round(L.artW * CHECK_DPI), Math.round(L.artH * CHECK_DPI)), shapesFromRender(C, r, { widthIn:L.artW, dpi:CHECK_DPI })), { dpi:CHECK_DPI, minSqIn:C.TIERS[sp.tier].minArea, space:true });
  if (big.stroke_pt_median < C.weightFor(sp.tier).pt * .75) post.push(`lines print at ${big.stroke_pt_median} pt on the full page`);
  if (C.weightFor(sp.tier).pt < I.MIN_PT) post.push(`tier weight under ${I.MIN_PT} pt`);
  problems += post.length;
  /* the PDF page */
  if (pdf) pdfPage(pdf, sp, r, i, pages.length);
  manifest.pages.push({ page:i + 1, code:sp.code, tier:sp.tier, title:sp.title, theme:sp.theme, family:sp.family, subject:sp.slots.subject, setting:sp.setting, composition:sp.composition,
    mirrored:!!sp.mirror, template:sp.template, description:sp.description, conversation_prompt:sp.talk, tags:sp.tags, sensitive_topics:sp.sensitive, params:sp.p,
    checks:{ passed:!post.length, dignity:pg.check.report.dignity, loose_line_ends:pg.check.report.looseEnds, picture_box:pg.check.report.box, line_weight_pt:pg.check.report.lineWeightPt,
      at_smallest_print:pg.check.report.metrics, at_full_page:big, after_writing:post }, files });
  console.log(`${post.length ? "CHECK" : "ok   "} ${String(i + 1).padStart(2)}. ${sp.code}  ${sp.title}  (${sp.setting}, ${sp.composition}; ${pg.check.report.metrics.regions} areas)${post.length ? " - " + post.join("; ") : ""}`);
});
if (pdf){ pdf.setProperties({ title:`Cognicopia coloring pages - ${seed} - Tier ${tier}`, subject:"Coloring pages" }); fs.writeFileSync(path.join(outDir, "packet.pdf"), pdf.output()); }
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 1) + "\n");
console.log(`\n${pages.length} page(s) in ${path.relative(process.cwd(), outDir) || "."}: ${["svg", "png"].filter(k => !has("no-" + k)).map(k => k.toUpperCase()).join(" + ")}${pdf ? " + packet.pdf" : ""} + manifest.json + prompts. ` +
  `${rejected.length} draft(s) were drawn again because a check failed.`);
if (problems){ console.error(`${problems} problem(s) after writing; see manifest.json.`); process.exitCode = 1; }

/* One US Letter page: title, picture, conversation caption, footer with
   the page code. 0.75 in binding gutter on the left, 0.5 in elsewhere. */
function pdfPage(doc, sp, r, i, n){
  if (i) doc.addPage();
  const pt = v => v * 72, Pg = C.PAGE, x0 = Pg.gutter, cw = Pg.w - Pg.gutter - Pg.outer, L = layoutFor(sp.tier);
  let y = Pg.top;
  doc.setFont("helvetica", "bold"); doc.setFontSize(L.titlePt);
  doc.text(sp.title, pt(x0 + cw / 2), pt(y + L.titleH / 2) + L.titlePt * .35, { align:"center" });
  y += L.titleH + L.gap;
  C.toPDF(doc, r, pt(x0 + (cw - L.artW) / 2), pt(y), pt(L.artW));
  y += L.artH + L.gap;
  doc.setFont("helvetica", "italic"); doc.setFontSize(L.captionPt);
  const lines = doc.splitTextToSize(sp.talk, pt(cw)).slice(0, 2), lh = L.captionPt * 1.3, cy = pt(y + L.captionH / 2) - (lines.length - 1) * lh / 2 + L.captionPt * .35;
  lines.forEach((t, k) => doc.text(t, pt(x0 + cw / 2), cy + k * lh, { align:"center" }));
  const fy = Pg.h - Pg.bottom;
  doc.setDrawColor(153, 153, 153); doc.setLineWidth(.75); doc.line(pt(x0), pt(fy - L.footH), pt(x0 + cw), pt(fy - L.footH)); doc.setDrawColor(0, 0, 0);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(51, 51, 51);
  doc.text("Cognicopia · Infinite Pages · " + C.TIERS[sp.tier].label, pt(x0), pt(fy) - 2);
  doc.text(`Page code ${sp.code} · ${i + 1} of ${n}`, pt(x0 + cw), pt(fy) - 2, { align:"right" });
  doc.setTextColor(0, 0, 0);
}
