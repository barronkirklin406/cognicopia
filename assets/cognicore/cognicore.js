/* CogniCore coloring: the line-art engine, every design, the packs, the
   prompt engine and the measured catalog, in one file for the Packet
   Builder and the packet tool. Built by scripts/generate_coloring_manifest.js
   from assets/cognicore/*.js: edit those, then run npm run coloring. */

/* ---------- lineart.js ---------- */
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

/* ---------- designs/botanical.js ---------- */
/* CogniCore designs: Botanical & Garden. Flowers big and upright, leaves
   with their veins only at Tiers 1-2, and nothing behind them. */
(function(C){
"use strict";
var h = C.helpers;

/* an upright tulip cup whose base sits at x, y, s wide */
function tulip(g, x, y, s, lv){
  g.S(h.path([x - s, y]).C([x - s * 1.02, y - s * 1.1], [x - s * .52, y - s * 1.52], [x - s * .36, y - s * 1.16])
    .L([x - s * .02, y - s * 1.62]).L([x + s * .36, y - s * 1.16]).C([x + s * .52, y - s * 1.52], [x + s * 1.02, y - s * 1.1], [x + s, y])
    .C([x + s, y + s * .78], [x - s, y + s * .78], [x - s, y]).Z(), lv);
  g.D(h.path([x - s * .36, y - s * 1.16]).Q([x - s * .02, y - s * .1], [x + s * .36, y - s * 1.16]).open(), lv > 2 ? 3 : 2);
}
/* a vase from its half profile (top of the rim to the foot) */
function vase(g, cx, prof, bands){
  g.S(h.mirror(prof, cx));
  (bands || []).forEach(function(b){ g.D(h.path([cx - b[1], b[0]]).Q([cx, b[0] + b[2]], [cx + b[1], b[0]]).open(), b[3] || 2); });
}

C.define({ id:"tulips-vase", title:"Tulips in a Vase", cat:"botanical-garden", season:"spring",
  tags:["tulips", "spring", "vases", "flowers"], talk:"Which flowers would you choose for your table?" }, function(g){
  var heads = g.at([[170, 250], [300, 170], [430, 250], [234, 350], [372, 344]], [[180, 250], [300, 180], [420, 250]], [[196, 260], [404, 260], [300, 190]]);
  var s = g.at(44, 54, 64);
  heads.forEach(function(p){ g.L(h.smooth([[p[0], p[1] + s * .5], [(p[0] + 300) / 2 + (p[0] < 300 ? 14 : -14), (p[1] + 560) / 2], [300 + (p[0] - 300) * .12, 560]], true)); });
  g.S(h.leaf([292, 556], [168, 382], 58, -.6));
  g.S(h.leaf([308, 556], [440, 400], 56, .6));
  g.D(h.vein([292, 556], [168, 382], -.6)); g.D(h.vein([308, 556], [440, 400], .6));
  heads.forEach(function(p){ tulip(g, p[0], p[1], s); });
  vase(g, 300, [[300, 548], [372, 548], [360, 580], [410, 650], [404, 730], [372, 770], [300, 772]],
    [[600, 78, 22, 2], [700, 92, 18, 3]]);
  g.S(h.rrect(214, 536, 172, 26, 10));
});

C.define({ id:"sunflower", title:"The Sunflower", cat:"botanical-garden", season:"summer",
  tags:["sunflowers", "summer", "fields"], talk:"What does a sunny summer afternoon feel like?" }, function(g){
  var cx = 300, cy = 290, r = 100, n = g.at(18, 16, 12);
  g.S(h.path([292, 390]).C([286, 520], [300, 640], [290, 790]).L([316, 790]).C([324, 640], [312, 520], [310, 390]).Z());
  var lf = [[[296, 560], [120, 470]], [[304, 640], [484, 560]]];
  lf.forEach(function(l, i){ g.S(h.leaf(l[0], l[1], 118, i ? .3 : -.3)); g.D(h.vein(l[0], l[1], i ? .3 : -.3)); });
  g.D(h.line([220, 520], [196, 470]), 3); g.D(h.line([390, 600], [414, 552]), 3);
  if (g.lvl >= 3) for (var j = 0; j < n; j++) g.S(h.petal(cx, cy, j * 360 / n + 180 / n, r * .6, r * 1.95, 2 * Math.PI * r / n * 1.5, "pointed"));
  for (var i = 0; i < n; i++){ var a = i * 360 / n; g.S(h.petal(cx, cy, a, r * .6, r * (g.lvl >= 3 ? 1.8 : 1.9), 2 * Math.PI * r / n * g.at(1.5, 1.55, 1.6), "pointed")); }
  g.S(h.circle(cx, cy, r));
  g.S(h.circle(cx, cy, r * .62), 2);
  g.DS(h.circle(cx, cy, r * .3), 3);
});

/* a garden rose seen from above: three rings of cupped petals around a
   curled centre; the inner ring only at Tiers 1-2 */
function rose(g, x, y, R, lv){
  lv = lv || 1;
  var ring = function(n, r0, r1, w, rot, l){ for (var i = 0; i < n; i++) g.S(h.petal(x, y, rot + i * 360 / n, r0, r1, w, "round"), l); };
  ring(5, R * .3, R, R * .95, -54, lv);
  ring(5, R * .2, R * .74, R * .72, -18, lv);
  ring(4, R * .12, R * .5, R * .5, 20, Math.max(lv, 2));
  g.S(h.circle(x, y, R * .24), lv);
  g.D(h.path([x - R * .12, y + R * .02]).Q([x - R * .1, y - R * .14], [x + R * .04, y - R * .12]).Q([x + R * .16, y - R * .06], [x + R * .08, y + R * .08]).open(), Math.max(lv, 2));
}
C.define({ id:"garden-rose", title:"The Garden Rose", cat:"botanical-garden", season:"summer",
  tags:["roses", "gardens", "summer"], talk:"Who in your family loved roses?" }, function(g){
  g.L(h.smooth([[300, 440], [292, 560], [304, 680], [296, 780]], true));
  var lv = [[[296, 560], [176, 500], -.4], [[302, 640], [430, 590], .4], [[298, 720], [190, 700], -.2]];
  lv.slice(0, g.at(3, 3, 2)).forEach(function(l){ g.S(h.leaf(l[0], l[1], 64, l[2])); g.D(h.vein(l[0], l[1], l[2])); });
  if (g.lvl >= 2){ g.L(h.smooth([[298, 600], [380, 560], [452, 520]], true)); g.S(h.smooth([[430, 520], [440, 478], [458, 452], [476, 478], [484, 520], [458, 534]])); g.D(h.line([458, 458], [458, 528]), 3); }
  rose(g, 300, 290, 170, 1);
});

C.define({ id:"poppies", title:"Poppies in the Field", cat:"botanical-garden", season:"summer",
  tags:["poppies", "fields", "wildflowers"], talk:"Where have you seen wildflowers growing?" }, function(g){
  var fl = g.at([[190, 250, 96], [420, 330, 82], [260, 480, 70]], [[210, 270, 110], [410, 360, 92]], [[300, 300, 150]]);
  var ang = g.at([200, 320, 80, 140], [200, 320, 80, 140], [225, 315, 45, 135]);
  fl.forEach(function(f){ g.L(h.smooth([[f[0], f[1] + f[2] * .3], [f[0] + (300 - f[0]) * .3, (f[1] + 780) / 2], [300 + (f[0] - 300) * .2, 780]], true)); });
  if (g.lvl >= 3) g.L(h.smooth([[480, 600], [470, 690], [440, 780]], true));
  if (g.lvl >= 3){ g.S(h.smooth([[468, 560], [494, 590], [484, 622], [466, 612], [458, 584]])); }
  fl.forEach(function(f){
    var x = f[0], y = f[1], r = f[2];
    ang.forEach(function(a){ g.S(h.petal(x, y, a, r * .1, r, r * 1.25, "round")); });
    g.S(h.circle(x, y, r * .26));
    g.K(h.circle(x, y, r * .1), 2);
    g.D(h.path(h.onCircle(x, y, r * .36, 230)).Q(h.onCircle(x, y, r * .6, 260), h.onCircle(x, y, r * .7, 250)).open(), 3);
  });
});

/* ---------- shared pieces ---------- */
/* a round flower head: n petals in one or two layers, and a centre */
function bloom(g, x, y, R, o){
  o = o || {};
  var n = o.n || 8, shape = o.shape || "oval", r0 = (o.r0 == null ? .22 : o.r0) * R, w = (o.w || 1) * 2 * Math.PI * R / n * .55, rot = o.rot || -90;
  if (o.back) for (var j = 0; j < n; j++) g.S(h.petal(x, y, rot + (j + .5) * 360 / n, r0, R * o.back, w, shape), o.backLv || 3);
  for (var i = 0; i < n; i++) g.S(h.petal(x, y, rot + i * 360 / n, r0, R, w, shape), o.lv || 1);
  if (o.center !== false) g.S(h.circle(x, y, R * (o.center || .28)), o.lv || 1);
  if (o.ring) g.DS(h.circle(x, y, R * o.ring), o.ringLv || 3);
}
/* a stem from the flower head down to the ground, gently curved */
function stem(g, from, to, bend, lv){ g.L(h.smooth([from, [(from[0] + to[0]) / 2 + (bend || 0), (from[1] + to[1]) / 2], to], true), lv); }
/* a leaf with its midrib (the rib at Tiers 1-2) */
function leafV(g, a, b, w, bend, lv){ g.S(h.leaf(a, b, w, bend), lv); g.D(h.vein(a, b, bend), Math.max(lv || 1, 2)); }
/* a terra-cotta pot: rim and tapered body, cx centre, top y, w rim width */
function pot(g, cx, y, w, hgt){
  g.S(h.poly([[cx - w * .42, y + w * .2], [cx + w * .42, y + w * .2], [cx + w * .32, y + hgt], [cx - w * .32, y + hgt]]));
  g.S(h.rrect(cx - w / 2, y, w, w * .22, w * .05));
}
/* a sugar-maple leaf: five broad, toothed lobes and a notch at the stem */
function maplePts(){
  var right = [[-90, 125], [-80, 92], [-74, 96], [-66, 64], [-60, 54], [-52, 72], [-46, 80], [-40, 96], [-35, 112], [-26, 84], [-20, 88], [-14, 62],
               [-8, 50], [0, 58], [8, 62], [15, 74], [24, 56], [36, 48], [52, 32], [70, 28], [90, 20]];
  var pts = right.map(function(p){ return h.onCircle(0, 0, p[1], p[0]); });
  var left = right.slice(1, right.length - 1).reverse().map(function(p){ return h.onCircle(0, 0, p[1], -180 - p[0]); });
  return pts.concat(left);
}
/* a leaf shape made of pointed lobes (maple, ivy): lobes = [angle, radius, half-width] */
function lobed(cx, cy, lobes, base){
  var pts = [];
  for (var a = 0; a < 360; a += 4){
    var r = base;
    lobes.forEach(function(l){ var d = Math.abs(((a - l[0]) % 360 + 540) % 360 - 180); if (d < l[2]) r = Math.max(r, base + (l[1] - base) * Math.pow(1 - d / l[2], 1.6)); });
    pts.push(h.onCircle(cx, cy, r, a));
  }
  return h.poly(pts);
}

C.define({ id:"daffodils", title:"Daffodils in Spring", cat:"botanical-garden", season:"spring",
  tags:["daffodils", "spring", "bulbs"], talk:"What are the first flowers of spring where you have lived?" }, function(g){
  var fl = g.at([[190, 250, 82], [410, 300, 76], [290, 470, 70]], [[200, 270, 96], [410, 330, 90]], [[300, 300, 150]]);
  g.S(h.leaf([270, 780], [150, 430], 40, -.2)); g.S(h.leaf([330, 780], [470, 470], 40, .2));
  if (g.lvl >= 2) g.S(h.leaf([300, 780], [320, 520], 34, .1));
  fl.forEach(function(f){ stem(g, [f[0], f[1] + f[2] * .4], [300 + (f[0] - 300) * .2, 780], (300 - f[0]) * .2); });
  fl.forEach(function(f){
    var x = f[0], y = f[1], R = f[2];
    bloom(g, x, y, R, { n:6, shape:"pointed", w:1.35, center:false, r0:.1 });
    for (var i = 0; i < 6; i++) g.D(h.line(h.onCircle(x, y, R * .42, -90 + i * 60), h.onCircle(x, y, R * .82, -90 + i * 60)), 3);
    g.S(h.smooth([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function(i){ return h.onCircle(x, y, R * (i % 2 ? .36 : .42), i * 30); })));
    g.S(h.circle(x, y, R * .2), 2);
  });
});

C.define({ id:"calla-lilies", title:"Calla Lilies", cat:"botanical-garden",
  tags:["lilies", "elegant", "vases"], talk:"What flowers would you give to someone special?" }, function(g){
  var calla = function(x, y, s, rot){
    g.group({ x:x, y:y, s:s, rot:rot }, function(g){
      g.S(h.smooth([[0, 0], [-14, -40], [-30, -100], [-50, -150], [-62, -184], [-44, -212], [-6, -222], [30, -234], [76, -268], [50, -220], [30, -180], [18, -120], [10, -50]]));
      g.L(h.smooth([[-56, -182], [-22, -176], [24, -194]], true));
      g.S(h.rrect(-12, -214, 16, 58, 8), 3);
    });
  };
  var set = g.at([[236, 330, 1, -16], [376, 290, 1.05, 14], [300, 230, 1.12, 0], [170, 430, .85, -34]], [[240, 330, 1.12, -14], [370, 300, 1.15, 12], [300, 240, 1.2, 0]], [[240, 320, 1.45, -10], [380, 310, 1.45, 12]]);
  set.forEach(function(c){ g.L(h.smooth([[c[0], c[1]], [(c[0] + 300) / 2, (c[1] + 600) / 2], [300 + (c[0] - 300) * .12, 620]], true)); });
  if (g.lvl >= 2){ leafV(g, [292, 600], [130, 470], 76, -.4); leafV(g, [308, 610], [470, 500], 70, .4); }
  set.forEach(function(c){ calla(c[0], c[1], c[2], c[3]); });
  g.S(h.path([222, 560]).L([378, 560]).L([368, 790]).L([232, 790]).Z());
  g.S(h.ellipse(300, 560, 78, 12));
  g.D(h.line([228, 690], [372, 690]), 2); g.D(h.line([230, 744], [370, 744]), 3);
});

C.define({ id:"daisy-jar", title:"Daisies in a Mason Jar", cat:"botanical-garden", season:"summer",
  tags:["daisies", "wildflowers", "canning-jars", "summer"], talk:"Where did daisies grow near a home you remember fondly?" }, function(g){
  var fl = g.at([[200, 200, 80], [380, 170, 78], [300, 330, 80], [150, 380, 64], [440, 350, 66]], [[210, 220, 90], [390, 200, 90], [300, 350, 90]], [[220, 250, 120], [390, 290, 110]]);
  fl.forEach(function(f){ stem(g, [f[0], f[1]], [300 + (f[0] - 300) * .2, 560], (300 - f[0]) * .15); });
  if (g.lvl >= 3){ leafV(g, [280, 540], [190, 470], 34, -.3); leafV(g, [320, 530], [420, 470], 34, .3); }
  fl.forEach(function(f){ bloom(g, f[0], f[1], f[2], { n:g.at(16, 13, 9), shape:"round", w:g.at(1.15, 1.2, 1.45), center:.3, ring:g.lvl >= 3 ? .16 : 0 }); });
  // the jar: glass left open so the stems show through
  g.L(h.path([200, 548]).L([200, 760]).Q([200, 790], [230, 790]).L([370, 790]).Q([400, 790], [400, 760]).L([400, 548]).open());
  g.S(h.rrect(190, 510, 220, 44, 8));
  g.D(h.line([196, 532], [404, 532]), 3);
  g.D(h.line([230, 600], [230, 740]), 3);
});

C.define({ id:"water-lily", title:"The Water Lily", cat:"botanical-garden", season:"summer",
  tags:["water-lilies", "ponds", "calm"], sensitive:["water"], talk:"Where is a peaceful place you like to sit and look at the water?" }, function(g){
  if (g.lvl >= 2) g.L(h.wave(20, 580, 640, 8, 6));
  if (g.lvl >= 3){ g.D(h.wave(60, 300, 700, 6, 3)); g.D(h.wave(330, 560, 740, 6, 3)); }
  g.S(h.path([300, 470]).L([560, 470]).C([560, 560], [440, 610], [300, 610]).C([160, 610], [40, 560], [40, 470]).C([40, 400], [160, 360], [300, 360]).C([380, 360], [450, 380], [500, 410]).Z());
  g.D(h.line([300, 470], [120, 540]), 2); g.D(h.line([300, 470], [480, 540]), 2); g.D(h.line([300, 470], [300, 600]), 3);
  var p = function(a, len, w, lv){ g.S(h.petal(300, 440, a, 10, len, w, "pointed"), lv); };
  [-160, -20].forEach(function(a){ p(a, 190, 90, 1); });
  [-140, -40].forEach(function(a){ p(a, 210, 96, 1); });
  [-118, -62].forEach(function(a){ p(a, 220, 96, 1); });
  p(-90, 230, 100, 1);
  if (g.lvl >= 2){ [-104, -76].forEach(function(a){ p(a, 150, 70, 2); }); }
  [-150, -30, -128, -52].forEach(function(a){ p(a, 120, 70, g.lvl >= 3 ? 3 : 9); });
});

C.define({ id:"magnolia-branch", title:"Magnolia Blossoms", cat:"botanical-garden", season:"spring",
  tags:["magnolia", "blossoms", "spring", "trees"], talk:"Which trees bloomed in spring on a street you know well?" }, function(g){
  var blossom = function(x, y, s, rot){
    g.group({ x:x, y:y, s:s, rot:rot }, function(g){
      g.S(h.petal(0, 0, -168, 0, 150, 100, "round"), 2);
      g.S(h.petal(0, 0, -12, 0, 150, 100, "round"), 2);
      g.S(h.petal(0, 0, -132, 0, 175, 110, "round"));
      g.S(h.petal(0, 0, -48, 0, 175, 110, "round"));
      g.S(h.petal(0, 0, -90, 0, 185, 120, "round"));
      g.D(h.line([0, -30], [0, -160]), 3); g.D(h.line([-14, -24], [-100, -120]), 3); g.D(h.line([14, -24], [100, -120]), 3);
      g.S(h.smooth([[-40, -4], [-28, 26], [0, 36], [28, 26], [40, -4], [0, -14]]));
    });
  };
  g.S(h.path([236, 790]).C([250, 640], [300, 520], [300, 420]).L([330, 420]).C([330, 530], [280, 650], [270, 790]).Z());
  if (g.lvl >= 2){ g.S(h.path([290, 560]).C([240, 520], [180, 500], [150, 470]).L([164, 454]).C([200, 480], [250, 500], [304, 536]).Z()); g.S(h.path([282, 604]).C([360, 560], [430, 540], [470, 530]).L([474, 548]).C([436, 556], [380, 580], [288, 632]).Z(), 3); }
  blossom(315, 400, g.at(1.1, 1.25, 1.55), 0);
  if (g.lvl >= 2) blossom(150, 462, .62, -40);
  if (g.lvl >= 3){ blossom(472, 532, .56, 36); g.S(h.smooth([[240, 700], [210, 650], [206, 610], [230, 632], [250, 690]])); }
});

C.define({ id:"hydrangea", title:"The Hydrangea", cat:"botanical-garden", season:"summer",
  tags:["hydrangea", "shrubs", "summer"], talk:"What grew by the front door of a house you liked?" }, function(g){
  leafV(g, [300, 520], [110, 640], 130, .3); leafV(g, [300, 520], [490, 650], 130, -.3);
  if (g.lvl >= 2) leafV(g, [300, 540], [300, 760], 110, .1);
  var fl = g.at(
    [[300, 150], [220, 180], [380, 180], [160, 250], [260, 240], [340, 240], [440, 250], [200, 320], [300, 310], [400, 320], [140, 390], [250, 390], [350, 390], [460, 390], [200, 460], [300, 460], [400, 460]],
    [[300, 170], [210, 220], [390, 220], [170, 320], [300, 290], [430, 320], [230, 420], [370, 420], [300, 460]],
    [[300, 200], [190, 300], [410, 300], [300, 380], [210, 450], [390, 450]]);
  var r = g.at(58, 70, 92);
  fl.forEach(function(f){ g.S(h.scallop(f[0], f[1], r, 4, .22, -45 + (f[0] % 3) * 8)); g.K(h.circle(f[0], f[1], r * .12)); });
});

C.define({ id:"porch-geranium", title:"The Porch Geranium", cat:"botanical-garden", season:"summer",
  tags:["geraniums", "porch", "pots"], talk:"What did you like to grow on a porch or windowsill?" }, function(g){
  var cl = g.at([[190, 200, 70], [350, 150, 76], [440, 290, 64], [260, 330, 60]], [[210, 220, 86], [390, 210, 86], [300, 340, 70]], [[210, 260, 110], [400, 260, 110]]);
  cl.forEach(function(c){ stem(g, [c[0], c[1] + c[2] * .6], [300, 560], 0); });
  var lv = g.at([[180, 480, 74], [420, 480, 74], [300, 450, 66], [230, 560, 60], [370, 560, 60]], [[190, 480, 80], [410, 480, 80], [300, 520, 70]], [[190, 500, 100], [410, 500, 100]]);
  lv.forEach(function(l){ g.S(h.scallop(l[0], l[1], l[2], 9, .12)); g.D(h.scallop(l[0], l[1], l[2] * .56, 9, .14), 3); });
  cl.forEach(function(c){
    var n = g.at(7, 6, 5), pr = c[2] * g.at(.42, .46, .5);
    if (g.lvl >= 2){ for (var k = 0; k < n; k++){ var q = h.onCircle(c[0], c[1], c[2] * .58, k * 360 / n - 90); g.S(h.scallop(q[0], q[1], pr, 5, .3)); } g.S(h.scallop(c[0], c[1], pr, 5, .3)); }
    else { g.S(h.scallop(c[0], c[1], c[2], 10, .12)); g.S(h.scallop(c[0], c[1], c[2] * .5, 5, .3)); }
  });
  pot(g, 300, 580, 300, 200);
  g.D(h.line([196, 700], [404, 700]), 3);
});

C.define({ id:"watering-can", title:"The Watering Can", cat:"botanical-garden",
  tags:["gardening", "watering", "tools"], talk:"What is the best time of day to water a garden?" }, function(g){
  if (g.lvl >= 2){ [[500, 600], [556, 640]].forEach(function(t, i){ stem(g, [t[0], t[1]], [t[0] + 6, 780], 6); tulip(g, t[0], t[1], 34 - i * 4, 1); }); leafV(g, [520, 780], [456, 680], 36, -.2); }
  g.S(h.path([150, 640]).C([220, 560], [340, 420], [470, 300]).L([500, 330]).C([380, 450], [270, 600], [200, 700]).Z());   // spout
  g.S(h.ellipse(500, 300, 52, 30, -45)); g.DS(h.ellipse(500, 300, 34, 17, -45), 3);   // the rose
  g.S(h.path([90, 390]).C([90, 300], [110, 250], [180, 236]).L([240, 236]).C([300, 246], [314, 300], [314, 390]).Z());   // top dome
  g.S(h.path([64, 400]).L([340, 400]).L([352, 740]).Q([350, 772], [318, 772]).L([86, 772]).Q([54, 772], [52, 740]).Z());   // body
  g.S(h.path([40, 460]).C([-40, 470], [-40, 640], [44, 660]).L([50, 630]).C([0, 616], [0, 500], [46, 490]).Z());   // back handle
  g.S(h.path([120, 300]).C([130, 150], [300, 150], [300, 300]).L([276, 300]).C([272, 184], [150, 184], [146, 300]).Z());   // top handle
  g.S(h.rrect(50, 386, 304, 30, 12));
  g.D(h.line([60, 470], [344, 470]), 2); g.D(h.line([62, 700], [348, 700]), 2);
});

C.define({ id:"garden-gate", title:"The Garden Gate", cat:"botanical-garden",
  tags:["gardens", "fences", "roses", "arbors"], sensitive:["home"], talk:"Tell me about a garden you loved. What grew along the fence?" }, function(g){
  var pk = g.at(6, 5, 4);
  g.S(h.path([60, 260]).Q([300, 40], [540, 260]).L([510, 260]).Q([300, 80], [90, 260]).Z(), 2);
  var w = 368 / pk;                                                   // pickets side by side: no thin gaps between rails
  for (var i = 0; i < pk; i++){ var x = 116 + i * w; g.S(h.poly([[x, 740], [x, 420], [x + w / 2, 390], [x + w, 420], [x + w, 740]])); }
  g.S(h.rect(120, 470, 360, 28)); g.S(h.rect(120, 660, 360, 28));
  g.D(h.line([136, 652], [464, 506]), 3);
  g.S(h.rect(60, 260, 56, 520)); g.S(h.rect(484, 260, 56, 520));
  [48, 472].forEach(function(x){ if (g.is(2)) g.S(h.rrect(x, 236, 80, 28, 8)); else g.K(h.rrect(x, 236, 80, 28, 8)); });
  if (g.lvl >= 2){ g.S(h.circle(88, 214, 20)); g.S(h.circle(512, 214, 20)); }
  g.L(h.smooth([[70, 780], [130, 640], [40, 520], [110, 400], [150, 300], [220, 190], [320, 160]], true), 3);
  var lf = [[100, 690, 30, 20], [70, 560, 40, -10], [100, 430, 30, -24], [150, 320, 40, -20], [210, 214, 36, -30]];
  lf.slice(0, g.at(5, 0, 0)).forEach(function(l, i){ g.S(h.leaf([l[0], l[1]], [l[0] + l[2] * 1.3 * (i % 2 ? 1 : -1), l[1] + l[3] * 1.3], 34, 0)); });
  if (g.lvl >= 2) [[170, 280], [300, 166]].forEach(function(c){ g.S(h.scallop(c[0], c[1], 42, 5, .25)); g.K(h.circle(c[0], c[1], 9)); });
  g.L(h.line([20, 780], [580, 780]), 3);
});

C.define({ id:"garden-wheelbarrow", title:"The Garden Wheelbarrow", cat:"botanical-garden",
  tags:["gardening", "tools", "flowers", "pots"], talk:"What would you plant first in a new garden?" }, function(g){
  if (g.lvl >= 2){ pot(g, 250, 330, 120, 110); bloom(g, 250, 280, 60, { n:8, shape:"round", w:1.1, center:.3 }); }
  pot(g, 380, 300, 130, 140); if (g.lvl >= 2) bloom(g, 380, 240, 70, { n:6, shape:"pointed", w:1.3, center:.3 }); else { g.S(h.scallop(380, 230, 80, 6, .22)); g.S(h.circle(380, 230, 28)); }
  if (g.lvl >= 3){ pot(g, 170, 360, 100, 80); tulip(g, 170, 330, 36, 1); }
  g.S(h.path([90, 420]).L([520, 420]).L([470, 560]).L([150, 560]).Z());
  g.D(h.line([112, 450], [506, 450]), 2);
  var aw = g.at(0, 0, 8);                                        // a sturdier arm at Tier 3
  g.S(h.path([150, 540 - aw]).L([40, 470 - aw]).L([30, 486 + aw]).L([140, 562 + aw]).Z());
  if (g.is(2)) g.S(h.rrect(12, 462, 44, 28, 12)); else g.K(h.rrect(8, 458, 48, 36, 12));
  g.S(h.path([176, 560]).L([150, 690]).L([190, 690]).L([214, 560]).Z());
  g.S(h.circle(470, 640, 80)); g.S(h.circle(470, 640, 36)); g.DS(h.circle(470, 640, 12), 2);
  g.L(h.line([440, 560], [470, 640]));
  g.L(h.line([20, 722], [580, 722]), 3);
});

C.define({ id:"windowsill-herbs", title:"Herbs on the Windowsill", cat:"botanical-garden",
  tags:["herbs", "kitchen-garden", "cooking", "pots"], talk:"Which herbs make a kitchen smell good?" }, function(g){
  if (g.lvl >= 2) g.S(h.path([40, 60]).L([560, 60]).L([560, 560]).L([40, 560]).Z());
  if (g.lvl >= 2){ g.L(h.line([300, 60], [300, 560])); g.L(h.line([40, 310], [560, 310]), 3); }
  // basil: round leaves
  var bx = 150;
  [[bx, 470, bx - 70, 400], [bx, 470, bx + 60, 390], [bx, 440, bx - 40, 340], [bx, 440, bx + 40, 330], [bx, 410, bx, 300]].slice(0, g.at(5, 5, 3))
    .forEach(function(l){ leafV(g, [l[0], l[1]], [l[2], l[3]], 60, 0); });
  // rosemary: tall sprigs of needles
  [[300, 470, 250, 250], [300, 470, 300, 220], [300, 470, 350, 260]].forEach(function(s, i){
    g.L(h.line([s[0], s[1]], [s[2], s[3]]));
    if (g.lvl >= 3) for (var k = 1; k < 7; k++){ var q = h.lerp([s[0], s[1]], [s[2], s[3]], k / 7); g.D(h.line(q, [q[0] - 22, q[1] - 14])); g.D(h.line(q, [q[0] + 22, q[1] - 14])); }
  });
  // chives: tall blades
  [390, 410, 430, 450, 470].slice(0, g.at(5, 4, 3)).forEach(function(x, i){ g.S(h.leaf([450, 480], [x + (i - 2) * g.at(22, 26, 40), 250 + (i % 2) * 30], g.at(22, 28, 40), (i - 2) * .1)); });
  if (g.lvl >= 3) g.S(h.circle(470, 240, 22));
  pot(g, 150, 470, 150, 140); pot(g, 300, 470, 150, 140); pot(g, 450, 470, 150, 140);
  g.S(h.rrect(20, 610, 560, 40, 10));
  if (g.lvl >= 2) g.S(h.rect(40, 650, 520, 30));
});

C.define({ id:"autumn-maple", title:"Autumn Maple Leaves", cat:"botanical-garden", season:"fall",
  tags:["leaves", "autumn", "trees"], talk:"What is your favorite thing about autumn?" }, function(g){
  var maple = function(x, y, s, rot, lv){
    g.group({ x:x, y:y, s:s, rot:rot }, function(g){
      g.S(h.poly(maplePts()), lv);
      g.L(h.line([0, 18], [0, 120]), lv);
      (g.is(2) ? [[-90, 104], [-35, 92], [-145, 92], [15, 58], [165, 58]] : [[-90, 104], [-35, 92], [-145, 92]]).forEach(function(v){ g.L(h.line([0, 14], h.onCircle(0, 14, v[1], v[0])), lv); });
    });
  };
  maple(300, 320, g.at(2, 2.4, 2.8), g.at(-8, -6, 0), 1);
  if (g.lvl >= 2) maple(470, 640, 1.1, 30, 2);
  if (g.lvl >= 3) maple(130, 650, 1, -30, 3);
});

C.define({ id:"oak-acorns", title:"Oak Leaves and Acorns", cat:"botanical-garden", season:"fall",
  tags:["oak", "acorns", "autumn", "woods"], talk:"What trees grew near a place you lived?" }, function(g){
  var oak = function(x, y, s, rot, lv){
    g.group({ x:x, y:y, s:s, rot:rot }, function(g){
      var top = [[20, -10], [50, -52], [78, -58], [96, -26], [130, -72], [160, -76], [178, -34], [212, -66], [238, -62], [250, -28], [276, -34], [292, -18]];
      var pts = [[0, 0]].concat(top, [[312, 0]], top.slice().reverse().map(function(p){ return [p[0], -p[1]]; }));
      g.S(h.smooth(pts, false, 1), lv);
      g.L(h.line([-40, 0], [290, 0]), lv);
      [[64, 56], [145, 74], [225, 64]].forEach(function(v){ g.D(h.line([v[0] - 30, 0], [v[0], -v[1] * .76]), Math.max(lv, 2)); g.D(h.line([v[0] - 30, 0], [v[0], v[1] * .76]), Math.max(lv, 2)); });
    });
  };
  var acorn = function(x, y, s, lv){
    g.group({ x:x, y:y, s:s }, function(g){
      g.S(h.smooth([[-34, 0], [-36, 40], [-18, 84], [0, 96], [18, 84], [36, 40], [34, 0]]), lv);
      g.S(h.path([-46, 8]).Q([-46, -42], [0, -46]).Q([46, -42], [46, 8]).Z(), lv);
      g.S(h.rrect(-6, -70, 12, 28, 5), lv);
      g.D(h.path([-38, -10]).Q([0, 4], [38, -10]).open(), 3); g.D(h.path([-30, -28]).Q([0, -16], [30, -28]).open(), 3);
    });
  };
  oak(g.at(110, 100, 90), g.at(250, 260, 300), g.at(1.3, 1.4, 1.5), -24, 1);
  if (g.lvl >= 2) oak(120, 520, 1.05, 8, 2);
  acorn(g.at(420, 430, 380), g.at(560, 560, 600), g.at(1.3, 1.5, 1.9), 1);
  if (g.lvl >= 2) acorn(g.at(520, 540, 0), 640, 1.1, 2);
});

C.define({ id:"apple-branch", title:"Apples on the Branch", cat:"botanical-garden", season:"fall",
  tags:["apples", "orchards", "harvest", "fruit"], talk:"What would you bake with a basket of apples?" }, function(g){
  var apple = function(x, y, r, lv){
    g.S(h.path([x, y - r * .7]).C([x - r * .6, y - r * 1.2], [x - r * 1.2, y - r * .6], [x - r * 1.05, y + r * .2]).C([x - r * .9, y + r], [x - r * .3, y + r * 1.1], [x, y + r * .85])
      .C([x + r * .3, y + r * 1.1], [x + r * .9, y + r], [x + r * 1.05, y + r * .2]).C([x + r * 1.2, y - r * .6], [x + r * .6, y - r * 1.2], [x, y - r * .7]).Z(), lv);
    g.L(h.line([x, y - r * .7], [x + r * .1, y - r * 1.15]), lv);
    g.D(h.path([x - r * .7, y - r * .1]).Q([x - r * .6, y - r * .5], [x - r * .3, y - r * .6]).open(), 3);
  };
  g.S(h.path([20, 120]).C([200, 150], [380, 110], [580, 60]).L([580, 90]).C([380, 140], [200, 180], [20, 150]).Z());
  var ap = g.at([[170, 300, 80], [360, 280, 86], [490, 230, 64]], [[190, 320, 96], [390, 300, 100]], [[220, 340, 120], [400, 330, 110]]);
  ap.forEach(function(a){ g.L(h.line([a[0], 150 - (a[0] - 20) * .08], [a[0] + 8, a[1] - a[2] * 1.1])); });
  [[110, 150, 60, 260], [290, 130, 340, 220], [450, 110, 540, 150]].slice(0, g.at(3, 2, 1)).forEach(function(l){ leafV(g, [l[0], l[1]], [l[2], l[3]], 56, .2); });
  ap.forEach(function(a){ apple(a[0], a[1], a[2], 1); });
});

C.define({ id:"fruit-bowl", title:"The Fruit Bowl", cat:"botanical-garden",
  tags:["fruit", "kitchen", "still-life"], talk:"What fruit do you enjoy most in its season?" }, function(g){
  var pear = function(x, y, s){ g.group({ x:x, y:y, s:s }, function(g){ g.S(h.smooth([[0, -110], [22, -96], [30, -50], [66, 0], [70, 50], [40, 86], [0, 94], [-40, 86], [-70, 50], [-66, 0], [-30, -50], [-22, -96]])); g.L(h.line([0, -110], [10, -140])); g.D(h.path([-44, 20]).Q([-40, -10], [-24, -30]).open(), 3); }); };
  if (g.lvl >= 3){ for (var i = 0; i < 9; i++){ var q = [150 + (i % 3) * 34 + (i > 5 ? 17 : 0), 380 + Math.floor(i / 3) * 30]; g.S(h.circle(q[0], q[1], 22)); } }
  pear(250, 350, g.at(1.1, 1.3, 1.6));
  if (g.lvl >= 2) pear(390, 380, 1);
  g.S(h.circle(g.at(320, 330, 330), g.at(430, 440, 440), g.at(70, 78, 90)));
  g.D(h.path([g.at(290, 300, 300), 390]).Q([g.at(310, 320, 320), 370], [g.at(340, 350, 350), 380]).open(), 3);
  g.S(h.path([60, 470]).L([540, 470]).C([530, 620], [420, 680], [300, 680]).C([180, 680], [70, 620], [60, 470]).Z());
  g.S(h.path([230, 676]).L([370, 676]).L([400, 730]).L([200, 730]).Z());
  g.D(h.path([90, 520]).Q([300, 560], [510, 520]).open(), 2);
});

C.define({ id:"strawberries", title:"Fresh Strawberries", cat:"botanical-garden", season:"summer",
  tags:["strawberries", "fruit", "summer", "berries"], talk:"What is the best way to eat fresh strawberries?" }, function(g){
  var berry = function(x, y, s, rot){
    g.group({ x:x, y:y, s:s, rot:rot }, function(g){
      g.S(h.smooth([[0, -60], [52, -58], [70, -20], [52, 40], [16, 96], [0, 104], [-16, 96], [-52, 40], [-70, -20], [-52, -58]]));
      for (var i = 0; i < 5; i++) g.S(h.leaf([0, -60], h.onCircle(0, -60, 50, 200 + i * 35), 26, 0));
      g.L(h.line([0, -66], [6, -100]));
      if (g.lvl >= 3) [[-30, -20], [0, -10], [30, -20], [-24, 20], [22, 22], [0, 50], [-40, 0], [40, 0]].forEach(function(p){ g.D(h.line(p, [p[0] + 4, p[1] + 8])); });
    });
  };
  var set = g.at([[200, 300, 1.4, -18], [380, 320, 1.5, 14], [290, 520, 1.5, 0], [460, 540, 1.1, 30]], [[210, 320, 1.8, -14], [390, 360, 1.8, 14], [300, 560, 1.6, 0]], [[210, 360, 2.2, -12], [400, 400, 2.2, 12]]);
  set.forEach(function(b){ berry(b[0], b[1], b[2], b[3]); });
});

C.define({ id:"pumpkin-patch", title:"The Pumpkin Patch", cat:"botanical-garden", season:"fall",
  tags:["pumpkins", "autumn", "harvest"], talk:"What does autumn smell like to you?" }, function(g){
  var pumpkin = function(x, y, rx, ry, lv){
    g.S(h.smooth([[x, y - ry], [x + rx * .7, y - ry * .96], [x + rx, y - ry * .2], [x + rx * .92, y + ry * .6], [x + rx * .5, y + ry], [x, y + ry * .92], [x - rx * .5, y + ry], [x - rx * .92, y + ry * .6], [x - rx, y - ry * .2], [x - rx * .7, y - ry * .96]]), lv);
    [-.5, 0, .5].forEach(function(f){ g.L(h.path([x + rx * f * .7, y - ry * .92]).Q([x + rx * f * 1.5, y], [x + rx * f * .7, y + ry * .95]).open(), lv); });
    g.S(h.path([x - 10, y - ry + 8]).L([x - 16, y - ry - 44]).Q([x, y - ry - 58], [x + 16, y - ry - 44]).L([x + 10, y - ry + 8]).Z(), lv);
  };
  if (g.lvl >= 2){ g.L(h.smooth([[40, 470], [120, 420], [200, 440], [262, 396]], true)); leafV(g, [120, 440], [60, 360], 70, -.2); }
  if (g.lvl >= 3) g.L(h.smooth([[262, 396], [300, 380], [320, 350], [300, 330], [286, 350]], true));
  pumpkin(250, 560, g.at(170, 190, 220), g.at(130, 150, 170), 1);
  if (g.lvl >= 2) pumpkin(470, 640, 90, 70, 1);
  g.L(h.line([20, 732], [580, 732]), 3);
});

C.define({ id:"harvest-basket", title:"The Vegetable Basket", cat:"botanical-garden", season:"fall",
  tags:["vegetables", "harvest", "kitchen-garden", "baskets"], talk:"What grew in the best vegetable garden you have seen?" }, function(g){
  var carrot = function(x, y, rot){ g.group({ x:x, y:y, rot:rot }, function(g){
    if (g.lvl >= 3) [-20, 0, 20].forEach(function(a){ g.S(h.leaf([0, -10], h.onCircle(0, -10, 110, -90 + a), 30, 0)); });
    else g.S(h.leaf([0, -10], [0, -130], 64, 0));
    g.S(h.smooth([[-26, 0], [-18, 90], [0, 190], [18, 90], [26, 0]]));
    if (g.lvl >= 2) [40, 80, 120].forEach(function(yy){ g.D(h.line([-14, yy], [0, yy + 6])); });
  }); };
  var tomato = function(x, y, r){ g.S(h.circle(x, y, r)); g.K(h.star(x, y - r * .8, r * .42, r * .16, 5)); };
  carrot(200, 300, -18); carrot(270, 280, -6);
  if (g.lvl >= 2) carrot(340, 290, 8);
  if (g.lvl >= 3) g.S(h.smooth([[380, 400], [400, 320], [470, 290], [520, 330], [520, 400]]));
  tomato(420, 400, g.at(62, 70, 80));
  if (g.lvl >= 2) tomato(170, 420, 56);
  g.S(h.path([70, 440]).L([530, 440]).L([480, 720]).L([120, 720]).Z());
  g.S(h.rrect(52, 420, 496, 40, 12));
  if (g.lvl >= 2){ [520, 580, 640].forEach(function(y){ g.D(h.line([100 + (y - 440) * .18, y], [500 - (y - 440) * .18, y])); }); }
  if (g.lvl >= 3){ [180, 250, 320, 390, 460].forEach(function(x){ g.D(h.line([x, 460], [x + (300 - x) * .1, 718])); }); }
  g.L(h.path([150, 424]).C([150, 250], [450, 250], [450, 424]).open(), 2);
});

C.define({ id:"dahlia", title:"The Dahlia", cat:"botanical-garden", season:"summer",
  tags:["dahlias", "late-summer", "flowers"], talk:"What colors would you choose for this flower?" }, function(g){
  stem(g, [300, 420], [300, 780], 10);
  leafV(g, [300, 600], [150, 540], 70, -.3); leafV(g, [300, 660], [460, 610], 70, .3);
  var R = 200;
  bloom(g, 300, 300, R, { n:g.at(16, 14, 10), shape:"pointed", w:1.25, back:g.lvl >= 2 ? .96 : 0, backLv:2, center:false });
  bloom(g, 300, 300, R * .68, { n:g.at(12, 10, 8), shape:"pointed", w:1.3, rot:-90 + 180 / g.at(12, 10, 8), center:false });
  if (g.lvl >= 2) bloom(g, 300, 300, R * .4, { n:8, shape:"pointed", w:1.35, center:false });
  g.S(h.circle(300, 300, R * g.at(.15, .16, .24)));
});
})(globalThis.CogniCore);

