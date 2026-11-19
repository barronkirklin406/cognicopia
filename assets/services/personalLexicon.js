/* The personal life-detail lexicon (hand-written source with no TypeScript; edit this file directly. It is listed in HAND_WRITTEN in
   scripts/build-services.mjs, so npm run services never builds or overwrites it).

   Why: a resident's own words (a brother, a pet, a first car, the town they grew up in) used to reach the crossword and the word search only
   as bare words, and each tool read them its own way. This module reads a resident ONCE, from either place a resident lives (the unified profile
   read by js/residentContext.js, or the packet tool's own form), and hands every activity the same list: an answer, the letters it takes in a
   grid, and one warm clue that is true of that exact answer.

   What it never does
     - It never guesses. "Your oldest brother" is said only when the profile says brother and oldest; with no role it says "A brother or sister of
       yours"; with no pet kind it says "A pet who was part of your home". A blank field gives no item at all.
     - It never asks a question or tests memory, and no clue holds its own answer.
     - It skips anyone marked as passed away, and anything the avoid list hits (whole words, with plurals), in the answer, the clue or the fact.
     - It never uses a number it was not given: a year appears only when the profile holds it (the birth year, a recorded moment, the year of
       the first car), and grid answers are letters only.
     - It names nobody's pronoun: no clue says he, she, his or her.

   build(source, opts)       -> { version, source, born, stage, count, thin, items[], numbers[] }
       source   a CogniResident.person() result, or the packet tool's resident object (r)
       opts     { avoid: [terms] | function(text)->bool, seed: "resident id or name", date: "2026-11-19" }
       item     { id, kind, tier, answer, grid, clue, phrase, fact, year? }       kind: sibling spouse child grandchild parent pet car-make car-model
                                                                                  car-color town state work first-job hobby favorite dish
       number   { kind: born | moment | car-year, value, text, clue }
       count    how many facts the profile really holds; thin is true under 3, and then no activity may claim to be "from your life"
   forPuzzle(lex, o)         -> items fit for a grid: { min, max, n, seed, kinds }, family and pets and the car first, the rest after, in an order
                                that is the same for the same resident, day and version
   stageAllows(stage, what)  -> whether a stage gets "crossword" (early clues, middle fit-the-words) or "wordsearch"; late gets neither
   staffNote(lex)            -> the one line for the Staff Companion Sheet when the profile is thin ("" when it is not)
   problems(lex)             -> a list of faults (clue holding its answer, quizzing words, a pronoun); empty when sound
   normalize(text)           -> the letters a grid takes: A to Z only, accents folded, a leading "the", "a" or "an" dropped */
