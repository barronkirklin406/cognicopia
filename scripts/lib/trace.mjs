/* =====================================================================
   Centerline tracer for line-art masters, for Node scripts.

   A picture from an image generator is a bitmap of ink lines. The coloring
   engine does not want the ink: it wants the lines' centers, as clean
   curves, because the engine draws every line itself at the weight its
   tier asks for (4, 6 or 10.5 px at the printed size, never under 3 pt).
   This file turns the bitmap into those centers:

     1. smooth the ink, so a ragged edge does not grow whiskers;
     2. find solid black accents (an eye, a tire) and set them aside;
     3. thin the rest to a one-pixel skeleton, ordered by distance from the
        edge so the skeleton runs down the middle of every line;
     4. read the skeleton as a graph of strokes, with a node at every
        junction and every free end;
     5. clean the graph: prune the short spurs a corner or a rough edge
        leaves, join the two junctions of a crossing, close small gaps
        where a line stops just short of another, drop specks;
     6. fit each stroke with cubic curves (Schneider's algorithm), keeping
        corners sharp and straight runs straight.

   The result is geometry only. scripts/lib/tiers.mjs then decides which
   strokes each tier shows. Everything here is deterministic: the same
   bitmap and options give the same strokes, byte for byte.
   Node built-ins only.
   ===================================================================== */

const INF = 1e20;

export const TRACE_DEFAULTS = {
  smoothSigma: 1.1,        // px at the master's size: rounds ragged edges, keeps real corners
  spurMin: 7,              // px: a branch shorter than this is a spur ...
  spurK: 2.4,              // ... or shorter than this many line half-widths
  contractK: 1.8,          // junctions closer than this many half-widths become one
  gap: 8,                  // px of white between the inks: a free end this close to another stroke is joined to it (a vein stops further off)
  gapCone: 40,             // degrees either side of the end's direction
  minPiece: 26,            // px: a separate piece with less line than this is a speck
  fitError: 1.15,          // px: how far a fitted curve may stray from the skeleton
  cornerAngle: 52,         // degrees of turn that make a corner
  cornerWindow: 8,         // px each side used to measure a turn
  pathSigma: 1.7,          // px: smoothing along a stroke before fitting
  blobK: 2.3,              // a black area wider than this many line half-widths is solid (a crossing of lines bulges to 1.41, a doubled line to about 2)
  blobMinArea: 0.0035      // sq in (at 300 DPI): smaller solid areas are specks
};

const RING = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];   // N NE E SE S SW W NW

/* ---------- tables for 3 x 3 neighborhoods ----------
   A neighborhood is eight bits, one per RING position, 1 = ink. For a pixel
   p, SIMPLE says that taking p away keeps the ink's connectedness (8-way) and
   the white's (4-way); BRANCHES counts the runs of ink around p, which is how
   many strokes meet there. */
const SIMPLE = new Uint8Array(256), BRANCHES = new Uint8Array(256), DEGREE = new Uint8Array(256);
(function buildTables(){
  const adj8 = (i, j) => Math.max(Math.abs(RING[i][0] - RING[j][0]), Math.abs(RING[i][1] - RING[j][1])) <= 1;
  const adj4 = (i, j) => Math.abs(RING[i][0] - RING[j][0]) + Math.abs(RING[i][1] - RING[j][1]) === 1;
  const components = (set, adj) => {
    const seen = new Set(), comps = [];
    for (const s of set){
      if (seen.has(s)) continue;
      const comp = [s], stack = [s]; seen.add(s);
      while (stack.length){ const a = stack.pop(); for (const b of set) if (!seen.has(b) && adj(a, b)){ seen.add(b); comp.push(b); stack.push(b); } }
      comps.push(comp);
    }
    return comps;
  };
  for (let m = 0; m < 256; m++){
    const ink = [], white = [];
    for (let i = 0; i < 8; i++) (m >> i & 1 ? ink : white).push(i);
    DEGREE[m] = ink.length;
    let runs = 0; for (let i = 0; i < 8; i++) if ((m >> i & 1) && !(m >> ((i + 7) & 7) & 1)) runs++;
    BRANCHES[m] = ink.length === 8 ? 0 : runs;
    const c8 = components(ink, adj8).length;
    const wc = components(white, adj4).filter(c => c.some(i => i % 2 === 0)).length;      // white pieces touching p along a side
    SIMPLE[m] = c8 === 1 && wc === 1 ? 1 : 0;
  }
})();

/* ---------- smoothing and distances ---------- */
/* Gaussian blur of a w x h picture of numbers (three box blurs approximate it), as a new array. */
export function gaussBlur(src, w, h, sigma){
  const N = w * h;
  let a = Float32Array.from(src), b = new Float32Array(N);
  if (!(sigma > 0)) return a;
  const wIdeal = Math.sqrt(12 * sigma * sigma / 3 + 1);
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
  const wu = wl + 2, mIdeal = (12 * sigma * sigma - 3 * wl * wl - 4 * wl * 3 - 3 * 3) / (-4 * wl - 4), m = Math.round(mIdeal);
  const sizes = [0, 1, 2].map(i => i < m ? wl : wu);
  const boxH = (src, dst, r) => {
    const inv = 1 / (r + r + 1);
    for (let y = 0; y < h; y++){
      const o = y * w; let acc = 0;
      for (let x = -r; x <= r; x++) acc += src[o + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++){
        dst[o + x] = acc * inv;
        acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
      }
    }
  };
  const boxV = (src, dst, r) => {
    const inv = 1 / (r + r + 1);
    for (let x = 0; x < w; x++){
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += src[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++){
        dst[y * w + x] = acc * inv;
        acc += src[Math.min(h - 1, y + r + 1) * w + x] - src[Math.max(0, y - r) * w + x];
      }
    }
  };
  for (const sz of sizes){ const r = (sz - 1) >> 1; boxH(a, b, r); boxV(b, a, r); }
  return a;
}

/* Blur the ink (a 0/1 picture) and keep what is more than half ink: rounds
   ragged edges and pinholes without moving a clean edge. */
export function smoothMask(bmp, sigma){
  const { w, h, px } = bmp, N = w * h;
  if (!(sigma > 0)) return { w, h, px: new Uint8Array(px) };
  const a = gaussBlur(px, w, h, sigma), out = new Uint8Array(N);
  for (let i = 0; i < N; i++) out[i] = a[i] > .5 ? 1 : 0;
  return { w, h, px: out, field: a };
}

/* Distance in pixels from each ink pixel to the nearest white pixel (0 on white).
   Exact Euclidean (Felzenszwalb and Huttenlocher). Pixels outside the picture count as white. */
export function inkDistance(bmp){
  const { w, h, px } = bmp, N = w * h, d = new Float32Array(N);
  const n = Math.max(w, h), f = new Float64Array(n), out = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const pass = (len, get, set) => {
    for (let q = 0; q < len; q++) f[q] = get(q);
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++){
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]){ k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++){ while (z[k + 1] < q) k++; out[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
    for (let q = 0; q < len; q++) set(q, out[q]);
  };
  // the picture's border counts as white: pad conceptually by treating row/column -1 as white
  for (let i = 0; i < N; i++) d[i] = px[i] ? INF : 0;
  for (let x = 0; x < w; x++) pass(h, q => d[q * w + x], (q, val) => { d[q * w + x] = val; });
  for (let y = 0; y < h; y++) pass(w, q => d[y * w + q], (q, val) => { d[y * w + q] = val; });
  for (let i = 0; i < N; i++){
    if (!px[i]) { d[i] = 0; continue; }
    const x = i % w, y = (i / w) | 0, edge = Math.min(x + 1, y + 1, w - x, h - y);        // distance to the border (a white pixel just outside)
    d[i] = Math.min(Math.sqrt(d[i]), edge);
  }
  return d;
}

