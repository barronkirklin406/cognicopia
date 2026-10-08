/* =====================================================================
   Cognicopia coloring subjects: the manifest and the subject search.
   Works in the browser (window.CognicopiaColoringManifest) and in Node
   (module.exports), with no network: the subjects come from
   assets/coloring/subjects.bundle.js when a page has loaded it, and
   from assets/coloring/manifest.json (fetched from this site) when not.

   Choosing a subject for a resident
     The resident's details become weighted tags: the decades of their
     teens and twenties (from the year they were born), their hobbies,
     their working life and anything asked for by name. Each tag is also
     tried through its broader tags with less weight, so a request for a
     Ford truck that no subject carries falls back to a pickup truck,
     then a utility vehicle, then a classic car, then any vehicle; a
     misspelled or unfamiliar word is matched to the nearest known tag;
     and when nothing matches at all a familiar default object is used.
     Subjects on the resident's avoid list, or not suited to their stage,
     are never chosen, and recently used subjects are passed over while
     others remain, so pages do not repeat.
   ===================================================================== */
(function(root, factory){
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CognicopiaColoringManifest = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";
  var STAGES = ["early", "middle", "late"];

  /* broader tags, tried in order when a tag finds nothing */
  var TAG_PARENTS = {
    ford_truck:"pickup_truck", chevy_truck:"pickup_truck", farm_truck:"pickup_truck", pickup_truck:"truck", truck:"utility_vehicle",
    utility_vehicle:"classic_car", tractor:"farm_machinery", farm_machinery:"utility_vehicle", combine:"farm_machinery",
    muscle_car:"classic_car", hot_rod:"classic_car", convertible:"classic_car", sedan:"classic_car", station_wagon:"classic_car",
    classic_car:"car", car:"vehicle", bus:"vehicle", motorcycle:"vehicle", scooter:"vehicle", bicycle:"vehicle",
    biplane:"airplane", jet:"airplane", airliner:"airplane", airplane:"aircraft", aircraft:"vehicle", helicopter:"aircraft",
    steam_train:"train", locomotive:"train", train:"vehicle", sailboat:"boat", canoe:"boat", ship:"boat", tugboat:"boat", boat:"vehicle",
    rose:"flower", tulip:"flower", daisy:"flower", sunflower:"flower", lily:"flower", flower:"garden", vegetable:"garden",
    garden:"nature", tree:"nature", oak:"tree", pine:"tree", pumpkin:"harvest", apple:"harvest", harvest:"farm", farm:"nature",
    hummingbird:"bird", cardinal:"bird", robin:"bird", owl:"bird", songbird:"bird", duck:"bird", bird:"animal",
    cat:"pet", dog:"pet", puppy:"dog", kitten:"cat", pet:"animal", horse:"farm_animal", pony:"horse", rooster:"farm_animal",
    chicken:"farm_animal", hen:"chicken", cow:"farm_animal", pig:"farm_animal", farm_animal:"farm",
    butterfly:"insect", insect:"garden",
    teapot:"tea", teacup:"tea", tea:"kitchen", coffee:"kitchen", baking:"kitchen", cooking:"kitchen", kitchen:"home",
    rocking_chair:"furniture", chair:"furniture", furniture:"home", lantern:"home", birdhouse:"garden", watering_can:"garden",
    grandfather_clock:"clock", wall_clock:"clock", pocket_watch:"clock", clock:"heirloom", heirloom:"home",
    telephone:"home", radio:"music", jukebox:"music", record_player:"music", phonograph:"music", piano:"music", music:"nostalgia",
    typewriter:"office", office:"work", sewing_machine:"sewing", sewing:"crafts", knitting:"crafts", quilting:"crafts", crafts:"home",
    fishing:"boat", camping:"lantern", woodworking:"furniture", carpentry:"woodworking", barn:"farm", mechanical:"vehicle",
    oil_lantern:"lantern", lamp:"lantern", cup:"teacup", afternoon_tea:"tea", porch:"rocking_chair", front_porch:"porch",
    rotary_telephone:"telephone", cathedral_radio:"radio", records:"jukebox", diner:"jukebox", letters:"typewriter"
  };
  /* What a topic on a resident's avoid list rules out. The codes are the
     ones the resident profile form uses; anything else typed is matched
     as a word, singular or plural, against each subject's title and tags. */
  var AVOID_TOPICS = {
    driving:["car", "truck", "tractor", "driving", "automobile", "utility vehicle", "sunday drive"],
    water:["boat", "sailboat", "sailing", "lake", "water", "sea", "fishing", "ship"],
    war:["war", "military", "biplane", "combat"], storms:["storm", "fire", "disaster"],
    children:["child", "children", "baby", "school"], medical:["hospital", "medical", "doctor", "nurse"],
    death:["death", "funeral", "grave"], religion:["church", "religion", "easter", "christmas"],
    money:["money", "bank", "coin"], politics:["politics", "election"], home:["house", "old house"],
    "family-conflict":["divorce"]
  };
  /* other words for the same thing */
  var SYNONYMS = {
    automobile:"car", auto:"car", motorcar:"car", cars:"car", trucks:"truck", pickup:"pickup_truck", gto:"muscle_car", mustang:"muscle_car",
    camaro:"muscle_car", corvette:"muscle_car", chevelle:"muscle_car", model_t:"classic_car", aeroplane:"airplane", plane:"airplane",
    planes:"airplane", airliner:"airliner", aviation:"airplane", flying:"airplane", pilot:"airplane", railroad:"train", railway:"train",
    trains:"train", sailing:"sailboat", boating:"boat", kitty:"cat", cats:"cat", dogs:"dog", birds:"bird", birdwatching:"bird",
    bird_watching:"bird", horses:"horse", riding:"horse", phone:"telephone", telephones:"telephone", timepiece:"clock", clocks:"clock",
    flowers:"flower", blossom:"flower", roses:"rose", gardening:"garden", gardens:"garden", trees:"tree", tea_time:"tea",
    sewing_machine:"sewing_machine", seamstress:"sewing", tailor:"sewing", quilts:"quilting", records:"record_player", dancing:"jukebox",
    singing:"music", songs:"music", writing:"typewriter", secretary:"typewriter", baker:"baking", cook:"cooking", chef:"cooking"
  };
  /* working lives and the subjects they bring to mind */
  var PROFESSION_TAGS = [
    [/farm|ranch|dairy|agricult|harvest/, ["farm", "tractor", "pickup_truck", "rooster", "barn", "harvest"]],
    [/mechanic|garage|auto|body shop/, ["car", "muscle_car", "truck", "mechanical"]],
    [/truck|haul|delivery|driver|chauffeur|cab/, ["truck", "pickup_truck", "car"]],
    [/rail|conductor|engineer on/, ["train", "locomotive"]],
    [/pilot|airline|aviat|stewardess|flight/, ["airplane", "airliner"]],
    [/sailor|navy|fisher|boat|marine|captain/, ["boat", "sailboat"]],
    [/secretar|office|clerk|typist|bookkeep|account|bank|insur/, ["typewriter", "telephone", "office"]],
    [/teach|school|librar/, ["typewriter", "clock", "flower", "office"]],
    [/sew|seamstress|tailor|dressmak|textile|garment/, ["sewing_machine", "sewing"]],
    [/homemak|housewife|mother|home/, ["kitchen", "teapot", "sewing_machine", "flower"]],
    [/cook|chef|baker|bakery|diner|restaurant|waitress|kitchen/, ["kitchen", "teapot", "jukebox"]],
    [/carpent|wood|cabinet|builder|construct/, ["woodworking", "rocking_chair", "birdhouse"]],
    [/garden|landscap|florist|nursery|groundskeep/, ["garden", "flower", "watering_can"]],
    [/music|musician|singer|band|organist|piano/, ["music", "radio", "jukebox"]],
    [/nurse|doctor|hospital|care/, ["flower", "garden", "teacup"]],
    [/telephone|operator|switchboard/, ["telephone"]],
    [/clock|watch|jewel/, ["clock", "grandfather_clock"]],
    [/postal|mail|letter carrier/, ["office", "truck"]],
    [/factory|mill|plant|assembly/, ["mechanical", "car", "truck"]]
  ];
  var HOBBY_TAGS = [
    [/garden|flower|plant|rose/, ["garden", "flower"]], [/fish/, ["boat", "fishing"]], [/bird/, ["bird"]],
    [/car|driv|motor/, ["car", "classic_car"]], [/sew|quilt|knit|crochet|needle/, ["sewing", "crafts"]],
    [/bak|cook|kitchen|tea/, ["kitchen", "tea"]], [/music|danc|sing|record|piano|radio/, ["music", "jukebox", "radio"]],
    [/read|writ|letter/, ["typewriter"]], [/horse|riding|rodeo/, ["horse"]], [/dog/, ["dog"]], [/cat/, ["cat"]],
    [/travel|fly|plane/, ["airplane"]], [/train|rail/, ["train"]], [/wood|carv|build/, ["woodworking"]],
    [/camp|hik|outdoor|nature/, ["nature", "tree", "lantern"]], [/sail|boat|lake/, ["boat"]], [/butterfl/, ["butterfly"]]
  ];
  /* when nothing matches: familiar, calm, adult objects */
  var DEFAULT_IDS = ["teapot", "garden_rose", "grandfather_clock", "rocking_chair", "1957_family_sedan", "sunflower", "teacup"];

  var data = null, byId = {}, knownTags = {};

  function index(manifest, paths){
    data = { manifest:manifest, paths:paths || {} };
    byId = {}; knownTags = {};
    (manifest.assets || []).forEach(function(a){ byId[a.id] = a; (a.tags || []).forEach(function(t){ knownTags[t] = (knownTags[t] || 0) + 1; }); });
    Object.keys(TAG_PARENTS).forEach(function(t){ knownTags[t] = knownTags[t] || 0; knownTags[TAG_PARENTS[t]] = knownTags[TAG_PARENTS[t]] || 0; });
    return data;
  }
  /* the bundle when a page has loaded it; otherwise this site's manifest.json */
  function loadSync(){
    if (data) return data;
    var g = typeof globalThis !== "undefined" ? globalThis : this;
    if (g && g.CognicopiaSubjects && g.CognicopiaSubjects.manifest) return index(g.CognicopiaSubjects.manifest, g.CognicopiaSubjects.paths);
    return null;
  }
  function load(base){
    var d = loadSync(); if (d) return Promise.resolve(d);
    if (typeof fetch !== "function") return Promise.reject(new Error("no coloring subjects are loaded"));
    return fetch((base || "") + "assets/coloring/manifest.json", { cache:"no-cache" }).then(function(r){
      if (!r.ok) throw new Error("the coloring subjects list could not be read");
      return r.json();
    }).then(function(m){ return index(m, {}); });
  }
  function use(manifest, paths){ return index(manifest, paths); }      // for tests and tools
  function assets(){ loadSync(); return data ? data.manifest.assets.slice() : []; }
  function get(id){ loadSync(); return byId[id] || null; }

  /* ---------- tags ---------- */
  function lev(a, b){
    if (Math.abs(a.length - b.length) > 2) return 9;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++){ cur = [i]; for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[b.length];
  }
  function normalizeTag(t){
    var s = String(t || "").trim().toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!s) return "";
    if (SYNONYMS[s]) return SYNONYMS[s];
    if (knownTags[s] != null) return s;
    if (/s$/.test(s) && knownTags[s.slice(0, -1)] != null) return s.slice(0, -1);
    if (/^(19|20)\d\d$/.test(s) || /^(19|20)\d0s$/.test(s)) return s;
    // the nearest known tag, for a misspelling ("tracktor") or a near miss
    var best = "", bd = 9, k;
    for (k in knownTags){ if (s.length < 4) break; var d = lev(s, k), lim = s.length >= 7 ? 2 : 1; if (d <= lim && d < bd){ bd = d; best = k; } }
    return best || s;
  }
  /* a tag and its broader tags, each worth less */
  function expand(tag){
    var out = [], seen = {}, t = normalizeTag(tag), w = 1;
    while (t && !seen[t] && out.length < 8){ seen[t] = 1; out.push({ tag:t, weight:w, level:out.length }); t = TAG_PARENTS[t]; w *= 0.62; }
    return out;
  }
  /* the decades of a resident's reminiscence years (roughly ages 10 to 30) */
  function eraTags(born){
    var y = parseInt(born, 10); if (!(y >= 1900 && y <= 2010)) return [];
    var out = [];
    for (var age = 10; age <= 30; age += 10){ var dec = Math.floor((y + age) / 10) * 10; out.push({ tag:dec + "s", weight:age === 20 ? 0.5 : 0.35 }); }
    return out;
  }
  function list(v){ return Array.isArray(v) ? v : String(v || "").split(/[,;\n]+/).map(function(s){ return s.trim(); }).filter(Boolean); }
  /* everything about the resident that can steer the picture, as weighted tags */
  function profileTags(p){
    p = p || {};
    var out = [], add = function(t, w, why){ var n = normalizeTag(t); if (n) out.push({ tag:n, weight:w, why:why }); };
    list(p.tags || p.requested).forEach(function(t){ add(t, 1.5, "asked for"); });
    var job = String(p.former_profession || p.profession || p.job || p.occupation || "").toLowerCase();
    PROFESSION_TAGS.forEach(function(r){ if (job && r[0].test(job)) r[1].forEach(function(t, i){ add(t, i ? 0.8 : 1, "work"); }); });
    list(p.hobbies).forEach(function(h){
      var s = String(h).toLowerCase(), hit = false;
      HOBBY_TAGS.forEach(function(r){ if (r[0].test(s)){ hit = true; r[1].forEach(function(t){ add(t, 0.9, "hobby"); }); } });
      if (!hit) add(h, 0.6, "hobby");
    });
    var born = p.born || p.birthYear || (p.dob ? String(p.dob).slice(0, 4) : "") || (p.DOB ? String(p.DOB).slice(0, 4) : "");
    eraTags(born).forEach(function(e){ out.push({ tag:e.tag, weight:e.weight, why:"their years" }); });
    return out;
  }
  /* Whole words only, so "war" never rules out a warm teapot; a plural
     ("cars") also catches the singular tag ("car"). */
  function avoided(a, avoid){
    var words = [];
    list(avoid).forEach(function(w){
      w = String(w && typeof w === "object" ? w.code || "" : w).toLowerCase().trim();
      if (w.length < 3) return;
      (AVOID_TOPICS[w] || [w]).forEach(function(x){ words.push(x); if (/s$/.test(x) && x.length > 3) words.push(x.slice(0, -1)); });
    });
    if (!words.length) return false;
    var hay = " " + [a.title, a.id, (a.tags || []).join(" "), a.prompt, a.completion, a.banner].join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ") + " ";
    return words.some(function(w){ return hay.indexOf(" " + w.replace(/[^a-z0-9]+/g, " ").trim() + " ") >= 0; });
  }
  function rng(seed){ var s = (seed >>> 0) || 1; return function(){ s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashSeed(s){ var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* score every subject for a resident; the best few, ranked */
  function rank(profile, opts){
    loadSync(); opts = opts || {};
    var stage = STAGES.indexOf(String((profile || {}).stage || opts.stage || "").toLowerCase()) >= 0 ? String((profile || {}).stage || opts.stage).toLowerCase() : "";
    var q = profileTags(profile), exclude = opts.exclude || [], avoid = (profile || {}).avoid;
    var pool = assets().filter(function(a){
      return (!stage || (a.dementiaStageCompatibility || STAGES).indexOf(stage) >= 0) && !avoided(a, avoid) && (!opts.category || a.category === opts.category) &&
        (typeof opts.filter !== "function" || opts.filter(a));            // the host page's own rule (the packet tool's avoid list)
    });
    return pool.map(function(a){
      var tags = {}, score = 0, level = 9, matched = [];
      (a.tags || []).forEach(function(t){ tags[t] = 1; });
      q.forEach(function(qt){
        var best = 0, lv = 9, hit = "";
        expand(qt.tag).forEach(function(e){ if (tags[e.tag] && e.weight > best){ best = e.weight; lv = e.level; hit = e.tag; } });
        if (best){ score += best * qt.weight; matched.push(hit); if (!/^\d{4}s$/.test(qt.tag)) level = Math.min(level, lv); }   // a decade alone is not a subject match
      });
      if (exclude.indexOf(a.id) >= 0) score *= 0.05;                  // recently used: only if nothing else is left
      return { asset:a, score:score, level:level, matched:matched };
    }).sort(function(x, y){ return y.score - x.score || x.asset.id.localeCompare(y.asset.id); });
  }
  /* the subject for one page: the best match, a fair pick among near-equals, or a familiar default */
  function select(profile, opts){
    opts = opts || {};
    var ranked = rank(profile, opts);
    if (!ranked.length) return null;
    var r = rng(typeof opts.seed === "number" ? opts.seed : hashSeed(opts.seed || JSON.stringify(profile || {})));
    var top = ranked[0].score;
    if (top > 0){
      var near = ranked.filter(function(x){ return x.score >= top * 0.86; });
      var pick = near[Math.floor(r() * near.length)];
      return { asset:pick.asset, score:pick.score, fallbackLevel:pick.level === 9 ? 0 : pick.level, matched:pick.matched,
        fallback:pick.level === 9 ? "their years" : pick.level > 0 ? "broader tag" : "exact" };
    }
    // nothing matched: a familiar object, skipping any recently used
    var ok = ranked.map(function(x){ return x.asset; }), ex = opts.exclude || [];
    var def = DEFAULT_IDS.map(function(id){ return ok.filter(function(a){ return a.id === id; })[0]; }).filter(Boolean);
    var fresh = def.filter(function(a){ return ex.indexOf(a.id) < 0; });
    var a = (fresh[0] || def[0]) || ok[Math.floor(r() * ok.length)];
    return { asset:a, score:0, fallbackLevel:-1, matched:[], fallback:"default object" };
  }
  /* several distinct subjects for a packet or a batch */
  function selectMany(profile, count, opts){
    opts = opts || {};
    var out = [], used = (opts.exclude || []).slice(), seed = typeof opts.seed === "number" ? opts.seed : hashSeed(opts.seed || "batch");
    for (var i = 0; i < count; i++){
      var s = select(profile, { stage:opts.stage, category:opts.category, filter:opts.filter, exclude:used, seed:seed + i * 7919 });
      if (!s) break;
      out.push(s); used.push(s.asset.id);
    }
    return out;
  }
  function paths(id){ loadSync(); return data && data.paths[id] ? data.paths[id] : null; }

  return { STAGES:STAGES, TAG_PARENTS:TAG_PARENTS, SYNONYMS:SYNONYMS, PROFESSION_TAGS:PROFESSION_TAGS, HOBBY_TAGS:HOBBY_TAGS, DEFAULT_IDS:DEFAULT_IDS, AVOID_TOPICS:AVOID_TOPICS,
    load:load, loadSync:loadSync, use:use, assets:assets, get:get, paths:paths,
    normalizeTag:normalizeTag, expand:expand, eraTags:eraTags, profileTags:profileTags, avoided:avoided, rank:rank, select:select, selectMany:selectMany,
    hashSeed:hashSeed, rng:rng };
});
