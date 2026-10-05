/* Cognicopia Infinite Pages, family: backyard songbirds.
   Cardinal, blue jay, robin, chickadee, goldfinch, bluebird, sparrow and
   wren, perched on a leafy branch, a berry branch, a blossom branch, a
   fence post or the rim of a birdbath. One body is shaped by each
   species' proportions (head size, body length, bill, crest, tail), and
   its markings (a mask, a cap, a bib, a breast patch) are lines drawn
   between points of the bird's own outline, so every color area is closed.
   The eye is a small solid dot: true to life, never a cartoon eye.
   See assets/cognicopia-coloring/infinite.js for the family contract. */
(function(C){
"use strict";
var I = C && C.infinite;
if (!I) return;
var h = C.helpers, k = I.kit, D2R = Math.PI / 180;

var SPECIES = {
  cardinal:  { title:"The Cardinal", name:"northern cardinal", hr:31, bl:150, bh:92, crest:1, bill:"seed", tailL:112, tailW:36, tailA:128, marks:["mask"] },
  bluejay:   { title:"The Blue Jay", name:"blue jay", hr:32, bl:162, bh:90, crest:1, bill:"stout", tailL:122, tailW:38, tailA:132, marks:["necklace", "bars"] },
  robin:     { title:"The Robin", name:"American robin", hr:30, bl:162, bh:96, bill:"thin", tailL:102, tailW:34, tailA:138, marks:["hood", "breast"] },
  chickadee: { title:"The Chickadee", name:"black-capped chickadee", hr:34, bl:128, bh:92, bill:"short", tailL:98, tailW:30, tailA:136, marks:["cap", "bib", "bars"] },
  goldfinch: { title:"The Goldfinch", name:"American goldfinch", hr:28, bl:130, bh:84, bill:"seed", tailL:84, tailW:30, tailA:140, notch:1, marks:["forecap", "bars"] },
  bluebird:  { title:"The Bluebird", name:"eastern bluebird", hr:30, bl:142, bh:92, bill:"thin", tailL:88, tailW:32, tailA:136, marks:["breast"] },
  sparrow:   { title:"The Song Sparrow", name:"song sparrow", hr:30, bl:142, bh:86, bill:"seed", tailL:98, tailW:32, tailA:140, marks:["crown"] },
  wren:      { title:"The Carolina Wren", name:"Carolina wren", hr:27, bl:124, bh:84, bill:"long", tailL:84, tailW:30, tailA:-128, marks:["crown"] }
};
var PERCHES = {
  leafy:    { label:"Leafy branch", words:"perched on a leafy branch" },
  berries:  { label:"Berry branch", words:"perched on a branch with ripe berries" },
  blossoms: { label:"Blossom branch", words:"perched on a flowering branch" },
  post:     { label:"Fence post", words:"perched on a wooden fence post" },
  bath:     { label:"Birdbath", words:"perched on the rim of a birdbath" }
};

/* the bird's points, feet at (0, 0), facing right */
function geometry(p){
  var S = SPECIES[p.species], f = p.size, hr = S.hr * f, bl = S.bl * f, bh = S.bh * f;
  /* the body sits on the perch: its lowest point just below y = 0, so the
     belly feathers cover the feet and no small gaps open under the bird */
  var tilt = (-22 + (p.tilt || 0)) * D2R, ca = Math.cos(tilt), sa = Math.sin(tilt);
  var B = [-6 * f, 5 - Math.sqrt(Math.pow(bl / 2 * sa, 2) + Math.pow(bh / 2 * ca, 2))];
  var rot = function(x, y){ return [B[0] + x * ca - y * sa, B[1] + x * sa + y * ca]; };
  var H = rot(bl * .44, -bh * .5);
  var head = function(a){ a *= D2R; return [H[0] + hr * Math.cos(a), H[1] + hr * Math.sin(a)]; };
  var body = function(a){ a *= D2R; return rot(bl / 2 * Math.cos(a), bh / 2 * Math.sin(a)); };
  var P = { billTop:head(-14), forehead:head(-58), crown:head(-104), nape:head(-160), back:body(-118), rump:body(-168),
    undertail:body(158), lowBelly:body(128), belly:body(96), breast:body(44), throat:head(74), chin:head(26) };
  return { S:S, f:f, hr:hr, bl:bl, bh:bh, B:B, H:H, rot:rot, head:head, body:body, P:P };
}
function outline(G, crest){
  var P = G.P, list = [P.billTop, P.forehead];
  if (crest) list.push(G.head(-96), [G.H[0] - G.hr * .95, G.H[1] - G.hr * 1.9], G.head(-150));
  else list.push(P.crown);
  list.push(P.nape, P.back, P.rump, P.undertail, P.lowBelly, P.belly, P.breast, P.throat, P.chin);
  return list;
}
function bird(g, p){
  var G = geometry(p), S = G.S, P = G.P, hr = G.hr;
  /* tail and legs first: the body covers their ends */
  /* the tail: narrow where it leaves the body, fanned at the tip */
  var ta = S.tailA * D2R, tb = G.rot(-G.bl * .3, -G.bh * .02), tl = S.tailL * G.f, tw = g.tube(S.tailW * G.f * 1.3);
  var tip = [tb[0] + Math.cos(ta) * tl, tb[1] + Math.sin(ta) * tl], n = [-Math.sin(ta), Math.cos(ta)];
  var tailPts = [[tb[0] + n[0] * tw * .32, tb[1] + n[1] * tw * .32], [tip[0] + n[0] * tw / 2, tip[1] + n[1] * tw / 2]];
  if (S.notch && g.is(2)) tailPts.push([tip[0] - Math.cos(ta) * tw * .3, tip[1] - Math.sin(ta) * tw * .3]);
  else tailPts.push([tip[0] + Math.cos(ta) * tw * .12, tip[1] + Math.sin(ta) * tw * .12]);
  tailPts.push([tip[0] - n[0] * tw / 2, tip[1] - n[1] * tw / 2], [tb[0] - n[0] * tw * .32, tb[1] - n[1] * tw * .32]);
  g.S(k.round(tailPts, [0, tw * .18, S.notch ? 0 : tw * .3, tw * .18, 0]));
  /* the bill: a closed shape, or solid when too small to color */
  var bill = S.bill === "thin" || S.bill === "long" ? [[hr * .74, -hr * .28], [hr * (S.bill === "long" ? 2.05 : 1.85), hr * .04], [hr * .72, hr * .3]]
    : S.bill === "short" ? [[hr * .74, -hr * .3], [hr * 1.5, hr * .06], [hr * .72, hr * .36]] : [[hr * .7, -hr * .42], [hr * 1.72, hr * .08], [hr * .66, hr * .5]];
  var bd = h.poly(bill.map(function(q){ return [G.H[0] + q[0], G.H[1] + q[1]]; }));
  if (g.fits(bd, 1.3)) g.S(bd); else g.K(bd);
  /* body, markings, wing */
  g.S(h.smooth(outline(G, S.crest), false, .95));
  var cut = function(a, mid, b, lv){ if (g.is(2)) g.D(h.smooth([a, mid, b], true), lv === 1 ? 2 : lv); };
  S.marks.forEach(function(m){
    if (m === "mask") cut(P.forehead, [G.H[0] - hr * .22, G.H[1] + hr * .1], P.throat, 1);
    if (m === "hood") cut(P.nape, [G.H[0] - hr * .1, G.H[1] + hr * .72], P.throat, 1);
    if (m === "cap") cut(P.billTop, [G.H[0] + hr * .05, G.H[1] - hr * .3], P.nape, 1);
    if (m === "forecap") cut(P.billTop, [G.H[0] + hr * .28, G.H[1] - hr * .42], P.crown, 2);
    if (m === "crown") cut(P.forehead, [G.H[0] - hr * .2, G.H[1] - hr * .42], P.nape, 2);
    if (m === "bib") cut(P.chin, [G.H[0] + hr * .12, G.H[1] + hr * 1.05], P.breast, 2);
    if (m === "necklace") cut(P.nape, [G.H[0] - hr * .05, G.H[1] + hr * 1.1], P.breast, 2);
    if (m === "breast") cut(P.throat, G.rot(G.bl * .02, G.bh * .02), P.lowBelly, S.marks.length > 1 ? 2 : 1);
  });
  var W = [G.rot(G.bl * .24, -G.bh * .3), G.rot(-G.bl * .04, -G.bh * .62), G.rot(-G.bl * .34, -G.bh * .48), G.rot(-G.bl * .7, -G.bh * .04),
    G.rot(-G.bl * .36, G.bh * .2), G.rot(-G.bl * .02, G.bh * .18), G.rot(G.bl * .16, -G.bh * .02)];
  g.S(h.smooth(W, false, .9));
  g.D(h.line(W[2], W[4]), 2);
  if (S.marks.indexOf("bars") >= 0) g.D(h.line(W[1], W[5]), 3);
  g.K(h.circle(G.H[0] + hr * .3, G.H[1] - hr * .12, g.min(hr * .15, g.at(3.5, 4.5, 6))));
  /* toes gripping the perch, as small dark accents */
  if (g.is(2)) [-10, 12].forEach(function(x){ g.K(h.ellipse(x * G.f, 1, 9 * G.f, 4.5 * G.f)); });
}

/* ---------- perches (drawn behind the bird; feet on y = 0) ---------- */
/* a branch reaching in from the front, its top level (y = 0) under the
   bird; it ends just behind the feet, so the tail hangs clear of it */
function branchBar(g, b, f){
  var x0 = -34 * f, x1 = b.x1 + 90 * f, t = g.tube(26 * f);
  g.S(k.round([[x0, 0], [40 * f, 0], [x1, -12], [x1 + 4, -12 + t * .55], [40 * f, t], [x0, t]], [t / 2, 0, 6, 6, 0, t / 2]));
  return { x0:x0, x1:x1, t:t };
}
function perch(kind){
  return { label:PERCHES[kind].label, words:PERCHES[kind].words, draw:function(g, h, b, p){
    var f = p.size, sz = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 300;
    if (kind === "post"){
      var pw = 96 * f, ph = 150 * f, px0 = -18 * f;
      g.S(h.rect(px0, 6, pw, ph));
      g.S(h.rrect(px0 - 10, 0, pw + 20, g.min(22 * f, g.at(15, 22, 34)), 6));
      if (g.is(3)) g.D(h.line([px0 + pw * .62, g.min(22 * f, g.at(15, 22, 34))], [px0 + pw * .62, 6 + ph]));
      return;
    }
    if (kind === "bath"){
      var bw = 230 * f, bx = -36 * f + bw / 2, dep = g.min(38 * f, g.at(20, 30, 46));
      g.S(h.rect(bx - g.tube(30 * f) / 2, dep, g.tube(30 * f), 130 * f));
      g.S(h.rrect(bx - 70 * f, dep + 124 * f, 140 * f, g.min(26 * f, g.at(16, 24, 38)), 8));
      g.S(h.path([bx - bw / 2, 0]).L([bx + bw / 2, 0]).Q([bx + bw * .4, dep + 6], [bx, dep + 8]).Q([bx - bw * .4, dep + 6], [bx - bw / 2, 0]).Z());
      return;
    }
    var x1 = b.x1 + 90 * f;
    if (kind === "leafy" && g.is(2)){
      var L1 = [x1 - 30 * f, -8], L2 = [x1 - 96 * f, 14 * f], lw = g.tube(34 * f);
      g.S(h.leaf(L1, [L1[0] + 40 * f, L1[1] - 74 * f], lw, .4)); g.D(h.vein(L1, [L1[0] + 40 * f, L1[1] - 74 * f], .4, 1), 3);
      g.S(h.leaf(L2, [L2[0] + 10 * f, L2[1] + 76 * f], lw, .4)); g.D(h.vein(L2, [L2[0] + 10 * f, L2[1] + 76 * f], .4, 1), 3);
    }
    if (kind === "berries"){
      var r = g.dot(14 * f), cx = x1 - 60 * f, ys = 26 * f;
      var bs = g.is(3) ? [[cx - r * 1.2, ys + r * 2.2], [cx + r * 1.3, ys + r * 2], [cx, ys + r * 4]] : [[cx - r * 1.15, ys + r * 2.1], [cx + r * 1.2, ys + r * 2.4]];
      bs.forEach(function(c){ g.L(h.line([cx, 0], c)); });
      bs.forEach(function(c){ g.S(h.circle(c[0], c[1], r)); });
      if (g.is(2)){ var lf = [x1 - 20 * f, -6]; g.S(h.leaf(lf, [lf[0] + 34 * f, lf[1] - 66 * f], g.tube(30 * f), .4)); }
    }
    if (kind === "blossoms"){
      branchBar(g, b, f);
      var R = g.min(34 * f, g.at(26, 40, 60)), cs = [[x1 - 40 * f - R, -14 - R * .4], [x1 - 40 * f - R * 3.4, -6 - R * .5]].slice(0, g.at(2, 2, 1));
      if (cs.length > 1 && cs[1][0] - R < b.x1 - 20 * f) cs.pop();
      if (!g.fits(h.petal(0, 0, -90, R * .3, R, R * .72, "round"), 1.6, R * .5)) cs = [];
      cs.forEach(function(c){
        for (var i = 0; i < 5; i++) g.S(h.petal(c[0], c[1], -90 + i * 72, R * .28, R, R * .72, "round"));
        g.S(h.circle(c[0], c[1], g.dot(R * .3)));
      });
      return;
    }
    branchBar(g, b, f);
  } };
}

I.family({
  id:"songbird", label:"Backyard songbird", template:"songbird",
  settings:["leafy", "berries", "blossoms", "post", "bath"],
  ownSettings:{ leafy:perch("leafy"), berries:perch("berries"), blossoms:perch("blossoms"), post:perch("post"), bath:perch("bath") },
  params:function(R){ return { species:R.pick(Object.keys(SPECIES)), size:R.range(.94, 1.08), tilt:R.int(-6, 8) }; },
  key:function(p){ return p.species; },
  subject:function(p){ return SPECIES[p.species].name; },
  title:function(p){ return SPECIES[p.species].title; },
  talk:function(p, R){ return R.pick(["Which birds came to visit where you lived?", "What would you put out to feed the birds in winter?", "What colors would you give this bird?",
    "Tell me about a morning when you heard the birds singing.", "Where is a good place to watch birds?"]); },
  tags:function(p){ return ["birds", p.species, "backyard"]; },
  draw:function(g, h, p){ bird(g, p); }
});
})(globalThis.CognicopiaColoring);
