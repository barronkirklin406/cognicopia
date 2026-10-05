/* Cognicopia Infinite Pages, family: mid-century household classics.
   A 1950s tabletop radio, a chrome toaster with two slices up, a rotary
   desk telephone, a twin-bell alarm clock and a table lamp. Each part that
   is too small to color at a tier becomes a small solid accent (a knob, a
   clock hand) or is left out; grille bars and lamp pleats run from one
   edge of their panel to the other. No brand names or lettering.
   See assets/cognicore/infinite.js for the family contract. */
(function(C){
"use strict";
var I = C && C.infinite;
if (!I) return;
var h = C.helpers, k = I.kit, D2R = Math.PI / 180;

/* a round part: colored when it is big enough, otherwise a solid accent */
function knob(g, x, y, r){ var d = h.circle(x, y, r); if (g.fits(d, 1.4)) g.S(d); else g.K(d); }
/* evenly spaced lines across a box, kept only while each strip is wide enough */
function bars(g, x0, y0, x1, y1, n, vertical){
  for (; n > 0; n--){ var gap = (vertical ? x1 - x0 : y1 - y0) / (n + 1); if (g.fits(h.rect(0, 0, vertical ? gap : x1 - x0, vertical ? y1 - y0 : gap), 1.5, gap)) break; }
  for (var i = 1; i <= n; i++){
    if (vertical){ var x = x0 + (x1 - x0) * i / (n + 1); g.D(h.line([x, y0], [x, y1])); }
    else { var y = y0 + (y1 - y0) * i / (n + 1); g.D(h.line([x0, y], [x1, y])); }
  }
}

function radio(g, p){
  var W = p.W, H = p.H, r = p.style === "dome" ? H * .46 : p.style === "arch" ? W * .3 : 18;
  var fw = g.lvl === 1 ? 0 : g.min(16, g.at(12, 18, 0));
  if (fw) [-W * .32, W * .32].forEach(function(x){ g.S(h.rrect(x - 22, -fw - 4, 44, fw + 8, 5)); });
  g.S(k.round([[-W / 2, -H - (p.style === "arch" ? H * .18 : 0)], [W / 2, -H - (p.style === "arch" ? H * .18 : 0)], [W / 2, -fw], [-W / 2, -fw]], [r, r, 12, 12]));
  /* speaker grille on one side, dial and knobs on the other */
  var gx0 = -W * .42, gx1 = W * .06, gy0 = -H * .82, gy1 = -fw - H * .14;
  g.S(h.rrect(gx0, gy0, gx1 - gx0, gy1 - gy0, 14));
  if (g.is(2)) bars(g, gx0, gy0, gx1, gy1, g.at(5, 3, 0), p.bars === "vertical");
  var dx = W * .25, dy = -H * .58, dr = Math.min(W * .14, H * .26);
  g.S(h.circle(dx, dy, dr));
  if (g.is(2) && g.ringFits(dr, dr * .55)) g.S(h.circle(dx, dy, dr * .55));
  if (g.is(3)) g.K(h.poly([[dx - 3, dy], [dx + 3, dy], [dx + dr * .5, dy - dr * .82]]));
  [dx - dr * .62, dx + dr * .62].forEach(function(x){ knob(g, x, -fw - H * .16, g.min(Math.min(W * .05, 16), g.at(10, 14, 20))); });
}
function toaster(g, p){
  var W = p.W, H = p.H * .9, bw = g.min(W * .3, 60);
  /* two slices of bread, then the lever, then the body */
  if (p.toast){ [-W * .2, W * .2].forEach(function(x){ g.S(k.round([[x - bw / 2, -H + 30], [x - bw / 2, -H - 44], [x - bw * .45, -H - 62], [x + bw * .45, -H - 62], [x + bw / 2, -H - 44], [x + bw / 2, -H + 30]], [0, 10, 18, 18, 10, 0])); }); }
  g.S(h.rrect(W / 2 - 12, -H * .62, g.min(34, g.at(24, 32, 46)), g.min(16, g.at(14, 22, 34)), 6));
  g.S(k.round([[-W / 2, -H], [W / 2, -H], [W / 2, -14], [-W / 2, -14]], [H * .3, H * .3, 10, 10]));
  if (!p.toast) [-W * .2, W * .2].forEach(function(x){ g.K(h.rrect(x - bw / 2, -H - 2, bw, 8, 4)); });
  g.S(h.rrect(-W / 2 - 10, -g.min(22, g.at(16, 24, 36)), W + 20, g.min(22, g.at(16, 24, 36)), 8));
  if (g.is(2)) knob(g, W * .32, -H * .28, g.min(14, g.at(12, 16, 0)));
  if (g.is(2)) [-H * .42, -H * .62].slice(0, g.at(2, 1, 0)).forEach(function(y){ g.D(h.line([-W / 2, y], [W / 2, y])); });
}
function telephone(g, p){
  var W = p.W * 1.05, H = p.H * .98, top = -H;
  /* the handset on its cradle: an arched grip with an earpiece and a
     mouthpiece at its ends, resting on the top of the body */
  var hs = g.tube(g.min(28, g.at(22, 30, 42))), cr = g.min(W * .13, g.at(24, 34, 50)), y0 = top + hs * .2;
  g.S(k.band([-W * .4, y0], [-W * .2, y0 - hs * 1.4], [W * .2, y0 - hs * 1.4], [W * .4, y0], hs));
  [-1, 1].forEach(function(s){ g.S(h.ellipse(s * W * .4, y0 + cr * .2, cr * 1.05, cr * .82)); });
  g.S(k.round([[-W * .36, top + hs * .9], [W * .36, top + hs * .9], [W * .5, 0], [-W * .5, 0]], [18, 18, 10, 10]));
  /* the dial: ring, finger holes when they fit, centre card */
  var cx = 0, cy = top + hs * .9 + (H - hs * .9) * .52, dr = Math.min(W * .27, (H - hs * .9) * .44);
  g.S(h.circle(cx, cy, dr));
  var hr = dr * .15, ring = dr * .66;
  if (g.is(3) && 2 * Math.PI * ring / 10 > hr * 2.6 && g.fits(h.circle(0, 0, hr), 1.3)){ for (var i = 0; i < 10; i++){ var a = (-60 + i * 30) * D2R; g.S(h.circle(cx + Math.cos(a) * ring, cy + Math.sin(a) * ring, hr)); } }
  if (g.is(2) && g.ringFits(dr, dr * .4)) g.S(h.circle(cx, cy, dr * .4)); else if (g.is(2)) knob(g, cx, cy, dr * .3);
}
function clock(g, p){
  var R = p.W * .42, cy = -R - g.min(26, g.at(18, 26, 38)), legW = g.tube(22);
  /* legs, bells and hammer behind the case */
  [-1, 1].forEach(function(s){ var leg = k.bar([s * R * .5, cy + R * .7], [s * R * .78, 0], legW, legW * .8); if (g.is(2)) g.S(leg); else g.K(leg); });
  [-1, 1].forEach(function(s){ var a = (-90 + s * 40) * D2R, bx = Math.cos(a) * R * 1.02, by = cy + Math.sin(a) * R * 1.02, br = R * .42;
    g.S(h.path([bx - br, by + br * .2]).C([bx - br, by - br * 1.1], [bx + br, by - br * 1.1], [bx + br, by + br * .2]).Z()); });
  if (g.is(2)) g.S(h.rrect(-g.tube(10) / 2, cy - R * 1.32, g.tube(10), R * .4, 4));
  g.S(h.circle(0, cy, R));
  var fr = R * .78;
  if (g.ringFits(R, fr)) g.S(h.circle(0, cy, fr)); else fr = R;
  if (g.is(2)) [0, 90, 180, 270].forEach(function(a){ var q = h.onCircle(0, cy, fr * .8, a - 90); g.K(h.circle(q[0], q[1], g.min(5, g.at(4, 5, 6)))); });
  /* hands as slim solid shapes */
  var hand = function(ang, len, w){ var a = (ang - 90) * D2R, tip = [Math.cos(a) * len, cy + Math.sin(a) * len], n = [-Math.sin(a) * w, Math.cos(a) * w];
    g.K(h.poly([[n[0], cy + n[1]], [tip[0], tip[1]], [-n[0], cy - n[1]], [-Math.cos(a) * w * 1.5, cy - Math.sin(a) * w * 1.5]])); };
  hand(p.hour * 30 + p.minute * .5, fr * .5, g.min(7, g.at(5, 6, 8)));
  hand(p.minute * 6, fr * .74, g.min(5, g.at(4, 5, 6)));
  g.K(h.circle(0, cy, g.min(8, g.at(6, 8, 10))));
}
function lamp(g, p){
  var W = p.W, sh = p.H * .62, top = -p.H * 1.55, sw0 = W * (p.shade === "drum" ? .62 : .42), sw1 = W * .76;
  /* the base and neck first, then the shade over the top of the neck */
  var bh = p.H * .62, neck = g.tube(18);
  g.S(h.rect(-neck / 2, top + sh - 10, neck, (-bh) - (top + sh) + 20));
  if (g.is(2)) knob(g, 0, top - g.min(12, g.at(9, 12, 16)) * .6, g.min(12, g.at(9, 12, 16)));
  var half = p.base === "jar" ? [[0, -bh], [W * .14, -bh], [W * .3, -bh * .78], [W * .34, -bh * .4], [W * .24, -bh * .08], [W * .26, 0], [0, 0]]
    : [[0, -bh], [neck * .8, -bh], [neck * .8, -bh * .22], [W * .3, -bh * .12], [W * .32, 0], [0, 0]];
  g.S(p.base === "jar" ? k.mirror(half, 0, .9) : k.mirror(half, 0, false));
  var shade = [[-sw0 / 2, top], [sw0 / 2, top], [sw1 / 2, top + sh], [-sw1 / 2, top + sh]];
  g.S(k.round(shade, p.shade === "bell" ? [14, 14, 4, 4] : [6, 6, 6, 6]));
  if (g.is(2)){
    var n = g.at(7, 4, 0);
    for (; n > 0; n--){ if (g.fits(h.rect(0, 0, sw0 / (n + 1), sh), 1.5, sw0 / (n + 1))) break; }
    for (var i = 1; i <= n; i++){ var f = i / (n + 1); g.D(h.line([-sw0 / 2 + sw0 * f, top], [-sw1 / 2 + sw1 * f, top + sh])); }
  }
  if (p.base === "jar" && g.is(3)){ var pts = k.mirrorPts(half, 0); g.D(h.line(pts[2], pts[pts.length - 2])); }
}

var TYPES = { radio:"1950s tabletop radio", toaster:"chrome pop-up toaster", telephone:"rotary desk telephone", clock:"twin-bell alarm clock", lamp:"table lamp with a pleated shade" };
I.family({
  id:"midcentury", label:"Mid-century household classics", template:"midcentury-classic",
  settings:["table", "shelf", "doily", "plain", "sill"],
  params:function(R){
    var type = R.pick(Object.keys(TYPES));
    return { type:type, W:R.int(240, 290), H:R.int(160, 196), style:R.pick(["dome", "box", "arch"]), bars:R.pick(["horizontal", "vertical"]),
      toast:R.chance(.65), hour:R.int(1, 12), minute:R.pick([0, 10, 15, 20, 30, 40, 45, 50]), shade:R.pick(["empire", "drum", "bell"]), base:R.pick(["jar", "column"]), era:"1950s" };
  },
  key:function(p){ return p.type; },
  subject:function(p){ return TYPES[p.type] + (p.type === "toaster" && p.toast ? " with two slices of toast" : ""); },
  title:function(p){ return { radio:"The Tabletop Radio", toaster:"The Chrome Toaster", telephone:"The Rotary Telephone", clock:"The Alarm Clock", lamp:"The Table Lamp" }[p.type]; },
  talk:function(p, R){
    var t = { radio:["What did you like to listen to on the radio?", "Which radio program did your family enjoy?"],
      toaster:["What do you like on your toast?", "Tell me about a favorite breakfast."],
      telephone:["Who did you like to call on the telephone?", "Tell me about a long telephone chat with a friend."],
      clock:["What time did your days usually start?", "Tell me about a busy morning in your house."],
      lamp:["Where is your favorite spot to sit and read?", "What would you read in the lamplight?"] }[p.type];
    return R.pick(t.concat(["What colors would you choose for this?"]));
  },
  tags:function(p){ return ["household", p.type, "1950s"]; },
  draw:function(g, h, p){ ({ radio:radio, toaster:toaster, telephone:telephone, clock:clock, lamp:lamp })[p.type](g, p); }
});
})(globalThis.CogniCore);
