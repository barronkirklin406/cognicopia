/* =====================================================================
   Cognicopia Tablet Activities: think, match and listen.

   Sights and Sounds (here), and the sorting, ordering and matching
   activities that follow it. Each registers itself with the kit
   (js/tabletKit.js) and is started by the screen (js/tablet.js).

   Calm by design: nothing is scored or timed, a card that does not fit
   floats gently back, and every activity can be finished for the person.
   ===================================================================== */
(function () {
  "use strict";
  var Kit = window.CognicopiaTabletKit, T = window.CognicopiaTablet, Art = window.CognicopiaTabletArt, Snd = window.CognicopiaTabletSound;
  if (!Kit || !T || !Art) return;
  var h = Kit.h, esc = Kit.esc, reduced = Kit.reduced;

  /* ===================== SIGHTS AND SOUNDS =====================
     A board of pictures. Touch one and its sound plays, drawn as a moving wave. Or choose "Which one is it?": a sound plays,
     and the picture that goes with it is the one to touch. A picture that is not the one plays its own sound, so nothing is
     lost by trying; after a couple of tries, or a quiet moment, the right picture glows. */
  function sounds(root, o, api) {
    var board = T.soundBoard(o), cards = board.cards, byId = {}, heard = {}, nHeard = 0, mode = "listen", synth = null, playing = null, raf = 0, round = 0, misses = 0, finishing = false;
    cards.forEach(function (c) { byId[c.id] = c; });
    api.used(cards.map(function (c) { return c.id; }));

    var box = h("div", "tb-wavebox tb-glass"), wv = h("canvas", "tb-wave"), status = h("p", "", "Touch a picture to hear it.");
    wv.setAttribute("role", "img"); wv.setAttribute("aria-label", "A moving wave that shows the sound as it plays");
    box.appendChild(wv); box.appendChild(status);
    var modes = h("div", "tb-modes");
    modes.innerHTML = '<button type="button" class="tb-btn" data-mode="listen" aria-pressed="true">Just listen</button><button type="button" class="tb-btn" data-mode="find" aria-pressed="false">Which one is it?</button><button type="button" class="tb-btn" id="tbSndAgain" hidden>Hear it again</button><button type="button" class="tb-btn go" id="tbSndOn" hidden>Turn sound on</button>';
    var grid = h("div", "tb-sounds"); grid.style.setProperty("--cols", cards.length === 4 ? 2 : 3);
    grid.innerHTML = cards.map(function (c) { return '<button type="button" class="tb-snd" data-snd="' + c.id + '" aria-label="' + esc(c.name) + '">' + Art.img(c.id, { size: 96 }) + "<span>" + esc(c.name) + "</span></button>"; }).join("");
    root.appendChild(box); root.appendChild(modes); root.appendChild(grid);

    var say = function (t) { status.textContent = t; api.live(t); };
    var cardEl = function (id) { return grid.querySelector('[data-snd="' + id + '"]'); };
    var target = function () { return board.targets[round]; };

    /* ----- the sound itself ----- */
    function ready() {
      if (!Snd) { say("This device cannot play these sounds."); return false; }
      if (!api.soundOn()) { $on(true); say("Sound is turned off. Turn it on to listen."); return false; }
      var ctx = api.audio(); if (!ctx) { say("This device cannot play these sounds."); return false; }
      if (!synth) synth = Snd.create(ctx);
      return true;
    }
    var $on = function (show) { var b = modes.querySelector("#tbSndOn"); b.hidden = !show; };
    function stop() { if (playing) { try { playing.h.stop(); } catch (e) { /* silent already */ } } playing = null; Array.prototype.forEach.call(grid.children, function (b) { b.classList.remove("is-playing"); }); }
    /* play a sound; ms (optional) stops it early, softly */
    function play(id, ms) {
      if (!ready()) return null;
      stop(); $on(false);
      var hnd = synth.play(id); if (!hnd) return null;
      playing = { id: id, h: hnd, until: hnd.duration };
      var el = cardEl(id); if (el) el.classList.add("is-playing");
      if (ms) api.later(function () { if (playing && playing.h === hnd) stop(); }, ms);
      api.later(function () { if (playing && playing.h === hnd) stop(); }, hnd.duration * 1000 + 400);
      return hnd;
    }

    /* ----- the moving wave ----- */
    var bars = [], prev = [];
    function drawWave(ts) {
      var r = wv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(100, Math.round(r.width)), hh = Math.max(60, Math.round(r.height));
      if (wv.width !== Math.round(w * dpr) || wv.height !== Math.round(hh * dpr)) { wv.width = Math.round(w * dpr); wv.height = Math.round(hh * dpr); }
      var c2 = wv.getContext("2d"); c2.setTransform(dpr, 0, 0, dpr, 0, 0); c2.clearRect(0, 0, w, hh);
      var n = Math.max(24, Math.floor(w / 14)), mid = hh / 2, data = null, t = ts / 1000;
      if (synth && playing) { data = new Uint8Array(synth.analyser.fftSize); synth.analyser.getByteTimeDomainData(data); }
      c2.strokeStyle = "rgba(27,56,43,.35)"; c2.lineWidth = 2; c2.beginPath(); c2.moveTo(0, mid); c2.lineTo(w, mid); c2.stroke();
      c2.lineCap = "round"; c2.lineWidth = 7;
      for (var k = 0; k < n; k++) {
        var amp;
        if (data) { var a = Math.floor(k * data.length / n), b = Math.floor((k + 1) * data.length / n), m = 0; for (var q = a; q < b; q++) m = Math.max(m, Math.abs(data[q] - 128)); amp = Math.min(1, m / 96); }
        else amp = reduced() ? 0.04 : 0.05 + 0.03 * Math.sin(t * 1.6 + k * 0.5);
        prev[k] = prev[k] == null ? amp : prev[k] + (amp - prev[k]) * 0.35;                // smooth, so the wave flows
        var half = Math.max(3, prev[k] * (hh * 0.46)), x = (k + 0.5) * (w / n);
        c2.strokeStyle = data ? "rgba(197,160,89,.45)" : "rgba(197,160,89,.25)"; c2.lineWidth = 12; c2.beginPath(); c2.moveTo(x, mid - half); c2.lineTo(x, mid + half); c2.stroke();
        c2.strokeStyle = data ? "#2d5a44" : "rgba(45,90,68,.6)"; c2.lineWidth = 6; c2.beginPath(); c2.moveTo(x, mid - half); c2.lineTo(x, mid + half); c2.stroke();
      }
      raf = requestAnimationFrame(drawWave);
    }
    raf = requestAnimationFrame(drawWave);

    /* ----- listen mode ----- */
    function heardIt(id) {
      if (heard[id]) return; heard[id] = true; nHeard++;
      var el = cardEl(id); if (el) el.classList.add("is-heard");
      api.progress(nHeard + " of " + cards.length + " heard");
      if (nHeard === cards.length) { finishing = true; var ms = Math.min((playing ? playing.until : 2) * 1000, 3500); api.later(function () { stop(); api.cheer("You have listened to every sound.", "Listen to more"); }, ms + 300); }
    }
    /* ----- "which one is it?" ----- */
    function ask() {
      var id = target(); if (!id) return;
      misses = 0; Array.prototype.forEach.call(grid.children, function (b) { b.classList.remove("is-right"); });
      api.progress("Sound " + (round + 1) + " of " + board.targets.length);
      say("Listen. Which picture goes with this sound?");
      api.later(function () { if (mode === "find") play(id); }, 500);
    }
    function pick(id) {
      if (finishing) return;
      if (mode === "listen") { var hnd = play(id); if (!hnd) return; say(byId[id].name + ". " + byId[id].line); heardIt(id); return; }
      if (id === target()) {
        var el = cardEl(id); el.classList.add("is-right"); api.chime(false); say("Yes, that is the " + byId[id].name.toLowerCase() + ". " + api.praise());
        round++;
        if (round >= board.targets.length) { finishing = true; api.later(function () { stop(); api.cheer("Every sound is matched.", "Listen to more"); }, 1500); }
        else api.later(ask, 1700);
      } else {
        misses++; play(id, 2200); say("That one is the " + byId[id].name.toLowerCase() + ". Listen again for the one we want."); api.soft();
        api.later(function () { if (mode === "find" && !finishing) { play(target()); if (misses >= 2) Kit.glow(cardEl(target())); } }, 2600);
      }
    }
    grid.addEventListener("click", function (e) { var b = e.target.closest("[data-snd]"); if (b) { api.unlock(); api.busy(); pick(b.getAttribute("data-snd")); } });
    modes.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return; api.unlock(); api.busy();
      if (b.id === "tbSndOn") { api.setSound(true); $on(false); say("Sound is on. Touch a picture to hear it."); return; }
      if (b.id === "tbSndAgain") { if (target()) play(target()); return; }
      var m = b.getAttribute("data-mode"); if (!m || m === mode || finishing) return;
      mode = m; stop();
      Array.prototype.forEach.call(modes.querySelectorAll("[data-mode]"), function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-mode") === mode)); });
      modes.querySelector("#tbSndAgain").hidden = mode !== "find";
      if (mode === "find") { round = 0; ask(); } else { say("Touch a picture to hear it."); api.progress(nHeard + " of " + cards.length + " heard"); }
    });
    if (!api.soundOn()) { $on(true); say("Sound is turned off. Turn it on to listen."); }
    api.progress("0 of " + cards.length + " heard");
    api.say(function () { return mode === "find" ? "Listen to the sound, then touch the picture that goes with it." : "Touch a picture to hear its sound. The pictures are " + cards.map(function (c) { return c.name.toLowerCase(); }).join(", ") + "."; });
    api.hint(function () {
      if (finishing) return;
      if (mode === "find") { Kit.glow(cardEl(target())); play(target()); return; }
      var next = cards.filter(function (c) { return !heard[c.id]; })[0]; if (next) Kit.glow(cardEl(next.id));
    });
    api.assist(function () {
      finishing = true; stop();
      var list = mode === "find" ? board.targets.slice(round) : cards.filter(function (c) { return !heard[c.id]; }).map(function (c) { return c.id; });
      if (mode === "find" && list.length) { var t0 = cardEl(list[0]); if (t0) t0.classList.add("is-right"); play(list[0], 1800); }
      list.forEach(function (id, k) { api.later(function () { var el = cardEl(id); if (el) { el.classList.add("is-heard"); Kit.glow(el, 900); } api.tick(); }, 350 * k); });
      say("Here are the sounds.");
      api.later(function () { stop(); api.cheer(mode === "find" ? "Every sound is matched." : "You have listened to every sound.", "Listen to more"); }, 350 * list.length + 1600);
    });
    api.debug(function () {
      var peak = 0; if (synth && playing) { var d = new Uint8Array(synth.analyser.fftSize); synth.analyser.getByteTimeDomainData(d); for (var i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i] - 128)); }
      return { mode: mode, cards: cards.map(function (c) { return c.id; }), heard: Object.keys(heard), playing: playing ? playing.id : null, target: target() || null, round: round, rounds: board.targets.length, misses: misses, peak: peak, finishing: finishing };
    });
    return function () { cancelAnimationFrame(raf); stop(); if (synth) { try { synth.stopAll(); } catch (e) { /* done */ } } };
  }

  Kit.register({
    id: "sounds", group: 2, order: 5, title: "Sights and Sounds", blurb: "Touch a picture and listen to its sound.",
    icon: '<path d="M6 32h4M16 20v24M26 10v44M36 22v20M46 14v36M56 28v8"/>', start: sounds
  });
})();
