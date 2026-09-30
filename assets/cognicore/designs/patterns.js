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
