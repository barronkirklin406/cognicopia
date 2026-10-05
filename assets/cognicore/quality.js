/* =====================================================================
   LINE-ART QUALITY METER
   Prints a drawing to a 1-bit bitmap (the way it comes off the printer)
   and measures what a person coloring it meets: the enclosed areas to
   color, the smallest of them in square inches, ink coverage, how much of
   the box the subject fills, the printed line thickness and the open white
   space around the subject. The library build, the ingest pipeline, the
   page generator (infinite.js) and the Packet Builder all measure with
   this one file, so a page is held to the same numbers wherever it is made.

   A drawing here is a list of shapes in pixel space, painted in order:
     { subpaths:[{ pts:[[x,y],...], closed:true }], fill: 0 | 1 | null, stroke: px }
   fill 0 paints white (hides what is behind), 1 paints black, null none.

   Runs as a plain browser script (after lineart.js, as CogniCore.quality)
   and in Node (vm, through scripts/lib/raster.mjs). It touches no network,
   storage or page.
   ===================================================================== */
(function(root){
"use strict";
var C = root.CogniCore;
if (!C) return;

/* ---------- drawing ---------- */
function createBitmap(w, h){ return { w:w, h:h, px:new Uint8Array(w * h) }; }   // 0 white, 1 black

function fillPolys(bmp, subpaths, value){
  var edges = [];
  subpaths.forEach(function(sp){
    var p = sp.pts;
    for (var i = 0; i < p.length; i++){
      var a = p[i], b = p[(i + 1) % p.length];
      if (a[1] === b[1]) continue;
      edges.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1]] : [b[0], b[1], a[0], a[1]]);
    }
  });
  if (!edges.length) return;
  var y0 = Infinity, y1 = -Infinity;
  edges.forEach(function(e){ if (e[1] < y0) y0 = e[1]; if (e[3] > y1) y1 = e[3]; });
  var ys = Math.max(0, Math.floor(y0)), ye = Math.min(bmp.h - 1, Math.ceil(y1));
  var xs = [];
  for (var y = ys; y <= ye; y++){
    var yc = y + .5; xs.length = 0;
    for (var k = 0; k < edges.length; k++){ var e = edges[k]; if (yc >= e[1] && yc < e[3]) xs.push(e[0] + (yc - e[1]) / (e[3] - e[1]) * (e[2] - e[0])); }
    xs.sort(function(a, b){ return a - b; });
    for (var j = 0; j + 1 < xs.length; j += 2){
      var xa = Math.max(0, Math.ceil(xs[j] - .5)), xb = Math.min(bmp.w - 1, Math.floor(xs[j + 1] - .5));
      var row = y * bmp.w;
      for (var x = xa; x <= xb; x++) bmp.px[row + x] = value;
    }
  }
}
function strokeSeg(bmp, a, b, r){
  var x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r)), x1 = Math.min(bmp.w - 1, Math.ceil(Math.max(a[0], b[0]) + r));
  var y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r)), y1 = Math.min(bmp.h - 1, Math.ceil(Math.max(a[1], b[1]) + r));
  var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, r2 = r * r;
  for (var y = y0; y <= y1; y++){
    var py = y + .5, row = y * bmp.w;
    for (var x = x0; x <= x1; x++){
      var px = x + .5;
      var t = L2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      var qx = a[0] + t * dx - px, qy = a[1] + t * dy - py;
      if (qx * qx + qy * qy <= r2) bmp.px[row + x] = 1;
    }
  }
}
function paint(bmp, shapes){
  shapes.forEach(function(s){
    if (s.fill === 0 || s.fill === 1) fillPolys(bmp, s.subpaths.filter(function(sp){ return sp.pts.length >= 3; }), s.fill);
    if (s.stroke > 0){
      var r = s.stroke / 2;
      s.subpaths.forEach(function(sp){
        var p = sp.pts;
        for (var i = 0; i + 1 < p.length; i++) strokeSeg(bmp, p[i], p[i + 1], r);
        if (sp.closed && p.length > 2) strokeSeg(bmp, p[p.length - 1], p[0], r);
        if (p.length === 1) strokeSeg(bmp, p[0], p[0], r);
      });
    }
  });
  return bmp;
}