/* ---------- designs/everyday.js ---------- */
/* CogniCore designs: Home & Everyday Tasks. Familiar jobs and small
   pleasures drawn as the things themselves (a laid table, a knitting
   basket, a letter), so a page can open a conversation about a role the
   person held: host, baker, gardener, letter writer. */
(function(C){
"use strict";
var h = C.helpers;
function ground(g, y, x0, x1){ g.L(h.line([x0 || 40, y], [x1 || 560, y]), 3); }
function cup(g, x, y, s, lv){
  g.group({ x:x, y:y, s:s }, function(g){
    g.S(h.ellipse(0, 70, 110, 20), lv);
    g.S(h.path([70, 10]).C([130, 6], [130, 70], [60, 64]).L([62, 46]).C([100, 48], [100, 26], [66, 28]).Z(), lv);
    g.S(h.path([-80, 0]).L([80, 0]).Q([74, 66], [0, 68]).Q([-74, 66], [-80, 0]).Z(), lv);
    g.S(h.ellipse(0, 0, 80, 14), lv);
    g.D(h.path([-70, 24]).Q([0, 40], [70, 24]).open(), Math.max(lv || 1, 3));
  });
}

C.define({ id:"clothesline", title:"Laundry Day", cat:"home-everyday",
  tags:["laundry", "washing", "sunshine", "chores"], talk:"What is your favorite smell of clean laundry drying?" }, function(g){
  g.S(h.rect(30, 140, 26, 640)); g.S(h.rect(544, 140, 26, 640));
  if (g.is(3)){ g.S(h.rect(10, 140, 66, 22)); g.S(h.rect(524, 140, 66, 22)); } else { g.K(h.rect(10, 140, 66, 22)); g.K(h.rect(524, 140, 66, 22)); }
  g.L(h.smooth([[56, 170], [300, 230], [544, 170]], true));
  var pin = function(x, y){ var d = h.rrect(x - 7, y - 20, 14, 40, 5); if (g.is(3)) g.S(d); else g.K(d); };
  var sag = function(x){ return 170 + 60 * (1 - Math.pow((x - 300) / 244, 2)); };
  // shirt
  var shirt = function(x){ var y = sag(x);
    g.S(h.path([x - 70, y]).L([x + 70, y]).L([x + 120, y + 60]).L([x + 96, y + 100]).L([x + 70, y + 80]).L([x + 70, y + 260]).L([x - 70, y + 260]).L([x - 70, y + 80]).L([x - 96, y + 100]).L([x - 120, y + 60]).Z());
    var cw = g.at(30, 44, 46), cd = g.at(36, 56, 60);
    if (g.is(2)) g.S(h.poly([[x - cw, y], [x, y + cd], [x + cw, y]])); else g.K(h.poly([[x - cw, y], [x, y + cd], [x + cw, y]]));
    g.L(h.line([x, y + cd], [x, y + 260]), 2);
    [70, 130, 190].forEach(function(dy){ g.DS(h.circle(x + 12, y + dy, 7), 3); });
    pin(x - 60, y); pin(x + 60, y);
  };
  var towel = function(x, w){ var y = sag(x); g.S(h.rect(x - w / 2, y, w, 220)); g.D(h.line([x - w / 2, y + 180], [x + w / 2, y + 180])); g.D(h.line([x - w / 2, y + 196], [x + w / 2, y + 196]), 3); pin(x - w / 2 + 12, y); pin(x + w / 2 - 12, y); };
  var dress = function(x){ var y = sag(x); g.S(h.path([x - 40, y]).L([x + 40, y]).L([x + 50, y + 110]).L([x + 110, y + 330]).L([x - 110, y + 330]).L([x - 50, y + 110]).Z()); g.L(h.path([x - 50, y + 110]).Q([x, y + 124], [x + 50, y + 110]).open(), 2); pin(x - 30, y); pin(x + 30, y); };
  if (g.lvl >= 2){ shirt(g.at(140, 160, 0)); towel(g.at(300, 0, 0), 130); dress(g.at(450, 430, 0)); }
  else { shirt(190); dress(420); }
  if (g.lvl >= 2){ g.S(h.path([180, 660]).L([420, 660]).L([400, 770]).L([200, 770]).Z()); g.S(h.rrect(170, 646, 260, 26, 10)); g.D(h.line([196, 710], [404, 710])); }
  ground(g, 780, 20, 580);
});

C.define({ id:"table-setting", title:"Setting the Table", cat:"home-everyday",
  tags:["meals", "hosting", "dining", "family-dinners"], talk:"Who would you invite to a special dinner?" }, function(g){
  if (g.lvl >= 2) g.S(h.rect(30, 110, 540, 600));
  if (g.lvl >= 3){ for (var x = 90; x < 570; x += 60) g.D(h.line([x, 110], [x, 710])); for (var y = 170; y < 710; y += 60) g.D(h.line([30, y], [570, y])); }
  g.S(h.circle(300, 420, 190));
  g.S(h.circle(300, 420, 130));
  if (g.lvl >= 2) g.D(h.circle(300, 420, 164), 3);
  // fork
  if (g.is(2)) g.S(h.path([70, 700]).L([70, 470]).Q([50, 440], [52, 330]).L([64, 330]).L([66, 420]).L([74, 420]).L([74, 330]).L([86, 330]).L([88, 420]).L([96, 420]).L([96, 330]).L([108, 330]).Q([110, 440], [90, 470]).L([90, 700]).Z());
  else g.K(h.path([50, 700]).L([50, 470]).Q([20, 440], [22, 330]).L([34, 330]).L([36, 420]).L([54, 420]).L([54, 330]).L([66, 330]).L([66, 420]).L([84, 420]).L([86, 330]).L([98, 330]).Q([100, 440], [70, 470]).L([70, 700]).Z());   // Tier 3: solid fork and knife, the plate to color
  // knife and spoon
  var knife = h.path([500, 700]).L([500, 480]).Q([500, 360], [530, 330]).Q([534, 420], [524, 480]).L([524, 700]).Z();
  if (g.is(2)) g.S(knife); else g.K(knife);
  if (g.lvl >= 2){ g.S(h.rrect(544, 470, 18, 230, 9)); g.S(h.ellipse(553, 420, 26, 50)); }
  if (g.lvl >= 2){ g.S(h.path([112, 520]).L([180, 520]).L([196, 700]).L([96, 700]).Z()); g.D(h.line([146, 520], [146, 700]), 3); }
  if (g.lvl >= 2) cup(g, 470, 190, g.at(.7, .8, .9), 2);
});

C.define({ id:"tea-for-two", title:"Tea for Two", cat:"home-everyday",
  tags:["tea", "friends", "visiting", "hospitality"], talk:"Who would you like to share a cup of tea with?" }, function(g){
  if (g.lvl >= 2){ g.S(h.rrect(30, 300, 540, 380, 60)); g.D(h.rrect(60, 330, 480, 320, 44), 3); }
  if (g.lvl >= 2){ cup(g, 180, 420, 1, 1); cup(g, 420, 520, 1, 1); g.S(h.path([230, 470]).L([330, 440]).L([334, 452]).L([236, 484]).Z()); g.S(h.ellipse(350, 440, 24, 14, -18)); }
  else cup(g, 280, 380, 2, 1);
  if (g.lvl >= 3){ g.S(h.ellipse(170, 590, 96, 22)); g.S(h.path([100, 580]).L([130, 530]).L([240, 530]).L([240, 580]).Z()); g.D(h.line([112, 560], [240, 560])); }
});

C.define({ id:"baking-day", title:"Baking Day", cat:"home-everyday",
  tags:["baking", "pies", "kitchen", "family-recipes"], talk:"What is a recipe you would love to smell baking right now?" }, function(g){
  g.S(h.rect(24, 560, 552, 40));
  if (g.lvl >= 2) g.S(h.rect(40, 600, 520, 170));
  if (g.lvl >= 3){ g.D(h.line([300, 600], [300, 770])); g.S(h.rrect(230, 670, 40, 18, 8)); g.S(h.rrect(330, 670, 40, 18, 8)); }
  g.S(h.ellipse(300, 470, 230, 90));
  g.S(h.ellipse(300, 452, 200, 72));
  var lines = g.at(5, 3, 2);
  for (var i = 1; i <= lines; i++){ var f = i / (lines + 1), x = 100 + 400 * f, dy = 72 * Math.sqrt(1 - Math.pow((x - 300) / 200, 2)); g.L(h.line([x, 452 - dy], [x, 452 + dy])); var y = 380 + 144 * f, dx = 200 * Math.sqrt(1 - Math.pow((y - 452) / 72, 2)); g.L(h.line([300 - dx, y], [300 + dx, y])); }
  g.S(h.path([110, 330]).L([450, 250]).L([458, 276]).L([118, 356]).Z());
  g.S(h.rrect(40, 324, 76, 40, 16)); g.S(h.rrect(448, 236, 76, 40, 16));
  if (g.lvl >= 2){ g.S(h.circle(480, 170, 60)); g.S(h.star(480, 170, 40, 18, 5), 3); g.S(h.path([60, 250]).Q([60, 170], [140, 170]).L([200, 170]).Q([260, 170], [260, 250]).Z(), 3); }
});

C.define({ id:"knitting-basket", title:"The Knitting Basket", cat:"home-everyday",
  tags:["knitting", "yarn", "handwork", "crafts"], talk:"What would you knit or make for someone you care about?" }, function(g){
  var ball = function(x, y, r, lv){ g.S(h.circle(x, y, r), lv); [-.5, 0, .5].forEach(function(f){ g.L(h.path([x - r * .9, y + f * r]).Q([x, y + f * r - r * .5], [x + r * .9, y + f * r]).open(), Math.max(lv || 1, 1)); }); };
  g.S(h.path([420, 110]).L([200, 520]).L([214, 526]).L([436, 116]).Z());
  g.S(h.circle(428, 106, 14));
  g.S(h.path([480, 150]).L([320, 540]).L([334, 546]).L([496, 156]).Z(), 2);
  if (g.lvl >= 2) g.S(h.circle(488, 146, 14), 2);
  ball(200, 420, g.at(90, 100, 120), 1);
  if (g.lvl >= 2) ball(360, 440, 80, 2);
  g.S(h.path([60, 460]).L([540, 460]).L([500, 740]).L([100, 740]).Z());
  g.S(h.rrect(44, 440, 512, 40, 14));
  if (g.lvl >= 2) [540, 610, 680].forEach(function(y){ g.D(h.line([60 + (y - 460) * .14, y], [540 - (y - 460) * .14, y])); });
  if (g.lvl >= 3) [150, 230, 310, 390, 470].forEach(function(x){ g.D(h.line([x, 480], [x + (300 - x) * .12, 738])); });
  if (g.lvl >= 2) g.L(h.smooth([[200, 510], [260, 560], [230, 620], [320, 640]], true));
});

C.define({ id:"sewing-basket", title:"The Sewing Basket", cat:"home-everyday",
  tags:["sewing", "mending", "spools", "handwork"], talk:"What is something you would love to mend or make?" }, function(g){
  // spool of thread
  g.group({ x:g.at(160, 180, 220), y:g.at(330, 330, 380), s:g.at(1, 1.15, 1.5) }, function(g){
    g.S(h.rect(-60, -110, 120, 220));
    for (var i = 0; i < 8; i++) g.D(h.line([-60, -90 + i * 26], [60, -80 + i * 26]));
    g.S(h.ellipse(0, -120, 90, 22)); g.S(h.ellipse(0, 120, 90, 22));
  });
  // pincushion
  g.group({ x:g.at(420, 420, 0), y:g.at(360, 380, 0), s:g.at(1, 1.1, 1) }, function(g){
    if (g.lvl < 2) return;
    g.S(h.smooth([[-110, 20], [-100, -60], [0, -90], [100, -60], [110, 20], [0, 60]]));
    [-60, -20, 20, 60].forEach(function(x){ g.L(h.path([x, -80]).Q([x * 1.3, -10], [x, 50]).open()); });
    g.S(h.star(0, -90, 34, 14, 5));
    [[-40, -110, -60, -150], [30, -100, 50, -150]].forEach(function(p){ g.L(h.line([p[0], p[1]], [p[2], p[3]])); g.S(h.circle(p[2], p[3], 12)); });
  });
  // scissors
  g.group({ x:300, y:g.at(620, 640, 640), s:g.at(1, 1.1, 1.3), rot:-12 }, function(g){
    g.S(h.path([0, -10]).L([220, -34]).L([222, -22]).L([10, 10]).Z());
    g.S(h.path([0, 10]).L([220, 34]).L([222, 22]).L([10, -10]).Z());
    g.S(h.ellipse(-70, -34, 56, 34)); g.S(h.ellipse(-70, 34, 56, 34));
    g.S(h.ellipse(-70, -34, 32, 16), 2); g.S(h.ellipse(-70, 34, 32, 16), 2);
    g.S(h.circle(6, 0, 10));
  });
  if (g.lvl >= 3){ g.S(h.path([470, 560]).L([530, 560]).L([524, 640]).Q([500, 660], [476, 640]).Z()); g.S(h.ellipse(500, 560, 30, 8)); }
});

C.define({ id:"potting-bench", title:"The Potting Bench", cat:"home-everyday",
  tags:["gardening", "potting", "seedlings", "tools"], talk:"What would you plant in these pots?" }, function(g){
  g.S(h.rect(60, 420, 480, 36));
  g.S(h.rect(80, 456, 26, 300)); g.S(h.rect(494, 456, 26, 300));
  if (g.lvl >= 2){ g.S(h.rect(80, 640, 440, 26)); g.S(h.rect(60, 140, 480, 22)); g.S(h.rect(80, 162, 20, 258)); g.S(h.rect(500, 162, 20, 258)); }
  var pot = function(x, w, hh){ g.S(h.poly([[x - w * .42, 420 - hh + w * .2], [x + w * .42, 420 - hh + w * .2], [x + w * .32, 420], [x - w * .32, 420]])); g.S(h.rrect(x - w / 2, 420 - hh, w, w * .22, 6)); };
  var sprout = function(x, top){ var k = g.at(1, 1.15, 1.5); g.L(h.line([x, top + 10], [x, top - 60 * k])); g.S(h.leaf([x, top - 40 * k], [x - 50 * k, top - 80 * k], 30 * k, -.2)); g.S(h.leaf([x, top - 50 * k], [x + 50 * k, top - 90 * k], 30 * k, .2)); };
  pot(g.at(190, 200, 220), 130, 120); sprout(g.at(190, 200, 220), 300);
  pot(g.at(400, 400, 390), g.at(110, 130, 150), g.at(100, 120, 140)); sprout(g.at(400, 400, 390), g.at(320, 300, 280));
  if (g.lvl >= 2){ g.S(h.path([300, 640]).L([240, 520]).L([260, 510]).L([318, 630]).Z()); g.S(h.path([240, 520]).Q([200, 470], [230, 440]).Q([280, 470], [260, 510]).Z()); }
  if (g.lvl >= 3){ g.S(h.rrect(300, 580, 170, 60, 20)); g.D(h.line([330, 580], [330, 640])); g.D(h.line([380, 580], [380, 640])); }
  ground(g, 760, 40, 560);
});

C.define({ id:"letter-writing", title:"Writing a Letter", cat:"home-everyday",
  tags:["letters", "writing", "keeping-in-touch", "mail"], talk:"Who would you most like to write a letter to?" }, function(g){
  g.S(h.path([60, 120]).L([420, 90]).L([460, 560]).L([100, 590]).Z());
  var lines = g.at(8, 6, 0);
  for (var i = 1; i <= lines; i++){ var f = i / (lines + 1); var a = h.lerp([80, 140], [100, 570], f), b = h.lerp([420, 110], [440, 540], f); g.D(h.line(a, b)); }
  g.S(h.rect(160, 420, 380, 240));
  g.L(h.poly([[160, 420], [350, 560], [540, 420]], true));
  if (g.lvl >= 2){ g.S(h.rect(450, 440, 70, 80)); g.D(h.rect(462, 452, 46, 56)); }
  g.group({ x:430, y:300, rot:30 }, function(g){
    var pw = g.at(16, 18, 22), tip = h.poly([[-pw, 20], [pw, 20], [0, 80]]);
    g.S(h.rrect(-pw, -200, 2 * pw, 220, 14));
    if (g.is(3)){ g.S(tip); g.D(h.line([0, 30], [0, 66])); } else g.K(tip);
    if (g.lvl >= 2) g.S(h.rrect(-pw - 4, -220, 2 * pw + 8, 40, 12));
  });
});

C.define({ id:"picnic-basket", title:"The Summer Picnic", cat:"home-everyday", season:"summer",
  tags:["picnics", "summer", "parks", "family-outings"], talk:"Where is a lovely spot for a picnic, and what would you pack?" }, function(g){
  g.S(h.path([20, 600]).L([580, 600]).L([580, 780]).L([20, 780]).Z());
  if (g.lvl >= 2){ for (var x = 90; x < 580; x += 70) g.L(h.line([x, 600], [x, 780])); [660, 720].forEach(function(y){ g.L(h.line([20, y], [580, y])); }); }
  g.L(h.path([160, 380]).C([160, 200], [440, 200], [440, 380]).open());
  g.S(h.path([100, 420]).L([500, 420]).L([470, 640]).L([130, 640]).Z());
  g.S(h.rrect(80, 380, 440, 56, 16));
  if (g.lvl >= 2) [490, 560].forEach(function(y){ g.D(h.line([110, y], [490, y])); });
  if (g.lvl >= 3) [180, 240, 300, 360, 420].forEach(function(x){ g.D(h.line([x, 440], [x + (300 - x) * .08, 636])); });
  g.S(h.rrect(270, 400, 60, 60, 12));
  if (g.lvl >= 2){ g.S(h.path([480, 560]).L([560, 560]).L([556, 690]).Q([520, 704], [484, 690]).Z()); g.S(h.ellipse(520, 560, 40, 10)); }
});

C.define({ id:"gone-fishing", title:"Gone Fishing", cat:"home-everyday",
  tags:["fishing", "lakes", "outdoors", "patience"], sensitive:["water"], talk:"What is the best part of a quiet day outdoors?" }, function(g){
  /* Tier 1: a rod with a colorable reel leaning behind the creel. Tiers 2
     and 3: the rod is a bold line in front, with a solid reel, so it never
     leaves thin slivers beside the basket. */
  if (g.is(3)){ g.S(h.path([60, 760]).L([520, 90]).L([534, 100]).L([80, 772]).Z()); g.S(h.circle(170, 610, 44)); g.S(h.circle(170, 610, 18)); }
  g.L(h.smooth([[526, 94], [560, 200], [560, 400], [540, 460]], true));
  g.S(h.smooth([[520, 470], [556, 450], [580, 480], [556, 520], [520, 500]]));
  g.group({ x:330, y:g.at(560, 560, 540), s:g.at(1, 1.1, 1.2) }, function(g){
    g.S(h.path([-150, -110]).L([150, -110]).L([130, 110]).Q([0, 140], [-130, 110]).Z());
    g.S(h.rrect(-164, -140, 328, 44, 14));
    g.L(h.path([-120, -140]).C([-120, -260], [120, -260], [120, -140]).open());
    if (g.lvl >= 2) [-40, 30, 90].forEach(function(y){ g.D(h.line([-146, y - 60], [146, y - 60])); });
    if (g.lvl >= 3) [-90, -30, 30, 90].forEach(function(x){ g.D(h.line([x, -96], [x * .9, 118])); });
  });
  if (!g.is(3)){ g.L(h.line([146, 656], [527, 95])); g.K(h.circle(176, 610, 30)); }        // the butt ends in the open, clear of the fish
  g.group({ x:170, y:720, s:g.at(.9, .9, 1.05), rot:-6 }, function(g){ g.S(h.smooth([[120, 0], [60, -40], [-40, -30], [-100, 0], [-40, 30], [60, 40]])); g.S(h.poly([[-100, 0], [-150, -40], [-140, 0], [-150, 40]])); g.K(h.circle(80, -8, 6)); g.D(h.path([40, -30]).Q([24, 0], [40, 30]).open()); });
});

C.define({ id:"sunday-paper", title:"The Sunday Paper", cat:"home-everyday",
  tags:["newspapers", "coffee", "mornings", "reading"], talk:"What part of the paper would you read first?" }, function(g){
  g.S(h.path([60, 200]).L([440, 170]).L([480, 620]).L([100, 650]).Z());
  g.S(h.path([80, 230]).L([420, 204]).L([430, 300]).L([90, 326]).Z());
  var cols = g.at(3, 2, 0);
  for (var c = 0; c < cols; c++) for (var r = 0; r < g.at(8, 5, 0); r++){ var x0 = 100 + c * 116, y = 360 + r * 30 - c * 9; g.D(h.line([x0, y], [x0 + 96, y - 8])); }
  if (g.lvl >= 1 && g.lvl < 2) g.S(h.rect(110, 360, 300, 200));
  g.S(h.path([96, 360]).L([250, 348]).L([258, 440]).L([104, 452]).Z(), 2);
  g.group({ x:460, y:560, s:g.at(1, 1.1, 1.3) }, function(g){
    g.S(h.path([-70, -60]).L([70, -60]).L([60, 70]).Q([0, 84], [-60, 70]).Z());
    var mugHandle = h.path([66, -30]).C([120, -30], [120, 40], [62, 40]).L([62, 20]).C([96, 20], [96, -10], [66, -10]).Z();
    if (g.is(2)) g.S(mugHandle); else g.K(mugHandle);
    g.S(h.ellipse(0, -60, 70, 14));
  });
  if (g.lvl >= 2){ g.S(h.circle(170, 720, 44)); g.S(h.circle(290, 720, 44)); g.L(h.path([214, 716]).Q([230, 700], [246, 716]).open()); }
});

C.define({ id:"ironing-day", title:"Ironing Day", cat:"home-everyday",
  tags:["ironing", "laundry", "chores", "home"], talk:"What is a chore you actually enjoy?" }, function(g){
  g.S(h.path([40, 420]).L([470, 420]).Q([570, 420], [570, 470]).Q([570, 520], [470, 520]).L([40, 520]).Z());
  g.L(h.line([160, 520], [440, 770])); g.L(h.line([440, 520], [160, 770]));
  if (g.lvl >= 2) g.S(h.path([90, 420]).L([130, 360]).L([290, 360]).L([330, 420]).Z());
  if (g.lvl >= 3) g.D(h.line([130, 390], [290, 390]));
  g.group({ x:g.at(420, 420, 330), y:g.at(356, 356, 340), s:g.at(1, 1.1, 1.4) }, function(g){
    g.S(h.path([-120, 60]).L([130, 60]).C([120, 30], [80, 10], [30, 4]).L([-100, 4]).Q([-120, 10], [-120, 60]).Z());
    g.S(h.path([-80, 4]).C([-80, -70], [40, -74], [60, 4]).L([34, 4]).C([24, -40], [-50, -40], [-54, 4]).Z());
    if (g.lvl >= 2) g.D(h.line([-104, 36], [104, 36]));
  });
  if (g.lvl >= 2){ g.L(h.smooth([[300, 400], [240, 440], [230, 560], [300, 700], [350, 770]], true), 2); }
});

C.define({ id:"cards-and-dominoes", title:"Cards and Dominoes", cat:"home-everyday",
  tags:["card-games", "dominoes", "games", "friends"], talk:"What game would you like to play with friends?" }, function(g){
  var card = function(x, y, rot, suit, lv){ g.group({ x:x, y:y, rot:rot }, function(g){
    g.S(h.rrect(-80, -120, 160, 240, 16), lv);
    if (suit === "heart") g.S(h.path([0, 40]).C([-70, -10], [-50, -80], [0, -40]).C([50, -80], [70, -10], [0, 40]).Z(), lv);
    else if (suit === "diamond") g.S(h.poly([[0, -60], [44, 0], [0, 60], [-44, 0]]), lv);
    else if (suit === "spade") g.S(h.path([0, -60]).C([60, -10], [60, 40], [10, 30]).L([24, 70]).L([-24, 70]).L([-10, 30]).C([-60, 40], [-60, -10], [0, -60]).Z(), lv);
    else { g.S(h.circle(0, -30, 26), lv); g.S(h.circle(-30, 14, 26), lv); g.S(h.circle(30, 14, 26), lv); g.S(h.poly([[-10, 20], [10, 20], [20, 70], [-20, 70]]), lv); }
  }); };
  card(170, 300, -20, "spade", 2); card(300, 270, 0, "heart", 1); card(430, 300, 20, "diamond", 1);
  if (g.lvl >= 3) card(230, 290, -10, "club", 3);
  var domino = function(x, y, a, b, rot){ g.group({ x:x, y:y, rot:rot }, function(g){
    g.S(h.rrect(-60, -120, 120, 240, 16)); g.L(h.line([-50, 0], [50, 0]));
    var pip = { 1:[[0, 0]], 2:[[-26, -26], [26, 26]], 3:[[-26, -26], [0, 0], [26, 26]], 4:[[-26, -26], [26, -26], [-26, 26], [26, 26]], 5:[[-26, -26], [26, -26], [0, 0], [-26, 26], [26, 26]] };
    (pip[a] || []).forEach(function(p){ g.K(h.circle(p[0], p[1] - 60, 11)); }); (pip[b] || []).forEach(function(p){ g.K(h.circle(p[0], p[1] + 60, 11)); });
  }); };
  domino(200, 600, 3, 5, 80);
  if (g.lvl >= 2) domino(420, 620, 2, 4, 100);
});
})(globalThis.CogniCore);

