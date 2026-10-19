/* =====================================================================
   Cognicopia Tablet Activities: the hands-on ones.

   Trace the Path (here), and the creative activities that follow it.
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

  Kit.register({
    id: "trace", group: 1, order: 1, title: "Trace the Path", blurb: "Slide along the glowing path. Take your time.",
    icon: '<path d="M8 46C16 10 28 10 32 32S48 58 56 20"/><circle cx="8" cy="46" r="5"/><circle cx="56" cy="20" r="5"/>', start: trace
  });
})();
