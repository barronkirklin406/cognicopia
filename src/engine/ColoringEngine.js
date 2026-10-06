/* =====================================================================
   Cognicopia hybrid coloring engine.

   A coloring page in two layers:
     Layer 1, the subject: one clean, pre-drawn vector picture (a car, a
       clock, a bird) from assets/coloring/<folder>/, scaled to fill the
       middle of the page. Its lines are set in printed points after
       scaling, so a small picture and a large one print the same weight.
     Layer 2, the setting: everything around it, made here for the
       resident's stage, with a seed so every page is different and any
       page can be printed again from its page code:
         early   a Zentangle-style border of small patterned cells and
                 mandala corners, the picture's title, and an open
                 conversation prompt underneath;
         middle  a bold border of a few large shapes, and a completion
                 line ("A classic 1967 muscle ____") with the word to
                 write shown beside it, so there is no wrong answer;
         late    no border and nothing behind the picture: very thick
                 lines, fine detail left out, and a large title banner.

   Rules the engine holds every page to (validate() reports any break):
     - pure black lines on white: fills are white, or a small black
       accent; no gray, shading or hatching;
     - no line under 3 px (2.25 pt); at the late stage none under 5 px
       (3.75 pt). The engine draws 4, 6 and 8 px (3, 4.5 and 6 pt);
     - US Letter, 0.5 in margins, everything inside the printable area.

   Output: toSVG (screen and print), toCanvas (screen preview, or 300
   DPI for a print-ready image) and toPDF (vector, through jsPDF or the
   build scripts' writer). renderHybridPage(profile, target) does it all.

   No network: subjects come from assets/coloring/subjects.bundle.js when
   it is on the page, otherwise from this site's own files (which the
   offline service worker keeps).
   ===================================================================== */
