/* =====================================================================
   COGNICORE LINE-ART ENGINE
   One source for every CogniCore coloring page. The Packet Builder draws
   the pages live, the packet tool draws them into its PDFs, and
   scripts/generate_coloring_manifest.js writes them out as SVG files and
   the catalog (src/data/cognicore_coloring_catalog.json).

   The clinical print standard is built in, not left to each drawing
   (docs/cognicore-coloring-standards.md):
     - pure black (#000) lines on pure white (#fff): no gray, no shading,
       no gradients, no textures, no text inside the picture;
     - line weight is set by the tier, never by the drawing, and matches
       the Dynamic Vector Engine's tier table (src/services/vectorEngine.ts):
       3 px (Tier 1, 1.0x), 6 px (Tier 2, 2.0x), 10.5 px (Tier 3, 3.5x) at
       the printed size, where 1 px is 1/96 in (0.75 pt); no line thinner
       than 3 px;
     - a 3:4 picture, scaled to fill its box, so every subject is big;
     - the tier decides how much detail is drawn: Tier 1 everything,
       Tier 2 the guiding lines, Tier 3 the main shapes only.

   A drawing is a function of (g, h): g collects the shapes for one tier,
   h holds the geometry helpers. Coordinates are a 600 x 800 box (3:4).
   Paths use only absolute M, L, C and Z, so they are easy to measure,
   fit, draw into a PDF and check.

   Runs as a plain browser script and in Node (vm). It touches no
   network, storage or page: it only turns numbers into drawings.
   ===================================================================== */