/* ---------- thinning ----------
   Parallel two-pass thinning (Guo and Hall, 1989), run from a work list of
   the pixels on the edge of the ink. Each pass takes away edge pixels that
   keep the shape's connections, from alternate sides, so a stroke thins to
   its middle without eating its own end. A last sequential pass removes the
   spare corner pixels the parallel passes leave on a diagonal. */
const GH = [new Uint8Array(256), new Uint8Array(256)];
(function buildThinTables(){
  for (let m = 0; m < 256; m++){
    const p2 = m & 1, p3 = m >> 1 & 1, p4 = m >> 2 & 1, p5 = m >> 3 & 1, p6 = m >> 4 & 1, p7 = m >> 5 & 1, p8 = m >> 6 & 1, p9 = m >> 7 & 1;
    const C = (!p2 & (p3 | p4) ? 1 : 0) + (!p4 & (p5 | p6) ? 1 : 0) + (!p6 & (p7 | p8) ? 1 : 0) + (!p8 & (p9 | p2) ? 1 : 0);
    const N1 = (p9 | p2) + (p3 | p4) + (p5 | p6) + (p7 | p8), N2 = (p2 | p3) + (p4 | p5) + (p6 | p7) + (p8 | p9), N = Math.min(N1, N2);
    const m0 = (p6 | p7 | (p9 ? 0 : 1)) & p8, m1 = (p2 | p3 | (p5 ? 0 : 1)) & p4;
    GH[0][m] = C === 1 && N >= 2 && N <= 3 && m0 === 0 ? 1 : 0;
    GH[1][m] = C === 1 && N >= 2 && N <= 3 && m1 === 0 ? 1 : 0;
  }
})();

export function thin(bmp){
  const { w, h } = bmp, W = w + 2, H = h + 2, a = new Uint8Array(W * H);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[(y + 1) * W + x + 1] = bmp.px[y * w + x];
  const off = RING.map(([dx, dy]) => dy * W + dx);
  const bits = i => (a[i + off[0]] | a[i + off[1]] << 1 | a[i + off[2]] << 2 | a[i + off[3]] << 3 | a[i + off[4]] << 4 | a[i + off[5]] << 5 | a[i + off[6]] << 6 | a[i + off[7]] << 7);
  const stamp = new Int32Array(W * H); let tick = 0;
  let cand = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const i = (y + 1) * W + x + 1;
    if (a[i] && (!a[i - 1] || !a[i + 1] || !a[i - W] || !a[i + W] || !a[i - W - 1] || !a[i - W + 1] || !a[i + W - 1] || !a[i + W + 1])) cand.push(i);
  }
  let idle = 0;
  for (let iter = 0; cand.length && idle < 2; iter ^= 1){
    const del = [];
    for (const i of cand) if (a[i] && GH[iter][bits(i)]) del.push(i);
    tick++;
    const next = [];
    for (const i of del) a[i] = 0;
    for (const i of cand) if (a[i] && stamp[i] !== tick){ stamp[i] = tick; next.push(i); }
    for (const i of del) for (let k = 0; k < 8; k++){ const n = i + off[k]; if (a[n] && stamp[n] !== tick){ stamp[n] = tick; next.push(n); } }
    idle = del.length ? 0 : idle + 1;
    cand = next;
  }
  // spare pixels (a thick corner, a doubled diagonal): any pixel that keeps the shape's connections and
  // is not the end of a stroke goes, one at a time, until none is left
  const left = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const i = (y + 1) * W + x + 1; if (a[i]) left.push(i); }
  for (let changed = true; changed;){
    changed = false;
    for (const i of left){
      if (!a[i]) continue;
      const m = bits(i);
      if (DEGREE[m] < 2 || !SIMPLE[m]) continue;
      let keepsEnds = true;                                          // never leave a neighbor as a new stroke end
      for (let k = 0; k < 8 && keepsEnds; k++) if (m >> k & 1 && DEGREE[bits(i + off[k])] < 3) keepsEnds = false;
      if (!keepsEnds) continue;
      a[i] = 0; changed = true;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = a[(y + 1) * W + x + 1];
  return out;
}

/* ---------- the skeleton as a graph of strokes ---------- */
class Graph {
  constructor(){ this.nodes = new Map(); this.edges = new Map(); this.nextNode = 0; this.nextEdge = 0; }
  addNode(x, y, extra){ const n = Object.assign({ id: this.nextNode++, x, y, edges: [] }, extra); this.nodes.set(n.id, n); return n; }
  addEdge(a, b, pts, r){
    const e = { id: this.nextEdge++, a: a.id, b: b.id, pts, r, len: pathLength(pts) };
    this.edges.set(e.id, e); a.edges.push(e.id); if (b.id !== a.id) b.edges.push(e.id); else a.edges.push(e.id);
    return e;
  }
  degree(n){ return n.edges.length; }                       // a loop counts twice
  other(e, nid){ return e.a === nid ? e.b : e.a; }
  removeEdge(e){
    for (const nid of [e.a, e.b]){ const n = this.nodes.get(nid); let i; while ((i = n.edges.indexOf(e.id)) >= 0) n.edges.splice(i, 1); }
    this.edges.delete(e.id);
  }
  removeNode(n){ this.nodes.delete(n.id); }
  /* the stroke's points, running away from node nid */
  from(e, nid){ return e.a === nid ? e.pts : e.pts.slice().reverse(); }
}

function pathLength(pts){ let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; }

export function skeletonGraph(sk, w, h, dt){
  const W = w + 2, H = h + 2, S = new Uint8Array(W * H);
  let count = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (sk[y * w + x]){ S[(y + 1) * W + x + 1] = 1; count++; }
  const off = RING.map(([dx, dy]) => dy * W + dx);
  const bits = i => (S[i + off[0]] | S[i + off[1]] << 1 | S[i + off[2]] << 2 | S[i + off[3]] << 3 | S[i + off[4]] << 4 | S[i + off[5]] << 5 | S[i + off[6]] << 6 | S[i + off[7]] << 7);
  const px = i => (i % W) - 1, py = i => ((i / W) | 0) - 1;
  const radius = i => dt[py(i) * w + px(i)];
  const cls = new Uint8Array(W * H);                       // 1 end, 2 along a stroke, 3 junction
  const ids = [], crowded = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const i = (y + 1) * W + x + 1; if (!S[i]) continue;
    const d = DEGREE[bits(i)];
    cls[i] = d === 0 ? 0 : d === 1 ? 1 : 2;
    if (d >= 3) crowded.push(i);
    ids.push(i);
  }
  // A junction is where three or more strokes leave a small cluster of crowded pixels: a crossing of two diagonals
  // is a 2 x 2 block, not a single pixel, and a thick corner is a crowd with only two ways out.
  {
    const mark = new Int32Array(W * H).fill(-1);
    for (const i of crowded){
      if (mark[i] >= 0) continue;
      const comp = [i], stack = [i]; mark[i] = i;
      while (stack.length){ const c = stack.pop(); for (let k = 0; k < 8; k++){ const n = c + off[k]; if (S[n] && DEGREE[bits(n)] >= 3 && mark[n] < 0){ mark[n] = i; comp.push(n); stack.push(n); } } }
      const out = new Set();
      for (const c of comp) for (let k = 0; k < 8; k++){ const n = c + off[k]; if (S[n] && mark[n] !== i) out.add(n); }
      const list = [...out], par = list.map((_, j) => j), find = j => { while (par[j] !== j) j = par[j] = par[par[j]]; return j; };
      for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) if (Math.abs(px(list[a]) - px(list[b])) <= 1 && Math.abs(py(list[a]) - py(list[b])) <= 1) par[find(a)] = find(b);
      const branches = new Set(list.map((_, j) => find(j))).size;
      if (branches >= 3) for (const c of comp) cls[c] = 3;
    }
  }
  const g = new Graph(), nodeAt = new Int32Array(W * H).fill(-1), members = new Map();
  // junction clusters and free ends become nodes
  for (const i of ids){
    if (cls[i] !== 3 || nodeAt[i] >= 0) continue;
    const comp = [i], stack = [i]; nodeAt[i] = -2;
    while (stack.length){ const c = stack.pop(); for (let k = 0; k < 8; k++){ const n = c + off[k]; if (cls[n] === 3 && nodeAt[n] === -1){ nodeAt[n] = -2; comp.push(n); stack.push(n); } } }
    let sx = 0, sy = 0; for (const c of comp){ sx += px(c); sy += py(c); }
    const node = g.addNode(sx / comp.length, sy / comp.length, { junction: true });
    for (const c of comp) nodeAt[c] = node.id;
    members.set(node.id, comp);
  }
  for (const i of ids){
    if (cls[i] !== 1) continue;
    const node = g.addNode(px(i), py(i), { junction: false });
    nodeAt[i] = node.id; members.set(node.id, [i]);
  }
  const visited = new Uint8Array(W * H);
  const pos = i => [px(i), py(i)];
  const touches = (a, b) => { const dx = Math.abs(px(a) - px(b)), dy = Math.abs(py(a) - py(b)); return dx <= 1 && dy <= 1; };
  const order = [4, 0, 2, 6, 1, 3, 5, 7];                  // sides before corners, so a walk keeps to the stroke
  for (const node of [...g.nodes.values()]){
    for (const p of members.get(node.id)){
      for (let k = 0; k < 8; k++){
        const q0 = p + off[k];
        if (!S[q0] || visited[q0] || nodeAt[q0] === node.id || nodeAt[q0] >= 0) continue;
        // walk a stroke from node, starting at q0, until another node
        const pts = [[node.x, node.y]], rs = [];
        let prev = p, cur = q0, end = -1;
        for (;;){
          if (nodeAt[cur] >= 0){ end = nodeAt[cur]; break; }
          visited[cur] = 1; pts.push(pos(cur)); rs.push(radius(cur));
          let next = -1, nextNear = -1, nodeNext = -1;
          for (const kk of order){
            const n = cur + off[kk];
            if (!S[n] || n === prev) continue;
            if (nodeAt[n] >= 0 && !(prev === p && nodeAt[n] === node.id && pts.length < 3)){ nodeNext = n; break; }
            if (visited[n]) continue;
            // a neighbor that also touches the pixel we came from is a corner of a small triangle: take the other way if there is one
            if (touches(n, prev)){ if (nextNear < 0) nextNear = n; } else if (next < 0) next = n;
          }
          if (nodeNext >= 0){ end = nodeAt[nodeNext]; break; }
          if (next < 0) next = nextNear;
          if (next < 0) break;
          prev = cur; cur = next;
        }
        if (end < 0) continue;                              // a walk that ran into a dead end of leftovers
        const endNode = g.nodes.get(end);
        pts.push([endNode.x, endNode.y]);
        const r = rs.length ? rs.reduce((s, v) => s + v, 0) / rs.length : radius(p);
        g.addEdge(node, endNode, pts, r);
      }
    }
  }
  // strokes that are closed loops with no junction on them
  for (const i of ids){
    if (cls[i] !== 2 || visited[i]) continue;
    // is it a leftover next to a walked stroke, or a loop of its own?
    const comp = [i], stack = [i], seen = new Set([i]); let attached = false;
    while (stack.length){
      const c = stack.pop();
      for (let k = 0; k < 8; k++){
        const n = c + off[k]; if (!S[n]) continue;
        if (visited[n] || nodeAt[n] >= 0){ attached = true; continue; }
        if (!seen.has(n)){ seen.add(n); comp.push(n); stack.push(n); }
      }
    }
    for (const c of comp) visited[c] = 1;
    if (attached || comp.length < 6) continue;
    // walk around it
    const start = comp[0], pts = [pos(start)], rs = [radius(start)], mark = new Set([start]);
    let cur = start, prevPx = start;
    for (;;){
      let next = -1;
      let near = -1;
      for (const kk of order){ const n = cur + off[kk]; if (!S[n] || mark.has(n) || !seen.has(n)) continue; if (cur !== start && touches(n, prevPx)){ if (near < 0) near = n; } else { next = n; break; } }
      if (next < 0) next = near;
      if (next < 0) break;
      mark.add(next); pts.push(pos(next)); rs.push(radius(next)); prevPx = cur; cur = next;
    }
    pts.push(pos(start));
    const node = g.addNode(pts[0][0], pts[0][1], { junction: false, loopAnchor: true });
    g.addEdge(node, node, pts, rs.reduce((s, v) => s + v, 0) / rs.length);
  }
  return g;
}

