/* =====================================================================
   Cognicopia Soothing Art: the calming pictures and the tracing paths.

   Two libraries of drawings, made in code, for the Instant Soothe packets
   (src/engine/SoothingPacketEngine.js):

     MOTIFS  line-art pictures for looking at, tracing with a finger or
             coloring: botanicals, things from a grandparent's kitchen and
             parlor, music and handwork, and calm geometry. Every motif
             is drawn from a seed, so the same motif is never quite the
             same twice (the number of leaves, the lean of a stem, the
             pattern of a quilt block).
     PATHS   rhythmic lanes to trace, slowly: waves, spirals, a garden
             path, a ring. A path is a center line; laneOutline() turns it
             into a wide lane with rounded ends that a finger or a thick
             marker can follow.

   A motif's drawing is a list of [pathData, fill, isDetail] in a 100 by
   100 box (the format the coloring library uses, so the sheet's own
   picture() fits and scales it). Three levels of detail:
     detailed  the mild / early stage: leaf veins, petals and patterns
     simple    the moderate / mid stage: the shape and a few details
     bold      the acute / late stage: the fewest, largest shapes
   Everything is an outline or a solid black shape: nothing is grey.

   Runs in the browser (window.CognicopiaSoothingArt) and in Node (vm). It
   makes no request, reads no clock, uses no storage and never calls the
   browser's own random function: every choice comes from the stream it is
   given (src/pcg/prng.js).
   ===================================================================== */
