/* =====================================================================
   Facility validator: is this batch of pages ready for a memory-care wing?

   It reads the pages the Activity Page Studio makes (the drawing
   operations of js/generators/coloring-pipeline.js, or any SVG text) and
   gives each batch a Clinical Readiness Score from 0 to 100:

     contrast and legibility  every line and fill is pure black on white
                              (contrast ratio from the colors themselves, 21:1
                              for black on white, 7:1 the floor), and no text is
                              under its stage's size floor;
     stroke weight            no line thinner than the minimum (3 pt on paper,
                              6 px on the 1200 x 1600 page) and the stage's own
                              line weight where the stage asks for heavier;
     negative space           the share of the page left empty, measured on a
                              60 x 80 grid, so a page is calm and not crowded;
     variety                  a batch is more than one kind of page, nothing
                              repeats, and a longer batch uses more than one domain;
     framework alignment      five practical checks drawn from how activity
                              professionals plan for dementia (below).

   The framework checks. Each names where the idea comes from; they are
   practical self-checks that SUPPORT a facility's own program and are not a
   clinical certification or a statement of regulatory compliance.

     interest     activities reflect a person's interests and lifestyle: a
                  reminiscence page tied to the years chosen, or the resident's own
                  interests (CMS F679, 42 CFR 483.24(c): "resident-centered
                  activities ... based on interests, needs and preferences").
     stage-fit    tasks are broken down for the stage: the whole task early, single
                  steps in the middle, three steps or a sensory look late
                  (Montessori-based dementia programming, C. Camp; occupational
                  therapy stage guidance).
     errorless    nothing can be got wrong: no quiz or test words, and no matching
                  or sorting at the late stage (Montessori-based programming;
                  CST practice).
     guidance     a staff note rides with each activity so one-to-one and
                  self-directed use is clear (CMS F679 guidance; NCCAP planning
                  models: one-to-one, small group, large group).
     variety      the domains in the batch (remembering, thinking, a meaningful
                  role, creative expression) are not all one (Montessori roles:
                  sensory, motor, cognitive).

   The limits are this module's own design limits, kept in LIMITS so a
   facility can change one in one place. They are not published standards.

   Works in the browser (window.CognicopiaFacilityValidator) and in Node.
   No network, no storage. report() writes one console block per batch.
   ===================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CognicopiaFacilityValidator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";
  var VERSION = "1.0.0";
  var W = 1200, H = 1600, PT = 160 / 72, COLS = 60, ROWS = 80;
  var LIMITS = {
    minStrokePx: 6,                                   // 3 pt on paper: the thinnest line anywhere
    stageLinePx: { 1: 3 * PT, 2: 4.5 * PT, 3: 6 * PT },
    floorTextPx: { 1: 18 * PT, 2: 20 * PT, 3: 24 * PT },
    minContrast: 7,                                   // the design system's own floor (AAA)
    /* the share of the page left empty, by kind of page and stage. Chosen a little under what the current library and sheets measure
       (text sheets 0.57 and up, coloring pages 0.70 and up at stages 1 and 2, 0.79 at stage 3), and calmer for later stages. */
    minWhite: { text: { 1: 0.50, 2: 0.50, 3: 0.55 }, coloring: { 1: 0.60, 2: 0.60, 3: 0.70 } },
    domains: 4
  };
  var WEIGHTS = { contrast: 20, stroke: 25, whitespace: 20, variety: 15, framework: 20 };
  var DOMAIN = { reminiscence: "Remembering", exercise: "Thinking", daily: "A meaningful role", coloring: "Creative expression" };
  var FRAMEWORKS = [
    { id: "interest",   label: "Reflects the resident's interests and years", source: "CMS F679 (42 CFR 483.24(c)): activities based on each resident's interests, needs and preferences" },
    { id: "stage-fit",  label: "Tasks are broken down for the stage",         source: "Montessori-based dementia programming (C. Camp); occupational therapy stage guidance" },
    { id: "errorless",  label: "Nothing can be got wrong",                    source: "Montessori-based programming; person-centered, failure-free practice" },
    { id: "guidance",   label: "A staff note rides with each activity",       source: "CMS F679 guidance on one-to-one and self-directed activities; NCCAP planning models" },
    { id: "variety",    label: "The batch uses more than one domain",         source: "Montessori roles (sensory, motor, cognitive); activity-professional program planning" }
  ];
  var QUIZ = /do you remember|remember when|what year|who is this|quiz|\btest\b|correct answer|wrong answer|can you (?:tell|name|recall)/i;
  var stageN = function (s) { s = Math.round(Number(s)); return s >= 1 && s <= 3 ? s : 2; };
  var pct = function (x) { return Math.max(0, Math.min(100, Math.round(x))); };

  /* ---------- color and contrast ---------- */
  var NAMED = { black: "#000000", white: "#ffffff" };
  function rgb(c) {
    c = String(c || "").trim().toLowerCase(); c = NAMED[c] || c;
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(c);
    if (!m) return null;
    var h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4), 16)];
  }
  function lum(v) { return 0.2126 * lin(v[0]) + 0.7152 * lin(v[1]) + 0.0722 * lin(v[2]); }
  function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  /* WCAG contrast of a color against white paper */
  function contrastOnWhite(color) {
    var v = rgb(color); if (!v) return 0;
    var l = lum(v); return Math.round((1.05 / (l + 0.05)) * 10) / 10;
  }

  /* ---------- the page, laid on a grid ---------- */
  function newGrid() { var g = []; for (var i = 0; i < COLS * ROWS; i++) g.push(0); return g; }
  function cell(g, x, y, hw) {
    var x0 = Math.floor((x - hw) / (W / COLS)), x1 = Math.floor((x + hw) / (W / COLS)), y0 = Math.floor((y - hw) / (H / ROWS)), y1 = Math.floor((y + hw) / (H / ROWS));
    for (var cy = Math.max(0, y0); cy <= Math.min(ROWS - 1, y1); cy++) for (var cx = Math.max(0, x0); cx <= Math.min(COLS - 1, x1); cx++) g[cy * COLS + cx] = 1;
  }
  function segment(g, x1, y1, x2, y2, hw) {
    var n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 8));
    for (var i = 0; i <= n; i++) cell(g, x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, hw);
  }
  function box(g, x, y, w, h) {
    for (var cy = Math.floor(y / (H / ROWS)); cy <= Math.floor((y + h) / (H / ROWS)); cy++) for (var cx = Math.floor(x / (W / COLS)); cx <= Math.floor((x + w) / (W / COLS)); cx++) if (cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS) g[cy * COLS + cx] = 1;
  }
  /* the points a path d passes through or is pulled toward (control points included), in order */
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
  /* occupancy of a page: the share of grid cells with nothing in them */
  function occupancy(pg) {
    var g = newGrid();
    pg.ops.forEach(function (op) {
      var hw = (op.sw || 1) / 2;
      if (op.t === "rect") {
        if (op.fill === "#000") box(g, op.x, op.y, op.w, op.h);
        segment(g, op.x, op.y, op.x + op.w, op.y, hw); segment(g, op.x + op.w, op.y, op.x + op.w, op.y + op.h, hw);
        segment(g, op.x + op.w, op.y + op.h, op.x, op.y + op.h, hw); segment(g, op.x, op.y + op.h, op.x, op.y, hw);
      } else if (op.t === "circle") {
        if (op.fill === "#000") box(g, op.cx - op.r, op.cy - op.r, op.r * 2, op.r * 2);
        for (var a = 0; a < 24; a++) cell(g, op.cx + op.r * Math.cos(a / 24 * 6.2832), op.cy + op.r * Math.sin(a / 24 * 6.2832), hw);
      } else if (op.t === "line") {
        segment(g, op.x1, op.y1, op.x2, op.y2, hw);
      } else if (op.t === "path") {
        if (op.stroke === "#fff") return;                              // the white center of a road marks nothing
        var k = op.k || 1, p = pathPoints(op.d).map(function (q) { return [q[0] * k + op.tx, q[1] * k + op.ty]; });
        for (var i = 1; i < p.length; i++) segment(g, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], hw * k);
      } else if (op.t === "text") {
        var w = op.str.length * op.size * (op.bold ? 0.6 : 0.55), x = op.anchor === "middle" ? op.x - w / 2 : op.anchor === "end" ? op.x - w : op.x;
        box(g, x, op.y - op.size * 0.8, w, op.size * 0.95);
      }
    });
    return g;
  }
  function whiteShare(g) { var used = 0; for (var i = 0; i < g.length; i++) used += g[i]; return { white: 1 - used / g.length, used: used, cells: g.length }; }
  /* the same measure taken from real pixels, so the estimate can be checked against what a browser draws */
  function occupancyFromCanvas(canvas) {
    var c = canvas.getContext("2d"), cw = canvas.width / COLS, ch = canvas.height / ROWS, g = newGrid(), d = c.getImageData(0, 0, canvas.width, canvas.height).data;
    for (var cy = 0; cy < ROWS; cy++) for (var cx = 0; cx < COLS; cx++) {
      var hit = 0, x0 = Math.floor(cx * cw), y0 = Math.floor(cy * ch), x1 = Math.floor((cx + 1) * cw), y1 = Math.floor((cy + 1) * ch);
      for (var y = y0; y < y1 && !hit; y++) for (var x = x0; x < x1; x++) { if (d[(y * canvas.width + x) * 4] < 128) { hit = 1; break; } }
      g[cy * COLS + cx] = hit;
    }
    return g;
  }

  /* ---------- one page ---------- */
  function validatePage(pg, ctx) {
    var n = stageN((pg.meta && pg.meta.stage) || (ctx && ctx.stage)), find = [], minStroke = Infinity, maxStroke = 0, minContrast = Infinity, minText = Infinity, colors = {}, textMin = LIMITS.floorTextPx[n];
    (pg.ops || []).forEach(function (op, i) {
      var cols = op.t === "text" ? ["#000"] : [op.fill, op.stroke || "#000"];
      /* white is the paper, not ink: only the colors that draw something are held to the contrast floor */
      cols.forEach(function (c) { if (c && c !== "none") { colors[c] = 1; if (c === "#fff" || c === "#ffffff") return; minContrast = Math.min(minContrast, contrastOnWhite(c)); } });
      if (op.t === "text") { if (op.role !== "code") minText = Math.min(minText, op.size); return; }
      if (op.t === "path" && op.stroke === "#fff") return;
      var sw = op.t === "path" ? op.sw * (op.k || 1) : op.sw;
      if (sw != null) { minStroke = Math.min(minStroke, sw); maxStroke = Math.max(maxStroke, sw); }
    });
    if (minStroke === Infinity) minStroke = null;
    if (minContrast === Infinity) minContrast = 21;
    if (minText === Infinity) minText = null;
    var wsh = whiteShare(occupancy(pg)), minWhite = LIMITS.minWhite[pg.meta && pg.meta.kind === "coloring" ? "coloring" : "text"][n];
    var contrastOk = minContrast >= LIMITS.minContrast && Object.keys(colors).every(function (c) { return ["#000", "#fff", "none", "#000000", "#ffffff"].indexOf(c) >= 0; });
    var textOk = minText == null || minText >= textMin - 0.5;
    var strokeOk = minStroke == null || minStroke >= LIMITS.minStrokePx;
    /* the drawing's main outline carries the stage's weight; its fine detail lines only have to clear the minimum */
    var strokeHeavy = minStroke == null || !pg.meta || pg.meta.kind !== "coloring" || maxStroke >= LIMITS.stageLinePx[n] - 0.5;
    var whiteOk = wsh.white >= minWhite;
    if (!contrastOk) find.push("A color other than black on white, or a contrast under " + LIMITS.minContrast + ":1 (lowest " + minContrast + ":1).");
    if (!textOk) find.push("Text of " + Math.round(minText) + " px is under the stage " + n + " floor of " + Math.round(textMin) + " px.");
    if (!strokeOk) find.push("A line of " + (Math.round(minStroke * 10) / 10) + " px is under the " + LIMITS.minStrokePx + " px minimum (3 pt).");
    if (!strokeHeavy) find.push("The drawing's main lines are " + (Math.round(maxStroke * 10) / 10) + " px, lighter than the stage " + n + " weight of " + (Math.round(LIMITS.stageLinePx[n] * 10) / 10) + " px.");
    if (!whiteOk) find.push("Only " + Math.round(wsh.white * 100) + " percent of the page is left empty; stage " + n + " needs " + Math.round(minWhite * 100) + " percent or more to stay calm.");
    return { stage: n, contrast: { min: minContrast, textMin: minText, ok: contrastOk && textOk }, stroke: { min: minStroke, ok: strokeOk && strokeHeavy }, whitespace: { ratio: Math.round(wsh.white * 1000) / 1000, min: minWhite, ok: whiteOk }, findings: find };
  }

  /* ---------- text of an SVG (the library's own drawings, or any other) ---------- */
  function scanSvg(svg, o) {
    o = o || {};
    var out = { strokes: [], colors: {}, findings: [] }, vb = /viewBox="([\d.\s-]+)"/.exec(svg), scale = o.scale || 1;
    if (vb) { var w = parseFloat(vb[1].split(/\s+/)[2]); if (w && o.pageWidth) scale = o.pageWidth / w; }
    (svg.match(/\sstroke-width="[^"]+"/g) || []).forEach(function (a) { var v = parseFloat(/"([^"]+)"/.exec(a)[1]); if (v === v) out.strokes.push(v * scale); });
    (svg.match(/\s(?:fill|stroke)="[^"]+"/g) || []).forEach(function (a) { var c = /"([^"]+)"/.exec(a)[1].toLowerCase(); if (c !== "none" && c !== "currentcolor") out.colors[c] = 1; });
    var min = out.strokes.length ? Math.min.apply(null, out.strokes) : null, floor = o.minStrokePx || LIMITS.minStrokePx;
    if (min != null && min < floor) out.findings.push("A line of " + Math.round(min * 10) / 10 + " px is under the " + floor + " px minimum.");
    Object.keys(out.colors).forEach(function (c) { if (contrastOnWhite(c) < LIMITS.minContrast) out.findings.push("The color " + c + " has a contrast of " + contrastOnWhite(c) + ":1, under " + LIMITS.minContrast + ":1."); });
    out.minStroke = min;
    return out;
  }

  /* ---------- the batch ---------- */
  function sheetText(pg) { return (pg.ops || []).filter(function (o) { return o.t === "text"; }).map(function (o) { return o.str; }).join(" "); }
  function validateBatch(pages, ctx) {
    ctx = ctx || {};
    var per = pages.map(function (pg) { return validatePage(pg, ctx); }), N = pages.length, find = [];
    per.forEach(function (r, i) { r.findings.forEach(function (f) { find.push("Page " + (i + 1) + ": " + f); }); });
    var frac = function (fn) { return N ? per.filter(fn).length / N : 0; };
    var contrast = pct(frac(function (r) { return r.contrast.ok; }) * 100), stroke = pct(frac(function (r) { return r.stroke.ok; }) * 100);
    var white = pct(per.reduce(function (s, r) { return s + Math.min(1, r.whitespace.ratio / r.whitespace.min); }, 0) / Math.max(1, N) * 100);
    /* variety: more than one domain, nothing twice */
    var kinds = {}, titles = {}, dup = 0;
    pages.forEach(function (pg) { var m = pg.meta || {}; kinds[m.module || m.kind || "?"] = 1; var key = (m.title || "") + "|" + sheetText(pg).slice(0, 80); if (titles[key]) dup++; titles[key] = 1; });
    var domains = Object.keys(kinds).length, want = Math.min(LIMITS.domains, N >= 4 ? 3 : N >= 2 ? 2 : 1);
    var variety = pct(Math.min(1, domains / want) * 100 - dup * (100 / Math.max(1, N)));
    if (domains < want) find.push("The batch uses " + domains + " kind" + (domains === 1 ? "" : "s") + " of page; " + want + " or more makes it more engaging.");
    if (dup) find.push(dup + " page" + (dup === 1 ? " repeats" : "s repeat") + " another in the batch.");
    /* framework alignment */
    var mods = pages.map(function (pg) { return (pg.meta && pg.meta.module) || ""; }), stage = stageN(ctx.stage || (pages[0] && pages[0].meta && pages[0].meta.stage));
    var texts = pages.map(sheetText).join(" ");
    var steps = pages.filter(function (pg) { return pg.meta && pg.meta.sheetKind === "steps"; });
    var tests = pages.some(function (pg) { return pg.meta && (pg.meta.sheetKind === "match" || pg.meta.sheetKind === "sort"); });
    var chk = {
      interest: mods.indexOf("reminiscence") >= 0 || !!(ctx.interests && String(ctx.interests).trim()),
      "stage-fit": steps.every(function (pg) { var k = pg.meta.steps; return stage === 3 ? k <= 4 : stage === 2 ? k <= 5 : k >= 4; }),
      errorless: !QUIZ.test(texts) && (stage !== 3 || !tests),
      guidance: pages.every(function (pg) { var m = pg.meta || {}; return m.module === "coloring" || !!m.staff; }),
      variety: domains >= want
    };
    var fw = FRAMEWORKS.map(function (f) { return { id: f.id, label: f.label, source: f.source, pass: !!chk[f.id] }; });
    fw.filter(function (f) { return !f.pass; }).forEach(function (f) { find.push("Framework: " + f.label + " is not met."); });
    var framework = pct(fw.filter(function (f) { return f.pass; }).length / fw.length * 100);
    var parts = { contrast: contrast, stroke: stroke, whitespace: white, variety: variety, framework: framework };
    var score = pct(Object.keys(WEIGHTS).reduce(function (s, k) { return s + parts[k] * WEIGHTS[k]; }, 0) / 100);
    var level = score >= 90 && !find.length ? "Ready" : score >= 75 ? "Ready with notes" : "Review before printing";
    return { version: VERSION, pages: N, score: score, level: level, parts: parts, weights: WEIGHTS, framework: fw, domains: Object.keys(kinds).map(function (k) { return DOMAIN[k] || k; }), perPage: per, findings: find };
  }

  /* ---------- the console report for a batch ---------- */
  function format(r) {
    var L = ["Clinical Readiness Score: " + r.score + " / 100 (" + r.level + ") for " + r.pages + " page" + (r.pages === 1 ? "" : "s")];
    L.push("  contrast and legibility " + r.parts.contrast + "   stroke weight " + r.parts.stroke + "   negative space " + r.parts.whitespace + "   variety " + r.parts.variety + "   framework alignment " + r.parts.framework);
    L.push("  domains: " + (r.domains.join(", ") || "none"));
    r.framework.forEach(function (f) { L.push("  " + (f.pass ? "[met]    " : "[not met]") + " " + f.label); });
    r.findings.forEach(function (f) { L.push("  note: " + f); });
    L.push("  A self-check that supports a facility's own program; it is not a clinical certification.");
    return L.join("\n");
  }
  function report(r, o) {
    var text = format(r);
    if (!o || o.silent !== true) { var c = o && o.console || root.console; if (c && c.info) c.info("[Cognicopia facility check]\n" + text); }
    return text;
  }

  return {
    VERSION: VERSION, LIMITS: LIMITS, WEIGHTS: WEIGHTS, FRAMEWORKS: FRAMEWORKS,
    contrastOnWhite: contrastOnWhite, occupancy: occupancy, occupancyFromCanvas: occupancyFromCanvas, whiteShare: whiteShare, pathPoints: pathPoints,
    validatePage: validatePage, validateBatch: validateBatch, scanSvg: scanSvg, format: format, report: report
  };
});
