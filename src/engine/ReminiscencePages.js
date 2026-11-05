/* =====================================================================
   Three packet pages built from the reminiscence engine (assets/services/reminiscenceEngine.js, CogniReminiscence):

     Sensory memory cards   for staff: one conversation topic from the resident's own life and years per card, with things from
                            those years to look at and talk about, the engine's own thing to hold (with its safety note), a scent
                            to offer (smelled from a jar or a cloth, never eaten) and a song from the years they remember best
     Your years             for the resident: a timeline from the year they were born through about age 30 (the years people
                            remember most readily), with the songs that were new then and things that came along, and where they
                            grew up when the form says
     Memory map             for the resident and staff together: their name in the middle and the parts of a life around it
                            (home, work, family, what they enjoy...), already holding what the form knows, with room to add more

   The words are invitations, never questions to get right: the engine's own tone check (toneProblems) is run on everything here,
   and the packet's avoid list is honored through allowed(text). Works in the browser (window.CognicopiaReminiscencePages) and in
   Node (module.exports). No network, no storage.
   ===================================================================== */
(function(root, factory){
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CognicopiaReminiscencePages = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(root){
  "use strict";
  var VERSION = "1.0.0";
  var R = function(){ return root.CogniReminiscence; };
  var TIER = { early:1, middle:2, late:3 };
  /* a scent for each conversation topic: everyday, safe to keep in a small jar or on a cloth, nothing sharp or chemical */
  var SCENTS = {
    "under-the-hood":"a worn leather work glove", "the-classroom":"a freshly sharpened pencil", "letters-home":"a sheet of writing paper in an envelope",
    "the-busy-kitchen":"a pinch of cinnamon in a small jar", "on-the-ward":"a fresh, clean cotton sheet", "the-farm-year":"a handful of clean hay in a jar",
    "keeping-house":"a cloth with a little lemon on it", "the-office":"a new pad of paper", "building-things":"a block of fresh-cut pine",
    "the-shift":"fresh coffee grounds in a small jar", "all-aboard":"fresh coffee grounds in a small jar", "on-the-road":"fresh coffee grounds in a small jar",
    "the-mail-route":"a stack of new envelopes", "the-store":"a bar of plain soap", "the-sewing-room":"a length of new cotton fabric",
    "on-duty":"a freshly pressed cotton shirt", "how-things-work":"a block of fresh-cut pine", "the-congregation":"an unlit beeswax candle",
    "a-days-work":"fresh coffee grounds in a small jar", "the-county-fair":"cinnamon sugar in a small jar", "main-street":"fresh coffee grounds in a small jar",
    "downtown":"fresh coffee grounds in a small jar", "the-porch":"a sprig of fresh mint", "by-the-water":"a small bowl of salt water",
    "the-mountains":"a few pine needles", "maple-season":"a little maple syrup in a small jar", "big-sky":"a sprig of sage", "the-southwest":"a sprig of sage",
    "home-in-canada":"a few pine needles", "where-you-grew-up":"a sprig of fresh mint", "on-the-radio":"fresh coffee grounds in a small jar",
    "the-television":"cocoa powder in a small jar", "at-the-movies":"fresh popcorn in a paper bag", "the-sunday-drive":"a worn leather glove",
    "the-kitchen-table":"a pinch of cinnamon in a small jar", "playtime":"a little fresh-cut grass in a jar", "dance-night":"a cloth with a dab of lavender water",
    "the-ballgame":"a leather baseball glove", "in-the-garden":"a little potting soil and a sprig of mint", "faithful-friends":"a few cedar shavings"
  };
  var SCENT_SAFE = "To smell only, never to eat; check allergies and breathing first.";
  var GENERIC_SCENT = "a sprig of fresh mint";

  function clean(v, n){ return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f<>{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, n || 80); }
  function list(v){ return (Array.isArray(v) ? v : String(v || "").split(/[,;]+/)).map(function(x){ return clean(x, 60); }).filter(Boolean); }
  function code(v){ return clean(v, 60).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  /* the packet form's details, as a profile the reminiscence engine reads */
  function profileFrom(r){
    r = r || {};
    var name = clean(r.goes || r.first, 40), born = parseInt(r.born, 10);
    return {
      id:"packet-" + code(name) + "-" + (born || ""),
      tier1_core:{ preferredName:name, cognitiveTier:TIER[r.stage] || 2, occupation:{ code:code(r.job) }, topHobbies:list(r.hobbies).map(function(h){ return { code:code(h) }; }),
        topicsToAvoid:{ topics:list(r.avoid).map(code) } },
      tier2_enrichment:{ birthYear:born, hometown:{ place:[clean(r.town, 60), clean(r.state, 30)].filter(Boolean).join(", ") } }
    };
  }
  var okTone = function(t){ var e = R(); return !e || !e.toneProblems || !e.toneProblems(String(t || "")).length; };
  var keep = function(allowed){ return function(t){ return okTone(t) && (typeof allowed !== "function" || allowed(t)); }; };
  function deck(r, count, opts){
    var e = R(); if (!e) throw new Error("The reminiscence engine is not loaded on this page.");
    return e.deck(profileFrom(r), { count:count, today:opts && opts.today, seed:(opts && opts.seed) || r.month || "1" });
  }
  /* ---------- sensory memory cards (for staff) ---------- */
  function sensory(r, opts){
    opts = opts || {};
    var ok = keep(opts.allowed), d = deck(r, Math.max(3, Math.min(6, opts.count || 4)) + 2, opts), out = [];
    d.cards.forEach(function(c){
      if (out.length >= (opts.count || 4)) return;
      var words = [c.title, c.invite].concat(c.starters, c.refs, [c.touch.prompt, c.song && c.song.title]).join(" ");
      if (!ok(words)) return;                                          // anything on the avoid list, or anything that quizzes, leaves the card out
      out.push({ topic:c.topic, title:c.title, invite:c.invite, starters:c.starters.slice(0, 2), look:c.refs.slice(0, 3),
        hold:{ prompt:c.touch.prompt, safety:c.touch.safety }, smell:{ what:SCENTS[c.topic] || GENERIC_SCENT, safety:SCENT_SAFE },
        song:c.song ? { title:c.song.title, artist:c.song.artist, year:c.song.year } : null });
    });
    return { name:d.person.name, cards:out };
  }
  /* ---------- your years (for the resident) ---------- */
  function timeline(r, opts){
    opts = opts || {};
    var ok = keep(opts.allowed), d = deck(r, 8, opts), who = d.person, by = who.birthYear, late = r.stage === "late";
    var rows = [{ year:by, head:"Born", sub:"", kind:"mile" }, { year:by + 10, head:"Ten years old", sub:"The years remembered best begin", kind:"mile" }];
    var seen = {};
    d.cards.forEach(function(c){
      var s = c.song;
      if (s && !seen[s.year] && s.year >= by + 5 && s.year <= by + 30 && ok(s.title + " " + s.artist)){ seen[s.year] = 1; rows.push({ year:s.year, head:s.title, sub:s.artist, kind:"song" }); }
      (c.refs || []).forEach(function(ref){
        var m = /\((19\d\d)\)|\bnew in (19\d\d)|\bof (19\d\d)\b/.exec(ref), y = m ? +(m[1] || m[2] || m[3]) : 0;
        if (y && !seen[y] && y >= by + 5 && y <= by + 30 && ok(ref)){ seen[y] = 1; rows.push({ year:y, head:ref.replace(/\s*\((19\d\d)\)|,?\s*new in 19\d\d|\s+of 19\d\d/g, "").replace(/^the\s/, "The "), sub:"New then", kind:"thing" }); }
      });
    });
    var middle = rows.slice(2).sort(function(a, b){ return a.year - b.year; }).slice(0, late ? 3 : 7);
    rows = rows.slice(0, late ? 1 : 2).concat(middle, late ? [] : [{ year:by + 30, head:"Thirty years old", sub:"Those years, in their own words", kind:"mile" }]);
    return { name:who.name, born:by, bump:who.bump, place:who.placeLabel || "", rows:rows };
  }
  /* ---------- memory map (for the resident and staff together) ---------- */
  function memoryMap(r, opts){
    opts = opts || {};
    var ok = keep(opts.allowed), late = r.stage === "late";
    var fit = function(arr){ return arr.map(function(x){ return clean(x, 40); }).filter(function(x){ return x && ok(x); }).slice(0, late ? 1 : 2); };
    var home = [clean(r.town, 40) + (r.state ? ", " + clean(r.state, 20) : "")].filter(function(x){ return x && x !== ", "; });
    var spokes = [
      { label:"Home", known:fit(home), invite:"The places called home" },
      { label:"Work", known:fit([r.job, r.firstjob]), invite:"A day's work" },
      { label:"Family", known:fit([r.spouse].concat(list(r.kids), list(r.sibs))), invite:"The people close by" },
      { label:"Friends and pets", known:fit(list(r.pets)), invite:"Good company" },
      { label:"Things I enjoy", known:fit(list(r.hobbies)), invite:"Hands busy, heart full" },
      { label:"Favorites", known:fit(list(r.favs)), invite:"The best of everything" }
    ];
    if (late) spokes = [spokes[0], spokes[2], spokes[4], spokes[5]];
    return { name:clean(r.goes || r.first, 40), spokes:spokes, invite:"Talk about any part, in any order. Add a word, a name or a little drawing. Every answer is welcome." };
  }
  return { VERSION:VERSION, SCENTS:SCENTS, SCENT_SAFE:SCENT_SAFE, profileFrom:profileFrom, sensory:sensory, timeline:timeline, memoryMap:memoryMap };
});
