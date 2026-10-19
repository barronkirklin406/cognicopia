/* =====================================================================
   Cognicopia Tablet Activities: the shared kit.

   The small things every activity uses: making an element, a card that
   glides to where it belongs, dragging with a finger (or tapping, or the
   Enter key), a soft glow for a hint. It also keeps the list of activities
   the menu is built from: each activity file registers itself here and the
   screen (js/tablet.js) reads the list.

   No screen of its own, no storage, no network.
   ===================================================================== */
(function (root) {
  "use strict";
  var Kit = root.CognicopiaTabletKit = root.CognicopiaTabletKit || {};
  var found = [];

  Kit.h = function (tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  Kit.esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  Kit.reduced = function () { return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches); };
  Kit.LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  /* "APPLE" -> "Apple" */
  Kit.cap = function (w) { w = String(w); return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); };

  /* ---------- the list of activities the menu is built from ----------
     def: { id, group (0 words, 1 hands-on, 2 think), order, title, blurb, icon (svg path markup, 64 x 64), start(root, opts, api) } */
  Kit.register = function (def) {
    if (!def || !def.id || !def.title || typeof def.start !== "function") throw new Error("an activity needs an id, a title and a start function");
    found = found.filter(function (d) { return d.id !== def.id; });
    found.push(def);
  };
  Kit.registered = function () { return found.slice().sort(function (a, b) { return (a.group - b.group) || ((a.order || 0) - (b.order || 0)); }); };

  /* ---------- a soft glow: the hint every activity gives after a quiet moment ---------- */
  Kit.glow = function (el, ms) {
    if (!el) return function () { /* nothing to glow */ };
    el.classList.remove("tb-glow"); void el.offsetWidth; el.classList.add("tb-glow");
    var t = setTimeout(off, ms || 4000);
    function off() { clearTimeout(t); el.classList.remove("tb-glow"); }
    return off;
  };

  /* ---------- moving an element to a new place in the page, gliding there from where it was (FLIP) ---------- */
  Kit.flip = function (el, mutate, ms) {
    var a = el.getBoundingClientRect();
    mutate();
    if (Kit.reduced() || !el.animate) return;
    var b = el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (!dx && !dy) return;
    el.style.zIndex = "60";
    var an = el.animate([{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }], { duration: ms || 420, easing: "cubic-bezier(.22,.9,.3,1)" });
    an.onfinish = an.oncancel = function () { el.style.zIndex = ""; };
  };
  /* the same, for a card that was being dragged (its inline transform is dropped first, so the glide starts where the finger let go) */
  Kit.settle = function (el, mutate, ms) {
    var a = el.getBoundingClientRect();
    el.style.transition = "none"; el.style.transform = ""; el.classList.remove("is-drag", "is-over");
    mutate();
    if (Kit.reduced() || !el.animate) return;
    var b = el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (!dx && !dy) return;
    el.style.zIndex = "60";
    var an = el.animate([{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }], { duration: ms || 420, easing: "cubic-bezier(.22,.9,.3,1)" });
    an.onfinish = an.oncancel = function () { el.style.zIndex = ""; };
  };
  /* a card that is not right for that place floats gently back to where it was: no shake, no red */
  Kit.glideHome = function (el) {
    if (Kit.reduced()) { el.style.transform = ""; el.classList.remove("is-drag", "is-over"); return; }
    el.style.transition = "transform .55s cubic-bezier(.22,.9,.3,1)"; el.style.transform = "";
    var done = function () { el.style.transition = ""; el.classList.remove("is-drag", "is-over"); el.removeEventListener("transitionend", done); };
    el.addEventListener("transitionend", done); setTimeout(done, 700);
  };
  /* a tap that did not fit: the card rises a little and settles again */
  Kit.bob = function (el) {
    if (Kit.reduced() || !el.animate) return;
    el.animate([{ transform: "translateY(0)" }, { transform: "translateY(-12px)" }, { transform: "translateY(0)" }], { duration: 520, easing: "ease-in-out" });
  };

  /* ---------- dragging with a finger, tapping, or the Enter key ----------
     host      the element that holds the cards (events are handled once, here)
     opts.pick(target)        -> the card for whatever was touched, or null
     opts.targets()           -> the elements a card may be dropped on
     opts.drop(card, target)  -> true when the card was accepted (the caller moves it, with Kit.settle); false sends it gliding home
     opts.tap(card)           -> a tap, or Enter or Space on the card
     opts.magnet              how many pixels away a place still pulls a card toward it (default 90) */
  Kit.dragger = function (host, opts) {
    var st = null, hush = false, slop = 10, magnet = opts.magnet == null ? 90 : opts.magnet;
    function targetAt(x, y, card) {
      var ts = (opts.targets && opts.targets()) || [], best = null, bd = Infinity;
      for (var i = 0; i < ts.length; i++) {
        var r = ts[i].getBoundingClientRect(); if (!r.width) continue;
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return ts[i];
        var dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom), d = Math.hypot(dx, dy);
        if (d < bd && d <= magnet) { bd = d; best = ts[i]; }
      }
      return best;
    }
    function lightUp(t) { (opts.targets && opts.targets() || []).forEach(function (x) { x.classList.toggle("is-over", x === t); }); }
    host.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button > 0) return;
      var card = opts.pick(e.target); if (!card || card.disabled || card.getAttribute("aria-disabled") === "true") return;
      e.preventDefault();
      try { card.setPointerCapture(e.pointerId); } catch (x) { /* mouse or an old browser */ }
      st = { card: card, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
    });
    host.addEventListener("pointermove", function (e) {
      if (!st || e.pointerId !== st.id) return;
      var dx = e.clientX - st.x0, dy = e.clientY - st.y0;
      if (!st.moved && Math.hypot(dx, dy) < slop) return;
      if (!st.moved) { st.moved = true; st.card.style.transition = "none"; st.card.classList.add("is-drag"); if (opts.lift) opts.lift(st.card); }
      st.card.style.transform = "translate(" + dx + "px," + dy + "px) scale(1.06)";
      lightUp(targetAt(e.clientX, e.clientY, st.card));
    });
    function release(e, cancelled) {
      if (!st || e.pointerId !== st.id) return;
      var s = st; st = null;
      if (!s.moved) return;                                   // a tap: the click that follows handles it
      hush = true; setTimeout(function () { hush = false; }, 60);
      var t = cancelled ? null : targetAt(e.clientX, e.clientY, s.card);
      lightUp(null);
      if (t && opts.drop(s.card, t)) return;
      Kit.glideHome(s.card);
      if (opts.miss) opts.miss(s.card, t);
    }
    host.addEventListener("pointerup", function (e) { release(e, false); });
    host.addEventListener("pointercancel", function (e) { release(e, true); });
    host.addEventListener("click", function (e) {
      var card = opts.pick(e.target); if (!card) return;
      if (hush) { e.stopPropagation(); e.preventDefault(); return; }
      if (card.disabled || card.getAttribute("aria-disabled") === "true") return;
      if (opts.tap) opts.tap(card, e);
    });
  };

  /* a number of things, one after another, a moment apart (the caller's timer keeps them from running after the screen is closed) */
  Kit.stagger = function (later, list, gap, fn, done) {
    list.forEach(function (x, i) { later(function () { fn(x, i); }, i * gap); });
    if (done) later(done, list.length * gap + 250);
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
