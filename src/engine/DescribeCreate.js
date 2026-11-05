/* =====================================================================
   Describe & Create: a coloring page from a few words.

   Staff type what they would like to color ("a 1957 Chevy truck on a
   prairie road", "a grandfather clock in a cozy parlor"). This reads the
   words, finds the finished drawing that fits them best among the
   coloring subjects (assets/coloring/manifest.json), and lays it out with
   the hybrid coloring engine (src/engine/ColoringEngine.js) at the
   resident's stage: bold black outlines at the stage's line weight, no
   gray, a border and words made for the stage, ready to print or put in a
   PDF.

   What it does not do, and says so on the screen: it never draws a new
   subject from the words. The engine draws only finished drawings (the
   owner's rule: a subject drawn in code came out uneven), and the site
   never asks a picture service for one (the finished site makes no
   network request). So every answer says which words it drew from, and,
   when nothing fits exactly, which drawing is the closest and which words
   it could not draw. A new subject joins the library through the owner's
   local art tool or a licensed drawing (docs/hybrid-coloring-engine.md).

   Works in the browser (window.CognicopiaDescribe) and in Node
   (module.exports). No network, no storage: the words are used for one
   page and kept nowhere.
   ===================================================================== */
(function(root, factory){
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CognicopiaDescribe = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(root){
  "use strict";
  var VERSION = "1.0.0", MAX = 160;
  var M = function(){ return root.CognicopiaColoringManifest; }, E = function(){ return root.CognicopiaColoringEngine; };

  /* words that carry no subject */
  var STOP = ("a an the of in on at by for with and or to from into onto over under near beside behind its it this that these those my our your his her their " +
    "some one two three very just like little big large small old new nice pretty lovely beautiful detailed simple classic vintage antique close up closeup " +
    "picture page drawing image coloring colouring color colour please make draw show me us of").split(" ");
  var STOPSET = {}; STOP.forEach(function(w){ STOPSET[w] = 1; });
  /* not for a coloring page in care: refused with a gentle note */
  var REFUSE = /\b(gun|guns|rifle|pistol|weapon|weapons|knife|knives|blood|bloody|gore|kill|killing|dead|death|corpse|skull|skeleton|grave|coffin|funeral|war|bomb|bombs|battle|soldier|soldiers|hospital|needle|syringe|injection|nude|naked|sexy|devil|demon|zombie|monster|scary|horror|alcohol|beer|whiskey|cigarette|cigarettes|smoking|drugs)\b/i;
  /* words that name the same subject as a tag in the library */
  var MORE = {
    chevy:"truck", chevrolet:"truck", ford:"truck", dodge:"truck", gmc:"truck", studebaker:"truck", "international_harvester":"tractor", deere:"tractor", farmall:"tractor",
    lily:"flower", lilies:"flower", tiger_lily:"flower", orchid:"flower", peony:"flower", peonies:"flower", iris:"flower", lilac:"flower", daffodil:"flower", daffodils:"flower",
    carnation:"flower", poppy:"flower", poppies:"flower", hydrangea:"flower", petunia:"flower", marigold:"flower", bloom:"flower", blooming:"flower", bouquet:"flower", bouquets:"flower",
    zinnia:"flower", pansy:"flower", violet:"flower", magnolia:"flower", camellia:"flower", lavender:"flower",
    robin:"bird", bluebird:"bird", blue_jay:"bird", sparrow:"bird", finch:"bird", wren:"bird", chickadee:"bird", songbird:"bird", hen:"chicken", chickens:"chicken",
    puppy:"dog", kitten:"cat", pony:"horse", stallion:"horse", mare:"horse",
    sedan:"car", coupe:"car", convertible:"car", wagon:"car", station_wagon:"car", roadster:"car",
    locomotive:"train", caboose:"train", jet:"airplane", seaplane:"airplane",
    kettle:"teapot", coffee:"teacup", mug:"teacup", saucer:"teacup", cup:"teacup",
    wall_clock:"clock", mantel_clock:"clock", cuckoo_clock:"clock", pocket_watch:"clock",
    radio:"radio", phonograph:"record_player", record_player:"jukebox", piano:"music",
    lamp:"lantern", candle:"lantern", rocker:"rocking_chair", armchair:"rocking_chair", porch:"front_porch",
    barn:"farm", farmhouse:"farm", maple:"tree", elm:"tree", pine:"tree", willow:"tree", apple_tree:"tree", oak:"oak_tree",
    pumpkins:"pumpkin", gourd:"pumpkin", squash:"pumpkin", boat:"boat", canoe:"boat", rowboat:"boat", sail:"sailboat"
  };
  /* words that say when, not what: they help choose, and never decide alone */
  var BRAND = /\b(chevy|chevrolet|ford|dodge|gmc|studebaker|cadillac|buick|pontiac|plymouth|oldsmobile|packard|deere|farmall|singer|zenith|philco|bulova)\b/i;
  var ERA = /^(1[89]\d\d|20[0-2]\d|(19|18)\d0s|forties|fifties|sixties|thirties|twenties|seventies)$/;
  var DECADE_WORD = { twenties:"1920s", thirties:"1930s", forties:"1940s", fifties:"1950s", sixties:"1960s", seventies:"1970s" };

  function clean(text){ return String(text == null ? "" : text).replace(/[\u0000-\u001f\u007f<>{}]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX); }
  function words(text){
    return clean(text).toLowerCase().replace(/['’]s\b/g, "").replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter(Boolean);
  }
  /* every tag the library knows, and the words that name each subject (its id and title) */
  function vocabulary(){
    var m = M(), known = {}, head = {};
    m.assets().forEach(function(a){
      (a.tags || []).forEach(function(t){ known[t] = 1; });
      a.id.split("_").concat([a.id]).forEach(function(t){ if (!/^\d/.test(t)) head[t] = 1; });
      String(a.title || "").toLowerCase().replace(/^the\s+/, "").split(/\s+/).forEach(function(t){ if (t && !/^\d/.test(t)) head[t] = 1; });
    });
    Object.keys(m.TAG_PARENTS || {}).forEach(function(t){ known[t] = 1; });
    return { known:known, head:head };
  }
  /* the words, read: what can steer the choice, what only sets the scene */
  function interpret(text){
    var raw = clean(text), list = words(raw), m = M(), V = vocabulary(), out = { text:raw, refused:"", terms:[], scene:[], era:[] };
    if (!raw) { out.refused = "empty"; return out; }
    if (REFUSE.test(raw)) { out.refused = "topic"; return out; }
    var used = {}, i, add = function(tag, word, weight, kind, sub){ if (!tag) return; out.terms.push({ tag:tag, word:word, weight:weight, kind:kind, sub:!!sub }); };
    // two words that name one thing first ("grandfather clock", "tiger lily", "pickup truck")
    for (i = 0; i < list.length - 1; i++){
      var pair = list[i] + "_" + list[i + 1];
      if (MORE[pair] || V.known[pair] || (m.SYNONYMS && m.SYNONYMS[pair])){
        var t2 = MORE[pair] || m.normalizeTag(pair);
        add(t2, list[i] + " " + list[i + 1], 2.2, "subject", !!MORE[pair]); used[i] = used[i + 1] = 1;
      }
    }
    for (i = 0; i < list.length; i++){
      var w = list[i];
      if (used[i] || STOPSET[w] || w.length < 3 && !/^\d/.test(w)) continue;
      if (ERA.test(w)){
        var dec = DECADE_WORD[w] || (/^\d{4}$/.test(w) ? w.slice(0, 3) + "0s" : w);
        out.era.push(dec); add(dec, w, 0.45, "era"); if (/^\d{4}$/.test(w)) add(w, w, 0.45, "era"); continue;
      }
      var tag = MORE[w] ? MORE[w] : m.normalizeTag(w);
      if (MORE[w] || V.known[tag]) add(tag, w, 2, "subject", !!MORE[w]);
      else out.scene.push(w);
    }
    return out;
  }
  /* the drawing that fits the words best, how well, and why */
  function choose(text, opts){
    opts = opts || {};
    var r = interpret(text), m = M();
    if (r.refused) return { ok:false, reason:r.refused, words:r };
    var subjects = r.terms.filter(function(t){ return t.kind !== "era"; });
    if (!subjects.length) return { ok:false, reason:"no-subject", words:r };
    var stage = opts.stage, avoid = opts.avoid || [];
    var suits = function(a){ return !stage || (a.dementiaStageCompatibility || ["early", "middle", "late"]).indexOf(stage) >= 0; };
    var pool = m.assets().filter(function(a){ return suits(a) && !m.avoided(a, avoid) && (typeof opts.filter !== "function" || opts.filter(a)); });
    /* what each drawing is: its own name (the words of its id and title that are tags) and, through the tag tree, what that is a kind of
       ("1950s_pickup_truck" is a pickup truck, a truck, a utility vehicle...). A word that reaches the drawing this way names it; a word
       that is only one of its tags ("lake" on the sailboat, "flower" on the butterfly) is the scene around it, which is not drawn. */
    var P = m.TAG_PARENTS || {};
    var isa = function(a){
      var name = "_" + a.id + "_" + String(a.title || "").toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]+/g, "_") + "_", out = {};
      (a.tags || []).forEach(function(t){ if (name.indexOf("_" + t + "_") >= 0 && !/^\d/.test(t)){ var d = 0, x = t; while (x && out[x] == null && d < 7){ out[x] = d; x = P[x]; d++; } } });
      return out;
    };
    var scored = pool.map(function(a){
      var tags = {}, kind = isa(a), score = 0, named = 0, hits = [], exact = false;
      (a.tags || []).forEach(function(t){ tags[t] = 1; });
      r.terms.forEach(function(t){
        var best = 0, isA = false, own = false;
        m.expand(t.tag).forEach(function(e){
          // a word may widen two steps at most (a pickup truck, a truck, a utility vehicle): a "vehicle" is not the closest thing to a truck
          if (kind[e.tag] != null && e.level <= 2){ var w = e.weight * Math.pow(0.7, kind[e.tag]); if (!isA || w > best){ best = w; isA = true; own = e.level === 0 || (!!tags[t.tag] && kind[e.tag] >= 1); } }
          else if (!isA && tags[e.tag] && e.weight * 0.3 > best) best = e.weight * 0.3;
        });
        if (!best) return;
        score += best * t.weight;
        // the word names what the drawing is when the word itself reaches it, or when the drawing carries the word and the word is a kind of
        // something the drawing is ("steam train" for the steam locomotive); a wider word ("vehicle") or a word that is only near it ("diner") does not
        if (t.kind !== "era" && isA){ named += best * t.weight; if (!t.sub && own){ hits.push(t.word); exact = true; } }
      });
      return { a:a, score:score, named:named, hits:hits, exact:exact };
    }).filter(function(x){ return x.named > 0; }).sort(function(x, y){ return y.score - x.score || x.a.id.localeCompare(y.a.id); });
    if (!scored.length){
      // a drawing would fit, but the resident's topics to avoid rule it out: say so, rather than "nothing fits"
      var without = (avoid.length || typeof opts.filter === "function") ? choose(text, { stage:stage, variant:opts.variant }) : null;
      return { ok:false, reason:without && without.ok ? "avoided" : "no-match", words:r };
    }
    var top = scored[0].score, near = scored.filter(function(x){ return x.score >= top * 0.92; });
    var pick = near[(m.hashSeed(r.text.toLowerCase()) + (opts.variant || 0)) % near.length];
    var drawn = {}; pick.hits.forEach(function(w){ drawn[w] = 1; });
    var notDrawn = r.terms.filter(function(t){ return t.kind !== "era" && !drawn[t.word]; }).map(function(t){ return t.word; }).concat(r.scene);
    return { ok:true, asset:pick.a, exact:pick.exact, drawnFrom:pick.hits, notDrawn:notDrawn, era:r.era, words:r,
      others:scored.filter(function(x){ return x.a.id !== pick.a.id; }).slice(0, 3).map(function(x){ return x.a; }) };
  }
  /* the plain sentence staff read under the picture */
  function explain(c){
    if (!c.ok) return {
      empty:"Type a few words about the picture you would like, such as “a rose in a jug” or “a 1950s pickup truck”.",
      topic:"That is not a subject for a coloring page here. Try something calm and familiar: a garden, a pet, a classic car, a teapot.",
      "no-subject":"Those words do not name a thing to draw. Add what is in the picture, such as a flower, a bird, a car or a clock.",
      "no-match":"Nothing in the drawings fits those words yet. Try a nearby subject: a flower, a bird, a farm animal, a classic car or a clock.",
      avoided:"Every drawing that fits is on this resident’s list of topics to avoid."
    }[c.reason] || "Nothing could be made from those words.";
    var t = c.asset.title, s = c.exact ? "Chosen from “" + c.drawnFrom.join("”, “") + "”: " + t + "." : "There is no drawing of exactly that yet. The closest one: " + t + ".";
    if (c.notDrawn.length) s += " Not used: " + c.notDrawn.map(function(w){ return "“" + w + "”"; }).join(", ") + ".";
    s += " A page shows the subject on its own, with a border made for the stage.";
    if (BRAND.test(c.words.text)) s += " No maker’s name or badge is drawn.";
    return s;
  }
  /* a page from the words: { choice, page, svg, note } or { choice, note } when nothing can be made */
  function create(text, opts){
    opts = opts || {};
    var c = choose(text, opts), e = E();
    if (!c.ok) return { choice:c, note:explain(c) };
    var paths = M().paths(c.asset.id);
    if (!paths || !e) return { choice:{ ok:false, reason:"no-match", words:c.words }, note:"The drawings are not loaded on this page." };
    var seed = ((M().hashSeed(c.words.text.toLowerCase() + "|" + (opts.stage || "middle")) + (opts.variant || 0) * 7919) >>> 0) || 1;
    var page = e.compose({ asset:c.asset, paths:paths, stage:opts.stage || "middle", seed:seed, name:opts.name, frame:opts.frame, header:opts.header, footer:opts.footer });
    page.meta.describe = { text:c.words.text, exact:c.exact, drawnFrom:c.drawnFrom, notDrawn:c.notDrawn };
    return { choice:c, page:page, note:explain(c), problems:e.validate(page) };
  }
  return { VERSION:VERSION, MAX:MAX, interpret:interpret, choose:choose, explain:explain, create:create };
});
