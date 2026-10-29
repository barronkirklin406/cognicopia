/* =====================================================================
   Cognicopia Tablet Activities: the sounds.

   Nothing is recorded or downloaded: every sound on the Sights and Sounds
   board is made here, on the tablet, from Web Audio (oscillators, noise,
   and a plucked-string model for the guitar). So it works with no internet,
   adds no weight to the page, and can be played, drawn as a moving
   waveform and checked in a test.

     CognicopiaTabletSound.META              the sounds: id, name, a line about each
     CognicopiaTabletSound.create(ctx)       { analyser, play(id), stopAll() } on an AudioContext
     CognicopiaTabletSound.render(id, rate)  renders a sound without speakers (for the check): { peak, rms, seconds }

   Each recipe schedules its notes on the context it is given and returns
   how long the sound lasts. Chance (the timing of chimes, the crackle of
   rain) comes from a small seeded generator, so a sound is the same every
   time it is played.
   ===================================================================== */
(function (root) {
  "use strict";
  var META = [
    { id: "bird", name: "Bird song", line: "A songbird calling from a branch." },
    { id: "train", name: "Train whistle", line: "A steam whistle down the line." },
    { id: "guitar", name: "Guitar", line: "An acoustic guitar, picked gently." },
    { id: "cat", name: "Purring cat", line: "A cat purring on a warm lap." },
    { id: "storm", name: "Thunderstorm", line: "Rain, then a long roll of thunder." },
    { id: "bells", name: "Church bells", line: "Bells ringing across town." },
    { id: "chimes", name: "Wind chimes", line: "Chimes stirring in a breeze." },
    { id: "waves", name: "Ocean waves", line: "Waves rolling onto the sand." },
    { id: "phone", name: "Old telephone", line: "A telephone ringing in the hall." }
  ];

  /* a small seeded generator (mulberry32): the same sound every time */
  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function hashOf(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* noise: white, pink or brown, as a buffer to loop */
  function noise(c, sec, kind, rnd) {
    var n = Math.floor(c.sampleRate * sec), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0), i, w;
    if (kind === "white") { for (i = 0; i < n; i++) d[i] = rnd() * 2 - 1; }
    else if (kind === "pink") {
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (i = 0; i < n; i++) {
        w = rnd() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      }
    } else { var last = 0; for (i = 0; i < n; i++) { w = rnd() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } }
    return b;
  }
  function loopOf(c, sec, kind, rnd) { var s = c.createBufferSource(); s.buffer = noise(c, sec, kind, rnd); s.loop = true; return s; }
  var floor = 0.0001;

  /* ---------- the recipes: (context, where to send it, start time, random) -> seconds ---------- */
  function chirp(c, out, t, f0, ratio, len, peak) {
    var o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * ratio, t + len);
    o2.type = "sine"; o2.frequency.setValueAtTime(f0 * 2, t); o2.frequency.exponentialRampToValueAtTime(f0 * 2 * ratio, t + len); g2.gain.value = 0.16;
    g.gain.setValueAtTime(floor, t); g.gain.exponentialRampToValueAtTime(peak, t + len * 0.2); g.gain.exponentialRampToValueAtTime(floor, t + len);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
    o.start(t); o2.start(t); o.stop(t + len + 0.03); o2.stop(t + len + 0.03);
  }
  function pluck(c, out, t, freq, gain, rnd) {
    var sec = Math.min(3.2, 1.3 + 240 / freq), n = Math.floor(c.sampleRate * sec), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    var L = Math.max(2, Math.round(c.sampleRate / freq)), line = new Float32Array(L), i, prev = 0, peak = 0;
    for (i = 0; i < L; i++) { var w = rnd() * 2 - 1; prev = 0.55 * w + 0.45 * prev; line[i] = prev; }     // a softened burst: a warm pluck, not a click
    var idx = 0, damp = 0.9972 - Math.min(0.004, freq / 120000);
    for (i = 0; i < n; i++) { var a = line[idx], b = line[(idx + 1) % L]; d[i] = a; line[idx] = (a + b) * 0.5 * damp; idx = (idx + 1) % L; if (Math.abs(a) > peak) peak = Math.abs(a); }
    var src = c.createBufferSource(), g = c.createGain(), lp = c.createBiquadFilter();
    src.buffer = buf; g.gain.value = gain / (peak || 1); lp.type = "lowpass"; lp.frequency.value = 4200;
    src.connect(lp); lp.connect(g); g.connect(out); src.start(t);
  }
  function bell(c, out, t, f, gain, dur) {
    [[0.5, 0.35, 1], [1, 1, 0.9], [1.2, 0.55, 0.7], [1.5, 0.35, 0.55], [2, 0.32, 0.42], [2.5, 0.2, 0.32], [3, 0.14, 0.26], [4.1, 0.09, 0.2]].forEach(function (p) {
      var o = c.createOscillator(), g = c.createGain(), d = dur * p[2];
      o.type = "sine"; o.frequency.value = f * p[0];
      g.gain.setValueAtTime(floor, t); g.gain.exponentialRampToValueAtTime(gain * p[1], t + 0.006); g.gain.exponentialRampToValueAtTime(floor, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05);
    });
  }
  function ping(c, out, t, f, gain, dur) {          // a metal bar: a few inharmonic partials, a long soft tail
    [[1, 1, 1], [2.76, 0.35, 0.55], [5.4, 0.14, 0.3], [8.93, 0.06, 0.18]].forEach(function (p) {
      var o = c.createOscillator(), g = c.createGain(), d = dur * p[2];
      o.type = "sine"; o.frequency.value = f * p[0];
      g.gain.setValueAtTime(floor, t); g.gain.exponentialRampToValueAtTime(gain * p[1], t + 0.004); g.gain.exponentialRampToValueAtTime(floor, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05);
    });
  }

  var RECIPES = {
    bird: function (c, out, t0) {
      [[0, 3000, 1.35, 0.11], [0.2, 3400, 1.3, 0.1], [0.42, 2800, 1.5, 0.14], [0.72, 3700, 0.7, 0.17]].forEach(function (p) { chirp(c, out, t0 + p[0], p[1], p[2], p[3], 0.3); });
      for (var i = 0; i < 9; i++) chirp(c, out, t0 + 1.3 + i * 0.07, 3300 + (i % 2) * 320, 1.15, 0.05, 0.22);
      [[2.25, 3100, 1.4, 0.12], [2.45, 3500, 1.25, 0.1], [2.65, 2700, 1.6, 0.16]].forEach(function (p) { chirp(c, out, t0 + p[0], p[1], p[2], p[3], 0.26); });
      return 3.2;
    },
    train: function (c, out, t0, rnd) {
      function blast(t, len) {
        var lp = c.createBiquadFilter(), g = c.createGain(), breath = loopOf(c, 1, "white", rnd), bp = c.createBiquadFilter(), bg = c.createGain();
        lp.type = "lowpass"; lp.frequency.value = 1900; lp.Q.value = 0.7;
        g.gain.setValueAtTime(floor, t); g.gain.exponentialRampToValueAtTime(0.42, t + 0.14); g.gain.setValueAtTime(0.42, t + len); g.gain.exponentialRampToValueAtTime(floor, t + len + 0.4);
        [349.23, 440, 523.25].forEach(function (f, k) {
          var o = c.createOscillator(), og = c.createGain(), v = c.createOscillator(), vg = c.createGain();
          o.type = k === 1 ? "triangle" : "sawtooth";
          o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12); o.frequency.setValueAtTime(f, t + len); o.frequency.exponentialRampToValueAtTime(f * 0.95, t + len + 0.4);
          v.frequency.value = 5.2; vg.gain.value = f * 0.006; v.connect(vg); vg.connect(o.frequency);
          og.gain.value = k === 1 ? 0.5 : 0.26; o.connect(og); og.connect(lp);
          o.start(t); v.start(t); o.stop(t + len + 0.45); v.stop(t + len + 0.45);
        });
        lp.connect(g); g.connect(out);
        bp.type = "bandpass"; bp.frequency.value = 1400; bp.Q.value = 0.6; bg.gain.setValueAtTime(0.1, t); bg.gain.exponentialRampToValueAtTime(floor, t + 0.5);
        breath.connect(bp); bp.connect(bg); bg.connect(out); breath.start(t); breath.stop(t + 0.6);
      }
      blast(t0, 1.5); blast(t0 + 2.3, 0.55);
      return 3.6;
    },
    guitar: function (c, out, t0, rnd) {
      var run = [82.41, 123.47, 196, 246.94, 329.63, 246.94, 196, 123.47];
      run.forEach(function (f, i) { pluck(c, out, t0 + i * 0.3, f, 0.5, rnd); });
      [82.41, 123.47, 164.81, 196, 246.94, 329.63].forEach(function (f, i) { pluck(c, out, t0 + 2.55 + i * 0.045, f, 0.4, rnd); });
      return 6.2;
    },
    cat: function (c, out, t0, rnd) {
      var n = loopOf(c, 3, "brown", rnd), bp = c.createBiquadFilter(), am = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), breath = c.createGain();
      bp.type = "bandpass"; bp.frequency.value = 150; bp.Q.value = 0.8; am.gain.value = 0.5; lfo.frequency.value = 25; lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain);
      n.connect(bp); bp.connect(am); am.connect(breath);
      var saw = c.createOscillator(), sg = c.createGain(), sl = c.createBiquadFilter(), sm = c.createGain(), sf = c.createOscillator(), sfg = c.createGain();   // the buzz under the purr, pulsing at the same rate
      saw.type = "sawtooth"; saw.frequency.value = 26; sl.type = "bandpass"; sl.frequency.value = 220; sl.Q.value = 0.7; sg.gain.value = 0.9; sm.gain.value = 0.5; sf.frequency.value = 26; sfg.gain.value = 0.5; sf.connect(sfg); sfg.connect(sm.gain);
      saw.connect(sl); sl.connect(sm); sm.connect(sg); sg.connect(breath);
      breath.gain.setValueAtTime(floor, t0);
      [0, 1.8, 3.6].forEach(function (k) { breath.gain.exponentialRampToValueAtTime(0.9, t0 + k + 0.8); breath.gain.exponentialRampToValueAtTime(0.35, t0 + k + 1.7); });
      breath.gain.exponentialRampToValueAtTime(floor, t0 + 5.6);
      breath.connect(out);
      [n, lfo, saw, sf].forEach(function (s) { s.start(t0); s.stop(t0 + 5.7); });
      return 5.6;
    },
    storm: function (c, out, t0, rnd) {
      var rain = loopOf(c, 2, "white", rnd), hp = c.createBiquadFilter(), lp = c.createBiquadFilter(), rg = c.createGain();
      hp.type = "highpass"; hp.frequency.value = 1500; lp.type = "lowpass"; lp.frequency.value = 9000;
      rg.gain.setValueAtTime(floor, t0); rg.gain.exponentialRampToValueAtTime(0.07, t0 + 0.8); rg.gain.setValueAtTime(0.07, t0 + 4.4); rg.gain.exponentialRampToValueAtTime(floor, t0 + 5.6);
      rain.connect(hp); hp.connect(lp); lp.connect(rg); rg.connect(out); rain.start(t0); rain.stop(t0 + 5.7);
      var crack = loopOf(c, 1, "white", rnd), cg = c.createGain(), chp = c.createBiquadFilter();
      chp.type = "highpass"; chp.frequency.value = 900; cg.gain.setValueAtTime(floor, t0 + 0.9); cg.gain.exponentialRampToValueAtTime(0.5, t0 + 0.91); cg.gain.exponentialRampToValueAtTime(floor, t0 + 1.25);
      crack.connect(chp); chp.connect(cg); cg.connect(out); crack.start(t0 + 0.9); crack.stop(t0 + 1.3);
      var rum = loopOf(c, 3, "brown", rnd), rl = c.createBiquadFilter(), rgn = c.createGain();
      rl.type = "lowpass"; rl.frequency.value = 230; rgn.gain.setValueAtTime(floor, t0 + 1.0);
      rgn.gain.exponentialRampToValueAtTime(1.0, t0 + 1.6); rgn.gain.exponentialRampToValueAtTime(0.5, t0 + 2.3); rgn.gain.exponentialRampToValueAtTime(0.85, t0 + 2.9); rgn.gain.exponentialRampToValueAtTime(0.3, t0 + 3.7); rgn.gain.exponentialRampToValueAtTime(floor, t0 + 5.4);
      rum.connect(rl); rl.connect(rgn); rgn.connect(out); rum.start(t0 + 1.0); rum.stop(t0 + 5.5);
      return 5.6;
    },
    bells: function (c, out, t0) {
      [[0, 261.63], [1.0, 196], [1.9, 220], [2.9, 261.63], [3.8, 196]].forEach(function (p) { bell(c, out, t0 + p[0], p[1], 0.3, 3.6); });
      return 7.2;
    },
    chimes: function (c, out, t0, rnd) {
      var scale = [1046.5, 1174.66, 1318.51, 1567.98, 1760], t = 0.05, i = 0;
      while (t < 4.6) { ping(c, out, t0 + t, scale[Math.floor(rnd() * scale.length)], 0.22 + rnd() * 0.12, 2.4); t += 0.18 + rnd() * 0.42; i++; }
      return 7;
    },
    waves: function (c, out, t0, rnd) {
      var n = loopOf(c, 4, "pink", rnd), lp = c.createBiquadFilter(), g = c.createGain();
      lp.type = "lowpass"; lp.Q.value = 0.5; lp.frequency.setValueAtTime(180, t0); g.gain.setValueAtTime(floor, t0);
      [0, 3.2].forEach(function (k) {
        lp.frequency.exponentialRampToValueAtTime(1500, t0 + k + 1.7); lp.frequency.exponentialRampToValueAtTime(220, t0 + k + 3.2);
        g.gain.exponentialRampToValueAtTime(0.75, t0 + k + 1.6); g.gain.exponentialRampToValueAtTime(0.06, t0 + k + 3.2);
      });
      n.connect(lp); lp.connect(g); g.connect(out); n.start(t0); n.stop(t0 + 6.6);
      return 6.5;
    },
    phone: function (c, out, t0) {
      function ring(t, len) {
        var a = c.createOscillator(), b = c.createOscillator(), mix = c.createGain(), am = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(), env = c.createGain();
        a.frequency.value = 440; b.frequency.value = 480; a.type = b.type = "sine"; mix.gain.value = 0.5; am.gain.value = 0.55; lfo.frequency.value = 20; lg.gain.value = 0.45; lfo.connect(lg); lg.connect(am.gain);
        a.connect(mix); b.connect(mix); mix.connect(am); am.connect(env); env.connect(out);
        env.gain.setValueAtTime(floor, t); env.gain.exponentialRampToValueAtTime(0.5, t + 0.03); env.gain.setValueAtTime(0.5, t + len); env.gain.exponentialRampToValueAtTime(floor, t + len + 0.08);
        [a, b, lfo].forEach(function (o) { o.start(t); o.stop(t + len + 0.1); });
        bell(c, out, t, 1568, 0.05, 0.5);
      }
      ring(t0, 1.5); ring(t0 + 2.3, 1.5);
      return 4.2;
    }
  };

  /* ---------- playing ---------- */
  function create(c) {
    var master = c.createGain(), comp = c.createDynamicsCompressor(), an = c.createAnalyser(), live = [];
    master.gain.value = 0.85; comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.005; comp.release.value = 0.25;
    an.fftSize = 1024; an.smoothingTimeConstant = 0.55;
    master.connect(comp); comp.connect(an); an.connect(c.destination);
    function play(id, when) {
      var r = RECIPES[id]; if (!r) return null;
      var g = c.createGain(), t0 = when == null ? c.currentTime + 0.04 : when, dur;
      g.connect(master);
      dur = r(c, g, t0, rng(hashOf(id)));
      var handle = {
        id: id, duration: dur, at: t0, stopped: false,
        stop: function () {
          if (handle.stopped) return; handle.stopped = true;
          try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setValueAtTime(g.gain.value, c.currentTime); g.gain.linearRampToValueAtTime(0, c.currentTime + 0.15); } catch (e) { /* already silent */ }
          setTimeout(function () { try { g.disconnect(); } catch (e) { /* gone */ } }, 400);
        }
      };
      live.push(handle);
      setTimeout(function () { handle.stopped = true; try { g.disconnect(); } catch (e) { /* gone */ } live = live.filter(function (x) { return x !== handle; }); }, (dur + 1.2) * 1000);
      return handle;
    }
    return { analyser: an, play: play, stopAll: function () { live.slice().forEach(function (h) { h.stop(); }); }, ids: META.map(function (m) { return m.id; }) };
  }

  /* render a sound with no speakers and report how loud it is (the check calls this for every sound) */
  function render(id, rate) {
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    if (!OAC) return Promise.resolve(null);
    var sr = rate || 22050, oc = new OAC(1, sr * 9, sr), s = create(oc), h = s.play(id, 0);
    return oc.startRendering().then(function (buf) {
      var d = buf.getChannelData(0), peak = 0, sum = 0, last = 0, i;
      for (i = 0; i < d.length; i++) { var v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; if (v > 0.005) last = i; }
      var early = 0, n = Math.min(d.length, Math.floor(sr * Math.min(h.duration, 4)));
      for (i = 0; i < n; i++) early += d[i] * d[i];
      return { peak: peak, rms: Math.sqrt(sum / d.length), seconds: h.duration, sounding: last / sr, nan: Array.prototype.some.call(d, function (x) { return x !== x; }), earlyRms: Math.sqrt(early / n) };
    });
  }

  root.CognicopiaTabletSound = { META: META, create: create, render: render };
})(typeof globalThis !== "undefined" ? globalThis : this);
