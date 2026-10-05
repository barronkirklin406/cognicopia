/* Cognicopia designs: Seasons & Holidays. A picture for each season and
   for the holidays residents grew up with: a spring wreath, an Easter
   basket, a valentine, summer lemonade, a jack-o'-lantern, the cornucopia,
   a holiday wreath, a snowman, ornaments and a pot of shamrocks. Friendly,
   adult and calm: nothing spooky, no lettering, nothing in the background.
   The packet tool uses them on its holiday pages. */
(function(C){
"use strict";
var h = C.helpers, CAT = "seasons-holidays";
function def(meta, draw){ meta.cat = CAT; return C.define(meta, draw); }
function ground(g, y, x0, x1){ g.L(h.line([x0, y], [x1, y])); }
/* A heart, tip at (0, s*.62), lobes above; drawn about the origin. */
function heart(s){
  return h.path([0, s * .62]).C([-s * .2, s * .42], [-s * .62, s * .14], [-s * .62, -s * .2]).C([-s * .62, -s * .48], [-s * .36, -s * .62], [-s * .17, -s * .58])
    .C([-s * .06, -s * .55], [0, -s * .46], [0, -s * .38]).C([0, -s * .46], [s * .06, -s * .55], [s * .17, -s * .58])
    .C([s * .36, -s * .62], [s * .62, -s * .48], [s * .62, -s * .2]).C([s * .62, s * .14], [s * .2, s * .42], [0, s * .62]).Z();
}
/* A tulip head, base at (0, 0), opening upward, s tall. */
function tulip(s){
  return h.smooth([[0, 0], [-s * .42, -s * .12], [-s * .5, -s * .62], [-s * .34, -s], [-s * .14, -s * .66], [0, -s * .98], [s * .14, -s * .66], [s * .34, -s], [s * .5, -s * .62], [s * .42, -s * .12]], false, .7);
}
/* A holly leaf from a to b: points along each edge. */
function holly(a, b, w, spikes){
  var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, pts = [a], back = [];
  for (var i = 1; i <= spikes * 2; i++){
    var t = i / (spikes * 2 + 1), out = (i % 2 ? 1 : .62) * w / 2 * Math.sin(Math.PI * Math.min(.95, t + .05));
    pts.push([a[0] + dx * t + nx * out, a[1] + dy * t + ny * out]);
    back.unshift([a[0] + dx * t - nx * out, a[1] + dy * t - ny * out]);
  }
  return h.smooth(pts.concat([b], back), false, .35);
}
/* A bow: two loops, a knot and two tails, centred at (x, y). */
function bow(g, x, y, s){
  g.S(h.poly([[x - s * .1, y + s * .1], [x - s * .62, y + s * 1.05], [x - s * .4, y + s * 1.12], [x - s * .2, y + s * .9], [x + s * .02, y + s * .14]]));
  g.S(h.poly([[x + s * .1, y + s * .1], [x + s * .62, y + s * 1.05], [x + s * .4, y + s * 1.12], [x + s * .2, y + s * .9], [x - s * .02, y + s * .14]]));
  g.S(h.smooth([[x, y], [x - s * .5, y - s * .5], [x - s * .9, y - s * .3], [x - s * .9, y + s * .3], [x - s * .5, y + s * .4]], false, .8));
  g.S(h.smooth([[x, y], [x + s * .5, y - s * .5], [x + s * .9, y - s * .3], [x + s * .9, y + s * .3], [x + s * .5, y + s * .4]], false, .8));
  g.S(h.rrect(x - s * .2, y - s * .22, s * .4, s * .44, s * .12));
}

/* ---------- Spring: a wreath of tulips and leaves ---------- */
/* A wreath is a broad ring; flowers and leaves sit inside the ring so no edge crosses another. */
function wreathRing(g, cx, cy, r0, r1){ g.S(h.circle(cx, cy, r1)); g.S(h.circle(cx, cy, r0)); }
def({ id:"spring-wreath", title:"The Spring Wreath", season:"spring", tags:["spring", "wreaths", "tulips", "flowers", "easter", "first-day-of-spring"],
  talk:"What is the first sign of spring you look forward to?" }, function(g){
  var cx = 300, cy = 380, R = 196;
  wreathRing(g, cx, cy, 142, 250);
  var tulips = g.at(6, 5, 4), per = 360 / tulips;
  for (var k = 0; k < tulips; k++){
    var a = -90 + k * per;
    for (var s2 = -1; s2 <= 1 && g.lvl >= 2; s2 += 2){
      var la = a + s2 * per * .3, p = h.onCircle(cx, cy, R, la - s2 * per * .1), q = h.onCircle(cx, cy, R + s2 * 16, la + s2 * per * .16);
      g.S(h.leaf(p, q, g.at(30, 36, 44), s2 * .3));
      if (g.lvl >= 3) g.D(h.vein(p, q, s2 * .3));
    }
    var b = h.onCircle(cx, cy, R - g.at(36, 38, 46), a);
    g.group({ x:b[0], y:b[1], rot:a + 90 }, function(g){
      g.S(tulip(g.at(72, 74, 76)));
      if (g.lvl >= 3) g.D(h.path([0, -8]).Q([-12, -40], [0, -68]).open());
    });
  }
});

/* ---------- Easter: a basket of eggs ---------- */
def({ id:"easter-basket", title:"The Easter Basket", season:"spring", tags:["easter", "eggs", "baskets", "spring"],
  talk:"Did your family color eggs at Easter? What colors did you like best?" }, function(g){
  g.S(h.path([132, 440]).C([132, 140], [468, 140], [468, 440]).L([436, 440]).C([436, 184], [164, 184], [164, 440]).Z());
  var eggs = g.at([[200, 420, -16], [282, 400, 6], [360, 410, -6], [420, 436, 18]], [[214, 420, -14], [300, 400, 4], [390, 420, 14]], [[220, 420, -10], [380, 420, 10]]);
  eggs.forEach(function(e, i){
    g.group({ x:e[0], y:e[1], rot:e[2] }, function(g){
      var rx = g.at(46, 56, 72), ry = rx * 1.3;
      g.S(h.ellipse(0, 0, rx, ry));
      if (g.lvl >= 2){
        [-.3, .2].forEach(function(f){ var y = ry * f, hw = rx * Math.sqrt(1 - f * f) * .97; g.D(h.line([-hw, y], [hw, y])); });
        if (g.lvl >= 3 && i % 2 === 0){ var zy = -ry * .05, zz = []; for (var z = 0; z <= 6; z++){ var x = -rx * .78 + z * rx * 1.56 / 6; zz.push([x, zy + (z % 2 ? -10 : 10)]); } g.D(h.poly(zz, true)); }
      }
    });
  });
  g.S(h.path([108, 470]).L([492, 470]).L([452, 700]).Q([300, 726], [148, 700]).Z());
  g.S(h.rrect(92, 444, 416, 48, 24));
  if (g.lvl >= 2) [540, 600, 656].forEach(function(y, i){ var f = (y - 492) / 220; g.D(h.line([110 + f * 40 + 4, y], [490 - f * 40 - 4, y]), i === 1 ? 2 : 3); });
  if (g.lvl >= 3) [200, 300, 400].forEach(function(x){ g.D(h.line([x, 494], [x + (x - 300) * -.06, 712])); });
});

/* ---------- Valentine's Day: hearts and Cupid's arrow ---------- */
def({ id:"valentine-heart", title:"A Valentine Heart", season:"winter", tags:["valentines", "hearts", "love", "february"],
  talk:"Tell me about a valentine you gave or received. Who was it for?" }, function(g){
  g.group({ x:300, y:400 }, function(g){ g.S(heart(470)); g.S(heart(g.at(300, 300, 270))); if (g.lvl >= 3) g.S(heart(150)); });
  if (g.lvl >= 2){
    g.S(h.poly([[86, 214], [104, 196], [520, 596], [502, 614]]));
    g.S(h.poly([[500, 572], [560, 632], [482, 612]]));
    g.S(h.poly([[86, 214], [40, 210], [60, 186], [104, 196]])); g.S(h.poly([[86, 214], [82, 260], [106, 240], [104, 196]]));
  }
  if (g.lvl >= 3) [[110, 640, 90], [500, 160, 80]].forEach(function(p){ g.group({ x:p[0], y:p[1], rot:p[0] < 300 ? -16 : 14 }, function(g){ g.S(heart(p[2])); }); });
});

/* ---------- Summer: lemonade on the porch ---------- */
def({ id:"lemonade", title:"Summer Lemonade", season:"summer", tags:["lemonade", "summer", "porches", "lemons", "drinks"],
  talk:"What did you drink to cool off on a hot summer day?" }, function(g){
  if (g.lvl >= 2) g.S(h.path([300, 330]).C([250, 300], [262, 260], [292, 252]).L([306, 286]).C([296, 290], [292, 304], [312, 318]).Z());
  g.S(h.path([92, 300]).L([300, 300]).L([316, 352]).C([340, 470], [330, 640], [292, 700]).L([96, 700]).C([60, 640], [52, 470], [76, 352]).Z());
  g.S(h.path([96, 360]).C([30, 380], [26, 520], [70, 560]).L([86, 538]).C([60, 500], [64, 420], [104, 404]).Z());
  if (g.lvl >= 2) g.L(h.path([82, 420]).Q([196, 440], [318, 420]).open());
  var ring = function(cx, cy, r, parts){
    g.S(h.circle(cx, cy, r));
    g.S(h.circle(cx, cy, r * g.at(.82, .8, .6)));
    for (var i = 0; i < parts; i++) g.L(h.line([cx, cy], h.onCircle(cx, cy, r * .8, i * 360 / parts)));
  };
  g.S(h.poly([[406, 240], [430, 236], [452, 470], [432, 472]]));
  g.S(h.path([360, 420]).L([540, 420]).L([520, 700]).Q([450, 712], [380, 700]).Z());
  if (g.lvl >= 2) g.L(h.line([370, 470], [530, 470]));
  ring(170, 520, g.at(66, 72, 80), g.at(8, 6, 0));
  if (g.lvl >= 2) ring(470, 590, 50, g.at(6, 4, 0));
  ground(g, 720, 30, 570);
});

/* ---------- Halloween: a friendly jack-o'-lantern ---------- */
def({ id:"jack-o-lantern", title:"The Jack-o'-Lantern", season:"fall", tags:["halloween", "pumpkins", "autumn", "october"],
  talk:"Did you carve pumpkins in the fall? What kind of face did you give yours?" }, function(g){
  g.L(h.path([316, 210]).C([360, 150], [420, 190], [400, 230]).C([390, 250], [362, 246], [370, 226]).open());
  if (g.lvl >= 2) g.S(h.leaf([318, 216], [420, 150], 54, -.4));
  g.S(h.path([282, 254]).L([288, 176]).Q([300, 150], [326, 168]).L([318, 254]).Z());
  var ribs = g.at([[180, 140], [420, 140], [234, 170], [366, 170]], [[190, 150], [410, 150]], [[200, 160], [400, 160]]);
  ribs.forEach(function(r){ g.S(h.ellipse(r[0], 470, r[1], 226)); });
  g.S(h.ellipse(300, 470, 150, 236));
  g.S(h.poly([[214, 410], [266, 340], [282, 420]]));
  g.S(h.poly([[386, 410], [334, 340], [318, 420]]));
  g.S(h.poly([[300, 446], [326, 494], [274, 494]]));
  g.S(h.path([186, 520]).Q([300, 600], [414, 520]).Q([404, 600], [300, 640]).Q([196, 600], [186, 520]).Z());
  if (g.lvl >= 2) g.L(h.path([226, 560]).Q([300, 590], [374, 560]).open());
});

/* ---------- Thanksgiving: the cornucopia ---------- */
def({ id:"cornucopia", title:"The Horn of Plenty", season:"fall", tags:["thanksgiving", "cornucopia", "harvest", "autumn", "fruit"],
  talk:"What was on the table for Thanksgiving dinner when you were growing up?" }, function(g){
  g.S(h.path([60, 300]).C([120, 250], [240, 250], [380, 300]).L([380, 560]).C([250, 560], [150, 470], [100, 380]).C([84, 352], [70, 330], [60, 300]).Z());
  g.L(h.path([60, 300]).C([40, 260], [80, 230], [100, 256]).open());
  g.at([170, 250, 320], [170, 250, 320], [190, 300]).forEach(function(x){ var t = (x - 60) / 320; g.L(h.path([x, 262 + t * 24]).Q([x - 30, 400], [x + 6, 498 + t * 36]).open()); });
  g.S(h.ellipse(380, 430, 64, 132));
  if (g.lvl >= 3){
    [[440, 270], [478, 262], [460, 296], [496, 296], [480, 330]].forEach(function(p){ g.S(h.circle(p[0], p[1], 22)); });
    g.S(h.leaf([430, 252], [372, 214], 34, .4));
  }
  g.S(h.path([420, 330]).C([400, 300], [430, 270], [462, 286]).C([490, 270], [524, 286], [516, 330]).C([526, 380], [480, 408], [462, 396]).C([444, 408], [412, 380], [420, 330]).Z());
  g.L(h.path([460, 290]).Q([462, 270], [474, 258]).open());
  if (g.lvl >= 2){
    g.S(h.path([520, 520]).C([480, 520], [470, 470], [500, 440]).C([510, 400], [500, 380], [524, 372]).C([548, 380], [540, 400], [550, 440]).C([580, 470], [570, 520], [520, 520]).Z());
    g.L(h.line([524, 372], [528, 352]));
  }
  g.S(h.ellipse(440, 560, 84, 66));
  if (g.lvl >= 2){ g.D(h.path([410, 500]).Q([390, 560], [410, 620]).open()); g.D(h.path([470, 500]).Q([490, 560], [470, 620]).open()); }
  g.S(h.rrect(430, 476, 20, 30, 6));
  ground(g, 640, 40, 560);
});

/* ---------- Christmas: a holly wreath with a bow ---------- */
def({ id:"holiday-wreath", title:"The Holiday Wreath", season:"winter", tags:["christmas", "wreaths", "holly", "winter", "december"],
  talk:"Where did your family hang the wreath at Christmastime?" }, function(g){
  var cx = 300, cy = 370, R = 196, n = g.at(9, 8, 6), per = 360 / n, br = g.at(13, 17, 30);
  wreathRing(g, cx, cy, 142, 250);
  for (var i = 0; i < n; i++){
    var a = -90 + i * per;
    [-1, 1].forEach(function(sd){
      var f0 = g.at(.28, .28, .22), p = h.onCircle(cx, cy, R + sd * 24, a + per * f0), q = h.onCircle(cx, cy, R + sd * 24, a + per * (1 - f0));
      g.S(holly(p, q, g.at(38, 46, 60), g.at(3, 2, 1)));
      if (g.lvl >= 3) g.D(h.line(p, h.lerp(p, q, .78)));
    });
    var b = h.onCircle(cx, cy, R, a);
    if (g.lvl >= 2){ g.S(h.circle(b[0] - br * 1.2, b[1] + br * .7, br)); g.S(h.circle(b[0] + br * 1.2, b[1] + br * .7, br)); g.S(h.circle(b[0], b[1] - br * 1.3, br)); }
    else g.S(h.circle(b[0], b[1], br));
  }
  if (g.lvl >= 2) bow(g, cx, cy + R + 76, g.at(62, 70, 0));
});

/* ---------- Winter: the snowman ---------- */
def({ id:"snowman", title:"The Snowman", season:"winter", tags:["snowmen", "snow", "winter", "first-snow"],
  talk:"Did you build snowmen when you were young? Who helped you?" }, function(g){
  g.S(h.path([40, 760]).Q([300, 690], [560, 760]).Z());
  if (g.lvl >= 2){ g.L(h.path([206, 396]).L([110, 330]).open()); g.L(h.line([136, 348], [120, 312])); g.L(h.path([394, 396]).L([490, 330]).open()); g.L(h.line([464, 348], [480, 312])); }
  g.S(h.circle(300, 610, 150));
  g.S(h.circle(300, 400, 112));
  g.S(h.circle(300, 228, 84));
  g.S(h.rrect(196, 282, 208, 42, 21));
  if (g.lvl >= 2) g.S(h.poly([[330, 300], [384, 300], [404, 430], [354, 436]]));
  if (g.lvl >= 3) [362, 374, 386].forEach(function(x, i){ g.D(h.line([x + i * 2, 424], [x + i * 2 + 4, 446])); });
  g.S(h.rect(222, 46, 156, 104));
  g.S(h.rrect(186, 142, 228, 26, 13));
  if (g.lvl >= 2) g.S(h.rect(222, 112, 156, 30));
  g.K(h.circle(270, 212, 10)); g.K(h.circle(330, 212, 10));
  g.S(h.poly([[300, 230], [372, 244], [300, 254]]));
  [360, 410, 460].forEach(function(y){ g.K(h.circle(300, y, 11)); });
});

/* ---------- Christmas: ornaments on a garland ---------- */
def({ id:"ornaments", title:"Christmas Ornaments", season:"winter", tags:["christmas", "ornaments", "decorations", "winter", "december"],
  talk:"Was there a special ornament your family hung on the tree every year?" }, function(g){
  g.L(h.wave(20, 580, 90, 18, 3));
  var balls = [[140, 380, 104, "round"], [310, 500, 88, "drop"], [470, 360, 96, "round"]], cap = g.at(1, 1.15, 1.4);
  balls.forEach(function(b, i){
    var top = b[3] === "drop" ? b[1] - b[2] * 1.5 : b[1] - b[2];
    g.L(h.line([b[0], 96 + Math.sin((b[0] - 20) / 560 * 3 * 2 * Math.PI) * 18], [b[0], top - 30]));
    g.S(h.rrect(b[0] - 24 * cap, top - 32 * cap, 48 * cap, 34 * cap, 6));
    if (b[3] === "drop") g.S(h.mirror([[b[0], top], [b[0] + b[2] * .5, top + b[2] * .4], [b[0] + b[2], b[1] + b[2] * .3], [b[0] + b[2] * .6, b[1] + b[2] * .9], [b[0], b[1] + b[2] * 1.1]], b[0]));
    else g.S(h.circle(b[0], b[1], b[2]));
    if (g.lvl >= 2){
      [-.32, .32].forEach(function(f){ var y = b[1] + b[2] * f, hw = b[2] * Math.sqrt(1 - f * f) * .97 * (b[3] === "drop" ? .92 : 1); g.D(h.line([b[0] - hw, y], [b[0] + hw, y])); });
      if (g.lvl >= 3){ var zz = []; for (var z = 0; z <= 6; z++){ zz.push([b[0] - b[2] * .78 + z * b[2] * 1.56 / 6, b[1] + (z % 2 ? -12 : 12)]); } g.D(h.poly(zz, true)); }
    }
  });
});

/* ---------- St. Patrick's Day: shamrocks in a pot ---------- */
def({ id:"shamrock-pot", title:"Shamrocks in a Pot", season:"spring", tags:["st-patricks-day", "shamrocks", "clover", "plants", "spring"],
  talk:"Have you ever looked for a four-leaf clover? Did you find one?" }, function(g){
  var plants = g.at([[300, 170, 0], [150, 280, -24], [450, 270, 22], [220, 410, -10], [384, 410, 12]], [[300, 190, 0], [160, 320, -22], [440, 320, 22]], [[300, 280, 0]]);
  plants.forEach(function(p){ g.L(h.path([300, 520]).Q([p[0] + (300 - p[0]) * .2, (p[1] + 520) / 2], [p[0], p[1] + 40]).open()); });
  plants.forEach(function(p){
    g.group({ x:p[0], y:p[1], rot:p[2], s:g.at(1, 1.15, 2) }, function(g){
      [0, 120, 240].forEach(function(r){ g.group({ x:0, y:0, rot:r }, function(g){ g.group({ x:0, y:-48 }, function(g){ g.S(heart(74)); if (g.lvl >= 3) g.D(h.line([0, 36], [0, -6])); }); }); });
    });
  });
  g.S(h.path([170, 560]).L([430, 560]).L([400, 740]).L([200, 740]).Z());
  g.S(h.rrect(150, 512, 300, 54, 10));
  if (g.lvl >= 2) g.D(h.line([186, 640], [414, 640]), 3);
});
})(globalThis.CogniCore);
