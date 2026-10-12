/* =====================================================================
   Traced art, for Node scripts: from a master picture to the art record
   the engine draws, and the files that hold it.

     buildArt(master)   trace the master's center lines (trace.mjs), work out
                        what each tier shows and how it is drawn (tiers.mjs),
                        measure every tier through the engine, and check the
                        trace against the master it came from;
     art files          src/data/coloring_art/<design-id>.json, one per
                        design: the items, where they came from, every check
                        and the review. Only approved art is drawn.

   Node built-ins only.
   ===================================================================== */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { traceMaster, inkDistance, TRACE_DEFAULTS } from "./trace.mjs";
import { deriveTiers, composeItems, measureTiers } from "./tiers.mjs";
import { createBitmap, paint } from "./raster.mjs";

import { ART_DIR } from "./cognicopia-coloring.mjs";
export { ART_DIR };
export const TRACE_VERSION = 1;
const sha256 = s => crypto.createHash("sha256").update(s).digest("hex");
export const itemsHash = items => sha256(JSON.stringify(items));

/* ---------- how well the trace matches its master ---------- */
function flatten(ops, steps){
  const subs = []; let cur = null;
  for (const o of ops){
    if (o.op === "M"){ cur = { pts: [o.p], closed: false }; subs.push(cur); }
    else if (o.op === "L") cur.pts.push(o.p);
    else { const a = cur.pts[cur.pts.length - 1]; for (let k = 1; k <= steps; k++){ const t = k / steps, u = 1 - t; cur.pts.push([u*u*u*a[0] + 3*u*u*t*o.c1[0] + 3*u*t*t*o.c2[0] + t*t*t*o.p[0], u*u*u*a[1] + 3*u*u*t*o.c1[1] + 3*u*t*t*o.c2[1] + t*t*t*o.p[1]]); } }
  }
  return subs;
}
function whiteRegions(bmp, minPx){
  const { w, h, px } = bmp, N = w * h, lab = new Int32Array(N), stack = new Int32Array(N); let n = 0;
  for (let i = 0; i < N; i++){
    if (px[i] || lab[i]) continue;
    let top = 0, a = 0, edge = false; stack[top++] = i; lab[i] = 1;
    while (top){
      const j = stack[--top], x = j % w, y = (j / w) | 0; a++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (x > 0 && !px[j - 1] && !lab[j - 1]){ lab[j - 1] = 1; stack[top++] = j - 1; }
      if (x < w - 1 && !px[j + 1] && !lab[j + 1]){ lab[j + 1] = 1; stack[top++] = j + 1; }
      if (y > 0 && !px[j - w] && !lab[j - w]){ lab[j - w] = 1; stack[top++] = j - w; }
      if (y < h - 1 && !px[j + w] && !lab[j + w]){ lab[j + w] = 1; stack[top++] = j + w; }
    }
    if (!edge && a >= minPx) n++;
  }
  return n;
}

/* The traced lines drawn again at the master's own line width, laid over the master: how far a traced
   line strays from the ink, how much ink it leaves out, and whether the areas to color agree. */
export function fidelity(master, trace){
  const { w, h } = master, shapes = [];
  for (const e of trace.edges) shapes.push({ subpaths: flatten(e.ops, 12), fill: null, stroke: 2 * trace.r0 });
  for (const b of trace.blobGeom || []){
    shapes.push({ subpaths: [{ pts: b.outer.loop.slice(0, -1), closed: true }], fill: 1, stroke: 0 });
    for (const hole of b.holes) shapes.push({ subpaths: [{ pts: hole.loop.slice(0, -1), closed: true }], fill: 0, stroke: 0 });
  }
  const drawn = paint(createBitmap(w, h), shapes), N = w * h;
  const inverse = b => { const px = new Uint8Array(N); for (let i = 0; i < N; i++) px[i] = b.px[i] ? 0 : 1; return { w, h, px }; };
  const dMaster = inkDistance(inverse(master)), dDrawn = inkDistance(inverse(drawn));
  const stray = [], missing = []; let ink = 0, xor = 0;
  for (let i = 0; i < N; i++){
    if (master.px[i]) ink++;
    if (master.px[i] !== drawn.px[i]) xor++;
    if (drawn.px[i] && !master.px[i]) stray.push(dMaster[i]);
    if (master.px[i] && !drawn.px[i]) missing.push(dDrawn[i]);
  }
  const q = (a, f) => a.length ? a.sort((x, y) => x - y)[Math.floor(f * (a.length - 1))] : 0;
  return { xor_share: +(xor / Math.max(1, ink)).toFixed(3), stray_p99_px: +q(stray, .99).toFixed(1), missing_p99_px: +q(missing, .99).toFixed(1),
    regions_master: whiteRegions(master, 50), regions_traced: whiteRegions(drawn, 50) };
}

