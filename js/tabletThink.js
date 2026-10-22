/* =====================================================================
   Cognicopia Tablet Activities: think, match and listen.

   Sort It, Put It in Order, Match the Clue, Odd One Out and Sights and Sounds. Each registers itself with the kit
   (js/tabletKit.js) and is started by the screen (js/tablet.js).

   Calm by design: nothing is scored or timed, a card that does not fit
   floats gently back, and every activity can be finished for the person.
   ===================================================================== */
(function () {
  "use strict";
  var Kit = window.CognicopiaTabletKit, T = window.CognicopiaTablet, Art = window.CognicopiaTabletArt, Snd = window.CognicopiaTabletSound;
  if (!Kit || !T || !Art) return;
  var h = Kit.h, esc = Kit.esc, reduced = Kit.reduced, byId = function (id) { return document.getElementById(id); };

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
      c2.strokeStyle = "rgba(14,60,67,.35)"; c2.lineWidth = 2; c2.beginPath(); c2.moveTo(0, mid); c2.lineTo(w, mid); c2.stroke();
      c2.lineCap = "round"; c2.lineWidth = 7;
      for (var k = 0; k < n; k++) {
        var amp;
        if (data) { var a = Math.floor(k * data.length / n), b = Math.floor((k + 1) * data.length / n), m = 0; for (var q = a; q < b; q++) m = Math.max(m, Math.abs(data[q] - 128)); amp = Math.min(1, m / 96); }
        else amp = reduced() ? 0.04 : 0.05 + 0.03 * Math.sin(t * 1.6 + k * 0.5);
        prev[k] = prev[k] == null ? amp : prev[k] + (amp - prev[k]) * 0.35;                // smooth, so the wave flows
        var half = Math.max(3, prev[k] * (hh * 0.46)), x = (k + 0.5) * (w / n);
        c2.strokeStyle = data ? "rgba(197,160,89,.45)" : "rgba(197,160,89,.25)"; c2.lineWidth = 12; c2.beginPath(); c2.moveTo(x, mid - half); c2.lineTo(x, mid + half); c2.stroke();
        c2.strokeStyle = data ? "#1c5963" : "rgba(45,90,68,.6)"; c2.lineWidth = 6; c2.beginPath(); c2.moveTo(x, mid - half); c2.lineTo(x, mid + half); c2.stroke();
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


  /* ---------- pictures that go together: how big a card may be, so a whole row fits without scrolling ---------- */
  function cardSize(api, n, lo, hi, side) {
    var a = api.area(); return Math.max(lo, Math.min(hi, Math.floor((a.w - (side || 56)) / n - 16)));
  }
  var thingHtml = function (art, word, size) { return Art.img(art, size ? { size: size } : {}) + "<span>" + esc(word) + "</span>"; };
  var middleOf = function (el) { var r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };

  /* ===================== SORT IT =====================
     Two baskets, each with a picture, and a tray of pictures. Drag a picture to the basket it goes with, or touch the picture and
     then the basket. A picture that goes in the other basket floats gently back, with a soft note and a word about where it
     does go; the right basket glows. Nothing is counted against anyone. */
  function sort(root, o, api) {
    var d = T.sortIt(o), total = d.items.length, placed = 0, picked = null, wrong = 0;
    api.used(d.groups.map(function (g) { return g.id; }));
    var wrap = h("div", "tb-sortwrap"), bins = h("div", "tb-bins"), tray = h("div", "tb-tray tb-glass"), msg = h("p", "tb-msg", "Touch a picture, then the basket it goes with.");
    d.groups.forEach(function (g, k) {
      var b = h("div", "tb-bin tb-glass", '<button type="button" class="tb-binhead">' + Art.img(g.cover, { size: 56 }) + "<b>" + esc(g.label) + '</b></button><div class="tb-binput"></div>');
      b.setAttribute("data-g", k); b.setAttribute("role", "group"); b.setAttribute("aria-label", g.label); bins.appendChild(b);
    });
    d.items.forEach(function (it, k) {
      var c = h("button", "tb-thing", thingHtml(it.art, it.word)); c.type = "button"; c.setAttribute("data-i", k); c.setAttribute("aria-pressed", "false"); tray.appendChild(c);
    });
    wrap.appendChild(bins); wrap.appendChild(tray); wrap.appendChild(msg); root.appendChild(wrap);
    function size() { wrap.style.setProperty("--thing", cardSize(api, total, 88, 150) + "px"); }
    size(); api.onResize(size);
    var binOf = function (g) { return bins.children[g]; }, cardOf = function (k) { return tray.querySelector('[data-i="' + k + '"]'); };
    var open = function () { return Array.prototype.slice.call(root.querySelectorAll(".tb-thing:not(.is-placed)")); };
    function pick(card) {
      if (picked) { picked.classList.remove("is-picked"); picked.setAttribute("aria-pressed", "false"); }
      picked = card === picked ? null : card;
      if (picked) { picked.classList.add("is-picked"); picked.setAttribute("aria-pressed", "true"); }
      api.tick();
    }
    function put(card, bin) {                                        /* true when the picture goes with that basket */
      var it = d.items[+card.getAttribute("data-i")], g = +bin.getAttribute("data-g");
      api.unlock(); api.busy();
      if (it.group !== g) {
        wrong++; api.soft(); Kit.bob(card);
        msg.textContent = "The " + it.word.toLowerCase() + " goes with " + d.groups[it.group].group + ". Try the other basket."; api.live(msg.textContent);
        Kit.glow(binOf(it.group), 3600);
        if (picked) { picked.classList.remove("is-picked"); picked.setAttribute("aria-pressed", "false"); picked = null; }
        return false;
      }
      if (picked === card) picked = null;
      Kit.settle(card, function () { bin.querySelector(".tb-binput").appendChild(card); card.classList.remove("is-picked"); card.classList.add("is-placed"); card.setAttribute("aria-disabled", "true"); card.tabIndex = -1; card.setAttribute("aria-pressed", "false"); });
      placed++; api.chime(false); wrong = 0;
      msg.textContent = api.praise() + " The " + it.word.toLowerCase() + " goes with " + d.groups[g].group + "."; api.live(msg.textContent);
      api.progress(placed + " of " + total + " sorted");
      if (placed === total) api.later(function () { api.cheer("All sorted. Nicely done!", "Sort more"); }, 900);
      return true;
    }
    Kit.dragger(wrap, {
      pick: function (t) { var c = t.closest && t.closest(".tb-thing"); return c && !c.classList.contains("is-placed") ? c : null; },
      targets: function () { return Array.prototype.slice.call(bins.children); },
      drop: function (card, bin) { return put(card, bin); },
      tap: function (card) { api.unlock(); api.busy(); pick(card); },
      magnet: 120
    });
    bins.addEventListener("click", function (e) {
      var bin = e.target.closest(".tb-bin"); if (!bin) return;
      if (picked) put(picked, bin); else { msg.textContent = "Touch a picture first, and then the basket it goes with."; api.live(msg.textContent); }
    });
    api.progress("0 of " + total + " sorted");
    api.say(function () { return "Which basket does each picture go with? " + d.groups[0].label + ", or " + d.groups[1].label + "."; });
    api.hint(function () { var c = picked || open()[0]; if (!c) return; var it = d.items[+c.getAttribute("data-i")]; Kit.glow(c, 3600); Kit.glow(binOf(it.group), 3600); });
    api.assist(function () {
      open().forEach(function (c, j) { api.later(function () { if (c.classList.contains("is-placed")) return; put(c, binOf(d.items[+c.getAttribute("data-i")].group)); }, 520 * j); });
    });
    api.debug(function () {
      return { groups: d.groups, items: d.items, placed: placed, total: total, picked: picked ? +picked.getAttribute("data-i") : -1, wrong: wrong,
        cards: function () { return open().map(function (c) { var m = middleOf(c); return { i: +c.getAttribute("data-i"), x: m[0], y: m[1], group: d.items[+c.getAttribute("data-i")].group }; }); },
        bins: function () { return [0, 1].map(function (g) { return middleOf(binOf(g)); }); } };
    });
  }

  /* ===================== ODD ONE OUT =====================
     Four pictures; three belong together. Touch the one that does not. A touch on one that does belong simply sets it aside
     with a kind word, and a second try makes the odd one glow. When it is found, the other three are named. */
  function odd(root, o, api) {
    var rounds = T.oddOne(o).rounds, ix = 0, found = false, tries = 0;
    api.used(rounds.map(function (r) { return r.set; }));
    var q = h("p", "tb-h", "Three of these go together. Touch the one that does not belong."), row = h("div", "tb-oddrow"), msg = h("p", "tb-msg", ""), nav = h("div", "tb-row");
    nav.innerHTML = '<button type="button" class="tb-btn go" id="tbOddNext" hidden>Another round <span aria-hidden="true">▶</span></button>';
    [q, row, msg, nav].forEach(function (x) { root.appendChild(x); });
    var oddBtn = function () { return row.querySelector('[data-odd="1"]'); };
    function size() { var tall = window.matchMedia("(orientation:portrait)").matches && api.area().w < 900; row.style.setProperty("--thing", cardSize(api, tall ? 2 : 4, 120, tall ? 270 : 230) + "px"); }
    function show() {
      var r = rounds[ix]; found = false; tries = 0;
      row.innerHTML = r.cards.map(function (c, k) { return '<button type="button" class="tb-thing tb-oddcard" data-c="' + k + '" data-odd="' + (c.odd ? 1 : 0) + '">' + thingHtml(c.art, c.word) + "</button>"; }).join("");
      msg.textContent = ""; byId("tbOddNext").hidden = true; size(); api.progress("Round " + (ix + 1) + " of " + rounds.length); api.busy();
      api.say(function () { return "Which one does not belong? " + r.cards.map(function (c) { return c.word.toLowerCase(); }).join(", "); });
    }
    row.addEventListener("click", function (e) {
      var b = e.target.closest("[data-c]"); if (!b || found || b.disabled) return; api.unlock(); api.busy();
      var r = rounds[ix];
      if (b.getAttribute("data-odd") === "1") {
        found = true; b.classList.add("is-found"); Kit.bob(b);
        Array.prototype.forEach.call(row.children, function (x) { if (x !== b) { x.classList.remove("is-aside"); x.classList.add("is-together"); x.disabled = true; } });
        api.chime(false); msg.textContent = api.praise() + " The other three are all " + r.together.toLowerCase() + "."; api.live(msg.textContent);
        if (ix === rounds.length - 1) api.later(function () { api.cheer("All done. Nicely spotted!", "More to spot"); }, 1500); else byId("tbOddNext").hidden = false;
      } else {
        tries++; b.classList.add("is-aside"); b.disabled = true; api.soft();
        msg.textContent = "That one goes with the others. Have another look."; api.live(msg.textContent);
        if (tries >= 2) Kit.glow(oddBtn(), 3600);
      }
    });
    byId("tbOddNext").addEventListener("click", function () { api.unlock(); ix++; show(); });
    api.onResize(size);
    show();
    api.hint(function () { if (!found) Kit.glow(oddBtn(), 3600); });
    api.assist(function () { ix = rounds.length - 1; show(); var b = oddBtn(); if (b) b.click(); });
    api.debug(function () {
      return { round: rounds[ix], index: ix, found: found, tries: tries,
        cards: function () { return Array.prototype.map.call(row.children, function (c) { var m = middleOf(c); return { x: m[0], y: m[1], odd: c.getAttribute("data-odd") === "1" }; }); } };
    });
  }

  /* ===================== MATCH THE CLUE =====================
     Pictures down the left, clues down the right. Touch a picture and then its clue (or a clue and then its picture), or drag a clue
     to its picture. A pair that fits locks with a tick and the clue settles under its picture; a pair that does not fit is let go
     with a soft note, and after two tries the right clue glows. */
  function match(root, o, api) {
    var m = T.matchUp(o), n = m.pairs.length, matched = 0, pickP = null, pickC = null, misses = 0, byArt = {};
    m.pairs.forEach(function (p) { byArt[p.art] = p; });
    api.used(m.pairs.map(function (p) { return p.set; }));
    var cols = h("div", "tb-matchcols"), pics = h("div", "tb-matchcol"), clues = h("div", "tb-matchcol"), msg = h("p", "tb-msg", "Touch a picture, then the clue that goes with it.");
    m.pictures.forEach(function (a) {
      var b = h("button", "tb-thing tb-mpic", Art.img(a, { size: 72 }) + '<span class="tb-mtext"><b>' + esc(byArt[a].word) + '</b><em class="tb-mdone"></em></span>'); b.type = "button"; b.setAttribute("data-art", a); b.setAttribute("aria-pressed", "false"); pics.appendChild(b);
    });
    m.clues.forEach(function (c, k) { var b = h("button", "tb-cuecard", esc(c)); b.type = "button"; b.setAttribute("data-clue", c); b.setAttribute("aria-pressed", "false"); clues.appendChild(b); });
    cols.appendChild(pics); cols.appendChild(clues); root.appendChild(cols); root.appendChild(msg); api.progress("0 of " + n + " matched");
    var picOf = function (a) { return pics.querySelector('[data-art="' + a + '"]'); }, clueOf = function (a) { return clues.querySelector('[data-clue="' + byArt[a].clue.replace(/"/g, '\\"') + '"]'); };
    function set(b, which) {
      var prev = which === "p" ? pickP : pickC; if (prev) { prev.classList.remove("is-picked"); prev.setAttribute("aria-pressed", "false"); }
      var next = b === prev ? null : b; if (next) { next.classList.add("is-picked"); next.setAttribute("aria-pressed", "true"); }
      if (which === "p") pickP = next; else pickC = next;
    }
    function judge(pic, clue) {                                      /* true when the clue is the picture's */
      var a = pic.getAttribute("data-art");
      if (byArt[a].clue === clue.getAttribute("data-clue")) {
        matched++; misses = 0; set(null, "p"); set(null, "c"); pickP = pickC = null;
        pic.classList.remove("is-picked"); pic.classList.add("is-matched"); pic.disabled = true; pic.querySelector(".tb-mdone").textContent = byArt[a].clue;
        clue.classList.remove("is-picked"); clue.classList.add("is-gone"); clue.disabled = true; clue.tabIndex = -1;
        api.chime(false); msg.textContent = api.praise() + " The " + byArt[a].word.toLowerCase() + ": " + byArt[a].clue.charAt(0).toLowerCase() + byArt[a].clue.slice(1); api.live(msg.textContent);
        api.progress(matched + " of " + n + " matched");
        if (matched === n) api.later(function () { api.cheer("Every pair is matched!", "More to match"); }, 800);
        return true;
      }
      misses++; api.soft(); Kit.bob(pic); Kit.bob(clue);
      [pic, clue].forEach(function (x) { x.classList.remove("is-picked"); x.setAttribute("aria-pressed", "false"); }); pickP = pickC = null;
      msg.textContent = "Those two do not go together. Try another."; api.live(msg.textContent);
      if (misses >= 2) { Kit.glow(picOf(a), 3600); Kit.glow(clueOf(a), 3600); }
      return false;
    }
    Kit.dragger(cols, {
      pick: function (t) { var c = t.closest && t.closest(".tb-cuecard, .tb-mpic"); return c && !c.disabled ? c : null; },
      targets: function () { return Array.prototype.slice.call(pics.querySelectorAll(".tb-mpic:not(.is-matched)")); },
      drop: function (card, target) { if (!card.classList.contains("tb-cuecard")) return false; api.unlock(); api.busy(); return judge(target, card); },
      tap: function (card) {
        api.unlock(); api.busy(); api.tick();
        var isPic = card.classList.contains("tb-mpic"); set(card, isPic ? "p" : "c");
        if (pickP && pickC) judge(pickP, pickC);
      },
      magnet: 60
    });
    api.say(function () { return "Match each picture with its clue. " + m.pairs.map(function (p) { return p.word.toLowerCase() + ": " + p.clue; }).join(" "); });
    api.hint(function () { var p = pics.querySelector(".tb-mpic:not(.is-matched)"); if (!p) return; Kit.glow(p, 3600); Kit.glow(clueOf(p.getAttribute("data-art")), 3600); });
    api.assist(function () {
      Array.prototype.slice.call(pics.querySelectorAll(".tb-mpic:not(.is-matched)")).forEach(function (p, j) {
        api.later(function () { var a = p.getAttribute("data-art"), c = clueOf(a); if (p.disabled || !c) return; judge(p, c); }, 560 * j);
      });
    });
    api.debug(function () {
      return { truth: byArt, matched: matched, n: n,
        pictures: function () { return Array.prototype.map.call(pics.children, function (b) { var mm = middleOf(b); return { art: b.getAttribute("data-art"), x: mm[0], y: mm[1], done: b.disabled }; }); },
        cluePos: function (a) { var c = clueOf(a); return c ? middleOf(c) : null; } };
    });
  }

  /* ===================== PUT IT IN ORDER =====================
     The steps of an everyday job, mixed up, and numbered places to put them. Touch a step, or drag it: it goes to the next free
     place when it is the next thing that happens, and floats back, with a soft note, when it comes a little later. */
  function order(root, o, api) {
    var all = T.inOrder(o).items, ix = 0, placed = 0, misses = 0;
    api.used(all.map(function (i) { return i.id; }));
    var head = h("div", "tb-ohead"), both = h("div", "tb-ostage"), slots = h("ol", "tb-oslots"), pool = h("div", "tb-opool"), msg = h("p", "tb-msg", ""), nav = h("div", "tb-row");
    nav.innerHTML = '<button type="button" class="tb-btn go" id="tbOrNext" hidden>Another job <span aria-hidden="true">▶</span></button>';
    both.appendChild(slots); both.appendChild(pool);
    [head, both, msg, nav].forEach(function (x) { root.appendChild(x); });
    var cur = function () { return all[ix]; }, stepBtn = function (k) { return pool.querySelector('[data-step="' + k + '"]'); };
    function show() {
      var it = cur(); placed = 0; misses = 0;
      head.innerHTML = (it.art ? Art.img(it.art, { size: 64 }) : "") + "<h3>" + esc(it.title) + "</h3>";
      slots.innerHTML = it.steps.map(function (s, k) { return '<li class="tb-oslot" data-slot="' + k + '"><b>' + (k + 1) + "</b></li>"; }).join("");
      pool.innerHTML = it.order.map(function (k) { return '<button type="button" class="tb-step" data-step="' + k + '">' + esc(it.steps[k]) + "</button>"; }).join("");
      msg.textContent = "What comes first?"; byId("tbOrNext").hidden = true; api.progress("Job " + (ix + 1) + " of " + all.length); api.busy();
      api.say(function () { return it.title + ". What comes first? " + it.order.map(function (k) { return it.steps[k]; }).join(". "); });
    }
    function put(card) {                                              /* true when it is the next step */
      var it = cur(), k = +card.getAttribute("data-step"); api.unlock(); api.busy();
      if (k !== placed) {
        misses++; api.soft(); Kit.bob(card);
        msg.textContent = "That one comes a little later. What happens " + (placed ? "next" : "first") + "?"; api.live(msg.textContent);
        if (misses >= 2) Kit.glow(stepBtn(placed), 3600);
        return false;
      }
      var li = slots.querySelector('[data-slot="' + placed + '"]'); misses = 0;
      Kit.settle(card, function () { li.appendChild(card); li.classList.add("is-filled"); card.classList.add("is-placed"); card.disabled = true; });
      placed++; api.chime(false);
      if (placed === it.steps.length) {
        msg.textContent = api.praise() + " That is the whole job."; api.live(msg.textContent);
        if (ix === all.length - 1) api.later(function () { api.cheer("Every step in its place!", "More to put in order"); }, 900); else byId("tbOrNext").hidden = false;
      } else msg.textContent = "And then?";
      return true;
    }
    Kit.dragger(both, {
      pick: function (t) { var c = t.closest && t.closest(".tb-step"); return c && !c.disabled ? c : null; },
      targets: function () { return Array.prototype.slice.call(slots.querySelectorAll(".tb-oslot:not(.is-filled)")); },
      drop: function (card) { return put(card); },
      tap: function (card) { put(card); },
      magnet: 140
    });
    byId("tbOrNext").addEventListener("click", function () { api.unlock(); ix++; show(); });
    show();
    api.hint(function () { var b = stepBtn(placed); if (b && !b.disabled) Kit.glow(b, 3600); });
    api.assist(function () {
      ix = all.length - 1; show();
      cur().steps.forEach(function (st, k) { api.later(function () { var b = stepBtn(k); if (b && !b.disabled) put(b); }, 460 * k); });
    });
    api.debug(function () {
      return { item: cur(), index: ix, placed: placed, misses: misses,
        steps: function () { return Array.prototype.map.call(pool.querySelectorAll(".tb-step:not(.is-placed)"), function (b) { var m = middleOf(b); return { k: +b.getAttribute("data-step"), x: m[0], y: m[1] }; }); },
        slots: function () { return Array.prototype.map.call(slots.children, function (li) { var m = middleOf(li); return [m[0], m[1]]; }); } };
    });
  }

  Kit.register({
    id: "sort", group: 2, order: 1, title: "Sort It", blurb: "Which basket does it go with?",
    icon: '<rect x="6" y="36" width="22" height="20"/><rect x="36" y="36" width="22" height="20"/><path d="M32 6v18M24 16l8 8 8-8"/>', start: sort
  });
  Kit.register({
    id: "order", group: 2, order: 2, title: "Put It in Order", blurb: "Which step comes first, and then?",
    icon: '<path d="M22 14h34M22 32h34M22 50h34"/><circle cx="10" cy="14" r="3"/><circle cx="10" cy="32" r="3"/><circle cx="10" cy="50" r="3"/>', start: order
  });
  Kit.register({
    id: "match", group: 2, order: 3, title: "Match the Clue", blurb: "Join each picture with its clue.",
    icon: '<circle cx="14" cy="32" r="9"/><circle cx="50" cy="32" r="9"/><path d="M23 32h18"/>', start: match
  });
  Kit.register({
    id: "odd", group: 2, order: 4, title: "Odd One Out", blurb: "Three go together. Which one does not?",
    icon: '<circle cx="12" cy="20" r="8"/><circle cx="32" cy="20" r="8"/><circle cx="52" cy="20" r="8"/><rect x="24" y="38" width="16" height="16"/>', start: odd
  });
  Kit.register({
    id: "sounds", group: 2, order: 5, title: "Sights and Sounds", blurb: "Touch a picture and listen to its sound.",
    icon: '<path d="M6 32h4M16 20v24M26 10v44M36 22v20M46 14v36M56 28v8"/>', start: sounds
  });
})();
