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
