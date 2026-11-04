#!/usr/bin/env node
/* =====================================================================
   Cognicopia Coloring prompt batches: writes image-generator prompts for new coloring
   pages, strict enough that what comes back is already close to the print
   standard (ultra-bold black lines, white background, no shading, 3:4,
   adult and dignified). Every job carries the same prompt written three
   ways (Midjourney, Stable Diffusion, DALL-E 3) and the dignity-filter
   result for its subject; a subject that fails the filter is left out.

   Nothing is sent anywhere: this only writes text files. Generate the
   images, save each one as <job_id>.png in assets/coloring/_inbox/, then
   run: node scripts/ingest_coloring_assets.mjs --jobs <out>.jsonl

   The usual batch is --masters: one picture per library design, named after
   the design, which the ingest traces to crisp vector art and simplifies for
   all three tiers (no need to ask for each tier separately).

   Run:  node scripts/coloring_prompts.mjs                  every idea, printed
         node scripts/coloring_prompts.mjs --out batch-01    batch-01.jsonl + .csv
   Options:
     --category <id|all>   one category's ideas (default all)
     --tier <1|2|3|best>   one tier for every job (default: each idea's best tiers)
     --generator <id>      midjourney, stable-diffusion or dall-e-3 (printed text)
     --subject "<words>"   one free subject (with --category and --title)
     --masters             one master per library design (or --category): the job id is the
                           design's id, so <design-id>.png replaces that design's art. The
                           owner's own wording (src/data/coloring_owner_prompts.json) is used
                           as the subject and kept whole as prompts.owner
     --library-words       with --masters: use the built-in subject words instead
     --library             one job per library design and tier (older: a picture per tier)
     --count <n>           at most n jobs
     --list                categories and how many ideas each has
   Node built-ins only.
   ===================================================================== */
import fs from "fs";
import path from "path";
import { loadCognicopiaColoring, ROOT } from "./lib/cognicopia-coloring.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i < 0 ? def : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true); };
const { C, P } = loadCognicopiaColoring();

if (args.includes("--list")){
  C.CATEGORIES.forEach(c => console.log(`${c.id.padEnd(20)} ${String(P.IDEAS.filter(i => i[0] === c.id).length).padStart(3)} ideas   ${c.label}`));
  process.exit(0);
}
const category = opt("category", "all"), tierOpt = opt("tier", "best"), generator = opt("generator", "midjourney");
if (category !== "all" && !C.CAT[category]){ console.error(`Unknown category ${category}. See --list.`); process.exit(1); }
if (!P.GENERATORS[generator]){ console.error(`Unknown generator ${generator}: ${Object.keys(P.GENERATORS).join(", ")}`); process.exit(1); }
const tiersFor = best => tierOpt === "best" || tierOpt === true ? best : [+tierOpt].filter(t => [1, 2, 3].includes(t));

let jobs = [];
const subject = opt("subject");
if (subject && subject !== true){
  if (category === "all"){ console.error("--subject needs --category."); process.exit(1); }
  tiersFor([1, 2, 3]).forEach(t => jobs.push(P.job({ subject, title:opt("title") !== true ? opt("title") : undefined, category, tier:t, source:"request" })));
} else if (args.includes("--masters")){
  /* The owner's own wording (src/data/coloring_owner_prompts.json) is used where it has one; --library-words uses the built-in words instead. */
  const ownerFile = path.join(ROOT, "src/data/coloring_owner_prompts.json");
  const owner = !args.includes("--library-words") && fs.existsSync(ownerFile) ? JSON.parse(fs.readFileSync(ownerFile, "utf8")).designs || {} : {};
  C.designs().filter(d => category === "all" || d.cat === category).forEach(d => {
    const o = owner[d.id], job = P.masterJob({ subject:o ? o.subject : P.subjectFor(d), title:d.title, category:d.cat, tags:d.tags, design_id:d.id, talk:d.talk, sensitive:d.sensitive });
    if (o){ job.owner_prompt = o.prompt; job.prompts.owner = o.prompt; }
    jobs.push(job);
  });
} else if (args.includes("--library")){
  C.designs().filter(d => category === "all" || d.cat === category).forEach(d =>
    tiersFor([1, 2, 3]).forEach(t => jobs.push(P.job({ subject:P.subjectFor(d), title:d.title, category:d.cat, tier:t, tags:d.tags, source:"library", design_id:d.id }))));
} else {
  P.IDEAS.filter(i => category === "all" || i[0] === category).forEach(i =>
    tiersFor(i[3]).forEach(t => jobs.push(P.job({ subject:i[1], category:i[0], tier:t, tags:i[2], source:"idea" }))));
}
const blocked = jobs.filter(j => j.dignity.length);
jobs = jobs.filter(j => !j.dignity.length);
const count = +opt("count", 0);
if (count > 0) jobs = jobs.slice(0, count);
blocked.forEach(j => console.error(`left out ${j.job_id}: ${j.dignity.map(d => `"${d.term}" (${d.kind})`).join(", ")}`));

const out = opt("out");
if (out && out !== true){
  const stem = path.isAbsolute(out) ? out : path.join(ROOT, out);
  fs.mkdirSync(path.dirname(stem), { recursive:true });
  fs.writeFileSync(stem + ".jsonl", jobs.map(j => JSON.stringify(j)).join("\n") + "\n");
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const withOwner = jobs.some(j => j.owner_prompt), gens = Object.keys(P.GENERATORS).concat(withOwner ? ["owner"] : []);
  const cols = ["job_id", "title", "category", "tier", "subject", ...gens];
  fs.writeFileSync(stem + ".csv", cols.join(",") + "\n" + jobs.map(j => [j.job_id, j.title, j.category, j.tier, j.subject, ...gens.map(g => j.prompts[g] || "")].map(q).join(",")).join("\n") + "\n");
  console.log(`Wrote ${jobs.length} job(s) to ${path.relative(ROOT, stem)}.jsonl and .csv${blocked.length ? ` (${blocked.length} left out by the dignity filter)` : ""}.`);
  console.log(`Save each generated image as <job_id>.png in assets/coloring/_inbox/, then run:\n  node scripts/ingest_coloring_assets.mjs --jobs ${path.relative(ROOT, stem)}.jsonl`);
} else {
  jobs.forEach(j => console.log(`# ${j.job_id}  (${C.CAT[j.category].label}, ${j.tier ? C.TIERS[j.tier].label : "master"})\n${j.prompts[generator]}\n`));
  console.log(`${jobs.length} job(s). ${P.GENERATORS[generator].note}`);
}
