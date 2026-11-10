/* =====================================================================
   Activity engine: the clinical side of the Activity Page Studio.

   It decides WHAT goes on a sheet. It never draws anything: it returns
   plain "sheet" objects (a title, items, a note for staff) and
   js/generators/coloring-pipeline.js lays them out on a 3:4 page.

   Three modules, each shaped by the resident's stage:
     reminiscence  era prompts (vehicles, home, music, faces, food) for the
                   decade chosen; invitations, never quiz questions;
     exercise      word pairs, sorting into two groups, a winding path to
                   follow, and (late stage) look-and-name;
     daily         a familiar task in clear steps, one picture to start.

   Stages (the studio says Stage 1, 2, 3; the coloring engine says early,
   middle, late; this file holds both names):
     1  mild      fuller prompts, five pairs, a longer path, six steps;
     2  moderate  one idea at a time, three pairs, a gentler path, four steps;
     3  advanced  sensory and calm: a word, a picture, a feeling; three
                  steps; nothing to get wrong.

   Dexterity (steady, limited, minimal) makes type larger, puts fewer
   items on a sheet and makes lines heavier; it never changes the stage.

   Rules every sheet is held to (toneProblems / validate):
     - an invitation, never a test: no "do you remember", no "what year",
       no quiz words, no pet names or praise that talks down;
     - nothing from the resident's topics to avoid;
     - the same profile and seed always give the same sheets, and a new
       seed gives different ones (the page code carries the seed).

   Works in the browser (window.CognicopiaActivityEngine) and in Node.
   No network and no storage: a name typed here is used for one sheet
   and kept nowhere.
   ===================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CognicopiaActivityEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";
  var VERSION = "1.0.0";

  /* ---------- stages and dexterity ---------- */
  var STAGES = {
    1: { n: 1, key: "E", coloring: "early",  label: "Stage 1, mild",     items: 4, pairs: 5, steps: 6, turns: 4, floorPt: 20 },
    2: { n: 2, key: "M", coloring: "middle", label: "Stage 2, moderate", items: 3, pairs: 3, steps: 4, turns: 2, floorPt: 24 },
    3: { n: 3, key: "L", coloring: "late",   label: "Stage 3, advanced", items: 2, pairs: 0, steps: 3, turns: 1, floorPt: 32 }
  };
  var DEXTERITY = {
    steady:  { id: "steady",  label: "Steady hands",  font: 1,    fewer: 0, extraLinePt: 0,   note: "" },
    limited: { id: "limited", label: "Limited grip",  font: 1.15, fewer: 1, extraLinePt: 1.5, note: "Bigger type, one fewer item, heavier lines. Offer a chunky crayon or a built-up marker." },
    minimal: { id: "minimal", label: "Little control", font: 1.3, fewer: 2, extraLinePt: 3,   note: "Largest type and the heaviest lines, with the fewest items. Hand-over-hand help is welcome." }
  };
  var DECADES = [1940, 1950, 1960, 1970, 1980];
  var SEASONS = ["spring", "summer", "fall", "winter"];
  var MODULES = [
    { id: "reminiscence", label: "Reminiscence prompts" },
    { id: "exercise",     label: "Thinking exercises" },
    { id: "daily",        label: "Daily living steps" },
    { id: "coloring",     label: "Coloring page" }
  ];

  /* ---------- the era bank: things to look at and talk about, by decade ---------- */
  var ERA = {
    1940: {
      vehicles: ["a Chevrolet Fleetline coupe", "a Ford pickup truck", "a Studebaker Champion", "a city streetcar"],
      home:     ["a wringer washing machine", "a Philco console radio", "a coal-and-wood kitchen stove", "a party-line telephone"],
      music:    ["big band music on the radio", "the jitterbug at a dance hall", "Glenn Miller's orchestra", "a Saturday-night radio show"],
      icons:    ["Bing Crosby", "Judy Garland", "Betty Grable", "Fred Astaire"],
      food:     ["pot roast on Sunday", "homemade apple pie", "a jar of home-canned peaches", "cornbread and beans"]
    },
    1950: {
      vehicles: ["a '57 Chevy Bel Air", "a Ford Fairlane", "a pink Cadillac", "a Greyhound bus"],
      home:     ["a television with rabbit ears", "a Singer sewing machine", "a percolator coffee pot", "a drive-in movie night"],
      music:    ["the diner jukebox", "rock and roll on the radio", "a sock hop", "Patsy Cline on the record player"],
      icons:    ["Elvis Presley", "Lucille Ball", "Ed Sullivan", "Marilyn Monroe"],
      food:     ["a malted milkshake", "a lime gelatin salad", "a church-supper casserole", "a TV dinner on a tray"]
    },
    1960: {
      vehicles: ["a Ford Mustang", "a Volkswagen Beetle", "a family station wagon", "a Chevy Impala"],
      home:     ["a transistor radio", "a hi-fi record player", "a rotary telephone", "a color television set"],
      music:    ["Motown on the radio", "the Beach Boys", "a folk song with a guitar", "dancing the twist"],
      icons:    ["The Beatles", "Johnny Carson", "Aretha Franklin", "Andy Griffith"],
      food:     ["a backyard barbecue", "meatloaf with mashed potatoes", "orange drink at breakfast", "a fondue pot at a party"]
    },
    1970: {
      vehicles: ["a Chevy Nova", "a Pontiac Firebird", "a Volkswagen camper van", "a Ford Bronco"],
      home:     ["a shag carpet", "a Crock-Pot on the counter", "a lava lamp", "avocado-green kitchen appliances"],
      music:    ["an eight-track tape", "country music on the radio", "Fleetwood Mac", "dancing to disco"],
      icons:    ["Carol Burnett", "Stevie Wonder", "John Wayne", "Dolly Parton"],
      food:     ["banana bread from the oven", "chili from the slow cooker", "a gelatin mold at the potluck", "popcorn on movie night"]
    },
    1980: {
      vehicles: ["a Chevy Camaro", "a family minivan", "a Honda Accord", "a Jeep Cherokee"],
      home:     ["a VCR and a stack of tapes", "a microwave oven", "a Walkman with headphones", "a phone answering machine"],
      music:    ["a cassette mix tape", "Whitney Houston", "music videos on television", "Dolly Parton on the radio"],
      icons:    ["Fred Rogers", "Michael Jackson", "Burt Reynolds", "Julia Child"],
      food:     ["microwave popcorn", "pizza night at home", "a casserole with crushed crackers", "frozen yogurt in summer"]
    }
  };
  var KIND_LABEL = { vehicles: "On the road", home: "Around the house", music: "Music", icons: "Familiar faces", food: "At the table" };
  var KIND_ORDER = ["vehicles", "home", "music", "icons", "food"];

  /* how each kind is offered at each stage: invitations only */
  var INVITE = {
    1: {
      vehicles: ["Tell me about {t}.", "Where might {t} have taken you?"],
      home:     ["What was {t} like in your home?", "Tell me about {t}."],
      music:    ["What do you like about {t}?", "Tell me about {t}."],
      icons:    ["What did you enjoy about {t}?", "Tell me about {t}."],
      food:     ["Who made {t} in your family?", "Tell me about {t}."]
    },
    2: {
      vehicles: ["Let's look at {t} together.", "Let's talk about {t}."],
      home:     ["Let's talk about {t}.", "Let's look at {t} together."],
      music:    ["Let's listen for {t}.", "Let's talk about {t}."],
      icons:    ["Let's talk about {t}.", "Let's think about {t}."],
      food:     ["Let's talk about {t}.", "Let's think about {t}."]
    },
    3: {
      vehicles: ["{t}."],
      home:     ["{t}."],
      music:    ["{t}."],
      icons:    ["{t}."],
      food:     ["{t}."]
    }
  };
  /* the late-stage sensory line under the item */
  var SENSE = {
    vehicles: "Look at the shiny wheels.",
    home:     "Something familiar from home.",
    music:    "Listen. Tap along if you like.",
    icons:    "A familiar face. Smile if you like.",
    food:     "Warm and sweet. Breathe in."
  };
  /* what staff do with it */
  var STAFF = {
    vehicles: "Show a photo or a toy model. Let the resident lead where the story goes.",
    home:     "Bring the real thing if you can, or a photo. Follow the resident's words.",
    music:    "Play a few bars of the song. Humming along counts.",
    icons:    "Show a photo. Stay with whatever the resident says; there is no right answer.",
    food:     "A safe, familiar smell (cinnamon, vanilla) helps. Check allergies and diet orders first."
  };

  /* ---------- exercises ---------- */
  var PAIRS = [
    ["salt", "pepper"], ["bread", "butter"], ["needle", "thread"], ["cup", "saucer"], ["hammer", "nail"],
    ["bacon", "eggs"], ["thunder", "lightning"], ["pencil", "paper"], ["lock", "key"], ["shoes", "socks"],
    ["knife", "fork"], ["milk", "cookies"], ["bat", "ball"], ["rise", "shine"]
  ];
  var SORTS = [
    { a: { name: "In the kitchen", items: ["teapot", "spoon", "kettle", "bread", "apple", "cup"] },
      b: { name: "In the garden",  items: ["tulip", "rake", "watering can", "tree", "bird", "daisy"] } },
    { a: { name: "Flies",   items: ["bird", "butterfly", "airplane", "kite", "owl", "hummingbird"] },
      b: { name: "Drives",  items: ["truck", "car", "tractor", "bus", "wagon", "train"] } },
    { a: { name: "Morning", items: ["rooster", "breakfast", "sunrise", "coffee", "newspaper", "toast"] },
      b: { name: "Evening", items: ["moon", "lamp", "slippers", "quilt", "night owl", "bedtime story"] } }
  ];
  var PATHS = [
    { from: "Home", to: "the garden" }, { from: "The porch", to: "the mailbox" },
    { from: "The kitchen door", to: "the orchard" }, { from: "The barn", to: "the pond" },
    { from: "The front gate", to: "the church" }
  ];
  /* library pictures for look-and-name (ids in assets/coloring/manifest.json) */
  var LOOK = [
    { id: "teapot", word: "TEAPOT" }, { id: "sunflower", word: "SUNFLOWER" }, { id: "rocking_chair", word: "ROCKING CHAIR" },
    { id: "sitting_cat", word: "CAT" }, { id: "cardinal", word: "CARDINAL" }, { id: "grandfather_clock", word: "CLOCK" },
    { id: "farm_tractor", word: "TRACTOR" }, { id: "daisy", word: "DAISY" }
  ];

  /* ---------- daily living ---------- */
  var TASKS = [
    { id: "tea", title: "Make a cup of tea", pic: "teapot", safety: "Hot water: a caregiver does the pouring of hot water.",
      full: ["Fill the kettle with water", "Warm the teapot", "Put the tea in the pot", "Pour in hot water and wait", "Pour the tea into your cup", "Sip it slowly"],
      mid:  ["Warm the teapot", "Add tea and hot water", "Pour tea into your cup", "Sip it slowly"],
      short: ["Add hot water to the tea", "Pour into your cup", "Sip it slowly"] },
    { id: "water", title: "Water the flowers", pic: "watering_can", safety: "",
      full: ["Pick up the watering can", "Fill it at the tap", "Carry it to the flowers", "Pour slowly at the base", "Set the can down", "Look at the flowers"],
      mid:  ["Pick up the watering can", "Carry it to the flowers", "Pour slowly", "Set the can down"],
      short: ["Pick up the can", "Pour on the flowers", "Look at the flowers"] },
    { id: "birds", title: "Feed the birds", pic: "birdhouse", safety: "Wash hands afterward.",
      full: ["Pick up the seed scoop", "Open the seed bag", "Scoop some seed", "Pour it in the feeder", "Close the bag", "Watch for visitors"],
      mid:  ["Scoop some seed", "Pour it in the feeder", "Close the bag", "Watch for visitors"],
      short: ["Scoop the seed", "Pour it in the feeder", "Watch for visitors"] },
    { id: "towel", title: "Fold a towel", pic: "",
      full: ["Lay the towel flat", "Smooth it with both hands", "Fold it in half", "Fold it in half again", "Press it flat", "Place it on the pile"],
      mid:  ["Lay the towel flat", "Fold it in half", "Fold it in half again", "Place it on the pile"],
      short: ["Lay the towel flat", "Fold it in half", "Place it on the pile"] },
    { id: "table", title: "Set the table", pic: "teacup",
      full: ["Lay the tablecloth", "Put a plate at each seat", "Put a fork on the left", "Put a cup near the plate", "Add a napkin", "Sit down together"],
      mid:  ["Put a plate at each seat", "Put a fork on the left", "Put a cup near the plate", "Sit down together"],
      short: ["Put a plate at each seat", "Put a cup near the plate", "Sit down together"] },
    { id: "hair", title: "Brush your hair", pic: "",
      full: ["Pick up the brush", "Hold it near the top", "Brush gently down", "Brush the other side", "Look in the mirror", "Put the brush back"],
      mid:  ["Pick up the brush", "Brush gently down", "Look in the mirror", "Put the brush back"],
      short: ["Pick up the brush", "Brush gently down", "Look in the mirror"] }
  ];

  /* ---------- tone: an invitation, never a test ---------- */
  var BAD = /do you remember|remember when|can you (?:tell|name|recall)|what year|who is this|quiz|\btest\b|correct answer|wrong answer|sweetie|honey|\bdear\b|good job|good girl|good boy|cutie|\bkiddo\b/i;
  function toneProblems(text) {
    var t = String(text == null ? "" : text), out = [];
    var m = BAD.exec(t);
    if (m) out.push("“" + m[0] + "” talks down or tests; use an invitation");
    return out;
  }

  /* ---------- a seeded random source: same profile + seed, same sheets ---------- */
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ---------- the profile, made safe ---------- */
  function normalize(p) {
    p = p || {};
    var stage = Math.max(1, Math.min(3, Math.round(Number(p.stage) || 2)));
    var dex = DEXTERITY[p.dexterity] ? p.dexterity : "steady";
    var born = Math.round(Number(p.born)) || 0;
    var decade = DECADES.indexOf(Number(p.decade)) >= 0 ? Number(p.decade) : decadeFor(born);
    var split = function (v) { return (Array.isArray(v) ? v : String(v == null ? "" : v).split(/[,;\n]/)).map(function (x) { return String(x).trim().toLowerCase(); }).filter(Boolean).slice(0, 20); };
    return {
      name: String(p.name == null ? "" : p.name).replace(/[<>&"]/g, "").trim().slice(0, 40),
      nameStyle: p.nameStyle === "flow" || p.nameStyle === "formal" ? p.nameStyle : "plain",
      born: born, stage: stage, dexterity: dex, decade: decade,
      season: SEASONS.indexOf(p.season) >= 0 ? p.season : "", vocation: String(p.vocation == null ? "" : p.vocation).toLowerCase().replace(/[^a-z]/g, "").slice(0, 20),
      /* a bigger, harder word search for an early-stage reader who wants a real workout */
      challenge: !!p.challenge,
      interests: split(p.interests), avoid: avoidTerms(p.avoid, split),
      /* the saved resident, read once by js/residentContext.js: the life pages are made from it (null when nobody is chosen) */
      person: p.person && typeof p.person === "object" ? p.person : null,
      /* a resident's own people, pets, places and things, as single words of 3 to 10 letters (printed on the sheet, kept nowhere) */
      personal: split(p.personal).map(function (x) { return x.replace(/[^a-z]/g, ""); }).filter(function (x, i, a) { return x.length >= 3 && x.length <= 10 && a.indexOf(x) === i; }).slice(0, 8)
    };
  }
  /* the decade a person was about twenty in: their reminiscence years */
  function decadeFor(born) {
    if (!born || born < 1900 || born > 2010) return 1950;
    var d = Math.floor((born + 20) / 10) * 10;
    return Math.max(1940, Math.min(1980, d));
  }
  /* The words to keep off a page. With the shared resident reader on the page (js/residentContext.js) a topic's name, such as
     "war" or "Korean War", stands for that topic's whole word list; anything else is a word as typed. */
  function avoidTerms(v, split) {
    var R = root.CogniResident;
    if (R && R.avoidFromText && !Array.isArray(v)) return R.avoidFromText(v).slice(0, 80);
    return split(v);
  }
  /* Whole words only: avoiding "war" leaves "warm" and "award" alone, and still catches "wars"; a plural, a possessive and the
     -ing, -ed and -er forms count ("garden" also keeps out "gardening" and "gardener"). */
  var AVOID_RE = {};
  function avoidRe(a) {
    return AVOID_RE[a] || (AVOID_RE[a] = new RegExp("(^|[^a-z0-9])" + String(a).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[^a-z0-9]+") + "(s|es|'s|ing|ed|er|ers)?([^a-z0-9]|$)", "i"));
  }
  function avoided(text, avoid) { var t = String(text); return avoid.some(function (a) { return a && avoidRe(a).test(t); }); }

  /* ---------- the sheets ---------- */
  function reminiscenceSheets(P, r, count) {
    var S = STAGES[P.stage], D = DEXTERITY[P.dexterity], bank = ERA[P.decade];
    var per = Math.max(1, S.items - D.fewer), sheets = [];
    var pool = [];
    KIND_ORDER.forEach(function (k) { shuffle(bank[k], r).forEach(function (t) { if (!avoided(t, P.avoid) && !avoided(KIND_LABEL[k], P.avoid)) pool.push({ kind: k, thing: t }); }); });
    pool = shuffle(pool, r);
    for (var s = 0; s < count; s++) {
      var items = [], used = {};
      for (var i = 0; i < pool.length && items.length < per; i++) {
        var c = pool[(i + s * per) % pool.length];
        if (used[c.kind] && Object.keys(used).length < KIND_ORDER.length) continue;
        used[c.kind] = 1;
        var tpl = pick(INVITE[P.stage][c.kind], r);
        var line = tpl.replace("{t}", P.stage === 3 ? cap(c.thing) : c.thing);
        items.push({ kind: c.kind, tag: KIND_LABEL[c.kind], thing: cap(c.thing), invite: line, sense: P.stage === 3 ? SENSE[c.kind] : "", staff: STAFF[c.kind] });
      }
      /* each of the resident's own interests takes one card, once, on every other sheet; a sheet with a single idea keeps it */
      var own = P.interests[Math.floor(s / 2)];
      if (own && s % 2 === 0 && P.stage < 3 && items.length > 1) {
        var it = own;
        if (!avoided(it, P.avoid)) items[items.length - 1] = { kind: "own", tag: "Your interests", thing: cap(it), invite: P.stage === 1 ? "Tell me about " + it + "." : "Let's talk about " + it + ".", sense: "", staff: "This one comes from the resident's own interests." };
      }
      sheets.push({ module: "reminiscence", kind: "prompts", title: "The " + P.decade + "s", subtitle: P.stage === 3 ? "Things to look at and enjoy" : "Things to talk about", items: items,
        staffNote: "Goal: reminiscence through familiar things. " + (P.stage === 3 ? "Offer one at a time; a smile or a hum is a full answer." : "Offer one or two; follow wherever the story goes.") });
    }
    return sheets;
  }

  function exerciseSheets(P, r, count) {
    var S = STAGES[P.stage], D = DEXTERITY[P.dexterity], sheets = [];
    var kinds = P.stage === 3 ? ["look", "path"] : ["match", "sort", "path"];
    var pairs = shuffle(PAIRS, r), sorts = shuffle(SORTS, r), looks = shuffle(LOOK, r), paths = shuffle(PATHS, r);
    for (var s = 0; s < count; s++) {
      var k = kinds[s % kinds.length];
      if (k === "match") {
        var n = Math.max(2, S.pairs - D.fewer), ps = pairs.slice(s * n, s * n + n);
        if (ps.length < n) ps = shuffle(PAIRS, r).slice(0, n);
        sheets.push({ module: "exercise", kind: "match", title: "Pairs that go together", subtitle: "Draw a line from each word to its partner", pairs: ps,
          right: shuffle(ps.map(function (p) { return p[1]; }), r),
          staffNote: "Goal: familiar association. Completing it together is the activity; any help is welcome." });
      } else if (k === "sort") {
        var sp = sorts[s % sorts.length], m = P.stage === 1 ? 3 : 2;
        m = Math.max(2, m - (D.fewer ? 1 : 0));
        var a = shuffle(sp.a.items, r).slice(0, m), b = shuffle(sp.b.items, r).slice(0, m);
        sheets.push({ module: "exercise", kind: "sort", title: "Sort together", subtitle: "Where does each one belong?", groups: [sp.a.name, sp.b.name],
          words: shuffle(a.map(function (w) { return { w: w, g: 0 }; }).concat(b.map(function (w) { return { w: w, g: 1 }; })), r),
          staffNote: "Goal: categorizing. Start by placing the first one yourself, then hand over the pencil." });
      } else if (k === "look") {
        var lk = looks[s % looks.length];
        sheets.push({ module: "exercise", kind: "look", title: "Look and enjoy", subtitle: "", pic: lk.id, word: lk.word,
          staffNote: "Goal: calm, shared attention. Say the word once, slowly; stay as long as the resident is comfortable." });
      } else {
        var pt = paths[s % paths.length];
        sheets.push({ module: "exercise", kind: "path", title: "Follow the path", subtitle: "From " + pt.from.toLowerCase() + " to " + pt.to, from: cap(pt.from), to: cap(pt.to), turns: S.turns, seed: Math.floor(r() * 1e9),
          staffNote: "Goal: tracing and following. Draw along the path with a finger first, then a thick marker." });
      }
    }
    return sheets;
  }

  function dailySheets(P, r, count) {
    var S = STAGES[P.stage], D = DEXTERITY[P.dexterity], sheets = [];
    var order = shuffle(TASKS, r), n = Math.max(3, S.steps - D.fewer);
    count = Math.min(count, order.length);                              // each task once: a batch never repeats a page
    for (var s = 0; s < count; s++) {
      var t = order[s % order.length];
      var list = P.stage === 3 ? t.short : P.stage === 2 ? t.mid : t.full;
      list = list.slice(0, Math.max(3, Math.min(list.length, n)));
      sheets.push({ module: "daily", kind: "steps", title: t.title, subtitle: "One step at a time", pic: t.pic,
        steps: list.map(function (x, i) { return { n: i + 1, text: x }; }), safety: t.safety,
        staffNote: "Goal: keeping a familiar routine. Do the first step together, then let the resident lead. " + (t.safety || "") });
    }
    return sheets;
  }

  /* ---------- the router: more kinds of sheet join here ----------
     register(id, { label, stages, build(profile, rng, count, kit) -> sheets, max(profile) }) adds a module. js/generators/activity-modules.js
     registers the rest of the master inventory this way, so the three modules above and every later one go through the same generate(). */
  var REGISTRY = {};
  function register(id, spec) { REGISTRY[id] = spec; MODULES = MODULES.filter(function (m) { return m.id !== id; }).concat([{ id: id, label: spec.label, stages: spec.stages }]); }
  var STAGE_FIT = { reminiscence: [1, 2, 3], exercise: [1, 2, 3], daily: [1, 2, 3], coloring: [1, 2, 3] };
  function fits(mod, stage) { var f = REGISTRY[mod] ? REGISTRY[mod].stages : STAGE_FIT[mod]; return !f || f.indexOf(stage) >= 0; }

  /* ---------- one call ---------- */
  /* generate(profile, { module, count, seed }) -> { stage, seed, code, sheets, problems } */
  function generate(profile, options) {
    options = options || {};
    var P = normalize(profile), S = STAGES[P.stage];
    var mod = ["reminiscence", "exercise", "daily"].indexOf(options.module) >= 0 || REGISTRY[options.module] ? options.module : "reminiscence";
    var seed = options.seed != null ? (options.seed >>> 0) : hash(JSON.stringify([P.stage, P.decade, P.season, P.interests, Date.now()]));
    if (!seed) seed = 1;
    var r = rng(hash(JSON.stringify([P.stage, P.dexterity, P.decade, P.interests, P.avoid, mod, seed])));
    var count = Math.max(1, Math.min(60, Math.round(options.count || 3)));
    var cap = REGISTRY[mod] && REGISTRY[mod].max ? REGISTRY[mod].max(P) : 60;
    count = Math.min(count, cap);                                                // a module with a small bank never repeats a sheet
    var sheets = !fits(mod, P.stage) ? [] : REGISTRY[mod] ? REGISTRY[mod].build(P, r, count, KIT) : mod === "reminiscence" ? reminiscenceSheets(P, r, count) : mod === "exercise" ? exerciseSheets(P, r, count) : dailySheets(P, r, count);
    /* the page code says the stage, the kind of page and the seed. A module may name its own letters (the life pages do, so
       "twenty" and "then and now" are not both T); the older kinds keep their first letter. */
    var code = "AS" + S.key + "-" + ((REGISTRY[mod] && REGISTRY[mod].code) || mod.charAt(0).toUpperCase()) + "-" + seed.toString(36).toUpperCase();
    sheets.forEach(function (sh, i) { sh.index = i; sh.stage = P.stage; sh.dexterity = P.dexterity; sh.name = P.name; sh.nameStyle = P.nameStyle; sh.code = code + "." + (i + 1); sh.dexNote = DEXTERITY[P.dexterity].note; });
    return { stage: P.stage, profile: P, seed: seed, code: code, module: mod, sheets: sheets, problems: validate(sheets, P), notFitting: !fits(mod, P.stage) };
  }

  /* what is wrong with these sheets, in words (an empty list is a pass) */
  /* The tone rules are for the words Cognicopia writes, not for the names of the resident's own people: a daughter called Honey,
     a dog called Dear or a family named Test is not baby talk. The names in the profile are set aside before a line is judged. */
  function withoutNames(text, P) {
    var w = P && P.person, names = [];
    if (P && P.name) names.push(P.name);
    if (w && w.family && w.family.all) w.family.all.forEach(function (x) { if (x && x.name) { names.push(x.name); if (x.first) names.push(x.first); } });
    if (!names.length) return text;
    var out = String(text);
    names.sort(function (a, b) { return b.length - a.length; }).forEach(function (n) { out = out.replace(new RegExp("(^|[^A-Za-z])" + String(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z])", "g"), "$1"); });
    return out;
  }
  function validate(sheets, P) {
    var out = [];
    (sheets || []).forEach(function (sh, i) {
      /* every word a sheet puts in front of the resident (the answer key and the note for staff are not read by the resident) */
      var texts = [], walk = function (v, key) {
        if (typeof v === "string") { if (key !== "staffNote" && key !== "keyLines" && key !== "dexNote" && key !== "code" && key !== "staff" && key !== "source") texts.push(v); }
        else if (Array.isArray(v)) v.forEach(function (x) { walk(x, key); });
        else if (v && typeof v === "object") Object.keys(v).forEach(function (k) { walk(v[k], k); });
      };
      ["title", "subtitle", "word", "from", "to", "items", "steps", "pairs", "words", "cards", "questions", "extra", "left", "right", "bank", "colors", "event", "target", "options"].forEach(function (k) { if (sh[k] != null) walk(sh[k], k); });
      /* a page of several items: everything in it is read by the resident, the strip for staff and the names of its parts aside */
      (sh.blocks || []).forEach(function (b) { if (b && b.kind !== "staff") Object.keys(b).forEach(function (k) { if (k !== "kind" && k !== "pic" && k !== "photo") walk(b[k], k === "label" || k === "text" || k === "sub" || k === "caption" ? "items" : k); }); });
      texts.forEach(function (t) {
        if (!t) return;
        toneProblems(withoutNames(t, P)).forEach(function (m) { out.push("Sheet " + (i + 1) + ": " + m); });
        if (P && avoided(t, P.avoid)) out.push("Sheet " + (i + 1) + ": “" + t + "” touches a topic to avoid");
      });
      if (sh.kind === "steps" && sh.steps.length < 3) out.push("Sheet " + (i + 1) + ": fewer than three steps");
      if (sh.stage === 3 && sh.kind === "steps" && sh.steps.length > 4) out.push("Sheet " + (i + 1) + ": too many steps for stage 3");
    });
    return out;
  }

  /* what a registered module needs from this file */
  var KIT = { STAGES: STAGES, DEXTERITY: DEXTERITY, ERA: ERA, DECADES: DECADES, rng: rng, hash: hash, shuffle: shuffle, pick: pick, cap: cap, avoided: avoided, toneProblems: toneProblems, decadeFor: decadeFor };
  return {
    kit: KIT, register: register, fits: fits, modules: function () { return MODULES.slice(); },
    VERSION: VERSION, STAGES: STAGES, DEXTERITY: DEXTERITY, DECADES: DECADES, SEASONS: SEASONS,
    KIND_LABEL: KIND_LABEL, ERA: ERA, TASKS: TASKS, PAIRS: PAIRS, SORTS: SORTS, LOOK: LOOK,
    normalize: normalize, decadeFor: decadeFor, generate: generate, validate: validate, toneProblems: toneProblems, hash: hash
  };
});