/* ---------- engine drawings into shapes ---------- */
function flattenOwn(d, map, steps){
  var subs = [], cur = null;
  C.parsePath(d).forEach(function(s){
    if (s.op === "M"){ cur = { pts:[map(s.p)], closed:false }; subs.push(cur); }
    else if (s.op === "L") cur.pts.push(map(s.p));
    else if (s.op === "C"){
      var a = s.from;
      for (var i = 1; i <= steps; i++){ var t = i / steps, u = 1 - t;
        cur.pts.push(map([u*u*u*a[0] + 3*u*u*t*s.c1[0] + 3*u*t*t*s.c2[0] + t*t*t*s.p[0], u*u*u*a[1] + 3*u*u*t*s.c1[1] + 3*u*t*t*s.c2[1] + t*t*t*s.p[1]])); }
    } else if (cur) cur.closed = true;
  });
  return subs;
}
/* r: CogniCore.render(...) (or a generated page); the picture printed
   widthIn wide at dpi, with the tier's line weight (or o.weight). */
function shapesFromRender(r, o){
  var W = C.W, k = o.widthIn * o.dpi / W, wt = C.weightFor(r.tier, o.weight);
  var map = function(p){ return [(r.tx + p[0] * r.s) * k, (r.ty + p[1] * r.s) * k]; };
  var main = wt.pt / 72 * o.dpi, det = Math.max(C.MIN_LINE_PT, wt.detailPt) / 72 * o.dpi;
  return r.items.map(function(it){
    return {
      subpaths:flattenOwn(it.d, map, 14),
      fill:it.fill === 2 ? 1 : it.fill === 1 ? 0 : null,
      stroke:it.fill === 2 ? 0 : it.kind === "d" ? det : main
    };
  });
}

/* ---------- measuring ---------- */
/* Everything a coloring page asks of the hand and eye, from its bitmap.
   noiseSqIn: specks smaller than this are ignored (a gap where two lines
   nearly touch); minSqIn: areas under this are counted as "tiny".
   o.strokes false skips the line-thickness pass (the slowest part);
   o.space adds the open white space: background_share, the paper around
   the subject (white touching the edge of the box), and open_space, the
   largest single white area, inside or outside a frame. */
