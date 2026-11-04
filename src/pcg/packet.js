/* =====================================================================
   Cognicopia PCG: today's packet.

   generate(profile, { date, variant }) returns the same packet for the same
   resident on the same day, every time, and a different one tomorrow.

   The layout is an anchor, and never changes
     Page 1  Word Search          Page 4  Color Page (bold lines)
     Page 2  the conversation     Page 5  For Staff (the action prompts)
     Page 3  the stage's puzzle
   Only what is ON the pages varies. Their titles are the same every day.

   The clinical staging matrix: the stage filters HOW HARD the output is,
   not only what it is about.
     early   Active recall and strategy
             Page 1  15 x 15 word search with diagonals, 14 words
             Page 2  open-ended questions: opinion, comparison, "did you know"
             Page 3  an intersecting crossword with clues and a box of words
             Page 4  a picture of the day's subject, with a Zentangle border
     middle  Guided completion
             Page 1  8 x 8 word search, across and down only, 6 words
             Page 2  familiar sayings to finish, with a box of words
             Page 3  an 8 x 8 crossword, first letters given, box of words
             Page 4  a bold picture of the day's subject, a word to write
     late    Sensory and visual anchoring
             Page 1  6 x 6 word search, across only, 3 big words (one is the
                     resident's own name)
             Page 2  three short sensory cards, ten words or fewer each
             Page 3  one large picture to look at together
             Page 4  a bold, high-contrast mandala to color

   Variation without distress
     The day's items come from three disjoint pools, one step apart from
     the resident's interests at most (matrix.js); the resident's own name is
     in the word search at every stage; page titles never change. The words,
     clues, sentences and pictures are new each morning, and none of the
     day's featured items or puzzle words is one of yesterday's.

   Caregiver action prompts are written from the day's pages: each names a
   page, and the item or word on that page, and a moment in the routine.

   Runs in the browser (window.CognicopiaPCG.packet) and in Node (vm).
   ===================================================================== */
