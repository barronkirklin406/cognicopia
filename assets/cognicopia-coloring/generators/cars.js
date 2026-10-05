/* Cognicopia Infinite Pages, family: classic cars.
   Sedans, coupes, station wagons, pickups and convertibles from the 1940s
   to the 1960s, side-on, facing right, on a quiet street or a country
   lane. The body is one closed outline with the wheel arches cut a little
   smaller than the tires (the tires cover them, so no slivers), windows
   are the cabin moved inward, and every seam runs from one outline to
   another. Era sets the proportions; tail fins, two-tone paint,
   whitewalls and the year vary from page to page.
   See assets/cognicopia-coloring/infinite.js for the family contract. */
(function(C){
"use strict";
var I = C && C.infinite;
if (!I) return;
var h = C.helpers, k = I.kit;

var BODIES = { sedan:"four-door sedan", coupe:"two-door coupe", wagon:"station wagon", pickup:"pickup truck", convertible:"convertible" };
var YEARS = { "1940s":[1941, 1946, 1947, 1948, 1949], "1950s":[1950, 1951, 1952, 1953, 1954, 1955, 1956, 1957, 1958, 1959], "1960s":[1960, 1961, 1962, 1963, 1964, 1965, 1966] };

function geometry(p){
  var L = p.L, x0 = -L / 2, x1 = L / 2, e40 = p.era === "1940s", e60 = p.era === "1960s";
  var rw = e60 ? 42 : 46, wy = -rw, yS = -rw * .74;
  var yBelt = -(rw + (e60 ? 52 : e40 ? 64 : 58)), cabH = (e40 ? 80 : e60 ? 62 : 70) * p.roof;
  var G = { L:L, x0:x0, x1:x1, rw:rw, wy:wy, yS:yS, yBelt:yBelt, yRoof:yBelt - cabH, yDeck:yBelt + 4, yHood:yBelt + 8 * p.hood,
    xr:x0 + L * .2, xf:x1 - L * (e40 ? .19 : .21), ra:rw - 3, rc:e40 ? 30 : e60 ? 8 : 16, rr:e40 ? 34 : e60 ? 10 : 20 };
  var b = p.body;
  if (b === "sedan"){ G.xa = x0 + .25 * L; G.xc = G.xa + .11 * L; G.xd = G.xc + .25 * L; G.xb = G.xd + .1 * L; }
  else if (b === "coupe"){ G.xa = x0 + .27 * L; G.xc = G.xa + .14 * L; G.xd = G.xc + .17 * L; G.xb = G.xd + .1 * L; }
  else if (b === "wagon"){ G.xa = x0 + .01 * L; G.xc = x0 + .03 * L; G.xd = x0 + .66 * L; G.xb = G.xd + .1 * L; }
  else if (b === "pickup"){ G.xa = x0 + .44 * L; G.xc = G.xa; G.xd = G.xa + .15 * L; G.xb = G.xd + .09 * L; }
  else { G.xa = x0 + .3 * L; G.xb = x0 + .7 * L; }
  return G;
}
/* where the bottom edge of the body is at x (the sill, or up in an arch) */
function bottomY(G, x){
  var arch = function(cx){ var d = x - cx; return Math.abs(d) < G.ra ? G.wy - Math.sqrt(G.ra * G.ra - d * d) : null; };
  var a = arch(G.xr); if (a != null) return a;
  a = arch(G.xf); if (a != null) return a;
  return G.yS;
}
/* x where a level line at y crosses an arch (side -1 left, +1 right) */
function archX(G, cx, y, side){ var d = y - G.wy; return cx + side * Math.sqrt(Math.max(0, G.ra * G.ra - d * d)); }
function archPts(G, cx){
  var dy = G.yS - G.wy, th = Math.atan2(dy, Math.sqrt(Math.max(0, G.ra * G.ra - dy * dy))) * 180 / Math.PI, pts = [];
  for (var i = 0; i <= 12; i++){ var a = th + (-180 - 2 * th) * i / 12; pts.push(h.onCircle(cx, G.wy, G.ra, a)); }
  return pts;
}
function outline(G, p){
  var top, pts, r;
  if (p.body === "pickup"){
    top = [[G.x0, G.yBelt], [G.xa, G.yBelt], [G.xa, G.yRoof], [G.xd, G.yRoof], [G.xb, G.yBelt]]; r = [6, 0, G.rr * .6, G.rr * .6, 6];
  } else if (p.body === "convertible"){
    var hump = G.yDeck - 24;
    top = [[G.x0, G.yDeck], [G.xa, G.yDeck], [G.xa + .02 * G.L, hump], [G.xa + .13 * G.L, hump], [G.xa + .15 * G.L, G.yBelt], [G.xb, G.yBelt]]; r = [G.rc, 4, 12, 12, 4, 4];
  } else if (p.body === "wagon"){
    top = [[G.x0, G.yDeck + 10], [G.xc, G.yRoof], [G.xd, G.yRoof], [G.xb, G.yBelt]]; r = [4, G.rr * .6, G.rr, 6];
  } else {
    top = [[G.x0, G.yDeck], [G.xa, G.yDeck], [G.xc, G.yRoof], [G.xd, G.yRoof], [G.xb, G.yBelt]]; r = [G.rc, 6, G.rr, G.rr, 6];
  }
  if (p.fin){ top[0] = [G.x0, G.yDeck - 22]; r[0] = 3; top.splice(1, 0, [G.x0 + .15 * G.L, G.yDeck]); r.splice(1, 0, 4); }
  pts = [[G.x0, G.yS]].concat(top, [[G.x1, G.yHood], [G.x1, G.yS]], archPts(G, G.xf), archPts(G, G.xr));
  r = [8].concat(r, [G.rc, 8], archPts(G, G.xf).map(function(){ return 0; }), archPts(G, G.xr).map(function(){ return 0; }));
  return k.round(pts, r);
}
/* the side windows: the cabin moved inward */
function windows(G, p, g){
  var ins = g.at(10, 11, 13);
  if (p.body === "convertible") return null;
  var quad = p.body === "pickup" ? [[G.xa, G.yBelt], [G.xa, G.yRoof], [G.xd, G.yRoof], [G.xb, G.yBelt]]
    : p.body === "wagon" ? [[G.xc + 4, G.yBelt], [G.xc + 4, G.yRoof], [G.xd, G.yRoof], [G.xb, G.yBelt]]
    : [[G.xa, G.yDeck], [G.xc, G.yRoof], [G.xd, G.yRoof], [G.xb, G.yBelt]];
  return k.inset(quad, ins);
}
function wheel(g, x, G, p){
  g.S(h.circle(x, G.wy, G.rw));
  if (p.wheel === "whitewall") g.S(h.circle(x, G.wy, G.rw * .76), 3);
  g.S(h.circle(x, G.wy, G.rw * g.at(.48, .5, 0)), 2);
  if (g.lvl !== 2) g.K(h.circle(x, G.wy, g.at(5, 0, 9)));
}
function draw(g, h, p){
  var G = geometry(p), win = windows(G, p, g);
  if (p.body === "convertible"){
    /* the windshield leans back from the cowl; the seats sit behind its top */
    var ws = g.at(28, 36, 56), wh = g.at(52, 56, 64), wtl = G.xb - 6 - wh * .58 - ws;
    g.S(h.poly([[G.xb - 6, G.yBelt + 6], [G.xb - 6 - wh * .58, G.yBelt - wh], [wtl, G.yBelt - wh], [G.xb - 6 - ws, G.yBelt + 6]]));
    var sw = .1 * G.L, front = wtl - 10 - sw, rear = G.xa + .15 * G.L + 8;
    g.S(h.rrect(front, G.yBelt - 42, sw, 52, 12), 2);
    if (front - rear > sw + 12) g.S(h.rrect(rear, G.yBelt - 38, sw, 48, 12), 3);
  }
  g.S(outline(G, p));
  if (win){
    g.S(h.poly(win));
    /* pillars and door seams: from the window's top or bottom edge to the bottom of the body */
    var wb = function(x){ return k.yAt(win[0], win[3], x); }, wt = function(x){ return k.yAt(win[1], win[2], x); };
    var seams = [];
    if (p.body === "sedan") seams.push([(win[1][0] + win[2][0]) / 2, "top"], [win[3][0] - 6, "bottom"], [win[0][0] + 10, "bottom"]);
    else if (p.body === "wagon") seams.push([k.lerp(win[1], win[2], .36)[0], "top"], [k.lerp(win[1], win[2], .7)[0], "top"], [win[3][0] - 6, "bottom"]);
    else if (p.body === "coupe") seams.push([win[3][0] - 6, "bottom"], [win[0][0] + .55 * (win[3][0] - win[0][0]), "bottom"]);
    else seams.push([win[3][0] - 6, "bottom"], [win[0][0] + 12, "bottom"]);
    seams.forEach(function(s, i){
      var x = s[0], y0 = s[1] === "top" ? wt(x) : wb(x);
      if (s[1] === "top" && p.body === "wagon") g.L(h.line([x, y0], [x, bottomY(G, x)]), 2);
      else if (s[1] === "top") g.L(h.line([x, y0], [x, bottomY(G, x)]), i ? 3 : 2);
      else g.D(h.line([x, y0], [x, bottomY(G, x)]), 2);
    });
    if (g.lvl >= 3) g.K(h.rrect(win[3][0] - 44, G.yBelt + 14, 22, 7, 3.5));
  } else {
    var xs = (G.xa + .15 * G.L + G.xb) / 2 - 10;
    g.D(h.line([xs, G.yBelt], [xs, bottomY(G, xs)]), 2);
  }
  /* two-tone paint or a chrome spear: a level line from the rear to the
     front wheel, broken at the arches */
  if (p.twoTone || p.body === "pickup"){
    var y = G.yBelt + .42 * (G.yS - G.yBelt), lv = p.body === "pickup" ? 3 : 2;
    g.D(h.line([G.x0, y], [archX(G, G.xr, y, -1), y]), lv);
    g.D(h.line([archX(G, G.xr, y, 1), y], [archX(G, G.xf, y, -1), y]), lv);
  }
  g.S(h.rrect(G.x0 - 4, G.yDeck + 8, 18, 30, 7), 3);
  g.S(h.circle(G.x1 - 24, G.yHood + 26, g.at(14, 20, 0)), 2);
  var bw = g.at(34, 44, 0), bh = g.at(30, 34, 0);
  g.S(h.rrect(G.x0 - 14, G.yS - bh + 6, bw, bh, 10), 2);
  g.S(h.rrect(G.x1 + 14 - bw, G.yS - bh + 6, bw, bh, 10), 2);
  wheel(g, G.xr, G, p); wheel(g, G.xf, G, p);
}

/* the road under it */
function road(lane){
  return {
    label:lane ? "Country lane" : "Quiet street", words:lane ? "on a quiet country lane" : "parked on a quiet street",
    draw:function(g, h, b){
      var x0 = b.x0 - 16, x1 = b.x1 + 16, top = -5, bot = 44, w = x1 - x0;
      if (lane) g.S(h.path([x0, bot]).L([x0, top + 10]).C([x0 + w * .3, top - 6], [x1 - w * .3, top - 6], [x1, top + 10]).L([x1, bot]).Z());
      else g.S(h.rect(x0, top, w, bot - top));
      if (!lane) for (var i = 0; i < 4; i++){ var x = x0 + 24 + i * (w - 48 - 70) / 3; g.S(h.rrect(x, 18, 70, 14, 7), 3); }
    }
  };
}

I.family({
  id:"classic-car", label:"Classic car", template:"vehicle-profile",
  settings:["street", "lane"], compositions:["centered", "grounded", "arch"], sensitive:["driving"],
  boxes:I.WIDE,
  ownSettings:{ street:road(false), lane:road(true) },
  params:function(R, tier, o){
    var era = R.pick(o.era || ["1940s", "1950s", "1960s"]), body = R.pick(["sedan", "coupe", "wagon", "pickup", "convertible"]);
    return { era:era, body:body, year:R.pick(YEARS[era]), L:R.int(470, 520), roof:R.range(.92, 1.08), hood:R.range(.9, 1.1),
      wheel:R.pick(["hubcap", "whitewall"]), fin:era === "1950s" && body !== "pickup" && body !== "wagon" && R.chance(.7),
      twoTone:body !== "pickup" && R.chance(era === "1950s" ? .7 : .35) };
  },
  key:function(p){ return p.body + ":" + p.era; },
  subject:function(p){ var w = [p.fin ? "tail fins" : "", p.wheel === "whitewall" ? "whitewall tires" : ""].filter(Boolean);
    return p.year + " " + (p.twoTone ? "two-tone " : "") + BODIES[p.body] + (w.length ? " with " + w.join(" and ") : ""); },
  title:function(p){ return "The " + p.year + " " + { sedan:"Sedan", coupe:"Coupe", wagon:"Station Wagon", pickup:"Pickup", convertible:"Convertible" }[p.body]; },
  talk:function(p, R){ return R.pick([
    "Where would a drive in this " + (p.body === "pickup" ? "truck" : "car") + " take you on a sunny afternoon?",
    "What color would you paint this " + (p.body === "pickup" ? "truck" : "car") + "?",
    "Tell me about a car or truck that mattered to you.",
    "Who would you take along for a ride in this one?",
    p.body === "wagon" ? "Where did families go on a road trip in a wagon like this?" : "What did a new " + p.year + " model mean to people then?"]); },
  tags:function(p){ return ["cars", p.body === "pickup" ? "trucks" : p.body, p.era]; },
  draw:draw
});
})(globalThis.CognicopiaColoring);
