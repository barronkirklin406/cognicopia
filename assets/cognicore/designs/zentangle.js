/* Cognicopia designs: Zentangle & Mandalas. Zentangle-style tangles (woven
   ribbons, crescent moons, spirals, pebbles, waves, looping petals and a
   sampler tile) and symmetrical mandalas. Every shape is closed, with a
   bold edge and a clean white inside; nothing is shaded, and there is no
   background texture to confuse the eye. The tiers change how many
   repeats there are and how large they are, so Tier 3 always keeps a few
   big pieces (docs/cognicore-coloring-standards.md). */
(function(C){
"use strict";
var h = C.helpers;
var X0 = 24, Y0 = 24, X1 = 576, Y1 = 776, CAT = "zentangle-mandalas";
function frame(g){ g.S(h.rect(X0, Y0, X1 - X0, Y1 - Y0)); }
function def(meta, draw){ meta.cat = CAT; meta.fit = meta.fit || "page"; return C.define(meta, draw); }

/* A straight line clipped to a rectangle (Liang-Barsky); null when it misses. */
function clipLine(a, b, x0, y0, x1, y1){
  var t0 = 0, t1 = 1, dx = b[0] - a[0], dy = b[1] - a[1];
  var p = [-dx, dx, -dy, dy], q = [a[0] - x0, x1 - a[0], a[1] - y0, y1 - a[1]];
  for (var i = 0; i < 4; i++){
    if (p[i] === 0){ if (q[i] < 0) return null; continue; }
    var r = q[i] / p[i];
    if (p[i] < 0){ if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]];
}
/* A band of width w through (cx, cy) at angle a (degrees), as a polygon long enough to cross the page. */
function band(cx, cy, a, w, len){
  len = len || 1200; a = a * Math.PI / 180;
  var ux = Math.cos(a), uy = Math.sin(a), vx = -uy * w / 2, vy = ux * w / 2;
  return [[cx - ux * len + vx, cy - uy * len + vy], [cx + ux * len + vx, cy + uy * len + vy], [cx + ux * len - vx, cy + uy * len - vy], [cx - ux * len - vx, cy - uy * len - vy]];
}
/* The outline that runs a distance off a ring of circles (radius rm, centres on a circle of radius R): the aura of a crescent-moon edge. */
function moonAura(cx, cy, R, n, rm, off, rot){
  var pts = [], rr = rm + off, steps = 360;
  for (var s = 0; s < steps; s++){
    var t = s * 2 * Math.PI / steps, ux = Math.cos(t), uy = Math.sin(t), best = R + off;
    for (var i = 0; i < n; i++){
      var a = ((rot || -90) + i * 360 / n) * Math.PI / 180, mx = R * Math.cos(a), my = R * Math.sin(a);
      var d = ux * mx + uy * my, disc = rr * rr - (mx * mx + my * my - d * d);
      if (disc >= 0){ var far = d + Math.sqrt(disc); if (far > best) best = far; }
    }
    pts.push([cx + ux * best, cy + uy * best]);
  }
  return h.poly(pts);
}
/* An Archimedean spiral inside a circle of radius R: an open line from near the centre out to the rim. */
function spiral(cx, cy, R, turns, rot){
  var pts = [], n = Math.round(turns * 36), r0 = R * .12;
  for (var i = 0; i <= n; i++){ var f = i / n, a = (rot || 0) + f * turns * 360; pts.push(h.onCircle(cx, cy, r0 + (R - r0) * f, a)); }
  return h.smooth(pts, true, .9);
}
/* A heart, tip at (0, size*.62), lobes above; drawn about the origin. */
function heart(s){
  return h.path([0, s * .62]).C([-s * .2, s * .42], [-s * .62, s * .14], [-s * .62, -s * .2]).C([-s * .62, -s * .48], [-s * .36, -s * .62], [-s * .17, -s * .58])
    .C([-s * .06, -s * .55], [0, -s * .46], [0, -s * .38]).C([0, -s * .46], [s * .06, -s * .55], [s * .17, -s * .58])
    .C([s * .36, -s * .62], [s * .62, -s * .48], [s * .62, -s * .2]).C([s * .62, s * .14], [s * .2, s * .42], [0, s * .62]).Z();
}
C.zenHelpers = { clipLine:clipLine, band:band, heart:heart, spiral:spiral };

/* ================= Zentangle-style tangles ================= */

/* Woven ribbons: a basket weave. Each ribbon passes over one crossing and
   under the next, drawn as separate pieces, so there are no slivers. */
def({ id:"zen-woven-ribbons", title:"Woven Ribbons", tags:["zentangle", "ribbons", "weaving", "basket", "geometric"],
  talk:"Did you ever weave, braid or tie ribbons? What did you make?" }, function(g){
  frame(g);
  var L = g.at({ w:66, nx:5, ny:7 }, { w:84, nx:4, ny:6 }, { w:108, nx:3, ny:4 }), w = L.w;
  var gx = (X1 - X0 - L.nx * w) / (L.nx + 1), gy = (Y1 - Y0 - L.ny * w) / (L.ny + 1);    // the gaps match at the edges and between ribbons
  var xs = h.range(L.nx).map(function(j){ return X0 + gx + w / 2 + j * (w + gx); }), ys = h.range(L.ny).map(function(i){ return Y0 + gy + w / 2 + i * (w + gy); });
  var piece = function(x0, y0, x1, y1, horiz){
    g.S(h.rect(x0, y0, x1 - x0, y1 - y0));
    if (g.lvl >= 3) g.D(horiz ? h.line([x0 + 4, (y0 + y1) / 2], [x1 - 4, (y0 + y1) / 2]) : h.line([(x0 + x1) / 2, y0 + 4], [(x0 + x1) / 2, y1 - 4]));
  };
  ys.forEach(function(y, i){                                       // across: broken where it passes under
    var start = X0;
    xs.forEach(function(x, j){ if ((i + j) % 2){ piece(start, y - w / 2, x - w / 2, y + w / 2, true); start = x + w / 2; } });
    piece(start, y - w / 2, X1, y + w / 2, true);
  });
  xs.forEach(function(x, j){                                       // down: broken where it passes under
    var start = Y0;
    ys.forEach(function(y, i){ if ((i + j) % 2 === 0){ piece(x - w / 2, start, x + w / 2, y - w / 2, false); start = y + w / 2; } });
    piece(x - w / 2, start, x + w / 2, Y1, false);
  });
});

/* Crescent moons: half-circles round a centre circle, echoed by auras. */
def({ id:"zen-crescent-moon", title:"The Crescent Moon Medallion", tags:["zentangle", "moons", "circles", "medallions"],
  talk:"Tell me about a night when the moon was especially bright. Where were you?" }, function(g){
  frame(g);
  var cx = 300, cy = 400, R = g.at(108, 118, 128), n = g.at(12, 10, 8), rm = R * Math.sin(Math.PI / n) * .98;
  var gap = g.at(34, 42, 0), auras = g.at(3, 2, 1);
  if (g.lvl === 1) g.S(moonAura(cx, cy, R, n, rm, 56, -90));
  for (var k = auras; k >= 1 && g.lvl >= 2; k--) g.S(moonAura(cx, cy, R, n, rm, k * gap, -90));
  for (var i = 0; i < n; i++){ var p = h.onCircle(cx, cy, R, -90 + i * 360 / n); g.S(h.circle(p[0], p[1], rm)); }
  g.S(h.circle(cx, cy, R));
  g.S(h.circle(cx, cy, g.at(62, 66, 70)), 2);
  if (g.lvl >= 3) for (var j = 0; j < 6; j++) g.S(h.petal(cx, cy, -90 + j * 60, 8, 56, 34, "round"));
  if (g.lvl >= 3) g.S(h.circle(cx, cy, 14));
  /* the corners: a quarter of the same moon edge in each */
  var cr = g.at(96, 104, 120), cn = g.at(4, 3, 3);
  [[X0, Y0, 0], [X1, Y0, 90], [X1, Y1, 180], [X0, Y1, 270]].forEach(function(c){
    var pts = [[c[0], c[1]]].concat(h.arcPts(c[0], c[1], cr, c[2], c[2] + 90, 18));
    g.S(h.clipped(pts, X0, Y0, X1, Y1, 0));
    if (g.lvl >= 2) for (var q = 0; q < cn; q++){ var a = c[2] + (q + .5) * 90 / cn, m = h.onCircle(c[0], c[1], cr, a);
      g.S(h.clipped(h.arcPts(m[0], m[1], cr * Math.sin(Math.PI / 4 / cn) * 1.15, a - 90, a + 90, 14), X0, Y0, X1, Y1, 0)); }
  });
});

/* Spirals in circles, like a garden of snail shells. */
def({ id:"zen-spiral-garden", title:"The Spiral Garden", tags:["zentangle", "spirals", "circles", "calm"],
  talk:"What is a path you liked to walk again and again?" }, function(g){
  frame(g);
  var circles = g.at(
    [[170, 150, 118, 2.5], [430, 170, 104, 2.25], [300, 380, 130, 2.75], [130, 430, 82, 1.75], [470, 420, 92, 2], [180, 650, 112, 2.5], [430, 660, 100, 2.25]],
    [[180, 180, 136, 2], [430, 240, 120, 1.75], [250, 470, 128, 2], [440, 560, 104, 1.75], [190, 680, 82, 1.5]],
    [[200, 210, 150, 1.25], [400, 440, 150, 1.25], [190, 640, 120, 1]]);
  circles.forEach(function(c, i){
    g.S(h.circle(c[0], c[1], c[2]));
    g.L(spiral(c[0], c[1], c[2], c[3], i * 77));
  });
  if (g.lvl >= 2) [[70, 70, 30], [530, 730, 30], [530, 70, 26], [70, 730, 26]].forEach(function(p){ g.S(h.circle(p[0], p[1], p[2] * g.at(1, 1.25, 1))); });
});

/* Smooth river pebbles, each with an echo line inside. */
def({ id:"zen-river-pebbles", title:"River Pebbles", tags:["zentangle", "pebbles", "stones", "rivers", "calm"],
  talk:"Did you ever skip stones on a lake or a river? Who taught you?" }, function(g){
  frame(g);
  var s = g.at(122, 150, 216), rows = Math.floor((Y1 - Y0) / (s * .86)), k = 0;
  for (var r = 0; r < rows; r++){
    var y = Y0 + s * .5 + r * (Y1 - Y0 - s) / Math.max(1, rows - 1), off = r % 2 ? s / 2 : 0;
    for (var x = X0 + s * .5 + off; x <= X1 - s * .44; x += s){
      k++;
      var rx = s * (.4 + (k % 3) * .02), ry = s * (.3 + (k % 2) * .04), rot = (k * 37) % 50 - 25;
      g.S(h.ellipse(x, y, rx, ry, rot));
      if (g.lvl >= 2) g.S(h.ellipse(x, y, rx * .58, ry * .52, rot));
    }
  }
});

/* Rolling waves: bands with a gently curving edge, one under the next. */
def({ id:"zen-rolling-waves", title:"Rolling Waves", tags:["zentangle", "waves", "water", "calm"],
  talk:"What is the most beautiful water you have ever seen: a lake, a river or the ocean?" }, function(g){
  frame(g);
  var n = g.at(9, 7, 5), dy = (Y1 - Y0) / n, amp = dy * .24, waves = g.at(3, 2.5, 2);
  for (var i = 1; i < n; i++){
    var y = Y0 + i * dy, pts = [], ph = i % 2 ? 0 : Math.PI;
    for (var s = 0; s <= 96; s++){ var x = X0 + (X1 - X0) * s / 96; pts.push([x, y + Math.sin(s / 96 * waves * 2 * Math.PI + ph) * amp]); }
    g.S(h.clipped(pts.concat([[X1, Y1], [X0, Y1]]), X0, Y0, X1, Y1, 0));
    if (g.lvl >= 2 && i % 2 === 1){
      var mid = []; for (var t = 1; t < 96; t++){ var xx = X0 + (X1 - X0) * t / 96; mid.push([xx, y + dy * .5 + Math.sin(t / 96 * waves * 2 * Math.PI + ph) * amp]); }
      g.D(h.smooth(mid, true));
    }
    if (g.lvl >= 3 && i % 2 === 0) for (var c = 0; c < waves * 2; c++){ var cx = X0 + (X1 - X0) * (c + .5) / (waves * 2); g.S(h.circle(cx, y + dy * .5 + Math.sin((c + .5) / (waves * 2) * waves * 2 * Math.PI + ph) * amp, dy * .17)); }
  }
});

/* Looping petals: long loops round a centre, each with an echo inside. */
def({ id:"zen-looping-petals", title:"Looping Petals", tags:["zentangle", "loops", "flowers", "mandalas"],
  talk:"Which flower would you most like to have growing by your door?" }, function(g){
  frame(g);
  var cx = 300, cy = 400, n = g.at(12, 10, 8);
  for (var i = 0; i < n; i++) g.S(h.petal(cx, cy, -90 + (i + .5) * 360 / n, 40, 262, 2 * Math.PI * 200 / n * .8, "round"));
  for (var j = 0; j < n; j++){
    var a = -90 + j * 360 / n;
    g.S(h.petal(cx, cy, a, 30, 214, 2 * Math.PI * 150 / n * .9, "round"));
    if (g.lvl >= 2) g.S(h.petal(cx, cy, a, 70, 178, 2 * Math.PI * 150 / n * .42, "round"));
  }
  g.S(h.circle(cx, cy, g.at(58, 62, 70)));
  if (g.lvl >= 3) g.S(h.circle(cx, cy, 28));
  if (g.lvl >= 2) [[80, 80], [520, 80], [80, 720], [520, 720]].forEach(function(p){ g.S(h.circle(p[0], p[1], g.at(36, 44, 0))); if (g.lvl >= 3) g.S(h.circle(p[0], p[1], 18)); });
});

/* A sampler tile: four quarters, a different tangle in each, and a spiral
   medallion at the centre. */
def({ id:"zen-tangle-sampler", title:"The Tangle Sampler", tags:["zentangle", "sampler", "tiles", "geometric"],
  talk:"If you made a sampler, which pattern would you put in the middle?" }, function(g){
  frame(g);
  var mx = 300, my = 400, s = g.at(1, 1.35, 1.9);
  g.S(h.rect(X0, Y0, mx - X0, my - Y0)); g.S(h.rect(mx, Y0, X1 - mx, my - Y0)); g.S(h.rect(X0, my, mx - X0, Y1 - my)); g.S(h.rect(mx, my, X1 - mx, Y1 - my));
  /* top left: diagonal stripes */
  var cr = g.at(118, 132, 150), clear = function(x, y, r){ return Math.hypot(x - mx, y - my) > cr + r + g.at(14, 20, 30); };
  var sp = 62 * s;
  for (var d = -800; d < 800; d += sp * 2) g.S(h.clipped(band((X0 + mx) / 2 + d / Math.SQRT2, (Y0 + my) / 2 + d / Math.SQRT2, 45, sp), X0, Y0, mx, my, g.at(400, 900, 2600)));
  /* top right: squares nested inside one another */
  var steps = g.at(4, 3, 2), bw = (X1 - mx) / 2, bh = (my - Y0) / 2;
  for (var k = 1; k <= steps; k++){ var f = k / (steps + 1); g.S(h.rect(mx + bw * f, Y0 + bh * f, (X1 - mx) - 2 * bw * f, (my - Y0) - 2 * bh * f)); }
  /* bottom left: rows of pearls */
  var pr = 30 * s, pd = pr * 2.7;
  for (var py = my + pd / 2; py + pr < Y1 - 4; py += pd) for (var px = X0 + pd / 2; px + pr < mx - 4; px += pd) if (clear(px, py, pr)) g.S(h.circle(px, py, pr));
  /* bottom right: scallops */
  var R = (X1 - mx) / (2 * g.at(3, 2, 2)), shift = g.lvl >= 2;     // whole scallops across the quarter; Tier 3 rows line up
  for (var row = 0; my + row * R * .9 - R < Y1; row++){
    var y = my + row * R * .9 + R * .2;
    for (var x = mx + R - (shift && row % 2 ? R : 0); x - R < X1; x += 2 * R){
      if (!clear(x, y, R * 1.45) || !clear(x, y + R, R * 1.1)) continue;
      var dd = h.clipped(h.arcPts(x, y, R, 180, 360, 20).concat([[x + R, y + 2 * R], [x - R, y + 2 * R]]), mx, my, X1, Y1, g.at(300, 900, 2600));
      if (dd) g.S(dd);
    }
  }
  /* the centre medallion */
  g.S(h.circle(mx, my, cr + g.at(26, 30, 0)), 2);
  g.S(h.circle(mx, my, cr));
  if (g.lvl >= 2) g.S(h.circle(mx, my, cr * .72));
  g.L(spiral(mx, my, cr * g.at(.72, .72, 1), g.at(2, 1.5, 1.25), 20));
});

/* ================= Mandalas ================= */

/* Heirloom mandala: eight petals in two rings, a scalloped rim and a rosette centre. */
def({ id:"mandala-heirloom", title:"The Heirloom Mandala", tags:["mandalas", "flowers", "circles", "symmetry"],
  talk:"What is something in your family that has been handed down for years?" }, function(g){
  frame(g);
  var cx = 300, cy = 400, n = g.at(8, 8, 6);
  g.S(h.scallop(cx, cy, 266, g.at(24, 18, 12), g.at(.12, .12, .16)));
  g.S(h.circle(cx, cy, 228), 2);
  for (var i = 0; i < n && g.lvl >= 2; i++) g.S(h.petal(cx, cy, -90 + (i + .5) * 360 / n, 100, 210, 2 * Math.PI * 160 / n * .7, "pointed"));
  for (var j = 0; j < n; j++){
    var a = -90 + j * 360 / n;
    g.S(h.petal(cx, cy, a, 96, g.at(226, 226, 206), 2 * Math.PI * 170 / n * g.at(.78, .78, .7), "round"));
    if (g.lvl >= 2) g.S(h.petal(cx, cy, a, 130, 200, 2 * Math.PI * 170 / n * .34, "round"));
  }
  g.S(h.circle(cx, cy, 104));
  var m = g.at(8, 6, 0);
  for (var k = 0; k < m; k++) g.S(h.petal(cx, cy, -90 + k * 360 / m, 34, 96, 2 * Math.PI * 70 / m * .8, "round"));
  g.S(h.circle(cx, cy, g.at(34, 38, 52)));
  if (g.lvl >= 2) [[78, 78], [522, 78], [78, 722], [522, 722]].forEach(function(p){ g.S(h.scallop(p[0], p[1], g.at(40, 46, 0), 6, .28)); g.S(h.circle(p[0], p[1], g.at(14, 16, 0)), 3); });
});

/* Star mandala: rings of points round a flower centre. */
def({ id:"mandala-star", title:"The Star Mandala", tags:["mandalas", "stars", "circles", "symmetry"],
  talk:"Did you ever look up at the stars on a clear night? Where were you?" }, function(g){
  frame(g);
  var cx = 300, cy = 400, n = g.at(12, 10, 8);
  g.S(h.circle(cx, cy, 268));
  for (var i = 0; i < n; i++){
    var a = -90 + i * 360 / n, b = 180 / n;
    g.S(h.poly([h.onCircle(cx, cy, 150, a - b), h.onCircle(cx, cy, 262, a), h.onCircle(cx, cy, 150, a + b)]));
    if (g.lvl >= 3) g.S(h.poly([h.onCircle(cx, cy, 170, a - b * .5), h.onCircle(cx, cy, 226, a), h.onCircle(cx, cy, 170, a + b * .5)]));
  }
  g.S(h.circle(cx, cy, 152));
  if (g.lvl >= 2) for (var j = 0; j < n; j++){ var aj = -90 + (j + .5) * 360 / n, bj = g.at(90, 180, 0) / n; g.S(h.poly([h.onCircle(cx, cy, 92, aj - bj), h.onCircle(cx, cy, 150, aj), h.onCircle(cx, cy, 92, aj + bj)])); }
  g.S(h.circle(cx, cy, 92));
  g.S(h.star(cx, cy, 86, g.at(40, 44, 48), g.at(8, 6, 5)));
  g.S(h.circle(cx, cy, g.at(22, 26, 30)));
});

/* A crocheted doily: a scalloped edge, a ring of arches with a hole in
   each, a ring of cells and a rosette. Neighbouring pieces share edges. */
def({ id:"mandala-doily", title:"Grandmother's Lace Doily", tags:["mandalas", "doilies", "lace", "crochet", "handmade"],
  talk:"Was there a lace doily or a crocheted piece in your home? Who made it?" }, function(g){
  frame(g);
  var cx = 300, cy = 400, n = g.at(14, 12, 10);
  g.S(h.scallop(cx, cy, 268, n, .14, -90));
  for (var i = 0; i < n; i++){ var a = -90 + i * 360 / n; g.S(h.petal(cx, cy, a, 150, 228, 2 * Math.PI * 190 / n * .8, "round"));
    if (g.lvl >= 2){ var p = h.onCircle(cx, cy, 196, a); g.S(h.circle(p[0], p[1], g.at(17, 21, 0))); } }
  g.S(h.circle(cx, cy, 152));
  var m = g.at(12, 8, 6);
  for (var k = 0; k < m; k++) g.S(h.sector(cx, cy, 76, 152, -90 + k * 360 / m, -90 + (k + 1) * 360 / m));
  g.S(h.circle(cx, cy, 76));
  if (g.lvl >= 3) for (var r = 0; r < 6; r++) g.S(h.petal(cx, cy, -90 + r * 60, 22, 70, 46, "round"));
  g.S(h.circle(cx, cy, g.at(22, 24, 40)));
});

/* Hearts round a flower: six hearts turned to the centre, leaves between. */
def({ id:"mandala-hearts", title:"The Heart Mandala", tags:["mandalas", "hearts", "love", "symmetry", "valentines"],
  talk:"Who are the people you hold closest to your heart?" }, function(g){
  frame(g);
  var cx = 300, cy = 400, n = 6;
  g.S(h.circle(cx, cy, 268));
  if (g.lvl >= 2){ g.S(h.circle(cx, cy, 238)); var cells = g.at(18, 12, 0); for (var c = 0; c < cells; c++) g.L(h.line(h.onCircle(cx, cy, 238, c * 360 / cells), h.onCircle(cx, cy, 268, c * 360 / cells))); }
  for (var i = 0; i < n && g.lvl >= 2; i++) g.S(h.petal(cx, cy, -90 + (i + .5) * 360 / n, 176, 232, 46, "pointed"));
  for (var j = 0; j < n; j++){
    g.group({ x:cx, y:cy, rot:j * 360 / n }, function(g){
      g.group({ x:0, y:-150, rot:180 }, function(g){ g.S(heart(132)); if (g.lvl >= 2) g.S(heart(70)); });
    });
  }
  g.S(h.circle(cx, cy, 58));
  if (g.lvl >= 3) for (var k = 0; k < 6; k++) g.S(h.petal(cx, cy, -90 + k * 60, 14, 54, 34, "round"));
  g.S(h.circle(cx, cy, g.at(14, 24, 30)));
});

/* Sunflower mandala: two rings of petals round a seed head. */
def({ id:"mandala-sunflower", title:"The Sunflower Mandala", season:"summer", tags:["mandalas", "sunflowers", "flowers", "summer"],
  talk:"Have you ever grown sunflowers? How tall did they get?" }, function(g){
  frame(g);
  var cx = 300, cy = 400, n = g.at(20, 16, 12);
  for (var i = 0; i < n; i++) g.S(h.petal(cx, cy, -90 + (i + .5) * 360 / n, 120, 268, 2 * Math.PI * 190 / n * .76, "pointed"));
  for (var j = 0; j < n; j++) g.S(h.petal(cx, cy, -90 + j * 360 / n, 120, 232, 2 * Math.PI * 170 / n * .76, "pointed"));
  g.S(h.circle(cx, cy, 136));
  if (g.lvl >= 3){
    for (var s = 1; s <= 40; s++){ var r = 19 * Math.sqrt(s) + 8, a = s * 137.508; if (r + 15 > 128) break; var p = h.onCircle(cx, cy, r, a); g.S(h.circle(p[0], p[1], 13)); }
  } else g.S(h.circle(cx, cy, g.at(0, 84, 70)));
  if (g.lvl === 2) g.S(h.circle(cx, cy, 36));
});
})(globalThis.CogniCore);
