#!/usr/bin/env node
/* =====================================================================
   Review sheets for traced art: what a person looks at before approving a
   picture. For each design waiting for review it writes one image, left to
   right: the master as it came in (a red ring marks every line that stops
   close to another, in case a shape was meant to be closed), then the page
   at Tier 1, Tier 2 and Tier 3 exactly as it prints (the same engine, the
   same weights, the same measure); below it, for a design that replaces one,
   the drawing the library has now. And one page, index.html, that lists
   them with the checks and the commands to approve or reject.

   Written to assets/coloring/_review/ (not published: the folder starts with
   an underscore; not committed). Open index.html in a browser.

   Run:  node scripts/review_coloring_art.mjs              the designs waiting for review
         node scripts/review_coloring_art.mjs --all        every ingested design
         node scripts/review_coloring_art.mjs --id sunflower
   Options: --root <dir> (the art files), --out <dir> (where the sheets go)
   Node built-ins only.
   ===================================================================== */
import fs from "fs";
import path from "path";
import { loadCognicopiaColoring, ROOT } from "./lib/cognicopia-coloring.mjs";
import { prepareMaster } from "./lib/master.mjs";
import { traceMaster } from "./lib/trace.mjs";
import { listArt } from "./lib/art.mjs";
import { createBitmap, paint, shapesFromRender } from "./lib/raster.mjs";
import { encodeRGBPNG } from "./lib/png.mjs";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf("--" + name); return i < 0 ? def : (args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true); };
const root = opt("root") !== true && opt("root") ? path.resolve(String(opt("root"))) : ROOT;
const outDir = opt("out") !== true && opt("out") ? path.resolve(String(opt("out"))) : path.join(ROOT, "assets", "coloring", "_review");
const ALL = args.includes("--all"), ONLY = opt("id") !== true && opt("id");
const { C } = loadCognicopiaColoring({ art: false });
const DPI = 100, PW = 400, GAP = 10;
const esc = t => String(t).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");

/* a bitmap shrunk to w x h (any ink in a block of at least a third of it shows) */
function shrink(bmp, w, h){
  const out = createBitmap(w, h), sx = bmp.w / w, sy = bmp.h / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    let s = 0, n = 0;
    for (let yy = Math.floor(y * sy); yy < Math.min(bmp.h, Math.floor((y + 1) * sy)); yy++) for (let xx = Math.floor(x * sx); xx < Math.min(bmp.w, Math.floor((x + 1) * sx)); xx++){ s += bmp.px[yy * bmp.w + xx]; n++; }
    out.px[y * w + x] = n && s / n > .35 ? 1 : 0;
  }
  return out;
}
/* the page as it prints at its smallest size, as a bitmap */
function tierBitmap(id, tier){
  const r = C.render(id, tier), L = C.pageLayout(C.smallestLayout(tier));
  return paint(createBitmap(Math.round(L.artW * DPI), Math.round(L.artH * DPI)), shapesFromRender(C, r, { widthIn: L.artW, dpi: DPI }));
}

const records = listArt(root).filter(a => (ONLY ? a.id === ONLY : ALL || a.review.status === "needs-review"));
if (!records.length){ console.log(ONLY ? `No ingested art for ${ONLY}.` : "Nothing is waiting for review."); process.exit(0); }
fs.mkdirSync(outDir, { recursive: true });

const sections = [];
for (const a of records){
  const rows = [];
  /* the drawing the library has now, before the art replaces it */
  let current = null;
  if (a.mode === "replace" && C.design(a.id) && C.design(a.id).source !== "traced") current = [1, 2, 3].map(t => tierBitmap(a.id, t));
  const rec = { id: a.id, items: a.items, fit: a.fit, pad: a.pad };
  if (a.meta) rec.meta = a.meta;
  C.art.use([rec]);
  const tiers = [1, 2, 3].map(t => tierBitmap(a.id, t));

  /* the master, with the open ends ringed */
  let master = null, ringed = 0, rings = [];
  const src = path.isAbsolute(a.source.file) ? a.source.file : path.join(ROOT, a.source.file);
  if (fs.existsSync(src)){
    try {
      const buf = fs.readFileSync(src), prep = /\.png$/i.test(src) ? prepareMaster({ png: buf }) : prepareMaster({ svg: buf.toString("utf8") });
      if (!prep.error){
        master = prep.bmp;
        rings = traceMaster(master, {}).nearEnds;
        ringed = rings.length;
      }
    } catch (e){ /* the master could not be read again: the sheet goes without it */ }
  }
  const shown = [];
  if (master) shown.push({ bmp: master, rings });
  tiers.forEach(b => shown.push({ bmp: b }));
  rows.push(shown);
  if (current) rows.push(current.map(b => ({ bmp: b, dim: true })));

  /* lay the rows out */
  const cols = Math.max(...rows.map(r => r.length)), ph = Math.round(PW * 4 / 3);
  const W = cols * (PW + GAP) + GAP, H = rows.length * (ph + GAP) + GAP, rgb = new Uint8Array(W * H * 3).fill(255);
  rows.forEach((row, ri) => row.forEach((p, ci) => {
    const ox = GAP + ci * (PW + GAP) + (rows[ri].length < cols && ri > 0 ? (PW + GAP) : 0), oy = GAP + ri * (ph + GAP), sm = shrink(p.bmp, PW, Math.round(PW * p.bmp.h / p.bmp.w));
    for (let y = 0; y < sm.h && y < ph; y++) for (let x = 0; x < PW; x++){
      const v = sm.px[y * PW + x], i = ((oy + y) * W + ox + x) * 3;
      if (v){ const g = p.dim ? 90 : 0; rgb[i] = g; rgb[i + 1] = g; rgb[i + 2] = g; }
    }
    for (const [rx, ry] of p.rings || []){                     // a red ring round every line that stops close to another
      const cx = ox + rx * PW / p.bmp.w, cy = oy + ry * PW / p.bmp.w;
      for (let k = 0; k < 360; k += 3) for (const rad of [9, 10]){ const x = Math.round(cx + rad * Math.cos(k * Math.PI / 180)), y = Math.round(cy + rad * Math.sin(k * Math.PI / 180)); if (x >= 0 && y >= 0 && x < W && y < H){ const i = (y * W + x) * 3; rgb[i] = 220; rgb[i + 1] = 0; rgb[i + 2] = 0; } }
    }
    for (let x = 0; x < PW; x++) for (const yy of [oy - 1, oy + ph]) if (yy >= 0 && yy < H){ const i = (yy * W + ox + x) * 3; rgb[i] = rgb[i + 1] = rgb[i + 2] = 170; }
  }));
  fs.writeFileSync(path.join(outDir, a.id + ".png"), encodeRGBPNG({ w: W, h: H, rgb }));
  sections.push({ a, ringed, hasMaster: !!master, hasCurrent: !!current });
  console.log(`sheet ${a.id}.png  (${a.review.status})`);
}