/* ---------- designs/heritage.js ---------- */
/* CogniCore designs: Nostalgic Heritage. Heirloom kitchenware, clocks,
   radios and telephones, the sewing room, and farm landmarks. Clock faces
   carry tick marks, never numerals: the picture stays free of text. */
(function(C){
"use strict";
var h = C.helpers, kit = C.kit;

/* a clock face: ticks by tier (12, 4 or none) and two solid hands at h:m */
function clockFace(g, cx, cy, r, hr, mn){
  g.S(h.circle(cx, cy, r));
  if (g.lvl >= 2) for (var i = 0; i < 12; i++){
    var big = i % 3 === 0;
    if (!big && g.lvl < 3) continue;
    g.D(h.line(h.onCircle(cx, cy, r * (big ? .72 : .8), i * 30 - 90), h.onCircle(cx, cy, r * .9, i * 30 - 90)));
  }
  var ha = ((hr % 12) + mn / 60) * 30 - 90, ma = mn * 6 - 90;
  g.K(h.poly([h.onCircle(cx, cy, r * .1, ha + 90), h.onCircle(cx, cy, r * .5, ha), h.onCircle(cx, cy, r * .1, ha - 90), h.onCircle(cx, cy, r * .14, ha + 180)]));
  g.K(h.poly([h.onCircle(cx, cy, r * .08, ma + 90), h.onCircle(cx, cy, r * .74, ma), h.onCircle(cx, cy, r * .08, ma - 90), h.onCircle(cx, cy, r * .12, ma + 180)]));
  g.K(h.circle(cx, cy, r * .07));
}
function ground(g, y, x0, x1){ g.L(h.line([x0 || 40, y], [x1 || 560, y]), 3); }

C.define({ id:"teapot-and-cup", title:"Teatime", cat:"nostalgic-heritage",
  tags:["tea", "kitchen", "china", "hospitality"], talk:"How do you like your tea or coffee, and who would you share it with?" }, function(g){
  g.S(h.path([420, 520]).C([470, 500], [500, 440], [530, 380]).L([556, 392]).C([530, 470], [500, 560], [436, 590]).Z());           // spout
  g.S(h.path([176, 470]).C([80, 450], [70, 610], [180, 600]).L([184, 574]).C([116, 574], [118, 494], [180, 500]).Z());               // handle
  g.S(h.mirror([[300, 400], [380, 408], [440, 460], [454, 540], [430, 610], [370, 650], [300, 654]], 300));                          // body
  g.S(h.path([220, 410]).Q([226, 346], [300, 340]).Q([374, 346], [380, 410]).Z());                                                   // lid
  g.S(h.ellipse(300, 410, 90, 16));
  if (g.is(2)) g.S(h.circle(300, 326, 22)); else g.K(h.circle(300, 326, 22));
  g.D(h.path([152, 520]).Q([300, 560], [448, 520]).open()); g.D(h.path([160, 590]).Q([300, 626], [440, 590]).open(), 3);
  if (g.lvl >= 2){
    g.S(h.ellipse(470, 736, 110, 22));                                                                                               // saucer
    g.S(h.path([398, 640]).L([542, 640]).Q([536, 724], [470, 728]).Q([404, 724], [398, 640]).Z());
    g.S(h.path([540, 656]).C([600, 650], [600, 710], [530, 706]).L([532, 690]).C([578, 690], [578, 668], [538, 672]).Z());
    g.D(h.path([404, 664]).Q([470, 680], [536, 664]).open(), 3);
  }
  ground(g, 760, 30, 570);
});

C.define({ id:"rotary-telephone", title:"The Rotary Telephone", cat:"nostalgic-heritage", era:"1950s",
  tags:["telephones", "keeping-in-touch", "home"], talk:"Who would you most like to ring up for a chat?" }, function(g){
  g.L(h.smooth([[140, 660], [60, 640], [56, 520], [120, 470]], true));
  g.S(h.rrect(116, 656, 368, 32, 12));
  g.S(h.path([144, 664]).L([184, 444]).Q([192, 412], [224, 412]).L([376, 412]).Q([408, 412], [416, 444]).L([456, 664]).Z());
  g.S(h.path([116, 396]).Q([116, 352], [168, 352]).L([432, 352]).Q([484, 352], [484, 396]).L([484, 412]).Q([484, 432], [456, 432]).L([424, 432]).Q([400, 432], [392, 408])
    .L([208, 408]).Q([200, 432], [176, 432]).L([144, 432]).Q([116, 432], [116, 412]).Z());
  if (g.lvl >= 2){ g.S(h.circle(160, 392, 18)); g.S(h.circle(440, 392, 18)); }
  g.S(h.circle(300, 552, 88));
  if (g.lvl >= 2) for (var i = 0; i < 10; i++){ var q = h.onCircle(300, 552, 60, -60 + i * 27); g.S(h.circle(q[0], q[1], g.at(14, 16, 16))); }
  g.S(h.circle(300, 552, g.at(30, 36, 44)));
  if (g.lvl >= 3) g.D(h.path(h.onCircle(300, 552, 76, -70)).Q(h.onCircle(300, 552, 100, -80), h.onCircle(300, 552, 82, -94)).open());
});

C.define({ id:"cathedral-radio", title:"The Family Radio", cat:"nostalgic-heritage", era:"1930s",
  tags:["radio", "music", "evenings", "home"], talk:"What would you like to hear on the radio this evening?" }, function(g){
  g.S(h.rrect(96, 610, 408, 34, 12));
  g.S(h.path([116, 610]).L([116, 400]).Q([116, 230], [300, 230]).Q([484, 230], [484, 400]).L([484, 610]).Z());
  if (g.lvl >= 2) g.D(h.path([140, 600]).L([140, 404]).Q([140, 256], [300, 256]).Q([460, 256], [460, 404]).L([460, 600]).open(), 3);
  g.S(h.path([180, 470]).L([180, 404]).Q([180, 300], [300, 300]).Q([420, 300], [420, 404]).L([420, 470]).Z());
  var bars = g.at([236, 268, 300, 332, 364], [250, 300, 350], [300]);
  bars.forEach(function(x){ var top = 404 - Math.sqrt(Math.max(0, 120 * 120 - (x - 300) * (x - 300))) * .86; g.L(h.line([x, top + 6], [x, 464])); });
  g.S(h.circle(300, 530, 40));
  g.S(h.circle(200, 540, 24)); g.S(h.circle(400, 540, 24));
  if (g.lvl >= 3){ g.D(h.line([300, 500], [300, 530])); g.S(h.circle(300, 530, 14)); }
});

C.define({ id:"sewing-machine", title:"The Sewing Machine", cat:"nostalgic-heritage", era:"1950s",
  tags:["sewing", "needlework", "handmade", "sewing-room"], talk:"What is something special that was sewn or mended by hand?" }, function(g){
  g.S(h.rect(88, 536, 28, 208)); g.S(h.rect(484, 536, 28, 208));
  if (g.lvl >= 2){ g.S(h.rect(116, 680, 368, 20)); g.S(h.rrect(220, 704, 160, 24, 8)); }
  g.S(h.rrect(56, 500, 488, 36, 8));
  if (g.lvl >= 2){ g.S(h.rrect(372, 536, 112, 52, 6)); g.S(h.circle(428, 562, 8)); }
  g.S(h.rrect(116, 464, 368, 36, 8));
  g.S(h.path([460, 464]).L([460, 300]).Q([460, 256], [416, 256]).L([180, 256]).Q([140, 256], [140, 296]).L([140, 404]).L([208, 404]).L([208, 332]).L([384, 332]).L([384, 464]).Z());
  g.S(h.circle(480, 344, 40)); g.DS(h.circle(480, 344, 16), 2);
  g.L(h.line([172, 404], [172, 448])); g.S(h.rrect(152, 444, 40, 16, 4));
  if (g.lvl >= 2){ g.S(h.rrect(292, 216, 36, 40, 6)); g.L(h.path([310, 216]).Q([240, 190], [180, 256]).open()); }
  g.D(h.line([150, 296], [450, 296]), 3);
});

C.define({ id:"grandfather-clock", title:"The Grandfather Clock", cat:"nostalgic-heritage",
  tags:["clocks", "heirlooms", "hallway"], talk:"Where would you put a tall clock like this?" }, function(g){
  g.S(h.path([176, 144]).L([176, 120]).Q([300, 30], [424, 120]).L([424, 144]).Z());
  if (g.lvl >= 2){ g.K(h.circle(176, 104, 14)); g.K(h.circle(424, 104, 14)); g.K(h.circle(300, 56, 14)); }
  g.S(h.rrect(188, 144, 224, 224, 12));
  clockFace(g, 300, 256, 90, 10, 10);
  g.S(h.rect(216, 368, 168, 300));
  g.S(h.path([248, 636]).L([248, 452]).Q([300, 388], [352, 452]).L([352, 636]).Z());
  g.L(h.line([300, 408], [300, 556])); g.S(h.circle(300, 580, 30));
  g.S(h.rrect(196, 668, 208, 80, 6)); g.S(h.rrect(180, 744, 240, 24, 8));
  if (g.lvl >= 3){ g.D(h.rrect(228, 684, 144, 48, 10)); g.D(h.line([200, 368], [216, 368])); }
});

C.define({ id:"schoolhouse-clock", title:"The Schoolhouse Clock", cat:"nostalgic-heritage",
  tags:["clocks", "school", "kitchen"], sensitive:["children"], talk:"What did a clock like this tick away the hours for?" }, function(g){
  g.S(h.path([208, 444]).L([392, 444]).L([372, 664]).L([228, 664]).Z());
  g.S(h.rrect(256, 488, 88, 132, 16));
  g.L(h.line([300, 488], [300, 572])); if (g.lvl >= 2) g.S(h.circle(300, 584, 20)); else g.K(h.circle(300, 584, 20));
  g.S(h.rrect(276, 664, 48, 24, 6), 2);
  g.S(h.ngon(300, 284, 190, 8, 22.5));
  if (g.lvl >= 3) g.D(h.ngon(300, 284, 164, 8, 22.5));
  clockFace(g, 300, 284, 140, 2, 50);
  g.S(h.circle(300, 80, 10));
});

C.define({ id:"pocket-watch", title:"The Pocket Watch", cat:"nostalgic-heritage",
  tags:["watches", "heirlooms", "clocks"], talk:"Who in your life was never late?" }, function(g){
  if (g.lvl >= 2){
    var P0 = [300, 170], Cc = [430, 40], P1 = [520, 190];
    var at = function(t){ return [(1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * Cc[0] + t * t * P1[0], (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * Cc[1] + t * t * P1[1]]; };
    var n = g.at(11, 0, 0);                                        // the chain's links from Tier 1 only
    for (var i = 1; i <= n; i++){ var p = at(i / (n + 1)), p2 = at(i / (n + 1) + .01), a = Math.atan2(p2[1] - p[1], p2[0] - p[0]) * 180 / Math.PI; g.S(h.ellipse(p[0], p[1], 20, 11, a + (i % 2 ? 0 : 90))); }
    if (g.lvl >= 3){ g.S(h.circle(520, 190, 12)); g.S(h.rrect(490, 200, 60, 18, 8)); }
    else g.L(h.path(P0).Q(Cc, P1).open());                           // Tier 2: the chain as one bold line
  }
  g.S(h.circle(300, 190, 30)); g.S(h.circle(300, 190, 14), 3);
  g.S(h.rrect(280, 214, 40, 36, 8));
  g.S(h.circle(300, 470, 220));
  g.D(h.circle(300, 470, 200), 3);
  clockFace(g, 300, 470, g.at(170, 176, 180), 9, 15);
  if (g.lvl >= 3) g.S(h.circle(300, 560, 34));
});

C.define({ id:"coffee-percolator", title:"The Coffee Percolator", cat:"nostalgic-heritage", era:"1950s",
  tags:["coffee", "kitchen", "mornings"], talk:"What is the best part of a slow morning?" }, function(g){
  g.S(h.path([228, 720]).L([372, 720]).L([392, 760]).L([208, 760]).Z());
  g.S(h.path([236, 250]).L([364, 250]).L([400, 720]).L([200, 720]).Z());
  g.S(h.path([390, 440]).C([470, 420], [480, 330], [520, 290]).L([540, 304]).C([500, 360], [490, 470], [396, 500]).Z());
  g.S(h.path([214, 300]).C([120, 320], [120, 600], [206, 640]).L([212, 606]).C([160, 580], [160, 360], [220, 336]).Z());
  g.S(h.rrect(216, 226, 168, 32, 10));
  g.S(h.path([256, 226]).Q([256, 170], [300, 170]).Q([344, 170], [344, 226]).Z());
  g.S(h.path([280, 170]).Q([280, 126], [300, 122]).Q([320, 126], [320, 170]).Z());
  g.D(h.line([220, 480], [380, 480])); g.D(h.line([212, 600], [388, 600]), 3);
  if (g.lvl >= 2){
    g.S(h.path([440, 640]).L([556, 640]).Q([552, 740], [498, 744]).Q([444, 740], [440, 640]).Z());
    g.S(h.path([554, 660]).C([600, 660], [600, 716], [546, 712]).L([548, 696]).C([580, 696], [580, 676], [552, 678]).Z());
    g.S(h.ellipse(498, 752, 86, 14));
  }
});

C.define({ id:"stand-mixer", title:"The Stand Mixer", cat:"nostalgic-heritage", era:"1950s",
  tags:["baking", "kitchen", "appliances"], talk:"What would you bake for a special occasion?" }, function(g){
  g.S(h.rrect(100, 700, 400, 48, 18));
  g.S(h.path([140, 700]).L([140, 330]).Q([140, 290], [180, 290]).L([230, 290]).L([230, 700]).Z());
  g.S(h.path([150, 250]).Q([150, 170], [240, 166]).L([420, 170]).Q([500, 176], [500, 250]).Q([500, 310], [440, 320]).L([220, 322]).Q([150, 318], [150, 250]).Z());
  g.D(h.path([420, 186]).Q([470, 200], [480, 250]).open(), 2);
  g.D(h.line([240, 190], [240, 314]), 3);
  g.S(h.circle(190, 250, 18), 2);
  g.L(h.line([380, 322], [380, 460]));
  g.S(h.path([380, 460]).C([340, 480], [340, 560], [380, 580]).C([420, 560], [420, 480], [380, 460]).Z(), 2);
  g.S(h.mirror([[380, 470], [480, 474], [494, 520], [470, 640], [430, 690], [380, 696]], 380));
  g.D(h.path([294, 520]).Q([380, 540], [466, 520]).open(), 3);
});

C.define({ id:"chrome-toaster", title:"The Chrome Toaster", cat:"nostalgic-heritage", era:"1950s",
  tags:["breakfast", "kitchen", "appliances"], talk:"What do you like on your toast?" }, function(g){
  var slice = function(x, lv){ g.S(h.path([x - 70, 380]).L([x - 70, 250]).Q([x - 84, 200], [x - 40, 190]).Q([x, 170], [x + 40, 190]).Q([x + 84, 200], [x + 70, 250]).L([x + 70, 380]).Z(), lv); g.D(h.path([x - 54, 370]).L([x - 54, 256]).Q([x - 64, 218], [x - 30, 208]).Q([x, 192], [x + 30, 208]).Q([x + 64, 218], [x + 54, 256]).L([x + 54, 370]).open(), 3); };
  slice(210, 1); slice(390, 2);
  g.S(h.path([90, 700]).L([90, 400]).Q([90, 330], [170, 330]).L([430, 330]).Q([510, 330], [510, 400]).L([510, 700]).Z());
  g.S(h.rrect(130, 318, 160, 30, 12)); g.S(h.rrect(310, 318, 160, 30, 12));
  if (g.is(2)) g.S(h.rrect(500, 470, 44, 30, 10)); else g.K(h.rrect(500, 466, 48, 38, 10));
  g.D(h.line([110, 520], [490, 520])); g.D(h.line([110, 560], [490, 560]), 3);
  [110, 420].forEach(function(x){ var d = h.rrect(x, 700, 70, 24, 8); if (g.is(2)) g.S(d); else g.K(d); });
  g.D(h.path([120, 420]).Q([140, 380], [180, 372]).open(), 3);
});

C.define({ id:"canning-jars", title:"Canning Jars", cat:"nostalgic-heritage", season:"fall",
  tags:["canning", "preserves", "harvest", "kitchen"], talk:"What would you put up in jars for the winter?" }, function(g){
  var jar = function(x, w, hgt, lv, fruit){
    var top = 760 - hgt;
    g.S(h.path([x - w / 2, top + 50]).Q([x - w / 2 - 10, top + 70], [x - w / 2, top + 100]).L([x - w / 2, 740]).Q([x - w / 2, 760], [x - w / 2 + 20, 760]).L([x + w / 2 - 20, 760]).Q([x + w / 2, 760], [x + w / 2, 740]).L([x + w / 2, top + 100]).Q([x + w / 2 + 10, top + 70], [x + w / 2, top + 50]).Z(), lv);
    g.S(h.rrect(x - w / 2 - 6, top, w + 12, 54, 8), lv);
    g.D(h.line([x - w / 2 - 4, top + 26], [x + w / 2 + 4, top + 26]), Math.max(lv, 2));
    if (fruit === "peach") [[-.2, .55], [.22, .72], [-.18, .88]].forEach(function(f){ g.S(h.ellipse(x + f[0] * w, top + f[1] * hgt, w * .22, w * .16, 20), lv); });
    if (fruit === "cherry") [[-.2, .5], [.2, .58], [0, .72], [-.24, .86], [.22, .88]].forEach(function(f){ g.S(h.circle(x + f[0] * w, top + f[1] * hgt, w * .12), Math.max(lv, 3)); });
    if (fruit === "bean") [-.25, -.08, .08, .25].forEach(function(f){ g.S(h.rrect(x + f * w - 9, top + 130, 18, hgt - 170, 9), Math.max(lv, 3)); });
    g.S(h.rrect(x - w * .3, top + hgt * .36, w * .6, w * .3, 10), lv);
  };
  if (g.lvl >= 3) jar(140, 150, 300, 3, "cherry");
  jar(g.at(300, 230, 300), g.at(170, 190, 250), g.at(420, 440, 520), 1, "peach");
  if (g.lvl >= 2) jar(g.at(460, 420, 0), 150, 330, 2, "bean");
  ground(g, 764, 40, 560);
});

C.define({ id:"milk-bottles", title:"The Milkman's Delivery", cat:"nostalgic-heritage", era:"1950s",
  tags:["milk", "deliveries", "doorstep", "kitchen"], talk:"What came to the door in the morning where you grew up?" }, function(g){
  var bottle = function(x, lv){
    g.S(h.mirror([[x, 250], [x + 30, 250], [x + 34, 300], [x + 70, 380], [x + 76, 660], [x + 60, 690], [x, 690]], x), lv);
    g.S(h.rrect(x - 36, 234, 72, 36, 10), lv);
    g.L(h.line([x - 73, 470], [x + 74, 470]), lv); g.L(h.line([x - 74, 560], [x + 75, 560]), lv);
    g.D(h.path([x - 50, 420]).Q([x - 56, 460], [x - 52, 480]).open(), 3);
  };
  bottle(300, 1);
  if (g.lvl >= 2){ bottle(140, 2); bottle(460, 2); }
  if (g.lvl >= 2){
    g.S(h.path([40, 560]).L([560, 560]).L([560, 740]).L([40, 740]).Z());
    [170, 300, 430].forEach(function(x){ g.D(h.line([x, 560], [x, 740])); });
    g.D(h.line([40, 650], [560, 650]), 3);
    g.S(h.rrect(28, 540, 544, 30, 10));
  } else ground(g, 700, 150, 450);
});

C.define({ id:"oil-lamp", title:"The Oil Lamp", cat:"nostalgic-heritage",
  tags:["lamps", "evenings", "farmhouse"], talk:"What makes a room feel cozy in the evening?" }, function(g){
  g.S(h.mirror([[300, 560], [420, 566], [460, 640], [430, 720], [380, 744], [300, 746]], 300));
  g.S(h.rrect(170, 740, 260, 28, 12));
  g.S(h.path([180, 620]).C([90, 610], [90, 700], [176, 700]).L([184, 680]).C([130, 676], [130, 636], [186, 640]).Z(), 2);
  g.S(h.rrect(230, 500, 140, 64, 14));
  g.S(h.mirror([[300, 140], [330, 140], [336, 250], [380, 360], [360, 470], [330, 500], [300, 500]], 300));
  g.S(h.path([290, 480]).Q([270, 430], [300, 380]).Q([330, 430], [310, 480]).Z());
  g.D(h.path([260, 360]).Q([254, 410], [264, 450]).open(), 3);
  g.D(h.path([196, 650]).Q([300, 680], [404, 650]).open(), 3);
});

C.define({ id:"typewriter", title:"The Typewriter", cat:"nostalgic-heritage", era:"1940s",
  tags:["typing", "office", "letters", "writing"], talk:"What would you like to put in a letter to someone?" }, function(g){
  g.S(h.path([230, 180]).L([370, 180]).L([380, 330]).L([220, 330]).Z());
  if (g.lvl >= 3) [215, 245, 275].forEach(function(y){ g.D(h.line([242, y], [358, y])); });
  g.S(h.rrect(96, 316, 408, 48, 20));
  [84, 516].forEach(function(x){ if (g.is(2)) g.S(h.circle(x, 340, 26)); else g.K(h.circle(x, 340, 26)); });
  g.S(h.path([116, 360]).L([484, 360]).L([540, 620]).L([60, 620]).Z());
  g.S(h.rrect(40, 610, 520, 60, 18));
  if (g.lvl >= 2){
    var rows = g.at([[440, 8], [490, 9], [540, 8]], [[450, 6], [520, 6]], []);
    rows.forEach(function(r, i){ for (var k = 0; k < r[1]; k++){ var x = 300 + (k - (r[1] - 1) / 2) * g.at(52, 64, 0); g.S(h.circle(x, r[0], g.at(16, 20, 0))); } });
    g.S(h.rrect(200, 580, 200, 22, 10));
  } else g.S(h.rrect(170, 500, 260, 60, 20));
  g.S(h.path([504, 330]).L([570, 300]).L([580, 316]).L([520, 350]).Z(), 2);
});

C.define({ id:"box-camera", title:"The Family Camera", cat:"nostalgic-heritage", era:"1950s",
  tags:["cameras", "photographs", "memories"], talk:"If you could take a picture of anything today, what would it be?" }, function(g){
  g.L(h.path([150, 300]).C([150, 120], [450, 120], [450, 300]).open(), 2);
  g.S(h.rrect(110, 290, 380, 300, 24));
  g.S(h.rrect(150, 250, 110, 50, 10));
  g.S(h.rrect(370, 256, 60, 44, 10));
  g.S(h.circle(300, 450, 110));
  g.S(h.circle(300, 450, 72));
  g.S(h.circle(300, 450, g.at(34, 38, 40)), 2);
  g.S(h.rrect(140, 320, 70, 44, 8), 2);
  g.D(h.line([110, 560], [490, 560]), 3);
  if (g.lvl >= 3) g.D(h.path([266, 416]).Q([276, 400], [296, 396]).open());
});

C.define({ id:"phonograph", title:"The Phonograph", cat:"nostalgic-heritage", era:"1920s",
  tags:["music", "records", "dancing"], talk:"What song makes you want to tap your feet?" }, function(g){
  g.S(h.path([260, 480]).C([300, 380], [360, 300], [470, 150]).L([560, 250]).C([440, 330], [370, 400], [300, 500]).Z());     // horn
  g.S(h.ellipse(515, 200, 72, 36, 42));
  if (g.lvl >= 2) g.D(h.ellipse(515, 200, 44, 20, 42), 3);
  if (g.lvl >= 2) [[.35, 1], [.6, 1]].forEach(function(t){ var a = h.lerp([260, 480], [470, 150], t[0]), b = h.lerp([300, 500], [560, 250], t[0]); g.D(h.path(a).Q(h.lerp(a, b, .5).map(function(v, i){ return v + (i ? 12 : -8); }), b).open(), 3); });
  g.S(h.ellipse(250, 520, 170, 38));
  g.D(h.ellipse(250, 520, 110, 24), 2); g.S(h.ellipse(250, 520, 24, 6), 3);
  g.S(h.path([80, 530]).L([420, 530]).L([420, 720]).L([80, 720]).Z());
  g.S(h.path([420, 530]).L([500, 490]).L([500, 670]).L([420, 720]).Z());
  g.D(h.rrect(130, 580, 240, 100, 12), 2);
  g.S(h.path([500, 560]).L([560, 540]).L([568, 556]).L([500, 584]).Z(), 2);
  g.S(h.circle(572, 548, 16), 2);
});

C.define({ id:"rural-mailbox", title:"The Country Mailbox", cat:"nostalgic-heritage",
  tags:["mail", "letters", "country-roads"], talk:"What is the nicest thing that could arrive in the mail?" }, function(g){
  if (g.lvl >= 2){ [[150, 700], [460, 710]].forEach(function(f){ g.L(h.line([f[0], 770], [f[0] + 10, f[1] - 60])); g.S(h.scallop(f[0] + 10, f[1] - 90, 40, 6, .3)); g.S(h.circle(f[0] + 10, f[1] - 90, 14)); }); }
  g.S(h.rect(276, 440, 48, 330));
  g.S(h.rect(200, 420, 200, 26));
  g.S(h.path([90, 420]).L([90, 260]).Q([90, 150], [260, 150]).L([500, 150]).L([500, 420]).Z());
  g.S(h.path([500, 420]).L([500, 150]).Q([560, 150], [560, 260]).L([560, 420]).Z());
  g.D(h.path([108, 260]).Q([112, 176], [240, 172]).open(), 3);
  g.S(h.rect(40, 210, 20, 150)); g.S(h.poly([[60, 210], [150, 210], [150, 270], [60, 270]]));
  g.S(h.circle(530, 290, 12), 2);
  if (g.lvl >= 3){ g.S(h.path([500, 190]).L([590, 176]).L([594, 236]).L([504, 250]).Z()); }
  ground(g, 770, 60, 540);
});

C.define({ id:"lighthouse", title:"The Lighthouse", cat:"nostalgic-heritage", fit:"page",
  tags:["lighthouses", "coast", "landmarks"], sensitive:["water"], talk:"What is the most beautiful place you have seen by the sea or a lake?" }, function(g){
  kit.frame(g);
  if (g.lvl >= 3) g.S(h.smooth([[80, 180], [96, 150], [132, 146], [150, 126], [190, 126], [210, 148], [236, 150], [244, 176], [230, 194]]));
  g.S(h.path([24, 560]).L([576, 560]).L([576, 776]).L([24, 776]).Z());
  if (g.lvl >= 2){ g.D(h.wave(40, 240, 640, 8, 3)); g.D(h.wave(330, 560, 700, 8, 3)); }
  g.S(h.path([24, 560]).C([120, 520], [260, 500], [400, 540]).C([470, 560], [520, 600], [540, 776]).L([24, 776]).Z());
  if (g.lvl >= 2){ g.S(h.path([390, 540]).L([390, 460]).L([540, 460]).L([540, 580]).Z(), 2); g.S(h.poly([[376, 464], [465, 400], [554, 464]]), 2); g.S(h.rect(440, 500, 40, 60), 3); }
  g.S(h.path([230, 560]).L([262, 230]).L([338, 230]).L([370, 560]).Z());
  var bands = g.at([[290, 350], [410, 470]], [[330, 420]], [[330, 420]]);
  bands.forEach(function(b){ var w0 = 38 + (b[0] - 230) * .097, w1 = 38 + (b[1] - 230) * .097; g.L(h.line([300 - w0, b[0]], [300 + w0, b[0]])); g.L(h.line([300 - w1, b[1]], [300 + w1, b[1]])); });
  g.S(h.rrect(236, 210, 128, 24, 6));
  g.S(h.rect(262, 140, 76, 70));
  if (g.lvl >= 2) g.L(h.line([300, 140], [300, 210]), 2);
  if (g.is(2)){ g.S(h.poly([[250, 142], [300, 96], [350, 142]])); g.S(h.circle(300, 90, 10)); }
  else { g.K(h.poly([[250, 142], [300, 96], [350, 142]])); g.K(h.circle(300, 90, 10)); }
  if (g.lvl >= 2) g.S(h.rrect(284, 480, 32, 80, 14));
});

C.define({ id:"red-barn", title:"The Red Barn", cat:"nostalgic-heritage", fit:"page",
  tags:["barns", "farms", "country"], sensitive:["home"], talk:"What animals or crops would a barn like this hold?" }, function(g){
  kit.scene(g, { horizon:560, trees:g.lvl >= 3 ? [[70, 70]] : null, sunX:130, sunY:140 });
  if (g.lvl >= 2){ g.S(h.path([440, 600]).L([440, 250]).Q([490, 200], [540, 250]).L([540, 600]).Z()); g.S(h.path([440, 256]).Q([490, 190], [540, 256]).Q([490, 226], [440, 256]).Z(), 3); [330, 410, 490].forEach(function(y){ g.D(h.line([440, y], [540, y])); }); }
  g.S(h.path([90, 640]).L([90, 380]).L([140, 290]).L([260, 240]).L([380, 290]).L([430, 380]).L([430, 640]).Z());
  g.D(h.poly([[90, 380], [140, 290], [260, 240], [380, 290], [430, 380]], true));
  g.S(h.rect(196, 480, 128, 160));
  g.L(h.line([260, 480], [260, 640]));
  g.L(h.line([196, 480], [260, 640])); g.L(h.line([324, 480], [260, 640]));
  g.S(h.rect(222, 320, 76, 72));
  if (g.lvl >= 2) g.D(h.line([222, 320], [298, 392]));
  if (g.lvl >= 3){ g.S(h.rect(116, 440, 50, 50)); g.S(h.rect(354, 440, 50, 50)); }
  if (g.lvl >= 3){
    [40, 100, 460, 520].forEach(function(x){ g.S(h.rect(x, 640, 16, 90)); });
    [670, 704].forEach(function(y){ g.L(h.line([24, y], [132, y])); g.L(h.line([444, y], [576, y])); });
  }
});

C.define({ id:"farm-windmill", title:"The Farm Windmill", cat:"nostalgic-heritage", fit:"page",
  tags:["windmills", "farms", "wind", "country"], talk:"What sounds would you hear on a windy day in the country?" }, function(g){
  kit.scene(g, { horizon:600, sunX:470, sunY:140, cloud:true });
  g.L(h.line([236, 720], [290, 300])); g.L(h.line([364, 720], [310, 300]));
  if (g.lvl >= 2) [380, 460, 540, 620].forEach(function(y, i){ var f = (y - 300) / 420; g.D(h.line([290 - f * 54, y], [310 + f * 54, y])); });
  if (g.lvl >= 3) [[380, 460], [460, 540], [540, 620], [620, 700]].forEach(function(p){ var f0 = (p[0] - 300) / 420, f1 = (p[1] - 300) / 420; g.D(h.line([290 - f0 * 54, p[0]], [310 + f1 * 54, p[1]])); });
  var n = g.at(16, 12, 6), ai = g.at(4, 4, 7), ao = g.at(8, 8, 14);      // fewer, broader vanes at Tier 3
  for (var i = 0; i < n; i++){ var a = i * 360 / n + g.at(0, 0, 30); g.S(h.poly([h.onCircle(300, 250, 34, a - ai), h.onCircle(300, 250, 150, a - ao), h.onCircle(300, 250, 150, a + ao), h.onCircle(300, 250, 34, a + ai)])); }   // Tier 3: no vane along the tail
  g.S(h.circle(300, 250, 34));
  g.S(h.path([330, 240]).L([470, 230]).L([520, 180]).L([530, 320]).L([470, 270]).L([330, 262]).Z());
  if (g.lvl >= 2){ g.S(h.rect(410, 640, 140, 90)); g.S(h.ellipse(480, 640, 70, 14)); }
});

C.define({ id:"covered-bridge", title:"The Covered Bridge", cat:"nostalgic-heritage", fit:"page",
  tags:["bridges", "country-roads", "rivers", "landmarks"], sensitive:["water"], talk:"Where does this road over the bridge lead?" }, function(g){
  kit.frame(g);
  if (g.lvl >= 2) g.S(h.circle(470, 130, 48));
  if (g.lvl >= 3) g.S(h.path([24, 420]).C([140, 340], [260, 360], [330, 400]).C([420, 350], [520, 350], [576, 400]).L([576, 776]).L([24, 776]).Z());
  g.S(h.path([24, 470]).C([160, 450], [440, 460], [576, 450]).L([576, 776]).L([24, 776]).Z());
  g.S(h.path([24, 600]).C([200, 580], [400, 620], [576, 600]).L([576, 776]).L([24, 776]).Z());
  if (g.lvl >= 2){ g.D(h.wave(60, 260, 660, 7, 3)); g.D(h.wave(320, 540, 710, 7, 3)); }
  g.S(h.path([60, 600]).L([80, 560]).L([520, 560]).L([540, 600]).Z());
  g.S(h.rect(100, 360, 400, 200));
  g.S(h.poly([[70, 370], [140, 280], [460, 280], [530, 370]]));
  g.S(h.path([180, 560]).L([180, 440]).Q([180, 400], [220, 400]).L([380, 400]).Q([420, 400], [420, 440]).L([420, 560]).Z());
  if (g.lvl >= 2) [140, 460].forEach(function(x){ g.S(h.rect(x - 16, 420, 32, 40)); });
  if (g.lvl >= 3) [120, 150, 450, 480].forEach(function(x){ g.D(h.line([x, 370], [x, 410])); });
});

C.define({ id:"rocking-chair", title:"The Rocking Chair", cat:"nostalgic-heritage",
  tags:["porches", "furniture", "resting"], talk:"Where is the most comfortable chair you have ever sat in?" }, function(g){
  g.S(h.path([184, 524]).L([140, 224]).L([168, 220]).L([212, 524]).Z());
  g.S(h.path([416, 524]).L([420, 224]).L([448, 226]).L([444, 524]).Z(), 2);
  g.S(h.rrect(120, 192, 80, 32, 12));
  if (g.lvl >= 2){ [0, 1, 2].forEach(function(k){ g.S(h.path([176 + k * 6, 260 + k * 80]).L([424 + k * 1, 260 + k * 80]).L([424, 282 + k * 80]).L([180 + k * 6, 282 + k * 80]).Z()); }); }
  if (g.lvl >= 1 && g.lvl < 2) g.S(h.path([168, 240]).L([430, 240]).L([430, 500]).L([200, 500]).Z());
  g.S(h.rect(188, 552, 24, 160)); g.S(h.rect(408, 552, 24, 168));
  g.S(h.path([172, 524]).L([444, 524]).L([452, 556]).L([164, 556]).Z());
  if (g.lvl >= 2) g.S(h.rrect(196, 496, 224, 32, 14));
  var arm = h.path([412, 428]).L([460, 440]).Q([480, 446], [476, 464]).L([470, 470]).L([410, 456]).Z(), post = h.rect(430, 452, 20, 90);
  if (g.is(2)){ g.S(arm); g.S(post); } else { g.K(arm); g.K(post); }
  g.S(h.path([72, 700]).Q([300, 772], [528, 692]).L([532, 712]).Q([300, 796], [68, 720]).Z());
});

C.define({ id:"wood-cookstove", title:"The Wood Cookstove", cat:"nostalgic-heritage", era:"1920s",
  tags:["kitchen", "cooking", "farmhouse", "warmth"], talk:"What was cooking on the stove on a cold day?" }, function(g){
  g.S(h.rect(400, 60, 44, 260));
  if (g.lvl >= 2) g.D(h.line([400, 180], [444, 180]));
  g.S(h.path([60, 320]).L([540, 320]).L([540, 360]).L([60, 360]).Z());
  g.S(h.rect(80, 360, 440, 300));
  g.S(h.rrect(110, 400, 180, 150, 10)); g.S(h.rrect(320, 400, 170, 150, 10));
  g.K(h.rrect(190, 460, 20, 30, 6)); g.K(h.rrect(395, 460, 20, 30, 6));
  if (g.lvl >= 2){ g.S(h.rect(110, 580, 380, 50)); g.D(h.line([300, 580], [300, 630])); }
  [92, 478].forEach(function(x){ if (g.is(2)) g.S(h.rect(x, 660, 30, 60)); else g.K(h.rect(x, 660, 30, 60)); });
  g.S(h.ellipse(200, 320, 70, 10), 2);
  g.S(h.mirror([[200, 190], [250, 200], [280, 250], [270, 300], [250, 314], [200, 316]], 200));
  g.S(h.path([270, 260]).C([320, 250], [330, 220], [350, 200]).L([360, 212]).C([340, 240], [330, 280], [274, 290]).Z());
  g.S(h.path([146, 214]).Q([200, 60], [254, 214]).L([242, 214]).Q([200, 84], [158, 214]).Z(), 2);
  if (g.lvl >= 3) g.S(h.ellipse(200, 196, 40, 8));
  g.K(h.circle(200, 184, 9));
});

C.define({ id:"butter-churn", title:"The Butter Churn", cat:"nostalgic-heritage", era:"1920s",
  tags:["farm", "kitchen", "dairy", "handwork"], talk:"What tastes best with fresh butter?" }, function(g){
  g.S(h.rrect(290, 60, 20, 240, 8));
  g.K(h.circle(300, 60, 18));
  g.S(h.mirror([[300, 300], [370, 302], [410, 480], [420, 700], [400, 760], [300, 764]], 300));
  g.S(h.ellipse(300, 300, 70, 16));
  g.L(h.path([222, 400]).Q([300, 420], [378, 400]).open());
  g.L(h.path([202, 620]).Q([300, 646], [398, 620]).open());
  if (g.lvl >= 2) [250, 300, 350].forEach(function(x){ g.D(h.line([x + (x - 300) * .1, 316], [x + (x - 300) * .3, 756])); });
  if (g.lvl >= 2){ g.S(h.path([470, 700]).L([470, 620]).Q([470, 590], [500, 590]).L([540, 590]).Q([570, 590], [570, 620]).L([570, 700]).Z()); g.S(h.ellipse(520, 700, 60, 12)); }
});

C.define({ id:"porch-swing", title:"The Porch Swing", cat:"nostalgic-heritage",
  tags:["porches", "summer-evenings", "resting"], sensitive:["home"], talk:"Who would you like to sit beside on a porch swing?" }, function(g){
  g.S(h.rect(32, 72, 536, 36));
  g.L(h.line([116, 108], [100, 428])); g.L(h.line([484, 108], [500, 428]));
  g.S(h.rrect(88, 400, 424, 124, 12));
  if (g.lvl >= 2) for (var x = 148; x < 500; x += 60) g.D(h.line([x, 412], [x, 512]), g.lvl >= 3 ? 2 : 2);
  if (g.lvl >= 2) g.S(h.rrect(160, 456, 100, 72, 24));
  g.S(h.path([76, 524]).L([524, 524]).L([544, 580]).L([56, 580]).Z());
  [56, 516].forEach(function(x){ if (g.is(2)) g.S(h.rrect(x, 472, 28, 80, 8)); else g.K(h.rrect(x, 472, 28, 80, 8)); });
});
})(globalThis.CogniCore);

/* ---------- designs/patterns.js ---------- */
/* CogniCore designs: Bold & Easy Patterns. Traditional quilt blocks and
   calm radial patterns: structured shapes with clear, closed edges (the
   kind of coloring that lowered anxiety in the mandala and plaid studies,
   docs/cognicore-coloring-standards.md). Tiers change how many blocks or
   rings there are, so Tier 3 always has a few large pieces. */
(function(C){
"use strict";
var h = C.helpers;

/* ---------- quilt blocks: pieces in a unit square, [x, y] in 0..1 ---------- */
function hst(x, y, s, dir){   // a half-square triangle unit split along one diagonal
  var a = [x, y], b = [x + s, y], c = [x + s, y + s], d = [x, y + s];
  return dir ? [[a, b, d], [b, c, d]] : [[a, b, c], [a, c, d]];
}
function qst(x, y, s){         // a quarter-square triangle unit (hourglass)
  var a = [x, y], b = [x + s, y], c = [x + s, y + s], d = [x, y + s], m = [x + s / 2, y + s / 2];
  return [[a, b, m], [b, c, m], [c, d, m], [d, a, m]];
}
function sq(x, y, w, hh){ return [[[x, y], [x + w, y], [x + w, y + (hh || w)], [x, y + (hh || w)]]]; }
var T = 1 / 3, Q = 1 / 4;
var BLOCKS = {
  "ohio-star": function(){ return [].concat(sq(0, 0, T), sq(2 * T, 0, T), sq(0, 2 * T, T), sq(2 * T, 2 * T, T), sq(T, T, T), qst(T, 0, T), qst(0, T, T), qst(2 * T, T, T), qst(T, 2 * T, T)); },
  "friendship-star": function(){ return [].concat(sq(0, 0, T), sq(2 * T, 0, T), sq(0, 2 * T, T), sq(2 * T, 2 * T, T), sq(T, T, T), hst(T, 0, T, 0), hst(2 * T, T, T, 1), hst(T, 2 * T, T, 0), hst(0, T, T, 1)); },
  "churn-dash": function(){ return [].concat(hst(0, 0, T, 1), hst(2 * T, 0, T, 0), hst(0, 2 * T, T, 0), hst(2 * T, 2 * T, T, 1), sq(T, T, T),
    sq(T, 0, T, T / 2), sq(T, T / 2, T, T / 2), sq(T, 2 * T, T, T / 2), sq(T, 2.5 * T, T, T / 2), sq(0, T, T / 2, T), sq(T / 2, T, T / 2, T), sq(2 * T, T, T / 2, T), sq(2.5 * T, T, T / 2, T)); },
  "pinwheel": function(){ return [].concat(hst(0, 0, .5, 0), hst(.5, 0, .5, 1), hst(0, .5, .5, 1), hst(.5, .5, .5, 0)); },
  "nine-patch": function(){ var p = []; for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) p = p.concat(sq(i * T, j * T, T)); return p; },
  "sawtooth-star": function(){
    var p = [].concat(sq(0, 0, Q), sq(3 * Q, 0, Q), sq(0, 3 * Q, Q), sq(3 * Q, 3 * Q, Q), sq(Q, Q, 2 * Q));
    var goose = function(a, b, c, d){ var m = h.lerp(a, b, .5); return [[d, c, m], [a, m, d], [m, b, c]]; };
    p.push.apply(p, goose([Q, 0], [3 * Q, 0], [3 * Q, Q], [Q, Q]).map(function(t){ return t; }));
    p.push.apply(p, [[[3 * Q, Q], [1, Q], [1, 3 * Q]].map(function(v){ return v; })].concat([[[3 * Q, Q], [1, 2 * Q], [3 * Q, 3 * Q]], [[1, 2 * Q], [1, 3 * Q], [3 * Q, 3 * Q]], [[1, Q], [1, 2 * Q], [3 * Q, Q]]]).slice(1));
    p.push([[3 * Q, Q], [1, Q], [1, 2 * Q]]);
    p.push.apply(p, [[[Q, 1], [3 * Q, 1], [2 * Q, 3 * Q]], [[Q, 3 * Q], [2 * Q, 3 * Q], [Q, 1]], [[2 * Q, 3 * Q], [3 * Q, 3 * Q], [3 * Q, 1]]]);
    p.push.apply(p, [[[0, Q], [0, 3 * Q], [Q, 2 * Q]], [[0, Q], [Q, Q], [Q, 2 * Q]], [[0, 3 * Q], [Q, 3 * Q], [Q, 2 * Q]]]);
    return p;
  },
  "log-cabin": function(){
    var p = sq(.4, .4, .2), x0 = .4, y0 = .4, x1 = .6, y1 = .6, w = .1;
    for (var r = 0; r < 4; r++){
      p.push([[x1, y0], [x1 + w, y0], [x1 + w, y1], [x1, y1]]); x1 += w;
      p.push([[x0, y1], [x1, y1], [x1, y1 + w], [x0, y1 + w]]); y1 += w;
      p.push([[x0 - w, y0], [x0, y0], [x0, y1], [x0 - w, y1]]); x0 -= w;
      p.push([[x0, y0 - w], [x1, y0 - w], [x1, y0], [x0, y0]]); y0 -= w;
    }
    return p;
  },
  "flying-geese": function(){
    var p = [];
    for (var i = 0; i < 4; i++){ var y = i * Q; p.push([[0, y + Q], [.5, y], [1, y + Q]], [[0, y], [.5, y], [0, y + Q]], [[.5, y], [1, y], [1, y + Q]]); }
    return p;
  },
  "rail-fence": function(){
    var p = [];
    [[0, 0, 0], [.5, 0, 1], [0, .5, 1], [.5, .5, 0]].forEach(function(b){ for (var k = 0; k < 3; k++){ var o = k / 6; p.push(b[2] ? [[b[0] + o, b[1]], [b[0] + o + 1 / 6, b[1]], [b[0] + o + 1 / 6, b[1] + .5], [b[0] + o, b[1] + .5]] : [[b[0], b[1] + o], [b[0] + .5, b[1] + o], [b[0] + .5, b[1] + o + 1 / 6], [b[0], b[1] + o + 1 / 6]]); } });
    return p;
  }
};
/* Draw one block at x, y, size s (a square). */
function block(g, name, x, y, s){
  BLOCKS[name]().forEach(function(poly){ g.S(h.poly(poly.map(function(p){ return [x + p[0] * s, y + p[1] * s]; }))); });
}
/* The page layout for a quilt: a border and, by tier, 6, 4 or 1 blocks. */
function quilt(name, meta){
  meta.cat = "bold-easy-patterns"; meta.fit = "page";
  meta.tags = ["quilts", "quilting", "patchwork", "handmade"].concat(meta.tags || []);
  C.define(meta, function(g){
    g.S(h.rect(24, 24, 552, 752));
    var lay = g.at({ cols:2, rows:3, s:236 }, { cols:2, rows:2, s:250 }, { cols:1, rows:1, s:500 });
    var gapX = (552 - lay.cols * lay.s) / (lay.cols + 1), gapY = (752 - lay.rows * lay.s) / (lay.rows + 1);
    if (g.lvl >= 2) g.D(h.rect(24 + gapX / 2, 24 + gapY / 2, 552 - gapX, 752 - gapY), 3);
    for (var r = 0; r < lay.rows; r++) for (var c = 0; c < lay.cols; c++) block(g, name, 24 + gapX + c * (lay.s + gapX), 24 + gapY + r * (lay.s + gapY), lay.s);
  });
}
quilt("ohio-star", { id:"quilt-ohio-star", title:"Ohio Star Quilt", tags:["stars"], talk:"Who in your family made quilts, or slept under one you remember fondly?" });
quilt("sawtooth-star", { id:"quilt-sawtooth-star", title:"Sawtooth Star Quilt", tags:["stars"], talk:"What would you name a quilt pattern of your own?" });
quilt("pinwheel", { id:"quilt-pinwheel", title:"Pinwheel Quilt", tags:["pinwheels"], talk:"What colors would you choose for a quilt on your bed?" });
quilt("nine-patch", { id:"quilt-nine-patch", title:"Nine Patch Quilt", tags:["squares"], talk:"What fabric would you save for a patchwork quilt?" });
quilt("churn-dash", { id:"quilt-churn-dash", title:"Churn Dash Quilt", tags:["farm"], talk:"What handmade things have been passed down in a family you know?" });
quilt("friendship-star", { id:"quilt-friendship-star", title:"Friendship Star Quilt", tags:["stars", "friendship"], talk:"Who is a friend you would make a quilt for?" });
quilt("log-cabin", { id:"quilt-log-cabin", title:"Log Cabin Quilt", tags:["log-cabin"], talk:"What would make a cabin in the woods feel like home?" });
quilt("flying-geese", { id:"quilt-flying-geese", title:"Flying Geese Quilt", tags:["geese", "autumn"], talk:"Where do you think the geese are flying to?" });
quilt("rail-fence", { id:"quilt-rail-fence", title:"Rail Fence Quilt", tags:["fences", "stripes"], talk:"What is your favorite kind of fabric to touch?" });

C.define({ id:"quilt-grandmothers-garden", title:"Grandmother's Flower Garden", cat:"bold-easy-patterns", fit:"page",
  tags:["quilts", "quilting", "hexagons", "flowers"], talk:"What flowers would you plant in a garden of your own?" }, function(g){
  g.S(h.rect(24, 24, 552, 752));
  var r = g.at(42, 52, 88), dx = r * Math.sqrt(3), rings = g.at(2, 2, 1);
  var centers = g.at([[300, 214], [300, 586]], [[300, 400]], [[300, 400]]);
  centers.forEach(function(c){
    var cells = [];
    for (var q = -rings; q <= rings; q++) for (var rr = -rings; rr <= rings; rr++) if (Math.max(Math.abs(q), Math.abs(rr), Math.abs(q + rr)) <= rings) cells.push([q, rr]);
    cells.forEach(function(ax){ var x = c[0] + dx * (ax[0] + ax[1] / 2), y = c[1] + r * 1.5 * ax[1]; g.S(h.ngon(x, y, r, 6, 30)); });
  });
});

C.define({ id:"quilt-dresden-plate", title:"Dresden Plate", cat:"bold-easy-patterns", fit:"page",
  tags:["quilts", "quilting", "plates", "circles"], talk:"What would you serve on your best plates?" }, function(g){
  g.S(h.rect(24, 24, 552, 752));
  var n = g.at(20, 16, 10), R = 250, cx = 300, cy = 400;
  if (g.lvl >= 2) g.D(h.rect(60, 100, 480, 600), 3);
  for (var i = 0; i < n; i++){ var a0 = i * 360 / n - 90, a1 = a0 + 360 / n, am = (a0 + a1) / 2; g.S(h.path(h.onCircle(cx, cy, 80, a0)).L(h.onCircle(cx, cy, R * .9, a0)).Q(h.onCircle(cx, cy, R * 1.04, am), h.onCircle(cx, cy, R * .9, a1)).L(h.onCircle(cx, cy, 80, a1)).Z()); }
  g.S(h.circle(cx, cy, 80));
  if (g.lvl >= 2) g.D(h.circle(cx, cy, 44), 3);
});

/* ---------- radial and geometric patterns ---------- */
function frame(g){ g.S(h.rect(24, 24, 552, 752)); }

C.define({ id:"garden-rosette", title:"The Garden Rosette", cat:"bold-easy-patterns", fit:"page",
  tags:["mandalas", "rosettes", "flowers", "circles"], talk:"What colors feel calm and peaceful to you?" }, function(g){
  frame(g);
  var cx = 300, cy = 400;
  var rings = g.at([[250, 16, "round"], [196, 12, "pointed"], [140, 10, "round"], [88, 8, "oval"]], [[250, 12, "round"], [180, 10, "pointed"], [110, 8, "round"]], [[250, 8, "round"], [150, 6, "round"]]);
  g.S(h.circle(cx, cy, 262));
  rings.forEach(function(rg, i){ for (var k = 0; k < rg[1]; k++) g.S(h.petal(cx, cy, k * 360 / rg[1] + (i % 2 ? 180 / rg[1] : 0) - 90, rg[0] * .3, rg[0], 2 * Math.PI * rg[0] / rg[1] * .62, rg[2])); });
  g.S(h.circle(cx, cy, g.at(40, 50, 60)));
  if (g.lvl >= 2) [[80, 100], [520, 100], [80, 700], [520, 700]].forEach(function(p){ g.S(h.scallop(p[0], p[1], g.at(40, 48, 0), 6, .3)); });
});

C.define({ id:"compass-rose", title:"The Compass Rose", cat:"bold-easy-patterns", fit:"page",
  tags:["compass", "stars", "travel", "maps"], talk:"Which direction would you travel if you could go anywhere?" }, function(g){
  frame(g);
  var cx = 300, cy = 400;
  g.S(h.circle(cx, cy, 250));
  if (g.lvl >= 2) g.S(h.circle(cx, cy, 214));
  var pts = function(n, r1, r2, rot){ for (var i = 0; i < n; i++){ var a = rot + i * 360 / n;
    if (g.is(2)){ g.S(h.poly([[cx, cy], h.onCircle(cx, cy, r2, a - 180 / n), h.onCircle(cx, cy, r1, a)])); g.S(h.poly([[cx, cy], h.onCircle(cx, cy, r1, a), h.onCircle(cx, cy, r2, a + 180 / n)])); }
    else g.S(h.poly([[cx, cy], h.onCircle(cx, cy, r2, a - 180 / n), h.onCircle(cx, cy, r1, a), h.onCircle(cx, cy, r2, a + 180 / n)]));   // Tier 3: whole points, not halves
  } };
  if (g.lvl >= 3) pts(8, 180, 110, -67.5);
  pts(4, g.at(200, 210, 230), g.at(60, 70, 80), -45);
  pts(4, g.at(240, 246, 250), g.at(60, 70, 80), -90);
  g.S(h.circle(cx, cy, g.at(26, 30, 34)));
});

C.define({ id:"sunburst-medallion", title:"The Sunburst", cat:"bold-easy-patterns", fit:"page", season:"summer",
  tags:["sun", "rays", "circles", "summer"], talk:"What is your favorite thing to do on a sunny day?" }, function(g){
  frame(g);
  var cx = 300, cy = 400, n = g.at(24, 16, 10);
  for (var i = 0; i < n; i++){                                           // Tier 3: ten rays, all long
    var a = i * 360 / n - 90, long = i % 2 === 0 || !g.is(2);
    g.S(h.poly([h.onCircle(cx, cy, 120, a - 180 / n), h.onCircle(cx, cy, long ? 270 : 210, a), h.onCircle(cx, cy, 120, a + 180 / n)]));
  }
  g.S(h.circle(cx, cy, 124));
  if (g.lvl >= 2) g.S(h.circle(cx, cy, 84));
  if (g.lvl >= 3) for (var k = 0; k < 12; k++) g.D(h.line(h.onCircle(cx, cy, 84, k * 30), h.onCircle(cx, cy, 124, k * 30)));
});

C.define({ id:"lotus-medallion", title:"The Lotus Medallion", cat:"bold-easy-patterns", fit:"page",
  tags:["lotus", "mandalas", "calm", "flowers"], talk:"Where do you feel most at peace?" }, function(g){
  frame(g);
  var cx = 300, cy = 400;
  var layers = g.at([[260, 12], [200, 12], [140, 8], [90, 8]], [[260, 10], [180, 8], [110, 6]], [[250, 8], [150, 6]]);
  layers.forEach(function(L, i){ for (var k = 0; k < L[1]; k++) g.S(h.petal(cx, cy, k * 360 / L[1] - 90 + (i % 2 ? 180 / L[1] : 0), 0, L[0], 2 * Math.PI * L[0] / L[1] * .72, "pointed")); });
  g.S(h.circle(cx, cy, g.at(44, 54, 64)));
  if (g.lvl >= 2) g.D(h.circle(cx, cy, g.at(24, 30, 0)), 2);
});

C.define({ id:"snowflake-medallion", title:"The Snowflake", cat:"bold-easy-patterns", fit:"page", season:"winter",
  tags:["snowflakes", "winter", "crystals"], talk:"What do you enjoy about a snowy day indoors?" }, function(g){
  frame(g);
  var cx = 300, cy = 400;
  for (var i = 0; i < 6; i++){
    var a = i * 60 - 90;
    g.group({ x:cx, y:cy, rot:a + 90 }, function(g){
      var aw = g.at(18, 21, 23), bw = g.at(1, 1.3, 1.45);                // broader arms and branches at Tiers 2 and 3
      g.S(h.poly([[-aw, 0], [-aw, -200], [0, -250], [aw, -200], [aw, 0]]));
      [-1, 1].forEach(function(s){ g.S(h.poly([[0, -150], [80 * s, -220], [(80 + 16 * bw) * s, -220 + 20 * bw], [14 * bw * s, -150 + 22 * bw]])); });
      if (g.lvl >= 3){ g.S(h.poly([[0, -100], [-40, -136], [-52, -122], [-12, -86]])); g.S(h.poly([[0, -100], [40, -136], [52, -122], [12, -86]])); }   // inner branches: Tier 1
      if (g.lvl >= 3) g.S(h.poly([[0, -250], [-20, -270], [0, -290], [20, -270]]));
    });
  }
  g.S(h.ngon(cx, cy, 64, 6, -90));
  if (g.lvl >= 2) g.D(h.ngon(cx, cy, 34, 6, -90));
});

/* Overlapping fans (seigaiha), each row half a radius below the last. The
   page width holds a whole number of fans, the bottom row sits on the frame
   and the top row stays whole under a band of sky, so the page edges never
   cut a fan into slivers. Each fan is drawn as an arch with straight sides
   so the next rows cover its lower half cleanly. */
C.define({ id:"art-deco-fans", title:"Art Deco Fans", cat:"bold-easy-patterns", fit:"page", era:"1930s",
  tags:["art-deco", "fans", "geometric"], talk:"What was the most elegant place you ever went to dance or dine?" }, function(g){
  frame(g);
  var R = 276 / g.at(2, 1.5, 1), rings = g.at(2, 1, 1), rays = g.at(3, 1, 0);
  var n = Math.floor((752 - 36 - R) * 2 / R);                          // rows below the top one
  var arch = function(x, y, r){ return h.clipped([[x - r, y + R * .75]].concat(h.arcPts(x, y, r, 180, 360, 36), [[x + r, y + R * .75]]), 24, 24, 576, 776, 0); };
  for (var row = 0; row <= n; row++){
    var y = 776 - (n - row) * R / 2, inset = (n - row) % 2 === 0;      // the bottom row is inset from the sides
    for (var x = 24 + (inset ? R : 0); x - R < 575.5; x += 2 * R){
      g.S(arch(x, y, R));
      for (var i = rings; i >= 1; i--) g.L(arch(x, y, R * i / (rings + 1)));
      for (var j = 1; j <= rays; j++){
        var a = 180 + j * 180 / (rays + 1), p0 = h.onCircle(x, y, R * rings / (rings + 1), a), p1 = h.onCircle(x, y, R, a);
        if (Math.min(p0[0], p1[0]) > 25 && Math.max(p0[0], p1[0]) < 575) g.D(h.line(p0, p1), 1);
      }
    }
  }
});

C.define({ id:"stained-glass-window", title:"The Stained Glass Window", cat:"bold-easy-patterns", fit:"page",
  tags:["stained-glass", "windows", "light", "geometric"], talk:"What colors do you like to see when the sun shines through a window?" }, function(g){
  g.S(h.path([60, 776]).L([60, 280]).Q([60, 40], [300, 40]).Q([540, 40], [540, 280]).L([540, 776]).Z());
  g.S(h.path([100, 740]).L([100, 290]).Q([100, 80], [300, 80]).Q([500, 80], [500, 290]).L([500, 740]).Z());
  var cx = 300, cy = 330;
  g.S(h.circle(cx, cy, 150));
  var n = g.at(8, 6, 4);
  for (var i = 0; i < n; i++) g.S(h.petal(cx, cy, i * 360 / n - 90, 20, 140, 2 * Math.PI * 140 / n * .7, "pointed"));
  g.S(h.circle(cx, cy, 34));
  g.L(h.line([100, 520], [500, 520]));
  var cols = g.at(4, 3, 2);
  for (var k = 1; k < cols; k++){ var x = 100 + k * 400 / cols; g.L(h.line([x, 520], [x, 740])); }
  if (g.lvl >= 2){ g.L(h.line([100, 630], [500, 630])); }
  if (g.lvl >= 3){ for (var j = 0; j < cols; j++){ var x0 = 100 + j * 100; g.D(h.line([x0, 520], [x0 + 100, 630])); g.D(h.line([x0 + 100, 520], [x0, 630])); } }
  g.L(h.line([100, 290], [150, 180]), 2); g.L(h.line([500, 290], [450, 180]), 2);
  g.S(h.rect(40, 740, 520, 36));
});

C.define({ id:"fish-scale-tiles", title:"Scallop Tiles", cat:"bold-easy-patterns", fit:"page",
  tags:["tiles", "scallops", "geometric", "calm"], talk:"What pattern would you choose for a kitchen floor?" }, function(g){
  frame(g);
  var R = g.at(64, 84, 116), dy = R * .9;
  for (var row = 0; 24 + row * dy - R < 776; row++){
    var y = 24 + row * dy + R * .2;
    for (var x = 24 + (row % 2 ? R : 0); x - R < 576; x += 2 * R){
      var pts = h.arcPts(x, y, R, 180, 360, 24).concat([[x + R, y + 2 * R], [x - R, y + 2 * R]]);
      var d = h.clipped(pts, 24, 24, 576, 776, 250);
      if (!d) continue;
      g.S(d);
      if (g.lvl >= 3 && y - R * .5 > 24){ var dd = h.clipped(h.arcPts(x, y + R * .15, R * .5, 180, 360, 16), 24, 24, 576, 776, 0); if (dd) g.D(h.poly(h.clipRect(h.arcPts(x, y + R * .15, R * .5, 180, 360, 16), 24, 24, 576, 776), true)); }
    }
  }
});

C.define({ id:"honeycomb", title:"The Honeycomb", cat:"bold-easy-patterns", fit:"page",
  tags:["hexagons", "honeybees", "geometric"], talk:"What is your favorite thing to sweeten with honey?" }, function(g){
  frame(g);
  var r = g.at(46, 66, 96), dx = r * Math.sqrt(3);
  for (var row = -1; 24 + row * r * 1.5 - r < 776; row++){
    for (var col = -1; 24 + col * dx - dx < 576; col++){
      var x = 24 + col * dx + (row % 2 ? dx / 2 : 0), y = 24 + row * r * 1.5;
      var pts = []; for (var i = 0; i < 6; i++) pts.push(h.onCircle(x, y, r, 30 + i * 60));
      var d = h.clipped(pts, 24, 24, 576, 776, 300);
      if (d) g.S(d);
    }
  }
});

/* A diamond trellis inside a plain border. The inner edges pass through
   diamond centres, so every piece along them is a half or a quarter
   diamond, never a sliver. Tiers 1 and 2 add bolts where the laths cross;
   Tier 1 adds a small diamond inside each opening. */
C.define({ id:"quatrefoil-lattice", title:"The Garden Trellis", cat:"bold-easy-patterns", fit:"page",
  tags:["trellis", "lattice", "diamonds", "geometric"], talk:"What would you grow up a garden trellis?" }, function(g){
  frame(g);
  var L = g.at({ a:10, b:14, s:96 }, { a:6, b:8, s:156 }, { a:4, b:6, s:216 }), s = L.s, u = s / 2;
  var w = L.a * u, hh = L.b * u, x0 = 300 - w / 2, y0 = 400 - hh / 2;
  g.S(h.rect(x0, y0, w, hh));
  for (var i = 0; i <= L.a; i++) for (var j = 0; j <= L.b; j++){
    var cx = x0 + i * u, cy = y0 + j * u, inside = i > 0 && i < L.a && j > 0 && j < L.b;
    if ((i + j) % 2 === 0){
      g.S(h.clipped([[cx, cy - u], [cx + u, cy], [cx, cy + u], [cx - u, cy]], x0, y0, x0 + w, y0 + hh, 0));
      if (inside) g.D(h.poly([[cx, cy - s * .2], [cx + s * .2, cy], [cx, cy + s * .2], [cx - s * .2, cy]]), 3);
    }
    else if (inside && g.lvl >= 2) g.K(h.circle(cx, cy, s * g.at(.1, .07, 0)));
  }
});

C.define({ id:"kaleidoscope", title:"The Kaleidoscope", cat:"bold-easy-patterns", fit:"page",
  tags:["kaleidoscope", "triangles", "geometric"], talk:"What game did you enjoy playing with friends?" }, function(g){
  frame(g);
  var cx = 300, cy = 400, n = g.at(12, 8, 6), R1 = 260;
  for (var i = 0; i < n; i++){
    var a0 = i * 360 / n - 90, a1 = a0 + 360 / n;
    g.S(h.poly([[cx, cy], h.onCircle(cx, cy, R1, a0), h.onCircle(cx, cy, R1, a1)]));
    g.S(h.poly([h.onCircle(cx, cy, R1 * .5, a0), h.onCircle(cx, cy, R1, (a0 + a1) / 2), h.onCircle(cx, cy, R1 * .5, a1)]));
    if (g.lvl >= 3) g.S(h.poly([h.onCircle(cx, cy, R1 * .22, a0), h.onCircle(cx, cy, R1 * .44, (a0 + a1) / 2), h.onCircle(cx, cy, R1 * .22, a1)]));
  }
  g.S(h.circle(cx, cy, g.at(34, 40, 50)));
});
})(globalThis.CogniCore);

/* ---------- designs/vehicles.js ---------- */
/* CogniCore designs: Classic Vehicles. Side-on views, facing right, with
   big wheels and plain panels; chrome, trim and seams only at Tiers 1-2.
   Each sits in a scene (lineart.js, kit.scene) so the tall page is filled
   with big areas to color, not empty paper.
   See assets/cognicore/lineart.js for g (the tier's shapes) and h (geometry). */
(function(C){
"use strict";
var h = C.helpers, kit = C.kit;

/* A wheel: tire, rim and hubcap; spoked wheels (bicycles, trains) pass spokes. */
function wheel(g, cx, cy, r, o){
  o = o || {};
  g.S(h.circle(cx, cy, r));
  g.S(h.circle(cx, cy, r * (o.rim || .58)), o.rimLv || 2);
  if (!g.is(2)) g.K(h.circle(cx, cy, r * .14));
  if (o.hub !== false) g.DS(h.circle(cx, cy, r * .22), 3);
  if (o.spokes) for (var i = 0; i < o.spokes; i++){ var a = i * 360 / o.spokes; g.D(h.line(h.onCircle(cx, cy, r * .24, a), h.onCircle(cx, cy, r * (o.rim || .58) - 2, a)), o.spokeLv || 2); }
}

/* A vehicle in its scene: the drawing's bottom-centre anchor [ax, ay] lands at
   [x, y] (usually on the road), scaled to span `width` units. */
function inScene(meta, scene, place, draw){
  meta.fit = "page";
  C.define(meta, function(g){
    kit.scene(g, scene);
    var s = place.width / (place.span[1] - place.span[0]);
    g.group({ x:place.x || 300, y:place.y, s:s, ox:(place.span[0] + place.span[1]) / 2, oy:place.anchorY }, draw);
    if (scene.rail) g.S(h.rect(24, place.y, 552, 30));
  });
}

function sedan(g){
  g.S(h.path([48, 452]).L([40, 402]).Q([44, 368], [70, 352]).L([96, 364]).Q([150, 378], [196, 384])
    .L([236, 322]).Q([244, 312], [262, 312]).L([388, 312]).Q([404, 312], [414, 324]).L([452, 382])
    .Q([540, 386], [562, 400]).Q([572, 422], [566, 452]).L([514, 452]).C([512, 386], [398, 386], [396, 452])
    .L([196, 452]).C([194, 386], [80, 386], [78, 452]).Z());
  g.S(h.path([214, 382]).L([246, 330]).Q([252, 324], [262, 324]).L([306, 324]).L([306, 382]).Z());
  g.S(h.path([322, 382]).L([322, 324]).L([384, 324]).Q([394, 324], [400, 334]).L([432, 382]).Z());
  g.S(h.rrect(548, 436, 34, 22, 9), 3);
  g.S(h.rrect(24, 436, 34, 22, 9), 3);
  g.S(h.circle(552, 410, 12), 3);
  g.S(h.path([46, 400]).L([62, 368]).L([74, 372]).L([60, 404]).Z(), 3);
  g.D(h.smooth([[92, 404], [220, 402], [340, 410], [520, 414]], true));
  g.D(h.line([314, 386], [314, 446]), 3);
  g.D(h.line([206, 388], [206, 440]), 3);
  g.D(h.line([290, 398], [304, 398]), 3);
  wheel(g, 137, 456, 46);
  wheel(g, 455, 456, 46);
}
inScene({ id:"sunday-sedan", title:"The Sunday Sedan", cat:"classic-vehicles", era:"1950s",
  tags:["cars", "chrome", "tail-fins", "road-trips"], sensitive:["driving"],
  talk:"Where would a Sunday drive take you today?" },
  { road:[610, 700], trees:[[120, 70], [178, 54]] }, { span:[24, 582], anchorY:502, y:690, width:540 }, sedan);

function pickup(g){
  g.S(h.path([30, 446]).L([30, 350]).L([262, 350]).L([262, 446]).L([232, 446]).C([230, 390], [128, 390], [126, 446]).L([74, 446]).Z());
  g.D(h.line([30, 372], [262, 372]));
  g.D(h.line([90, 350], [90, 372]), 3); g.D(h.line([150, 350], [150, 372]), 3); g.D(h.line([210, 350], [210, 372]), 3);
  g.S(h.path([262, 446]).L([262, 300]).Q([262, 262], [298, 262]).L([362, 262]).Q([384, 262], [394, 282]).L([420, 346])
    .Q([514, 346], [548, 364]).Q([572, 378], [572, 420]).L([572, 446]).L([522, 446]).C([520, 388], [412, 388], [410, 446]).Z());
  g.S(h.path([284, 336]).L([284, 296]).Q([284, 282], [300, 282]).L([356, 282]).Q([368, 282], [374, 294]).L([392, 336]).Z());
  g.S(h.rrect(556, 430, 30, 22, 8), 3);
  g.S(h.circle(546, 378, 14), 3);
  g.D(h.line([420, 346], [420, 420]), 2);
  g.D(h.line([306, 356], [322, 356]), 3);
  wheel(g, 179, 448, 44);
  wheel(g, 466, 448, 44);
}
inScene({ id:"farm-pickup", title:"The Farm Pickup", cat:"classic-vehicles", era:"1950s",
  tags:["trucks", "farm", "work"], sensitive:["driving"],
  talk:"What would you haul in the back of this truck?" },
  { road:[610, 700], trees:[[480, 64]] }, { span:[30, 586], anchorY:492, y:690, width:530 }, pickup);

function tractor(g){
  g.S(h.rrect(236, 250, 20, 90, 6), 2);
  g.S(h.rrect(228, 240, 36, 16, 6), 2);
  g.S(h.path([180, 344]).L([180, 316]).Q([180, 300], [196, 300]).L([470, 300]).Q([496, 300], [500, 324]).L([506, 390]).L([180, 390]).Z());
  g.D(h.line([220, 318], [220, 382]));
  g.D(h.line([470, 318], [476, 382]), 3); g.D(h.line([452, 318], [456, 382]), 3); g.D(h.line([434, 318], [436, 382]), 3);
  g.S(h.path([60, 310]).Q([60, 250], [120, 246]).L([170, 244]).L([176, 290]).L([122, 294]).Q([104, 296], [104, 316]).Z());
  g.S(h.circle(150, 390, 118));
  g.S(h.circle(150, 390, 70));
  g.DS(h.circle(150, 390, 22), 2);
  for (var i = 0; i < 12; i++){ var a = i * 30 + 15; g.D(h.poly([h.onCircle(150, 390, 104, a - 6), h.onCircle(150, 390, 118, a - 10), h.onCircle(150, 390, 118, a + 10), h.onCircle(150, 390, 104, a + 6)]), 3); }
  g.S(h.circle(470, 438, 58));
  g.S(h.circle(470, 438, 30));
  g.DS(h.circle(470, 438, 10), 2);
  g.S(h.path([118, 300]).Q([150, 230], [226, 250]).L([222, 296]).Z());
}
inScene({ id:"farm-tractor", title:"The Farm Tractor", cat:"classic-vehicles", era:"1940s",
  tags:["farm", "tractors", "harvest"], talk:"What grows best in a good field?" },
  { horizon:430, trees:[[520, 60], [470, 44]] }, { span:[32, 528], anchorY:508, y:700, width:500 }, tractor);

function locomotive(g){
  g.S(h.path([118, 250]).L([106, 170]).L([168, 170]).L([156, 250]).Z());
  g.S(h.rrect(96, 150, 82, 26, 8));
  g.S(h.path([236, 250]).Q([236, 212], [262, 212]).Q([288, 212], [288, 250]).Z(), 2);
  g.S(h.path([96, 250]).L([404, 250]).L([404, 364]).L([96, 364]).Q([60, 306], [96, 250]).Z());
  g.D(h.line([150, 250], [150, 364])); g.D(h.line([330, 250], [330, 364]), 3);
  g.S(h.circle(88, 306, 22), 3);
  g.S(h.path([392, 150]).L([540, 150]).L([540, 364]).L([392, 364]).Z());
  g.S(h.rrect(378, 130, 176, 26, 8));
  g.S(h.rrect(420, 180, 92, 78, 8));
  g.D(h.line([466, 180], [466, 258]), 3);
  g.S(h.path([60, 364]).L([552, 364]).L([552, 392]).L([60, 392]).Z());
  g.S(h.path([60, 392]).L([22, 462]).L([96, 462]).L([96, 392]).Z());
  g.D(h.line([46, 440], [96, 440]), 3); g.D(h.line([38, 414], [96, 414]), 3);
  g.at([184, 290, 396], [184, 290, 396], [210, 370]).forEach(function(x){ wheel(g, x, 430, 50, { spokes:6, spokeLv:3 }); });
  g.S(h.circle(122, 450, 26), 2);
  g.L(h.line([184, 440], [396, 440]), 3);
}
inScene({ id:"steam-locomotive", title:"The Steam Locomotive", cat:"classic-vehicles", era:"1930s",
  tags:["trains", "railroad", "travel"], talk:"Where would you ride this train today?" },
  { horizon:370, trees:[[90, 50]], rail:1 }, { span:[22, 554], anchorY:480, y:660, width:520 }, locomotive);

C.define({ id:"lake-sailboat", title:"Sailing on the Lake", cat:"classic-vehicles", fit:"page",
  tags:["boats", "lake", "summer", "wind"], sensitive:["water"], season:"summer",
  talk:"What is the nicest weather for a day on the water?" }, function(g){
  kit.scene(g, { horizon:520, hills:false, water:540, sunX:150 });
  g.group({ x:320, y:600, s:1.1, ox:300, oy:560 }, function(g){
    g.S(h.path([300, 90]).L([300, 468]).L([112, 468]).Q([190, 300], [300, 90]).Z());
    g.S(h.path([320, 126]).L([470, 468]).L([320, 468]).Z());
    g.D(h.line([300, 190], [196, 330]), 3); g.D(h.line([300, 320], [150, 420]), 3);
    g.D(h.line([320, 250], [390, 350]), 3);
    g.L(h.line([300, 468], [300, 80]));
    g.S(h.path([70, 488]).L([536, 488]).Q([516, 548], [460, 560]).L([150, 560]).Q([96, 548], [70, 488]).Z());
    g.D(h.smooth([[92, 512], [300, 520], [520, 512]], true));
    g.S(h.path([292, 80]).L([330, 92]).L([292, 104]).Z(), 2);
  });
});

function woody(g){
  g.S(h.path([30, 450]).L([30, 322]).Q([30, 300], [54, 300]).L([400, 300]).Q([420, 300], [432, 316]).L([462, 370]).Q([540, 376], [566, 392]).Q([576, 414], [572, 450])
    .L([520, 450]).C([518, 388], [410, 388], [408, 450]).L([190, 450]).C([188, 388], [80, 388], [78, 450]).Z());
  [[50, 316, 96], [160, 316, 96], [270, 316, 96]].forEach(function(w){ g.S(h.rrect(w[0], w[1], w[2], 48, 6)); });
  g.S(h.path([380, 364]).L([380, 316]).L([404, 316]).Q([416, 316], [424, 330]).L([444, 364]).Z());
  g.D(h.rect(44, 378, 336, 56), 3);
  [156, 268].forEach(function(x){ g.D(h.line([x, 378], [x, 434]), 3); });
  if (g.lvl >= 3){ g.D(h.line([44, 406], [380, 406])); }
  g.S(h.rrect(552, 432, 34, 22, 9), 3); g.S(h.rrect(18, 432, 34, 22, 9), 3);
  g.S(h.circle(552, 404, 12), 3);
  if (g.lvl >= 2) g.D(h.path([40, 300]).L([40, 286]).L([380, 286]).L([380, 300]).open(), 3);
  wheel(g, 134, 452, 46); wheel(g, 464, 452, 46);
}
inScene({ id:"woody-wagon", title:"The Woody Station Wagon", cat:"classic-vehicles", era:"1940s",
  tags:["cars", "station-wagons", "road-trips", "family"], sensitive:["driving"], talk:"Where would a family road trip take you?" },
  { road:[610, 700], trees:[[480, 60], [530, 46]] }, { span:[18, 586], anchorY:498, y:690, width:540 }, woody);

function convertible(g){
  g.S(h.path([40, 450]).L([36, 400]).Q([40, 372], [80, 368]).L([200, 364]).L([240, 380]).L([330, 380]).L([372, 350]).L([388, 352]).L([360, 386])
    .Q([520, 388], [556, 404]).Q([574, 420], [568, 450]).L([520, 450]).C([518, 390], [410, 390], [408, 450]).L([190, 450]).C([188, 390], [80, 390], [78, 450]).Z());
  g.S(h.path([200, 364]).Q([204, 316], [246, 316]).L([256, 380]).Z(), 2);
  g.S(h.path([262, 380]).Q([266, 330], [304, 330]).L([314, 380]).Z(), 3);
  g.L(h.line([350, 382], [384, 314]));
  g.D(h.smooth([[60, 404], [300, 410], [540, 414]], true));
  g.S(h.rrect(550, 436, 34, 22, 9), 3); g.S(h.rrect(20, 436, 34, 22, 9), 3);
  g.S(h.circle(554, 410, 12), 3);
  wheel(g, 134, 454, 46); wheel(g, 464, 454, 46);
}
inScene({ id:"convertible", title:"The Convertible", cat:"classic-vehicles", era:"1950s",
  tags:["cars", "convertibles", "summer", "chrome"], sensitive:["driving"], season:"summer", talk:"What would you enjoy most about a drive with the top down?" },
  { road:[610, 700], trees:[[100, 60]] }, { span:[20, 584], anchorY:500, y:690, width:540 }, convertible);

function breadTruck(g){
  g.S(h.path([30, 440]).L([30, 250]).Q([30, 220], [60, 220]).L([400, 220]).Q([470, 220], [500, 280]).L([540, 360]).Q([570, 372], [572, 410]).L([572, 440])
    .L([520, 440]).C([518, 380], [410, 380], [408, 440]).L([180, 440]).C([178, 380], [70, 380], [68, 440]).Z());
  g.S(h.path([410, 330]).L([410, 250]).L([440, 250]).Q([462, 250], [474, 272]).L([504, 330]).Z());
  g.S(h.rrect(60, 250, 320, 130, 12));
  if (g.lvl >= 2) g.D(h.rrect(80, 270, 280, 90, 10), 2);
  if (g.lvl >= 3) g.D(h.path([120, 330]).Q([150, 290], [200, 300]).Q([240, 280], [280, 300]).Q([310, 290], [320, 330]).open());
  g.D(h.line([400, 220], [400, 430]), 2);
  g.S(h.rrect(552, 426, 34, 22, 9), 3); g.S(h.rrect(16, 426, 34, 22, 9), 3);
  g.S(h.circle(556, 390, 12), 3);
  wheel(g, 124, 444, 44); wheel(g, 464, 444, 44);
}
inScene({ id:"bread-truck", title:"The Bakery Delivery Truck", cat:"classic-vehicles", era:"1950s",
  tags:["trucks", "deliveries", "bakery", "neighborhoods"], sensitive:["driving"], talk:"What would you like delivered fresh to the door?" },
  { road:[610, 700] }, { span:[16, 586], anchorY:488, y:690, width:540 }, breadTruck);

C.define({ id:"streetcar", title:"The Streetcar", cat:"classic-vehicles", era:"1940s", fit:"page",
  tags:["streetcars", "trolleys", "city", "travel"], talk:"Where in town would you ride the streetcar to?" }, function(g){
  kit.scene(g, { horizon:440, hills:false, trees:g.lvl >= 3 ? [[500, 60]] : null });
  g.L(h.line([24, 120], [576, 110]));
  g.L(h.line([300, 116], [340, 300]));
  g.S(h.rrect(60, 290, 480, 36, 14));
  g.S(h.path([50, 600]).L([50, 330]).L([550, 330]).L([550, 600]).Z());
  var win = g.at(6, 5, 4), ww = 440 / win;
  for (var i = 0; i < win; i++) g.S(h.rrect(80 + i * ww, 360, ww - 20, 90, 10));
  g.D(h.line([50, 480], [550, 480])); g.D(h.line([50, 560], [550, 560]), 3);
  if (g.lvl >= 2){ g.S(h.rect(470, 470, 60, 130)); }
  [140, 460].forEach(function(x){ wheel(g, x, 640, 40, { rim:.5 }); });
  g.S(h.rect(24, 670, 552, 30));
});

C.define({ id:"vintage-bicycle", title:"The Bicycle with a Basket", cat:"classic-vehicles", era:"1950s", fit:"page",
  tags:["bicycles", "country-lanes", "flowers", "exercise"], talk:"Where would you ride a bicycle on a sunny afternoon?" }, function(g){
  kit.scene(g, { horizon:460, trees:[[520, 64]] });
  g.group({ x:300, y:560, s:1 }, function(g){
    wheel(g, -150, 80, 110, { rim:.9, rimLv:2, spokes:g.at(12, 8, 0), spokeLv:2 });
    wheel(g, 150, 80, 110, { rim:.9, rimLv:2, spokes:g.at(12, 8, 0), spokeLv:2 });
    g.L(h.poly([[-150, 80], [-40, -60], [110, -60], [150, 80]], true));
    g.L(h.line([-40, -60], [10, 80])); g.L(h.line([10, 80], [-150, 80]));
    g.L(h.line([110, -60], [90, -120]));
    var grip = h.path([60, -130]).Q([90, -140], [120, -124]).L([116, -112]).Q([90, -124], [64, -118]).Z();
    var saddle = h.path([-80, -84]).Q([-40, -100], [0, -84]).L([-6, -70]).Q([-40, -80], [-74, -70]).Z();
    if (g.is(2)){ g.S(grip); g.S(saddle); } else { g.K(grip); g.K(saddle); }
    g.L(h.line([-40, -60], [-44, -76]));
    if (g.lvl >= 2){ g.S(h.path([120, -110]).L([220, -110]).L([210, -40]).L([130, -40]).Z()); [150, 180].forEach(function(x){ g.D(h.line([x, -110], [x - 4, -40])); }); }   // the basket from Tier 2 up
    if (g.lvl >= 3) [[140, -140, 30], [190, -150, 34]].forEach(function(f){ g.S(h.scallop(f[0], f[1], f[2], 6, .3)); g.K(h.circle(f[0], f[1], f[2] * .3)); });
    g.K(h.circle(10, 80, 18));
  });
});

C.define({ id:"motor-scooter", title:"The Motor Scooter", cat:"classic-vehicles", era:"1950s", fit:"page",
  tags:["scooters", "travel", "city", "summer"], sensitive:["driving"], talk:"Where would you ride on a warm evening?" }, function(g){
  kit.scene(g, { horizon:460, road:[640, 710], trees:[[90, 56]] });
  g.group({ x:300, y:560, s:1.05 }, function(g){
    wheel(g, -150, 80, 58); wheel(g, 160, 80, 58);
    g.S(h.path([-240, 50]).C([-250, -30], [-200, -70], [-120, -74]).L([-40, -74]).C([-20, -60], [-16, -20], [-20, 40]).Q([-120, 70], [-240, 50]).Z());
    g.S(h.rrect(-200, -104, 150, 34, 14));
    g.S(h.rect(-24, 20, 120, g.at(24, 24, 40)));                  // a deeper floorboard at Tier 3
    g.S(h.path([80, 44]).C([90, -60], [110, -120], [128, -170]).L([160, -170]).C([150, -100], [140, -20], [150, 44]).Z());
    var fender = h.path([90, 80]).C([90, 0], [230, 0], [230, 80]).L([214, 80]).C([214, 20], [106, 20], [106, 80]).Z();
    if (g.is(2)) g.S(fender); else g.K(fender);
    g.L(h.line([144, -170], [144, -196]));
    g.L(h.line([100, -196], [200, -196]));
    g.S(h.circle(150, -232, 32));
    if (g.lvl >= 2) g.D(h.path([-220, 10]).Q([-140, -30], [-50, -40]).open());
  });
});
C.define({ id:"tugboat", title:"The Harbor Tugboat", cat:"classic-vehicles", fit:"page",
  tags:["boats", "harbors", "work", "sea"], sensitive:["water"], talk:"What kind of work would you enjoy watching at a harbor?" }, function(g){
  kit.scene(g, { horizon:500, hills:false, water:520, sunX:130, sunY:150 });
  g.group({ x:300, y:560, s:1 }, function(g){
    g.S(h.rrect(30, -330, 70, 150, 10));
    g.S(h.rect(24, -280, 82, 30), 2);
    g.S(h.path([-150, -150]).L([-150, -270]).L([90, -270]).L([90, -150]).Z());
    g.at([-120, -60, 0], [-120, -60, 0], [-120, -30]).forEach(function(x){ g.S(h.rrect(x, -250, g.at(44, 44, 70), 60, 8)); });
    g.S(h.path([-260, -150]).L([250, -150]).Q([290, -150], [290, -110]).C([260, 20], [100, 40], [0, 40]).L([-190, 40]).C([-240, 30], [-270, -60], [-260, -150]).Z());
    g.D(h.path([-250, -110]).L([270, -110]).open());
    [-150, -50, 50, 150].forEach(function(x){ g.S(h.circle(x, -60, 24), 2); });
  });
});

C.define({ id:"biplane", title:"The Biplane", cat:"classic-vehicles", era:"1930s", fit:"page",
  tags:["airplanes", "flying", "sky", "adventure"], talk:"Where would you fly if you could go anywhere?" }, function(g){
  kit.frame(g);
  g.S(h.smooth([[110, 250], [124, 218], [160, 212], [180, 190], [220, 190], [242, 210], [266, 210], [280, 234], [266, 254]]), 2);
  g.S(h.smooth([[380, 640], [394, 612], [430, 606], [450, 586], [490, 586], [512, 606], [536, 606], [550, 630], [536, 650]]), 3);
  if (g.lvl >= 2) g.S(h.path([24, 700]).C([200, 640], [400, 690], [576, 650]).L([576, 776]).L([24, 776]).Z());
  g.group({ x:300, y:440, s:1, rot:-8 }, function(g){
    [[-60, 120], [60, 120]].forEach(function(w){ g.L(h.line([w[0], 40], [w[0], w[1] - 24])); if (g.is(2)) g.S(h.circle(w[0], w[1], 26)); else g.K(h.circle(w[0], w[1], 26)); });
    if (g.is(2)) g.S(h.rrect(-230, 26, 460, 40, 18));
    if (g.is(2)) g.S(h.path([-240, -10]).L([-300, -90]).L([-270, -90]).L([-200, -30]).Z());
    else g.S(h.path([-246, -4]).L([-316, -116]).L([-262, -116]).L([-186, -30]).Z());         // a bigger fin at Tier 3
    g.S(h.path([-250, 0]).C([-250, -40], [-200, -60], [-120, -60]).L([180, -50]).Q([230, -44], [240, 0]).Q([230, 44], [180, 50]).L([-120, 60]).C([-200, 60], [-250, 40], [-250, 0]).Z());
    if (g.lvl >= 2) g.D(h.line([-150, 0], [120, 4]));
    if (g.is(2)) g.S(h.path([-40, -58]).Q([-20, -108], [30, -102]).L([30, -56]).Z());
    else { g.K(h.path([-40, -58]).Q([-24, -90], [26, -88]).L([26, -56]).Z()); g.S(h.rrect(-230, 26, 460, 40, 18)); }   // Tier 3: lower windscreen, the lower wing in front
    g.L(h.line([-150, -96], [-150, -50])); g.L(h.line([150, -96], [150, -46]));
    if (g.lvl >= 2){ g.D(h.line([-150, -96], [-80, -52])); g.D(h.line([150, -96], [80, -48])); }
    g.S(h.rrect(-230, -136, 460, 40, 18));
    g.S(h.ellipse(250, 0, 16, 70));
  });
});
C.define({ id:"hot-air-balloon", title:"The Hot Air Balloon", cat:"classic-vehicles", fit:"page",
  tags:["balloons", "sky", "festivals", "adventure"], talk:"What would you like to see from high above?" }, function(g){
  kit.frame(g);
  if (g.lvl >= 2) g.S(h.smooth([[60, 600], [72, 574], [104, 568], [122, 550], [156, 550], [174, 568], [198, 568], [210, 590], [198, 608]]), 2);
  if (g.lvl >= 2) g.S(h.path([24, 680]).C([150, 610], [300, 630], [420, 660]).C([480, 630], [540, 630], [576, 650]).L([576, 776]).L([24, 776]).Z());
  var cx = 300;
  g.S(h.path([cx, 60]).C([470, 60], [520, 230], [470, 360]).C([440, 440], [380, 480], [350, 520]).L([250, 520]).C([220, 480], [160, 440], [130, 360]).C([80, 230], [130, 60], [cx, 60]).Z());
  var gores = g.at(7, 5, 3);
  for (var i = 1; i < gores; i++){ var f = i / gores, x = 130 + 340 * f; var bulge = (x - cx) * .4; g.L(h.path([cx + (x - cx) * .15, 62]).Q([x + bulge, 250], [250 + 100 * f, 518]).open()); }
  if (g.lvl >= 2) g.L(h.path([140, 380]).Q([cx, 430], [460, 380]).open());
  g.S(h.rect(248, 516, 104, 22));
  [[252, 538], [348, 538]].forEach(function(r){ g.L(h.line(r, [r[0] + (r[0] < cx ? 14 : -14), 600])); });
  g.S(h.path([250, 600]).L([350, 600]).L([340, 680]).L([260, 680]).Z());
  if (g.lvl >= 2){ g.D(h.line([252, 630], [348, 630])); }
});

function fireEngine(g){
  g.S(h.path([30, 450]).L([30, 330]).L([380, 330]).L([380, 280]).Q([380, 250], [410, 250]).L([470, 250]).Q([496, 250], [510, 280]).L([540, 350])
    .Q([572, 362], [574, 400]).L([574, 450]).L([522, 450]).C([520, 390], [412, 390], [410, 450]).L([190, 450]).C([188, 390], [80, 390], [78, 450]).Z());
  g.S(h.path([420, 330]).L([420, 270]).L([464, 270]).Q([478, 270], [486, 286]).L([506, 330]).Z());
  g.S(h.rect(40, 290, 340, 20)); g.S(h.rect(40, 250, 340, 20), 2);
  var rungs = g.at(9, 6, 4);
  for (var i = 0; i <= rungs; i++){ var x = 50 + i * 320 / rungs; g.L(h.line([x, 270], [x, 290]), 3); }
  g.S(h.circle(240, 390, 36)); g.S(h.circle(240, 390, 14), 3);
  g.S(h.circle(410, 220, 20), 3); g.L(h.line([410, 240], [410, 250]), 3);
  g.D(h.line([40, 360], [380, 360]));
  g.S(h.rrect(552, 432, 34, 22, 9), 3); g.S(h.rrect(16, 432, 34, 22, 9), 3);
  g.S(h.circle(556, 392, 12), 3);
  wheel(g, 134, 452, 46); wheel(g, 466, 452, 46);
}
inScene({ id:"fire-engine", title:"The Fire Engine", cat:"classic-vehicles", era:"1940s",
  tags:["fire-engines", "trucks", "community", "helpers"], sensitive:["driving", "storms"], talk:"Who are the helpers you admire in a community?" },
  { road:[610, 700], trees:[[90, 60]] }, { span:[16, 586], anchorY:498, y:690, width:540 }, fireEngine);
})(globalThis.CogniCore);

/* ---------- designs/wildlife.js ---------- */
/* CogniCore designs: Wildlife & Nature. Birds, butterflies, pond and shore
   life and gentle animals, drawn with natural proportions: small solid
   eyes, no smiles, no cartoon faces. */
(function(C){
"use strict";
var h = C.helpers, kit = C.kit;

/* A perched songbird facing right, about 330 long, feet at 0, 0.
   o.crest: a pointed crest (cardinal); o.tail: tail length; o.bib: a bib
   line on the breast (robin, chickadee); o.cap: a cap line (chickadee). */
function songbird(g, x, y, s, o){
  o = o || {};
  var tl = o.tail || 1;
  g.group({ x:x, y:y, s:s, flip:o.flip }, function(g){
    if (o.crest) g.S(h.smooth([[132, -186], [120, -236], [100, -276], [150, -250], [196, -210], [214, -186]]));
    g.S(h.smooth([[176, -198], [214, -186], [236, -160], [240, -136], [226, -104], [212, -62], [180, -16], [128, 8], [70, 18], [10, 26],
      [-60 * tl, 70 * tl], [-78 * tl, 50 * tl], [-20, 0], [40, -60], [90, -130], [130, -180]]));
    var beak = h.poly([[236, -150], [288, -136], [236, -122]]);
    if (g.is(3)) g.S(beak); else g.K(beak);
    if (o.bib) g.L(h.smooth([[226, -110], [196, -80], [150, -40], [110, 4]], true));
    if (o.cap) g.L(h.smooth([[140, -176], [180, -150], [236, -150]], true));
    if (o.mask) g.L(h.smooth([[240, -126], [210, -120], [196, -140], [214, -160], [238, -154]], true), 2);
    g.K(h.circle(204, -150, 8));
    g.S(h.smooth([[150, -120], [120, -40], [70, -4], [-10, 18], [40, -40], [100, -110]]));
    g.D(h.smooth([[134, -96], [90, -40], [30, 4]], true)); g.D(h.smooth([[118, -110], [60, -54], [10, 0]], true), 3);
    g.L(h.line([120, 8], [110, 44])); g.L(h.line([150, 0], [150, 44]));
  });
}
/* a branch across the page with a few leaves; th is its thickness at the
   left end (it tapers a little to the right) */
function branch(g, y0, y1, leaves, lv, th){
  th = th || 30; var tr = th * .87;
  g.S(h.path([20, y0]).C([200, y0 + 20], [400, y1 - 10], [580, y1 - 20]).L([580, y1 - 20 + tr]).C([400, y1 - 10 + tr], [200, y0 + 20 + tr], [20, y0 + th]).Z(), lv);
  (leaves || []).forEach(function(l){ g.S(h.leaf([l[0], l[1]], [l[2], l[3]], l[4] || 44, l[5] || 0), l[6] || 1); g.D(h.vein([l[0], l[1]], [l[2], l[3]], l[5] || 0), Math.max(l[6] || 1, 2)); });
}
/* a point on a cubic curve */
function bez(p0, p1, p2, p3, t){ var u = 1 - t; return [0, 1].map(function(k){ return u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]; }); }
/* a pine bough th thick along a curve, with n pairs of needles fanning out
   from its two edges (so they never cut the bough into pieces) */
function bough(g, p0, p1, p2, p3, th, n, len){
  var q = function(p, k){ return [p[0], p[1] + th * k]; }, b0 = q(p0, 1), b1 = q(p1, 1), b2 = q(p2, .9), b3 = q(p3, .85);
  g.S(h.path(p0).C(p1, p2, p3).L(b3).C(b2, b1, b0).Z());
  for (var i = 1; i < n; i++){
    var a = bez(p0, p1, p2, p3, i / n), b = bez(b0, b1, b2, b3, i / n);
    g.L(h.line(a, [a[0] + len * .45, a[1] - len])); g.L(h.line(b, [b[0] + len * .45, b[1] + len]));
  }
}

C.define({ id:"cardinal-branch", title:"The Cardinal", cat:"wildlife-nature", season:"winter",
  tags:["birds", "cardinals", "winter", "backyard-birds"], talk:"Which birds visit a window you like to look out of?" }, function(g){
  branch(g, 560, 520, g.at([[140, 580, 90, 660, 60, -.3], [420, 540, 480, 620, 56, .3], [520, 520, 560, 450, 50, 0]], [[140, 580, 90, 660, 64, -.3], [480, 536, 550, 600, 60, .3]], [[150, 580, 100, 670, 70, -.3]]), 1, g.at(30, 36, 46));
  if (g.lvl >= 2) g.at([[250, 600, 16], [276, 616, 16], [240, 628, 16]], [[246, 606, 22], [284, 624, 22]], []).forEach(function(b){ g.S(h.circle(b[0], b[1], b[2])); });
  songbird(g, g.at(250, 250, 180), g.at(540, 540, 560), g.at(1.2, 1.35, 1.4), { crest:true, mask:true, tail:1.25 });
});

C.define({ id:"robin-fence", title:"The Robin on the Fence", cat:"wildlife-nature", season:"spring",
  tags:["birds", "robins", "spring", "fences"], talk:"What are the first signs of spring you notice?" }, function(g){
  g.S(h.poly([[110, 800], [110, 470], [160, 430], [210, 470], [210, 800]]));
  g.S(h.rect(20, 560, 560, 40));
  if (g.lvl >= 2){ g.S(h.poly([[390, 800], [390, 480], [440, 440], [490, 480], [490, 800]])); g.S(h.rect(20, 690, 560, 40)); }
  if (g.lvl >= 3){ g.D(h.line([130, 620], [140, 760])); g.D(h.line([410, 620], [420, 760])); }
  songbird(g, 170, 432, g.at(1.25, 1.35, 1.5), { bib:true, tail:1 });
});

C.define({ id:"chickadee-pine", title:"Chickadee in the Pines", cat:"wildlife-nature", season:"winter",
  tags:["birds", "chickadees", "pine", "winter"], talk:"What does the woods sound like on a quiet winter morning?" }, function(g){
  bough(g, [20, 520], [200, 500], [400, 470], [580, 440], g.at(26, 32, 44), g.at(15, 10, 0), 56);
  var cone = function(x, y, s, lv){ g.group({ x:x, y:y, s:s }, function(g){ g.S(h.smooth([[0, 0], [34, 30], [40, 90], [20, 150], [0, 166], [-20, 150], [-40, 90], [-34, 30]]), lv); for (var r = 1; r < 5; r++) g.D(h.path([-36 + r * 2, r * 30]).Q([0, r * 30 + 16], [36 - r * 2, r * 30]).open(), Math.max(lv, 2)); }); };
  cone(430, 470, g.at(1.1, 1.3, 1.5), 1);
  if (g.lvl >= 3) cone(510, 460, .9, 3);
  songbird(g, 200, 510, g.at(1.15, 1.3, 1.45), { cap:true, bib:true, tail:.9 });
});

C.define({ id:"bluebird-house", title:"The Bluebird's House", cat:"wildlife-nature", season:"spring",
  tags:["birds", "bluebirds", "birdhouses", "spring"], sensitive:["home"], talk:"What would you plant around a birdhouse?" }, function(g){
  g.S(h.rect(276, 460, 48, 340));
  g.S(h.rect(180, 250, 240, 220));
  g.S(h.poly([[150, 262], [300, 130], [450, 262], [426, 274], [300, 168], [174, 274]]));
  g.S(h.circle(300, 330, 44));
  g.L(h.line([300, 400], [300, 430]));
  if (g.lvl >= 2){ g.D(h.line([180, 440], [420, 440])); }
  songbird(g, 420, 250, g.at(.85, .95, 1.05), { tail:1 });
  if (g.lvl >= 2) [[120, 800, 150], [480, 800, 170]].forEach(function(t){ g.L(h.line([t[0], t[1]], [t[0], t[1] - t[2]])); g.S(h.leaf([t[0], t[1] - 10], [t[0] - 40, t[1] - t[2] * .6], 26, -.2)); g.S(h.path([t[0] - 26, t[1] - t[2]]).C([t[0] - 28, t[1] - t[2] - 40], [t[0] - 10, t[1] - t[2] - 46], [t[0], t[1] - t[2] - 30]).C([t[0] + 10, t[1] - t[2] - 46], [t[0] + 28, t[1] - t[2] - 40], [t[0] + 26, t[1] - t[2]]).Q([t[0], t[1] - t[2] + 20], [t[0] - 26, t[1] - t[2]]).Z()); });
});

/* A hummingbird hovering at a trumpet vine: the flower hangs from the stem
   with its mouth toward the bird, and the bird's long bill stops just short
   of it, so bill and flower never cut each other into slivers. */
C.define({ id:"hummingbird", title:"The Hummingbird", cat:"wildlife-nature", season:"summer",
  tags:["birds", "hummingbirds", "flowers", "summer"], talk:"What flowers would you plant to bring birds to a garden?" }, function(g){
  var trumpet = function(x, y, s, rot, lv){ g.group({ x:x, y:y, s:s, rot:rot }, function(g){
    g.S(h.path([0, -12]).C([60, -14], [96, -18], [126, -46]).Q([146, -62], [158, -42]).L([158, 42]).Q([146, 62], [126, 46]).C([96, 18], [60, 14], [0, 12]).Z(), lv);
    g.S(h.ellipse(158, 0, 20, 46), lv);
    g.D(h.path([24, 0]).L([118, 0]).open(), 3);
  }); };
  /* the flower and the bird share one steep axis: the flower hangs along it
     and the bird hovers below, its bill pointing back up the same line */
  var A = 60 * Math.PI / 180, ca = Math.cos(A), sa = Math.sin(A);
  var f = g.at(1.15, 1.25, 1.4), sb = g.at(1.2, 1.3, 1.4), B = [150, 70];
  var reach = 178 * f + 18 + 140 * sb, H = [B[0] + reach * ca, B[1] + reach * sa];
  g.L(h.smooth([[40, 800], [70, 650], [60, 500], [84, 330], [110, 190], [150, 70]], true));
  if (g.lvl >= 2){ g.S(h.leaf([72, 560], [170, 520], 50, .3)); g.S(h.leaf([66, 450], [-20, 390], 46, -.3)); }
  if (g.lvl >= 3){ g.D(h.vein([72, 560], [170, 520], .3)); g.D(h.vein([66, 450], [-20, 390], -.3)); g.S(h.leaf([104, 210], [200, 190], 44, .2)); }
  if (g.lvl >= 3) trumpet(84, 330, .85, 75, 3);
  if (g.lvl >= 2) trumpet(150, 70, .85, -10, 2);
  trumpet(B[0], B[1], f, 60, 1);
  g.group({ x:H[0], y:H[1], s:sb }, function(g){
    g.S(h.smooth([[10, 0], [40, -110], [100, -200], [150, -226], [164, -190], [124, -90], [62, 34]]));        // raised wing
    if (g.lvl >= 3) g.D(h.smooth([[44, -30], [84, -120], [136, -190]], true));
    g.group({ rot:60 }, function(g){
      g.S(h.poly([[176, -8], [284, -30], [276, 14], [186, 24]]));                                              // forked tail
      g.S(h.poly([[180, 18], [278, 46], [252, 82], [170, 42]]));
      g.S(h.smooth([[14, -38], [80, -42], [150, -24], [198, 6], [206, 26], [160, 44], [96, 48], [36, 42], [6, 26]]));   // body
      if (g.lvl >= 2) g.D(h.path([30, 30]).Q([70, 52], [124, 42]).open());
    });
    g.S(h.circle(0, 0, 36));
    g.K(h.poly([[-30 * ca + 9 * sa, -30 * sa - 9 * ca], [-140 * ca, -140 * sa], [-30 * ca - 9 * sa, -30 * sa + 9 * ca]]));   // bill
    g.K(h.circle(-10, -10, 6.5));
  });
});

C.define({ id:"barn-owl", title:"The Barn Owl", cat:"wildlife-nature",
  tags:["birds", "owls", "evening", "woods"], talk:"What sounds do you like to hear at night?" }, function(g){
  branch(g, 690, 680, g.at([[500, 690, 560, 620, 50, .2], [80, 700, 40, 770, 50, -.2]], [[500, 690, 560, 620, 56, .2]], []), 1, g.at(30, 34, 42));
  g.S(h.smooth([[300, 170], [390, 190], [440, 300], [450, 460], [420, 600], [360, 690], [300, 700], [240, 690], [180, 600], [150, 460], [160, 300], [210, 190]]));
  g.S(h.smooth([[172, 330], [140, 470], [170, 600], [230, 680], [216, 560], [200, 420]]), 2);
  g.S(h.smooth([[428, 330], [460, 470], [430, 600], [370, 680], [384, 560], [400, 420]]), 2);
  g.S(h.path([300, 250]).C([250, 196], [170, 214], [176, 300]).C([180, 380], [250, 420], [300, 450]).C([350, 420], [420, 380], [424, 300]).C([430, 214], [350, 196], [300, 250]).Z());
  g.K(h.ellipse(250, 318, 13, 16)); g.K(h.ellipse(350, 318, 13, 16));
  g.S(h.poly([[292, 346], [308, 346], [300, 384]]));
  if (g.lvl >= 2) g.D(h.path([300, 262]).L([300, 336]).open(), 3);
  if (g.lvl >= 2){ var rows = g.at(4, 3, 0); for (var r = 0; r < rows; r++) for (var c = 0; c < 4 - (r % 2); c++){ var x = 244 + c * 38 + (r % 2) * 19, y = 490 + r * 40; g.D(h.path([x - 14, y]).Q([x, y + 16], [x + 14, y]).open()); } }
  g.K(h.ellipse(270, 700, 18, 10)); g.K(h.ellipse(330, 700, 18, 10));
});

C.define({ id:"swan-lake", title:"The Swan", cat:"wildlife-nature", fit:"page",
  tags:["birds", "swans", "lakes", "calm"], sensitive:["water"], talk:"Where is a calm place you like to walk by the water?" }, function(g){
  kit.scene(g, { horizon:420, water:440, sunX:460, sunY:150, hills:g.lvl >= 3 ? undefined : false });
  g.S(h.path([418, 560]).L([420, 490]).C([400, 380], [380, 300], [320, 260]).C([300, 246], [300, 200], [340, 190]).C([370, 184], [390, 200], [390, 224]).L([372, 226]).C([370, 212], [356, 206], [344, 210]).C([326, 216], [330, 244], [350, 262]).C([410, 310], [440, 400], [452, 480]).L([458, 560]).Z());
  g.S(h.path([120, 560]).C([150, 480], [300, 470], [420, 480]).C([470, 440], [520, 430], [540, 470]).C([520, 560], [440, 620], [300, 620]).C([200, 620], [130, 600], [120, 560]).Z());
  if (g.is(2)) g.S(h.poly([[388, 210], [420, 226], [386, 232]])); else g.K(h.poly([[388, 210], [420, 226], [386, 232]]));
  g.K(h.circle(364, 216, 6));
  g.S(h.path([170, 540]).C([220, 440], [340, 430], [410, 500]).C([370, 560], [250, 580], [170, 540]).Z());
  if (g.lvl >= 2){ g.D(h.path([220, 520]).Q([290, 480], [370, 500]).open()); g.D(h.path([240, 548]).Q([310, 520], [384, 526]).open(), 3); }
});

C.define({ id:"mallard-duck", title:"The Mallard on the Pond", cat:"wildlife-nature", fit:"page",
  tags:["birds", "ducks", "ponds"], sensitive:["water"], talk:"What would you bring to share with the ducks at a pond?" }, function(g){
  kit.scene(g, { horizon:430, water:450, sunX:130, sunY:150, hills:g.lvl >= 3 ? undefined : false });
  if (g.lvl >= 2){ g.S(h.path([470, 776]).L([470, 640]).L([490, 640]).L([490, 776]).Z()); g.S(h.rrect(462, 560, 36, 90, 18)); g.S(h.path([520, 776]).L([520, 600]).L([538, 600]).L([538, 776]).Z()); g.S(h.rrect(512, 520, 34, 90, 17)); }
  g.S(h.path([90, 560]).C([80, 500], [140, 480], [220, 486]).L([330, 490]).C([380, 490], [420, 470], [440, 440]).C([470, 500], [460, 560], [420, 600]).C([380, 640], [300, 650], [220, 650]).C([140, 650], [96, 620], [90, 560]).Z());
  g.S(h.path([220, 500]).C([230, 440], [240, 390], [230, 350]).C([224, 300], [260, 270], [300, 280]).C([330, 290], [336, 320], [330, 340]).C([320, 380], [300, 430], [290, 500]).Z());
  g.S(h.path([322, 318]).C([360, 316], [390, 326], [396, 340]).C([370, 346], [346, 344], [322, 340]).Z());
  g.K(h.circle(296, 310, 6));
  g.L(h.path([226, 380]).Q([262, 392], [302, 380]).open(), 2);
  g.S(h.path([170, 540]).C([240, 500], [340, 510], [410, 540]).C([350, 590], [240, 600], [170, 540]).Z());
  if (g.lvl >= 2) g.D(h.path([220, 548]).Q([290, 534], [360, 546]).open());
});

/* a butterfly seen from above, wings spread: fore- and hind-wings mirrored */
function butterfly(g, x, y, s, veins){
  g.group({ x:x, y:y, s:s }, function(g){
    var fore = [[8, -20], [60, -150], [150, -200], [240, -190], [250, -120], [180, -40], [60, 0]];
    var hind = [[8, 10], [60, 10], [170, 40], [200, 120], [150, 200], [60, 190], [14, 90]];
    [1, -1].forEach(function(sgn){
      var F = fore.map(function(p){ return [p[0] * sgn, p[1]]; }), Hh = hind.map(function(p){ return [p[0] * sgn, p[1]]; });
      g.S(h.smooth(Hh));
      g.S(h.smooth(F));
      if (veins >= 1){ g.L(h.smooth([[12 * sgn, -16], [120 * sgn, -150], [220 * sgn, -170]], true)); g.L(h.smooth([[14 * sgn, 20], [120 * sgn, 60], [170 * sgn, 130]], true)); }
      if (veins >= 2){ g.D(h.smooth([[20 * sgn, -10], [150 * sgn, -80], [230 * sgn, -130]], true)); g.D(h.smooth([[16 * sgn, 30], [90 * sgn, 130], [110 * sgn, 190]], true)); }
      if (veins >= 3){ [[200, -186], [230, -150], [210, -80]].forEach(function(p){ g.DS(h.circle(p[0] * sgn, p[1], 12)); }); [[150, 180], [190, 110]].forEach(function(p){ g.DS(h.circle(p[0] * sgn, p[1], 12)); }); }
      g.L(h.smooth([[4 * sgn, -70], [30 * sgn, -150], [60 * sgn, -200]], true));
      g.S(h.circle(62 * sgn, -204, 8));
    });
    g.S(h.smooth([[0, -80], [14, -50], [14, 100], [0, 150], [-14, 100], [-14, -50]]));
    g.S(h.circle(0, -84, 18));
  });
}
C.define({ id:"monarch-butterfly", title:"The Monarch Butterfly", cat:"wildlife-nature", season:"summer",
  tags:["butterflies", "monarchs", "gardens", "summer"], talk:"Where have you watched butterflies on a warm day?" }, function(g){
  butterfly(g, 300, 380, 1.1, g.at(3, 2, 1));
  if (g.lvl >= 2){ g.L(h.smooth([[300, 800], [300, 680], [310, 620]], true)); g.S(h.scallop(310, 600, g.at(50, 60, 0), 8, .2)); g.S(h.circle(310, 600, 20)); }
});

C.define({ id:"dragonfly-reeds", title:"The Dragonfly", cat:"wildlife-nature", season:"summer",
  tags:["dragonflies", "ponds", "reeds", "summer"], sensitive:["water"], talk:"What do you enjoy about a summer afternoon outdoors?" }, function(g){
  /* reed blades rising from the ground: tall behind the wings at Tier 1,
     below them at Tiers 2 and 3 so no blade is cut into small pieces */
  var reeds = g.at([[120, 300], [180, 200], [460, 260], [520, 340]], [[110, 500], [170, 560], [440, 540], [500, 480]], [[130, 520], [470, 500]]), bw = g.at(16, 20, 26);
  reeds.forEach(function(r){ var lean = r[0] < 300 ? -24 : 24; g.S(h.path([r[0] - bw, 800]).Q([r[0] - bw * .6, (800 + r[1]) / 2], [r[0] + lean, r[1]]).Q([r[0] + bw * .9, (800 + r[1]) / 2], [r[0] + bw, 800]).Z()); });
  if (g.lvl >= 2) g.at([[250, 330], [370, 300]], [[260, 580], [360, 560]]).forEach(function(c){ g.L(h.line([c[0], 800], [c[0], c[1] + 80])); g.S(h.rrect(c[0] - 18, c[1], 36, 90, 18)); });
  g.group({ x:300, y:380, s:g.at(1, 1.1, 1.2), rot:-8 }, function(g){
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function(q){
      var wing = q[1] < 0 ? [[0, -6], [80 * q[0], -60], [230 * q[0], -70], [250 * q[0], -40], [120 * q[0], -8]] : [[0, 6], [80 * q[0], 30], [210 * q[0], 60], [230 * q[0], 34], [110 * q[0], 8]];
      g.S(h.smooth(wing));
      g.D(h.smooth([[10 * q[0], 0], [120 * q[0], q[1] < 0 ? -40 : 26], [220 * q[0], q[1] < 0 ? -52 : 42]], true));
    });
    var hw = g.at(10, 13, 16);
    g.S(h.smooth([[0, 36], [hw, 80], [hw - 1, 250], [0, 272], [1 - hw, 250], [-hw, 80]]));
    g.S(h.rrect(-hw - 8, -24, 2 * hw + 16, 66, 16));
    g.S(h.circle(0, -44, g.at(22, 26, 30)));
    if (g.lvl >= 3) [90, 140, 190, 230].forEach(function(yy){ g.D(h.line([-9, yy], [9, yy])); });
  });
});

C.define({ id:"koi-pond", title:"Koi in the Pond", cat:"wildlife-nature",
  tags:["fish", "koi", "ponds", "calm"], sensitive:["water"], talk:"What is a peaceful sound you enjoy?" }, function(g){
  var koi = function(x, y, s, rot){
    g.group({ x:x, y:y, s:s, rot:rot }, function(g){
      g.S(h.smooth([[-140, 0], [-200, -60], [-236, -54], [-196, 0], [-240, 60], [-196, 60]]));
      g.S(h.smooth([[20, -48], [-20, -96], [-90, -92], [-70, -40]]));
      g.S(h.smooth([[40, 38], [10, 90], [-30, 90], [-10, 40]]), 1);
      g.S(h.smooth([[150, 0], [130, -34], [60, -54], [-40, -44], [-150, 0], [-40, 40], [60, 52], [130, 32]]));
      g.S(h.smooth([[60, 36], [40, 100], [0, 110], [10, 60]]), 2);
      g.K(h.circle(112, -12, 7));
      if (g.lvl >= 2) g.D(h.path([90, -40]).Q([70, 0], [90, 40]).open());
      if (g.lvl >= 3) [[30, -14], [-30, 10], [-90, -4]].forEach(function(p){ g.D(h.smooth([[p[0] - 22, p[1] - 12], [p[0], p[1] - 20], [p[0] + 22, p[1] - 8], [p[0] + 16, p[1] + 14], [p[0] - 16, p[1] + 12]])); });
      if (g.lvl >= 2){ g.D(h.line([-190, -2], [-150, 0]), 3); }
    });
  };
  if (g.lvl >= 2) [[130, 680, 80], [480, 170, 70]].forEach(function(p){ g.S(h.path([p[0], p[1]]).L([p[0] + p[2], p[1] - 16]).A(p[0], p[1], p[2], -12, 330).Z()); });
  koi(320, 260, g.at(1.2, 1.3, 1.45), 16);
  koi(280, 560, g.at(1.2, 1.3, 1.45), 196);
  if (g.lvl >= 3) [[110, 110], [520, 720], [80, 420]].forEach(function(c){ g.D(h.circle(c[0], c[1], 22)); });
});

C.define({ id:"sea-turtle", title:"The Sea Turtle", cat:"wildlife-nature",
  tags:["turtles", "ocean", "shore"], sensitive:["water"], talk:"What is your favorite thing about the seaside?" }, function(g){
  g.S(h.smooth([[180, 300], [100, 200], [60, 170], [120, 180], [200, 250]]));
  g.S(h.smooth([[420, 300], [500, 200], [540, 170], [480, 180], [400, 250]]));
  g.S(h.smooth([[210, 560], [150, 640], [160, 660], [240, 600]]));
  g.S(h.smooth([[390, 560], [450, 640], [440, 660], [360, 600]]));
  g.S(h.smooth([[300, 120], [340, 140], [350, 200], [300, 230], [250, 200], [260, 140]]));
  g.K(h.circle(276, 170, 7)); g.K(h.circle(324, 170, 7));
  g.S(h.smooth([[300, 200], [420, 240], [460, 400], [400, 600], [300, 640], [200, 600], [140, 400], [180, 240]]));
  var plates = g.at(2, 1, 0);
  if (plates >= 1){ g.L(h.ngon(300, 400, 70, 6, 30)); [30, 90, 150, 210, 270, 330].forEach(function(a){ g.L(h.line(h.onCircle(300, 400, 70, a), h.onCircle(300, 400, 150, a))); }); }
  else { g.L(h.ngon(300, 410, 96, 6, 30)); }
  if (plates >= 2) g.D(h.smooth([[200, 260], [300, 240], [400, 260]], true));
  g.S(h.path([280, 636]).L([300, 690]).L([320, 636]).Z());
});

C.define({ id:"seashells", title:"Seashells on the Shore", cat:"wildlife-nature", season:"summer",
  tags:["shells", "beach", "shore", "summer"], sensitive:["water"], talk:"What would you collect on a walk along the shore?" }, function(g){
  var scallop = function(x, y, s, ribs){
    g.group({ x:x, y:y, s:s }, function(g){
      g.S(h.path([-40, 60]).L([-60, 90]).L([60, 90]).L([40, 60]).Z());
      var pts = [[0, 70]]; for (var i = 0; i <= 12; i++){ var a = -160 + i * (140 / 12); pts.push(h.onCircle(0, 70, i % 2 ? 150 : 160, a)); }
      g.S(h.smooth(pts, false, .6));
      for (var k = 1; k < ribs; k++){ var a2 = -160 + k * 140 / ribs; g.L(h.line([0, 70], h.onCircle(0, 70, 150, a2))); }
    });
  };
  scallop(g.at(210, 230, 300), g.at(240, 260, 300), g.at(1, 1.2, 1.6), g.at(9, 7, 5));
  if (g.lvl >= 2){
    g.group({ x:420, y:470, s:g.at(1, 1.1, 1) }, function(g){
      g.S(h.smooth([[0, -120], [60, -80], [80, 0], [40, 100], [0, 120], [-50, 80], [-60, 0], [-30, -60]]));
      g.L(h.smooth([[0, -120], [20, -60], [0, 0], [-20, 60], [0, 110]], true));
      g.D(h.smooth([[-50, -30], [0, -40], [60, -20]], true)); g.D(h.smooth([[-58, 30], [0, 20], [70, 40]], true), 3);
    });
  }
  if (g.lvl >= 2){ g.S(h.circle(170, 580, 90)); for (var p = 0; p < 5; p++) g.S(h.petal(170, 580, -90 + p * 72, 12, 60, 34, "oval")); g.S(h.circle(170, 580, 10)); }
  if (g.lvl >= 3) g.S(h.star(470, 680, 70, 28, 5));
  g.L(h.smooth([[20, 740], [200, 720], [400, 750], [580, 730]], true), 3);
});

C.define({ id:"nautilus-shell", title:"The Nautilus Shell", cat:"wildlife-nature",
  tags:["shells", "spirals", "ocean", "patterns"], sensitive:["water"], talk:"What treasures would you keep on a windowsill?" }, function(g){
  var cx = 300, cy = 420, a0 = 0.18, k = 0.19, turns = 2.4, pts = [];
  var R = function(t){ return 18 * Math.exp(k * t); };
  var maxT = turns * 2 * Math.PI;
  for (var t = 0; t <= maxT; t += 0.12){ pts.push([cx + R(t) * Math.cos(t), cy + R(t) * Math.sin(t)]); }
  var outer = [];
  for (var t2 = maxT - 2 * Math.PI; t2 <= maxT; t2 += 0.12) outer.push([cx + R(t2) * Math.cos(t2), cy + R(t2) * Math.sin(t2)]);
  g.S(h.smooth(outer.concat([[cx + R(maxT - 2 * Math.PI) * Math.cos(maxT - 2 * Math.PI), cy + R(maxT - 2 * Math.PI) * Math.sin(maxT - 2 * Math.PI)]]), false, .9));
  g.L(h.smooth(pts, true, .9));
  var n = g.at(14, 10, 6);
  for (var i = 1; i <= n; i++){ var tt = maxT - 2 * Math.PI + i * 2 * Math.PI / (n + 1); var inner = [cx + R(tt - 2 * Math.PI) * Math.cos(tt), cy + R(tt - 2 * Math.PI) * Math.sin(tt)], out = [cx + R(tt) * Math.cos(tt), cy + R(tt) * Math.sin(tt)]; g.L(h.path(inner).Q(h.lerp(inner, out, .5).map(function(v, j){ return v + (j ? -14 : 14); }), out).open()); }
});

C.define({ id:"garden-rabbit", title:"The Garden Rabbit", cat:"wildlife-nature", season:"spring",
  tags:["rabbits", "gardens", "spring", "clover"], talk:"What animals have you seen visiting a garden?" }, function(g){
  if (g.lvl >= 2) [[120, 740], [470, 750], [520, 700]].forEach(function(c, i){ g.L(h.line([c[0], 780], [c[0], c[1]])); [0, 120, 240].forEach(function(a){ g.S(h.petal(c[0], c[1] - 30, a - 90, 0, 36, 34, "round")); }); });
  g.S(h.smooth([[180, 700], [140, 620], [150, 520], [210, 450], [300, 420], [370, 440], [400, 520], [390, 620], [420, 690], [380, 720], [300, 720]]));
  g.S(h.circle(150, 600, 36));
  g.S(h.smooth([[330, 440], [310, 380], [330, 320], [380, 290], [440, 300], [470, 340], [466, 390], [430, 420], [380, 440]]));
  g.S(h.smooth([[372, 300], [340, 200], [336, 120], [362, 110], [390, 180], [396, 290]]));
  g.S(h.smooth([[400, 300], [410, 200], [430, 130], [456, 136], [446, 220], [420, 304]]));
  if (g.lvl >= 2){ g.D(h.smooth([[356, 280], [352, 190], [360, 140]], true)); g.D(h.smooth([[412, 280], [424, 200], [440, 150]], true)); }
  g.K(h.circle(420, 350, 8));
  g.S(h.ellipse(468, 380, 9, 7));
  g.S(h.smooth([[340, 700], [360, 640], [420, 650], [440, 700], [400, 720]]));
  if (g.lvl >= 2) g.D(h.path([230, 560]).Q([260, 640], [230, 700]).open());
  g.L(h.line([60, 722], [540, 722]), 3);
});

C.define({ id:"sleeping-cat", title:"The Cat on the Cushion", cat:"wildlife-nature",
  tags:["cats", "pets", "naps", "home"], talk:"Where is the coziest spot in a house for a nap?" }, function(g){
  g.S(h.rrect(60, 560, 480, 150, 60));
  if (g.lvl >= 2){ [[60, 600], [540, 600], [60, 680], [540, 680]].forEach(function(c){ g.S(h.circle(c[0], c[1], 18)); }); g.D(h.path([100, 620]).Q([300, 600], [500, 620]).open()); }
  g.S(h.smooth([[110, 580], [120, 470], [220, 380], [360, 370], [470, 420], [510, 510], [490, 580], [300, 600]]));
  g.S(h.smooth([[120, 570], [150, 610], [300, 620], [450, 600], [500, 560], [470, 590], [300, 600], [160, 590]]));
  g.S(h.poly(g.at([[120, 420], [118, 318], [184, 384]], [[120, 420], [118, 318], [184, 384]], [[110, 426], [104, 290], [198, 380]])));
  g.S(h.poly(g.at([[184, 388], [230, 304], [246, 408]], [[184, 388], [230, 304], [246, 408]], [[176, 394], [238, 280], [258, 414]])));
  g.S(h.smooth([[130, 470], [110, 420], [140, 380], [200, 370], [240, 400], [230, 470], [180, 500]]));
  if (g.lvl >= 2){ g.D(h.path([150, 440]).Q([162, 450], [176, 440]).open(), 1); g.D(h.path([196, 436]).Q([208, 446], [222, 436]).open(), 1); }
  g.S(h.ellipse(180, 468, 8, 6));
  if (g.lvl >= 2){ g.D(h.path([280, 400]).Q([320, 460], [300, 540]).open()); g.D(h.path([380, 400]).Q([420, 470], [400, 540]).open(), 3); }
});

C.define({ id:"faithful-dog", title:"The Faithful Dog", cat:"wildlife-nature",
  tags:["dogs", "pets", "companions", "home"], talk:"What makes a dog a good companion?" }, function(g){
  if (g.lvl >= 2) g.S(h.ellipse(330, 612, 250, 40));
  if (g.lvl >= 3) g.D(h.ellipse(330, 612, 200, 24));
  g.S(h.smooth([[200, 580], [130, 600], [70, 590], [80, 606], [140, 616], [210, 600]]));
  g.S(h.smooth([[528, 192], [510, 222], [470, 240], [432, 262], [428, 340], [424, 420], [432, 520], [436, 590], [474, 598], [476, 614], [400, 614], [396, 540],
    [392, 470], [352, 488], [326, 520], [336, 596], [340, 614], [230, 614], [196, 580], [186, 500], [206, 420], [250, 340], [300, 280], [344, 230],
    [362, 196], [376, 160], [398, 130], [428, 122], [456, 136], [476, 160], [504, 172], [524, 178]]));
  g.S(h.smooth([[396, 136], [422, 150], [420, 210], [400, 246], [376, 226], [378, 164]]));
  g.K(h.circle(456, 170, 8));
  g.K(h.ellipse(522, 190, 11, 9));
  if (g.lvl >= 2){ g.S(h.path([352, 222]).Q([390, 248], [432, 250]).L([430, 272]).Q([386, 270], [344, 244]).Z()); g.S(h.circle(400, 280, 12)); }
  g.L(h.smooth([[326, 520], [290, 560], [300, 612]], true));
  if (g.lvl >= 2) g.D(h.smooth([[240, 420], [270, 500], [250, 560]], true));
});

C.define({ id:"proud-rooster", title:"The Proud Rooster", cat:"wildlife-nature",
  tags:["roosters", "farms", "mornings"], talk:"What time do you like to get up in the morning?" }, function(g){
  g.S(h.rect(40, 690, 520, 34));
  if (g.lvl >= 2) [100, 300, 500].forEach(function(x){ g.S(h.rect(x - 14, 724, 28, 76)); });
  var tail = g.at([[-70, 180], [-50, 200], [-30, 215], [-10, 225]], [[-60, 190], [-30, 212], [-8, 226]], [[-40, 205]]);
  tail.forEach(function(t, i){ g.S(h.path([240, 470]).C([150, 400], [120, 300], [160 + t[0], 220 - i * 20]).C([180 + t[0], 300], [220, 380], [270, 440]).Z()); });
  g.S(h.smooth([[260, 620], [200, 560], [200, 470], [270, 400], [350, 380], [390, 300], [400, 220], [440, 190], [480, 210], [490, 270], [470, 340], [450, 420], [420, 520], [360, 600]]));
  g.S(h.path([416, 204]).C([400, 170], [420, 146], [436, 168]).C([436, 136], [466, 130], [470, 160]).C([480, 136], [510, 150], [496, 190]).C([506, 196], [504, 214], [486, 214]).Z());
  g.S(h.smooth(g.at([[486, 270], [500, 300], [486, 330], [470, 300]], [[486, 268], [504, 302], [486, 336], [468, 302]], [[484, 262], [512, 304], [486, 350], [460, 304]])));
  g.S(h.poly([[488, 236], [530, 250], [488, 262]]));
  g.K(h.circle(462, 234, 7));
  g.S(h.smooth([[280, 450], [340, 440], [390, 500], [360, 560], [280, 540]]));
  if (g.lvl >= 2){ g.D(h.path([300, 470]).Q([350, 480], [370, 530]).open()); g.D(h.smooth([[390, 300], [420, 360], [400, 420]], true), 3); }
  g.L(h.line([300, 610], [290, 692])); g.L(h.line([350, 600], [360, 692]));
});

C.define({ id:"pine-cones", title:"Pine Cones and Boughs", cat:"wildlife-nature", season:"winter",
  tags:["pine", "woods", "winter", "evergreens"], talk:"What does a pine forest smell like to you?" }, function(g){
  var B = [[30, 200], [200, 240], [380, 250], [570, 220]], th = g.at(22, 30, 40);
  var cones = g.lvl >= 2 ? [[230, 270, g.at(1, 1.15, 1.4), 1], [420, 290, .9, 2]] : [[230, 270, 1.4, 1]];
  cones.forEach(function(c){ g.L(h.line([c[0], bez(B[0], B[1], B[2], B[3], (c[0] - 30) / 540)[1] + th / 2], [c[0], c[1] + 4]), c[3]); });   // stems, under the bough
  bough(g, B[0], B[1], B[2], B[3], th, g.at(19, 13, 0), 70);
  /* a cone hanging from its stem: an outline from a half-width profile, and
     rows of scales as scalloped lines that end exactly on that outline */
  var W = function(t){ return 82 * Math.pow(Math.sin(Math.PI * t), .6) * (1 - .22 * t); }, CL = 290;
  var cone = function(x, y, s, lv){ g.group({ x:x, y:y, s:s }, function(g){
    var side = []; for (var k = 1; k < 16; k++) side.push([W(k / 16), k / 16 * CL]);
    g.S(h.smooth([[0, 0]].concat(side, [[0, CL]], side.slice().reverse().map(function(p){ return [-p[0], p[1]]; }))), lv);
    var rows = g.at(6, 4, 3), m = g.at(3, 3, 2), dip = CL / (rows + 1) * .42;
    for (var r = 1; r <= rows; r++){
      var t = r / (rows + 1), yy = t * CL, w = W(t), p = h.path([-w, yy]);
      for (var i = 0; i < m; i++){ var x0 = -w + 2 * w * i / m, x1 = -w + 2 * w * (i + 1) / m; p.Q([(x0 + x1) / 2, yy + 2 * dip], [x1, yy]); }
      g.L(p.open(), lv);
    }
  }); };
  cones.forEach(function(c){ cone(c[0], c[1], c[2], c[3]); });
});

C.define({ id:"mountain-lake", title:"The Mountain Lake", cat:"wildlife-nature", fit:"page",
  tags:["mountains", "lakes", "landscapes", "travel"], sensitive:["water"], talk:"Where is a place you would like to visit again?" }, function(g){
  kit.frame(g);
  if (g.lvl >= 2) g.S(h.circle(120, 150, 44));
  g.S(h.poly([[24, 470], [180, 180], [300, 380], [400, 220], [576, 470]]));
  g.S(h.poly([[140, 254], [180, 180], [222, 256], [196, 244], [180, 270], [162, 244]]), 2);
  g.S(h.poly([[362, 290], [400, 220], [440, 290], [418, 280], [400, 300], [382, 280]]), 2);
  if (g.lvl >= 3) g.S(h.poly([[240, 470], [330, 320], [430, 470]]));
  g.S(h.path([24, 470]).L([576, 470]).L([576, 560]).L([24, 560]).Z());
  if (g.lvl >= 2){ g.D(h.line([120, 500], [240, 500])); g.D(h.line([330, 530], [480, 530])); }
  g.S(h.path([24, 560]).C([200, 540], [400, 580], [576, 550]).L([576, 776]).L([24, 776]).Z());
  var pine = function(x, y, s){ g.group({ x:x, y:y, s:s }, function(g){ g.S(h.rect(-10, -20, 20, 40)); g.S(h.poly([[0, -200], [70, -20], [-70, -20]])); if (g.lvl >= 2){ g.L(h.line([-40, -90], [40, -90])); } }); };
  pine(110, 700, g.at(1, 1.1, 1.2)); if (g.lvl >= 2) pine(480, 700, .9); if (g.lvl >= 3) pine(190, 720, .7);
});
})(globalThis.CogniCore);

