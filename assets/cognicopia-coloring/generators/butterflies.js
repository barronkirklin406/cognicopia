/* Cognicopia Infinite Pages, family: garden butterflies.
   Monarch, tiger swallowtail, painted lady, cabbage white and clouded
   sulphur, seen from above with the wings open. Each wing is one closed
   outline; markings are a border (the wing drawn again, smaller, about its
   own centre), veins and stripes that run between points of an outline,
   and round spots only where they are big enough to color. The left side
   mirrors the right. See assets/cognicopia-coloring/infinite.js for the family contract. */
(function(C){
"use strict";
var I = C && C.infinite;
if (!I) return;
var h = C.helpers, k = I.kit;

var SPECIES = {
  monarch:     { name:"monarch butterfly", title:"The Monarch", apex:[146, -122], hind:1, marks:["border", "veins"] },
  swallowtail: { name:"tiger swallowtail butterfly", title:"The Swallowtail", apex:[150, -116], hind:1.06, tail:1, marks:["stripes"] },
  paintedlady: { name:"painted lady butterfly", title:"The Painted Lady", apex:[140, -118], hind:.94, marks:["apex", "spots"] },
  cabbage:     { name:"cabbage white butterfly", title:"The Cabbage White", apex:[132, -110], hind:.96, round:1, marks:["tip", "spot"] },
  sulphur:     { name:"clouded sulphur butterfly", title:"The Sulphur Butterfly", apex:[132, -112], hind:.92, round:1, marks:["border", "spot"] }
};

/* right wings, around the body's joint at (0, 0). Every marking runs
   between these points, which lie on the smooth outlines exactly. The
   forewing's lower edge lies well over the hindwing's upper edge. */
function wings(p){
  var S = SPECIES[p.species], ax = S.apex[0] * p.wide, ay = S.apex[1] * p.tall, hi = S.hind * p.hind, r = S.round ? .96 : 1;
  var fore = [[6, -12], [50, -72 * p.tall], [ax * .72, ay * .93], [ax * r, ay * r], [ax + 26 * p.wide, ay + 34], [ax + 20 * p.wide, ay + 78],
    [ax * .9, -2], [100 * p.wide, 16], [52, 16], [8, 12]];
  var hind = [[8, 2], [80 * hi, -2], [136 * hi, 30 * hi], [130 * hi, 86 * hi], [86 * hi, 120 * hi], [40 * hi, 104 * hi], [12, 36]];
  if (S.tail) hind.splice(5, 0, [62 * hi, 126 * hi], [56 * hi, 184 * hi], [44 * hi, 124 * hi]);
  return { fore:fore, hind:hind };
}
function centroid(pts){ var x = 0, y = 0; pts.forEach(function(q){ x += q[0]; y += q[1]; }); return [x / pts.length, y / pts.length]; }
function shrink(pts, f){ var c = centroid(pts); return pts.map(function(q){ return [c[0] + (q[0] - c[0]) * f, c[1] + (q[1] - c[1]) * f]; }); }

function side(g, p, Wg){
  var S = SPECIES[p.species], F = Wg.fore, Hw = Wg.hind, tens = .9, has = function(m){ return S.marks.indexOf(m) >= 0; };
  g.S(h.smooth(Hw, false, tens));
  if (has("border") && g.is(2)){ var ih = shrink(Hw, .7); if (g.fits(h.smooth(ih, false, tens), 1.6)) g.S(h.smooth(ih, false, tens)); }
  if (has("stripes") && g.is(2)) g.D(h.line(Hw[1], Hw[Hw.length - 2]), 2);
  g.S(h.smooth(F, false, tens));
  if (has("border") && g.is(2)){
    var inner = shrink(F, .72), di = h.smooth(inner, false, tens);
    if (g.fits(di, 1.6)){ g.S(di); if (has("veins")){ g.D(h.line(inner[0], inner[4]), 3); g.D(h.line(inner[9], inner[6]), 3); } }
  }
  if (has("stripes")){ g.D(h.line(F[1], F[8]), 1); g.D(h.line(F[2], F[7]), 3); }
  if (has("apex")){
    g.D(h.line(F[2], F[6]), 1);
    if (g.is(2)){ var ac = centroid([F[2], F[3], F[4], F[5], F[6]]), sr = g.dot(9); if (g.fits(h.circle(0, 0, sr), 1.4)) g.S(h.circle(ac[0], ac[1], sr)); }
  }
  if (has("tip")) g.D(h.line(F[2], F[5]), 1);
  if (has("spot")){ var cc = centroid(F), r = g.dot(14); g.S(h.circle(cc[0] + 8, cc[1], r)); }
}
function butterfly(g, p){
  var Wg = wings(p), dy = -Math.max.apply(null, Wg.hind.map(function(q){ return q[1]; })) - 4;
  g.group({ x:0, y:dy, ox:0, oy:0 }, function(gg){
    gg.group({ x:0, y:0, flip:true }, function(g2){ side(g2, p, Wg); });
    side(gg, p, Wg);
    /* antennae ending in small dark clubs, then the body over the wing roots */
    var cl = gg.min(6, gg.at(4, 5, 6));
    [-1, 1].forEach(function(s){ gg.L(h.smooth([[s * 4, -40], [s * 16, -84], [s * 40, -112]], true)); gg.K(h.ellipse(s * 40, -112, cl * 1.4, cl)); });
    var aw = gg.tube(20), tw = gg.tube(30);
    if (gg.lvl === 1){
      /* Tier 3: head, thorax and abdomen as one outline, big enough to color */
      var hw = Math.max(tw * .42, 13);
      gg.S(k.mirror([[0, -46 - hw], [hw, -46], [hw * .62, -36], [tw / 2, -16], [aw / 2, 10], [aw / 2 * .8, 80], [0, 112]], 0, .9));
    } else {
      gg.S(h.smooth([[0, -4], [aw / 2, 10], [aw / 2 * .8, 80], [0, 112], [-aw / 2 * .8, 80], [-aw / 2, 10]], false, .9));
      gg.S(h.ellipse(0, -14, tw / 2, 28));
      gg.S(h.circle(0, -46, gg.min(13, gg.at(10, 14, 20))));
    }
  });
}

I.family({
  id:"butterfly", label:"Garden butterfly", template:"garden-wildlife",
  settings:["plain"], compositions:["centered", "cameo", "tile", "arch"],
  params:function(R){ return { species:R.pick(Object.keys(SPECIES)), wide:R.range(.94, 1.06), tall:R.range(.94, 1.06), hind:R.range(.94, 1.06) }; },
  key:function(p){ return p.species; },
  subject:function(p){ return SPECIES[p.species].name + " with its wings open"; },
  title:function(p){ return SPECIES[p.species].title; },
  talk:function(p, R){ return R.pick(["Which flowers bring butterflies to a garden?", "Where have you seen butterflies on a summer day?", "What colors would you give these wings?",
    "Tell me about a garden or a meadow you enjoyed.", "What is your favorite thing about summer afternoons?"]); },
  tags:function(p){ return ["butterflies", p.species, "garden", "summer"]; },
  draw:function(g, h, p){ butterfly(g, p); }
});
})(globalThis.CognicopiaColoring);
