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
    var t = fit(sh.title, big || 92, 64, W - PAD * 2, 200, true, 1.12);
    y = block(pg, t.lines, W / 2, y, t.size, { bold: true, anchor: "middle", lh: 1.12 });
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
    var n = stageN(sh.stage), dex = sh.dexterity || "steady", lw = strokeFor(n, dex), bp = bodyPx(n, dex), fl = floorPx(n);
    var pg = newPage({ kind: "prompts", title: sh.title, stage: n, code: sh.code });
    var y0 = header(pg, sh), items = sh.items, area = H - 70 - y0, bh = area / Math.max(1, items.length);
    items.forEach(function (it, i) {
      var y = y0 + i * bh, x = PAD + 10, iw = W - 2 * PAD - 20, ih = bh - 34;
      if (i) P.line(pg, PAD, y - 12, W - PAD, y - 12, Math.max(7, lw * 0.7), "", "rule");
      P.text(pg, x, y + fl * 0.82, fl, it.tag, { bold: true });
      var yy = y + fl * 1.35, rem = ih - fl * 1.35;
      var th = fit(it.thing, Math.round(bp * 1.2), fl, iw, rem * 0.4, true);
      yy = block(pg, th.lines, x, yy, th.size, { bold: true }); rem -= th.h;
      var iv = fit(it.invite, bp, fl, iw, rem * (it.sense ? 0.55 : 1), false);
      yy = block(pg, iv.lines, x, yy + 6, iv.size); rem -= iv.h + 6;
      if (it.sense && rem > fl * 1.3) { var se = fit(it.sense, Math.round(bp * 0.9), fl, iw, rem, false); block(pg, se.lines, x, yy + 6, se.size); }
    });
    footer(pg, sh.code);
    return pg;
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
    var y0 = header(pg, sh), rows = sh.pairs.length, rh = (H - 90 - y0) / rows;
    sh.pairs.forEach(function (p, i) {
      var cy = y0 + i * rh + rh / 2, lw2 = sh.right[i];
      var a = fit(p[0].toUpperCase(), Math.round(bp * 1.3), fl, 380, rh - 16, true), b = fit(lw2.toUpperCase(), Math.round(bp * 1.3), fl, 380, rh - 16, true);
      block(pg, a.lines, PAD + 20, cy - a.h / 2, a.size, { bold: true });
      block(pg, b.lines, W - PAD - 20, cy - b.h / 2, b.size, { bold: true, anchor: "end" });
      P.circle(pg, 470, cy, 22, lw, "none"); P.circle(pg, 730, cy, 22, lw, "none");
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
    var f = { prompts: promptsFull, steps: stepsFull, match: matchFull, sort: sortFull, path: pathFull, look: lookFull }[sh.kind] || PAGE_KINDS[sh.kind];
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
      } else if (op.t === "text") {
        c.font = (op.bold ? "700 " : "400 ") + op.size + "px " + (op.font === "grid" ? GRID_FONT : op.font && SCRIPTS[op.font] ? SCRIPTS[op.font].family : FONT); c.textAlign = op.anchor === "middle" ? "center" : op.anchor === "end" ? "right" : "left"; c.textBaseline = "alphabetic";
        c.fillText(op.str, op.x, op.y);
      }
      c.restore();
    });
    return canvas;
  }

  /* what is wrong with a page, in words (an empty list is a pass) */
  function validate(pg) {
    var out = [], n = stageN(pg.meta && pg.meta.stage), fl = floorPx(n);
    if (pg.w * 4 !== pg.h * 3) out.push("The page is not 3:4.");
    var minLine = 6;                                                     // never a line thinner than 6 px; real lines are 6.7 px and up
    pg.ops.forEach(function (op, i) {
      if (op.t !== "text") {
        var sw = op.t === "path" ? op.sw * op.k : op.sw;
        if (sw < minLine && !(op.t === "path" && op.stroke === "#fff")) out.push("Line " + (i + 1) + " is only " + f1(sw) + " px (needs " + minLine + " or more).");
        [op.fill, op.stroke].forEach(function (c) { if (c && ["none", "#fff", "#000"].indexOf(c) < 0) out.push("Line " + (i + 1) + " uses a color other than black or white."); });
      } else {
        if (op.role !== "code" && op.size < fl) out.push("Text “" + op.str.slice(0, 20) + "” is " + op.size + " px, under the stage floor of " + fl + " px.");
        var half = op.str.length * op.size * (op.bold ? 0.6 : 0.55) * (op.anchor === "middle" ? 0.5 : op.anchor === "end" ? 1 : 0);
        var left = op.anchor === "middle" ? op.x - half : op.anchor === "end" ? op.x - half : op.x, right = op.anchor === "middle" ? op.x + half : op.anchor === "end" ? op.x : op.x + op.str.length * op.size * (op.bold ? 0.6 : 0.55);
        if (left < 8 || right > W - 8 || op.y > H - 4) out.push("Text “" + op.str.slice(0, 20) + "” runs off the page.");
      }
      if (op.t === "rect" && (op.x < 0 || op.y < 0 || op.x + op.w > W || op.y + op.h > H)) out.push("A box runs off the page.");
    });
    (pg.meta && pg.meta.fit || []).forEach(function (m) { out.push(m); });
    return out;
  }

  return {
    VERSION: VERSION, W: W, H: H, PX_PER_PT: PT, FONT: FONT, LAYOUTS: LAYOUTS, STYLES: STYLES, BOX: BOX,
    registerPage: registerPage,
    GRID_FONT: GRID_FONT, kit: { newPage: newPage, P: P, block: block, fit: fit, wrap: wrap, header: header, footer: footer, subjectOps: subjectOps, subjectPaths: subjectPaths, strokeFor: strokeFor, bodyPx: bodyPx, floorPx: floorPx,
           stageN: stageN, rng: rng, hash: hash, smooth: smooth, W: W, H: H, PAD: PAD, PT: PT, BOX: BOX, drawCard: drawCard, cellsFor: cellsFor },
    strokeFor: strokeFor, bodyPx: bodyPx, floorPx: floorPx, chooseSubject: chooseSubject, subjectPaths: subjectPaths,
    composeColoring: composeColoring, sheetPages: sheetPages, packPrompts: packPrompts, toSVG: toSVG, toCanvas: toCanvas, validate: validate, hash: hash
  };
});