/* ---------- packs.js ---------- */
/* CogniCore coloring packs: themed bundles of designs that print together
   at one tier (a resident's own, or the pack's recommendation). A design
   can sit in several packs. Add a pack by listing design ids; the checks
   (scripts/check-coloring.mjs) confirm every id exists. */
(function(C){
"use strict";
function pack(id, title, theme, about, designs, tier){ C.definePack({ id:id, title:title, theme:theme, about:about, designs:designs, tier:tier || 0 }); }

/* Classic vehicles */
pack("sunday-drive", "Sunday Drive", "classic-vehicles", "Cars made for a slow drive: the sedan, the convertible, the woody wagon and a scooter.",
  ["sunday-sedan", "convertible", "woody-wagon", "motor-scooter"]);
pack("working-wheels", "Working Wheels", "classic-vehicles", "Trucks and machines that did the day's work: the pickup, the bakery truck, the fire engine and the tractor.",
  ["farm-pickup", "bread-truck", "fire-engine", "farm-tractor"]);
pack("rails-and-roads", "Rails and Roads", "classic-vehicles", "Ways to get across town or across the country: the steam train, the streetcar and a bicycle.",
  ["steam-locomotive", "streetcar", "bread-truck", "vintage-bicycle"]);
pack("on-the-water", "On the Water", "classic-vehicles", "Boats and the places they sail from.",
  ["lake-sailboat", "tugboat", "lighthouse", "swan-lake"]);
pack("up-in-the-sky", "Up in the Sky", "classic-vehicles", "Things that fly or turn in the wind.",
  ["biplane", "hot-air-balloon", "farm-windmill", "monarch-butterfly"]);

/* Botanical and garden */
pack("spring-garden", "The Spring Garden", "botanical-garden", "The first flowers and visitors of spring.",
  ["tulips-vase", "daffodils", "magnolia-branch", "robin-fence", "bluebird-house"]);
pack("rose-garden", "The Rose Garden", "botanical-garden", "Roses, the gate they climb and the can that waters them.",
  ["garden-rose", "garden-gate", "watering-can", "porch-geranium"]);
pack("summer-blooms", "Summer Blooms", "botanical-garden", "Big, bright summer flowers.",
  ["sunflower", "poppies", "daisy-jar", "dahlia", "hydrangea"]);
pack("flowers-for-the-table", "Flowers for the Table", "botanical-garden", "Cut flowers and a table set for guests.",
  ["tulips-vase", "calla-lilies", "daisy-jar", "table-setting"]);
pack("autumn-leaves", "Autumn Leaves", "botanical-garden", "Leaves, acorns, apples and pumpkins of the fall.",
  ["autumn-maple", "oak-acorns", "pumpkin-patch", "apple-branch"]);
pack("orchard-harvest", "The Orchard Harvest", "botanical-garden", "Fruit from the tree, the patch and the jar.",
  ["apple-branch", "fruit-bowl", "strawberries", "canning-jars", "harvest-basket"]);
pack("kitchen-garden", "The Kitchen Garden", "botanical-garden", "Herbs and vegetables grown for the table.",
  ["windowsill-herbs", "harvest-basket", "potting-bench", "garden-wheelbarrow"]);
pack("garden-tools", "In the Garden Shed", "botanical-garden", "The tools of a good garden.",
  ["watering-can", "garden-wheelbarrow", "potting-bench", "garden-gate"]);
pack("water-garden", "The Water Garden", "botanical-garden", "Lilies, koi and the life of a quiet pond.",
  ["water-lily", "koi-pond", "dragonfly-reeds", "swan-lake"]);

/* Nostalgic heritage */
pack("grandmothers-kitchen", "Grandmother's Kitchen", "nostalgic-heritage", "Teapots, percolators, mixers and jars from a well-used kitchen.",
  ["teapot-and-cup", "coffee-percolator", "stand-mixer", "chrome-toaster", "wood-cookstove", "canning-jars"]);
pack("the-parlor", "The Parlor", "nostalgic-heritage", "The radio, the phonograph and a chair by the lamp.",
  ["cathedral-radio", "phonograph", "rocking-chair", "oil-lamp", "grandfather-clock"]);
pack("timepieces", "Timepieces", "nostalgic-heritage", "Clocks and a watch, with plain faces and bold hands.",
  ["grandfather-clock", "schoolhouse-clock", "pocket-watch"]);
pack("sewing-room", "The Sewing Room", "nostalgic-heritage", "Machines, baskets and the quilts they made.",
  ["sewing-machine", "sewing-basket", "knitting-basket", "quilt-nine-patch"]);
pack("keeping-in-touch", "Keeping in Touch", "nostalgic-heritage", "Telephones, typewriters, letters and the mailbox at the end of the lane.",
  ["rotary-telephone", "typewriter", "rural-mailbox", "letter-writing", "box-camera"]);
pack("down-on-the-farm", "Down on the Farm", "nostalgic-heritage", "The barn, the windmill, the churn and the rooster.",
  ["red-barn", "farm-windmill", "butter-churn", "milk-bottles", "proud-rooster", "farm-tractor"]);
pack("front-porch", "The Front Porch", "nostalgic-heritage", "A swing, a rocker, a potted geranium and good company.",
  ["porch-swing", "rocking-chair", "porch-geranium", "faithful-dog", "sleeping-cat"]);
pack("landmarks", "Landmarks", "nostalgic-heritage", "Lighthouses, covered bridges, barns and mountain lakes.",
  ["lighthouse", "covered-bridge", "red-barn", "farm-windmill", "mountain-lake"]);
pack("good-morning", "Good Morning", "nostalgic-heritage", "Milk on the step, the paper, coffee and toast.",
  ["milk-bottles", "bread-truck", "sunday-paper", "coffee-percolator", "chrome-toaster"]);

/* Wildlife and nature */
pack("backyard-birds", "Backyard Birds", "wildlife-nature", "Cardinals, robins, chickadees, bluebirds and a hummingbird.",
  ["cardinal-branch", "robin-fence", "chickadee-pine", "bluebird-house", "hummingbird"]);
pack("butterfly-garden", "The Butterfly Garden", "wildlife-nature", "Flowers and the wings that visit them.",
  ["monarch-butterfly", "hummingbird", "sunflower", "dahlia", "dragonfly-reeds"]);
pack("pond-life", "Pond Life", "wildlife-nature", "Ducks, swans, koi and dragonflies.",
  ["mallard-duck", "swan-lake", "koi-pond", "dragonfly-reeds", "water-lily"]);
pack("seashore", "The Seashore", "wildlife-nature", "Shells, a sea turtle and the lighthouse on the point.",
  ["seashells", "nautilus-shell", "sea-turtle", "lighthouse", "tugboat"]);
pack("faithful-companions", "Faithful Companions", "wildlife-nature", "A dog, a cat and a rabbit in the garden.",
  ["faithful-dog", "sleeping-cat", "garden-rabbit"]);
pack("woodland-walk", "A Woodland Walk", "wildlife-nature", "Owls, pine cones, oak leaves and a mountain lake.",
  ["barn-owl", "pine-cones", "oak-acorns", "mountain-lake", "chickadee-pine"]);
pack("farmyard", "The Farmyard", "wildlife-nature", "The rooster, the barn and the animals around it.",
  ["proud-rooster", "red-barn", "faithful-dog", "garden-rabbit", "butter-churn"]);

/* Bold and easy patterns */
pack("quilting-bee-stars", "Quilting Bee: Stars", "bold-easy-patterns", "Star quilt blocks: Ohio Star, Sawtooth Star, Friendship Star and Churn Dash.",
  ["quilt-ohio-star", "quilt-sawtooth-star", "quilt-friendship-star", "quilt-churn-dash"]);
pack("quilting-bee-classics", "Quilting Bee: Classics", "bold-easy-patterns", "Everyday blocks: Nine Patch, Pinwheel, Log Cabin, Rail Fence and Flying Geese.",
  ["quilt-nine-patch", "quilt-pinwheel", "quilt-log-cabin", "quilt-rail-fence", "quilt-flying-geese"]);
pack("heirloom-quilts", "Heirloom Quilts", "bold-easy-patterns", "The quilts that get handed down.",
  ["quilt-grandmothers-garden", "quilt-dresden-plate", "quilt-log-cabin", "quilt-ohio-star"]);
pack("calm-circles", "Calm Circles", "bold-easy-patterns", "Rosettes, medallions and a compass: round, even and calm.",
  ["garden-rosette", "lotus-medallion", "compass-rose", "sunburst-medallion", "kaleidoscope"]);
pack("glass-and-tile", "Glass and Tile", "bold-easy-patterns", "Stained glass, scallops, honeycomb, trellis and fans.",
  ["stained-glass-window", "fish-scale-tiles", "honeycomb", "quatrefoil-lattice", "art-deco-fans"]);
pack("easy-bold-starter", "Easy Bold Starter", "bold-easy-patterns", "Big, clear patterns with only a few areas each, for a first session or a tired day.",
  ["sunburst-medallion", "quilt-nine-patch", "honeycomb", "garden-rosette", "compass-rose"], 3);

/* Home and everyday tasks */
pack("tea-time", "Tea Time", "home-everyday", "Cups, pots, a laid table and something baked.",
  ["tea-for-two", "teapot-and-cup", "table-setting", "baking-day"]);
pack("baking-day", "Baking Day", "home-everyday", "Pies, mixers, the cookstove and the fruit that goes in.",
  ["baking-day", "stand-mixer", "wood-cookstove", "apple-branch", "canning-jars"]);
pack("needle-arts", "Needle Arts", "home-everyday", "Knitting, sewing and the quilts they make.",
  ["knitting-basket", "sewing-basket", "sewing-machine", "quilt-dresden-plate"]);
pack("letter-day", "A Letter Day", "home-everyday", "Writing, typing, calling and the mailbox.",
  ["letter-writing", "rural-mailbox", "typewriter", "rotary-telephone"]);
pack("picnic-in-the-park", "A Picnic in the Park", "home-everyday", "A basket, berries, a sailboat and a bicycle ride.",
  ["picnic-basket", "strawberries", "lake-sailboat", "vintage-bicycle"]);
pack("gone-fishing", "Gone Fishing", "home-everyday", "A quiet day on the water.",
  ["gone-fishing", "lake-sailboat", "mountain-lake", "tugboat"]);
pack("wash-day", "Wash Day and Rest", "home-everyday", "Laundry on the line, the iron, the sewing basket and the porch swing after.",
  ["clothesline", "ironing-day", "sewing-basket", "porch-swing"]);
pack("game-night", "Game Night", "home-everyday", "Cards, dominoes, music and tea with friends.",
  ["cards-and-dominoes", "cathedral-radio", "phonograph", "tea-for-two"]);
pack("keeping-house", "Keeping House", "home-everyday", "The work of a home, done well.",
  ["table-setting", "baking-day", "clothesline", "ironing-day", "knitting-basket"]);

/* The four seasons */
pack("season-spring", "Spring", "seasons", "Tulips, daffodils, blossoms, robins and a rabbit in the garden.",
  ["tulips-vase", "daffodils", "magnolia-branch", "robin-fence", "bluebird-house", "garden-rabbit"]);
pack("season-summer", "Summer", "seasons", "Sunflowers, poppies, butterflies, picnics and sailing.",
  ["sunflower", "poppies", "monarch-butterfly", "picnic-basket", "lake-sailboat", "convertible"]);
pack("season-autumn", "Autumn", "seasons", "Maple leaves, pumpkins, apples, acorns and the harvest.",
  ["autumn-maple", "pumpkin-patch", "apple-branch", "oak-acorns", "harvest-basket", "canning-jars"]);
pack("season-winter", "Winter", "seasons", "Cardinals, chickadees, snowflakes, pine cones and a warm stove.",
  ["cardinal-branch", "chickadee-pine", "snowflake-medallion", "pine-cones", "wood-cookstove", "quilt-log-cabin"]);

/* Decades */
pack("decade-1930s-1940s", "The 1930s and 1940s", "decades", "Steam trains, cathedral radios, biplanes, streetcars and typewriters.",
  ["steam-locomotive", "cathedral-radio", "biplane", "streetcar", "farm-tractor", "typewriter", "woody-wagon"]);
pack("decade-1950s", "The 1950s", "decades", "Tail fins, rotary telephones, chrome toasters and the milkman.",
  ["sunday-sedan", "rotary-telephone", "chrome-toaster", "stand-mixer", "milk-bottles", "motor-scooter"]);

/* Therapeutic focus */
pack("calming-patterns", "Calming Patterns", "focus", "Structured, repeating patterns for a calm, settled session.",
  ["garden-rosette", "lotus-medallion", "fish-scale-tiles", "honeycomb", "quilt-grandmothers-garden"]);
pack("conversation-starters", "Conversation Starters", "focus", "Familiar objects that invite a story: the telephone, the car, the table, the letter, the dog and the barn.",
  ["rotary-telephone", "sunday-sedan", "table-setting", "letter-writing", "faithful-dog", "red-barn"]);
pack("big-and-bold", "Big and Bold", "focus", "One big shape per page in the heaviest lines, for residents who need the simplest, clearest pages.",
  ["sunflower", "teapot-and-cup", "monarch-butterfly", "sunburst-medallion", "lake-sailboat", "garden-rose"], 3);
pack("fine-motor-practice", "Fine-Motor Practice", "focus", "Pages with more, smaller areas, for residents who enjoy detailed work.",
  ["quilt-ohio-star", "daisy-jar", "art-deco-fans", "steam-locomotive", "typewriter", "hydrangea"], 1);
pack("guided-focus-mix", "Guided Focus Mix", "focus", "A balanced set of subjects with a few guiding lines, one from each theme.",
  ["tulips-vase", "farm-pickup", "cathedral-radio", "barn-owl", "quilt-pinwheel", "knitting-basket"], 2);
})(globalThis.CogniCore);

