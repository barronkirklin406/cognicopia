/* Cognicopia Infinite Pages, family: tea and coffee service.
   Teapots (round, pear and squat), tall coffee pots, stovetop kettles and
   a cup and saucer. The body is a mirrored profile; the spout and the
   handle are bands drawn first and tucked into the body; decorative bands
   run between matching points of the profile; a lid sits on the rim with
   its base hidden. See assets/cognicopia-coloring/infinite.js for the family contract. */
(function(C){
"use strict";
var I = C && C.infinite;
if (!I) return;
var h = C.helpers, k = I.kit;

/* right halves (fractions of width W and height H), top centre to bottom centre */
var PROFILES = {
  round:  [[0, -1], [.26, -1], [.46, -.8], [.5, -.44], [.44, -.12], [.3, -.04], [0, -.04]],
  pear:   [[0, -1], [.2, -1], [.32, -.8], [.5, -.3], [.45, -.08], [.3, -.04], [0, -.04]],
  squat:  [[0, -.84], [.3, -.84], [.48, -.66], [.53, -.36], [.44, -.08], [.3, -.04], [0, -.04]],
  coffee: [[0, -1], [.26, -1], [.3, -.92], [.38, -.2], [.4, -.08], [.34, -.04], [0, -.04]],
  kettle: [[0, -.74], [.24, -.74], [.47, -.52], [.52, -.24], [.46, -.06], [.32, -.04], [0, -.04]]
};
function body(g, p, prof, W, H){
  var half = prof.map(function(q){ return [q[0] * W, q[1] * H]; }), pts = k.mirrorPts(half, 0), L = pts.length;
  g.S(k.mirror(half, 0, .9));
  /* decorative bands between matching points of the profile (always two at Tier 1) */
  if (p.bands || g.lvl === 3) [2, 4].slice(0, g.at(2, 1, 0)).forEach(function(j){ g.D(h.line(pts[j], pts[L - j])); });
  /* a five-petal flower on the side, only when it is big enough to color */
  if (p.motif && g.is(2)){
    var fy = (half[2][1] + half[4][1]) / 2, R = Math.min(W * .14, Math.abs(half[4][1] - half[2][1]) * .32);
    if (g.fits(h.petal(0, 0, -90, R * .3, R, R * .7, "round"), 1.5, R * .5)){
      for (var i = 0; i < 5; i++) g.S(h.petal(0, fy, -90 + i * 72, R * .3, R, R * .7, "round"));
      g.S(h.circle(0, fy, g.dot(R * .3)));
    }
  }
  return half;
}
/* the lid, drawn before the body so the rim covers its lower edge */
/* a handle on the left: a loop whose opening stays big enough to color */
function handle(g, xTop, xBot, y1, y2, t, out, yMin, yMax){
  for (var i = 0; i < 5; i++){
    var hole = h.ellipse(Math.min(xTop, xBot) - out * .42, (y1 + y2) / 2, Math.max(4, out * .36 - t / 2), Math.max(4, (y2 - y1) / 2 - t / 2));
    if (g.fits(hole, 1.5)) break;
    out *= 1.1; y1 = Math.max(yMin == null ? -1e9 : yMin, y1 - 6); y2 = Math.min(yMax == null ? 1e9 : yMax, y2 + 6);
  }
  if (g.fits(hole, 1.5)) g.S(k.band([xTop + 18, y1], [xTop - out, y1 - 6], [xBot - out, y2 + 6], [xBot + 18, y2], t));
  /* an opening too small to color: the handle is one solid loop instead */
  else g.S(h.path([xTop + 24, y1 - t / 2]).C([xTop - out - t / 2, y1 - 6 - t / 2], [xBot - out - t / 2, y2 + 6 + t / 2], [xBot + 24, y2 + t / 2]).Z());
}
function lid(g, top, lw, lh, knob){
  var kd = h.circle(0, top - lh - knob * .6, knob);
  if (g.fits(kd, 1.4)) g.S(kd); else g.K(kd);                 // a knob too small to color is solid, like a dark porcelain knob
  g.S(k.mirror([[0, top - lh], [lw * .3, top - lh * .9], [lw * .5, top - lh * .3], [lw * .5, top + 12], [0, top + 12]], 0, .9));
}
function teapot(g, p){
  var W = p.W, H = p.H, prof = PROFILES[p.shape], t = g.tube(g.at(22, 28, 34));
  var top = prof[0][1] * H;
  /* handle (left) and spout (right) first */
  handle(g, -W * .42, -W * .4, top + H * .16, -H * .2, t, g.at(80, 88, 100) + t, top + H * .08, -H * .12);
  var sw = g.tube(g.at(30, 34, 46)), st = g.tube(g.at(18, 22, 36)), sl = p.spout + g.at(0, 8, 24);
  g.S(k.band([W * .3, -H * .28], [W * .62, -H * .28], [W * .68, -H * .7], [W * .5 + sl, top - 4], sw, st));
  lid(g, top, W * .52, g.min(H * .18, g.at(18, 30, 48)), g.min(14, g.at(9, 12, 16)));
  body(g, p, prof, W, H);
}
function coffeePot(g, p){
  var W = p.W * .8, H = p.H * 1.35, prof = PROFILES.coffee, t = g.tube(g.at(22, 26, 34));
  var top = -H;
  handle(g, -W * .3, -W * .38, -H * .86, -H * .24, t, g.at(70, 80, 92) + t, -H * .9, -H * .14);
  var sw = g.tube(g.at(26, 30, 44)), st = g.tube(g.at(16, 20, 34));
  g.S(k.band([W * .3, -H * .2], [W * .6, -H * .24], [W * .5, -H * .72], [W * .42 + p.spout * .6, -H * .96], sw, st));
  lid(g, top, W * .54, g.min(H * .12, g.at(18, 28, 44)), g.min(13, g.at(9, 12, 16)));
  body(g, p, prof, W, H);
}
function kettle(g, p){
  var W = p.W * 1.1, H = p.H, prof = PROFILES.kettle, t = g.tube(g.at(22, 28, 36)), top = prof[0][1] * H;
  var sw = g.tube(g.at(30, 34, 46)), st = g.tube(g.at(22, 26, 38));
  g.S(k.band([W * .3, -H * .34], [W * .5, -H * .36], [W * .6, -H * .52], [W * .5 + p.spout * .5 + g.at(0, 8, 24), -H * .74], sw, st));
  /* the bail handle clears the lid and its knob by a gap big enough to color */
  var lh = g.min(H * .12, g.at(16, 26, 42)), kr = g.min(13, g.at(9, 12, 16)), lidTop = top - lh - kr * 1.6;
  var hx = W * .34, hh = Math.max(H * .5 + t, (top - lidTop + t + g.min(30, g.at(20, 30, 44))) / .75);
  g.S(k.band([-hx, top + 12], [-hx, top - hh], [hx, top - hh], [hx, top + 12], t));
  lid(g, top, W * .4, lh, kr);
  body(g, p, prof, W, H);
}
function cup(g, p){
  var Ws = p.W * 1.24, Wc = p.W * .8, Hc = p.H * .84, ry = g.min(20, g.at(16, 24, 38)), t = g.tube(g.at(18, 22, 30));
  g.S(h.ellipse(0, -ry, Ws / 2, ry));
  if (g.lvl === 3 && g.ringFits(ry * .5, ry * .2)) g.S(h.ellipse(0, -ry * 1.1, Ws * .36, ry * .55));
  g.group({ x:0, y:0, flip:true }, function(gg){ handle(gg, -Wc * .42, -Wc * .34, -Hc * .92, -Hc * .48, t, g.at(56, 62, 74) + t, -Hc * .96, -Hc * .4); });
  var half = [[0, -Hc], [Wc * .5, -Hc], [Wc * .47, -Hc * .58], [Wc * .41, -Hc * .34], [Wc * .32, -ry * 1.1], [Wc * .18, -ry * 1.05], [0, -ry * 1.05]];
  g.S(k.mirror(half, 0, .9));
  var rim = g.min(Hc * .1, g.at(14, 22, 32));
  g.S(h.ellipse(0, -Hc, Wc * .5 + 2, rim));
  var pts = k.mirrorPts(half, 0);
  if ((p.bands && g.is(2)) || g.lvl === 3) g.D(h.line(pts[2], pts[pts.length - 2]));
  if (g.lvl === 3) g.D(h.line(pts[3], pts[pts.length - 3]));
}

var NAMES = { teapot:"teapot", coffee:"coffee pot", kettle:"stovetop kettle", cup:"teacup and saucer" };
I.family({
  id:"tea", label:"Tea and coffee service", template:"heirloom-tableware",
  settings:["table", "doily", "tray", "shelf", "sill", "plain"],
  params:function(R){
    var type = R.pick(["teapot", "teapot", "coffee", "kettle", "cup"]);
    return { type:type, shape:R.pick(["round", "pear", "squat"]), W:R.int(210, 260), H:R.int(150, 185), spout:R.int(70, 96), bands:R.chance(.75), motif:R.chance(.5) };
  },
  key:function(p){ return p.type + (p.type === "teapot" ? ":" + p.shape : ""); },
  subject:function(p){ return (p.type === "teapot" ? p.shape + " china " : p.type === "coffee" ? "tall enamel " : p.type === "kettle" ? "" : "china ") + NAMES[p.type] + (p.motif && p.type !== "kettle" ? " with a flower on the side" : ""); },
  title:function(p){ return { teapot:"The China Teapot", coffee:"The Coffee Pot", kettle:"The Kettle", cup:"A Cup and Saucer" }[p.type]; },
  talk:function(p, R){ return R.pick(["Who would you invite over for a cup of tea or coffee?", "How do you take your tea, or your coffee?", "What would you serve alongside it?",
    "Tell me about a kitchen table where people gathered.", "Which colors would you paint this pattern?"]); },
  tags:function(p){ return ["tea", "kitchen", p.type]; },
  draw:function(g, h, p){ if (p.type === "teapot") teapot(g, p); else if (p.type === "coffee") coffeePot(g, p); else if (p.type === "kettle") kettle(g, p); else cup(g, p); }
});
})(globalThis.CognicopiaColoring);
