/* =====================================================================
   Cognicopia PCG: the tagging matrix.

   What this module decides is WHAT a resident's packet is about; the
   other modules decide how it is written and laid out.

   Reading the profile
     Every typed field (work, hobbies, favorite things, pets, first car...)
     is broken into words and matched to the topic graph in topics.json:
     exactly, by plural ("tractors" is "tractor"), by a misspelling
     ("gardning" is "gardening"), or by a phrase ("model t"). A match
     counts for more or less by field. The topics that clear the bar are the
     resident's OWN topics. The year of birth weights the decades of their
     teens and twenties; a decade named outright ("fifties") counts fully.
     Anything the avoid list names is removed before any of this happens, so
     it can never be matched, pooled or printed.

   Three pools, and why there are three
     own      items from the resident's own topics (a farmer: tractors, barns,
              hens), plus anything named in the profile word for word.
     cross    items from OTHER topics that share a cross-pollination tag with
              an own topic, strongest overlap first: a farmer has "rural" and
              "utility", a 1950s Ford pickup carries both, so the pickup is
              offered although its own topic is cars.
     tangent  items from a topic exactly ONE step away on the graph: for a
              teacher, playground games and packed lunches, never aviation.
     Nothing further than one step is ever reachable. Each pool is rotated
     on its own (see prng.js), so on any day the featured item, its
     companion and the surprise come from three disjoint pools, and
     tomorrow's three are three different items.

   How much a page may assume
     An item gets a level: 2 when the profile names it, 1 when it belongs to
     an own topic, 0 when it is a cross-over or a tangent. The grammar only
     lets a sentence presume as much as the level allows ("Tell me about a
     time you fixed a tailgate" needs 2; "What made a pickup so dependable?"
     needs 0).

   Runs in the browser (window.CognicopiaPCG.matrix) and in Node (vm).
   ===================================================================== */
