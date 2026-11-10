/* =====================================================================
   Activity modules: the rest of the master clinical inventory, joined to
   the engine's router (CognicopiaActivityEngine.register).

   Nine kinds of activity, three to a stage, each made for the stage it
   is named for and available a stage either side where it still suits:

     Stage 1, mild        1  wordgrid     themed word searches, mixed-up words and
                                          "a look back" facts, from the resident's
                                          decade and former work
                          2  timeline     events or life chapters to put in order
                          3  memory       pairs to cut out, in rows and columns
     Stage 2, moderate    4  dialogue     one-theme conversation sheets, a question
                                          ladder and a response log for the chart
                          5  household    pictures, clothes and ingredients to match
                          6  phrases      proverbs and old song lines to finish
     Stage 3, advanced    7  coloring     (the Studio's coloring pages, a stage of their own)
                          8  recognition  shapes and colors, face up, nothing to get wrong
                          9  rhythm       tickets: a word to feel, a rhyme, a line of verse

   Every sheet is an invitation, never a test: there is no score, help is
   always welcome, and the staff note says how to use it one to one. Every
   poem and song line is a work published in 1928 or earlier, so it is free
   to print (each carries its year, and the check fails on a later one).
   The facts in a look-back are dates a facility can verify in a minute.

   Sheets are plain objects; js/generators/activity-pages.js draws them.
   No network, no storage.
   ===================================================================== */