/* ---------- cleaning the graph ---------- */
function mergeThrough(g, n){
  // a node with exactly two strokes is not a junction: join them into one
  if (n.junction === true && g.degree(n) !== 2) return;
  if (g.degree(n) !== 2 || n.loopAnchor) return;
  const [e1id, e2id] = n.edges;
  if (e1id === e2id) return;                                 // a loop through its own node
  const e1 = g.edges.get(e1id), e2 = g.edges.get(e2id);
  const p1 = g.from(e1, n.id).slice().reverse();            // running into n
  const p2 = g.from(e2, n.id);                              // running out of n
  const a = g.nodes.get(g.other(e1, n.id)), b = g.nodes.get(g.other(e2, n.id));
  const pts = p1.concat(p2.slice(1));
  const r = (e1.r * e1.len + e2.r * e2.len) / Math.max(1e-9, e1.len + e2.len);
  g.removeEdge(e1); g.removeEdge(e2); g.removeNode(n);
  g.addEdge(a, b, pts, r);
}

function pruneSpurs(g, o){
  let removed = 0, changed = true;
  while (changed){
    changed = false;
    for (const e of [...g.edges.values()]){
      if (!g.edges.has(e.id) || e.a === e.b) continue;
      const na = g.nodes.get(e.a), nb = g.nodes.get(e.b), da = g.degree(na), db = g.degree(nb);
      if (!((da === 1 && db >= 3) || (db === 1 && da >= 3))) continue;
      const free = da === 1 ? na : nb, joint = da === 1 ? nb : na;
      if (free.anchored) continue;
      const jr = Math.max(e.r, ...joint.edges.map(id => g.edges.get(id).r));
      if (e.len < Math.max(o.spurMin, o.spurK * jr)){
        g.removeEdge(e); g.removeNode(free); removed++; changed = true;
        mergeThrough(g, joint);
      }
    }
  }
  return removed;
}

