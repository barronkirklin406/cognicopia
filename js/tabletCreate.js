/* =====================================================================
   Cognicopia Tablet Activities: the hands-on ones.

   Trace the Path, Color a Picture, Finger Paint and Bubbles.
   Each registers itself with the kit (js/tabletKit.js) and is started by
   the screen (js/tablet.js) with a root element, the choices, and an api.

   Calm by design: nothing is scored or timed, a slip is never a failure,
   and every activity can be finished for the person with one touch.
   ===================================================================== */
(function () {
  "use strict";
  var Kit = window.CognicopiaTabletKit, T = window.CognicopiaTablet, Art = window.CognicopiaTabletArt, PCG = window.CognicopiaPCG;
  if (!Kit || !T || !Art) return;
  var h = Kit.h, reduced = Kit.reduced;

  /* ===================== TRACE THE PATH =====================
     A bee goes to a flower, a train to its station, a dog to its bone, along a wide glowing lane. The marker always stays on the
     lane and only moves forward: a finger that wanders off leaves it waiting, a finger that lifts leaves it where it is, and a
     finger that comes back to the lane carries it on. The marker glides toward the finger rather than jumping, so a trembling hand
     still makes a smooth journey. Nothing is ever sent back to the start. */
  function trace(root, o, api) {
    var cfg = T.STAGES[o.stage].trace, rounds = cfg.rounds, round = 0, path = null, tol = 40;
    var rng = PCG.prng.create(o.seed + "/scenes"), order = rng.shuffle(["bee", "train", "dog"]);
    if (o.avoid && o.avoid[0] === order[0]) order.push(order.shift());
    api.used([order[0]]);
    var cv = h("canvas", "tb-trace"), msg = h("p", "tb-msg", "");
    cv.setAttribute("role", "img");
    root.appendChild(cv); root.appendChild(msg);
    var ctx = cv.getContext("2d"), dpr = 1, vw = 300, vh = 200, sc = 1, ox = 0, oy = 0, raf = 0, last = 0, clock = 0;
    var i = 0, shown = 0, dragging = false, away = false, landed = -9, hintAt = -9, assisting = false, over = false, lastTick = 0, lane = null;
    var pics = {}, FACES_LEFT = { train: true };       /* the train's picture looks left; the rest look right */
    ["bee", "flower", "train", "station", "dog", "bone"].forEach(function (id) { Art.image(id, 256, function (im) { pics[id] = im; }); });

    function layout() {
      var r = cv.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      vw = Math.max(200, Math.round(r.width)); vh = Math.max(160, Math.round(r.height));
      cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
      sc = Math.min(vw / 1000, vh / 600); ox = (vw - 1000 * sc) / 2; oy = (vh - 600 * sc) / 2;
      if (path) tol = Math.max(path.tol * 0.8, Math.min(path.tol / sc, path.kind === "spiral" ? 36 : 72));
    }
    function build() {
      path = T.tracePath({ stage: o.stage, seed: o.seed + "/" + round, scene: order[round % order.length] });
      lane = typeof Path2D === "function" ? new Path2D(path.d) : null;
      i = 0; shown = 0; dragging = false; away = false; over = false; landed = -9; hintAt = -9;
      layout();
      cv.setAttribute("aria-label", path.line + " Slide a finger along the glowing path, a little at a time.");
      msg.textContent = path.line + " Touch the " + path.from + " and slide along the glowing path.";
      api.progress("Journey " + (round + 1) + " of " + rounds); api.live(msg.textContent);
    }
    var tolU = function () { return tol; };
    function toUnits(e) { var b = cv.getBoundingClientRect(); return [(e.clientX - b.left - ox) / sc, (e.clientY - b.top - oy) / sc]; }
    function at(k) { var a = Math.max(0, Math.min(path.pts.length - 1, Math.floor(k))), b = Math.min(path.pts.length - 1, a + 1), f = k - a, p = path.pts[a], q = path.pts[b]; return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]; }

    /* ----- the picture ----- */
    function ground(scene) {
      var g = ctx.createLinearGradient(0, 0, 0, 600); g.addColorStop(0, "#fff9e8"); g.addColorStop(1, "#f1e6c9");
      ctx.fillStyle = g; ctx.fillRect(-400, -400, 1800, 1400);
      ctx.fillStyle = "rgba(246,221,138,.85)"; ctx.beginPath(); ctx.arc(905, 78, 46, 0, 6.3); ctx.fill();
      ctx.fillStyle = "rgba(159,203,176,.55)"; ctx.beginPath(); ctx.moveTo(-400, 600); ctx.lineTo(-400, 540); ctx.quadraticCurveTo(150, 470, 420, 545); ctx.quadraticCurveTo(700, 480, 1400, 540); ctx.lineTo(1400, 600); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(111,163,134,.55)"; ctx.beginPath(); ctx.moveTo(-400, 600); ctx.lineTo(-400, 575); ctx.quadraticCurveTo(300, 530, 600, 580); ctx.quadraticCurveTo(900, 540, 1400, 575); ctx.lineTo(1400, 600); ctx.closePath(); ctx.fill();
      if (scene === "bee") { for (var k = 0; k < 9; k++) { var x = 70 + k * 108, y = 566 + (k % 3) * 8; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.3); ctx.fill(); ctx.fillStyle = "#e0b43a"; ctx.beginPath(); ctx.arc(x, y, 4, 0, 6.3); ctx.fill(); } }
      if (scene === "train") { ctx.strokeStyle = "rgba(79,64,48,.55)"; ctx.lineWidth = 5; ctx.lineCap = "round"; [130, 380, 630, 880].forEach(function (x) { ctx.beginPath(); ctx.moveTo(x, 590); ctx.lineTo(x, 510); ctx.moveTo(x - 20, 524); ctx.lineTo(x + 20, 524); ctx.stroke(); }); }
      if (scene === "dog") { ctx.strokeStyle = "rgba(79,64,48,.5)"; ctx.lineWidth = 5; ctx.lineCap = "round"; for (var f = 0; f < 11; f++) { var fx = 40 + f * 92; ctx.beginPath(); ctx.moveTo(fx, 592); ctx.lineTo(fx, 540); ctx.stroke(); } ctx.beginPath(); ctx.moveTo(20, 556); ctx.lineTo(990, 556); ctx.stroke(); }
    }
    function partial(upto) {            // the line from the start to a (fractional) point number
      var n = Math.floor(upto), p = at(upto);
      ctx.beginPath(); ctx.moveTo(path.pts[0][0], path.pts[0][1]);
      for (var k = 1; k <= n; k++) ctx.lineTo(path.pts[k][0], path.pts[k][1]);
      ctx.lineTo(p[0], p[1]);
    }
    function sprite(id, x, y, size, angle, mirror, pulse) {
      var im = pics[id]; if (!im) return;
      if (FACES_LEFT[id]) mirror = !mirror;
      ctx.save(); ctx.translate(x, y); if (angle) ctx.rotate(angle); if (mirror) ctx.scale(-1, 1); var s = size * (1 + pulse); ctx.drawImage(im, -s / 2, -s / 2, s, s); ctx.restore();
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, vw, vh);
      ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
      if (!path) return;
      ground(path.scene);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      var laneW = tol * 2, still = reduced();
      /* the lane: a wide, warm band with a soft glow, and a dotted guide down its middle */
      ctx.strokeStyle = "rgba(245,184,0,.22)"; ctx.lineWidth = laneW + 44; ctx.setLineDash([]);
      if (lane) ctx.stroke(lane);
      ctx.strokeStyle = "#b8914a"; ctx.lineWidth = laneW + 8; if (lane) ctx.stroke(lane);
      ctx.strokeStyle = "#f7e7b8"; ctx.lineWidth = laneW; if (lane) ctx.stroke(lane);
      if (path.scene === "train") {                      // sleepers and two rails
        ctx.strokeStyle = "#7a5230"; ctx.lineWidth = 9;
        for (var k = 6; k < path.pts.length - 3; k += 3) { var p = path.pts[k], q = path.pts[k + 1], a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2, d = laneW * 0.42; ctx.beginPath(); ctx.moveTo(p[0] - Math.cos(a) * d, p[1] - Math.sin(a) * d); ctx.lineTo(p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d); ctx.stroke(); }
        ctx.strokeStyle = "#4a5260"; ctx.lineWidth = 6;
        [-1, 1].forEach(function (side) { ctx.beginPath(); for (var m = 0; m < path.pts.length - 1; m += 2) { var p0 = path.pts[m], q0 = path.pts[m + 1], a0 = Math.atan2(q0[1] - p0[1], q0[0] - p0[0]) + Math.PI / 2, x0 = p0[0] + Math.cos(a0) * side * laneW * 0.3, y0 = p0[1] + Math.sin(a0) * side * laneW * 0.3; if (m) ctx.lineTo(x0, y0); else ctx.moveTo(x0, y0); } ctx.stroke(); });
      } else {
        ctx.strokeStyle = "#1a202c"; ctx.lineWidth = 5; ctx.setLineDash([2, 16]); ctx.lineDashOffset = still ? 0 : -clock * 26; if (lane) ctx.stroke(lane); ctx.setLineDash([]);
      }
      /* the way travelled (the one travelling stops a little short of where it is going, so both can be seen) */
      var vis = Math.min(shown, path.pts.length - 11);
      if (vis > 0.5) { ctx.strokeStyle = "rgba(45,90,68,.92)"; ctx.lineWidth = Math.max(20, tol * 0.7); partial(vis); ctx.stroke(); }
      /* where it is going */
      var near = shown > path.pts.length * 0.7, pulse = still ? 0 : Math.sin(clock * 4) * (near ? 0.07 : 0.03);
      var glow = ctx.createRadialGradient(path.end[0], path.end[1], 10, path.end[0], path.end[1], 120);
      glow.addColorStop(0, near ? "rgba(245,184,0,.55)" : "rgba(245,184,0,.28)"); glow.addColorStop(1, "rgba(245,184,0,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(path.end[0], path.end[1], 120, 0, 6.3); ctx.fill();
      sprite(path.to, path.end[0], path.end[1] - (path.to === "flower" ? 30 : 6), path.to === "station" ? 200 : 150, 0, false, pulse);
      /* a hint: a bright pulse runs along the way ahead */
      if (clock - hintAt < 4) {
        var span = 60, from = vis, to = Math.min(path.pts.length - 1, vis + span), beat = still ? 0.5 : (Math.sin(clock * 7) + 1) / 2;
        ctx.strokeStyle = "rgba(245,184,0," + (0.3 + beat * 0.45).toFixed(2) + ")"; ctx.lineWidth = laneW * 0.9;
        ctx.beginPath(); var a2 = at(from); ctx.moveTo(a2[0], a2[1]); for (var m2 = Math.ceil(from); m2 <= to; m2++) ctx.lineTo(path.pts[m2][0], path.pts[m2][1]); ctx.stroke();
      }
      /* the one travelling: it faces the way it is going */
      var here = at(vis), ahead = at(Math.min(path.pts.length - 1, vis + 4)), back = at(Math.max(0, vis - 4)), ang = Math.atan2(ahead[1] - back[1], ahead[0] - back[0]), left = Math.cos(ang) < 0;
      var bob = still ? 0 : Math.sin(clock * 5) * 4, hop = clock - landed < 1.2 ? Math.abs(Math.sin((clock - landed) * 7)) * 0.16 * Math.max(0, 1 - (clock - landed) / 1.2) : 0;
      var size = path.from === "train" ? 200 : path.from === "dog" ? 165 : 140, wait = away && !over ? (still ? 0 : Math.sin(clock * 6) * 0.06) : 0;
      if (away && !over) { ctx.strokeStyle = "rgba(245,184,0,.7)"; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(here[0], here[1], size * 0.62 + (still ? 0 : Math.sin(clock * 6) * 6), 0, 6.3); ctx.stroke(); }
      if (path.from === "dog") sprite("dog", here[0], here[1] - size * 0.3 + bob, size, 0, left, hop + wait);
      else sprite(path.from, here[0], here[1] - (path.from === "bee" ? 6 : size * 0.22) + bob, size, left ? ang - Math.PI : ang, left, hop + wait);
    }
    function frame(ts) {
      var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts; clock += dt;
      if (path && !over) {
        if (assisting) i = Math.min(path.pts.length - 1, i + dt * (path.pts.length / 2.2));
        shown += (i - shown) * Math.min(1, dt * 9); if (Math.abs(i - shown) < 0.02) shown = i;
        if (i >= path.pts.length - 1 - Math.max(2, Math.round(tol * 0.6 / 6)) && shown > path.pts.length - 6) arrive();
      }
      draw();
      raf = requestAnimationFrame(frame);
    }
    function arrive() {
      if (over) return;
      over = true; i = path.pts.length - 1; landed = clock; dragging = false;
      api.chime(false); msg.textContent = path.arrive; api.live(path.arrive);
      api.later(function () {
        round++;
        if (round >= rounds) api.cheer("Every journey is complete. A lovely, steady hand.", "Trace more");
        else { build(); }
      }, assisting ? 700 : 1400);
    }
    function moveTo(e) {
      if (over || assisting) return;
      var r = T.follow(path, { i: i }, toUnits(e), tolU());
      away = r.status === "away";
      if (r.i > i) { i = r.i; if (clock - lastTick > 0.18) { lastTick = clock; api.tick(); } }
      if (r.status === "done") i = path.pts.length - 1;
      msg.textContent = away ? "Take your time. The " + path.from + " is waiting right here." : "Lovely. Keep going.";
    }
    cv.addEventListener("pointerdown", function (e) {
      api.unlock(); e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* mouse or old browser */ }
      dragging = true; moveTo(e);
    });
    cv.addEventListener("pointermove", function (e) { if (dragging) moveTo(e); });
    var lift = function () { dragging = false; };
    cv.addEventListener("pointerup", lift); cv.addEventListener("pointercancel", lift);
    /* without a finger: the arrow keys and the space bar carry the marker along */
    api.onKey(function (e) {
      if (!/^(ArrowRight|ArrowDown|ArrowLeft|ArrowUp| |Spacebar)$/.test(e.key) || over || assisting) return;
      e.preventDefault(); if (e.key === "ArrowLeft" || e.key === "ArrowUp") return;
      i = Math.min(path.pts.length - 1, i + 6); away = false; api.busy();
    });
    build(); api.onResize(layout);
    raf = requestAnimationFrame(frame);
    api.say(function () { return path.line + " Touch it, then slide your finger along the glowing path."; });
    api.hint(function () { hintAt = clock; msg.textContent = "Slide along the glowing path. The " + path.from + " will follow."; });
    api.assist(function () {
      assisting = true; dragging = false; msg.textContent = "Here we go. The " + path.from + " is on its way.";    // the same gentle journey for every path that is left
    });
    api.debug(function () {
      return { path: path, tol: tolU(), round: round, index: i, shown: shown, away: away, over: over, assisting: assisting, scene: path.scene, from: path.from, to: path.to,
        toClient: function (x, y) { var b = cv.getBoundingClientRect(); return [b.left + ox + x * sc, b.top + oy + y * sc]; } };
    });
    return function () { cancelAnimationFrame(raf); };
  }


  /* ---------- the colors: choose a set (Soft, Bold, Garden, Vintage), then a color ---------- */
  var PALETTES = T.PALETTES;
  var hexRGB = function (hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  var rgba = function (hex, a) { var c = hexRGB(hex); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; };
  var isLight = function (hex) { var c = hexRGB(hex); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) > 170; };
  var seeded = function (seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  var byId = function (id) { return document.getElementById(id); };
  var hashOf = function (s) { var x = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };

  /* onPick(hex, name) is told the color at once, and each time it changes. The chosen set is remembered. */
  function colorPanel(api, onPick) {
    var bank = Math.min(PALETTES.length - 1, Math.max(0, api.prefs.palette || 0)), pick = 0, box = h("div", "tb-colors"), banks = h("div", "tb-banks"), pal = h("div", "tb-pal");
    banks.setAttribute("role", "group"); banks.setAttribute("aria-label", "Sets of colors");
    PALETTES.forEach(function (p, k) { var b = h("button", "tb-btn", p.name); b.type = "button"; b.setAttribute("data-bank", k); b.setAttribute("aria-pressed", String(k === bank)); banks.appendChild(b); });
    pal.setAttribute("role", "group"); pal.setAttribute("aria-label", "Colors");
    function swatches() {
      pal.innerHTML = "";
      PALETTES[bank].colors.forEach(function (c, k) {
        var b = h("button", "tb-sw" + (isLight(c[1]) ? " light" : "")); b.type = "button"; b.style.background = c[1];
        b.setAttribute("aria-label", c[0]); b.setAttribute("aria-pressed", String(k === pick)); b.setAttribute("data-color", c[1]); b.setAttribute("data-name", c[0]); pal.appendChild(b);
      });
      onPick(PALETTES[bank].colors[pick][1], PALETTES[bank].colors[pick][0]);
    }
    banks.addEventListener("click", function (e) {
      var b = e.target.closest("[data-bank]"); if (!b) return; api.unlock();
      bank = +b.getAttribute("data-bank"); api.prefs.palette = bank; api.savePrefs(); pick = 0;
      Array.prototype.forEach.call(banks.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); }); swatches(); api.busy();
    });
    pal.addEventListener("click", function (e) {
      var b = e.target.closest(".tb-sw"); if (!b) return; api.unlock(); api.tick(); api.busy();
      Array.prototype.forEach.call(pal.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      pick = Array.prototype.indexOf.call(pal.children, b); onPick(b.getAttribute("data-color"), b.getAttribute("data-name"));
    });
    box.appendChild(banks); box.appendChild(pal); swatches();
    return { el: box, pal: pal, colors: function () { return PALETTES[bank].colors.map(function (c) { return c[1]; }); }, bank: function () { return PALETTES[bank].id; } };
  }

  /* ===================== COLOR THE PICTURE =====================
     A picture from the coloring library, drawn as closed outlines. A tap fills the whole shape under the finger, and a color
     can never leave its lines, so nothing can be done wrong: Undo takes the last color back, Start over takes them all back, and
     Finish for me colors what is left. The shapes are found on the picture itself (T.regions), so every picture in the
     library works, however it was drawn. */
  var CW = 600, CH = 800;
  function loadColoring(cb) {
    if (window.CognicopiaColoring) return cb(true);
    var s = document.createElement("script"); s.src = "assets/cognicopia-coloring/cognicopia-coloring.js";
    s.onload = function () { cb(!!window.CognicopiaColoring); }; s.onerror = function () { cb(false); }; document.head.appendChild(s);
  }
  /* the picture's pixels, drawn from its own outlines at CW x CH: nothing is fetched */
  function rasterise(svg, cb) {
    var im = new Image();
    im.onload = function () {
      try { var cv = document.createElement("canvas"); cv.width = CW; cv.height = CH; var g = cv.getContext("2d", { willReadFrequently: true }); g.fillStyle = "#fff"; g.fillRect(0, 0, CW, CH); g.drawImage(im, 0, 0, CW, CH); cb(g.getImageData(0, 0, CW, CH)); }
      catch (e) { cb(null); }
    };
    im.onerror = function () { cb(null); };
    im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function color(root, o, api) {
    var gone = false;
    root.innerHTML = '<p class="tb-big">Getting the pictures ready…</p>';
    loadColoring(function (ok) {
      if (gone) return;
      if (!ok) { root.innerHTML = '<p class="tb-big">The pictures could not be loaded. Choose Home, then try again.</p>'; return; }
      var C = window.CognicopiaColoring, tier = T.STAGES[o.stage].color.tier, ids = T.designChoices(o, C.designs()), page = 0, PER = 8, fill = "#f4b6c2", cp = null, finishIt = null;
      api.used(ids.slice(0, PER));
      function chooser() {
        finishIt = null; root.innerHTML = ""; api.progress("");
        var start = (page * PER) % ids.length, show = []; for (var k = 0; k < PER && k < ids.length; k++) show.push(ids[(start + k) % ids.length]);
        var box = h("div", "tb-chooser"), grid = h("div", "tb-pics"), more = h("div", "tb-row");
        box.appendChild(h("p", "tb-h", "Choose a picture to color"));
        show.forEach(function (id) {
          var title = C.design(id).title, b = h("button", "tb-pic", C.toSVG(C.render(id, tier), { standalone: true, widthIn: 2, label: "" }));
          b.type = "button"; b.setAttribute("data-id", id); b.setAttribute("aria-label", title + ", a picture to color");
          var sv = b.querySelector("svg"); if (sv) { sv.removeAttribute("width"); sv.removeAttribute("height"); }
          grid.appendChild(b);
        });
        more.innerHTML = '<button type="button" class="tb-btn" data-more="1">More pictures <span aria-hidden="true">▶</span></button>';
        box.appendChild(grid); box.appendChild(more); root.appendChild(box);
        grid.addEventListener("click", function (e) { var b = e.target.closest(".tb-pic"); if (b) { api.unlock(); paintIt(b.getAttribute("data-id")); } });
        more.addEventListener("click", function () { api.unlock(); api.busy(); page++; chooser(); });
        api.hint(function () { Kit.glow(grid.querySelector(".tb-pic"), 3800); });
        api.assist(function () {                                  /* choose the first picture, wait for it to open, and color it */
          var b = grid.querySelector(".tb-pic"), tries = 0; if (b) b.click();
          (function go() { if (finishIt) finishIt(); else if (++tries < 40) api.later(go, 150); })();
        });
        api.say(function () { return "Choose a picture to color: " + show.map(function (id) { return C.design(id).title; }).join(", ") + "."; });
        api.debug(function () { return { stage: "choose", ids: show, all: ids.length }; });
      }
      function paintIt(id) {
        var title = C.design(id).title;
        root.innerHTML = '<p class="tb-big">Getting your picture ready…</p>'; api.progress(title); finishIt = null;
        rasterise(C.toSVG(C.render(id, tier), { standalone: true, widthIn: 6.25, label: "" }), function (img) {
          if (gone) return;
          if (!img) { root.innerHTML = '<p class="tb-big">That picture could not be opened.</p>'; api.later(chooser, 1500); return; }
          var R = T.regions(img.data, CW, CH, 700), inner = [], hist = [], have = [], r;
          for (r = 1; r <= R.count; r++) if (r !== R.bg) inner.push(r);
          root.innerHTML = "";
          var split = h("div", "tb-split tb-colorsplit"), art = h("div", "tb-art"), sheet = h("div", "tb-sheet"), side = h("div", "tb-side tb-colorside");
          var fillCv = h("canvas", "tb-layer"), lineCv = h("canvas", "tb-layer tb-lines"), hintCv = h("canvas", "tb-layer tb-regionglow");
          [fillCv, lineCv, hintCv].forEach(function (c) { c.width = CW; c.height = CH; });
          lineCv.setAttribute("role", "img"); lineCv.setAttribute("aria-label", title + ", a picture to color. Choose a color, then tap a shape.");
          sheet.appendChild(fillCv); sheet.appendChild(lineCv); sheet.appendChild(hintCv); art.appendChild(sheet);
          var fg = fillCv.getContext("2d"), fd = fg.createImageData(CW, CH), hg = hintCv.getContext("2d");
          var ol = lineCv.getContext("2d").createImageData(CW, CH), n = CW * CH, i;
          for (i = 0; i < n; i++) ol.data[i * 4 + 3] = 255 - img.data[i * 4];
          lineCv.getContext("2d").putImageData(ol, 0, 0);
          cp = colorPanel(api, function (c) { fill = c; });
          side.appendChild(h("p", "tb-sub", "Pick a color, then tap a shape")); side.appendChild(cp.el);
          var bar = h("div", "tb-row tb-colorbar");
          bar.innerHTML = '<button type="button" class="tb-btn" data-co="undo"><span aria-hidden="true">↶</span> Undo</button><button type="button" class="tb-btn" data-co="clear">Start over</button><button type="button" class="tb-btn" data-co="pick">Another picture</button>';
          side.appendChild(bar); split.appendChild(art); split.appendChild(side); root.appendChild(split);
          /* the picture is as large as the free space allows, beside the colors (a wide screen) or above them (a tall one) */
          function size() {
            var a = api.area(), tall = window.matchMedia("(orientation:portrait)").matches, ww = tall ? a.w : a.w - side.offsetWidth - 24, hh = tall ? a.h - side.offsetHeight - 16 : a.h - 8;
            var w = Math.max(150, Math.min(ww, hh * 3 / 4)); sheet.style.width = Math.floor(w) + "px"; sheet.style.height = Math.floor(w * 4 / 3) + "px";
          }
          size(); window.requestAnimationFrame(size); api.onResize(size);

          function paintShape(k, hex) {                              /* put a color on one shape (or take it off) */
            var b = R.boxes[k], c = hex ? hexRGB(hex) : [0, 0, 0], a = hex ? 255 : 0, d = fd.data, x, y, p;
            for (y = b[1]; y <= b[3]; y++) for (x = b[0]; x <= b[2]; x++) { p = y * CW + x; if (R.lab[p] === k) { d[p * 4] = c[0]; d[p * 4 + 1] = c[1]; d[p * 4 + 2] = c[2]; d[p * 4 + 3] = a; } }
            fg.putImageData(fd, 0, 0, b[0], b[1], b[2] - b[0] + 1, b[3] - b[1] + 1);
            have[k] = hex || "";
          }
          var count = function () { return inner.filter(function (k) { return have[k]; }).length; };
          function progress() { api.progress(title + " · " + count() + " of " + inner.length + " colored"); }
          function color1(k, hex) {
            hist.push([k, have[k] || ""]); paintShape(k, hex); progress();
            if (inner.length && count() === inner.length) api.later(function () { api.cheer("Your picture is finished. Beautifully colored.", "Another picture"); }, 700);
          }
          lineCv.addEventListener("click", function (e) {
            var b = lineCv.getBoundingClientRect(), x = Math.min(CW - 1, Math.max(0, Math.floor((e.clientX - b.left) / b.width * CW))), y = Math.min(CH - 1, Math.max(0, Math.floor((e.clientY - b.top) / b.height * CH))), k = R.lab[y * CW + x];
            if (!k) return; api.unlock(); api.tick(); api.busy(); color1(k, fill);
          });
          bar.addEventListener("click", function (e) {
            var b = e.target.closest("[data-co]"); if (!b) return; var what = b.getAttribute("data-co"); api.unlock(); api.busy();
            if (what === "undo") { var u = hist.pop(); if (u) paintShape(u[0], u[1]); progress(); }
            if (what === "clear") { Object.keys(have).forEach(function (k) { if (have[k]) { hist.push([+k, have[k]]); paintShape(+k, ""); } }); progress(); }
            if (what === "pick") chooser();
          });
          /* the middle of a shape: the point of it nearest its center, so a tap there is always inside */
          var mid = {};
          function centre(k) {
            if (mid[k]) return mid[k];
            var b = R.boxes[k], sx = 0, sy = 0, c = 0, x, y;
            for (y = b[1]; y <= b[3]; y++) for (x = b[0]; x <= b[2]; x++) if (R.lab[y * CW + x] === k) { sx += x; sy += y; c++; }
            var cx = sx / c, cy = sy / c, best = 1e12, px = cx, py = cy;
            for (y = b[1]; y <= b[3]; y++) for (x = b[0]; x <= b[2]; x++) if (R.lab[y * CW + x] === k) { var dd = (x - cx) * (x - cx) + (y - cy) * (y - cy); if (dd < best) { best = dd; px = x; py = y; } }
            return (mid[k] = [px, py]);
          }
          function glow(k) {
            var b = R.boxes[k], im = hg.createImageData(CW, CH), d = im.data, x, y, p;
            for (y = b[1]; y <= b[3]; y++) for (x = b[0]; x <= b[2]; x++) { p = y * CW + x; if (R.lab[p] === k) { d[p * 4] = 245; d[p * 4 + 1] = 184; d[p * 4 + 2] = 0; d[p * 4 + 3] = 200; } }
            hg.putImageData(im, 0, 0); hintCv.classList.remove("on"); void hintCv.offsetWidth; hintCv.classList.add("on");
            api.later(function () { hg.clearRect(0, 0, CW, CH); hintCv.classList.remove("on"); }, 3900);
          }
          var openOnes = function () { return inner.filter(function (k) { return !have[k]; }); };
          finishIt = function () {
            var cols = cp.colors(), open = openOnes().sort(function (a, b) { var p = centre(a), q = centre(b); return (p[1] - q[1]) || (p[0] - q[0]); }), gap = Math.min(150, 4200 / Math.max(1, open.length));
            open.forEach(function (k, j) { api.later(function () { if (!have[k]) { hist.push([k, ""]); paintShape(k, cols[(j * 3 + 1) % cols.length]); api.tick(); progress(); } }, gap * j); });
            api.later(function () { api.cheer("Your picture is finished. Beautifully colored.", "Another picture"); }, gap * open.length + 900);
          };
          progress();
          api.say(function () { return "Pick a color, then tap a shape to color it."; });
          api.hint(function () { var k = openOnes()[0]; if (k) glow(k); else Kit.glow(cp.pal, 3800); });
          api.assist(finishIt);
          api.debug(function () {
            return { stage: "paint", id: id, shapes: inner.length, filled: count(), bank: cp.bank(), colors: cp.colors(), undo: hist.length, color: fill,
              spots: function () { var b = lineCv.getBoundingClientRect(); return inner.map(function (k) { var c = centre(k); return [b.left + (c[0] + 0.5) / CW * b.width, b.top + (c[1] + 0.5) / CH * b.height, have[k] || "", R.areas[k]]; }); },
              pixel: function (x, y) { var b = lineCv.getBoundingClientRect(), p = Math.floor((y - b.top) / b.height * CH) * CW + Math.floor((x - b.left) / b.width * CW); return [fd.data[p * 4], fd.data[p * 4 + 1], fd.data[p * 4 + 2], fd.data[p * 4 + 3]]; } };
          });
        });
      }
      chooser();
    });
    return function () { gone = true; };
  }

  /* ===================== FINGER PAINT =====================
     A big sheet of paper, thick soft brushes, and no way to get it wrong. Soft, chalk and watercolor brushes lay paint down;
     the blending brush smears what is already there. Undo takes the last stroke back, and Clear can be undone too. */
  var BRUSHES = [["soft", "Soft"], ["chalk", "Chalk"], ["wash", "Wash"], ["blend", "Blend"]], SIZES = [["10", "Fine"], ["24", "Medium"], ["44", "Thick"], ["72", "Wide"]], PAPERS = [["Parchment"], ["Wood"], ["Canvas"], ["White"]];
  function paper(g, w, h, kind) {
    var rnd = seeded(7 + kind * 131), i, x, y, r;
    function blobs(n, rgb, a0, a1, r0, r1) { for (i = 0; i < n; i++) { x = rnd() * w; y = rnd() * h; r = r0 + rnd() * (r1 - r0); var a = a0 + rnd() * (a1 - a0), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(" + rgb + "," + a + ")"); gr.addColorStop(1, "rgba(" + rgb + ",0)"); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } }
    var rgb;
    if (kind === 3) { g.fillStyle = "#ffffff"; g.fillRect(0, 0, w, h); return; }
    if (kind === 0) {                                              // parchment: warm, blotchy, with tiny flecks and darker corners
      g.fillStyle = "#efe0bb"; g.fillRect(0, 0, w, h);
      blobs(150, rgb = "176,132,72", 0.03, 0.08, 40, 170); blobs(90, rgb = "255,248,225", 0.05, 0.1, 40, 150);
      for (i = 0; i < Math.floor(w * h / 900); i++) { g.fillStyle = "rgba(110,80,40," + (0.04 + rnd() * 0.08) + ")"; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
    } else if (kind === 1) {                                       // wood: planks with long wavy grain and a couple of knots
      var planks = 4, ph = h / planks, tint = ["#b07a4c", "#a8714a", "#b88456", "#a36c44"];
      for (var p = 0; p < planks; p++) {
        g.fillStyle = tint[p % tint.length]; g.fillRect(0, p * ph, w, ph);
        for (i = 0; i < 46; i++) { var yy = p * ph + rnd() * ph, amp = 1 + rnd() * 5, fr = 0.004 + rnd() * 0.01, ph0 = rnd() * 6; g.strokeStyle = "rgba(70,40,20," + (0.08 + rnd() * 0.16) + ")"; g.lineWidth = 0.6 + rnd() * 1.8; g.beginPath(); for (x = 0; x <= w; x += 8) { var yv = yy + Math.sin(x * fr + ph0) * amp; if (x) g.lineTo(x, yv); else g.moveTo(x, yv); } g.stroke(); }
        if (rnd() < 0.8) { var kx = rnd() * w, ky = p * ph + ph * (0.3 + rnd() * 0.4); for (r = 3; r < 22; r += 4) { g.strokeStyle = "rgba(70,40,20," + (0.25 - r * 0.008) + ")"; g.lineWidth = 1.5; g.beginPath(); g.ellipse(kx, ky, r * 1.8, r, 0, 0, 6.3); g.stroke(); } }
        g.fillStyle = "rgba(50,28,12,.45)"; g.fillRect(0, p * ph, w, 2);
      }
    } else {                                                       // canvas: a linen weave
      g.fillStyle = "#f1e9d6"; g.fillRect(0, 0, w, h);
      for (x = 0; x < w; x += 4) { g.fillStyle = "rgba(120,100,70," + (0.05 + rnd() * 0.06) + ")"; g.fillRect(x, 0, 1, h); }
      for (y = 0; y < h; y += 4) { g.fillStyle = "rgba(120,100,70," + (0.05 + rnd() * 0.06) + ")"; g.fillRect(0, y, w, 1); }
      blobs(60, rgb = "160,135,95", 0.02, 0.05, 50, 200);
    }
    var vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);       // the paper darkens toward its edges
    vg.addColorStop(0, "rgba(90,60,25,0)"); vg.addColorStop(1, "rgba(90,60,25," + (kind === 1 ? 0.28 : 0.24) + ")"); g.fillStyle = vg; g.fillRect(0, 0, w, h);
  }

  function paint(root, o, api) {
    var prefs = api.prefs, brush = "soft", sizeIx = 1, paperIx = Math.min(3, Math.max(0, prefs.paper || 0)), color = "#f4b6c2", strokes = 0, undo = [], tab = "colors";
    var wrap = h("div", "tb-paintwrap tb-glass"), bg = h("canvas", "tb-pbg"), ink = h("canvas", "tb-paint"), tools = h("div", "tb-ptools tb-glass"), split = h("div", "tb-split tb-paintsplit");
    ink.setAttribute("role", "img"); ink.setAttribute("aria-label", "A sheet of paper to paint on with a finger");
    wrap.appendChild(bg); wrap.appendChild(ink); split.appendChild(wrap); split.appendChild(tools); root.appendChild(split);
    var tabs = h("div", "tb-row tb-ptabs"), body = h("div", "tb-pbody"), acts = h("div", "tb-row tb-pacts");
    tabs.innerHTML = '<button type="button" class="tb-btn" data-tab="colors" aria-pressed="true">Colors</button><button type="button" class="tb-btn" data-tab="brush" aria-pressed="false">Brush</button><button type="button" class="tb-btn" data-tab="paper" aria-pressed="false">Paper</button>';
    acts.innerHTML = '<button type="button" class="tb-btn" data-act="undo"><span aria-hidden="true">↶</span> Undo</button><button type="button" class="tb-btn" data-act="clear">Clear</button>';
    var cp = colorPanel(api, function (c) { color = c; });
    var brushBox = h("div", "tb-pane"), paperBox = h("div", "tb-pane");
    brushBox.innerHTML = '<div class="tb-grid4" role="group" aria-label="Brushes">' + BRUSHES.map(function (b, k) { return '<button type="button" class="tb-btn" data-brush="' + b[0] + '" aria-pressed="' + (k === 0) + '">' + b[1] + "</button>"; }).join("") + '</div><div class="tb-grid4" role="group" aria-label="Brush size">' + SIZES.map(function (s, k) { return '<button type="button" class="tb-btn" data-size="' + k + '" aria-pressed="' + (k === 1) + '">' + s[1] + "</button>"; }).join("") + "</div>";
    paperBox.innerHTML = '<div class="tb-grid4" role="group" aria-label="Paper">' + PAPERS.map(function (p, k) { return '<button type="button" class="tb-btn" data-paper="' + k + '" aria-pressed="' + (k === paperIx) + '">' + p[0] + "</button>"; }).join("") + "</div>";
    var panes = { colors: cp.el, brush: brushBox, paper: paperBox };
    function showTab(t) { tab = t; body.innerHTML = ""; body.appendChild(panes[t]); Array.prototype.forEach.call(tabs.children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-tab") === t)); }); }
    tools.appendChild(tabs); tools.appendChild(body); tools.appendChild(acts); showTab("colors");

    var g = ink.getContext("2d"), bgc = bg.getContext("2d"), dpr = 1, W = 0, H = 0, cache = {}, tmp = document.createElement("canvas"), tg = tmp.getContext("2d");
    function fit() {
      var r = wrap.getBoundingClientRect(), nw = Math.max(200, Math.round(r.width)), nh = Math.max(160, Math.round(r.height));
      if (nw === W && nh === H) return;
      var old = null; if (W) { old = document.createElement("canvas"); old.width = ink.width; old.height = ink.height; old.getContext("2d").drawImage(ink, 0, 0); }
      W = nw; H = nh; dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(1.8e6 / (W * H)));
      ink.width = bg.width = Math.round(W * dpr); ink.height = bg.height = Math.round(H * dpr); cache = {};
      if (old) g.drawImage(old, 0, 0, ink.width, ink.height);
      drawPaper();
    }
    function drawPaper() { bgc.setTransform(1, 0, 0, 1, 0, 0); paper(bgc, bg.width, bg.height, paperIx); }
    /* the marks a brush makes: a stamp for the color and size, laid down along the finger's path */
    function stamp(kind, c, d, v) {
      var key = kind + c + Math.round(d) + (kind === "chalk" ? v : 0); if (cache[key]) return cache[key];
      var s = Math.ceil(d) + 4, cv = document.createElement("canvas"); cv.width = cv.height = s; var x = cv.getContext("2d"), r = d / 2, m = s / 2;
      if (kind === "chalk") {
        var rnd = seeded(31 + v * 17 + Math.round(d)); x.fillStyle = c;
        for (var i = 0; i < d * 1.8; i++) { var a = rnd() * 6.283, rr = Math.sqrt(rnd()) * r; x.globalAlpha = 0.3 + rnd() * 0.7; x.beginPath(); x.arc(m + Math.cos(a) * rr, m + Math.sin(a) * rr, 0.6 + rnd() * (d * 0.04 + 0.8), 0, 6.3); x.fill(); }
      } else {
        var gr = x.createRadialGradient(m, m, r * (kind === "wash" ? 0.0 : 0.12), m, m, r);
        gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(kind === "wash" ? 0.6 : 0.55, rgba(c, kind === "wash" ? 0.75 : 0.88)); gr.addColorStop(1, rgba(c, 0));
        x.fillStyle = gr; x.beginPath(); x.arc(m, m, r, 0, 6.3); x.fill();
      }
      return (cache[key] = cv);
    }
    function dab(px, py, d, n) {
      if (brush === "blend") { return; }
      var st = stamp(brush, color, d, n % 4); g.globalAlpha = brush === "wash" ? 0.16 : 1; g.drawImage(st, px - st.width / 2, py - st.height / 2); g.globalAlpha = 1;
    }
    function smudge(fx, fy, tx, ty, d) {
      var r = Math.max(8, Math.round(d / 2)), s = r * 2; if (tmp.width !== s) tmp.width = tmp.height = s;
      tg.globalCompositeOperation = "source-over"; tg.clearRect(0, 0, s, s); tg.drawImage(ink, Math.round(fx - r), Math.round(fy - r), s, s, 0, 0, s, s);
      tg.globalCompositeOperation = "destination-in"; var gr = tg.createRadialGradient(r, r, r * 0.25, r, r, r); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)"); tg.fillStyle = gr; tg.fillRect(0, 0, s, s);
      g.globalAlpha = 0.6; g.drawImage(tmp, Math.round(tx - r), Math.round(ty - r)); g.globalAlpha = 1;
    }
    function snapshot() { var c = document.createElement("canvas"); c.width = ink.width; c.height = ink.height; c.getContext("2d").drawImage(ink, 0, 0); undo.push(c); if (undo.length > 12) undo.shift(); }
    function restore() { var c = undo.pop(); if (!c) return; g.clearRect(0, 0, ink.width, ink.height); g.drawImage(c, 0, 0, ink.width, ink.height); strokes = Math.max(0, strokes - 1); }
    var last = null, n = 0;
    function strokeTo(x, y, pressure, pen) {
      if (!last) return;
      var d = SIZES[sizeIx][0] * (pen && pressure > 0 ? 0.55 + pressure * 0.9 : 1) * dpr, px = x * dpr, py = y * dpr;
      var dx = px - last.x, dy = py - last.y, dist = Math.hypot(dx, dy), step = Math.max(1, d * (brush === "wash" ? 0.1 : brush === "chalk" ? 0.2 : 0.13)), k = Math.max(1, Math.floor(dist / step));
      for (var i = 1; i <= k; i++) {
        var t = i / k, qx = last.x + dx * t, qy = last.y + dy * t;
        if (brush === "blend") smudge(last.x + dx * (i - 1) / k, last.y + dy * (i - 1) / k, qx, qy, d); else dab(qx, qy, d, n++);
      }
      last = { x: px, y: py };
    }
    var pt = function (e) { var r = ink.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    ink.addEventListener("pointerdown", function (e) {
      if (!e.isPrimary) return;                                      // a resting palm is not a second brush
      api.unlock(); e.preventDefault(); try { ink.setPointerCapture(e.pointerId); } catch (x) { /* mouse */ }
      snapshot(); strokes++; var p = pt(e); last = { x: p[0] * dpr, y: p[1] * dpr }; n = 0; demoOff();
      if (brush !== "blend") dab(last.x, last.y, SIZES[sizeIx][0] * dpr, n++);
    });
    ink.addEventListener("pointermove", function (e) {
      if (!last || !e.isPrimary) return;
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if (!evs.length) evs = [e];
      evs.forEach(function (ev) { var p = pt(ev); strokeTo(p[0], p[1], ev.pressure, ev.pointerType === "pen"); });
    });
    var end = function () { if (last) { last = null; api.busy(); } };
    ink.addEventListener("pointerup", end); ink.addEventListener("pointercancel", end);
    /* the tools */
    tabs.addEventListener("click", function (e) { var b = e.target.closest("[data-tab]"); if (b) { api.unlock(); showTab(b.getAttribute("data-tab")); api.busy(); } });
    brushBox.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return; api.unlock(); api.busy();
      if (b.hasAttribute("data-brush")) { brush = b.getAttribute("data-brush"); Array.prototype.forEach.call(brushBox.querySelectorAll("[data-brush]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); }); }
      if (b.hasAttribute("data-size")) { sizeIx = +b.getAttribute("data-size"); Array.prototype.forEach.call(brushBox.querySelectorAll("[data-size]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); }); }
    });
    paperBox.addEventListener("click", function (e) {
      var b = e.target.closest("[data-paper]"); if (!b) return; api.unlock(); api.busy();
      paperIx = +b.getAttribute("data-paper"); prefs.paper = paperIx; api.savePrefs(); drawPaper();
      Array.prototype.forEach.call(paperBox.querySelectorAll("[data-paper]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    });
    acts.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return; api.unlock(); api.busy();
      if (b.getAttribute("data-act") === "undo") restore();
      else { snapshot(); strokes++; g.clearRect(0, 0, ink.width, ink.height); }     // Clear is a stroke too, so Undo brings the painting back
    });
    /* the quiet-moment hint: a soft dot shows how a finger paints */
    var demo = null;
    function demoOff() { if (demo) { demo.remove(); demo = null; } }
    function showDemo() {
      demoOff(); if (last) return;
      var dot = h("div", "tb-demo"); wrap.appendChild(dot); demo = dot;
      if (reduced() || !dot.animate) { Kit.glow(wrap, 3600); api.later(demoOff, 3600); return; }
      var w = wrap.clientWidth, hh = wrap.clientHeight, keys = [];
      for (var i = 0; i <= 12; i++) { var t = i / 12; keys.push({ transform: "translate(" + (w * (0.2 + 0.6 * t) - 22) + "px," + (hh * (0.5 + 0.18 * Math.sin(t * 6.283)) - 22) + "px)", opacity: i === 0 || i === 12 ? 0 : 0.9 }); }
      dot.animate(keys, { duration: 2600, easing: "ease-in-out" }).onfinish = demoOff;
    }
    fit(); api.onResize(fit); api.progress("");
    api.say(function () { return "Choose a color and paint with your finger."; });
    api.hint(showDemo);
    api.assist(function () {
      demoOff(); var cols = cp.colors(), cur0 = sizeIx; sizeIx = 2; brush = "soft"; snapshot(); strokes++;
      [0.3, 0.5, 0.7].forEach(function (fy, k) {
        color = cols[(k * 3 + 1) % cols.length];
        var pts = []; for (var j = 0; j <= 34; j++) pts.push([W * (0.1 + 0.8 * j / 34), H * (fy + 0.09 * Math.sin(j / 34 * 6.283 * (k + 1)))]);
        pts.forEach(function (p, j) { api.later(function () { color = cols[(k * 3 + 1) % cols.length]; if (!j) last = { x: p[0] * dpr, y: p[1] * dpr }; else strokeTo(p[0], p[1], 0, false); if (j === pts.length - 1) last = null; }, k * 1000 + j * 24); });
      });
      api.later(function () { sizeIx = cur0; api.cheer("What a lovely painting!", "Paint again"); }, 3900);
    });
    api.debug(function () {
      return { strokes: strokes, demo: !!demo, undo: undo.length, brush: brush, size: +SIZES[sizeIx][0], paper: paperIx, tab: tab, canvas: ink, ink: function (x, y) { return Array.prototype.slice.call(g.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data); }, bgPixel: function (x, y) { return Array.prototype.slice.call(bgc.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data); }, cssSize: [W, H], color: color };
    });
  }

  /* ===================== BUBBLE POP =====================
     Bubbles drift up the screen, bump each other gently, and pop with a soft chime and a ripple of color that nudges their neighbors.
     Nothing is counted. Slower and Faster change how quickly they float; people who ask for less motion get still bubbles. */
  var SPEEDS = [["Very slow", 12], ["Gentle", 22], ["Brisk", 38], ["Lively", 60]], BUB = ["#e58aa5", "#e0b43a", "#66b88a", "#9a7bd0", "#f0956a", "#3fa7a0"], NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  function bubbles(root, o, api) {
    var late = o.stage === "late", still = reduced(), speed = Math.min(4, Math.max(1, api.prefs.speed || 2)), cv = h("canvas", "tb-sky"), ctrl = h("div", "tb-row tb-speedrow"), msg = h("p", "tb-msg", "Tap a bubble to pop it. Take your time, and pop as many as you like.");
    ctrl.innerHTML = '<button type="button" class="tb-btn" data-speed="-1"><span aria-hidden="true">−</span> Slower</button><span class="tb-speed" id="tbSpeedLbl"></span><button type="button" class="tb-btn" data-speed="1">Faster <span aria-hidden="true">+</span></button>';
    cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "Bubbles drifting up the screen. Tap a bubble to pop it.");
    root.appendChild(cv); root.appendChild(ctrl); root.appendChild(msg);
    var g = cv.getContext("2d"), W = 300, H = 300, dpr = 1, list = [], ripples = [], drops = [], raf = 0, last = 0, clock = 0, popped = 0, ending = false, hintB = null, hintAt = -9, rnd = seeded(hashOf(o.seed + "/bubbles")), maxN = late ? 5 : 8;
    var tbt = parseFloat(getComputedStyle(byId("tb")).getPropertyValue("--tbt")) || 72, minR = Math.max(40, tbt * 0.7), maxR = minR + (late ? 34 : 26);
    function fit() { var r = cv.getBoundingClientRect(); W = Math.max(200, Math.round(r.width)); H = Math.max(200, Math.round(r.height)); dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    function label() { byId("tbSpeedLbl").textContent = "Float: " + SPEEDS[speed - 1][0]; ctrl.querySelector('[data-speed="-1"]').disabled = speed <= 1; ctrl.querySelector('[data-speed="1"]').disabled = speed >= 4; }
    function spawn(anywhere) {
      var r = minR + rnd() * (maxR - minR), b = { x: r + rnd() * Math.max(10, W - 2 * r), y: anywhere || still ? r + 20 + rnd() * Math.max(10, H - 2 * r - 40) : H + r + 6, r: r, vy: 0.75 + rnd() * 0.5, ph: rnd() * 6.28, c: BUB[Math.floor(rnd() * BUB.length)], vx: 0, born: clock };
      list.push(b); return b;
    }
    function popIt(b) {
      var i = list.indexOf(b); if (i < 0) return; list.splice(i, 1); popped++;
      var note = NOTES[Math.max(0, Math.min(NOTES.length - 1, Math.round((maxR - b.r) / (maxR - minR) * (NOTES.length - 1))))];
      api.tone([note, note * 1.5], 0.06, 0.7, 0.07);
      ripples.push({ x: b.x, y: b.y, r: b.r, t: 0, c: b.c });
      if (!still) for (var k = 0; k < 12; k++) { var a = rnd() * 6.283, sp = 60 + rnd() * 140; drops.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, t: 0, c: b.c, r: 3 + rnd() * 4 }); }
      list.forEach(function (n2) { var dx = n2.x - b.x, dy = n2.y - b.y, d = Math.hypot(dx, dy) || 1; if (d < b.r * 3.2) { var f = (1 - d / (b.r * 3.2)) * 90; n2.vx += dx / d * f; n2.y += dy / d * f * 0.05; } });
      if (still && !ending) api.later(function () { spawn(true); }, 700);
    }
    function frame(ts) {
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts; clock += dt;
      var base = SPEEDS[speed - 1][1];
      if (!still) {
        list.forEach(function (b) { b.y -= base * b.vy * dt; b.vx *= Math.pow(0.2, dt); b.x += (Math.sin(clock * 0.8 + b.ph) * 10 + b.vx) * dt; if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); } if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); } });
        for (var i = 0; i < list.length; i++) for (var j = i + 1; j < list.length; j++) {         // bubbles bump softly and slide past each other
          var a = list[i], b2 = list[j], dx = b2.x - a.x, dy = b2.y - a.y, d = Math.hypot(dx, dy), min = a.r + b2.r;
          if (d < min && d > 0.01) { var push = (min - d) * 0.5, nx = dx / d, ny = dy / d; a.x -= nx * push * 0.5; a.y -= ny * push * 0.25; b2.x += nx * push * 0.5; b2.y += ny * push * 0.25; a.vx -= nx * 4; b2.vx += nx * 4; }
        }
        for (var k = list.length - 1; k >= 0; k--) if (list[k].y < -list[k].r - 10) list.splice(k, 1);
        if (!ending && list.length < maxN && rnd() < dt * 1.5) spawn(false);
      }
      draw(dt); raf = requestAnimationFrame(frame);
    }
    function draw(dt) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      list.forEach(function (b) {
        var gr = g.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.08, b.x, b.y, b.r);
        gr.addColorStop(0, "rgba(255,255,255,.92)"); gr.addColorStop(0.5, rgba(b.c, 0.12)); gr.addColorStop(1, rgba(b.c, 0.4));
        g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.283); g.fill();
        g.strokeStyle = rgba(b.c, 0.95); g.lineWidth = 5; g.stroke();
        g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath(); g.arc(b.x, b.y, b.r * 0.72, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
        if (hintB === b && clock - hintAt < 3.6) { var pulse = still ? 0 : (Math.sin(clock * 7) + 1) / 2; g.strokeStyle = "rgba(245,184,0," + (0.55 + pulse * 0.4) + ")"; g.lineWidth = 10 + pulse * 6; g.beginPath(); g.arc(b.x, b.y, b.r + 10, 0, 6.283); g.stroke(); }
      });
      for (var i = ripples.length - 1; i >= 0; i--) {
        var rp = ripples[i]; rp.t += dt; var f = rp.t / (still ? 0.4 : 0.8); if (f >= 1) { ripples.splice(i, 1); continue; }
        [0, 0.18].forEach(function (lag) { var ff = Math.max(0, f - lag); if (ff <= 0) return; g.strokeStyle = rgba(rp.c, (1 - ff) * 0.8); g.lineWidth = 6 * (1 - ff) + 1; g.beginPath(); g.arc(rp.x, rp.y, rp.r * (1 + ff * 1.4), 0, 6.283); g.stroke(); });
      }
      for (var j = drops.length - 1; j >= 0; j--) { var d = drops[j]; d.t += dt; if (d.t > 0.7) { drops.splice(j, 1); continue; } d.vy += 220 * dt; d.x += d.vx * dt; d.y += d.vy * dt; g.fillStyle = rgba(d.c, 1 - d.t / 0.7); g.beginPath(); g.arc(d.x, d.y, d.r * (1 - d.t / 1.4), 0, 6.283); g.fill(); }
    }
    cv.addEventListener("pointerdown", function (e) {
      api.unlock(); e.preventDefault(); api.busy();
      var r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, hit = null;
      for (var i = list.length - 1; i >= 0; i--) { var b = list[i]; if (Math.hypot(x - b.x, y - b.y) <= b.r + 14) { hit = b; break; } }
      if (hit) popIt(hit); else ripples.push({ x: x, y: y, r: 8, t: 0.2, c: "#c5a059" });
    });
    ctrl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-speed]"); if (!b || b.disabled) return; api.unlock(); api.busy();
      speed = Math.min(4, Math.max(1, speed + (+b.getAttribute("data-speed")))); api.prefs.speed = speed; api.savePrefs(); label();
    });
    fit(); api.onResize(function () { fit(); list.forEach(function (b) { b.x = Math.min(b.x, W - b.r); }); }); label();
    for (var k = 0; k < (still ? maxN - 2 : 5); k++) spawn(true);
    raf = requestAnimationFrame(frame);
    api.progress(""); api.say(function () { return "Tap the bubbles to pop them."; });
    api.hint(function () { hintB = list[Math.floor(rnd() * list.length)] || null; hintAt = clock; });
    api.assist(function () {
      ending = true;
      list.slice().forEach(function (b, k2) { api.later(function () { popIt(b); }, 170 * k2); });
      api.later(function () { api.cheer("Every bubble has floated away.", "More bubbles"); }, 170 * list.length + 1000);
    });
    api.debug(function () {
      return { seed: o.seed, hintOn: function () { return !!hintB && clock - hintAt < 3.6; }, count: function () { return list.length; }, popped: function () { return popped; }, speed: speed, minDiameter: minR * 2,
        centers: function () { var r = cv.getBoundingClientRect(); return list.map(function (b) { return [r.left + b.x, r.top + b.y, b.r * 2]; }); } };
    });
    return function () { cancelAnimationFrame(raf); };
  }

  Kit.register({
    id: "trace", group: 1, order: 1, title: "Trace the Path", blurb: "Slide along the glowing path. Take your time.",
    icon: '<path d="M8 46C16 10 28 10 32 32S48 58 56 20"/><circle cx="8" cy="46" r="5"/><circle cx="56" cy="20" r="5"/>', start: trace
  });

  Kit.register({
    id: "color", group: 1, order: 2, title: "Color a Picture", blurb: "Pick a color, tap a shape.",
    icon: '<path d="M32 8C16 8 6 20 6 32s10 24 22 24c6 0 6-6 2-10s0-8 6-8h12c6 0 10-4 10-10C58 16 46 8 32 8z"/><circle cx="20" cy="28" r="3"/><circle cx="32" cy="20" r="3"/><circle cx="44" cy="26" r="3"/>', start: color
  });
  Kit.register({
    id: "paint", group: 1, order: 3, title: "Finger Paint", blurb: "Paint freely with colors.",
    icon: '<path d="M10 54c8 0 12-4 12-10l26-28 6 6-28 26c-2 8-8 12-16 6z"/>', start: paint
  });
  Kit.register({
    id: "bubbles", group: 1, order: 4, title: "Bubbles", blurb: "Tap the drifting bubbles. Calm and gentle.",
    icon: '<circle cx="22" cy="40" r="14"/><circle cx="46" cy="22" r="9"/><circle cx="46" cy="48" r="6"/>', start: bubbles
  });
})();
