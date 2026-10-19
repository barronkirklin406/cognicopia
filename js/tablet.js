/* =====================================================================
   Cognicopia Tablet Activities: the screen (tablet.html).

   The shell every activity runs in, and the main menu. An activity is a
   file that registers itself with the kit (js/tabletKit.js); this file
   gives each one the same frame:

     Home           back to the menu, from anywhere
     Finish for me  completes the activity with a gentle celebration
     Next           a fresh activity, instantly: nothing is scored, nothing is lost
     Read to Me     the device's own voice reads what is on the screen
     a hint         after 15 quiet seconds the right place glows

   Calm by design: a right answer gets a soft chime; a place that does not
   fit lets the card glide back to where it was, with a soft rising note
   and a kind sentence. There is no red, no buzzer, no game over and no
   score. Nothing a person does is stored or sent anywhere: only the
   level, topic, sound and speed choices stay in this browser, and no
   network request is made.
   ===================================================================== */
(function () {
  "use strict";
  var T = window.CognicopiaTablet, Kit = window.CognicopiaTabletKit;
  if (!T || !Kit || !document.getElementById("tbMenu")) return;

  var $ = function (id) { return document.getElementById(id); };
  var esc = Kit.esc, h = Kit.h, reduced = Kit.reduced, LETTERS = Kit.LETTERS;
  var PRAISE = ["That's it!", "Lovely!", "Wonderful!", "Just right!", "Nicely done!"];
  var praise = function () { return PRAISE[Math.floor(Math.random() * PRAISE.length)]; };

  /* ---------- what is remembered in this browser: the choices only, never what anyone did ---------- */
  var PREFS_KEY = "cognicopia_tablet_prefs", prefs = { stage: "middle", topic: "", sound: true, speed: 2 };
  try {
    var saved = JSON.parse(window.localStorage.getItem(PREFS_KEY) || "null");
    if (saved) {
      if (T.STAGES[saved.stage]) prefs.stage = saved.stage;
      if (T.TOPICS.some(function (t) { return t.id === saved.topic; })) prefs.topic = saved.topic;
      if (saved.sound === false) prefs.sound = false;
      if (saved.speed >= 1 && saved.speed <= 4) prefs.speed = Math.round(saved.speed);
    }
  } catch (e) { /* private browsing: the choices simply start fresh each visit */ }
  function savePrefs() { try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* not kept */ } }

  /* ---------- sound: soft tones made on the tablet (Web Audio, offline) ---------- */
  var audio = null;
  function unlock() {
    try {
      if (!audio) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) audio = new AC(); }
      if (audio && audio.state === "suspended") audio.resume();
    } catch (e) { /* silent is fine */ }
  }
  function tone(freqs, gain, len, gap) {
    if (!prefs.sound) return;
    unlock();
    if (!audio) return;
    try {
      var t0 = audio.currentTime + 0.02;
      freqs.forEach(function (f, i) {
        var o = audio.createOscillator(), g = audio.createGain(), t = t0 + i * (gap || 0.13);
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + len + 0.05);
      });
    } catch (e) { /* silent is fine */ }
  }
  var chime = function (big) { tone(big ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 880], 0.09, 0.9); };
  /* the sound of "not that one, but nearly": two soft notes that rise, like a gentle question */
  var soft = function () { tone([392, 440], 0.05, 1.0, 0.16); };
  var pop = function () { tone([420, 300], 0.07, 0.25, 0.04); };
  var tick = function () { tone([700], 0.03, 0.12); };
  var audioReady = function () { unlock(); return audio; };

  /* ---------- Read to Me: the device's own voices ---------- */
  var canSpeak = "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
  function speak(text) {
    if (!canSpeak || !text) return;
    try {
      var synth = window.speechSynthesis; synth.cancel();
      var u = new window.SpeechSynthesisUtterance(text), vs = synth.getVoices() || [];
      var v = vs.filter(function (x) { return /^en/i.test(x.lang) && x.localService; })[0] || vs.filter(function (x) { return x.localService; })[0];
      u.rate = 0.85; u.lang = "en-US"; if (v) { u.voice = v; u.lang = v.lang; }
      synth.speak(u);
    } catch (e) { /* no voice: the text is on the screen */ }
  }
  var hush = function () { try { if (canSpeak) window.speechSynthesis.cancel(); } catch (e) { /* nothing to stop */ } };

  /* ---------- the free-packet count, the same as Tablet Mode in the packet tool: one session is one packet ---------- */
  var TRIAL = null;
  try { TRIAL = window.CogniTrialLedger ? window.CogniTrialLedger.forBrowser(window.localStorage) : null; } catch (e) { TRIAL = null; }
  var counted = false;
  var licensed = function () { try { return !!(window.CognicopiaLicense && window.CognicopiaLicense.isLicensed()); } catch (e) { return false; } };
  var freeRuns = function () { var c = window.CognicopiaLicenseConfig; return (c && c.FREE_RUNS) || 25; };
  function allowed() {
    if (counted || licensed()) return true;
    if (TRIAL && TRIAL.count() >= freeRuns()) { $("tbGate").hidden = false; $("tbGateClose").focus(); return false; }
    if (TRIAL) TRIAL.record();
    counted = true;
    return true;
  }

  /* ---------- the shell: one activity at a time, full screen ---------- */
  var overlay = $("tb"), stage = $("tbStage"), cur = null, wake = null, inerted = [], returnTo = null;
  var idleMs = 15000, idleTimer = 0, lastUsed = {}, ACT = {};
  function live(t) { $("tbLive").textContent = t; }

  function burst(x, y) {
    if (reduced()) return;
    var colors = ["#2d5a44", "#c5a059", "#f6cdb4", "#9fcbb0", "#e8cc8a", "#8a3a20"];
    for (var i = 0; i < 14; i++) {
      var d = h("span", "tb-burst"), a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 90;
      d.style.left = x + "px"; d.style.top = y + "px"; d.style.background = colors[i % colors.length];
      d.style.setProperty("--dx", Math.cos(a) * r + "px"); d.style.setProperty("--dy", Math.sin(a) * r - 40 + "px");
      document.body.appendChild(d); setTimeout(function (n) { n.remove(); }.bind(null, d), 1200);
    }
  }
  /* the finish: a warm medal, a chime, a little confetti, and a way on. Used when the work is done and when "Finish for me" is pressed. */
  var MEDAL = '<svg class="tb-medal" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><g class="ray" stroke="#c5a059" stroke-width="5" stroke-linecap="round" fill="none"><path d="M60 4v14M60 102v14M4 60h14M102 60h14M20 20l10 10M90 90l10 10M100 20 90 30M30 90l-10 10"/></g>' +
    '<circle cx="60" cy="58" r="34" fill="#f1dda8" stroke="#1b382b" stroke-width="5"/><path d="M60 38l6.6 13.4 14.8 2.1-10.7 10.4 2.5 14.7L60 71.6 46.8 78.6l2.5-14.7L38.6 53.5l14.8-2.1z" fill="#1b382b"/>' +
    '<path d="M42 88l-8 24 16-8 6 10 4-22zM78 88l8 24-16-8-6 10-4-22z" fill="#c5a059" stroke="#1b382b" stroke-width="4" stroke-linejoin="round"/></svg>';
  function cheer(text, nextLabel) {
    if (!cur) return;
    cur.done = true; stopIdle(); $("tbAssist").disabled = true;
    var old = stage.querySelector(".tb-cheer"); if (old) old.remove();
    var c = h("div", "tb-cheer", MEDAL + "<p>" + esc(text) + '</p><div class="tb-row"><button type="button" class="tb-btn go" data-cheer="next">' + esc(nextLabel || "Another one") + '</button><button type="button" class="tb-btn" data-cheer="menu">Home</button></div>');
    c.setAttribute("role", "status");
    stage.appendChild(c); chime(true);
    var r = c.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 3);
    live(text); c.querySelector("[data-cheer=next]").focus();
  }
  function area() { return { w: Math.max(260, stage.clientWidth - 32), h: Math.max(260, stage.clientHeight - 28) }; }

  /* ---------- the quiet-moment hint: after 15 seconds with no touch, the right place glows ---------- */
  function stopIdle() { clearTimeout(idleTimer); idleTimer = 0; }
  function armIdle() {
    stopIdle();
    if (!cur || !cur.hintFn || cur.done || cur.assisting || overlay.hidden) return;
    var me = cur;
    idleTimer = setTimeout(function () {
      if (cur !== me || me.done || me.assisting || overlay.hidden) return;
      me.hints++;
      try { me.hintFn(); } catch (e) { /* a hint is only a kindness */ }
      live("Here is a hint. The glowing place is the next step.");
      armIdle();
    }, idleMs);
  }
  /* a timer that belongs to the activity on the screen: it never fires after the activity is closed or replaced */
  function later(fn, ms) {
    var me = cur, t = setTimeout(function () { if (cur === me) fn(); }, ms);
    if (me) me.timers.push(t);
    return t;
  }

  function teardown() {
    stopIdle();
    if (cur) { cur.timers.forEach(clearTimeout); cur.timers = []; }
    if (cur && cur.cleanup) { try { cur.cleanup(); } catch (e) { /* leaving anyway */ } }
    hush();
  }
  function run(act, seed) {
    teardown();
    stage.innerHTML = ""; stage.scrollTop = 0;
    $("tbProg").textContent = ""; $("tbSay").hidden = true; $("tbAssist").hidden = true; $("tbAssist").disabled = false; $("tbNew").hidden = false; live("");
    var me = cur = { act: act, seed: seed, say: null, cleanup: null, debug: null, onKey: null, onResize: null, assistFn: null, hintFn: null, done: false, assisting: false, timers: [], hints: 0, used: null };
    var api = {
      area: area, live: live, chime: chime, soft: soft, pop: pop, tick: tick, cheer: cheer, praise: praise, speak: speak, unlock: unlock, audio: audioReady,
      soundOn: function () { return prefs.sound; }, setSound: function (on) { prefs.sound = !!on; savePrefs(); soundLabel(); }, prefs: prefs, savePrefs: savePrefs, later: later, busy: armIdle,
      progress: function (t) { $("tbProg").textContent = t; },
      say: function (fn) { me.say = fn; $("tbSay").hidden = !(canSpeak && fn); },
      debug: function (fn) { me.debug = fn; },
      onKey: function (fn) { me.onKey = fn; },
      onResize: function (fn) { me.onResize = fn; },
      assist: function (fn) { me.assistFn = fn; $("tbAssist").hidden = !fn; },
      hint: function (fn) { me.hintFn = fn; armIdle(); },
      used: function (ids) { me.used = ids; },
      isDone: function () { return me.done; },
      again: function () { next(); }
    };
    me.api = api;
    var opts = { stage: prefs.stage, topic: prefs.topic, seed: seed, avoid: lastUsed[act.id] || [], prefs: prefs };
    try { me.cleanup = act.start(stage, opts, api) || null; }
    catch (e) { stage.innerHTML = '<p class="tb-big">That one could not start. Choose Home, then try another.</p>'; if (window.console && console.error) console.error("tablet activity " + act.id + ": " + (e && e.stack || e)); }
  }
  /* Next: a fresh activity at once, and one that does not repeat what was just on the screen */
  function next() {
    if (!cur) return;
    lastUsed[cur.act.id] = cur.used || [];
    run(cur.act, T.newSeed());
  }
  function openAct(id, from) {
    var act = ACT[id];
    if (!act || !allowed()) return;
    returnTo = from || document.activeElement;
    overlay.hidden = false; document.documentElement.classList.add("tb-open");
    inerted = Array.prototype.filter.call(document.body.children, function (n) { return n !== overlay && n !== $("tbGate") && n.tagName !== "SCRIPT" && !n.inert; });
    inerted.forEach(function (n) { n.inert = true; });
    $("tbTitle").textContent = act.title;
    unlock(); wakeLock();
    run(act, T.newSeed());
    $("tbBack").focus();
  }
  function closeAct() {
    teardown(); cur = null; stage.innerHTML = "";
    overlay.hidden = true; document.documentElement.classList.remove("tb-open");
    inerted.forEach(function (n) { n.inert = false; }); inerted = [];
    try { if (wake && !wake.released) wake.release().catch(function () { /* released */ }); } catch (e) { /* nothing held */ }
    wake = null;
    if (returnTo && returnTo.focus) returnTo.focus();
  }
  function wakeLock() {
    try { if (navigator.wakeLock && document.visibilityState === "visible") navigator.wakeLock.request("screen").then(function (l) { wake = l; }).catch(function () { /* the screen may sleep: that is all */ }); } catch (e) { /* not available */ }
  }


  /* ---------- an on-screen keyboard: letters in order, so nothing has to be learned ---------- */
  function keyboard(onLetter, onBack) {
    var kb = h("div", "tb-kb"); kb.setAttribute("role", "group"); kb.setAttribute("aria-label", "Letters");
    LETTERS.forEach(function (L) { kb.appendChild(h("button", "tb-key", L)).setAttribute("data-k", L); });
    var back = h("button", "tb-key wide", "⌫ Back"); back.setAttribute("data-k", "BACK"); back.setAttribute("aria-label", "Take back a letter");
    kb.appendChild(back);
    kb.addEventListener("click", function (e) {
      var b = e.target.closest("[data-k]"); if (!b) return;
      var k = b.getAttribute("data-k"); tick();
      if (k === "BACK") onBack(); else onLetter(k);
    });
    return kb;
  }
  function wordKeys(onLetter, onBack) {
    return function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); onLetter(e.key.toUpperCase()); }
      else if (e.key === "Backspace") { e.preventDefault(); onBack(); }
    };
  }

  /* ===================== WORD SEARCH ===================== */
  function wordSearch(root, o, api) {
    var a = api.area(), portrait = a.w < a.h * 1.1, gw = portrait ? a.w : a.w - 330, gh = portrait ? a.h - 330 : a.h;
    o.fit = { size: Math.max(5, Math.floor(Math.min(gw, gh) / 55)) };
    var ws = T.wordSearch(o);
    if (!ws) { root.innerHTML = '<p class="tb-big">No puzzle this time. Choose New one.</p>'; return; }
    var n = ws.size, found = {}, pending = null, down = null, moved = false, path = [], nFound = 0, colorIx = 0;
    var split = h("div", "tb-split"), grid = h("div", "tb-grid"), side = h("div", "tb-side");
    grid.setAttribute("role", "grid"); grid.setAttribute("aria-label", "Letter grid, " + n + " by " + n + ". Slide along a word, or tap its first letter, then its last.");
    grid.style.setProperty("--n", n);
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      var cell = h("div", "tb-cell", ws.rows[r].charAt(c)); cell.setAttribute("role", "gridcell"); cell.setAttribute("data-r", r); cell.setAttribute("data-c", c); grid.appendChild(cell);
    }
    side.innerHTML = '<h3 class="tb-h">Find these words</h3><ul class="tb-words">' + ws.words.map(function (w) { return '<li data-w="' + w + '"><span class="tb-tick" aria-hidden="true"></span><span>' + w + "</span></li>"; }).join("") +
      '</ul><div class="tb-row"><button type="button" class="tb-btn" id="tbHint"><span aria-hidden="true">💡</span> Hint</button></div><p class="tb-msg" id="tbWsMsg">Slide your finger along a word, or tap its first letter and then its last letter.</p>';
    split.appendChild(grid); split.appendChild(side); root.appendChild(split);
    function size() { var b = area(), p = b.w < b.h * 1.1, w = p ? b.w : b.w - 330, hh = p ? b.h - 352 : b.h; grid.style.setProperty("--cell", Math.max(52, Math.min(92, Math.floor(Math.min(w, hh) / n) - 3)) + "px"); }
    size(); api.onResize(size);
    var cellAt = function (rc) { return grid.querySelector('[data-r="' + rc[0] + '"][data-c="' + rc[1] + '"]'); };
    function fromPoint(x, y) { var e = document.elementFromPoint(x, y); e = e && e.closest ? e.closest(".tb-cell") : null; return e && grid.contains(e) ? [+e.getAttribute("data-r"), +e.getAttribute("data-c")] : null; }
    function line(p, q) {
      var dr = q[0] - p[0], dc = q[1] - p[1];
      if (!dr && !dc) return [p];
      var k = Math.round(Math.atan2(dr, dc) / (Math.PI / 4)), sr = Math.round(Math.sin(k * Math.PI / 4)), sc = Math.round(Math.cos(k * Math.PI / 4)), len = Math.max(Math.abs(dr), Math.abs(dc)), out = [];
      for (var i = 0; i <= len; i++) { var rr = p[0] + sr * i, cc = p[1] + sc * i; if (rr < 0 || cc < 0 || rr >= n || cc >= n) break; out.push([rr, cc]); }
      return out;
    }
    function paint(p) {
      Array.prototype.forEach.call(grid.querySelectorAll(".is-sel"), function (x) { x.classList.remove("is-sel"); });
      (p || []).forEach(function (rc) { var e = cellAt(rc); if (e) { e.classList.remove("is-fade"); e.classList.add("is-sel"); } });
      path = p || [];
    }
    function mark(rc) { Array.prototype.forEach.call(grid.querySelectorAll(".is-start"), function (x) { x.classList.remove("is-start"); }); if (rc) { var e = cellAt(rc); if (e) e.classList.add("is-start"); } }
    function tryWord(p) {
      var letters = p.map(function (rc) { return ws.rows[rc[0]].charAt(rc[1]); }).join(""), back = letters.split("").reverse().join(""), hit = null;
      ws.words.forEach(function (w) { if (!hit && !found[w] && (w === letters || w === back)) hit = w; });
      if (hit) {
        found[hit] = true; nFound++; var cls = "f" + (colorIx++ % 7);
        p.forEach(function (rc) { var e = cellAt(rc); if (e) e.classList.add(cls); });
        paint([]);
        var li = side.querySelector('[data-w="' + hit + '"]'); li.classList.add("is-found"); li.querySelector(".tb-tick").textContent = "✓";
        api.progress(nFound + " of " + ws.words.length + " found");
        $("tbWsMsg").textContent = praise(); live("Found " + hit + ". " + nFound + " of " + ws.words.length + ".");
        if (nFound === ws.words.length) cheer("You found them all!", "New word search"); else chime(false);
      } else {
        var cs = p.map(cellAt).filter(function (e) { return e && !/ f\d/.test(" " + e.className); });
        cs.forEach(function (e) { e.classList.add("is-fade"); e.classList.remove("is-sel"); });
        setTimeout(function () { cs.forEach(function (e) { e.classList.remove("is-fade"); }); }, 650);
        path = []; $("tbWsMsg").textContent = "Keep looking. Slide along a whole word.";
      }
    }
    function tap(rc) {
      if (!pending) { pending = rc; mark(rc); paint([rc]); return; }
      if (pending[0] === rc[0] && pending[1] === rc[1]) { pending = null; mark(null); paint([]); return; }
      var p = line(pending, rc); pending = null; mark(null); paint(p); tryWord(p);
    }
    grid.addEventListener("pointerdown", function (e) {
      unlock(); var rc = fromPoint(e.clientX, e.clientY); if (!rc) return;
      e.preventDefault(); try { grid.setPointerCapture(e.pointerId); } catch (x) { /* mouse or old browser */ }
      down = rc; moved = false; if (!pending) paint([rc]);
    });
    grid.addEventListener("pointermove", function (e) {
      if (!down) return;
      var rc = fromPoint(e.clientX, e.clientY); if (!rc) return;
      if (rc[0] !== down[0] || rc[1] !== down[1]) { moved = true; if (pending) { pending = null; mark(null); } }
      if (moved) paint(line(down, rc));
    });
    grid.addEventListener("pointerup", function () {
      if (!down) return;
      var s = down; down = null;
      if (moved) tryWord(path.length ? path : [s]); else tap(s);
    });
    grid.addEventListener("pointercancel", function () { down = null; paint([]); });
    $("tbHint").addEventListener("click", function () {
      var left = ws.placed.filter(function (p) { return !found[p.word]; });
      if (!left.length) return;
      var p = left[Math.floor(Math.random() * left.length)], e = cellAt([p.r, p.c]);
      if (e) { e.classList.remove("is-hint"); void e.offsetWidth; e.classList.add("is-hint"); setTimeout(function () { e.classList.remove("is-hint"); }, 3000); }
      $("tbWsMsg").textContent = "Look for " + p.word + ". Its first letter is flashing."; live("Look for " + p.word + ". Its first letter is flashing.");
    });
    function cellsOf(p) { var out = [], k; for (k = 0; k < p.word.length; k++) out.push([p.r + p.dy * k, p.c + p.dx * k]); return out; }
    api.hint(function () {
      var left = ws.placed.filter(function (p) { return !found[p.word]; }); if (!left.length) return;
      var p = left[Math.floor(Math.random() * left.length)];
      cellsOf(p).forEach(function (rc) { var e = cellAt(rc); if (e) Kit.glow(e, 3600); });
      $("tbWsMsg").textContent = "Look for " + p.word + ". Its letters are glowing.";
    });
    api.assist(function () {
      ws.placed.filter(function (p) { return !found[p.word]; }).forEach(function (p, k) { api.later(function () { if (!found[p.word]) tryWord(cellsOf(p)); }, 500 * k); });
    });
    api.progress("0 of " + ws.words.length + " found");
    api.say(function () { var left = ws.words.filter(function (w) { return !found[w]; }); return left.length ? "Find these words. " + left.map(function (w) { return w.toLowerCase(); }).join(". ") + "." : "You found every word. Lovely!"; });
    api.debug(function () { return { size: n, placed: ws.placed, words: ws.words, found: Object.keys(found), cell: function (r2, c2) { var b = cellAt([r2, c2]).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; } }; });
  }

  /* ===================== CROSSWORD ===================== */
  function crossword(root, o, api) {
    var a = api.area(), side = a.w >= a.h * 1.15, panelW = side ? 440 : 0, fitW = a.w - panelW - 24, fitH = side ? a.h : a.h - 540;
    o.fit = { size: Math.max(5, Math.floor(Math.min(fitW, fitH) / 55)) };
    var cw = T.crossword(o);
    if (!cw) { root.innerHTML = '<p class="tb-big">No puzzle this time. Choose New one.</p>'; return; }
    var typed = {}, done = {}, sel = { r: 0, c: 0, dir: "A" }, cellsEl = {};
    var key = function (r, c) { return r + "," + c; };
    var filled = function (r, c) { return r >= 0 && c >= 0 && r < cw.rows && c < cw.cols && cw.cells[r].charAt(c) !== "."; };
    var entryCells = function (e) { var out = []; for (var k = 0; k < e.word.length; k++) out.push([e.r + (e.dir === "D" ? k : 0), e.c + (e.dir === "A" ? k : 0)]); return out; };
    var entryAt = function (r, c, dir) { return cw.entries.filter(function (e) { return e.dir === dir && entryCells(e).some(function (p) { return p[0] === r && p[1] === c; }); })[0] || null; };
    var cur2 = function () { return entryAt(sel.r, sel.c, sel.dir); };
    var split = h("div", "tb-split"), grid = h("div", "tb-cw"), panel = h("div", "tb-side");
    grid.style.setProperty("--cols", cw.cols); grid.setAttribute("role", "grid"); grid.setAttribute("aria-label", "Crossword, " + cw.rows + " rows by " + cw.cols + " columns");
    var numAt = {}; cw.entries.forEach(function (e) { numAt[key(e.r, e.c)] = e.num; });
    for (var r = 0; r < cw.rows; r++) for (var c = 0; c < cw.cols; c++) {
      if (!filled(r, c)) { grid.appendChild(h("div", "tb-blank")); continue; }
      var b = h("button", "tb-cwc", (numAt[key(r, c)] ? "<i>" + numAt[key(r, c)] + "</i>" : "") + '<span class="L"></span>'); b.type = "button"; b.setAttribute("data-r", r); b.setAttribute("data-c", c);
      b.setAttribute("aria-label", "Row " + (r + 1) + ", column " + (c + 1)); grid.appendChild(b); cellsEl[key(r, c)] = b;
    }
    var clue = h("div", "tb-clue", ""), nav = h("div", "tb-row"), kb;
    nav.innerHTML = '<button type="button" class="tb-btn" data-cwn="-1">◀ Clue</button><button type="button" class="tb-btn" id="tbCwHint"><span aria-hidden="true">💡</span> A letter</button><button type="button" class="tb-btn" data-cwn="1">Clue ▶</button>';
    panel.style.flex = "0 1 " + (side ? panelW : 560) + "px"; panel.style.maxWidth = "100%";
    function size() { var b2 = area(), s2 = b2.w >= b2.h * 1.15, fw = b2.w - (s2 ? 440 : 0) - 24, fh = s2 ? b2.h : b2.h - 540; grid.style.setProperty("--cell", Math.max(52, Math.min(84, Math.floor(Math.min(fw / cw.cols, fh / cw.rows)) - 3)) + "px"); }
    function refresh() {
      var e = cur2(), inWord = {}; if (e) entryCells(e).forEach(function (p) { inWord[key(p[0], p[1])] = 1; });
      var doneCell = {}; cw.entries.forEach(function (en) { if (done[en.num + en.dir]) entryCells(en).forEach(function (p) { doneCell[key(p[0], p[1])] = 1; }); });
      Object.keys(cellsEl).forEach(function (k) {
        var el = cellsEl[k]; el.querySelector(".L").textContent = typed[k] || "";
        el.classList.toggle("is-word", !!inWord[k]); el.classList.toggle("is-done", !!doneCell[k]); el.classList.toggle("is-cur", k === key(sel.r, sel.c));
      });
      clue.innerHTML = e ? e.num + " " + (e.dir === "A" ? "Across" : "Down") + ": " + esc(e.clue) + "<small>" + e.word.length + " letters</small>" : "Tap a square";
      api.progress(Object.keys(done).length + " of " + cw.entries.length + " words");
    }
    function select(r2, c2, dir) {
      sel.r = r2; sel.c = c2;
      if (dir) sel.dir = dir;
      if (!entryAt(r2, c2, sel.dir)) sel.dir = sel.dir === "A" ? "D" : "A";
      refresh(); var e = cur2(); if (e) live(e.num + " " + (e.dir === "A" ? "across" : "down") + ". " + e.clue + ". " + e.word.length + " letters.");
    }
    function check() {
      var all = true;
      cw.entries.forEach(function (e) {
        var ok = entryCells(e).every(function (p, k) { return typed[key(p[0], p[1])] === e.word.charAt(k); });
        if (ok && !done[e.num + e.dir]) { done[e.num + e.dir] = true; chime(false); live(e.word + " is right."); }
        if (!ok) all = false;
      });
      refresh();
      if (all) cheer("The crossword is finished!", "New crossword");
    }
    function next(dirn) {
      var order = cw.entries, e = cur2(), ix = e ? order.indexOf(e) : -1; ix = (ix + dirn + order.length) % order.length;
      var n2 = order[ix]; select(n2.r, n2.c, n2.dir);
    }
    function type(L) {
      var e = cur2(); if (!e) return;
      typed[key(sel.r, sel.c)] = L;
      var cs = entryCells(e), at = cs.findIndex(function (p) { return p[0] === sel.r && p[1] === sel.c; });
      if (at < cs.length - 1) { sel.r = cs[at + 1][0]; sel.c = cs[at + 1][1]; }
      check();
    }
    function back() {
      var e = cur2(); if (!e) return;
      if (typed[key(sel.r, sel.c)]) { delete typed[key(sel.r, sel.c)]; refresh(); return; }
      var cs = entryCells(e), at = cs.findIndex(function (p) { return p[0] === sel.r && p[1] === sel.c; });
      if (at > 0) { sel.r = cs[at - 1][0]; sel.c = cs[at - 1][1]; delete typed[key(sel.r, sel.c)]; }
      refresh();
    }
    grid.addEventListener("click", function (e) {
      var b = e.target.closest(".tb-cwc"); if (!b) return; unlock();
      var r2 = +b.getAttribute("data-r"), c2 = +b.getAttribute("data-c");
      if (r2 === sel.r && c2 === sel.c && entryAt(r2, c2, sel.dir === "A" ? "D" : "A")) select(r2, c2, sel.dir === "A" ? "D" : "A"); else select(r2, c2);
    });
    kb = keyboard(type, back);
    panel.appendChild(clue); panel.appendChild(nav); panel.appendChild(h("div", "", "")).style.height = "10px"; panel.appendChild(kb);
    split.appendChild(grid); split.appendChild(panel); root.appendChild(split);
    nav.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cwn]"); if (b) { next(+b.getAttribute("data-cwn")); return; }
      if (e.target.closest("#tbCwHint")) {
        var en = cur2(); if (!en) return;
        var cs = entryCells(en), p = cs.filter(function (q) { return typed[key(q[0], q[1])] !== en.word.charAt(cs.indexOf(q)); })[0];
        if (p) { sel.r = p[0]; sel.c = p[1]; typed[key(p[0], p[1])] = en.word.charAt(cs.indexOf(p)); check(); }
      }
    });
    var keyEl = function (L) { return kb.querySelector('[data-k="' + L + '"]'); };
    api.hint(function () {
      var e = cur2() || cw.entries[0], cs = entryCells(e), p = cs.filter(function (q) { return typed[key(q[0], q[1])] !== e.word.charAt(cs.indexOf(q)); })[0];
      if (!p) { var open = cw.entries.filter(function (x) { return !done[x.num + x.dir]; })[0]; if (open) select(open.r, open.c, open.dir); return; }
      select(p[0], p[1], e.dir); Kit.glow(cellsEl[key(p[0], p[1])], 3600); Kit.glow(keyEl(e.word.charAt(cs.indexOf(p))), 3600);
    });
    api.assist(function () {
      cw.entries.filter(function (e) { return !done[e.num + e.dir]; }).forEach(function (e, n) {
        api.later(function () { entryCells(e).forEach(function (p, k) { typed[key(p[0], p[1])] = e.word.charAt(k); }); check(); }, 450 * n);
      });
    });
    api.onKey(wordKeys(type, back)); size(); api.onResize(size);
    select(cw.entries[0].r, cw.entries[0].c, cw.entries[0].dir);
    api.say(function () { var e = cur2(); return e ? e.num + " " + (e.dir === "A" ? "across" : "down") + ". " + e.clue + ". " + e.word.length + " letters." : ""; });
    api.debug(function () { return { cw: cw, typed: typed, done: done, cell: function (r2, c2) { var b2 = cellsEl[key(r2, c2)].getBoundingClientRect(); return [b2.left + b2.width / 2, b2.top + b2.height / 2]; } }; });
  }

  /* ===================== SPELL IT ===================== */
  function spell(root, o, api) {
    var sp = T.spellIt(o), items = sp.items, ix = 0, got = [], locked = 0, finished = false;
    if (!items.length) { root.innerHTML = '<p class="tb-big">No words this time. Choose New one.</p>'; return; }
    var clue = h("p", "tb-big", ""), slots = h("div", "tb-slots"), msg = h("p", "tb-msg", ""), row = h("div", "tb-row");
    row.innerHTML = '<button type="button" class="tb-btn" id="tbSpHint"><span aria-hidden="true">💡</span> A letter</button><button type="button" class="tb-btn go" id="tbSpNext" hidden>Next ▶</button>';
    var kb = keyboard(type, back); root.appendChild(clue); root.appendChild(slots); root.appendChild(msg); root.appendChild(row); root.appendChild(kb); root.lastChild.style.marginTop = "14px";
    var word = function () { return items[ix].word; };
    function show() {
      var it = items[ix]; locked = it.given; got = it.word.split("").map(function (L, k) { return k < locked ? L : ""; }); finished = false;
      clue.textContent = it.clue; msg.textContent = "Spell the word that fits."; $("tbSpNext").hidden = true;
      api.progress("Word " + (ix + 1) + " of " + items.length); draw();
      api.say(function () { return it.clue + ". It has " + it.word.length + " letters."; });
    }
    function draw() {
      var firstEmpty = got.indexOf("");
      slots.innerHTML = got.map(function (L, k) { return '<div class="tb-slot' + (k < locked ? " is-given" : "") + (k === firstEmpty && !finished ? " is-next" : "") + '" data-s="' + k + '">' + L + "</div>"; }).join("");
      slots.setAttribute("aria-label", word().length + " letters: " + got.map(function (L) { return L || "blank"; }).join(", "));
    }
    function type(L) {
      if (finished) return;
      var at = got.indexOf(""); if (at < 0) return;
      got[at] = L; draw();
      if (got.indexOf("") < 0) {
        if (got.join("") === word()) {
          finished = true; draw(); msg.textContent = praise() + " " + word().charAt(0) + word().slice(1).toLowerCase() + "."; chime(false); live(msg.textContent);
          if (ix === items.length - 1) cheer("All the words are spelled!", "New words"); else $("tbSpNext").hidden = false;
        } else { msg.textContent = "Nearly. Take a letter back, or tap A letter."; slots.classList.add("tb-shake"); }
      }
    }
    function back() {
      if (finished) return;
      var at = got.indexOf(""); at = at < 0 ? got.length : at;
      if (at > locked) { got[at - 1] = ""; draw(); msg.textContent = "Spell the word that fits."; }
    }
    row.addEventListener("click", function (e) {
      if (e.target.closest("#tbSpNext")) { ix++; show(); return; }
      if (e.target.closest("#tbSpHint") && !finished) { var at = got.indexOf(""); if (at >= 0) type(word().charAt(at)); else { got = got.map(function (L, k) { return k < locked ? L : ""; }); draw(); } }
    });
    api.hint(function () {
      if (finished) return; var at = got.indexOf(""); if (at < 0) return;
      Kit.glow(kb.querySelector('[data-k="' + word().charAt(at) + '"]'), 3600); var sl = slots.querySelector('[data-s="' + at + '"]'); if (sl) Kit.glow(sl, 3600);
    });
    api.assist(function () {
      got = word().split(""); finished = true; draw(); msg.textContent = praise() + " " + word().charAt(0) + word().slice(1).toLowerCase() + "."; chime(false);
      api.later(function () { cheer("All the words are spelled!", "New words"); }, 1100);
    });
    api.onKey(wordKeys(type, back)); show();
    api.debug(function () { return { word: word(), got: got, index: ix, count: items.length }; });
  }

  /* ===================== FINISH THE SAYING ===================== */
  function saying(root, o, api) {
    var S = T.sayings(o).items, ix = 0, answered = false;
    var big = h("p", "tb-big", ""), opts = h("div", "tb-opts"), msg = h("p", "tb-msg", ""), nav = h("div", "tb-row");
    nav.innerHTML = '<button type="button" class="tb-btn go" id="tbSyNext" hidden>Next ▶</button>';
    root.appendChild(big); root.appendChild(opts); root.appendChild(msg); root.appendChild(nav);
    function show() {
      var s = S[ix]; answered = false;
      big.innerHTML = esc(s.lead) + ' <span class="blank" style="display:inline-block;min-width:3.5ch;border-bottom:6px solid #1a202c">&nbsp;</span>';
      opts.innerHTML = s.options.map(function (t, k) { return '<button type="button" class="tb-opt" data-o="' + k + '">' + esc(t) + "</button>"; }).join("");
      msg.textContent = ""; $("tbSyNext").hidden = true; api.progress("Saying " + (ix + 1) + " of " + S.length);
      api.say(function () { return s.lead + " blank. Is it " + s.options.join(", or ") + "?"; });
    }
    opts.addEventListener("click", function (e) {
      var b = e.target.closest("[data-o]"); if (!b || answered) return; unlock(); answered = true;
      var s = S[ix], pick = s.options[+b.getAttribute("data-o")], right = pick === s.answer;
      Array.prototype.forEach.call(opts.children, function (x) { x.disabled = true; if (x.textContent === s.answer) x.classList.add("is-right"); });
      if (!right) b.classList.add("is-picked");
      big.innerHTML = esc(s.lead) + " <u>" + esc(s.answer) + "</u>";
      msg.textContent = right ? praise() : "Good thought. Here is how it goes."; if (right) chime(false); live(msg.textContent + " " + s.lead + " " + s.answer);
      if (ix === S.length - 1) setTimeout(function () { if (cur && cur.act.id === "saying") cheer("All done. Lovely work!", "More sayings"); }, 1300); else $("tbSyNext").hidden = false;
    });
    nav.addEventListener("click", function () { ix++; show(); });
    show();
    var rightBtn = function () { return Array.prototype.filter.call(opts.children, function (x) { return x.textContent === S[ix].answer; })[0]; };
    api.hint(function () { if (!answered) Kit.glow(rightBtn(), 3600); });
    api.assist(function () { ix = S.length - 1; show(); var b = rightBtn(); if (b) b.click(); });
    api.debug(function () { return { item: S[ix], index: ix, count: S.length }; });
  }

  /* ===================== SORT IT ===================== */
  function sort(root, o, api) {
    var d = T.sortIt(o), ix = 0, answered = false, right = 0;
    var card = h("div", "tb-card", ""), opts = h("div", "tb-opts"), msg = h("p", "tb-msg", ""), nav = h("div", "tb-row");
    nav.innerHTML = '<button type="button" class="tb-btn go" id="tbSoNext" hidden>Next ▶</button>';
    root.appendChild(h("p", "tb-h", "Which group does it go with?")); root.appendChild(card); root.appendChild(opts); root.appendChild(msg); root.appendChild(nav);
    function show() {
      var it = d.items[ix]; answered = false; card.textContent = it.word.charAt(0) + it.word.slice(1).toLowerCase(); card.setAttribute("data-w", it.word);
      opts.innerHTML = d.groups.map(function (g, k) { return '<button type="button" class="tb-opt" data-g="' + k + '">' + esc(g.label) + "</button>"; }).join("");
      msg.textContent = ""; $("tbSoNext").hidden = true; api.progress("Item " + (ix + 1) + " of " + d.items.length);
      api.say(function () { return it.word + ". Does it go with " + d.groups[0].label + ", or " + d.groups[1].label + "?"; });
    }
    opts.addEventListener("click", function (e) {
      var b = e.target.closest("[data-g]"); if (!b || answered) return; unlock(); answered = true;
      var it = d.items[ix], ok = +b.getAttribute("data-g") === it.group;
      Array.prototype.forEach.call(opts.children, function (x) { x.disabled = true; if (+x.getAttribute("data-g") === it.group) x.classList.add("is-right"); });
      if (!ok) b.classList.add("is-picked"); else right++;
      msg.textContent = (ok ? praise() + " " : "") + card.textContent + ": " + d.groups[it.group].one + "."; if (ok) chime(false); live(msg.textContent);
      if (ix === d.items.length - 1) setTimeout(function () { if (cur && cur.act.id === "sort") cheer("All sorted. Nicely done!", "Sort more"); }, 1300); else $("tbSoNext").hidden = false;
    });
    nav.addEventListener("click", function () { ix++; show(); });
    show();
    var rightG = function () { return opts.querySelector('[data-g="' + d.items[ix].group + '"]'); };
    api.hint(function () { if (!answered) Kit.glow(rightG(), 3600); });
    api.assist(function () { ix = d.items.length - 1; show(); var b = rightG(); if (b) b.click(); });
    api.debug(function () { return { item: d.items[ix], groups: d.groups, index: ix }; });
  }

  /* ===================== PUT IT IN ORDER ===================== */
  function order(root, o, api) {
    var all = T.inOrder(o).items, ix = 0, placed = 0;
    var title = h("p", "tb-h", ""), slots = h("ol", "tb-placed"), pool = h("div", "tb-order"), msg = h("p", "tb-msg", ""), nav = h("div", "tb-row");
    nav.innerHTML = '<button type="button" class="tb-btn go" id="tbOrNext" hidden>Next ▶</button>';
    var both = h("div", "tb-split"); both.appendChild(slots); both.appendChild(pool);
    [title, both, msg, nav].forEach(function (x) { root.appendChild(x); });
    function show() {
      var it = all[ix]; placed = 0;
      title.textContent = it.title + ": tap the steps in the order they happen.";
      slots.innerHTML = it.steps.map(function (s, k) { return '<li data-slot="' + k + '"><b>' + (k + 1) + '</b><span></span></li>'; }).join("");
      pool.innerHTML = it.order.map(function (k) { return '<button type="button" class="tb-opt" data-step="' + k + '">' + esc(it.steps[k]) + "</button>"; }).join("");
      msg.textContent = "What comes first?"; $("tbOrNext").hidden = true; api.progress("Activity " + (ix + 1) + " of " + all.length);
      api.say(function () { return it.title + ". Which comes first? " + it.order.map(function (k) { return it.steps[k]; }).join(". "); });
    }
    pool.addEventListener("click", function (e) {
      var b = e.target.closest("[data-step]"); if (!b || b.disabled) return; unlock();
      var it = all[ix], k = +b.getAttribute("data-step");
      if (k === placed) {
        var li = slots.querySelector('[data-slot="' + placed + '"]'); li.classList.add("is-on"); li.querySelector("span").textContent = it.steps[k];
        b.disabled = true; b.classList.add("is-matched"); b.style.visibility = "hidden"; placed++; chime(false);
        if (placed === it.steps.length) { msg.textContent = praise(); live(msg.textContent); if (ix === all.length - 1) setTimeout(function () { if (cur && cur.act.id === "order") cheer("Every step in its place!", "More to put in order"); }, 900); else $("tbOrNext").hidden = false; }
        else msg.textContent = "And then?";
      } else { b.classList.remove("is-shake"); void b.offsetWidth; b.classList.add("is-shake"); msg.textContent = "Not quite yet. Try another step."; live(msg.textContent); }
    });
    nav.addEventListener("click", function () { ix++; show(); });
    show();
    api.hint(function () { var b = pool.querySelector('[data-step="' + placed + '"]'); if (b && !b.disabled) Kit.glow(b, 3600); });
    api.assist(function () {
      ix = all.length - 1; show();
      all[ix].steps.forEach(function (st, k) { api.later(function () { var b = pool.querySelector('[data-step="' + k + '"]'); if (b) b.click(); }, 420 * k); });
    });
    api.debug(function () { return { item: all[ix], index: ix, placed: placed }; });
  }

  /* ===================== MATCH THE CLUE ===================== */
  function match(root, o, api) {
    var m = T.matchUp(o), pickW = null, pickC = null, matched = 0, n = m.pairs.length;
    var cols = h("div", "tb-cols"), msg = h("p", "tb-msg", "Tap a word, then the clue that goes with it.");
    var truth = {}; m.pairs.forEach(function (p) { truth[p.word] = p.clue; });
    m.words.forEach(function (w) { var b = h("button", "tb-opt", esc(w.charAt(0) + w.slice(1).toLowerCase())); b.type = "button"; b.setAttribute("data-word", w); cols.appendChild(b); });
    m.clues.forEach(function (c) { var b = h("button", "tb-opt", esc(c)); b.type = "button"; b.setAttribute("data-clue", c); cols.appendChild(b); });
    // words in the left column, clues in the right: the grid's two columns hold them in turn
    var L = Array.prototype.slice.call(cols.querySelectorAll("[data-word]")), R = Array.prototype.slice.call(cols.querySelectorAll("[data-clue]"));
    cols.innerHTML = ""; for (var k = 0; k < n; k++) { cols.appendChild(L[k]); cols.appendChild(R[k]); }
    root.appendChild(cols); root.appendChild(msg); api.progress("0 of " + n + " matched");
    function setPick(b, which) { var prev = which === "w" ? pickW : pickC; if (prev) { prev.classList.remove("is-picked"); prev.setAttribute("aria-pressed", "false"); } if (b) { b.classList.add("is-picked"); b.setAttribute("aria-pressed", "true"); } if (which === "w") pickW = b; else pickC = b; }
    cols.addEventListener("click", function (e) {
      var b = e.target.closest(".tb-opt"); if (!b || b.disabled) return; unlock();
      var isW = b.hasAttribute("data-word"); setPick(b === (isW ? pickW : pickC) ? null : b, isW ? "w" : "c");
      if (!pickW || !pickC) return;
      if (truth[pickW.getAttribute("data-word")] === pickC.getAttribute("data-clue")) {
        [pickW, pickC].forEach(function (x) { x.disabled = true; x.classList.remove("is-picked"); x.classList.add("is-matched"); x.innerHTML += " ✓"; });
        pickW = pickC = null; matched++; chime(false); msg.textContent = praise(); api.progress(matched + " of " + n + " matched"); live(msg.textContent);
        if (matched === n) setTimeout(function () { if (cur && cur.act.id === "match") cheer("Every pair is matched!", "More to match"); }, 700);
      } else {
        var a1 = pickW, a2 = pickC; pickW = pickC = null;
        [a1, a2].forEach(function (x) { x.classList.remove("is-picked"); x.setAttribute("aria-pressed", "false"); x.classList.remove("is-shake"); void x.offsetWidth; x.classList.add("is-shake"); });
        msg.textContent = "Those two do not go together. Try another."; live(msg.textContent);
      }
    });
    api.say(function () { return "Match each word with its clue. " + m.pairs.map(function (p) { return p.word.toLowerCase() + ": " + p.clue; }).join(". "); });
    function clueOf(w) { return R.filter(function (b) { return b.getAttribute("data-clue") === truth[w.getAttribute("data-word")]; })[0]; }
    api.hint(function () { var w = L.filter(function (b) { return !b.disabled; })[0]; if (!w) return; Kit.glow(w, 3600); Kit.glow(clueOf(w), 3600); });
    api.assist(function () {
      L.filter(function (b) { return !b.disabled; }).forEach(function (w, j) { api.later(function () { var c = clueOf(w); if (w.disabled || !c) return; w.click(); c.click(); }, 520 * j); });
    });
    api.debug(function () { return { truth: truth, matched: matched, n: n }; });
  }

  /* ===================== ODD ONE OUT ===================== */
  function odd(root, o, api) {
    var rounds = T.oddOne(o).rounds, ix = 0, answered = false;
    var q = h("p", "tb-h", "Three of these go together. Which one does not belong?"), opts = h("div", "tb-opts"), msg = h("p", "tb-msg", ""), nav = h("div", "tb-row");
    nav.innerHTML = '<button type="button" class="tb-btn go" id="tbOdNext" hidden>Next ▶</button>';
    [q, opts, msg, nav].forEach(function (x) { root.appendChild(x); });
    function show() {
      var r = rounds[ix]; answered = false;
      opts.innerHTML = r.cards.map(function (c, k) { return '<button type="button" class="tb-opt" data-c="' + k + '" data-odd="' + (c.odd ? 1 : 0) + '">' + esc(c.word.charAt(0) + c.word.slice(1).toLowerCase()) + "</button>"; }).join("");
      msg.textContent = ""; $("tbOdNext").hidden = true; api.progress("Round " + (ix + 1) + " of " + rounds.length);
      api.say(function () { return "Which one does not belong? " + r.cards.map(function (c) { return c.word.toLowerCase(); }).join(", "); });
    }
    opts.addEventListener("click", function (e) {
      var b = e.target.closest("[data-c]"); if (!b || answered) return; unlock(); answered = true;
      var r = rounds[ix], ok = b.getAttribute("data-odd") === "1";
      Array.prototype.forEach.call(opts.children, function (x) { x.disabled = true; if (x.getAttribute("data-odd") === "1") x.classList.add("is-right"); });
      if (!ok) b.classList.add("is-picked");
      msg.textContent = (ok ? praise() + " " : "") + "The other three are " + r.together.toLowerCase() + "."; if (ok) chime(false); live(msg.textContent);
      if (ix === rounds.length - 1) setTimeout(function () { if (cur && cur.act.id === "odd") cheer("All done. Nicely spotted!", "More to spot"); }, 1300); else $("tbOdNext").hidden = false;
    });
    nav.addEventListener("click", function () { ix++; show(); });
    show();
    var oddBtn = function () { return opts.querySelector('[data-odd="1"]'); };
    api.hint(function () { if (!answered) Kit.glow(oddBtn(), 3600); });
    api.assist(function () { ix = rounds.length - 1; show(); var b = oddBtn(); if (b) b.click(); });
    api.debug(function () { return { round: rounds[ix], index: ix }; });
  }

  /* ===================== COLOR A PICTURE ===================== */
  var COLORS = [["Red", "#d94b3d"], ["Orange", "#f08a24"], ["Yellow", "#f2c230", 1], ["Green", "#4a9d5b"], ["Teal", "#2e8b8b"], ["Blue", "#4f6fc2"], ["Purple", "#8e5bb5"], ["Pink", "#ee9ab8", 1], ["Brown", "#9a6a43"], ["White", "#ffffff", 1]];
  function palette(onPick, start) {
    var pal = h("div", "tb-pal"); pal.setAttribute("role", "group"); pal.setAttribute("aria-label", "Colors");
    COLORS.forEach(function (c, k) {
      var b = h("button", "tb-sw" + (c[2] ? " light" : "")); b.type = "button"; b.style.background = c[1]; b.setAttribute("aria-label", c[0]); b.setAttribute("aria-pressed", String(k === start)); b.setAttribute("data-color", c[1]); pal.appendChild(b);
    });
    pal.addEventListener("click", function (e) {
      var b = e.target.closest(".tb-sw"); if (!b) return;
      Array.prototype.forEach.call(pal.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); }); onPick(b.getAttribute("data-color"), b.getAttribute("aria-label"));
    });
    return pal;
  }
  function loadColoring(cb) {
    if (window.CognicopiaColoring) return cb(true);
    var s = document.createElement("script"); s.src = "assets/cognicopia-coloring/cognicopia-coloring.js";
    s.onload = function () { cb(!!window.CognicopiaColoring); }; s.onerror = function () { cb(false); }; document.head.appendChild(s);
  }
  function color(root, o, api) {
    root.innerHTML = '<p class="tb-big">Getting the pictures ready…</p>';
    loadColoring(function (ok) {
      if (!ok || !cur || cur.act.id !== "color") { if (!ok && cur) root.innerHTML = '<p class="tb-big">The pictures could not be loaded. Choose Menu, then try again.</p>'; return; }
      var C = window.CognicopiaColoring, tier = T.STAGES[o.stage].color.tier;
      /* a tap colors one path, so only offer pictures drawn as at least three (a remade picture drawn as one path would color all at once) */
      var shapesOf = function (id) { return (C.toSVG(C.render(id, tier), { standalone: true, widthIn: 2, label: "" }).match(/<path/g) || []).length; };
      var offered = C.designs().filter(function (d) { try { return shapesOf(d.id) >= 3; } catch (e) { return false; } });
      var ids = T.designChoices(o, offered.length >= 6 ? offered : C.designs()), fillAll = null;
      function choose() {
        fillAll = null;
        api.hint(function () { Kit.glow(root.querySelector(".tb-pic"), 3600); });
        api.assist(function () { var b = root.querySelector(".tb-pic"); if (b) b.click(); api.later(function () { if (fillAll) fillAll(); else cheer("Your picture is finished!", "Another picture"); }, 300); });
        root.innerHTML = '<p class="tb-h">Choose a picture to color</p>'; api.progress("");
        var grid = h("div", "tb-pics");
        ids.forEach(function (id) {
          var b = h("button", "tb-pic", C.toSVG(C.render(id, 3), { standalone: true, widthIn: 2, label: C.design(id).title })); b.type = "button"; b.setAttribute("data-id", id); b.setAttribute("aria-label", C.design(id).title);
          var sv = b.querySelector("svg"); if (sv) { sv.removeAttribute("width"); sv.removeAttribute("height"); } grid.appendChild(b);
        });
        grid.addEventListener("click", function (e) { var b = e.target.closest(".tb-pic"); if (b) paintIt(b.getAttribute("data-id")); });
        root.appendChild(grid); api.debug(function () { return { stage: "choose", ids: ids }; });
      }
      function paintIt(id) {
        root.innerHTML = ""; api.progress(C.design(id).title);
        var split = h("div", "tb-split"), art = h("div", "tb-art"), side = h("div", "tb-side"), fill = COLORS[0][1], hist = [];
        split.style.alignItems = "stretch";
        art.innerHTML = C.toSVG(C.render(id, tier), { standalone: true, widthIn: 6, label: C.design(id).title + ", a picture to color" });
        var sv = art.querySelector("svg"); sv.removeAttribute("width"); sv.removeAttribute("height");
        side.style.flex = "0 1 320px";
        side.appendChild(h("p", "tb-h", "Pick a color, then tap a shape"));
        side.appendChild(palette(function (c) { fill = c; }, 0));
        var bar = h("div", "tb-row"); bar.style.marginTop = "14px";
        bar.innerHTML = '<button type="button" class="tb-btn" data-co="undo">↶ Undo</button><button type="button" class="tb-btn" data-co="clear">Start over</button><button type="button" class="tb-btn" data-co="pick">Another picture</button>';
        side.appendChild(bar); split.appendChild(art); split.appendChild(side); root.appendChild(split);
        sv.addEventListener("click", function (e) {
          var p = e.target.closest("path"); if (!p) return; unlock();
          hist.push([p, p.style.fill || ""]); p.style.fill = fill; tick();
        });
        bar.addEventListener("click", function (e) {
          var b = e.target.closest("[data-co]"); if (!b) return; var what = b.getAttribute("data-co");
          if (what === "undo") { var h2 = hist.pop(); if (h2) h2[0].style.fill = h2[1]; }
          if (what === "clear") { while (hist.length) { var h3 = hist.pop(); h3[0].style.fill = h3[1]; } }
          if (what === "pick") choose();
        });
        var shapes = Array.prototype.slice.call(sv.querySelectorAll("path"));
        fillAll = function () {
          var pal = COLORS.map(function (c) { return c[1]; }), open = shapes.filter(function (p) { return !p.style.fill; }), gap = Math.min(140, 4200 / Math.max(1, open.length));
          open.forEach(function (p, k) { api.later(function () { hist.push([p, ""]); p.style.fill = pal[k % pal.length]; tick(); }, gap * k); });
          api.later(function () { cheer("Your picture is finished!", "Another picture"); }, gap * open.length + 900);
        };
        api.hint(function () { var p = shapes.filter(function (x) { return !x.style.fill; })[0]; Kit.glow(p || side.querySelector(".tb-pal"), 3600); });
        api.assist(fillAll);
        api.say(function () { return "Pick a color, then tap a shape to color it."; });
        api.debug(function () { return { stage: "paint", id: id, shapes: sv.querySelectorAll("path").length, filled: hist.length }; });
      }
      choose();
    });
  }

  /* ===================== FINGER PAINT ===================== */
  function paint(root, o, api) {
    var cv = h("canvas", "tb-paint"), strokes = [], col = COLORS[0][1], width = 14, down = null;
    var bar = h("div", "tb-row"); bar.style.margin = "12px 0 0";
    bar.appendChild(palette(function (c) { col = c; }, 0)); bar.firstChild.style.maxWidth = "560px";
    var tools = h("div", "tb-row"); tools.innerHTML = '<button type="button" class="tb-btn" data-pw="6">Thin</button><button type="button" class="tb-btn" data-pw="14">Medium</button><button type="button" class="tb-btn" data-pw="30">Thick</button><button type="button" class="tb-btn" data-pw="undo">↶ Undo</button><button type="button" class="tb-btn" data-pw="clear">Clear</button>';
    root.appendChild(cv); root.appendChild(bar); root.appendChild(tools);
    var ctx = cv.getContext("2d");
    function fit() { var r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.max(50, Math.round(r.width * d)); cv.height = Math.max(50, Math.round(r.height * d)); redraw(); }
    function seg(s, from, to) { ctx.strokeStyle = s.c; ctx.fillStyle = s.c; ctx.lineWidth = s.w * cv.width / 1000; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(from[0] * cv.width, from[1] * cv.height); ctx.lineTo(to[0] * cv.width, to[1] * cv.height); ctx.stroke(); }
    function redraw() { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); strokes.forEach(function (s) { if (s.p.length === 1) seg(s, s.p[0], s.p[0]); for (var k = 1; k < s.p.length; k++) seg(s, s.p[k - 1], s.p[k]); }); }
    var pt = function (e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    cv.addEventListener("pointerdown", function (e) { unlock(); e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* mouse */ } down = { c: col, w: width, p: [pt(e)] }; strokes.push(down); seg(down, down.p[0], down.p[0]); });
    cv.addEventListener("pointermove", function (e) { if (!down) return; var p = pt(e), last = down.p[down.p.length - 1]; down.p.push(p); seg(down, last, p); });
    var end = function () { down = null; }; cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    tools.addEventListener("click", function (e) {
      var b = e.target.closest("[data-pw]"); if (!b) return; var k = b.getAttribute("data-pw");
      if (k === "undo") { strokes.pop(); redraw(); } else if (k === "clear") { strokes.length = 0; redraw(); } else width = +k;
    });
    api.hint(function () { Kit.glow(cv, 3600); });
    api.assist(function () {
      var cols = COLORS.map(function (c) { return c[1]; });
      [0.3, 0.5, 0.7].forEach(function (fy, k) {
        var st = { c: cols[(k * 3 + 1) % cols.length], w: 22, p: [] }; strokes.push(st);
        for (var j = 0; j <= 30; j++) (function (j2) { api.later(function () { var p = [0.1 + 0.8 * j2 / 30, fy + 0.08 * Math.sin(j2 / 30 * 6.28 * (k + 1))], prev = st.p[st.p.length - 1]; st.p.push(p); seg(st, prev || p, p); }, k * 700 + j2 * 20); })(j);
      });
      api.later(function () { cheer("What a lovely painting!", "Paint again"); }, 2900);
    });
    fit(); api.onResize(fit); api.progress("");
    api.say(function () { return "Choose a color and paint with your finger."; });
    api.debug(function () { return { strokes: strokes.length, canvas: cv, pixel: function (x, y) { return Array.prototype.slice.call(ctx.getImageData(x, y, 1, 1).data); } }; });
  }

  /* ===================== BUBBLES ===================== */
  function bubbles(root, o, api) {
    var late = o.stage === "late", sky = h("div", "tb-sky"), list = [], raf = 0, last = 0, still = reduced(), popped = 0;
    sky.setAttribute("aria-label", "Bubbles to pop. Tap a bubble."); root.appendChild(sky);
    root.appendChild(h("p", "tb-msg", "Tap a bubble to pop it. Take your time, and pop as many as you like."));
    var maxN = late ? 6 : 9;
    function spawn() {
      var w = sky.clientWidth, hh = sky.clientHeight, d = (late ? 110 : 80) + Math.random() * (late ? 50 : 50);
      var b = h("button", "tb-bub"); b.type = "button"; b.style.width = b.style.height = d + "px"; b.setAttribute("aria-label", "Bubble");
      var o2 = { el: b, d: d, x: Math.random() * Math.max(10, w - d), y: still ? 20 + Math.random() * Math.max(10, hh - d - 40) : hh + 10, vy: (late ? 18 : 28) + Math.random() * 22, ph: Math.random() * 6.28 };
      b.addEventListener("pointerdown", function (e) { e.preventDefault(); unlock(); popIt(o2); });
      b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); popIt(o2); } });
      sky.appendChild(b); list.push(o2); place(o2);
    }
    function place(b) { b.el.style.transform = "translate(" + (b.x + (still ? 0 : Math.sin(b.ph) * 14)).toFixed(1) + "px," + b.y.toFixed(1) + "px)"; }
    function popIt(b) {
      var i = list.indexOf(b); if (i < 0) return; list.splice(i, 1); popped++; pop();
      b.el.classList.add("is-pop"); b.el.style.transform += " scale(1.35)"; setTimeout(function () { b.el.remove(); }, 400);
      if (still) setTimeout(function () { if (cur && cur.act.id === "bubbles") spawn(); }, 600);
    }
    function frame(t) {
      var dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
      for (var i = list.length - 1; i >= 0; i--) { var b = list[i]; b.y -= b.vy * dt; b.ph += dt * 1.2; if (b.y < -b.d - 10) { b.el.remove(); list.splice(i, 1); } else place(b); }
      if (list.length < maxN && Math.random() < dt * 1.4) spawn();
      raf = requestAnimationFrame(frame);
    }
    for (var k = 0; k < (still ? maxN - 2 : 4); k++) { spawn(); if (!still) list[k].y = 40 + Math.random() * (sky.clientHeight - 140); }
    if (!still) raf = requestAnimationFrame(frame);
    api.hint(function () { var b = list[Math.floor(Math.random() * list.length)]; if (b) Kit.glow(b.el, 3600); });
    api.assist(function () {
      list.slice().forEach(function (b, k) { api.later(function () { popIt(b); }, 160 * k); });
      api.later(function () { cheer("Every bubble has floated away.", "More bubbles"); }, 160 * list.length + 900);
    });
    api.progress(""); api.say(function () { return "Tap the bubbles to pop them."; });
    api.debug(function () { return { count: function () { return list.length; }, popped: function () { return popped; }, centers: function () { return list.map(function (b) { var r = b.el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); } }; });
    return function () { cancelAnimationFrame(raf); };
  }

  /* ---------- the menu ---------- */
  var ICON = {
    wordsearch: '<rect x="8" y="8" width="48" height="48" rx="6"/><path d="M20 8v48M32 8v48M44 8v48M8 20h48M8 32h48M8 44h48"/><path d="M14 50 50 14" stroke-width="7"/>',
    crossword: '<rect x="8" y="8" width="48" height="48"/><path d="M8 24h48M8 40h48M24 8v48M40 8v48"/><rect x="24" y="24" width="16" height="16"/>',
    spell: '<path d="M8 52h14M25 52h14M42 52h14"/><path d="M14 38 22 12l8 26M17 28h10"/><path d="M40 12h14M47 12v26"/>',
    saying: '<path d="M8 10h48v32H28L16 54V42H8z"/><path d="M18 22h28M18 31h18"/>',
    color: '<path d="M32 8C16 8 6 20 6 32s10 24 22 24c6 0 6-6 2-10s0-8 6-8h12c6 0 10-4 10-10C58 16 46 8 32 8z"/><circle cx="20" cy="28" r="3"/><circle cx="32" cy="20" r="3"/><circle cx="44" cy="26" r="3"/>',
    paint: '<path d="M10 54c8 0 12-4 12-10l26-28 6 6-28 26c-2 8-8 12-16 6z"/>',
    bubbles: '<circle cx="22" cy="40" r="14"/><circle cx="46" cy="22" r="9"/><circle cx="46" cy="48" r="6"/>',
    sort: '<rect x="6" y="36" width="22" height="20"/><rect x="36" y="36" width="22" height="20"/><path d="M32 6v18M24 16l8 8 8-8"/>',
    order: '<path d="M22 14h34M22 32h34M22 50h34"/><circle cx="10" cy="14" r="3"/><circle cx="10" cy="32" r="3"/><circle cx="10" cy="50" r="3"/>',
    match: '<circle cx="14" cy="32" r="9"/><circle cx="50" cy="32" r="9"/><path d="M23 32h18"/>',
    odd: '<circle cx="12" cy="20" r="8"/><circle cx="32" cy="20" r="8"/><circle cx="52" cy="20" r="8"/><rect x="24" y="38" width="16" height="16"/>'
  };
  [
    ["wordsearch", 0, 1, "Word Search", "Slide a finger along a hidden word.", wordSearch],
    ["crossword", 0, 2, "Crossword", "Tap a square, then tap letters on the keyboard.", crossword],
    ["spell", 0, 3, "Spell It", "A clue, and letters to tap in order.", spell],
    ["saying", 0, 4, "Finish the Saying", "Choose the word that completes it.", saying],
    ["color", 1, 2, "Color a Picture", "Pick a color, tap a shape.", color],
    ["paint", 1, 3, "Finger Paint", "Paint freely with colors.", paint],
    ["bubbles", 1, 4, "Bubbles", "Tap the drifting bubbles. Calm and gentle.", bubbles],
    ["sort", 2, 1, "Sort It", "Which group does it go with?", sort],
    ["order", 2, 2, "Put It in Order", "Tap the steps in the order they happen.", order],
    ["match", 2, 3, "Match the Clue", "Join each word with its clue.", match],
    ["odd", 2, 4, "Odd One Out", "Three go together. Which one does not?", odd]
  ].forEach(function (a) { Kit.register({ id: a[0], group: a[1], order: a[2], title: a[3], blurb: a[4], icon: ICON[a[0]], start: a[5] }); });

  var GROUPS = [["Words and letters", "Search, fill in and finish."], ["Follow and create", "Hands-on, with a finger."], ["Think and match", "Sort, order, match and listen."]];
  var menu = $("tbMenu"), defs = Kit.registered();
  GROUPS.forEach(function (g, gi) {
    var sec = h("div", "", "<h2>" + esc(g[0]) + "<small>" + esc(g[1]) + "</small></h2>"), ul = h("ul", "tbp-grid");
    defs.filter(function (d) { return d.group === gi; }).forEach(function (a) {
      ACT[a.id] = { id: a.id, title: a.title, start: a.start };
      ul.appendChild(h("li", "", '<button type="button" class="tbp-card" data-act="' + a.id + '"><svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + a.icon + "</svg><b>" + esc(a.title) + "</b><span>" + esc(a.blurb) + "</span></button>"));
    });
    sec.appendChild(ul); menu.appendChild(sec);
  });
  menu.addEventListener("click", function (e) { var b = e.target.closest("[data-act]"); if (b) openAct(b.getAttribute("data-act"), b); });
  /* Surprise me: the tablet chooses, and never the same one twice in a row */
  var lastSurprise = "";
  $("tbSurprise").addEventListener("click", function () {
    var ids = Object.keys(ACT).filter(function (k) { return k !== lastSurprise; });
    lastSurprise = ids[Math.floor(Math.random() * ids.length)];
    openAct(lastSurprise, $("tbSurprise"));
  });

  /* the choices at the top */
  var topic = $("tbTopic");
  T.TOPICS.slice().sort(function (a, b) { return a.label < b.label ? -1 : 1; }).forEach(function (t) { var op = document.createElement("option"); op.value = t.id; op.textContent = t.label.charAt(0).toUpperCase() + t.label.slice(1); topic.appendChild(op); });
  topic.value = prefs.topic; $({ early: "tbStageEarly", middle: "tbStageMiddle", late: "tbStageLate" }[prefs.stage]).checked = true;
  topic.addEventListener("change", function () { prefs.topic = topic.value; savePrefs(); });
  Array.prototype.forEach.call(document.querySelectorAll("input[name=stage]"), function (r) { r.addEventListener("change", function () { if (r.checked) { prefs.stage = r.value; savePrefs(); } }); });
  function soundLabel() { var b = $("tbSound"); b.textContent = prefs.sound ? "🔔 Sound: On" : "🔕 Sound: Off"; b.setAttribute("aria-pressed", String(prefs.sound)); }
  $("tbSound").addEventListener("click", function () { prefs.sound = !prefs.sound; savePrefs(); soundLabel(); if (prefs.sound) chime(false); });
  soundLabel();
  $("tbFull").addEventListener("click", function () { try { var f = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen; if (f) { var r = f.call(document.documentElement); if (r && r.catch) r.catch(function () { /* the browser said no */ }); } } catch (e) { /* not available */ } });
  $("tbGateClose").addEventListener("click", function () { $("tbGate").hidden = true; });

  /* the bar inside an activity */
  $("tbBack").addEventListener("click", closeAct);
  $("tbNew").addEventListener("click", function () { if (cur) next(); });
  $("tbSay").addEventListener("click", function () { if (cur && cur.say) speak(cur.say()); });
  $("tbAssist").addEventListener("click", function () {
    var me = cur; if (!me || me.done || me.assisting || !me.assistFn) return;
    me.assisting = true; stopIdle(); unlock(); live("Finishing this one for you.");
    try { me.assistFn(); } catch (e) { cheer("All done. Lovely!", "Another one"); return; }
    later(function () { if (!me.done) cheer("All done. Lovely!", "Another one"); }, 12000);   // however an activity ends its help, the help always ends
  });
  stage.addEventListener("click", function (e) {
    var b = e.target.closest("[data-cheer]"); if (!b) return;
    if (b.getAttribute("data-cheer") === "menu") closeAct(); else if (cur) next();
  });
  /* any touch or key press means someone is here: the quiet-moment hint starts counting again */
  overlay.addEventListener("pointerdown", armIdle, true);
  overlay.addEventListener("touchstart", armIdle, { capture: true, passive: true });
  overlay.addEventListener("keydown", armIdle, true);
  document.addEventListener("keydown", function (e) {
    if (overlay.hidden) { if (e.key === "Escape" && !$("tbGate").hidden) $("tbGate").hidden = true; return; }
    if (e.key === "Escape") { closeAct(); return; }
    if (cur && cur.onKey && !/^(INPUT|SELECT|TEXTAREA)$/.test((document.activeElement || {}).tagName || "")) cur.onKey(e);
  });
  window.addEventListener("resize", function () { if (cur && cur.onResize) cur.onResize(); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && !overlay.hidden) { wakeLock(); armIdle(); } else stopIdle();
  });
  window.addEventListener("pagehide", hush);

  window.CognicopiaTabletUI = {
    activities: Object.keys(ACT), open: function (id) { openAct(id); }, close: closeAct,
    current: function () { return cur ? cur.act.id : null; }, debug: function () { return cur && cur.debug ? cur.debug() : null; },
    prefs: function () { return JSON.parse(JSON.stringify(prefs)); },
    /* for the checks: how long a quiet moment is, and what the shell has done for this activity */
    idleMs: function (ms) { if (ms > 0) { idleMs = ms; armIdle(); } return idleMs; },
    stats: function () { return cur ? { hints: cur.hints, assisting: cur.assisting, done: cur.done, assist: !!cur.assistFn, hint: !!cur.hintFn } : null; }
  };
})();