/* Two junctions a few pixels apart are one crossing drawn with a short link. */
function contractLinks(g, o){
  let n = 0, changed = true;
  while (changed){
    changed = false;
    for (const e of [...g.edges.values()].sort((x, y) => x.len - y.len)){
      if (!g.edges.has(e.id) || e.a === e.b) continue;
      const na = g.nodes.get(e.a), nb = g.nodes.get(e.b);
      if (g.degree(na) < 3 || g.degree(nb) < 3) continue;
      if (e.len >= o.contractK * Math.max(e.r, 2)) continue;
      // keep two strokes that make a tiny face between the same pair of junctions
      if (na.edges.filter(id => id !== e.id && g.other(g.edges.get(id), na.id) === nb.id).length) continue;
      const mx = (na.x + nb.x) / 2, my = (na.y + nb.y) / 2;
      g.removeEdge(e);
      for (const id of [...nb.edges]){
        const f = g.edges.get(id), pts = f.pts;
        if (f.a === nb.id){ f.a = na.id; pts[0] = [mx, my]; }
        if (f.b === nb.id){ f.b = na.id; pts[pts.length - 1] = [mx, my]; }
        na.edges.push(id);
      }
      na.x = mx; na.y = my;
      for (const id of na.edges){ const f = g.edges.get(id); if (f.a === na.id) f.pts[0] = [mx, my]; if (f.b === na.id) f.pts[f.pts.length - 1] = [mx, my]; f.len = pathLength(f.pts); }
      g.removeNode(nb);
      n++; changed = true;
      break;
    }
  }
  return n;
}

function direction(pts, atEnd, span){
  // unit vector pointing out of the stroke at one end
  const n = pts.length, tip = atEnd ? pts[n - 1] : pts[0];
  let acc = 0, i = atEnd ? n - 2 : 1, ref = tip;
  while (i >= 0 && i < n){ ref = pts[i]; acc = Math.hypot(tip[0] - ref[0], tip[1] - ref[1]); if (acc >= span) break; i += atEnd ? -1 : 1; }
  const dx = tip[0] - ref[0], dy = tip[1] - ref[1], L = Math.hypot(dx, dy) || 1;
  return [dx / L, dy / L];
}

/* Free ends that stop just short of another stroke are joined to it. */
function closeGaps(g, o){
  const cone = Math.cos(o.gapCone * Math.PI / 180);
  let closed = 0;
  for (let guard = 0; guard < 2000; guard++){
    let maxR = 1; for (const e of g.edges.values()) if (e.r > maxR) maxR = e.r;
    const cell = Math.max(4, o.gap + 2 * maxR + 2);                  // a gap is measured between the inks: the skeletons are a line's half-width further apart at each end
    const grid = new Map(), keyOf = (x, y) => Math.floor(x / cell) + "," + Math.floor(y / cell);
    for (const e of g.edges.values()) e.pts.forEach((p, i) => { const k = keyOf(p[0], p[1]); (grid.get(k) || grid.set(k, []).get(k)).push([e.id, i]); });
    let best = null;
    for (const n of g.nodes.values()){
      if (g.degree(n) !== 1 || n.anchored) continue;
      const eid = n.edges[0], e = g.edges.get(eid), atEnd = e.b === n.id && e.a !== n.id;
      const own = atEnd ? e.pts.length - 1 : 0, dir = direction(e.pts, atEnd, 6);
      const cx = Math.floor(n.x / cell), cy = Math.floor(n.y / cell);
      for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++){
        for (const [fid, idx] of grid.get(gx + "," + gy) || []){
          const f = g.edges.get(fid), p = f.pts[idx], dx = p[0] - n.x, dy = p[1] - n.y, d = Math.hypot(dx, dy), reach = o.gap + e.r + f.r;
          if (d < 1e-9 || d > reach) continue;
          if (fid === eid){
            // not back along its own stroke
            const along = atEnd ? own - idx : idx - own;
            if (along < Math.max(10, 1.5 * reach)) continue;
          }
          if ((dx * dir[0] + dy * dir[1]) / d < cone) continue;
          if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) < 1e-9 && (n.id < best.node.id))) best = { d, node: n, edge: f, idx, p };
        }
      }
    }
    if (!best) break;
    let target;
    const f = best.edge, last = f.pts.length - 1;
    const nearA = best.idx <= 2, nearB = best.idx >= last - 2;
    if ((nearA || nearB) && f.a !== f.b || (nearA && f.a === f.b)){
      target = g.nodes.get(nearA ? f.a : f.b);
      if (target.id === best.node.id) { best.node.anchored = true; continue; }
    } else {
      // split the stroke it runs into, making a new junction there
      const split = f.pts, p = split[best.idx];
      const nj = g.addNode(p[0], p[1], { junction: true });
      const nA = g.nodes.get(f.a), nB = g.nodes.get(f.b);
      const first = split.slice(0, best.idx + 1), second = split.slice(best.idx);
      const r = f.r;
      g.removeEdge(f);
      g.addEdge(nA, nj, first, r); g.addEdge(nj, nB, second, r);
      target = nj;
    }
    const bridge = [[best.node.x, best.node.y], [target.x, target.y]];
    (g.bridges = g.bridges || []).push({ from: [best.node.x, best.node.y], to: [target.x, target.y], d: best.d });
    g.addEdge(best.node, target, bridge, Math.max(1, g.edges.get(best.node.edges[0]).r));
    // the end is no longer free; if it had a single stroke it now passes through
    mergeThrough(g, best.node);
    if (target.junction !== true) mergeThrough(g, target);
    closed++;
  }
  return closed;
}

/* Free ends with another stroke close by, straight ahead: lines that stop short of closing a shape
   (or are meant to stop there, like a vein). Returns the ends' positions. */
function nearEnds(g, reach, coneDeg){
  let maxR = 1; for (const e of g.edges.values()) if (e.r > maxR) maxR = e.r;
  const cone = Math.cos(coneDeg * Math.PI / 180), cell = Math.max(4, reach + 2 * maxR + 2), grid = new Map(), keyOf = (x, y) => Math.floor(x / cell) + "," + Math.floor(y / cell);
  for (const e of g.edges.values()) e.pts.forEach((p, i) => { const k = keyOf(p[0], p[1]); (grid.get(k) || grid.set(k, []).get(k)).push([e.id, i]); });
  const out = [];
  for (const n of g.nodes.values()){
    if (g.degree(n) !== 1) continue;
    const eid = n.edges[0], e = g.edges.get(eid), atEnd = e.b === n.id && e.a !== n.id, own = atEnd ? e.pts.length - 1 : 0, dir = direction(e.pts, atEnd, 6);
    let found = false;
    const cx = Math.floor(n.x / cell), cy = Math.floor(n.y / cell);
    for (let gx = cx - 1; gx <= cx + 1 && !found; gx++) for (let gy = cy - 1; gy <= cy + 1 && !found; gy++){
      for (const [fid, idx] of grid.get(gx + "," + gy) || []){
        const f = g.edges.get(fid), p = f.pts[idx], dx = p[0] - n.x, dy = p[1] - n.y, d = Math.hypot(dx, dy), far = reach + e.r + f.r;
        if (d < 1e-9 || d > far) continue;
        if (fid === eid && Math.abs(own - idx) < Math.max(10, 1.5 * far)) continue;
        if ((dx * dir[0] + dy * dir[1]) / d >= cone){ found = true; break; }
      }
    }
    if (found) out.push([n.x, n.y]);
  }
  return out;
}

function components(g){
  const seen = new Set(), comps = [];
  for (const n of g.nodes.values()){
    if (seen.has(n.id)) continue;
    const nodes = [n.id], stack = [n.id], edges = new Set(); seen.add(n.id);
    while (stack.length){
      const id = stack.pop();
      for (const eid of g.nodes.get(id).edges){
        edges.add(eid);
        const o = g.other(g.edges.get(eid), id);
        if (!seen.has(o)){ seen.add(o); nodes.push(o); stack.push(o); }
      }
    }
    comps.push({ nodes, edges: [...edges] });
  }
  return comps;
}

