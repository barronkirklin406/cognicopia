#!/usr/bin/env node
/* =====================================================================
   Margins and size of every coloring page, measured the way the catalog measures them (assets/cognicopia-coloring/quality.js): each design drawn at
   each tier, printed to a 1-bit bitmap, and the least white left round the subject, how far it reaches across the page, and its small areas read off.
   The owner's rule of November 19, 2026: the whole subject inside the page with at least 8% of white on every side, as large as that allows
   (45% of the page filled, or 78% across on its long side). Prints a table; exits 1 when a design in the list fails.

     node scripts/audit-coloring-margins.mjs              every design
     node scripts/audit-coloring-margins.mjs --json out.json
     node scripts/audit-coloring-margins.mjs --only sunday-sedan,woody-wagon
   ===================================================================== */
import fs from "fs";
import { loadCognicopiaColoring } from "./lib/cognicopia-coloring.mjs";
import { createBitmap, paint, shapesFromRender, measure } from "./lib/raster.mjs";

const args = process.argv.slice(2), only = args.indexOf("--only") >= 0 ? (args[args.indexOf("--only") + 1] || "").split(",").filter(Boolean) : [], jsonOut = args.indexOf("--json") >= 0 ? args[args.indexOf("--json") + 1] : null;
const { C } = loadCognicopiaColoring();
const MEASURE_DPI = 100, NOISE_SQ_IN = .003, MIN_MARGIN = .08;
const rows = [];
for (const d of C.designs()){
  if (only.length && !only.includes(d.id)) continue;
  const tiers = [];
  for (const t of [1, 2, 3]){
    const T = C.TIERS[t], L = C.pageLayout(C.smallestLayout(t)), r = C.render(d.id, t);
    const bmp = paint(createBitmap(Math.round(L.artW * MEASURE_DPI), Math.round(L.artH * MEASURE_DPI)), shapesFromRender(C, r, { widthIn: L.artW, dpi: MEASURE_DPI }));
    const m = measure(bmp, { dpi: MEASURE_DPI, noiseSqIn: NOISE_SQ_IN, minSqIn: T.minArea });
    tiers.push({ tier: t, margin_min: m.margin_min, fill: m.subject_fill, span: m.subject_span, tiny: m.tiny_regions, max_tiny: T.maxTiny, regions: m.regions });
  }
  const margin = Math.min(...tiers.map(x => x.margin_min)), fill = Math.min(...tiers.map(x => x.fill)), span = Math.min(...tiers.map(x => x.span));
  const sized = margin >= MIN_MARGIN && (fill >= .45 || span >= .78), areas = tiers.every(x => x.tiny <= x.max_tiny);
  rows.push({ id: d.id, title: d.title, margin, fill, span, sized, areas, tiers });
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
const bad = rows.filter(r => !r.sized || !r.areas);
for (const r of rows.slice().sort((a, b) => a.margin - b.margin)) console.log(`${(r.margin * 100).toFixed(1).padStart(5)}%  fill ${Math.round(r.fill * 100).toString().padStart(2)}%  span ${Math.round(r.span * 100).toString().padStart(2)}%  ${r.sized ? "size ok " : "SIZE    "}${r.areas ? "areas ok" : "AREAS   "}  ${r.id}  ${r.title}`);
console.log(`${rows.length} design(s); ${rows.filter(r => !r.sized).length} below the margin or size rule; ${rows.filter(r => !r.areas).length} with too many small areas`);
process.exit(only.length && bad.length ? 1 : 0);
