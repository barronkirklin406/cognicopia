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
  var T = window.CognicopiaTablet, Kit = window.CognicopiaTabletKit, Art = window.CognicopiaTabletArt;
  if (!T || !Kit || !document.getElementById("tbMenu")) return;

  var $ = function (id) { return document.getElementById(id); };
  var esc = Kit.esc, h = Kit.h, reduced = Kit.reduced, LETTERS = Kit.LETTERS;
  var PRAISE = ["That's it!", "Lovely!", "Wonderful!", "Just right!", "Nicely done!"];
  var praise = function () { return PRAISE[Math.floor(Math.random() * PRAISE.length)]; };

  /* ---------- what is remembered in this browser: the choices only, never what anyone did ---------- */
  var PREFS_KEY = "cognicopia_tablet_prefs", prefs = { stage: "middle", topic: "", era: "", sound: true, speed: 2, grid: 0, palette: 0, paper: 0 };
  try {
    var saved = JSON.parse(window.localStorage.getItem(PREFS_KEY) || "null");
    if (saved) {
      if (T.STAGES[saved.stage]) prefs.stage = saved.stage;
      if (T.TOPICS.some(function (t) { return t.id === saved.topic; })) prefs.topic = saved.topic;
      if (/^19[4-8]0s$/.test(saved.era)) prefs.era = saved.era;
      if (saved.sound === false) prefs.sound = false;
      if (saved.speed >= 1 && saved.speed <= 4) prefs.speed = Math.round(saved.speed);
      if (saved.grid >= 3 && saved.grid <= 6) prefs.grid = Math.round(saved.grid);
      if (saved.palette >= 0 && saved.palette <= 3) prefs.palette = Math.round(saved.palette);
      if (saved.paper >= 0 && saved.paper <= 3) prefs.paper = Math.round(saved.paper);
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
    var K = window.CogniVoice;
    if (K) { K.speak(text); return; }
    try {                                    // the voice kit did not load: the device's own first local voice
      var synth = window.speechSynthesis; synth.cancel();
      var u = new window.SpeechSynthesisUtterance(text), vs = synth.getVoices() || [];
      var v = vs.filter(function (x) { return /^en/i.test(x.lang) && x.localService; })[0];
      u.rate = 0.9; u.pitch = 1; u.lang = "en-US"; if (v) { u.voice = v; u.lang = v.lang; }
      synth.speak(u);
    } catch (e) { /* no voice: the text is on the screen */ }
  }
  var hush = function () { try { if (window.CogniVoice) window.CogniVoice.stop(); else if (canSpeak) window.speechSynthesis.cancel(); } catch (e) { /* nothing to stop */ } };

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
    var colors = ["#1c5963", "#c5a059", "#f6cdb4", "#95c8cd", "#e8cc8a", "#8a3a20"];
    for (var i = 0; i < 14; i++) {
      var d = h("span", "tb-burst"), a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 90;
      d.style.left = x + "px"; d.style.top = y + "px"; d.style.background = colors[i % colors.length];
      d.style.setProperty("--dx", Math.cos(a) * r + "px"); d.style.setProperty("--dy", Math.sin(a) * r - 40 + "px");
      document.body.appendChild(d); setTimeout(function (n) { n.remove(); }.bind(null, d), 1200);
    }
  }
  /* the finish: a warm medal, a chime, a little confetti, and a way on. Used when the work is done and when "Finish for me" is pressed. */
  var MEDAL = '<svg class="tb-medal" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><g class="ray" stroke="#c5a059" stroke-width="5" stroke-linecap="round" fill="none"><path d="M60 4v14M60 102v14M4 60h14M102 60h14M20 20l10 10M90 90l10 10M100 20 90 30M30 90l-10 10"/></g>' +
    '<circle cx="60" cy="58" r="34" fill="#f1dda8" stroke="#0e3c43" stroke-width="5"/><path d="M60 38l6.6 13.4 14.8 2.1-10.7 10.4 2.5 14.7L60 71.6 46.8 78.6l2.5-14.7L38.6 53.5l14.8-2.1z" fill="#0e3c43"/>' +
    '<path d="M42 88l-8 24 16-8 6 10 4-22zM78 88l8 24-16-8-6 10-4-22z" fill="#c5a059" stroke="#0e3c43" stroke-width="4" stroke-linejoin="round"/></svg>';
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
  /* Calm mode (Sundowning / De-escalation): the late stage's size and count, and only the slow, one-thing-at-a-time activities. Not saved:
     it is a switch on this screen, and the level chosen above is the one that comes back. */
  var calmOn = false, avoidTerms = [];
  function effStage() { return calmOn ? "late" : prefs.stage; }
  function run(act, seed) {
    teardown();
    stage.innerHTML = ""; stage.scrollTop = 0;
    $("tbProg").textContent = ""; $("tbSay").hidden = true; $("tbAssist").hidden = true; $("tbAssist").disabled = false; $("tbNew").hidden = false; live("");
    var me = cur = { act: act, seed: seed, say: null, cleanup: null, debug: null, onKey: null, onResize: null, assistFn: null, hintFn: null, done: false, assisting: false, timers: [], hints: 0, used: null };
    var api = {
      area: area, live: live, chime: chime, soft: soft, pop: pop, tick: tick, tone: tone, cheer: cheer, praise: praise, speak: speak, unlock: unlock, audio: audioReady,
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
    var opts = { stage: effStage(), topic: prefs.topic, era: prefs.era, seed: seed, avoid: lastUsed[act.id] || [], prefs: prefs };
    $("tbAnchor").textContent = T.anchor(act.id, opts.stage);
    try {
      me.cleanup = act.start(stage, opts, api) || null;
      /* Keep off the screen: an activity that shows a word on the list is drawn again from a fresh draw (up to eight times) */
      for (var tries = 0; avoidTerms.length && tries < 8 && T.avoidHits(screenWords(stage), avoidTerms).length; tries++) {
        if (me.cleanup) { try { me.cleanup(); } catch (e2) { /* stopped */ } me.cleanup = null; }
        stage.innerHTML = ""; opts.seed = T.newSeed();
        me.cleanup = act.start(stage, opts, api) || null;
      }
    }
    catch (e) { stage.innerHTML = '<p class="tb-big">That one could not start. Choose Home, then try another.</p>'; if (window.console && console.error) console.error("tablet activity " + act.id + ": " + (e && e.stack || e)); }
  }
  /* Every piece of text on the screen, each set apart by a space: textContent runs a row of answer buttons together
     ("side" "table" "day" reads as "sidetableday"), so a word to keep off the screen could hide between its neighbours. */
  function screenWords(el) {
    var out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) out.push(n.nodeValue);
    return out.join(" ");
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

  /* ---------- the menu ---------- */
  var GROUPS = [["Words and letters", "Search, fill in and finish."], ["Follow and create", "Hands-on, with a finger."], ["Think and match", "Sort, order, match and listen."]];
  var menu = $("tbMenu"), defs = Kit.registered();
  GROUPS.forEach(function (g, gi) {
    var sec = h("div", "", "<h2>" + esc(g[0]) + "<small>" + esc(g[1]) + "</small></h2>"), ul = h("ul", "tbp-grid");
    defs.filter(function (d) { return d.group === gi; }).forEach(function (a) {
      ACT[a.id] = { id: a.id, title: a.title, start: a.start };
      var md = T.MODULES[a.id], tag = md ? "<span class=\"tbp-tag\">" + esc(md.therapy) + " \u00B7 GDS 3\u20137</span>" : "";
      var mark = Art && Art.has("m-" + a.id) ? Art.img("m-" + a.id, { size: 76 }).replace('class="tb-ico"', 'class="tbp-pic"') : '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + a.icon + "</svg>";
      ul.appendChild(h("li", "", '<button type="button" class="tbp-card" data-act="' + a.id + '">' + mark + "<b>" + esc(a.title) + "</b><span>" + esc(a.blurb) + "</span>" + tag + "</button>"));
    });
    sec.appendChild(ul); menu.appendChild(sec);
  });
  menu.addEventListener("click", function (e) { var b = e.target.closest("[data-act]"); if (b) openAct(b.getAttribute("data-act"), b); });
  /* Surprise me: the tablet chooses, and never the same one twice in a row */
  var lastSurprise = "";
  $("tbSurprise").addEventListener("click", function () {
    var ids = Object.keys(ACT).filter(function (k) { return k !== lastSurprise && (!calmOn || (T.MODULES[k] && T.MODULES[k].calm)); });
    lastSurprise = ids[Math.floor(Math.random() * ids.length)];
    openAct(lastSurprise, $("tbSurprise"));
  });

  /* the choices at the top */
  var topic = $("tbTopic");
  T.TOPICS.slice().sort(function (a, b) { return a.label < b.label ? -1 : 1; }).forEach(function (t) { var op = document.createElement("option"); op.value = t.id; op.textContent = t.label.charAt(0).toUpperCase() + t.label.slice(1); topic.appendChild(op); });
  topic.value = prefs.topic; $({ early: "tbStageEarly", middle: "tbStageMiddle", late: "tbStageLate" }[prefs.stage]).checked = true;
  topic.addEventListener("change", function () { prefs.topic = topic.value; savePrefs(); });
  var era = $("tbEra"); era.value = prefs.era;
  era.addEventListener("change", function () { prefs.era = /^19[4-8]0s$/.test(era.value) ? era.value : ""; savePrefs(); });
  $("tbAvoid").addEventListener("input", function () { avoidTerms = T.avoidWords(this.value); });
  function calmApply() {
    var late = $("tbStageLate"), back = $({ early: "tbStageEarly", middle: "tbStageMiddle", late: "tbStageLate" }[prefs.stage]);
    Array.prototype.forEach.call(document.querySelectorAll("input[name=stage]"), function (r) { r.disabled = calmOn; });
    (calmOn ? late : back).checked = true;
    Array.prototype.forEach.call(document.querySelectorAll(".tbp-card"), function (c) {
      var md = T.MODULES[c.getAttribute("data-act")], off = calmOn && !(md && md.calm);
      c.parentNode.hidden = off;
    });
    $("tbCalm").setAttribute("aria-pressed", String(calmOn)); $("tbCalm").textContent = calmOn ? "\uD83C\uDF19 Calm mode: On" : "\uD83C\uDF19 Calm mode: Off";
    live(calmOn ? "Calm mode is on: late-stage size and only slow, one-thing-at-a-time activities." : "Calm mode is off.");
  }
  $("tbCalm").addEventListener("click", function () { calmOn = !calmOn; calmApply(); });
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
  $("tbVoice").hidden = !(canSpeak && window.CogniVoice);
  $("tbVoice").addEventListener("click", function () { if (window.CogniVoice) window.CogniVoice.openPanel({ opener: $("tbVoice") }); });
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