(function(root, factory){
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CognicopiaColoringEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(root){
  "use strict";
  var VERSION = "1.0.0";
  var PAGE = { w:612, h:792, margin:36 };                       // US Letter in points
  var PX = 72 / 96;                                              // one CSS pixel in points
  var STAGES = {
    early:  { key:"E", line:3,   detail:3,   border:3,   min:3 * PX, label:"Early stage" },
    middle: { key:"M", line:4.5, detail:3.6, border:4.5, min:3 * PX, label:"Middle stage" },
    late:   { key:"L", line:6,   detail:0,   border:6,   min:5 * PX, label:"Late stage" }
  };
  var FONT = '"Atkinson Hyperlegible", Arial, Helvetica, sans-serif';

  function manifest(){
    if (root.CognicopiaColoringManifest) return root.CognicopiaColoringManifest;
    if (typeof require === "function"){ try { return require("../services/ColoringManifest.js"); } catch (e){} }
    throw new Error("The coloring subjects list (ColoringManifest.js) is not loaded.");
  }
  function stageOf(s){
    var v = String(s == null ? "" : s).toLowerCase();
    if (STAGES[v]) return v;
    if (v === "1" || v === "mild" || v === "early-stage") return "early";
    if (v === "2" || v === "moderate" || v === "mid") return "middle";
    if (v === "3" || v === "advanced" || v === "severe" || v === "late-stage") return "late";
    return "middle";
  }

  /* ---------- path data: absolute M, L, C and Z (what the processor writes) ---------- */
  var TOK = /[MLCZmlcz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
  function parse(d){
    var t = String(d).match(TOK) || [], out = [], i = 0, cmd = "";
    while (i < t.length){
      if (/[A-Za-z]/.test(t[i])){ cmd = t[i++].toUpperCase(); if (cmd === "Z"){ out.push({ op:"Z" }); continue; } }
      if (cmd === "M" || cmd === "L"){ out.push({ op:cmd, p:[+t[i], +t[i + 1]] }); i += 2; if (cmd === "M") cmd = "L"; }
      else if (cmd === "C"){ out.push({ op:"C", c1:[+t[i], +t[i + 1]], c2:[+t[i + 2], +t[i + 3]], p:[+t[i + 4], +t[i + 5]] }); i += 6; }
      else i++;
    }
    return out;
  }
  var f2 = function(v){ var r = Math.round(v * 100) / 100; return String(r === 0 ? 0 : r); };
  function str(segs){
    return segs.map(function(s){
      if (s.op === "Z") return "Z";
      if (s.op === "C") return "C" + f2(s.c1[0]) + " " + f2(s.c1[1]) + " " + f2(s.c2[0]) + " " + f2(s.c2[1]) + " " + f2(s.p[0]) + " " + f2(s.p[1]);
      return s.op + f2(s.p[0]) + " " + f2(s.p[1]);
    }).join("");
  }
  function map(segs, k, dx, dy){
    var m = function(p){ return [dx + p[0] * k, dy + p[1] * k]; };
    return segs.map(function(s){ return s.op === "Z" ? s : s.op === "C" ? { op:"C", c1:m(s.c1), c2:m(s.c2), p:m(s.p) } : { op:s.op, p:m(s.p) }; });
  }
  function box(segs, b){
    b = b || [Infinity, Infinity, -Infinity, -Infinity];
    var cur = null, add = function(x, y){ if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; };
    segs.forEach(function(s){
      if (s.op === "Z") return;
      if (s.op === "C" && cur) for (var k = 1; k < 12; k++){ var t = k / 12, u = 1 - t;
        add(u * u * u * cur[0] + 3 * u * u * t * s.c1[0] + 3 * u * t * t * s.c2[0] + t * t * t * s.p[0], u * u * u * cur[1] + 3 * u * u * t * s.c1[1] + 3 * u * t * t * s.c2[1] + t * t * t * s.p[1]); }
      add(s.p[0], s.p[1]); cur = s.p;
    });
    return b;
  }

  /* ---------- shapes for the border, as path data ---------- */
  var KAPPA = 0.5522847498;
  function circle(cx, cy, r){
    var k = KAPPA * r;
    return "M" + f2(cx + r) + " " + f2(cy) + "C" + [cx + r, cy + k, cx + k, cy + r, cx, cy + r].map(f2).join(" ") + "C" + [cx - k, cy + r, cx - r, cy + k, cx - r, cy].map(f2).join(" ") +
      "C" + [cx - r, cy - k, cx - k, cy - r, cx, cy - r].map(f2).join(" ") + "C" + [cx + k, cy - r, cx + r, cy - k, cx + r, cy].map(f2).join(" ") + "Z";
  }
  function rect(x, y, w, h, r){
    r = Math.min(r || 0, w / 2, h / 2);
    if (!r) return "M" + f2(x) + " " + f2(y) + "L" + f2(x + w) + " " + f2(y) + "L" + f2(x + w) + " " + f2(y + h) + "L" + f2(x) + " " + f2(y + h) + "Z";
    var k = KAPPA * r, P = function(a){ return a.map(f2).join(" "); };
    return "M" + P([x + r, y]) + "L" + P([x + w - r, y]) + "C" + P([x + w - r + k, y, x + w, y + r - k, x + w, y + r]) + "L" + P([x + w, y + h - r]) +
      "C" + P([x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h]) + "L" + P([x + r, y + h]) + "C" + P([x + r - k, y + h, x, y + h - r + k, x, y + h - r]) +
      "L" + P([x, y + r]) + "C" + P([x, y + r - k, x + r - k, y, x + r, y]) + "Z";
  }
  function poly(pts){ return pts.map(function(p, i){ return (i ? "L" : "M") + f2(p[0]) + " " + f2(p[1]); }).join("") + "Z"; }
  function line(a, b){ return "M" + f2(a[0]) + " " + f2(a[1]) + "L" + f2(b[0]) + " " + f2(b[1]); }
  /* a petal (a lens) from the center c to the tip t, w wide */
  function petal(c, t, w){
    var dx = t[0] - c[0], dy = t[1] - c[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * w, ny = dx / L * w;
    var a = [c[0] + dx * 0.25 + nx, c[1] + dy * 0.25 + ny], b = [c[0] + dx * 0.75 + nx, c[1] + dy * 0.75 + ny];
    var a2 = [c[0] + dx * 0.75 - nx, c[1] + dy * 0.75 - ny], b2 = [c[0] + dx * 0.25 - nx, c[1] + dy * 0.25 - ny];
    var P = function(p){ return f2(p[0]) + " " + f2(p[1]); };
    return "M" + P(c) + "C" + P(a) + " " + P(b) + " " + P(t) + "C" + P(a2) + " " + P(b2) + " " + P(c) + "Z";
  }
  /* a soft, uneven pebble */
  function pebble(cx, cy, r, rnd){
    var n = 6, pts = [], i;
    for (i = 0; i < n; i++){ var a = i / n * Math.PI * 2, rr = r * (0.82 + rnd() * 0.22); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    var P = function(p){ return f2(p[0]) + " " + f2(p[1]); }, d = "M" + P(pts[0]);
    for (i = 0; i < n; i++){
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += "C" + P([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]) + " " + P([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]) + " " + P(p2);
    }
    return d + "Z";
  }
  /* a smooth closed curve around c, its radius a function of the angle */
  function polar(c, rOf, n){
    var pts = [], i, P = function(p){ return f2(p[0]) + " " + f2(p[1]); };
    for (i = 0; i < n; i++){ var a = i / n * Math.PI * 2, r = rOf(a); pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); }
    var d = "M" + P(pts[0]);
    for (i = 0; i < n; i++){
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += "C" + P([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]) + " " + P([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]) + " " + P(p2);
    }
    return d + "Z";
  }
  function rng(seed){ var s = (seed >>> 0) || 1; return function(){ s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------- motifs: closed shapes inside one border cell ---------- */
  /* Every motif keeps clear of the cell's edges, so no sliver too small
     to color appears between a motif and a divider. */
  var MOTIFS = {
    rosette:function(c, R, rnd, n){ n = n || 4; var out = [], rot = rnd() < 0.5 ? 0 : Math.PI / n;
      for (var i = 0; i < n; i++){ var a = rot + i / n * Math.PI * 2; out.push(petal([c[0], c[1]], [c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R], R * (n > 5 ? 0.22 : 0.3))); }
      out.push(circle(c[0], c[1], R * 0.3)); return out; },
    rings:function(c, R){ return [circle(c[0], c[1], R), circle(c[0], c[1], R * 0.52)]; },
    diamond:function(c, R){ return [poly([[c[0], c[1] - R], [c[0] + R, c[1]], [c[0], c[1] + R], [c[0] - R, c[1]]]), circle(c[0], c[1], R * 0.4)]; },
    pebbles:function(c, R, rnd){ var r = R * 0.42, d = R * 0.5;
      return [pebble(c[0] - d * 0.55, c[1] - d * 0.45, r, rnd), pebble(c[0] + d * 0.6, c[1] - d * 0.3, r * 0.92, rnd), pebble(c[0] - d * 0.05, c[1] + d * 0.62, r * 0.95, rnd)]; },
    star:function(c, R, rnd){ return MOTIFS.rosette(c, R, rnd, 6); },
    quatrefoil:function(c, R){ return [polar(c, function(a){ return R * (0.62 + 0.38 * Math.abs(Math.cos(2 * a))); }, 32), circle(c[0], c[1], R * 0.26)]; },
    circle:function(c, R){ return [circle(c[0], c[1], R)]; },
    square:function(c, R){ return [rect(c[0] - R * 0.8, c[1] - R * 0.8, R * 1.6, R * 1.6, R * 0.25)]; },
    bigdiamond:function(c, R){ return [poly([[c[0], c[1] - R], [c[0] + R, c[1]], [c[0], c[1] + R], [c[0] - R, c[1]]])]; },
    mandala:function(c, R, rnd){ var out = [circle(c[0], c[1], R)], n = 8;
      for (var i = 0; i < n; i++){ var a = i / n * Math.PI * 2; out.push(petal([c[0] + Math.cos(a) * R * 0.32, c[1] + Math.sin(a) * R * 0.32], [c[0] + Math.cos(a) * R * 0.88, c[1] + Math.sin(a) * R * 0.88], R * 0.13)); }
      out.push(circle(c[0], c[1], R * 0.3)); return out; }
  };
  var EARLY_SETS = [["rosette", "rings"], ["diamond", "pebbles"], ["star", "rings"], ["quatrefoil", "diamond"], ["pebbles", "rosette"], ["rings", "star"]];
  var MIDDLE_SETS = [["circle", "circle"], ["bigdiamond", "bigdiamond"], ["square", "circle"], ["circle", "bigdiamond"]];

  /* the border: an outer and inner frame, cells between them, a motif in each */
  function border(fr, b, stage, rnd){
    var items = [], P = function(d, fill, w){ items.push({ d:d, fill:fill || "none", w:w, role:"border" }); };
    var bw = STAGES[stage].border, early = stage === "early";
    var set = early ? EARLY_SETS[Math.floor(rnd() * EARLY_SETS.length)] : MIDDLE_SETS[Math.floor(rnd() * MIDDLE_SETS.length)];
    var x0 = fr.x, y0 = fr.y, x1 = fr.x + fr.w, y1 = fr.y + fr.h;
    P(rect(x0, y0, fr.w, fr.h, early ? 12 : 16), "#fff", bw);
    P(rect(x0 + b, y0 + b, fr.w - 2 * b, fr.h - 2 * b, 0), "#fff", bw);
    var target = b * (early ? 1.12 : 1.55), cells = [];
    // corners
    [[x0, y0], [x1 - b, y0], [x0, y1 - b], [x1 - b, y1 - b]].forEach(function(p){ cells.push({ x:p[0], y:p[1], w:b, h:b, corner:true }); });
    // dividers that close each corner square
    [[x0 + b, y0, x0 + b, y0 + b], [x1 - b, y0, x1 - b, y0 + b], [x0 + b, y1 - b, x0 + b, y1], [x1 - b, y1 - b, x1 - b, y1],
     [x0, y0 + b, x0 + b, y0 + b], [x1 - b, y0 + b, x1, y0 + b], [x0, y1 - b, x0 + b, y1 - b], [x1 - b, y1 - b, x1, y1 - b]].forEach(function(l){ P(line([l[0], l[1]], [l[2], l[3]]), "none", bw); });
    // the long sides, cut into cells
    var horiz = function(y){ var L = fr.w - 2 * b, n = Math.max(1, Math.round(L / target)), s = L / n;
      for (var i = 0; i < n; i++){ cells.push({ x:x0 + b + i * s, y:y, w:s, h:b, i:i }); if (i) P(line([x0 + b + i * s, y], [x0 + b + i * s, y + b]), "none", bw); } };
    var vert = function(x){ var L = fr.h - 2 * b, n = Math.max(1, Math.round(L / target)), s = L / n;
      for (var i = 0; i < n; i++){ cells.push({ x:x, y:y0 + b + i * s, w:b, h:s, i:i }); if (i) P(line([x, y0 + b + i * s], [x + b, y0 + b + i * s]), "none", bw); } };
    horiz(y0); horiz(y1 - b); vert(x0); vert(x1 - b);
    var clear = Math.max(5, bw * 1.6);
    cells.forEach(function(c){
      var R = Math.min(c.w, c.h) / 2 - clear, cc = [c.x + c.w / 2, c.y + c.h / 2];
      if (R < 6) return;
      var kind = c.corner ? (early ? "mandala" : "circle") : set[(c.i || 0) % 2];
      MOTIFS[kind](cc, R, rnd).forEach(function(d){ P(d, "#fff", bw); });
    });
    return { items:items, pattern:set.join("+") };
  }

  /* ---------- words on the page ---------- */
  /* Text is laid out by an estimate of its width (generous, so it never
     runs over), then drawn by each renderer in Atkinson Hyperlegible. */
  function wrap(text, size, maxW, bold){
    var per = size * (bold ? 0.6 : 0.55), max = Math.max(4, Math.floor(maxW / per)), words = String(text).split(/\s+/), lines = [], cur = "";
    words.forEach(function(w){ var t = cur ? cur + " " + w : w; if (t.length <= max || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    return lines;
  }
  function fitSize(text, size, maxW, bold, min){ var per = bold ? 0.62 : 0.56; while (size > (min || 10) && String(text).length * size * per > maxW) size -= 1; return size; }

  /* ---------- the page ---------- */
  function code(stage, id, seed){ return "H" + STAGES[stage].key + "-" + id + "-" + (seed >>> 0).toString(36).toUpperCase(); }
  function parseCode(c){
    var m = /^H([EML])-([a-z0-9_]+)-([0-9A-Z]+)$/i.exec(String(c || "").trim());
    if (!m) return null;
    var stage = { E:"early", M:"middle", L:"late" }[m[1].toUpperCase()];
    return { stage:stage, id:m[2].toLowerCase(), seed:parseInt(m[3], 36) >>> 0 };
  }

  /* compose({ asset, paths, stage, seed, name, prompt, frame, header, footer })
     paths: the subject's [d, fill, detail] in the 800 x 600 box.
     frame {x, y, w, h} in points: lay the page out inside this box, for a
     host page that has its own heading (the packet tool) or a binding
     gutter (the coloring library); the whole Letter page inside its
     0.5 in margins when left out. header false: no name line and no title
     (the host prints them). footer false: no footer line. */
  function compose(o){
    var stage = stageOf(o.stage), S = STAGES[stage], a = o.asset, seed = (o.seed >>> 0) || 1, rnd = rng(seed);
    if (!a || !o.paths || !o.paths.length) throw new Error("No subject to draw.");
    var M = PAGE.margin, W = PAGE.w, H = PAGE.h;
    var F = o.frame || { x:M, y:M, w:W - 2 * M, h:H - 2 * M };
    var X0 = F.x, inner = F.w, bottom = F.y + F.h, cx = X0 + inner / 2;
    var header = o.header !== false, footer = o.footer !== false, foot = footer ? 26 : 4;
    var page = { w:W, h:H, stage:stage, frame:{ x:F.x, y:F.y, w:F.w, h:F.h }, items:[], texts:[],
      meta:{ id:a.id, title:a.title, category:a.category, seed:seed, code:code(stage, a.id, seed), stage:stage, engine:VERSION } };
    var T = function(text, x, y, size, bold, align, role){ page.texts.push({ text:String(text), x:x, y:y, size:size, bold:!!bold, align:align || "center", role:role || "text" }); };
    var y = F.y, subjectBox;
    var name = header ? String(o.name || "").trim() : "";
    // the subject's own shape, so a wide car gets a frame that fits it
    var keep = o.paths.filter(function(p){ return !(stage === "late" && p[2]); });
    var segsAll = keep.map(function(p){ return parse(p[0]); }), bb = [Infinity, Infinity, -Infinity, -Infinity];
    segsAll.forEach(function(s){ box(s, bb); });
    var aspect = (bb[2] - bb[0]) / Math.max(1, bb[3] - bb[1]);
    if (stage === "late"){
      // the name, a large banner, then the picture as big as the page allows
      if (name) { T("Prepared especially for " + name, cx, y + 12, 12, false, "center", "for"); y += 20; }
      var banner = String(a.banner || a.title).toUpperCase(), bh = Math.min(96, Math.max(64, F.h * 0.13)), size = fitSize(banner, Math.min(64, bh - 32), inner - 48, true, 30);
      page.items.push({ d:rect(X0, y, inner, bh, 18), fill:"#fff", w:S.border, role:"banner" });
      T(banner, cx, y + bh / 2 + size * 0.36, size, true, "center", "banner");
      y += bh + 22;
      subjectBox = { x:X0 + 6, y:y, w:inner - 12, h:bottom - foot - y };
    } else {
      if (name) { T("Prepared especially for " + name, cx, y + 12, 12, false, "center", "for"); y += 20; }
      if (header){
        var tsize = fitSize(a.title, stage === "early" ? 24 : 28, inner, true, 16);
        T(a.title, cx, y + tsize * 0.85, tsize, true, "center", "title"); y += tsize + 12;
      }
      var wide = aspect > 1.6, below = stage === "early" ? 64 : 84, avail = bottom - foot - below - y;
      var b = stage === "early" ? (wide ? 40 : 46) : (wide ? 46 : 52), padIn = stage === "early" ? 14 : 16, ring = 2 * (b + padIn);
      if (inner < 460){ b = Math.round(b * 0.86); padIn = Math.round(padIn * 0.86); ring = 2 * (b + padIn); }   // a narrow frame keeps more room for the picture
      var want = (inner - ring) / aspect * 1.55 + ring;               // a wide subject gets a frame that suits it, with room to breathe
      var fh = Math.max(Math.min(avail, ring + 150), Math.min(avail, want));
      y += (avail - fh) / 2;                                        // the frame and its words sit in the middle of the space
      var fr = { x:X0, y:y, w:inner, h:fh };
      var br = border(fr, b, stage, rnd); br.items.forEach(function(it){ page.items.push(it); }); page.meta.pattern = br.pattern;
      subjectBox = { x:fr.x + b + padIn, y:fr.y + b + padIn, w:fr.w - 2 * (b + padIn), h:fr.h - 2 * (b + padIn) };
      var ty = fr.y + fr.h + 26;
      if (stage === "early"){
        var prompt = o.prompt || a.prompt || "Color it any way you like. What does it bring to mind?";
        wrap(prompt, 16, inner, false).slice(0, 2).forEach(function(l, i){ T(l, cx, ty + i * 21, 16, false, "center", "prompt"); });
      } else {
        // the completion line, with the word to write shown beside it
        var lead = a.completion || ("Here is a" + (/^[aeiou]/i.test(a.word || "") ? "n" : ""));
        var lsize = fitSize(lead + " ____________", 22, inner, true, 16);
        T(lead + " ____________", cx, ty + 4, lsize, true, "center", "completion");
        T("The word to write on the line: " + (a.word || a.title.toLowerCase()), cx, ty + 34, 15, false, "center", "word");
      }
    }
    // Layer 1: the subject, fitted and centered; lines set in points after scaling
    var half = S.line / 2 + 1, bw = bb[2] - bb[0], bhh = bb[3] - bb[1];
    var k = Math.min((subjectBox.w - 2 * half) / bw, (subjectBox.h - 2 * half) / bhh);
    var dx = subjectBox.x + (subjectBox.w - bw * k) / 2 - bb[0] * k, dy = subjectBox.y + (subjectBox.h - bhh * k) / 2 - bb[1] * k;
    keep.forEach(function(p, i){
      var fill = p[1] === "#000" ? "#000" : p[1] === "#fff" ? "#fff" : "none";
      page.items.push({ d:str(map(segsAll[i], k, dx, dy)), fill:fill, w:p[2] ? S.detail : S.line, role:"subject" });
    });
    page.meta.subjectScale = k;
    // footer: for staff, small
    if (footer){
      T("Cognicopia · " + S.label, X0, bottom - 2, 9, false, "left", "footer");
      T("Page code " + page.meta.code, X0 + inner, bottom - 2, 9, false, "right", "footer");
    }
    return page;
  }

  /* ---------- a mandala: a pattern page with no subject ----------
     Rings of cells drawn from a seed, for the stage. Every cell is closed (circles
     and scalloped rings crossed by straight dividers), every line is the stage's own
     weight, and the page is the same weight of black on white as every other:
       late    four bands of six or eight big cells, the fewest lobes, nothing inside
               a cell: every area to color is a generous shape
       middle  five bands, a petal, dot or diamond in each cell of one of them
       early   six bands and more cells, a pattern in two of them (Zentangle style)
     The same seed draws the same mandala, so a page can be printed again. */
  var MANDALA = {
    early:  { counts:[8, 10, 12], mult:[0, 1, 1, 2, 2, 2], bounds:[0.12, 0.27, 0.43, 0.58, 0.77, 1], amp:[0.10, 0.08, 0.07, 0.06, 0.05, 0], motifs:[2, 4], scallop:0.6 },
    middle: { counts:[6, 8],      mult:[0, 1, 1, 2, 2],    bounds:[0.16, 0.34, 0.56, 0.78, 1],       amp:[0.10, 0.08, 0.06, 0.04, 0],       motifs:[2], scallop:0.5 },
    late:   { counts:[6, 8],      mult:[0, 1, 1, 2],       bounds:[0.20, 0.52, 0.78, 1],             amp:[0.08, 0.10, 0.05, 0],             motifs:[], scallop:0.3 }
  };
  function composeMandala(o){
    o = o || {};
    var stage = stageOf(o.stage), S = STAGES[stage], M = PAGE.margin, seed = (o.seed >>> 0) || 1, rnd = rng(seed), cfg = MANDALA[stage];
    var F = o.frame || { x:M, y:M, w:PAGE.w - 2 * M, h:PAGE.h - 2 * M };
    var cx = F.x + F.w / 2, cy = F.y + F.h / 2, R = Math.min(F.w, F.h) / 2 - S.line / 2 - 3, c = [cx, cy], TAU = Math.PI * 2;
    var N = cfg.counts[Math.floor(rnd() * cfg.counts.length)], n = cfg.mult.map(function(m){ return m * N; });
    var rot = rnd() < 0.5 ? 0 : Math.PI / (2 * N), scallop = rnd() < cfg.scallop;
    var phi = n.map(function(k, i){ return k ? rot + (i % 2 ? Math.PI / k : 0) : rot; });
    var amp = cfg.amp.map(function(a){ return scallop ? a : 0; }), bounds = cfg.bounds, last = bounds.length - 1;
    var rOf = function(i, th){ return bounds[i] * R * (1 + amp[i] * Math.cos((n[i] || n[1]) * (th - phi[i]))); };
    var items = [], i, j;
    var add = function(d, fill){ items.push({ d:d, fill:fill, w:S.line, role:"subject" }); };
    for (i = last; i >= 0; i--) add(i === last && !amp[i] ? circle(cx, cy, bounds[i] * R) : polar(c, (function(k){ return function(a){ return rOf(k, a); }; })(i), 96), "#fff");
    for (i = 1; i <= last; i++) for (j = 0; j < n[i]; j++){
      var th = phi[i] + TAU * j / n[i], r0 = rOf(i - 1, th), r1 = rOf(i, th);
      add(line([cx + Math.cos(th) * r0, cy + Math.sin(th) * r0], [cx + Math.cos(th) * r1, cy + Math.sin(th) * r1]), "none");
    }
    if (cfg.motifs.length) add(circle(cx, cy, 0.45 * bounds[0] * R * (1 - amp[0])), "#fff");
    var styles = ["petal", "dot", "diamond"].sort(function(){ return rnd() - 0.5; });
    cfg.motifs.forEach(function(bi, mi){
      var style = styles[mi % styles.length];
      for (var k = 0; k < n[bi]; k++){
        var a = phi[bi] + TAU * (k + 0.5) / n[bi], ri = rOf(bi - 1, a), ro = rOf(bi, a), rc = (ri + ro) / 2;
        var m = 0.34 * Math.min(ro - ri, rc * TAU / n[bi]), ca = Math.cos(a), sa = Math.sin(a), px = cx + ca * rc, py = cy + sa * rc;
        if (style === "dot") add(circle(px, py, m * 0.9), "#fff");
        else if (style === "diamond") add(poly([[px + ca * m, py + sa * m], [px - sa * m, py + ca * m], [px - ca * m, py - sa * m], [px + sa * m, py - ca * m]]), "#fff");
        else add(petal([cx + ca * (rc - m * 1.1), cy + sa * (rc - m * 1.1)], [cx + ca * (rc + m * 1.1), cy + sa * (rc + m * 1.1)], m * 0.55), "#fff");
      }
    });
    var page = { w:PAGE.w, h:PAGE.h, stage:stage, frame:{ x:F.x, y:F.y, w:F.w, h:F.h }, items:items, texts:[],
      meta:{ id:"mandala", title:"Mandala", category:"mandala", seed:seed, code:code(stage, "mandala", seed), stage:stage, engine:VERSION, pattern:N + (scallop ? "-scalloped" : "-round") } };
    if (o.footer) page.texts.push({ text:"Cognicopia · " + S.label + " · Page code " + page.meta.code, x:F.x, y:F.y + F.h - 2, size:9, bold:false, align:"left", role:"footer" });
    return page;
  }

  /* ---------- the rules, checked ---------- */
  function validate(page){
    var S = STAGES[page.stage], problems = [], F = page.frame;
    page.items.forEach(function(it, i){
      if (!(it.w >= S.min - 1e-9)) problems.push("line " + i + " (" + it.role + ") is " + it.w + " pt, under the " + S.min + " pt floor");
      if (["#fff", "#000", "none"].indexOf(it.fill) < 0) problems.push("line " + i + " has the fill " + it.fill);
      var b = box(parse(it.d));
      if (b[0] < PAGE.margin - it.w || b[2] > PAGE.w - PAGE.margin + it.w || b[1] < PAGE.margin - it.w || b[3] > PAGE.h - PAGE.margin + it.w) problems.push("line " + i + " (" + it.role + ") leaves the printable area");
      else if (F && (b[0] < F.x - it.w || b[2] > F.x + F.w + it.w || b[1] < F.y - it.w || b[3] > F.y + F.h + it.w)) problems.push("line " + i + " (" + it.role + ") leaves the space it was given");
    });
    page.texts.forEach(function(t){ if (t.role !== "footer" && t.size < 12) problems.push("the " + t.role + " text is under 12 pt"); });
    if (page.stage === "late" && page.items.some(function(it){ return it.role === "border"; })) problems.push("the late stage has a border");
    return problems;
  }

  /* ---------- renderers ---------- */
  function esc(s){ return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function toSVG(page, o){
    o = o || {};
    var w = o.width ? ' width="' + esc(o.width) + '"' : "", h = o.height ? ' height="' + esc(o.height) + '"' : "";
    var body = page.items.map(function(it){ return '<path d="' + it.d + '" fill="' + (it.fill === "none" ? "none" : it.fill) + '" stroke="#000" stroke-width="' + it.w + '" stroke-linecap="round" stroke-linejoin="round"/>'; }).join("");
    var text = (o.text === false ? [] : page.texts).map(function(t){
      return '<text x="' + f2(t.x) + '" y="' + f2(t.y) + '" font-family=\'' + FONT + '\' font-size="' + t.size + '" font-weight="' + (t.bold ? 700 : 400) + '" text-anchor="' + (t.align === "left" ? "start" : t.align === "right" ? "end" : "middle") + '" fill="#000">' + esc(t.text) + "</text>";
    }).join("");
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + page.w + " " + page.h + '"' + w + h + ' role="img" aria-label="' + esc(page.meta.title + ", a page to color") + '"><rect width="' + page.w + '" height="' + page.h + '" fill="#fff"/>' + body + text + "</svg>";
  }
  /* screen preview, or a print-ready image: dpi 300 gives 2550 x 3300.
     A print-ready image (200 dpi or more, or o.pure) is made pure black and
     white afterwards: the soft gray edge pixels a screen uses to smooth
     lines become black or white, so nothing prints gray. */
  function toCanvas(page, canvas, o){
    o = o || {};
    var dpi = o.dpi || 300, k = dpi / 72, pure = o.pure != null ? !!o.pure : dpi >= 200;
    canvas.width = Math.round(page.w * k); canvas.height = Math.round(page.h * k);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, page.w, page.h);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#000";
    page.items.forEach(function(it){
      var p = new Path2D(it.d);
      if (it.fill !== "none"){ ctx.fillStyle = it.fill; ctx.fill(p); }
      ctx.lineWidth = it.w; ctx.stroke(p);
    });
    ctx.fillStyle = "#000"; ctx.textBaseline = "alphabetic";
    page.texts.forEach(function(t){
      var size = t.size, max = page.frame ? page.frame.w : page.w - 2 * PAGE.margin;
      ctx.font = (t.bold ? "700 " : "400 ") + size + "px " + FONT;
      while (size > 8 && ctx.measureText(t.text).width > max){ size -= 1; ctx.font = (t.bold ? "700 " : "400 ") + size + "px " + FONT; }
      ctx.textAlign = t.align === "left" ? "left" : t.align === "right" ? "right" : "center";
      ctx.fillText(t.text, t.x, t.y);
    });
    if (pure && ctx.getImageData){
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      var img = ctx.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
      for (var i = 0; i < d.length; i += 4){ var v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 < 160 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      ctx.putImageData(img, 0, 0);
    }
    return canvas;
  }
  /* vector PDF through jsPDF (or the build scripts' writer); x, y, w place the page */
  function toPDF(page, doc, o){
    o = o || {};
    var x = o.x || 0, y = o.y || 0, w = o.w || page.w, k = w / page.w;
    var m = function(p){ return [x + p[0] * k, y + p[1] * k]; };
    doc.setDrawColor(0, 0, 0);
    if (doc.setLineCap) doc.setLineCap("round");
    if (doc.setLineJoin) doc.setLineJoin("round");
    page.items.forEach(function(it){
      doc.setLineWidth(it.w * k);
      if (it.fill === "#000") doc.setFillColor(0, 0, 0); else doc.setFillColor(255, 255, 255);
      parse(it.d).forEach(function(s){
        if (s.op === "M"){ var a = m(s.p); doc.moveTo(a[0], a[1]); }
        else if (s.op === "L"){ var b = m(s.p); doc.lineTo(b[0], b[1]); }
        else if (s.op === "C"){ var c1 = m(s.c1), c2 = m(s.c2), p = m(s.p); doc.curveTo(c1[0], c1[1], c2[0], c2[1], p[0], p[1]); }
        else doc.close();
      });
      if (it.fill === "none") doc.stroke(); else doc.fillStroke();
    });
    doc.setFillColor(255, 255, 255);
    if (doc.setTextColor) doc.setTextColor(0, 0, 0);
    page.texts.forEach(function(t){
      var size = t.size * k, max = (page.frame ? page.frame.w : page.w - 2 * PAGE.margin) * k;
      doc.setFont(o.font || "helvetica", t.bold ? "bold" : "normal"); doc.setFontSize(size);
      if (doc.getTextWidth) while (size > 7 && doc.getTextWidth(t.text) > max){ size -= 0.5; doc.setFontSize(size); }
      doc.text(t.text, x + t.x * k, y + t.y * k, { align:t.align });
    });
    return doc;
  }

  /* ---------- subjects ---------- */
  var cache = {};
  function pathsFromSvg(text){
    var out = [], re = /<path\s+d="([^"]*)"\s+fill="([^"]*)"[^>]*?(data-detail="1")?\s*\/>/g, m;
    while ((m = re.exec(text))) out.push([m[1], m[2], m[3] ? 1 : 0]);
    return out;
  }
  function subjectPathsSync(id){ if (cache[id]) return cache[id]; var p = manifest().paths(id); if (p) cache[id] = p; return p || null; }
  /* from the bundle, or this site's own file (cached for the session) */
  function subjectPaths(id){
    var p = subjectPathsSync(id); if (p) return Promise.resolve(p);
    var a = manifest().get(id); if (!a) return Promise.reject(new Error("No coloring subject named " + id));
    if (typeof fetch !== "function") return Promise.reject(new Error("The subject " + id + " is not loaded."));
    return fetch(a.filePath).then(function(r){ if (!r.ok) throw new Error("The subject " + id + " could not be read."); return r.text(); })
      .then(function(t){ var ps = pathsFromSvg(t); if (!ps.length) throw new Error("The subject " + id + " has nothing to draw."); cache[id] = ps; return ps; });
  }

  /* ---------- one call: choose, compose, draw ---------- */
  function plan(profile, o){
    o = o || {}; profile = profile || {};
    var M = manifest(), stage = stageOf(o.stage || profile.stage), seed = o.seed != null ? (o.seed >>> 0) : M.hashSeed(JSON.stringify([profile.name, profile.born, profile.hobbies, profile.job, o.salt || Date.now()]));
    var c = o.code ? parseCode(o.code) : null;
    if (c){ stage = c.stage; seed = c.seed; }
    var sel = c || o.subjectId ? { asset:M.get(c ? c.id : o.subjectId), fallback:"chosen" } : M.select(Object.assign({}, profile, { stage:stage }), { seed:seed, exclude:o.exclude, category:o.category, filter:o.filter });
    if (!sel || !sel.asset) throw new Error("No coloring subject could be found.");
    return { stage:stage, seed:seed, selection:sel, asset:sel.asset };
  }
  function composeFor(profile, o){
    var p = plan(profile, o), paths = subjectPathsSync(p.asset.id);
    if (!paths) throw new Error("The subject " + p.asset.id + " is not loaded on this page.");
    o = o || {};
    var page = compose({ asset:p.asset, paths:paths, stage:p.stage, seed:p.seed, name:(profile || {}).name, prompt:o.prompt, frame:o.frame, header:o.header, footer:o.footer });
    page.meta.selection = { fallback:p.selection.fallback, matched:p.selection.matched || [], score:p.selection.score || 0 };
    return page;
  }
  function draw(page, target, o){
    if (!target || target === "svg") return toSVG(page, o);
    if (typeof target.getContext === "function") return toCanvas(page, target, o);
    if (typeof target.moveTo === "function" && typeof target.setLineWidth === "function") return toPDF(page, target, o);
    if (typeof target.innerHTML === "string" || "innerHTML" in target){ target.innerHTML = toSVG(page, Object.assign({ width:"100%" }, o)); return target; }
    throw new Error("The coloring page cannot be drawn on that target.");
  }
  /* renderHybridPage(residentProfile, target[, options]): a Promise of { page, output }.
     target: a <canvas> (300 DPI unless options.dpi), a jsPDF document
     (options.x, y, w place the page), an element (an SVG is put in it),
     or nothing for an SVG string. */
  function renderHybridPage(profile, target, o){
    o = o || {};
    return Promise.resolve().then(function(){ return manifest().load(o.base); }).then(function(){
      var p = plan(profile, o);
      return subjectPaths(p.asset.id).then(function(paths){
        var page = compose({ asset:p.asset, paths:paths, stage:p.stage, seed:p.seed, name:(profile || {}).name, prompt:o.prompt, frame:o.frame, header:o.header, footer:o.footer });
        page.meta.selection = { fallback:p.selection.fallback, matched:p.selection.matched || [], score:p.selection.score || 0 };
        return { page:page, output:draw(page, target, o) };
      });
    });
  }

  return { VERSION:VERSION, PAGE:PAGE, STAGES:STAGES, stageOf:stageOf, compose:compose, composeMandala:composeMandala, composeFor:composeFor, plan:plan, validate:validate,
    toSVG:toSVG, toCanvas:toCanvas, toPDF:toPDF, draw:draw, renderHybridPage:renderHybridPage, subjectPaths:subjectPaths, subjectPathsSync:subjectPathsSync,
    pathsFromSvg:pathsFromSvg, code:code, parseCode:parseCode, parse:parse, box:box, MOTIFS:MOTIFS };
});