function removePieces(g, minLen){
  let n = 0;
  for (const c of components(g)){
    const total = c.edges.reduce((s, id) => s + g.edges.get(id).len, 0);
    if (total >= minLen && c.edges.length) continue;
    for (const id of c.edges){ const e = g.edges.get(id); if (e) g.removeEdge(e); }
    for (const id of c.nodes){ const node = g.nodes.get(id); if (node) g.removeNode(node); }
    n++;
  }
  return n;
}

/* ---------- smooth strokes into cubic curves ---------- */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, s) => [a[0] * s, a[1] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1], len = a => Math.hypot(a[0], a[1]);
const unit = a => { const L = len(a); return L < 1e-12 ? [0, 0] : [a[0] / L, a[1] / L]; };

function bez(c, t){ const u = 1 - t; return [u*u*u*c[0][0] + 3*u*u*t*c[1][0] + 3*u*t*t*c[2][0] + t*t*t*c[3][0], u*u*u*c[0][1] + 3*u*u*t*c[1][1] + 3*u*t*t*c[2][1] + t*t*t*c[3][1]]; }
function bez1(c, t){ const u = 1 - t; return [3*u*u*(c[1][0]-c[0][0]) + 6*u*t*(c[2][0]-c[1][0]) + 3*t*t*(c[3][0]-c[2][0]), 3*u*u*(c[1][1]-c[0][1]) + 6*u*t*(c[2][1]-c[1][1]) + 3*t*t*(c[3][1]-c[2][1])]; }
function bez2(c, t){ const u = 1 - t; return [6*u*(c[2][0]-2*c[1][0]+c[0][0]) + 6*t*(c[3][0]-2*c[2][0]+c[1][0]), 6*u*(c[2][1]-2*c[1][1]+c[0][1]) + 6*t*(c[3][1]-2*c[2][1]+c[1][1])]; }

function chordParams(d, first, last){
  const u = [0];
  for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1] + len(sub(d[i], d[i - 1])));
  const T = u[u.length - 1] || 1;
  return u.map(v => v / T);
}

