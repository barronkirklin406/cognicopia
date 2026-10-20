/* =====================================================================
   Cognicopia Tablet Activities: the puzzle makers.

   Everything the touch activities on tablet.html show, made from the PCG
   content (assets/pcg/pcg-data.bundle.js) and the PCG puzzle makers
   (src/pcg/puzzles.js), so a tablet puzzle is as sound as a printed one:
   the word search holds only the listed words, the crossword has no
   accidental word, every clue and saying passes the dignity rules.

     wordSearch, crossword, spellIt, sayings, sortIt, inOrder, matchUp,
     oddOne, tracePath, soundBoard, designChoices, regions, enrich, PALETTES

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
      label: "Early stage", tier: 1, tierName: "Mild", gds: "3\u20134", fast: "3\u20134",
      search: { sizes: [5, 6], dirs: [[1, 0], [0, 1], [1, 1]] },
      cross: { size: 6, target: 5, max: 6, minLen: 3, attempts: 40 },
      spell: { count: 5, minLen: 4, maxLen: 6, firstGiven: false },
      saying: { count: 6, options: 3 }, sort: { count: 8 }, order: { maxSteps: 6 }, match: { pairs: 5 }, odd: { rounds: 5 },
      trace: { tol: 34, kinds: ["wave", "zigzag", "spiral", "scurve", "heart", "circle", "hill"], rounds: 3 },
      /* the picture is drawn with all its detail (tier 1) in the bold line of tier 2, and then every big shape is cut up further */
      color: { tier: 1, weight: "ultra-bold", enrich: { minArea: 1200, ringDepth: 23, cell: 1400, rings: 3, band: 15, max: 110, lw: 4 } }, sounds: { cards: 6, rounds: 3 }
    },
    middle: {
      label: "Middle stage", tier: 2, tierName: "Moderate", gds: "5", fast: "5",
      search: { sizes: [4, 5], dirs: [[1, 0], [0, 1]] },
      cross: { size: 6, target: 4, max: 5, minLen: 3, attempts: 40 },
      spell: { count: 5, minLen: 3, maxLen: 5, firstGiven: false },
      saying: { count: 5, options: 3 }, sort: { count: 6 }, order: { maxSteps: 4 }, match: { pairs: 4 }, odd: { rounds: 4 },
      trace: { tol: 46, kinds: ["wave", "scurve", "heart", "circle", "hill"], rounds: 3 },
      color: { tier: 2, weight: "ultra-bold", enrich: { minArea: 2200, ringDepth: 25, cell: 2600, rings: 2, band: 18, max: 70, lw: 5 } }, sounds: { cards: 6, rounds: 3 }
    },
    late: {
      label: "Late stage", tier: 3, tierName: "Advanced", gds: "6\u20137", fast: "6\u20137",
      search: { sizes: [3, 4], dirs: [[1, 0]] },
      cross: { size: 5, target: 3, max: 4, minLen: 3, attempts: 40 },
      spell: { count: 4, minLen: 3, maxLen: 4, firstGiven: true },
      saying: { count: 4, options: 2 }, sort: { count: 4 }, order: { maxSteps: 3 }, match: { pairs: 3 }, odd: { rounds: 3 },
      trace: { tol: 62, kinds: ["hill", "wave", "scurve", "circle"], rounds: 3 },
      color: { tier: 3, weight: "extra-bold-sensory", enrich: { minArea: 6000, ringDepth: 40, cell: 8000, rings: 1, band: 26, max: 32, lw: 6 } }, sounds: { cards: 4, rounds: 2 }
    }
  };
  var stageOf = function (o) { return STAGES[o && o.stage] ? o.stage : "middle"; };
  var cfgOf = function (o, k) { return STAGES[stageOf(o)][k]; };
  var rngOf = function (o, label) { return P.create(String(o && o.seed != null ? o.seed : "tablet") + "/" + label); };
  var BLOCK = new Set(D.safety.blocklist);

  /* ---------- the topics and the content for one ---------- */
  var TOPICS = D.topics.map(function (t) { return { id: t.id, label: t.label }; });
  var okText = function (s) { return !G.lint(s, D); };
  var okWord = function (w) { return /^[A-Z]+$/.test(w) && !BLOCK.has(w); };
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

  /* ---------- sort it, odd one out and match the clue: pictures of things that go together ----------
     The sets are in js/tabletBanks.js. Each picture is in one set only, and two sets of one family are never set against each other,
     so what goes where is never a matter of opinion. A topic chooses its own sets first; what was just on the screen comes last. */
  var thingMap = null;
  function thing(art) {
    if (!thingMap) { thingMap = {}; banks().OBJECTS.forEach(function (x) { thingMap[x.art] = { art: x.art, word: x.word.charAt(0) + x.word.slice(1).toLowerCase(), clue: x.clue }; }); }
    return thingMap[art];
  }
  var setsFor = function (min) { return banks().SETS.filter(function (s) { return s.things.length >= min; }); };
  var setOut = function (s) { return { id: s.id, label: s.label, group: s.group, cover: s.cover }; };
  /* the sets in the order a screen should try them: the topic's, then the rest, and the ones the last screen used at the end */
  function setOrder(o, rng, min, label) {
    var topic = o && o.topic, avoid = (o && o.avoid) || [], all = setsFor(min);
    var hit = topic ? all.filter(function (s) { return s.topics.indexOf(topic) >= 0; }) : [], rest = all.filter(function (s) { return hit.indexOf(s) < 0; });
    var list = rng.fork(label + "-t").shuffle(hit).concat(rng.fork(label + "-r").shuffle(rest));
    return list.filter(function (s) { return avoid.indexOf(s.id) < 0; }).concat(list.filter(function (s) { return avoid.indexOf(s.id) >= 0; }));
  }
  var differ = function (a, b) { return a.id !== b.id && a.family !== b.family; };
  function sortIt(o) {
    var c = cfgOf(o, "sort"), rng = rngOf(o, "so"), per = Math.ceil(c.count / 2), list = setOrder(o, rng, per, "s"), a = list[0];
    var b = rng.fork("b").shuffle(setsFor(per).filter(function (s) { return differ(a, s); }))[0], items = [];
    [a, b].forEach(function (grp, gi) { rng.fork("g" + gi).shuffle(grp.things).slice(0, per).forEach(function (t) { var x = thing(t); items.push({ art: t, word: x.word, group: gi }); }); });
    return { groups: [setOut(a), setOut(b)], items: rng.fork("mix").shuffle(items) };
  }
  /* every pair of sets that may be set against each other is a deck: the three that go together come from the first, the odd one from the second */
  function oddDecks() {
    var out = [];
    setsFor(3).forEach(function (a) { banks().SETS.forEach(function (b) { if (differ(a, b)) out.push({ together: a.id, apart: b.id }); }); });
    return out;
  }
  function oddOne(o) {
    var c = cfgOf(o, "odd"), rng = rngOf(o, "od"), rounds = [], list = setOrder(o, rng, 3, "d");
    list.forEach(function (a) {
      if (rounds.length >= c.rounds) return;
      var b = rng.fork("p" + a.id).shuffle(banks().SETS.filter(function (s) { return differ(a, s); }))[0];
      var same = rng.fork("s" + a.id).shuffle(a.things).slice(0, 3), odd = rng.fork("d" + a.id).pick(b.things);
      var cards = same.map(function (t) { return { art: t, word: thing(t).word, odd: false }; }).concat([{ art: odd, word: thing(odd).word, odd: true }]);
      rounds.push({ cards: rng.fork("m" + a.id).shuffle(cards), together: a.label, set: a.id, apart: b.label });
    });
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
      out.push({ id: s.id, title: s.title, steps: steps, order: mix, art: banks().SEQ_ART[s.id] || "" });   // order: the step numbers in the order they are shown
    });
    return { items: out.slice(0, Math.max(2, n - 1)) };
  }

  /* ---------- match the clue: a picture, and the clue that goes with it ---------- */
  function matchUp(o) {
    var c = cfgOf(o, "match"), rng = rngOf(o, "ma"), list = setOrder(o, rng, 1, "m"), pairs = [], Art = artOf();
    list.forEach(function (s) {                          /* one picture from each set, so no clue can fit two of them */
      if (pairs.length >= c.pairs) return;
      var t = rng.fork("t" + s.id).shuffle(s.things.filter(function (a) { var x = thing(a); return Art.has(a) && okText(x.clue) && x.clue.toLowerCase().indexOf(x.word.toLowerCase()) < 0; }))[0];
      if (t) pairs.push({ art: t, set: s.id, word: thing(t).word, clue: thing(t).clue });
    });
    return { pairs: pairs, pictures: rng.fork("w").shuffle(pairs.map(function (p) { return p.art; })), clues: rng.fork("c").shuffle(pairs.map(function (p) { return p.clue; })) };
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
  /* four sets of eight, each color named: rich and saturated, never pale. Jewel tones, bold primaries, a deep garden and an old-fashioned
     Americana set. Each is dark or bright enough to stand against the black outline, and no two in a set are close. */
  var PALETTES = [
    { id: "jewel", name: "Jewel", colors: [["Crimson", "#c1121f"], ["Tangerine", "#f26a0f"], ["Gold", "#f5b700"], ["Emerald", "#0e8a4f"], ["Teal", "#0b8f94"], ["Sapphire", "#1f4fc4"], ["Indigo", "#3b2f9e"], ["Amethyst", "#8a2cc2"]] },
    { id: "primary", name: "Bold", colors: [["Red", "#d00000"], ["Orange", "#f77f00"], ["Yellow", "#ffc800"], ["Green", "#1b9a3c"], ["Blue", "#0a58ca"], ["Violet", "#6a1fb0"], ["Magenta", "#c2185b"], ["Brown", "#7b3f12"]] },
    { id: "nature", name: "Garden", colors: [["Leaf", "#2f9e3f"], ["Forest", "#14532d"], ["Lime", "#7fb519"], ["Sunflower", "#f5b301"], ["Poppy", "#d62828"], ["Iris", "#6b2fa3"], ["Lake", "#0f6fbf"], ["Earth", "#7a4a1e"]] },
    { id: "retro", name: "Vintage", colors: [["Harvest gold", "#e8a200"], ["Burnt orange", "#d1560f"], ["Barn red", "#a4161a"], ["Brown", "#6b3a1e"], ["Navy", "#12306b"], ["Plum", "#6a1b5c"], ["Avocado", "#6a8d1a"], ["Teal", "#0f7a76"]] }
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

  /* ---------- color a picture: more to color ---------- */
  /* Adds bold lines inside the big shapes of a closed-outline picture, so there is more to color and no big flat area is left.
     data is the picture's pixels (RGBA, dark lines on white), w by h; it is changed in place. For each big shape:
       - a ring: one more outline, set in from the edge (a border band, as on a stained-glass panel or a plate), and
       - cells: the middle of the shape divided into a few pieces by lines half-way between seed points.
     Every line is drawn inside a shape and nothing else, so it can only divide that shape; the shapes found afterward (regions)
     are the old shapes, cut up. o: { minArea (smallest shape to cut), ringDepth (how deep a shape must be to get a ring), cell
     (about how much area each cell has; 0 for no cells), rings (most rings in one shape), band (narrowest band a ring leaves, in pixels, so a finger can land in it), max (most shapes the picture may end with), lw (line width in pixels) }.
     Returns { before, after } counts of shapes (the page outside excluded). The same picture and settings always give the same lines. */
  function enrich(data, w, h, o) {
    o = o || {};
    var n = w * h, lw = o.lw || 4, minArea = o.minArea || 3200, ringDepth = o.ringDepth || 30, cell = o.cell || 0, cap = o.max || 60, maxRings = o.rings == null ? 1 : o.rings, band = o.band || 18;
    var R = regions(data, w, h, 700), before = R.count - (R.bg ? 1 : 0), budget = cap - before, i, x, y;
    if (!R.count || budget <= 0) return { before: before, after: before };
    /* distance from every white pixel to the nearest line pixel (exact, Felzenszwalb) */
    var INF = 1e20, f = new Float64Array(n), dist = new Float64Array(n), v = new Int32Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1), g = new Float64Array(Math.max(w, h));
    for (i = 0; i < n; i++) f[i] = data[i * 4] >= 150 ? INF : 0;
    function pass(len, get, put) {
      var k = 0, q, sI;
      for (q = 0; q < len; q++) g[q] = get(q);
      v[0] = 0; z[0] = -INF; z[1] = INF;
      for (q = 1; q < len; q++) {
        sI = ((g[q] + q * q) - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
        while (sI <= z[k]) { k--; sI = ((g[q] + q * q) - (g[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
        k++; v[k] = q; z[k] = sI; z[k + 1] = INF;
      }
      k = 0;
      for (q = 0; q < len; q++) { while (z[k + 1] < q) k++; put(q, (q - v[k]) * (q - v[k]) + g[v[k]]); }
    }
    for (x = 0; x < w; x++) pass(h, function (q) { return f[q * w + x]; }, function (q, val) { dist[q * w + x] = val; });
    for (y = 0; y < h; y++) pass(w, function (q) { return dist[y * w + q]; }, function (q, val) { f[y * w + q] = val; });
    for (i = 0; i < n; i++) dist[i] = f[i] >= INF / 2 ? 9999 : Math.sqrt(f[i]);
    var maxD = new Float64Array(R.count + 1), where = new Int32Array(R.count + 1), area = new Int32Array(R.count + 1), k;
    for (i = 0; i < n; i++) { k = R.lab[i]; if (!k || data[i * 4] < 150) continue; area[k]++; if (dist[i] > maxD[k]) { maxD[k] = dist[i]; where[k] = i; } }
    var dark = new Float32Array(n), order = [], used = 0;
    for (k = 1; k <= R.count; k++) if (k !== R.bg && area[k] >= minArea && maxD[k] >= ringDepth) order.push(k);
    order.sort(function (a, b) { return (area[b] - area[a]) || (a - b); });
    var wide = w * h * 0.22;                                     /* a shape this big is a backdrop: a ring, never cells */
    order.forEach(function (k) {
      if (used >= budget) return;
      var b = R.boxes[k], depth = maxD[k], r = Math.min(30, Math.max(band * 0.85 + lw / 2, depth * 0.38)), pitch = Math.max(band + lw, Math.min(30, depth * 0.3)), radii = [], rr;
      for (rr = r; radii.length < maxRings && depth - rr >= band * 0.7; rr += pitch) radii.push(rr);
      var ringOn = radii.length > 0, inner = ringOn ? radii[radii.length - 1] + lw / 2 : 0, px = [], p, a, cells = 0, t;
      for (y = b[1]; y <= b[3]; y++) for (x = b[0]; x <= b[2]; x++) {
        p = y * w + x; if (R.lab[p] !== k || data[p * 4] < 150) continue;
        for (t = 0; t < radii.length; t++) { a = lw / 2 + 0.5 - Math.abs(dist[p] - radii[t]); if (a > 0 && a > dark[p]) dark[p] = Math.min(1, a); }
        if (dist[p] > inner + 2) px.push(p);
      }
      used += radii.length;
      if (cell && area[k] < wide && px.length >= cell * 1.6) {
        var m = Math.max(2, Math.min(6, Math.floor(px.length / cell))), seeds, grow;
        m = Math.min(m, budget - used + 1);
        for (; m >= 2; m--) {
          seeds = [where[k]];
          var near = new Float64Array(px.length);
          for (i = 0; i < px.length; i++) { var dx = px[i] % w - where[k] % w, dy = ((px[i] / w) | 0) - ((where[k] / w) | 0); near[i] = dx * dx + dy * dy; }
          while (seeds.length < m) {
            var bi = -1, bd = -1;
            for (i = 0; i < px.length; i += 2) if (near[i] > bd) { bd = near[i]; bi = i; }
            if (bi < 0 || bd < 26 * 26) break;
            seeds.push(px[bi]);
            for (i = 0; i < px.length; i++) { var ex = px[i] % w - px[bi] % w, ey = ((px[i] / w) | 0) - ((px[bi] / w) | 0), dd = ex * ex + ey * ey; if (dd < near[i]) near[i] = dd; }
          }
          if (seeds.length < 2) break;
          /* every cell must be big enough to tap */
          var counts = new Int32Array(seeds.length), pick = new Int32Array(px.length), j;
          for (i = 0; i < px.length; i++) {
            var cx = px[i] % w, cy = (px[i] / w) | 0, b1 = 1e12, bj = 0;
            for (j = 0; j < seeds.length; j++) { var sx = seeds[j] % w - cx, sy = ((seeds[j] / w) | 0) - cy, sd = sx * sx + sy * sy; if (sd < b1) { b1 = sd; bj = j; } }
            pick[i] = bj; counts[bj]++;
          }
          var small = false; for (j = 0; j < seeds.length; j++) if (counts[j] < Math.max(1100, cell * 0.55)) small = true;
          if (small) continue;
          for (i = 0; i < px.length; i++) {
            var qx = px[i] % w, qy = (px[i] / w) | 0, d1 = 1e12, d2 = 1e12;
            for (j = 0; j < seeds.length; j++) { var tx = seeds[j] % w - qx, ty = ((seeds[j] / w) | 0) - qy, td = Math.sqrt(tx * tx + ty * ty); if (td < d1) { d2 = d1; d1 = td; } else if (td < d2) d2 = td; }
            a = lw / 2 + 0.5 - (d2 - d1) / 2; if (a > 0 && a > dark[px[i]]) dark[px[i]] = Math.min(1, a);
          }
          cells = seeds.length; break;
        }
        if (cells) used += cells - 1;
      }
    });
    for (i = 0; i < n; i++) if (dark[i] > 0) { var val = Math.round(255 * (1 - dark[i])); if (val < data[i * 4]) data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = val; }
    var R2 = regions(data, w, h, 700);
    return { before: before, after: R2.count - (R2.bg ? 1 : 0) };
  }

  /* ---------- color a picture: which library designs to offer ---------- */
  function designChoices(o, designs) {
    var rng = rngOf(o, "co"), skip = banks().COLOR_SKIP || [], list = designs.filter(function (d) { return d.cat !== "zentangle-mandalas" && !(d.sensitive && d.sensitive.length) && skip.indexOf(d.id) < 0; });
    return rng.shuffle(list).map(function (d) { return d.id; });
  }

  /* ---------- what each activity serves, in a care plan's words ----------
     The therapy each of the thirteen activities offers, and whether it is a calm one: slow, one thing at a time, nothing timed or competing.
     Every activity is made for all three stages (GDS 3 to 7); the stage changes the size and the count, never whether it can be done. */
  var MODULES = {
    wordsearch: { therapy: "Cognitive Stimulation", calm: false }, crossword: { therapy: "Cognitive Stimulation", calm: false },
    spell: { therapy: "Errorless Learning", calm: false }, saying: { therapy: "Spontaneous Recall", calm: true },
    trace: { therapy: "Spatial / Fine Motor", calm: true }, color: { therapy: "Creative Expression", calm: true },
    paint: { therapy: "Creative Expression", calm: true }, bubbles: { therapy: "Sensory Stimulation", calm: false },
    sort: { therapy: "Semantic Memory", calm: false }, order: { therapy: "Executive Function", calm: false },
    match: { therapy: "Errorless Learning", calm: true }, odd: { therapy: "Semantic Memory", calm: false },
    sounds: { therapy: "Sensory Stimulation / Music", calm: true }
  };
  /* "[Therapy: Spatial / Fine Motor | GDS 5]": the stage's GDS goes with the activity. */
  function anchor(id, stage) {
    var m = MODULES[id], S = STAGES[STAGES[stage] ? stage : "middle"];
    return m ? "[Therapy: " + m.therapy + " | GDS " + S.gds + "]" : "";
  }
  /* The words an activity's screen is checked against: whole words, any case, a plural, a possessive. */
  function avoidWords(text) {
    return String(text == null ? "" : text).split(/[,;\n]+/).map(function (w) { return w.toLowerCase().replace(/\s+/g, " ").trim(); })
      .filter(function (w, i, a) { return w.length >= 3 && a.indexOf(w) === i; });
  }
  function avoidHits(text, terms) {
    var t = String(text == null ? "" : text), out = [];
    (terms || []).forEach(function (w) {
      if (new RegExp("(^|[^a-z0-9])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[^a-z0-9]+") + "(s|es|'s)?([^a-z0-9]|$)", "i").test(t)) out.push(w);
    });
    return out;
  }

  root.CognicopiaTablet = {
    MODULES: MODULES, anchor: anchor, avoidWords: avoidWords, avoidHits: avoidHits,
    STAGES: STAGES, TOPICS: TOPICS, SHAPES: Object.keys(SHAPES), SHAPE_LABEL: SHAPE_LABEL, SCENES: SCENES,
    wordSearch: wordSearch, crossword: crossword, spellIt: spellIt, sayings: sayings, sortIt: sortIt, oddOne: oddOne, inOrder: inOrder,
    matchUp: matchUp, soundBoard: soundBoard, tracePath: tracePath, follow: follow, designChoices: designChoices, regions: regions, enrich: enrich, MAX_SHAPES: 90, PALETTES: PALETTES, oddDecks: oddDecks,
    counts: function () { return { packs: banks().PACKS.length, clueSets: banks().CLUES.length, sayings: sayingPool().length, objects: banks().OBJECTS.length }; },
    newSeed: function () { return String(Date.now()) + "-" + Math.floor(Math.random() * 1e9); }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