(function (root) {
  "use strict";
  var PCG = root.CognicopiaPCG = root.CognicopiaPCG || {};
  var P = PCG.prng, Mx = PCG.matrix, G = PCG.grammar, Z = PCG.puzzles;
  if (!P || !Mx || !G || !Z) throw new Error("Load prng.js, matrix.js, grammar.js and puzzles.js before packet.js.");
  var VERSION = "1.0.0";

  var STAGES = {
    early: {
      label: "Early (mild)", focus: "Active recall and strategy",
      wordsearch: { size: 15, dirs: [[1, 0], [0, 1], [1, 1], [1, -1]], words: 14, minLen: 4, maxLen: 11, personal: 1, quota: { F: 5, C: 4, T: 3 } },
      crossword: { size: 9, target: 5, max: 6, pool: { F: 6, C: 4, T: 4 }, minLen: 4, maxLen: 9, attempts: 30 }
    },
    middle: {
      label: "Middle (moderate)", focus: "Guided completion",
      wordsearch: { size: 8, dirs: [[1, 0], [0, 1]], words: 6, minLen: 3, maxLen: 7, personal: 0, quota: { F: 2, C: 2, T: 1 } },
      crossword: { size: 8, target: 4, max: 5, pool: { F: 4, C: 3, T: 3 }, minLen: 3, maxLen: 7, attempts: 40 },
      completions: 5
    },
    late: {
      label: "Late (advanced)", focus: "Sensory and visual anchoring",
      wordsearch: { size: 6, dirs: [[1, 0]], words: 3, minLen: 3, maxLen: 6, personal: 0, quota: { F: 1, C: 1, T: 0 } },
      cards: 3
    }
  };
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var dateLabel = function(p){ return WEEKDAYS[(((p.day + 4) % 7) + 7) % 7] + ", " + MONTHS[p.m - 1] + " " + p.d + ", " + p.y; };

  var wordsOf = function(it, lo, hi, bad){ return it.terms.map(function(t){ return t[0]; }).filter(function(w){ return w.length >= lo && w.length <= hi && !bad.has(w); }); };
  /* shuffled, with words of four letters or more ahead of the three-letter ones */
  var longFirst = function(list, rng, key){ var s = rng.shuffle(list); return s.filter(function(k){ return key(k).length >= 4; }).concat(s.filter(function(k){ return key(k).length < 4; })); };
  function overlaps(w, list){ for (var i = 0; i < list.length; i++) if (list[i] === w || list[i].indexOf(w) >= 0 || w.indexOf(list[i]) >= 0) return true; return false; }
  var ref = function(pr, it, tag){ var info = pr.items.get(it.id) || { level: 0 }; return { id: it.id, name: it.name, kind: it.kind, subject: it.subject || null, level: info.level, slot: tag }; };

  /* ---------- the word search words ---------- */
  function chooseSearchWords(pr, focus, stage, rng, prev, safety){
    var cfg = STAGES[stage].wordsearch, chosen = [], used = [], block = new Set(safety.blocklist);
    var bad = new Set(prev); block.forEach(function(w){ bad.add(w); });
    function add(w, src, refId){ if (overlaps(w, used)) return false; used.push(w); chosen.push({ word: w, src: src, ref: refId || null }); return true; }
    var name = pr.anchorName;
    if (/^[A-Z]{3,11}$/.test(name) && name.length <= cfg.maxLen && !block.has(name)) add(name, "name", null);
    if (cfg.personal){
      var pool = pr.anchors.filter(function(w){ return w.length >= 3 && w.length <= cfg.maxLen && w !== name && !block.has(w); });
      P.rotationWindow(pr.nameKey + "|A", pool.length, Math.min(cfg.personal, pool.length), pr.day).forEach(function(i){ add(pool[i], "personal", null); });
    }
    var slots = [["F", focus.F], ["C", focus.C], ["T", focus.T]], leftovers = [];
    slots.forEach(function(s){
      var it = s[1], q = cfg.quota[s[0]], cand = longFirst(wordsOf(it, cfg.minLen, cfg.maxLen, bad), rng.fork("ws:" + s[0]), function(w){ return w; }), took = 0;
      cand.forEach(function(w){ if (took < q && add(w, s[0], it.id)) took++; else leftovers.push([w, s[0], it.id]); });
    });
    for (var i = 0; chosen.length < cfg.words && i < leftovers.length; i++) add(leftovers[i][0], leftovers[i][1], leftovers[i][2]);
    if (chosen.length < cfg.words){
      var topics = focus.F.topics, near = pr.pools.usable.filter(function(it){ return it !== focus.F && it !== focus.C && it !== focus.T && it.topics.some(function(t){ return topics.indexOf(t) >= 0; }); });
      rng.fork("ws:fill").shuffle(near).forEach(function(it){
        if (chosen.length >= cfg.words) return;
        longFirst(wordsOf(it, cfg.minLen, cfg.maxLen, bad), rng.fork("ws:fill:" + it.id), function(w){ return w; }).forEach(function(w){ if (chosen.length < cfg.words) add(w, "T", it.id); });
      });
    }
    return chosen.slice(0, cfg.words);
  }

  /* ---------- the crossword ---------- */
  function buildCrossword(pr, focus, stage, rng, prev, taken, safety){
    var cfg = STAGES[stage].crossword, bad = new Set(prev), takenSet = new Set(taken), entries = [], seen = {};
    function addFrom(it, n, label){
      var cand = it.terms.filter(function(t){ return t[0].length >= cfg.minLen && t[0].length <= cfg.maxLen && !bad.has(t[0]) && !seen[t[0]]; });
      var fresh = cand.filter(function(t){ return !takenSet.has(t[0]); }), stale = cand.filter(function(t){ return takenSet.has(t[0]); });
      var r = rng.fork("xw:" + label);
      longFirst(fresh, r, function(t){ return t[0]; }).concat(longFirst(stale, r, function(t){ return t[0]; })).slice(0, n).forEach(function(t){ seen[t[0]] = 1; entries.push({ word: t[0], clue: t[1], ref: it.id }); });
    }
    addFrom(focus.F, cfg.pool.F, "F"); addFrom(focus.C, cfg.pool.C, "C"); addFrom(focus.T, cfg.pool.T, "T");
    if (entries.length < cfg.pool.F + cfg.pool.C + cfg.pool.T - 2){
      rng.fork("xw:fill").shuffle(pr.pools.usable.filter(function(it){ return it.topics.some(function(t){ return focus.F.topics.indexOf(t) >= 0; }); })).slice(0, 3).forEach(function(it){ addFrom(it, 3, it.id); });
    }
    var cw = Z.crossword(entries, { size: cfg.size, target: cfg.target, max: cfg.max, attempts: cfg.attempts }, rng.fork("xw"));
    return cw ? { cw: cw, candidates: entries.length } : null;
  }

  /* ---------- the conversation page ---------- */
  var levelOf = function(pr, it){ return (pr.items.get(it.id) || { level: 0 }).level; };

  function talkEarly(pr, focus, env, rng){
    var data = env.data, g = data.grammar.stages.early, used = {}, lines = [], log = 0;
    function make(list, it, it2, level, label){
      var r = rng.fork(label), el = G.eligible(list, it, it2, level, env).filter(function(t){ return !used[t.id]; });
      if (!el.length) return null;
      var top = Math.max.apply(null, el.map(function(t){ return t.presume || 0; }));
      var pool = r.shuffle(el.filter(function(t){ return (t.presume || 0) === top; }));
      for (var i = 0; i < pool.length; i++){
        var text = G.expand(pool[i].text, it, it2, env, r.fork(pool[i].id));
        if (text && !G.lint(text, data) && Mx.textAllowed(pr, text)){
          used[pool[i].id] = 1;
          var n = 0; el.forEach(function(t){ n += G.fills(t, it, it2, env); });
          log += Math.log(n) / Math.LN10;
          return { kind: top >= 2 ? "story" : top === 1 ? "domain" : pair(it2), text: text, refs: it2 ? [it.id, it2.id] : [it.id], template: pool[i].id };
        }
      }
      return null;
    }
    function pair(it2){ return it2 ? "pair" : "open"; }
    var all = g.story.concat(g.open);
    var a = make(all, focus.F, null, levelOf(pr, focus.F), "talk:A"); if (a) lines.push(a);
    var b = make(g.open, focus.C, null, 0, "talk:B"); if (b) lines.push(b);
    var c = make(g.pair, focus.F, focus.C, 0, "talk:C"); if (c) lines.push(c);
    var d = make(g.open, focus.T, null, 0, "talk:D"); if (d) lines.push(d);
    var withFact = [focus.F, focus.C, focus.T].filter(function(it){ return it.facts && it.facts.length; })[0];
    if (withFact){
      var r2 = rng.fork("talk:fact"), follow = r2.pick(g.factFollow), fact = withFact.facts[r2.int(withFact.facts.length)];
      var ft = data.grammar.ui.titles.factLead + " " + fact;
      if (!G.lint(ft, data) && !G.lint(follow, data) && Mx.textAllowed(pr, ft)){ lines.push({ kind: "fact", text: ft, follow: follow, refs: [withFact.id], template: "fact" }); log += Math.log(withFact.facts.length * g.factFollow.length) / Math.LN10; }
    }
    if (lines.length < 5){
      var e = make(all, focus.F, null, levelOf(pr, focus.F), "talk:E"); if (e) lines.push(e);
    }
    return { lines: lines, log: log };
  }

  function completions(pr, focus, stage, rng){
    var count = STAGES[stage].completions, out = [], answers = {}, pool = 0, data = pr.data;
    var quota = [[focus.F, 2], [focus.C, 2], [focus.T, 1]];
    function ok(c){ return !answers[c.answer] && !G.lint(c.lead + " " + c.answer, data) && Mx.textAllowed(pr, c.lead + " " + c.answer); }
    function from(it){ return rng.fork("c:" + it.id).shuffle(it.completions.map(function(c){ return { lead: c[0], answer: c[1], ref: it.id }; })); }
    quota.forEach(function(q){
      var cand = from(q[0]).filter(ok); pool += q[0].completions.length;
      cand.slice(0, q[1]).forEach(function(c){ if (ok(c)){ answers[c.answer] = 1; out.push(c); } });
    });
    if (out.length < count){
      var used = {}; out.forEach(function(c){ used[c.ref] = 1; });
      rng.fork("c:fill").shuffle(pr.pools.usable.filter(function(it){ return !used[it.id] && it !== focus.F && it !== focus.C && it !== focus.T; })).forEach(function(it){
        if (out.length >= count) return;
        pool += it.completions.length;
        var c = from(it).filter(ok)[0]; if (c){ answers[c.answer] = 1; out.push(c); }
      });
    }
    out = out.slice(0, count);
    var bank = rng.fork("c:bank").shuffle(out.map(function(c){ return c.answer; }));
    return { items: out, bank: bank, pool: pool };
  }

  var SENSE_ORDER = ["sight", "touch", "sound", "smell"];
  function sensoryCards(pr, focus, env, rng){
    var data = env.data, g = data.grammar.stages.late, cards = [], usedSense = {}, log = 0;
    var plan = [[focus.F, ["sight"]], [focus.F.senses.touch || focus.F.senses.sound ? focus.F : focus.C, ["touch", "sound"]], [focus.C, ["smell", "sound", "touch", "sight"]], [focus.T, ["sight", "touch", "sound", "smell"]]];
    function card(it, senses, label){
      var r = rng.fork(label), order = senses.slice();
      if (order.length > 1) order = r.shuffle(order);
      for (var s = 0; s < order.length; s++){
        var key = order[s];
        if (usedSense[it.id + key]) continue;
        var el = G.eligible(g[key], it, null, 0, env);
        var pool = r.fork(key).shuffle(el);
        for (var i = 0; i < pool.length; i++){
          var text = G.expand(pool[i].text, it, null, env, r.fork(pool[i].id));
          if (text && G.wordCount(text) <= 10 && !G.lint(text, data) && Mx.textAllowed(pr, text)){
            usedSense[it.id + key] = 1;
            var n = 0; el.forEach(function(t){ n += G.fills(t, it, null, env); }); log += Math.log(Math.max(1, n)) / Math.LN10;
            return { sense: key, item: ref(pr, it), label: it.name, text: text, template: pool[i].id };
          }
        }
      }
      return null;
    }
    for (var i = 0; i < plan.length && cards.length < STAGES.late.cards; i++){
      var c = card(plan[i][0], plan[i][1], "card" + i); if (c) cards.push(c);
    }
    /* anchor cards ("This is a Ford pickup.") always fit */
    var tries = [focus.F, focus.C, focus.T];
    for (var j = 0; cards.length < STAGES.late.cards && j < tries.length; j++){
      var it = tries[j], el = G.eligible(g.anchor, it, null, 0, env), r = rng.fork("anchor" + j);
      for (var k = 0; k < el.length; k++){
        var text = G.expand(el[k].text, it, null, env, r.fork(el[k].id));
        if (text && G.wordCount(text) <= 10 && !G.lint(text, data)){ cards.push({ sense: "anchor", item: ref(pr, it), label: it.name, text: text, template: el[k].id }); break; }
      }
    }
    return { cards: cards, log: log };
  }

  function lookPage(pr, focus, env, rng){
    var data = env.data, g = data.grammar.stages.late;
    var it = [focus.F, focus.C, focus.T].filter(function(x){ return x.subject; })[0] || focus.F;
    var r = rng.fork("look"), lines = [];
    var an = G.eligible(g.anchor, it, null, 0, env);
    for (var i = 0, p = r.shuffle(an); i < p.length && !lines.length; i++){
      var t = G.expand(p[i].text, it, null, env, r.fork(p[i].id));
      if (t && G.wordCount(t) <= 10 && !G.lint(t, data)) lines.push(t);
    }
    var key = ["sight", "touch", "sound", "smell"].filter(function(k){ return it.senses[k] && it.senses[k].length; })[0];
    if (key){
      var el = r.fork("sense").shuffle(G.eligible(g[key], it, null, 0, env));
      for (var j = 0; j < el.length && lines.length < 2; j++){
        var t2 = G.expand(el[j].text, it, null, env, r.fork(el[j].id));
        if (t2 && G.wordCount(t2) <= 10 && !G.lint(t2, data) && lines.indexOf(t2) < 0) lines.push(t2);
      }
    }
    return { item: ref(pr, it), label: it.name, subject: it.subject || null, lines: lines };
  }

  /* ---------- the caregiver action prompts ---------- */
  function senseCue(it, rng){
    var order = rng.shuffle(["touch", "sound", "smell", "sight"].filter(function(k){ return it.senses[k] && it.senses[k].length; })), k = order[0];
    if (!k) return "";
    var v = it.senses[k][rng.int(it.senses[k].length)];
    return k === "touch" ? "the feel of " + v : k === "sound" ? "the sound of the " + v : k === "smell" ? "the smell of " + v : "the look of the " + v;
  }
  function buildPrompts(pr, stage, env, rng, page, focus){
    var data = env.data, tpls = data.grammar.caregiver.templates.filter(function(t){ return t.stages.indexOf(stage) >= 0; });
    var roles = stage === "late" ? ["hook", "talk", "connect", "puzzle", "color", "comfort", "wrap"] : ["hook", "talk", "connect", "puzzle", "color", "wrap"];
    var rM = rng.fork("moments"), momentTpls = rM.shuffle(data.grammar.caregiver.moments[stage]), mi = 0;
    var out = [], usedItem = {};
    var itemsByPage = {};
    [1, 2, 3, 4].forEach(function(n){ itemsByPage[n] = page.refs[n].map(function(id){ return pr.ix.items.get(id); }).filter(Boolean); });
    var wsWord = (page.wordsearch.words.filter(function(w){ return w.src === "F"; })[0] || page.wordsearch.words.filter(function(w){ return w.src !== "name"; })[0] || page.wordsearch.words[0]).word;
    var nameInGrid = page.wordsearch.words.some(function(w){ return w.src === "name"; });
    function nextMoment(){
      var m = momentTpls[mi++ % momentTpls.length], t = G.expand(m, null, null, env, rM.fork("m" + mi)) || m;
      return t.charAt(0).toLowerCase() + t.slice(1);     // a moment ends a sentence ("... as the evening settles in")
    }
    roles.forEach(function(role, idx){
      var r = rng.fork("cg:" + role), list = tpls.filter(function(t){ return t.role === role; }), choices = [];
      list.forEach(function(t){
        var pg = t.page || 0, it = null, extra = {};
        if (role === "hook"){ pg = 1; extra.word = wsWord; if ((t.requires || []).indexOf("name-in-grid") >= 0 && !nameInGrid) return; }
        else if (role === "talk"){ pg = 2; it = itemsByPage[2][0] || null; }
        else if (role === "puzzle"){ pg = 3; it = itemsByPage[3][0] || null; }
        else if (role === "color"){ pg = 4; it = itemsByPage[4][0] || null; }
        else if (role === "connect" || role === "comfort"){
          var opts = [];
          [2, 3, 4, 1].forEach(function(n){ itemsByPage[n].forEach(function(x){ if (!(role === "comfort" && usedItem[x.id] && n === 2 && itemsByPage[2].length > 1)) opts.push([x, n]); }); });
          if (!opts.length) return;
          var prefer = opts.filter(function(o){ return o[1] === 2; });
          var o = (prefer.length ? prefer : opts)[r.fork(t.id).int((prefer.length ? prefer : opts).length)];
          it = o[0]; pg = o[1];
          if (role === "comfort") extra.sense_cue = senseCue(it, r.fork("cue"));
        }
        if (role !== "wrap" && role !== "hook" && !it && G.slotsOf(t.text).some(function(s){ return /item/.test(s); })) return;
        extra.page = pg || ""; extra.moment = null;
        choices.push({ t: t, it: it, pg: pg, extra: extra });
      });
      if (!choices.length) return;
      var pick = r.shuffle(choices);
      for (var i = 0; i < pick.length; i++){
        var c = pick[i], needMoment = G.slotsOf(c.t.text).indexOf("moment") >= 0;
        var e2 = { data: data, ix: env.ix, era: env.era, pronoun: env.pronoun, name: env.name, extra: Object.assign({}, c.extra, { moment: needMoment ? nextMoment() : "x" }) };
        if (!G.available(G.slotsOf(c.t.text), c.it, null, e2)) continue;
        var text = G.expand(c.t.text, c.it, null, e2, r.fork(c.t.id));
        if (text && !G.lint(text, data) && Mx.textAllowed(pr, text)){
          if (c.it) usedItem[c.it.id] = 1;
          var names = c.it && /\bitem\b|_item/.test(c.t.text);
          out.push({ n: out.length + 1, page: c.pg || null, role: role, text: text, ref: names ? c.it.id : null, template: c.t.id });
          return;
        }
      }
    });
    return out;
  }

  /* ---------- how many different packets this resident can have ---------- */
  var logChoose = function(n, k){ if (k <= 0 || k > n) return 0; var s = 0; for (var i = 1; i <= k; i++) s += Math.log((n - k + i) / i) / Math.LN10; return s; };
  var log10 = function(n){ return n > 0 ? Math.log(n) / Math.LN10 : 0; };
  function bigText(l){
    if (l < 3) return String(Math.max(1, Math.round(Math.pow(10, l))));
    var units = [[15, "quadrillion"], [12, "trillion"], [9, "billion"], [6, "million"], [3, "thousand"]];
    if (l >= 18) return "more than a quintillion";
    for (var i = 0; i < units.length; i++) if (l >= units[i][0]){
      var v = Math.pow(10, l - units[i][0]), r = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
      return r + " " + units[i][1];
    }
    return String(Math.round(Math.pow(10, l)));
  }

  /* ---------- the packet ---------- */
  function generate(raw, opts){
    opts = opts || {};
    var data = Mx.data(), pr = Mx.readProfile(raw, data), ix = pr.ix;
    var parts = P.dateParts(opts.date), variant = Math.max(0, opts.variant | 0), stage = pr.stage, S = STAGES[stage];
    pr.day = parts.day;
    var seed = P.dailySeed(pr.nameKey, parts, variant), rng = P.create(seed);
    var name = pr.first || "the resident";
    var env = { data: data, ix: ix, era: pr.era, pronoun: pr.pronoun, name: name, extra: {} };
    var focus = Mx.focusFor(pr, parts, variant);

    /* yesterday's words are left out: a new morning is new words */
    var yFocus = Mx.focusAt(pr, P.addDays(parts, -1), 0, null), prev = [];
    [yFocus.F, yFocus.C, yFocus.T].forEach(function(it){ it.terms.forEach(function(t){ prev.push(t[0]); }); });

    /* page 1: the word search */
    var wsWords = chooseSearchWords(pr, focus, stage, rng.fork("ws"), prev, data.safety);
    var wsCfg = S.wordsearch;
    var ws = Z.wordSearch(wsWords.map(function(w){ return w.word; }), wsCfg, rng.fork("wsgrid"), data.safety);
    var placedWords = wsWords.filter(function(w){ return ws.placed.some(function(p){ return p.word === w.word; }); });
    var T = data.grammar.ui.titles, I = data.grammar.ui.instructions;
    var pages = [], refs = { 1: [], 2: [], 3: [], 4: [] }, log = 0;
    var addRef = function(n, id){ if (id && refs[n].indexOf(id) < 0) refs[n].push(id); };
    placedWords.forEach(function(w){ addRef(1, w.ref); });
    log += logChoose(Math.max(wsWords.length, [focus.F, focus.C, focus.T].reduce(function(a, it){ return a + wordsOf(it, wsCfg.minLen, wsCfg.maxLen, new Set(prev)).length; }, 0)), wsCfg.words - 1);
    var page1 = { n: 1, type: "wordsearch", title: T.wordsearch, instruction: I["wordsearch." + stage], size: ws.size, rows: ws.rows, words: placedWords, list: placedWords.map(function(w){ return w.word; }).sort(), placed: ws.placed, directions: wsCfg.dirs.length > 2 ? "across, down and slanted" : wsCfg.dirs.length === 2 ? "across and down" : "across" };
    pages.push(page1);

    /* page 2: the conversation, in the stage's own voice */
    var page2 = { n: 2, type: "talk", style: stage === "early" ? "open" : stage === "middle" ? "complete" : "sense", title: T["talk." + stage] };
    if (stage === "early"){
      var te = talkEarly(pr, focus, env, rng.fork("talk"));
      page2.instruction = I["talk.early"]; page2.items = te.lines; log += te.log;
      te.lines.forEach(function(l){ l.refs.forEach(function(id){ addRef(2, id); }); });
    } else if (stage === "middle"){
      var co = completions(pr, focus, stage, rng.fork("complete"));
      page2.instruction = rng.fork("intro").pick(data.grammar.stages.middle.intro); page2.bankLabel = data.grammar.stages.middle.bankLabel;
      page2.items = co.items; page2.bank = co.bank;
      co.items.forEach(function(c){ addRef(2, c.ref); });
      log += logChoose(Math.max(co.pool, co.items.length), co.items.length);
    } else {
      var sc = sensoryCards(pr, focus, env, rng.fork("cards"));
      page2.instruction = ""; page2.cards = sc.cards; log += sc.log;
      sc.cards.forEach(function(c){ addRef(2, c.item.id); });
    }
    pages.push(page2);

    /* page 3: the stage's puzzle */
    var page3 = { n: 3, type: "puzzle", title: T["puzzle." + stage], instruction: I["puzzle." + stage] };
    var xw = stage === "late" ? null : buildCrossword(pr, focus, stage, rng.fork("p3"), prev, placedWords.map(function(w){ return w.word; }), data.safety);
    if (xw){
      page3.style = "crossword"; page3.crossword = xw.cw;
      page3.bank = xw.cw.entries.map(function(e){ return e.word; }).sort();
      page3.firstLetters = stage === "middle";
      xw.cw.entries.forEach(function(e){ addRef(3, e.ref); });
      log += logChoose(Math.max(xw.candidates, xw.cw.entries.length), xw.cw.entries.length);
    } else {
      var lk = lookPage(pr, focus, env, rng.fork("look"));
      page3.style = "look"; page3.look = lk; page3.title = T["puzzle.late"]; page3.instruction = I["puzzle.late"];
      addRef(3, lk.item.id);
    }
    pages.push(page3);

    /* page 4: the bold-line coloring page */
    var page4 = { n: 4, type: "coloring", title: T.coloring, instruction: I["coloring." + stage] };
    var withSubject = [focus.F, focus.C, focus.T].filter(function(it){ return it.subject; })[0];
    if (stage !== "late" && withSubject){
      page4.style = "subject"; page4.subject = withSubject.subject; page4.ref = withSubject.id; page4.label = withSubject.name;
      page4.seed = P.seedInt(seed + "/color"); addRef(4, withSubject.id);
    } else {
      page4.style = "mandala"; page4.seed = P.seedInt(seed + "/mandala"); page4.subject = null; page4.ref = null; page4.label = "";
    }
    pages.push(page4);

    /* page 5: for staff */
    var page = { refs: refs, wordsearch: page1 };
    var prompts = buildPrompts(pr, stage, env, rng.fork("prompts"), page, focus);
    var why = [["Featured today", focus.F], ["Goes with it", focus.C], ["A step away", focus.T]].map(function(x){
      var e = Mx.explain(pr, x[1]);
      return { label: x[0], item: x[1].name, id: x[1].id, pool: e.pool, why: e.why };
    });
    var answers = { wordsearch: page1.list.slice() };
    if (page3.style === "crossword") answers.crossword = page3.crossword.entries.map(function(e){ return e.num + (e.dir === "A" ? " across" : " down") + ": " + e.word; });
    if (page2.style === "complete") answers.completions = page2.items.map(function(c){ return c.lead + " ... " + c.answer; });
    pages.push({ n: 5, type: "staff", title: T.staff, note: I["staff.note"], why: why, prompts: prompts, answers: answers });

    /* what is possible for this resident */
    var sp = pr.slots, triples = log10(sp.F.length) + log10(sp.C.length) + log10(sp.T.length);
    var total = triples + log;
    return {
      version: VERSION, content: data.hash, seed: seed, variant: variant,
      date: { iso: parts.iso, label: dateLabel(parts), day: parts.day },
      stage: stage, stageInfo: { label: S.label, focus: S.focus },
      resident: { first: pr.first, name: name, pronoun: pr.pronoun, born: pr.born },
      theme: focus.F.name,
      focus: { feature: ref(pr, focus.F, "F"), companion: ref(pr, focus.C, "C"), surprise: ref(pr, focus.T, "T") },
      why: why, read: Mx.summary(pr), pages: pages, prompts: prompts, answers: answers, refs: refs,
      stats: { permutations: { log10: Math.round(total * 100) / 100, text: bigText(total) }, focusTriples: Math.round(Math.pow(10, triples)), pools: pr.health }
    };
  }

  /* how many packets can be made for a profile, without making one */
  function permutations(raw){ var p = generate(raw, {}); return p.stats.permutations; }

  PCG.packet = { generate: generate, permutations: permutations, STAGES: STAGES, VERSION: VERSION, dateLabel: dateLabel, bigText: bigText };
  PCG.generate = generate;
})(typeof globalThis !== "undefined" ? globalThis : this);