/* ---------- prompts.js ---------- */
/* =====================================================================
   COGNICORE PROMPT ENGINE AND DIGNITY FILTER
   Builds strict line-art prompts for image generators (Midjourney, Stable
   Diffusion, DALL-E 3) so new artwork arrives already close to the
   CogniCore print standard, and checks any title, tag, caption or prompt
   for childish, quizzing or talking-down language.

   Nothing here calls a generator or any other service: it only writes
   text. Staff paste a prompt into the tool they use, or run
   scripts/coloring_prompts.mjs for a batch, then bring the images back in
   with scripts/ingest_coloring_assets.mjs, which checks and normalizes
   them and holds them for review before they reach any resident.
   Runs as a plain browser script and in Node (vm).
   ===================================================================== */
(function(root){
"use strict";

var POSITIVE = "Ultra-bold black line art coloring page for adults, {SUBJECT}, thick high-contrast clean black outlines, white background, no shading, no gradients, clean vector art style, simple focal point, 3:4 aspect ratio, dignity-first senior coloring book";
var NEGATIVE = ["shading", "grayscale", "color", "realistic photo", "thin lines", "cluttered background", "extra limbs", "childish", "cartoon faces", "tiny details", "noise", "texture", "blur"];
/* What each tier asks of the picture, in words a generator follows. */
var TIER_WORDS = {
  1: { add:"moderate detail, 30 to 60 clearly closed areas to color, uniform bold lines", neg:[] },
  2: { add:"one clear subject with a few guiding interior lines, 12 to 30 large closed areas, extra-bold uniform lines", neg:["busy background"] },
  3: { add:"a single large subject filling the page, only 4 to 12 very large closed areas, extra-thick outlines, nothing in the background", neg:["background scenery", "small parts", "fine interior lines", "text"] }
};
var GENERATORS = {
  "midjourney":       { label:"Midjourney",             note:"Paste into /imagine. --ar sets the 3:4 page; --no lists what to leave out." },
  "stable-diffusion": { label:"Stable Diffusion / SDXL", note:"Put the negative prompt in its own box. 1536 x 2048 keeps the 3:4 page." },
  "dall-e-3":         { label:"DALL-E 3",               note:"DALL-E has no negative prompt, so the things to avoid are written into the request." }
};

/* Build the prompt for one subject at one tier. */
function build(subject, tier, generator){
  tier = TIER_WORDS[tier] ? tier : 2;
  var subj = String(subject || "").replace(/\s+/g, " ").trim().replace(/[.]+$/, "");
  var positive = POSITIVE.replace("{SUBJECT}", subj) + ", " + TIER_WORDS[tier].add;
  var negative = NEGATIVE.concat(TIER_WORDS[tier].neg);
  var out = { subject:subj, tier:tier, positive:positive, negative:negative };
  out.text = format(out, generator || "midjourney");
  return out;
}
function format(p, generator){
  if (generator === "stable-diffusion") return "Prompt: " + p.positive + "\nNegative prompt: " + p.negative.join(", ") + "\nSize: 1536 x 2048 (3:4)";
  if (generator === "dall-e-3") return p.positive + ". Avoid: " + p.negative.join(", ") + ". A tall portrait page, 3:4.";
  return p.positive + " --ar 3:4 --no " + p.negative.join(", ");
}
/* All three generators at once, for a design or a free subject. */
function buildAll(subject, tier){
  var base = build(subject, tier), out = { subject:base.subject, tier:base.tier, positive:base.positive, negative:base.negative, prompts:{} };
  Object.keys(GENERATORS).forEach(function(k){ out.prompts[k] = format(base, k); });
  return out;
}

/* ---------- dignity-first filter ----------
   Words that make an adult's page read as a child's, memory-quiz openings
   that test rather than invite, and pet names that talk down. Checked on
   subjects, titles, tags and captions: never on the negative prompt, which
   names these things on purpose to keep them out. */
var JUVENILE = ["cute", "cutesy", "kawaii", "chibi", "cartoon", "cartoonish", "cartoony", "baby", "babies", "toddler", "nursery", "kiddie", "kiddy", "kids",
  "for children", "children's", "childish", "childlike", "smiley", "smiling face", "happy face", "funny face", "silly", "googly", "teddy", "teddy bear", "unicorn",
  "princess", "fairy", "fairies", "clown", "emoji", "mascot", "anime", "manga", "big eyes", "puppy eyes", "doodle", "cupcake", "lollipop", "kitty", "doggy", "bunny", "piggy", "ducky"];
var QUIZ = ["do you remember", "can you remember", "don't you remember", "try to remember", "remember when", "what year was", "can you name", "name the", "quiz", "test your"];
var ELDERSPEAK = ["sweetie", "dearie", "sweetheart", "good girl", "good boy", "little old", "oldie", "golden oldie", "young lady", "young man"];
/* pet names that are also ordinary words (honey, dear, hon) count only when
   they address someone: "Thank you, honey." but not "sweeten with honey" */
var VOCATIVE = /(?:^|[,.!?;]\s*)(honey|dear|hon|sugar)\s*[,.!?]|,\s*(honey|dear|hon|sugar)\b/i;
function escRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function dignityCheck(text){
  var t = " " + String(text || "").toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ") + " ";
  var hits = [];
  [["juvenile", JUVENILE], ["memory-test", QUIZ], ["elderspeak", ELDERSPEAK]].forEach(function(set){
    set[1].forEach(function(w){ if (new RegExp(" " + escRe(w) + " ").test(t)) hits.push({ term:w, kind:set[0] }); });
  });
  var v = VOCATIVE.exec(String(text || ""));
  if (v) hits.push({ term:(v[1] || v[2]).toLowerCase(), kind:"elderspeak" });
  return hits;
}

/* ---------- subjects for new artwork ----------
   Ideas for the next pages to generate: adult, familiar, era-true and
   easy to draw in bold lines. [category, subject, tags, best tiers] */
var IDEAS = [
  ["classic-vehicles", "a 1955 two-tone hardtop sedan seen from the side on a quiet street", ["cars", "1950s"], [1, 2, 3]],
  ["classic-vehicles", "a 1920s open touring car with spoked wheels", ["cars", "1920s"], [1, 2]],
  ["classic-vehicles", "a rounded 1960s camper van seen from the side", ["vans", "1960s", "road-trips"], [1, 2, 3]],
  ["classic-vehicles", "a 1940s milk delivery truck", ["trucks", "1940s", "deliveries"], [1, 2, 3]],
  ["classic-vehicles", "a farm tractor pulling a hay wagon", ["farm", "tractors"], [1, 2]],
  ["classic-vehicles", "a paddle-wheel riverboat", ["boats", "rivers"], [1, 2]],
  ["classic-vehicles", "a wooden canoe resting at the edge of a lake", ["boats", "lakes"], [2, 3]],
  ["classic-vehicles", "a vintage filling station pump", ["gas-stations", "1950s"], [2, 3]],
  ["classic-vehicles", "a classic city bus from the 1950s", ["buses", "city", "1950s"], [1, 2]],
  ["classic-vehicles", "a propeller airliner parked on the runway", ["airplanes", "travel"], [1, 2]],
  ["classic-vehicles", "a horse-drawn buggy on a country lane", ["buggies", "horses", "country"], [1, 2]],
  ["classic-vehicles", "a steam engine crossing a stone bridge", ["trains", "bridges"], [1]],
  ["classic-vehicles", "a 1950s station wagon loaded for a picnic", ["cars", "picnics", "1950s"], [1, 2]],
  ["classic-vehicles", "a vintage motorcycle with a sidecar", ["motorcycles"], [1, 2]],
  ["classic-vehicles", "a fishing trawler in the harbor", ["boats", "harbors"], [1, 2]],
  ["classic-vehicles", "a classic pickup truck with a Christmas tree in the bed", ["trucks", "winter", "holidays"], [1, 2]],
  ["classic-vehicles", "a sleigh with runners in the snow", ["sleighs", "winter"], [1, 2, 3]],
  ["classic-vehicles", "a lighthouse tender boat", ["boats", "coast"], [1, 2]],
  ["classic-vehicles", "a tandem bicycle for two", ["bicycles"], [1, 2]],
  ["classic-vehicles", "a mail truck with a rounded hood", ["mail", "trucks"], [2, 3]],
  ["botanical-garden", "a bouquet of peonies in a china pitcher", ["peonies", "vases"], [1, 2, 3]],
  ["botanical-garden", "a sprig of lilacs in a mason jar", ["lilacs", "spring"], [1, 2]],
  ["botanical-garden", "a climbing rose on a white trellis", ["roses", "trellis"], [1, 2]],
  ["botanical-garden", "morning glories along a picket fence", ["morning-glories", "fences"], [1, 2]],
  ["botanical-garden", "a single iris bloom with long leaves", ["iris", "spring"], [2, 3]],
  ["botanical-garden", "a bundle of lavender tied with a ribbon", ["lavender", "herbs"], [1, 2]],
  ["botanical-garden", "hollyhocks growing against a garden wall", ["hollyhocks", "summer"], [1, 2]],
  ["botanical-garden", "a pear tree branch with two ripe pears", ["pears", "fruit"], [2, 3]],
  ["botanical-garden", "tomato plants with ripe tomatoes in a garden bed", ["tomatoes", "vegetables"], [1, 2]],
  ["botanical-garden", "a basket of fresh peaches", ["peaches", "fruit"], [1, 2, 3]],
  ["botanical-garden", "a potted Boston fern on a stand", ["ferns", "houseplants"], [1, 2]],
  ["botanical-garden", "a large single camellia blossom", ["camellia", "flowers"], [2, 3]],
  ["botanical-garden", "a cluster of cherry blossoms on a branch", ["blossoms", "spring"], [1, 2]],
  ["botanical-garden", "a bowl of lemons with leaves", ["lemons", "fruit"], [2, 3]],
  ["botanical-garden", "a window box full of petunias", ["petunias", "window-boxes"], [1, 2]],
  ["botanical-garden", "a pumpkin, gourds and corn stalks for autumn", ["autumn", "harvest"], [1, 2]],
  ["botanical-garden", "holly leaves and berries", ["holly", "winter"], [1, 2, 3]],
  ["botanical-garden", "a poinsettia in a clay pot", ["poinsettia", "winter"], [2, 3]],
  ["botanical-garden", "a cornflower and wheat bouquet", ["wildflowers", "harvest"], [1, 2]],
  ["botanical-garden", "a strawberry patch with blossoms", ["strawberries", "spring"], [1, 2]],
  ["nostalgic-heritage", "an antique candlestick telephone", ["telephones", "1920s"], [2, 3]],
  ["nostalgic-heritage", "a jukebox with rounded top", ["music", "1950s"], [1, 2]],
  ["nostalgic-heritage", "a hand-crank ice cream maker on a porch", ["ice-cream", "summer"], [1, 2]],
  ["nostalgic-heritage", "a kerosene lantern", ["lanterns"], [2, 3]],
  ["nostalgic-heritage", "an old-fashioned brass cash register", ["stores", "shops"], [1, 2]],
  ["nostalgic-heritage", "a farmhouse hand water pump with a bucket", ["farm", "water"], [1, 2, 3]],
  ["nostalgic-heritage", "a quilt folded over a wooden quilt rack", ["quilts", "home"], [1, 2]],
  ["nostalgic-heritage", "a mantel clock with a rounded top", ["clocks"], [2, 3]],
  ["nostalgic-heritage", "a milk can on a farm porch", ["farm", "dairy"], [2, 3]],
  ["nostalgic-heritage", "a general store front with a striped awning", ["stores", "towns"], [1, 2]],
  ["nostalgic-heritage", "a one-room schoolhouse with a bell tower", ["schools", "landmarks"], [1, 2]],
  ["nostalgic-heritage", "a gazebo bandstand in a town park", ["parks", "music"], [1, 2]],
  ["nostalgic-heritage", "a soda fountain glass with a straw and a cherry", ["soda-fountain", "1950s"], [2, 3]],
  ["nostalgic-heritage", "a wind-up alarm clock with two bells", ["clocks", "mornings"], [2, 3]],
  ["nostalgic-heritage", "a hand-cranked coffee grinder", ["coffee", "kitchen"], [1, 2]],
  ["nostalgic-heritage", "a wooden rolling pin and flour sifter", ["baking", "kitchen"], [2, 3]],
  ["nostalgic-heritage", "a vintage suitcase with travel stickers shapes and no words", ["travel", "luggage"], [1, 2]],
  ["nostalgic-heritage", "a hat box with a ribbon and a Sunday hat", ["hats", "fashion"], [1, 2]],
  ["nostalgic-heritage", "a wooden radio console in a living room corner", ["radio", "home"], [1, 2]],
  ["nostalgic-heritage", "a church-free country chapel-style town hall with a clock", ["towns", "landmarks"], [1, 2]],
  ["wildlife-nature", "a blue jay perched on a bird feeder", ["birds", "blue-jays"], [1, 2, 3]],
  ["wildlife-nature", "a pair of mourning doves on a wire", ["birds", "doves"], [1, 2]],
  ["wildlife-nature", "a white-tailed deer standing in a meadow, side view", ["deer", "meadows"], [1, 2]],
  ["wildlife-nature", "a horse's head in profile with a flowing mane", ["horses"], [1, 2, 3]],
  ["wildlife-nature", "a Holstein cow standing in a pasture", ["cows", "farm"], [1, 2]],
  ["wildlife-nature", "a painted turtle resting on a log", ["turtles", "ponds"], [2, 3]],
  ["wildlife-nature", "a trout leaping from a stream", ["fish", "streams"], [1, 2]],
  ["wildlife-nature", "a great blue heron wading in the reeds", ["birds", "herons"], [1, 2]],
  ["wildlife-nature", "a goldfinch on a thistle", ["birds", "finches"], [1, 2]],
  ["wildlife-nature", "a honeybee on a clover blossom, realistic proportions", ["bees", "flowers"], [1, 2]],
  ["wildlife-nature", "a squirrel holding an acorn, natural pose", ["squirrels", "autumn"], [1, 2]],
  ["wildlife-nature", "a loon on a calm lake at dawn", ["birds", "lakes"], [1, 2]],
  ["wildlife-nature", "a hen sitting on her nest box", ["hens", "farm"], [1, 2, 3]],
  ["wildlife-nature", "a scallop shell and starfish on sand", ["shells", "beach"], [2, 3]],
  ["wildlife-nature", "a pinecone and evergreen branch", ["pine", "winter"], [2, 3]],
  ["wildlife-nature", "a dragonfly resting on a cattail", ["dragonflies", "ponds"], [2, 3]],
  ["wildlife-nature", "a pair of cardinals in a snowy pine", ["birds", "winter"], [1, 2]],
  ["wildlife-nature", "a sleeping fox curled in the grass", ["foxes"], [1, 2]],
  ["wildlife-nature", "a sailboat harbor with gulls, simple shapes", ["harbors", "gulls"], [1]],
  ["wildlife-nature", "a waterfall between two pine trees", ["waterfalls", "forests"], [1, 2]],
  ["bold-easy-patterns", "a Double Wedding Ring quilt block", ["quilts"], [1, 2]],
  ["bold-easy-patterns", "a Bear's Paw quilt block", ["quilts"], [1, 2]],
  ["bold-easy-patterns", "a Lone Star quilt center", ["quilts", "stars"], [1, 2, 3]],
  ["bold-easy-patterns", "an Art Nouveau floral tile", ["tiles", "art-nouveau"], [1, 2]],
  ["bold-easy-patterns", "a simple Celtic knot circle with wide bands", ["knots"], [1, 2]],
  ["bold-easy-patterns", "a rose window of stained glass", ["stained-glass"], [1, 2, 3]],
  ["bold-easy-patterns", "a paisley medallion with large shapes", ["paisley"], [1, 2]],
  ["bold-easy-patterns", "a checkerboard of large squares with flowers in every other square", ["checkerboard"], [2, 3]],
  ["bold-easy-patterns", "a folk-art tulip border pattern", ["folk-art", "tulips"], [1, 2]],
  ["bold-easy-patterns", "a Pennsylvania Dutch hex sign star", ["folk-art", "stars"], [2, 3]],
  ["bold-easy-patterns", "a ring of large leaves around a circle", ["leaves", "wreaths"], [2, 3]],
  ["bold-easy-patterns", "a sunflower mandala with large petals", ["mandalas", "sunflowers"], [2, 3]],
  ["bold-easy-patterns", "a Victorian tile with a four-petal flower", ["tiles"], [2, 3]],
  ["bold-easy-patterns", "a basket-weave pattern of wide strips", ["weaving"], [1, 2]],
  ["bold-easy-patterns", "a snowflake with six wide arms", ["snowflakes", "winter"], [2, 3]],
  ["bold-easy-patterns", "a carousel-style medallion with scallops", ["medallions"], [1, 2]],
  ["bold-easy-patterns", "a lattice of hexagons with a flower in the middle", ["hexagons"], [1, 2]],
  ["bold-easy-patterns", "an Amish diamond-in-a-square quilt", ["quilts", "amish"], [2, 3]],
  ["bold-easy-patterns", "a heart-in-hand folk-art motif", ["folk-art"], [2, 3]],
  ["bold-easy-patterns", "a large compass star inside a circle", ["compass", "stars"], [2, 3]],
  ["home-everyday", "a fresh loaf of bread on a cutting board", ["baking", "bread"], [2, 3]],
  ["home-everyday", "a pie cooling on a windowsill", ["baking", "pies"], [1, 2, 3]],
  ["home-everyday", "a knitting project with needles and a ball of yarn", ["knitting"], [1, 2]],
  ["home-everyday", "a shoeshine kit with brush and polish tin", ["shoes", "grooming"], [1, 2]],
  ["home-everyday", "a picnic table set with a checked cloth", ["picnics"], [1, 2]],
  ["home-everyday", "folded towels in a wicker laundry basket", ["laundry"], [2, 3]],
  ["home-everyday", "canning jars, a funnel and fruit on the counter", ["canning", "kitchen"], [1, 2]],
  ["home-everyday", "a garden hat, gloves and trowel on a bench", ["gardening"], [1, 2]],
  ["home-everyday", "a birdhouse on a workbench with a paintbrush", ["woodworking", "birdhouses"], [1, 2]],
  ["home-everyday", "a toolbox with a hammer, saw and level", ["tools", "woodworking"], [1, 2]],
  ["home-everyday", "a mixing bowl with a wooden spoon and eggs", ["baking"], [2, 3]],
  ["home-everyday", "a coffee pot and two mugs on a table", ["coffee", "friends"], [2, 3]],
  ["home-everyday", "a jigsaw puzzle partly finished on a table", ["puzzles", "games"], [1, 2]],
  ["home-everyday", "a checkerboard with checkers", ["checkers", "games"], [1, 2]],
  ["home-everyday", "a hymnal-free songbook and a piano bench", ["music", "piano"], [1, 2]],
  ["home-everyday", "a watering can and a row of seedlings", ["gardening"], [2, 3]],
  ["home-everyday", "a lunch pail and thermos", ["work", "lunch"], [2, 3]],
  ["home-everyday", "a rocking chair with a folded blanket", ["resting", "home"], [2, 3]],
  ["home-everyday", "a clothespin bag hanging on a line", ["laundry"], [2, 3]],
  ["home-everyday", "a fishing tackle box open with lures", ["fishing"], [1, 2]]
];

/* The subject to ask a generator for, for one of the library's own designs. */
function subjectFor(d){
  if (!d) return "";
  if (d.aiSubject) return d.aiSubject;
  var t = String(d.title).replace(/^(The|A|An)\s+/, "").toLowerCase();
  return (d.era ? d.era + " " : "") + t + (d.cat === "bold-easy-patterns" && !/pattern|quilt/.test(t) ? " pattern" : "");
}
function slug(s){
  var t = String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (t.length > 48){ t = t.slice(0, 49); t = t.slice(0, t.lastIndexOf("-") > 20 ? t.lastIndexOf("-") : 48); }   // whole words only
  return t;
}
/* A generation job: one subject, one tier, every generator's prompt. */
function job(o){
  var p = buildAll(o.subject, o.tier);
  return {
    job_id: "ai-" + o.category + "-" + slug(String(o.title || o.subject).replace(/^(the|a|an)\s+/i, "")) + "-t" + p.tier,
    title: o.title || (o.subject.charAt(0).toUpperCase() + o.subject.slice(1)),
    subject: p.subject, category: o.category, tier: p.tier, tags: (o.tags || []).slice(),
    source: o.source || "idea", design_id: o.design_id || null,
    positive: p.positive, negative: p.negative, prompts: p.prompts,
    expect: { aspect_ratio:"3:4", line_weight:["", "thick", "ultra-bold", "extra-bold-sensory"][p.tier], review:"required before use" },
    dignity: dignityCheck(o.subject + " " + (o.title || "") + " " + (o.tags || []).join(" "))
  };
}

root.CogniCorePrompts = {
  POSITIVE:POSITIVE, NEGATIVE:NEGATIVE, TIER_WORDS:TIER_WORDS, GENERATORS:GENERATORS, IDEAS:IDEAS,
  build:build, buildAll:buildAll, format:format, dignityCheck:dignityCheck, subjectFor:subjectFor, job:job, slug:slug,
  JUVENILE:JUVENILE, QUIZ:QUIZ, ELDERSPEAK:ELDERSPEAK
};
})(typeof globalThis !== "undefined" ? globalThis : this);

