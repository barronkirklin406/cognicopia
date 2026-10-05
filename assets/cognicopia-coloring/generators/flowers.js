/* Cognicopia Infinite Pages, family: garden flowers.
   One, three or five blooms (tulips, daisies, roses, sunflowers, daffodils
   or zinnias) in a jug, a bud vase, a mason jar, a pitcher, an urn or a
   plain cylinder. Blooms are spaced on an arc so they never overlap;
   stems run from inside the vase to the middle of each bloom, so both ends
   are hidden. Decorative bands on the vase run between matching points of
   its own outline. See assets/cognicopia-coloring/infinite.js for the family contract. */
(function(C){
"use strict";
var I = C && C.infinite;
if (!I) return;
var h = C.helpers, k = I.kit;

/* right halves of the vase outlines, top centre to bottom centre, as
   fractions of width (x) and height (y); bands: outline points to join */
var VASES = {
  jug:      { label:"stoneware jug", half:[[0, -1], [.24, -1], [.22, -.86], [.5, -.56], [.48, -.2], [.36, 0], [0, 0]], bands:[2, 4], smooth:.9 },
  bud:      { label:"slender bud vase", half:[[0, -1], [.22, -1], [.14, -.84], [.16, -.52], [.36, -.2], [.3, 0], [0, 0]], bands:[3, 4], smooth:.9 },
  mason:    { label:"mason jar", half:[[0, -1], [.36, -1], [.36, -.9], [.48, -.8], [.5, -.1], [.46, 0], [0, 0]], bands:[2, 4], smooth:.35 },
  pitcher:  { label:"milk pitcher", half:[[0, -1], [.38, -1], [.34, -.8], [.47, -.45], [.43, -.08], [.34, 0], [0, 0]], bands:[2, 4], smooth:.9 },
  urn:      { label:"footed urn", half:[[0, -1], [.42, -1], [.36, -.9], [.5, -.6], [.3, -.26], [.17, -.18], [.2, -.08], [.33, 0], [0, 0]], bands:[3, 5], smooth:.8 },
  cylinder: { label:"tall glass vase", half:[[0, -1], [.32, -1], [.32, -.05], [.3, 0], [0, 0]], bands:[], smooth:.2 }
};
var FLOWERS = { tulip:"tulips", daisy:"daisies", rose:"roses", sunflower:"sunflowers", daffodil:"daffodils", zinnia:"zinnias" };
var ONE = { tulip:"a tulip", daisy:"a daisy", rose:"a rose", sunflower:"a sunflower", daffodil:"a daffodil", zinnia:"a zinnia" };

function vase(g, p){
  var V = VASES[p.vase], w = p.vase === "bud" ? p.vw * .72 : p.vw, ht = p.vh;
  var half = V.half.map(function(q){ return [q[0] * w, q[1] * ht]; }), pts = k.mirrorPts(half, 0);
  if (p.vase === "pitcher"){
    var t = g.tube(g.at(18, 24, 30)), y1 = -ht * .82, y2 = -ht * .32, x1 = -w * .34, x2 = -w * .4, out = g.at(60, 66, 76) + t;
    g.S(k.band([x1 + 12, y1], [x1 - out, y1], [x2 - out, y2], [x2 + 12, y2], t));
    g.S(h.poly([[w * .3, -ht + 18], [w * .38 + 34, -ht - 14], [w * .38 + 4, -ht + 44]]));
  }
  g.S(k.mirror(half, 0, V.smooth));
  var n = V.bands.length ? g.at(2, 1, 0) : 0, L = pts.length;
  for (var i = 0; i < n; i++){ var j = V.bands[i], a = pts[j], b = pts[L - j]; g.D(h.line(a, b)); }
  if (p.vase === "mason" && g.is(2)) g.D(h.line(pts[2], pts[L - 2]), 1);
}

/* ---------- blooms, centred on (0, 0), radius R ----------
   Petals in a ring are kept from touching at their widest, so the gaps
   between them stay open to the paper (no tiny closed wedges). */
/* the most petals (from n down to least) whose petals are still big
   enough to color at this tier and size; 0 when none are */
function petalsThatFit(g, n, least, r0, R, shape, kw){
  for (var m = n; m >= least; m--){ var widest = r0 + (R - r0) * (shape === "round" ? .6 : .3), pw = (kw || .8) * 2 * Math.PI * widest / m;
    if (g.fits(h.petal(0, 0, -90, Math.max(r0, R * .42), R, pw, shape), shape === "pointed" ? 1.8 : 1.5, pw * .8)) return m; }
  return 0;
}
function ring(g, n, r0, R, shape, rot, kw){
  var widest = r0 + (R - r0) * (shape === "round" ? .6 : .3), pw = (kw || .8) * 2 * Math.PI * widest / n;
  for (var i = 0; i < n; i++) g.S(h.petal(0, 0, (rot || -90) + i * 360 / n, r0, R, pw, shape));
}
function bloom(g, f, R){
  if (f === "tulip"){
    var w = R * .82, t = R * .2;
    g.S(h.smooth([[-w, -R * .9], [-t, -R * .5], [0, -R * 1.05], [t, -R * .5], [w, -R * .9], [w * 1.06, R * .1], [0, R * .7], [-w * 1.06, R * .1]], false, .8));
    g.D(h.line([-t, -R * .5], [0, R * .7]), 3); g.D(h.line([t, -R * .5], [0, R * .7]), 3);
  } else if (f === "daisy" || f === "sunflower"){
    var c = R * (f === "daisy" ? .34 : .42), shape = f === "daisy" ? "oval" : "pointed";
    var np = petalsThatFit(g, f === "daisy" ? g.at(14, 11, 8) : g.at(16, 12, 9), 5, c * .85, R, shape);
    if (np){ ring(g, np, c * .85, R, shape); g.S(h.circle(0, 0, g.dot(c))); }
    else { g.S(h.scallop(0, 0, R, 6, .18, -90)); if (g.ringFits(R * .82, g.dot(c))) g.S(h.circle(0, 0, g.dot(c))); }
    if (f === "sunflower" && g.is(3)) g.S(h.circle(0, 0, g.dot(c * .5)));
  } else if (f === "rose"){
    /* rings from the outside in, each only if it leaves a ring wide enough */
    g.S(h.scallop(0, 0, R, 5, .14, -90));
    var rIn = R * .86;
    if (g.ringFits(rIn, R * .6)){ g.S(h.scallop(0, 0, R * .6, 5, .14, -90)); rIn = R * .6 * .86; }
    var cr = g.dot(R * .24);
    if (g.ringFits(rIn, cr)) g.S(h.circle(0, 0, cr));
  } else if (f === "daffodil"){
    if (petalsThatFit(g, 6, 6, R * .3, R, "oval", .86)) ring(g, 6, R * .3, R, "oval", -90, .86); else g.S(h.scallop(0, 0, R, 6, .22, -90));
    g.S(h.scallop(0, 0, R * .42, 8, .1, -90));
    if (g.is(2) && g.ringFits(R * .42 * .9, g.dot(R * .18))) g.S(h.circle(0, 0, g.dot(R * .18)));
  } else {
    var zl = g.at(13, 11, 9), zr = R * .87;
    g.S(h.scallop(0, 0, R, zl, .13, -90));
    if (g.ringFits(zr, R * .62)){ g.S(h.scallop(0, 0, R * .62, zl, .13, -90)); zr = R * .62 * .87; }
    if (g.ringFits(zr, g.dot(R * .26))) g.S(h.circle(0, 0, g.dot(R * .26)));
  }
}

/* where the blooms sit: on an arc about a point inside the vase mouth */
function layout(p, tier){
  var n = tier === 3 ? Math.min(3, p.n) : p.n, R = (n === 1 ? 92 : n === 3 ? 66 : 52) * p.size * (tier === 3 ? 1.25 : 1);
  var angs = n === 1 ? [0] : n === 3 ? [-38, 0, 38] : [-62, -31, 0, 31, 62], rad = n === 1 ? [1] : n === 3 ? [.86, 1.06, .86] : [.72, .96, 1.1, .96, .72];
  var S = n === 1 ? 150 + R * .6 : n === 3 ? (2 * R + 18) / .64 : (2 * R + 18) / .49;
  var pivot = [0, -p.vh + 34];
  return { R:R, pivot:pivot, pts:angs.map(function(a, i){ var r = S * rad[i], t = a * Math.PI / 180; return [pivot[0] + Math.sin(t) * r, pivot[1] - Math.cos(t) * r, a]; }) };
}

I.family({
  id:"flowers", label:"Garden flowers", template:"flower-arrangement",
  settings:["table", "sill", "doily", "shelf", "tray", "plain"],
  params:function(R){
    return { vase:R.pick(Object.keys(VASES)), flower:R.pick(Object.keys(FLOWERS)), n:R.pick([1, 3, 3, 5]), vw:R.int(150, 196), vh:R.int(190, 250),
      size:R.range(.92, 1.08), leaves:R.chance(.75), season:"" };
  },
  key:function(p){ return p.flower + ":" + p.vase; },
  subject:function(p){ return (p.n === 1 ? ONE[p.flower] : (p.n === 3 ? "three " : "five ") + FLOWERS[p.flower]) + " in a " + VASES[p.vase].label; },
  title:function(p){ var t = FLOWERS[p.flower]; t = t.charAt(0).toUpperCase() + t.slice(1); return p.n === 1 ? "A Single " + ONE[p.flower].slice(2).replace(/^./, function(c){ return c.toUpperCase(); }) : t + " in a " + VASES[p.vase].label.replace(/(^|\s)\S/g, function(c){ return c.toUpperCase(); }); },
  talk:function(p, R){ return R.pick(["Which flowers would you pick for a table bouquet?", "Tell me about a garden you liked to visit.", "Who would you give these flowers to?",
    "Which flower has your favorite scent?", "What colors would make this bouquet cheerful?"]); },
  tags:function(p){ return ["flowers", p.flower, "bouquets"]; },
  draw:function(g, h, p){
    var Lo = layout(p, g.tier), R = Lo.R;
    Lo.pts.forEach(function(q){ g.L(h.smooth([Lo.pivot, [q[0] * .45, Lo.pivot[1] + (q[1] - Lo.pivot[1]) * .5], [q[0], q[1]]], true)); });
    if ((p.leaves || Lo.pts.length === 1) && g.is(2)){
      [Lo.pts[0], Lo.pts[Lo.pts.length - 1]].forEach(function(q, i){
        var s = i ? 1 : -1, a = Lo.pts.length === 1 ? [0, Lo.pivot[1] + (q[1] - Lo.pivot[1]) * (i ? .46 : .34)] : [q[0] * .3, Lo.pivot[1] + (q[1] - Lo.pivot[1]) * .32];
        g.S(h.leaf(a, [a[0] + s * g.at(70, 76, 0), a[1] - 24], g.tube(g.at(30, 34, 0)), s * .4));
      });
    }
    Lo.pts.forEach(function(q){ g.group({ x:q[0], y:q[1], rot:p.flower === "tulip" ? q[2] * .4 : 0 }, function(gg){ bloom(gg, p.flower, R); }); });
    vase(g, p);
  }
});
})(globalThis.CognicopiaColoring);
