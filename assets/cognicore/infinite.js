/* =====================================================================
   COGNICOPIA INFINITE PAGES: the endless coloring-page generator
   Makes new, print-ready coloring pages on demand, as many as a facility
   needs, each one different, and each one held to the same clinical
   print standard as the curated library (docs/infinite-coloring-engine.md).

   How a page is made, in four steps:
     1. THEME MATRIX. A seed (a number) picks a theme (1950s and '60s
        nostalgia, classic vehicles, garden tools, local wildlife, household
        items...), a subject family in it (a classic car, a watering can, a
        songbird...), that family's parameters (body style, era, species,
        vase shape, flower...), a setting (a tabletop, a windowsill, a
        branch, a quiet street...) and a composition (centered, set low,
        an arched window, an oval cameo, a rounded tile; mirrored or not).
     2. PROMPT. The same choices fill one of ten prompt templates with
        {subject}, {setting} and {composition_style}. The words are the
        page's title, its description and, for staff who also use an
        image generator, a strict prompt for one (prompts.js formats it).
     3. DRAWING. The family draws the subject in closed vector shapes (the
        line-art engine's g/h, lineart.js), the setting is drawn behind
        it, and the whole picture is placed in its 3:4 box.
     4. GUARDRAILS. Before a page is kept it must pass every check:
          input:  the dignity filter (no childish, quizzing or talking-down
                  words), no banned subject words, nothing on the
                  resident's avoid list;
          vector: every filled shape closed, no loose line ends (a line
                  must end on another line or under a shape), the picture
                  inside its box with a margin, lines at least 3 pt;
          print:  printed at its smallest size and measured
                  (quality.js): no more tiny areas than the tier allows,
                  a sensible number of areas for the tier, line weight as
                  printed, and enough open white space around the subject.
        A page that fails is drawn again from the next seed; a batch never
        repeats a page, and spreads its subjects so the same kind of
        picture does not come twice while there are others to choose.

   Every page has a short code (for example 2NV-K3F9Q1: tier, theme, seed)
   printed in its footer. The same code always draws the same page, so
   a favorite can be printed again.

   Runs as a plain browser script and in Node (vm), after lineart.js,
   quality.js and prompts.js; the families that draw the subjects are in
   assets/cognicore/generators/*.js. It touches no network, storage or
   page: it only turns numbers into drawings.
   ===================================================================== */