(function (root) {
  "use strict";
  var VERSION = "1.0.0";
  var TAU = Math.PI * 2, KAPPA = 0.5522847498;

  /* ---------- path-data helpers (absolute M, L, C and Z, like the page models) ---------- */
  var r2 = function (v) { var r = Math.round(v * 100) / 100; return r === 0 ? 0 : r; };
  var P = function (x, y) { return r2(x) + " " + r2(y); };
  var Mv = function (x, y) { return "M" + P(x, y); };
  var Lv = function (x, y) { return "L" + P(x, y); };
  var Cv = function (a, b, c, d, e, f) { return "C" + P(a, b) + " " + P(c, d) + " " + P(e, f); };
  var rot = function (x, y, cx, cy, a) { var c = Math.cos(a), s = Math.sin(a); return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]; };

  function poly(points, close) {
    return points.map(function (p, i) { return (i ? "L" : "M") + P(p[0], p[1]); }).join("") + (close ? "Z" : "");
  }
  /* a smooth curve through the points (Catmull-Rom, as cubic Beziers) */
  function smooth(pts, close, tension) {
    var t = tension == null ? 0.5 : tension, n = pts.length, d = "", i;
    if (n < 3) return poly(pts, close);
    var at = function (k) { return close ? pts[((k % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, k))]; };
    d += Mv(pts[0][0], pts[0][1]);
    var last = close ? n : n - 1;
    for (i = 0; i < last; i++) {
      var p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      d += Cv(p1[0] + (p2[0] - p0[0]) * t / 3, p1[1] + (p2[1] - p0[1]) * t / 3, p2[0] - (p3[0] - p1[0]) * t / 3, p2[1] - (p3[1] - p1[1]) * t / 3, p2[0], p2[1]);
    }
    return d + (close ? "Z" : "");
  }
  /* an ellipse, turned by `a` radians about its center */
  function ell(cx, cy, rx, ry, a) {
    a = a || 0;
    var q = function (x, y) { return rot(cx + x, cy + y, cx, cy, a); }, k = KAPPA;
    var p = [q(rx, 0), q(rx, k * ry), q(k * rx, ry), q(0, ry), q(-k * rx, ry), q(-rx, k * ry), q(-rx, 0), q(-rx, -k * ry), q(-k * rx, -ry), q(0, -ry), q(k * rx, -ry), q(rx, -k * ry)];
    return Mv(p[0][0], p[0][1]) + Cv(p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1]) + Cv(p[4][0], p[4][1], p[5][0], p[5][1], p[6][0], p[6][1]) +
      Cv(p[7][0], p[7][1], p[8][0], p[8][1], p[9][0], p[9][1]) + Cv(p[10][0], p[10][1], p[11][0], p[11][1], p[0][0], p[0][1]) + "Z";
  }
  var circ = function (cx, cy, r) { return ell(cx, cy, r, r, 0); };
  function rect(x, y, w, h, rad) {
    rad = Math.max(0, Math.min(rad || 0, w / 2, h / 2));
    if (!rad) return poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
    var k = KAPPA * rad;
    return Mv(x + rad, y) + Lv(x + w - rad, y) + Cv(x + w - rad + k, y, x + w, y + rad - k, x + w, y + rad) + Lv(x + w, y + h - rad) +
      Cv(x + w, y + h - rad + k, x + w - rad + k, y + h, x + w - rad, y + h) + Lv(x + rad, y + h) + Cv(x + rad - k, y + h, x, y + h - rad + k, x, y + h - rad) +
      Lv(x, y + rad) + Cv(x, y + rad - k, x + rad - k, y, x + rad, y) + "Z";
  }
  /* a leaf or a petal from its base to its tip, w being half its width */
  function leaf(bx, by, tx, ty, w) {
    var dx = tx - bx, dy = ty - by, len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len, ny = dx / len;
    var at = function (f, s) { return [bx + dx * f + nx * s, by + dy * f + ny * s]; };
    var a = at(0.25, w * 1.25), b = at(0.78, w * 0.95), c = at(0.78, -w * 0.95), d = at(0.25, -w * 1.25);
    return Mv(bx, by) + Cv(a[0], a[1], b[0], b[1], tx, ty) + Cv(c[0], c[1], d[0], d[1], bx, by) + "Z";
  }
  /* a point on a quadratic curve, and the way it points */
  function quad(p0, p1, p2, t) {
    var u = 1 - t, x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
    var tx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]), ty = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]), l = Math.sqrt(tx * tx + ty * ty) || 1;
    return { x: x, y: y, tx: tx / l, ty: ty / l };
  }
  function quadD(p0, p1, p2) {
    return Mv(p0[0], p0[1]) + Cv(p0[0] + 2 / 3 * (p1[0] - p0[0]), p0[1] + 2 / 3 * (p1[1] - p0[1]), p2[0] + 2 / 3 * (p1[0] - p2[0]), p2[1] + 2 / 3 * (p1[1] - p2[1]), p2[0], p2[1]);
  }
  var rf = function (R, a, b) { return a + R.next() * (b - a); };
  var sgn = function (R) { return R.next() < 0.5 ? -1 : 1; };
  var LV = { bold: 0, simple: 1, detailed: 2 };
  var by = function (lv, bold, simple, detailed) { var k = LV[lv]; return k === 0 ? bold : k === 1 ? simple : detailed; };

  /* =====================================================================
     MOTIFS
     draw(R, lv) -> [[pathData, fill, isDetail], ...] in a 100 x 100 box
     ===================================================================== */
  var W = "#fff", K = "#000";

  function fern(R, lv) {
    var s = sgn(R), p0 = [50, 96], p1 = [50 + s * rf(R, 8, 16), 56], p2 = [50 + s * rf(R, 2, 8), 6], out = [];
    var n = by(lv, 4, 6, 9), i, t, q, side, len, ang, tip;
    out.push([quadD(p0, p1, p2), "none", 0]);
    for (i = 0; i < n; i++) {
      t = 0.2 + 0.7 * i / (n - 1 || 1);
      q = quad(p0, p1, p2, t);
      len = by(lv, 30, 27, 25) * Math.pow(1 - t * 0.78, 0.9) + 4;
      for (side = -1; side <= 1; side += 2) {
        ang = Math.atan2(q.ty, q.tx) + side * (Math.PI * 0.36);
        tip = [q.x + Math.cos(ang) * len, q.y + Math.sin(ang) * len];
        out.push([leaf(q.x, q.y, tip[0], tip[1], len * by(lv, 0.3, 0.26, 0.22)), W, 0]);
        if (lv === "detailed") out.push([Mv(q.x, q.y) + Lv(q.x + (tip[0] - q.x) * 0.82, q.y + (tip[1] - q.y) * 0.82), "none", 1]);
      }
    }
    out.push([leaf(p2[0] - s * 1, p2[1] + 10, p2[0], p2[1] - 4, by(lv, 5.5, 5, 4.2)), W, 0]);
    return out;
  }

  function daisy(R, lv) {
    var cx = 50, cy = 36, n = by(lv, 8, 10, 14), out = [], i, a, r0 = by(lv, 12, 10, 9), r1 = by(lv, 34, 33, 32);
    var s = sgn(R);
    out.push([quadD([cx, cy + 20], [cx + s * 6, 70], [50, 97]), "none", 0]);
    out.push([leaf(50, 84, 50 - 30, 66 + rf(R, -3, 3), by(lv, 7, 6, 5)), W, 0]);
    if (lv !== "bold") out.push([leaf(50, 80, 50 + 28, 62 + rf(R, -3, 3), by(lv, 7, 6, 5)), W, 0]);
    for (i = 0; i < n; i++) {
      a = TAU * i / n + rf(R, -0.04, 0.04);
      out.push([leaf(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, by(lv, 8.5, 7, 5.6)), W, 0]);
    }
    out.push([circ(cx, cy, r0 + 1.5), W, 0]);
    if (lv === "detailed") { out.push([circ(cx, cy, 4), "none", 1]); }
    return out;
  }

  function tulip(R, lv) {
    var out = [], l = rf(R, 0, 6), s = sgn(R);
    out.push([Mv(50, 52) + Cv(50, 70, 50 + s * 2, 84, 50, 97), "none", 0]);
    out.push([Mv(50, 96) + Cv(26, 92 - l, 14, 70, 20, 50 - l) + Cv(34, 60, 46, 76, 50, 96) + "Z", W, 0]);
    if (lv !== "bold") out.push([Mv(50, 96) + Cv(74, 90 - l, 86, 74, 82, 56 + l) + Cv(66, 64, 54, 78, 50, 96) + "Z", W, 0]);
    out.push([Mv(50, 54) + Cv(28, 52, 22, 32, 30, 16) + Cv(40, 22, 48, 34, 50, 54) + "Z", W, 0]);
    out.push([Mv(50, 54) + Cv(72, 52, 78, 32, 70, 16) + Cv(60, 22, 52, 34, 50, 54) + "Z", W, 0]);
    out.push([Mv(50, 54) + Cv(35, 46, 35, 24, 50, 6) + Cv(65, 24, 65, 46, 50, 54) + "Z", W, 0]);
    if (lv === "detailed") out.push([Mv(50, 46) + Lv(50, 20), "none", 1]);
    return out;
  }

  function sunflower(R, lv) {
    var cx = 50, cy = 40, n = by(lv, 10, 12, 16), out = [], i, a, rd = by(lv, 17, 16, 15), s = sgn(R);
    out.push([quadD([cx, cy + rd], [cx + s * 5, 78], [50, 98]), "none", 0]);
    out.push([leaf(50, 86, 22, 72 + rf(R, -3, 3), by(lv, 7, 6, 5)), W, 0]);
    if (lv !== "bold") out.push([leaf(50, 80, 80, 66 + rf(R, -3, 3), by(lv, 7, 6, 5)), W, 0]);
    for (i = 0; i < n; i++) {
      a = TAU * i / n;
      out.push([leaf(cx + Math.cos(a) * rd * 0.9, cy + Math.sin(a) * rd * 0.9, cx + Math.cos(a) * 39, cy + Math.sin(a) * 39, by(lv, 9, 7.5, 6)), W, 0]);
    }
    out.push([circ(cx, cy, rd), W, 0]);
    if (lv === "detailed") { out.push([circ(cx, cy, rd * 0.62), "none", 1]); out.push([circ(cx, cy, rd * 0.26), "none", 1]); }
    else if (lv === "simple") out.push([circ(cx, cy, rd * 0.5), "none", 1]);
    return out;
  }

  function oakleaf(R, lv) {
    var lobes = by(lv, 3, 4, 5), n = 90, left = [], right = [], i, t, w, lo = rf(R, 0, Math.PI * 2);
    for (i = 0; i <= n; i++) {
      t = i / n;
      w = 30 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.75) * (0.7 + 0.3 * Math.cos(TAU * lobes * t + lo * 0));
      left.push([50 - w, 88 - t * 78]); right.push([50 + w, 88 - t * 78]);
    }
    var pts = left.concat(right.reverse());
    var out = [[smooth(pts, true, 0.6), W, 0], [Mv(50, 88) + Lv(50, 99), "none", 0]];
    out.push([Mv(50, 88) + Lv(50, 16), "none", 0]);
    if (lv === "detailed") for (i = 1; i <= 4; i++) {
      t = i / 5; out.push([Mv(50, 88 - t * 70) + Lv(50 - 17 * (1 - t * 0.5), 88 - t * 70 - 9), "none", 1]); out.push([Mv(50, 88 - t * 70) + Lv(50 + 17 * (1 - t * 0.5), 88 - t * 70 - 9), "none", 1]);
    }
    return out;
  }

  function mapleleaf(R, lv) {
    var out = [], cx = 50, cy = 58, i, side, lobes = lv === "bold" ? [[0, 44, 12.5], [62, 40, 11.5], [-62, 40, 11.5], [125, 30, 9.5], [-125, 30, 9.5]] : [[0, 42, 9.5], [64, 38, 8.5], [-64, 38, 8.5], [128, 28, 7], [-128, 28, 7]];
    out.push([Mv(cx, cy) + Cv(cx, cy + 14, cx + rf(R, -2, 2), cy + 28, cx, 99), "none", 0]);
    lobes.forEach(function (lb) {
      var a = lb[0] * Math.PI / 180, len = lb[1] + rf(R, -2, 2), tx = cx + Math.sin(a) * len, ty = cy - Math.cos(a) * len;
      out.push([leaf(cx, cy, tx, ty, lb[2] * by(lv, 1, 1, 0.95)), W, 0]);
      if (lv !== "bold") for (side = -1; side <= 1; side += 2) {
        var ba = a + side * 0.9, f = 0.5, bx = cx + (tx - cx) * f, by_ = cy + (ty - cy) * f, tl = len * 0.36;
        out.push([leaf(bx, by_, bx + Math.sin(ba) * tl, by_ - Math.cos(ba) * tl, tl * 0.2), W, 0]);
      }
      if (lv === "detailed") out.push([Mv(cx, cy) + Lv(cx + (tx - cx) * 0.8, cy + (ty - cy) * 0.8), "none", 1]);
    });
    void i;
    return out;
  }

  function lilac(R, lv) {
    var rows = by(lv, 3, 4, 6), rr = by(lv, 7.5, 6.5, 5.2), out = [], i, j, x, y, s = sgn(R);
    out.push([Mv(50, 10 + rows * rr * 1.7) + Cv(50 + s * 3, 60, 50, 80, 50, 98), "none", 0]);
    out.push([leaf(50, 88, 22, 74 + rf(R, -3, 3), by(lv, 7, 6, 5)), W, 0]);
    out.push([leaf(50, 84, 78, 70 + rf(R, -3, 3), by(lv, 7, 6, 5)), W, 0]);
    for (i = 0; i < rows; i++) {
      var cnt = i + 1;
      for (j = 0; j < cnt; j++) {
        x = 50 + (j - (cnt - 1) / 2) * rr * 2.1 + rf(R, -0.8, 0.8); y = 14 + i * rr * 1.75 + rf(R, -0.8, 0.8);
        out.push([circ(x, y, rr), W, 0]);
        if (lv === "detailed") out.push([circ(x, y, rr * 0.38), "none", 1]);
      }
    }
    return out;
  }

  function wheat(R, lv) {
    var stalks = lv === "detailed" ? 2 : 1, out = [], k, i, side, s = sgn(R);
    for (k = 0; k < stalks; k++) {
      var off = stalks === 1 ? 0 : (k ? 18 : -18), bx = 50 + off * 0.6, topx = 50 + off + s * (k ? 4 : -4), top = k ? 14 : 24;
      var p0 = [bx, 98], p1 = [bx + (topx - bx) * 0.2, 60], p2 = [topx, top], n = by(lv, 4, 5, 6);
      out.push([quadD(p0, p1, p2), "none", 0]);
      for (i = 0; i < n; i++) {
        var q = quad(p0, p1, p2, 1 - 0.07 - i * (0.36 / n));
        for (side = -1; side <= 1; side += 2) {
          var a = Math.atan2(q.ty, q.tx) + side * 0.5, len = by(lv, 17, 15, 13);
          var tip = [q.x + Math.cos(a) * len, q.y + Math.sin(a) * len];
          out.push([leaf(q.x, q.y, tip[0], tip[1], by(lv, 4.6, 4, 3.4)), W, 0]);
          if (lv === "detailed") out.push([Mv(tip[0], tip[1]) + Lv(tip[0] + Math.cos(a) * 9, tip[1] + Math.sin(a) * 9), "none", 1]);
        }
      }
      var tq = quad(p0, p1, p2, 1);
      out.push([leaf(tq.x, tq.y + 4, tq.x, tq.y - 14, by(lv, 4.4, 3.8, 3.2)), W, 0]);
      if (k === 0) out.push([leaf(bx, 92, bx - 28 - (stalks === 1 ? 6 : 0), 62, by(lv, 6, 5, 4.4)), W, 0]);
    }
    return out;
  }

  function rosebloom(R, lv) {
    var cx = 50, cy = 50, rings = by(lv, 2, 3, 4), out = [], k, i, n, a, d, rr, f;
    var base = rf(R, 0, TAU), rOut = 17;
    for (k = rings; k >= 1; k--) {
      f = k / rings; n = 4 + k * 2; rr = 6 + (rOut - 6) * f; d = (46 - rOut) * f;
      for (i = 0; i < n; i++) {
        a = base + TAU * i / n + k * 0.45;
        out.push([ell(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, rr * 0.9, a + Math.PI / 2), W, 0]);
      }
    }
    out.push([circ(cx, cy, by(lv, 8, 7, 6)), W, 0]);
    if (lv !== "bold") out.push([smooth([[cx - 3, cy - 1], [cx, cy - 4], [cx + 3, cy], [cx, cy + 2.5], [cx - 1.5, cy - 0.5]], false), "none", 1]);
    return out;
  }

  function vine(R, lv) {
    var out = [], n = by(lv, 3, 5, 7), pts = [], i, amp = rf(R, 11, 15), ph = rf(R, 0, 1);
    for (i = 0; i <= 40; i++) { var u = i / 40; pts.push([6 + u * 88, 52 + amp * Math.sin(TAU * (u * 1.25 + ph))]); }
    out.push([smooth(pts, false), "none", 0]);
    for (i = 0; i < n; i++) {
      var u2 = 0.1 + 0.8 * i / (n - 1 || 1), px = 6 + u2 * 88, py = 52 + amp * Math.sin(TAU * (u2 * 1.25 + ph)), up = i % 2 === 0 ? -1 : 1;
      var len = by(lv, 30, 26, 22);
      out.push([leaf(px, py, px + 7, py + up * len, by(lv, 9, 7.5, 6.2)), W, 0]);
      if (lv === "detailed") out.push([Mv(px, py) + Lv(px + 6, py + up * len * 0.8), "none", 1]);
    }
    if (lv === "detailed") out.push([smooth([[94, pts[40][1]], [98, pts[40][1] - 6], [94, pts[40][1] - 10], [91, pts[40][1] - 6], [93, pts[40][1] - 4]], false), "none", 1]);
    return out;
  }

  function apple(R, lv) {
    var out = [], tilt = rf(R, -0.12, 0.12);
    var body = Mv(50, 30) + Cv(62, 20, 88, 28, 86, 56) + Cv(85, 82, 62, 94, 50, 90) + Cv(38, 94, 15, 82, 14, 56) + Cv(12, 28, 38, 20, 50, 30) + "Z";
    out.push([body, W, 0]);
    out.push([Mv(50, 30) + Cv(50, 22, 52, 14, 58 + tilt * 30, 8), "none", 0]);
    out.push([leaf(54, 20, 82, 8 + tilt * 20, by(lv, 7.5, 6.5, 5.5)), W, 0]);
    if (lv !== "bold") out.push([Mv(27, 52) + Cv(27, 44, 31, 38, 38, 34), "none", 1]);
    if (lv === "detailed") out.push([Mv(54, 78) + Cv(64, 76, 72, 70, 76, 62), "none", 1]);
    return out;
  }

  function songbird(R, lv) {
    var out = [], lean = rf(R, -0.08, 0.08);
    out.push([smooth([[2, 84], [30, 79], [62, 87], [98, 80]], false), "none", 0]);
    out.push([leaf(80, 83, 90, 70, by(lv, 7, 6, 5)), W, 0]);
    out.push([Mv(46, 72) + Lv(46, 84), "none", 0]); out.push([Mv(58, 72) + Lv(58, 83), "none", 0]);
    out.push([leaf(32, 60, 4, 76 + lean * 40, by(lv, 7.5, 6.5, 5.5)), W, 0]);
    out.push([ell(50, 56, 25, 17, -0.25), W, 0]);
    out.push([circ(72, 40, 11.5), W, 0]);
    out.push([poly([[82, 36], [95, 42], [82, 46]], true), W, 0]);
    out.push([circ(74.5, 37.5, 2.3), K, 0]);
    if (lv !== "bold") out.push([leaf(48, 52, 30, 62, by(lv, 6, 5.5, 5)), "none", 1]);
    if (lv === "detailed") out.push([smooth([[36, 56], [44, 60], [54, 61]], false), "none", 1]);
    return out;
  }

  function teacup(R, lv) {
    var out = [], steam = by(lv, 1, 2, 3), i;
    out.push([ell(50, 80, 41, 9, 0), W, 0]);
    out.push([Mv(23, 44) + Cv(23, 66, 34, 80, 50, 80) + Cv(66, 80, 77, 66, 77, 44) + "Z", W, 0]);
    out.push([ell(50, 44, 27, 7, 0), W, 0]);
    out.push([Mv(77, 50) + Cv(98, 46, 98, 72, 72, 70), "none", 0]);
    if (lv !== "bold") out.push([Mv(76, 56) + Cv(90, 54, 90, 66, 72, 64), "none", 1]);
    for (i = 0; i < steam; i++) {
      var x = steam === 1 ? 50 : 38 + i * (24 / (steam - 1)), sw = rf(R, 4, 6);
      out.push([Mv(x, 32) + Cv(x - sw, 26, x + sw, 20, x, 12), "none", 0]);
    }
    if (lv === "detailed") out.push([Mv(34, 60) + Cv(40, 70, 60, 70, 66, 60), "none", 1]);
    return out;
  }

  function kettle(R, lv) {
    var out = [];
    out.push([Mv(28, 56) + Cv(28, 18, 72, 18, 72, 56), "none", 0]);
    out.push([Mv(78, 66) + Cv(90, 60, 96, 46, 93, 34) + Lv(86, 36) + Cv(88, 46, 83, 54, 74, 58) + "Z", W, 0]);
    out.push([Mv(22, 84) + Cv(18, 62, 30, 42, 50, 40) + Cv(70, 42, 82, 62, 78, 84) + "Z", W, 0]);
    out.push([ell(50, 40, 17, 5, 0), W, 0]);
    out.push([circ(50, 30, 5.5), W, 0]);
    out.push([Mv(18, 84) + Lv(82, 84), "none", 0]);
    if (lv !== "bold") out.push([Mv(24, 70) + Cv(34, 76, 66, 76, 76, 70), "none", 1]);
    if (lv === "detailed") out.push([Mv(27, 56) + Cv(36, 62, 64, 62, 73, 56), "none", 1]);
    return out;
  }

  function radio(R, lv) {
    var out = [], hasDial = lv !== "bold";
    out.push([Mv(32, 30) + Cv(40, 8, 60, 8, 68, 30), "none", 0]);
    out.push([rect(8, 30, 84, 58, 11), W, 0]);
    out.push([circ(32, 59, 20), "none", 0]);
    if (lv !== "bold") out.push([circ(32, 59, 12), "none", 1]);
    if (lv === "detailed") out.push([circ(32, 59, 5), "none", 1]);
    if (hasDial) {
      out.push([rect(56, 42, 30, 14, 3), "none", 0]);
      out.push([Mv(66, 44) + Lv(66, 54), "none", 1]);
      if (lv === "detailed") { out.push([Mv(74, 46) + Lv(74, 54), "none", 1]); out.push([Mv(80, 46) + Lv(80, 54), "none", 1]); }
    }
    out.push([circ(62, 76, 4.5), W, 0]); out.push([circ(79, 76, 4.5), W, 0]);
    out.push([Mv(24, 88) + Lv(24, 94), "none", 0]); out.push([Mv(76, 88) + Lv(76, 94), "none", 0]);
    return out;
  }

  function pocketwatch(R, lv) {
    var out = [], cx = 50, cy = 60, i, a, tick = lv === "detailed" ? 12 : 4, h = rf(R, -0.5, 0.5);
    out.push([circ(50, 10, 6), "none", 0]);
    out.push([rect(44, 14, 12, 8, 2), W, 0]);
    out.push([circ(cx, cy, 34), W, 0]);
    if (lv !== "bold") out.push([circ(cx, cy, 29), "none", 1]);
    for (i = 0; i < tick; i++) {
      a = TAU * i / tick - Math.PI / 2;
      out.push([Mv(cx + Math.cos(a) * 21, cy + Math.sin(a) * 21) + Lv(cx + Math.cos(a) * (lv === "detailed" ? 26 : 25), cy + Math.sin(a) * (lv === "detailed" ? 26 : 25)), "none", 0]);
    }
    out.push([Mv(cx, cy) + Lv(cx + Math.cos(-Math.PI / 2 + h) * 22, cy + Math.sin(-Math.PI / 2 + h) * 22), "none", 0]);
    out.push([Mv(cx, cy) + Lv(cx + Math.cos(0.3 + h) * 15, cy + Math.sin(0.3 + h) * 15), "none", 0]);
    out.push([circ(cx, cy, 3.2), K, 0]);
    return out;
  }

  function lantern(R, lv) {
    var out = [];
    out.push([Mv(36, 16) + Cv(36, -2, 64, -2, 64, 16), "none", 0]);
    out.push([rect(40, 14, 20, 7, 2), W, 0]);
    out.push([Mv(34, 82) + Cv(22, 70, 25, 52, 40, 46) + Lv(42, 21) + Lv(58, 21) + Lv(60, 46) + Cv(75, 52, 78, 70, 66, 82) + "Z", W, 0]);
    out.push([rect(28, 82, 44, 10, 3), W, 0]);
    out.push([leaf(50, 76, 50, 52, by(lv, 8, 7, 6)), W, 0]);
    if (lv !== "bold") out.push([Mv(32, 66) + Cv(32, 60, 35, 56, 39, 54), "none", 1]);
    if (lv === "detailed") out.push([Mv(46, 40) + Lv(46, 24), "none", 1]);
    return out;
  }

  function mantelclock(R, lv) {
    var out = [], cx = 50, cy = 50, i, a, tick = lv === "detailed" ? 12 : 4, h = rf(R, -0.4, 0.4);
    out.push([circ(50, 13, 4.2), W, 0]);
    out.push([Mv(18, 90) + Lv(18, 42) + Cv(18, 16, 82, 16, 82, 42) + Lv(82, 90) + "Z", W, 0]);
    out.push([rect(12, 90, 76, 7, 2), W, 0]);
    out.push([circ(cx, cy, 24), W, 0]);
    if (lv !== "bold") out.push([circ(cx, cy, 20), "none", 1]);
    for (i = 0; i < tick; i++) { a = TAU * i / tick - Math.PI / 2; out.push([Mv(cx + Math.cos(a) * 14.5, cy + Math.sin(a) * 14.5) + Lv(cx + Math.cos(a) * 19, cy + Math.sin(a) * 19), "none", 0]); }
    out.push([Mv(cx, cy) + Lv(cx + Math.cos(-Math.PI / 2 + h) * 15, cy + Math.sin(-Math.PI / 2 + h) * 15), "none", 0]);
    out.push([Mv(cx, cy) + Lv(cx + Math.cos(0.6 + h) * 10, cy + Math.sin(0.6 + h) * 10), "none", 0]);
    out.push([circ(cx, cy, 2.6), K, 0]);
    if (lv === "detailed") { out.push([rect(40, 78, 20, 8, 2), "none", 1]); }
    return out;
  }

  function pitcher(R, lv) {
    var out = [];
    out.push([Mv(74, 38) + Cv(97, 36, 97, 70, 72, 68), "none", 0]);
    out.push([Mv(30, 18) + Cv(38, 24, 62, 24, 70, 18) + Cv(76, 34, 76, 52, 72, 62) + Cv(82, 72, 80, 88, 66, 90) + Lv(34, 90) + Cv(20, 88, 18, 72, 28, 62) + Cv(24, 52, 24, 34, 30, 18) + "Z", W, 0]);
    out.push([Mv(30, 18) + Cv(22, 16, 22, 10, 28, 9), "none", 0]);
    if (lv !== "bold") out.push([Mv(25, 60) + Cv(40, 66, 60, 66, 75, 60), "none", 1]);
    if (lv === "detailed") { out.push([Mv(26, 38) + Cv(40, 44, 60, 44, 74, 38), "none", 1]); out.push([Mv(22, 78) + Cv(40, 84, 60, 84, 78, 78), "none", 1]); }
    return out;
  }

  function antiquekey(R, lv) {
    var out = [], tooth = by(lv, 2, 3, 4), i;
    out.push([rect(46, 44, 46, 11, 3), W, 0]);
    out.push([circ(28, 50, 19), W, 0]);
    out.push([circ(28, 50, 9.5), W, 0]);
    if (lv === "detailed") { out.push([circ(28, 50, 3), K, 1]); out.push([circ(28, 50, 14.5), "none", 1]); }
    for (i = 0; i < tooth; i++) out.push([rect(88 - i * 9, 55, 6, 10 + (i % 2) * 7, 1.5), W, 0]);
    return out;
  }

  function spool(R, lv) {
    var out = [], i, n = by(lv, 3, 5, 8);
    out.push([rect(30, 32, 40, 46, 0), W, 0]);
    for (i = 0; i < n; i++) { var y = 34 + (i + 0.5) * (42 / n); out.push([Mv(30, y) + Cv(40, y + 3, 60, y + 3, 70, y), "none", lv === "detailed" ? 1 : 0]); }
    out.push([rect(22, 20, 56, 12, 3), W, 0]);
    out.push([rect(22, 78, 56, 12, 3), W, 0]);
    out.push([Mv(70, 60) + Cv(92, 58, 86, 88, 97, 80), "none", 0]);
    return out;
  }

  function cottage(R, lv) {
    var out = [], chim = rf(R, 0, 1) < 0.5 ? 26 : 64;
    out.push([Mv(6, 90) + Lv(94, 90), "none", 0]);
    out.push([rect(chim, 24, 10, 20, 0), W, 0]);
    out.push([rect(22, 48, 56, 42, 0), W, 0]);
    out.push([poly([[14, 50], [50, 16], [86, 50]], true), W, 0]);
    out.push([rect(44, 62, 14, 28, 6), W, 0]);
    if (lv !== "bold") { out.push([rect(28, 58, 12, 12, 0), W, 0]); out.push([rect(62, 58, 12, 12, 0), W, 0]); }
    if (lv === "detailed") { out.push([Mv(34, 58) + Lv(34, 70), "none", 1]); out.push([Mv(28, 64) + Lv(40, 64), "none", 1]); out.push([Mv(68, 58) + Lv(68, 70), "none", 1]); out.push([Mv(62, 64) + Lv(74, 64), "none", 1]); out.push([circ(55, 77, 1.5), K, 1]); }
    return out;
  }

  function pianokeys(R, lv) {
    var out = [], i, x0 = 8, kw = 12;
    out.push([rect(4, 22, 92, 70, 5), W, 0]);
    for (i = 0; i < 7; i++) out.push([rect(x0 + i * kw, 28, kw, 58, 0), W, 0]);
    [0, 1, 3, 4, 5].forEach(function (k) { out.push([rect(x0 + (k + 1) * kw - 4, 28, 8, 34, 0), K, 0]); });
    return out;
  }

  function notes(R, lv) {
    var out = [], tilt = rf(R, -0.06, 0.06);
    out.push([ell(28, 76, 11, 8, -0.35), K, 0]); out.push([ell(66, 66, 11, 8, -0.35), K, 0]);
    out.push([Mv(37, 74) + Lv(37, 24 + tilt * 20), "none", 0]); out.push([Mv(75, 64) + Lv(75, 14 + tilt * 20), "none", 0]);
    out.push([poly([[36, 22 + tilt * 20], [76, 12 + tilt * 20], [76, 24 + tilt * 20], [36, 34 + tilt * 20]], true), K, 0]);
    if (lv === "detailed") { out.push([Mv(36, 44) + Lv(76, 34), "none", 1]); }
    return out;
  }

  function record(R, lv) {
    var out = [], g = by(lv, 0, 2, 3), i;
    out.push([circ(50, 52, 42), W, 0]);
    for (i = 0; i < g; i++) out.push([circ(50, 52, 35 - i * 6), "none", 1]);
    out.push([circ(50, 52, 15), W, 0]);
    out.push([circ(50, 52, 2.6), K, 0]);
    out.push([Mv(92, 8) + Lv(62, 52), "none", 0]);
    out.push([circ(94, 8, 4.5), W, 0]);
    if (lv !== "bold") out.push([rect(56, 50, 9, 6, 1), W, 0]);
    return out;
  }

  function quilt(R, lv) {
    var out = [], v = R.range(0, 2), i;
    out.push([rect(8, 8, 84, 84, 0), W, 0]);
    if (v === 0) {                                      // square in diamond in square
      var lvls = by(lv, 2, 3, 4), x0 = 8, y0 = 8, w = 84;
      var pts = function (n) { return n; };
      void pts;
      for (i = 0; i < lvls; i++) {
        var m = [[x0 + w / 2, y0], [x0 + w, y0 + w / 2], [x0 + w / 2, y0 + w], [x0, y0 + w / 2]];
        out.push([poly(m, true), i % 2 === 0 ? K : W, 0]);
        var nx = x0 + w / 4, ny = y0 + w / 4;
        out.push([rect(nx, ny, w / 2, w / 2, 0), i % 2 === 0 ? W : K, 0]);
        x0 = nx; y0 = ny; w = w / 2;
      }
    } else if (v === 1) {                               // a pinwheel
      var c = [50, 50], cs = [[8, 8], [92, 8], [92, 92], [8, 92]];
      for (i = 0; i < 4; i++) {
        var a = cs[i], b = cs[(i + 1) % 4], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        out.push([poly([a, mid, c], true), K, 0]);
        out.push([poly([mid, b, c], true), W, 0]);
      }
      out.push([circ(50, 50, by(lv, 6, 5, 4)), W, 0]);
    } else {                                            // nine patch
      var s3 = 28, j;
      for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
        var dark = (i + j) % 2 === 0;
        out.push([rect(8 + i * s3, 8 + j * s3, s3, s3, 0), dark ? K : W, 0]);
        if (!dark && lv !== "bold") out.push([poly([[8 + i * s3, 8 + j * s3], [8 + (i + 1) * s3, 8 + j * s3 + s3 / 2], [8 + i * s3, 8 + (j + 1) * s3]], true), "none", 1]);
      }
    }
    return out;
  }

  function yarn(R, lv) {
    var out = [], n = by(lv, 2, 3, 5), i;
    out.push([Mv(44, 52) + Lv(92, 14), "none", 0]); out.push([circ(94, 12, 3.6), W, 0]);
    out.push([circ(40, 58, 30), W, 0]);
    for (i = 0; i < n; i++) {
      var o = -18 + i * (36 / (n - 1 || 1));
      out.push([Mv(40 - 28, 58 + o * 0.6) + Cv(28, 58 + o - 12, 52, 58 + o + 14, 40 + 28, 58 + o * 0.6), "none", lv === "bold" ? 0 : 1]);
    }
    out.push([Mv(66, 78) + Cv(84, 86, 70, 98, 92, 94), "none", 0]);
    return out;
  }

  function ripples(R, lv) {
    var out = [], n = by(lv, 3, 4, 6), i, cx = 50 + rf(R, -3, 3), cy = 50 + rf(R, -3, 3);
    for (i = n; i >= 1; i--) out.push([circ(cx, cy, 6 + i * (40 / n)), W, 0]);
    out.push([circ(cx, cy, 4), K, 0]);
    return out;
  }

  function mandala(R, lv) {
    var out = [], i, a, n1 = by(lv, 6, 8, 8), n2 = by(lv, 0, 12, 16), off = rf(R, 0, 1);
    out.push([circ(50, 50, 45), "none", 0]);
    if (n2) for (i = 0; i < n2; i++) { a = TAU * (i + off) / n2; out.push([leaf(50 + Math.cos(a) * 25, 50 + Math.sin(a) * 25, 50 + Math.cos(a) * 42, 50 + Math.sin(a) * 42, by(lv, 6, 5.5, 4.5)), W, 0]); }
    for (i = 0; i < n1; i++) { a = TAU * i / n1; out.push([leaf(50 + Math.cos(a) * 9, 50 + Math.sin(a) * 9, 50 + Math.cos(a) * (n2 ? 26 : 38), 50 + Math.sin(a) * (n2 ? 26 : 38), by(lv, 11, 8, 6.5)), W, 0]); }
    out.push([circ(50, 50, by(lv, 10, 8, 7)), W, 0]);
    if (lv === "detailed") out.push([circ(50, 50, 3), K, 1]);
    return out;
  }

  function spiral(R, lv) {
    var turns = by(lv, 1.75, 2.25, 3.25), pts = [], i, steps = 180, t, r, a, a0 = rf(R, 0, TAU);
    for (i = 0; i <= steps; i++) { t = i / steps; r = 3 + 42 * t; a = a0 + TAU * turns * t; pts.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r]); }
    return [[smooth(pts, false), "none", 0], [circ(pts[0][0], pts[0][1], 2.6), K, 0]];
  }

  function waves(R, lv) {
    var out = [], n = by(lv, 4, 5, 7), i, j, ph = rf(R, 0, 1), amp = by(lv, 7, 6, 5);
    for (i = 0; i < n; i++) {
      var pts = [], y0 = 14 + i * (72 / (n - 1));
      for (j = 0; j <= 28; j++) { var u = j / 28; pts.push([8 + u * 84, y0 + amp * Math.sin(TAU * (u * 2 + ph + i * 0.18))]); }
      out.push([smooth(pts, false), "none", 0]);
    }
    return out;
  }

  function lattice(R, lv) {
    var out = [], g = by(lv, 3, 4, 6), i, c, x0 = 10, y0 = 10, s = 80;
    out.push([rect(x0, y0, s, s, 6), W, 0]);
    var step = s / g;
    for (i = 1; i < g; i++) {
      c = i * step;
      out.push([Mv(x0 + c, y0) + Lv(x0, y0 + c), "none", 0]); out.push([Mv(x0 + c, y0 + s) + Lv(x0 + s, y0 + c), "none", 0]);
      out.push([Mv(x0 + c, y0) + Lv(x0 + s, y0 + s - c), "none", 0]); out.push([Mv(x0, y0 + c) + Lv(x0 + s - c, y0 + s), "none", 0]);
    }
    out.push([Mv(x0 + s / 2, y0) + Lv(x0 + s, y0 + s / 2) + Lv(x0 + s / 2, y0 + s) + Lv(x0, y0 + s / 2) + "Z", "none", lv === "bold" ? 0 : 1]);
    return out;
  }

  /* id, the name printed as the page's title, who it suits (n nature, h heritage, m music and handwork), and the drawing */
  var N = "n", H = "h", Mu = "m";
  var MOTIFS = [
    { id: "m-fern", name: "Fern Frond", themes: [N], draw: fern },
    { id: "m-daisy", name: "Daisy", themes: [N], draw: daisy },
    { id: "m-tulip", name: "Tulip", themes: [N], draw: tulip },
    { id: "m-sunflower", name: "Sunflower", themes: [N], draw: sunflower },
    { id: "m-oakleaf", name: "Oak Leaf", themes: [N], draw: oakleaf },
    { id: "m-mapleleaf", name: "Maple Leaf", themes: [N], draw: mapleleaf },
    { id: "m-lilac", name: "Lilac Sprig", themes: [N, H], draw: lilac },
    { id: "m-wheat", name: "Wheat Stalks", themes: [N, H], draw: wheat },
    { id: "m-rose", name: "Garden Rose", themes: [N], draw: rosebloom },
    { id: "m-vine", name: "Flowing Vine", themes: [N, Mu], draw: vine },
    { id: "m-apple", name: "Orchard Apple", themes: [N, H], draw: apple },
    { id: "m-songbird", name: "Songbird on a Branch", themes: [N, Mu], draw: songbird },
    { id: "m-teacup", name: "Teacup and Saucer", themes: [H, Mu], draw: teacup },
    { id: "m-kettle", name: "Kitchen Kettle", themes: [H], draw: kettle },
    { id: "m-radio", name: "Table Radio", themes: [H, Mu], draw: radio },
    { id: "m-watch", name: "Pocket Watch", themes: [H], draw: pocketwatch },
    { id: "m-lantern", name: "Porch Lantern", themes: [H], draw: lantern },
    { id: "m-clock", name: "Mantel Clock", themes: [H], draw: mantelclock },
    { id: "m-pitcher", name: "Farmhouse Pitcher", themes: [H], draw: pitcher },
    { id: "m-key", name: "Old Brass Key", themes: [H], draw: antiquekey },
    { id: "m-spool", name: "Spool of Thread", themes: [H, Mu], draw: spool },
    { id: "m-cottage", name: "Country Cottage", themes: [H, N], draw: cottage },
    { id: "m-piano", name: "Piano Keys", themes: [Mu], draw: pianokeys },
    { id: "m-notes", name: "Musical Notes", themes: [Mu], draw: notes },
    { id: "m-record", name: "Record Player", themes: [Mu, H], draw: record },
    { id: "m-quilt", name: "Quilt Block", themes: [Mu, H], draw: quilt },
    { id: "m-yarn", name: "Ball of Yarn", themes: [Mu, H], draw: yarn },
    { id: "m-ripples", name: "Pond Ripples", themes: [N, H, Mu], draw: ripples },
    { id: "m-mandala", name: "Calm Mandala", themes: [N, H, Mu], draw: mandala },
    { id: "m-spiral", name: "Slow Spiral", themes: [N, H, Mu], draw: spiral },
    { id: "m-waves", name: "Gentle Waves", themes: [N, H, Mu], draw: waves },
    { id: "m-lattice", name: "Garden Lattice", themes: [N, H, Mu], draw: lattice }
  ];

  /* =====================================================================
     PATHS: a center line, made to fit the room it is given
     make(R, w, h, hw, k) -> { pts: [[x, y], ...] inside 0..w and 0..h, closed }
     w and h are the room the line may use (already inside the lane's own half width hw). k, from 1 down, eases the bends
     (a smaller swing and a slower wave): buildPath() tries the full shape first and eases it until every bend is wider than
     the lane, so a lane never folds over itself.
     ===================================================================== */
  function sample(fn, n) { var pts = [], i; for (i = 0; i <= n; i++) pts.push(fn(i / n)); return pts; }
  var line = function (pts) { return { pts: pts, closed: false }; };
  var slow = function (f, k) { return f * (0.55 + 0.45 * k); };

  function wave(R, w, h, hw, k) {
    var f = slow(R.pick([1.5, 2, 2.5]), k), ph = rf(R, 0, 0.25), A = Math.min(h * 0.4, w / (f * 3.4)) * k;
    return line(sample(function (u) { return [u * w, h / 2 + A * Math.sin(TAU * (f * u + ph))]; }, 200));
  }
  function swells(R, w, h, hw, k) {
    var A = h * 0.2 * k, B = h * 0.1 * k, ph = rf(R, 0, 1), f = slow(1.25, k);
    return line(sample(function (u) { return [u * w, h / 2 + A * Math.sin(TAU * (f * u + ph)) + B * Math.sin(TAU * (2 * f * u + ph * 2))]; }, 220));
  }
  function shoreline(R, w, h, hw, k) {
    var ph = rf(R, 0, 0.3), f = slow(2.25, k);
    return line(sample(function (u) { return [u * w, h / 2 + h * (0.06 + 0.28 * u) * k * Math.sin(TAU * (f * u + ph))]; }, 240));
  }
  function meander(R, w, h, hw, k) {
    var ph = rf(R, 0, 1), f = slow(1.1, k);
    return line(sample(function (u) { return [u * w, h / 2 + h * 0.27 * k * Math.sin(TAU * (f * u + ph)) + h * 0.09 * k * Math.sin(TAU * (2.1 * f * u + ph * 3))]; }, 240));
  }
  function softzigzag(R, w, h, hw, k) {
    var f = slow(R.pick([2, 2.5, 3]), k), A = Math.min(h * 0.4, w / (f * 3)) * k;
    return line(sample(function (u) { return [u * w, h / 2 + A * Math.tanh(1.5 * Math.sin(TAU * f * u + Math.PI / 2)) / Math.tanh(1.5)]; }, 260));
  }
  function lazyS(R, w, h, hw, k) {
    var s = sgn(R), A = w * 0.44 * k;
    return line(sample(function (u) { return [w / 2 + s * A * Math.sin(TAU * u), u * h]; }, 220));
  }
  function ribbon(R, w, h, hw, k) {
    var s = sgn(R), ph = rf(R, -0.2, 0.2), f = slow(1.5, k);
    return line(sample(function (u) { return [w * u, h * (0.5 + s * 0.36 * k * Math.sin(TAU * (f * u + ph)) * (1 - 0.35 * Math.abs(2 * u - 1)))]; }, 240));
  }
  function arch(R, w, h, hw, k) {
    var rx = w * 0.46, ry = Math.min(h * 0.78, rx * 1.15);
    return line(sample(function (u) { var a = Math.PI * (1 - u); return [w / 2 + rx * Math.cos(a), h * 0.92 - ry * Math.sin(a)]; }, 200));
  }
  function spiralPath(inward) {
    return function (R, w, h, hw, k) {
      var R0 = Math.min(w, h) / 2, rEnd = hw * 1.7 + 12, gap = hw * 2 + 14, turns = Math.max(1, Math.floor((R0 - rEnd) / gap * 4) / 4), a0 = rf(R, 0, TAU), s = sgn(R);
      return line(sample(function (u) { var t = inward ? u : 1 - u, r = R0 - (R0 - rEnd) * t, a = a0 + s * TAU * turns * t; return [w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r]; }, 260));
    };
  }
  /* rows that run the width of the room, joined by half circles at alternating ends */
  function snake(R, w, h, hw, k) {
    var rows = hw >= 28 ? 2 : 3, gap = h / (rows - 1), r = gap / 2, pts = [[0, 0]], i, kk;
    for (i = 0; i < rows; i++) {
      var y = i * gap, ltr = i % 2 === 0, ex = ltr ? w - r : r;
      pts.push([ex, y]);
      if (i < rows - 1) {
        for (kk = 1; kk <= 18; kk++) { var a = -Math.PI / 2 + Math.PI * kk / 18 * (ltr ? 1 : -1); pts.push([ex + Math.cos(a) * r, y + r + Math.sin(a) * r]); }
      } else pts.push([ltr ? w : 0, y]);
    }
    return line(densify(pts, 6));
  }
  function circle(R, w, h, hw, k) {
    var rho = Math.min(w, h) / 2, s = sgn(R);
    var pts = sample(function (u) { var a = Math.PI / 2 + s * TAU * u; return [w / 2 + Math.cos(a) * rho, h / 2 + Math.sin(a) * rho]; }, 220);
    return { pts: pts.slice(0, -1), closed: true };
  }
  function oval(R, w, h, hw, k) {
    var rx = w / 2, ry = Math.min(h / 2, Math.max(rx * 0.7, hw * 1.6 + 6)), s = sgn(R);
    var pts = sample(function (u) { var a = Math.PI / 2 + s * TAU * u; return [w / 2 + Math.cos(a) * rx, h / 2 + Math.sin(a) * ry]; }, 240);
    return { pts: pts.slice(0, -1), closed: true };
  }
  function staircase(R, w, h, hw, k) {
    var steps = hw >= 28 ? 3 : 4, rad = hw + 10, pts = [], sx = (w - rad * 2) / steps, sy = (h - rad * 2) / steps, i, x = 0, y = h;
    pts.push([x, y]);
    for (i = 0; i < steps; i++) { pts.push([x + sx, y]); x += sx; pts.push([x, y - sy]); y -= sy; }
    pts.push([w, y]);
    return line(roundCorners(pts, rad));
  }
  function trail(R, w, h, hw, k) {
    var n = hw >= 28 ? 4 : 5, pts = [], i, rad = hw * 1.5 + 10, side = sgn(R);
    for (i = 0; i < n; i++) { var x = w * (i % 2 ? 0.1 : 0.9); pts.push([side > 0 ? x : w - x, h * i / (n - 1)]); }
    return line(roundCorners(pts, rad));
  }
  function dunes(R, w, h, hw, k) {
    var p1 = rf(R, 0, 1), p2 = rf(R, 0, 1), f = slow(0.9, k);
    return line(sample(function (u) { return [u * w, h / 2 + k * (h * 0.2 * Math.sin(TAU * (f * u + p1)) + h * 0.1 * Math.sin(TAU * (2.1 * f * u + p2)) + h * 0.05 * Math.sin(TAU * (3.4 * f * u)))]; }, 260));
  }
  function ripple(R, w, h, hw, k) {
    var f = slow(2.25, k), ph = rf(R, 0, 0.2), s = sgn(R);
    return line(sample(function (u) { return [u * w, h / 2 + s * h * 0.36 * k * Math.exp(-1.7 * u) * Math.sin(TAU * (f * u + ph))]; }, 260));
  }
  function vwave(R, w, h, hw, k) {
    var f = slow(R.pick([1.5, 2]), k), A = Math.min(w * 0.4, h / (f * 6)) * k, ph = rf(R, 0, 0.25);
    return line(sample(function (u) { return [w / 2 + A * Math.sin(TAU * (f * u + ph)), u * h]; }, 220));
  }

  /* a polyline with more points along its long runs, so the lane's edges keep their shape */
  function densify(pts, step) {
    var out = [pts[0]], i;
    for (i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(d / step)), kk;
      for (kk = 1; kk <= n; kk++) out.push([a[0] + (b[0] - a[0]) * kk / n, a[1] + (b[1] - a[1]) * kk / n]);
    }
    return out;
  }
  /* a polyline whose corners are rounded with a circular arc of the given radius */
  function roundCorners(pts, rad) {
    var out = [pts[0]], i, kk;
    for (i = 1; i < pts.length - 1; i++) {
      var a = pts[i - 1], b = pts[i], c = pts[i + 1];
      var d1 = [a[0] - b[0], a[1] - b[1]], d2 = [c[0] - b[0], c[1] - b[1]], l1 = Math.hypot(d1[0], d1[1]), l2 = Math.hypot(d2[0], d2[1]);
      var u1 = [d1[0] / l1, d1[1] / l1], u2 = [d2[0] / l2, d2[1] / l2];
      var ang = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
      var t = Math.min(rad / Math.tan(ang / 2), l1 / 2 - 0.01, l2 / 2 - 0.01), r = t * Math.tan(ang / 2);
      var p1 = [b[0] + u1[0] * t, b[1] + u1[1] * t], p2 = [b[0] + u2[0] * t, b[1] + u2[1] * t];
      var bis = [u1[0] + u2[0], u1[1] + u2[1]], bl = Math.hypot(bis[0], bis[1]) || 1;
      var cc = [b[0] + bis[0] / bl * (r / Math.sin(ang / 2)), b[1] + bis[1] / bl * (r / Math.sin(ang / 2))];
      var a1 = Math.atan2(p1[1] - cc[1], p1[0] - cc[0]), a2 = Math.atan2(p2[1] - cc[1], p2[0] - cc[0]), da = a2 - a1;
      while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      out.push(p1);
      for (kk = 1; kk < 14; kk++) { var aa = a1 + da * kk / 14; out.push([cc[0] + Math.cos(aa) * r, cc[1] + Math.sin(aa) * r]); }
      out.push(p2);
    }
    out.push(pts[pts.length - 1]);
    return densify(out, 5);
  }

  var PATHS = [
    { id: "p-wave", across: true, name: "Gentle Wave", themes: [N, H, Mu], rhythm: true, make: wave },
    { id: "p-swells", across: true, name: "Ocean Swells", themes: [N, Mu], rhythm: true, make: swells },
    { id: "p-shoreline", across: true, name: "Rising Tide", themes: [N], rhythm: true, make: shoreline },
    { id: "p-meander", across: true, name: "River Bend", themes: [N, H], rhythm: true, make: meander },
    { id: "p-zigzag", across: true, name: "Soft Zigzag", themes: [H, Mu], rhythm: true, make: softzigzag },
    { id: "p-lazys", name: "The Lazy S", themes: [N, H, Mu], rhythm: true, make: lazyS },
    { id: "p-ribbon", across: true, name: "Flowing Ribbon", themes: [H, Mu], rhythm: true, make: ribbon },
    { id: "p-arch", name: "Rainbow Arch", themes: [N, H], rhythm: false, make: arch },
    { id: "p-spiral-in", name: "Spiral Inward", themes: [N, H, Mu], rhythm: false, make: spiralPath(true) },
    { id: "p-spiral-out", name: "Spiral Outward", themes: [N, H, Mu], rhythm: false, make: spiralPath(false) },
    { id: "p-garden", name: "Garden Path", themes: [N, H], rhythm: false, make: snake },
    { id: "p-circle", name: "Full Circle", themes: [N, H, Mu], rhythm: false, make: circle },
    { id: "p-oval", name: "Pond Edge", themes: [N, H], rhythm: false, make: oval },
    { id: "p-steps", name: "Garden Steps", themes: [H, Mu], rhythm: false, make: staircase },
    { id: "p-trail", name: "Winding Trail", themes: [N, H], rhythm: false, make: trail },
    { id: "p-dunes", across: true, name: "Prairie Hills", themes: [N, H], rhythm: true, make: dunes },
    { id: "p-ripple", across: true, name: "Fading Ripples", themes: [N, Mu], rhythm: true, make: ripple },
    { id: "p-vwave", name: "Winding Stream", themes: [N, H], rhythm: true, make: vwave }
  ];

  /* ---------- from a center line to a lane ---------- */
  var area = function (pts) { var a = 0, i, n = pts.length; for (i = 0; i < n; i++) { var p = pts[i], q = pts[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
  /* the lane around a center line: path data for its outline (an open line: one closed outline with a rounded cap at each
     end; a closed line: the outer loop, then the inner one) */
  function laneOutline(pts, hw, closed) {
    var n = pts.length, left = [], right = [], i;
    for (i = 0; i < n; i++) {
      var a = pts[closed ? (i + n - 1) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      var tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l;
      left.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]); right.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
    }
    if (closed) {
      var outer = area(left) >= area(right) ? left : right, inner = outer === left ? right : left;
      return { d: [poly(outer, true), poly(inner, true)], loops: [outer, inner] };
    }
    /* a half circle around the end c, turning away from the line */
    var cap = function (c, from, tan) {
      var a0 = Math.atan2(from[1] - c[1], from[0] - c[0]), out = [], kk, sign = 1;
      var probe = [c[0] + Math.cos(a0 + Math.PI / 2) * hw, c[1] + Math.sin(a0 + Math.PI / 2) * hw];
      if ((probe[0] - c[0]) * tan[0] + (probe[1] - c[1]) * tan[1] < 0) sign = -1;
      for (kk = 1; kk < 14; kk++) out.push([c[0] + Math.cos(a0 + sign * Math.PI * kk / 14) * hw, c[1] + Math.sin(a0 + sign * Math.PI * kk / 14) * hw]);
      return out;
    };
    var t0 = [pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]], t1 = [pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]];
    var outline = left.concat(cap(pts[n - 1], left[n - 1], t1), right.slice().reverse(), cap(pts[0], right[0], t0));
    return { d: [poly(outline, true)], loops: [outline] };
  }

  /* the tightest bend of a line: the smallest radius of the circle through three points about 9 units apart along it */
  function minRadius(pts, closed) {
    var n = pts.length, cum = [0], i, best = Infinity, total;
    for (i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    total = cum[n - 1] + (closed ? Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) : 0);
    var span = 9, at = function (s) { s = closed ? ((s % total) + total) % total : Math.max(0, Math.min(cum[n - 1], s)); var lo = 0, hi = n - 1; while (lo < hi - 1) { var m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; } var t = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1), b = pts[(hi) % n]; return [pts[lo][0] + (b[0] - pts[lo][0]) * t, pts[lo][1] + (b[1] - pts[lo][1]) * t]; };
    for (i = 0; i < n; i++) {
      if (!closed && (cum[i] < span || cum[n - 1] - cum[i] < span)) continue;
      var a = at(cum[i] - span), b = pts[i], c = at(cum[i] + span);
      var ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
      var cross = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
      if (cross < 1e-6) continue;
      var rad = ab * bc * ca / (4 * cross);
      if (rad < best) best = rad;
    }
    return best;
  }
  /* Is the path fit to be a lane? No bend is tighter than the lane can follow (so the lane's inside edge never folds), and no
     two parts of it, more than half a turn of the tightest allowed bend apart along the line, come nearer than the lane's width
     plus a gap (so nothing crosses and nothing touches). */
  function pathOk(pts, hw, closed, gap) {
    if (minRadius(pts, closed) < hw + 4) return false;
    var n = pts.length, cum = [0], i, j, total;
    for (i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    total = cum[n - 1] + (closed ? Math.hypot(pts[0][0] - pts[n - 1][0], pts[0][1] - pts[n - 1][1]) : 0);
    var need = 2 * hw + (gap == null ? 8 : gap), apart = Math.PI * (hw + 4);
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var ds = cum[j] - cum[i];
      if (closed) ds = Math.min(ds, total - ds);
      if (ds <= apart) continue;
      var dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1];
      if (dx * dx + dy * dy < need * need) return false;
    }
    return true;
  }
  /* the path as a lane: the full shape if the lane can follow it, otherwise the shape eased a little at a time until it can.
     rngFor() gives the same stream every time, so the shape keeps its character while it is eased. Returns null if no
     version fits. */
  function buildPath(def, rngFor, w, h, hw) {
    var k;
    for (k = 1; k >= 0.28; k -= 0.06) {
      var res = def.make(rngFor(), w, h, hw, k);
      if (res && res.pts.length > 3 && pathOk(res.pts, hw, res.closed)) { res.ease = Math.round(k * 100) / 100; return res; }
    }
    return null;
  }

  root.CognicopiaSoothingArt = Object.freeze({
    VERSION: VERSION, MOTIFS: MOTIFS, PATHS: PATHS, laneOutline: laneOutline, pathOk: pathOk, minRadius: minRadius, buildPath: buildPath,
    helpers: Object.freeze({ poly: poly, smooth: smooth, ell: ell, circ: circ, rect: rect, leaf: leaf, densify: densify, roundCorners: roundCorners })
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