function generateBezier(d, first, last, u, t1, t2){
  const n = last - first + 1, p0 = d[first], p3 = d[last];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < n; i++){
    const t = u[i], s = 1 - t, b0 = s*s*s, b1 = 3*t*s*s, b2 = 3*t*t*s, b3 = t*t*t;
    const a1 = mul(t1, b1), a2 = mul(t2, b2);
    c00 += dot(a1, a1); c01 += dot(a1, a2); c11 += dot(a2, a2);
    const tmp = sub(d[first + i], add(mul(p0, b0 + b1), mul(p3, b2 + b3)));
    x0 += dot(a1, tmp); x1 += dot(a2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  const al = Math.abs(det) < 1e-12 ? 0 : (x0 * c11 - x1 * c01) / det, ar = Math.abs(det) < 1e-12 ? 0 : (c00 * x1 - c01 * x0) / det;
  const seg = len(sub(p3, p0)), eps = 1e-6 * seg;
  let arc = 0; for (let i = first + 1; i <= last; i++) arc += len(sub(d[i], d[i - 1]));
  if (al < eps || ar < eps || al > arc || ar > arc){            // a handle longer than the stretch it fits is a runaway, not a curve
    const dist = seg / 3;
    return [p0, add(p0, mul(t1, dist)), add(p3, mul(t2, dist)), p3];
  }
  return [p0, add(p0, mul(t1, al)), add(p3, mul(t2, ar)), p3];
}

function maxError(d, first, last, c, u){
  let worst = 0, at = Math.floor((last - first + 1) / 2) + first;
  for (let i = first + 1; i < last; i++){
    const q = bez(c, u[i - first]), dd = sub(q, d[i]), e = dd[0] * dd[0] + dd[1] * dd[1];
    if (e >= worst){ worst = e; at = i; }
  }
  return { worst, at };
}

function reparam(d, first, last, u, c){
  const out = [];
  for (let i = first; i <= last; i++){
    const t = u[i - first], q = bez(c, t), q1 = bez1(c, t), q2 = bez2(c, t), diff = sub(q, d[i]);
    const num = dot(diff, q1), den = dot(q1, q1) + dot(diff, q2);
    out.push(Math.abs(den) < 1e-12 ? t : Math.min(1, Math.max(0, t - num / den)));
  }
  // keep the parameters increasing
  for (let i = 1; i < out.length; i++) if (out[i] < out[i - 1]) out[i] = out[i - 1];
  out[0] = 0; out[out.length - 1] = 1;
  return out;
}

function fitCubic(d, first, last, t1, t2, err2, out, depth){
  const n = last - first + 1;
  if (n === 2){
    const dist = len(sub(d[last], d[first])) / 3;
    out.push([d[first], add(d[first], mul(t1, dist)), add(d[last], mul(t2, dist)), d[last]]); return;
  }
  let u = chordParams(d, first, last), c = generateBezier(d, first, last, u, t1, t2), e = maxError(d, first, last, c, u);
  if (e.worst < err2){ out.push(c); return; }
  if (e.worst < err2 * 16){
    for (let it = 0; it < 5; it++){
      const up = reparam(d, first, last, u, c);
      c = generateBezier(d, first, last, up, t1, t2); e = maxError(d, first, last, c, up); u = up;
      if (e.worst < err2){ out.push(c); return; }
    }
  }
  if (depth > 40 || n <= 3){ out.push(c); return; }
  let split = e.at; if (split <= first + 1 || split >= last - 1) split = (first + last) >> 1;          // a split at the very end would not shrink the problem
  const center = unit(sub(d[split - 1], d[split + 1]));
  fitCubic(d, first, split, t1, center, err2, out, depth + 1);
  fitCubic(d, split, last, mul(center, -1), t2, err2, out, depth + 1);
}

/* How far the fitted curves stray from the points they were fitted to. */
function deviation(p, segs){
  const poly = [];
  for (const c of segs){
    const steps = Math.max(12, Math.ceil((len(sub(c[1], c[0])) + len(sub(c[2], c[1])) + len(sub(c[3], c[2]))) / 1.5));      // a sample about every pixel and a half
    for (let k = 0; k <= steps; k++) poly.push(bez(c, k / steps));
  }
  let worst = 0;
  const cell = 16, grid = new Map(), key = (x, y) => Math.floor(x / cell) + "," + Math.floor(y / cell);
  for (const q of poly){ const k = key(q[0], q[1]); (grid.get(k) || grid.set(k, []).get(k)).push(q); }
  for (const q of p){
    let best = 1e18; const cx = Math.floor(q[0] / cell), cy = Math.floor(q[1] / cell);
    for (let r = 1; r <= 6 && best === 1e18; r++){
      for (let gx = cx - r; gx <= cx + r; gx++) for (let gy = cy - r; gy <= cy + r; gy++) for (const o of grid.get(gx + "," + gy) || []){ const d = (o[0] - q[0]) * (o[0] - q[0]) + (o[1] - q[1]) * (o[1] - q[1]); if (d < best) best = d; }
    }
    if (best === 1e18) best = 1e6;
    if (best > worst) worst = best;
  }
  // and the other way: no part of a curve may wander away from the points (a runaway curve can pass near both ends)
  const pg = new Map();
  for (const q of p){ const k = key(q[0], q[1]); (pg.get(k) || pg.set(k, []).get(k)).push(q); }
  for (const o of poly){
    let best = 1e18; const cx = Math.floor(o[0] / cell), cy = Math.floor(o[1] / cell);
    for (let r = 1; r <= 6 && best === 1e18; r++){
      for (let gx = cx - r; gx <= cx + r; gx++) for (let gy = cy - r; gy <= cy + r; gy++) for (const q of pg.get(gx + "," + gy) || []){ const d = (o[0] - q[0]) * (o[0] - q[0]) + (o[1] - q[1]) * (o[1] - q[1]); if (d < best) best = d; }
    }
    if (best === 1e18) best = 1e6;
    if (best > worst) worst = best;
  }
  return Math.sqrt(worst);
}

/* Fit one smooth piece. A long piece is cut into stretches that share their tangent at the joins, so no
   single fit has a long, wandering curve to explain; the result is checked against the points and refitted
   in shorter stretches if it strayed. */
function fitPiece(p, t1, t2, err2, tol){
  const n = p.length;
  const run = ch => {
    const out = [];
    if (n <= ch){ fitCubic(p, 0, n - 1, t1, t2, err2, out, 0); return out; }
    const k = Math.ceil((n - 1) / ch), b = [0];
    for (let j = 1; j < k; j++) b.push(Math.round(j * (n - 1) / k));
    b.push(n - 1);
    for (let j = 0; j < k; j++){
      const a = b[j], z = b[j + 1], span = 3;
      const ta = j === 0 ? t1 : unit(sub(p[Math.min(n - 1, a + span)], p[Math.max(0, a - span)]));
      const tz = j === k - 1 ? t2 : unit(sub(p[Math.max(0, z - span)], p[Math.min(n - 1, z + span)]));
      fitCubic(p, a, z, ta, tz, err2, out, 0);
    }
    return out;
  };
  let segs = run(Infinity);
  if (deviation(p, segs) > tol) segs = run(220);
  if (deviation(p, segs) > tol) segs = run(45);
  return segs;
}

/* the piece fits a straight line within tol? */
function straightWithin(p, tol){
  const a = p[0], b = p[p.length - 1], L = len(sub(b, a));
  if (L < 1e-9) return false;
  const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
  let worst = 0; for (const q of p) worst = Math.max(worst, Math.abs((q[0] - a[0]) * nx + (q[1] - a[1]) * ny));
  return worst <= tol;
}

export function gaussSmooth(p, sigma){
  // smooth the inside of a piece, ends fixed; windows shrink at the ends so the ends pull their neighbors
  const n = p.length; if (n < 5 || !(sigma > 0)) return p.slice();
  const R = Math.ceil(2.5 * sigma), wts = []; for (let k = -R; k <= R; k++) wts.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const out = p.slice();
  for (let i = 1; i < n - 1; i++){
    const r = Math.min(R, i, n - 1 - i);                    // symmetric window, never past an end
    let sx = 0, sy = 0, sw = 0;
    for (let k = -r; k <= r; k++){ const wgt = wts[k + R]; sx += p[i + k][0] * wgt; sy += p[i + k][1] * wgt; sw += wgt; }
    out[i] = [sx / sw, sy / sw];
  }
  return out;
}

function gaussSmoothClosed(p, sigma){
  const n = p.length; if (n < 8 || !(sigma > 0)) return p.slice();
  const R = Math.min(Math.ceil(2.5 * sigma), (n >> 1) - 1), wts = []; for (let k = -R; k <= R; k++) wts.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const out = new Array(n);
  for (let i = 0; i < n; i++){
    let sx = 0, sy = 0, sw = 0;
    for (let k = -R; k <= R; k++){ const q = p[(i + k + n) % n], wgt = wts[k + R]; sx += q[0] * wgt; sy += q[1] * wgt; sw += wgt; }
    out[i] = [sx / sw, sy / sw];
  }
  return out;
}

export function resample(pts, step){
  // evenly spaced points along a polyline (first and last kept)
  const total = pathLength(pts); if (total < step * 1.5) return pts.slice();
  const n = Math.max(2, Math.round(total / step)), out = [pts[0]]; let seg = 1, acc = 0, segLen = len(sub(pts[1], pts[0]));
  for (let k = 1; k < n; k++){
    const target = total * k / n;
    while (seg < pts.length - 1 && acc + segLen < target){ acc += segLen; seg++; segLen = len(sub(pts[seg], pts[seg - 1])); }
    const t = segLen ? (target - acc) / segLen : 0;
    out.push([pts[seg - 1][0] + (pts[seg][0] - pts[seg - 1][0]) * t, pts[seg - 1][1] + (pts[seg][1] - pts[seg - 1][1]) * t]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/* indices along an evenly spaced stroke where it turns sharply */
export function findCorners(p, o, closed){
  const n = p.length, k = o.cornerWindow, thr = o.cornerAngle * Math.PI / 180, turn = new Float64Array(n);
  for (let i = 0; i < n; i++){
    let ia = i - k, ib = i + k;
    if (closed){ ia = (ia + n) % n; ib = ib % n; } else if (ia < 0 || ib >= n) continue;
    const v1 = unit(sub(p[i], p[ia])), v2 = unit(sub(p[ib], p[i]));
    turn[i] = Math.acos(Math.max(-1, Math.min(1, dot(v1, v2))));
  }
  const out = [];
  for (let i = 0; i < n; i++){
    if (turn[i] < thr) continue;
    let top = true;
    for (let j = -k; j <= k && top; j++){ const q = closed ? (i + j + n) % n : i + j; if (q >= 0 && q < n && q !== i && (turn[q] > turn[i] || (turn[q] === turn[i] && q < i))) top = false; }
    if (top) out.push(i);
  }
  return out;
}

/* Fit one stroke: returns ops [{ op:"M", p }, { op:"L", p } | { op:"C", c1, c2, p }...] in pixels. */
export function fitStroke(raw, o, closed){
  let pts = resample(raw, 1.25);
  if (pts.length < 2) return null;
  if (closed && len(sub(pts[0], pts[pts.length - 1])) > 1e-6) pts.push(pts[0]);
  const body = closed ? pts.slice(0, -1) : pts;
  let corners = body.length >= 2 * o.cornerWindow + 2 ? findCorners(gaussSmooth(body, 1.2), o, closed) : [];
  const pieces = [];
  if (closed){
    if (!corners.length){
      // one smooth loop: smooth it all the way around, start where it began, share the tangent across the seam
      const sm = gaussSmoothClosed(body, o.pathSigma / 1.25);
      pieces.push({ p: sm.concat(sm.slice(0, 1)), seam: true });
    } else {
      const rot = body.slice(corners[0]).concat(body.slice(0, corners[0])), shifted = corners.map(c => (c - corners[0] + body.length) % body.length).sort((a, b) => a - b);
      const cuts = shifted.concat([body.length]);
      for (let i = 0; i < cuts.length - 1; i++){
        const seg = rot.slice(cuts[i], cuts[i + 1] + 1); if (cuts[i + 1] === body.length) seg.push(rot[0]);
        pieces.push({ p: smoothPiece(seg, o) });
      }
    }
  } else {
    const cuts = [0].concat(corners, [body.length - 1]);
    for (let i = 0; i < cuts.length - 1; i++) pieces.push({ p: smoothPiece(body.slice(cuts[i], cuts[i + 1] + 1), o) });
  }
  const ops = [{ op: "M", p: pieces[0].p[0] }], err2 = o.fitError * o.fitError;
  for (const piece of pieces){
    const p = piece.p;
    if (p.length < 2) continue;
    if (straightWithin(p, Math.min(o.fitError * .5, .6))){ ops.push({ op: "L", p: p[p.length - 1] }); continue; }
    const lead = Math.min(p.length - 1, 5);
    let t1, t2;
    if (piece.seam){ t1 = unit(sub(p[1], p[p.length - 2])); t2 = mul(t1, -1); }
    else { t1 = unit(sub(p[Math.min(p.length - 1, lead)], p[0])); t2 = unit(sub(p[p.length - 1 - Math.min(p.length - 1, lead)], p[p.length - 1])); }
    if (!t1[0] && !t1[1]) { ops.push({ op: "L", p: p[p.length - 1] }); continue; }
    const segs = fitPiece(p, t1, t2, err2, Math.max(3 * o.fitError, 3));
    for (const c of segs){
      const chord = len(sub(c[3], c[0]));
      // a curve whose handles lie on its chord is a line
      const flat = chord > 1e-9 && Math.max(Math.abs(cross(sub(c[1], c[0]), sub(c[3], c[0]))), Math.abs(cross(sub(c[2], c[0]), sub(c[3], c[0])))) / chord < .3;
      ops.push(flat ? { op: "L", p: c[3] } : { op: "C", c1: c[1], c2: c[2], p: c[3] });
    }
  }
  return { ops, closed: !!closed };
}
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
function smoothPiece(p, o){
  if (p.length < 5) return p;
  const s = gaussSmooth(p, o.pathSigma / 1.25);
  return s;
}

/* ---------- solid black areas ---------- */
/* Marching squares on a blurred 0/1 field: closed outlines with the ink on the
   left, so outer outlines and holes wind opposite ways (a nonzero fill leaves
   the holes white). Returns loops of [x, y] in pixels. */
function contours(field, w, h, x0, y0, x1, y1){
  const level = .5, segs = new Map(), at = (x, y) => field[y * w + x];
  const interp = (xa, ya, xb, yb) => { const va = at(xa, ya), vb = at(xb, yb), t = (level - va) / (vb - va || 1e-9); return [xa + (xb - xa) * t + .5, ya + (yb - ya) * t + .5]; };
  const key = p => p[0].toFixed(3) + "," + p[1].toFixed(3);
  const add = (a, b) => { segs.set(key(a), { a, b }); };
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++){
    const v = [at(x, y) >= level, at(x + 1, y) >= level, at(x + 1, y + 1) >= level, at(x, y + 1) >= level];
    const m = (v[0] ? 1 : 0) | (v[1] ? 2 : 0) | (v[2] ? 4 : 0) | (v[3] ? 8 : 0);
    if (m === 0 || m === 15) continue;
    const T = interp(x, y, x + 1, y), R = interp(x + 1, y, x + 1, y + 1), B = interp(x, y + 1, x + 1, y + 1), L = interp(x, y, x, y + 1);
    switch (m){
      case 1: add(L, T); break;           case 2: add(T, R); break;           case 3: add(L, R); break;
      case 4: add(R, B); break;           case 5: add(L, T); add(R, B); break; case 6: add(T, B); break;
      case 7: add(L, B); break;           case 8: add(B, L); break;           case 9: add(B, T); break;
      case 10: add(T, R); add(B, L); break; case 11: add(B, R); break;        case 12: add(R, L); break;
      case 13: add(R, T); break;          case 14: add(T, L); break;
    }
  }
  const loops = [];
  while (segs.size){
    const [k0, s0] = segs.entries().next().value; segs.delete(k0);
    const loop = [s0.a, s0.b]; let tail = s0.b;
    for (;;){
      const nx = segs.get(key(tail)); if (!nx) break;
      segs.delete(key(tail)); loop.push(nx.b); tail = nx.b;
      if (key(tail) === key(loop[0])) break;
    }
    if (loop.length > 6) loops.push(loop);
  }
  return loops;
}

function areaOf(loop){ let s = 0; for (let i = 0; i < loop.length; i++){ const p = loop[i], q = loop[(i + 1) % loop.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; }

/* ---------- the whole trace ---------- */
const to = (v, k) => Math.round(v * k * 10) / 10;
const fmtN = v => { const r = Math.round(v * 10) / 10; return String(r === 0 ? 0 : r); };

export function opsToPath(ops, k, close){
  let s = "";
  for (const o of ops){
    if (o.op === "M") s += "M" + fmtN(o.p[0] * k) + " " + fmtN(o.p[1] * k);
    else if (o.op === "L") s += " L" + fmtN(o.p[0] * k) + " " + fmtN(o.p[1] * k);
    else s += " C" + fmtN(o.c1[0] * k) + " " + fmtN(o.c1[1] * k) + " " + fmtN(o.c2[0] * k) + " " + fmtN(o.c2[1] * k) + " " + fmtN(o.p[0] * k) + " " + fmtN(o.p[1] * k);
  }
  return s + (close ? " Z" : "");
}

/**
 * Trace a 1-bit master (ink = 1).
 * opts.dpi: pixels per inch of the master (for the speck sizes); the master is taken to be 6 in wide.
 * Returns { w, h, k, r0, graph, blobs, ink, notes, stats }:
 *   graph  strokes: [{ id, a, b, pts, r, len, loop, ops, d }] with d in engine units (k = units per pixel)
 *   blobs  solid areas: [{ d, area, bbox, cx, cy, holes }]
 *   r0     the master's typical half line width in pixels
 */
export function traceMaster(bmp, opts){
  const o = Object.assign({}, TRACE_DEFAULTS, opts || {}), dpi = o.dpi || bmp.w / 6;      // the master is 6 in wide
  const { w, h } = bmp, k = 600 / w, notes = [], stats = {};
  const sm = smoothMask(bmp, o.smoothSigma);
  const dt = inkDistance(sm);

  // typical half line width: from a first thinning of the whole picture
  const sk0 = thin(sm);
  const rs = []; for (let i = 0; i < sk0.length; i++) if (sk0[i]) rs.push(dt[i]);
  rs.sort((a, b) => a - b);
  const r0 = rs.length ? rs[Math.floor(rs.length / 2)] : 1;
  stats.r0 = +r0.toFixed(2); stats.skeleton_px = rs.length;

  // solid black areas: ink that a disk wider than the line fits inside
  let blobs = [], lineDt = dt, g = null, solid = null;
  const rb = Math.max(o.blobK * r0, r0 + 4), N = w * h;
  const minPx = Math.round(o.blobMinArea * dpi * dpi), lab = new Int32Array(N);
  let parts = [], keep = new Uint8Array(1);
  {
    const core = new Uint8Array(N); let any = false;
    for (let i = 0; i < N; i++) if (dt[i] >= rb){ core[i] = 1; any = true; }
    if (any){
      const dcore = inkDistance(createInverse(core, w, h));                       // distance from every pixel to the core
      const blob = new Uint8Array(N);
      for (let i = 0; i < N; i++) if (sm.px[i] && (core[i] || (dcore[i] <= rb + .5))) blob[i] = 1;
      parts = labelComponents(blob, w, h, lab);
      keep = new Uint8Array(parts.length + 1);
      parts.forEach((c, idx) => {
        const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1, fill = c.area / (bw * bh);
        if (c.area >= minPx && fill >= .3) keep[idx + 1] = 1;                                // a solid shape: an eye, a hub, a clock hand (not a thin scatter of ink)
      });
    }
  }
  // strokes of what is left once the solid areas are set aside. A "solid area" that has a line leaving it on
  // opposite sides is a thick stretch of a line: it goes back to being line, and the strokes are read again.
  for (let pass = 0; pass < 3; pass++){
    blobs = []; solid = null;
    const lineMask = new Uint8Array(sm.px), field = new Float32Array(N);
    let any = false;
    for (let i = 0; i < N; i++) if (lab[i] && keep[lab[i]]){ lineMask[i] = 0; field[i] = 1; any = true; }
    if (any){
      const f = smoothMask({ w, h, px: Uint8Array.from(field, v => v ? 1 : 0) }, 1.4).field;
      parts.forEach((c, idx) => {
        if (!keep[idx + 1]) return;
        const x0 = Math.max(0, c.x0 - 3), y0 = Math.max(0, c.y0 - 3), x1 = Math.min(w - 1, c.x1 + 3), y1 = Math.min(h - 1, c.y1 + 3);
        const loops = contours(f, w, h, x0, y0, x1, y1).map(l => ({ loop: l, area: areaOf(l) }));
        if (!loops.length) return;
        loops.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
        blobs.push({ outer: loops[0], holes: loops.slice(1), area: c.area, bbox: [c.x0, c.y0, c.x1, c.y1], cx: (c.x0 + c.x1) / 2, cy: (c.y0 + c.y1) / 2, maskId: idx + 1 });
      });
      solid = field;
    }
    lineDt = blobs.length ? inkDistance({ w, h, px: lineMask }) : dt;
    g = skeletonGraph(blobs.length ? thin({ w, h, px: lineMask }) : sk0, w, h, lineDt);
    if (!blobs.length) break;
    // line ends that touch a solid area are anchored to it
    const near = inkDistance(createInverse(Uint8Array.from(field, v => v ? 1 : 0), w, h)), ends = new Map();
    for (const n of g.nodes.values()){
      if (g.degree(n) !== 1 || near[Math.round(n.y) * w + Math.round(n.x)] > 2.5 * r0 + 2) continue;
      n.anchored = true;
      let best = null, bd = Infinity;
      for (const b of blobs){ const d = Math.hypot(n.x - b.cx, n.y - b.cy); if (d < bd){ bd = d; best = b; } }
      if (best) (ends.get(best) || ends.set(best, []).get(best)).push([n.x - best.cx, n.y - best.cy]);
    }
    let changed = false;
    for (const [b, dirs] of ends){
      if (dirs.length !== 2) continue;
      const cos = (dirs[0][0] * dirs[1][0] + dirs[0][1] * dirs[1][1]) / (Math.hypot(...dirs[0]) * Math.hypot(...dirs[1]) || 1);
      if (cos <= Math.cos(140 * Math.PI / 180)){ keep[b.maskId] = 0; changed = true; }
    }
    if (!changed) break;
  }
  stats.solid_areas = blobs.length;
  stats.raw_strokes = g.edges.size;
  for (const n of [...g.nodes.values()]) if (g.nodes.has(n.id) && g.degree(n) === 2) mergeThrough(g, n);
  const oo = Object.assign({}, o, { gap: o.gap * dpi / 300, spurMin: o.spurMin * dpi / 300, minPiece: o.minPiece * dpi / 300 });
  stats.spurs_pruned = pruneSpurs(g, oo);
  stats.links_joined = contractLinks(g, oo);
  stats.spurs_pruned += pruneSpurs(g, oo);
  stats.gaps_closed = closeGaps(g, oo);
  stats.spurs_pruned += pruneSpurs(g, oo);
  for (const n of [...g.nodes.values()]) if (g.nodes.has(n.id) && g.degree(n) === 2 && !n.loopAnchor) mergeThrough(g, n);
  stats.specks_dropped = removePieces(g, oo.minPiece);
  const free = [...g.nodes.values()].filter(n => g.degree(n) === 1).length, near = nearEnds(g, 40 * dpi / 300, 50);
  stats.free_ends = free; stats.ends_near_lines = near.length;
  if (stats.gaps_closed) notes.push(`closed ${stats.gaps_closed} small gap${stats.gaps_closed > 1 ? "s" : ""} where a line stopped short of another`);
  if (stats.specks_dropped) notes.push(`dropped ${stats.specks_dropped} speck${stats.specks_dropped > 1 ? "s" : ""} of stray line`);

  // a line that ends at a solid area is carried on to it, so no white leaks between them
  if (solid){
    for (const n of g.nodes.values()){
      if (!n.anchored || g.degree(n) !== 1) continue;
      const e = g.edges.get(n.edges[0]), atEnd = e.b === n.id && e.a !== n.id, dir = direction(e.pts, atEnd, 6);
      for (let t = .5; t <= 3.5 * r0 + 4; t += .5){
        const x = Math.round(n.x + dir[0] * t), y = Math.round(n.y + dir[1] * t);
        if (x < 0 || y < 0 || x >= w || y >= h) break;
        if (solid[y * w + x]){ const p = [n.x + dir[0] * t, n.y + dir[1] * t]; if (atEnd) e.pts.push(p); else e.pts.unshift(p); e.len = pathLength(e.pts); break; }
      }
    }
  }

  // curves
  const edges = [];
  for (const e of [...g.edges.values()].sort((a, b) => a.id - b.id)){
    const loop = e.a === e.b;
    const fit = fitStroke(e.pts, oo, loop);
    if (!fit || fit.ops.length < 2) continue;
    edges.push({ id: e.id, a: e.a, b: e.b, pts: e.pts, r: e.r, len: e.len, loop, ops: fit.ops, d: opsToPath(fit.ops, k, loop) });
  }
  const blobOut = blobs.map(b => {
    const parts = [b.outer, ...b.holes.filter(hl => Math.abs(hl.area) >= Math.round(o.blobMinArea * dpi * dpi))].map(l => {
      const ring = l.loop.slice(0, -1), fit = fitStroke(ring.concat([ring[0]]), Object.assign({}, oo, { pathSigma: 1.2, fitError: Math.max(.8, o.fitError * .8) }), true);
      return fit ? opsToPath(fit.ops, k, true) : "";
    }).filter(Boolean);
    return { d: parts.join(" "), area: b.area, bbox: b.bbox, cx: b.cx, cy: b.cy, holes: b.holes.length };
  });
  stats.strokes = edges.length;
  return { w, h, k, r0, graph: g, edges, blobs: blobOut, blobGeom: blobs, notes, stats, nearEnds: near };
}

/* ---------- small bitmap helpers ---------- */
function createInverse(mask, w, h){ const px = new Uint8Array(w * h); for (let i = 0; i < px.length; i++) px[i] = mask[i] ? 0 : 1; return { w, h, px }; }
function labelComponents(mask, w, h, lab){
  const N = w * h, stack = new Int32Array(N), comps = [];
  for (let i = 0; i < N; i++){
    if (!mask[i] || lab[i]) continue;
    const id = comps.length + 1; let top = 0, area = 0, x0 = w, y0 = h, x1 = -1, y1 = -1; stack[top++] = i; lab[i] = id;
    while (top){
      const j = stack[--top], x = j % w, y = (j / w) | 0; area++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && mask[j - 1] && !lab[j - 1]){ lab[j - 1] = id; stack[top++] = j - 1; }
      if (x < w - 1 && mask[j + 1] && !lab[j + 1]){ lab[j + 1] = id; stack[top++] = j + 1; }
      if (y > 0 && mask[j - w] && !lab[j - w]){ lab[j - w] = id; stack[top++] = j - w; }
      if (y < h - 1 && mask[j + w] && !lab[j + w]){ lab[j + w] = id; stack[top++] = j + w; }
    }
    comps.push({ area, x0, y0, x1, y1 });
  }
  return comps;
}
