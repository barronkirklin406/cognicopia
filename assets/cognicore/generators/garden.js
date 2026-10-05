/* Cognicopia Infinite Pages, family: garden tools.
   Watering cans (drum, oval and French styles, with or without a rose),
   clay pots of geraniums, tulips, seedlings or a fern, wheelbarrows (empty,
   with soil or with pumpkins) and birdhouses on a post. Parts that join
   (spouts, handles, stems, legs) are drawn first and tucked under the part
   in front, so every edge meets another edge.
   See assets/cognicore/infinite.js for the family contract. */
(function(C){
"use strict";
var I = C && C.infinite;
if (!I) return;
var h = C.helpers, k = I.kit;
var D2R = Math.PI / 180;

var sideX = k.sideX, bandC = k.band, bar = k.bar;

/* ---------- watering can ---------- */
function wateringCan(g, p){
  var bw = p.bw, bh = p.bh, t = g.tube(g.at(18, 24, 32)), body, r;
  var style = p.style;
  if (style === "drum"){ body = [[-bw / 2, -bh], [bw / 2, -bh], [bw / 2, 0], [-bw / 2, 0]]; r = [10, 10, 14, 14]; }
  else if (style === "french"){ body = [[-bw * .36, -bh], [bw * .36, -bh], [bw / 2, 0], [-bw / 2, 0]]; r = [10, 10, 14, 14]; }
  else { body = [[-bw * .4, -bh], [bw * .4, -bh], [bw / 2 + 12, -bh * .45], [bw * .42, 0], [-bw * .42, 0], [-bw / 2 - 12, -bh * .45]]; r = [12, 12, 40, 14, 14, 40]; }
  /* spout: from inside the body, up and out to the right */
  var a = p.spoutA * D2R, d = [Math.cos(a), -Math.sin(a)], n = [Math.sin(a), Math.cos(a)], ys = -bh * .26, xs = sideX(body, ys, true);
  var B = [xs - d[0] * 40, ys - d[1] * 40], T = [xs + d[0] * p.spoutL, ys + d[1] * p.spoutL], wt = g.tube(g.at(18, 24, 34)), wb = Math.max(wt + 8, g.at(28, 32, 42));
  var off = function(P, w, s){ return [P[0] + n[0] * w / 2 * s, P[1] + n[1] * w / 2 * s]; };
  g.S(h.poly([off(B, wb, 1), off(T, wt, 1), off(T, wt, -1), off(B, wb, -1)]));
  if (p.rose && g.is(2)){
    var R0 = [T[0] - d[0] * 6, T[1] - d[1] * 6], ln = g.min(g.at(36, 40, 0), 40), R1 = [T[0] + d[0] * ln, T[1] + d[1] * ln], wr = Math.max(wt * 2.4, g.at(56, 62, 0));
    g.S(h.poly([off(R0, wt, 1), off(R1, wr, 1), off(R1, wr, -1), off(R0, wt, -1)]));
    g.S(h.ellipse(R1[0], R1[1], g.min(g.at(10, 13, 0), g.at(12, 18, 0)), wr / 2 + 5, -p.spoutA));
  }
  /* handles: over the top, behind, or both */
  var handle = g.lvl === 1 ? "top" : p.handle;
  var xA = body[0][0] * .82 + 6, xB = bw * g.at(.2, .24, .3), hh = bh * g.at(.42, .4, .36) + g.at(22, 26, 30) + t;
  if (handle !== "back") g.S(bandC([xA, -bh + 10], [xA - 4, -bh - hh * 1.3], [xB + 4, -bh - hh * 1.3], [xB, -bh + 10], t));
  if (handle !== "top"){
    var y1 = -bh * .84, y2 = -bh * .26, xl1 = sideX(body, y1, false), xl2 = sideX(body, y2, false), out = g.at(84, 96, 110) + t;
    g.S(bandC([xl1 + 16, y1], [xl1 - out, y1], [xl2 - out, y2], [xl2 + 16, y2], t));
  }
  g.S(k.round(body, r));
  if (handle !== "back" && g.is(2)) g.S(h.ellipse((xA + xB) / 2, -bh, (xB - xA) / 2 - t / 2 - 14, g.at(13, 17, 0)));
  /* galvanized bands */
  [[-bh * .16, 2], [-bh * .78, 3]].forEach(function(b){ g.D(h.line([sideX(body, b[0], false), b[0]], [sideX(body, b[0], true), b[0]]), b[1]); });
}

/* ---------- potted plant ---------- */
function pottedPlant(g, p){
  var pw = p.pw, pb = pw * .72, ph = p.ph, rh = g.at(30, 34, 40), soil = -ph + 12;
  var plant = p.plant, top = -ph;
  if (plant === "geranium"){
    var heads = [[-62, top - 150], [8, top - 196], [70, top - 140]].slice(0, g.at(3, 3, 2));
    if (g.lvl === 1) heads = [[-38, top - 160], [44, top - 170]];
    var lv = [[-78, top - 34, 40], [76, top - 40, 38], [0, top - 70, 36]];
    heads.forEach(function(c){ g.L(h.smooth([[c[0] * .2, soil], [c[0] * .6, (soil + c[1]) / 2], [c[0], c[1]]], true)); });
    lv.slice(0, g.at(3, 3, 2)).forEach(function(l){ g.S(h.scallop(l[0], l[1], l[2] * p.leaf, 8, .14, 10)); if (g.lvl >= 3) g.S(h.circle(l[0], l[1], l[2] * p.leaf * .46)); });
    heads.forEach(function(c){ var rr = g.at(40, 44, 50) * p.bloom; g.S(h.scallop(c[0], c[1], rr, g.at(12, 10, 8), .11, -90)); if (g.lvl >= 3) g.S(h.scallop(c[0], c[1], rr * .5, 6, .16, -90)); });
  } else if (plant === "tulips"){
    var tt = g.lvl === 1 ? [[-48, top - 150, -10], [48, top - 186, 10]] : [[-58, top - 150, -12], [0, top - 196, 0], [58, top - 140, 12]];
    [[-1, -80, top - 90], [1, 78, top - 100]].forEach(function(l){ g.S(h.leaf([l[0] * 14, soil], [l[1], l[2]], g.at(34, 38, 44), l[0] * .4)); });
    tt.forEach(function(c){ g.L(h.smooth([[c[0] * .25, soil], [c[0] * .7, (soil + c[1]) / 2], [c[0], c[1] + 20]], true)); });
    tt.forEach(function(c){ g.group({ x:c[0], y:c[1], rot:c[2], s:p.bloom * g.at(1, 1.08, 1.45) }, function(gg){ tulip(gg); }); });
  } else if (plant === "seedlings"){
    /* neighbours alternate short and tall, so their leaves never touch */
    var n = g.at(4, 3, 2), ll = g.at(46, 52, 60), lw = g.tube(g.at(26, 30, 38));
    for (var grow = 0; grow < 8 && !g.fits(h.leaf([0, 0], [ll, -24], lw, .5), 1.5, lw); grow++){ ll *= 1.1; lw *= 1.1; }
    var sp = ll * 1.25;
    for (var i = 0; i < n; i++){
      var x = (i - (n - 1) / 2) * sp, ht = (i % 2 ? 58 + ll : 64) + (p.v * 7) % 14, y = top - ht;
      g.L(h.line([x, soil], [x, y + 6]));
      g.S(h.leaf([x, y + 4], [x - ll, y - 22], lw, -.5));
      g.S(h.leaf([x, y + 4], [x + ll, y - 30], lw, .5));
    }
  } else {
    /* fern fronds rise from across the pot and arch outward */
    var m = g.at(7, 5, 3);
    for (var j = 0; j < m; j++){
      var f = m === 1 ? .5 : j / (m - 1), ang = -142 + f * 104, sx = (f - .5) * pw * .5, len = (132 + 44 * Math.sin(f * Math.PI)) * p.leaf;
      var tip = [sx + Math.cos(ang * D2R) * len, soil + Math.sin(ang * D2R) * len], bend = f < .5 ? -.7 : f > .5 ? .7 : 0;
      g.S(h.leaf([sx, soil], tip, g.tube(g.at(36, 42, 50)), bend));
      g.D(h.vein([sx, soil], tip, bend, 1), 3);
    }
  }
  if (p.saucer) g.S(h.rrect(-pb / 2 - 20, -12, pb + 40, 24, 10), 2);
  g.S(k.round([[-pw / 2, -ph + rh], [pw / 2, -ph + rh], [pb / 2, 0], [-pb / 2, 0]], [0, 0, 8, 8]));
  g.S(h.rrect(-pw / 2 - 12, -ph, pw + 24, rh, 6));
}
function tulip(g){
  g.S(h.smooth([[-26, -32], [-8, -14], [0, -38], [8, -14], [26, -32], [28, 4], [0, 26], [-28, 4]], false, .8));
  g.D(h.line([-8, -14], [0, 26]), 3); g.D(h.line([8, -14], [0, 26]), 3);
}

/* ---------- wheelbarrow ----------
   The wheel overlaps the tray's front corner and the handles and leg start
   inside the tray, so every joint is one clean crossing. */
function wheelbarrow(g, p){
  var d = p.depth, top = -70 - d, wr = p.wheelR, wx = 62 + wr * .62, wy = -wr, t = g.tube(g.at(16, 20, 26));
  var tray = [[-150, top], [132, top], [62, -70], [-112, -70]];
  g.S(bar([-96, -110], [-246, top + 22], t));
  g.S(bar([-82, -96], [-104, 0], t));
  if (g.is(2)) g.S(h.rrect(-270, top + 22 - (t + 8) / 2, 46, t + 8, (t + 8) / 2));
  if (p.load === "soil") g.S(h.path([-146, top + 6]).C([-110, top - 70], [90, top - 76], [128, top + 6]).Z());
  if (p.load === "pumpkins"){
    [[-62, top - 30, 50], [48, top - 26, 44]].forEach(function(c){
      g.S(h.smooth([[c[0], c[1] - c[2] * .78], [c[0] + c[2], c[1] - c[2] * .4], [c[0] + c[2] * 1.05, c[1] + c[2] * .3], [c[0], c[1] + c[2] * .8], [c[0] - c[2] * 1.05, c[1] + c[2] * .3], [c[0] - c[2], c[1] - c[2] * .4]]));
      g.D(h.smooth([[c[0], c[1] - c[2] * .78], [c[0] - c[2] * .42, c[1]], [c[0] - c[2] * .3, c[1] + c[2] * .79]], true), 3);
      g.D(h.smooth([[c[0], c[1] - c[2] * .78], [c[0] + c[2] * .42, c[1]], [c[0] + c[2] * .3, c[1] + c[2] * .79]], true), 3);
      g.S(h.rrect(c[0] - g.tube(14) / 2, c[1] - c[2] * .78 - 24, g.tube(14), 28, 5), 2);
    });
  }
  g.S(h.poly(tray));
  if (g.lvl >= 3) g.S(h.poly([[-150, top], [132, top], [k.xAt(tray[1], tray[2], top + 20), top + 20], [k.xAt(tray[0], tray[3], top + 20), top + 20]]));
  g.S(h.circle(wx, wy, wr));
  if (g.is(2)) g.S(h.circle(wx, wy, g.dot(wr * .36))); else g.K(h.circle(wx, wy, 9));
}

/* ---------- birdhouse ---------- */
function birdhouse(g, p){
  var bw = p.bw, bh = p.bh, rh = p.rh, post = p.post, ov = g.at(22, 24, 26), rt = g.tube(g.at(18, 22, 28)), pw = g.tube(g.at(26, 32, 40));
  var y0 = -post, eave = y0 - bh, apex = [0, eave - rh];
  g.S(h.rect(-pw / 2, y0 + 10, pw, post - 10));
  g.S(h.rrect(-bw / 2 - 12, y0 - 2, bw + 24, g.at(18, 22, 26), 4));
  g.S(h.poly([[-bw / 2, y0], [bw / 2, y0], [bw / 2, eave], apex, [-bw / 2, eave]]));
  var slope = rh / (bw / 2), ex = bw / 2 + ov, ey = eave + ov * slope;
  g.S(h.poly([[0, apex[1] - rt], [-ex, ey - rt], [-ex, ey], apex]));
  g.S(h.poly([[0, apex[1] - rt], [ex, ey - rt], [ex, ey], apex]));
  var hy = eave + bh * .42, hr = g.at(17, 21, 25);
  g.K(h.circle(0, hy, hr));
  if (g.is(2)) g.K(h.circle(0, hy + hr + 16, 6));
  (g.lvl >= 3 ? [.8, .92] : g.lvl === 2 && p.siding ? [.86] : []).forEach(function(f){ var y = eave + bh * f; g.D(h.line([-bw / 2, y], [bw / 2, y]), 2); });
}

var TYPES = { "watering-can":"watering can", "potted-plant":"clay pot", wheelbarrow:"wheelbarrow", birdhouse:"birdhouse" };
var PLANTS = { geranium:"red geraniums", tulips:"tulips", seedlings:"young seedlings", fern:"a Boston fern" };
I.family({
  id:"garden", label:"Garden tools", template:"garden-tool",
  settings:["lawn", "bench", "porch", "sill", "table", "shelf", "plain"],
  compositionsFor:function(p){ return p.type === "wheelbarrow" ? ["centered", "grounded", "arch"] : ["centered", "grounded", "arch", "cameo", "tile"]; },
  boxesFor:function(p){ return p.type === "wheelbarrow" ? I.WIDE : null; },
  settingsFor:function(p){ return { "watering-can":["lawn", "bench", "porch", "plain"], "potted-plant":["sill", "table", "bench", "shelf", "porch", "plain"],
    wheelbarrow:["lawn"], birdhouse:["lawn"] }[p.type]; },
  params:function(R, tier, o){
    var type = R.pick(o.type || ["watering-can", "watering-can", "potted-plant", "potted-plant", "wheelbarrow", "birdhouse"]);
    if (type === "watering-can") return { type:type, style:R.pick(["drum", "oval", "french"]), bw:R.int(190, 230), bh:R.int(150, 195), spoutA:R.int(36, 50),
      spoutL:R.int(150, 185), rose:R.chance(.7), handle:R.pick(["top", "top", "back", "both"]) };
    if (type === "potted-plant") return { type:type, plant:R.pick(["geranium", "tulips", "seedlings", "fern"]), pw:R.int(150, 190), ph:R.int(130, 170),
      leaf:R.range(.92, 1.1), bloom:R.range(.92, 1.08), saucer:R.chance(.5), v:R.int(0, 9) };
    if (type === "wheelbarrow") return { type:type, depth:R.int(100, 126), wheelR:R.int(46, 54), load:R.pick(["empty", "soil", "pumpkins"]) };
    return { type:type, bw:R.int(120, 160), bh:R.int(110, 150), rh:R.int(56, 80), post:R.int(120, 170), siding:R.chance(.6) };
  },
  key:function(p){ return p.type + ":" + (p.style || p.plant || p.load || "post"); },
  subject:function(p){
    if (p.type === "watering-can") return ({ drum:"galvanized", oval:"oval galvanized", french:"tall French-style" })[p.style] + " watering can" + (p.rose ? " with a sprinkler rose" : " with a long spout");
    if (p.type === "potted-plant") return "clay flowerpot of " + PLANTS[p.plant];
    if (p.type === "wheelbarrow") return "garden wheelbarrow" + ({ empty:"", soil:" full of garden soil", pumpkins:" carrying two pumpkins" })[p.load];
    return "wooden birdhouse on a post";
  },
  title:function(p){
    if (p.type === "watering-can") return "The Watering Can";
    if (p.type === "potted-plant") return ({ geranium:"Geraniums in a Clay Pot", tulips:"Potted Tulips", seedlings:"Seedlings in a Pot", fern:"The Potted Fern" })[p.plant];
    if (p.type === "wheelbarrow") return p.load === "pumpkins" ? "Pumpkins in the Wheelbarrow" : "The Garden Wheelbarrow";
    return "The Birdhouse";
  },
  talk:function(p, R){ return R.pick([
    "What would you plant first in a spring garden?", "Who taught you how to garden?", "What grew best where you lived?",
    p.type === "birdhouse" ? "Which birds came to your yard?" : "What is the best time of day to work in a garden?",
    p.type === "potted-plant" ? "Which flowers would you choose for a sunny window?" : "Tell me about a garden you liked to spend time in."]); },
  tags:function(p){ return ["gardening", p.type, p.plant || p.load || p.style || "outdoors"].filter(Boolean); },
  draw:function(g, h, p){
    if (p.type === "watering-can") wateringCan(g, p);
    else if (p.type === "potted-plant") pottedPlant(g, p);
    else if (p.type === "wheelbarrow") wheelbarrow(g, p);
    else birdhouse(g, p);
  }
});
})(globalThis.CogniCore);