/* ---------- measured catalog (generated) ----------
   metrics: asset id -> [areas to color, smallest area sq in, median area sq in, areas under the tier minimum, visual complexity] */
(function(C){
"use strict";
if (!C) return;
C.catalog = {"schema_version":"1.0.0","content_hash":"edb9864a429a6acf65ae34862480061c678b1849d2ebb31814d43781fc8aa9af","bands":[{"id":"simple","label":"Simple: up to 12 areas to color","max_regions":12},{"id":"moderate","label":"Moderate: 13 to 40 areas","max_regions":40},{"id":"detailed","label":"Detailed: more than 40 areas","max_regions":null}],"metrics":{"cc-tulips-vase-t1":[17,0.071,0.556,0,"moderate"],"cc-tulips-vase-t2":[11,0.089,0.537,0,"simple"],"cc-tulips-vase-t3":[9,0.221,1.05,0,"simple"],"cc-sunflower-t1":[43,0.094,0.246,0,"detailed"],"cc-sunflower-t2":[22,0.193,0.286,0,"moderate"],"cc-sunflower-t3":[18,0.137,0.337,0,"moderate"],"cc-garden-rose-t1":[19,0.317,0.563,0,"moderate"],"cc-garden-rose-t2":[19,0.294,0.492,0,"moderate"],"cc-garden-rose-t3":[13,0.433,0.596,0,"moderate"],"cc-poppies-t1":[16,0.096,0.489,0,"moderate"],"cc-poppies-t2":[10,0.145,0.634,0,"simple"],"cc-poppies-t3":[5,0.431,1.588,0,"simple"],"cc-daffodils-t1":[27,0.067,0.197,0,"moderate"],"cc-daffodils-t2":[19,0.095,0.285,0,"moderate"],"cc-daffodils-t3":[9,0.511,0.624,0,"simple"],"cc-calla-lilies-t1":[15,0.029,0.465,0,"moderate"],"cc-calla-lilies-t2":[9,0.106,0.775,0,"simple"],"cc-calla-lilies-t3":[6,0.052,0.759,1,"simple"],"cc-daisy-jar-t1":[98,0.021,0.065,0,"detailed"],"cc-daisy-jar-t2":[49,0.01,0.097,3,"detailed"],"cc-daisy-jar-t3":[23,0.082,0.253,1,"moderate"],"cc-water-lily-t1":[15,0.045,0.34,0,"moderate"],"cc-water-lily-t2":[11,0.028,0.439,1,"simple"],"cc-water-lily-t3":[9,0.014,0.406,1,"simple"],"cc-magnolia-branch-t1":[23,0.078,0.302,0,"moderate"],"cc-magnolia-branch-t2":[16,0.101,0.519,0,"moderate"],"cc-magnolia-branch-t3":[5,0.598,1.775,0,"simple"],"cc-hydrangea-t1":[32,0.004,0.706,5,"moderate"],"cc-hydrangea-t2":[14,0.026,1.133,1,"moderate"],"cc-hydrangea-t3":[11,0.004,2.561,1,"simple"],"cc-porch-geranium-t1":[51,0.004,0.118,2,"detailed"],"cc-porch-geranium-t2":[29,0.032,0.213,1,"moderate"],"cc-porch-geranium-t3":[10,0.189,2.369,0,"simple"],"cc-watering-can-t1":[15,0.018,0.209,1,"moderate"],"cc-watering-can-t2":[14,0.011,0.331,2,"moderate"],"cc-watering-can-t3":[8,0.029,0.408,1,"simple"],"cc-garden-gate-t1":[51,0.004,0.238,2,"detailed"],"cc-garden-gate-t2":[28,0.088,0.399,0,"moderate"],"cc-garden-gate-t3":[16,0.316,0.547,0,"moderate"],"cc-garden-wheelbarrow-t1":[34,0.003,0.118,3,"moderate"],"cc-garden-wheelbarrow-t2":[27,0.016,0.107,1,"moderate"],"cc-garden-wheelbarrow-t3":[9,0.127,0.265,0,"simple"],"cc-windowsill-herbs-t1":[49,0.003,0.159,9,"detailed"],"cc-windowsill-herbs-t2":[26,0.016,0.213,2,"moderate"],"cc-windowsill-herbs-t3":[17,0.11,0.218,1,"moderate"],"cc-autumn-maple-t1":[14,0.008,0.147,4,"moderate"],"cc-autumn-maple-t2":[8,0.003,0.767,1,"simple"],"cc-autumn-maple-t3":[3,1.206,1.208,0,"simple"],"cc-oak-acorns-t1":[9,0.029,0.607,0,"simple"],"cc-oak-acorns-t2":[9,0.013,0.667,2,"simple"],"cc-oak-acorns-t3":[4,0.039,1.452,1,"simple"],"cc-apple-branch-t1":[10,0.118,0.557,0,"simple"],"cc-apple-branch-t2":[8,0.219,0.609,0,"simple"],"cc-apple-branch-t3":[6,0.242,1.036,0,"simple"],"cc-fruit-bowl-t1":[12,0.013,0.131,3,"simple"],"cc-fruit-bowl-t2":[5,0.859,1.417,0,"simple"],"cc-fruit-bowl-t3":[4,0.716,3.065,0,"simple"],"cc-strawberries-t1":[31,0.003,0.122,7,"moderate"],"cc-strawberries-t2":[20,0.003,0.173,2,"moderate"],"cc-strawberries-t3":[12,0.125,0.143,0,"simple"],"cc-pumpkin-patch-t1":[8,0.013,0.85,1,"simple"],"cc-pumpkin-patch-t2":[7,0.095,0.85,0,"simple"],"cc-pumpkin-patch-t3":[3,0.098,7.263,1,"simple"],"cc-harvest-basket-t1":[44,0.023,0.385,0,"detailed"],"cc-harvest-basket-t2":[20,0.015,0.28,2,"moderate"],"cc-harvest-basket-t3":[8,0.054,0.442,1,"simple"],"cc-dahlia-t1":[55,0.089,0.197,0,"detailed"],"cc-dahlia-t2":[49,0.078,0.205,0,"detailed"],"cc-dahlia-t3":[21,0.269,0.313,0,"moderate"],"cc-clothesline-t1":[29,0.007,0.123,4,"moderate"],"cc-clothesline-t2":[15,0.022,0.494,1,"moderate"],"cc-clothesline-t3":[5,0.008,0.574,1,"simple"],"cc-table-setting-t1":[86,0.008,0.196,4,"detailed"],"cc-table-setting-t2":[14,0.004,0.288,2,"moderate"],"cc-table-setting-t3":[2,4.581,4.617,0,"simple"],"cc-tea-for-two-t1":[18,0.013,0.269,2,"moderate"],"cc-tea-for-two-t2":[13,0.006,0.212,3,"moderate"],"cc-tea-for-two-t3":[5,0.084,1.325,1,"simple"],"cc-baking-day-t1":[44,0.044,0.112,0,"detailed"],"cc-baking-day-t2":[23,0.049,0.207,2,"moderate"],"cc-baking-day-t3":[14,0.136,0.335,0,"moderate"],"cc-knitting-basket-t1":[36,0.049,0.393,0,"moderate"],"cc-knitting-basket-t2":[15,0.035,0.474,2,"moderate"],"cc-knitting-basket-t3":[5,0.124,1.349,0,"simple"],"cc-sewing-basket-t1":[28,0.014,0.327,2,"moderate"],"cc-sewing-basket-t2":[24,0.012,0.372,4,"moderate"],"cc-sewing-basket-t3":[7,0.183,0.782,0,"simple"],"cc-potting-bench-t1":[25,0.111,0.394,0,"moderate"],"cc-potting-bench-t2":[22,0.146,0.398,0,"moderate"],"cc-potting-bench-t3":[11,0.209,0.321,0,"simple"],"cc-letter-writing-t1":[9,0.067,0.422,0,"simple"],"cc-letter-writing-t2":[9,0.126,0.455,0,"simple"],"cc-letter-writing-t3":[4,0.724,6.053,0,"simple"],"cc-picnic-basket-t1":[38,0.074,0.317,0,"moderate"],"cc-picnic-basket-t2":[32,0.048,0.274,1,"moderate"],"cc-picnic-basket-t3":[5,0.174,2.006,0,"simple"],"cc-gone-fishing-t1":[26,0.055,0.293,0,"moderate"],"cc-gone-fishing-t2":[12,0.061,0.65,0,"simple"],"cc-gone-fishing-t3":[10,0.048,0.845,1,"simple"],"cc-sunday-paper-t1":[9,0.043,0.585,0,"simple"],"cc-sunday-paper-t2":[9,0.036,0.498,1,"simple"],"cc-sunday-paper-t3":[6,0.058,2.357,1,"simple"],"cc-ironing-day-t1":[10,0.026,0.906,0,"simple"],"cc-ironing-day-t2":[10,0.004,0.825,1,"simple"],"cc-ironing-day-t3":[5,0.239,1.208,0,"simple"],"cc-cards-and-dominoes-t1":[15,0.019,0.23,1,"moderate"],"cc-cards-and-dominoes-t2":[9,0.041,2.234,1,"simple"],"cc-cards-and-dominoes-t3":[6,0.431,1.212,0,"simple"],"cc-teapot-and-cup-t1":[13,0.026,0.337,0,"moderate"],"cc-teapot-and-cup-t2":[11,0.019,0.374,2,"simple"],"cc-teapot-and-cup-t3":[6,0.005,0.559,1,"simple"],"cc-rotary-telephone-t1":[18,0.046,0.071,0,"moderate"],"cc-rotary-telephone-t2":[17,0.069,0.07,0,"moderate"],"cc-rotary-telephone-t3":[5,0.621,1.84,0,"simple"],"cc-cathedral-radio-t1":[7,0.081,0.627,0,"simple"],"cc-cathedral-radio-t2":[6,0.221,1.783,0,"simple"],"cc-cathedral-radio-t3":[7,0.175,1.445,0,"simple"],"cc-sewing-machine-t1":[15,0.015,0.564,1,"moderate"],"cc-sewing-machine-t2":[15,0.039,0.478,1,"moderate"],"cc-sewing-machine-t3":[6,0.338,0.94,0,"simple"],"cc-grandfather-clock-t1":[9,0.238,1.174,0,"simple"],"cc-grandfather-clock-t2":[8,0.203,1.383,0,"simple"],"cc-grandfather-clock-t3":[8,0.179,1.229,0,"simple"],"cc-schoolhouse-clock-t1":[8,0.03,1.569,0,"simple"],"cc-schoolhouse-clock-t2":[7,0.02,1.029,1,"simple"],"cc-schoolhouse-clock-t3":[4,0.991,4.021,0,"simple"],"cc-pocket-watch-t1":[20,0.039,0.058,0,"moderate"],"cc-pocket-watch-t2":[4,0.134,6.296,0,"simple"],"cc-pocket-watch-t3":[4,0.098,4.801,1,"simple"],"cc-coffee-percolator-t1":[13,0.028,0.704,0,"moderate"],"cc-coffee-percolator-t2":[12,0.018,0.625,1,"simple"],"cc-coffee-percolator-t3":[8,0.097,0.689,1,"simple"],"cc-stand-mixer-t1":[6,0.011,4.905,1,"simple"],"cc-stand-mixer-t2":[7,0.004,4.447,1,"simple"],"cc-stand-mixer-t3":[4,2.027,5.527,0,"simple"],"cc-chrome-toaster-t1":[10,0.135,0.673,0,"simple"],"cc-chrome-toaster-t2":[8,0.11,0.454,0,"simple"],"cc-chrome-toaster-t3":[4,0.35,1.825,0,"simple"],"cc-canning-jars-t1":[24,0.029,0.332,0,"moderate"],"cc-canning-jars-t2":[11,0.617,0.703,0,"simple"],"cc-canning-jars-t3":[6,0.825,1.596,0,"simple"],"cc-milk-bottles-t1":[18,0.196,0.896,0,"moderate"],"cc-milk-bottles-t2":[14,0.159,1.721,0,"moderate"],"cc-milk-bottles-t3":[4,0.396,3.93,0,"simple"],"cc-oil-lamp-t1":[6,0.288,1.008,0,"simple"],"cc-oil-lamp-t2":[6,0.24,0.908,0,"simple"],"cc-oil-lamp-t3":[5,0.181,0.78,0,"simple"],"cc-typewriter-t1":[33,0.058,0.059,0,"moderate"],"cc-typewriter-t2":[20,0.066,0.076,0,"moderate"],"cc-typewriter-t3":[5,1.092,1.545,0,"simple"],"cc-box-camera-t1":[9,0.431,1.851,0,"simple"],"cc-box-camera-t2":[8,0.375,1.782,0,"simple"],"cc-box-camera-t3":[5,0.309,2.445,0,"simple"],"cc-phonograph-t1":[11,0.031,0.505,0,"simple"],"cc-phonograph-t2":[9,0.051,0.697,0,"simple"],"cc-phonograph-t3":[5,0.636,1.192,0,"simple"],"cc-rural-mailbox-t1":[13,0.029,0.219,0,"moderate"],"cc-rural-mailbox-t2":[11,0.023,0.182,3,"simple"],"cc-rural-mailbox-t3":[6,0.106,1.01,1,"simple"],"cc-lighthouse-t1":[18,0.02,0.464,0,"moderate"],"cc-lighthouse-t2":[13,0.141,0.616,0,"moderate"],"cc-lighthouse-t3":[8,0.117,0.851,1,"simple"],"cc-red-barn-t1":[42,0.017,0.141,1,"detailed"],"cc-red-barn-t2":[14,0.172,0.616,0,"moderate"],"cc-red-barn-t3":[8,0.249,0.325,0,"simple"],"cc-farm-windmill-t1":[39,0.011,0.201,4,"moderate"],"cc-farm-windmill-t2":[22,0.135,0.156,0,"moderate"],"cc-farm-windmill-t3":[11,0.201,0.235,0,"simple"],"cc-covered-bridge-t1":[14,0.025,0.85,0,"moderate"],"cc-covered-bridge-t2":[11,0.074,1.354,0,"simple"],"cc-covered-bridge-t3":[8,0.566,2.476,0,"simple"],"cc-rocking-chair-t1":[17,0.072,0.591,0,"moderate"],"cc-rocking-chair-t2":[17,0.05,0.47,0,"moderate"],"cc-rocking-chair-t3":[8,0.167,0.417,0,"simple"],"cc-wood-cookstove-t1":[16,0.084,0.647,0,"moderate"],"cc-wood-cookstove-t2":[15,0.086,0.564,0,"moderate"],"cc-wood-cookstove-t3":[7,0.141,1.545,0,"simple"],"cc-butter-churn-t1":[7,0.176,0.855,0,"simple"],"cc-butter-churn-t2":[9,0.135,0.407,0,"simple"],"cc-butter-churn-t3":[3,0.15,0.165,0,"simple"],"cc-porch-swing-t1":[7,0.166,1.584,0,"simple"],"cc-porch-swing-t2":[7,0.136,1.347,0,"simple"],"cc-porch-swing-t3":[4,1.065,3.949,0,"simple"],"cc-quilt-ohio-star-t1":[128,0.112,0.116,0,"detailed"],"cc-quilt-ohio-star-t2":[85,0.096,0.099,0,"detailed"],"cc-quilt-ohio-star-t3":[22,0.391,0.403,0,"moderate"],"cc-quilt-sawtooth-star-t1":[104,0.128,0.27,0,"detailed"],"cc-quilt-sawtooth-star-t2":[69,0.113,0.255,0,"detailed"],"cc-quilt-sawtooth-star-t3":[18,0.456,1.03,0,"moderate"],"cc-quilt-pinwheel-t1":[50,0.567,0.578,0,"detailed"],"cc-quilt-pinwheel-t2":[33,0.556,0.567,0,"moderate"],"cc-quilt-pinwheel-t3":[9,2.195,2.216,0,"simple"],"cc-quilt-nine-patch-t1":[56,0.518,0.518,0,"detailed"],"cc-quilt-nine-patch-t2":[37,0.504,0.511,0,"moderate"],"cc-quilt-nine-patch-t3":[10,2.002,2.016,0,"simple"],"cc-quilt-churn-dash-t1":[104,0.241,0.245,0,"detailed"],"cc-quilt-churn-dash-t2":[69,0.221,0.23,0,"detailed"],"cc-quilt-churn-dash-t3":[18,0.904,0.916,0,"moderate"],"cc-quilt-friendship-star-t1":[80,0.241,0.248,0,"detailed"],"cc-quilt-friendship-star-t2":[53,0.221,0.228,0,"detailed"],"cc-quilt-friendship-star-t3":[14,0.891,0.904,0,"moderate"],"cc-quilt-log-cabin-t1":[104,0.08,0.251,0,"detailed"],"cc-quilt-log-cabin-t2":[69,0.068,0.228,0,"detailed"],"cc-quilt-log-cabin-t3":[18,0.283,0.924,0,"moderate"],"cc-quilt-flying-geese-t1":[74,0.265,0.276,0,"detailed"],"cc-quilt-flying-geese-t2":[49,0.245,0.255,0,"detailed"],"cc-quilt-flying-geese-t3":[13,1,1.02,0,"moderate"],"cc-quilt-rail-fence-t1":[74,0.371,0.374,0,"detailed"],"cc-quilt-rail-fence-t2":[49,0.352,0.363,0,"detailed"],"cc-quilt-rail-fence-t3":[13,1.417,1.423,0,"moderate"],"cc-quilt-grandmothers-garden-t1":[39,0.378,0.379,0,"moderate"],"cc-quilt-grandmothers-garden-t2":[20,0.522,0.526,0,"moderate"],"cc-quilt-grandmothers-garden-t3":[8,1.429,1.437,0,"simple"],"cc-quilt-dresden-plate-t1":[27,0.017,0.641,2,"moderate"],"cc-quilt-dresden-plate-t2":[18,0.714,0.721,0,"moderate"],"cc-quilt-dresden-plate-t3":[12,1.02,1.025,0,"simple"],"cc-garden-rosette-t1":[53,0.128,0.261,0,"detailed"],"cc-garden-rosette-t2":[37,0.187,0.345,0,"moderate"],"cc-garden-rosette-t3":[24,0.386,0.488,0,"moderate"],"cc-compass-rose-t1":[39,0.087,0.161,0,"moderate"],"cc-compass-rose-t2":[30,0.14,0.378,0,"moderate"],"cc-compass-rose-t3":[14,0.207,0.853,0,"moderate"],"cc-sunburst-medallion-t1":[38,0.087,0.157,0,"moderate"],"cc-sunburst-medallion-t2":[20,0.107,0.197,0,"moderate"],"cc-sunburst-medallion-t3":[12,0.265,0.266,0,"simple"],"cc-lotus-medallion-t1":[43,0.102,0.306,0,"detailed"],"cc-lotus-medallion-t2":[27,0.179,0.408,0,"moderate"],"cc-lotus-medallion-t3":[16,0.313,0.657,0,"moderate"],"cc-snowflake-medallion-t1":[51,0.056,0.083,0,"detailed"],"cc-snowflake-medallion-t2":[27,0.179,0.236,0,"moderate"],"cc-snowflake-medallion-t3":[30,0.148,0.205,0,"moderate"],"cc-art-deco-fans-t1":[117,0.082,0.24,0,"detailed"],"cc-art-deco-fans-t2":[31,0.307,0.957,0,"moderate"],"cc-art-deco-fans-t3":[13,0.638,2.018,0,"moderate"],"cc-stained-glass-window-t1":[33,0.209,0.298,0,"moderate"],"cc-stained-glass-window-t2":[17,0.258,1.133,0,"moderate"],"cc-stained-glass-window-t3":[14,0.207,0.743,0,"moderate"],"cc-fish-scale-tiles-t1":[128,0.027,0.168,0,"detailed"],"cc-fish-scale-tiles-t2":[44,0.112,0.97,0,"detailed"],"cc-fish-scale-tiles-t3":[24,0.188,1.629,0,"moderate"],"cc-honeycomb-t1":[90,0.082,0.46,0,"detailed"],"cc-honeycomb-t2":[49,0.021,0.872,1,"detailed"],"cc-honeycomb-t3":[24,0.281,1.464,0,"moderate"],"cc-quatrefoil-lattice-t1":[143,0.051,0.172,0,"detailed"],"cc-quatrefoil-lattice-t2":[33,0.189,0.926,0,"moderate"],"cc-quatrefoil-lattice-t3":[19,0.316,0.74,0,"moderate"],"cc-kaleidoscope-t1":[74,0.033,0.319,0,"detailed"],"cc-kaleidoscope-t2":[34,0.368,0.391,0,"moderate"],"cc-kaleidoscope-t3":[26,0.345,0.373,0,"moderate"],"cc-sunday-sedan-t1":[31,0.011,0.262,6,"moderate"],"cc-sunday-sedan-t2":[13,0.138,0.648,0,"moderate"],"cc-sunday-sedan-t3":[10,0.214,1.421,0,"simple"],"cc-farm-pickup-t1":[28,0.016,0.271,3,"moderate"],"cc-farm-pickup-t2":[15,0.12,0.682,0,"moderate"],"cc-farm-pickup-t3":[11,0.269,1.179,0,"simple"],"cc-farm-tractor-t1":[36,0.016,0.11,4,"moderate"],"cc-farm-tractor-t2":[14,0.02,0.522,3,"moderate"],"cc-farm-tractor-t3":[9,0.116,1.099,1,"simple"],"cc-steam-locomotive-t1":[62,0.008,0.11,9,"detailed"],"cc-steam-locomotive-t2":[30,0.009,0.276,3,"moderate"],"cc-steam-locomotive-t3":[17,0.075,0.549,1,"moderate"],"cc-lake-sailboat-t1":[11,0.027,0.575,0,"simple"],"cc-lake-sailboat-t2":[8,0.021,2.622,2,"simple"],"cc-lake-sailboat-t3":[5,2.152,3.172,0,"simple"],"cc-woody-wagon-t1":[39,0.009,0.212,7,"moderate"],"cc-woody-wagon-t2":[14,0.133,0.292,0,"moderate"],"cc-woody-wagon-t3":[12,0.098,0.366,1,"simple"],"cc-convertible-t1":[25,0.015,0.223,3,"moderate"],"cc-convertible-t2":[12,0.135,0.648,0,"simple"],"cc-convertible-t3":[9,0.004,1.423,1,"simple"],"cc-bread-truck-t1":[23,0.004,0.267,3,"moderate"],"cc-bread-truck-t2":[14,0.119,0.648,0,"moderate"],"cc-bread-truck-t3":[11,0.083,0.522,1,"simple"],"cc-streetcar-t1":[31,0.012,0.392,3,"moderate"],"cc-streetcar-t2":[24,0.024,0.588,1,"moderate"],"cc-streetcar-t3":[16,0.267,0.842,0,"moderate"],"cc-vintage-bicycle-t1":[52,0.011,0.188,3,"detailed"],"cc-vintage-bicycle-t2":[17,0.01,0.209,4,"moderate"],"cc-vintage-bicycle-t3":[6,0.309,2.699,0,"simple"],"cc-motor-scooter-t1":[28,0.004,0.442,2,"moderate"],"cc-motor-scooter-t2":[19,0.153,0.383,0,"moderate"],"cc-motor-scooter-t3":[15,0.066,0.698,1,"moderate"],"cc-tugboat-t1":[19,0.018,0.207,1,"moderate"],"cc-tugboat-t2":[16,0.008,0.173,3,"moderate"],"cc-tugboat-t3":[7,0.233,1.104,0,"simple"],"cc-biplane-t1":[15,0.073,0.298,0,"moderate"],"cc-biplane-t2":[15,0.044,0.222,1,"moderate"],"cc-biplane-t3":[7,0.155,1.047,0,"simple"],"cc-hot-air-balloon-t1":[21,0.173,0.467,0,"moderate"],"cc-hot-air-balloon-t2":[17,0.137,0.489,0,"moderate"],"cc-hot-air-balloon-t3":[7,0.084,2.195,1,"simple"],"cc-fire-engine-t1":[39,0.003,0.123,5,"moderate"],"cc-fire-engine-t2":[15,0.132,0.354,0,"moderate"],"cc-fire-engine-t3":[12,0.199,0.391,0,"simple"],"cc-cardinal-branch-t1":[14,0.007,0.183,1,"moderate"],"cc-cardinal-branch-t2":[11,0.004,0.121,1,"simple"],"cc-cardinal-branch-t3":[6,0.027,0.424,1,"simple"],"cc-robin-fence-t1":[14,0.073,0.683,0,"moderate"],"cc-robin-fence-t2":[11,0.225,0.981,0,"simple"],"cc-robin-fence-t3":[6,0.381,1.175,0,"simple"],"cc-chickadee-pine-t1":[15,0.003,0.097,4,"moderate"],"cc-chickadee-pine-t2":[8,0.005,0.273,1,"simple"],"cc-chickadee-pine-t3":[7,0.158,0.379,0,"simple"],"cc-bluebird-house-t1":[13,0.026,0.43,0,"moderate"],"cc-bluebird-house-t2":[12,0.065,0.384,0,"simple"],"cc-bluebird-house-t3":[8,0.136,0.534,0,"simple"],"cc-hummingbird-t1":[15,0.139,0.289,0,"moderate"],"cc-hummingbird-t2":[11,0.102,0.268,0,"simple"],"cc-hummingbird-t3":[7,0.269,0.425,0,"simple"],"cc-barn-owl-t1":[11,0.014,0.447,1,"simple"],"cc-barn-owl-t2":[9,0.041,0.866,1,"simple"],"cc-barn-owl-t3":[4,0.596,2.832,0,"simple"],"cc-swan-lake-t1":[13,0.008,0.715,1,"moderate"],"cc-swan-lake-t2":[8,0.011,1.296,2,"simple"],"cc-swan-lake-t3":[5,0.389,2.264,0,"simple"],"cc-mallard-duck-t1":[18,0.11,0.705,0,"moderate"],"cc-mallard-duck-t2":[14,0.082,0.648,0,"moderate"],"cc-mallard-duck-t3":[7,0.047,1.18,1,"simple"],"cc-monarch-butterfly-t1":[20,0.013,0.035,2,"moderate"],"cc-monarch-butterfly-t2":[9,0.042,0.474,1,"simple"],"cc-monarch-butterfly-t3":[6,0.045,2.208,1,"simple"],"cc-dragonfly-reeds-t1":[28,0.006,0.086,8,"moderate"],"cc-dragonfly-reeds-t2":[13,0.151,0.343,0,"moderate"],"cc-dragonfly-reeds-t3":[9,0.153,0.32,0,"simple"],"cc-koi-pond-t1":[23,0.01,0.161,2,"moderate"],"cc-koi-pond-t2":[12,0.128,0.659,0,"simple"],"cc-koi-pond-t3":[8,0.162,0.527,0,"simple"],"cc-sea-turtle-t1":[8,0.1,0.465,0,"simple"],"cc-sea-turtle-t2":[8,0.073,0.392,0,"simple"],"cc-sea-turtle-t3":[8,0.044,0.3,1,"simple"],"cc-seashells-t1":[20,0.018,0.232,1,"moderate"],"cc-seashells-t2":[15,0.019,0.351,1,"moderate"],"cc-seashells-t3":[6,0.419,1.198,0,"simple"],"cc-nautilus-shell-t1":[15,0.274,0.773,0,"moderate"],"cc-nautilus-shell-t2":[11,0.358,1.029,0,"simple"],"cc-nautilus-shell-t3":[7,0.589,1.499,0,"simple"],"cc-garden-rabbit-t1":[20,0.014,0.08,3,"moderate"],"cc-garden-rabbit-t2":[15,0.061,0.07,0,"moderate"],"cc-garden-rabbit-t3":[6,0.362,0.766,0,"simple"],"cc-sleeping-cat-t1":[12,0.007,0.15,2,"simple"],"cc-sleeping-cat-t2":[10,0.065,0.123,0,"simple"],"cc-sleeping-cat-t3":[6,0.235,1.199,0,"simple"],"cc-faithful-dog-t1":[12,0.034,0.4,0,"simple"],"cc-faithful-dog-t2":[11,0.022,0.235,3,"simple"],"cc-faithful-dog-t3":[4,0.109,0.354,1,"simple"],"cc-proud-rooster-t1":[14,0.024,0.18,0,"moderate"],"cc-proud-rooster-t2":[13,0.018,0.143,3,"moderate"],"cc-proud-rooster-t3":[7,0.181,0.432,0,"simple"],"cc-pine-cones-t1":[21,0.021,0.284,0,"moderate"],"cc-pine-cones-t2":[16,0.017,0.343,2,"moderate"],"cc-pine-cones-t3":[5,0.298,1.131,0,"simple"],"cc-mountain-lake-t1":[18,0.024,0.51,0,"moderate"],"cc-mountain-lake-t2":[13,0.031,0.453,2,"moderate"],"cc-mountain-lake-t3":[8,0.036,2.762,1,"simple"]},"ingested":[]};
})(globalThis.CogniCore);
