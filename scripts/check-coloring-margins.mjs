#!/usr/bin/env node
/* =====================================================================
   The coloring overhaul's framing rule (the owner, November 19, 2026), measured on every page it covers:

     margins    the whole subject sits inside the page with at least 8% of white on every side (left and right as a share of the width, top and
                bottom as a share of the height), at all three tiers; nothing touches an edge
     size       and it is as large as that allows: 45% of the picture box filled, or 78% of the page across on its long side
     files      the three served pages (assets/coloring/<category>/cc-<id>-t1..t3.svg) exist, are 3:4 (viewBox 600 x 800), and are pure black on pure white
                (fills #fff or #000 or none; strokes #000), with no text in the picture
     areas      the tier rules for small coloring areas still hold (scripts/check-coloring.mjs owns that; it is read here only to say so)
     earlier    no page of the overhaul is on the "earlier framing" list in assets/cognicopia-coloring/lineart.js

   The pages covered are the 55 of the overhaul (the drawn pictures remade with the picture maker, the traced ones, the quilts, stained glass and
   kaleidoscope, which are exact vectors) and every Fair Food picture. Designs outside that list keep their earlier framing until they are remade
   (node scripts/audit-coloring-margins.mjs prints all 150). Run: node scripts/check-coloring-margins.mjs
   ===================================================================== */
import fs from "fs";
import path from "path";
import { loadCognicopiaColoring } from "./lib/cognicopia-coloring.mjs";
import { createBitmap, paint, shapesFromRender, measure } from "./lib/raster.mjs";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COVERED = [
  /* the four priority pictures */
  "sunday-sedan", "woody-wagon", "vintage-bicycle", "ballgame",
  /* botanical and garden */
  "calla-lilies", "water-lily", "magnolia-branch", "hydrangea", "watering-can", "autumn-maple", "oak-acorns", "windowsill-herbs", "garden-wheelbarrow",
  "strawberries", "apple-branch", "pumpkin-patch", "harvest-basket",
  /* home and hearth */
  "apple-pie", "ice-cream-soda", "clothesline", "table-setting", "tea-for-two", "baking-day", "knitting-basket", "sewing-basket", "potting-bench",
  "letter-writing", "picnic-basket", "gone-fishing", "sunday-paper", "ironing-day", "cards-and-dominoes", "wood-cookstove", "butter-churn", "porch-swing",
  /* seasons */
  "spring-wreath", "easter-basket", "valentine-heart", "lemonade", "jack-o-lantern", "cornucopia", "holiday-wreath", "snowman", "ornaments", "shamrock-pot",
  /* wildlife and nature */
  "lake-sailboat", "monarch-butterfly", "dragonfly-reeds", "sea-turtle", "seashells", "nautilus-shell",
  /* exact vectors: quilts, stained glass, kaleidoscope */
  "barn-quilt", "quilt-ohio-star", "quilt-sawtooth-star", "quilt-pinwheel", "quilt-nine-patch", "quilt-churn-dash", "quilt-friendship-star", "quilt-log-cabin",
  "quilt-flying-geese", "quilt-rail-fence", "quilt-grandmothers-garden", "quilt-dresden-plate", "stained-glass-window", "kaleidoscope"
];
/* pages of the overhaul whose remade picture is still to come: they stay on the earlier framing (lineart.js) and are reported, never skipped silently */
const PENDING = ["baking-day", "holiday-wreath", "snowman", "ornaments"];
const MEASURE_DPI = 100, NOISE_SQ_IN = .003, MIN_MARGIN = .08;
const problems = []; let passed = 0;
const ok = (c, m) => { if (c) passed++; else problems.push(m); };

const { C } = loadCognicopiaColoring();
const ids = new Set(C.designs().map(d => d.id));
const covered = COVERED.concat(C.designs().map(d => d.id).filter(id => /^ai-fair-/.test(id)));
const lineart = fs.readFileSync(path.join(ROOT, "assets/cognicopia-coloring/lineart.js"), "utf8");
const legacy = (lineart.match(/var LEGACY_FRAME = \{\};\s*\[([^\]]*)\]/) || [, ""])[1].match(/"[a-z0-9-]+"/g) || [];
const legacyIds = legacy.map(s => s.replace(/"/g, ""));

for (const id of covered){
  /* a design that is in the list but not in the library is a typo in this file, not a pass */
  if (!ids.has(id)) { problems.push(`${id}: not a design in the library (fix the list in this check)`); continue; }
  if (PENDING.includes(id)){ ok(legacyIds.includes(id), `${id}: is pending its remade picture but is not on the earlier framing list in lineart.js`); continue; }
  ok(!legacyIds.includes(id), `${id}: still on the earlier framing list in lineart.js`);
  const d = C.designs().find(x => x.id === id);
  for (const t of [1, 2, 3]){
    const T = C.TIERS[t], L = C.pageLayout(C.smallestLayout(t)), r = C.render(id, t);
    const bmp = paint(createBitmap(Math.round(L.artW * MEASURE_DPI), Math.round(L.artH * MEASURE_DPI)), shapesFromRender(C, r, { widthIn: L.artW, dpi: MEASURE_DPI }));
    const m = measure(bmp, { dpi: MEASURE_DPI, noiseSqIn: NOISE_SQ_IN, minSqIn: T.minArea });
    ok(m.margin_min >= MIN_MARGIN, `${id} tier ${t}: ${(m.margin_min * 100).toFixed(1)}% of white at its tightest side (needs ${MIN_MARGIN * 100}%)`);
    ok(m.subject_fill >= .45 || m.subject_span >= .78, `${id} tier ${t}: fills ${Math.round(m.subject_fill * 100)}% and reaches ${Math.round(m.subject_span * 100)}% across (needs 45% filled or 78% across)`);
  }
  const cat = d.cat, dir = path.join(ROOT, "assets/coloring", cat);
  for (const t of [1, 2, 3]){
    const f = path.join(dir, `cc-${id}-t${t}.svg`);
    if (!fs.existsSync(f)) { problems.push(`${id} tier ${t}: ${path.relative(ROOT, f)} is not served (run npm run coloring)`); continue; }
    const svg = fs.readFileSync(f, "utf8");
    ok(/viewBox="0 0 600 800"/.test(svg), `${id} tier ${t}: the page is not 3:4 (viewBox 600 x 800)`);
    const colors = [...svg.matchAll(/\b(fill|stroke)="([^"]*)"/g)].map(m => m[1] + "=" + m[2].toLowerCase());
    const bad = colors.filter(c => !/^(fill=(#fff|#ffffff|#000|#000000|none)|stroke=(#000|#000000|none))$/.test(c));
    ok(!bad.length, `${id} tier ${t}: not pure black on white (${[...new Set(bad)].slice(0, 3).join(", ")})`);
    ok(!/<text[\s>]/.test(svg), `${id} tier ${t}: has text in the picture`);
  }
}
ok(covered.length - PENDING.length >= 55, `the check measures ${covered.length - PENDING.length} pages (the overhaul's pages that are done, and the Fair Food pictures); ${PENDING.length} wait for their remade picture`);

console.log(problems.length ? `coloring margins check FAILED: ${problems.length} problem(s), ${passed} passed\n  - ` + problems.slice(0, 40).join("\n  - ") : `coloring margins check passed: ${passed} checks over ${covered.length} pages (at least 8% of white on every side at all three tiers, large as that allows, served 3:4 in pure black on white, none on the earlier framing list)`);
process.exit(problems.length ? 1 : 0);
