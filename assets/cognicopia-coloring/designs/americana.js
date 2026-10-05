/* Cognicopia designs: Vintage Americana. Familiar pieces of American life
   from the 1930s to the 1960s: the barn quilt, the Liberty Bell, a porch
   dressed for the Fourth of July, the jukebox, the gas pump, the county
   fair, apple pie, the ballgame and the ice-cream soda. Big closed shapes,
   no lettering, nothing in the background. */
(function(C){
"use strict";
var h = C.helpers, CAT = "vintage-americana";
function def(meta, draw){ meta.cat = CAT; return C.define(meta, draw); }
function ground(g, y, x0, x1){ g.L(h.line([x0, y], [x1, y])); }
/* Clip a polygon to a convex polygon (Sutherland-Hodgman); both as point lists. */
function clipConvex(subject, clip){
  var out = subject, area = 0;
  for (var i = 0; i < clip.length; i++){ var p = clip[i], q = clip[(i + 1) % clip.length]; area += p[0] * q[1] - q[0] * p[1]; }
  var sgn = area > 0 ? 1 : -1;
  for (var e = 0; e < clip.length && out.length; e++){
    var a = clip[e], b = clip[(e + 1) % clip.length], inp = out; out = [];
    var inside = function(p){ return sgn * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= 0; };
    var cut = function(p, q){ var A1 = q[1] - p[1], B1 = p[0] - q[0], C1 = A1 * p[0] + B1 * p[1], A2 = b[1] - a[1], B2 = a[0] - b[0], C2 = A2 * a[0] + B2 * a[1], det = A1 * B2 - A2 * B1;
      return det === 0 ? q : [(B2 * C1 - B1 * C2) / det, (A1 * C2 - A2 * C1) / det]; };
    for (var k = 0; k < inp.length; k++){
      var cur = inp[k], prev = inp[(k + inp.length - 1) % inp.length], ci = inside(cur), pi = inside(prev);
      if (ci){ if (!pi) out.push(cut(prev, cur)); out.push(cur); } else if (pi) out.push(cut(prev, cur));
    }
  }
  return out;
}
function polyArea(p){ var a = 0; for (var i = 0; i < p.length; i++){ var q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return Math.abs(a / 2); }
function ellipsePts(cx, cy, rx, ry, n){ var pts = []; for (var i = 0; i < n; i++){ var t = i * 2 * Math.PI / n; pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); } return pts; }
C.americanaHelpers = { clipConvex:clipConvex, ellipsePts:ellipsePts };

/* ---------- The barn quilt ---------- */
var QUILT = {
  /* pieces of a quilt block in the unit square, by tier: an Ohio star, a friendship star, an hourglass */
  1: function(){ var T = 1 / 3, sq = function(x, y){ return [[x, y], [x + T, y], [x + T, y + T], [x, y + T]]; }, qst = function(x, y){ var m = [x + T / 2, y + T / 2]; return [[[x, y], [x + T, y], m], [[x + T, y], [x + T, y + T], m], [[x + T, y + T], [x, y + T], m], [[x, y + T], [x, y], m]]; };
    return [sq(0, 0), sq(2 * T, 0), sq(0, 2 * T), sq(2 * T, 2 * T), sq(T, T)].concat(qst(T, 0), qst(0, T), qst(2 * T, T), qst(T, 2 * T)); },
  2: function(){ var T = 1 / 3, sq = function(x, y){ return [[x, y], [x + T, y], [x + T, y + T], [x, y + T]]; };
    return [sq(0, 0), sq(2 * T, 0), sq(0, 2 * T), sq(2 * T, 2 * T), sq(T, T),
      [[T, 0], [2 * T, 0], [2 * T, T]], [[T, 0], [2 * T, T], [T, T]], [[2 * T, T], [1, T], [1, 2 * T]], [[2 * T, T], [1, 2 * T], [2 * T, 2 * T]],
      [[T, 2 * T], [2 * T, 2 * T], [T, 1]], [[2 * T, 2 * T], [2 * T, 1], [T, 1]], [[0, T], [T, T], [0, 2 * T]], [[T, T], [T, 2 * T], [0, 2 * T]]]; },
  3: function(){ return [[[0, 0], [1, 0], [.5, .5]], [[1, 0], [1, 1], [.5, .5]], [[1, 1], [0, 1], [.5, .5]], [[0, 1], [0, 0], [.5, .5]]]; }
};
def({ id:"barn-quilt", title:"The Barn Quilt", tags:["barns", "quilts", "farms", "country"], sensitive:["home"],
  talk:"Have you seen a quilt square painted on a barn? What pattern would you choose for yours?" }, function(g){
  g.S(h.poly([[90, 760], [90, 410], [300, 222], [510, 410], [510, 760]]));
  g.S(h.poly([[56, 410], [300, 190], [544, 410], [520, 430], [300, 232], [80, 430]]));
  g.group({ x:300, y:430, rot:45 }, function(g){
    var s = 168;
    g.S(h.rect(-s / 2 - 12, -s / 2 - 12, s + 24, s + 24), 2);
    QUILT[g.tier]().forEach(function(p){ g.S(h.poly(p.map(function(v){ return [-s / 2 + v[0] * s, -s / 2 + v[1] * s]; }))); });
  });
  g.S(h.rect(196, 600, 208, 160));
  g.L(h.line([300, 600], [300, 760]));
  if (g.lvl >= 2){ g.D(h.line([196, 600], [300, 760])); g.D(h.line([300, 600], [196, 760])); g.D(h.line([300, 600], [404, 760])); g.D(h.line([404, 600], [300, 760])); }
  if (g.lvl >= 3){ g.S(h.rect(116, 620, 52, 52)); g.S(h.rect(432, 620, 52, 52)); g.D(h.line([142, 620], [142, 672])); g.D(h.line([458, 620], [458, 672])); }
  ground(g, 760, 30, 570);
});

/* ---------- The Liberty Bell ---------- */
def({ id:"liberty-bell", title:"The Liberty Bell", tags:["liberty-bell", "philadelphia", "history", "bells", "independence-day"], season:"summer",
  talk:"Have you ever visited a famous place in American history? What was it like to be there?" }, function(g){
  g.S(h.rrect(96, 96, 408, 60, 14));
  if (g.lvl >= 2) g.D(h.line([118, 126], [482, 126]), 3);
  g.S(h.rect(268, 156, 64, 50));
  g.S(h.circle(300, 612, 30));
  var half = [[300, 196], [362, 202], [392, 246], [400, 330], [412, 420], [438, 500], [474, 552], [480, 584], [300, 590]];
  g.S(h.mirror(half, 300));
  g.L(h.path([214, 252]).Q([300, 268], [386, 252]).open());
  g.L(h.path([140, 548]).Q([300, 574], [460, 548]).open());
  if (g.lvl >= 2) g.D(h.path([206, 292]).Q([300, 308], [394, 292]).open());
  if (g.lvl >= 2) g.D(h.poly([[292, 312], [300, 350], [288, 384], [302, 420], [292, 458], [306, 500], [298, 540]], true));
  if (g.lvl >= 3) g.D(h.path([176, 506]).Q([300, 526], [424, 506]).open());
});

/* ---------- A porch dressed for the Fourth of July ---------- */
/* One pleated piece of fan bunting: a ring segment whose outer edge bows out like cloth. */
function pleat(cx, cy, r0, r1, a0, a1, bow){
  var pts = h.arcPts(cx, cy, r0, a0, a1, 10).reverse();
  for (var i = 0; i <= 12; i++){ var f = i / 12, a = a0 + (a1 - a0) * f; pts.push(h.onCircle(cx, cy, r1 + bow * Math.sin(Math.PI * f), a)); }
  return h.poly(pts);
}
def({ id:"porch-bunting", title:"The Fourth of July Porch", season:"summer", tags:["independence-day", "flags", "bunting", "porches", "summer", "patriotic"],
  talk:"How did your family celebrate the Fourth of July? Was there a parade, a picnic or fireworks?" }, function(g){
  g.S(h.rect(30, 96, 540, 44));
  g.S(h.rect(50, 140, 44, 600)); g.S(h.rect(506, 140, 44, 600));
  var cx = 300, cy = 140, pleats = g.at(5, 4, 3), R = [186, 140, 96, 56];
  for (var k = 0; k < pleats; k++){ var a0 = k * 180 / pleats, a1 = (k + 1) * 180 / pleats; g.S(pleat(cx, cy, R[1], R[0], a0, a1, 16)); }
  g.S(h.sector(cx, cy, R[2], R[1], 0, 180));
  g.S(h.sector(cx, cy, R[3], R[2], 0, 180));
  g.S(h.sector(cx, cy, 0, R[3], 0, 180));
  if (g.lvl >= 3) g.S(h.star(cx, cy + 28, 22, 9, 5, -90));
  g.S(h.rect(94, 430, 412, 26));
  g.S(h.rect(94, 700, 412, 22));
  var n = g.at(8, 6, 4), bw = g.at(26, 32, 42), span = 412 - 2 * 30;
  for (var b = 0; b < n; b++){ var x = 94 + 30 + (b + .5) * span / n; g.S(h.rect(x - bw / 2, 456, bw, 244)); }
  ground(g, 740, 24, 576);
});

/* ---------- The jukebox ---------- */
def({ id:"jukebox", title:"The Jukebox", era:"1950s", tags:["jukebox", "music", "diners", "dancing", "records"],
  talk:"What song would you have played on the jukebox? Where did you go to hear music with friends?" }, function(g){
  g.S(h.rect(110, 740, 380, 34));
  g.S(h.path([130, 740]).L([130, 330]).C([130, 140], [470, 140], [470, 330]).L([470, 740]).Z());
  if (g.lvl >= 2){ g.S(h.rrect(146, 340, 26, 380, 13)); g.S(h.rrect(428, 340, 26, 380, 13)); }
  g.L(h.path([180, 520]).L([180, 336]).C([180, 214], [420, 214], [420, 336]).L([420, 520]).open());
  g.S(h.rrect(206, 316, 188, 150, 18));
  g.S(h.circle(300, 391, 58));
  if (g.lvl >= 2) g.S(h.circle(300, 391, 20));
  if (g.lvl >= 3) for (var b = 0; b < 6; b++) g.S(h.rrect(207 + b * 32, 486, 26, 20, 5));
  g.S(h.rrect(192, 552, 216, 164, 16));
  var bars = g.at(5, 3, 0);
  for (var i = 1; i <= bars; i++){ var x = 192 + i * 216 / (bars + 1); g.D(h.line([x, 566], [x, 702])); }
});

/* ---------- The gas pump ---------- */
def({ id:"gas-pump", title:"The Filling Station Pump", era:"1950s", tags:["gas-stations", "cars", "road-trips", "route-66"],
  talk:"Was there a filling station you always stopped at? Tell me about it." }, function(g){
  g.S(h.rect(282, 210, 36, 34));
  g.S(h.circle(300, 150, 74));
  if (g.lvl >= 2) g.L(h.line([228, 150], [372, 150]));
  g.L(h.path([432, 470]).C([440, 560], [530, 600], [470, 704]).open());
  g.S(h.rrect(186, 240, 228, 470, 22));
  g.S(h.circle(300, 350, 72));
  if (g.lvl >= 2){ g.S(h.circle(300, 350, 48)); g.L(h.line([300, 350], [330, 322])); }
  if (g.lvl >= 3) for (var t = 0; t < 8; t++) g.D(h.line(h.onCircle(300, 350, 54, -90 + t * 45), h.onCircle(300, 350, 66, -90 + t * 45)));
  if (g.lvl >= 2) g.S(h.rrect(226, 448, 148, 52, 10));
  g.S(h.rrect(216, 530, 168, 150, 12));
  g.S(h.rrect(414, 372, 40, 100, 12));
  if (g.lvl >= 2) g.S(h.poly([[440, 384], [488, 360], [500, 380], [454, 410]]));
  g.S(h.rect(166, 710, 268, 40));
});

/* ---------- The Ferris wheel at the county fair ---------- */
def({ id:"ferris-wheel", title:"The County Fair Ferris Wheel", season:"summer", tags:["county-fair", "ferris-wheel", "fairs", "summer"],
  talk:"Did you ride the Ferris wheel at the county fair? Who did you go with?" }, function(g){
  var cx = 300, cy = 330;
  g.S(h.poly([[96, 760], [140, 760], [314, 340], [286, 340]]));
  g.S(h.poly([[504, 760], [460, 760], [286, 340], [314, 340]]));
  g.S(h.circle(cx, cy, 232));
  g.S(h.circle(cx, cy, 200));
  var spokes = g.at(16, 12, 8);
  if (g.lvl >= 2) g.L(h.circle(cx, cy, 112));
  for (var i = 0; i < spokes; i++) g.L(h.line(h.onCircle(cx, cy, 34, i * 360 / spokes), h.onCircle(cx, cy, 200, i * 360 / spokes)));
  g.S(h.circle(cx, cy, 34));
  var cabins = g.at(8, 8, 6);
  for (var k = 0; k < cabins; k++){
    var a = -90 + k * 360 / cabins, p = h.onCircle(cx, cy, 232, a), q = h.onCircle(cx, cy, 278, a);
    g.L(h.line(p, [q[0], q[1] - 8]));
    g.S(h.path([q[0] - 38, q[1] + 10]).Q([q[0], q[1] - 30], [q[0] + 38, q[1] + 10]).L([q[0] + 30, q[1] + 60]).Q([q[0], q[1] + 68], [q[0] - 30, q[1] + 60]).Z());
    if (g.lvl >= 3) g.D(h.line([q[0] - 36, q[1] + 18], [q[0] + 36, q[1] + 18]));
  }
  ground(g, 760, 40, 560);
});

/* ---------- Apple pie cooling on the windowsill ---------- */
def({ id:"apple-pie", title:"Apple Pie on the Sill", season:"fall", tags:["pie", "baking", "apples", "kitchen", "desserts", "windows"],
  talk:"Who made the best pie in your family? What kind was it?" }, function(g){
  g.S(h.rect(70, 40, 460, 380));
  g.S(h.rect(100, 70, 400, 350));
  if (g.lvl >= 2){ g.L(h.line([300, 70], [300, 420])); g.L(h.line([100, 245], [500, 245])); }
  g.S(h.rect(40, 420, 520, 34));
  g.S(h.rect(60, 454, 480, 26), 2);
  var cy = 520;
  g.S(h.path([52, cy]).L([96, cy + 92]).Q([300, cy + 150], [504, cy + 92]).L([548, cy]).Z());
  var crust = []; for (var i = 0; i < 48; i++){ var t = i * 2 * Math.PI / 48, f = i % 2 ? .955 : 1; crust.push([300 + 256 * f * Math.cos(t), cy + 92 * f * Math.sin(t)]); }
  g.S(h.smooth(crust, false, 1));
  var top = ellipsePts(300, cy - 6, 196, 62, 72);
  g.S(h.poly(top));
  var L = g.at({ n:4, w:30, sp:88 }, { n:3, w:40, sp:116 }, null), minA = g.at(900, 2200, 0);
  if (L){
    [36, -36].forEach(function(ang){
      for (var k = -(L.n - 1) / 2; k <= (L.n - 1) / 2; k++){
        var a = ang * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux, ox = 300 + vx * k * L.sp, oy = cy - 6 + vy * k * L.sp * .42;
        var strip = [[ox - ux * 400 + vx * L.w / 2, oy - uy * 400 + vy * L.w / 4], [ox + ux * 400 + vx * L.w / 2, oy + uy * 400 + vy * L.w / 4], [ox + ux * 400 - vx * L.w / 2, oy + uy * 400 - vy * L.w / 4], [ox - ux * 400 - vx * L.w / 2, oy - uy * 400 - vy * L.w / 4]];
        var c = clipConvex(strip, top);
        if (c.length >= 3 && polyArea(c) > minA) g.S(h.poly(c));
      }
    });
  } else [-96, 0, 96].forEach(function(dx){ g.S(h.petal(300 + dx, cy - 6, -90, -48, 48, 56, "pointed")); });
});

/* ---------- Take me out to the ballgame ---------- */
def({ id:"ballgame", title:"Take Me Out to the Ballgame", season:"summer", tags:["baseball", "sports", "ballgames", "summer"],
  talk:"Which ball team did your family cheer for? Did you ever go to a game?" }, function(g){
  g.S(h.path([296, 300]).Q([450, 290], [500, 336]).Q([420, 356], [296, 334]).Z());
  g.S(h.path([120, 330]).C([120, 160], [356, 160], [356, 330]).Z());
  if (g.lvl >= 2){ g.D(h.path([238, 196]).Q([232, 262], [238, 330]).open()); g.D(h.path([176, 214]).Q([152, 268], [160, 330]).open(), 3); g.D(h.path([300, 214]).Q([324, 268], [316, 330]).open(), 3); }
  if (g.is(2)) g.S(h.ellipse(238, 184, 20, 11)); else g.K(h.ellipse(238, 184, 20, 11));
  g.group({ x:84, y:500, rot:-14 }, function(g){
    g.S(h.circle(0, 0, g.at(24, 26, 34)));
    g.S(h.path([12, -14]).C([130, -12], [270, -28], [440, -38]).C([476, -38], [476, 38], [440, 38]).C([270, 28], [130, 12], [12, 14]).Z());
    if (g.lvl >= 2) g.D(h.line([44, -12], [44, 12]));
  });
  g.S(h.circle(400, 636, 100));
  if (g.lvl >= 2){ g.D(h.path([330, 566]).C([374, 600], [374, 672], [330, 706]).open()); g.D(h.path([470, 566]).C([426, 600], [426, 672], [470, 706]).open()); }
});

/* ---------- The ice-cream soda ---------- */
def({ id:"ice-cream-soda", title:"The Ice-Cream Soda", era:"1950s", season:"summer", tags:["soda-fountains", "ice-cream", "diners", "desserts", "summer"],
  talk:"What did you order at the soda fountain or the ice-cream parlor?" }, function(g){
  g.S(h.ellipse(300, 742, 160, 28));
  g.S(h.poly([[356, 130], [380, 138], [348, 380], [324, 374]]));
  g.S(h.ellipse(300, 718, 76, 16));
  g.S(h.rect(288, 640, 24, 80));
  var half = [[300, 340], [394, 344], [406, 424], [388, 530], [348, 610], [300, 642]];
  g.S(h.mirror(half, 300));
  if (g.lvl >= 2){ g.D(h.path([256, 380]).Q([246, 500], [278, 620]).open()); g.D(h.path([344, 380]).Q([354, 500], [322, 620]).open()); }
  if (g.lvl >= 3){ g.D(h.path([300, 384]).L([300, 628]).open()); }
  g.S(h.path([194, 350]).C([190, 300], [226, 282], [250, 284]).C([248, 240], [276, 220], [300, 220]).C([324, 220], [352, 240], [350, 284]).C([374, 282], [410, 300], [406, 350]).Z());
  if (g.lvl >= 2) g.D(h.path([236, 316]).Q([300, 340], [364, 316]).open());
  g.S(h.circle(300, 192, 30));
  g.L(h.path([300, 162]).Q([306, 128], [334, 110]).open());
});

/* ---------- The blue ribbon from the county fair ---------- */
def({ id:"blue-ribbon", title:"The Blue Ribbon", season:"summer", tags:["county-fair", "ribbons", "prizes", "fairs", "summer"],
  talk:"Did you ever enter something at the county fair: a pie, a quilt, a calf or a garden vegetable?" }, function(g){
  g.S(h.poly([[236, 420], [312, 430], [262, 760], [214, 712], [170, 744]]));
  g.S(h.poly([[364, 420], [288, 430], [338, 760], [386, 712], [430, 744]]));
  var cx = 300, cy = 300, n = g.at(24, 18, 14);
  g.S(h.scallop(cx, cy, 214, n, .1, -90));
  if (g.lvl >= 2) for (var i = 0; i < n; i++){ var a = -90 + (i + .5) * 360 / n; g.D(h.line(h.onCircle(cx, cy, 150, a), h.onCircle(cx, cy, 184, a))); }
  g.S(h.circle(cx, cy, 148));
  g.S(h.circle(cx, cy, g.at(112, 112, 96)));
  if (g.lvl >= 3) g.S(h.star(cx, cy, 70, 30, 5, -90));
  if (g.lvl >= 2){ g.D(h.line([228, 520], [266, 520]), 3); g.D(h.line([334, 520], [372, 520]), 3); }
});
})(globalThis.CognicopiaColoring);
