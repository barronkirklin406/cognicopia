/* =====================================================================
   Cognicopia Clinical Activities: the activity engine.

   One generator for every stage-aware page the packet tool (index.html)
   and the Packet Builder (builder.html) print beyond their older page
   makers. Each page is made from a seed (the resident's first name, the
   calendar date and a variant number), so the same resident gets the same
   page all day, tomorrow's is different, and the layout never moves.

   Early (GDS 3-4)     12 x 12 and 15 x 15 word searches with slanted words,
                       word ladders, anagrams with clues, sorting two groups,
                       odd one out (words or pictures), multi-step order
                       cards, a maze with a long way round, a daily page.
   Middle (GDS 5)      guided 8 x 8 word searches, finishing a familiar
                       phrase from two or three choices, matching a 1950s or
                       60s thing to its bold name, a lane to trace, order
                       cards with the first step given, an iconic shape
                       inside a pattern frame to color.
   Late (GDS 6-7)      a high-contrast shape inside a bold pattern frame,
                       a wide lane to trace, a large-print maze with few
                       turns, a day, season and weather page, big words
                       to choose between, three pictures to match.

   Everything is held to the stage's rules in ClinicalMatrix.js: type no
   smaller than the stage's floor (24 pt and extra bold at the late stage),
   lines no thinner than the stage's floor (6 px at the late stage, 8 px
   for the shapes a hand is asked to follow), pure black on white, nothing
   outside the page's 0.5 in margins, and the adult-dignity filter on every
   word. A page that breaks a rule is not returned: the generator draws it
   again from the next seed, and throws if it cannot.

   A page is vector data (a "page model"): { w, h, stage, frame, items:
   [{ d, fill, w, role }], texts: [{ text, x, y, size, bold, align, role }],
   meta }. toPDF draws it on a jsPDF document, toSVG returns an SVG, and the
   same model is what ClinicalMatrix.validatePage checks.

   Runs in the browser (window.CognicopiaClinicalActivities) and in Node
   (vm). It makes no network request, reads no file, uses no browser
   storage and never calls the browser's own random function.
   ===================================================================== */