(function (root) {
  "use strict";
  var PCG = root.CognicopiaPCG = root.CognicopiaPCG || {};
  var P = PCG.prng;
  if (!P) throw new Error("Load prng.js before matrix.js.");

  var FIELD_ORDER = ["job", "hobbies", "favs", "pets", "firstcar", "firstjob", "school", "extra", "town"];
  var FIELD_LABEL = { job: "their work", hobbies: "things they enjoyed", favs: "favorite things", pets: "their pets", firstcar: "their first car", firstjob: "their first job", school: "their school", extra: "topics added for today", town: "their hometown" };
  var EXPLICIT_DECADE = /\b(?:19|20)\d0s?\b|\b[2-9]0s\b/g;

  function data(){
    var d = root.CognicopiaPCGData;
    if (!d) throw new Error("The content bundle (assets/pcg/pcg-data.bundle.js) is not loaded.");
    return d;
  }
  function stageOf(s){
    var v = String(s == null ? "" : s).toLowerCase();
    if (v === "early" || v === "mild" || v === "1" || v === "early-stage") return "early";
    if (v === "late" || v === "advanced" || v === "severe" || v === "3" || v === "late-stage") return "late";
    return "middle";
  }
  var byId = function(a, b){ return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; };

  /* ---------- words ---------- */
  /* One stem per word, applied to the profile and to the keywords alike, so
     both sides agree even where the stem itself is not a real word. */
  function stem(w){
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + "y";
    if (w.length > 4 && /(ches|shes|xes|sses|zes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 5 && /oes$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function toks(text, stop){
    var f = P.fold(text), out = [];
    if (!f) return out;
    f.split(" ").forEach(function(w){ if (w && !stop.has(w)) out.push(stem(w)); });
    return out;
  }
  /* Is b within one edit (insert, delete or swap-for-another letter) of a? */
  function within1(a, b){
    if (a === b) return true;
    var la = a.length, lb = b.length, i = 0, j = 0, edits = 0;
    if (Math.abs(la - lb) > 1) return false;
    while (i < la && j < lb){
      if (a.charAt(i) === b.charAt(j)){ i++; j++; continue; }
      if (++edits > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    return edits + (la - i) + (lb - j) <= 1;
  }
  function containsSeq(hay, needle){
    for (var i = 0; i + needle.length <= hay.length; i++){
      var k = 0;
      while (k < needle.length && hay[i + k] === needle[k]) k++;
      if (k === needle.length) return true;
    }
    return false;
  }

  /* ---------- the indexes, built once per content bundle ---------- */
  var INDEX = new WeakMap();
  function index(d){
    var ix = INDEX.get(d);
    if (ix) return ix;
    var M = d.profileMap, stop = new Set(M.stopwords);
    ix = { M: M, stop: stop, tags: new Map(), decades: [], topics: new Map(), adj: new Map(), general: [], items: new Map(), byTopic: new Map(),
           df: new Map(), idf: new Map(), kw: new Map(), phrases: [], fuzzy: [], itemKeys: new Map(), itemText: new Map(), itemDecades: new Map(), N: d.items.length };
    d.tags.forEach(function(t){ ix.tags.set(t.id, t); if (t.decade) ix.decades.push(t.id); });
    d.topics.forEach(function(t){ ix.topics.set(t.id, t); ix.adj.set(t.id, new Set()); ix.byTopic.set(t.id, []); if (t.general) ix.general.push(t.id); });
    d.topics.forEach(function(t){ t.neighbors.forEach(function(n){ if (ix.adj.has(n)){ ix.adj.get(t.id).add(n); ix.adj.get(n).add(t.id); } }); });
    d.topics.forEach(function(t){
      t.keywords.forEach(function(k){
        var ts = toks(k, stop);
        if (!ts.length) return;
        if (ts.length === 1){
          if (!ix.kw.has(ts[0])) ix.kw.set(ts[0], new Set());
          ix.kw.get(ts[0]).add(t.id);
          if (ts[0].length >= M.match.fuzzyMinLength) ix.fuzzy.push([ts[0], t.id]);
        } else ix.phrases.push({ toks: ts, topic: t.id });
      });
    });
    d.items.forEach(function(it){
      ix.items.set(it.id, it);
      it.topics.forEach(function(tp){ if (ix.byTopic.has(tp)) ix.byTopic.get(tp).push(it); });
      it.tags.forEach(function(g){ ix.df.set(g, (ix.df.get(g) || 0) + 1); });
      ix.itemDecades.set(it.id, it.tags.filter(function(g){ return ix.tags.get(g) && ix.tags.get(g).decade; }));
      ix.itemKeys.set(it.id, [toks(it.name, stop)].concat((it.aka || []).map(function(a){ return toks(a, stop); })).filter(function(k){ return k.length; }));
      var text = new Set(), add = function(s){ toks(s, stop).forEach(function(w){ text.add(w); }); };
      add(it.name); add(it.plural || ""); (it.aka || []).forEach(add); it.parts.forEach(add);
      Object.keys(it.senses).forEach(function(k){ it.senses[k].forEach(add); });
      it.terms.forEach(function(t){ add(t[0]); add(t[1]); });
      it.completions.forEach(function(c){ add(c[0]); add(c[1]); });
      (it.facts || []).forEach(add);
      ix.itemText.set(it.id, text);
    });
    ix.df.forEach(function(n, g){ ix.idf.set(g, Math.log(1 + ix.N / n)); });
    INDEX.set(d, ix);
    return ix;
  }

  /* ---------- the avoid list ---------- */
  /* Every word of every entry counts ("Vietnam war" avoids both), and any
     topic with that word as a keyword is avoided as a whole. */
  function avoidOf(list, ix){
    var tokens = new Set(), topics = new Set();
    (list || []).forEach(function(e){ toks(e, ix.stop).forEach(function(t){ if (t.length >= 3) tokens.add(t); }); });
    tokens.forEach(function(t){ var s = ix.kw.get(t); if (s) s.forEach(function(id){ topics.add(id); }); });
    /* a phrase keyword ("main street") is avoided when all of its words are */
    ix.phrases.forEach(function(ph){ if (ph.toks.every(function(t){ return tokens.has(t); })) topics.add(ph.topic); });
    return { tokens: tokens, topics: topics, any: tokens.size > 0 };
  }
  function entryAllowed(text, avoid, ix){
    if (!avoid.any) return true;
    var ts = toks(text, ix.stop);
    for (var i = 0; i < ts.length; i++) if (avoid.tokens.has(ts[i])) return false;
    return true;
  }
  function itemAllowed(it, avoid, ix){
    if (!avoid.any) return true;
    for (var i = 0; i < it.topics.length; i++) if (avoid.topics.has(it.topics[i])) return false;
    var text = ix.itemText.get(it.id), bad = false;
    avoid.tokens.forEach(function(t){ if (text.has(t)) bad = true; });
    return !bad;
  }
  /* A sentence the engine built, checked against the same list. */
  function textAllowed(profile, text){ return entryAllowed(text, profile.avoid, profile.ix); }

  /* ---------- the years ---------- */
  function bumpAt(age, bumps){
    for (var i = 0; i < bumps.length; i++) if (age >= bumps[i].from && age <= bumps[i].to) return bumps[i].w;
    return 0;
  }
  /* How much of each decade falls in the years that stay vivid: ages 10 to 30
     count fully, the years either side half or less. */
  function eraOf(born, explicit, ix){
    var weights = {}, known = !!born || explicit.length > 0;
    ix.decades.forEach(function(d){
      var start = parseInt(d.slice(0, 4), 10), sum = 0, y;
      if (born) for (y = start; y < start + 10; y++) sum += bumpAt(y - born, ix.M.memory.bump);
      weights[d] = born ? sum / 10 : 0;
    });
    explicit.forEach(function(d){ weights[d] = 1; });
    return { known: known, weights: weights, explicit: explicit };
  }
  function eraFit(it, era, ix){
    if (!era.known) return ix.M.memory.timeless;
    var ds = ix.itemDecades.get(it.id);
    if (!ds.length) return ix.M.memory.timeless;
    var best = 0;
    ds.forEach(function(d){ var v = era.weights[d]; if (v > best) best = v; });
    return best;
  }

  /* ---------- reading a profile ---------- */
  var toList = function(v){
    if (v == null) return [];
    var a = Array.isArray(v) ? v : String(v).split(",");
    return a.map(function(s){ return String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, 80); }).filter(Boolean).slice(0, 24);
  };
  var toInt = function(v){ var n = parseInt(v, 10); return isFinite(n) ? n : 0; };

  /* The resident's own words for the puzzles: a name in the grid is an anchor.
     A pet, child or spouse is one word ("Rusty (dog)" is RUSTY); a town is
     its words run together ("Rapid City" is RAPIDCITY). */
  function personalWords(raw, avoid, ix){
    var out = [], seen = {};
    function add(entry, firstOnly){
      if (!entryAllowed(entry, avoid, ix)) return;
      var f = P.fold(String(entry).replace(/\(.*?\)/g, " "));
      if (!f) return;
      var w = (firstOnly ? f.split(" ")[0] : f.replace(/ /g, "")).toUpperCase();
      if (/^[A-Z]{3,11}$/.test(w) && !seen[w]){ seen[w] = 1; out.push(w); }
    }
    toList(raw.pets).forEach(function(e){ add(e, true); });
    toList(raw.town).forEach(function(e){ add(e, false); });
    toList(raw.kids).forEach(function(e){ add(e, true); });
    toList(raw.spouse).forEach(function(e){ add(e, true); });
    toList(raw.crew).forEach(function(e){ add(e, true); });
    toList(raw.state).forEach(function(e){ add(e, false); });
    return out;
  }
  var firstWord = function(name){ var w = P.fold(name).split(" ")[0] || ""; return w.toUpperCase(); };

  function readProfile(raw, d){
    d = d || data();
    raw = raw || {};
    var ix = index(d), M = ix.M, W = M.fieldWeights;
    var born = toInt(raw.born); if (born < 1880 || born > 2015) born = 0;
    var avoid = avoidOf(toList(raw.avoid), ix);

    /* the typed fields, with any entry the avoid list names left out */
    var fields = {};
    FIELD_ORDER.forEach(function(f){
      var src = f === "extra" ? raw.topics : raw[f], list = toList(src).filter(function(e){ return entryAllowed(e, avoid, ix); });
      if (list.length) fields[f] = list;
    });

    /* explicit decades ("fifties", "1960s", "the 70s") */
    var explicit = [], allText = FIELD_ORDER.map(function(f){ return (fields[f] || []).join(" "); }).join(" ").toLowerCase();
    (allText.match(EXPLICIT_DECADE) || []).forEach(function(m){
      var n = parseInt(m, 10), dec = m.length <= 3 ? (n < 20 ? 2000 + n : 1900 + n) : n;
      var id = dec + "s"; if (ix.tags.has(id) && explicit.indexOf(id) < 0) explicit.push(id);
    });
    Object.keys(M.decadeWords).forEach(function(w){ if (new RegExp("\\b" + w + "\\b").test(allText) && explicit.indexOf(M.decadeWords[w]) < 0 && ix.tags.has(M.decadeWords[w])) explicit.push(M.decadeWords[w]); });
    var era = eraOf(born, explicit, ix);

    /* words in the profile -> topics */
    var scores = {}, flat = [];
    FIELD_ORDER.forEach(function(f){
      var weight = W[f] != null ? W[f] : 0.5;
      (fields[f] || []).forEach(function(entry){
        var ts = toks(entry, ix.stop), hits = {};
        flat.push({ field: f, weight: weight, set: new Set(ts), toks: ts });
        ts.forEach(function(t){
          var exact = ix.kw.get(t);
          if (exact) exact.forEach(function(id){ hits[id] = Math.max(hits[id] || 0, 1); });
          else if (t.length >= M.match.fuzzyMinLength) ix.fuzzy.forEach(function(p){
            if (within1(t, p[0])) hits[p[1]] = Math.max(hits[p[1]] || 0, M.match.fuzzyFactor);
          });
        });
        ix.phrases.forEach(function(ph){ if (containsSeq(ts, ph.toks)) hits[ph.topic] = Math.max(hits[ph.topic] || 0, M.match.phraseBoost); });
        Object.keys(hits).forEach(function(id){
          var s = scores[id] || (scores[id] = { id: id, score: 0, via: {} });
          s.score += weight * hits[id];
          s.via[f] = (s.via[f] || 0) + 1;
        });
      });
    });
    var own = Object.keys(scores).map(function(id){ var s = scores[id]; s.score = Math.min(s.score, M.match.entryCap); return s; })
      .filter(function(s){ return s.score >= M.match.ownThreshold && !avoid.topics.has(s.id); })
      .sort(function(a, b){ return b.score - a.score || (a.id < b.id ? -1 : 1); })
      .slice(0, M.match.maxOwnTopics);
    var generic = own.length === 0;
    if (generic) own = ix.general.filter(function(id){ return !avoid.topics.has(id); }).map(function(id){ return { id: id, score: M.match.ownThreshold, via: {}, general: true }; });
    var ownIds = new Set(own.map(function(o){ return o.id; }));

    /* items the profile names outright */
    var nameHit = new Set();
    d.items.forEach(function(it){
      var keys = ix.itemKeys.get(it.id);
      for (var i = 0; i < flat.length; i++){
        if (flat[i].weight < 0.5) continue;
        for (var k = 0; k < keys.length; k++){
          var all = true;
          for (var j = 0; j < keys[k].length; j++) if (!flat[i].set.has(keys[k][j])) { all = false; break; }
          if (all){ nameHit.add(it.id); return; }
        }
      }
    });

    /* the tags the profile leans toward */
    var tagW = {};
    own.forEach(function(o){
      var s = Math.min(1, o.score);
      ix.topics.get(o.id).implies.forEach(function(g){ tagW[g] = Math.min(2, (tagW[g] || 0) + s); });
    });
    nameHit.forEach(function(id){
      ix.items.get(id).tags.forEach(function(g){ var t = ix.tags.get(g); if (t && !t.decade && !t.generic) tagW[g] = Math.min(2, (tagW[g] || 0) + 0.5); });
    });

    var profile = {
      ix: ix, data: d,
      first: String(raw.first == null ? "" : raw.first).trim().slice(0, 40),
      nameKey: P.nameKey(raw.first),
      born: born, stage: stageOf(raw.stage), pronoun: ({ she: "she", he: "he", they: "they" })[String(raw.pronoun || "they").toLowerCase()] || "they",
      fields: fields, avoid: avoid, era: era, ownTopics: own, ownIds: ownIds, generic: generic, nameHit: nameHit, tagW: tagW,
      anchorName: firstWord(raw.first), anchors: personalWords(raw, avoid, ix), items: new Map()
    };
    buildPools(profile);
    return profile;
  }

  /* ---------- the pools ---------- */
  function buildPools(pr){
    var ix = pr.ix, M = ix.M, d = pr.data, own = [], crossC = [], tangent = [];
    var nb = new Set();
    pr.ownTopics.forEach(function(o){ ix.adj.get(o.id).forEach(function(n){ if (!pr.ownIds.has(n) && !pr.avoid.topics.has(n)) nb.add(n); }); });
    var usable = [];
    d.items.forEach(function(it){
      if (!itemAllowed(it, pr.avoid, ix)) return;
      var fit = eraFit(it, pr.era, ix);
      if (fit < M.memory.eligible) return;
      var level = pr.nameHit.has(it.id) ? 2 : (!pr.generic && it.topics.some(function(t){ return pr.ownIds.has(t); }) ? 1 : 0);
      var inOwn = level >= 1 || (pr.generic && it.topics.some(function(t){ return pr.ownIds.has(t); }));
      pr.items.set(it.id, { item: it, level: level, fit: fit });
      usable.push(it);
      if (inOwn) own.push(it);
    });
    var ownSet = new Set(own.map(function(i){ return i.id; }));
    var maxX = 0;
    usable.forEach(function(it){
      if (ownSet.has(it.id)) return;
      var s = 0, linked = 0;
      it.tags.forEach(function(g){
        var t = ix.tags.get(g);
        if (!t || t.decade || t.generic || !pr.tagW[g]) return;
        s += pr.tagW[g] * ix.idf.get(g); linked++;
      });
      if (linked) { crossC.push([it, s]); if (s > maxX) maxX = s; }
    });
    var cut = Math.max(M.pools.crossMinScore, maxX * M.pools.crossRelative);
    crossC = crossC.filter(function(x){ return x[1] >= cut; })
      .sort(function(a, b){ return b[1] - a[1] || (a[0].id < b[0].id ? -1 : 1); }).slice(0, M.pools.crossMax);
    var cross = crossC.map(function(x){ return x[0]; }), crossSet = new Set(cross.map(function(i){ return i.id; }));
    var tc = [];
    usable.forEach(function(it){
      if (ownSet.has(it.id) || crossSet.has(it.id)) return;
      var near = it.topics.filter(function(t){ return nb.has(t); });
      if (!near.length) return;
      var s = pr.items.get(it.id).fit;
      it.tags.forEach(function(g){ var t = ix.tags.get(g); if (t && !t.decade && !t.generic && pr.tagW[g]) s += 0.3 * pr.tagW[g]; });
      tc.push([it, s]);
    });
    tangent = tc.sort(function(a, b){ return b[1] - a[1] || (a[0].id < b[0].id ? -1 : 1); }).slice(0, M.pools.tangentMax).map(function(x){ return x[0]; });
    pr.pools = { own: own.sort(byId), cross: cross.sort(byId), tangent: tangent.sort(byId), usable: usable.sort(byId), neighbors: nb };
    pr.slots = slotPools(pr);
    pr.health = { own: pr.pools.own.length, cross: pr.pools.cross.length, tangent: pr.pools.tangent.length,
                  thin: pr.pools.own.length < M.pools.minPool || pr.pools.cross.length < M.pools.minPool || pr.pools.tangent.length < M.pools.minPool };
    if (!usable.length){ var e = new Error("The avoid list leaves nothing to build today's packet from. Remove a word or two and try again."); e.code = "PCG_NO_CONTENT"; throw e; }
  }

  /* A pool that is too small borrows from the next closest group, never from farther away. */
  function slotPools(pr){
    var min = pr.ix.M.pools.minPool, pl = pr.pools;
    var F = pl.own.slice(), C = pl.cross.slice(), T = pl.tangent.slice();
    function topUp(base, groups){
      var seen = new Set(base.map(function(i){ return i.id; }));
      groups.forEach(function(g){ g.forEach(function(it){ if (base.length < min && !seen.has(it.id)){ seen.add(it.id); base.push(it); } }); });
      base.sort(byId);
    }
    if (F.length < min) topUp(F, [C, T]);
    if (C.length < min) topUp(C, [T, F]);
    if (T.length < min) topUp(T, [C, F]);
    if (!F.length) F = pl.usable.slice();
    if (!C.length) C = pl.usable.slice();
    if (!T.length) T = pl.usable.slice();
    return { F: F, C: C, T: T };
  }

  /* ---------- the day's three ---------- */
  /* The featured item, its companion and the surprise for a day.
     variant 0 is the day's packet; a higher variant is a second packet for
     the same day: independent of the rotation, and never any of the
     baseline's three. */
  function focusAt(pr, parts, variant, exclude){
    var key = pr.nameKey, used = new Set(exclude || []), sp = pr.slots;
    function pick(pool, slot){
      var n = pool.length, it, step, idx;
      if (!n) return null;
      if (variant > 0){
        var avail = pool.filter(function(x){ return !used.has(x.id); });
        if (!avail.length) return null;
        return avail[P.create(key + "|" + slot + "|v" + variant + "|" + parts.iso).int(avail.length)];
      }
      idx = P.rotationIndex(key + "|" + slot, n, parts.day);
      for (step = 0; step < n; step++){ it = pool[(idx + step) % n]; if (!used.has(it.id)) return it; }
      return null;
    }
    var F = pick(sp.F, "F"); if (F) used.add(F.id);
    var C = pick(sp.C, "C"); if (C) used.add(C.id);
    var T = pick(sp.T, "T"); if (T) used.add(T.id);
    var rest = pr.pools.usable.filter(function(x){ return !used.has(x.id); });
    function any(slot){ var it = rest.length ? rest[P.create(key + "|" + slot + "|any|" + parts.iso + "|" + variant).int(rest.length)] : pr.pools.usable[0]; rest = rest.filter(function(x){ return x !== it; }); used.add(it.id); return it; }
    if (!F) F = any("F"); if (!C) C = any("C"); if (!T) T = any("T");
    return { F: F, C: C, T: T };
  }
  function focusFor(pr, parts, variant){
    var base = focusAt(pr, parts, 0, null);
    if (!variant) return base;
    return focusAt(pr, parts, variant, [base.F.id, base.C.id, base.T.id]);
  }

  /* ---------- why each item was chosen ---------- */
  function topicLabel(ix, id){ return ix.topics.get(id).label; }
  function explain(pr, it){
    var ix = pr.ix, info = pr.items.get(it.id) || { level: 0 };
    var viaOf = function(o){ var f = FIELD_ORDER.filter(function(k){ return o.via && o.via[k]; })[0]; return f ? FIELD_LABEL[f] : ""; };
    var mine = pr.ownTopics.filter(function(o){ return it.topics.indexOf(o.id) >= 0; })[0];
    if (pr.nameHit.has(it.id)) return { pool: "own", level: 2, why: "It is named in the profile." };
    if (mine && !mine.general) return { pool: "own", level: 1, topic: topicLabel(ix, mine.id), via: viaOf(mine), why: "From " + topicLabel(ix, mine.id) + (viaOf(mine) ? " (" + viaOf(mine) + ")" : "") + "." };
    if (mine && mine.general) return { pool: "own", level: 0, topic: topicLabel(ix, mine.id), why: "A familiar everyday topic: " + topicLabel(ix, mine.id) + "." };
    var shared = it.tags.filter(function(g){ var t = ix.tags.get(g); return t && !t.decade && !t.generic && pr.tagW[g]; })
      .sort(function(x, y){ return pr.tagW[y] - pr.tagW[x] || (x < y ? -1 : 1); }).slice(0, 2);
    var inCross = pr.pools.cross.indexOf(it) >= 0;
    if (inCross && shared.length){
      /* each shared tag, with the interest it comes from: "the outdoors with fishing and the seasons with gardening" */
      var byOwner = [], seenOwner = {};
      shared.forEach(function(g){
        var owner = pr.ownTopics.filter(function(o){ return ix.topics.get(o.id).implies.indexOf(g) >= 0; })
          .sort(function(x, y){ return y.score - x.score; })[0];
        var who = owner ? topicLabel(ix, owner.id) : "";
        if (seenOwner[who] != null) byOwner[seenOwner[who]].tags.push(ix.tags.get(g).label);
        else { seenOwner[who] = byOwner.length; byOwner.push({ who: who, tags: [ix.tags.get(g).label] }); }
      });
      var text = "It shares " + byOwner.map(function(x){ return x.tags.join(" and ") + (x.who ? " with " + x.who : ""); }).join(", and ") + ".";
      return { pool: "cross", level: 0, tags: shared.map(function(g){ return ix.tags.get(g).label; }), topic: byOwner[0].who, why: text };
    }
    var near = it.topics.filter(function(t){ return pr.pools.neighbors.has(t); })[0];
    var from = near ? pr.ownTopics.filter(function(o){ return ix.adj.get(o.id).has(near); })[0] : null;
    return { pool: "tangent", level: 0, topic: near ? topicLabel(ix, near) : "", from: from ? topicLabel(ix, from.id) : "",
             why: "One step from " + (from ? topicLabel(ix, from.id) : "their interests") + ": " + (near ? topicLabel(ix, near) : "a related topic") + "." };
  }

  /* what was read from the profile, for people to check */
  function summary(pr){
    var ix = pr.ix;
    return {
      topics: pr.generic ? [] : pr.ownTopics.map(function(o){ return { id: o.id, label: topicLabel(ix, o.id), via: FIELD_ORDER.filter(function(k){ return o.via[k]; }).map(function(k){ return FIELD_LABEL[k]; }) }; }),
      generic: pr.generic,
      decades: pr.era.known ? ix.decades.filter(function(d){ return pr.era.weights[d] >= ix.M.memory.eligible; }).map(function(d){ return ix.tags.get(d).label; }) : [],
      pools: pr.health,
      avoiding: pr.avoid.any
    };
  }

  /* does a tag or topic link these two items in one step? (used by the checks) */
  function oneDegree(pr, it){
    var ix = pr.ix, own = pr.ownIds, i;
    for (i = 0; i < it.topics.length; i++){
      if (own.has(it.topics[i])) return true;
      var ad = ix.adj.get(it.topics[i]);
      var hit = false; own.forEach(function(o){ if (ad.has(o)) hit = true; });
      if (hit) return true;
    }
    return it.tags.some(function(g){ var t = ix.tags.get(g); return t && !t.decade && !t.generic && pr.tagW[g]; });
  }

  PCG.matrix = {
    data: data, index: index, stageOf: stageOf, stem: stem, within1: within1, readProfile: readProfile, focusFor: focusFor, focusAt: focusAt,
    explain: explain, summary: summary, textAllowed: textAllowed, oneDegree: oneDegree, eraFit: eraFit, FIELD_LABEL: FIELD_LABEL
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