function measure(bmp, o){
  var dpi = o.dpi, noiseSqIn = o.noiseSqIn == null ? .003 : o.noiseSqIn, minSqIn = o.minSqIn == null ? .05 : o.minSqIn;
  var w = bmp.w, h = bmp.h, px = bmp.px, N = w * h, lab = new Int32Array(N), stack = new Int32Array(N);
  var comps = [], ink = 0, bx0 = w, by0 = h, bx1 = -1, by1 = -1, i;
  for (i = 0; i < N; i++) if (px[i]){ ink++; var x = i % w, y = (i / w) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  var id = 0;
  for (i = 0; i < N; i++){
    if (px[i] || lab[i]) continue;
    id++; var top = 0, area = 0, edge = false; stack[top++] = i; lab[i] = id;
    while (top){
      var j = stack[--top]; area++;
      var jx = j % w, jy = (j / w) | 0;
      if (jx === 0 || jy === 0 || jx === w - 1 || jy === h - 1) edge = true;
      if (jx > 0 && !px[j - 1] && !lab[j - 1]){ lab[j - 1] = id; stack[top++] = j - 1; }
      if (jx < w - 1 && !px[j + 1] && !lab[j + 1]){ lab[j + 1] = id; stack[top++] = j + 1; }
      if (jy > 0 && !px[j - w] && !lab[j - w]){ lab[j - w] = id; stack[top++] = j - w; }
      if (jy < h - 1 && !px[j + w] && !lab[j + w]){ lab[j + w] = id; stack[top++] = j + w; }
    }
    comps.push({ area:area, edge:edge });
  }
  var perSqIn = dpi * dpi;
  var areas = comps.filter(function(c){ return !c.edge; }).map(function(c){ return c.area / perSqIn; }).filter(function(a){ return a >= noiseSqIn; }).sort(function(a, b){ return a - b; });
  var median = areas.length ? areas[Math.floor(areas.length / 2)] : 0;
  var out = {
    regions:areas.length,
    smallest_region_sq_in:+(areas[0] || 0).toFixed(3),
    median_region_sq_in:+median.toFixed(3),
    largest_region_sq_in:+(areas[areas.length - 1] || 0).toFixed(2),
    tiny_regions:areas.filter(function(a){ return a < minSqIn; }).length,
    ink_coverage:+(ink / N).toFixed(3),
    subject_fill:bx1 < 0 ? 0 : +(((bx1 - bx0 + 1) * (by1 - by0 + 1)) / N).toFixed(3)
  };
  if (o.strokes !== false){ var st = strokeStats(bmp, dpi); out.stroke_pt_median = st.stroke_pt_median; out.stroke_pt_p10 = st.stroke_pt_p10; }
  if (o.space){
    var bg = 0, big = 0;
    comps.forEach(function(c){ if (c.edge) bg += c.area; if (c.area > big) big = c.area; });
    out.background_share = +(bg / N).toFixed(3);
    out.open_space = +(big / N).toFixed(3);
  }
  return out;
}

/* Line thickness: for each ink pixel, the shortest run of ink through it in
   four directions (a diagonal step is 1.41 pixels long). Solid areas give
   long runs everywhere, so the median and the thinnest tenth describe the
   lines. Returned in printed points. */
function strokeStats(bmp, dpi){
  var w = bmp.w, h = bmp.h, px = bmp.px, N = w * h;
  var runH = new Uint16Array(N), runV = new Uint16Array(N), runD = new Uint16Array(N), runA = new Uint16Array(N);
  var fill = function(arr, idxs, n){ var s = 0; while (s < n){ if (!px[idxs[s]]){ s++; continue; } var e = s; while (e < n && px[idxs[e]]) e++; for (var k = s; k < e; k++) arr[idxs[k]] = Math.min(65535, e - s); s = e; } };
  var ix = new Int32Array(Math.max(w, h)), ia = new Int32Array(Math.max(w, h)), n, na, x, y;
  for (y = 0; y < h; y++){ for (x = 0; x < w; x++) ix[x] = y * w + x; fill(runH, ix, w); }
  for (x = 0; x < w; x++){ for (y = 0; y < h; y++) ix[y] = y * w + x; fill(runV, ix, h); }
  for (var s = -(h - 1); s < w; s++){
    n = 0; na = 0;
    for (y = 0; y < h; y++){ x = s + y; if (x >= 0 && x < w) ix[n++] = y * w + x; var xa = w - 1 - (s + y); if (xa >= 0 && xa < w) ia[na++] = y * w + xa; }
    fill(runD, ix, n); fill(runA, ia, na);
  }
  var hist = new Uint32Array(2048), cnt = 0;
  for (var i = 0; i < N; i++){ if (!px[i]) continue; var t = Math.min(runH[i], runV[i], runD[i] * 1.4142, runA[i] * 1.4142); hist[Math.min(2047, Math.round(t * 4))]++; cnt++; }
  if (!cnt) return { stroke_pt_median:0, stroke_pt_p10:0 };
  var q = function(f){ var c = 0; for (var b = 0; b < 2048; b++){ c += hist[b]; if (c >= cnt * f) return b / 4; } return 0; };
  return { stroke_pt_median:+(q(.5) / dpi * 72).toFixed(2), stroke_pt_p10:+(q(.1) / dpi * 72).toFixed(2) };
}

/* A rendered page, printed at its smallest size and measured against its
   tier, in one call: { bmp, m } (o.dpi, default 100; o.strokes, o.space). */
function measureRender(r, o){
  o = o || {};
  var dpi = o.dpi || 100, L = C.pageLayout(C.smallestLayout(r.tier)), T = C.TIERS[r.tier];
  var bmp = paint(createBitmap(Math.round(L.artW * dpi), Math.round(L.artH * dpi)), shapesFromRender(r, { widthIn:L.artW, dpi:dpi, weight:o.weight }));
  return { bmp:bmp, m:measure(bmp, { dpi:dpi, noiseSqIn:.003, minSqIn:T.minArea, strokes:o.strokes, space:o.space }) };
}

C.quality = { createBitmap:createBitmap, paint:paint, shapesFromRender:shapesFromRender, measure:measure, strokeStats:strokeStats, measureRender:measureRender };
})(typeof globalThis !== "undefined" ? globalThis : this);
