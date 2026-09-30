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