(function (root) {
  "use strict";
  var VERSION = "1.0.0";
  var CM = root.CognicopiaClinicalMatrix;
  if (!CM) throw new Error("Load src/engine/ClinicalMatrix.js before ClinicalActivities.js.");
  var PCG = root.CognicopiaPCG || {};
  var SAFE = CM.SAFE;
  var TAU = Math.PI * 2;
  var MAX_ATTEMPTS = 40;

  /* ---------- drawing helpers (path data: absolute M, L, C and Z) ---------- */
  var r2 = function (v) { var r = Math.round(v * 100) / 100; return r === 0 ? 0 : r; };
  var pt = function (x, y) { return r2(x) + " " + r2(y); };
  var KAPPA = 0.5522847498;
  function dLine(ax, ay, bx, by) { return "M" + pt(ax, ay) + "L" + pt(bx, by); }
  function dPoly(points, close) {
    return points.map(function (p, i) { return (i ? "L" : "M") + pt(p[0], p[1]); }).join("") + (close ? "Z" : "");
  }
  function dEllipse(cx, cy, rx, ry) {
    var kx = KAPPA * rx, ky = KAPPA * ry;
    return "M" + pt(cx + rx, cy) + "C" + pt(cx + rx, cy + ky) + " " + pt(cx + kx, cy + ry) + " " + pt(cx, cy + ry) +
      "C" + pt(cx - kx, cy + ry) + " " + pt(cx - rx, cy + ky) + " " + pt(cx - rx, cy) +
      "C" + pt(cx - rx, cy - ky) + " " + pt(cx - kx, cy - ry) + " " + pt(cx, cy - ry) +
      "C" + pt(cx + kx, cy - ry) + " " + pt(cx + rx, cy - ky) + " " + pt(cx + rx, cy) + "Z";
  }
  var dCircle = function (cx, cy, r) { return dEllipse(cx, cy, r, r); };
  function dRect(x, y, w, h, rad) {
    rad = Math.max(0, Math.min(rad || 0, w / 2, h / 2));
    if (!rad) return "M" + pt(x, y) + "L" + pt(x + w, y) + "L" + pt(x + w, y + h) + "L" + pt(x, y + h) + "Z";
    var k = KAPPA * rad;
    return "M" + pt(x + rad, y) + "L" + pt(x + w - rad, y) + "C" + pt(x + w - rad + k, y) + " " + pt(x + w, y + rad - k) + " " + pt(x + w, y + rad) +
      "L" + pt(x + w, y + h - rad) + "C" + pt(x + w, y + h - rad + k) + " " + pt(x + w - rad + k, y + h) + " " + pt(x + w - rad, y + h) +
      "L" + pt(x + rad, y + h) + "C" + pt(x + rad - k, y + h) + " " + pt(x, y + h - rad + k) + " " + pt(x, y + h - rad) +
      "L" + pt(x, y + rad) + "C" + pt(x, y + rad - k) + " " + pt(x + rad - k, y) + " " + pt(x + rad, y) + "Z";
  }
  /* the path data of a page model is parsed by this, so the model needs nothing else to be drawn */
  var TOK = /[MLCZmlcz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
  function parse(d) {
    var t = String(d).match(TOK) || [], out = [], i = 0, cmd = "";
    while (i < t.length) {
      if (/[A-Za-z]/.test(t[i])) { cmd = t[i++].toUpperCase(); if (cmd === "Z") { out.push({ op: "Z" }); continue; } }
      if (cmd === "M" || cmd === "L") { out.push({ op: cmd, p: [+t[i], +t[i + 1]] }); i += 2; if (cmd === "M") cmd = "L"; }
      else if (cmd === "C") { out.push({ op: "C", c1: [+t[i], +t[i + 1]], c2: [+t[i + 2], +t[i + 3]], p: [+t[i + 4], +t[i + 5]] }); i += 6; }
      else i++;
    }
    return out;
  }
  function bbox(segs, b) {
    b = b || [Infinity, Infinity, -Infinity, -Infinity];
    var cur = null, add = function (x, y) { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; };
    segs.forEach(function (s) {
      if (s.op === "Z") return;
      if (s.op === "C" && cur) for (var k = 1; k < 12; k++) {
        var t = k / 12, u = 1 - t;
        add(u * u * u * cur[0] + 3 * u * u * t * s.c1[0] + 3 * u * t * t * s.c2[0] + t * t * t * s.p[0],
            u * u * u * cur[1] + 3 * u * u * t * s.c1[1] + 3 * u * t * t * s.c2[1] + t * t * t * s.p[1]);
      }
      add(s.p[0], s.p[1]); cur = s.p;
    });
    return b;
  }
  function mapSegs(segs, k, dx, dy) {
    var m = function (p) { return [dx + p[0] * k, dy + p[1] * k]; };
    return segs.map(function (s) { return s.op === "Z" ? s : s.op === "C" ? { op: "C", c1: m(s.c1), c2: m(s.c2), p: m(s.p) } : { op: s.op, p: m(s.p) }; });
  }
  function segsToD(segs) {
    return segs.map(function (s) {
      if (s.op === "Z") return "Z";
      if (s.op === "C") return "C" + pt(s.c1[0], s.c1[1]) + " " + pt(s.c2[0], s.c2[1]) + " " + pt(s.p[0], s.p[1]);
      return s.op + pt(s.p[0], s.p[1]);
    }).join("");
  }

  /* ---------- measuring text ----------
     The widths of every printable ASCII character in Atkinson Hyperlegible (the face every page is set in),
     regular and bold, in 1/1000 em, read from the font files. Layout never has to guess how wide a word is,
     and a page maker can promise that nothing runs off its box. A host with the real font loaded may pass
     its own measure(text, size, bold) instead. */
  var W_REG = [280, 281, 301, 655, 594, 927, 705, 160, 300, 300, 433, 602, 205, 368, 205, 377, 648, 402, 549, 574, 614, 583, 598, 510, 615, 598, 205, 205, 553, 602, 553, 520, 780, 626, 619, 656, 673, 567, 548, 710, 690, 414, 510, 627, 539, 820, 689, 727, 601, 753, 618, 596, 558, 690, 589, 840, 623, 595, 607, 315, 377, 315, 552, 396, 268, 526, 566, 500, 564, 539, 311, 560, 546, 278, 254, 490, 239, 841, 546, 552, 566, 576, 340, 471, 324, 536, 441, 654, 461, 429, 460, 319, 233, 319, 555];
  var W_BOLD = [320, 283, 410, 783, 619, 977, 702, 222, 366, 366, 434, 618, 243, 374, 243, 442, 652, 448, 586, 605, 626, 612, 632, 543, 625, 561, 243, 243, 573, 618, 573, 614, 754, 690, 639, 673, 686, 580, 544, 719, 679, 458, 560, 659, 537, 842, 700, 764, 626, 781, 654, 619, 617, 663, 656, 883, 699, 687, 621, 333, 442, 333, 589, 430, 314, 553, 596, 520, 596, 566, 367, 597, 572, 315, 259, 567, 314, 886, 572, 573, 596, 601, 372, 534, 379, 570, 526, 723, 533, 518, 516, 370, 234, 370, 533];
  var W_EXTRA = { "·": [235, 301], "–": [480, 508], "—": [800, 842], "’": [235, 277], "‘": [235, 277], "“": [398, 498], "”": [398, 498], "…": [696, 803],
    "é": [539, 566], "è": [539, 566], "ê": [539, 566], "ë": [539, 566], "á": [526, 553], "à": [526, 553], "â": [526, 553], "ä": [526, 553],
    "í": [278, 301], "ì": [278, 301], "î": [278, 301], "ï": [278, 301], "ó": [552, 573], "ò": [552, 573], "ô": [552, 573], "ö": [552, 573],
    "ú": [536, 570], "ù": [536, 570], "û": [536, 570], "ü": [536, 570], "ñ": [546, 572], "ç": [500, 520], "É": [567, 580], "°": [352, 404],
    "½": [812, 856], "¼": [826, 853], "¾": [868, 959], "×": [528, 539], "•": [438, 438] };
  function measure(text, size, bold) {
    var s = String(text), table = bold ? W_BOLD : W_REG, total = 0, i, c, e;
    for (i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c >= 32 && c <= 126) total += table[c - 32];
      else { e = W_EXTRA[s.charAt(i)]; total += e ? e[bold ? 1 : 0] : (bold ? 600 : 560); }
    }
    return total * size / 1000;
  }

  /* ---------- the body frame: the room a page maker has between the header and the tip ---------- */
  var SH = CM.SHELL;
  function bodyFrame() { return { x: SH.left, y: SH.body.top, w: SH.right - SH.left, h: SH.body.bottom - SH.body.top }; }

  /* ---------- a sheet: the thing a generator draws on ---------- */
  var isStaff = function (role) { return CM.STAFF_ROLES.indexOf(role) >= 0; };
  var isExempt = function (role) { return role === "number" || role === "mark"; };

  function sheet(kind, st, o) {
    var S = CM.STAGES[st], T = S.type;
    var F = o.frame ? { x: +o.frame.x, y: +o.frame.y, w: +o.frame.w, h: +o.frame.h } : bodyFrame();
    var meas = typeof o.measure === "function" ? o.measure : measure;
    var sh = { kind: kind, stage: st, S: S, T: T, F: F, items: [], texts: [], meta: {}, meas: meas,
      cx: F.x + F.w / 2, right: F.x + F.w, bottom: F.y + F.h, notes: [] };
    /* a rule the generator could not keep: the page is drawn again from the next seed */
    sh.fail = function (why) { sh.notes.push(why); };

    sh.width = function (text, size, bold) { return meas(String(text), size, !!bold); };
    /* the largest size, from `size` down to the stage's floor for the role, at which the text fits maxW; null if none does */
    sh.fitSize = function (text, maxW, size, role, bold) {
      var floor = CM.floorFor(st, role), b = !!bold || (T.bold && !isStaff(role) && !isExempt(role)), s = size;
      while (s > floor && meas(text, s, b) > maxW) s -= 0.5;
      s = Math.max(s, floor);
      return meas(text, s, b) <= maxW + 0.01 ? s : null;
    };
    sh.text = function (text, x, y, size, opt) {
      opt = opt || {};
      var role = opt.role || "body", floor = CM.floorFor(st, role), staff = isStaff(role), exempt = isExempt(role);
      var s = Math.max(floor, size), bold = !staff && !exempt && T.bold ? true : !!opt.bold;
      var t = { text: String(text), x: r2(x), y: r2(y), size: r2(s), bold: bold, align: opt.align || "left", role: role };
      if (opt.color) t.color = opt.color;
      if (opt.rotate) t.rotate = opt.rotate;
      t.w = r2(meas(t.text, t.size, t.bold));
      sh.texts.push(t);
      return t;
    };
    /* wrapped lines of text no wider than maxW */
    sh.wrap = function (text, maxW, size, bold) {
      var words = String(text).split(/\s+/).filter(Boolean), lines = [], cur = "";
      words.forEach(function (w) {
        var t = cur ? cur + " " + w : w;
        if (!cur || meas(t, size, bold) <= maxW) cur = t; else { lines.push(cur); cur = w; }
      });
      if (cur) lines.push(cur);
      return lines;
    };
    /* a paragraph: the first baseline at y; returns the y below the last line */
    sh.para = function (text, x, y, maxW, size, opt) {
      opt = opt || {};
      var role = opt.role || "body", bold = !!opt.bold || (T.bold && !isStaff(role) && !isExempt(role));
      var s = Math.max(CM.floorFor(st, role), size), lead = opt.lead || Math.round(s * 1.28), align = opt.align || "left";
      var ax = align === "center" ? x + maxW / 2 : align === "right" ? x + maxW : x;
      var lines = sh.wrap(text, maxW, s, bold);
      if (lines.length === 2 && opt.balance !== false) {
        /* two lines of near equal length read better than a full line and a stray word */
        var ws = lines.join(" ").split(" "), best = null, i0;
        for (i0 = 1; i0 < ws.length; i0++) {
          var a = ws.slice(0, i0).join(" "), b = ws.slice(i0).join(" "), m = Math.max(meas(a, s, bold), meas(b, s, bold));
          if (m <= maxW && (!best || m < best.m)) best = { a: a, b: b, m: m };
        }
        if (best) lines = [best.a, best.b];
      }
      lines.forEach(function (l, i) { sh.text(l, ax, y + i * lead, s, { role: role, bold: opt.bold, align: align, color: opt.color }); });
      return y + (lines.length - 1) * lead + Math.round(s * 0.32);
    };
    /* a shape. d is path data; fill is "#fff", "#000" or "none"; w is the line weight in points */
    sh.path = function (d, opt) {
      opt = opt || {};
      var it = { d: d, fill: opt.fill || "none", w: r2(opt.w == null ? S.stroke.rule : opt.w), role: opt.role || "rule" };
      var b = bbox(parse(d));
      if (isFinite(b[0])) it.bounds = [r2(b[0]), r2(b[1]), r2(b[2]), r2(b[3])];
      sh.items.push(it);
      return it;
    };
    sh.rect = function (x, y, w, h, opt) { opt = opt || {}; return sh.path(dRect(x, y, w, h, opt.r), opt); };
    sh.circle = function (cx, cy, r, opt) { return sh.path(dCircle(cx, cy, r), opt); };
    sh.line = function (ax, ay, bx, by, opt) { return sh.path(dLine(ax, ay, bx, by), opt); };
    /* a black box with white lettering, the page's strongest signal */
    sh.inverse = function (x, y, w, h, label, size, opt) {
      opt = opt || {};
      sh.rect(x, y, w, h, { r: opt.r == null ? 6 : opt.r, fill: "#000", w: opt.w || S.stroke.rule, role: opt.role || "rule" });
      sh.text(label, x + w / 2, y + h / 2 + size * 0.35, size, { bold: true, align: "center", role: opt.textRole || "label", color: "#fff" });
    };
    /* title and instruction at the top; returns the y at which the content may start */
    sh.head = function (title, instruction) {
      /* a host that prints its own title (the packet tool's heading, the Packet Builder's sheet header) asks for the instruction alone */
      if (o.headless) return instruction ? sh.para(instruction, F.x, F.y + Math.round(T.instruction * 0.9), F.w, T.instruction, { role: "instruction" }) + 10 : F.y;
      var size = sh.fitSize(title, F.w, T.title, "title", true);
      if (size == null) { sh.fail("the title \"" + title + "\" is wider than the page"); size = CM.floorFor(st, "title"); }
      var y = F.y + Math.round(size * 0.9);
      sh.text(title, sh.cx, y, size, { bold: true, align: "center", role: "title" });
      y += Math.round(size * 0.42);
      if (instruction) y = sh.para(instruction, F.x, y + Math.round(T.instruction * 1.15), F.w, T.instruction, { role: "instruction" });
      return y + 10;
    };
    /* a picture from the coloring library, fitted and centered in a box; strokes are set in printed points */
    sh.picture = function (paths, box, opt) {
      opt = opt || {};
      var w = opt.w == null ? S.stroke.art : opt.w, keep = paths.filter(function (p) { return opt.detail === false ? !p[2] : !(S.decor === "none" && p[2]); });
      var segs = keep.map(function (p) { return parse(p[0]); }), bb = [Infinity, Infinity, -Infinity, -Infinity];
      segs.forEach(function (s) { bbox(s, bb); });
      var bw = bb[2] - bb[0], bh = bb[3] - bb[1], pad = w / 2 + 1;
      var k = Math.min((box.w - 2 * pad) / bw, (box.h - 2 * pad) / bh);
      var dx = box.x + (box.w - bw * k) / 2 - bb[0] * k, dy = box.y + (box.h - bh * k) / 2 - bb[1] * k;
      keep.forEach(function (p, i) {
        var fill = opt.fill || (p[1] === "#000" ? "#000" : "#fff");
        sh.path(segsToD(mapSegs(segs[i], k, dx, dy)), { fill: fill, w: p[2] && opt.detailW ? opt.detailW : w, role: opt.role || "subject" });
      });
      return { k: k, box: { x: dx + bb[0] * k, y: dy + bb[1] * k, w: bw * k, h: bh * k } };
    };

    /* the rules the page must keep, found by looking at the page itself */
    sh.problems = function () {
      var out = sh.notes.slice(), page = sh.model();
      CM.validatePage(page, st).forEach(function (p) { out.push(p); });
      var boxes = [];
      sh.texts.forEach(function (t) {
        if (t.rotate) return;
        var x0 = t.align === "center" ? t.x - t.w / 2 : t.align === "right" ? t.x - t.w : t.x, x1 = x0 + t.w;
        if (x0 < F.x - 0.6 || x1 > F.x + F.w + 0.6) out.push("the text \"" + t.text.slice(0, 24) + "\" runs outside its space (" + r2(x0) + " to " + r2(x1) + ")");
        boxes.push({ t: t, x0: x0, x1: x1, y0: t.y - t.size * 0.76, y1: t.y + t.size * 0.22 });
      });
      for (var i = 0; i < boxes.length; i++) for (var j = i + 1; j < boxes.length; j++) {
        var a = boxes[i], b = boxes[j];
        if (a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5)
          out.push("the texts \"" + a.t.text.slice(0, 18) + "\" and \"" + b.t.text.slice(0, 18) + "\" overlap");
      }
      return out;
    };
    sh.model = function () {
      return { w: SAFE.pageW, h: SAFE.pageH, stage: st, kind: kind, frame: { x: F.x, y: F.y, w: F.w, h: F.h }, items: sh.items, texts: sh.texts, meta: sh.meta };
    };
    return sh;
  }

  /* ---------- the shell: header, tip and foot ----------
     The packet tool draws its own header and foot; this is the same shell for a page made on its own, for the
     Packet Builder's print sheets, and for the checks. All of it is black, on white, in the stage's face. */
  function withShell(page, c) {
    c = c || {};
    var H = CM.headerParts({ name: c.name, date: c.date, wing: c.wing });
    var out = { w: page.w, h: page.h, stage: page.stage, kind: page.kind, meta: page.meta, items: page.items.slice(), texts: page.texts.slice(),
      frame: { x: SH.left, y: SAFE.edge, w: SH.right - SH.left, h: SAFE.pageH - 2 * SAFE.edge } };
    var L = SH.left, R = SH.right, meas = typeof c.measure === "function" ? c.measure : measure;
    var add = function (text, x, y, size, o) {
      var t = { text: text, x: r2(x), y: r2(y), size: size, bold: !!o.bold, align: o.align || "left", role: o.role };
      t.w = r2(meas(text, size, t.bold));
      out.texts.push(t); return t;
    };
    var nm = H.name || "Name:", rightText = H.right, rightSize = SH.header.date;
    while (rightSize > 10 && meas(nm, SH.header.name, true) + 24 + meas(rightText, rightSize, true) > R - L) rightSize -= 0.5;
    add(nm, L, SH.header.y, SH.header.name, { bold: true, role: "header" });
    if (!H.name) out.items.push({ d: dLine(L + meas(nm, SH.header.name, true) + 8, SH.header.y + 1, L + 230, SH.header.y + 1), fill: "none", w: 2.25, role: "shell" });
    add(rightText, R, SH.header.y, rightSize, { bold: true, align: "right", role: "header" });
    out.items.push({ d: dLine(L, SH.header.ruleY, R, SH.header.ruleY), fill: "none", w: SH.header.rule, role: "shell" });
    if (c.tip) tipLines(c.tip, meas).forEach(function (ln) { add(ln.text, L + ln.x, SH.tip.y + ln.row * SH.tip.lead, SH.tip.size, { bold: ln.bold, role: "cue" }); });
    out.items.push({ d: dLine(L, SH.footer.ruleY, R, SH.footer.ruleY), fill: "none", w: SH.footer.rule, role: "shell" });
    add("Cognicopia", L, SH.footer.y, SH.footer.size, { role: "footer" });
    add("Page " + (c.page || 1) + " of " + (c.pages || 1), (L + R) / 2, SH.footer.y, SH.footer.page, { bold: true, align: "center", role: "footer" });
    add(c.stageLabel || CM.STAGES[page.stage].label, R, SH.footer.y, SH.footer.size, { align: "right", role: "footer" });
    return out;
  }
  /* A tip, set in at most two lines of the shell's width: "Clinical Tip:" in bold, then the sentence.
     Returns [{ text, x, row, bold }] with x measured from the left margin. */
  function tipLines(tip, meas) {
    meas = meas || measure;
    var m = /^([^:]{3,22}:)\s*(.*)$/.exec(tip), prefix = m ? m[1] : "", rest = m ? m[2] : String(tip), size = SH.tip.size, width = SH.right - SH.left;
    var pw = prefix ? meas(prefix + " ", size, true) : 0, words = rest.split(/\s+/).filter(Boolean), lines = [], cur = "", avail = width - pw;
    words.forEach(function (w) {
      var t = cur ? cur + " " + w : w;
      if (!cur || meas(t, size, false) <= avail) cur = t; else { lines.push(cur); cur = w; avail = width; }
    });
    if (cur) lines.push(cur);
    lines = lines.slice(0, SH.tip.lines);
    var out = [];
    if (prefix) out.push({ text: prefix, x: 0, row: 0, bold: true });
    lines.forEach(function (ln, i) { out.push({ text: ln, x: i === 0 ? pw : 0, row: i, bold: false }); });
    return out;
  }

  /* ---------- drawing a page model ---------- */
  var FONT_STACK = "'Atkinson Hyperlegible', 'Atkinson Hyperlegible Next', Arial, Helvetica, sans-serif";
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };

  /* a jsPDF document (or the build scripts' writer): o.x, o.y place the page's top-left corner, o.scale scales it */
  function toPDF(page, doc, o) {
    o = o || {};
    var x0 = o.x || 0, y0 = o.y || 0, k = o.scale || 1, font = o.font || "helvetica";
    var m = function (p) { return [x0 + p[0] * k, y0 + p[1] * k]; };
    doc.setDrawColor(0, 0, 0);
    if (doc.setLineCap) doc.setLineCap("round");
    if (doc.setLineJoin) doc.setLineJoin("round");
    page.items.forEach(function (it) {
      doc.setLineWidth(it.w * k);
      if (it.fill === "#000") doc.setFillColor(0, 0, 0); else doc.setFillColor(255, 255, 255);
      parse(it.d).forEach(function (s) {
        if (s.op === "M") { var a = m(s.p); doc.moveTo(a[0], a[1]); }
        else if (s.op === "L") { var b = m(s.p); doc.lineTo(b[0], b[1]); }
        else if (s.op === "C") { var c1 = m(s.c1), c2 = m(s.c2), p = m(s.p); doc.curveTo(c1[0], c1[1], c2[0], c2[1], p[0], p[1]); }
        else doc.close();
      });
      if (it.fill === "none") doc.stroke(); else doc.fillStroke();
    });
    doc.setFillColor(255, 255, 255);
    page.texts.forEach(function (t) {
      doc.setFont(font, t.bold ? "bold" : "normal");
      doc.setFontSize(t.size * k);
      if (doc.setTextColor) { if (t.color === "#fff") doc.setTextColor(255, 255, 255); else doc.setTextColor(0, 0, 0); }
      var x = x0 + t.x * k, y = y0 + t.y * k;
      if (t.rotate) {
        /* turned about (x, y): jsPDF writes from its anchor in the turned direction, so the anchor is the end the text starts from */
        var w = t.w * k, ax = t.align === "center" ? x + w / 2 : t.align === "right" ? x + w : x;
        doc.text(t.text, ax, y, { angle: t.rotate });
      } else doc.text(t.text, x, y, { align: t.align });
    });
    if (doc.setTextColor) doc.setTextColor(0, 0, 0);
    return doc;
  }

  /* an SVG string. o.crop: only the page's frame (for a host that has its own header and foot); o.viewBox: [x, y, w, h] in
   page points, to show only that part of the page (a host with its own print margins); o.width: the CSS width;
   o.background false: no white page behind it (a host that prints on white paper has no use for one) */
  function toSVG(page, o) {
    o = o || {};
    var F = page.frame, vb = o.viewBox && o.viewBox.length === 4 ? o.viewBox.map(Number) : o.crop ? [F.x, F.y, F.w, F.h] : [0, 0, page.w, page.h];
    var body = page.items.map(function (it) {
      /* data-bw marks the white fills, so a page that is forced to pure black (the Packet Builder's print) keeps them white */
      return '<path d="' + it.d + '" fill="' + (it.fill === "#000" ? "#000" : it.fill === "none" ? "none" : '#fff" data-bw="white') + '" stroke="#000" stroke-width="' + it.w + '" stroke-linecap="round" stroke-linejoin="round"' + (it.role === "shell" ? ' data-role="shell"' : "") + "/>";
    }).join("");
    var text = page.texts.map(function (t) {
      var anchor = t.align === "right" ? "end" : t.align === "center" ? "middle" : "start";
      return '<text x="' + t.x + '" y="' + t.y + '" font-family="' + FONT_STACK + '" font-size="' + t.size + '" font-weight="' + (t.bold ? 700 : 400) + '" text-anchor="' + anchor + '" fill="' + (t.color === "#fff" ? '#fff" data-bw="white' : "#000") + '"' +
        (t.rotate ? ' transform="rotate(' + t.rotate + " " + t.x + " " + t.y + ')"' : "") + (CM.STAFF_ROLES.indexOf(t.role) >= 0 ? ' data-role="staff"' : "") + ">" + esc(t.text) + "</text>";
    }).join("");
    var label = (page.meta && page.meta.title ? page.meta.title : "Activity page") + (page.meta && page.meta.instruction ? ". " + page.meta.instruction : "");
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(" ") + '"' + (o.width ? ' width="' + esc(o.width) + '"' : "") + (o.height ? ' height="' + esc(o.height) + '"' : "") +
      ' role="img" aria-label="' + esc(label) + '">' + (o.background === false ? "" : '<rect x="' + vb[0] + '" y="' + vb[1] + '" width="' + vb[2] + '" height="' + vb[3] + '" fill="#fff" stroke="none" data-bw="white"/>') + body + text + "</svg>";
  }

  /* ---------- the day's context: a seeded stream and a place in the rotation ---------- */
  function fatal(msg) { var e = new Error(msg); e.fatal = true; return e; }
  var cap = function (s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); };
  var range = function (n) { var a = [], i; for (i = 0; i < n; i++) a.push(i); return a; };

  function makeCtx(kind, st, day, o, attempt) {
    var P = PCG.prng, variant = o.variant | 0, slot = o.slot | 0, nk = P.nameKey(o.name);
    return {
      kind: kind, stage: st, day: day, attempt: attempt, variant: variant, slot: slot, name: o.name,
      key: nk + "|" + st + "|" + kind + "|" + slot,
      pos: day.day + variant * 100003 + slot * 7919,
      rng: CM.dailyRng(o.name, day.iso, variant, kind + "/" + st + "/" + slot + "/" + attempt)
    };
  }
  /* Up to k things from arr for today, in the rotation order (so a thing is not used again for a good while),
     skipping any that fail ok(item, index); if the rotation's own picks fail, the seeded stream fills the rest. */
  function pickRot(ctx, tag, arr, k, ok) {
    var P = PCG.prng, n = arr.length, out = [], seen = {};
    if (!n || k <= 0) return out;
    P.rotationWindow(ctx.key + "|" + tag, n, Math.min(k, n), ctx.pos + ctx.attempt * 13).forEach(function (i) {
      if (out.length < k && (!ok || ok(arr[i], i))) { out.push(arr[i]); seen[i] = 1; }
    });
    if (out.length < k) ctx.rng.shuffle(range(n)).forEach(function (i) {
      if (out.length < k && !seen[i] && (!ok || ok(arr[i], i))) { out.push(arr[i]); seen[i] = 1; }
    });
    return out;
  }
  var rotIndex = function (ctx, tag, n, shift) { return n ? PCG.prng.rotationIndex(ctx.key + "|" + tag, n, ctx.pos + ctx.attempt * 13 + (shift || 0)) : 0; };

  /* ---------- what the care team asked to leave out ---------- */
  function avoider(o) {
    var M = root.CognicopiaColoringManifest, topics = (M && M.AVOID_TOPICS) || {}, words = [];
    [].concat(o.avoid || []).forEach(function (a) {
      a = String(a && typeof a === "object" ? a.code || a.text || "" : a).toLowerCase().trim();
      if (a.length < 3) return;
      (topics[a] || [a]).forEach(function (w) { words.push(w); if (/s$/.test(w) && w.length > 3) words.push(w.slice(0, -1)); });
    });
    var res = words.map(function (w) { return new RegExp("(^|[^a-z0-9])" + String(w).toLowerCase().replace(/[^a-z0-9]+/g, "[^a-z0-9]+") + "s?([^a-z0-9]|$)", "i"); });
    return function (text) { text = String(text); for (var i = 0; i < res.length; i++) if (res[i].test(text)) return true; return false; };
  }
  /* one resident-facing string: adult-dignity filter, and the avoid list */
  function seemly(text, bad) { return CM.dignity.clean(text) && !bad(text); }

  /* ---------- the content ---------- */
  function content(o) {
    var d = o.data || (root.CognicopiaPCGData && root.CognicopiaPCGData.activities);
    if (!d || !d.sorting || !d.sequences || !d.sayings || !d.words) throw fatal("The activity content is not loaded (assets/pcg/pcg-data.bundle.js).");
    return d;
  }
  function subjectsOf(o) {
    var S = o.subjects;
    if (!S) { var M = root.CognicopiaColoringManifest; try { S = M && M.loadSync ? M.loadSync() : null; } catch (e) { S = null; } }
    return S && S.manifest && S.paths ? S : null;
  }
  var lastWord = function (s) { var m = /([A-Za-z]+)\s*$/.exec(s); return m ? m[1].toLowerCase() : s; };

  /* groups a resident may be given: not behind a faith door the care team did not open, nothing from the avoid list */
  function groupsFor(D, o, bad) {
    var allow = [].concat(o.allow || []);
    return D.sorting.filter(function (g) {
      if (g.needs && allow.indexOf(g.needs) < 0) return false;
      return !bad(g.label + " " + g.id) && g.words.filter(function (w) { return !bad(w); }).length >= 8;
    });
  }
  var cleanWords = function (g, bad) { return g.words.filter(function (w) { return !bad(w) && CM.dignity.clean(w); }); };
  /* two groups that cannot be mistaken for one another */
  function farApart(a, b, strict) {
    if (a.id === b.id) return false;
    if (a.family.some(function (f) { return b.family.indexOf(f) >= 0; })) return false;
    if (strict && lastWord(a.label) === lastWord(b.label)) return false;
    return true;
  }

  /* ---------- the pictures: names, which others look alike, and the era each belongs to ---------- */
  var SUBJECT_NAME = { owl: "Owl", sitting_cat: "Cat", sitting_dog: "Dog", cathedral_radio: "Radio", propeller_airliner: "Airliner",
    steam_locomotive: "Steam train", pumpkin: "Pumpkin", "1957_family_sedan": "Family car", "1967_muscle_car": "Muscle car", "1950s_pickup_truck": "Pickup truck",
    farm_tractor: "Tractor", oak_tree: "Oak tree", garden_rose: "Rose", sewing_machine: "Sewing machine", watering_can: "Watering can",
    grandfather_clock: "Grandfather clock", rotary_telephone: "Telephone", oil_lantern: "Lantern", rocking_chair: "Rocking chair" };
  var SUBJECT_CLASH = { "1950s_pickup_truck": "road", "1957_family_sedan": "road", "1967_muscle_car": "road", farm_tractor: "farm", biplane: "air", propeller_airliner: "air",
    steam_locomotive: "rail", sailboat: "boat", daisy: "flower", garden_rose: "flower", sunflower: "flower", tulip: "flower", oak_tree: "tree", pumpkin: "pumpkin",
    teacup: "tea", teapot: "tea", grandfather_clock: "clock", cathedral_radio: "music", jukebox: "music", rotary_telephone: "phone", sewing_machine: "machine",
    typewriter: "machine", cardinal: "bird", hummingbird: "bird", owl: "bird", rooster: "bird", butterfly: "butterfly", horse: "horse", sitting_cat: "cat",
    sitting_dog: "dog", oil_lantern: "lantern", rocking_chair: "chair", birdhouse: "birdhouse", watering_can: "can" };
  /* things that read well as a solid shape: a clear outline, with the details inside not needed to know it */
  var SILHOUETTE_OK = ["1950s_pickup_truck", "1957_family_sedan", "1967_muscle_car", "farm_tractor", "steam_locomotive", "propeller_airliner", "sailboat", "biplane",
    "cardinal", "hummingbird", "owl", "rooster", "horse", "butterfly", "sitting_cat", "sitting_dog", "oak_tree", "teapot", "rocking_chair", "birdhouse", "watering_can", "oil_lantern", "teacup", "tulip", "pumpkin"];
  function subjectName(a) {
    if (SUBJECT_NAME[a.id]) return SUBJECT_NAME[a.id];
    var t = String(a.title).replace(/^The\s+/i, "").replace(/^\d{4}s?\s+/, "").toLowerCase();
    return cap(t);
  }
  var clashOf = function (a) { return SUBJECT_CLASH[a.id] || a.id; };

  /* the pictures a resident may be given at this stage: adult subjects, nothing on the avoid list */
  function subjectPool(o, st, bad, S) {
    var M = root.CognicopiaColoringManifest;
    return S.manifest.assets.filter(function (a) {
      if (!S.paths[a.id] || !S.paths[a.id].length) return false;
      if (!CM.dignity.adultSubject(a, st)) return false;
      if (M && M.avoided && M.avoided(a, o.avoid)) return false;
      return !bad(a.title);
    });
  }
  var eraWeight = function (a) { return (a.tags || []).some(function (t) { return t === "1950s" || t === "1960s"; }) ? 2 : (a.category === "nostalgia" || a.category === "objects" || a.category === "vehicles") ? 1.4 : 1; };

  /* ---------- word ladder graph (words one letter apart) ---------- */
  var ladderCache = typeof WeakMap === "function" ? new WeakMap() : null;
  function ladderGraph(words) {
    var hit = ladderCache && ladderCache.get(words);
    if (hit) return hit;
    var buckets = {}, adj = {};
    words.forEach(function (w) {
      adj[w] = [];
      for (var i = 0; i < w.length; i++) { var k = w.slice(0, i) + "_" + w.slice(i + 1); (buckets[k] = buckets[k] || []).push(w); }
    });
    Object.keys(buckets).forEach(function (k) {
      var b = buckets[k];
      for (var i = 0; i < b.length; i++) for (var j = 0; j < b.length; j++) if (i !== j) adj[b[i]].push(b[j]);
    });
    var g = { adj: adj };
    if (ladderCache) ladderCache.set(words, g);
    return g;
  }
  var oneApart = function (a, b) { if (a.length !== b.length) return false; var d = 0, i; for (i = 0; i < a.length; i++) if (a.charAt(i) !== b.charAt(i) && ++d > 1) return false; return d === 1; };
  /* every way to go from start to end in single steps using any of the words in bank (each at most once) */
  function ladderPaths(start, end, bank) {
    var found = [];
    (function walk(cur, used, path) {
      if (oneApart(cur, end)) found.push(path.concat([end]));
      bank.forEach(function (w) { if (used.indexOf(w) < 0 && oneApart(cur, w)) walk(w, used.concat([w]), path.concat([w])); });
    })(start, [], [start]);
    return found;
  }
  function scrambleOf(word, rng, known) {
    var letters = word.split(""), distinct = {}, tries = 0, out = word;
    letters.forEach(function (c) { distinct[c] = 1; });
    if (Object.keys(distinct).length < 3) return null;
    while (tries++ < 60) {
      out = rng.shuffle(letters).join("");
      if (out !== word && !known[out] && !/(.)\1\1/.test(out)) return out;
    }
    return null;
  }
  function knownWords(D) {
    var k = {};
    D.words.forEach(function (w) { k[w] = 1; });
    D.sorting.forEach(function (g) { g.words.forEach(function (w) { if (/^[A-Za-z]+$/.test(w)) k[w.toUpperCase()] = 1; }); });
    return k;
  }
  var DIR_NAME = { "1,0": "across", "0,1": "down", "1,1": "down and to the right", "1,-1": "up and to the right" };
  var THEME_NAME = { kitchen: "the kitchen", garden: "the garden", plants: "growing things", food: "good food", outdoors: "the outdoors", workshop: "the workshop",
    needlework: "sewing", laundry: "washing day", clothing: "clothes", school: "school days", office: "the office", animals: "animals", birds: "birds",
    music: "music", weather: "the weather", money: "money", bedroom: "the bedroom", porch: "the front porch", church: "church", travel: "a road trip",
    grooming: "getting ready", sport: "the ballgame", fishing: "fishing", transport: "things that go" };

  /* =====================================================================
     THE PAGE MAKERS
     Each is fn(sh, ctx, o): draw on the sheet `sh`, keep to its stage's
     limits, and put the staff's answers in sh.meta. A rule it cannot keep
     goes to sh.fail(), and the page is drawn again from the next seed.
     ===================================================================== */
  var REG = {};
  function register(id, title, fn) { REG[id] = { id: id, title: title, fn: fn }; }

  /* ---------- word searches: large (early) and guided (middle, late) ---------- */
  var SEARCH_DIRS = { 4: [[1, 0], [0, 1], [1, 1], [1, -1]], 2: [[1, 0], [0, 1]], 1: [[1, 0]] };
  function searchThemes(D, o, bad, count, maxLen) {
    var allow = [].concat(o.allow || []), fams = {}, out = [];
    D.sorting.forEach(function (g) {
      if ((g.needs && allow.indexOf(g.needs) < 0) || bad(g.label)) return;
      g.family.forEach(function (f) { (fams[f] = fams[f] || []).push(g); });
    });
    Object.keys(fams).sort().forEach(function (f) {
      var seen = {}, words = [];
      fams[f].forEach(function (g) {
        g.words.forEach(function (w) {
          var W = w.toUpperCase();
          if (/^[A-Z]{3,}$/.test(W) && W.length <= maxLen && !seen[W] && !bad(w) && CM.dignity.clean(w)) { seen[W] = 1; words.push(W); }
        });
      });
      if (words.length >= count + 2 && THEME_NAME[f]) out.push({ family: f, label: THEME_NAME[f], words: words });
    });
    return out;
  }
  function genSearch(sh, ctx, o, mode) {
    var st = sh.stage, S = sh.S, T = sh.T, L = S.limits.wordsearch, F = sh.F, rng = ctx.rng, bad = avoider(o), D = content(o);
    if (!PCG.puzzles || !PCG.matrix) throw fatal("Load the procedural engine (src/pcg) before the word searches.");
    var size = mode === "large" ? rng.pick(L.sizes) : L.sizes[0], dirs = SEARCH_DIRS[L.dirs];
    var count = st === "early" ? (size >= 15 ? 13 : 10) : st === "middle" ? 6 : 3;
    var maxLen = st === "early" ? 10 : size - 1;
    var themes = searchThemes(D, o, bad, count, maxLen);
    if (!themes.length) throw fatal("no theme has enough words for a " + size + " by " + size + " word search");
    var theme = themes[rotIndex(ctx, "theme", themes.length)], words = [];
    rng.shuffle(theme.words).forEach(function (w) {
      if (words.length < count && !words.some(function (x) { return x.indexOf(w) >= 0 || w.indexOf(x) >= 0; })) words.push(w);
    });
    if (words.length < count) { sh.fail("too few words for the word search"); return; }
    var grid = PCG.puzzles.wordSearch(words, { size: size, dirs: dirs }, rng.fork("grid"), PCG.matrix.data().safety);
    if (grid.dropped.length) { sh.fail("could not place " + grid.dropped.join(", ")); return; }

    var title = "Word Search: " + cap(theme.label);
    var instruction = st === "early" ? "Circle each word. They go across, down and slanted."
      : st === "middle" ? "Circle each word. The first letter of every word has a box." : "Circle each word. The first letter has a box.";
    var top = sh.head(title, instruction);

    /* the word list, in columns, at the foot of the page */
    var cols = st === "early" ? 4 : st === "middle" ? 2 : 1, colW = F.w / cols, longest = words.slice().sort(function (a, b) { return b.length - a.length; })[0];
    var wsize = sh.fitSize(longest, colW - 10, T.word, "word", st === "late");
    if (wsize == null) { sh.fail("the word list does not fit its columns"); return; }
    var rows = Math.ceil(words.length / cols), lead = Math.round(wsize * 1.45);
    var firstBase = sh.bottom - (rows - 1) * lead - Math.round(wsize * 0.25), listTop = firstBase - Math.round(wsize * 0.85);
    words.slice().sort().forEach(function (w, i) {
      var c = Math.floor(i / rows), r = i % rows;
      sh.text(w, F.x + c * colW + 4, firstBase + r * lead, wsize, { role: "word", bold: st === "late" });
    });

    /* the grid */
    var avail = listTop - 12 - top, cell = Math.floor(Math.min(F.w / size, avail / size)), gw = cell * size;
    var ls = Math.min(T.cell + (st === "early" ? 4 : 0), Math.floor(cell * 0.66));
    if (ls < CM.floorFor(st, "cell")) { sh.fail("the grid cells are too small for " + CM.floorFor(st, "cell") + " pt letters (" + cell + " pt cells)"); return; }
    var gx = sh.cx - gw / 2, gy = top;
    sh.rect(gx, gy, gw, gw, { w: S.stroke.rule, fill: "#fff", role: "rule" });
    grid.rows.forEach(function (row, r) {
      for (var c = 0; c < size; c++) sh.text(row.charAt(c), gx + c * cell + cell / 2, gy + r * cell + cell / 2 + ls * 0.35, ls, { role: "cell", bold: true, align: "center" });
    });
    if (mode === "guided") grid.placed.forEach(function (p) {
      sh.rect(gx + p.c * cell + 2, gy + p.r * cell + 2, cell - 4, cell - 4, { r: 5, w: S.stroke.rule, role: "rule" });
    });

    sh.meta = { id: mode === "large" ? "search-large" : "search-guided", title: title, instruction: instruction, topic: theme.label, size: size, words: words,
      answers: grid.placed.map(function (p) { return p.word + " (row " + (p.r + 1) + ", column " + (p.c + 1) + ", " + DIR_NAME[p.dx + "," + p.dy] + ")"; }),
      key: { rows: grid.rows, placed: grid.placed, cell: cell, x: gx, y: gy } };
  }
  register("search-large", "Large word search", function (sh, ctx, o) { genSearch(sh, ctx, o, "large"); });
  register("search-guided", "Guided word search", function (sh, ctx, o) { genSearch(sh, ctx, o, "guided"); });

  /* ---------- word ladder (early) ---------- */
  var hamming = function (a, b) { var d = 0, i; for (i = 0; i < a.length; i++) if (a.charAt(i) !== b.charAt(i)) d++; return d; };
  var diffPos = function (a, b) { for (var i = 0; i < a.length; i++) if (a.charAt(i) !== b.charAt(i)) return i; return -1; };
  function genLadder(sh, ctx, o) {
    var D = content(o), words = D.words, rng = ctx.rng, S = sh.S, T = sh.T, F = sh.F, L = S.limits.ladder, g = ladderGraph(words), bad = avoider(o);
    var okWord = function (w) { return !bad(w) && CM.dignity.clean(w); };
    var pool = words.filter(function (w) { return g.adj[w].length >= 2 && okWord(w); });
    var rungs = rng.range(L.rungs[0], L.rungs[1]), chain = null, tries = 0;
    while (!chain && tries++ < 500) {
      var c = [rng.pick(pool)], lastPos = -1, ok = true, i;
      for (i = 0; i < rungs + 1 && ok; i++) {
        var cur = c[c.length - 1];
        var opts = g.adj[cur].filter(function (w) { return c.indexOf(w) < 0 && okWord(w); });
        if (!opts.length) { ok = false; break; }
        var differ = opts.filter(function (w) { return diffPos(cur, w) !== lastPos; }), nx = rng.pick(differ.length ? differ : opts);
        lastPos = diffPos(cur, nx); c.push(nx);
      }
      if (!ok) continue;
      var start = c[0], end = c[c.length - 1], bank = c.slice(1, -1);
      if (hamming(start, end) < 2) continue;
      var paths = ladderPaths(start, end, bank);
      if (paths.length !== 1 || paths[0].length !== c.length) continue;
      chain = c;
    }
    if (!chain) throw fatal("no word ladder could be made");
    var start0 = chain[0], end0 = chain[chain.length - 1], n = chain.length;
    var title = "Word Ladder", instruction = "Change one letter at a time to climb from " + start0 + " to " + end0 + ". The word box has the steps.";
    var top = sh.head(title, instruction);

    /* the word box: the steps, shuffled, in chips at the foot */
    var chipSize = 22, chipH = 40, bank0 = rng.shuffle(chain.slice(1, -1)), chips = [], lineW = 0, lines = [[]];
    bank0.forEach(function (w) {
      var cw = Math.ceil(sh.width(w, chipSize, true)) + 30;
      if (lineW + cw > F.w && lines[lines.length - 1].length) { lines.push([]); lineW = 0; }
      lines[lines.length - 1].push({ w: w, cw: cw }); lineW += cw + 12;
    });
    var boxTop = sh.bottom - lines.length * (chipH + 10) - 26;
    sh.text("Word box", F.x, boxTop + 4, T.label, { role: "label", bold: true });
    lines.forEach(function (ln, li) {
      var total = ln.reduce(function (a, c) { return a + c.cw; }, 0) + (ln.length - 1) * 12, x = sh.cx - total / 2, y = boxTop + 14 + li * (chipH + 10);
      ln.forEach(function (c) {
        sh.rect(x, y, c.cw, chipH, { r: 8, w: S.stroke.rule, fill: "#fff" });
        sh.text(c.w, x + c.cw / 2, y + chipH / 2 + chipSize * 0.35, chipSize, { role: "choice", bold: true, align: "center" });
        x += c.cw + 12;
      });
    });

    /* the rungs */
    var avail = boxTop - 12 - top, gap = 10, bs = Math.min(48, Math.floor((avail - (n - 1) * gap) / n));
    if (bs < 34) { sh.fail("the ladder's boxes would be under 34 pt"); return; }
    var len = chain[0].length, ww = len * bs + (len - 1) * 8, wx = sh.cx - ww / 2, ls = Math.round(bs * 0.62);
    chain.forEach(function (w, ri) {
      var y = top + ri * (bs + gap), given = ri === 0 || ri === n - 1;
      sh.text(String(ri + 1), wx - 14, y + bs / 2 + 5, 14, { role: "number", align: "right" });
      for (var k = 0; k < len; k++) {
        var x = wx + k * (bs + 8);
        sh.rect(x, y, bs, bs, { r: 6, w: given ? S.stroke.art : S.stroke.rule, fill: "#fff" });
        if (given) sh.text(w.charAt(k), x + bs / 2, y + bs / 2 + ls * 0.35, ls, { role: "cell", bold: true, align: "center" });
      }
    });

    sh.meta = { id: "ladder", title: title, instruction: instruction, topic: "", answers: [chain.join(" > ")], key: { chain: chain } };
  }
  register("ladder", "Word ladder", genLadder);

  /* ---------- anagrams with clues (early, middle) ---------- */
  function genAnagram(sh, ctx, o) {
    var D = content(o), rng = ctx.rng, S = sh.S, T = sh.T, F = sh.F, st = sh.stage, L = S.limits.anagram, bad = avoider(o), known = knownWords(D);
    var groups = groupsFor(D, o, bad), pool = [];
    groups.forEach(function (g) {
      cleanWords(g, bad).forEach(function (w) {
        var W = w.toUpperCase();
        if (/^[A-Z]+$/.test(W) && W.length >= L.minLen && W.length <= L.maxLen) pool.push({ word: W, group: g });
      });
    });
    var usedGroup = {}, items = [];
    pickRot(ctx, "anagram", pool, L.words * 3, function (it) {
      if (usedGroup[it.group.id] || items.length >= L.words) return false;
      var rest = L.firstLetter ? it.word.slice(1) : it.word, sc = scrambleOf(rest, rng, known);
      if (!sc) return false;
      usedGroup[it.group.id] = 1; items.push({ word: it.word, tiles: sc, group: it.group });
      return true;
    });
    if (items.length < L.words) { sh.fail("too few words for the anagrams"); return; }
    var title = "Anagrams", instruction = L.firstLetter ? "The first letter is done. Put the other letters in order. The clue helps." : "Put the letters in order to make a word. The clue helps.";
    var top = sh.head(title, instruction), maxN = items.reduce(function (a, it) { return Math.max(a, it.word.length); }, 0);
    var avail = sh.bottom - top, pitch = avail / items.length;
    var tile = Math.max(28, Math.min(st === "early" ? 40 : 46, Math.floor((pitch - 14 - 5) / 2)));
    var span = maxN * tile + (maxN - 1) * 6, clueX = F.x + span + 22, clueW = F.x + F.w - clueX;
    var cs = T.clue;
    if (clueW < 120) { sh.fail("no room for the clue beside the letters"); return; }
    items.forEach(function (it, i) {
      var y = top + i * pitch + 4, n = it.word.length, tiles = it.tiles.split(""), off = L.firstLetter ? 1 : 0;
      /* the mixed letters */
      tiles.forEach(function (ch, k) {
        var x = F.x + (k + off) * (tile + 6);
        sh.rect(x, y, tile, tile, { r: 6, w: S.stroke.rule, fill: "#fff" });
        sh.text(ch, x + tile / 2, y + tile / 2 + tile * 0.62 * 0.35, Math.round(tile * 0.62), { role: "cell", bold: true, align: "center" });
      });
      /* the boxes to write in */
      for (var k = 0; k < n; k++) {
        var x2 = F.x + k * (tile + 6), y2 = y + tile + 5;
        sh.rect(x2, y2, tile, tile, { r: 6, w: S.stroke.rule, fill: "#fff" });
        if (L.firstLetter && k === 0) sh.text(it.word.charAt(0), x2 + tile / 2, y2 + tile / 2 + tile * 0.62 * 0.35, Math.round(tile * 0.62), { role: "cell", bold: true, align: "center" });
      }
      sh.para("Clue: " + it.group.one, clueX, y + tile / 2 + cs * 0.35, clueW, cs, { role: "clue" });
    });
    sh.meta = { id: "anagram", title: title, instruction: instruction, topic: items[0].group.label.toLowerCase(),
      answers: items.map(function (it) { return it.tiles + (L.firstLetter ? " (after " + it.word.charAt(0) + ")" : "") + " = " + it.word; }), key: { items: items.map(function (it) { return { word: it.word, tiles: it.tiles, clue: it.group.one }; }) } };
  }
  register("anagram", "Anagrams", genAnagram);

  /* ---------- sort into two groups (early, middle) ---------- */
  function chooseGroupPair(ctx, groups, strict) {
    var n = groups.length, a = groups[rotIndex(ctx, "sort-a", n)], j0 = rotIndex(ctx, "sort-b", n), b = null, j;
    for (j = 0; j < n && !b; j++) { var c = groups[(j0 + j) % n]; if (farApart(a, c, strict) || (!strict && a.id !== c.id && !a.family.some(function (f) { return c.family.indexOf(f) >= 0; }))) b = c; }
    return b ? [a, b] : null;
  }
  function genSorting(sh, ctx, o) {
    var D = content(o), rng = ctx.rng, S = sh.S, T = sh.T, F = sh.F, st = sh.stage, L = S.limits.sorting, bad = avoider(o), groups = groupsFor(D, o, bad);
    var pair = chooseGroupPair(ctx, groups, st === "middle");
    if (!pair) throw fatal("no two groups can be set against each other");
    var half = L.items / 2, rows = [], colLabels = pair.map(function (g) { return g.label; });
    pair.forEach(function (g, gi) {
      var ws = rng.shuffle(cleanWords(g, bad).filter(function (w) { return w.length <= 20; })).slice(0, half);
      ws.forEach(function (w) { rows.push({ text: cap(w), col: gi }); });
    });
    if (rows.length < L.items) { sh.fail("too few items to sort"); return; }
    /* mix the two groups, never more than two of one group in a row */
    var order = null, t = 0;
    while (!order && t++ < 80) {
      var mix = rng.shuffle(rows), okMix = true, i;
      for (i = 2; i < mix.length; i++) if (mix[i].col === mix[i - 1].col && mix[i].col === mix[i - 2].col) okMix = false;
      if (okMix) order = mix;
    }
    rows = order || rows;
    var title = "Sort into Two Groups", instruction = L.example ? "Tick the box for the group each one belongs to. The first is done." : "Tick the box for the group each one belongs to.";
    var top = sh.head(title, instruction);
    var colW = 150, itemW = F.w - 2 * colW, hs = T.label, x0 = F.x, headerH = 54;
    /* the headings, in the two tick columns */
    var heads = colLabels.map(function (lab, ci) {
      var lines = sh.wrap(lab, colW - 12, hs, true);
      return { lines: lines, x: x0 + itemW + ci * colW };
    });
    if (heads.some(function (h) { return h.lines.length > 2 || h.lines.some(function (l) { return sh.width(l, hs, true) > colW - 8; }); })) { sh.fail("a group name does not fit its column"); return; }
    var avail = sh.bottom - top - headerH - 8, rh = Math.min(St(st), Math.floor(avail / rows.length));
    if (rh < 38) { sh.fail("the rows would be under 38 pt"); return; }
    var tableH = headerH + rh * rows.length, ty = top + 4;
    heads.forEach(function (h) {
      h.lines.forEach(function (l, li) { sh.text(l, h.x + colW / 2, ty + 22 + li * (hs + 4), hs, { role: "label", bold: true, align: "center" }); });
    });
    /* the grid: an outer box, a rule under the headings, a rule between the rows and a rule between the two columns */
    sh.rect(x0, ty, F.w, tableH, { w: S.stroke.rule, fill: "none" });
    sh.line(x0, ty + headerH, x0 + F.w, ty + headerH, { w: S.stroke.rule });
    sh.line(x0 + itemW, ty, x0 + itemW, ty + tableH, { w: S.stroke.rule });
    sh.line(x0 + itemW + colW, ty, x0 + itemW + colW, ty + tableH, { w: S.stroke.rule });
    var box = Math.min(34, rh - 14), isize = T.body;
    rows.forEach(function (r, ri) {
      var y = ty + headerH + ri * rh;
      if (ri) sh.line(x0, y, x0 + F.w, y, { w: S.stroke.rule });
      var s = sh.fitSize(r.text, itemW - 24, isize, "body", false);
      if (s == null) { sh.fail("\"" + r.text + "\" does not fit its row"); s = CM.floorFor(st, "body"); }
      sh.text(r.text, x0 + 12, y + rh / 2 + s * 0.35, s, { role: "body" });
      for (var ci = 0; ci < 2; ci++) {
        var bx = x0 + itemW + ci * colW + (colW - box) / 2, by = y + (rh - box) / 2;
        sh.rect(bx, by, box, box, { r: 5, w: S.stroke.rule, fill: "#fff" });
        if (L.example && ri === 0 && ci === r.col)
          sh.path(dPoly([[bx + box * 0.2, by + box * 0.55], [bx + box * 0.42, by + box * 0.78], [bx + box * 0.82, by + box * 0.22]], false), { w: S.stroke.art, role: "rule" });
      }
    });
    sh.meta = { id: "sorting", title: title, instruction: instruction, topic: pair[0].label.toLowerCase() + " and " + pair[1].label.toLowerCase(),
      answers: pair.map(function (g, gi) { return g.label + ": " + rows.filter(function (r) { return r.col === gi; }).map(function (r) { return r.text.toLowerCase(); }).join(", "); }),
      key: { groups: pair.map(function (g) { return g.id; }), rows: rows } };
  }
  function St(st) { return st === "early" ? 54 : 62; }
  register("sorting", "Sort into two groups", genSorting);

  /* ---------- odd one out: words (early) or pictures (early, middle) ---------- */
  function oddText(sh, ctx, o, count, per) {
    var D = content(o), rng = ctx.rng, S = sh.S, T = sh.T, F = sh.F, bad = avoider(o), groups = groupsFor(D, o, bad), rows = [], usedGroup = {}, usedWord = {};
    var tries = 0, ordered = pickRot(ctx, "odd-a", groups, groups.length, null);
    while (rows.length < count && tries++ < 400) {
      var A = ordered[rows.length % ordered.length], B = rng.pick(groups);
      if (usedGroup[A.id] || !farApart(A, B, true)) { ordered = ordered.slice(1).concat(ordered.slice(0, 1)); continue; }
      var wa = rng.shuffle(cleanWords(A, bad).filter(function (w) { return w.length <= 16 && !usedWord[w]; })).slice(0, per - 1),
          wb = rng.pick(cleanWords(B, bad).filter(function (w) { return w.length <= 16; }));
      if (wa.length < per - 1 || !wb) continue;
      usedGroup[A.id] = 1; wa.concat([wb]).forEach(function (w) { usedWord[w] = 1; });
      var cells = wa.map(function (w) { return { text: cap(w), odd: false }; }), at = rng.int(per);
      cells.splice(at, 0, { text: cap(wb), odd: true });
      rows.push({ cells: cells, group: A, odd: B });
    }
    if (rows.length < count) { sh.fail("too few rows for odd one out"); return null; }
    var title = "Odd One Out", instruction = "Circle the one in each row that does not belong.";
    var top = sh.head(title, instruction), avail = sh.bottom - top, pitch = Math.min(86, avail / rows.length), boxH = Math.min(58, pitch - 14), gap = 10;
    var numW = 26, boxW = (F.w - numW - (per - 1) * gap) / per, size = T.body;
    rows.forEach(function (r, ri) {
      var y = top + ri * pitch + 4;
      sh.text(String(ri + 1), F.x + numW - 6, y + boxH / 2 + 5, 14, { role: "number", align: "right" });
      r.cells.forEach(function (c, ci) {
        var x = F.x + numW + ci * (boxW + gap), s = sh.fitSize(c.text, boxW - 14, size, "choice", false);
        if (s == null) { sh.fail("\"" + c.text + "\" does not fit its box"); s = CM.floorFor(sh.stage, "choice"); }
        sh.rect(x, y, boxW, boxH, { r: 8, w: S.stroke.rule, fill: "#fff" });
        sh.text(c.text, x + boxW / 2, y + boxH / 2 + s * 0.35, s, { role: "choice", align: "center" });
      });
    });
    sh.meta = { id: "oddone", title: title, instruction: instruction, topic: rows[0].group.label.toLowerCase(), mode: "words",
      answers: rows.map(function (r, i) { return (i + 1) + ". " + r.cells.filter(function (c) { return c.odd; })[0].text + " (the others are " + r.group.label.toLowerCase() + ")"; }), key: { rows: rows } };
    return rows;
  }
  function oddPictures(sh, ctx, o, count, per) {
    var S0 = subjectsOf(o), rng = ctx.rng, S = sh.S, T = sh.T, F = sh.F, st = sh.stage, bad = avoider(o);
    if (!S0) return false;
    var boxW0 = (F.w - (per - 1) * 12) / per, pool = subjectPool(o, st, bad, S0).filter(function (a) { return sh.fitSize(subjectName(a), boxW0 - 24, T.label + 2, "label", false) != null; }), byCat = {};
    pool.forEach(function (a) { (byCat[a.category] = byCat[a.category] || []).push(a); });
    var cats = Object.keys(byCat).filter(function (c) { return byCat[c].length >= per - 1; }).sort();
    if (cats.length < 2) return false;
    var rows = [], usedId = {}, catOrder = rng.shuffle(cats), tries = 0;
    while (rows.length < count && tries++ < 300) {
      var A = catOrder[rows.length % catOrder.length], B = rng.pick(cats.filter(function (c) { return c !== A; }));
      var clash = {}, majority = [];
      rng.shuffle(byCat[A].filter(function (a) { return !usedId[a.id]; })).forEach(function (a) {
        if (majority.length < per - 1 && !clash[clashOf(a)]) { clash[clashOf(a)] = 1; majority.push(a); }
      });
      var odd = rng.pick(byCat[B].filter(function (a) { return !usedId[a.id] && !clash[clashOf(a)]; }));
      if (majority.length < per - 1 || !odd) continue;
      majority.concat([odd]).forEach(function (a) { usedId[a.id] = 1; });
      var cells = majority.map(function (a) { return { asset: a, odd: false }; });
      cells.splice(rng.int(per), 0, { asset: odd, odd: true });
      rows.push({ cells: cells, cat: A, oddCat: B });
    }
    if (rows.length < count) return false;
    var title = "Odd One Out", instruction = "Circle the picture in each row that does not belong.";
    var top = sh.head(title, instruction), avail = sh.bottom - top, pitch = Math.min(176, avail / rows.length), gap = 12;
    var nameSize = T.label, boxW = (F.w - (per - 1) * gap) / per, picH = pitch - nameSize - 26;
    if (picH < 70) { sh.fail("the pictures would be under 70 pt tall"); return null; }
    rows.forEach(function (r, ri) {
      var y = top + ri * pitch + 2;
      r.cells.forEach(function (c, ci) {
        var x = F.x + ci * (boxW + gap), nm = subjectName(c.asset);
        sh.rect(x, y, boxW, pitch - 12, { r: 10, w: S.stroke.rule, fill: "#fff" });
        sh.picture(S0.paths[c.asset.id], { x: x + 8, y: y + 6, w: boxW - 16, h: picH }, { detail: false, w: S.stroke.art });
        var s = sh.fitSize(nm, boxW - 12, nameSize + 2, "label", false);
        if (s == null) { sh.fail("\"" + nm + "\" does not fit under its picture"); s = CM.floorFor(st, "label"); }
        sh.text(nm, x + boxW / 2, y + pitch - 12 - 10, s, { role: "label", bold: true, align: "center" });
      });
    });
    sh.meta = { id: "oddone", title: title, instruction: instruction, topic: "", mode: "pictures",
      answers: rows.map(function (r, i) { return (i + 1) + ". " + subjectName(r.cells.filter(function (c) { return c.odd; })[0].asset); }), key: { rows: rows.map(function (r) { return r.cells.map(function (c) { return { id: c.asset.id, odd: c.odd }; }); }) } };
    return true;
  }
  function genOdd(sh, ctx, o) {
    var L = sh.S.limits.odd, st = sh.stage, usePic = (o.mode === "pictures") || (o.mode !== "words" && (st === "middle" || ctx.rng.chance(0.5)));
    if (usePic) {
      var res = oddPictures(sh, ctx, o, st === "early" ? 3 : L.puzzles, st === "early" ? 4 : 3);
      if (res === true || res === null) return;
    }
    oddText(sh, ctx, o, L.puzzles, L.items);
  }
  register("oddone", "Odd one out", genOdd);

  /* ---------- put it in order (every stage) ---------- */
  function genSequence(sh, ctx, o) {
    var D = content(o), rng = ctx.rng, S = sh.S, T = sh.T, F = sh.F, st = sh.stage, L = S.limits.sequence, bad = avoider(o);
    var procs = D.sequences.filter(function (p) { return !bad(p.title + " " + p.steps.join(" ")) && p.steps.length >= L.steps; });
    if (!procs.length) throw fatal("no procedure can be used for the order cards");
    var proc = procs[rotIndex(ctx, "proc", procs.length)];
    /* the steps: all of them, or an even spread for a stage that gets fewer */
    var steps = proc.steps.slice(), n = Math.min(L.steps, steps.length);
    if (steps.length > n) {
      var pick = [], i;
      for (i = 0; i < n; i++) pick.push(Math.round(i * (steps.length - 1) / (n - 1)));
      steps = pick.map(function (ix) { return steps[ix]; });
    }
    var order = null, t = 0;
    while (!order && t++ < 60) { var sh2 = rng.shuffle(range(n)); if (sh2.some(function (v, i) { return v !== i; }) && (!L.firstGiven || sh2[0] !== 0 || n < 3)) order = sh2; }
    order = order || range(n).reverse();
    var title = "Put It in Order", lower = proc.title.charAt(0).toLowerCase() + proc.title.slice(1);
    var instruction = st === "late" ? "Look at the steps for " + lower + ". Point to what comes next." : (L.firstGiven ? "Number the steps for " + lower + ". The first is done." : "Number the steps for " + lower + ", 1 to " + n + ".");
    var top = sh.head(title, instruction);

    /* the check at the foot, turned half round so it is read only when the page is turned */
    var ccSize = st === "late" ? 24 : T.label, checkLines = steps.map(function (s, i) { return (i + 1) + ".  " + s; });
    var cl = Math.round(ccSize * 1.3);
    /* join the steps into as few lines as will hold them */
    var joined = [], cur = "";
    checkLines.forEach(function (s) { var tt = cur ? cur + "     " + s : s; if (!cur || sh.width(tt, ccSize, st === "late") <= F.w - 24) cur = tt; else { joined.push(cur); cur = s; } });
    if (cur) joined.push(cur);
    var stripH = joined.length * cl + 30, stripTop = sh.bottom - stripH;
    sh.rect(F.x, stripTop, F.w, stripH - 4, { r: 10, w: S.stroke.rule, fill: "none" });
    joined.forEach(function (ln, li) { sh.text(ln, sh.cx, stripTop + 22 + li * cl, ccSize, { role: "label", align: "center", rotate: 180, bold: st === "late" }); });

    /* the cards */
    var avail = stripTop - 14 - top, gap = 12, ch = Math.min(st === "late" ? 112 : 84, Math.floor((avail - (n - 1) * gap) / n));
    if (ch < 52) { sh.fail("the order cards would be under 52 pt tall"); return; }
    var numW = Math.min(64, ch), cardX = F.x + numW + 14, cardW = F.w - numW - 14, size = st === "late" ? T.body : T.body;
    order.forEach(function (si, slot) {
      var y = top + slot * (ch + gap), text = steps[si];
      /* the number box, at the left */
      sh.rect(F.x, y + (ch - numW) / 2, numW, numW, { r: 8, w: S.stroke.art, fill: "#fff" });
      if (L.firstGiven && si === 0) sh.text("1", F.x + numW / 2, y + ch / 2 + numW * 0.34, Math.round(numW * 0.62), { role: "cell", bold: true, align: "center" });
      /* the card */
      sh.rect(cardX, y, cardW, ch, { r: 10, w: S.stroke.rule, fill: "#fff" });
      var s = size, lines = sh.wrap(text, cardW - 28, s, st === "late");
      while (s > CM.floorFor(st, "body") && (lines.length > 2 || lines.length * Math.round(s * 1.25) > ch - 12 || lines.some(function (l) { return sh.width(l, s, st === "late") > cardW - 28; }))) { s -= 1; lines = sh.wrap(text, cardW - 28, s, st === "late"); }
      if (lines.length > 2 || lines.some(function (l) { return sh.width(l, s, st === "late") > cardW - 28; })) { sh.fail("\"" + text + "\" does not fit its card"); return; }
      var lead = Math.round(s * 1.25), base = y + ch / 2 - ((lines.length - 1) * lead) / 2 + s * 0.35;
      lines.forEach(function (l, li) { sh.text(l, cardX + 16, base + li * lead, s, { role: "body" }); });
    });
    sh.meta = { id: "sequence", title: title, instruction: instruction, topic: lower,
      answers: steps.map(function (s, i) { return (i + 1) + ". " + s; }), key: { proc: proc.id, steps: steps, order: order } };
  }
  register("sequence", "Put it in order", genSequence);

  /* ---------- choose the ending (every stage) ---------- */
  function genChoose(sh, ctx, o) {
    var D = content(o), rng = ctx.rng, S = sh.S, T = sh.T, F = sh.F, st = sh.stage, L = S.limits.choose, bad = avoider(o);
    var okItem = function (s) {
      var all = [s.lead, s.answer].concat(s.others);
      if (!all.every(function (t) { return seemly(t, bad); })) return false;
      if (st === "late" && (s.lead.length > 30 || s.answer.length > 12)) return false;
      if (st === "middle" && s.answer.length > 18) return false;
      return true;
    };
    var count = L.items, picks = pickRot(ctx, "choose", D.sayings, count * 2, okItem), items = [];
    picks.forEach(function (s) { if (items.length < count && !items.some(function (x) { return x.kind === s.kind && x.lead.split(" ")[0] === s.lead.split(" ")[0] && x.kind !== "proverb"; })) items.push(s); });
    if (items.length < Math.min(count, 3)) { sh.fail("too few lines to finish"); return; }
    var title = "Choose the Ending", instruction = st === "late" ? "Point to the word that finishes each line." : "Circle the word that finishes each line.";
    var top = sh.head(title, instruction), ws = T.word, lineSize = T.body, bold = st === "late";
    var lay = null, use = items.length;
    while (!lay && use >= 2) {
      var avail = sh.bottom - top, pitch = avail / use, chipH = Math.round(ws * 1.9), leadH = pitch - chipH - 20, ok = true, blocks = [];
      items.slice(0, use).forEach(function (s) {
        var blank = "_______", text = s.lead + " " + blank, size = lineSize, lines = sh.wrap(text, F.w, size, bold);
        while (size > CM.floorFor(st, "body") && lines.length > 1 && (lines.length * Math.round(size * 1.25) > leadH)) { size -= 1; lines = sh.wrap(text, F.w, size, bold); }
        if (lines.length * Math.round(size * 1.25) > leadH + 2 || lines.some(function (l) { return sh.width(l, size, bold) > F.w; })) ok = false;
        blocks.push({ s: s, size: size, lines: lines });
      });
      if (ok && pitch >= chipH + 56) lay = { use: use, pitch: pitch, chipH: chipH, blocks: blocks }; else use--;
    }
    if (!lay) { sh.fail("the lines to finish do not fit the page"); return; }
    var answers = [], optCount = L.options;
    lay.blocks.forEach(function (b, bi) {
      var s = b.s, y = top + bi * lay.pitch, lead = Math.round(b.size * 1.25);
      b.lines.forEach(function (l, li) {
        if (li === b.lines.length - 1) {
          /* the last line ends in a blank: drawn as a rule, not as underscores */
          var stem = l.replace(/\s*_+$/, ""), w0 = sh.width(stem + " ", b.size, bold);
          sh.text(stem, F.x, y + b.size + li * lead, b.size, { role: "body" });
          sh.line(F.x + w0, y + b.size + li * lead + 2, Math.min(F.x + F.w, F.x + w0 + 120), y + b.size + li * lead + 2, { w: S.stroke.rule });
        } else sh.text(l, F.x, y + b.size + li * lead, b.size, { role: "body" });
      });
      var opts = [s.answer].concat(rng.shuffle(s.others).slice(0, optCount - 1)), correct = rng.int(opts.length);
      opts = rng.shuffle(opts);
      correct = opts.indexOf(s.answer);
      var cw = opts.map(function (t) { return Math.ceil(sh.width(t, ws, bold)) + 36; }), gap = 16, total = cw.reduce(function (a, c) { return a + c; }, 0) + gap * (opts.length - 1);
      if (total > F.w) { sh.fail("the choices for \"" + s.lead + "\" do not fit across the page"); return; }
      var cy = y + b.lines.length * lead + 10, x = F.x;
      opts.forEach(function (t, k) {
        sh.rect(x, cy, cw[k], lay.chipH, { r: 10, w: S.stroke.rule, fill: "#fff" });
        sh.text(t, x + cw[k] / 2, cy + lay.chipH / 2 + ws * 0.35, ws, { role: "choice", bold: bold, align: "center" });
        x += cw[k] + gap;
      });
      answers.push(s.lead + " " + s.answer);
    });
    sh.meta = { id: "choose-ending", title: title, instruction: instruction, topic: "", answers: answers, key: { ids: lay.blocks.map(function (b) { return b.s.id; }) } };
  }
  register("choose-ending", "Choose the ending", genChoose);

  /* ---------- match the picture to its name (every stage) ---------- */
  function derange(n, rng) {
    if (n < 2) return range(n);
    var p = null, t = 0;
    while (!p && t++ < 60) { var s = rng.shuffle(range(n)); if (s.every(function (v, i) { return v !== i; })) p = s; }
    if (p) return p;
    var out = range(n); out.push(out.shift()); return out;
  }
  function genMatching(sh, ctx, o) {
    var S0 = subjectsOf(o);
    if (!S0) throw fatal("The coloring pictures are not loaded, so the matching page cannot be drawn.");
    var rng = ctx.rng, S = sh.S, T = sh.T, F = sh.F, st = sh.stage, L = S.limits.matching, bad = avoider(o);
    var pool = subjectPool(o, st, bad, S0).filter(function (a) { return a.category === "vehicles" || a.category === "objects" || a.category === "nostalgia"; })
      .sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    var clash = {}, items = [];
    pickRot(ctx, "match", pool, L.pairs * 3, function (a) {
      if (items.length >= L.pairs || clash[clashOf(a)]) return false;
      if (sh.fitSize(subjectName(a), 10000, T.word, "word", true) == null) return false;
      clash[clashOf(a)] = 1; items.push(a); return true;
    });
    if (items.length < L.pairs) { sh.fail("too few pictures for the matching page"); return; }
    var title = "Match the Picture", instruction = st === "early" ? "Draw a line from each picture to its name." : "Draw a line from each picture to its name. The first line is done.";
    var top = sh.head(title, instruction), n = items.length, avail = sh.bottom - top, pitch = avail / n, picH = Math.floor(pitch - 14);
    var picW = Math.floor(Math.min(F.w * 0.42, picH * 1.45)), nameX = F.x + F.w - Math.floor(F.w * 0.40), nameW = F.x + F.w - nameX;
    var names = items.map(subjectName), base = st === "early" ? T.word + 2 : T.word;
    var size = names.reduce(function (m, nm) { var s = sh.fitSize(nm, nameW - 34, base, "word", true); return s == null ? -1 : (m < 0 ? -1 : Math.min(m, s)); }, base);
    if (size < 0) { sh.fail("a name does not fit beside the pictures"); return; }
    var order = derange(n, rng), chipH = Math.round(size * 1.9), dotR = 8;
    items.forEach(function (a, i) {
      var y = top + i * pitch + 2;
      sh.rect(F.x, y, picW, picH, { r: 10, w: S.stroke.rule, fill: "#fff" });
      sh.picture(S0.paths[a.id], { x: F.x + 6, y: y + 6, w: picW - 12, h: picH - 12 }, { detail: false, w: S.stroke.art });
      sh.circle(F.x + picW + 12, y + picH / 2, dotR, { fill: "#000", w: S.stroke.rule });
    });
    order.forEach(function (ai, slot) {
      var y = top + slot * pitch + 2 + (picH - chipH) / 2, nm = names[ai];
      sh.rect(nameX + 20, y, nameW - 20, chipH, { r: 10, w: S.stroke.rule, fill: "#fff" });
      sh.circle(nameX + 8, y + chipH / 2, dotR, { fill: "#000", w: S.stroke.rule });
      sh.text(nm, nameX + 20 + (nameW - 20) / 2, y + chipH / 2 + size * 0.35, size, { role: "word", bold: true, align: "center" });
    });
    if (st !== "early") {
      var slot0 = order.indexOf(0), ya = top + 2 + picH / 2, yb = top + slot0 * pitch + 2 + picH / 2;
      sh.line(F.x + picW + 12, ya, nameX + 8, yb, { w: S.stroke.art });
    }
    sh.meta = { id: "matching", title: title, instruction: instruction, topic: names[0].toLowerCase(),
      answers: items.map(function (a, i) { return "Picture " + (i + 1) + " is the " + names[i].toLowerCase() + " (name " + (order.indexOf(i) + 1) + " from the top)"; }),
      key: { ids: items.map(function (a) { return a.id; }), order: order } };
  }
  register("matching", "Match the picture to its name", genMatching);

  /* ---------- the maze: a long way round, in thick walls (every stage) ---------- */
  function mazeSolve(passages, cols, rows) {
    var prev = {}, q = [[0, 0]], seen = { "0,0": 1 };
    while (q.length) {
      var cur = q.shift(), c = cur[0], r = cur[1];
      if (c === cols - 1 && r === rows - 1) break;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nc = c + d[0], nr = r + d[1], k = nc + "," + nr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || seen[k] || !passages[c + "," + r + ">" + k]) return;
        seen[k] = 1; prev[k] = c + "," + r; q.push([nc, nr]);
      });
    }
    var out = [], k = (cols - 1) + "," + (rows - 1);
    if (!seen[k]) return null;
    while (k) { out.unshift(k.split(",").map(Number)); k = prev[k]; }
    return out;
  }
  var link = function (P, a, b) { P[a[0] + "," + a[1] + ">" + b[0] + "," + b[1]] = true; P[b[0] + "," + b[1] + ">" + a[0] + "," + a[1]] = true; };
  var DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  /* every cell open: a perfect maze (one way through, with turnings that lead nowhere) */
  function fullMaze(cols, rows, rng) {
    var P = {}, seen = {}, stack = [[0, 0]];
    seen["0,0"] = 1;
    while (stack.length) {
      var cur = stack[stack.length - 1], opts = DIRS4.map(function (d) { return [cur[0] + d[0], cur[1] + d[1]]; })
        .filter(function (n) { return n[0] >= 0 && n[1] >= 0 && n[0] < cols && n[1] < rows && !seen[n[0] + "," + n[1]]; });
      if (!opts.length) { stack.pop(); continue; }
      var nx = rng.pick(opts); seen[nx[0] + "," + nx[1]] = 1; link(P, cur, nx); stack.push(nx);
    }
    return { P: P, used: function () { return true; } };
  }
  /* only the way through and a few short turnings that lead nowhere: a wide track, no clutter. The track never runs beside
     itself, so every corridor is bounded by solid black and there is only ever one way to go. */
  function trackMaze(cols, rows, rng, deadEnds) {
    var goal = (cols - 1) + "," + (rows - 1), found = null, tries = 0, minLen = cols + rows + 1;
    var near = function (a, b) { return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1; };
    while (!found && tries++ < 600) {
      if (tries === 300) minLen = cols + rows - 1;
      var maxLen = minLen + 6, path = [[0, 0]], seen = { "0,0": 1 }, steps = 0;
      (function walk() {
        if (found || steps++ > 6000) return;
        var cur = path[path.length - 1], key = cur[0] + "," + cur[1];
        if (key === goal) { if (path.length >= minLen) found = path.slice(); return; }
        if (path.length >= maxLen) return;
        rng.shuffle(DIRS4).forEach(function (d) {
          var n = [cur[0] + d[0], cur[1] + d[1]], k = n[0] + "," + n[1];
          if (found || n[0] < 0 || n[1] < 0 || n[0] >= cols || n[1] >= rows || seen[k]) return;
          if (Math.abs(n[0] - (cols - 1)) + Math.abs(n[1] - (rows - 1)) > maxLen - path.length) return;
          /* no chord: the new cell touches only the cell it comes from */
          for (var i = 0; i < path.length - 1; i++) if (near(path[i], n)) return;
          seen[k] = 1; path.push(n); walk();
          if (!found) { path.pop(); delete seen[k]; }
        });
      })();
    }
    if (!found) return null;
    var P = {}, used = {};
    found.forEach(function (c, i) { used[c[0] + "," + c[1]] = 1; if (i) link(P, found[i - 1], c); });
    var added = 0;
    rng.shuffle(found.slice(1, -1)).forEach(function (c) {
      if (added >= deadEnds) return;
      var opts = DIRS4.map(function (d) { return [c[0] + d[0], c[1] + d[1]]; }).filter(function (n) {
        if (n[0] < 0 || n[1] < 0 || n[0] >= cols || n[1] >= rows || used[n[0] + "," + n[1]]) return false;
        /* the turning's only used neighbor is the track it leaves */
        return DIRS4.every(function (d) { var m = (n[0] + d[0]) + "," + (n[1] + d[1]); return m === c[0] + "," + c[1] || !used[m]; });
      });
      if (!opts.length) return;
      var n = rng.pick(opts); used[n[0] + "," + n[1]] = 1; link(P, c, n); added++;
    });
    return { P: P, used: function (c, r) { return !!used[c + "," + r]; }, path: found };
  }
  function genMaze(sh, ctx, o) {
    var rng = ctx.rng, S = sh.S, T = sh.T, F = sh.F, st = sh.stage, L = S.limits.maze, cols = L.cols, rows = L.rows;
    var built = null, best = null, solution = null, t;
    if (st === "late") {
      built = trackMaze(cols, rows, rng, L.deadEnds || 0);
      if (!built) throw fatal("no track could be drawn for the large-print maze");
      solution = built.path;
    } else {
      for (t = 0; t < 40; t++) {
        var m = fullMaze(cols, rows, rng), sol = mazeSolve(m.P, cols, rows);
        if (sol && (!best || sol.length > best.sol.length)) best = { m: m, sol: sol };
      }
      built = best.m; solution = best.sol;
    }
    var title = "Find Your Way Through", instruction = st === "late" ? "Trace the track from the arrow at the top to the arrow at the bottom." : "Start at the top arrow. Find the way to the bottom arrow.";
    var top = sh.head(title, instruction), label = T.label, padTop = label + 34, padBot = label + 34;
    var avail = sh.bottom - top - padTop - padBot, cell = Math.floor(Math.min(F.w / cols, avail / rows));
    if (cell < 40) { sh.fail("the maze corridors would be under 40 pt wide"); return; }
    var mw = cell * cols, mh = cell * rows, mx = Math.round(sh.cx - mw / 2), my = Math.round(top + padTop + (avail - mh) / 2);
    var used = built.used, open = function (c1, r1, c2, r2) { return !!built.P[c1 + "," + r1 + ">" + c2 + "," + r2]; };
    var inUse = function (c, r) { return c >= 0 && r >= 0 && c < cols && r < rows && used(c, r); };
    /* horizontal wall segments (a wall above row r at column c) and vertical ones, then merged into runs */
    var segs = [], r, c;
    for (r = 0; r <= rows; r++) {
      var run = null;
      for (c = 0; c <= cols; c++) {
        var wall = false;
        if (c < cols) {
          var a = inUse(c, r - 1), b = inUse(c, r);
          wall = (a || b) && !(a && b && open(c, r - 1, c, r));
          if (r === 0 && c === 0) wall = false;                       // the way in
          if (r === rows && c === cols - 1) wall = false;             // the way out
        }
        if (wall && !run) run = c;
        if (!wall && run != null) { segs.push([mx + run * cell, my + r * cell, mx + c * cell, my + r * cell]); run = null; }
      }
    }
    for (c = 0; c <= cols; c++) {
      var run2 = null;
      for (r = 0; r <= rows; r++) {
        var wall2 = false;
        if (r < rows) {
          var a2 = inUse(c - 1, r), b2 = inUse(c, r);
          wall2 = (a2 || b2) && !(a2 && b2 && open(c - 1, r, c, r));
        }
        if (wall2 && run2 == null) run2 = r;
        if (!wall2 && run2 != null) { segs.push([mx + c * cell, my + run2 * cell, mx + c * cell, my + r * cell]); run2 = null; }
      }
    }
    var d = segs.map(function (s) { return dLine(s[0], s[1], s[2], s[3]); }).join("");
    if (st === "late") {
      /* a track on its own cannot be told from the space around it, so everything that is not track is black */
      for (r = 0; r < rows; r++) {
        var from = null;
        for (c = 0; c <= cols; c++) {
          var solid = c < cols && !inUse(c, r);
          if (solid && from == null) from = c;
          if (!solid && from != null) { sh.rect(mx + from * cell, my + r * cell, (c - from) * cell, cell, { fill: "#000", w: S.stroke.motor, role: "motor" }); from = null; }
        }
      }
    }
    sh.path(d, { w: S.stroke.motor, fill: "none", role: "motor" });
    /* the arrows in and out, with their words */
    var ax = mx + cell / 2, tri = function (x, y, up) { return dPoly([[x - 12, y], [x + 12, y], [x, y + (up ? -16 : 16)]], true); };
    sh.text("START", ax, my - 30, label, { role: "label", bold: true, align: "center" });
    sh.path(dPoly([[ax - 12, my - 22], [ax + 12, my - 22], [ax, my - 5]], true), { fill: "#000", w: S.stroke.rule });
    var ex = mx + mw - cell / 2;
    sh.path(dPoly([[ex - 12, my + mh + 5], [ex + 12, my + mh + 5], [ex, my + mh + 22]], true), { fill: "#000", w: S.stroke.rule });
    sh.text("FINISH", ex, my + mh + 22 + 8 + label, label, { role: "label", bold: true, align: "center" });
    void tri;
    sh.meta = { id: "maze", title: title, instruction: instruction, topic: "", cols: cols, rows: rows, cell: cell,
      answers: ["The way through is " + solution.length + " squares long. Start at the top left; the way out is at the bottom right."],
      key: { solution: solution, x: mx, y: my, cell: cell, cols: cols, rows: rows } };
  }
  register("maze", "Large-print maze", genMaze);

  /* ---------- follow the path: a wide lane to trace (middle, late) ---------- */
  function genPathTrace(sh, ctx, o) {
    var rng = ctx.rng, S = sh.S, T = sh.T, F = sh.F, st = sh.stage, late = st === "late";
    var lane = late ? 76 : 60, title = "Follow the Path", instruction = late ? "Trace along the path with a finger or a thick marker." : "Trace along the path. Stay inside the lines.";
    var top = sh.head(title, instruction), label = T.label, padTop = label + 26, padBot = label + 26;
    var yTop = top + padTop + lane / 2, yBot = sh.bottom - padBot - lane / 2, rowsN = late ? rng.range(2, 3) : rng.range(3, 4), sp = 0;
    while (rowsN > 2 && (yBot - yTop) / (rowsN - 1) < lane + 26) rowsN--;
    if (rowsN < 2) { sh.fail("no room for a path"); return; }
    /* the rows are no further apart than the lane's width plus a generous gap, and the whole path sits in the middle of the space */
    sp = Math.min((yBot - yTop) / (rowsN - 1), lane + 120);
    if (sp < lane + 26) { sh.fail("the rows of the path would touch"); return; }
    var y0 = yTop + ((yBot - yTop) - sp * (rowsN - 1)) / 2, yLast = y0 + sp * (rowsN - 1), margin = 8, R = sp / 2, amp = 0;
    var xa = F.x + margin + R + lane / 2, xb = F.x + F.w - margin - R - lane / 2;
    if (xb - xa < 80) { sh.fail("the path's turns leave no room for the straight parts"); return; }
    var xLeft = F.x + margin + 3, xRight = F.x + F.w - margin - 3, fr0 = 1 + rng.int(2) * 0.5 + (rng.chance(0.5) ? 0.5 : 0);
    /* the wiggle must curve more gently than the lane is wide, or the lane's two edges would cross each other */
    amp = Math.max(0, Math.min(16, (sp - lane - 18) / 2.4, Math.pow(xb - xa, 2) / (Math.pow(TAU * fr0, 2) * (lane / 2 + 10))));
    var pts = [], i, k;
    var wig = function (x, ph, fr) { var t = (x - xa) / (xb - xa); if (t <= 0 || t >= 1) return 0; var w = Math.sin(Math.PI * t); return amp * w * w * Math.sin(TAU * fr * t + ph); };
    for (i = 0; i < rowsN; i++) {
      var dir = i % 2 === 0 ? 1 : -1, yc = y0 + i * sp, ph = rng.next() * TAU, fr = fr0;
      var from = i === 0 ? xLeft : (dir > 0 ? xa : xb), to = i === rowsN - 1 ? (dir > 0 ? xRight : xLeft) : (dir > 0 ? xb : xa);
      var n = Math.max(2, Math.ceil(Math.abs(to - from) / 6));
      for (k = pts.length ? 1 : 0; k <= n; k++) { var x = from + (to - from) * k / n; pts.push([x, yc + wig(x, ph, fr)]); }
      if (i < rowsN - 1) {
        var cx = dir > 0 ? xb : xa, steps = 30;
        for (k = 1; k <= steps; k++) { var a = -Math.PI / 2 + Math.PI * k / steps; pts.push([cx + dir * R * Math.cos(a), yc + R + R * Math.sin(a)]); }
      }
    }
    var left = [], right = [];
    pts.forEach(function (p, ix) {
      var p0 = pts[Math.max(0, ix - 1)], p1 = pts[Math.min(pts.length - 1, ix + 1)], tx = p1[0] - p0[0], ty = p1[1] - p0[1], len = Math.hypot(tx, ty) || 1, nx = -ty / len, ny = tx / len;
      left.push([p[0] + nx * lane / 2, p[1] + ny * lane / 2]); right.push([p[0] - nx * lane / 2, p[1] - ny * lane / 2]);
    });
    sh.path(dPoly(left.concat(right.reverse()), true), { fill: "#fff", w: S.stroke.motor, role: "motor" });
    /* the arrow at the start, the target at the finish, and their words */
    var s0 = pts[0], dirEnd = (rowsN - 1) % 2 === 0 ? 1 : -1, e0 = pts[pts.length - 1];
    sh.path(dPoly([[s0[0] + 14, s0[1] - 15], [s0[0] + 14, s0[1] + 15], [s0[0] + 40, s0[1]]], true), { fill: "#000", w: S.stroke.rule });
    var ex = e0[0] - dirEnd * (lane * 0.62);
    sh.circle(ex, e0[1], lane * 0.3, { fill: "#fff", w: S.stroke.rule });
    sh.circle(ex, e0[1], lane * 0.13, { fill: "#000", w: S.stroke.rule });
    sh.text("START", s0[0] - lane * 0.0 + 2, s0[1] - lane / 2 - 14, label, { role: "label", bold: true, align: "left" });
    sh.text("FINISH", e0[0], e0[1] + lane / 2 + 12 + label, label, { role: "label", bold: true, align: dirEnd > 0 ? "right" : "left" });
    sh.meta = { id: "pathtrace", title: title, instruction: instruction, topic: "", lane: lane, rows: rowsN, answers: ["Trace from the arrow at the top left to the target. The path is " + lane + " points wide."], key: { center: pts, lane: lane } };
  }
  register("pathtrace", "Follow the path", genPathTrace);

  /* ---------- today: the day, the season and the weather (every stage) ---------- */
  var DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var SEASON_ORDER = ["spring", "summer", "fall", "winter"], WEATHER_ORDER = ["sunny", "cloudy", "rainy", "snowy"];
  /* a cloud, drawn as one closed outline in a 100 by 60 box */
  function cloudD(cx, cy, w) {
    var k = w / 100, X = function (v) { return cx + (v - 50) * k; }, Y = function (v) { return cy + (v - 30) * k; };
    var q = function (a, b) { return pt(X(a), Y(b)); };
    return "M" + q(20, 52) + "C" + q(8, 52) + " " + q(0, 44) + " " + q(6, 34) + "C" + q(9, 27) + " " + q(16, 26) + " " + q(22, 28) + "C" + q(22, 14) + " " + q(34, 6) + " " + q(46, 8) +
      "C" + q(58, 10) + " " + q(64, 16) + " " + q(66, 25) + "C" + q(78, 21) + " " + q(92, 29) + " " + q(91, 41) + "C" + q(90, 48) + " " + q(84, 52) + " " + q(76, 52) + "Z";
  }
  function weatherIcon(sh, kind, cx, cy, s, w) {
    if (kind === "sunny") {
      sh.circle(cx, cy, s * 0.24, { fill: "#fff", w: w, role: "subject" });
      for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; sh.line(cx + Math.cos(a) * s * 0.36, cy + Math.sin(a) * s * 0.36, cx + Math.cos(a) * s * 0.5, cy + Math.sin(a) * s * 0.5, { w: w, role: "subject" }); }
      return;
    }
    var up = kind === "cloudy" ? 0 : -s * 0.08;
    sh.path(cloudD(cx, cy + up, s * 0.92), { fill: "#fff", w: w, role: "subject" });
    if (kind === "rainy") for (var j = -1; j <= 1; j++) sh.line(cx + j * s * 0.2 - s * 0.04, cy + s * 0.3, cx + j * s * 0.2 - s * 0.12, cy + s * 0.46, { w: w, role: "subject" });
    if (kind === "snowy") for (var m = -1; m <= 1; m++) {
      var fx = cx + m * s * 0.22, fy = cy + s * 0.37, rr = s * 0.07;
      [0, 1, 2].forEach(function (t) { var b = t * Math.PI / 3; sh.line(fx - Math.cos(b) * rr, fy - Math.sin(b) * rr, fx + Math.cos(b) * rr, fy + Math.sin(b) * rr, { w: w, role: "subject" }); });
    }
  }
  function genOrientation(sh, ctx, o) {
    var S = sh.S, T = sh.T, F = sh.F, st = sh.stage, day = ctx.day, weekday = new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
    var south = o.south != null ? !!o.south : CM.southern(o.timeZone), season = CM.seasonOf(day.m, south), weather = WEATHER_ORDER.indexOf(String(o.weather || "").toLowerCase()) >= 0 ? String(o.weather).toLowerCase() : "";
    var late = st === "late", title = "Today";
    var instruction = late ? "Circle today's weather." : "Look outside together. Circle the weather you see.";
    var y = sh.head(title, instruction), gap = 8, rule = S.stroke.rule;
    var bigSize = sh.fitSize(DAY_NAMES[weekday].toUpperCase(), F.w - 20, late ? 64 : st === "middle" ? 54 : 46, "title", true);
    if (bigSize == null) { sh.fail("the day's name does not fit"); return; }
    /* the day, large, and the date under it */
    sh.text(DAY_NAMES[weekday].toUpperCase(), sh.cx, y + bigSize * 0.84, bigSize, { role: "title", bold: true, align: "center" });
    y += Math.round(bigSize * 0.84) + 12;
    var dateText = MONTHS[day.m - 1] + " " + day.d + ", " + day.y, dsize = sh.fitSize(dateText, F.w, T.title, "title", true);
    sh.text(dateText, sh.cx, y + dsize * 0.84, dsize, { role: "title", bold: true, align: "center" });
    y += Math.round(dsize * 0.84) + 16;
    /* the days of the week, today in black */
    var bh = late ? 60 : st === "middle" ? 54 : 48, bw = (F.w - 6 * gap) / 7, ls = T.label;
    DAY_ABBR.forEach(function (ab, i) {
      var x = F.x + i * (bw + gap);
      if (i === weekday) sh.inverse(x, y, bw, bh, ab, ls, { w: rule });
      else { sh.rect(x, y, bw, bh, { r: 6, w: rule, fill: "#fff" }); sh.text(ab, x + bw / 2, y + bh / 2 + ls * 0.35, ls, { role: "label", bold: true, align: "center" }); }
    });
    y += bh + 20;
    /* the season */
    sh.text("The season", F.x, y + T.label * 0.8, T.label, { role: "label", bold: true });
    y += Math.round(T.label * 0.8) + 10;
    var sw = (F.w - 3 * gap) / 4;
    SEASON_ORDER.forEach(function (sn, i) {
      var x = F.x + i * (sw + gap), nm = sn.toUpperCase();
      if (sn === season) sh.inverse(x, y, sw, bh, nm, ls, { w: rule });
      else { sh.rect(x, y, sw, bh, { r: 6, w: rule, fill: "#fff" }); sh.text(nm, x + sw / 2, y + bh / 2 + ls * 0.35, ls, { role: "label", bold: true, align: "center" }); }
    });
    y += bh + 20;
    /* the weather */
    sh.text("The weather", F.x, y + T.label * 0.8, T.label, { role: "label", bold: true });
    y += Math.round(T.label * 0.8) + 10;
    var promptH = late ? 0 : 66, ih = Math.min(late ? 150 : 130, sh.bottom - promptH - y), iw = (F.w - 3 * gap) / 4;
    if (ih < 90) { sh.fail("the weather pictures would be under 90 pt tall"); return; }
    var labH = ls + 14, pich = ih - labH;
    WEATHER_ORDER.forEach(function (wk, i) {
      var x = F.x + i * (iw + gap), on = wk === weather;
      sh.rect(x, y, iw, ih, { r: 10, w: on ? S.stroke.motor : rule, fill: "#fff" });
      weatherIcon(sh, wk, x + iw / 2, y + pich / 2 + 4, Math.min(iw - 14, pich + 6), S.stroke.art);
      var nm = cap(wk);
      if (on) sh.inverse(x + 6, y + ih - labH - 4, iw - 12, labH, nm, ls, { w: rule, r: 5 });
      else sh.text(nm, x + iw / 2, y + ih - 10, ls, { role: "label", bold: true, align: "center" });
    });
    y += ih + 14;
    if (!late) {
      sh.text("One thing I notice today:", F.x, y + T.label, T.label, { role: "label", bold: true });
      sh.line(F.x, y + T.label + 30, F.x + F.w, y + T.label + 30, { w: rule });
    }
    sh.meta = { id: "orientation", title: title, instruction: instruction, topic: "today", day: DAY_NAMES[weekday], season: season,
      answers: [DAY_NAMES[weekday] + ", " + dateText + "; " + season + (weather ? "; " + weather : "; the weather is for you to see together")], key: { weekday: weekday, season: season, weather: weather } };
  }
  register("orientation", "Today: day, season and weather", genOrientation);

  /* ---------- a shape to look at, in a bold pattern frame (middle, late) ---------- */
  function kit() {
    var ce = root.CognicopiaColoringEngine;
    if (!ce || !ce.kit) throw fatal("Load src/engine/ColoringEngine.js before the shape page.");
    return ce.kit;
  }
  /* rings of cells around a disc: the outer band's cells hold petals, the inner band's hold dots (middle), or one band of big dots (late).
     Every cell is closed by two circles and two straight lines, and none is smaller than a tenth of a square inch. Returns the disc's radius. */
  function ringFrame(sh, K, cx, cy, R, rnd) {
    var S = sh.S, late = sh.stage === "late", w = S.stroke.art, bands = late ? [0.64, 1] : [0.5, 0.74, 1], N = late ? 8 : (rnd() < 0.5 ? 10 : 12), bi, j;
    sh.circle(cx, cy, R, { fill: "#fff", w: w, role: "border" });
    for (bi = bands.length - 1; bi >= 1; bi--) {
      var ri = bands[bi - 1] * R, ro = bands[bi] * R, off = (bi % 2 ? 0 : Math.PI / N) + (late ? Math.PI / N : 0);
      if (bi < bands.length - 1) sh.circle(cx, cy, ro, { fill: "#fff", w: w, role: "border" });
      for (j = 0; j < N; j++) {
        var a = off + TAU * j / N;
        sh.line(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri, cx + Math.cos(a) * ro, cy + Math.sin(a) * ro, { w: w, role: "border" });
      }
      for (j = 0; j < N; j++) {
        var am = off + TAU * (j + 0.5) / N, rc = (ri + ro) / 2, m = 0.34 * Math.min(ro - ri, rc * TAU / N), px = cx + Math.cos(am) * rc, py = cy + Math.sin(am) * rc;
        if (late || bi === 1) sh.circle(px, py, m * (late ? 1.1 : 0.95), { fill: "#fff", w: w, role: "border" });
        else sh.path(K.petal([cx + Math.cos(am) * (rc - m * 1.15), cy + Math.sin(am) * (rc - m * 1.15)], [cx + Math.cos(am) * (rc + m * 1.15), cy + Math.sin(am) * (rc + m * 1.15)], m * 0.6), { fill: "#fff", w: w, role: "border" });
      }
    }
    sh.circle(cx, cy, bands[0] * R, { fill: "#fff", w: w, role: "border" });
    return bands[0] * R - w / 2;
  }
  function genSilhouette(sh, ctx, o) {
    var S0 = subjectsOf(o);
    if (!S0) throw fatal("The coloring pictures are not loaded, so the shape page cannot be drawn.");
    var K = kit(), rng = ctx.rng, S = sh.S, T = sh.T, F = sh.F, st = sh.stage, bad = avoider(o), late = st === "late";
    var pool = subjectPool(o, st, bad, S0).filter(function (a) { return SILHOUETTE_OK.indexOf(a.id) >= 0; }).sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    if (o.prefer) { var pref = pool.filter(function (a) { return a.category === o.prefer || a.id === o.prefer; }); if (pref.length) pool = pref; }
    if (!pool.length) throw fatal("no shape can be used for this resident");
    var asset = pool[rotIndex(ctx, "shape", pool.length)], name = subjectName(asset);
    var title = late ? "Look Together" : "Color the Pattern", instruction = late ? "Trace around the " + name.toLowerCase() + " with a finger." : "Color the pattern around the " + name.toLowerCase() + ". Choose any colors you like.";
    var top = sh.head(title, instruction), capSize = late ? 40 : 30, capH = capSize + 24;
    var capFit = sh.fitSize(name.toUpperCase(), F.w, capSize, "title", true);
    if (capFit == null) { sh.fail("the name does not fit under the shape"); return; }
    var fr = { x: F.x, y: top, w: F.w, h: sh.bottom - top - capH };
    var paths = S0.paths[asset.id].filter(function (p) { return !p[2]; }), bb = [Infinity, Infinity, -Infinity, -Infinity];
    paths.forEach(function (p) { bbox(parse(p[0]), bb); });
    var aspect = (bb[2] - bb[0]) / Math.max(1, bb[3] - bb[1]), pattern;
    if (aspect < 1.45) {
      /* a round or tall shape sits in a mandala: rings of petals and dots around a disc */
      var R = Math.min(fr.w, fr.h) / 2 - S.stroke.art / 2 - 2, cx = fr.x + fr.w / 2, cy = fr.y + fr.h / 2, inner = ringFrame(sh, K, cx, cy, R, K.rng(PCG.prng.seedInt(ctx.rng.seed + "/frame")));
      var hh = 2 * inner * 0.9 / Math.sqrt(1 + aspect * aspect), ww = hh * aspect;
      sh.picture(S0.paths[asset.id], { x: cx - ww / 2, y: cy - hh / 2, w: ww, h: hh }, { fill: "#000", w: S.stroke.art, detail: false, role: "subject" });
      pattern = "mandala";
    } else {
      /* a wide shape, a car or a train, sits in a pattern border */
      var b = late ? 62 : 52, padIn = late ? 18 : 16, br = K.border(fr, b, st, K.rng(PCG.prng.seedInt(ctx.rng.seed + "/frame")));
      br.items.forEach(function (it) { sh.path(it.d, { fill: it.fill, w: it.w, role: "border" }); });
      sh.picture(S0.paths[asset.id], { x: fr.x + b + padIn, y: fr.y + b + padIn, w: fr.w - 2 * (b + padIn), h: fr.h - 2 * (b + padIn) }, { fill: "#000", w: S.stroke.art, detail: false, role: "subject" });
      pattern = br.pattern;
    }
    sh.text(name.toUpperCase(), sh.cx, sh.bottom - 8, capFit, { role: "title", bold: true, align: "center" });
    sh.meta = { id: "silhouette", title: title, instruction: instruction, topic: "the " + name.toLowerCase(), subject: asset.id, pattern: pattern,
      answers: ["The shape is the " + name.toLowerCase() + ". There is no right or wrong way to color the pattern."], key: { subject: asset.id } };
  }
  register("silhouette", "Shape to look at", genSilhouette);

  /* =====================================================================
     THE ENTRY POINTS
     ===================================================================== */
  var ALIAS = { "maze-motor": "maze", "sequence-cards": "sequence", "oddone-words": "oddone", "wordsearch-large": "search-large", "wordsearch-guided": "search-guided" };

  /* generate(kind, o) -> a page model, or throws an Error saying why not.
     o: { stage, name, date, variant, slot, frame, measure, subjects, data, avoid, allow, weather, south, force } */
  function generate(kind, o) {
    o = o || {};
    var id = ALIAS[kind] || kind, g = REG[id];
    if (!g) throw new Error("There is no activity called \"" + kind + "\".");
    var st = CM.stageOf(o.stage);
    if (!o.force && !CM.allowed(st, id)) throw new Error(CM.why(st, id) || ("The " + g.title + " page is not made for the " + st + " stage."));
    var P = PCG.prng;
    if (!P) throw fatal("Load src/pcg/prng.js before ClinicalActivities.js.");
    var day = P.dateParts(o.date == null ? P.today() : o.date), last = "", attempt;
    for (attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      var ctx = makeCtx(id, st, day, o, attempt), sh = sheet(id, st, o);
      try { g.fn(sh, ctx, o); }
      catch (e) { if (e.fatal) throw e; last = e && e.message ? e.message : String(e); continue; }
      var probs = sh.problems();
      if (!probs.length && sh.items.length + sh.texts.length > 0) {
        var page = sh.model(), m = page.meta;
        m.kind = id; m.stage = st; m.seed = ctx.rng.seed; m.date = day.iso; m.attempts = attempt + 1; m.cueKind = CM.kindOf(id); m.engine = VERSION;
        if (!m.title) m.title = g.title;
        return page;
      }
      last = probs[0] || "the page is empty";
    }
    throw new Error("The " + g.title + " page could not be laid out for the " + st + " stage: " + last);
  }
  /* the same, for a caller that must not stop: { page } or { error } */
  function tryGenerate(kind, o) {
    try { return { page: generate(kind, o), error: "" }; }
    catch (e) { return { page: null, error: e && e.message ? e.message : String(e) }; }
  }

  /* the page makers, with what the matrix says about each */
  function kinds() {
    return Object.keys(REG).map(function (id) {
      var a = CM.entry("packet", id) || CM.entry("builder", id) || {};
      return { id: id, title: REG[id].title, name: a.name || REG[id].title, domain: a.domain || "", stages: a.stages || { early: true, middle: true, late: true } };
    });
  }
  /* the staff's answers for a page, as lines of text */
  function answerLines(page) {
    var m = page.meta || {}, out = [];
    (m.answers || []).forEach(function (a) { out.push(String(a)); });
    return out;
  }

  /* The solved page, for the staff copy: the same page with the answer drawn on it in the stage's heaviest line.
     Word searches circle every word; mazes draw the way through. Other pages return null. */
  function solution(page) {
    var m = page.meta || {}, st = page.stage, S = CM.STAGES[st], out = { w: page.w, h: page.h, stage: st, kind: page.kind, frame: page.frame, meta: m, items: page.items.slice(), texts: page.texts.slice() };
    var add = function (d, w) { var it = { d: d, fill: "none", w: w, role: "rule" }, b = bbox(parse(d)); it.bounds = [r2(b[0]), r2(b[1]), r2(b[2]), r2(b[3])]; out.items.push(it); };
    if ((m.id === "search-large" || m.id === "search-guided") && m.key) {
      var k = m.key;
      k.placed.forEach(function (p) {
        var x0 = k.x + (p.c + 0.5) * k.cell, y0 = k.y + (p.r + 0.5) * k.cell, x1 = k.x + (p.c + p.dx * (p.word.length - 1) + 0.5) * k.cell, y1 = k.y + (p.r + p.dy * (p.word.length - 1) + 0.5) * k.cell;
        /* a capsule around the word: two half circles joined by the two long sides */
        var rad = k.cell * 0.46, ang = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(ang) * rad, ny = Math.cos(ang) * rad, pts = [], i, n = 14;
        for (i = 0; i <= n; i++) { var a = ang - Math.PI / 2 - Math.PI * i / n; pts.push([x1 + Math.cos(a) * rad, y1 + Math.sin(a) * rad]); }
        for (i = 0; i <= n; i++) { var b = ang + Math.PI / 2 - Math.PI * i / n; pts.push([x0 + Math.cos(b) * rad, y0 + Math.sin(b) * rad]); }
        void nx; void ny;
        add(dPoly(pts, true), S.stroke.art);
      });
      return out;
    }
    if (m.id === "maze" && m.key) {
      var mk = m.key, pts2 = [[mk.x + mk.cell / 2, mk.y - 4]];
      mk.solution.forEach(function (c) { pts2.push([mk.x + (c[0] + 0.5) * mk.cell, mk.y + (c[1] + 0.5) * mk.cell]); });
      pts2.push([mk.x + (mk.cols - 0.5) * mk.cell, mk.y + mk.rows * mk.cell + 4]);
      add(dPoly(pts2, false), S.stroke.art);
      return out;
    }
    return null;
  }

  root.CognicopiaClinicalActivities = Object.freeze({
    VERSION: VERSION, MAX_ATTEMPTS: MAX_ATTEMPTS, SHELL: SH,
    generate: generate, tryGenerate: tryGenerate, kinds: kinds, answerLines: answerLines, solution: solution,
    withShell: withShell, tipLines: tipLines, bodyFrame: bodyFrame, measure: measure, toPDF: toPDF, toSVG: toSVG,
    parse: parse, bbox: bbox, subjectName: subjectName, SILHOUETTE_OK: SILHOUETTE_OK,
    /* what another page maker needs to draw a stage-ruled page of its own (src/engine/SoothingPacketEngine.js does): the
       sheet a page is drawn on, which checks every rule, and the path-data helpers */
    kit: Object.freeze({ sheet: sheet, dLine: dLine, dPoly: dPoly, dRect: dRect, dEllipse: dEllipse, dCircle: dCircle, mapSegs: mapSegs, segsToD: segsToD, pt: pt, r2: r2 })
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
