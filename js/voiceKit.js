/* =====================================================================
   COGNICOPIA VOICE KIT  (window.CogniVoice)
   One place that chooses a voice and speaks, for Tablet Activities, Tablet
   Interactive Mode and the Academy, so they all sound the same.

   - Voices: only the ones installed on the device. A voice the browser
     streams from a company's server would send the words (which can hold a
     resident's first name) off the device, so it is never used. Of the
     local English voices, novelty and legacy ones are dropped and the most
     natural is ranked first ("Natural", "Neural", "Premium", "Enhanced",
     "Siri", and well-known modern names). iPad Safari fills its voice list
     late, so the list is read again on `voiceschanged` and for a few
     seconds after.
   - Delivery: rate 0.90 ("Natural"), pitch 1.0. Text is cut at commas,
     colons, full stops and ellipses and spoken in short pieces with a small
     gap after each, so it never runs on.
   - Panel: openPanel() is a Voice settings dialog (pace, the voices on this
     device with a preview, a test sentence).
   - smooth(): a gentle low-pass filter for a recorded audio element. The
     browser does not let a text-to-speech voice pass through the Web Audio
     graph, so the filter is for recordings only.

   No network request. The only thing stored is the choice of voice and pace
   (localStorage "cognicopia_voice"), which holds no resident data.
   ===================================================================== */
