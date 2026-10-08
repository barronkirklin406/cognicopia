/* Cognicopia Infinite Pages, family: homes, barns and Main Street.
   A two-story farmhouse with a porch, a cottage, a red barn, a one-room
   schoolhouse with its bell tower, a general store with an awning, and a
   lighthouse: plain front views standing on a lawn. Window panes, door
   braces and stripes run from edge to edge of their own frame, and are
   only drawn where every pane is big enough to color.
   See assets/cognicopia-coloring/infinite.js for the family contract. */
(function(C){
"use strict";
var I = C && C.infinite;
if (!I) return;
var h = C.helpers, k = I.kit;

/* a window: frame, then panes (four, two or one) as the tier and size allow */
function windowAt(g, x, y, w, ht){
  g.S(h.rect(x - w / 2, y - ht, w, ht));
  if (!g.is(2)) return;
  var four = g.is(3) && g.fits(h.rect(0, 0, w / 2, ht / 2), 1.4, Math.min(w, ht) / 2), two = g.fits(h.rect(0, 0, w / 2, ht), 1.4, w / 2);
  if (four){ g.D(h.line([x, y - ht], [x, y])); g.D(h.line([x - w / 2, y - ht / 2], [x + w / 2, y - ht / 2])); }
  else if (two) g.D(h.line([x, y - ht], [x, y]));
}
function door(g, x, y, w, ht){
  g.S(h.rect(x - w / 2, y - ht, w, ht));
  if (g.is(2)) g.K(h.circle(x + w * .3, y - ht * .48, g.min(5, g.at(4, 5, 6))));
}
/* a gable: the wall's triangle, then the roof over it as one band */
function gable(g, x0, x1, y, rh, ov, t){
  var cx = (x0 + x1) / 2, apex = [cx, y - rh], slope = rh / ((x1 - x0) / 2), ey = y + ov * slope;
  t = t * Math.sqrt(1 + slope * slope);                         // the band keeps its thickness across a steep pitch
  g.S(h.poly([[x0, y], apex, [x1, y]]));
  g.S(h.poly([[x0 - ov, ey], [cx, y - rh - t], [x1 + ov, ey], [x1, y], apex, [x0, y]]));
  return apex;
}

function farmhouse(g, p){
  var W = p.W, H = p.H, rh = p.rh, top = -H, ww = Math.min(g.min(W * .13, g.at(28, 40, 60)), W * .24), wh = ww * 1.45;
  if (g.is(2) && p.chimney) g.S(h.rect(p.chimney * W * .3 - (p.chimney < 0 ? g.tube(30) : 0), top - rh * .7, g.tube(30), rh * .7));
  g.S(h.rect(-W / 2, top, W, H));
  gable(g, -W / 2, W / 2, top, rh, 18, g.tube(18));
  if (p.attic && g.is(2)) windowAt(g, 0, top - rh * .22, g.min(W * .12, g.at(26, 36, 0)), g.min(W * .12, g.at(26, 36, 0)));
  var n = p.upstairs === 3 && W > 300 && g.is(2) ? 3 : 2, xs = n === 3 ? [-W * .3, 0, W * .3] : [-W * .26, W * .26];
  xs.forEach(function(x){ windowAt(g, x, top + H * .42, ww, wh); });
  /* ground floor: door, windows and porch posts spaced evenly, and the
     windows left out when the wall between them would be too narrow */
  var dw = g.min(W * .16, g.at(30, 44, 64)), porch = p.porch && g.is(2), pw = porch ? g.tube(16) : 0;
  var gap = (W - 2 * pw - 2 * ww - dw) / 4, wallOK = g.fits(h.rect(0, 0, gap, H * .3), 1.6, gap);
  if (wallOK) [-1, 1].forEach(function(sd){ windowAt(g, sd * (dw / 2 + gap + ww / 2), -H * .1, ww, Math.min(wh, H * .3)); });
  door(g, 0, 0, dw, H * .36);
  if (porch){
    var pr = g.min(26, g.at(18, 26, 38)), py = -H * .46;
    [-W / 2, W / 2 - pw].forEach(function(x){ g.S(h.rect(x, py + pr - 2, pw, -py - pr + 2)); });
    g.S(h.rect(-W / 2 - 14, py, W + 28, pr));
  }
  if (g.is(3)) g.S(h.rect(-dw * .9, -12, dw * 1.8, 12));
}
function cottage(g, p){
  var W = p.W * .9, H = p.H * .62, rh = p.rh * 1.15, top = -H, ww = Math.min(g.min(W * .15, g.at(30, 42, 62)), W * .22), wh = ww * 1.2;
  if (g.is(2) && p.chimney) g.S(h.rect(p.chimney * W * .34 - (p.chimney < 0 ? g.tube(30) : 0), top - rh * .62, g.tube(30), rh * .62));
  g.S(h.rect(-W / 2, top, W, H));
  gable(g, -W / 2, W / 2, top, rh, 22, g.tube(20));
  [-W * .3, W * .3].forEach(function(x){
    windowAt(g, x, -H * .3, ww, wh);
    if (p.boxes && g.is(3)) g.S(h.rect(x - ww * .62, -H * .3, ww * 1.24, g.min(14, 12)));
  });
  door(g, 0, 0, g.min(W * .17, g.at(30, 44, 64)), H * .66);
  if (g.is(2)) windowAt(g, 0, top - rh * .3, g.min(W * .12, g.at(24, 34, 0)), g.min(W * .12, g.at(24, 34, 0)));
}
function barn(g, p){
  var W = p.W, H = p.H * .78, rh = p.rh * 1.05, top = -H, t = g.tube(16) * g.at(1, 1.2, 1.5);
  var roof = [[-W / 2 - 12, top + 8], [-W * .44, top - rh * .6], [0, top - rh], [W * .44, top - rh * .6], [W / 2 + 12, top + 8]];
  /* a cupola on the ridge, drawn first so the roof covers its base */
  if (p.cupola && g.is(2)){ var cw = g.min(W * .16, g.at(40, 50, 0)), ch = g.min(46, g.at(40, 50, 0));
    g.S(h.rect(-cw / 2, top - rh - ch, cw, ch + 20)); g.S(h.poly([[-cw / 2 - 10, top - rh - ch], [0, top - rh - ch - cw * .6], [cw / 2 + 10, top - rh - ch]])); }
  g.S(h.rect(-W / 2, top, W, H));
  g.S(h.poly([[-W / 2, top], [-W * .44, top - rh * .6 + t], [0, top - rh + t], [W * .44, top - rh * .6 + t], [W / 2, top]]));
  g.S(h.poly(roof.concat([[W / 2 + 12, top + 8 + t], [W * .44, top - rh * .6 + t], [0, top - rh + t], [-W * .44, top - rh * .6 + t], [-W / 2 - 12, top + 8 + t]])));
  var dw = W * .44, dh = H * .66;
  g.S(h.rect(-dw / 2, -dh, dw, dh));
  if (g.is(2)){ g.D(h.line([-dw / 2, -dh], [0, 0])); g.D(h.line([0, -dh], [-dw / 2, 0])); g.D(h.line([0, -dh], [dw / 2, 0])); g.D(h.line([dw / 2, -dh], [0, 0])); g.D(h.line([0, -dh], [0, 0])); }
  else g.D(h.line([0, -dh], [0, 0]));
  /* the hayloft door sits in the gable, clear of the roof band */
  var lw = g.min(W * .2, g.at(40, 56, 80)), room = rh - t - 10 - g.min(14, g.at(10, 16, 26)), lh = Math.min(g.min(rh * .36, g.at(40, 54, 74)), room * .8);
  if (g.fits(h.rect(0, 0, lw, lh), 1.5, Math.min(lw, lh))) g.S(h.rect(-lw / 2, top - lh - 10, lw, lh));
  if (g.is(3)) [-W * .37, W * .37].forEach(function(x){ windowAt(g, x, -H * .5, g.min(W * .1, 28), g.min(W * .1, 28)); });
}
function schoolhouse(g, p){
  var W = p.W * .92, H = p.H * .7, rh = p.rh * .82, top = -H, tw = g.min(W * .24, g.at(50, 64, 84)), th = 74;
  /* the bell tower stands on the ridge, so it is drawn before the roof */
  g.S(h.rect(-tw / 2, top - rh - th, tw, th + rh * .5));
  g.S(h.poly([[-tw / 2 - 10, top - rh - th], [0, top - rh - th - tw * .8], [tw / 2 + 10, top - rh - th]]));
  var bo = g.min(tw * .4, g.at(20, 28, 0));
  if (g.is(2)) g.S(k.round([[-bo / 2, top - rh - 18], [-bo / 2, top - rh - th + 16], [bo / 2, top - rh - th + 16], [bo / 2, top - rh - 18]], [0, bo / 2, bo / 2, 0]));
  g.S(h.rect(-W / 2, top, W, H));
  gable(g, -W / 2, W / 2, top, rh, 18, g.tube(18));
  [-W * .32, W * .32].forEach(function(x){ windowAt(g, x, -H * .24, g.min(W * .14, g.at(30, 42, 60)), g.min(W * .14, g.at(30, 42, 60)) * 1.6); });
  var dw = g.min(W * .18, g.at(34, 46, 66));
  if (g.is(2)) g.S(h.poly([[-dw * .9, -H * .72], [0, -H * .72 - dw * .5], [dw * .9, -H * .72]]));
  door(g, 0, 0, dw, H * .66);
}
function store(g, p){
  var W = p.W, H = p.H * .9, ft = g.min(64, g.at(50, 64, 80)), top = -H;
  g.S(h.rect(-W / 2, top - ft, W, H + ft));
  g.S(h.rect(-W / 2 - 12, top - ft - g.min(18, g.at(14, 20, 32)), W + 24, g.min(18, g.at(14, 20, 32))));
  if (g.is(2)) g.S(h.rect(-W * .3, top - ft * .78, W * .6, ft * .58));
  var dw = g.min(W * .18, g.at(34, 46, 66)), sw = (W - dw) / 2 - 30, sh = H * .34;
  [-1, 1].forEach(function(s){ var x = s * (dw / 2 + 12 + sw / 2); windowAt(g, x, -H * .1, sw, sh); });
  door(g, 0, 0, dw, H * .46);
  /* the awning: a band with a scalloped edge, clear of the windows and door */
  var ah = g.min(30, g.at(22, 30, 44)), n = Math.max(4, Math.round(W / g.min(48, g.at(40, 56, 80)))), sr = (W + 20) / n / 2;
  var ay = Math.min(-H * .1 - sh, -H * .46) - g.min(16, g.at(12, 20, 32)) - sr - ah;
  var path = h.path([-W / 2 - 10, ay]).L([W / 2 + 10, ay]).L([W / 2 + 10, ay + ah]);
  for (var i = 0; i < n; i++){ var cx = W / 2 + 10 - sr - i * sr * 2; path.A(cx, ay + ah, sr, 0, 180); }
  g.S(path.Z());
  if (g.is(3)) for (var j = 1; j < n; j++){ var x = -W / 2 - 10 + j * sr * 2; g.D(h.line([x, ay], [x, ay + ah])); }
}
function lighthouse(g, p){
  var b = p.W * .48, t = b * .64, Ht = p.H * 1.9, top = -Ht, gal = g.min(20, g.at(16, 22, 34));
  var tower = [[-t / 2, top], [t / 2, top], [b / 2, 0], [-b / 2, 0]];
  var lw = t * .76, lh = g.min(62, g.at(54, 64, 84)), dome = g.min(lw * .55, g.at(26, 36, 50));
  var dd = h.path([-lw / 2 - 6, top - gal - lh + 4]).C([-lw / 2 - 6, top - gal - lh - dome * 1.3], [lw / 2 + 6, top - gal - lh - dome * 1.3], [lw / 2 + 6, top - gal - lh + 4]).Z();
  if (g.fits(dd, 1.4)) g.S(dd); else g.K(dd);
  g.K(h.circle(0, top - gal - lh - dome, g.min(6, g.at(5, 6, 8))));
  g.S(h.rect(-lw / 2, top - gal - lh, lw, lh));
  if (g.is(2)){ var m = g.at(3, 1, 0); for (var i = 1; i <= m; i++){ var x = -lw / 2 + lw * i / (m + 1); g.D(h.line([x, top - gal - lh], [x, top - gal])); } }
  g.S(h.poly(tower));
  g.S(h.rect(-t / 2 - 22, top - gal, t + 44, gal));
  /* stripes above the door, each band as tall as its own width allows */
  var dw = g.min(b * .3, g.at(30, 40, 56)), clear = -dw * 1.5 - g.min(20, g.at(14, 22, 34)), span = clear - top;
  var stripes = p.plain ? 0 : g.at(4, 3, 2);
  for (; stripes > 0; stripes--){ var bh = span / (stripes * 2 + 1); if (g.fits(h.rect(0, 0, t * .9, bh), 1.6, bh)) break; }
  for (var j = 1; j < stripes * 2; j += 2){
    var y0 = top + span * j / (stripes * 2 + 1), y1 = top + span * (j + 1) / (stripes * 2 + 1);
    g.D(h.line([k.xAt(tower[0], tower[3], y0), y0], [k.xAt(tower[1], tower[2], y0), y0]), 1);
    g.D(h.line([k.xAt(tower[0], tower[3], y1), y1], [k.xAt(tower[1], tower[2], y1), y1]), 1);
  }
  g.S(k.round([[-dw / 2, 0], [-dw / 2, -dw * 1.5], [dw / 2, -dw * 1.5], [dw / 2, 0]], [0, dw / 2, dw / 2, 0]));
}

var TYPES = { farmhouse:"two-story farmhouse with a front porch", cottage:"small cottage with a chimney", barn:"red barn with big doors and a hayloft",
  schoolhouse:"one-room schoolhouse with a bell tower", store:"general store with a striped awning", lighthouse:"striped lighthouse" };
I.family({
  id:"homestead", label:"Homes, barns and Main Street", template:"homestead",
  settings:["lawn"],
  params:function(R){
    var type = R.pick(Object.keys(TYPES));
    return { type:type, W:R.int(290, 340), H:R.int(220, 260), rh:R.int(110, 140), porch:R.chance(.7), boxes:R.chance(.6),
      chimney:R.pick([-1, 1, 1, 0]), upstairs:R.pick([2, 3]), attic:R.chance(.4), cupola:R.chance(.6), plain:R.chance(.25),
      sensitive:type === "farmhouse" || type === "cottage" ? ["home"] : type === "lighthouse" ? ["water"] : [] };
  },
  key:function(p){ return p.type; },
  subject:function(p){ return TYPES[p.type]; },
  title:function(p){ return { farmhouse:"The Farmhouse", cottage:"The Cottage", barn:"The Red Barn", schoolhouse:"The Schoolhouse", store:"The General Store", lighthouse:"The Lighthouse" }[p.type]; },
  talk:function(p, R){
    var t = { farmhouse:["What would you grow in the garden beside this house?", "Tell me about a porch where people liked to sit."],
      cottage:["What would make a cottage like this cozy?", "Which flowers would you plant by the door?"],
      barn:["What animals might live in this barn?", "Tell me about a farm you visited."],
      schoolhouse:["What was a school day like when you were young?", "Tell me about a favorite teacher."],
      store:["What would you buy at a general store?", "Tell me about a shop where people knew your name."],
      lighthouse:["Where have you seen the ocean or a big lake?", "What would it be like to keep a lighthouse?"] }[p.type];
    return R.pick(t.concat(["What colors would you choose for this building?"]));
  },
  tags:function(p){ return ["buildings", p.type, "heritage"]; },
  draw:function(g, h, p){ ({ farmhouse:farmhouse, cottage:cottage, barn:barn, schoolhouse:schoolhouse, store:store, lighthouse:lighthouse })[p.type](g, p); }
});
})(globalThis.CognicopiaColoring);
