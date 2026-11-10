/* =====================================================================
   One reader for a saved resident (window.CogniResident).

   A resident is kept in this browser's sealed store as a profile in three tiers ("cognicopia.residentProfile",
   written by profile.html). Every tool used to turn that profile into what it needed with its own copy of the
   code, so a new field had to be wired five times and the copies drifted (the Activity Page Studio took a ticked
   topic to avoid as its label and never matched it). This file is the one place that reads a profile:

     person(profile)   a flat, plain description of the person: name, the years of their youth, stage, former
                       work, where they come from, family by generation, music, pastimes, and the words to keep
                       off a page. Nothing is guessed: a field the profile does not hold comes back empty.
     avoidWords(...)   the real words behind the topics to avoid (the same lists as src/engine/ClinicalMatrix.js;
                       scripts/check-resident-context.mjs proves the two are identical)
     avoidMatcher(...) whole words, plurals included: avoiding "war" leaves "warm" alone
     list / read / activeId   the saved residents in the storage object it is handed (it opens none itself)

   It reads; it never writes a profile and never sends anything anywhere. Plain script, no build step.
   ===================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CogniResident = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";
  var VERSION = "1.0.0";
  var PREFIX = "cognicopia_resident_", SCHEMA = "cognicopia.residentProfile", ACTIVE_KEY = "cognicopia_active_resident";

  /* ---------- the topics to avoid, as words (kept identical to ClinicalMatrix.AVOID_TOPIC_WORDS and AVOID_ERAS) ---------- */
  var AVOID_TOPIC_WORDS = {
    war: ["war", "battle", "combat", "soldier", "army", "navy", "marines", "veteran", "military", "draft", "bomb"],
    death: ["death", "died", "funeral", "grave", "burial", "widow", "passed away"],
    medical: ["hospital", "illness", "surgery", "doctor", "nurse", "cancer", "pills", "medicine"],
    religion: ["church", "prayer", "hymn", "faith", "bible", "priest"],
    money: ["money", "bills", "bank", "debt"], politics: ["politics", "election", "vote", "president"],
    driving: ["driving", "car keys", "license"], home: ["going home", "old house"], "family-conflict": ["divorce", "fight", "argue"],
    children: ["baby", "babies", "child", "children"], water: ["boat", "ocean", "drowning", "sea", "lake"],
    storms: ["storm", "tornado", "fire", "flood", "thunder"]
  };
  var AVOID_ERAS = [
    { code: "era-wwii", label: "World War II (1939–1945)", words: ["world war", "ww2", "wwii", "pearl harbor", "d-day", "nazi", "pacific theater", "iwo jima", "blitz", "rationing"] },
    { code: "era-korea", label: "Korean War (1950–1953)", words: ["korea", "korean war", "38th parallel", "inchon", "pusan"] },
    { code: "era-vietnam", label: "Vietnam War (1955–1975)", words: ["vietnam", "saigon", "agent orange", "viet cong", "draft lottery"] },
    { code: "era-gulf", label: "Gulf, Iraq and Afghanistan wars", words: ["desert storm", "gulf war", "iraq", "afghanistan", "kuwait", "baghdad"] },
    { code: "era-coldwar", label: "Cold War and the Cuban missile crisis", words: ["cold war", "iron curtain", "cuban missile", "fallout shelter", "air raid drill"] }
  ];

  /* A short name for each, with no comma in it, for a field that lists them separated by commas (several of the form's own labels
     hold commas: "Illness, hospitals and medical"). */
  var AVOID_NAMES = {
    war: "war", death: "death and loss", medical: "illness and hospitals", religion: "religion", money: "money", politics: "politics",
    driving: "driving", home: "going home", "family-conflict": "family conflict", children: "babies and children", water: "water and boats", storms: "storms and fire",
    "era-wwii": "World War II", "era-korea": "Korean War", "era-vietnam": "Vietnam War", "era-gulf": "Gulf and Iraq wars", "era-coldwar": "Cold War"
  };

  /* ---------- small helpers ---------- */
  var str = function (v) { return v == null ? "" : String(v).replace(/\s+/g, " ").trim(); };
  var obj = function (v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; };
  var arr = function (v) { return Array.isArray(v) ? v : []; };
  var labelOf = function (x) { return x && typeof x === "object" ? str(x.label || x.code) : str(x); };
  var codeOf = function (x) { return x && typeof x === "object" ? str(x.code || x.label) : str(x); };
  var words = function (v) { return String(v == null ? "" : v).split(/[,;\n]+/).map(str).filter(Boolean); };
  var firstWord = function (n) { return str(n).split(" ")[0] || ""; };
  function uniq(list) { var seen = {}; return list.filter(function (w) { var k = String(w).toLowerCase(); if (!k || seen[k]) return false; seen[k] = 1; return true; }); }
  function codes(v) { return arr(v).map(codeOf).filter(Boolean); }

  /* avoidWords({ topics, eras, people, places, other }) -> lower-case terms, 3 letters or more, no duplicates.
     A ticked topic or era becomes its word list; a typed name, place or phrase is a term as typed. A plain list
     or a comma-separated line is accepted as typed terms. */
  function avoidWords(av) {
    var out = [], seen = {};
    var add = function (w) { w = str(w).toLowerCase(); if (w.length >= 3 && !seen[w]) { seen[w] = 1; out.push(w); } };
    if (Array.isArray(av) || typeof av === "string") { (Array.isArray(av) ? av.map(codeOf) : words(av)).forEach(add); return out; }
    av = obj(av);
    codes(av.topics).forEach(function (c) { (AVOID_TOPIC_WORDS[c.toLowerCase()] || []).forEach(add); });
    arr(av.eras).forEach(function (c) {
      var code = codeOf(c), label = labelOf(c);
      AVOID_ERAS.forEach(function (e) { if (e.code === code || e.label === code || e.label === label) e.words.forEach(add); });
    });
    ["people", "places", "other", "words"].forEach(function (k) { (Array.isArray(av[k]) ? av[k].map(codeOf) : words(av[k])).forEach(add); });
    return out;
  }
  /* the short name of a ticked topic or era ({code, label}); one this file does not know keeps its own label, commas removed */
  function avoidName(x) { var c = codeOf(x); return AVOID_NAMES[c] || labelOf(x).replace(/\s*,\s*/g, " ").trim(); }
  /* avoidFromText("war, Korean War, the farm fire") -> the words to keep off a page. An entry that is a topic's or an era's
     short name (or its code) becomes that topic's word list; anything else is a term as typed. sortAvoidText() says which was which. */
  function sortAvoidText(text) {
    var byName = {}, topics = [], eras = [], typed = [];
    Object.keys(AVOID_NAMES).forEach(function (c) { byName[AVOID_NAMES[c].toLowerCase()] = c; byName[c] = c; });
    words(text).forEach(function (w) {
      var c = byName[w.toLowerCase()];
      if (!c) typed.push(w); else if (c.indexOf("era-") === 0) { if (eras.indexOf(c) < 0) eras.push(c); } else if (topics.indexOf(c) < 0) topics.push(c);
    });
    return { topics: topics, eras: eras, typed: typed };
  }
  function avoidFromText(text) { var t = sortAvoidText(text); return avoidWords({ topics: t.topics, eras: t.eras, other: t.typed }); }
  /* avoidMatcher(terms) -> text => the terms found in it, as whole words. A plural, a possessive and the -ing, -ed and -er forms
     count ("garden" also finds "gardening"); "war" does not find "warm". The Activity Page Studio's engine uses the same rule. */
  function avoidMatcher(terms) {
    var res = (Array.isArray(terms) ? terms : words(terms)).map(function (w) { return str(w).toLowerCase(); }).filter(function (w) { return w.length >= 3; })
      .map(function (w) { return { term: w, re: new RegExp("(^|[^a-z0-9])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[^a-z0-9]+") + "(s|es|'s|ing|ed|er|ers)?([^a-z0-9]|$)", "i") }; });
    return function (text) {
      text = String(text == null ? "" : text);
      var hits = [];
      for (var i = 0; i < res.length; i++) if (res[i].re.test(text)) hits.push(res[i].term);
      return hits;
    };
  }

  /* ---------- family, by generation ---------- */
  var GENERATION = {
    spouse: "partner", partner: "partner", son: "children", daughter: "children", grandchild: "grandchildren", "great-grandchild": "greatGrandchildren",
    sibling: "siblings", parent: "parents", "other-family": "otherFamily", friend: "friends", neighbor: "friends",
    "pet-dog": "pets", "pet-cat": "pets", "pet-other": "pets"
  };
  function family(people) {
    var f = { partner: [], children: [], grandchildren: [], greatGrandchildren: [], siblings: [], parents: [], otherFamily: [], friends: [], pets: [], others: [], all: [] };
    arr(people).forEach(function (x) {
      x = obj(x); var name = str(x.name); if (!name) return;
      var rel = obj(x.relationship), code = str(rel.code), isPet = !!x.isPet || code.indexOf("pet-") === 0;
      var one = { name: name, first: firstWord(name), relation: code, relationLabel: str(rel.label), isPet: isPet, passed: !!x.passedAway };
      if (x.photo) one.photo = String(x.photo);                               // the name of a sealed picture, when the profile holds one
      (f[isPet ? "pets" : (GENERATION[code] || "others")]).push(one); f.all.push(one);
    });
    return f;
  }
  /* the people (or pets) of a list who are living: a page a visitor would hold names them only */
  function present(list) { return arr(list).filter(function (x) { return x && !x.passed; }); }

  /* ---------- the person ---------- */
  var STAGE_NAME = { 1: "early", 2: "middle", 3: "late" }, STAGE_GDS = { 1: "GDS 3–4", 2: "GDS 5", 3: "GDS 6–7" };
  function person(profile) {
    var p = obj(profile), t1 = obj(p.tier1_core), t2 = obj(p.tier2_enrichment), t3 = obj(p.tier3_deep);
    var born = Math.round(Number(t2.birthYear)) || 0; if (born < 1880 || born > 2020) born = 0;
    var tier = Math.round(Number(t1.cognitiveTier)) || Math.round(Number(obj(t1.difficulty).level)) || 0;
    var stage = tier >= 1 && tier <= 3 ? tier : 0;
    var occ = obj(t1.occupation), voc = obj(t1.primaryVocation), home = obj(t2.hometown), music = obj(t2.music), av = obj(t1.topicsToAvoid);
    var place = str(home.place), parts = place.split(",").map(str).filter(Boolean);
    var fam = family(t3.people), notes = String(t3.notes == null ? "" : t3.notes);
    var noteLine = function (label) { var m = new RegExp("(?:^|\\n)" + label + ": ([^\\n]*)").exec(notes); return m ? words(m[1]) : null; };
    var hobbies = arr(t1.topHobbies).map(labelOf).filter(Boolean);
    var own = uniq(fam.all.map(function (x) { return x.first; }).concat(parts[0] ? [firstWord(parts[0])] : []));
    return {
      id: str(p.id), name: str(t1.preferredName), nickname: str(t1.nickname), room: str(t1.unitNumber), wing: str(t1.wing),
      born: born, youth: born ? { from: born + 15, to: born + 25 } : null, turnedTwenty: born ? born + 20 : 0, decadeAtTwenty: born ? Math.floor((born + 20) / 10) * 10 : 0,
      stage: stage, stageName: STAGE_NAME[stage] || "", gds: STAGE_GDS[stage] || "",
      work: { code: str(occ.code), label: labelOf(occ), vocation: str(voc.code), vocationLabel: labelOf(voc), text: (str(occ.code) + " " + labelOf(occ) + " " + str(voc.code) + " " + labelOf(voc) + " " + str(p.pastVocation)).toLowerCase().trim() },
      hometown: { place: place, town: parts[0] || "", state: parts[1] || "", environment: labelOf(home.environment), region: labelOf(t2.region), regionCode: codeOf(t2.region) },
      family: fam,
      music: { genres: arr(music.genres).map(labelOf).filter(Boolean), artists: arr(music.artists).map(labelOf).filter(Boolean), favoriteSong: str(music.favoriteSong) },
      hobbies: hobbies, activities: arr(t2.activityPreferences).map(labelOf).filter(Boolean), skills: arr(obj(t2.skills).items).map(labelOf).filter(Boolean),
      decades: arr(t2.meaningfulDecades).map(labelOf).filter(Boolean),
      avoid: { topics: arr(av.topics).map(labelOf).filter(Boolean), eras: arr(av.eras).map(labelOf).filter(Boolean), people: words(av.people), places: words(av.places), other: words(av.other), words: avoidWords(av),
        names: arr(av.topics).map(avoidName).concat(arr(av.eras).map(avoidName)).filter(Boolean) },
      interests: noteLine("Interests") || hobbies,                             // the Studio keeps typed interests and words on two labelled lines of the notes
      personalWords: noteLine("Words from their life") || own,
      /* the optional parts of a life story (profile.html, "More of their story"); empty until someone fills them in */
      milestones: arr(t3.milestones).map(function (m) { m = obj(m); return { year: Math.round(Number(m.year)) || 0, text: str(m.text) }; }).filter(function (m) { return m.text; }),
      dish: { name: str(obj(t3.signatureDish).name), ingredients: words(obj(t3.signatureDish).ingredients), steps: arr(obj(t3.signatureDish).steps).map(str).filter(Boolean) },
      comforts: arr(t3.comforts).map(labelOf).filter(Boolean),
      notes: notes
    };
  }

  /* ---------- the saved residents in a storage object ---------- */
  function read(storage, id) {
    try { var p = JSON.parse(storage.getItem(PREFIX + id)); return p && p.schema === SCHEMA && p.tier1_core ? p : null; } catch (e) { return null; }
  }
  function list(storage) {
    var out = [];
    try {
      for (var i = 0; i < storage.length; i++) {
        var k = storage.key(i);
        if (k && k.indexOf(PREFIX) === 0) { var p = read(storage, k.slice(PREFIX.length)); if (p && str(p.tier1_core.preferredName)) out.push(p); }
      }
    } catch (e) { /* a blocked or locked store lists nobody */ }
    return out.sort(function (a, b) { return str(a.tier1_core.preferredName).localeCompare(str(b.tier1_core.preferredName)); });
  }
  function activeId(storage) { try { return str(storage.getItem(ACTIVE_KEY)); } catch (e) { return ""; } }

  return Object.freeze({
    VERSION: VERSION, PREFIX: PREFIX, SCHEMA: SCHEMA, ACTIVE_KEY: ACTIVE_KEY,
    AVOID_TOPIC_WORDS: AVOID_TOPIC_WORDS, AVOID_ERAS: AVOID_ERAS, AVOID_NAMES: AVOID_NAMES, avoidWords: avoidWords, avoidMatcher: avoidMatcher,
    avoidName: avoidName, sortAvoidText: sortAvoidText, avoidFromText: avoidFromText,
    person: person, family: family, present: present, read: read, list: list, activeId: activeId, words: words, labelOf: labelOf
  });
});
