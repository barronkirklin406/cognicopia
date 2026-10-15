/* =====================================================================
   Detail levels for traced line art, for Node scripts.

   One drawing has to serve three tiers: Tier 1 shows everything, Tier 2 the
   guiding lines, Tier 3 only the big shapes. A design made in code says, for
   every line, the least-detailed tier that still shows it (the "lv" of
   g.S / g.D). A traced picture has no such notes, so they are worked out
   here from the picture itself:

     1. the traced strokes are painted as a wall, and the white between them
        is labeled: each enclosed area is a "face" (the exterior is one);
     2. every stroke is sorted by what it does: it separates two faces, or
        it is a loose line inside one face (a vein, a whisker, a stem);
     3. the faces are merged smallest first, each into the neighbor it shares
        the most outline with. A stroke leaves the picture at the step where
        the two areas it divided become one, so the order is "the finest
        details go first", the way a person would simplify a drawing;
     4. for each tier, the fewest merges are chosen that make the page pass
        that tier's rule when it is drawn and measured by the engine itself
        (no more small areas than the tier allows, a few large areas at the
        top tiers). Cuts only fall between groups of different size, so a
        ring of equal petals goes together or stays together;
     5. loose lines are kept by length, small separate pieces by size, and
        solid accents by area.

   Strokes that border the outside are the picture's outline (main weight);
   the rest are detail lines. The result is the item list the engine's
   CognicopiaColoring.art.use() takes: [[kind, lv, d], ...].
   Deterministic. Node built-ins only.
   ===================================================================== */
import { loadCognicopiaColoring } from "./cognicopia-coloring.mjs";
import { traceMaster, gaussBlur } from "./trace.mjs";

export const TIER_RULES = {
  /* What a tier aims for, from how the hand-made library simplifies its own pages (median across all
     150 designs: Tier 2 keeps 70% of the areas to color, Tier 3 keeps 36%). Aims, not limits: a tier
     takes the cut that lands closest, as long as the engine's rule (areas under the minimum) is met. */
  share: { 2: .7, 3: .36 },                         // of Tier 1's areas to color
  floor: { 2: 6, 3: 3 },                            // never aim below this many areas
  ceiling: { 2: 30, 3: 12 },                        // ... or above this many (the prompts' 12-30 and 4-12)
  looseMin: { 1: 0, 2: .04, 3: .12 },               // a line that stands alone: shortest kept, as a share of the picture's size
  structural: .14,                                  // a stroke between two areas this long (a frame, a wall, a leaf's edge) holds them apart ...
  held: .25,                                        // ... unless one of them is smaller than this (sq in at the smallest print): a sliver is not worth keeping
  pieceMin: { 1: 0, 2: .05, 3: .25 },               // separate pieces: smallest kept, as a share of the main piece
  accent: { lv1: .03, lv2: .008 },                  // solid accents: area (sq in at the smallest print) to show at every tier / at Tiers 1 and 2 (smaller ones are Tier 1 only)
  together: .25,                                    // faces within this share of the smallest one merge in the same round (a ring of equal petals goes together)
  smooth: { 2: .35, 3: .8 }                         // how much a tier rounds its outlines, as a share of its line width: detail much smaller than its line goes
};

/* ---------- painting the wall and labeling the faces ---------- */
function line(x0, y0, x1, y1, plot){
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (;;){
    plot(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy){ err -= dy; x0 += sx; }
    if (e2 < dx){ err += dx; y0 += sy; }
  }
}
function fillLoop(mask, w, h, loop, value){
  let y0 = Infinity, y1 = -Infinity;
  for (const p of loop){ if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(h - 1, Math.ceil(y1)); y++){
    const xs = [];
    for (let i = 0; i + 1 < loop.length; i++){ const p = loop[i], q = loop[i + 1]; if ((p[1] <= y + .5) !== (q[1] <= y + .5)) xs.push(p[0] + (y + .5 - p[1]) / (q[1] - p[1]) * (q[0] - p[0])); }
    xs.sort((a, b) => a - b);
    for (let j = 0; j + 1 < xs.length; j += 2) for (let x = Math.max(0, Math.ceil(xs[j] - .5)); x <= Math.min(w - 1, Math.floor(xs[j + 1] - .5)); x++) mask[y * w + x] = value;
  }
}

