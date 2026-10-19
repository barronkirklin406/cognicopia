/* =====================================================================
   Cognicopia Tablet Activities: the puzzle makers.

   Everything the touch activities on tablet.html show, made from the PCG
   content (assets/pcg/pcg-data.bundle.js) and the PCG puzzle makers
   (src/pcg/puzzles.js), so a tablet puzzle is as sound as a printed one:
   the word search holds only the listed words, the crossword has no
   accidental word, every clue and saying passes the dignity rules.

     wordSearch, crossword, spellIt, sayings, sortIt, inOrder, matchUp,
     oddOne, tracePath, soundBoard, designChoices

   Each takes { stage: "early" | "middle" | "late", topic: a topic id or "",
   seed: any text, fit: { size } } and returns plain data. The same seed
   gives the same puzzle; a new seed gives a new one. No screen, no
   storage, no network: runs in the browser (window.CognicopiaTablet) and in
   Node, where scripts/check-tablet.mjs proves every stage and topic.
   ===================================================================== */
(function (root) {
  "use strict";
  var PCG = root.CognicopiaPCG, D = root.CognicopiaPCGData;
  var Z = PCG.puzzles, P = PCG.prng, G = PCG.grammar;

  /* what each stage gets: fewer, larger, simpler as the stage goes on */
  var STAGES = {
    early: {
      label: "Early stage",
      search: { size: 10, dirs: [[1, 0], [0, 1], [1, 1]], words: 7, minLen: 4, maxLen: 9 },
      cross: { size: 9, target: 5, max: 6, pool: 10, minLen: 3, maxLen: 8, attempts: 30 },
      spell: { count: 5, minLen: 4, maxLen: 9, firstGiven: false },
      saying: { count: 6, options: 3 }, sort: { count: 8 }, order: { maxSteps: 6 }, match: { pairs: 5 }, odd: { rounds: 5 },
      trace: { tol: 34, kinds: ["wave", "zigzag", "spiral", "scurve", "heart", "circle", "hill"], rounds: 3 },
      color: { tier: 2 }, sounds: { cards: 6, rounds: 3 }
    },
    middle: {
      label: "Middle stage",
      search: { size: 8, dirs: [[1, 0], [0, 1]], words: 5, minLen: 3, maxLen: 7 },
      cross: { size: 8, target: 4, max: 5, pool: 8, minLen: 3, maxLen: 7, attempts: 40 },
      spell: { count: 5, minLen: 3, maxLen: 6, firstGiven: true },
      saying: { count: 5, options: 3 }, sort: { count: 6 }, order: { maxSteps: 4 }, match: { pairs: 4 }, odd: { rounds: 4 },
      trace: { tol: 46, kinds: ["wave", "scurve", "heart", "circle", "hill"], rounds: 3 },
      color: { tier: 3 }, sounds: { cards: 6, rounds: 3 }
    },
    late: {
      label: "Late stage",
      search: { size: 6, dirs: [[1, 0]], words: 3, minLen: 3, maxLen: 6 },
      cross: { size: 6, target: 3, max: 4, pool: 6, minLen: 3, maxLen: 5, attempts: 40 },
      spell: { count: 4, minLen: 3, maxLen: 5, firstGiven: true },
      saying: { count: 4, options: 2 }, sort: { count: 4 }, order: { maxSteps: 3 }, match: { pairs: 3 }, odd: { rounds: 3 },
      trace: { tol: 62, kinds: ["hill", "wave", "scurve", "circle"], rounds: 3 },
      color: { tier: 3 }, sounds: { cards: 4, rounds: 2 }
    }
  };
  var stageOf = function (o) { return STAGES[o && o.stage] ? o.stage : "middle"; };
  var cfgOf = function (o, k) { return STAGES[stageOf(o)][k]; };
  var rngOf = function (o, label) { return P.create(String(o && o.seed != null ? o.seed : "tablet") + "/" + label); };
  var BLOCK = new Set(D.safety.blocklist);

  /* ---------- the topics and the content for one ---------- */
  var TOPICS = D.topics.map(function (t) { return { id: t.id, label: t.label }; });
  var topicById = {}; D.topics.forEach(function (t) { topicById[t.id] = t; });
  var okText = function (s) { return !G.lint(s, D); };
  var okWord = function (w) { return /^[A-Z]+$/.test(w) && !BLOCK.has(w); };
  /* terms of one item that may be shown: a plain word, a clue that passes the rules and does not give the word away */
  function termsOf(it) {
    return it.terms.filter(function (t) { return okWord(t[0]) && okText(t[1]) && t[1].toUpperCase().indexOf(t[0]) < 0; })
      .map(function (t) { return { word: t[0], clue: t[1], ref: it.id }; });
  }
  /* the items for a topic, topped up with a nearby topic's when a topic is small; "" means any one topic, chosen by the seed */
  function itemsFor(o, rng, need) {
    var id = o && o.topic && topicById[o.topic] ? o.topic : rng.fork("topic").pick(TOPICS).id;
    var list = D.items.filter(function (it) { return it.topics.indexOf(id) >= 0; });
    var count = function (l) { return l.reduce(function (n, it) { return n + termsOf(it).length; }, 0); };
    var near = topicById[id].neighbors || [];
    for (var i = 0; count(list) < (need || 12) && i < near.length; i++) {
      list = list.concat(D.items.filter(function (it) { return it.topics.indexOf(near[i]) >= 0 && list.indexOf(it) < 0; }));
    }
    return { topic: id, label: topicById[id].label, items: list };
  }
  function overlaps(w, list) { for (var i = 0; i < list.length; i++) if (list[i] === w || list[i].indexOf(w) >= 0 || w.indexOf(list[i]) >= 0) return true; return false; }

  /* ---------- word search ---------- */
  function wordSearch(o) {
    var c = cfgOf(o, "search"), size = Math.max(5, Math.min(c.size, (o.fit && o.fit.size) || c.size)), maxLen = Math.min(c.maxLen, size);
    for (var attempt = 0; attempt < 8; attempt++) {
      var rng = rngOf(o, "ws" + attempt), pick = itemsFor(o, rng, 14), chosen = [];
      rng.fork("it").shuffle(pick.items).forEach(function (it) {
        var terms = rng.fork("t:" + it.id).shuffle(termsOf(it).filter(function (t) { return t.word.length >= c.minLen && t.word.length <= maxLen; }));
        terms.slice(0, 2).forEach(function (t) { if (chosen.length < c.words && !overlaps(t.word, chosen.map(function (x) { return x.word; }))) chosen.push(t); });
      });
      if (chosen.length < Math.min(3, c.words)) continue;
      var ws = Z.wordSearch(chosen.map(function (t) { return t.word; }), { size: size, dirs: c.dirs }, rng.fork("grid"), D.safety);
      if (ws.placed.length < Math.min(3, c.words)) continue;
      return { size: ws.size, rows: ws.rows, placed: ws.placed, words: ws.placed.map(function (p) { return p.word; }).sort(), topic: pick.topic, topicLabel: pick.label };
    }
    return null;
  }

  /* ---------- crossword ---------- */
  function crossword(o) {
    var c = cfgOf(o, "cross"), size = Math.max(5, Math.min(c.size, (o.fit && o.fit.size) || c.size)), maxLen = Math.min(c.maxLen, size);
    for (var attempt = 0; attempt < 10; attempt++) {
      var rng = rngOf(o, "cw" + attempt), pick = itemsFor(o, rng, 16), entries = [], seen = {};
      rng.fork("it").shuffle(pick.items).forEach(function (it) {
        var terms = rng.fork("t:" + it.id).shuffle(termsOf(it).filter(function (t) { return t.word.length >= c.minLen && t.word.length <= maxLen && !seen[t.word]; }));
        terms.slice(0, 2).forEach(function (t) { if (entries.length < c.pool) { seen[t.word] = 1; entries.push(t); } });
      });
      var cw = Z.crossword(entries, { size: size, target: c.target, max: c.max, attempts: c.attempts }, rng.fork("x"));
      if (!cw || cw.entries.length < Math.min(3, c.target) || Z.checkCrossword(cw).length) continue;
      cw.topic = pick.topic; cw.topicLabel = pick.label;
      return cw;
    }
    return null;
  }

  /* ---------- spell it: a clue and the word to spell ---------- */
  function spellIt(o) {
    var c = cfgOf(o, "spell"), rng = rngOf(o, "sp"), pick = itemsFor(o, rng, 14), out = [], seen = {};
    rng.fork("it").shuffle(pick.items).forEach(function (it) {
      rng.fork("t:" + it.id).shuffle(termsOf(it).filter(function (t) { return t.word.length >= c.minLen && t.word.length <= c.maxLen; })).slice(0, 1).forEach(function (t) {
        if (out.length < c.count && !seen[t.word]) { seen[t.word] = 1; out.push({ word: t.word, clue: t.clue, ref: t.ref, given: c.firstGiven ? 1 : 0 }); }
      });
    });
    return { items: out, topic: pick.topic, topicLabel: pick.label };
  }

  /* ---------- finish the saying ---------- */
  function sayings(o) {
    var c = cfgOf(o, "saying"), rng = rngOf(o, "sy");
    var pool = D.activities.sayings.filter(function (s) { return okText(s.lead + " " + s.answer); });
    var out = rng.shuffle(pool).slice(0, c.count).map(function (s) {
      var opts = [s.answer].concat(rng.fork(s.id).shuffle(s.others).slice(0, c.options - 1));
      return { id: s.id, lead: s.lead, answer: s.answer, options: rng.fork("o" + s.id).shuffle(opts), kind: s.kind };
    });
    return { items: out };
  }

  /* ---------- sort it, and odd one out: groups of things ---------- */
  function twoGroups(rng, need) {
    var groups = D.activities.sorting.filter(function (g) { return g.words.filter(okText).length >= need; });
    var shuffled = rng.shuffle(groups), a = shuffled[0], b = shuffled.filter(function (g) { return g !== a && (g.family || []).join() !== (a.family || []).join(); })[0] || shuffled[1];
    return [a, b];
  }
  function sortIt(o) {
    var c = cfgOf(o, "sort"), rng = rngOf(o, "so"), per = Math.ceil(c.count / 2), g = twoGroups(rng, per), items = [];
    g.forEach(function (grp, gi) { rng.fork("g" + gi).shuffle(grp.words.filter(okText)).slice(0, per).forEach(function (w) { items.push({ word: w, group: gi }); }); });
    return { groups: g.map(function (x) { return { id: x.id, label: x.label, one: x.one }; }), items: rng.fork("mix").shuffle(items) };
  }
  function oddOne(o) {
    var c = cfgOf(o, "odd"), rng = rngOf(o, "od"), rounds = [], tries = 0;
    while (rounds.length < c.rounds && tries++ < 40) {
      var g = twoGroups(rng.fork("r" + tries), 4), same = rng.fork("s" + tries).shuffle(g[0].words.filter(okText)).slice(0, 3), odd = rng.fork("d" + tries).pick(g[1].words.filter(okText));
      if (same.length < 3 || !odd) continue;
      var cards = same.map(function (w) { return { word: w, odd: false }; }).concat([{ word: odd, odd: true }]);
      rounds.push({ cards: rng.fork("m" + tries).shuffle(cards), together: g[0].label, apart: g[1].label });
    }
    return { rounds: rounds };
  }

  /* ---------- put it in order ---------- */
  function inOrder(o) {
    var c = cfgOf(o, "order"), rng = rngOf(o, "or"), n = 3 + rng.int(3), out = [], list = D.activities.sequences.filter(function (s) { return s.steps.every(okText); });
    var pick = o && o.topic ? list.filter(function (s) { return s.topics.indexOf(o.topic) >= 0; }) : [];
    rng.shuffle(pick.length ? pick.concat(rng.shuffle(list)) : list).slice(0, 4).forEach(function (s) {
      if (out.some(function (x) { return x.id === s.id; })) return;
      var steps = s.steps.slice(0, c.maxSteps), mix = steps.map(function (t, i) { return i; }), k = 0;
      do { mix = rng.fork(s.id + k++).shuffle(mix); } while (steps.length > 1 && mix.every(function (v, i) { return v === i; }) && k < 20);
      out.push({ id: s.id, title: s.title, steps: steps, order: mix });   // order: the step numbers in the order they are shown
    });
    return { items: out.slice(0, Math.max(2, n - 1)) };
  }

  /* ---------- match the clue ---------- */
  function matchUp(o) {
    var c = cfgOf(o, "match"), rng = rngOf(o, "ma"), pick = itemsFor(o, rng, 14), pairs = [], used = {};
    rng.fork("it").shuffle(pick.items).forEach(function (it) {
      var t = rng.fork("t:" + it.id).shuffle(termsOf(it).filter(function (x) { return x.word.length >= 3 && x.word.length <= 8 && x.clue.length <= 60; }))[0];
      if (t && pairs.length < c.pairs && !used[t.word]) { used[t.word] = 1; pairs.push({ word: t.word, clue: t.clue }); }
    });
    return { pairs: pairs, words: rng.fork("w").shuffle(pairs.map(function (p) { return p.word; })), clues: rng.fork("c").shuffle(pairs.map(function (p) { return p.clue; })), topic: pick.topic, topicLabel: pick.label };
  }

  /* ---------- sights and sounds: a board of sounds to listen to ----------
     The sounds themselves are made on the tablet (js/tabletSound.js); this chooses which ones are on the board and which one
     each "which one is it?" round is about. The same seed gives the same board; "avoid" lists what the last board had. */
  function soundBoard(o) {
    var c = cfgOf(o, "sounds"), rng = rngOf(o, "sn"), all = (root.CognicopiaTabletSound && root.CognicopiaTabletSound.META) || [], avoid = (o && o.avoid) || [];
    var fresh = all.filter(function (m) { return avoid.indexOf(m.id) < 0; }), pool = rng.shuffle(fresh).concat(rng.shuffle(all.filter(function (m) { return avoid.indexOf(m.id) >= 0; })));
    var cards = pool.slice(0, c.cards).map(function (m) { return { id: m.id, name: m.name, line: m.line }; });
    return { cards: cards, targets: rng.fork("t").shuffle(cards.map(function (m) { return m.id; })).slice(0, c.rounds) };
  }

  /* ---------- trace the path: a line to follow with a finger ---------- */
  var W = 1000, H = 600;
  function resample(pts, step) {
    var out = [pts[0]], acc = 0, i;
    for (i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!seg) continue;
      var t = step - acc;
      while (t <= seg) { out.push([a[0] + (b[0] - a[0]) * t / seg, a[1] + (b[1] - a[1]) * t / seg]); t += step; }
      acc = seg - (t - step);
    }
    var last = pts[pts.length - 1], tail = out[out.length - 1];
    if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.4) out.push(last);
    return out;
  }
  var SHAPES = {
    wave: function (r, late) {
      var amp = late ? 90 : 105 + r.int(50), cyc = late ? 1.25 : 1.5 + r.int(2) * 0.5, pts = [];
      for (var i = 0; i <= 160; i++) { var u = i / 160; pts.push([100 + 800 * u, 300 - amp * Math.sin(u * cyc * 2 * Math.PI)]); }
      return pts;
    },
    hill: function (r) {
      var pts = [], amp = 170 + r.int(60);
      for (var i = 0; i <= 120; i++) { var u = i / 120; pts.push([100 + 800 * u, 460 - amp * Math.sin(u * Math.PI)]); }
      return pts;
    },
    zigzag: function (r) {
      var n = 4 + r.int(3), pts = [];
      for (var i = 0; i <= n; i++) pts.push([100 + 800 * i / n, i % 2 ? 140 : 460]);
      return pts;
    },
    scurve: function () {
      var pts = [], p = [[110, 480], [520, 480], [480, 120], [890, 120]];
      for (var i = 0; i <= 120; i++) { var t = i / 120, m = 1 - t; pts.push([m * m * m * p[0][0] + 3 * m * m * t * p[1][0] + 3 * m * t * t * p[2][0] + t * t * t * p[3][0], m * m * m * p[0][1] + 3 * m * m * t * p[1][1] + 3 * m * t * t * p[2][1] + t * t * t * p[3][1]]); }
      return pts;
    },
    spiral: function (r) {
      var turns = 2 + r.int(2) * 0.25, pts = [];
      for (var i = 0; i <= 260; i++) { var u = i / 260, a = -Math.PI / 2 + u * turns * 2 * Math.PI, rad = 255 - 215 * u; pts.push([500 + rad * 1.35 * Math.cos(a), 300 + rad * Math.sin(a)]); }
      return pts;
    },
    circle: function () {
      var pts = [];
      for (var i = 0; i <= 200; i++) { var a = -Math.PI / 2 + i / 200 * 2 * Math.PI; pts.push([500 + 330 * Math.cos(a), 305 + 230 * Math.sin(a)]); }
      return pts;
    },
    heart: function () {
      var pts = [];
      for (var i = 0; i <= 240; i++) {
        var t = i / 240 * 2 * Math.PI;
        pts.push([500 - 16 * Math.pow(Math.sin(t), 3) * 17, 270 - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 17]);
      }
      return pts;
    }
  };
  var SHAPE_LABEL = { wave: "a wave", hill: "a hill", zigzag: "a zigzag", scurve: "an S curve", spiral: "a spiral", circle: "a circle", heart: "a heart" };
  /* three little journeys: who sets out, where they are going, and which open lines suit them */
  var SCENES = {
    bee: { from: "bee", to: "flower", shapes: ["wave", "scurve", "zigzag", "spiral", "hill"], line: "Help the bee fly to the flower.", arrive: "The bee has reached the flower." },
    train: { from: "train", to: "station", shapes: ["hill", "wave", "scurve"], line: "Guide the train along the track to the station.", arrive: "The train has pulled into the station." },
    dog: { from: "dog", to: "bone", shapes: ["zigzag", "wave", "hill", "scurve"], line: "Help the dog find its bone.", arrive: "The dog has found its bone." }
  };
  function tracePath(o) {
    var c = cfgOf(o, "trace"), rng = rngOf(o, "tr"), names = Object.keys(SCENES);
    var scene = o && o.scene && SCENES[o.scene] ? o.scene : rng.fork("scene").pick(names.filter(function (n) { return SCENES[n].shapes.some(function (k) { return c.kinds.indexOf(k) >= 0; }); }));
    var kinds = o && o.kind && SHAPES[o.kind] ? [o.kind] : SCENES[scene].shapes.filter(function (k) { return c.kinds.indexOf(k) >= 0; });
    var kind = rng.fork("kind").pick(kinds.length ? kinds : c.kinds);
    var raw = SHAPES[kind](rng.fork("shape"), stageOf(o) === "late");
    if (rng.fork("flip").chance(0.5) && kind !== "heart" && kind !== "circle") raw = raw.map(function (p) { return [W - p[0], p[1]]; });
    var pts = resample(raw, 6), closed = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 14;
    return { kind: kind, label: SHAPE_LABEL[kind], scene: scene, from: SCENES[scene].from, to: SCENES[scene].to, line: SCENES[scene].line, arrive: SCENES[scene].arrive,
      pts: pts, closed: closed, w: W, h: H, tol: kind === "spiral" ? Math.min(c.tol, 30) : c.tol, start: pts[0], end: pts[pts.length - 1],
      d: "M" + pts.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" L"), length: Math.round((pts.length - 1) * 6) };
  }
  /* The rule the screen follows, kept here so it can be proved without a screen.
     state: { i }, how far along the line the marker is (a point number); point: where the finger is, in the path's own units;
     tolUnits: how wide the lane is on each side. The marker only ever moves forward, and it always stays on the line. A finger
     that wanders away just leaves it waiting where it is (status "away"); a finger that comes back to the lane picks it up
     again. Nothing sends it back to the start: lifting the finger, wobbling, or going the wrong way costs nothing.
     Returns { i, status: "on" | "away" | "done" }. */
  function follow(path, state, point, tolUnits) {
    var pts = path.pts, i = state.i, ahead = 24, back = 3, reach = tolUnits * 2.2, best = -1, bd = Infinity, j;
    for (j = Math.max(0, i - back); j <= Math.min(pts.length - 1, i + ahead); j++) {
      var d = Math.hypot(pts[j][0] - point[0], pts[j][1] - point[1]);
      if (d < bd) { bd = d; best = j; }
    }
    var close = Math.max(2, Math.round(tolUnits * 0.6 / 6));      // reaching the finish circle counts
    if (best < 0 || bd > reach) return { i: i, status: i >= pts.length - 1 - close ? "done" : "away" };
    var next = Math.max(i, best);
    return { i: next, status: next >= pts.length - 1 - close ? "done" : "on" };
  }

  /* ---------- color a picture: which library designs to offer ---------- */
  function designChoices(o, designs) {
    var rng = rngOf(o, "co"), list = designs.filter(function (d) { return d.cat !== "zentangle-mandalas" && !(d.sensitive && d.sensitive.length); });
    return rng.shuffle(list).slice(0, 6).map(function (d) { return d.id; });
  }

  root.CognicopiaTablet = {
    STAGES: STAGES, TOPICS: TOPICS, SHAPES: Object.keys(SHAPES), SHAPE_LABEL: SHAPE_LABEL, SCENES: SCENES,
    wordSearch: wordSearch, crossword: crossword, spellIt: spellIt, sayings: sayings, sortIt: sortIt, oddOne: oddOne, inOrder: inOrder,
    matchUp: matchUp, soundBoard: soundBoard, tracePath: tracePath, follow: follow, designChoices: designChoices,
    newSeed: function () { return String(Date.now()) + "-" + Math.floor(Math.random() * 1e9); }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
