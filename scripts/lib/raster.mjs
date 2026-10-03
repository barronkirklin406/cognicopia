/* =====================================================================
   Line-art rasterizer and meter for Cognicopia Coloring pages.
   Turns a drawing into a 1-bit bitmap (the way it prints), then measures
   what a person coloring it meets: the enclosed areas to color, the
   smallest of them in square inches, ink coverage, how much of the box the
   subject fills, and the printed line thickness. Used for the catalog's
   visual-complexity numbers, the tier checks and the ingest pipeline.

   A drawing here is a list of shapes in pixel space, painted in order:
     { subpaths:[{ pts:[[x,y],...], closed:true }], fill: 0 | 1 | null, stroke: px }
   fill 0 paints white (hides what is behind), 1 paints black, null none.
   Node built-ins only.
   ===================================================================== */

/* ---------- drawing ---------- */
export function createBitmap(w, h){ return { w, h, px: new Uint8Array(w * h) }; }   // 0 white, 1 black

function fillPolys(bmp, subpaths, value){
  const edges = [];
  subpaths.forEach(sp => {
    const p = sp.pts;
    for (let i = 0; i < p.length; i++){
      const a = p[i], b = p[(i + 1) % p.length];
      if (a[1] === b[1]) continue;
      edges.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1]] : [b[0], b[1], a[0], a[1]]);
    }
  });
  if (!edges.length) return;
  let y0 = Infinity, y1 = -Infinity;
  edges.forEach(e => { if (e[1] < y0) y0 = e[1]; if (e[3] > y1) y1 = e[3]; });
  const ys = Math.max(0, Math.floor(y0)), ye = Math.min(bmp.h - 1, Math.ceil(y1));
  const xs = [];
  for (let y = ys; y <= ye; y++){
    const yc = y + .5; xs.length = 0;
    for (const e of edges) if (yc >= e[1] && yc < e[3]) xs.push(e[0] + (yc - e[1]) / (e[3] - e[1]) * (e[2] - e[0]));
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2){
      const xa = Math.max(0, Math.ceil(xs[k] - .5)), xb = Math.min(bmp.w - 1, Math.floor(xs[k + 1] - .5));
      const row = y * bmp.w;
      for (let x = xa; x <= xb; x++) bmp.px[row + x] = value;
    }
  }
}
function strokeSeg(bmp, a, b, r){
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r)), x1 = Math.min(bmp.w - 1, Math.ceil(Math.max(a[0], b[0]) + r));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r)), y1 = Math.min(bmp.h - 1, Math.ceil(Math.max(a[1], b[1]) + r));
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, r2 = r * r;
  for (let y = y0; y <= y1; y++){
    const py = y + .5, row = y * bmp.w;
    for (let x = x0; x <= x1; x++){
      const px = x + .5;
      let t = L2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = a[0] + t * dx - px, qy = a[1] + t * dy - py;
      if (qx * qx + qy * qy <= r2) bmp.px[row + x] = 1;
    }
  }
}
export function paint(bmp, shapes){
  for (const s of shapes){
    if (s.fill === 0 || s.fill === 1) fillPolys(bmp, s.subpaths.filter(sp => sp.pts.length >= 3), s.fill);
    if (s.stroke > 0){
      const r = s.stroke / 2;
      for (const sp of s.subpaths){
        const p = sp.pts;
        for (let i = 0; i + 1 < p.length; i++) strokeSeg(bmp, p[i], p[i + 1], r);
        if (sp.closed && p.length > 2) strokeSeg(bmp, p[p.length - 1], p[0], r);
        if (p.length === 1) strokeSeg(bmp, p[0], p[0], r);
      }
    }
  }
  return bmp;
}