export function paintWalls(trace){
  const { w, h } = trace, wall = new Uint8Array(w * h);
  const plot = (x, y) => { if (x >= 0 && y >= 0 && x < w && y < h) wall[y * w + x] = 1; };
  for (const e of trace.edges){
    const p = e.pts;
    for (let i = 1; i < p.length; i++) line(Math.round(p[i - 1][0]), Math.round(p[i - 1][1]), Math.round(p[i][0]), Math.round(p[i][1]), plot);
  }
  for (const b of trace.blobGeom || []){
    fillLoop(wall, w, h, b.outer.loop, 1);
    for (const hole of b.holes) fillLoop(wall, w, h, hole.loop, 0);
  }
  return wall;
}

/* White areas, 4-connected. Returns { lab, areas, ext } (label 0 is wall; areas[label] in pixels). */
export function labelFaces(wall, w, h){
  const N = w * h, lab = new Int32Array(N), stack = new Int32Array(N), areas = [0];
  let id = 0;
  for (let i = 0; i < N; i++){
    if (wall[i] || lab[i]) continue;
    id++; let top = 0, a = 0; stack[top++] = i; lab[i] = id;
    while (top){
      const j = stack[--top], x = j % w; a++;
      if (x > 0 && !wall[j - 1] && !lab[j - 1]){ lab[j - 1] = id; stack[top++] = j - 1; }
      if (x < w - 1 && !wall[j + 1] && !lab[j + 1]){ lab[j + 1] = id; stack[top++] = j + 1; }
      if (j >= w && !wall[j - w] && !lab[j - w]){ lab[j - w] = id; stack[top++] = j - w; }
      if (j < N - w && !wall[j + w] && !lab[j + w]){ lab[j + w] = id; stack[top++] = j + w; }
    }
    areas.push(a);
  }
  return { lab, areas, ext: lab[0] || lab[w - 1] || lab[N - 1] || lab[N - w] };
}

/* Which two faces does a stroke run between? Samples a few pixels either side all along it and votes. */
function strokeSides(e, lab, wall, w, h){
  const p = e.pts, left = new Map(), right = new Map();
  const vote = (m, x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= w || y >= h || wall[y * w + x]) return false; const l = lab[y * w + x]; m.set(l, (m.get(l) || 0) + 1); return true; };
  for (let i = 0; i < p.length; i++){
    const a = p[Math.max(0, i - 3)], b = p[Math.min(p.length - 1, i + 3)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const L = Math.hypot(tx, ty); if (L < 1e-6) continue;
    tx /= L; ty /= L;
    const nx = -ty, ny = tx;
    for (const d of [3, 5, 8]) if (vote(left, p[i][0] + nx * d, p[i][1] + ny * d)) break;
    for (const d of [3, 5, 8]) if (vote(right, p[i][0] - nx * d, p[i][1] - ny * d)) break;
  }
  const top = m => { let best = 0, n = 0; for (const [l, c] of m) if (c > n || (c === n && l < best)){ best = l; n = c; } return best; };
  return [top(left), top(right)];
}

/* ---------- merging faces, smallest first ----------
   Faces go in rounds: the smallest face and every face within a quarter of its size merge at the same
   time, each into the neighbor outside that group it shares the most outline with. Equal faces (the
   wedges between the spokes of a wheel, the petals of a flower) therefore all go the same way, and a
   cut never leaves half a wheel. A stroke leaves at the round where the areas it divided become one. */