(function(root){
"use strict";

var W = 600, H = 800, ENGINE_VERSION = "1.0.0";

/* ---------- 1. Tiers, line weights, categories, page ---------- */
/* minArea: the smallest area to color, in square inches at the smallest
   printed size; maxTiny: how many areas under it a page may still have
   (small accents such as a gap between two petals). Both are measured on
   the printed bitmap by scripts/generate_coloring_manifest.js. */
var TIERS = {
  1: { id:1, label:"Tier 1 - High Detail", short:"High Detail", weight:"thick", lvl:3, minArea:.02, maxTiny:10,
       stage:"early", about:"More lines inside each shape and more to color, for residents who enjoy detail and fine-motor work." },
  2: { id:2, label:"Tier 2 - Guided Focus", short:"Guided Focus", weight:"ultra-bold", lvl:2, minArea:.05, maxTiny:4,
       stage:"moderate", about:"One clear subject with a few guiding lines, larger areas and heavier lines." },
  3: { id:3, label:"Tier 3 - Single Focal / Sensory", short:"Single Focal / Sensory", weight:"extra-bold-sensory", lvl:1, minArea:.12, maxTiny:1,
       stage:"advanced", about:"One big, familiar shape in the heaviest lines, a handful of large areas and nothing in the background." }
};
/* px: outline width at the printed size in CSS pixels (96 per inch), the
   unit of the Dynamic Vector Engine's tier table; pt: the same in print
   points (px x 0.75); detailPt: interior lines, which never drop below the
   tier's minimum (3, 5 and 9 px). */
var MIN_LINE_PT = 2.25;
var WEIGHTS = {
  "thick":              { id:"thick",              label:"Thick (3 px, 2.25 pt)",                pt:2.25,  detailPt:2.25, px:3 },
  "ultra-bold":         { id:"ultra-bold",         label:"Ultra-bold (6 px, 4.5 pt)",            pt:4.5,   detailPt:3.75, px:6 },
  "extra-bold-sensory": { id:"extra-bold-sensory", label:"Extra-bold sensory (10.5 px, 7.9 pt)", pt:7.875, detailPt:6.75, px:10.5 }
};
var CATEGORIES = [
  { id:"classic-vehicles",   label:"Classic Vehicles",
    blurb:"Mid-century cars, trucks, trains, boats and farm machines, drawn side-on and big." },
  { id:"botanical-garden",   label:"Botanical & Garden",
    blurb:"Flowers, leaves, fruit, vegetables and the tools of a kitchen garden." },
  { id:"nostalgic-heritage", label:"Nostalgic Heritage",
    blurb:"Heirloom kitchenware, clocks, radios, telephones, sewing machines and farm landmarks." },
  { id:"wildlife-nature",    label:"Wildlife & Nature",
    blurb:"Songbirds, butterflies, pond and shore life, and gentle animals, drawn with respect, never as cartoons." },
  { id:"bold-easy-patterns", label:"Bold & Easy Patterns",
    blurb:"Quilt blocks, rosettes, stained glass and tiles: calm, structured patterns with clear edges." },
  { id:"home-everyday",      label:"Home & Everyday Tasks",
    blurb:"Familiar jobs and small pleasures: laundry day, baking, tea, letters, knitting and fishing." }
];
var CAT = {}; CATEGORIES.forEach(function(c){ CAT[c.id] = c; });

/* The printed page, in inches: US Letter with a 0.75 in binding gutter on
   the left (three-ring binder holes sit inside it) and 0.5 in elsewhere. */
var PAGE = { w:8.5, h:11, gutter:0.75, outer:0.5, top:0.5, bottom:0.5,
             holes:{ diameter:0.3125, fromEdge:0.375, centers:[1.25, 5.5, 9.75] } };

/* Where things go on a coloring page. Every size is fixed in advance, so
   the picture's line weight can be set exactly before anything prints. */
function pageLayout(o){
  o = o || {};
  var tier = TIERS[o.tier] ? o.tier : 2;
  var contentW = PAGE.w - PAGE.gutter - PAGE.outer, contentH = PAGE.h - PAGE.top - PAGE.bottom;
  var gap = 0.1, foot = 0.22;
  var titlePt = [0, 24, 28, 32][tier] + (o.largePrint ? 8 : 0), captionPt = [0, 16, 18, 20][tier] + (o.largePrint ? 4 : 0);   // large print: +8 pt titles, +4 pt captions
  var titleH = o.title ? +(titlePt / 72 * 1.3 + 0.02).toFixed(3) : 0;
  var captionH = o.caption ? +(captionPt / 72 * 1.3 * 2 + 0.04).toFixed(3) : 0;
  var headerH = o.header ? 0.4 : 0;
  var used = foot + (headerH ? headerH + gap : 0) + (titleH ? titleH + gap : 0) + (captionH ? captionH + gap : 0) + gap;
  var artH = contentH - used, artW = artH * 0.75;
  if (artW > contentW){ artW = contentW; artH = artW / 0.75; }
  return { page:PAGE, contentW:contentW, contentH:contentH, artW:+artW.toFixed(3), artH:+artH.toFixed(3),
           titlePt:titlePt, captionPt:captionPt, titleH:titleH, captionH:captionH, headerH:headerH, footH:foot, gap:gap };
}

/* The smallest a picture ever prints: every heading on, in large print.
   The tier rules are measured at this size (a color guide sits beside the
   picture, in width the 3:4 box leaves free, so it never shrinks it). */
function SMALLEST(tier){ return { tier:tier, header:true, title:true, caption:true, largePrint:true }; }

/* ---------- 2. Geometry helpers (all return absolute M/L/C/Z paths) ---------- */
function fmt(n){ var r = Math.round(n * 10) / 10; return String(r === 0 ? 0 : r); }
function P(p){ return fmt(p[0]) + " " + fmt(p[1]); }
var KAPPA = 0.5522847498;

var h = {
  W:W, H:H, fmt:fmt,
  /* straight-edged outline through the points */
  poly: function(pts, open){ return "M" + pts.map(P).join(" L") + (open ? "" : " Z"); },
  line: function(a, b){ return "M" + P(a) + " L" + P(b); },
  /* a smooth curve through the points (Catmull-Rom); tension 1 = natural, 0 = straight */
  smooth: function(pts, open, t){
    t = t == null ? 1 : t;
    var n = pts.length; if (n < 3) return h.poly(pts, open);
    var get = function(i){ return open ? pts[Math.max(0, Math.min(n - 1, i))] : pts[(i + n) % n]; };
    var s = "M" + P(pts[0]), last = open ? n - 1 : n;
    for (var i = 0; i < last; i++){
      var p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      var c1 = [p1[0] + (p2[0] - p0[0]) / 6 * t, p1[1] + (p2[1] - p0[1]) / 6 * t];
      var c2 = [p2[0] - (p3[0] - p1[0]) / 6 * t, p2[1] - (p3[1] - p1[1]) / 6 * t];
      s += " C" + P(c1) + " " + P(c2) + " " + P(p2);
    }
    return s + (open ? "" : " Z");
  },
  /* a path built segment by segment: h.path([x,y]).L([..]).Q([..],[..]).C([..],[..],[..]).Z() */
  path: function(start){ return new PathB(start); },
  ellipse: function(cx, cy, rx, ry, rot){
    var k = KAPPA, a = (rot || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    var T = function(x, y){ return [cx + x * ca - y * sa, cy + x * sa + y * ca]; };
    return "M" + P(T(rx, 0)) +
      " C" + P(T(rx, ry * k)) + " " + P(T(rx * k, ry)) + " " + P(T(0, ry)) +
      " C" + P(T(-rx * k, ry)) + " " + P(T(-rx, ry * k)) + " " + P(T(-rx, 0)) +
      " C" + P(T(-rx, -ry * k)) + " " + P(T(-rx * k, -ry)) + " " + P(T(0, -ry)) +
      " C" + P(T(rx * k, -ry)) + " " + P(T(rx, -ry * k)) + " " + P(T(rx, 0)) + " Z";
  },
  circle: function(cx, cy, r){ return h.ellipse(cx, cy, r, r); },
  rect: function(x, y, w, hh){ return h.poly([[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]]); },
  rrect: function(x, y, w, hh, r){
    r = Math.min(r, w / 2, hh / 2); var k = r * (1 - KAPPA);
    return "M" + P([x + r, y]) + " L" + P([x + w - r, y]) + " C" + P([x + w - k, y]) + " " + P([x + w, y + k]) + " " + P([x + w, y + r]) +
      " L" + P([x + w, y + hh - r]) + " C" + P([x + w, y + hh - k]) + " " + P([x + w - k, y + hh]) + " " + P([x + w - r, y + hh]) +
      " L" + P([x + r, y + hh]) + " C" + P([x + k, y + hh]) + " " + P([x, y + hh - k]) + " " + P([x, y + hh - r]) +
      " L" + P([x, y + r]) + " C" + P([x, y + k]) + " " + P([x + k, y]) + " " + P([x + r, y]) + " Z";
  },
  /* an arc as cubic curves, angles in degrees (0 = east, 90 = south) */
  arc: function(cx, cy, r, a0, a1, withMove){
    var s = "", n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 90)), step = (a1 - a0) / n;
    for (var i = 0; i < n; i++){
      var t0 = (a0 + i * step) * Math.PI / 180, t1 = (a0 + (i + 1) * step) * Math.PI / 180, k = 4 / 3 * Math.tan((t1 - t0) / 4);
      var p0 = [cx + r * Math.cos(t0), cy + r * Math.sin(t0)], p3 = [cx + r * Math.cos(t1), cy + r * Math.sin(t1)];
      var c1 = [p0[0] - k * r * Math.sin(t0), p0[1] + k * r * Math.cos(t0)], c2 = [p3[0] + k * r * Math.sin(t1), p3[1] - k * r * Math.cos(t1)];
      if (i === 0 && withMove !== false) s += "M" + P(p0);
      s += " C" + P(c1) + " " + P(c2) + " " + P(p3);
    }
    return s;
  },
  /* a ring segment (annular sector) between radii r0 < r1 and angles a0 < a1 */
  sector: function(cx, cy, r0, r1, a0, a1){
    var pt = function(r, a){ a = a * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
    if (r0 <= 0) return "M" + P([cx, cy]) + " L" + P(pt(r1, a0)) + h.arc(cx, cy, r1, a0, a1, false) + " Z";
    return "M" + P(pt(r0, a0)) + " L" + P(pt(r1, a0)) + h.arc(cx, cy, r1, a0, a1, false) + " L" + P(pt(r0, a1)) + h.arc(cx, cy, r0, a1, a0, false) + " Z";
  },
  /* a closed symmetric outline from its right half: points from the top of the
     centre line, down the right side, to the bottom of the centre line */
  mirror: function(half, cx, open){
    var right = half.slice(), left = half.slice(1, half.length - 1).reverse().map(function(p){ return [2 * cx - p[0], p[1]]; });
    return h.smooth(right.concat(left), open);
  },
  mirrorPoly: function(half, cx){
    var left = half.slice(1, half.length - 1).reverse().map(function(p){ return [2 * cx - p[0], p[1]]; });
    return h.poly(half.concat(left));
  },
  /* a pointed leaf or petal from a to b, w wide at its widest; bend curves it sideways */
  leaf: function(a, b, w, bend, blunt){
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    bend = bend || 0; var bw = w / 2, m1 = .3, m2 = .72;
    var at = function(t, side, f){ var o = side * bw * f + bend * L * Math.sin(Math.PI * t) * .18; return [a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]; };
    var tip = blunt ? [[a[0] + dx * .96 + nx * bw * .35, a[1] + dy * .96 + ny * bw * .35], b, [a[0] + dx * .96 - nx * bw * .35, a[1] + dy * .96 - ny * bw * .35]] : [b];
    return h.smooth([a, at(m1, 1, .92), at(m2, 1, .8)].concat(tip, [at(m2, -1, .8), at(m1, -1, .92)]), false, .9);
  },
  /* the midrib of that leaf, stopping short of the tip */
  vein: function(a, b, bend, f){
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; bend = bend || 0; f = f || .82;
    var pts = [0, .25, .5, .75, 1].map(function(t){ t *= f; var o = bend * L * Math.sin(Math.PI * t) * .18; return [a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]; });
    return h.smooth(pts, true);
  },
  /* a rounded petal around a centre, from radius r0 out to r1, at angle a (degrees) */
  petal: function(cx, cy, a, r0, r1, w, shape){
    var t = a * Math.PI / 180, ux = Math.cos(t), uy = Math.sin(t), vx = -uy, vy = ux, L = r1 - r0;
    var at = function(f, o){ return [cx + ux * (r0 + L * f) + vx * o, cy + uy * (r0 + L * f) + vy * o]; };
    var hw = w / 2;
    if (shape === "round")   return h.smooth([at(0, 0), at(.2, hw * .8), at(.6, hw), at(.92, hw * .6), at(1, 0), at(.92, -hw * .6), at(.6, -hw), at(.2, -hw * .8)], false, .95);
    if (shape === "notched") return h.smooth([at(0, 0), at(.25, hw * .85), at(.7, hw), at(1, hw * .45), at(.9, 0), at(1, -hw * .45), at(.7, -hw), at(.25, -hw * .85)], false, .9);
    if (shape === "pointed") return h.smooth([at(0, 0), at(.3, hw * .9), at(.7, hw * .75), at(1, 0), at(.7, -hw * .75), at(.3, -hw * .9)], false, .9);
    return h.smooth([at(0, 0), at(.3, hw), at(.75, hw * .85), at(1, 0), at(.75, -hw * .85), at(.3, -hw)], false, .95);   // oval
  },
  star: function(cx, cy, r1, r2, n, rot){
    var pts = [];
    for (var i = 0; i < n * 2; i++){ var a = ((rot || -90) + i * 180 / n) * Math.PI / 180, r = i % 2 ? r2 : r1; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return h.poly(pts);
  },
  /* a regular polygon */
  ngon: function(cx, cy, r, n, rot){
    var pts = []; for (var i = 0; i < n; i++){ var a = ((rot || 0) + i * 360 / n) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return h.poly(pts);
  },
  /* an open wavy line from x0 to x1 */
  wave: function(x0, x1, y, amp, n){
    var pts = []; for (var i = 0; i <= n * 4; i++){ var x = x0 + (x1 - x0) * i / (n * 4); pts.push([x, y + Math.sin(i * Math.PI / 2) * amp]); }
    return h.smooth(pts, true, .8);
  },
  /* a scalloped outline: n rounded lobes around a circle (clusters, ruffled leaves) */
  scallop: function(cx, cy, r, n, depth, rot){
    var pts = [];
    for (var i = 0; i < n * 2; i++) pts.push(h.onCircle(cx, cy, i % 2 ? r * (1 - (depth || .18)) : r, (rot || -90) + i * 180 / n));
    return h.smooth(pts, false, 1.1);
  },
  /* points along an arc (degrees), for outlines that are later clipped */
  arcPts: function(cx, cy, r, a0, a1, n){ var pts = []; n = n || Math.max(4, Math.ceil(Math.abs(a1 - a0) / 8)); for (var i = 0; i <= n; i++) pts.push(h.onCircle(cx, cy, r, a0 + (a1 - a0) * i / n)); return pts; },
  /* clip a polygon to a rectangle (Sutherland-Hodgman); [] when nothing is left */
  clipRect: function(pts, x0, y0, x1, y1){
    var edges = [function(p){ return p[0] >= x0; }, function(p){ return p[0] <= x1; }, function(p){ return p[1] >= y0; }, function(p){ return p[1] <= y1; }];
    var cut = [function(a, b){ var t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + t * (b[1] - a[1])]; }, function(a, b){ var t = (x1 - a[0]) / (b[0] - a[0]); return [x1, a[1] + t * (b[1] - a[1])]; },
               function(a, b){ var t = (y0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y0]; }, function(a, b){ var t = (y1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y1]; }];
    var out = pts;
    for (var e = 0; e < 4 && out.length; e++){
      var inp = out; out = [];
      for (var i = 0; i < inp.length; i++){
        var cur = inp[i], prev = inp[(i + inp.length - 1) % inp.length], ci = edges[e](cur), pi = edges[e](prev);
        if (ci){ if (!pi) out.push(cut[e](prev, cur)); out.push(cur); } else if (pi) out.push(cut[e](prev, cur));
      }
    }
    return out;
  },
  /* the clipped polygon as a path, or "" when it falls outside (or is a sliver) */
  clipped: function(pts, x0, y0, x1, y1, minArea){
    var c = h.clipRect(pts, x0, y0, x1, y1), a = 0;
    for (var i = 0; i < c.length; i++){ var p = c[i], q = c[(i + 1) % c.length]; a += p[0] * q[1] - q[0] * p[1]; }
    return c.length >= 3 && Math.abs(a / 2) >= (minArea == null ? 200 : minArea) ? h.poly(c) : "";
  },
  /* points on a circle, degrees */
  onCircle: function(cx, cy, r, a){ a = a * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; },
  /* move, turn and scale a list of points */
  tf: function(pts, o){
    var a = (o.rot || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), s = o.s == null ? 1 : o.s, sx = (o.flip ? -1 : 1) * s, ox = o.ox || 0, oy = o.oy || 0;
    return pts.map(function(p){ var x = (p[0] - ox) * sx, y = (p[1] - oy) * s; return [x * ca - y * sa + (o.x == null ? ox : o.x), x * sa + y * ca + (o.y == null ? oy : o.y)]; });
  },
  lerp: function(a, b, t){ return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; },
  range: function(n){ var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }
};
function PathB(p){ this.s = "M" + P(p); this.p = p; }
PathB.prototype.L = function(p){ this.s += " L" + P(p); this.p = p; return this; };
PathB.prototype.C = function(c1, c2, p){ this.s += " C" + P(c1) + " " + P(c2) + " " + P(p); this.p = p; return this; };
PathB.prototype.Q = function(c, p){   // quadratic, stored as the equivalent cubic
  var a = this.p, c1 = [a[0] + 2 / 3 * (c[0] - a[0]), a[1] + 2 / 3 * (c[1] - a[1])], c2 = [p[0] + 2 / 3 * (c[0] - p[0]), p[1] + 2 / 3 * (c[1] - p[1])];
  return this.C(c1, c2, p);
};
PathB.prototype.A = function(cx, cy, r, a0, a1){ this.s += h.arc(cx, cy, r, a0, a1, false); var t = a1 * Math.PI / 180; this.p = [cx + r * Math.cos(t), cy + r * Math.sin(t)]; return this; };
PathB.prototype.Z = function(){ return this.s + " Z"; };
PathB.prototype.toString = function(){ return this.s; };
PathB.prototype.open = function(){ return this.s; };

/* ---------- 3. Reading our own paths back (measuring and PDF drawing) ---------- */
function parsePath(d){
  var out = [], re = /([MLCZ])([^MLCZ]*)/g, m, cur = null, start = null;
  while ((m = re.exec(d))){
    var n = m[2].trim() ? m[2].trim().split(/[\s,]+/).map(Number) : [];
    if (m[1] === "M"){ cur = [n[0], n[1]]; start = cur; out.push({ op:"M", p:cur }); }
    else if (m[1] === "L"){ for (var i = 0; i + 1 < n.length; i += 2){ cur = [n[i], n[i + 1]]; out.push({ op:"L", p:cur }); } }
    else if (m[1] === "C"){ for (var j = 0; j + 5 < n.length; j += 6){ var c = { op:"C", c1:[n[j], n[j + 1]], c2:[n[j + 2], n[j + 3]], p:[n[j + 4], n[j + 5]], from:cur }; cur = c.p; out.push(c); } }
    else { out.push({ op:"Z" }); cur = start; }
  }
  return out;
}
function bez(a, b, c, d, t){ var u = 1 - t; return [u*u*u*a[0] + 3*u*u*t*b[0] + 3*u*t*t*c[0] + t*t*t*d[0], u*u*u*a[1] + 3*u*u*t*b[1] + 3*u*t*t*c[1] + t*t*t*d[1]]; }
/* points along a path, for measuring (curves sampled every 1/steps) */
function samplePath(d, steps){
  steps = steps || 10;
  var pts = [];
  parsePath(d).forEach(function(s){
    if (s.op === "M" || s.op === "L") pts.push(s.p);
    else if (s.op === "C") for (var i = 1; i <= steps; i++) pts.push(bez(s.from, s.c1, s.c2, s.p, i / steps));
  });
  return pts;
}
/* the area enclosed by a path (all its outlines), in drawing units */
function shapeArea(d){
  var total = 0, cur = [];
  var flush = function(){ if (cur.length > 2){ var a = 0; for (var i = 0; i < cur.length; i++){ var p = cur[i], q = cur[(i + 1) % cur.length]; a += p[0] * q[1] - q[0] * p[1]; } total += Math.abs(a / 2); } cur = []; };
  parsePath(d).forEach(function(s){
    if (s.op === "M"){ flush(); cur.push(s.p); }
    else if (s.op === "L") cur.push(s.p);
    else if (s.op === "C") for (var i = 1; i <= 8; i++) cur.push(bez(s.from, s.c1, s.c2, s.p, i / 8));
  });
  flush();
  return total;
}
function bboxOf(items){
  var b = { x0:Infinity, y0:Infinity, x1:-Infinity, y1:-Infinity };
  items.forEach(function(it){ samplePath(it.d, 8).forEach(function(p){
    if (p[0] < b.x0) b.x0 = p[0]; if (p[0] > b.x1) b.x1 = p[0]; if (p[1] < b.y0) b.y0 = p[1]; if (p[1] > b.y1) b.y1 = p[1];
  }); });
  return b;
}

/* ---------- 4. Drawing context: what a design draws, tier by tier ----------
   g.S(d)  a shape: white inside, outline in the main weight (hides what is behind it)
   g.L(d)  a line in the main weight, nothing filled
   g.D(d)  a detail line (interior lines, veins, seams), lighter but never under the tier's minimum
   g.DS(d) a small shape in the detail weight
   g.K(d)  a small solid black accent (an eye, a button), used sparingly
   The last argument is the least-detailed tier that still shows it:
   1 = every tier, 2 = Tiers 1 and 2, 3 = Tier 1 only. S, L and K default
   to 1; D and DS default to 2. */
function Ctx(tier, variant){
  this.tier = tier; this.lvl = TIERS[tier].lvl; this.items = []; this.variant = variant || 0; this.m = null;
}
Ctx.prototype._add = function(d, kind, fill, lv){
  if (d && (lv || 1) <= this.lvl) this.items.push({ d:this.m ? transformPath(String(d), this.m) : String(d), kind:kind, fill:fill });
  return this;
};
/* Draw fn() moved, scaled, turned or flipped: o = { x, y, s, rot, flip, ox, oy }
   (ox, oy: the point in the drawing that lands on x, y). Groups nest. */
Ctx.prototype.group = function(o, fn){
  var a = (o.rot || 0) * Math.PI / 180, s = o.s == null ? 1 : o.s, sx = (o.flip ? -1 : 1) * s;
  var ox = o.ox || 0, oy = o.oy || 0, x = o.x == null ? ox : o.x, y = o.y == null ? oy : o.y;
  var m = [Math.cos(a) * sx, Math.sin(a) * sx, -Math.sin(a) * s, Math.cos(a) * s, 0, 0];
  m[4] = x - (m[0] * ox + m[2] * oy); m[5] = y - (m[1] * ox + m[3] * oy);
  var prev = this.m; this.m = prev ? mul(prev, m) : m;
  try { fn(this); } finally { this.m = prev; }
  return this;
};
function mul(p, m){ return [p[0] * m[0] + p[2] * m[1], p[1] * m[0] + p[3] * m[1], p[0] * m[2] + p[2] * m[3], p[1] * m[2] + p[3] * m[3], p[0] * m[4] + p[2] * m[5] + p[4], p[1] * m[4] + p[3] * m[5] + p[5]]; }
function transformPath(d, m){
  var T = function(p){ return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; };
  return parsePath(d).map(function(s){
    if (s.op === "M") return "M" + P(T(s.p));
    if (s.op === "L") return "L" + P(T(s.p));
    if (s.op === "C") return "C" + P(T(s.c1)) + " " + P(T(s.c2)) + " " + P(T(s.p));
    return "Z";
  }).join(" ");
}
Ctx.prototype.S = function(d, lv){ return this._add(d, "m", 1, lv || 1); };
Ctx.prototype.L = function(d, lv){ return this._add(d, "m", 0, lv || 1); };
Ctx.prototype.D = function(d, lv){ return this._add(d, "d", 0, lv || 2); };
Ctx.prototype.DS = function(d, lv){ return this._add(d, "d", 1, lv || 2); };
Ctx.prototype.K = function(d, lv){ return this._add(d, "k", 2, lv || 1); };
/* one value per tier: g.at(t1, t2, t3) */
Ctx.prototype.at = function(a, b, c){ return [a, b, c][this.tier - 1]; };
Ctx.prototype.is = function(lv){ return lv <= this.lvl; };

/* ---------- 4b. Kits: settings shared by many designs ----------
   A wide subject (a car, a boat, a barn) would leave most of a tall 3:4
   page empty, so it sits in a scene: an arched frame with sky, land and,
   if asked, a road, each a big closed area to color. Tier 1 adds hills,
   a cloud and a tree line; Tier 3 keeps only land, road and the subject.
   Draw the scene first, then the subject over it (fit "page"). */
var kit = {
  frame: function(g){ g.S(h.path([24, 776]).L([24, 250]).Q([24, 24], [300, 24]).Q([576, 24], [576, 250]).L([576, 776]).Z()); },
  scene: function(g, o){
    o = o || {};
    var hy = o.horizon || 470;
    kit.frame(g);
    if (o.sun !== false) g.S(h.circle(o.sunX || 446, o.sunY || 150, g.at(46, 52, 60)), o.sunLv || 2);
    if (o.cloud !== false){
      g.S(h.smooth([[112, 240], [124, 210], [158, 204], [178, 182], [216, 180], [240, 200], [268, 200], [284, 222], [272, 244]]), 3);
      g.S(h.smooth([[300, 250], [314, 230], [344, 228], [362, 212], [392, 216], [404, 236], [398, 254]]), 3);
    }
    if (o.hills !== false) g.S(h.path([24, hy - 30]).C([130, hy - 110], [250, hy - 96], [330, hy - 40]).C([410, hy - 100], [520, hy - 96], [576, hy - 44]).L([576, 776]).L([24, 776]).Z(), 3);
    if (o.trees) o.trees.forEach(function(t){
      g.S(h.rect(t[0] - 6, hy - 36, 12, 34), 3);
      g.S(h.smooth([[t[0], hy - 36 - t[1]], [t[0] + t[1] * .42, hy - 36 - t[1] * .55], [t[0] + t[1] * .36, hy - 40], [t[0], hy - 30], [t[0] - t[1] * .36, hy - 40], [t[0] - t[1] * .42, hy - 36 - t[1] * .55]]), 3);
    });
    if (!(o.water && o.water - hy < 60)) g.S(h.path([24, hy]).C([180, hy - 22], [420, hy + 18], [576, hy - 8]).L([576, 776]).L([24, 776]).Z());
    if (o.road){
      var r0 = o.road[0], r1 = o.road[1];
      g.S(h.path([24, r0]).L([576, r0 - 10]).L([576, r1]).L([24, r1 + 10]).Z());
      if (o.dashes !== false) for (var x = 60; x < 560; x += 90) g.D(h.line([x, (r0 + r1) / 2 + 5 - (x - 24) / 552 * 10], [x + 44, (r0 + r1) / 2 + 5 - (x + 20) / 552 * 10]), 3);
    }
    if (o.water){
      g.S(h.path([24, o.water]).L([576, o.water]).L([576, 776]).L([24, 776]).Z());
      g.D(h.wave(60, 250, o.water + 70, 7, 3), 2); g.D(h.wave(330, 540, o.water + 130, 7, 3), 2); g.D(h.wave(110, 330, o.water + 190, 7, 3), 3);
    }
  }
};

/* ---------- 5. The library ---------- */
var DESIGNS = [], BY_ID = {}, PACKS = [], PACK_BY_ID = {};
var REQUIRED = ["id", "title", "cat", "talk"];
function define(meta, draw){
  REQUIRED.forEach(function(k){ if (!meta[k]) throw new Error("CogniCore design needs " + k + ": " + JSON.stringify(meta)); });
  if (!CAT[meta.cat]) throw new Error("Unknown category " + meta.cat + " for " + meta.id);
  if (BY_ID[meta.id]) throw new Error("Duplicate design id " + meta.id);
  var d = {
    id:meta.id, title:meta.title, cat:meta.cat, talk:meta.talk, tags:(meta.tags || []).slice(),
    era:meta.era || "", season:meta.season || "", sensitive:(meta.sensitive || []).slice(),
    fit:meta.fit || "subject", pad:meta.pad == null ? .05 : meta.pad, draw:draw, source:"procedural"
  };
  DESIGNS.push(d); BY_ID[d.id] = d;
  return d;
}
function definePack(p){
  if (!p.id || !p.title || !p.designs || !p.designs.length) throw new Error("A pack needs id, title and designs: " + JSON.stringify(p));
  if (PACK_BY_ID[p.id]) throw new Error("Duplicate pack id " + p.id);
  var pk = { id:p.id, title:p.title, about:p.about || "", designs:p.designs.slice(), tier:p.tier || 0, theme:p.theme || "" };
  PACKS.push(pk); PACK_BY_ID[pk.id] = pk;
  return pk;
}

/* Tags the catalog and the search box use, from the design and the tier. */
var CAT_TAGS = {
  "classic-vehicles":["reminiscence", "vehicles", "transport"], "botanical-garden":["nature", "garden", "flowers"],
  "nostalgic-heritage":["reminiscence", "heritage", "home"], "wildlife-nature":["nature", "animals"],
  "bold-easy-patterns":["patterns", "calming", "structured"], "home-everyday":["reminiscence", "daily-life", "familiar-tasks"]
};
var TIER_TAGS = { 1:["fine-motor", "high-detail"], 2:["guided-focus", "motor-skills"], 3:["sensory", "single-focal", "large-areas"] };
function tagsFor(d, tier){
  var t = ["bold-lines"].concat(CAT_TAGS[d.cat] || [], TIER_TAGS[tier] || [], d.tags, d.era ? [d.era] : [], d.season ? [d.season] : []);
  var seen = {};
  return t.filter(function(x){ x = String(x).toLowerCase(); if (!x || seen[x]) return false; seen[x] = 1; return true; }).map(function(x){ return String(x).toLowerCase(); });
}
function assetId(d, tier){ return "cc-" + d.id + "-t" + tier; }

/* ---------- 6. Rendering ---------- */
function weightFor(tier, override){ return WEIGHTS[override] || WEIGHTS[TIERS[tier].weight]; }

/* Draw one design at one tier. Returns the shapes and how to fit them. */
function render(id, tier, variant){
  var d = BY_ID[id];
  if (!d) throw new Error("No CogniCore design " + id);
  tier = TIERS[tier] ? +tier : 2;
  var g = new Ctx(tier, variant);
  d.draw(g, h);
  if (!g.items.length) throw new Error(id + " drew nothing at tier " + tier);
  var bb = bboxOf(g.items), s = 1, tx = 0, ty = 0;
  if (d.fit === "subject"){
    var pad = W * d.pad, bw = Math.max(1, bb.x1 - bb.x0), bh = Math.max(1, bb.y1 - bb.y0);
    s = Math.min((W - 2 * pad) / bw, (H - 2 * pad) / bh);
    tx = (W - bw * s) / 2 - bb.x0 * s; ty = (H - bh * s) / 2 - bb.y0 * s;
  }
  /* The tier's smallest area rule: a white shape too small to color at this
     tier (at the smallest printed size, with every heading on) is left out.
     Lines and black accents are kept. */
  var inch = pageLayout(SMALLEST(tier)).artW / W * s, minA = TIERS[tier].minArea * .6;
  var items = g.items.filter(function(it){ return it.fill !== 1 || shapeArea(it.d) * inch * inch >= minA; });
  return { id:id, tier:tier, design:d, items:items, bbox:bb, s:s, tx:tx, ty:ty, dropped:g.items.length - items.length };
}

function esc(t){ return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

/* SVG for a rendered design. o.widthIn: the printed width of the picture
   in inches (sets the line weight exactly); o.weight: a line-weight id to
   override the tier's; o.standalone: a complete SVG file. */
function toSVG(r, o){
  o = o || {};
  var widthIn = o.widthIn || pageLayout({ tier:r.tier }).artW, wt = weightFor(r.tier, o.weight);
  var unitsPerPt = W / (widthIn * 72);
  var main = wt.pt * unitsPerPt / r.s, det = Math.max(MIN_LINE_PT, wt.detailPt) * unitsPerPt / r.s;
  var label = o.label || (r.design.title + ", a picture to color");
  var body = r.items.map(function(it){
    if (it.fill === 2) return '<path fill="#000" stroke="none" d="' + it.d + '"/>';
    var a = it.fill ? "" : ' fill="none"';
    if (it.kind === "d") a += ' stroke-width="' + fmt3(det) + '"';
    return "<path" + a + ' d="' + it.d + '"/>';
  }).join("");
  var g = '<g transform="translate(' + fmt3(r.tx) + " " + fmt3(r.ty) + ") scale(" + fmt3(r.s) + ')" fill="#fff" data-bw="white" stroke="#000" stroke-width="' + fmt3(main) + '" stroke-linecap="round" stroke-linejoin="round">' + body + "</g>";
  var size = o.standalone ? ' width="' + fmt3(widthIn) + 'in" height="' + fmt3(widthIn / .75) + 'in"' : "";
  var head = o.standalone ? '<svg xmlns="http://www.w3.org/2000/svg" version="1.1"' : "<svg";
  return head + ' viewBox="0 0 ' + W + " " + H + '"' + size + (o.cls ? ' class="' + o.cls + '"' : "") + ' role="img" aria-label="' + esc(label) + '">' +
    (o.standalone ? "<title>" + esc(r.design.title) + "</title>" + (o.background !== false ? '<rect width="' + W + '" height="' + H + '" fill="#fff"/>' : "") : "") + g + "</svg>";
}
function fmt3(n){ return String(Math.round(n * 1000) / 1000); }

/* Draw a rendered design into a jsPDF document: x, y is the top-left corner
   of the picture in points and w its width (the height is w / 0.75). */
function toPDF(doc, r, x, y, w, o){
  o = o || {};
  var wt = weightFor(r.tier, o.weight), k = w / W;
  var map = function(p){ return [x + (r.tx + p[0] * r.s) * k, y + (r.ty + p[1] * r.s) * k]; };
  doc.setDrawColor(0, 0, 0); doc.setFillColor(255, 255, 255);
  if (doc.setLineCap) doc.setLineCap("round");
  if (doc.setLineJoin) doc.setLineJoin("round");
  r.items.forEach(function(it){
    doc.setLineWidth(it.kind === "d" ? Math.max(MIN_LINE_PT, wt.detailPt) : wt.pt);
    if (it.fill === 2) doc.setFillColor(0, 0, 0);
    parsePath(it.d).forEach(function(s){
      if (s.op === "M"){ var a = map(s.p); doc.moveTo(a[0], a[1]); }
      else if (s.op === "L"){ var b = map(s.p); doc.lineTo(b[0], b[1]); }
      else if (s.op === "C"){ var c1 = map(s.c1), c2 = map(s.c2), p = map(s.p); doc.curveTo(c1[0], c1[1], c2[0], c2[1], p[0], p[1]); }
      else doc.close();
    });
    if (it.fill === 2){ doc.fill(); doc.setFillColor(255, 255, 255); }
    else if (it.fill) doc.fillStroke(); else doc.stroke();
  });
}

/* The size of the whole printed library. */
function stats(){
  var byCat = {}; CATEGORIES.forEach(function(c){ byCat[c.id] = 0; });
  DESIGNS.forEach(function(d){ byCat[d.cat]++; });
  return { designs:DESIGNS.length, assets:DESIGNS.length * 3, packs:PACKS.length, byCategory:byCat };
}

root.CogniCore = {
  version:ENGINE_VERSION, W:W, H:H, TIERS:TIERS, WEIGHTS:WEIGHTS, CATEGORIES:CATEGORIES, CAT:CAT, PAGE:PAGE, smallestLayout:SMALLEST,
  define:define, definePack:definePack, render:render, toSVG:toSVG, toPDF:toPDF, pageLayout:pageLayout,
  weightFor:weightFor, tagsFor:tagsFor, assetId:assetId, parsePath:parsePath, samplePath:samplePath, bboxOf:bboxOf,
  designs:function(){ return DESIGNS.slice(); }, design:function(id){ return BY_ID[id] || null; },
  packs:function(){ return PACKS.slice(); }, pack:function(id){ return PACK_BY_ID[id] || null; },
  stats:stats, helpers:h, kit:kit, transformPath:transformPath, shapeArea:shapeArea
};
})(typeof globalThis !== "undefined" ? globalThis : this);