/* the page */
const mark = r => r === "pass" || r === "confirmed" ? "&#10003;" : r === "fail" ? "&#10007;" : "?";
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cognicopia Coloring: art to review</title>
<style>
:root{color-scheme:light;--ink:#111;--paper:#fff;--line:#bbb;--ok:#0b6b2e;--bad:#a30f0f;--ask:#7a4b00}
body{font:16px/1.5 system-ui,Segoe UI,Arial,sans-serif;color:var(--ink);background:var(--paper);margin:0;padding:16px;max-width:1200px;margin:0 auto}
h1{font-size:1.6rem}h2{font-size:1.25rem;margin:0}section{border-top:2px solid var(--ink);margin-top:28px;padding-top:12px}
img{max-width:100%;height:auto;border:1px solid var(--line)}table{border-collapse:collapse;margin:8px 0}td,th{border:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}
.ok{color:var(--ok)}.fail{color:var(--bad);font-weight:700}.ask{color:var(--ask)}code{background:#f1f1f1;padding:2px 5px;border-radius:3px;word-break:break-all}.sub{color:#444;margin:2px 0 8px}
</style></head><body>
<h1>Art to review</h1>
<p>Left to right: the master as it came in (red rings mark lines that stop close to another line), then Tier 1, Tier 2 and Tier 3 as they print. Below, if it replaces a design, the drawing the library has now. Look at all three tiers: the subject should stay clear and no line should look torn or odd. Then approve or reject with the commands under each picture.</p>
${sections.map(({ a, ringed, hasMaster, hasCurrent }) => `<section id="${esc(a.id)}">
<h2>${esc(a.title)} <small>(${esc(a.id)}, ${a.mode === "replace" ? "replaces the library drawing" : "a new design"}; ${esc(a.review.status)})</small></h2>
<p class="sub">${esc(a.category_id)} &middot; ${(a.bytes / 1000).toFixed(1)} KB of path data &middot; master lines about ${(2 * a.trace.r0 * 72 / 300).toFixed(1)} pt on a 6 in page${a.source.generator ? " &middot; made with " + esc(a.source.generator) : ""}${a.source.license ? " &middot; " + esc(a.source.license) : ""}</p>
<img src="${esc(a.id)}.png" alt="${esc(a.title)}: ${hasMaster ? "the master, then " : ""}Tier 1, Tier 2 and Tier 3${hasCurrent ? ", then the current library drawing at each tier" : ""}">
<table><tr><th>Tier</th><th>Areas to color</th><th>Smallest area (sq in)</th><th>Under the minimum</th><th>Meets the rule</th></tr>
${[1, 2, 3].map(t => { const m = a.tiers[String(t)], T = C.TIERS[t]; return `<tr><td>${esc(T.label)}</td><td>${m.regions}</td><td>${m.smallest_region_sq_in}</td><td>${m.tiny_regions} (allows ${T.maxTiny})</td><td class="${m.meets_rule ? "ok" : "fail"}">${m.meets_rule ? "yes" : "NO"}</td></tr>`; }).join("")}</table>
<ul>${a.checks.map(c => `<li class="${c.result === "pass" || c.result === "confirmed" ? "ok" : c.result === "fail" ? "fail" : "ask"}"><b>${mark(c.result)}</b> ${esc(c.label)}${c.detail ? " <small>&mdash; " + esc(c.detail) + "</small>" : ""}</li>`).join("")}</ul>
${a.source.notes && a.source.notes.length ? `<p><b>Notes:</b> ${esc(a.source.notes.join("; "))}</p>` : ""}
<p>Approve: <code>node scripts/ingest_coloring_assets.mjs --approve ${esc(a.id)} --reviewer "Your name"</code><br>Reject: <code>node scripts/ingest_coloring_assets.mjs --reject ${esc(a.id)} --reviewer "Your name" --reason "why"</code></p>
</section>`).join("\n")}
</body></html>
`;
fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log(`\nWrote ${sections.length} sheet(s) and index.html to ${path.relative(ROOT, outDir) || outDir}. Open index.html in a browser.`);