function mergeFaces(faces, ext, sep, tolerance, smallPx){
  const parent = faces.map((_, i) => i), find = i => { while (parent[i] !== i) i = parent[i]; return i; };
  const area = faces.slice(), rounds = [], done = new Set();
  for (;;){
    const ex = find(ext), live = [];
    for (let f = 1; f < faces.length; f++) if (parent[f] === f && f !== ex && !done.has(f)) live.push(f);
    if (!live.length) break;
    let a0 = Infinity; for (const f of live) if (area[f] < a0) a0 = area[f];
    const cls = new Set(live.filter(f => area[f] <= a0 * (1 + tolerance))), next = new Map(), bound = new Map();
    const add = (m, g, h, len) => { if (!m.has(g)) m.set(g, new Map()); m.get(g).set(h, (m.get(g).get(h) || 0) + len); };
    for (const s of sep){
      const a = find(s.left), b = find(s.right);
      if (a === b) continue;
      const m = s.structural ? bound : next;                     // a long stroke holds big areas apart; a small area is not held
      if (cls.has(a)) add(m, a, b, s.len);
      if (cls.has(b)) add(m, b, a, s.len);
    }
    const merges = [];
    for (const g of [...cls].sort((x, y) => x - y)){
      let m = next.get(g);
      if (!m && area[g] < smallPx) m = bound.get(g);
      if (!m){ done.add(g); continue; }                          // held by long strokes only, or enclosed by solid areas only
      let into = -1, best = -1;
      for (const [h, len] of m){ if (cls.has(h) || h === ex) continue; if (len > best || (len === best && h < into)){ best = len; into = h; } }
      if (into < 0){                                            // only its own kind, or only the outside around it
        for (const [h, len] of m){ if (h === ex) continue; if (len > best || (len === best && h < into)){ best = len; into = h; } }
        if (into < 0) into = ex;                                // a floating piece leaves with its outline
      }
      merges.push([g, into]);
    }
    if (!merges.length) continue;
    const applied = [];
    for (const [g, into] of merges){ const t = find(into); if (find(g) === t) continue; parent[g] = t; area[t] += area[g]; applied.push([g, t]); }
    if (!applied.length){ for (const g of cls) done.add(g); continue; }
    rounds.push({ pop: a0, merges: applied });
    const n = rounds.length;
    for (const s of sep) if (s.rank === Infinity && find(s.left) === find(s.right)) s.rank = n;
  }
  return rounds;
}

/* ---------- strokes, tier by tier, drawn by the engine ---------- */
const engine = () => loadCognicopiaColoring().C;

function group(list){
  // [[kind, tiers, d]] with one item per kind and set of tiers
  const by = new Map();
  for (const [kind, lv, d] of list){ const k = kind + lv; if (!by.has(k)) by.set(k, [kind, lv, []]); by.get(k)[2].push(d); }
  const order = ["d", "m", "k"];
  return [...by.values()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]) || a[1] - b[1]).map(([kind, lv, ds]) => [kind, lv, ds.join(" ")]);
}

export function renderArt(items, tier, meta){
  const C = engine();
  return C.renderWith(Object.assign({ id: "trace-check", title: "trace", fit: "subject", pad: .05 }, meta || {}), C.art.draw(items), tier);
}
export function measureArt(items, tier, meta){
  const C = engine();
  try {
    const r = renderArt(items, tier, meta), q = C.quality.measureRender(r, { strokes: false });
    return q.m;
  } catch (e){ return null; }
}


/* ---------- a tier's outlines: the merged areas, rounded to the tier's scale ----------
   Dropping strokes leaves the outlines of what remains exactly as detailed as they were: a ring of
   petals that has become one area still has a point and a notch for every petal. A thick line cannot
   draw that, and it looks torn. So for Tiers 2 and 3 the outlines are drawn again from the areas:
   each merged area is blurred and every spot goes to the area with the most of it around (which
   rounds corners, fills notches and drops points narrower than the tier's line), and the lines run
   where the areas meet. */