(function (root) {
  "use strict";
  var E = root.CognicopiaActivityEngine;
  if (!E || !E.register) return;
  var K = E.kit;

  /* ---------- words, by decade and by former work ---------- */
  var DECADE_WORDS = {
    1940: ["RADIO", "SWING", "DANCE", "POSTCARD", "GARDEN", "TROLLEY", "PICNIC", "QUILT", "SODA", "PARADE", "LETTER", "CANNING"],
    1950: ["JUKEBOX", "DINER", "MILKSHAKE", "TELEVISION", "NEON", "POODLE", "SOCKHOP", "CHROME", "SUBURB", "PICNIC", "RECORD", "BOWLING"],
    1960: ["TRANSISTOR", "MOTOWN", "STATION", "FONDUE", "FOLKSONG", "BARBECUE", "TWIST", "RECORD", "CAMPER", "PATIO", "GUITAR", "HIFI"],
    1970: ["DISCO", "CROCKPOT", "SHAG", "CAMPER", "BELLS", "GUITAR", "SUNSET", "CASSETTE", "PLANTS", "MACRAME", "RADIO", "BIKE"],
    1980: ["CASSETTE", "WALKMAN", "MICROWAVE", "SNEAKERS", "VIDEO", "ARCADE", "MIXTAPE", "POPCORN", "SUMMER", "ROLLER", "RADIO", "PIZZA"]
  };
  var VOCATIONS = {
    farmer:      { label: "the farm", words: ["BARN", "TRACTOR", "HARVEST", "CORN", "FIELD", "WHEAT", "PLOW", "CATTLE", "SEED", "FENCE"] },
    teacher:     { label: "the classroom", words: ["CHALK", "CLASS", "DESK", "BOOK", "BELL", "LESSON", "PENCIL", "SCHOOL", "READ", "MAP"] },
    nurse:       { label: "caring work", words: ["CARE", "KIND", "WARD", "SHIFT", "CHART", "UNIFORM", "CAP", "HAND", "COMFORT", "TEAM"] },
    cook:        { label: "the kitchen", words: ["OVEN", "BREAD", "FLOUR", "SPOON", "PIE", "SOUP", "APRON", "KNEAD", "SUGAR", "PAN"] },
    mechanic:    { label: "the garage", words: ["WRENCH", "ENGINE", "GARAGE", "TIRE", "OIL", "BOLT", "PISTON", "HOOD", "JACK", "GEAR"] },
    secretary:   { label: "the office", words: ["TYPE", "LETTER", "DESK", "FILE", "PHONE", "MEMO", "STAMP", "PAPER", "CLOCK", "PEN"] },
    carpenter:   { label: "the workshop", words: ["HAMMER", "NAIL", "SAW", "PLANE", "BOARD", "LEVEL", "DRILL", "WOOD", "SQUARE", "CHISEL"] },
    driver:      { label: "the road", words: ["ROAD", "TRUCK", "MAP", "ROUTE", "HIGHWAY", "WHEEL", "FUEL", "CARGO", "MILE", "HORN"] },
    shopkeeper:  { label: "the store", words: ["STORE", "SHELF", "COUNTER", "COINS", "BELL", "GOODS", "LEDGER", "SCALE", "SIGN", "CHANGE"] },
    seamstress:  { label: "the sewing room", words: ["THREAD", "NEEDLE", "FABRIC", "BUTTON", "PATTERN", "SEAM", "THIMBLE", "SILK", "HEM", "LACE"] }
  };

  /* ---------- dated events (a look back, and the timeline) ---------- */
  var EVENTS = [
    { y: 1903, t: "The Wright brothers make their first flight" }, { y: 1908, t: "The Ford Model T goes on sale" },
    { y: 1927, t: "Charles Lindbergh flies alone across the Atlantic" }, { y: 1931, t: "The Empire State Building opens" },
    { y: 1936, t: "Hoover Dam is completed" }, { y: 1937, t: "The Golden Gate Bridge opens" }, { y: 1941, t: "Mount Rushmore is completed" },
    { y: 1945, t: "The Slinky goes on sale" }, { y: 1948, t: "The Polaroid camera goes on sale" }, { y: 1954, t: "The first pocket transistor radio goes on sale" },
    { y: 1955, t: "Disneyland opens in California" }, { y: 1956, t: "Elvis Presley sings on the Ed Sullivan show" }, { y: 1956, t: "The Interstate Highway Act is signed" },
    { y: 1958, t: "The Hula-Hoop becomes a craze" }, { y: 1958, t: "Jet airliners begin carrying passengers across the Atlantic" }, { y: 1959, t: "The Barbie doll is introduced" },
    { y: 1960, t: "The Etch A Sketch is introduced" }, { y: 1964, t: "The Beatles appear on the Ed Sullivan show" }, { y: 1964, t: "The Ford Mustang is introduced" },
    { y: 1967, t: "The first microwave oven for the home goes on sale" }, { y: 1969, t: "Apollo 11 lands on the Moon" }, { y: 1972, t: "The video game Pong arrives" },
    { y: 1976, t: "The Concorde begins passenger flights" }, { y: 1977, t: "The Apple II personal computer goes on sale" }, { y: 1979, t: "The Sony Walkman goes on sale" },
    { y: 1981, t: "MTV begins broadcasting" }, { y: 1981, t: "The space shuttle Columbia makes its first flight" }, { y: 1984, t: "Apple introduces the Macintosh" }
  ];
  var LIFE = ["Starting school", "A first job", "Learning to drive", "Setting up a home of your own", "Retirement"];

  /* ---------- helpers ---------- */
  var stageItems = { 1: 0, 2: 1, 3: 2 };
  var take = function (arr, n) { return arr.slice(0, Math.max(0, n)); };
  var okWord = function (w, P) { return !K.avoided(w, P.avoid); };
  var fewer = function (P) { return K.DEXTERITY[P.dexterity].fewer; };
  var caps = function (s) { return String(s).charAt(0).toUpperCase() + String(s).slice(1); };
  var HOME = "Goal: ";

  /* ---------- 1. word grids, mixed-up words and a look back ---------- */
  function makeGrid(words, size, dirs, r) {
    var grid = [], placed = [], i, j;
    for (i = 0; i < size; i++) { grid.push([]); for (j = 0; j < size; j++) grid[i].push(""); }
    words.slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (w) {
      for (var t = 0; t < 120; t++) {
        var d = dirs[Math.floor(r() * dirs.length)], rr = Math.floor(r() * size), cc = Math.floor(r() * size), ok = true, k;
        if (rr + d[0] * (w.length - 1) < 0 || rr + d[0] * (w.length - 1) >= size || cc + d[1] * (w.length - 1) < 0 || cc + d[1] * (w.length - 1) >= size) continue;
        for (k = 0; k < w.length; k++) { var cur = grid[rr + d[0] * k][cc + d[1] * k]; if (cur && cur !== w.charAt(k)) { ok = false; break; } }
        if (!ok) continue;
        for (k = 0; k < w.length; k++) grid[rr + d[0] * k][cc + d[1] * k] = w.charAt(k);
        placed.push({ w: w, r: rr, c: cc, dr: d[0], dc: d[1] }); return;
      }
    });
    var fill = "AEIOUSTRNLDCHMPBGWF";
    for (i = 0; i < size; i++) for (j = 0; j < size; j++) if (!grid[i][j]) grid[i][j] = fill.charAt(Math.floor(r() * fill.length));
    return { rows: grid.map(function (row) { return row.join(""); }), placed: placed };
  }
  /* the big word search for an early-stage reader: every direction, and a pool wide enough for 20 words.
     The size is what keeps the letters at the stage's large-print floor on one Letter page (measured, not guessed):
     20 x 20 with 20 words, smaller where a less steady hand needs a bigger cell to circle. */
  var CHALLENGE = { steady: { size: 20, words: 20 }, limited: { size: 18, words: 16 }, minimal: { size: 16, words: 14 } };
  var ALL_WAYS = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  function bigPool(P) {
    var v = VOCATIONS[P.vocation], out = P.personal.map(function (w) { return w.toUpperCase(); });
    [DECADE_WORDS[P.decade], v ? v.words : [], DECADE_WORDS[Math.max(1940, P.decade - 10)], DECADE_WORDS[Math.min(1980, P.decade + 10)]].forEach(function (list) {
      (list || []).forEach(function (w) { if (out.indexOf(w) < 0) out.push(w); });
    });
    return out;
  }
  function themeWords(P, which) {
    if (which === "personal") return { label: "Words from your life", list: P.personal.map(function (w) { return w.toUpperCase(); }).concat(DECADE_WORDS[P.decade]) };
    var v = VOCATIONS[P.vocation];
    if (which === "vocation" && v) return { label: "Words from " + v.label, list: v.words };
    return { label: "Words from the " + P.decade + "s", list: DECADE_WORDS[P.decade] };
  }
  function scrambleOf(w, r) { for (var t = 0; t < 20; t++) { var a = K.shuffle(w.split(""), r).join(""); if (a !== w) return a; } return w.split("").reverse().join(""); }
  function eventsNear(P, r, n, spread) {
    var lo = P.decade - 25, hi = P.decade + 30, pool = EVENTS.filter(function (e) { return e.y >= lo && e.y <= hi && okWord(e.t, P); });
    if (pool.length < n + 2) pool = EVENTS.filter(function (e) { return okWord(e.t, P); });
    var out = [], used = {};
    K.shuffle(pool, r).forEach(function (e) {
      if (out.length >= n || used[e.y]) return;
      if (spread && out.some(function (o) { return Math.abs(o.y - e.y) < spread; })) return;
      used[e.y] = 1; out.push(e);
    });
    return out;
  }
  function wordgridSheets(P, r, count) {
    var out = [], plan = P.personal.length >= 3 ? ["personal", "grid", "scramble", "facts", "grid2"] : ["grid", "scramble", "facts", "grid2"], used = {};
    if (P.challenge && P.stage === 1) plan = ["big"].concat(plan);
    for (var s = 0; s < count; s++) {
      var what = plan[s % plan.length], size = P.stage === 1 ? 10 : 8;
      if (K.DEXTERITY[P.dexterity].fewer) size = Math.max(7, size - 2);
      var nWords = Math.max(4, (P.stage === 1 ? 8 : 6) - fewer(P) * 2);
      if (what === "big") {
        var cf = CHALLENGE[P.dexterity] || CHALLENGE.steady;
        var bp = K.shuffle(bigPool(P).filter(function (w) { return okWord(w, P) && w.length >= 3 && w.length <= cf.size; }), r);
        var own = P.personal.map(function (w) { return w.toUpperCase(); }).filter(function (w) { return bp.indexOf(w) >= 0; });
        var want = own.concat(bp.filter(function (w) { return own.indexOf(w) < 0; })).slice(0, cf.words);
        var bg = makeGrid(want, cf.size, ALL_WAYS, r);
        out.push({ module: "wordgrid", kind: "wordgrid", title: own.length ? "Words from your life" : "Words from the " + P.decade + "s", size: cf.size,
          subtitle: "Find the words. They run in every direction: across, down, slanting, and backward.", rows: bg.rows, words: bg.placed.map(function (x) { return x.w; }),
          keyLines: bg.placed.map(function (x) { return x.w + ": row " + (x.r + 1) + ", column " + (x.c + 1) + ", going " + (x.dr > 0 ? "down" : x.dr < 0 ? "up" : "") + (x.dr && x.dc ? " and " : "") + (x.dc > 0 ? "right" : x.dc < 0 ? "left" : ""); }),
          staffNote: HOME + "a full-size word search for a reader who wants a real workout: words run in all eight directions, backward ones included. Offer it whole, say nothing about how long it takes, and leave it where the resident can come back to it." });
      } else if (what === "grid" || what === "grid2" || what === "personal") {
        var th = themeWords(P, what === "personal" ? "personal" : what === "grid2" ? "vocation" : "decade");
        var own = what === "personal" ? P.personal.map(function (w) { return w.toUpperCase(); }).filter(function (w) { return okWord(w, P) && w.length <= size; }) : [];
        var pool = K.shuffle(th.list.filter(function (w) { return own.indexOf(w) < 0 && okWord(w, P) && w.length <= size; }), r), words = take(own.concat(pool), nWords);
        var dirs = P.stage === 1 ? [[0, 1], [1, 0], [1, 1]] : [[0, 1], [1, 0]];
        var g = makeGrid(words, size, dirs, r);
        out.push({ module: "wordgrid", kind: "wordgrid", title: th.label, subtitle: "Find the words. They run across, down" + (P.stage === 1 ? " and slanting." : "."), size: size, rows: g.rows, words: g.placed.map(function (x) { return x.w; }),
          keyLines: g.placed.map(function (x) { return x.w + ": row " + (x.r + 1) + ", column " + (x.c + 1) + (x.dr && x.dc ? " going down and right" : x.dr ? " going down" : " going across"); }),
          staffNote: HOME + (what === "personal" ? "a word search that holds names and places from the resident's own life. Say each word aloud as it is found and let the resident tell its story. " : "a themed word search from the resident's own years or work. ") + "Circle the first word together; the finding is the activity, so help freely." });
      } else if (what === "scramble") {
        var th2 = themeWords(P, s % 2 ? "vocation" : "decade"), n2 = Math.max(3, (P.stage === 1 ? 5 : 4) - fewer(P));
        var ws = take(K.shuffle(th2.list.filter(function (w) { return okWord(w, P) && w.length >= 4; }), r), n2);
        out.push({ module: "wordgrid", kind: "scramble", title: "Mixed-up words", subtitle: th2.label + ". The first letter is in place.", items: ws.map(function (w) { return { scr: w.charAt(0) + scrambleOf(w.slice(1), r), len: w.length, first: w.charAt(0) }; }),
          keyLines: ws.map(function (w) { return w; }),
          staffNote: HOME + "word play from familiar words. Say the word aloud together; any good guess is welcome." });
      } else {
        var ev = eventsNear(P, r, Math.max(2, (P.stage === 1 ? 3 : 2) - (fewer(P) > 1 ? 1 : 0)), 0), items = ev.map(function (e) {
          return { kind: "fact", tag: "A look back, " + e.y, thing: e.t + ".", invite: P.stage === 1 ? "What does this bring to mind?" : "Let's talk about it together.", sense: "", staff: "A date to check, then follow the resident's own story." };
        });
        out.push({ module: "wordgrid", kind: "prompts", title: "A look back", subtitle: "Things that happened in your years", items: items,
          staffNote: HOME + "short facts from the decades as conversation starters. The question is an invitation, never a test; a memory of the day, the place or the people is all the answer needed." });
      }
    }
    return out;
  }

  /* ---------- 2. timeline sorting ---------- */
  function timelineSheets(P, r, count) {
    var out = [], seenOrders = {}, n = Math.max(3, (P.stage === 1 ? 5 : 3) - (fewer(P) ? 1 : 0));
    for (var s = 0; s < count; s++) {
      var life = s % 2 === 1, items;
      if (life) {
        var combos = [[0, 1, 4], [0, 2, 4], [1, 2, 4], [0, 1, 3], [1, 3, 4], [0, 2, 3], [2, 3, 4], [0, 3, 4]];
        var idx = P.stage === 1 ? [0, 1, 2, 3, 4] : combos[((s - 1) / 2) % combos.length];
        items = take(idx, n).map(function (i) { return { t: LIFE[i], y: null, o: i }; });
      } else {
        items = eventsNear(P, r, n, P.stage === 1 ? 3 : 8).map(function (e) { return { t: e.t, y: e.y, o: e.y }; });
      }
      var order = items.slice().sort(function (a, b) { return a.o - b.o; }), shuffled = K.shuffle(items, r);
      for (var tries = 0; tries < 12 && (shuffled.every(function (x, i) { return x === order[i]; }) || seenOrders[items.map(function (x) { return x.t; }).sort().join("|") + ">" + shuffled.map(function (x) { return x.t; }).join("|")]); tries++) shuffled = K.shuffle(items, r);
      seenOrders[items.map(function (x) { return x.t; }).sort().join("|") + ">" + shuffled.map(function (x) { return x.t; }).join("|")] = 1;
      var letters = "ABCDE".slice(0, shuffled.length).split("");
      out.push({ module: "timeline", kind: "timeline", title: life ? "Chapters of a life" : "What came first?", subtitle: "Write 1 in the box of the earliest, then 2, 3 and so on.",
        cards: shuffled.map(function (x, i) { return { id: letters[i], text: x.t }; }),
        keyLines: order.map(function (x, i) { var c = shuffled.indexOf(x); return (i + 1) + ". " + letters[c] + (x.y ? " (" + x.y + ")" : "") + ": " + x.t; }),
        staffNote: HOME + (life ? "putting life's chapters in order, which is personal and has no wrong story: people's lives differ, so welcome any order that makes sense to them." : "arranging events in time, a task that uses long-held knowledge. Start with the one they know best.") + " Offer to do the first one together." });
    }
    return out;
  }

  /* ---------- 3. memory pairs to cut out ---------- */
  var PICS = [["teapot", "TEAPOT"], ["teacup", "TEACUP"], ["sunflower", "SUNFLOWER"], ["daisy", "DAISY"], ["rooster", "ROOSTER"], ["cardinal", "CARDINAL"], ["horse", "HORSE"], ["sitting_cat", "CAT"],
    ["sitting_dog", "DOG"], ["grandfather_clock", "CLOCK"], ["pumpkin", "PUMPKIN"], ["tulip", "TULIP"], ["owl", "OWL"], ["butterfly", "BUTTERFLY"], ["sailboat", "SAILBOAT"], ["farm_tractor", "TRACTOR"],
    ["rotary_telephone", "TELEPHONE"], ["typewriter", "TYPEWRITER"], ["garden_rose", "ROSE"], ["hummingbird", "HUMMINGBIRD"]];
  function memorySheets(P, r, count) {
    var out = [], pairs = Math.max(3, (P.stage === 1 ? 6 : 4) - fewer(P));
    var pool = PICS.filter(function (p) { return okWord(p[1], P) && okWord(p[0], P); });
    for (var s = 0; s < count; s++) {
      var pick = take(K.shuffle(pool, r), pairs), faces = [];
      pick.forEach(function (p) { faces.push({ pic: p[0], word: p[1] }); faces.push({ pic: p[0], word: p[1] }); });
      out.push({ module: "memory", kind: "memory", title: "Find the pairs", subtitle: "Cut along the dashed lines. Turn the cards face down, turn two over, and look for a match.", cols: pairs > 4 ? 3 : 2, cards: K.shuffle(faces, r),
        keyLines: pick.map(function (p) { return p[1]; }),
        staffNote: HOME + "remembering where a card was, in rows and columns. Begin with every card face up and talk about each picture, then turn a few down. Start with " + Math.min(3, pairs) + " pairs and add more when it goes well; a turned card is never wrong." });
    }
    return out;
  }

  /* ---------- 4. guided dialogue ---------- */
  var THEMES = [
    { t: "Sunday dinner", q1: ["Who sat around the table on a Sunday?", "What was always on the table?", "Who did the cooking, and what did the kitchen smell like?"], q2: ["What did you like best at Sunday dinner?", "Who sat next to you?"], q3: ["Warm bread and a full table.", "The clink of plates and the sound of family."] },
    { t: "A first car", q1: ["What was the first car you remember?", "Where did you like to drive?", "Who taught you, or who rode along?"], q2: ["What did the car look like?", "Where did you like to go?"], q3: ["A shiny fender in the sun.", "The hum of an engine on a quiet road."] },
    { t: "The kitchen radio", q1: ["What did your family listen to on the radio?", "Where in the house did the radio sit?", "Who in the family liked it most?"], q2: ["What was your favorite program or song?", "Who listened with you?"], q3: ["A song playing softly in the kitchen.", "Humming along to a favorite tune."] },
    { t: "Summer evenings", q1: ["What did you do on a summer evening?", "Where did people gather outside?", "What sounds filled those evenings?"], q2: ["Where did you sit on a summer evening?", "What did you like about it?"], q3: ["A cool breeze at the end of a warm day.", "Crickets and the last of the light."] },
    { t: "Going to town", q1: ["How did you get to town?", "What did you go there to do?", "What was your favorite store or place?"], q2: ["What was the best part of going to town?", "Who went with you?"], q3: ["A shop bell ringing as the door opens.", "The smell of fresh bread from a bakery."] },
    { t: "Holidays at home", q1: ["How did your family celebrate the holidays?", "What did the house look like?", "Which dish or tradition did you look forward to?"], q2: ["What was your favorite holiday?", "What did the house smell like?"], q3: ["Candles glowing in a window.", "Cinnamon and something baking."] },
    { t: "The neighborhood", q1: ["What was your street like?", "Who lived nearby?", "Where did people stop to talk?"], q2: ["What did you see out of your front window?", "Who lived next door?"], q3: ["A porch and a friendly wave.", "Leaves rustling on a quiet street."] },
    { t: "Dressed up", q1: ["What did you wear when you dressed up?", "Where did you go in your best clothes?", "Who helped you get ready?"], q2: ["What was your favorite outfit?", "Where did you wear it?"], q3: ["The soft feel of a favorite scarf.", "A best coat and a bright hat."] },
    { t: "Music at home", q1: ["Who in your family played or sang?", "What songs did everyone know?", "Where did people sing together?"], q2: ["What song do you like best?", "Who sang with you?"], q3: ["A tune you know, hummed softly.", "Tapping a hand along to a steady beat."] },
    { t: "The garden", q1: ["What did your garden or yard hold?", "Who looked after it?", "What did it smell like in summer?"], q2: ["What did you like growing?", "Who worked in the garden with you?"], q3: ["Warm earth and green leaves.", "The color of flowers in the sun."] }
  ];
  function dialogueSheets(P, r, count) {
    var pool = K.shuffle(THEMES.filter(function (t) { return okWord(t.t, P); }), r), out = [];
    for (var s = 0; s < count && s < pool.length; s++) {
      var th = pool[s], qs = P.stage === 1 ? th.q1 : P.stage === 2 ? th.q2 : th.q3;
      qs = take(qs, Math.max(1, qs.length - (fewer(P) ? 1 : 0)));
      var era = K.ERA[P.decade], carLine = null;
      if (th.t === "A first car" && era) carLine = P.stage < 3 ? "Cars from the " + P.decade + "s: " + take(K.shuffle(era.vehicles, r), 2).join(" and ") + "." : null;
      out.push({ module: "dialogue", kind: "dialogue", title: th.t, subtitle: P.stage === 3 ? "Things to enjoy together" : "Let's talk about it", questions: qs, extra: carLine,
        log: ["Joined in", "Told a story", "Smiled", "Needed a rest"],
        staffNote: HOME + "one theme, one conversation. " + (P.stage === 3 ? "Read one line slowly, then wait. A smile, a hum or a held hand is a full answer." : "Ask one question, then wait and follow the story wherever it goes. Repeat a word or two back to show you are listening.") + " Tick what you saw on the log, with the date, for the care record." });
    }
    return out;
  }

  /* ---------- 5. household matching ---------- */
  var HOUSE_PICS = [["teapot", "TEAPOT"], ["teacup", "TEACUP"], ["rotary_telephone", "TELEPHONE"], ["typewriter", "TYPEWRITER"], ["cathedral_radio", "RADIO"], ["grandfather_clock", "CLOCK"], ["oil_lantern", "LANTERN"],
    ["rocking_chair", "ROCKING CHAIR"], ["watering_can", "WATERING CAN"], ["sewing_machine", "SEWING MACHINE"], ["birdhouse", "BIRDHOUSE"]];
  var HOUSE_WORDS = [["flour", "BREAD"], ["apples", "PIE"], ["wool", "SWEATER"], ["cotton", "SHIRT"], ["tomatoes", "SOUP"], ["cream", "BUTTER"], ["oats", "PORRIDGE"], ["leather", "BOOTS"], ["silk", "SCARF"], ["eggs", "OMELET"]];
  function householdSheets(P, r, count) {
    var out = [], n = Math.max(3, (P.stage === 1 ? 5 : 3) - (fewer(P) ? 1 : 0)), pics = K.shuffle(HOUSE_PICS.filter(function (p) { return okWord(p[1], P); }), r), words = K.shuffle(HOUSE_WORDS.filter(function (p) { return okWord(p[0], P) && okWord(p[1], P); }), r);
    for (var s = 0; s < count; s++) {
      if (s % 2 === 0) {
        var pk = take(pics.slice((s / 2 * n) % pics.length).concat(pics), n);
        out.push({ module: "household", kind: "household", mode: "pictures", title: "Things around the house", subtitle: "Draw a line from each picture to its name.", left: pk.map(function (p) { return { pic: p[0], word: "" }; }), right: K.shuffle(pk.map(function (p) { return p[1]; }), r),
          keyLines: pk.map(function (p) { return p[1]; }),
          staffNote: HOME + "everyday objects from the home, matched by sight, which uses procedural and long-term memory. Say each name aloud; handling the real object makes it stronger." });
      } else {
        var wp = take(words.slice(((s - 1) / 2 * n) % words.length).concat(words), n);
        out.push({ module: "household", kind: "household", mode: "words", title: "From the pantry and the sewing box", subtitle: "Draw a line from what it is made from to what it makes.", left: wp.map(function (p) { return { pic: "", word: p[0].toUpperCase() }; }), right: K.shuffle(wp.map(function (p) { return p[1]; }), r),
          keyLines: wp.map(function (p) { return p[0].toUpperCase() + " to " + p[1]; }),
          staffNote: HOME + "materials and what they become, familiar from kitchens and sewing rooms. Offer the real thing to touch if you can." });
      }
    }
    return out;
  }

  /* ---------- 6. phrases and old song lines ---------- */
  var PROVERBS = [["A stitch in time", "saves nine"], ["Look before you", "leap"], ["Many hands make", "light work"], ["Better late", "than never"], ["Practice makes", "perfect"], ["The early bird catches", "the worm"],
    ["A penny saved is", "a penny earned"], ["Home is where the", "heart is"], ["Every cloud has a", "silver lining"], ["Actions speak louder", "than words"], ["Don't count your chickens", "before they hatch"], ["Birds of a feather", "flock together"],
    ["Rome wasn't", "built in a day"], ["Waste not,", "want not"], ["A rolling stone", "gathers no moss"], ["Two heads are", "better than one"], ["You can't judge a book", "by its cover"], ["Slow and steady", "wins the race"],
    ["Where there's smoke,", "there's fire"], ["Honesty is", "the best policy"]];
  var LYRICS = [["Take me out to the ball game, take me out with the", "crowd", 1908], ["Let me call you sweetheart, I'm in love with", "you", 1910], ["Home, home on the range, where the deer and the antelope", "play", 1904],
    ["I come from Alabama with my banjo on my", "knee", 1848], ["In the good old summertime, in the good old", "summertime", 1902], ["Shine on, shine on, harvest", "moon", 1908],
    ["I've been working on the railroad, all the live-long", "day", 1894], ["By the light of the silvery", "moon", 1909], ["Down by the old mill", "stream", 1910], ["When Irish eyes are", "smiling", 1912], ["You made me love you, I didn't want to do", "it", 1913]];
  function phrasesSheets(P, r, count) {
    var out = [], n = Math.max(3, (P.stage === 1 ? 6 : 4) - fewer(P)), pv = K.shuffle(PROVERBS.filter(function (x) { return okWord(x[0] + " " + x[1], P); }), r), ly = K.shuffle(LYRICS.filter(function (x) { return okWord(x[0] + " " + x[1], P); }), r);
    for (var s = 0; s < count; s++) {
      var song = s % 2 === 1, pool = song ? ly : pv, seenEnd = {}, pk = take(pool.slice((Math.floor(s / 2) * n) % pool.length).concat(pool).filter(function (x) { if (seenEnd[x[1]]) return false; seenEnd[x[1]] = 1; return true; }), n);   // no two lines end the same way
      var items = pk.map(function (x) { return { start: x[0], end: x[1], year: song ? x[2] : null }; });
      out.push({ module: "phrases", kind: "phrases", title: song ? "Finish the song" : "Finish the saying", subtitle: P.stage === 1 ? "Say the ending, or write it on the line." : "Choose an ending from the box and say it, or write it.", items: items,
        bank: P.stage === 1 ? null : K.shuffle(items.map(function (x) { return x.end; }), r),
        keyLines: items.map(function (x) { return x.start + " " + x.end; }),
        staffNote: HOME + (song ? "old songs and the words that go with them, which often stay when other words do. Hum the tune and let them finish the line; singing it together counts." : "well-known sayings that many people finish without thinking, a sign of long-held language.") + " There is no wrong ending: any word that fits is welcome." });
    }
    return out;
  }

  /* ---------- 8. shapes and colors, face up ---------- */
  var SHAPES = ["circle", "square", "triangle", "star", "heart", "diamond", "oval", "cross"];
  var COLORS = ["RED", "YELLOW", "BLUE", "GREEN", "ORANGE", "PURPLE"];
  var COLOR_OBJECTS = { RED: "an apple", YELLOW: "the sun", BLUE: "the sky", GREEN: "a leaf", ORANGE: "a pumpkin", PURPLE: "a plum" };
  function recognitionSheets(P, r, count) {
    var out = [];
    for (var s = 0; s < count; s++) {
      var shapes = K.shuffle(SHAPES, r), n = P.stage === 2 ? Math.max(3, 4 - fewer(P)) : 2;
      if (s % 2 === 0) {
        if (P.stage === 2) {
          var pk = take(shapes, n);
          out.push({ module: "recognition", kind: "shapes", mode: "match", title: "Same shapes", subtitle: "Draw a line from each shape to the one that matches.", left: pk, right: K.shuffle(pk, r), keyLines: pk.map(function (x) { return x + " to " + x; }),
            staffNote: HOME + "matching by sight, face up with nothing hidden. Trace the first line together with a finger, then hand over the pencil. Every shape in the right column has its partner." });
        } else {
          var target = shapes[0], other = shapes[1];
          out.push({ module: "recognition", kind: "shapes", mode: "point", title: "Point to the same", subtitle: "Look at the shape on top. Point to the one that is the same.", target: target, options: K.shuffle([target, other], r), keyLines: ["The same shape is the " + target + "."],
            staffNote: HOME + "calm shared attention on one shape and two very different choices, so there is nothing to get wrong. Point, say the name once, and smile; if they point to either one, name it and move on." });
        }
      } else {
        var cs = take(K.shuffle(COLORS, r), P.stage === 2 ? Math.max(2, n - 1) : 2);
        out.push({ module: "recognition", kind: "shapes", mode: "colors", title: "Colors around us", subtitle: "Find something with this color, or color the shape in.", colors: cs.map(function (c, i) { return { word: c, shape: shapes[i], thing: COLOR_OBJECTS[c] }; }),
          keyLines: cs.map(function (c) { return c + ": " + COLOR_OBJECTS[c]; }),
          staffNote: HOME + "naming colors, a skill that is often kept late. Hold up a crayon or a real object of the color. The page prints in black and white so it copies cleanly; the color is the crayon's job." });
      }
    }
    return out;
  }

  /* ---------- 9. rhythm and sensory tickets ---------- */
  var FEEL = ["Warm.", "Soft.", "Golden.", "Quiet.", "Sunny.", "Fresh bread.", "Rain on the roof.", "A cool breeze.", "Clean sheets.", "A warm cup.", "Green leaves.", "A friendly voice."];
  var VERSE = [["O my Luve is like a red, red rose.", "Robert Burns, 1794", 1794], ["I wandered lonely as a cloud.", "William Wordsworth, 1807", 1807],
    ["Hope is the thing with feathers.", "Emily Dickinson, 1891", 1891], ["The world is so full of a number of things.", "Robert Louis Stevenson, 1885", 1885],
    ["Sweet and low, sweet and low.", "Alfred Tennyson, 1850", 1850], ["Who has seen the wind? Neither I nor you.", "Christina Rossetti, 1872", 1872],
    ["There's no place like home.", "John Howard Payne, 1823", 1823], ["Daisy, Daisy, give me your answer, do.", "Harry Dacre, 1892", 1892],
    ["Beautiful dreamer, wake unto me.", "Stephen Foster, 1864", 1864], ["Under a spreading chestnut tree.", "Henry Wadsworth Longfellow, 1840", 1840]];
  function rhythmSheets(P, r, count) {
    var bank = [], per = Math.max(2, (P.stage === 3 ? 2 : 3) - fewer(P));
    FEEL.forEach(function (w) { if (okWord(w, P)) bank.push({ kind: "feel", tag: "A word to feel", thing: w, invite: "Feel it. Breathe slowly.", sense: "", staff: "Say it slowly and let the word settle." }); });
    VERSE.forEach(function (v) { if (okWord(v[0], P)) bank.push({ kind: "verse", tag: "A line of verse", thing: v[0], invite: "Say it with me.", sense: v[1], source: v[1], year: v[2], staff: "A familiar line to say or hum; the rhythm carries it." }); });
    bank = K.shuffle(bank, r);
    /* the late stage keeps to single words and short lines; the choice is made before the page is dealt, so a page is never left empty */
    var pool = P.stage === 3 ? bank.filter(function (x) { return x.kind === "feel" || x.thing.length < 33; }) : bank;
    var out = [];
    for (var s = 0; s < count; s++) {
      var items = take(pool.slice(s * per).concat(pool), per);
      if (P.stage === 3) items = items.map(function (x) { return Object.assign({}, x, { sense: "" }); });   // one thing at a time: no line about the author
      out.push({ module: "rhythm", kind: "prompts", title: "Words to enjoy", subtitle: "Something to feel and something to say", items: items,
        staffNote: HOME + "short words and familiar verse for cutting into tickets. Hand one over, read it slowly, and tap a gentle beat. Each poem and song line is from a work published in 1928 or earlier, free to print." });
    }
    return out;
  }

  /* ---------- the router ---------- */
  E.register("wordgrid",    { label: "Word grids and look-back", stages: [1, 2],    build: wordgridSheets,    max: function () { return 8; } });
  E.register("timeline",    { label: "Timeline sorting",         stages: [1, 2],    build: timelineSheets,    max: function () { return 8; } });
  E.register("memory",      { label: "Memory pairs",             stages: [1, 2],    build: memorySheets,      max: function () { return 6; } });
  E.register("dialogue",    { label: "Guided dialogue",          stages: [1, 2, 3], build: dialogueSheets,    max: function () { return THEMES.length - 2; } });
  E.register("household",   { label: "Household matching",       stages: [1, 2],    build: householdSheets,   max: function () { return 6; } });
  E.register("phrases",     { label: "Sayings and song lines",   stages: [1, 2],    build: phrasesSheets,     max: function () { return 6; } });
  E.register("recognition", { label: "Shapes and colors",        stages: [2, 3],    build: recognitionSheets, max: function () { return 6; } });
  E.register("rhythm",      { label: "Rhythm and word tickets",  stages: [2, 3],    build: rhythmSheets,      max: function () { return 5; } });
  E.VOCATIONS = Object.keys(VOCATIONS).map(function (k) { return { id: k, label: caps(k) }; });
  E.PUBLIC_DOMAIN = { verse: VERSE, lyrics: LYRICS, events: EVENTS };
  void stageItems;
})(typeof globalThis !== "undefined" ? globalThis : this);
