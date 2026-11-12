/* =====================================================================
   Activity pages: how the sheets of js/generators/activity-modules.js are
   drawn on the 3:4 page.

   Each composer takes a sheet and returns a page (a list of drawing
   operations, js/generators/coloring-pipeline.js). All of them keep to the
   same rules as the rest of the studio: pure black on white, lines of
   3 pt or more, type at the stage's size or larger, one idea to a page,
   nothing off the sheet. Shapes are plain geometry (a circle, a star);
   pictures are the finished drawings in the coloring library.

     wordgrid     a large-print letter grid and its word list
     scramble     mixed-up words with boxes to write in
     timeline     lettered cards and a box for each to number
     memory       pairs of cut-out cards in rows and columns, dashed cut lines
     dialogue     a theme, a ladder of questions, a line to note each answer,
                  and a response log for the care record
     household    pictures or materials on the left, names on the right
     phrases      the start of a saying or song line and a line to finish it
     shapes       shapes to match, a shape to point to, colors to name

   Works in the browser and in Node. No network, no storage.
   ===================================================================== */
(function (root) {
  "use strict";
  var PL = root.CognicopiaColoringPipeline;
  if (!PL || !PL.registerPage || !PL.kit) return;
  var K = PL.kit, P = K.P, W = K.W, H = K.H, PAD = K.PAD;

  function base(sh) {
    var n = K.stageN(sh.stage), dex = sh.dexterity || "steady";
    return { n: n, dex: dex, lw: K.lineOf ? K.lineOf(sh, n, dex) : K.strokeFor(n, dex), bp: K.bodyPx(n, dex), fl: K.floorPx(n) };
  }
  function page(sh, kind) { return K.newPage({ kind: kind, title: sh.title, stage: K.stageN(sh.stage), code: sh.code }); }

  /* ---------- plain shapes, as closed outlines ---------- */
  function shapePath(name, cx, cy, s) {
    var r = s / 2, i, a, pts = [], f = function (n) { return Math.round(n * 10) / 10; };
    var poly = function (p) { return p.map(function (q, j) { return (j ? "L" : "M") + f(q[0]) + " " + f(q[1]); }).join("") + "Z"; };
    if (name === "circle" || name === "oval") {
      var rx = name === "oval" ? r * 1.0 : r, ry = name === "oval" ? r * 0.62 : r, k = 0.5523;
      return "M" + f(cx - rx) + " " + f(cy) + "C" + f(cx - rx) + " " + f(cy - ry * k) + " " + f(cx - rx * k) + " " + f(cy - ry) + " " + f(cx) + " " + f(cy - ry) +
        "C" + f(cx + rx * k) + " " + f(cy - ry) + " " + f(cx + rx) + " " + f(cy - ry * k) + " " + f(cx + rx) + " " + f(cy) +
        "C" + f(cx + rx) + " " + f(cy + ry * k) + " " + f(cx + rx * k) + " " + f(cy + ry) + " " + f(cx) + " " + f(cy + ry) +
        "C" + f(cx - rx * k) + " " + f(cy + ry) + " " + f(cx - rx) + " " + f(cy + ry * k) + " " + f(cx - rx) + " " + f(cy) + "Z";
    }
    if (name === "square") return poly([[cx - r * 0.85, cy - r * 0.85], [cx + r * 0.85, cy - r * 0.85], [cx + r * 0.85, cy + r * 0.85], [cx - r * 0.85, cy + r * 0.85]]);
    if (name === "triangle") return poly([[cx, cy - r], [cx + r * 1.05, cy + r * 0.8], [cx - r * 1.05, cy + r * 0.8]]);
    if (name === "diamond") return poly([[cx, cy - r], [cx + r * 0.75, cy], [cx, cy + r], [cx - r * 0.75, cy]]);
    if (name === "star") { for (i = 0; i < 10; i++) { a = -Math.PI / 2 + i * Math.PI / 5; var rr = i % 2 ? r * 0.45 : r; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); } return poly(pts); }
    if (name === "cross") { var t = r * 0.34; return poly([[cx - t, cy - r], [cx + t, cy - r], [cx + t, cy - t], [cx + r, cy - t], [cx + r, cy + t], [cx + t, cy + t], [cx + t, cy + r], [cx - t, cy + r], [cx - t, cy + t], [cx - r, cy + t], [cx - r, cy - t], [cx - t, cy - t]]); }
    /* heart */
    return "M" + f(cx) + " " + f(cy + r * 0.9) + "C" + f(cx - r * 1.5) + " " + f(cy - r * 0.1) + " " + f(cx - r * 0.7) + " " + f(cy - r * 1.1) + " " + f(cx) + " " + f(cy - r * 0.35) +
      "C" + f(cx + r * 0.7) + " " + f(cy - r * 1.1) + " " + f(cx + r * 1.5) + " " + f(cy - r * 0.1) + " " + f(cx) + " " + f(cy + r * 0.9) + "Z";
  }
  function drawShape(pg, name, cx, cy, size, lw) { P.path(pg, shapePath(name, cx, cy, size), lw, "none", "#000"); }

  /* ---------- word grid ---------- */
  function wordgrid(sh) {
    var b = base(sh), pg = page(sh, "wordgrid"), y0 = K.header(pg, sh), words = sh.words, cols = words.length > 12 ? 4 : 3, rowsW = Math.ceil(words.length / cols);
    var wsize = Math.max(b.fl, Math.round(b.bp * 0.9)), wrow = wsize * 1.4, listH = rowsW * wrow + 30;
    var avail = H - 70 - listH - y0 - 20, cell = Math.floor(Math.min((W - 2 * PAD - 40) / sh.size, avail / sh.size)), gw = cell * sh.size, gx = Math.round((W - gw) / 2), gy = Math.round(y0 + 10);
    P.rect(pg, gx - 14, gy - 14, gw + 28, gw + 28, 20, b.lw, "none");
    var ls = Math.max(b.fl, Math.round(cell * 0.6));
    for (var r = 0; r < sh.size; r++) for (var c = 0; c < sh.size; c++) P.text(pg, gx + c * cell + cell / 2, gy + r * cell + cell / 2 + ls * 0.36, ls, sh.rows[r].charAt(c), { bold: true, anchor: "middle", font: "grid" });
    var ly = gy + gw + 44, colW = (W - 2 * PAD) / cols;
    words.forEach(function (w, i) { var f = K.fit(w, wsize, b.fl, colW - 30, wrow, true); P.text(pg, PAD + (i % cols) * colW + colW / 2, ly + Math.floor(i / cols) * wrow + f.size * 0.82, f.size, w, { bold: true, anchor: "middle" }); });
    K.footer(pg, sh.code); return pg;
  }
  function scramble(sh) {
    var b = base(sh), pg = page(sh, "scramble"), y0 = K.header(pg, sh), items = sh.items, rh = (H - 90 - y0) / items.length;
    items.forEach(function (it, i) {
      var y = y0 + i * rh, big = Math.max(b.fl, Math.round(b.bp * 1.5)), txt = it.scr.split("").join(" ");
      if (sh.roomy) P.rect(pg, PAD, y + 2, W - 2 * PAD, rh - 14, 22, b.lw, "none");
      else if (i) P.line(pg, PAD, y - 6, W - PAD, y - 6, Math.max(7, b.lw * 0.7), "", "rule");
      P.text(pg, PAD + 10, y + 54, b.fl, String(i + 1) + ".", { bold: true });
      var f = K.fit(txt, big, b.fl, W - 2 * PAD - 100, 120, true); P.text(pg, W / 2 + 30, y + 40 + f.size * 0.8, f.size, txt, { bold: true, anchor: "middle" });
      var bw = Math.min(84, Math.floor((W - 2 * PAD - 120) / it.len) - 8), tot = it.len * (bw + 8) - 8, bx = Math.round((W - tot) / 2) + 30, by = y + rh - 120;
      for (var k = 0; k < it.len; k++) P.rect(pg, bx + k * (bw + 8), by, bw, 84, 10, b.lw, k === 0 ? "none" : "none");
      P.text(pg, bx + bw / 2, by + 60, Math.round(bw * 0.7), it.first, { bold: true, anchor: "middle" });
    });
    K.footer(pg, sh.code); return pg;
  }

  /* ---------- timeline ---------- */
  function timeline(sh) {
    var b = base(sh), pg = page(sh, "timeline"), y0 = K.header(pg, sh), cards = sh.cards, rh = (H - 90 - y0) / cards.length, r = Math.min(46, rh * 0.22);
    cards.forEach(function (c, i) {
      var y = y0 + i * rh, cy = y + rh / 2, bx = PAD + 20 + r * 2 + 24, bw = W - bx - PAD - 150, bh = Math.min(rh - 30, 200);
      P.circle(pg, PAD + 20 + r, cy, r, b.lw, "none"); P.text(pg, PAD + 20 + r, cy + Math.max(b.fl, r * 1.1) * 0.36, Math.max(b.fl, Math.round(r * 1.1)), c.id, { bold: true, anchor: "middle" });
      P.rect(pg, bx, cy - bh / 2, bw, bh, 18, b.lw, "none");
      var f = K.fit(c.text, Math.round(b.bp * 1.05), b.fl, bw - 40, bh - 24, true); K.block(pg, f.lines, bx + 22, cy - f.h / 2, f.size, { bold: true });
      P.rect(pg, W - PAD - 110, cy - 55, 110, 110, 16, b.lw, "none");
    });
    P.text(pg, W - PAD - 65, y0 - 6, b.fl, "Number", { bold: true, anchor: "middle" });
    K.footer(pg, sh.code); return pg;
  }

  /* ---------- memory pairs ---------- */
  function memory(sh) {
    var b = base(sh), pg = page(sh, "memory"), cols = sh.cols, rows = Math.ceil(sh.cards.length / cols), m = 40, gap = 40, title = 90;
    var t = K.fit("Cut along the dashed lines", Math.max(b.fl, Math.round(b.bp * 0.85)), b.fl, W - 2 * PAD, 70, true); K.block(pg, t.lines, W / 2, 22, t.size, { bold: true, anchor: "middle" });
    var top = 22 + t.h + 20, cw = (W - 2 * m - gap * (cols - 1)) / cols, ch = (H - top - 70 - gap * (rows - 1)) / rows;
    sh.cards.forEach(function (c, i) {
      var cx = m + (i % cols) * (cw + gap), cy = top + Math.floor(i / cols) * (ch + gap);
      P.rect(pg, cx, cy, cw, ch, 22, b.lw, "none");
      var paths = K.subjectPaths(c.pic), wd = K.fit(c.word, Math.round(b.bp * 0.95), b.fl, cw - 24, 80, true), picH = ch - wd.h - 36;
      if (paths) K.subjectOps(pg, paths, { x: cx + 14, y: cy + 14, w: cw - 28, h: picH }, b.lw, b.n);
      K.block(pg, wd.lines, cx + cw / 2, cy + ch - wd.h - 14, wd.size, { bold: true, anchor: "middle" });
    });
    for (var c2 = 1; c2 < cols; c2++) P.line(pg, m + c2 * (cw + gap) - gap / 2, top - 10, m + c2 * (cw + gap) - gap / 2, H - 56, 7, "18 14", "guide");
    for (var r2 = 1; r2 < rows; r2++) P.line(pg, 14, top + r2 * (ch + gap) - gap / 2, W - 14, top + r2 * (ch + gap) - gap / 2, 7, "18 14", "guide");
    void title; K.footer(pg, sh.code); return pg;
  }

  /* ---------- dialogue ---------- */
  function dialogue(sh) {
    /* the room under each question is ruled for the answer; fewer rules are drawn when more would crowd the page */
    var b0 = base(sh), pgOut = null;
    for (var most = 3; most >= 1; most--) { pgOut = dialogueWith(sh, most); if (K.whiteShare(pgOut) >= PL.CALM_WHITE[b0.n] + 0.012) break; }
    return pgOut;
  }
  function dialogueWith(sh, most) {
    var b = base(sh), pg = page(sh, "dialogue"), y0 = K.header(pg, sh), logH = 290, qs = sh.questions, area = H - 70 - logH - y0, extraH = sh.extra ? 150 : 0, rh = (area - extraH) / qs.length;
    if (sh.extra) { var ex = K.fit(sh.extra, b.fl + 4, b.fl, W - 2 * PAD - 60, 110, false); P.rect(pg, PAD, y0, W - 2 * PAD, 130, 16, b.lw, "none"); K.block(pg, ex.lines, PAD + 30, y0 + (130 - ex.h) / 2, ex.size, {}); y0 += extraH; }
    var r = Math.min(40, rh * 0.18);
    qs.forEach(function (q, i) {
      var y = y0 + i * rh; P.circle(pg, PAD + 20 + r, y + r + 6, r, b.lw, "none"); P.text(pg, PAD + 20 + r, y + r + 6 + Math.max(b.fl, r * 1.1) * 0.36, Math.max(b.fl, Math.round(r * 1.1)), String(i + 1), { bold: true, anchor: "middle" });
      var tx = PAD + 20 + r * 2 + 24, f = K.fit(q, Math.round(b.bp * 1.1), b.fl, W - tx - PAD, rh - 80, true), yq = K.block(pg, f.lines, tx, y, f.size, { bold: true });
      /* at least as many rules as keep the room from reading as an empty band, spread evenly down it */
      var last = y + rh - 34, room = last - yq, step = Math.max(b.fl * 2.3, 96), nl = Math.max(Math.ceil(room / 380), Math.min(most, Math.floor((room - 20) / step)), 1);
      for (var li = 1; li <= nl; li++) P.line(pg, tx, yq + room * li / nl, W - PAD, yq + room * li / nl, li === nl ? b.lw : Math.max(7, b.lw * 0.7), "", "rule");
    });
    var ly = H - 60 - logH; P.rect(pg, PAD, ly, W - 2 * PAD, logH, 18, b.lw, "none");
    P.text(pg, PAD + 24, ly + 20 + b.fl * 0.8, b.fl, "For staff: how it went", { bold: true });
    var bw = (W - 2 * PAD - 48) / 2;
    sh.log.forEach(function (lab, i) { var x = PAD + 24 + (i % 2) * bw, y = ly + 80 + Math.floor(i / 2) * 70; P.rect(pg, x, y, 44, 44, 6, b.lw, "none"); P.text(pg, x + 62, y + 36, b.fl, lab, {}); });
    P.text(pg, PAD + 24, ly + logH - 40, b.fl, "Date ________   Staff ________", {});
    K.footer(pg, sh.code); return pg;
  }

  /* ---------- household ---------- */
  function household(sh) {
    var b = base(sh), pg = page(sh, "household"), y0 = K.header(pg, sh), rows = sh.left.length, rh = (H - 90 - y0) / rows;
    sh.left.forEach(function (l, i) {
      var cy = y0 + i * rh + rh / 2, right = sh.right[i];
      if (sh.roomy) P.rect(pg, PAD - 6, cy - rh / 2 + 6, W - 2 * PAD + 12, rh - 12, 22, b.lw, "none");
      if (l.pic) { var ps = K.subjectPaths(l.pic); if (ps) K.subjectOps(pg, ps, { x: PAD, y: cy - rh / 2 + 8, w: 380, h: rh - 16 }, b.lw, b.n); }
      else { var f = K.fit(l.word, Math.round(b.bp * 1.2), b.fl, 380, rh - 16, true); K.block(pg, f.lines, PAD + 10, cy - f.h / 2, f.size, { bold: true }); }
      var g = K.fit(right, Math.round(b.bp * 1.2), b.fl, 350, rh - 16, true); K.block(pg, g.lines, W - PAD - 10, cy - g.h / 2, g.size, { bold: true, anchor: "end" });
      P.circle(pg, 500, cy, 22, b.lw, "none"); P.circle(pg, 640, cy, 22, b.lw, "none");
    });
    K.footer(pg, sh.code); return pg;
  }

  /* ---------- phrases ---------- */
  function phrases(sh) {
    var b = base(sh), pg = page(sh, "phrases"), y0 = K.header(pg, sh), bankH = sh.bank ? 215 : 0, rows = sh.items.length, rh = (H - 90 - bankH - y0) / rows;
    sh.items.forEach(function (it, i) {
      var y = y0 + i * rh, f = K.fit(it.start, Math.round(b.bp * 1.0), b.fl, W - 2 * PAD - 20, rh - 70, true);
      if (sh.roomy) P.rect(pg, PAD, y + 4, W - 2 * PAD, rh - 16, 22, b.lw, "none");
      K.block(pg, f.lines, PAD + 10, y + (sh.roomy ? 18 : 0), f.size, { bold: true });
      P.line(pg, PAD + 10, y + rh - 36, W - PAD - 10, y + rh - 36, b.lw, "", "rule");
    });
    if (sh.bank) {
      var by = H - 90 - bankH + 10; P.rect(pg, PAD, by, W - 2 * PAD, bankH - 20, 18, b.lw, "none");
      P.text(pg, PAD + 24, by + 18 + b.fl * 0.8, b.fl, "Endings to choose from", { bold: true });
      var f2 = K.fit(sh.bank.join("   ·   "), Math.round(b.bp * 0.95), b.fl, W - 2 * PAD - 60, bankH - 100, false); K.block(pg, f2.lines, PAD + 30, by + 28 + b.fl * 1.3, f2.size, {});
    }
    K.footer(pg, sh.code); return pg;
  }

  /* ---------- shapes and colors ---------- */
  function shapes(sh) {
    var b = base(sh), pg = page(sh, "shapes"), y0 = K.header(pg, sh);
    if (sh.mode === "match") {
      var rows = sh.left.length, rh = (H - 90 - y0) / rows, size = Math.min(210, rh - 40);
      sh.left.forEach(function (n, i) {
        var cy = y0 + i * rh + rh / 2; drawShape(pg, n, 270, cy, size, b.lw); drawShape(pg, sh.right[i], W - 270, cy, size, b.lw);
        P.circle(pg, 470, cy, 22, b.lw, "none"); P.circle(pg, 730, cy, 22, b.lw, "none");
      });
    } else if (sh.mode === "point") {
      var ts = 380, ty = y0 + 30 + ts / 2; drawShape(pg, sh.target, W / 2, ty, ts, b.lw);
      var oy = ty + ts / 2 + 70, oh = H - 90 - oy, ow = (W - 2 * PAD - 40) / 2, os = Math.min(300, oh - 60);
      sh.options.forEach(function (o, i) { var x = PAD + i * (ow + 40); P.rect(pg, x, oy, ow, oh, 24, b.lw, "none"); drawShape(pg, o, x + ow / 2, oy + oh / 2, os, b.lw); });
    } else {
      var cs = sh.colors, n = cs.length, rh2 = (H - 90 - y0) / n;
      cs.forEach(function (c, i) {
        var y = y0 + i * rh2, sz = Math.min(rh2 - 60, 240); P.rect(pg, PAD, y + 8, W - 2 * PAD, rh2 - 24, 24, b.lw, "none");
        drawShape(pg, c.shape, PAD + 40 + sz / 2, y + rh2 / 2 - 4, sz, b.lw);
        var big = K.fit(c.word, Math.round(b.bp * 2), b.fl, W - 2 * PAD - sz - 140, 140, true); P.text(pg, PAD + 80 + sz, y + rh2 / 2 - 6 + big.size * 0.3, big.size, c.word, { bold: true });
        var sm = K.fit("Find " + c.thing + ".", b.bp, b.fl, W - 2 * PAD - sz - 140, 90, false); K.block(pg, sm.lines, PAD + 80 + sz, y + rh2 / 2 + big.size * 0.45, sm.size, {});
      });
    }
    K.footer(pg, sh.code); return pg;
  }

  /* ---------- the staff answer key ---------- */
  function answers(sh) {
    var b = base(sh), size = b.fl, lh = Math.round(size * 1.34), rows = [], made = [], i = 0, n = 0;
    (sh.groups || []).forEach(function (g) {
      rows.push({ bold: true, t: g.title });
      (g.lines || []).forEach(function (l) {
        K.wrap(String(l), size, W - 2 * PAD - 60, false).forEach(function (part, k) { rows.push({ bold: false, t: (k ? "    " : "") + part }); });
      });
    });
    if (!rows.length) rows.push({ bold: false, t: "This packet has no answers to give." });
    var head = { title: "Answer key", subtitle: "For staff. Keep this page out of the resident's packet.", stage: sh.stage, dexterity: sh.dexterity };
    while (i < rows.length && n < 12) {
      var pg = K.newPage({ kind: "answers", title: "Answer key", stage: K.stageN(sh.stage), code: sh.code + (n ? "-" + (n + 1) : "") });
      var y = K.header(pg, head), room = Math.max(1, Math.floor((H - 90 - y) / lh));
      for (var k = 0; k < room && i < rows.length; k++, i++) P.text(pg, PAD + 10, y + 12 + k * lh + size * 0.8, size, rows[i].t, { bold: rows[i].bold });
      K.footer(pg, pg.meta.code); made.push(pg); n++;
    }
    return made;
  }

  PL.registerPage("answers", answers); PL.registerPage("wordgrid", wordgrid); PL.registerPage("scramble", scramble); PL.registerPage("timeline", timeline); PL.registerPage("memory", memory);
  PL.registerPage("dialogue", dialogue); PL.registerPage("household", household); PL.registerPage("phrases", phrases); PL.registerPage("shapes", shapes);
})(typeof globalThis !== "undefined" ? globalThis : this);