function groupLabels(F, root, w, h){
  const N = w * h, out = new Int32Array(N);
  for (let i = 0; i < N; i++) out[i] = F.lab[i] ? root[F.lab[i]] : 0;
  // the lines themselves go to the nearest area (breadth first, four ways)
  const q = new Int32Array(N); let head = 0, tail = 0;
  for (let i = 0; i < N; i++){
    if (!out[i]) continue;
    const x = i % w;
    if ((x > 0 && !out[i - 1]) || (x < w - 1 && !out[i + 1]) || (i >= w && !out[i - w]) || (i < N - w && !out[i + w])) q[tail++] = i;
  }
  while (head < tail){
    const i = q[head++], x = i % w, v = out[i];
    if (x > 0 && !out[i - 1]){ out[i - 1] = v; q[tail++] = i - 1; }
    if (x < w - 1 && !out[i + 1]){ out[i + 1] = v; q[tail++] = i + 1; }
    if (i >= w && !out[i - w]){ out[i - w] = v; q[tail++] = i - w; }
    if (i < N - w && !out[i + w]){ out[i + w] = v; q[tail++] = i + w; }
  }
  return out;
}

/* Blur each area on a coarser grid (b master pixels to a cell) and give every cell to the area with most of it. */
function roundAreas(grp, w, h, b, sigma){
  const gw = Math.floor(w / b), gh = Math.floor(h / b), M = gw * gh, N = w * h;
  let maxG = 0; for (let i = 0; i < N; i++) if (grp[i] > maxG) maxG = grp[i];
  const start = new Int32Array(maxG + 2);
  for (let i = 0; i < N; i++) start[grp[i] + 1]++;
  for (let g = 1; g <= maxG + 1; g++) start[g] += start[g - 1];
  const fill = start.slice(), order = new Int32Array(N);
  for (let i = 0; i < N; i++) order[fill[grp[i]]++] = i;
  const bestVal = new Float32Array(M).fill(-1), bestLab = new Int32Array(M), pad = Math.ceil(3 * sigma) + 2, unitArea = 1 / (b * b);
  for (let g = 1; g <= maxG; g++){
    if (start[g] === start[g + 1]) continue;
    let x0 = gw, y0 = gh, x1 = -1, y1 = -1;
    for (let k = start[g]; k < start[g + 1]; k++){
      const i = order[k], gx = Math.min(gw - 1, ((i % w) / b) | 0), gy = Math.min(gh - 1, ((i / w | 0) / b) | 0);
      if (gx < x0) x0 = gx; if (gx > x1) x1 = gx; if (gy < y0) y0 = gy; if (gy > y1) y1 = gy;
    }
    const rw = x1 - x0 + 1 + 2 * pad, rh = y1 - y0 + 1 + 2 * pad, acc = new Float32Array(rw * rh);
    for (let k = start[g]; k < start[g + 1]; k++){
      const i = order[k], gx = Math.min(gw - 1, ((i % w) / b) | 0), gy = Math.min(gh - 1, ((i / w | 0) / b) | 0);
      acc[(gy - y0 + pad) * rw + gx - x0 + pad] += unitArea;
    }
    const blur = gaussBlur(acc, rw, rh, sigma);
    for (let y = Math.max(0, y0 - pad); y <= Math.min(gh - 1, y1 + pad); y++) for (let x = Math.max(0, x0 - pad); x <= Math.min(gw - 1, x1 + pad); x++){
      const v = blur[(y - y0 + pad) * rw + x - x0 + pad], i = y * gw + x;
      if (v > bestVal[i]){ bestVal[i] = v; bestLab[i] = g; }
    }
  }
  return { lab: bestLab, gw, gh };
}