(function (root) {
  "use strict";
  var synth = root.speechSynthesis, Utt = root.SpeechSynthesisUtterance;
  var supported = !!(synth && typeof Utt === "function");
  var KEY = "cognicopia_voice", SAMPLE = "Welcome to today’s activity.", PITCH = 1.0;
  var PACES = [{ id: "slow", label: "Slow", rate: 0.78 }, { id: "natural", label: "Natural", rate: 0.90 }, { id: "normal", label: "Normal", rate: 1.0 }];
  var GAPS = { comma: 110, colon: 200, stop: 320, ellipsis: 480 };

  /* ---------- choosing a voice ---------- */
  /* the macOS novelty voices and the oldest synthesizers: never offered */
  var NEVER = /\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Ralph|Junior|Kathy|Princess|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b|espeak|festival|flite|\bpico\b|compact/i;
  var LEGACY = /Microsoft (David|Zira|Mark|Hazel|George|James|Richard|Catherine|Linda|Sean|Heera|Ravi)\b.*Desktop|Microsoft (David|Zira|Mark) /i;
  var MODERN = /\b(Ava|Aria|Jenny|Guy|Samantha|Allison|Nicky|Zoe|Evan|Karen|Daniel|Serena|Moira|Tessa|Susan|Stephanie|Libby|Sonia|Ryan)\b/i;
  function usable(v) {
    return !!v && /^en([-_]|$)/i.test(v.lang || "") && v.localService === true && !NEVER.test(v.name || "");
  }
  /* higher is more natural; the number only orders voices on one device */
  function score(v) {
    var n = v.name || "", s = 0;
    if (/natural|neural/i.test(n)) s += 40;
    if (/premium|enhanced/i.test(n)) s += 30;
    if (/siri/i.test(n)) s += 25;
    if (MODERN.test(n)) s += 15;
    if (LEGACY.test(n)) s -= 30;
    if (/^en[-_]US/i.test(v.lang)) s += 6; else if (/^en[-_](GB|AU|CA|IE|NZ|ZA)/i.test(v.lang)) s += 3;
    if (v.default) s += 2;
    return s;
  }
  function rankVoices(list) {
    return (list || []).filter(usable).map(function (v, i) { return { v: v, s: score(v), i: i }; })
      .sort(function (a, b) { return b.s - a.s || (a.v.name < b.v.name ? -1 : a.v.name > b.v.name ? 1 : 0) || a.i - b.i; })
      .map(function (x) { return x.v; });
  }
  var voiceList = [], listeners = [];
  function refresh() {
    if (!supported) return;
    var all = []; try { all = synth.getVoices() || []; } catch (e) { all = []; }
    var next = rankVoices(all);
    var changed = next.length !== voiceList.length || next.some(function (v, i) { return v !== voiceList[i] && v.voiceURI !== (voiceList[i] || {}).voiceURI; });
    voiceList = next;
    if (changed) listeners.slice().forEach(function (fn) { try { fn(voiceList); } catch (e) { /* a listener that fails does not stop the rest */ } });
  }
  if (supported) {
    refresh();
    try { synth.addEventListener("voiceschanged", refresh); } catch (e) { synth.onvoiceschanged = refresh; }
    /* iPad Safari may never announce its voices: ask again for a few seconds */
    var tries = 0, poll = setInterval(function () { refresh(); if (voiceList.length || ++tries > 12) clearInterval(poll); }, 250);
  }

  /* ---------- the choice, kept on the device ---------- */
  var state = { voice: "", rate: "natural", hifi: true };
  try {
    var saved = JSON.parse(root.localStorage.getItem(KEY) || "null");
    if (saved && typeof saved === "object") {
      state.voice = typeof saved.voice === "string" ? saved.voice.slice(0, 120) : "";
      state.rate = PACES.some(function (p) { return p.id === saved.rate; }) ? saved.rate : "natural";
      state.hifi = saved.hifi !== false;
    }
  } catch (e) { /* storage blocked: the defaults stand for this visit */ }
  function save() { try { root.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* not saved this visit */ } }
  function paceOf(id) { return PACES.filter(function (p) { return p.id === id; })[0] || PACES[1]; }
  function best() {
    if (!state.hifi) return voiceList.length ? legacyFirst() : null;
    return voiceList.filter(function (v) { return v.name === state.voice; })[0] || voiceList[0] || null;
  }
  /* with High-Fidelity off: the first local English voice in the device's own order, as before */
  function legacyFirst() {
    var all = []; try { all = synth.getVoices() || []; } catch (e) { all = []; }
    return all.filter(function (v) { return /^en/i.test(v.lang) && v.localService; })[0] || voiceList[0] || null;
  }
  function chosen() {   // the voice the person picked, even with High-Fidelity off
    return voiceList.filter(function (v) { return v.name === state.voice; })[0] || null;
  }

  /* ---------- the words: short pieces with a small gap after each ---------- */
  var ABBR = /^(mr|mrs|ms|dr|st|jr|sr|vs|etc|no|mt)\.$/i;
  function segments(text) {
    var t = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    if (!t) return [];
    var parts = [], buf = "", words = t.split(" ");
    words.forEach(function (w, i) {
      buf += (buf ? " " : "") + w;
      var last = i === words.length - 1, m = /(\.\.\.|…|[.!?;:,])["”’)]*$/.exec(w), gap = 0;
      if (m && !(m[1] === "." && (ABBR.test(w) || /^[A-Z]\.$/.test(w)))) {
        gap = /\.\.\.|…/.test(m[1]) ? GAPS.ellipsis : m[1] === "," ? GAPS.comma : /[;:]/.test(m[1]) ? GAPS.colon : GAPS.stop;
      }
      if (gap || last) { parts.push({ text: buf, gap: last ? 0 : gap }); buf = ""; }
    });
    /* a very short piece joins the next so "Yes, please." is not chopped */
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      while (p.text.length < 14 && p.gap <= GAPS.comma && i + 1 < parts.length) { var q = parts[++i]; p = { text: p.text + " " + q.text, gap: q.gap }; }
      out.push(p);
    }
    return out;
  }

  /* ---------- speaking ---------- */
  var run = 0, timer = 0, keep = [];
  function utter(text, o) {
    o = o || {};
    var u = new Utt(String(text)), v = o.voice || best();
    u.rate = o.rate || paceOf(state.rate).rate; u.pitch = PITCH; u.volume = o.volume == null ? 1 : o.volume;
    u.lang = "en-US"; if (v) { u.voice = v; u.lang = v.lang; }
    return u;
  }
  function stop() {
    run++; clearTimeout(timer); keep = [];
    if (supported) { try { synth.cancel(); } catch (e) { /* nothing to stop */ } }
  }
  function speak(text, o) {
    if (!supported || !text) return false;
    o = o || {};
    var segs = segments(text); if (!segs.length) return false;
    stop();
    var mine = run, i = 0;
    function next() {
      if (mine !== run) return;
      if (i >= segs.length) { if (o.onend) o.onend(); return; }
      var s = segs[i++], u = utter(s.text, o);
      keep.push(u);   // some browsers drop an utterance nothing refers to
      u.onend = function () { if (mine !== run) return; timer = setTimeout(next, s.gap); };
      u.onerror = function (e) { if (mine !== run || (e && (e.error === "interrupted" || e.error === "canceled"))) return; next(); };
      try { synth.speak(u); } catch (e) { /* no voice: the words are on the screen */ }
    }
    next();
    return true;
  }

  /* ---------- a recording, softened ---------- */
  function smooth(el) {
    try {
      if (!el || el._cgSmooth) return !!(el && el._cgSmooth);
      var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false;
      var ctx = new AC(), src = ctx.createMediaElementSource(el), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = "lowpass"; lp.frequency.value = 7500; lp.Q.value = 0.7; g.gain.value = 0.95;
      src.connect(lp); lp.connect(g); g.connect(ctx.destination);
      el.addEventListener("play", function () { if (ctx.state === "suspended") ctx.resume(); });
      el._cgSmooth = ctx; return true;
    } catch (e) { return false; }
  }

  /* ---------- the Voice settings panel ---------- */
  var CSS = ".cgv-back{position:fixed;inset:0;z-index:6000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(20,28,24,.62)}" +
    ".cgv{box-sizing:border-box;width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:20px 22px;background:#fff;color:#1a1a1a;border:3px solid #0e3c43;border-radius:20px;font:600 1rem/1.5 'Atkinson Hyperlegible',system-ui,sans-serif;letter-spacing:.01em}" +
    ".cgv *{box-sizing:border-box}.cgv h2{margin:0 0 4px;font-size:1.4rem;line-height:1.2;color:#0e3c43}.cgv h3{margin:18px 0 8px;font-size:1rem;color:#1a1a1a}" +
    ".cgv p{margin:6px 0;color:#2b2b2b}.cgv-row{display:flex;flex-wrap:wrap;gap:8px}" +
    ".cgv button{min-width:52px;min-height:52px;padding:8px 16px;border:2.5px solid #0e3c43;border-radius:14px;background:#fff;color:#0e3c43;font:inherit;font-weight:700;cursor:pointer}" +
    ".cgv button[aria-pressed=true],.cgv button.cgv-test,.cgv-back .cgv button[aria-pressed=true]{background:#0e3c43 !important;color:#fff !important;-webkit-text-fill-color:#fff !important}.cgv button{-webkit-text-fill-color:currentColor}.cgv button:focus-visible{outline:3px solid #f5b800;outline-offset:2px;box-shadow:0 0 0 5px #1a1a1a}" +
    ".cgv-pace button{flex:1 1 90px}.cgv-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}" +
    ".cgv-list li{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 10px;border:2px solid #b9c4bd;border-radius:14px}" +
    ".cgv-list .cgv-name{flex:1 1 150px;min-width:0;overflow-wrap:anywhere}.cgv-list small{display:block;font-weight:600;color:#3d3d3d}" +
    ".cgv-test{width:100%;margin-top:14px}.cgv-note{margin-top:14px;padding:10px 12px;border-left:5px solid #0e3c43;background:#eef3f3}" +
    ".cgv-sw{display:flex;align-items:center;gap:12px;margin-top:16px}.cgv-sw input{width:52px;height:52px;flex:none;accent-color:#0e3c43}.cgv-close{margin-top:16px;width:100%}";
  function el(tag, attrs, text) {
    var e = root.document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }
  /* o: { rates: [{id,label,value}], getRate(), setRate(value), onVoice(name), hifi: { label, hint, get(), set(on) }, opener } */
  function openPanel(o) {
    o = o || {};
    var doc = root.document;
    if (!doc.getElementById("cg-voice-css")) { var st = el("style", { id: "cg-voice-css" }); st.textContent = CSS; doc.head.appendChild(st); }
    var old = doc.getElementById("cgVoicePanel"); if (old) old.remove();
    var opener = o.opener || doc.activeElement;
    var back = el("div", { class: "cgv-back", id: "cgVoicePanel" }), box = el("div", { class: "cgv", role: "dialog", "aria-modal": "true", "aria-labelledby": "cgvTitle" });
    back.appendChild(box);
    var rates = o.rates || PACES.map(function (p) { return { id: p.id, label: p.label, value: p.rate }; });
    var getRate = o.getRate || function () { return paceOf(state.rate).rate; };
    var setRate = o.setRate || function (val) { var p = PACES.filter(function (x) { return x.rate === val; })[0]; if (p) { state.rate = p.id; save(); } };
    function close() { stop(); back.remove(); doc.removeEventListener("keydown", onKey, true); if (opener && opener.focus) { try { opener.focus(); } catch (e) { /* gone */ } } }
    function onKey(e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); return; }
      if (e.key !== "Tab") return;
      var f = [].slice.call(box.querySelectorAll("button,input")).filter(function (x) { return !x.disabled; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    function sample(v) { speak(SAMPLE, { voice: v || best(), rate: getRate() }); }
    function draw() {
      box.textContent = "";
      box.appendChild(el("h2", { id: "cgvTitle" }, "Voice settings"));
      box.appendChild(el("p", {}, "These are the voices installed on this device. Nothing is sent anywhere."));
      box.appendChild(el("h3", {}, "Pace"));
      var pace = el("div", { class: "cgv-row cgv-pace", role: "group", "aria-label": "Speech pace" });
      rates.forEach(function (r) {
        var b = el("button", { type: "button", "aria-pressed": String(Math.abs(getRate() - r.value) < 0.001) }, r.label);
        b.addEventListener("click", function () { setRate(r.value); draw(); sample(); var again = box.querySelector(".cgv-pace button[aria-pressed=true]"); if (again) again.focus(); });
        pace.appendChild(b);
      });
      box.appendChild(pace);
      box.appendChild(el("h3", {}, "Voices on this device"));
      if (!supported) box.appendChild(el("p", {}, "This browser cannot read aloud. Everything is also shown on the screen."));
      else if (!voiceList.length) box.appendChild(el("p", {}, "No voice that stays on this device was found yet. If the list stays empty, the words remain on the screen."));
      else {
        var ul = el("ul", { class: "cgv-list" }), cur = (o.hifi && o.hifi.get && !o.hifi.get()) ? legacyFirst() : best();
        voiceList.slice(0, 12).forEach(function (v) {
          var li = el("li"), nm = el("span", { class: "cgv-name" }, v.name), small = el("small", {}, score(v) >= 30 ? "Natural voice · " + v.lang : v.lang);
          nm.appendChild(small); li.appendChild(nm);
          var pv = el("button", { type: "button", "aria-label": "Preview " + v.name }, "Preview"); pv.addEventListener("click", function () { sample(v); });
          var use = el("button", { type: "button", "aria-pressed": String(cur === v), "aria-label": "Use " + v.name }, cur === v ? "In use" : "Use");
          use.addEventListener("click", function () { state.voice = v.name; save(); if (o.onVoice) o.onVoice(v.name); draw(); var again = box.querySelector(".cgv-list button[aria-pressed=true]"); if (again) again.focus(); sample(v); });
          li.appendChild(pv); li.appendChild(use); ul.appendChild(li);
        });
        box.appendChild(ul);
        if (score(voiceList[0]) < 30) box.appendChild(el("p", { class: "cgv-note" }, "This device offers only basic voices. If its maker offers a more natural voice to install, it will appear in this list once installed."));
      }
      if (o.hifi) {
        var lab = el("label", { class: "cgv-sw" }), cb = el("input", { type: "checkbox" });
        cb.checked = !!o.hifi.get(); cb.addEventListener("change", function () { o.hifi.set(cb.checked); draw(); });
        lab.appendChild(cb); lab.appendChild(el("span", {}, o.hifi.label || "High-Fidelity Voice"));
        box.appendChild(lab); if (o.hifi.hint) box.appendChild(el("p", {}, o.hifi.hint));
      }
      var test = el("button", { type: "button", class: "cgv-test" }, "Test voice: “" + SAMPLE.replace(/’/g, "’") + "”");
      test.addEventListener("click", function () { sample(); }); box.appendChild(test);
      var cl = el("button", { type: "button", class: "cgv-close" }, "Done"); cl.addEventListener("click", close); box.appendChild(cl);
    }
    function redraw() { if (!back.isConnected) { var i = listeners.indexOf(redraw); if (i >= 0) listeners.splice(i, 1); return; } draw(); }
    listeners.push(redraw);
    back.addEventListener("click", function (e) { if (e.target === back) close(); });
    doc.addEventListener("keydown", onKey, true);
    draw(); doc.body.appendChild(back);
    var first = box.querySelector("button"); if (first) first.focus({ preventScroll: true });
    return { close: close };
  }

  root.CogniVoice = {
    supported: supported, SAMPLE: SAMPLE, PACES: PACES, PITCH: PITCH,
    usable: usable, score: score, rankVoices: rankVoices, segments: segments,
    voices: function () { return voiceList.slice(); }, best: best, chosen: chosen,
    onVoices: function (fn) { listeners.push(fn); if (voiceList.length) fn(voiceList); },
    get: function () { return { voice: state.voice, rate: state.rate, hifi: state.hifi }; },
    setVoice: function (name) { state.voice = String(name || "").slice(0, 120); save(); },
    setRate: function (id) { if (PACES.some(function (p) { return p.id === id; })) { state.rate = id; save(); } },
    setHifi: function (on) { state.hifi = !!on; save(); },
    rate: function () { return paceOf(state.rate).rate; },
    utter: utter, speak: speak, stop: stop, smooth: smooth, openPanel: openPanel
  };
})(typeof window !== "undefined" ? window : globalThis);