(function (root) {
  "use strict";
  var VERSION = "1.0.0";

  var str = function (v) { return v == null ? "" : String(v).replace(/\s+/g, " ").trim(); };
  var arr = function (v) { return Array.isArray(v) ? v : []; };
  var obj = function (v) { return v && typeof v === "object" ? v : {}; };
  var QUIZ = /\b(do you remember|can you recall|can you remember|test yourself|quiz|try to remember|do you recall)\b/i;
  var PRONOUN = /\b(he|she|his|her|hers|him)\b/i;

  /* ---------- text ---------- */
  function fold(s) { try { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) { return String(s); } }
  function normalize(text) {
    var t = fold(str(text)).toUpperCase().replace(/^(THE|A|AN)\s+/, "");
    return t.replace(/[^A-Z]/g, "");
  }
  function words(list) {
    var out = [];
    (Array.isArray(list) ? list : String(list == null ? "" : list).split(/[,;\n]+/)).forEach(function (w) { w = str(w); if (w) out.push(w); });
    return out;
  }
  function stageNum(v) {
    if (typeof v === "number") return v >= 1 && v <= 3 ? Math.round(v) : 0;
    var s = str(v).toLowerCase();
    return { early: 1, mild: 1, middle: 2, moderate: 2, mid: 2, late: 3, advanced: 3, acute: 3, "1": 1, "2": 2, "3": 3 }[s] || 0;
  }

  /* ---------- the avoid list, whole words with plurals (the same rule as js/residentContext.js avoidMatcher) ---------- */
  function matcher(avoid) {
    if (typeof avoid === "function") return avoid;
    var res = words(avoid).map(function (w) { return w.toLowerCase(); }).filter(function (w) { return w.length >= 3; }).map(function (w) {
      return new RegExp("(^|[^a-z0-9])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[^a-z0-9]+") + "(s|es|'s|ing|ed|er|ers)?([^a-z0-9]|$)", "i");
    });
    return function (text) { text = String(text == null ? "" : text); for (var i = 0; i < res.length; i++) if (res[i].test(text)) return true; return false; };
  }

  /* ---------- a small generator, so an order is the same for the same resident, day and version ---------- */
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    var a = hash(String(seed)) || 1;
    return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(list, rand) { var a = list.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---------- the one place a relationship is put into words ---------- */
  var ORDER_WORD = { oldest: "oldest", middle: "middle", younger: "younger", youngest: "youngest", twin: "twin" };
  function siblingPhrase(role, order) {
    var kin = role === "brother" ? "brother" : role === "sister" ? "sister" : "";
    if (!kin) return "a brother or sister of yours";
    var o = ORDER_WORD[order] || "";
    return "your " + (o ? o + " " : "") + kin;
  }
  var cap = function (s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); };
  function petPhrase(kind) { return kind ? "a " + kind + " who was part of your home" : "a pet who was part of your home"; }

  /* ---------- one resident, whichever place it came from, in one shape ---------- */
  function fromPerson(p) {
    var f = obj(p.family), home = obj(p.hometown);
    var kin = function (list, relation) { return arr(list).map(function (x) { return { name: str(x.first || x.name), relation: relation || x.relation, role: x.role || "", order: x.order || "", passed: !!x.passed, kind: x.petKind || "" }; }); };
    var m = {
      id: str(p.id), born: Math.round(Number(p.born)) || 0, stage: stageNum(p.stage),
      siblings: kin(f.siblings, "sibling"), spouse: kin(f.partner, "spouse"), children: kin(f.children, "child"), grandchildren: kin(f.grandchildren, "grandchild"),
      parents: kin(f.parents, "parent"), pets: kin(f.pets, "pet"),
      vehicles: arr(p.vehicles).map(function (v) { return { make: str(v.make), model: str(v.model), year: Math.round(Number(v.year)) || 0, color: str(v.color) }; }),
      town: str(home.town), state: str(home.state), work: str(obj(p.work).label), firstJob: "",
      hobbies: arr(p.hobbies).map(str).filter(Boolean), favorites: [], dish: str(obj(p.dish).name),
      moments: arr(p.milestones).map(function (x) { return { year: Math.round(Number(x.year)) || 0, text: str(x.text) }; }).filter(function (x) { return x.text; })
    };
    m.siblings.forEach(function (x) { x.role = x.role || ""; });
    return m;
  }
  /* the packet tool keeps "Name|role|order" for each brother or sister and "Name|kind" for each pet in two plain text fields (sibInfo, petInfo) */
  function parseInfo(text) {
    var out = {};
    String(text == null ? "" : text).split(/[;\n]+/).forEach(function (line) { var p = line.split("|"); var k = str(p[0]).toLowerCase(); if (k) out[k] = { a: str(p[1]).toLowerCase(), b: str(p[2]).toLowerCase() }; });
    return out;
  }
  function fromPacket(r) {
    var sibInfo = parseInfo(r.sibInfo), petInfo = parseInfo(r.petInfo);
    var sibs = words(r.sibs).map(function (n) { var i = sibInfo[n.toLowerCase()] || {}; return { name: n, relation: "sibling", role: i.a === "brother" || i.a === "sister" ? i.a : "", order: i.b || "", passed: false }; });
    var pets = words(r.pets).map(function (n) { var i = petInfo[n.toLowerCase()] || {}; return { name: n, relation: "pet", kind: /^(dog|cat|bird|horse)$/.test(i.a) ? i.a : "", passed: false }; });
    var oneCar = str(r.firstcar), make = str(r.carMake), model = str(r.carModel), year = Math.round(Number(r.carYear)) || 0, color = str(r.carColor);
    var vehicles = [];
    if (make || model || year || color) vehicles.push({ make: make, model: model, year: year, color: color });
    else if (oneCar) vehicles.push({ make: "", model: "", year: 0, color: "", text: oneCar });
    return {
      id: str(r.id || r.first || r.goes), born: Math.round(Number(r.born)) || 0, stage: stageNum(r.stage),
      siblings: sibs, spouse: str(r.spouse) ? [{ name: str(r.spouse), relation: "spouse", passed: false }] : [],
      children: words(r.kids).map(function (n) { return { name: n, relation: "child", passed: false }; }), grandchildren: [],
      parents: str(r.mother) ? [{ name: str(r.mother), relation: "mother", passed: false }] : [], pets: pets,
      vehicles: vehicles, town: str(r.town), state: str(r.state), work: str(r.job), firstJob: str(r.firstjob),
      hobbies: words(r.hobbies), favorites: words(r.favs), dish: "", moments: []
    };
  }
  function toModel(src) {
    src = obj(src);
    return src.family && src.hometown ? fromPerson(src) : fromPacket(src);
  }

  /* ---------- the build ---------- */
  function build(src, opts) {
    opts = opts || {};
    var m = toModel(src), hit = matcher(opts.avoid), items = [], numbers = [], facts = 0, seen = {};
    var add = function (kind, tier, answer, clue, phrase, fact, extra) {
      answer = str(answer); if (!answer || !clue) return;
      var grid = normalize(answer); if (grid.length < 3) return;
      if (hit(answer) || hit(clue) || hit(fact) || hit(phrase)) return;
      if (clue.toUpperCase().replace(/[^A-Z ]/g, "").indexOf(grid) >= 0) return;                           // a clue never holds its own answer
      if (seen[grid]) return; seen[grid] = 1;
      var it = { id: kind + ":" + grid, kind: kind, tier: tier, answer: answer, grid: grid, clue: clue, phrase: phrase || "", fact: fact || "" };
      if (extra) for (var k in extra) it[k] = extra[k];
      items.push(it);
    };
    var living = function (list) { return arr(list).filter(function (x) { return x && x.name && !x.passed; }); };

    arr(m.siblings).forEach(function (x) { if (!x.name) return; facts++; if (x.passed) return;
      var ph = siblingPhrase(x.role, x.order);
      add("sibling", 1, x.name, cap(ph), ph, (x.role || "brother or sister") + " " + x.name + (x.order ? " (" + x.order + ")" : ""));
    });
    living(m.spouse).forEach(function (x) { facts++; add("spouse", 1, x.name, "Your husband or wife", "your husband or wife", "spouse " + x.name); });
    arr(m.spouse).filter(function (x) { return x && x.passed && x.name; }).forEach(function () { facts++; });
    living(m.children).forEach(function (x) { facts++; add("child", 1, x.name, "One of your children", "one of your children", "child " + x.name); });
    living(m.grandchildren).forEach(function (x) { facts++; add("grandchild", 1, x.name, "One of your grandchildren", "one of your grandchildren", "grandchild " + x.name); });
    living(m.parents).forEach(function (x) {
      facts++;
      var ph = x.relation === "mother" ? "your mother" : "a parent of yours";
      add("parent", 1, x.name, cap(ph), ph, (x.relation === "mother" ? "mother " : "parent ") + x.name);
    });
    arr(m.pets).forEach(function (x) { if (!x.name) return; facts++; if (x.passed) return;
      var ph = petPhrase(x.kind);
      add("pet", 1, x.name, cap(ph), ph, (x.kind || "pet") + " " + x.name);
    });
    arr(m.vehicles).forEach(function (v) {
      if (v.make || v.model || v.year || v.color || v.text) facts++;
      var yr = v.year ? ", from " + v.year : "";
      if (v.make) add("car-make", 1, v.make, "The make of your first car" + yr, "your first car", "first car " + v.make + (v.year ? " " + v.year : ""), v.year ? { year: v.year } : null);
      if (v.model) add("car-model", 1, v.model, "The model of your first car" + yr, "your first car", "first car model " + v.model, v.year ? { year: v.year } : null);
      if (v.color) add("car-color", 2, v.color, "The color of your first car", "your first car", "first car color " + v.color);
      if (v.text) {
        /* a free-text car ("Ford pickup"): each word is offered with the same plain clue, so nothing is split into a make or model that was not said */
        v.text.split(/[\s\/,-]+/).filter(function (w) { return normalize(w).length >= 3; }).forEach(function (w) { add("car-make", 1, w, "A word from the name of your first car", "your first car", "first car " + v.text); });
      }
      if (v.year) numbers.push({ kind: "car-year", value: v.year, text: String(v.year), clue: "The year of your first car" });
    });
    if (m.town) { facts++; add("town", 2, m.town, "The town you grew up in", "the town you grew up in", "hometown " + m.town); }
    if (m.state) { facts++; add("state", 2, m.state, "The state or country you grew up in", "where you grew up", "state " + m.state); }
    if (m.work) { facts++; add("work", 2, m.work, "The work you did", "the work you did", "work " + m.work); }
    if (m.firstJob) { facts++; add("first-job", 2, m.firstJob, "Your first job", "your first job", "first job " + m.firstJob); }
    arr(m.hobbies).forEach(function (h) { facts++; add("hobby", 3, h, "Something you enjoyed doing", "something you enjoyed", "hobby " + h); });
    arr(m.favorites).forEach(function (h) { facts++; add("favorite", 3, h, "One of your favorite things", "one of your favorite things", "favorite " + h); });
    if (m.dish) { facts++; add("dish", 3, m.dish, "A dish you were known for", "a dish you were known for", "dish " + m.dish); }

    /* numbers: only what the profile holds, each with the plain fact it comes from */
    if (m.born) numbers.unshift({ kind: "born", value: m.born, text: String(m.born), clue: "The year you were born" });
    arr(m.moments).forEach(function (x) { if (x.year) numbers.push({ kind: "moment", value: x.year, text: String(x.year), clue: cap(x.text) }); });
    numbers = numbers.filter(function (n) { return !hit(n.clue) && !hit(n.text); });
    var kept = {}; numbers = numbers.filter(function (n) { var k = n.kind + n.value; if (kept[k]) return false; kept[k] = 1; return true; });

    var born = m.born ? 1 : 0;
    var count = facts + born;
    return { version: VERSION, source: src && src.family && src.hometown ? "profile" : "form", born: m.born, stage: m.stage, count: count, thin: count < 3, items: items, numbers: numbers,
      seed: str(opts.seed || m.id) + "|" + str(opts.date) + "|" + VERSION };
  }

  /* ---------- choosing for a grid ---------- */
  function forPuzzle(lex, o) {
    o = o || {};
    var min = o.min || 3, max = o.max || 12, kinds = o.kinds || null, rand = rng((o.seed || lex.seed) + "|puzzle");
    var fit = arr(lex && lex.items).filter(function (it) { return it.grid.length >= min && it.grid.length <= max && (!kinds || kinds.indexOf(it.kind) >= 0); });
    var out = [];
    [1, 2, 3].forEach(function (tier) { out = out.concat(shuffle(fit.filter(function (it) { return it.tier === tier; }), rand)); });
    return o.n ? out.slice(0, o.n) : out;
  }

  function stageAllows(stage, what) {
    var s = stageNum(stage);
    if (s === 3) return false;
    if (what === "crossword") return s === 1 || s === 2 || s === 0;
    if (what === "wordsearch") return true;
    return true;
  }
  /* early gets a clue-based crossword; middle gets fit-the-words with first letters and no clues */
  function crosswordStyle(stage) { var s = stageNum(stage); return s === 3 ? "" : s === 2 ? "fit" : "clues"; }

  function staffNote(lex) {
    return lex && lex.thin ? "This profile holds few personal details, so these puzzles use everyday and era words. Adding family names, pets, a first car, the town they grew up in and what they enjoyed will make future puzzles theirs." : "";
  }

  /* ---------- a check any tool or test can run ---------- */
  function problems(lex) {
    var out = [];
    arr(lex && lex.items).forEach(function (it) {
      if (!it.grid || it.grid !== normalize(it.answer)) out.push(it.id + ": grid letters do not match the answer");
      if (it.clue.toUpperCase().replace(/[^A-Z ]/g, "").indexOf(it.grid) >= 0) out.push(it.id + ": the clue holds its own answer");
      if (QUIZ.test(it.clue)) out.push(it.id + ": the clue quizzes");
      if (PRONOUN.test(it.clue) || PRONOUN.test(it.phrase)) out.push(it.id + ": the clue uses a pronoun");
      if (/[?]/.test(it.clue)) out.push(it.id + ": the clue is a question");
    });
    arr(lex && lex.numbers).forEach(function (n) { if (!(n.value > 0) || n.text !== String(n.value)) out.push(n.kind + ": number does not match its text"); });
    return out;
  }

  var api = { VERSION: VERSION, build: build, forPuzzle: forPuzzle, stageAllows: stageAllows, crosswordStyle: crosswordStyle, staffNote: staffNote, problems: problems,
    normalize: normalize, matcher: matcher, siblingPhrase: siblingPhrase, petPhrase: petPhrase, stageNum: stageNum };
  root.CogniLexicon = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