/* An area smaller than minPx (after rounding) is noise: it joins the neighbor it shares the most edge with. */
function dropSpecks(lab, gw, gh, minPx, keep){
  const M = gw * gh, seen = new Uint8Array(M), stack = new Int32Array(M);
  for (let i = 0; i < M; i++){
    if (seen[i]) continue;
    const v = lab[i], comp = []; let top = 0; stack[top++] = i; seen[i] = 1;
    while (top){
      const j = stack[--top], x = j % gw; comp.push(j);
      if (x > 0 && !seen[j - 1] && lab[j - 1] === v){ seen[j - 1] = 1; stack[top++] = j - 1; }
      if (x < gw - 1 && !seen[j + 1] && lab[j + 1] === v){ seen[j + 1] = 1; stack[top++] = j + 1; }
      if (j >= gw && !seen[j - gw] && lab[j - gw] === v){ seen[j - gw] = 1; stack[top++] = j - gw; }
      if (j < M - gw && !seen[j + gw] && lab[j + gw] === v){ seen[j + gw] = 1; stack[top++] = j + gw; }
    }
    if (comp.length >= minPx || v === keep) continue;
    const votes = new Map();
    for (const j of comp){ const x = j % gw; for (const n of [x > 0 ? j - 1 : -1, x < gw - 1 ? j + 1 : -1, j >= gw ? j - gw : -1, j < M - gw ? j + gw : -1]) if (n >= 0 && lab[n] !== v) votes.set(lab[n], (votes.get(lab[n]) || 0) + 1); }
    let best = -1, n = 0; for (const [l, c] of votes) if (c > n || (c === n && l < best)){ best = l; n = c; }
    if (best >= 0) for (const j of comp) lab[j] = best;
  }
}

/* The outlines at the meeting of areas, as strokes: [[kind, d]]. */
function outlinesOf(lab, gw, gh, exteriorGroup, o){
  const M = gw * gh, ink = new Uint8Array(M);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++){
    const i = y * gw + x;
    if (x + 1 < gw && lab[i] !== lab[i + 1]){ ink[i] = 1; ink[i + 1] = 1; }
    if (y + 1 < gh && lab[i] !== lab[i + gw]){ ink[i] = 1; ink[i + gw] = 1; }
  }
  const tr = traceMaster({ w: gw, h: gh, px: ink }, { dpi: 100, smoothSigma: .6, gap: 0, spurMin: 9, minPiece: 45, fitError: o.fitError, pathSigma: o.pathSigma, cornerAngle: o.cornerAngle, cornerWindow: 4, blobMinArea: 1 });
  const at = (x, y) => { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= gw || y >= gh ? 0 : lab[y * gw + x]; };
  return tr.edges.map(e => {
    let outer = false;
    for (let i = 0; i < e.pts.length && !outer; i += 3){
      const a = e.pts[Math.max(0, i - 3)], b = e.pts[Math.min(e.pts.length - 1, i + 3)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
      const p = e.pts[i];
      if (at(p[0] - ty * 3, p[1] + tx * 3) === exteriorGroup || at(p[0] + ty * 3, p[1] - tx * 3) === exteriorGroup) outer = true;
    }
    return [outer ? "m" : "d", e.d];
  });
}


/* The art items for the engine from each tier's own strokes and accents:
   [[kind, tiers, d], ...], tiers being bit 1 (Tier 1), 2 (Tier 2), 4 (Tier 3). A stroke or accent drawn the
   same at several tiers is one item. byTier[t] is [[kind, d], ...]; accents[t] is [d, ...]. */
export function composeItems(byTier, accents){
  const masks = new Map();
  const put = (kind, d, mask) => { const k = kind + "|" + d; if (!masks.has(k)) masks.set(k, { kind, d, mask: 0 }); masks.get(k).mask |= mask; };
  for (const t of [1, 2, 3]){
    // Tier 3 is the heaviest-line tier: its interior strokes are drawn at the outline weight too, so no line on it prints thinner than 7.9 pt
    for (const [kind, d] of byTier[t] || []) put(t === 3 && kind === "d" ? "m" : kind, d, 1 << (t - 1));
    for (const d of accents[t] || []) put("k", d, 1 << (t - 1));
  }
  const grouped = new Map();
  for (const { kind, d, mask } of masks.values()){ const k = kind + mask; if (!grouped.has(k)) grouped.set(k, [kind, mask, []]); grouped.get(k)[2].push(d); }
  const order = ["d", "m", "k"];
  return [...grouped.values()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]) || a[1] - b[1]).map(([kind, mask, ds]) => [kind, mask, ds.join(" ")]);
}

