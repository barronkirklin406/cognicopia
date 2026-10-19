/* =====================================================================
   Cognicopia Tablet Activities: the puzzle makers.

   Everything the touch activities on tablet.html show, made from the PCG
   content (assets/pcg/pcg-data.bundle.js) and the PCG puzzle makers
   (src/pcg/puzzles.js), so a tablet puzzle is as sound as a printed one:
   the word search holds only the listed words, the crossword has no
   accidental word, every clue and saying passes the dignity rules.

     wordSearch, crossword, spellIt, sayings, sortIt, inOrder, matchUp,
     oddOne, tracePath, soundBoard, designChoices, regions, PALETTES

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
      search: { sizes: [5, 6], dirs: [[1, 0], [0, 1], [1, 1]] },
      cross: { size: 6, target: 5, max: 6, minLen: 3, attempts: 40 },
      spell: { count: 5, minLen: 4, maxLen: 6, firstGiven: false },
      saying: { count: 6, options: 3 }, sort: { count: 8 }, order: { maxSteps: 6 }, match: { pairs: 5 }, odd: { rounds: 5 },
      trace: { tol: 34, kinds: ["wave", "zigzag", "spiral", "scurve", "heart", "circle", "hill"], rounds: 3 },
      color: { tier: 2 }, sounds: { cards: 6, rounds: 3 }
    },
    middle: {
      label: "Middle stage",
      search: { sizes: [4, 5], dirs: [[1, 0], [0, 1]] },
      cross: { size: 6, target: 4, max: 5, minLen: 3, attempts: 40 },
      spell: { count: 5, minLen: 3, maxLen: 5, firstGiven: false },
      saying: { count: 5, options: 3 }, sort: { count: 6 }, order: { maxSteps: 4 }, match: { pairs: 4 }, odd: { rounds: 4 },
      trace: { tol: 46, kinds: ["wave", "scurve", "heart", "circle", "hill"], rounds: 3 },
      color: { tier: 3 }, sounds: { cards: 6, rounds: 3 }
    },
    late: {
      label: "Late stage",
      search: { sizes: [3, 4], dirs: [[1, 0]] },
      cross: { size: 5, target: 3, max: 4, minLen: 3, attempts: 40 },
      spell: { count: 4, minLen: 3, maxLen: 4, firstGiven: true },
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

  /* ---------- the banks (js/tabletBanks.js) ---------- */
  var banks = function () { return root.CognicopiaTabletBanks; }, artOf = function () { return root.CognicopiaTabletArt; };
  var NEED = { 3: 2, 4: 3, 5: 4, 6: 5 };            // how many words a word search of each size holds
  /* a list in the order a screen should try it: what the topic asks for first, then the rest, and what was just on the screen last */
  function ordered(list, o, rng, label) {
    var topic = o && o.topic, avoid = (o && o.avoid) || [];
    var hit = topic ? list.filter(function (x) { return x.topics.indexOf(topic) >= 0; }) : [], rest = list.filter(function (x) { return hit.indexOf(x) < 0; });
    var all = rng.fork(label + "-t").shuffle(hit).concat(rng.fork(label + "-r").shuffle(rest));
    return all.filter(function (x) { return avoid.indexOf(x.id) < 0; }).concat(all.filter(function (x) { return avoid.indexOf(x.id) >= 0; }));
  }

  /* ---------- word search: 3 x 3 to 6 x 6, from a themed pack ---------- */
  function wordSearch(o) {
    var c = cfgOf(o, "search"), lo = c.sizes[0], hi = c.sizes[1], cap = Math.max(3, Math.min(6, (o.fit && o.fit.size) || 6));
    var size = o && o.size ? o.size : lo + rngOf(o, "wsz").int(hi - lo + 1);
    size = Math.max(3, Math.min(6, size, cap));
    var need = NEED[size], dirs = c.dirs.filter(function (d) { return size >= 5 || d[0] === 0 || d[1] === 0; });    // a small grid never reads on the diagonal
    var packs = ordered(banks().PACKS, o, rngOf(o, "wsp"), "p");
    for (var a = 0; a < packs.length; a++) {
      var pack = packs[a], rng = rngOf(o, "ws" + a), chosen = [];
      var pool = pack.words.filter(function (w) { return w.length >= 3 && w.length <= size && okWord(w); });
      if (pool.length < need) continue;
      rng.fork("w").shuffle(pool).forEach(function (w) { if (chosen.length < need && !overlaps(w, chosen)) chosen.push(w); });
      if (chosen.length < need) continue;
      var ws = Z.wordSearch(chosen, { size: size, dirs: dirs }, rng.fork("grid"), D.safety);
      if (ws.placed.length < need) continue;
      return { size: ws.size, rows: ws.rows, placed: ws.placed, words: ws.placed.map(function (p) { return p.word; }).sort(), pack: pack.id, topic: pack.id, topicLabel: pack.label };
    }
    return null;
  }

  /* ---------- crossword: from a clue set ---------- */
  function crossword(o) {
    var c = cfgOf(o, "cross"), size = Math.max(5, Math.min(c.size, (o.fit && o.fit.size) || c.size)), sets = ordered(banks().CLUES, o, rngOf(o, "cws"), "c");
    for (var a = 0; a < Math.min(sets.length, 16); a++) {
      var set = sets[a], rng = rngOf(o, "cw" + a);
      var entries = set.entries.filter(function (e) { return e[0].length >= c.minLen && e[0].length <= size && okWord(e[0]) && okText(e[1]) && e[1].toUpperCase().indexOf(e[0]) < 0; })
        .map(function (e) { return { word: e[0], clue: e[1], ref: set.id }; });
      if (entries.length < 4) continue;
      var cw = Z.crossword(entries, { size: size, target: c.target, max: c.max, attempts: c.attempts }, rng.fork("x"));
      if (!cw || cw.entries.length < Math.min(3, c.target) || Z.checkCrossword(cw).length) continue;
      cw.topic = set.id; cw.topicLabel = set.title;
      return cw;
    }
    return null;
  }

  /* ---------- spell it: a picture, a clue, and the word to spell ---------- */
  function spellIt(o) {
    var c = cfgOf(o, "spell"), rng = rngOf(o, "sp"), avoid = (o && o.avoid) || [], Art = artOf();
    var pool = banks().OBJECTS.filter(function (x) { return x.word.length >= c.minLen && x.word.length <= c.maxLen && okWord(x.word) && okText(x.clue) && x.clue.toUpperCase().indexOf(x.word) < 0 && Art.has(x.art); });
    var order = rng.fork("o").shuffle(pool), fresh = order.filter(function (x) { return avoid.indexOf(x.word) < 0; }).concat(order.filter(function (x) { return avoid.indexOf(x.word) >= 0; }));
    return { items: fresh.slice(0, c.count).map(function (x) { return { word: x.word, clue: x.clue, art: x.art, given: c.firstGiven ? 1 : 0 }; }) };
  }

  /* ---------- finish the saying: proverbs, hymns and songs ---------- */
  function sayingPool() {
    var seen = {}, out = [], norm = function (s) { return s.toLowerCase().replace(/[^a-z]/g, ""); };
    banks().SAYINGS.concat(D.activities.sayings).forEach(function (s) { var k = norm(s.lead); if (seen[k] || !okText(s.lead + " " + s.answer) || s.lead.toLowerCase().indexOf(s.answer.toLowerCase()) >= 0) return;   /* an opening that holds its own answer gives it away */ seen[k] = 1; out.push(s); });
    return out;
  }
  function sayings(o) {
    var c = cfgOf(o, "saying"), rng = rngOf(o, "sy"), avoid = (o && o.avoid) || [], order = rng.shuffle(sayingPool());
    var fresh = order.filter(function (s) { return avoid.indexOf(s.id) < 0; }).concat(order.filter(function (s) { return avoid.indexOf(s.id) >= 0; }));
    return { items: fresh.slice(0, c.count).map(function (s) {
      var opts = [s.answer].concat(rng.fork(s.id).shuffle(s.others).slice(0, c.options - 1));
      return { id: s.id, lead: s.lead, answer: s.answer, options: rng.fork("o" + s.id).shuffle(opts), kind: s.kind };
    }) };
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

  /* ---------- color a picture: the color sets, and the shapes in a closed-outline picture ---------- */
  /* four sets of eight, each color named: soft, bold, natural and old-fashioned */
  var PALETTES = [
    { id: "pastel", name: "Soft", colors: [["Blush", "#f4b6c2"], ["Peach", "#f9c9a4"], ["Butter", "#f8e5a1"], ["Mint", "#b7e1c4"], ["Sky", "#bcd8ea"], ["Lilac", "#d4c1ec"], ["Cream", "#fbf1dc"], ["Stone", "#d9d2c3"]] },
    { id: "primary", name: "Bold", colors: [["Red", "#d93a2f"], ["Orange", "#f28c1c"], ["Yellow", "#f6d11b"], ["Green", "#2f9e44"], ["Blue", "#2f6fd0"], ["Purple", "#7a3fb5"], ["Black", "#1a202c"], ["White", "#ffffff"]] },
    { id: "nature", name: "Garden", colors: [["Leaf", "#4a9d5b"], ["Forest", "#2e6b44"], ["Moss", "#8aa84b"], ["Earth", "#8a5a2b"], ["Clay", "#c27a4a"], ["Sand", "#e2c79d"], ["Stone", "#8d96a3"], ["Water", "#5aa6a0"]] },
    { id: "retro", name: "Vintage", colors: [["Harvest gold", "#e0a526"], ["Burnt orange", "#d2691e"], ["Avocado", "#7a8c2e"], ["Brown", "#6b4a2b"], ["Plum", "#6f3b5b"], ["Rust", "#a5472a"], ["Cream", "#f1e4c3"], ["Teal", "#2f8f8b"]] }
  ];

  /* The shapes of a picture made of closed outlines. data is the picture's pixels (RGBA, dark lines on white), w by h.
     Every enclosed white area bigger than minArea is a shape; smaller specks and the lines themselves join the nearest
     shape, so a tap anywhere on the page lands on a shape and a color never leaves its lines.
     Returns { w, h, lab (shape number at each pixel, 1..count), count, boxes (left, top, right, bottom of each), areas, bg (the shape outside the picture) }. */
  function regions(data, w, h, minArea) {
    var n = w * h, line = new Uint8Array(n), lab = new Int32Array(n), stack = new Int32Array(n), i, p, x, found = 0;
    for (i = 0; i < n; i++) line[i] = data[i * 4] < 150 ? 1 : 0;
    var areas = [0], edge = [false], sp, a, tb;
    for (i = 0; i < n; i++) {
      if (line[i] || lab[i]) continue;
      found++; sp = 0; stack[sp++] = i; lab[i] = found; a = 0; tb = false;
      while (sp) {
        p = stack[--sp]; a++; x = p % w;
        if (!x || x === w - 1 || p < w || p >= n - w) tb = true;
        if (x > 0 && !line[p - 1] && !lab[p - 1]) { lab[p - 1] = found; stack[sp++] = p - 1; }
        if (x < w - 1 && !line[p + 1] && !lab[p + 1]) { lab[p + 1] = found; stack[sp++] = p + 1; }
        if (p >= w && !line[p - w] && !lab[p - w]) { lab[p - w] = found; stack[sp++] = p - w; }
        if (p < n - w && !line[p + w] && !lab[p + w]) { lab[p + w] = found; stack[sp++] = p + w; }
      }
      areas.push(a); edge.push(tb);
    }
    var map = new Int32Array(found + 1), count = 0, bg = 0, bgArea = 0, keptArea = [0];
    for (i = 1; i <= found; i++) {
      if (areas[i] < minArea) continue;
      map[i] = ++count; keptArea.push(areas[i]);
      if (edge[i] && areas[i] > bgArea) { bgArea = areas[i]; bg = count; }
    }
    for (i = 0; i < n; i++) lab[i] = lab[i] ? map[lab[i]] : 0;
    if (!count) return { w: w, h: h, lab: lab, count: 0, boxes: [null], areas: [0], bg: 0 };
    var qh = 0, qt = 0, q = stack, l;
    for (i = 0; i < n; i++) if (lab[i]) { x = i % w; if ((x > 0 && !lab[i - 1]) || (x < w - 1 && !lab[i + 1]) || (i >= w && !lab[i - w]) || (i < n - w && !lab[i + w])) q[qt++] = i; }
    while (qh < qt) {
      p = q[qh++]; x = p % w; l = lab[p];
      if (x > 0 && !lab[p - 1]) { lab[p - 1] = l; q[qt++] = p - 1; }
      if (x < w - 1 && !lab[p + 1]) { lab[p + 1] = l; q[qt++] = p + 1; }
      if (p >= w && !lab[p - w]) { lab[p - w] = l; q[qt++] = p - w; }
      if (p < n - w && !lab[p + w]) { lab[p + w] = l; q[qt++] = p + w; }
    }
    var boxes = [null], y;
    for (i = 1; i <= count; i++) boxes.push([w, h, -1, -1]);
    for (i = 0; i < n; i++) { l = lab[i]; if (!l) continue; x = i % w; y = (i - x) / w; var b = boxes[l]; if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }
    return { w: w, h: h, lab: lab, count: count, boxes: boxes, areas: keptArea, bg: bg };
  }

  /* ---------- color a picture: which library designs to offer ---------- */
  function designChoices(o, designs) {
    var rng = rngOf(o, "co"), list = designs.filter(function (d) { return d.cat !== "zentangle-mandalas" && !(d.sensitive && d.sensitive.length); });
    return rng.shuffle(list).map(function (d) { return d.id; });
  }

  root.CognicopiaTablet = {
    STAGES: STAGES, TOPICS: TOPICS, SHAPES: Object.keys(SHAPES), SHAPE_LABEL: SHAPE_LABEL, SCENES: SCENES,
    wordSearch: wordSearch, crossword: crossword, spellIt: spellIt, sayings: sayings, sortIt: sortIt, oddOne: oddOne, inOrder: inOrder,
    matchUp: matchUp, soundBoard: soundBoard, tracePath: tracePath, follow: follow, designChoices: designChoices, regions: regions, PALETTES: PALETTES,
    counts: function () { return { packs: banks().PACKS.length, clueSets: banks().CLUES.length, sayings: sayingPool().length, objects: banks().OBJECTS.length }; },
    newSeed: function () { return String(Date.now()) + "-" + Math.floor(Math.random() * 1e9); }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