/* ---------- Cognicopia Coloring drawings into shapes ---------- */
function flattenOwn(C, d, map, steps){
  const subs = []; let cur = null;
  C.parsePath(d).forEach(s => {
    if (s.op === "M"){ cur = { pts:[map(s.p)], closed:false }; subs.push(cur); }
    else if (s.op === "L") cur.pts.push(map(s.p));
    else if (s.op === "C"){
      const a = s.from, n = steps;
      for (let i = 1; i <= n; i++){ const t = i / n, u = 1 - t;
        cur.pts.push(map([u*u*u*a[0] + 3*u*u*t*s.c1[0] + 3*u*t*t*s.c2[0] + t*t*t*s.p[0], u*u*u*a[1] + 3*u*u*t*s.c1[1] + 3*u*t*t*s.c2[1] + t*t*t*s.p[1]])); }
    } else if (cur) cur.closed = true;
  });
  return subs;
}
/* r: CognicopiaColoring.render(...) result; the picture printed widthIn wide at dpi. */
export function shapesFromRender(C, r, { widthIn, dpi, weight }){
  const W = C.W, k = widthIn * dpi / W, wt = C.weightFor(r.tier, weight);
  const map = p => [(r.tx + p[0] * r.s) * k, (r.ty + p[1] * r.s) * k];
  const main = wt.pt / 72 * dpi, det = Math.max(2.25, wt.detailPt) / 72 * dpi;
  return r.items.map(it => ({
    subpaths: flattenOwn(C, it.d, map, 14),
    fill: it.fill === 2 ? 1 : it.fill === 1 ? 0 : null,
    stroke: it.fill === 2 ? 0 : it.kind === "d" ? det : main
  }));
}

/* ---------- measuring ---------- */
/* Everything a coloring page asks of the hand and eye, from its bitmap.
   noiseSqIn: specks smaller than this are ignored (a gap where two lines
   nearly touch); minSqIn: areas under this are counted as "tiny". */