(function(root){
"use strict";
var C = root.CogniCore, PR = root.CogniCorePrompts;
if (!C) return;
var h = C.helpers, W = C.W, H = C.H;
var VERSION = "1.0.0";

/* ---------- 1. Seeds ---------- */
/* A string or number to a 32-bit seed (FNV-1a, then a mixer). */
function hashSeed(s){
  s = String(s); var x = 2166136261;
  for (var i = 0; i < s.length; i++){ x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  x ^= x >>> 15; x = Math.imul(x, 2246822507); x ^= x >>> 13; x = Math.imul(x, 3266489909); x ^= x >>> 16;
  return x >>> 0;
}
/* A small, fast, seeded random source (mulberry32). Same seed, same page. */
function rng(seed){
  var a = seed >>> 0;
  function next(){ a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  var R = {
    next:next,
    range:function(lo, hi){ return Math.round((lo + (hi - lo) * next()) * 100) / 100; },
    int:function(lo, hi){ return lo + Math.floor(next() * (hi - lo + 1)); },
    pick:function(list){ return list[Math.floor(next() * list.length)]; },
    chance:function(p){ return next() < p; },
    weighted:function(list){                                        // [[item, weight], ...]
      var tot = 0, i; for (i = 0; i < list.length; i++) tot += list[i][1];
      var r = next() * tot;
      for (i = 0; i < list.length; i++){ r -= list[i][1]; if (r < 0) return list[i][0]; }
      return list[list.length - 1][0];
    },
    shuffle:function(list){ var b = list.slice(); for (var i = b.length - 1; i > 0; i--){ var j = Math.floor(next() * (i + 1)), t = b[i]; b[i] = b[j]; b[j] = t; } return b; }
  };
  return R;
}

/* ---------- 2. Rules: what every generated page must meet ----------
   On top of the library's tier rules (lineart.js TIERS: smallest area and
   how many tiny areas a page may have), a generated page must have a
   sensible number of areas for its tier (enough to color, few enough not
   to overwhelm), keep open white space around its subject, and stay
   within its box. Lines are at least 3 pt at every tier. */
var RULES = {
  1: { minRegions:8, maxRegions:110, minOpenSpace:.16, maxInk:.17, maxLooseEnds:0 },
  2: { minRegions:5, maxRegions:48,  minOpenSpace:.18, maxInk:.2,  maxLooseEnds:0 },
  3: { minRegions:3, maxRegions:20,  minOpenSpace:.18, maxInk:.27, maxLooseEnds:0 }
};
var MIN_PT = 3;              // the clinical floor: no line thinner than 3 pt
var MARGIN = 10;             // drawing units kept clear inside the 600 x 800 box

/* Subjects a page is never about, whatever a family or a staff member
   asks for: fantasy, cartoons, frightening or clinical scenes. (The
   dignity filter in prompts.js adds childish, quizzing and talking-down
   words.) Checked on every assembled prompt, title and caption. */
var BANNED = ["fantasy", "dragon", "unicorn", "fairy", "fairies", "wizard", "witch", "monster", "alien", "robot", "superhero", "mermaid", "zombie", "ghost",
  "skull", "skeleton", "weapon", "gun", "rifle", "knife", "blood", "war", "battle", "hospital", "ambulance", "syringe", "pills", "funeral", "grave", "cemetery", "coffin",
  "anime", "manga", "chibi", "emoji", "cartoon", "cartoonish", "comic", "caricature", "big eyes", "googly eyes"];
function bannedIn(text){
  var t = " " + String(text || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ") + " ";
  return BANNED.filter(function(w){ return t.indexOf(" " + w + " ") >= 0; });
}

/* ---------- 3. Themes: the matrix a seed chooses from ----------
   families: [family id, weight, options for that family's choices]. */
var THEMES = [
  { id:"nostalgia", code:"NV", label:"1950s & '60s Nostalgia", cat:"vintage-americana",
    blurb:"Two-tone cars with tail fins, tabletop radios, chrome toasters, rotary telephones and the household classics of the era.",
    families:[["classic-car", 3, { era:["1950s", "1960s"] }], ["midcentury", 4, {}]] },
  { id:"vehicles", code:"VH", label:"Classic Vehicles", cat:"classic-vehicles",
    blurb:"Sedans, coupes, station wagons, pickups and convertibles from the 1940s to the 1960s, in full side view on a quiet road.",
    families:[["classic-car", 1, {}]] },
  { id:"garden-tools", code:"GT", label:"Simple Gardening Tools", cat:"botanical-garden",
    blurb:"Watering cans, wheelbarrows, clay pots, birdhouses and a pail of hand tools: the familiar kit of a home garden.",
    families:[["garden", 1, {}]] },
  { id:"wildlife", code:"WL", label:"Local Wildlife", cat:"wildlife-nature",
    blurb:"Backyard songbirds on a branch, a fence post or a birdbath, and butterflies of the garden, drawn true to life.",
    families:[["songbird", 3, {}], ["butterfly", 2, {}]] },
  { id:"household", code:"HH", label:"Familiar Household Items", cat:"home-everyday",
    blurb:"Teapots, coffee pots, kettles, cups and saucers, lamps, clocks and radios: things from a kitchen table and a living room.",
    families:[["tea", 3, {}], ["midcentury", 2, {}]] },
  { id:"flowers", code:"FL", label:"Garden Flowers", cat:"botanical-garden",
    blurb:"Tulips, daisies, roses, sunflowers and daffodils in jugs, jars, pitchers and vases, and potted plants for the windowsill.",
    families:[["flowers", 3, {}], ["garden", 1, { type:["potted-plant"] }]] },
  { id:"homes", code:"HB", label:"Homes, Barns & Main Street", cat:"nostalgic-heritage",
    blurb:"Farmhouses, cottages, red barns, a one-room schoolhouse, a general store and a lighthouse.",
    families:[["homestead", 1, {}]] },
  { id:"harvest", code:"HV", label:"Harvest & Kitchen Garden", cat:"botanical-garden",
    blurb:"Bowls and baskets of apples, pears, lemons and peaches, pumpkins and garden vegetables.",
    families:[["harvest", 1, {}]] }
];
var THEME = {}, THEME_BY_CODE = {};
THEMES.forEach(function(t){ THEME[t.id] = t; THEME_BY_CODE[t.code] = t; });

/* ---------- 4. Families: the subjects (registered by generators/*.js) ----------
   A family: { id, label, template, sensitive, settings:[ids], compositions:[ids],
     params(R, tier, opts) -> p, key(p) -> the kind of subject, for spreading
     a batch; subject(p) -> words for {subject}; title(p), talk(p, R), tags(p),
     draw(g, h, p): the subject in closed shapes, standing on y = 0, centered
     on x = 0 }. settingsFor(p) and compositionsFor(p), when given, narrow
     the choices for one subject. A family may also define its own settings (perches, roads)
     and its own boxes for a composition (a wide subject such as a car uses
     nearly the full width of the page). */
var FAMILIES = {};
function family(f){
  ["id", "label", "template", "params", "key", "subject", "title", "talk", "draw"].forEach(function(k){ if (!f[k]) throw new Error("Generator family needs " + k + ": " + f.id); });
  if (FAMILIES[f.id]) throw new Error("Duplicate generator family " + f.id);
  f.settings = f.settings || ["plain"]; f.compositions = f.compositions || ["centered", "grounded", "arch", "cameo", "tile"];
  f.sensitive = f.sensitive || []; f.ownSettings = f.ownSettings || {};
  FAMILIES[f.id] = f;
  return f;
}

/* ---------- Drawing kit shared by the families ---------- */
var kit = {
  /* a closed outline through pts, each corner rounded by r (a number, or
     one per point; 0 keeps a corner sharp) */
  round:function(pts, r, open){
    var n = pts.length, rad = function(i){ return Array.isArray(r) ? (r[i] || 0) : (r || 0); };
    var at = function(a, b, d){ var L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + (b[0] - a[0]) * d / L, a[1] + (b[1] - a[1]) * d / L]; };
    var path = null;
    for (var i = 0; i < n; i++){
      var p = pts[i], prev = pts[(i + n - 1) % n], next = pts[(i + 1) % n], ri = rad(i);
      if (open && (i === 0 || i === n - 1)) ri = 0;
      if (ri > 0){
        var d = Math.min(ri, Math.hypot(p[0] - prev[0], p[1] - prev[1]) / 2, Math.hypot(p[0] - next[0], p[1] - next[1]) / 2);
        var a = at(p, prev, d), b = at(p, next, d);
        if (!path) path = h.path(a); else path.L(a);
        path.Q(p, b);
      } else { if (!path) path = h.path(p); else path.L(p); }
    }
    return open ? path.open() : path.Z();
  },
  /* a convex outline moved inward by k (window glass inside a frame) */
  inset:function(pts, k){
    var n = pts.length, cx = 0, cy = 0, lines = [], out = [];
    pts.forEach(function(p){ cx += p[0] / n; cy += p[1] / n; });
    for (var i = 0; i < n; i++){
      var a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      if ((cx - a[0]) * nx + (cy - a[1]) * ny < 0){ nx = -nx; ny = -ny; }
      lines.push([a[0] + nx * k, a[1] + ny * k, dx, dy]);
    }
    for (var j = 0; j < n; j++){
      var l1 = lines[(j + n - 1) % n], l2 = lines[j], den = l1[2] * l2[3] - l1[3] * l2[2];
      if (Math.abs(den) < 1e-9){ out.push([l2[0], l2[1]]); continue; }
      var t = ((l2[0] - l1[0]) * l2[3] - (l2[1] - l1[1]) * l2[2]) / den;
      out.push([l1[0] + l1[2] * t, l1[1] + l1[3] * t]);
    }
    return out;
  },
  /* the y of a straight edge a-b at x */
  yAt:function(a, b, x){ return a[1] + (b[1] - a[1]) * (x - a[0]) / ((b[0] - a[0]) || 1); },
  /* the x of a straight edge a-b at y */
  xAt:function(a, b, y){ return a[0] + (b[0] - a[0]) * (y - a[1]) / ((b[1] - a[1]) || 1); },
  lerp:function(a, b, t){ return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; },
  /* a closed outline from its right half (top of the centre line, down the
     right side, to the bottom of the centre line), smooth or straight */
  mirror:function(half, cx, smooth){ var left = half.slice(1, half.length - 1).reverse().map(function(p){ return [2 * cx - p[0], p[1]]; });
    return smooth === false ? h.poly(half.concat(left)) : h.smooth(half.concat(left), false, smooth == null ? 1 : smooth); },
  /* x of a polygon's left or right side at height y (straight edges) */
  sideX:function(pts, y, right){
    var best = null;
    for (var i = 0; i < pts.length; i++){
      var a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] - y) * (b[1] - y) > 0 || a[1] === b[1]) continue;
      var x = kit.xAt(a, b, y);
      if (best == null || (right ? x > best : x < best)) best = x;
    }
    return best == null ? 0 : best;
  },
  /* a closed band t thick along the cubic a, c1, c2, b (handles, stems,
     arches), offset along the curve so it keeps its thickness all the way;
     t2 tapers it to the far end */
  band:function(a, c1, c2, b, t, t2){
    var n = 18, L = [], R = [], u2 = t2 == null ? t : t2;
    for (var i = 0; i <= n; i++){
      var s = i / n, u = 1 - s;
      var p = [u*u*u*a[0] + 3*u*u*s*c1[0] + 3*u*s*s*c2[0] + s*s*s*b[0], u*u*u*a[1] + 3*u*u*s*c1[1] + 3*u*s*s*c2[1] + s*s*s*b[1]];
      var d = [3*u*u*(c1[0] - a[0]) + 6*u*s*(c2[0] - c1[0]) + 3*s*s*(b[0] - c2[0]), 3*u*u*(c1[1] - a[1]) + 6*u*s*(c2[1] - c1[1]) + 3*s*s*(b[1] - c2[1])];
      var len = Math.hypot(d[0], d[1]) || 1, w = (t + (u2 - t) * s) / 2, nx = -d[1] / len * w, ny = d[0] / len * w;
      L.push([p[0] + nx, p[1] + ny]); R.push([p[0] - nx, p[1] - ny]);
    }
    return h.poly(L.concat(R.reverse()));
  },
  /* a straight bar from a to b, t thick (posts, legs, rails); t2 tapers it */
  bar:function(a, b, t, t2){
    var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L / 2, ny = dx / L / 2, u = t2 == null ? t : t2;
    return h.poly([[a[0] + nx * t, a[1] + ny * t], [b[0] + nx * u, b[1] + ny * u], [b[0] - nx * u, b[1] - ny * u], [a[0] - nx * t, a[1] - ny * t]]);
  },
  /* points of the outline a mirrored half makes (to anchor lines on it) */
  mirrorPts:function(half, cx){ return half.concat(half.slice(1, half.length - 1).reverse().map(function(p){ return [2 * cx - p[0], p[1]]; })); }
};

/* ---------- 5. Settings: what the subject stands on ----------
   Each is drawn behind the subject, sized from the subject's box b
   ({ x0, y0, x1, y1 }, standing on y1), in a few big closed shapes. */
function sizeOf(b){ var bw = b.x1 - b.x0, bh = b.y1 - b.y0; return { cx:(b.x0 + b.x1) / 2, y:b.y1, w:Math.max(bw * 1.32, bh * .9), u:Math.max(bw, bh) / 420 }; }
function ellipsePts(cx, cy, rx, ry, n, lobes, depth){
  var pts = [];
  for (var i = 0; i < n; i++){ var a = i / n * Math.PI * 2, k = lobes ? 1 - (i % 2 ? depth : 0) : 1; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  return pts;
}
var SETTINGS = {
  plain:  { label:"No setting", words:"on its own, with clean white space all around" },
  table:  { label:"Tabletop", words:"standing on a plain wooden tabletop",
    draw:function(g, h, b){ var s = sizeOf(b), u = s.u, x0 = s.cx - s.w / 2, x1 = s.cx + s.w / 2, d = 26 * u;
      g.S(h.poly([[x0 + d, s.y - 20 * u], [x1 - d, s.y - 20 * u], [x1, s.y + 26 * u], [x0, s.y + 26 * u]]));
      g.S(h.rect(x0, s.y + 26 * u, s.w, g.min(g.at(28, 30, 34) * u, g.at(15, 24, 38)))); } },
  sill:   { label:"Windowsill", words:"resting on a sunny windowsill",
    draw:function(g, h, b){ var s = sizeOf(b), u = s.u, x0 = s.cx - s.w / 2, t = g.min(30 * u, g.at(16, 24, 38));
      g.S(h.rrect(x0, s.y - 8 * u, s.w, t, 6 * u));
      g.S(h.rect(x0 + 40 * u, s.y - 8 * u + t, s.w - 80 * u, g.min(g.at(30, 32, 36) * u, g.at(15, 24, 38)))); } },
  shelf:  { label:"Wall shelf", words:"on a wall shelf with two plain brackets",
    draw:function(g, h, b){ var s = sizeOf(b), u = s.u, x0 = s.cx - s.w / 2, x1 = s.cx + s.w / 2, t = g.min(24 * u, g.at(15, 24, 38)), kk = g.min(g.at(56, 60, 66) * u, g.at(40, 60, 100)), y = s.y - 6 * u + t;
      g.S(h.rect(x0, s.y - 6 * u, s.w, t));
      g.S(h.poly([[x0 + 30 * u, y], [x0 + 30 * u + kk, y], [x0 + 30 * u, y + kk]]));
      g.S(h.poly([[x1 - 30 * u, y], [x1 - 30 * u - kk, y], [x1 - 30 * u, y + kk]])); } },
  doily:  { label:"Oval placemat", words:"on an oval placemat",
    draw:function(g, h, b){ var s = sizeOf(b), u = s.u, rx = s.w * .46, ry = g.min(g.at(40, 42, 46) * u, g.at(30, 40, 60)), rim = g.min(14 * u, g.at(10, 14, 0));
      g.S(h.ellipse(s.cx, s.y + 4 * u, rx, ry));
      if (g.is(2)) g.S(h.ellipse(s.cx, s.y + 4 * u, rx - rim * 1.6, ry - rim)); } },
  tray:   { label:"Serving tray", words:"on a serving tray with two handles",
    draw:function(g, h, b){ var s = sizeOf(b), u = s.u, x0 = s.cx - s.w / 2, x1 = s.cx + s.w / 2, th = g.min(g.at(30, 32, 38) * u, g.at(18, 26, 40)), hw = g.min(g.at(34, 38, 44) * u, g.at(32, 44, 60));
      if (g.fits(h.rrect(0, 0, hw - 8 * u, th, th / 2), 1.6, th)){ g.S(h.rrect(x0 - hw + 8 * u, s.y - 10 * u, hw, th, th / 2)); g.S(h.rrect(x1 - 8 * u, s.y - 10 * u, hw, th, th / 2)); }
      g.S(h.rrect(x0, s.y - 14 * u, s.w, th + 8 * u, 10 * u)); } },
  bench:  { label:"Potting bench", words:"on a sturdy potting bench",
    draw:function(g, h, b){ var s = sizeOf(b), u = s.u, x0 = s.cx - s.w / 2, x1 = s.cx + s.w / 2, lw = g.min(g.at(26, 30, 36) * u, g.at(16, 26, 46)), lh = g.min(90 * u, g.at(60, 72, 90)), top = g.min(28 * u, g.at(16, 24, 38));
      g.S(h.rect(x0 + 24 * u, s.y + top - 8 * u, lw, lh)); g.S(h.rect(x1 - 24 * u - lw, s.y + top - 8 * u, lw, lh));
      g.S(h.rect(x0, s.y - 8 * u, s.w, top)); } },
  lawn:   { label:"Lawn", words:"on a gentle patch of lawn",
    draw:function(g, h, b){ var s = sizeOf(b), u = s.u, x0 = s.cx - s.w / 2 - 20 * u, x1 = s.cx + s.w / 2 + 20 * u;
      g.S(h.path([x0, s.y + 40 * u]).C([x0 + 30 * u, s.y - 10 * u], [s.cx - s.w * .2, s.y - 14 * u], [s.cx, s.y - 12 * u]).C([s.cx + s.w * .2, s.y - 10 * u], [x1 - 30 * u, s.y - 8 * u], [x1, s.y + 40 * u]).Z()); } },
  porch:  { label:"Porch boards", words:"on the boards of a front porch",
    draw:function(g, h, b){ var s = sizeOf(b), u = s.u, x0 = s.cx - s.w / 2 - 10 * u, x1 = s.cx + s.w / 2 + 10 * u, t = g.min(g.at(56, 60, 66) * u, g.at(30, 40, 56));
      g.S(h.rect(x0, s.y - 12 * u, x1 - x0, t));
      if (g.is(2)){ var n = g.at(5, 3, 0); for (var i = 1; i <= n; i++){ var x = x0 + (x1 - x0) * i / (n + 1); g.D(h.line([x, s.y - 12 * u], [x - 14 * u, s.y - 12 * u + t])); } } } }
};

/* ---------- 6. Compositions: where the picture sits on the page ----------
   box: where the subject and its setting go (600 x 800 units); anchor:
   centered in it or standing on its floor; frame: an outline drawn first. */
var COMPOSITIONS = {
  centered:{ label:"Centered", words:"centered on the page with a wide white margin all around", box:[50, 84, 550, 716], anchor:"center" },
  grounded:{ label:"Set low", words:"set low on the page with open white space above", box:[44, 176, 556, 744], anchor:"bottom" },
  arch:    { label:"Arched window", words:"inside a plain arched window frame", box:[82, 200, 518, 728], anchor:"bottom",
    frame:function(g, h){ g.S(h.path([40, 768]).L([40, 276]).Q([40, 36], [300, 36]).Q([560, 36], [560, 276]).L([560, 768]).Z()); } },
  cameo:   { label:"Oval cameo", words:"inside a simple oval cameo frame", box:[116, 150, 484, 650], anchor:"center",
    frame:function(g, h){ g.S(h.ellipse(300, 400, 264, 364)); } },
  tile:    { label:"Rounded tile", words:"inside a rounded square tile with one bold border", box:[78, 96, 522, 704], anchor:"center",
    frame:function(g, h){ g.S(h.rrect(36, 40, 528, 720, 56)); } }
};

/* Boxes for a wide subject (a car, a wheelbarrow): nearly the full width
   of the page, so it is drawn big, with open space above it. */
var WIDE = { centered:[14, 150, 586, 650], grounded:[14, 300, 586, 744], arch:[56, 250, 544, 716] };

/* ---------- 7. Prompt templates ----------
   Ten variable-driven templates, one per kind of subject, plus one for
   Tier 3 pages of any family. {subject}, {setting} and {composition_style}
   come from the page's choices; the clinical frame (PREFIX, the tier's
   words and NEGATIVE) is added to every one. */
var PREFIX = "Bold black-and-white coloring page for older adults in memory care: ";
var SUFFIX = "Realistic, adult and dignified; continuous ultra-thick black outlines (at least {min_pt} pt at print size), every shape fully closed, pure white fills and background, no gray, no shading, no cross-hatching, no texture, no text, one focal subject with generous white space around it, 3:4 portrait page.";
var TEMPLATES = [
  { id:"heirloom-tableware", label:"Heirloom tableware", families:["tea"],
    text:"a {subject} {setting}, {composition_style}. A familiar piece of tableware with a smooth, simple outline and true-to-life proportions." },
  { id:"vehicle-profile", label:"Classic vehicle in profile", families:["classic-car"],
    text:"a {subject} in full side view, {setting}, {composition_style}. Real-world proportions and period-correct details, large round wheels, no people inside." },
  { id:"garden-tool", label:"Garden tool", families:["garden"],
    text:"a {subject} {setting}, {composition_style}. A practical, well-used garden tool drawn plainly and true to life." },
  { id:"songbird", label:"Backyard songbird", families:["songbird"],
    text:"a {subject} {setting}, {composition_style}. Field-guide accurate anatomy, a calm resting pose, a small solid black eye, feathers suggested by a few large shapes." },
  { id:"flower-arrangement", label:"Flower arrangement", families:["flowers"],
    text:"{subject} {setting}, {composition_style}. Large open blooms with clearly separated petals, stems and leaves with white space between them." },
  { id:"midcentury-classic", label:"Mid-century household classic", families:["midcentury"],
    text:"a {subject} {setting}, {composition_style}. A 1950s or 1960s household classic with rounded, era-accurate styling and no brand names." },
  { id:"homestead", label:"Familiar building", families:["homestead"],
    text:"a {subject} {setting}, {composition_style}. A plain front view with a clear roofline, a few large windows and a simple door." },
  { id:"harvest-still-life", label:"Harvest still life", families:["harvest"],
    text:"{subject} {setting}, {composition_style}. Whole, recognizable fruit and vegetables with smooth outlines and room between them." },
  { id:"garden-wildlife", label:"Garden wildlife", families:["butterfly"],
    text:"a {subject} {setting}, {composition_style}. Natural, symmetrical wing shapes and markings simplified into a few large closed areas." },
  { id:"bold-easy-focal", label:"Bold & Easy single focal (Tier 3)", families:[], tier:3,
    text:"one very large {subject} {setting}, {composition_style}. Only a handful of big, simple closed areas, the heaviest lines, nothing in the background." }
];
var TEMPLATE = {}; TEMPLATES.forEach(function(t){ TEMPLATE[t.id] = t; });
/* What a generator must never draw (written into every prompt). */
var NEGATIVE = ["gray", "shading", "gradient", "cross-hatching", "stippling", "texture", "thin lines", "sketchy lines", "broken outlines", "open shapes",
  "busy background", "pattern fill", "text", "lettering", "logo", "watermark", "border clutter", "cartoon", "anime", "big eyes", "chibi", "childish",
  "fantasy", "caricature", "photo", "3d render", "color"];
function templateFor(f, tier){ return tier === 3 ? TEMPLATE["bold-easy-focal"] : TEMPLATE[f.template]; }
/* fill a template; "a {subject}" takes "an" before a vowel sound */
function fill(text, slots){
  return text.replace(/\ba \{subject\}/g, function(){ var s = String(slots.subject || ""); return (/^[aeiou]/i.test(s) ? "an " : "a ") + s; })
    .replace(/\{(\w+)\}/g, function(m, k){ return slots[k] != null ? slots[k] : m; });
}

/* ---------- 8. A page from a seed ---------- */
function themeFor(id){ return THEME[id] || THEMES[0]; }
/* spec({ seed, tier, theme }) -> every choice for one page. Deterministic. */
function spec(o){
  var seed = typeof o.seed === "number" ? o.seed >>> 0 : hashSeed(o.seed == null ? 1 : o.seed);
  var tier = [1, 2, 3].indexOf(+o.tier) >= 0 ? +o.tier : 2, th = themeFor(o.theme), R = rng(seed);
  var fams = th.families.filter(function(x){ return FAMILIES[x[0]]; });
  if (!fams.length) throw new Error("No generator families are loaded for theme " + th.id);
  var pick = R.weighted(fams.map(function(x){ return [x, x[1]]; })), F = FAMILIES[pick[0]];
  var p = F.params(R, tier, pick[2] || {});
  var fs = F.settingsFor ? F.settingsFor(p) : F.settings, fc = F.compositionsFor ? F.compositionsFor(p) : F.compositions;
  var settings = (o.settings || fs).filter(function(s){ return fs.indexOf(s) >= 0 && (SETTINGS[s] || F.ownSettings[s]); });
  var setting = R.pick(settings.length ? settings : fs);
  var comps = fc.filter(function(c){ return COMPOSITIONS[c]; });
  var composition = R.pick(comps), mirror = R.chance(.5);
  var S = F.ownSettings[setting] || SETTINGS[setting], K = COMPOSITIONS[composition], T = templateFor(F, tier);
  var slots = { subject:F.subject(p), setting:typeof S.words === "function" ? S.words(p) : S.words, composition_style:K.words, min_pt:String(Math.round(weight(tier).pt * 10) / 10) };
  var sp = {
    v:1, engine:VERSION, seed:seed, tier:tier, theme:th.id, cat:th.cat, family:F.id, p:p, setting:setting, composition:composition, mirror:mirror,
    key:F.id + ":" + F.key(p), template:T.id, slots:slots,
    title:F.title(p), talk:F.talk(p, R), tags:(F.tags ? F.tags(p) : []).concat([th.id]), sensitive:F.sensitive.concat(p.sensitive || []),
    era:p.era || "", season:p.season || ""
  };
  sp.sig = [sp.key, setting, composition, mirror ? 1 : 0, JSON.stringify(p)].join("|");
  sp.code = code(sp);
  sp.description = sentence(fill(T.text, slots));
  return sp;
}
function sentence(s){ s = String(s).replace(/\s+/g, " ").trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
function weight(tier){ return C.weightFor(tier); }

/* Page codes: tier, theme and seed, for example 2NV-K3F9Q1. */
function code(sp){ return sp.tier + themeFor(sp.theme).code + "-" + (sp.seed >>> 0).toString(36).toUpperCase(); }
function parse(c){
  var m = /^\s*([123])([A-Z]{2})-([0-9A-Z]{1,7})\s*$/.exec(String(c || "").toUpperCase());
  if (!m || !THEME_BY_CODE[m[2]]) return null;
  var seed = parseInt(m[3], 36);
  if (!(seed >= 0 && seed <= 4294967295)) return null;
  try { return spec({ seed:seed, tier:+m[1], theme:THEME_BY_CODE[m[2]].id }); } catch (e){ return null; }
}

/* The prompt for this page: the template filled in, with the clinical
   frame, for an image generator (prompts.js formats it per generator). */
function prompt(sp, generator){
  var T = TEMPLATE[sp.template], tw = PR ? PR.TIER_WORDS[sp.tier] : { add:"", neg:[] };
  var positive = PREFIX + fill(T.text, sp.slots) + " " + fill(SUFFIX, sp.slots) + (tw.add ? " " + sentence(tw.add) + "." : "");
  var negative = NEGATIVE.concat(tw.neg || []).filter(function(x, i, a){ return a.indexOf(x) === i; });
  var out = { template:T.id, positive:positive, negative:negative, slots:sp.slots };
  if (PR) out.text = PR.format({ positive:positive.replace(/\.$/, ""), negative:negative }, generator || "midjourney");
  return out;
}

/* ---------- 9. Drawing a page ---------- */
/* The smallest a part may print at each tier, in page units (600 across
   the picture): a tube or bar's width, and a round part's radius. With
   the tier's line weight, these leave an area inside each part that is
   above the tier's smallest area to color. */
var MIN_TUBE = { 1:13, 2:20, 3:32 }, MIN_R = { 1:12, 2:18, 3:30 };
/* Tell a drawing its page scale: g.px is drawing units per page unit;
   g.tube(w) and g.dot(r) raise a width or radius to the tier's minimum;
   g.min(v, m) raises v to m page units. */
function perimeter(d){
  var pts = C.samplePath(d, 8), L = 0;
  for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}
function prep(g, px){
  var Lay = C.pageLayout(C.smallestLayout(g.tier)), unit = Lay.artW / W;           // inches per page unit, at the smallest print
  var minA = C.TIERS[g.tier].minArea / (unit * unit), stroke = C.weightFor(g.tier).pt / 72 / unit;
  /* g.fits(d, k, w): the closed shape d (drawing units) leaves an area to
     color at least k (default 1.4) times the tier's smallest area when
     printed, and (when its narrowest width w is given) is wide enough not
     to fill in with ink */
  g.fits = function(d, k, w){
    return C.shapeArea(d) / (px * px) - perimeter(d) / px * stroke / 2 >= minA * (k || 1.4) && (w == null || w / px >= 2.4 * stroke);
  };
  /* g.ringFits(rOut, rIn): the ring between two round outlines is wide and
     big enough to color (rOut: the outer outline's narrowest radius) */
  g.ringFits = function(rOut, rIn){
    var a = rOut / px, b = rIn / px;
    return a - b >= 2.2 * stroke && Math.PI * (a * a - b * b) - Math.PI * (a + b) * stroke >= minA * 1.4;
  };
  g.stroke = stroke * px;
  g.px = px;
  g.min = function(v, m){ return Math.max(v, m * px); };
  g.tube = function(v){ return Math.max(v || 0, MIN_TUBE[g.tier] * px); };
  g.dot = function(v){ return Math.max(v || 0, MIN_R[g.tier] * px); };
  return g;
}
function union(a, b){ return !a ? b : !b ? a : { x0:Math.min(a.x0, b.x0), y0:Math.min(a.y0, b.y0), x1:Math.max(a.x1, b.x1), y1:Math.max(a.y1, b.y1) }; }
function render(sp){
  var F = FAMILIES[sp.family];
  if (!F) throw new Error("Unknown generator family " + sp.family);
  var S = F.ownSettings[sp.setting] || SETTINGS[sp.setting] || SETTINGS.plain, K = COMPOSITIONS[sp.composition] || COMPOSITIONS.centered;
  var meta = { id:"gen-" + sp.code.toLowerCase(), title:sp.title, talk:sp.talk, cat:sp.cat, tags:sp.tags, era:sp.era, season:sp.season,
    sensitive:sp.sensitive, fit:"page", source:"generated", code:sp.code, spec:sp };
  var boxes = F.boxesFor ? F.boxesFor(sp.p) : F.boxes, bx = (boxes && boxes[sp.composition]) || K.box, tw = bx[2] - bx[0], th = bx[3] - bx[1];
  /* lay out: draw the subject and its setting, fit them in the box, then
     draw again knowing the page scale (so thin parts keep the tier's
     printed minimum), and fit once more */
  var layout = function(tier, px){
    var subj = C.sketch(tier, function(s){ prep(s, px); F.draw(s, h, sp.p); }).bbox, all = subj;
    if (S.draw) all = union(all, C.sketch(tier, function(s){ prep(s, px); S.draw(s, h, subj, sp.p); }).bbox);
    return { subj:subj, all:all, s:Math.min(tw / Math.max(1, all.x1 - all.x0), th / Math.max(1, all.y1 - all.y0)) };
  };
  return C.renderWith(meta, function(g){
    var first = layout(g.tier, 1), px = 1 / first.s, L = layout(g.tier, px);
    px = 1 / L.s;
    var all = L.all, s = L.s, cx = (all.x0 + all.x1) / 2, cy = (all.y0 + all.y1) / 2;
    var X = (bx[0] + bx[2]) / 2, Y = K.anchor === "bottom" ? bx[3] - (all.y1 - cy) * s : (bx[1] + bx[3]) / 2;
    if (K.frame) K.frame(g, h);
    prep(g, px);
    g.group({ x:X, y:Y, s:s, ox:cx, oy:cy, flip:!!sp.mirror }, function(gg){ if (S.draw) S.draw(gg, h, L.subj, sp.p); F.draw(gg, h, sp.p); });
  }, sp.tier, sp);
}

/* ---------- 10. Guardrails ---------- */
/* Input: the words of the page. Returns problems ([] when clean). */
function guard(sp, o){
  o = o || {};
  var out = [], words = [sp.title, sp.talk, sp.slots.subject, sp.slots.setting, sp.slots.composition_style, sp.tags.join(" ")].join(" ");
  if (PR) PR.dignityCheck(words).forEach(function(x){ out.push("dignity: \"" + x.term + "\" (" + x.kind + ")"); });
  bannedIn(words + " " + prompt(sp).positive).forEach(function(w){ out.push("banned subject word: " + w); });
  var avoid = o.avoid || [];
  sp.sensitive.forEach(function(x){ if (avoid.indexOf(x) >= 0) out.push("on the resident's avoid list: " + x); });
  if (weight(sp.tier).pt < MIN_PT || Math.max(C.MIN_LINE_PT, weight(sp.tier).detailPt) < MIN_PT) out.push("line weight under " + MIN_PT + " pt");
  return out;
}

/* Vector: closed shapes, no loose line ends, inside the box. */
function polylines(it){
  var subs = [], cur = null;
  C.parsePath(it.d).forEach(function(s){
    if (s.op === "M"){ cur = { pts:[s.p], closed:false }; subs.push(cur); }
    else if (s.op === "L") cur.pts.push(s.p);
    else if (s.op === "C"){ for (var i = 1; i <= 8; i++){ var t = i / 8, u = 1 - t, a = s.from;
      cur.pts.push([u*u*u*a[0] + 3*u*u*t*s.c1[0] + 3*u*t*t*s.c2[0] + t*t*t*s.p[0], u*u*u*a[1] + 3*u*u*t*s.c1[1] + 3*u*t*t*s.c2[1] + t*t*t*s.p[1]]); } }
    else if (cur) cur.closed = true;
  });
  return subs;
}
function segDist(p, a, b){
  var dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, t = L2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
  return Math.sqrt(x * x + y * y);
}
function inside(p, pts){
  var c = false;
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++){
    var a = pts[i], b = pts[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function inspect(r){
  var out = [], tr = function(p){ return [r.tx + p[0] * r.s, r.ty + p[1] * r.s]; };
  var L = C.pageLayout(C.smallestLayout(r.tier)), unitsPerPt = W / (L.artW * 72);
  var tol = weight(r.tier).pt * unitsPerPt * .5 + 1.5;
  var shapes = r.items.map(function(it){ return polylines(it).map(function(sp){ return { pts:sp.pts.map(tr), closed:sp.closed }; }); });
  var loose = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  r.items.forEach(function(it, i){
    shapes[i].forEach(function(sp){
      sp.pts.forEach(function(p){ if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
      if (it.fill && !sp.closed) out.push("an open outline on a filled shape (item " + i + ")");
    });
    if (it.fill) return;
    shapes[i].forEach(function(sp, k){
      if (sp.closed || sp.pts.length < 2) return;
      [sp.pts[0], sp.pts[sp.pts.length - 1]].forEach(function(p){
        var ok = false;
        for (var j = 0; j < shapes.length && !ok; j++){
          var later = j > i && r.items[j].fill;
          for (var m = 0; m < shapes[j].length && !ok; m++){
            var q = shapes[j][m];
            if (j === i && m === k) continue;
            if (later && q.closed && inside(p, q.pts)){ ok = true; break; }
            for (var n = 0; n + 1 < q.pts.length; n++) if (segDist(p, q.pts[n], q.pts[n + 1]) <= tol){ ok = true; break; }
            if (!ok && q.closed && q.pts.length > 2 && segDist(p, q.pts[q.pts.length - 1], q.pts[0]) <= tol) ok = true;
          }
        }
        if (!ok) loose++;
      });
    });
  });
  if (loose > RULES[r.tier].maxLooseEnds) out.push(loose + " loose line end" + (loose === 1 ? "" : "s") + " (every line must end on another line)");
  if (x0 < MARGIN || y0 < MARGIN || x1 > W - MARGIN || y1 > H - MARGIN) out.push("the picture runs outside its box");
  return { problems:out, looseEnds:loose, box:[Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)] };
}
/* Print: measured at the smallest printed size (quality.js). */
function measurePage(r, o){
  o = o || {};
  if (!C.quality) return { problems:[], m:null };
  var T = C.TIERS[r.tier], Rl = RULES[r.tier], wt = weight(r.tier);
  var m = C.quality.measureRender(r, { strokes:o.strokes !== false, space:true }).m, out = [];
  if (m.tiny_regions > T.maxTiny) out.push(m.tiny_regions + " areas under " + T.minArea + " sq in (Tier " + r.tier + " allows " + T.maxTiny + ")");
  if (m.regions < Rl.minRegions) out.push("only " + m.regions + " areas to color (at least " + Rl.minRegions + ")");
  if (m.regions > Rl.maxRegions) out.push(m.regions + " areas to color (at most " + Rl.maxRegions + " at Tier " + r.tier + ")");
  if (m.open_space < Rl.minOpenSpace) out.push("too little open white space (" + Math.round(m.open_space * 100) + "%, at least " + Math.round(Rl.minOpenSpace * 100) + "%)");
  if (m.ink_coverage > Rl.maxInk) out.push("too much ink (" + Math.round(m.ink_coverage * 100) + "% of the page)");
  if (m.stroke_pt_median != null && m.stroke_pt_median < wt.pt * .75) out.push("lines print at " + m.stroke_pt_median + " pt, under " + wt.pt + " pt");
  return { problems:out, m:m };
}
/* Every check on one page: { ok, problems, report }. */
function check(sp, r, o){
  o = o || {};
  var g = guard(sp, o), v = inspect(r), q = o.measure === false ? { problems:[], m:null } : measurePage(r, o);
  var problems = g.concat(v.problems, q.problems);
  return { ok:!problems.length, problems:problems,
    report:{ dignity:g.length ? "fail" : "pass", looseEnds:v.looseEnds, box:v.box, lineWeightPt:weight(sp.tier).pt, metrics:q.m } };
}

/* ---------- 11. Batches: many pages, never the same twice ----------
   o: { seed, count, tier, themes:[ids], avoid:[sensitive codes], skip:[codes],
        measure:false to skip the print measure (faster; vector and input
        checks still run), strokes:false to skip only the line-width pass,
        attempts: tries per page (default 14) }.
   Returns { pages:[{ spec, r, check }], rejected:[{ code, problems }] }. */
function batch(o){
  o = o || {};
  var count = Math.max(1, Math.min(200, +o.count || 1)), tier = [1, 2, 3].indexOf(+o.tier) >= 0 ? +o.tier : 2;
  var themes = (o.themes && o.themes.length ? o.themes : THEMES.map(function(t){ return t.id; })).filter(function(t){ return THEME[t]; });
  if (!themes.length) themes = THEMES.map(function(t){ return t.id; });
  var base = String(o.seed == null ? "cognicopia" : o.seed), order = rng(hashSeed(base + "#order")).shuffle(themes);
  var seenSig = {}, seenKey = {}, skip = {}, pages = [], rejected = [], tries = o.attempts || 14;
  (o.skip || []).forEach(function(c){ skip[String(c).toUpperCase()] = 1; });
  for (var i = 0; i < count; i++){
    var theme = order[i % order.length], best = null;
    for (var a = 0; a < tries && !best; a++){
      var sp = spec({ seed:hashSeed(base + "#" + i + "#" + a), tier:tier, theme:theme });
      if (seenSig[sp.sig] || skip[sp.code]) continue;
      if (seenKey[sp.key] && a < tries - 4) continue;            // spread the kinds of subject while there are others
      var r;
      try { r = render(sp); } catch (e){ rejected.push({ code:sp.code, problems:["could not be drawn: " + e.message] }); continue; }
      var ck = check(sp, r, o);
      if (!ck.ok){ rejected.push({ code:sp.code, problems:ck.problems }); continue; }
      best = { spec:sp, r:r, check:ck };
    }
    if (best){ seenSig[best.spec.sig] = 1; seenKey[best.spec.key] = (seenKey[best.spec.key] || 0) + 1; pages.push(best); }
  }
  return { pages:pages, rejected:rejected };
}

/* One page from its code, checked: { spec, r, check } or null. */
function page(c, o){
  var sp = typeof c === "string" ? parse(c) : c;
  if (!sp) return null;
  var r = render(sp);
  return { spec:sp, r:r, check:check(sp, r, o) };
}

C.infinite = {
  version:VERSION, THEMES:THEMES, THEME:THEME, SETTINGS:SETTINGS, COMPOSITIONS:COMPOSITIONS, TEMPLATES:TEMPLATES, TEMPLATE:TEMPLATE,
  RULES:RULES, MIN_PT:MIN_PT, MIN_TUBE:MIN_TUBE, MIN_R:MIN_R, WIDE:WIDE, BANNED:BANNED, NEGATIVE:NEGATIVE, FAMILIES:FAMILIES,
  family:family, hashSeed:hashSeed, rng:rng, spec:spec, code:code, parse:parse, prompt:prompt, render:render,
  guard:guard, inspect:inspect, measure:measurePage, check:check, batch:batch, page:page, bannedIn:bannedIn,
  ellipsePts:ellipsePts, kit:kit
};
})(typeof globalThis !== "undefined" ? globalThis : this);
