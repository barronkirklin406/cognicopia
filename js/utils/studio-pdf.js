/* =====================================================================
   The Activity Page Studio's PDF: real text and real lines.

   A Studio page is a list of drawing steps on a 1200 x 1600 sheet
   (js/generators/coloring-pipeline.js). Until now the PDF held a picture
   of each page: heavy, and its words could not be searched, selected or
   read aloud. draw() puts the same steps into the PDF as shapes and text
   in the page's own faces, embedded in the file, so the page is sharp at
   any size, its words are words, and the file is a fraction of the size.

   A page is drawn this way only when every step can be drawn exactly:
   a path made of moves, lines and curves, a face the PDF maker holds, and
   every character in that face. Anything else (an arc in a path, a letter
   the face does not have) and that one page goes in as a picture, as
   before, and make() says how many did.

   make(pages, { gutter, title }) resolves with { doc, vector, picture }.
   The PDF maker's Atkinson pack (assets/vendor/jspdf-atkinson.js) and the
   three extra faces (assets/vendor/jspdf-studio-faces.js) are loaded from
   this site only when a PDF is made. Nothing leaves the computer.
   ===================================================================== */
(function (root) {
  "use strict";
  var PAGE_W = 612, PAGE_H = 792, MARGIN = 36, GUTTER = 54;           // US Letter in points; 0.5 in margins, 0.75 in on the binding side
  var MAIN = "AtkinsonHyperlegible";
  function PL() { return root.CognicopiaColoringPipeline; }

  /* ---------- loading the PDF maker's faces, once ---------- */
  var loading = {};
  function script(src) {
    if (!loading[src]) loading[src] = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src; s.onload = function () { res(); }; s.onerror = function () { delete loading[src]; rej(new Error("could not load " + src)); };
      document.head.appendChild(s);
    });
    return loading[src];
  }
  function fontKeys(pages) { var keys = {}; pages.forEach(function (pg) { pg.ops.forEach(function (op) { if (op.t === "text" && op.font) keys[op.font] = 1; }); }); return Object.keys(keys); }
  function kit(pages) {
    var NS = root.jspdf;
    if (!NS || !NS.jsPDF) return Promise.reject(new Error("The PDF maker could not load."));
    var first = NS.jsPDF.__atkinson ? Promise.resolve() : script("assets/vendor/jspdf-atkinson.js");
    return first.then(function () { return fontKeys(pages).length && !root.CognicopiaPdfFaces ? script("assets/vendor/jspdf-studio-faces.js").catch(function () { /* those pages go in as pictures */ }) : null; });
  }
  /* the face a step's text is set in, registered in this file the first time it is asked for; null when the maker does not hold it */
  function faceFor(doc, op) {
    if (!op.font) return { family: MAIN, style: op.bold ? "bold" : "normal" };
    var f = root.CognicopiaPdfFaces && root.CognicopiaPdfFaces[op.font]; if (!f) return null;
    doc.__cgFaces = doc.__cgFaces || {};
    if (!doc.__cgFaces[op.font]) { try { doc.addFileToVFS(f.file, f.data); doc.addFont(f.file, f.family, f.style); doc.__cgFaces[op.font] = 1; } catch (e) { return null; } }
    return { family: f.family, style: f.style };
  }
  function hasGlyphs(doc, str) {
    var meta = (doc.getFont() || {}).metadata;
    if (!meta || typeof meta.characterToGlyph !== "function") return false;
    for (var i = 0; i < str.length; i++) { var c = str.charCodeAt(i); if (c !== 32 && !meta.characterToGlyph(c)) return false; }
    return true;
  }

  /* ---------- a path's d as moves, lines and curves in absolute numbers; null when it holds anything else ---------- */
  function segments(d) {
    var tok = String(d).match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [], out = [], i = 0, cmd = "", cx = 0, cy = 0, sx = 0, sy = 0, px = 0, py = 0, last = "";
    var num = function () { return parseFloat(tok[i++]); }, more = function () { return i < tok.length && !/[a-zA-Z]/.test(tok[i]); };
    while (i < tok.length) {
      if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++]; else if (!cmd) return null;
      var rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? cx : 0, oy = rel ? cy : 0, x1, y1, x2, y2, x, y;
      if (C === "Z") { out.push(["Z"]); cx = sx; cy = sy; last = "Z"; if (more()) return null; continue; }
      if (C === "M") { cx = num() + ox; cy = num() + oy; sx = cx; sy = cy; out.push(["M", cx, cy]); cmd = rel ? "l" : "L"; last = "M"; continue; }
      if (C === "L") { cx = num() + ox; cy = num() + oy; out.push(["L", cx, cy]); last = "L"; continue; }
      if (C === "H") { cx = num() + ox; out.push(["L", cx, cy]); last = "L"; continue; }
      if (C === "V") { cy = num() + oy; out.push(["L", cx, cy]); last = "L"; continue; }
      if (C === "C") { x1 = num() + ox; y1 = num() + oy; x2 = num() + ox; y2 = num() + oy; x = num() + ox; y = num() + oy; out.push(["C", x1, y1, x2, y2, x, y]); px = x2; py = y2; cx = x; cy = y; last = "C"; continue; }
      if (C === "S") { x1 = last === "C" ? 2 * cx - px : cx; y1 = last === "C" ? 2 * cy - py : cy; x2 = num() + ox; y2 = num() + oy; x = num() + ox; y = num() + oy; out.push(["C", x1, y1, x2, y2, x, y]); px = x2; py = y2; cx = x; cy = y; last = "C"; continue; }
      if (C === "Q") { x1 = num() + ox; y1 = num() + oy; x = num() + ox; y = num() + oy; out.push(["C", cx + 2 / 3 * (x1 - cx), cy + 2 / 3 * (y1 - cy), x + 2 / 3 * (x1 - x), y + 2 / 3 * (y1 - y), x, y]); px = x1; py = y1; cx = x; cy = y; last = "Q"; continue; }
      return null;                                                       // an arc, or a smooth quadratic: not drawn here
    }
    for (var k = 0; k < out.length; k++) for (var j = 1; j < out[k].length; j++) if (!isFinite(out[k][j])) return null;
    return out.length ? out : null;
  }

  /* ---------- can this page be drawn exactly? ---------- */
  function drawable(doc, pg) {
    var images = (PL() && PL().imageOf) || null;
    for (var i = 0; i < pg.ops.length; i++) {
      var op = pg.ops[i];
      if (op.t === "path") { if (!segments(op.d)) return false; if (["#000", "#fff"].indexOf(op.stroke) < 0) return false; }
      else if (op.t === "text") { var f = faceFor(doc, op); if (!f) return false; doc.setFont(f.family, f.style); if (!hasGlyphs(doc, String(op.str))) return false; }
      else if (op.t === "image") { if (!images || !images(op.src)) return false; }
      else if (["rect", "circle", "line"].indexOf(op.t) < 0) return false;
    }
    return true;
  }

  /* ---------- one page into the file, inside box { x, y, w } in points ---------- */
  function draw(doc, pg, box) {
    var P = PL(); if (!P || !pg || !pg.ops) return false;
    if (!drawable(doc, pg)) return false;
    var s = box.w / P.W, X = function (v) { return box.x + v * s; }, Y = function (v) { return box.y + v * s; };
    var paint = function (fill) { return fill === "#fff" || fill === "#000" ? "FD" : "S"; };
    doc.setLineJoin("round"); doc.setLineCap("round"); doc.setTextColor(0, 0, 0);
    pg.ops.forEach(function (op) {
      doc.setDrawColor(0, 0, 0); doc.setFillColor(0, 0, 0); doc.setLineWidth((op.sw || 1) * s);
      doc.setLineDashPattern(op.dash ? String(op.dash).split(" ").map(function (n) { return Number(n) * s; }) : [], 0);
      if (op.fill === "#fff") doc.setFillColor(255, 255, 255);
      if (op.t === "rect") { var r = Math.min(op.r || 0, op.w / 2, op.h / 2) * s; if (r > 0) doc.roundedRect(X(op.x), Y(op.y), op.w * s, op.h * s, r, r, paint(op.fill)); else doc.rect(X(op.x), Y(op.y), op.w * s, op.h * s, paint(op.fill)); }
      else if (op.t === "circle") doc.circle(X(op.cx), Y(op.cy), op.r * s, paint(op.fill));
      else if (op.t === "line") doc.line(X(op.x1), Y(op.y1), X(op.x2), Y(op.y2));
      else if (op.t === "path") {
        var k = op.k || 1, PX = function (v) { return X(v * k + (op.tx || 0)); }, PY = function (v) { return Y(v * k + (op.ty || 0)); };
        doc.setLineWidth(op.sw * k * s); if (op.stroke === "#fff") doc.setDrawColor(255, 255, 255);
        segments(op.d).forEach(function (g) {
          if (g[0] === "M") doc.moveTo(PX(g[1]), PY(g[2])); else if (g[0] === "L") doc.lineTo(PX(g[1]), PY(g[2]));
          else if (g[0] === "C") doc.curveTo(PX(g[1]), PY(g[2]), PX(g[3]), PY(g[4]), PX(g[5]), PY(g[6])); else doc.close();
        });
        if (op.fill === "#fff" || op.fill === "#000") doc.fillStroke(); else doc.stroke();
      } else if (op.t === "image") {
        /* a photograph fills its frame, cropped evenly: the frame clips it */
        var im = P.imageOf(op.src), kk = Math.max(op.w / im.naturalWidth, op.h / im.naturalHeight), iw = im.naturalWidth * kk, ih = im.naturalHeight * kk;
        doc.saveGraphicsState(); doc.rect(X(op.x), Y(op.y), op.w * s, op.h * s, null); doc.clip(); doc.discardPath();
        doc.addImage(op.src, /^data:image\/png/.test(op.src) ? "PNG" : "JPEG", X(op.x - (iw - op.w) / 2), Y(op.y - (ih - op.h) / 2), iw * s, ih * s, undefined, "FAST");
        doc.restoreGraphicsState();
      } else if (op.t === "text") {
        var f = faceFor(doc, op); doc.setFont(f.family, f.style); doc.setFontSize(op.size * s);
        doc.text(String(op.str), X(op.x), Y(op.y), { align: op.anchor === "middle" ? "center" : op.anchor === "end" ? "right" : "left", baseline: "alphabetic" });
      }
    });
    doc.setLineDashPattern([], 0);
    return true;
  }
  /* the same page as a picture (2250 x 3000, 300 dpi across 7.5 in), for a page that cannot be drawn exactly */
  function picture(doc, pg, box) {
    var cv = document.createElement("canvas"); PL().toCanvas(pg, cv, 1.875);
    doc.addImage(cv.toDataURL("image/png"), "PNG", box.x, box.y, box.w, box.w * 4 / 3, undefined, "FAST");
  }
  /* where a page sits on the sheet: inside 0.5 in margins, or with a 0.75 in gutter that alternates sides for two-sided printing */
  function boxFor(i, gutter) { return gutter ? { x: i % 2 === 0 ? GUTTER : MARGIN, y: MARGIN, w: PAGE_W - MARGIN - GUTTER } : { x: MARGIN, y: MARGIN, w: PAGE_W - 2 * MARGIN }; }

  function make(pages, o) {
    o = o || {};
    return kit(pages).then(function () {
      var doc = new root.jspdf.jsPDF({ unit: "pt", format: "letter", orientation: "portrait", compress: true }), vector = 0, pictures = 0;
      pages.forEach(function (pg, i) {
        if (i) doc.addPage();
        var box = boxFor(i, o.gutter), done = false;
        try { done = o.pictures ? false : draw(doc, pg, box); } catch (e) { done = false; }
        if (done) vector++; else { picture(doc, pg, box); pictures++; }
      });
      doc.setProperties({ title: o.title || "Cognicopia activity pages", creator: "Cognicopia" });
      return { doc: doc, vector: vector, picture: pictures };
    });
  }

  root.CognicopiaStudioPdf = Object.freeze({ make: make, draw: draw, picture: picture, segments: segments, boxFor: boxFor, kit: kit, PAGE: { w: PAGE_W, h: PAGE_H, margin: MARGIN, gutter: GUTTER } });
})(typeof globalThis !== "undefined" ? globalThis : this);