/**
 * Trace a master and work out its art.
 * opts.fit / opts.pad: as for a design (default "subject", .05).
 * opts.tierMasters: { 2: bitmap, 3: bitmap }, a drawing made for that tier, used as it is
 *   (traced, not simplified) instead of the tier being worked out from the main master.
 * opts.budget: bytes of path data to aim for (default 45000); opts.trace, opts.rules: tracer and tier settings (see trace.mjs, tiers.mjs).
 * Returns { items, tiers, trace, fidelity, derived, notes, bytes }.
 */
export function buildArt(master, opts){
  opts = opts || {};
  const meta = { fit: opts.fit || "subject", pad: opts.pad == null ? .05 : opts.pad }, budget = opts.budget || 45000;
  /* A dense picture needs more path data than the library can carry a hundred times over: curves are fitted a
     little looser, in steps, until it is within the budget (the loosest still lies within a pixel or two of the line). */
  let trace, derived, byTier, accents, notes, items, scale = 1;
  for (const loosen of [1, 1.6, 2.4]){
    scale = loosen;
    const tOpts = Object.assign({}, opts.trace);
    if (loosen > 1){ tOpts.fitError = (tOpts.fitError || TRACE_DEFAULTS.fitError) * loosen; tOpts.pathSigma = (tOpts.pathSigma || TRACE_DEFAULTS.pathSigma) * (1 + (loosen - 1) * .3); }
    trace = traceMaster(master, tOpts);
    derived = deriveTiers(trace, { meta, rules: opts.rules });
    byTier = Object.assign({}, derived.byTier); accents = Object.assign({}, derived.accents);
    notes = trace.notes.concat(derived.notes);
    for (const t of [2, 3]){
      const m = opts.tierMasters && opts.tierMasters[t];
      if (!m) continue;
      const tr = traceMaster(m, tOpts), d = deriveTiers(tr, { meta, rules: opts.rules });
      byTier[t] = d.byTier[1]; accents[t] = d.accents[1];                      // a drawing of its own: every stroke of it, as traced
      notes.push(`Tier ${t} comes from its own drawing`);
    }
    items = composeItems(byTier, accents);
    if (JSON.stringify(items).length <= budget) break;
  }
  if (scale > 1) notes.push(`curves fitted ${scale} times looser to bring the art within ${(budget / 1000).toFixed(0)} KB`);
  const tiers = measureTiers(items, meta);
  return {
    items, tiers, meta, notes, derived: { faces: derived.faces, rounds: derived.steps, cuts: derived.cuts, loose_strokes: derived.loose, between_areas: derived.separating, pieces: derived.pieces },
    trace: { version: TRACE_VERSION, r0: +trace.r0.toFixed(2), stats: trace.stats, near_ends: trace.nearEnds.length, looser: scale },
    fidelity: fidelity(master, trace), bytes: JSON.stringify(items).length, nearEnds: trace.nearEnds, graphTrace: trace
  };
}

/* ---------- the files ---------- */
export const artFile = (root, id) => path.join(root, ART_DIR, id + ".json");
export function readArt(root, id){
  const f = artFile(root, id);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
}
export function listArt(root){
  const dir = path.join(root, ART_DIR);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort().map(f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) : [];
}
export function writeArt(root, art){
  const f = artFile(root, art.id);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(art, null, 1) + "\n");
  return f;
}

export { approvedArt } from "./cognicopia-coloring.mjs";