export function measure(bmp, { dpi, noiseSqIn = .003, minSqIn = .05 }){
  const { w, h, px } = bmp, N = w * h, lab = new Int32Array(N), stack = new Int32Array(N);
  let comps = [], ink = 0, bx0 = w, by0 = h, bx1 = -1, by1 = -1;
  for (let i = 0; i < N; i++) if (px[i]){ ink++; const x = i % w, y = (i / w) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  let id = 0;
  for (let i = 0; i < N; i++){
    if (px[i] || lab[i]) continue;
    id++; let top = 0, area = 0, edge = false; stack[top++] = i; lab[i] = id;
    while (top){
      const j = stack[--top]; area++;
      const x = j % w, y = (j / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (x > 0 && !px[j - 1] && !lab[j - 1]){ lab[j - 1] = id; stack[top++] = j - 1; }
      if (x < w - 1 && !px[j + 1] && !lab[j + 1]){ lab[j + 1] = id; stack[top++] = j + 1; }
      if (y > 0 && !px[j - w] && !lab[j - w]){ lab[j - w] = id; stack[top++] = j - w; }
      if (y < h - 1 && !px[j + w] && !lab[j + w]){ lab[j + w] = id; stack[top++] = j + w; }
    }
    comps.push({ area, edge });
  }
  const perSqIn = dpi * dpi;
  const areas = comps.filter(c => !c.edge).map(c => c.area / perSqIn).filter(a => a >= noiseSqIn).sort((a, b) => a - b);
  const median = areas.length ? areas[Math.floor(areas.length / 2)] : 0;
  return {
    regions: areas.length,
    smallest_region_sq_in: +(areas[0] || 0).toFixed(3),
    median_region_sq_in: +median.toFixed(3),
    largest_region_sq_in: +(areas[areas.length - 1] || 0).toFixed(2),
    tiny_regions: areas.filter(a => a < minSqIn).length,
    ink_coverage: +(ink / N).toFixed(3),
    subject_fill: bx1 < 0 ? 0 : +(((bx1 - bx0 + 1) * (by1 - by0 + 1)) / N).toFixed(3),
    ...strokeStats(bmp, dpi)
  };
}

/* Line thickness: for each ink pixel, the shortest run of ink through it in
   four directions (a diagonal step is 1.41 pixels long). Solid areas give
   long runs everywhere, so the median and the thinnest tenth describe the
   lines. Returned in printed points. */
export function strokeStats(bmp, dpi){
  const { w, h, px } = bmp, N = w * h;
  const runH = new Uint16Array(N), runV = new Uint16Array(N), runD = new Uint16Array(N), runA = new Uint16Array(N);
  const fill = (arr, idxs) => { let s = 0; while (s < idxs.length){ if (!px[idxs[s]]){ s++; continue; } let e = s; while (e < idxs.length && px[idxs[e]]) e++; for (let k = s; k < e; k++) arr[idxs[k]] = Math.min(65535, e - s); s = e; } };
  for (let y = 0; y < h; y++){ const ix = []; for (let x = 0; x < w; x++) ix.push(y * w + x); fill(runH, ix); }
  for (let x = 0; x < w; x++){ const ix = []; for (let y = 0; y < h; y++) ix.push(y * w + x); fill(runV, ix); }
  for (let s = -(h - 1); s < w; s++){ const ix = [], ia = []; for (let y = 0; y < h; y++){ const x = s + y; if (x >= 0 && x < w) ix.push(y * w + x); const xa = w - 1 - (s + y); if (xa >= 0 && xa < w) ia.push(y * w + xa); } fill(runD, ix); fill(runA, ia); }
  const hist = new Uint32Array(2048); let n = 0;
  for (let i = 0; i < N; i++){ if (!px[i]) continue; const t = Math.min(runH[i], runV[i], runD[i] * 1.4142, runA[i] * 1.4142); hist[Math.min(2047, Math.round(t * 4))]++; n++; }
  if (!n) return { stroke_pt_median: 0, stroke_pt_p10: 0 };
  const q = f => { let c = 0; for (let b = 0; b < 2048; b++){ c += hist[b]; if (c >= n * f) return b / 4; } return 0; };
  return { stroke_pt_median: +(q(.5) / dpi * 72).toFixed(2), stroke_pt_p10: +(q(.1) / dpi * 72).toFixed(2) };
}

/* ---------- helpers for the ingest pipeline ---------- */
/* Grow ink by r pixels (a round brush): thickens lines that are too thin. */
export function dilate(bmp, r){
  const { w, h, px } = bmp, out = new Uint8Array(px), offs = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) offs.push([dx, dy]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    if (!px[y * w + x]) continue;
    for (const [dx, dy] of offs){ const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) out[yy * w + xx] = 1; }
  }
  return { w, h, px: out };
}
/* Remove specks: ink blobs smaller than minPx become white, and white holes
   smaller than minPx become ink (both read as noise, not drawing). */
export function despeckle(bmp, minPx){
  const { w, h, px } = bmp, N = w * h, lab = new Int32Array(N), stack = new Int32Array(N);
  for (const val of [1, 0]){
    lab.fill(0); const area = [0], edge = [false]; let id = 0;
    for (let i = 0; i < N; i++){
      if (px[i] !== val || lab[i]) continue;
      id++; let top = 0, a = 0, e = false; stack[top++] = i; lab[i] = id;
      while (top){ const j = stack[--top]; a++; const x = j % w, y = (j / w) | 0;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) e = true;
        if (x > 0 && px[j - 1] === val && !lab[j - 1]){ lab[j - 1] = id; stack[top++] = j - 1; }
        if (x < w - 1 && px[j + 1] === val && !lab[j + 1]){ lab[j + 1] = id; stack[top++] = j + 1; }
        if (y > 0 && px[j - w] === val && !lab[j - w]){ lab[j - w] = id; stack[top++] = j - w; }
        if (y < h - 1 && px[j + w] === val && !lab[j + w]){ lab[j + w] = id; stack[top++] = j + w; }
      }
      area.push(a); edge.push(e);
    }
    for (let i = 0; i < N; i++){ const l = lab[i]; if (l && area[l] <= minPx && !(val === 0 && edge[l])) px[i] = 1 - val; }
  }
  return bmp;
}
