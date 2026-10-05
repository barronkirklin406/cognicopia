/* Cognicopia Infinite Pages, family: harvest and kitchen garden.
   A bowl of fruit, a basket of apples or tomatoes, a pumpkin with its
   leaf, and a single large apple, pear or lemon. Fruit is spaced so the
   ones behind show well above the ones in front, and the bowl or basket
   is drawn last so it covers the bottoms cleanly. Creases and ribs run from
   the top point of a fruit's outline to its bottom point.
   See assets/cognicopia-coloring/infinite.js for the family contract. */
(function(C){
"use strict";
var I = C && C.infinite;
if (!I) return;
var h = C.helpers, k = I.kit;

var FRUIT = { apple:"apples", pear:"pears", lemon:"lemons", orange:"oranges", peach:"peaches", plum:"plums", tomato:"tomatoes" };

/* one fruit centred at (x, y), radius R */
function fruit(g, kind, x, y, R, leafSide, top){
  /* only fruit on top of a pile shows its stem, and only one its leaf */
  var stem = function(){ if (top === false) return; var w = g.tube(R * .14), d = h.rrect(x - w / 2, y - R * 1.12, w, R * .5, w * .4);
    if (g.fits(h.rect(0, 0, w, R * .3), 1.4, w)) g.S(d); else g.K(d); };
  var leaf = function(){ if ((g.is(2) || top === "single") && leafSide && top !== false){ var a = [x + leafSide * 4, y - R * .92], lw = g.tube(R * .34), tip = [a[0] + leafSide * R * .78, a[1] - R * .36];
    g.S(h.leaf(a, tip, lw, leafSide * .4)); if (g.is(3) && top === "single") g.D(h.vein(a, tip, leafSide * .4, 1)); } };
  if (kind === "apple" || kind === "tomato"){
    stem(); leaf();
    var a = kind === "apple" ? 1 : .86;
    g.S(k.mirror([[0, -R * .74 * a], [R * .48, -R * .98 * a], [R * .96, -R * .5 * a], [R, R * .2], [R * .62, R * .86], [0, R * .82]].map(function(q){ return [x + q[0], y + q[1]]; }), x, .95));
  } else if (kind === "pear"){
    stem(); leaf();
    g.S(k.mirror([[0, -R * 1.18], [R * .36, -R * 1.04], [R * .5, -R * .44], [R * .96, R * .3], [R * .74, R * .86], [0, R * .96]].map(function(q){ return [x + q[0], y + q[1]]; }), x, .95));
  } else if (kind === "lemon"){
    leaf();
    g.S(h.smooth([[x - R * 1.18, y], [x - R * .8, y - R * .7], [x, y - R * .8], [x + R * .8, y - R * .7], [x + R * 1.18, y], [x + R * .8, y + R * .7], [x, y + R * .8], [x - R * .8, y + R * .7]], false, .9));
  } else if (kind === "plum"){
    stem();
    g.S(h.ellipse(x, y, R * .86, R));
    if (g.is(2) && top === "single") g.D(h.smooth([[x, y - R], [x - R * .3, y], [x, y + R]], true));
  } else {
    if (kind === "orange") leaf(); else stem();
    g.S(h.circle(x, y, R));
    if (kind === "peach" && g.is(2) && top === "single") g.D(h.smooth([[x, y - R], [x - R * .34, y], [x, y + R]], true));
    if (kind === "orange" && g.is(3)) g.K(h.circle(x, y - R * .5, g.min(4, 4)));
  }
}
/* where the fruit sits above a rim at y = rim, spread over a width w */
/* how wide each fruit is, in radii */
var WIDTH = { apple:2, tomato:2, pear:1.9, lemon:2.36, plum:1.72, orange:2, peach:2 };
/* the fruit above a rim at y = rim: a back row standing well above the
   front row, and neighbours overlapping a little so no small gaps open
   between them; one leaf, on the middle fruit at the top */
function pile(n, w, R, rim, kind, lift){
  var out = [], front = Math.min(n, 3), back = n - front, sp = R * (WIDTH[kind] || 2) * .84, up = lift || 0;
  for (var j = 0; j < back; j++) out.push([(j - (back - 1) / 2) * sp, rim - R * 1.3 - up, j === 0 ? 1 : 0, true]);
  for (var i = 0; i < front; i++) out.push([(i - (front - 1) / 2) * sp, rim - R * .36 - up, !back && i === 1 ? 1 : 0, !back]);
  return out;
}
function bowl(g, p){
  var bw = p.W * 1.1, bh = p.H * .5, R = g.min(p.R, g.at(26, 36, 58)), rim = -bh, n = g.lvl === 1 ? Math.min(p.n, 3) : p.n;
  var widest = WIDTH[p.mix] > WIDTH[p.fruit] ? p.mix : p.fruit;
  pile(n, bw * .92, R, rim, widest, g.lvl === 1 ? R * .42 : 0).forEach(function(q, i){ fruit(g, i % 2 && p.mix ? p.mix : p.fruit, q[0], q[1], R, q[2], q[3]); });
  var half = [[0, -bh], [bw * .5, -bh], [bw * .44, -bh * .46], [bw * .24, -bh * .16], [bw * .17, -bh * .1], [bw * .23, 0], [0, 0]];
  g.S(k.mirror(half, 0, .9));
  var pts = k.mirrorPts(half, 0);
  if (g.is(2)) g.D(h.line(pts[2], pts[pts.length - 2]));
  if (g.is(3)) g.D(h.line(pts[3], pts[pts.length - 3]));
}
function basket(g, p){
  var bw = p.W * 1.1, bh = p.H * .52, R = g.min(p.R, g.at(26, 36, 52)), rim = -bh, t = g.tube(g.at(18, 22, 30));
  /* the handle arches over the fruit, from inside the basket */
  var hh = bh * .9 + R * 2.2;
  if (g.is(2)) g.S(k.band([-bw * .44, rim + 20], [-bw * .44, rim - hh], [bw * .44, rim - hh], [bw * .44, rim + 20], t));
  pile(g.lvl === 1 ? 3 : p.n, bw * .86, R, rim, p.fruit, g.lvl === 1 ? R * .25 : 0).forEach(function(q){ fruit(g, p.fruit, q[0], q[1], R, q[2], q[3]); });
  var body = [[-bw / 2, rim], [bw / 2, rim], [bw * .38, 0], [-bw * .38, 0]];
  g.S(k.round(body, [4, 4, 10, 10]));
  var rh = g.min(18, g.at(14, 22, 34));
  g.S(h.rrect(-bw / 2 - 8, rim - rh / 2, bw + 16, rh, rh / 2));
  if (g.is(2)){
    var n = g.at(5, 3, 0);
    for (; n > 0; n--){ if (g.fits(h.rect(0, 0, bw * .76 / (n + 1), bh * .7), 1.6, bw * .76 / (n + 1))) break; }
    for (var i = 1; i <= n; i++){ var f = i / (n + 1); g.D(h.line([-bw / 2 + bw * f, rim + rh / 2], [-bw * .38 + bw * .76 * f, 0])); }
    if (g.is(3)){ var y = rim + bh * .55; g.D(h.line([k.xAt(body[0], body[3], y), y], [k.xAt(body[1], body[2], y), y])); }
  }
}
function pumpkin(g, p){
  var R = p.W * .56, Hh = R * .64, cy = -Hh;
  var two = p.n > 3 && g.is(2);
  if (two){ var r2 = R * .46; g.S(h.smooth([[R * 1.2, cy + Hh - r2 * 1.5], [R * 1.2 + r2, cy + Hh - r2 * .8], [R * 1.2, cy + Hh], [R * 1.2 - r2, cy + Hh - r2 * .8]], false, 1)); }
  var stw = g.tube(26);
  g.S(k.round([[-stw / 2, cy - Hh * .7], [-stw * .4, cy - Hh * 1.24], [stw * .8, cy - Hh * 1.3], [stw / 2, cy - Hh * .7]], [0, 6, 6, 0]));
  if (g.is(2)){ var a = [stw * .6, cy - Hh * .84]; g.S(h.leaf(a, [a[0] + R * .7, a[1] - R * .36], g.tube(R * .3), .4)); }
  /* a wide, low pumpkin with a dimple at the stem and at the base */
  var top = [0, cy - Hh * .64], bot = [0, cy + Hh * .9];
  g.S(k.mirror([top, [R * .36, cy - Hh * .98], [R * .8, cy - Hh * .76], [R * 1.02, cy - Hh * .08], [R * .9, cy + Hh * .7], [R * .46, cy + Hh * .99], bot], 0, .95));
  /* ribs from the stem to the base, bowing out, wide apart so every lobe is big */
  (g.lvl === 3 ? [.36, .72] : [.42]).forEach(function(f){
    [-1, 1].forEach(function(s){ g.D(h.smooth([top, [s * R * f * .82, cy - Hh * .62], [s * R * f, cy + Hh * .1], [s * R * f * .7, cy + Hh * .8], bot], true), 1); });
  });
}
function single(g, p){
  var R = 150, kind = p.fruit === "lemon" ? "lemon" : p.fruit === "pear" ? "pear" : "apple";
  /* a second leaf on the other side at Tier 1, each with its midrib */
  if (g.is(2)){ var a = [-4, -R - R * .92], tip = [a[0] - R * .7, a[1] - R * .26]; g.S(h.leaf(a, tip, g.tube(R * .32), -.4)); g.D(h.vein(a, tip, -.4, 1), 3); }
  fruit(g, kind, 0, -R, R, 1, "single");
}

var KINDS = { bowl:"a bowl of ", basket:"a woven basket of ", pumpkin:"a ribbed pumpkin with its leaf", single:"one large " };
I.family({
  id:"harvest", label:"Harvest and kitchen garden", template:"harvest-still-life",
  settings:["table", "doily", "sill", "porch", "plain"],
  settingsFor:function(p){ return p.type === "pumpkin" ? ["porch", "lawn", "plain"] : ["table", "doily", "sill", "plain"]; },
  params:function(R, tier){
    var type = R.pick(tier === 1 ? ["bowl", "bowl", "basket", "pumpkin"] : ["bowl", "bowl", "basket", "pumpkin", "single"]), fr = R.pick(["apple", "pear", "lemon", "orange", "peach", "plum"]);
    if (type === "basket") fr = R.pick(["apple", "tomato", "peach", "orange"]);
    if (type === "single") fr = R.pick(["apple", "pear", "lemon"]);
    return { type:type, fruit:fr, mix:type === "bowl" && R.chance(.4) ? R.pick(["apple", "pear", "orange", "lemon"]) : "", n:R.pick([3, 4, 5]), W:R.int(220, 270), H:R.int(150, 190), R:R.int(40, 50), season:type === "pumpkin" ? "fall" : "" };
  },
  key:function(p){ return p.type + ":" + p.fruit; },
  subject:function(p){
    if (p.type === "pumpkin") return KINDS.pumpkin;
    if (p.type === "single") return KINDS.single + p.fruit;
    return KINDS[p.type] + FRUIT[p.fruit] + (p.mix && p.mix !== p.fruit ? " and " + FRUIT[p.mix] : "");
  },
  title:function(p){
    if (p.type === "pumpkin") return "The Harvest Pumpkin";
    if (p.type === "single") return { apple:"A Ripe Apple", pear:"A Ripe Pear", lemon:"A Fresh Lemon" }[p.fruit];
    var f = FRUIT[p.fruit]; return (p.type === "bowl" ? "A Bowl of " : "A Basket of ") + f.charAt(0).toUpperCase() + f.slice(1);
  },
  talk:function(p, R){ return R.pick(["What would you bake with these?", "Where did the best fruit come from when you were growing up?", "Tell me about a harvest or a market you enjoyed.",
    "What is your favorite fruit, and when does it taste best?", "Who would you share these with?"]); },
  tags:function(p){ return ["harvest", "fruit", p.fruit, p.type].filter(Boolean); },
  draw:function(g, h, p){ ({ bowl:bowl, basket:basket, pumpkin:pumpkin, single:single })[p.type](g, p); }
});
})(globalThis.CognicopiaColoring);