/** Measure finished items at every tier, through the engine: { 1: {...}, 2: {...}, 3: {...} }. */
export function measureTiers(items, meta){
  const C = engine(), out = {};
  for (const t of [1, 2, 3]){
    const m = measureArt(items, t, meta);
    out[t] = m ? { regions: m.regions, tiny_regions: m.tiny_regions, smallest_region_sq_in: m.smallest_region_sq_in, median_region_sq_in: m.median_region_sq_in, subject_fill: m.subject_fill, ink_coverage: m.ink_coverage,
      meets_rule: m.regions >= 1 && m.tiny_regions <= C.TIERS[t].maxTiny } : { regions: 0, tiny_regions: 0, smallest_region_sq_in: 0, median_region_sq_in: 0, subject_fill: 0, ink_coverage: 0, meets_rule: false };
  }
  return out;
}

/**
 * Work out the items for the engine from a trace.
 * trace: traceMaster() result. o.meta: { fit, pad }. o.rules overrides TIER_RULES.
 * Returns { items, report, notes, faces }.
 */
export function deriveTiers(trace, o){
  o = o || {};
  const C = engine(), R = Object.assign({}, TIER_RULES, o.rules || {}), notes = [];
  const { w, h } = trace;
  const wall = paintWalls(trace), F = labelFaces(wall, w, h);
  const strokes = trace.edges.map(e => {
    const [left, right] = strokeSides(e, F.lab, wall, w, h);
    return { e, left, right, len: e.len, sep: left && right && left !== right, rank: Infinity, outer: left === F.ext || right === F.ext, comp: 0 };
  });

  // separate pieces, by the strokes that touch each other
  const byNode = new Map();
  strokes.forEach((s, i) => { for (const n of [s.e.a, s.e.b]){ if (!byNode.has(n)) byNode.set(n, []); byNode.get(n).push(i); } });
  const comp = new Array(strokes.length).fill(-1); let nc = 0;
  strokes.forEach((s, i) => {
    if (comp[i] >= 0) return;
    const stack = [i]; comp[i] = nc;
    while (stack.length){ const j = stack.pop(); for (const n of [strokes[j].e.a, strokes[j].e.b]) for (const k of byNode.get(n)) if (comp[k] < 0){ comp[k] = nc; stack.push(k); } }
    nc++;
  });
  const compBox = Array.from({ length: nc }, () => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, len: 0 }));
  strokes.forEach((s, i) => { s.comp = comp[i]; const b = compBox[comp[i]]; b.len += s.len; for (const p of s.e.pts){ if (p[0] < b.x0) b.x0 = p[0]; if (p[0] > b.x1) b.x1 = p[0]; if (p[1] < b.y0) b.y0 = p[1]; if (p[1] > b.y1) b.y1 = p[1]; } });
  let main = 0; compBox.forEach((b, i) => { if (b.len > compBox[main].len) main = i; });
  const diag = b => Math.hypot(b.x1 - b.x0, b.y1 - b.y0), mainDiag = Math.max(1, diag(compBox[main]));
  const box = compBox[main];
  for (const b of trace.blobs){ const x0 = b.bbox[0], y0 = b.bbox[1], x1 = b.bbox[2], y1 = b.bbox[3]; box.x0 = Math.min(box.x0, x0); box.y0 = Math.min(box.y0, y0); box.x1 = Math.max(box.x1, x1); box.y1 = Math.max(box.y1, y1); }
  const size = Math.max(box.x1 - box.x0, box.y1 - box.y0, 1);

  for (const s of strokes) s.structural = s.sep && s.len / size >= R.structural;
  const sqIn = C.pageLayout(C.smallestLayout(1)).artW / 6;                           // master inches -> printed inches (the master is 6 in wide)
  const dpiM = w / 6, smallPx = R.held / (sqIn * sqIn) * dpiM * dpiM;               // the master pixels in an area too small to be held by a long stroke
  const steps = mergeFaces(F.areas, F.ext, strokes.filter(s => s.sep), R.together, smallPx);
  const cands = [0]; for (let k = 1; k <= steps.length; k++) cands.push(k);          // a cut may fall between any two rounds

  const accentLv = b => { const a = b.area / (dpiM * dpiM) * sqIn * sqIn; return a >= R.accent.lv1 ? 1 : a >= R.accent.lv2 ? 2 : 3; };
  // a separate piece stays by its size; a line that stands alone by its length; a stroke between two areas by the merges (or for good, if it is long)
  const pieceLv = s => { if (s.comp === main) return 1; const pc = diag(compBox[s.comp]) / mainDiag; return pc >= R.pieceMin[3] ? 1 : pc >= R.pieceMin[2] ? 2 : 3; };
  const lvl = t => C.TIERS[t].lvl;
  const standsAlone = (s, t) => t === 1 || (s.len / size >= R.looseMin[t] && pieceLv(s) <= lvl(t));
  const shown = (s, t, cut) => s.sep ? s.rank > cut && pieceLv(s) <= lvl(t) : standsAlone(s, t);
  const kindOf = s => s.outer || (!s.sep && s.left === F.ext) ? "m" : "d";

  // for each tier, the cut that lands closest to its aim while the engine's rule is met, when the engine draws and measures it
  const T = C.TIERS, cuts = { 1: 0, 2: 0, 3: 0 };
  const hard = (t, m) => !!m && m.regions >= 1 && m.tiny_regions <= T[t].maxTiny;
  const evalTier = (t, cut) => {
    const list = [];
    for (const s of strokes) if (shown(s, t, cut)) list.push([kindOf(s), 7, s.e.d]);
    for (const b of trace.blobs) if (b.d && accentLv(b) <= lvl(t)) list.push(["k", 7, b.d]);
    const items = group(list), m = items.length ? measureArt(items, t, o.meta) : null;
    return m;
  };
  let from = 0, regions1 = 0;
  for (const t of [1, 2, 3]){
    const list = cands.filter(c => c >= from), memo = new Map();
    const get = i => { if (!memo.has(i)) memo.set(i, evalTier(t, list[i])); return memo.get(i); };
    const aim = t === 1 ? Infinity : Math.max(R.floor[t], Math.min(R.ceiling[t], Math.round(R.share[t] * regions1)));
    let pick = -1, nearest = Infinity;
    for (let i = 0; i < list.length; i++){                             // less detail as more is merged: stop once past the aim
      const m = get(i);
      if (!hard(t, m)) continue;
      if (t === 1){ pick = i; break; }
      const off = Math.abs(m.regions - aim);
      if (off < nearest){ pick = i; nearest = off; }
      if (m.regions <= aim) break;
    }
    if (pick < 0){
      // nothing meets the rule: take the cut with the fewest small areas, and say so
      let tiny = Infinity;
      list.forEach((_, i) => { const m = get(i), v = m ? m.tiny_regions : Infinity; if (v < tiny){ tiny = v; pick = i; } });
      if (pick < 0) pick = 0;
      notes.push(`Tier ${t}: no amount of simplifying met the rule (fewest small areas: ${tiny}, ${T[t].maxTiny} allowed)`);
    }
    cuts[t] = list[pick]; from = cuts[t];
    if (t === 1) regions1 = (get(pick) || { regions: 0 }).regions;
  }

  // the finished tiers. Tier 1 is the picture as traced; Tiers 2 and 3 are drawn again from their merged areas.
  const bit = t => 1 << (t - 1), accentMask = b => { const lv = accentLv(b); return lv === 1 ? 7 : lv === 2 ? 3 : 1; };
  const nFaces = F.areas.length, Cw = C.WEIGHTS, artW = t => C.pageLayout(C.smallestLayout(t)).artW;
  const linePx = t => Cw[T[t].weight].pt / 72 / artW(t) * 600;                      // the tier's line width in picture units (600 across)
  const roundedTier = (t, cut) => {
    const parent = Array.from({ length: nFaces }, (_, i) => i), find = i => { while (parent[i] !== i) i = parent[i]; return i; };
    for (let i = 0; i < cut; i++) for (const [g, into] of steps[i].merges) parent[g] = into;
    const root = new Int32Array(nFaces); for (let i = 1; i < nFaces; i++) root[i] = find(i);
    const b = Math.max(1, Math.round(1 / trace.k)), grp = groupLabels(F, root, w, h), sigma = R.smooth[t] * linePx(t);
    const { lab, gw, gh } = roundAreas(grp, w, h, b, sigma);
    const unit = artW(t) / 600, minPx = Math.round(T[t].minArea * .5 / (unit * unit));
    dropSpecks(lab, gw, gh, minPx, root[F.ext]);
    const lines = outlinesOf(lab, gw, gh, root[F.ext], { fitError: Math.max(.45, linePx(t) * .04), pathSigma: Math.max(1.2, sigma * .45), cornerAngle: t === 2 ? 55 : 62 });
    const out = lines.map(([kind, d]) => [kind, d]), loose = [];
    for (const s of strokes) if (!s.sep && standsAlone(s, t)){ out.push([kindOf(s), s.e.d]); loose.push(s.e.d); }
    return out;
  };
  const byTier = {};
  const first = [];
  for (const s of strokes) if (shown(s, 1, cuts[1])) first.push([kindOf(s), s.e.d]);
  byTier[1] = first;
  const measureTier = (t, pairs) => {
    const list = pairs.map(([kind, d]) => [t === 3 && kind === "d" ? "m" : kind, 7, d]);   // measured at the weight Tier 3 prints at
    for (const b of trace.blobs) if (b.d && accentLv(b) <= lvl(t)) list.push(["k", 7, b.d]);
    const its = group(list);
    return its.length ? measureArt(its, t, o.meta) : null;
  };
  for (const t of [2, 3]){
    let idx = Math.max(0, cands.indexOf(Math.max(cuts[t], t === 3 ? cuts[2] : 0))), pairs = null, m = null;
    for (let attempt = 0; attempt < 6; attempt++){
      try { pairs = roundedTier(t, cands[idx]); } catch (e){ pairs = null; }
      m = pairs && pairs.length ? measureTier(t, pairs) : null;
      if (hard(t, m)) break;
      if (idx >= cands.length - 1) break;
      idx++;
    }
    if (!hard(t, m)){                                                   // could not be redrawn: keep the strokes of the cut
      pairs = []; for (const s of strokes) if (shown(s, t, cuts[t])) pairs.push([kindOf(s), s.e.d]);
      notes.push(`Tier ${t}: kept the traced strokes (the rounded outlines did not meet the rule)`);
    } else cuts[t] = cands[idx];
    byTier[t] = pairs;
  }

  const accents = {};
  for (const t of [1, 2, 3]) accents[t] = trace.blobs.filter(b => b.d && accentLv(b) <= lvl(t)).map(b => b.d);
  const items = composeItems(byTier, accents);

  // the finished picture, measured through the engine exactly as it will print
  const report = {};
  for (const t of [1, 2, 3]){
    const m = measureArt(items, t, o.meta);
    report[t] = { cut: cuts[t], regions: m ? m.regions : 0, tiny_regions: m ? m.tiny_regions : 0, smallest_region_sq_in: m ? m.smallest_region_sq_in : 0,
      subject_fill: m ? m.subject_fill : 0, meets_rule: hard(t, m), bytes: byTier[t].reduce((n, p) => n + p[1].length, 0) };
  }
  return { items, report, notes, byTier, accents, faces: F.areas.length - 1, steps: steps.length, cands, cuts, loose: strokes.filter(s => !s.sep).length, separating: strokes.filter(s => s.sep).length, pieces: nc };
}
