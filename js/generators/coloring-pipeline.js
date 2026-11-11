/* =====================================================================
   Coloring pipeline: every Activity Page Studio sheet on a 3:4 page.

   A page is a list of plain drawing operations (rect, circle, line, path,
   text) on a 1200 x 1600 virtual canvas. That is exactly 3:4, and it is
   exactly the printable area of a US Letter sheet inside 0.5 in margins
   (7.5 x 10 in, 160 px to the inch). Two writers turn the same list into
   pictures: toSVG (the live preview and the printed page) and toCanvas
   (the PNG and the PDF), so what staff see is what prints.

   Lines are set in printed points and converted once (1 pt = 160/72 px):
     stage 1  3 pt    stage 2  4.5 pt    stage 3  6 pt
   plus the dexterity allowance (0, 1.5 or 3 pt). So the thinnest line on
   any page is about 6.7 px on the canvas, above the 4 to 6 px floor, and
   the standards in docs/cognicopia-coloring-standards.md (3 pt and up).
   Everything is pure black on white: fills are white or black, nothing
   gray, no gradient, no shading.

   Coloring pages are not drawn from words. The drawing is one of the
   finished pictures in assets/coloring (the owner's rule: no subject is
   drawn in code, and no picture service is called). Words choose among
   them (src/engine/DescribeCreate.js); a style (Cozy-Spooky, Vintage
   Americana, Botanical Gardens, Classic Animals, Simple Architecture,
   Kitchen & Baking) is a hand-made short list of the library.

   Layouts:  full      one idea per page
             cards4    four cards, 2 x 2 (cut along the dashed lines)
             cards6    six cards, 2 x 3
             cards8    eight wide cards, 2 x 4, each turned sideways on the upright sheet
             strips    five wide tickets across the sheet, to turn sideways
   Pages that are not made of cards (matching, sorting, the path, the
   coloring picture) are always full pages.

   Works in the browser (window.CognicopiaColoringPipeline) and in Node.
   No network, no storage.
   ===================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CognicopiaColoringPipeline = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";
  var VERSION = "1.0.0";
  var W = 1200, H = 1600, PT = 160 / 72, PAD = 48;
  var FONT = '"Atkinson Hyperlegible", Arial, Helvetica, sans-serif';
  /* hand-lettered name styles (local open-licence fonts in /fonts); "plain" is the interface type */
  /* the letter grid is set in the monospaced cut of the same accessible face, so every column lines up */
  var GRID_FONT = '"Atkinson Hyperlegible Mono", "Atkinson Hyperlegible", monospace';
  var SCRIPTS = {
    flow:   { label: "Flowing script", family: '"Pinyon Script", "Brush Script MT", cursive', k: 2.8, width: 0.55 },
    formal: { label: "Formal script",  family: '"Marck Script", "Segoe Script", cursive',     k: 2.5, width: 0.55 }
  };
  var BOX = { w: 800, h: 600 };                                 // the box every library drawing is made in
  var LINE_PT = { 1: 3, 2: 4.5, 3: 6 };                         // main line, in printed points
  var DEX_PT = { steady: 0, limited: 1.5, minimal: 3 };
  var DEX_FONT = { steady: 1, limited: 1.15, minimal: 1.3 };
  var BASE_PT = { 1: 20, 2: 24, 3: 32 };                        // body type
  var FLOOR_PT = { 1: 18, 2: 20, 3: 24 };                       // the smallest type a stage may use
  var TITLE_MIN = 72;                                           // a page title: 32 pt or more at every stage (32 pt is 71.1 px)
  var GROW_MAX = { 1: 2.2, 2: 2.2, 3: 2.2 };                    // how far a card's type may grow to fill the room it has
  var CALM_WHITE = { 1: 0.50, 2: 0.50, 3: 0.55 };               // the share of a page of words that stays empty, by stage (the facility validator's numbers)
  var BLANK_MAX = 420;                                          // the tallest band a page may leave empty (2.6 in): more reads as unfinished
  var STAGE_NAME = { 1: "early", 2: "middle", 3: "late" };
  var LAYOUTS = [
    { id: "full",   label: "One full page",        cols: 1, rows: 1, per: 1 },
    { id: "cards4", label: "Four cards (2 by 2)",  cols: 2, rows: 2, per: 4 },
    { id: "cards6", label: "Six cards (2 by 3)",   cols: 2, rows: 3, per: 6 },
    { id: "cards8", label: "Eight sideways cards (2 by 4)", cols: 2, rows: 4, per: 8 },
    { id: "strips", label: "Five wide tickets (sideways)",  cols: 1, rows: 5, per: 5 }
  ];
  var STYLES = [
    { id: "cozy",         label: "Cozy-Spooky (gentle harvest)", ids: ["pumpkin", "owl", "oil_lantern", "sitting_cat", "rocking_chair", "oak_tree"],
      note: "Friendly pumpkin, owl and lantern. Nothing frightening, as care guidance asks." },
    { id: "americana",    label: "Vintage Americana", ids: ["1950s_pickup_truck", "1957_family_sedan", "farm_tractor", "steam_locomotive", "jukebox", "cathedral_radio", "rotary_telephone", "biplane"], note: "" },
    { id: "botanical",    label: "Botanical Gardens", ids: ["daisy", "garden_rose", "sunflower", "tulip", "butterfly", "hummingbird", "watering_can", "birdhouse"], note: "" },
    { id: "animals",      label: "Classic Animals", ids: ["horse", "sitting_cat", "sitting_dog", "rooster", "owl", "cardinal"], note: "" },
    { id: "architecture", label: "Simple Architecture", ids: ["birdhouse", "grandfather_clock", "rocking_chair", "oil_lantern"],
      note: "The library has no buildings yet; these are the porch and parlor pieces nearest to it. New drawings join through the owner's art tool." },
    { id: "kitchen",      label: "Kitchen & Baking Nostalgia", ids: ["teapot", "teacup", "pumpkin"],
      note: "Three kitchen drawings so far; more join through the owner's art tool." }
  ];

  /* ---------- small helpers ---------- */
  var f1 = function (n) { return Math.round(n * 10) / 10; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function stageN(s) { if (s === "early") return 1; if (s === "middle") return 2; if (s === "late") return 3; s = Math.round(Number(s)); return s >= 1 && s <= 3 ? s : 2; }
  /* the main line for a stage, in canvas px */
  function strokeFor(stage, dex) { return f1((LINE_PT[stageN(stage)] + (DEX_PT[dex] || 0)) * PT); }
  function bodyPx(stage, dex) { var n = stageN(stage); return Math.round(BASE_PT[n] * (DEX_FONT[dex] || 1) * PT); }
  function floorPx(stage) { return Math.round(FLOOR_PT[stageN(stage)] * PT); }

  /* text is laid out by an estimate of its width (generous, so it never runs over) */
  function wrap(str, size, maxW, bold) {
    var per = size * (bold ? 0.6 : 0.55), max = Math.max(3, Math.floor(maxW / per)), words = String(str).split(/\s+/).filter(Boolean), lines = [], cur = "";
    words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (t.length <= max || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    return lines;
  }
  /* the largest size (down to min) at which the text fits the box; overflow true when even min does not */
  function fit(str, size, min, maxW, maxH, bold, lh) {
    lh = lh || 1.22;
    var s = size, lines;
    for (;;) {
      lines = wrap(str, s, maxW, bold);
      var widest = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 0);
      if ((lines.length * s * lh <= maxH && widest * s * (bold ? 0.6 : 0.55) <= maxW + 1) || s <= min) break;
      s = Math.max(min, s - 2);
    }
    var w2 = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 0);
    return { size: s, lines: lines, h: lines.length * s * lh, lh: lh, overflow: lines.length * s * lh > maxH || w2 * s * (bold ? 0.6 : 0.55) > maxW + 1 };
  }

  /* ---------- the page and its operations ---------- */
  function newPage(meta) { return { w: W, h: H, ops: [], meta: meta || {} }; }
  var P = {
    rect: function (pg, x, y, w, h, r, sw, fill, dash) { pg.ops.push({ t: "rect", x: f1(x), y: f1(y), w: f1(w), h: f1(h), r: r || 0, sw: sw, fill: fill || "none", dash: dash || "" }); },
    circle: function (pg, cx, cy, r, sw, fill) { pg.ops.push({ t: "circle", cx: f1(cx), cy: f1(cy), r: f1(r), sw: sw, fill: fill || "none" }); },
    line: function (pg, x1, y1, x2, y2, sw, dash, role) { pg.ops.push({ t: "line", x1: f1(x1), y1: f1(y1), x2: f1(x2), y2: f1(y2), sw: sw, dash: dash || "", role: role || "" }); },
    path: function (pg, d, sw, fill, stroke, tx, ty, k) { pg.ops.push({ t: "path", d: d, sw: f1(sw), fill: fill || "none", stroke: stroke || "#000", tx: f1(tx || 0), ty: f1(ty || 0), k: k || 1 }); },
    /* a photograph (a data address made on this computer from a resident's sealed picture), cropped to fill its box */
    image: function (pg, x, y, w, h, src) { pg.ops.push({ t: "image", x: f1(x), y: f1(y), w: f1(w), h: f1(h), src: String(src) }); },
    text: function (pg, x, y, size, str, o) { o = o || {}; pg.ops.push({ t: "text", x: f1(x), y: f1(y), size: Math.round(size), str: String(str), bold: !!o.bold, anchor: o.anchor || "start", role: o.role || "", font: o.font || "" }); }
  };
  /* lines of text; returns the y below the block */
  function block(pg, lines, x, y, size, o) {
    o = o || {};
    var lh = o.lh || 1.22;
    lines.forEach(function (l, i) { P.text(pg, x, y + size * 0.82 + i * size * lh, size, l, { bold: o.bold, anchor: o.anchor, role: o.role }); });
    return y + lines.length * size * lh;
  }
  /* the quiet line at the foot of every sheet: the page code, so any page can be made again */
  function footer(pg, code) { if (code) P.text(pg, W / 2, H - 30, 30, code, { anchor: "middle", role: "code" }); }
  /* the resident's name, hand-lettered under the title; returns the y below it. style: "flow", "formal" or plain */
  function nameplate(pg, name, style, n, y) {
    var sc = SCRIPTS[style];
    if (!sc) return block(pg, ["For " + name], W / 2, y, floorPx(n), { anchor: "middle", bold: true });
    var lab = floorPx(n), size = Math.round(lab * sc.k);
    while (size > lab && String(name).length * size * sc.width > W - PAD * 2) size -= 2;
    y = block(pg, ["Prepared with care for"], W / 2, y, lab, { anchor: "middle" });
    P.text(pg, W / 2, y + size * 0.85, size, name, { anchor: "middle", font: style, role: "nameplate" });
    return y + size * 1.15;
  }
  function header(pg, sh, big) {
    var n = stageN(sh.stage), bp = bodyPx(n, sh.dexterity), y = PAD;
    var t = fit(sh.title, big || 92, TITLE_MIN, W - PAD * 2, 250, true, 1.12);   // a page title is never under 32 pt
    y = block(pg, t.lines, W / 2, y, t.size, { bold: true, anchor: "middle", lh: 1.12, role: "title" });
    if (sh.subtitle) { var s = fit(sh.subtitle, Math.round(bp * 0.9), floorPx(n), W - PAD * 2, 120, false); y = block(pg, s.lines, W / 2, y + 8, s.size, { anchor: "middle" }); }
    if (sh.name) y = nameplate(pg, sh.name, sh.nameStyle, n, y + 6);
    return y + 16;
  }

  /* ---------- the library drawings ---------- */
  function manifest() {
    if (root.CognicopiaColoringManifest) return root.CognicopiaColoringManifest;
    if (typeof require === "function") { try { return require("../../src/services/ColoringManifest.js"); } catch (e) { /* not loaded */ } }
    return null;
  }
  function subjectPaths(id) { var m = manifest(); return m && id ? (m.paths(id) || null) : null; }
  /* the drawing laid inside a rectangle, its lines set to `linePx` after scaling; stage 3 leaves the fine detail out */
  function subjectOps(pg, paths, rect, linePx, n) {
    var k = Math.min(rect.w / BOX.w, rect.h / BOX.h), tx = rect.x + (rect.w - BOX.w * k) / 2, ty = rect.y + (rect.h - BOX.h * k) / 2;
    paths.forEach(function (p) {
      if (p[2] && n === 3) return;
      var fill = p[1] === "#000" || p[1] === "#000000" || p[1] === "black" ? "#000" : (p[1] === "none" ? "none" : "#fff");
      P.path(pg, p[0], (p[2] ? Math.max(6.2, linePx * 0.8) : linePx) / k, fill, "#000", tx, ty, k);
    });
    (pg.meta.ink = pg.meta.ink || []).push([f1(ty), f1(ty + BOX.h * k)]);
    return { x: tx, y: ty, w: BOX.w * k, h: BOX.h * k, k: k };
  }

  /* ---------- choosing a drawing ---------- */
  function styleById(id) { return STYLES.filter(function (s) { return s.id === id; })[0] || STYLES[0]; }
  /* { asset, why } for a style and/or words. Words go through the Describe engine when it is on the page. */
  function chooseSubject(o) {
    o = o || {};
    var m = manifest(), stage = STAGE_NAME[stageN(o.stage)], avoid = o.avoid || [];
    if (!m) return { asset: null, why: "The drawings are not loaded on this page." };
    var D = root.CognicopiaDescribe;
    if (o.text && String(o.text).trim() && D) {
      var c = D.choose(o.text, { stage: stage, avoid: avoid, variant: o.variant || 0 });
      if (c.ok) return { asset: c.asset, why: D.explain(c), words: true };
      return { asset: null, why: D.explain(c) };
    }
    var st = styleById(o.style), pool = st.ids.map(function (id) { return m.get(id); }).filter(function (a) {
      return a && (!a.dementiaStageCompatibility || a.dementiaStageCompatibility.indexOf(stage) >= 0) && !(m.avoided && m.avoided(a, avoid));
    });
    if (!pool.length) return { asset: null, why: "Every drawing in this style is on the list of topics to avoid." };
    var asset = pool[((o.seed >>> 0) + (o.variant || 0)) % pool.length];
    return { asset: asset, why: st.note || ("From the " + st.label + " set: " + asset.title + "."), style: st.id };
  }

  /* ---------- a coloring page ---------- */
  function composeColoring(asset, paths, o) {
    o = o || {};
    var n = stageN(o.stage), dex = o.dexterity || "steady", lw = strokeFor(n, dex);
    var pg = newPage({ kind: "coloring", sheetKind: "coloring", title: asset.title, stage: n, code: o.code || "", subject: asset.id });
    if (n < 3) P.rect(pg, 30, 30, W - 60, H - 120, 28, lw, "none");   // the frame stops above the page code
    var tsize = n === 3 ? 124 : 96, banner = String(asset.banner || asset.title).toUpperCase();
    var t = fit(banner, tsize, 64, W - 200, 150, true, 1.1);
    block(pg, t.lines, W / 2, 96, t.size, { bold: true, anchor: "middle", lh: 1.1 });
    var box = { x: 80, y: 330, w: 1040, h: 780 };
    subjectOps(pg, paths, box, lw, n);
    if (n === 1 && asset.prompt) { var q = fit(asset.prompt, bodyPx(1, dex), floorPx(1), W - 220, 180, false); block(pg, q.lines, W / 2, 1230, q.size, { anchor: "middle" }); }
    if (n === 2 && asset.completion) {
      var c = fit(asset.completion + " ______", bodyPx(2, dex), floorPx(2), W - 220, 170, true); block(pg, c.lines, W / 2, 1230, c.size, { anchor: "middle", bold: true });
      P.text(pg, W / 2, 1405, floorPx(2), "Word to write: " + String(asset.word || asset.title).toUpperCase(), { anchor: "middle" });
    }
    if (o.name) {
      var sc = SCRIPTS[o.nameStyle], by = n < 3 ? 1470 : 1520;
      if (!sc) P.text(pg, W / 2, by, floorPx(n), "For " + o.name, { anchor: "middle", bold: true });
      else {
        var lab = floorPx(n), size = Math.round(lab * sc.k);
        while (size > lab && String(o.name).length * size * sc.width > W - 200) size -= 2;
        P.text(pg, W / 2, by - size * 0.55, lab, "Prepared with care for", { anchor: "middle" });
        P.text(pg, W / 2, by + size * 0.45, size, o.name, { anchor: "middle", font: o.nameStyle, role: "nameplate" });
      }
    }
    footer(pg, o.code);
    return pg;
  }

  /* ---------- cards and tickets ---------- */
  function cellsFor(layout) {
    var L = LAYOUTS.filter(function (x) { return x.id === layout; })[0] || LAYOUTS[0], gap = 40, m = 36;
    var cw = (W - 2 * m - gap * (L.cols - 1)) / L.cols, ch = (H - 2 * m - gap * (L.rows - 1) - (L.per > 1 ? 24 : 0)) / L.rows, cells = [];
    for (var r = 0; r < L.rows; r++) for (var c = 0; c < L.cols; c++) cells.push({ x: m + c * (cw + gap), y: m + r * (ch + gap), w: cw, h: ch });
    return { L: L, cells: cells, gap: gap };
  }
  /* one card inside a cell: { tag, badge, head, lines[] } */
  function drawCard(pg, card, cell, n, dex, lw) {
    P.rect(pg, cell.x, cell.y, cell.w, cell.h, 26, lw, "none");
    var x = cell.x + 34, y = cell.y + 28, iw = cell.w - 68, ih = cell.h - 56, bp = bodyPx(n, dex), fl = floorPx(n), problems = [];
    var wide = cell.w > cell.h * 1.6;
    if (card.badge) {                                                    // a big step number
      var r = Math.max(fl * 0.7, Math.min(54, ih * 0.16)), ds = Math.max(Math.round(r * 1.15), fl);
      P.circle(pg, x + r, y + r, r, lw, "none");
      P.text(pg, x + r, y + r + ds * 0.36, ds, card.badge, { bold: true, anchor: "middle" });
      x += wide ? r * 2 + 28 : 0; iw -= wide ? r * 2 + 28 : 0;
      if (!wide) y += r * 2 + 18; ih -= wide ? 0 : r * 2 + 18;
    }
    var hs = Math.min(Math.round(bp * 1.15), wide ? 74 : 110);
    /* the small label above the heading goes first when a small card is short of room */
    if (card.tag && !fit(card.head, hs, fl, iw, (ih - fl * 1.3) * (card.lines && card.lines.length ? 0.75 : 1), true).overflow) { P.text(pg, x, y + fl * 0.82, fl, card.tag, { bold: true }); y += fl * 1.3; ih -= fl * 1.3; }
    var head = fit(card.head, hs, fl, iw, ih * (card.lines && card.lines.length ? 0.75 : 1), true);
    y = block(pg, head.lines, x, y, head.size, { bold: true }); ih -= head.h + 10;
    if (head.overflow) problems.push("text does not fit a card");
    (card.lines || []).forEach(function (l) {
      if (ih < fl * 1.3) return;
      var b = fit(l, bp, fl, iw, ih, false);
      if (b.overflow) return;
      y = block(pg, b.lines, x, y + 8, b.size); ih -= b.h + 8;
    });
    return problems;
  }
  function cardPages(cards, layout, sh, code) {
    var G = cellsFor(layout), n = stageN(sh.stage), dex = sh.dexterity || "steady", lw = strokeFor(n, dex), pages = [];
    for (var i = 0; i < cards.length; i += G.L.per) {
      var pg = newPage({ kind: "cards", title: sh.title, stage: n, code: sh.code, layout: layout });
      var chunk = cards.slice(i, i + G.L.per);
      chunk.forEach(function (c, j) { var pr = drawCard(pg, c, G.cells[j], n, dex, lw); if (pr.length) pg.meta.fit = (pg.meta.fit || []).concat(pr); });
      if (G.L.per > 1) {                                                // dashed cut lines between cards
        for (var cc = 1; cc < G.L.cols; cc++) P.line(pg, G.cells[cc].x - G.gap / 2, 14, G.cells[cc].x - G.gap / 2, H - 50, 7, "18 14", "guide");
        for (var rr = 1; rr < G.L.rows; rr++) P.line(pg, 14, G.cells[rr * G.L.cols].y - G.gap / 2, W - 14, G.cells[rr * G.L.cols].y - G.gap / 2, 7, "18 14", "guide");
      }
      footer(pg, sh.code + (cards.length > G.L.per ? " p" + (Math.floor(i / G.L.per) + 1) : ""));
      pages.push(pg);
    }
    return pages;
  }

  /* ---------- full pages for each kind of sheet ---------- */
  function promptsFull(sh) {
    var n = stageN(sh.stage), dex = sh.dexterity || "steady", lw = strokeFor(n, dex), bp = bodyPx(n, dex), fl = floorPx(n), rule = Math.max(7, f1(lw * 0.7));
    /* each idea fills its share of the page: its type grows as far as the page stays calm, the words sit in the middle of their
       room, and on an early or middle page each idea is a framed card with a line or two to write on when there is room */
    return calmest(n, function (grow, extras) {
      var pg = newPage({ kind: "prompts", title: sh.title, stage: n, code: sh.code }), framed = extras && n < 3;
      var y0 = header(pg, sh), items = sh.items, gap = 26, area = H - 76 - y0, bh = (area - gap * (items.length - 1)) / Math.max(1, items.length);
      items.forEach(function (it, i) {
        var y = y0 + i * (bh + gap), pad = framed ? 30 : 10, x = PAD + pad, iw = W - 2 * PAD - pad * 2, ih = bh - pad * 2, lay = null;
        if (framed) P.rect(pg, PAD, y, W - 2 * PAD, bh, 24, lw); else if (i) P.line(pg, PAD, y - gap / 2, W - PAD, y - gap / 2, rule, "", "rule");
        for (var k = grow; k >= 0.59; k -= 0.1) {
          var sz = function (m) { return Math.max(fl, Math.round(bp * m * k)); };                // never under the stage's floor
          var th = fit(it.thing, sz(1.2), fl, iw, ih, true, 1.15), iv = fit(it.invite, sz(1), fl, iw, ih, false), se = it.sense ? fit(it.sense, sz(0.9), fl, iw, ih, false) : null;
          lay = { th: th, iv: iv, se: se, tot: fl * 1.35 + th.h + 8 + iv.h + (se ? se.h + 8 : 0) };
          if (lay.tot <= ih) break;
        }
        if (lay.tot > ih && lay.se) { lay.tot -= lay.se.h + 8; lay.se = null; }               // the sense line is the first to go when the room is small
        var step = fl * 2.4, spare = ih - lay.tot, lines = framed && spare > step * 1.3 ? Math.min(2, Math.floor(spare / step)) : 0;
        var yy = y + pad + Math.max(0, (ih - lay.tot - lines * step) / 2);
        P.text(pg, x, yy + fl * 0.82, fl, it.tag, { bold: true }); yy += fl * 1.35;
        yy = block(pg, lay.th.lines, x, yy, lay.th.size, { bold: true, lh: 1.15 });
        yy = block(pg, lay.iv.lines, x, yy + 8, lay.iv.size);
        if (lay.se) yy = block(pg, lay.se.lines, x, yy + 8, lay.se.size);
        for (var q = 1; q <= lines; q++) P.line(pg, x, yy + q * step, x + iw, yy + q * step, rule, "", "write");
      });
      footer(pg, sh.code);
      return pg;
    });
  }
  function stepsFull(sh) {
    var n = stageN(sh.stage), dex = sh.dexterity || "steady", lw = strokeFor(n, dex), bp = bodyPx(n, dex), fl = floorPx(n);
    var pg = newPage({ kind: "steps", title: sh.title, stage: n, code: sh.code });
    var y0 = header(pg, sh);
    var paths = sh.pic ? subjectPaths(sh.pic) : null;
    if (paths) { var box = subjectOps(pg, paths, { x: 330, y: y0, w: 540, h: 400 }, lw, n); y0 = box.y + box.h + 20; }
    var steps = sh.steps, area = H - (sh.safety ? 190 : 80) - y0, rh = area / steps.length, r = Math.max(fl * 0.7, Math.min(48, rh * 0.3)), ds = Math.max(Math.round(r * 1.1), fl);
    steps.forEach(function (s, i) {
      var cy = y0 + i * rh + rh / 2;
      P.circle(pg, PAD + 30 + r, cy, r, lw, "none");
      P.text(pg, PAD + 30 + r, cy + ds * 0.36, ds, String(s.n), { bold: true, anchor: "middle" });
      var tx = PAD + 30 + r * 2 + 30, t = fit(s.text, Math.round(bp * 1.1), fl, W - tx - PAD, rh - 14, true);
      block(pg, t.lines, tx, cy - t.h / 2, t.size, { bold: true });
    });
    if (sh.safety) { var sf = fit(sh.safety, fl, fl, W - PAD * 2, 90, true); block(pg, sf.lines, W / 2, H - 80 - sf.h, sf.size, { anchor: "middle", bold: true }); }
    footer(pg, sh.code);
    return pg;
  }
  function matchFull(sh) {
    var n = stageN(sh.stage), dex = sh.dexterity || "steady", lw = strokeFor(n, dex), bp = bodyPx(n, dex), fl = floorPx(n);
    var pg = newPage({ kind: "match", title: sh.title, stage: n, code: sh.code });
    var y0 = header(pg, sh), rows = sh.pairs.length, bottom = H - 86, rh = (bottom - y0) / rows, colW = 400, big = Math.round(Math.min(bp * 2.1, Math.max(bp * 1.3, rh * 0.26)));
    /* the two columns stand in their own frames, with the dots to join between them; the words grow with the room each has */
    P.rect(pg, PAD, y0, colW, bottom - y0, 24, lw); P.rect(pg, W - PAD - colW, y0, colW, bottom - y0, 24, lw);
    sh.pairs.forEach(function (p, i) {
      var cy = y0 + i * rh + rh / 2, lw2 = sh.right[i];
      var tw = (colW - 70) * 0.8;                                                     // capitals run wider than the estimate allows for
      var a = fit(p[0].toUpperCase(), big, fl, tw, rh - 24, true), b = fit(lw2.toUpperCase(), big, fl, tw, rh - 24, true);
      block(pg, a.lines, PAD + 30, cy - a.h / 2, a.size, { bold: true });
      block(pg, b.lines, W - PAD - 30, cy - b.h / 2, b.size, { bold: true, anchor: "end" });
      if (i) { P.line(pg, PAD + 20, y0 + i * rh, PAD + colW - 20, y0 + i * rh, Math.max(7, f1(lw * 0.6)), "", "rule"); P.line(pg, W - PAD - colW + 20, y0 + i * rh, W - PAD - 20, y0 + i * rh, Math.max(7, f1(lw * 0.6)), "", "rule"); }
      P.circle(pg, PAD + colW + 46, cy, 22, lw, "none"); P.circle(pg, W - PAD - colW - 46, cy, 22, lw, "none");
    });
    footer(pg, sh.code);
    return pg;
  }
  function sortFull(sh) {
    var n = stageN(sh.stage), dex = sh.dexterity || "steady", lw = strokeFor(n, dex), bp = bodyPx(n, dex), fl = floorPx(n);
    var pg = newPage({ kind: "sort", title: sh.title, stage: n, code: sh.code });
    var y0 = header(pg, sh), boxH = 560, boxY = H - 70 - boxH, cw = (W - 2 * PAD - 40) / 2;
    sh.groups.forEach(function (g, i) {
      var x = PAD + i * (cw + 40);
      P.rect(pg, x, boxY, cw, boxH, 28, lw, "none");
      var t = fit(g, Math.round(bp * 1.2), fl, cw - 60, 130, true); block(pg, t.lines, x + cw / 2, boxY + 30, t.size, { bold: true, anchor: "middle" });
    });
    var words = sh.words, cols = 2, rows = Math.ceil(words.length / cols), rh = Math.min(150, (boxY - y0 - 30) / rows);
    words.forEach(function (w, i) {
      var c = i % cols, r = Math.floor(i / cols), x = PAD + c * (cw + 40), y = y0 + r * rh;
      P.rect(pg, x, y, cw, rh - 18, 22, lw, "none");
      var t = fit(w.w.toUpperCase(), Math.round(bp * 1.2), fl, cw - 40, rh - 40, true); block(pg, t.lines, x + cw / 2, y + (rh - 18 - t.h) / 2, t.size, { bold: true, anchor: "middle" });
    });
    footer(pg, sh.code);
    return pg;
  }
  /* a smooth path through points (Catmull-Rom turned into cubic curves) */
  function smooth(pts) {
    var d = "M" + f1(pts[0][0]) + " " + f1(pts[0][1]);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += "C" + f1(p1[0] + (p2[0] - p0[0]) / 6) + " " + f1(p1[1] + (p2[1] - p0[1]) / 6) + " " + f1(p2[0] - (p3[0] - p1[0]) / 6) + " " + f1(p2[1] - (p3[1] - p1[1]) / 6) + " " + f1(p2[0]) + " " + f1(p2[1]);
    }
    return d;
  }
  function pathFull(sh) {
    var n = stageN(sh.stage), dex = sh.dexterity || "steady", lw = strokeFor(n, dex), bp = bodyPx(n, dex), fl = floorPx(n);
    var pg = newPage({ kind: "path", title: sh.title, stage: n, code: sh.code });
    var y0 = header(pg, sh), r = rng(sh.seed || 1);
    var x1 = 210, y1 = H - 330, x2 = W - 210, y2 = y0 + 190, pts = [[x1, y1]], k = Math.max(1, sh.turns);
    for (var i = 1; i <= k; i++) {
      var t = i / (k + 1), side = i % 2 ? 1 : -1;
      pts.push([x1 + (x2 - x1) * t + side * (120 + r() * 140), y1 + (y2 - y1) * t + (r() - 0.5) * 80]);
    }
    pts.push([x2, y2]);
    pts = pts.map(function (p) { return [Math.max(190, Math.min(W - 190, p[0])), p[1]]; });
    var road = 88 + (DEX_PT[dex] || 0) * 8, d = smooth(pts);
    P.path(pg, d, road, "none", "#000");                                 // the road: a black stroke with a white one on top leaves two clean outlines
    P.path(pg, d, road - lw * 2, "none", "#fff");
    P.circle(pg, x1, y1, 52, lw, "#fff"); P.circle(pg, x2, y2, 52, lw, "#fff");
    var fa = fit(sh.from, bp, fl, 380, 170, true), fb = fit(sh.to, bp, fl, 380, 170, true);
    block(pg, fa.lines, x1, y1 + 66, fa.size, { bold: true, anchor: "middle" });
    block(pg, fb.lines, x2, y2 - 66 - fb.h, fb.size, { bold: true, anchor: "middle" });
    footer(pg, sh.code);
    return pg;
  }
  function lookFull(sh) {
    var n = stageN(sh.stage), dex = sh.dexterity || "steady", lw = strokeFor(n, dex);
    var pg = newPage({ kind: "look", title: sh.title, stage: n, code: sh.code });
    var y0 = header(pg, sh, 84), paths = subjectPaths(sh.pic);
    if (paths) subjectOps(pg, paths, { x: 80, y: y0 + 20, w: 1040, h: 820 }, lw, n);
    var t = fit(sh.word, 150, 80, W - 160, 200, true, 1.05); block(pg, t.lines, W / 2, H - 330, t.size, { bold: true, anchor: "middle" });
    footer(pg, sh.code);
    return pg;
  }

  /* ---------- a page of several items (kind "blocks") ----------
     A sheet lists two to five blocks: a large prompt, then companions (choices to circle, a line to write on, things to pair, a short
     list, numbered steps, dated moments, frames for people) and, if wanted, a strip for staff at the foot. The composer shares the
     height of the page among them by how much each holds, and each block grows its type and spreads its rows to fill what it is
     given, so a page neither crowds nor ends in an empty band.

       { kind: "prompt",   text, sub }                       the main idea, in a frame
       { kind: "choices",  label, options: [text] }           boxes to circle or point to
       { kind: "write",    label, lines: 2 }                  a label and lines to write on
       { kind: "starters", items: [text] }                    sentence openings, each with a line to finish it
       { kind: "pairs",    label, left: [text], right: [text] }   two columns to join
       { kind: "list",     label, items: [text] }             things to tick
       { kind: "steps",    label, items: [text] }             numbered steps
       { kind: "moments",  items: [{ year, text }] }          dated moments down a line
       { kind: "frames",   items: [{ name, sub }] }           a frame, a name and a line under it
       { kind: "tiers",    items: [{ label, names, more, blanks }] }   a family, one generation to a row
       { kind: "blanks",   items: [text] }                    numbered kinds of word, each with a line for the word chosen
       { kind: "picture",  pic, caption }                     a finished drawing from the library, and its name
       { kind: "ladder",   rungs: [{ word, clue }] }          a word ladder: the first word given, a clue for each step
       { kind: "staff",    text }                             a strip at the foot, for the person helping */
  var BLOCK_GAP = 30;
  function blockNeed(b, c) {                                    // { min, want, max }: the least a part needs, its share of what is left, and the most it can use well
    var n = (b.items || b.options || b.left || []).length, row = c.fl * 2.5, lab = b.label ? c.fl * 1.6 + 8 : 0, w = W - 2 * PAD - 12;
    if (b.kind === "prompt") return { min: c.bp * (b.sub ? 4.6 : 3.2), want: 3, max: c.bp * (b.sub ? 9.5 : 8) };
    if (b.kind === "choices") { var cols = choiceCols(b, c), rows = Math.ceil(n / cols); return { min: lab + rows * (c.fl * 2.5), want: 1 + rows * 1.1, max: lab + rows * c.bp * 4.2 + 18 * (rows - 1) }; }
    if (b.kind === "write") { var ln = Math.max(1, b.lines || 2); return { min: lab + ln * c.fl * 2.3, want: 0.6 + ln * 0.8, max: lab + ln * c.fl * 3.4 }; }
    if (b.kind === "starters") return { min: n * c.fl * 3.4, want: n * 1.3, max: n * c.bp * 5 };
    if (b.kind === "pairs") return { min: lab + n * row, want: 1 + n * 0.9, max: lab + n * c.bp * 4 };
    if (b.kind === "list" || b.kind === "steps") return { min: lab + n * row, want: 0.8 + n * 0.9, max: lab + n * c.bp * 3.6 };
    if (b.kind === "moments") return { min: n * c.fl * 2.9, want: n * 1.2, max: n * c.bp * 4.4 };
    if (b.kind === "frames") { var fc = frameCols(n), fr = Math.ceil(n / fc), fw = (w - 26 * (fc - 1)) / fc; return { min: fr * c.fl * 8.5, want: fr * 6, max: fr * fw * 1.25 + 26 * (fr - 1) }; }
    if (b.kind === "tiers") return { min: n * (c.fl * 1.5 + c.bp * 2.1 + 16), want: n * 1.7, max: n * c.bp * 5.2 };
    if (b.kind === "blanks") return { min: n * c.fl * 2.4, want: n * 0.9, max: n * c.bp * 3.2 };
    if (b.kind === "picture") return { min: c.fl * 8, want: 4.5, max: c.bp * 10 };
    if (b.kind === "ladder") { var rn = (b.rungs || []).length; return { min: rn * c.fl * 2.9, want: rn * 1.5, max: rn * c.bp * 4.6 }; }
    return { min: c.fl * 2.4, want: 1, max: c.fl * 4 };
  }
  function choiceCols(b, c) { if (b.cols === 1 || b.cols === 2) return b.cols; var longest = (b.options || []).reduce(function (m, o) { return Math.max(m, String(o).length); }, 0); return c.n === 3 || longest > 24 || (b.options || []).length < 3 ? 1 : 2; }
  function frameCols(n) { return n <= 2 ? n || 1 : n <= 4 ? 2 : 3; }
  function blockLabel(pg, b, c, x, y, w) {
    if (!b.label) return y;
    var t = fit(b.label, c.sz(0.95), c.fl, w, c.fl * 2.6, true);
    return block(pg, t.lines, x, y, t.size, { bold: true }) + 8;
  }
  /* one size for lines that share a part of the page: the largest at which every one of them fits its box */
  function fitAll(texts, size, min, maxW, maxH, bold, lh) {
    var out = size; texts.forEach(function (t) { out = Math.min(out, fit(t, size, min, maxW, maxH, bold, lh).size); });
    return Math.max(min, out);
  }
  var BLOCKS = {
    prompt: function (pg, b, c, x, y, w, h) {
      if (!c.plain) P.rect(pg, x, y, w, h, 26, c.lw);
      var subH = b.sub ? Math.min(h * 0.34, c.bp * 2.6) : 0, pad = 34;
      var t = fit(b.text, c.sz(1.6), c.sz(0.8), w - pad * 2, h - pad * 2 - subH, true, 1.18);
      var s2 = b.sub ? fit(b.sub, c.bp, c.fl, w - pad * 2, subH, false) : null, total = t.h + (s2 ? s2.h + 14 : 0), yy = y + (h - total) / 2;
      yy = block(pg, t.lines, x + w / 2, yy, t.size, { bold: true, anchor: "middle", lh: 1.18 });
      if (s2) block(pg, s2.lines, x + w / 2, yy + 14, s2.size, { anchor: "middle" });
    },
    choices: function (pg, b, c, x, y, w, h) {
      var y1 = blockLabel(pg, b, c, x, y, w), opts = b.options || [], cols = choiceCols(b, c), rows = Math.ceil(opts.length / cols), g = 18;
      var cw = (w - g * (cols - 1)) / cols, ch = Math.min((y + h - y1 - g * (rows - 1)) / rows, c.bp * 4.2), r = Math.max(18, Math.min(30, ch * 0.2));
      var osz = fitAll(opts, c.sz(1.25), c.fl, cw - 18 - (26 + r * 2 + 36), ch - 14, true);
      opts.forEach(function (o, i) {
        var bx = x + (i % cols) * (cw + g), by = y1 + Math.floor(i / cols) * (ch + g);
        if (!c.plain) P.rect(pg, bx, by, cw, ch, 18, c.lw);
        P.circle(pg, bx + 26 + r, by + ch / 2, r, c.lw, "none");
        var tx = bx + 26 + r * 2 + 36, t = fit(o, osz, c.fl, bx + cw - 18 - tx, ch - 14, true);
        block(pg, t.lines, tx, by + (ch - t.h) / 2, t.size, { bold: true });
      });
    },
    write: function (pg, b, c, x, y, w, h) {
      var y1 = blockLabel(pg, b, c, x, y, w), n = Math.max(1, b.lines || 2), rh = Math.min((y + h - y1) / n, c.fl * 3.4);
      for (var i = 0; i < n; i++) P.line(pg, x, y1 + (i + 1) * rh - 6, x + w, y1 + (i + 1) * rh - 6, c.rule, "", "write");
    },
    starters: function (pg, b, c, x, y, w, h) {
      var items = b.items || [], rh = Math.min(h / Math.max(1, items.length), c.bp * 5);
      var ssz = fitAll(items, c.sz(1.2), c.fl, w, rh * 0.5, true);
      items.forEach(function (it, i) {
        var yy = y + i * rh, t = fit(it, ssz, c.fl, w, rh * 0.5, true);
        block(pg, t.lines, x, yy + 4, t.size, { bold: true });
        P.line(pg, x, yy + rh - 12, x + w, yy + rh - 12, c.rule, "", "write");
      });
    },
    pairs: function (pg, b, c, x, y, w, h) {
      var y1 = blockLabel(pg, b, c, x, y, w), left = b.left || [], right = b.right || [], n = Math.max(left.length, right.length), rh = Math.min((y + h - y1) / Math.max(1, n), c.bp * 4), col = w * 0.36;
      var lsz = fitAll(left, c.sz(1.2), c.fl, col, rh - 12, true), rsz = fitAll(right, c.sz(1.2), c.fl, col, rh - 12, true);
      for (var i = 0; i < n; i++) {
        var cy = y1 + i * rh + rh / 2;
        if (left[i] != null) { var a = fit(left[i], lsz, c.fl, col, rh - 12, true); block(pg, a.lines, x + 8, cy - a.h / 2, a.size, { bold: true }); P.circle(pg, x + col + 44, cy, 20, c.lw, "none"); }
        if (right[i] != null) { var d = fit(right[i], rsz, c.fl, col, rh - 12, true); block(pg, d.lines, x + w - 8, cy - d.h / 2, d.size, { bold: true, anchor: "end" }); P.circle(pg, x + w - col - 44, cy, 20, c.lw, "none"); }
      }
    },
    list: function (pg, b, c, x, y, w, h) { rowsOf(pg, b, c, x, y, w, h, false); },
    steps: function (pg, b, c, x, y, w, h) { rowsOf(pg, b, c, x, y, w, h, true); },
    moments: function (pg, b, c, x, y, w, h) {
      var items = b.items || [], rh = Math.min(h / Math.max(1, items.length), c.bp * 4.4), lx = x + 30, ys = c.sz(1.15), yearW = Math.round(ys * 0.64 * 4 + 28);
      if (items.length > 1) P.line(pg, lx, y + rh / 2, lx, y + (items.length - 1) * rh + rh / 2, c.rule, "", "rule");
      var anyYear = items.some(function (it) { return it.year; }), msz = fitAll(items.map(function (it) { return it.text; }), c.sz(1.15), c.fl, x + w - (lx + 46) - (anyYear ? yearW : 0), rh - 12, false);
      items.forEach(function (it, i) {
        var cy = y + i * rh + rh / 2, tx = lx + 46;
        P.circle(pg, lx, cy, 18, c.lw, "#fff");
        if (it.year) { P.text(pg, tx, cy + ys * 0.36, ys, String(it.year), { bold: true }); tx += yearW; }
        var t = fit(it.text, msz, c.fl, x + w - tx, rh - 12, false);
        block(pg, t.lines, tx, cy - t.h / 2, t.size);
      });
    },
    frames: function (pg, b, c, x, y, w, h) {
      var items = b.items || [], cols = frameCols(items.length), rows = Math.ceil(items.length / cols), g = 26, cw = (w - g * (cols - 1)) / cols, ch = Math.min((h - g * (rows - 1)) / rows, cw * 1.25);
      var subLines = items.reduce(function (m, it) { return Math.max(m, it.sub ? Math.min(2, fit(it.sub, c.fl, c.fl, cw, c.fl * 2.6, false).lines.length) : 0); }, 0);
      items.forEach(function (it, i) {
        var bx = x + (i % cols) * (cw + g), by = y + Math.floor(i / cols) * (ch + g), capH = c.bp * 1.7 + subLines * c.fl * 1.22 + (subLines ? 6 : 0), ph = ch - capH;
        if (it.photo) P.image(pg, bx, by, cw, ph, it.photo);
        P.rect(pg, bx, by, cw, ph, 16, c.lw);
        if (!it.photo) { var hint = fit(it.hint || "A photo can go here", c.fl, c.fl, cw - 30, ph - 20, false); block(pg, hint.lines, bx + cw / 2, by + (ph - hint.h) / 2, hint.size, { anchor: "middle", role: "hint" }); }
        if (!it.name) { P.line(pg, bx + 20, by + ch - 18, bx + cw - 20, by + ch - 18, c.rule, "", "write"); return; }      // no name yet: a line to write it on
        var nm = fit(it.name, c.sz(1.3), c.fl, cw, c.bp * 1.6, true), yy = block(pg, nm.lines.slice(0, 1), bx + cw / 2, by + ph + 6, nm.size, { bold: true, anchor: "middle" });
        if (it.sub) { var sb = fit(it.sub, c.fl, c.fl, cw, c.fl * 2.6, false); block(pg, sb.lines.slice(0, 2), bx + cw / 2, yy, sb.size, { anchor: "middle" }); }
      });
    },
    tiers: function (pg, b, c, x, y, w, h) {
      var rows = b.items || [], rh = Math.min(h / Math.max(1, rows.length), c.bp * 5.2), labH = c.fl * 1.5, g = 18;
      rows.forEach(function (row, i) {
        var yy = y + i * rh, names = (row.names || []).slice(), boxes = names.length || row.blanks || 1, extra = row.more ? 1 : 0, k = Math.max(2, boxes + extra), bw = Math.min((w - g * (k - 1)) / k, w * 0.46), bh = rh - labH - 18;
        var lab = fit(row.label, c.fl, c.fl, w, labH, true); block(pg, lab.lines.slice(0, 1), x, yy, lab.size, { bold: true });
        if (i) P.line(pg, x + bw / 2, yy - 14, x + bw / 2, yy + 2, c.rule, "", "rule");           // the line of descent
        for (var j = 0; j < boxes; j++) {
          var bx = x + j * (bw + g), by = yy + labH;
          P.rect(pg, bx, by, bw, bh, 16, c.lw);
          if (names[j]) { var t = fit(names[j], c.sz(1.2), c.fl, bw - 24, bh - 10, true); block(pg, t.lines.slice(0, 1), bx + bw / 2, by + (bh - t.size * 1.22) / 2, t.size, { bold: true, anchor: "middle" }); }
        }
        if (row.more) { var mt = fit("and " + row.more + " more", c.fl, c.fl, bw, bh, false); block(pg, mt.lines, x + boxes * (bw + g), yy + labH + (bh - mt.h) / 2, mt.size, {}); }
      });
    },
    blanks: function (pg, b, c, x, y, w, h) {
      var items = b.items || [], rh = Math.min(h / Math.max(1, items.length), c.bp * 3.2), r = Math.max(c.fl * 0.6, Math.min(30, rh * 0.3)), ds = Math.max(c.fl, Math.round(r * 1.1));
      var bsz = fitAll(items, c.sz(1.05), c.fl, w * 0.52 - (r * 2 + 22), rh - 10, true);
      items.forEach(function (it, i) {
        var cy = y + i * rh + rh / 2, tx = x + r * 2 + 22, half = w * 0.52;
        P.circle(pg, x + r, cy, r, c.lw, "none"); P.text(pg, x + r, cy + ds * 0.36, ds, String(i + 1), { bold: true, anchor: "middle" });
        var t = fit(it, bsz, c.fl, x + half - tx, rh - 10, true); block(pg, t.lines, tx, cy - t.h / 2, t.size, { bold: true });
        P.line(pg, x + half + 16, cy + c.fl * 0.5, x + w, cy + c.fl * 0.5, c.rule, "", "write");
      });
    },
    picture: function (pg, b, c, x, y, w, h) {
      var cap = b.caption ? fit(b.caption, c.sz(1.1), c.fl, w, c.bp * 1.6, true) : null, capH = cap ? cap.h + 10 : 0, paths = b.pic ? subjectPaths(b.pic) : null;
      if (paths) subjectOps(pg, paths, { x: x + w * 0.2, y: y, w: w * 0.6, h: h - capH }, c.lw, c.n);
      if (cap) block(pg, cap.lines.slice(0, 1), x + w / 2, y + h - capH + 6, cap.size, { bold: true, anchor: "middle" });
    },
    ladder: function (pg, b, c, x, y, w, h) {
      var rungs = b.rungs || [], rh = Math.min(h / Math.max(1, rungs.length), c.bp * 4.6), len = rungs.reduce(function (m, q) { return Math.max(m, String(q.word).length); }, 1);
      var bs = Math.max(c.fl * 1.5, Math.min(rh - 26, 118, (w * 0.46) / len)), g = 10, ls = Math.max(c.fl, Math.round(bs * 0.62)), bx0 = x + 4;
      rungs.forEach(function (q, i) {
        var by = y + i * rh + (rh - bs) / 2, word = String(q.word);
        for (var j = 0; j < word.length; j++) { P.rect(pg, bx0 + j * (bs + g), by, bs, bs, 10, c.lw); if (!i) P.text(pg, bx0 + j * (bs + g) + bs / 2, by + bs / 2 + ls * 0.36, ls, word.charAt(j), { bold: true, anchor: "middle" }); }
        if (i) P.line(pg, bx0 + bs / 2, by - (rh - bs), bx0 + bs / 2, by, c.rule, "", "rule");     // the ladder's rail between two steps
        var tx = bx0 + word.length * (bs + g) + 26, t = fit(i ? q.clue : "Start here", c.sz(1.05), c.fl, x + w - tx, rh - 12, !i);
        block(pg, t.lines, tx, by + (bs - t.h) / 2, t.size, { bold: !i });
      });
    },
    staff: function (pg, b, c, x, y, w, h) {
      P.line(pg, x, y, x + w, y, c.rule, "", "rule");
      var t = fit("For staff: " + b.text, c.fl, c.fl, w, h - 14, false);
      block(pg, t.lines, x, y + 14, t.size, { role: "staff" });
    }
  };
  function rowsOf(pg, b, c, x, y, w, h, numbered) {
    var y1 = blockLabel(pg, b, c, x, y, w), items = b.items || [], rh = Math.min((y + h - y1) / Math.max(1, items.length), c.bp * 3.6), r = Math.max(c.fl * 0.62, Math.min(34, rh * 0.3));
    var rsz = fitAll(items, c.sz(1.2), c.fl, w - (r * 2 + 26), rh - 12, numbered);
    items.forEach(function (it, i) {
      var cy = y1 + i * rh + rh / 2;
      if (numbered) { P.circle(pg, x + r, cy, r, c.lw, "none"); var ds = Math.max(c.fl, Math.round(r * 1.1)); P.text(pg, x + r, cy + ds * 0.36, ds, String(i + 1), { bold: true, anchor: "middle" }); }
      else P.rect(pg, x, cy - r, r * 2, r * 2, 8, c.lw);
      var tx = x + r * 2 + 26, t = fit(it, rsz, c.fl, x + w - tx, rh - 12, numbered);
      block(pg, t.lines, tx, cy - t.h / 2, t.size, { bold: numbered });
    });
  }
  function blocksFull(sh) {
    var n = stageN(sh.stage), dex = sh.dexterity || "steady", lw = strokeFor(n, dex), bp = bodyPx(n, dex), fl = floorPx(n);
    /* drawn at the largest type that leaves the page calm; a page still too full gives up its frames, then some size, and if it
       is still too full it says so (the stage wants fewer parts on a page, not smaller ones) */
    var page = calmest(n, function (grow, extras) {
      var c = { n: n, lw: lw, rule: Math.max(7, f1(lw * 0.7)), bp: bp, fl: fl, g: grow, plain: !extras, sz: function (m) { return Math.max(fl, Math.round(bp * m * grow)); } };
      var pg = newPage({ kind: "blocks", title: sh.title, stage: n, code: sh.code });
      var y0 = header(pg, sh), x = PAD + 6, w = W - 2 * PAD - 12, bottom = H - 76;
      var all = (sh.blocks || []).filter(function (b) { return b && BLOCKS[b.kind]; }), staff = all.filter(function (b) { return b.kind === "staff"; })[0], blocks = all.filter(function (b) { return b.kind !== "staff"; });
      if (staff) { var st = fit("For staff: " + staff.text, fl, fl, w, 400, false), sh2 = st.h + 26; BLOCKS.staff(pg, staff, c, x, bottom - sh2, w, sh2); bottom -= sh2 + BLOCK_GAP; }
      var needs = blocks.map(function (b) { return blockNeed(b, c); }), room = bottom - y0 - BLOCK_GAP * Math.max(0, blocks.length - 1);
      var minSum = needs.reduce(function (m, q) { return m + q.min; }, 0), wantSum = needs.reduce(function (m, q) { return m + q.want; }, 0), spare = room - minSum;
      if (spare < 0) (pg.meta.fit = pg.meta.fit || []).push("This page holds more than fits: " + blocks.length + " parts need " + Math.round(minSum) + " px and there are " + Math.round(room) + ".");
      /* each part takes its share of the room, but no more than it can use well; what is left over becomes even air above,
         between and below, so a page with little on it sits in the middle of the sheet and not at its top */
      var hs = needs.map(function (q) { return spare >= 0 ? q.min : q.min * room / minSum; }), left = Math.max(0, spare);
      for (var pass = 0; pass < 5 && left > 1; pass++) {
        var open = needs.map(function (q, i) { return i; }).filter(function (i) { return hs[i] < Math.max(needs[i].min, needs[i].max) - 0.5; });
        if (!open.length) break;
        var ws = open.reduce(function (m, i) { return m + needs[i].want; }, 0), used = 0;
        open.forEach(function (i) { var add = Math.min(Math.max(needs[i].min, needs[i].max) - hs[i], left * needs[i].want / ws); hs[i] += add; used += add; });
        left -= used;
      }
      var air = left > 1 ? left / (blocks.length + 1) : 0, y = y0 + air;
      blocks.forEach(function (b, i) { BLOCKS[b.kind](pg, b, c, x, y, w, hs[i]); y += hs[i] + BLOCK_GAP + air; });
      pg.meta.blocks = blocks.length + (staff ? 1 : 0);
      footer(pg, sh.code);
      return pg;
    }, 1.5);
    var white = whiteShare(page);
    if (white < CALM_WHITE[n]) (page.meta.fit = page.meta.fit || []).push("This page is fuller than stays calm at stage " + n + ": " + Math.round(white * 100) + " percent of it is empty and " + Math.round(CALM_WHITE[n] * 100) + " is wanted. Give it fewer parts.");
    return page;
  }

  /* the prompts of several sheets dealt onto cards together, so a sheet of eight cards is full of eight ideas and not two */
  function packPrompts(sheets, layout) {
    var cards = []; sheets.forEach(function (sh) { sh.items.forEach(function (it) { cards.push({ tag: it.tag, head: it.thing, lines: [it.invite, it.sense].filter(Boolean) }); }); });
    var f = sheets[0];
    return cardPages(cards, layout, { title: f.title, stage: f.stage, dexterity: f.dexterity, code: f.code }).map(function (pg) { return tag(pg, f); });
  }

  /* more kinds of sheet join here: js/generators/activity-pages.js adds the rest of the master inventory */
  var PAGE_KINDS = {};
  function registerPage(kind, fn) { PAGE_KINDS[kind] = fn; }
  /* what kind of sheet a page came from, for the facility validator */
  function tag(pg, sh) { pg.meta.sheetKind = sh.kind; if (sh.steps) pg.meta.steps = sh.steps.length; if (sh.keyLines) pg.meta.key = sh.keyLines; return pg; }

  /* the pages for one sheet in a layout; { pages, fellBack } */
  function sheetPages(sh, layout) {
    layout = layout || "full";
    var cardable = sh.kind === "prompts" || sh.kind === "steps";
    if (layout !== "full" && cardable) {
      var cards = sh.kind === "prompts"
        ? sh.items.map(function (it) { return { tag: it.tag, head: it.thing, lines: [it.invite, it.sense].filter(Boolean) }; })
        : sh.steps.map(function (s) { return { badge: String(s.n), head: s.text, lines: [] }; });
      return { pages: cardPages(cards, layout, sh).map(function (pg) { return tag(pg, sh); }), fellBack: false };
    }
    var f = { prompts: promptsFull, steps: stepsFull, match: matchFull, sort: sortFull, path: pathFull, look: lookFull, blocks: blocksFull }[sh.kind] || PAGE_KINDS[sh.kind];
    if (!f) throw new Error("No page is made for a sheet of kind " + sh.kind);
    var made = f(sh), list = Array.isArray(made) ? made : [made];
    return { pages: list.map(function (pg) { return tag(pg, sh); }), fellBack: layout !== "full" };
  }

  /* ---------- writers ---------- */
  function toSVG(pg, o) {
    o = o || {};
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + (o.width || W) + '" height="' + (o.height || H) + '" role="img" aria-label="' + esc(o.label || (pg.meta && pg.meta.title) || "Activity page") + '" font-family=\'' + FONT + '\' stroke-linejoin="round" stroke-linecap="round">';
    s += '<rect width="' + W + '" height="' + H + '" fill="#fff"/>';
    pg.ops.forEach(function (op) {
      var dash = op.dash ? ' stroke-dasharray="' + op.dash + '"' : "";
      if (op.t === "rect") s += '<rect x="' + op.x + '" y="' + op.y + '" width="' + op.w + '" height="' + op.h + '" rx="' + op.r + '" fill="' + op.fill + '" stroke="#000" stroke-width="' + op.sw + '"' + dash + '/>';
      else if (op.t === "circle") s += '<circle cx="' + op.cx + '" cy="' + op.cy + '" r="' + op.r + '" fill="' + op.fill + '" stroke="#000" stroke-width="' + op.sw + '"/>';
      else if (op.t === "line") s += '<line x1="' + op.x1 + '" y1="' + op.y1 + '" x2="' + op.x2 + '" y2="' + op.y2 + '" stroke="#000" stroke-width="' + op.sw + '"' + dash + '/>';
      else if (op.t === "path") s += '<path d="' + op.d + '" transform="translate(' + op.tx + ' ' + op.ty + ') scale(' + op.k + ')" fill="' + op.fill + '" stroke="' + op.stroke + '" stroke-width="' + op.sw + '"/>';
      else if (op.t === "image") s += '<image x="' + op.x + '" y="' + op.y + '" width="' + op.w + '" height="' + op.h + '" preserveAspectRatio="xMidYMid slice" href="' + esc(op.src) + '"/>';
      else if (op.t === "text") s += '<text x="' + op.x + '" y="' + op.y + '" ' + (op.font === "grid" ? ' font-family=\'' + GRID_FONT + '\'' : op.font && SCRIPTS[op.font] ? ' font-family=\'' + SCRIPTS[op.font].family + '\'' : '') + ' font-size="' + op.size + '" font-weight="' + (op.bold ? 700 : 400) + '" text-anchor="' + op.anchor + '" fill="#000">' + esc(op.str) + '</text>';
    });
    return s + '</svg>';
  }
  function toCanvas(pg, canvas, scale) {
    scale = scale || 1;
    canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
    var c = canvas.getContext("2d");
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
    c.lineJoin = "round"; c.lineCap = "round";
    pg.ops.forEach(function (op) {
      c.save();
      c.strokeStyle = "#000"; c.fillStyle = "#000"; c.lineWidth = op.sw || 1; c.setLineDash(op.dash ? op.dash.split(" ").map(Number) : []);
      if (op.t === "rect") {
        var r = op.r || 0; c.beginPath(); c.moveTo(op.x + r, op.y); c.arcTo(op.x + op.w, op.y, op.x + op.w, op.y + op.h, r); c.arcTo(op.x + op.w, op.y + op.h, op.x, op.y + op.h, r);
        c.arcTo(op.x, op.y + op.h, op.x, op.y, r); c.arcTo(op.x, op.y, op.x + op.w, op.y, r); c.closePath();
        if (op.fill === "#fff") { c.fillStyle = "#fff"; c.fill(); } else if (op.fill === "#000") c.fill(); c.stroke();
      } else if (op.t === "circle") {
        c.beginPath(); c.arc(op.cx, op.cy, op.r, 0, Math.PI * 2);
        if (op.fill === "#fff") { c.fillStyle = "#fff"; c.fill(); } else if (op.fill === "#000") c.fill(); c.stroke();
      } else if (op.t === "line") { c.beginPath(); c.moveTo(op.x1, op.y1); c.lineTo(op.x2, op.y2); c.stroke(); }
      else if (op.t === "path") {
        c.translate(op.tx, op.ty); c.scale(op.k, op.k); c.lineWidth = op.sw; c.strokeStyle = op.stroke;
        var p = new Path2D(op.d);
        if (op.fill === "#fff") { c.fillStyle = "#fff"; c.fill(p); } else if (op.fill === "#000") c.fill(p);
        c.stroke(p);
      } else if (op.t === "image") {
        var im = IMAGES[op.src];                                           // drawn only once loaded (loadImages), cropped to fill its box
        if (im && im.naturalWidth) { var k2 = Math.max(op.w / im.naturalWidth, op.h / im.naturalHeight), sw2 = op.w / k2, sh2 = op.h / k2; c.drawImage(im, (im.naturalWidth - sw2) / 2, (im.naturalHeight - sh2) / 2, sw2, sh2, op.x, op.y, op.w, op.h); }
      } else if (op.t === "text") {
        c.font = (op.bold ? "700 " : "400 ") + op.size + "px " + (op.font === "grid" ? GRID_FONT : op.font && SCRIPTS[op.font] ? SCRIPTS[op.font].family : FONT); c.textAlign = op.anchor === "middle" ? "center" : op.anchor === "end" ? "right" : "left"; c.textBaseline = "alphabetic";
        c.fillText(op.str, op.x, op.y);
      }
      c.restore();
    });
    return canvas;
  }

  /* How much of a page of words and boxes is left empty, on the same 60 x 80 grid the facility validator lays over a page
     (js/utils/facility-validator.js): a cell counts as used when a word's box, a line or an outline touches it. The page makers
     read it to grow their type only as far as the page stays calm. */
  var GC = 60, GR = 80;
  /* the points a path passes through or is pulled toward (control points included), in order */
  function pathPoints(d) {
    var tok = String(d).match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [], pts = [], i = 0, cmd = "", cx = 0, cy = 0, sx = 0, sy = 0;
    var num = function () { return parseFloat(tok[i++]); };
    while (i < tok.length) {
      if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
      var rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? cx : 0, oy = rel ? cy : 0;
      if (C === "Z") { cx = sx; cy = sy; pts.push([cx, cy]); if (i < tok.length && !/[a-zA-Z]/.test(tok[i])) i++; continue; }
      if (C === "H") { cx = num() + ox; pts.push([cx, cy]); continue; }
      if (C === "V") { cy = num() + oy; pts.push([cx, cy]); continue; }
      var n = { M: 2, L: 2, T: 2, C: 6, S: 4, Q: 4, A: 7 }[C]; if (!n) { i++; continue; }
      var a = []; for (var k = 0; k < n; k++) a.push(num());
      if (C === "A") { cx = a[5] + ox; cy = a[6] + oy; pts.push([cx, cy]); continue; }
      for (var j = 0; j < n; j += 2) pts.push([a[j] + ox, a[j + 1] + oy]);
      cx = a[n - 2] + ox; cy = a[n - 1] + oy;
      if (C === "M") { sx = cx; sy = cy; cmd = rel ? "l" : "L"; }
    }
    return pts;
  }
  function whiteShare(pg) {
    var g = new Uint8Array(GC * GR), cw = W / GC, ch = H / GR;
    var cell = function (x, y, hw) {
      var x0 = Math.floor((x - hw) / cw), x1 = Math.floor((x + hw) / cw), y0 = Math.floor((y - hw) / ch), y1 = Math.floor((y + hw) / ch);
      for (var cy = Math.max(0, y0); cy <= Math.min(GR - 1, y1); cy++) for (var cx = Math.max(0, x0); cx <= Math.min(GC - 1, x1); cx++) g[cy * GC + cx] = 1;
    };
    var seg = function (x1, y1, x2, y2, hw) { var n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 8)); for (var i = 0; i <= n; i++) cell(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, hw); };
    var box = function (x, y, w, h) { for (var cy = Math.floor(y / ch); cy <= Math.floor((y + h) / ch); cy++) for (var cx = Math.floor(x / cw); cx <= Math.floor((x + w) / cw); cx++) if (cx >= 0 && cy >= 0 && cx < GC && cy < GR) g[cy * GC + cx] = 1; };
    pg.ops.forEach(function (op) {
      var hw = (op.sw || 1) / 2;
      if (op.t === "rect") {
        if (op.fill === "#000") box(op.x, op.y, op.w, op.h);
        seg(op.x, op.y, op.x + op.w, op.y, hw); seg(op.x + op.w, op.y, op.x + op.w, op.y + op.h, hw); seg(op.x + op.w, op.y + op.h, op.x, op.y + op.h, hw); seg(op.x, op.y + op.h, op.x, op.y, hw);
      } else if (op.t === "circle") {
        if (op.fill === "#000") box(op.cx - op.r, op.cy - op.r, op.r * 2, op.r * 2);
        for (var a = 0; a < 24; a++) cell(op.cx + op.r * Math.cos(a / 24 * 6.2832), op.cy + op.r * Math.sin(a / 24 * 6.2832), hw);
      } else if (op.t === "line") seg(op.x1, op.y1, op.x2, op.y2, hw);
      else if (op.t === "image") box(op.x, op.y, op.w, op.h);
      else if (op.t === "path") {
        if (op.stroke === "#fff") return;                                // the white center of a road marks nothing
        var k = op.k || 1, pts = pathPoints(op.d);
        for (var q = 1; q < pts.length; q++) seg(pts[q - 1][0] * k + op.tx, pts[q - 1][1] * k + op.ty, pts[q][0] * k + op.tx, pts[q][1] * k + op.ty, hw * k);
      } else if (op.t === "text") {
        var w = op.str.length * op.size * (op.bold ? 0.6 : 0.55), x = op.anchor === "middle" ? op.x - w / 2 : op.anchor === "end" ? op.x - w : op.x;
        box(x, op.y - op.size * 0.8, w, op.size * 0.95);
      }
    });
    var used = 0; for (var i = 0; i < g.length; i++) used += g[i];
    return 1 - used / g.length;
  }
  /* the page a maker draws at the largest growth that still leaves it calm: make(grow, extras) is tried from the stage's most
     generous growth down to none, then once more without its extras (frames, lines to write on) */
  function calmest(n, make, most) {
    var pg = null, calm = function () { return whiteShare(pg) >= CALM_WHITE[n] + 0.012; };
    for (var grow = most || GROW_MAX[n]; grow >= 0.79; grow -= 0.1) { pg = make(grow, true); if (calm()) return pg; }
    for (var less = 1; less >= 0.59; less -= 0.1) { pg = make(less, false); if (calm()) return pg; }   // a crowded page gives up its extras, then some size (never under the stage's floor)
    return pg;
  }

  /* where the ink is, top to bottom: [top, bottom] for everything drawn (the page code at the foot aside) */
  function inkBands(pg) {
    var out = (pg.meta && pg.meta.ink || []).map(function (b) { return [b[0], b[1]]; });
    pg.ops.forEach(function (op) {
      if (op.t === "text") { if (op.role !== "code") out.push([op.y - op.size * 0.8, op.y + op.size * 0.25]); }
      else if (op.t === "rect" || op.t === "image") out.push([op.y, op.y + op.h]);
      else if (op.t === "circle") out.push([op.cy - op.r, op.cy + op.r]);
      else if (op.t === "line") out.push([Math.min(op.y1, op.y2) - op.sw / 2, Math.max(op.y1, op.y2) + op.sw / 2]);
      else if (op.t === "path" && !/[a-y]/.test(op.d)) {                 // absolute commands only: every second number is a y
        var nums = op.d.match(/-?\d*\.?\d+(?:e-?\d+)?/g) || [], lo = Infinity, hi = -Infinity;
        for (var i = 1; i < nums.length; i += 2) { var yy = Number(nums[i]) * op.k + op.ty; if (yy < lo) lo = yy; if (yy > hi) hi = yy; }
        if (hi >= lo) out.push([lo, hi]);
      }
    });
    return out.sort(function (a, b) { return a[0] - b[0]; });
  }
  /* the tallest band of the page with nothing on it, between the top margin and the foot */
  function blankBand(pg) {
    var top = PAD, foot = H - 76, at = top, worst = 0;
    inkBands(pg).forEach(function (b) { if (b[0] > at) worst = Math.max(worst, Math.min(b[0], foot) - at); at = Math.max(at, b[1]); });
    return Math.round(Math.max(worst, foot - at));
  }

  /* the photographs on a set of pages, loaded so a canvas can draw them (the browser only); resolves when all are ready */
  var IMAGES = {};
  function loadImages(pages) {
    var srcs = []; (pages || []).forEach(function (pg) { pg.ops.forEach(function (op) { if (op.t === "image" && !IMAGES[op.src] && srcs.indexOf(op.src) < 0) srcs.push(op.src); }); });
    if (!srcs.length || typeof Image === "undefined") return Promise.resolve();
    return Promise.all(srcs.map(function (src) { return new Promise(function (done) { var im = new Image(); im.onload = function () { IMAGES[src] = im; done(); }; im.onerror = function () { done(); }; im.src = src; }); }));
  }

  /* what is wrong with a page, in words (an empty list is a pass) */
  function validate(pg) {
    var out = [], n = stageN(pg.meta && pg.meta.stage), fl = floorPx(n);
    if (pg.w * 4 !== pg.h * 3) out.push("The page is not 3:4.");
    var minLine = 6;                                                     // never a line thinner than 6 px; real lines are 6.7 px and up
    pg.ops.forEach(function (op, i) {
      if (op.t === "image") { if (op.x < 0 || op.y < 0 || op.x + op.w > W || op.y + op.h > H) out.push("A photograph runs off the page."); }
      else if (op.t !== "text") {
        var sw = op.t === "path" ? op.sw * op.k : op.sw;
        if (sw < minLine && !(op.t === "path" && op.stroke === "#fff")) out.push("Line " + (i + 1) + " is only " + f1(sw) + " px (needs " + minLine + " or more).");
        [op.fill, op.stroke].forEach(function (c) { if (c && ["none", "#fff", "#000"].indexOf(c) < 0) out.push("Line " + (i + 1) + " uses a color other than black or white."); });
      } else {
        if (op.role === "title" && op.size < TITLE_MIN) out.push("The title “" + op.str.slice(0, 20) + "” is " + op.size + " px, under 32 pt (" + TITLE_MIN + " px).");
        if (op.role !== "code" && op.size < fl) out.push("Text “" + op.str.slice(0, 20) + "” is " + op.size + " px, under the stage floor of " + fl + " px.");
        var half = op.str.length * op.size * (op.bold ? 0.6 : 0.55) * (op.anchor === "middle" ? 0.5 : op.anchor === "end" ? 1 : 0);
        var left = op.anchor === "middle" ? op.x - half : op.anchor === "end" ? op.x - half : op.x, right = op.anchor === "middle" ? op.x + half : op.anchor === "end" ? op.x : op.x + op.str.length * op.size * (op.bold ? 0.6 : 0.55);
        if (left < 8 || right > W - 8 || op.y > H - 4) out.push("Text “" + op.str.slice(0, 20) + "” runs off the page.");
      }
      if (op.t === "rect" && (op.x < 0 || op.y < 0 || op.x + op.w > W || op.y + op.h > H)) out.push("A box runs off the page.");
    });
    var blank = blankBand(pg);
    if (blank > BLANK_MAX) out.push("The page leaves a band of " + blank + " px empty (" + BLANK_MAX + " or less reads as finished).");
    (pg.meta && pg.meta.fit || []).forEach(function (m) { out.push(m); });
    return out;
  }

  return {
    VERSION: VERSION, W: W, H: H, PX_PER_PT: PT, FONT: FONT, LAYOUTS: LAYOUTS, STYLES: STYLES, BOX: BOX,
    registerPage: registerPage,
    GRID_FONT: GRID_FONT, kit: { newPage: newPage, P: P, block: block, fit: fit, wrap: wrap, header: header, footer: footer, subjectOps: subjectOps, subjectPaths: subjectPaths, strokeFor: strokeFor, bodyPx: bodyPx, floorPx: floorPx,
           stageN: stageN, rng: rng, hash: hash, smooth: smooth, W: W, H: H, PAD: PAD, PT: PT, BOX: BOX, drawCard: drawCard, cellsFor: cellsFor, calmest: calmest, whiteShare: whiteShare },
    strokeFor: strokeFor, bodyPx: bodyPx, floorPx: floorPx, chooseSubject: chooseSubject, subjectPaths: subjectPaths,
    composeColoring: composeColoring, sheetPages: sheetPages, packPrompts: packPrompts, toSVG: toSVG, toCanvas: toCanvas, validate: validate, hash: hash,
    TITLE_MIN: TITLE_MIN, BLANK_MAX: BLANK_MAX, CALM_WHITE: CALM_WHITE, blankBand: blankBand, whiteShare: whiteShare, loadImages: loadImages
  };
});
