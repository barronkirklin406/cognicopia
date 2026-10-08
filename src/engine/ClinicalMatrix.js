/* =====================================================================
   Cognicopia Clinical Alignment Matrix.

   One rulebook, read by every page maker. It decides, for each stage of
   dementia, how a page may look and what may be on it; the page makers
   (the packet tool, the Packet Builder, Today's Packet and the activity
   engine) keep to it, and the checks fail the build when one does not.

   Stages (the numbers people in care know them by)
     early   GDS 3-4, FAST 3-4   active recall and problem solving
     middle  GDS 5,   FAST 5     guided completion; errorless learning
     late    GDS 6-7, FAST 6-7   sensory, visual and motor anchoring
   The stage is chosen by the care team; nothing here infers it, and nothing
   here is a clinical assessment.

   What the matrix holds
     STAGES      type floors, grid sizes, stroke weights, counts per page
     SAFE        the printable area: nothing inside 0.5 in of any edge
     ACTIVITIES  every activity in the packet tool, the Packet Builder and
                 the activity engine: which stages it suits, and why
     dignity     the adult-dignity filter for words and pictures
     cues        the clinical tips and conversation starters printed on each
                 page for the person sitting beside the resident
     validatePage  the check every generated page must pass

   Frameworks the tips are drawn from: Montessori-based dementia programming
   (choice, a prepared place, a control of error, slow demonstration),
   Validation Therapy (acknowledge the feeling, never correct), Errorless
   Learning (give the cue before the answer; no guessing), hand-over-hand
   guidance, and person-centred communication.

   Runs in the browser (window.CognicopiaClinicalMatrix) and in Node (vm).
   ===================================================================== */
(function (root) {
  "use strict";
  var VERSION = "1.0.0";
  var PCG = root.CognicopiaPCG || {};

  /* ---------- the printable area (points; 72 to the inch) ---------- */
  var SAFE = Object.freeze({
    pageW: 612, pageH: 792,
    edge: 36,          // 0.5 in: nothing is ever drawn closer to an edge than this
    left: 54,          // 0.75 in: the binding side, for a three-ring punch
    right: 54, top: 54, bottom: 54
  });

  /* ---------- the three stages ---------- */
  var STAGES = {
    early: {
      id: "early", label: "Early (mild)", gds: "3–4", fast: "3–4", builder: "early", tier: 1,
      focus: "Active recall and problem solving", framework: "Cognitive stimulation; open recall; strategy",
      /* type: the smallest any resident-facing text may be, and the sizes the page makers aim for */
      type: { floor: 14, title: 26, instruction: 18, body: 20, label: 16, clue: 16, word: 18, cell: 15, bold: false },
      /* stroke: the thinnest line, in points; art is the weight pictures are drawn at */
      stroke: { min: 2.25, art: 3, rule: 2.25, motor: 4.5 },
      limits: {
        wordsearch: { sizes: [12, 15], dirs: 4, words: [10, 14] },
        crossword: { max: 13, words: [7, 9] },
        ladder: { rungs: [3, 5] }, anagram: { words: 6, minLen: 4, maxLen: 7, firstLetter: false },
        sorting: { items: 8, example: false }, odd: { puzzles: 5, items: 4 },
        sequence: { steps: 5, firstGiven: false }, matching: { pairs: 5 },
        maze: { cols: 7, rows: 9 }, choose: { items: 5, options: 3 }, completion: { items: 6 }
      },
      decor: "detailed", clutter: "light", prompts: "open"
    },
    middle: {
      id: "middle", label: "Middle (moderate)", gds: "5", fast: "5", builder: "moderate", tier: 2,
      focus: "Guided completion and errorless learning", framework: "Errorless learning; familiar phrases; recognition",
      type: { floor: 18, title: 28, instruction: 20, body: 22, label: 20, clue: 18, word: 22, cell: 24, bold: false },
      stroke: { min: 3, art: 4.5, rule: 3, motor: 4.5 },
      limits: {
        wordsearch: { sizes: [8], dirs: 2, words: [5, 6] },
        crossword: { max: 8, words: [4, 6] },
        ladder: { rungs: [3, 3] }, anagram: { words: 4, minLen: 4, maxLen: 5, firstLetter: true },
        sorting: { items: 6, example: true }, odd: { puzzles: 3, items: 3 },
        sequence: { steps: 4, firstGiven: true }, matching: { pairs: 4 },
        maze: { cols: 5, rows: 7 }, choose: { items: 5, options: 2 }, completion: { items: 5 }
      },
      decor: "simple", clutter: "minimal", prompts: "guided"
    },
    late: {
      id: "late", label: "Late (advanced)", gds: "6–7", fast: "6–7", builder: "advanced", tier: 3,
      focus: "Sensory, visual and motor anchoring", framework: "Sensory stimulation; visual anchoring; motor engagement",
      type: { floor: 24, title: 32, instruction: 26, body: 32, label: 24, clue: 24, word: 32, cell: 40, bold: true },
      stroke: { min: 4.5, art: 6, rule: 4.5, motor: 6 },
      limits: {
        wordsearch: { sizes: [6], dirs: 1, words: [3, 3] },
        crossword: { max: 0, words: [0, 0] },
        ladder: { rungs: [0, 0] }, anagram: { words: 0, minLen: 0, maxLen: 0, firstLetter: true },
        sorting: { items: 0, example: true }, odd: { puzzles: 0, items: 0 },
        sequence: { steps: 3, firstGiven: true }, matching: { pairs: 3 },
        maze: { cols: 4, rows: 5, deadEnds: 2 }, choose: { items: 3, options: 2 }, completion: { items: 3 }
      },
      decor: "none", clutter: "none", prompts: "sensory"
    }
  };
  Object.keys(STAGES).forEach(function (k) { Object.freeze(STAGES[k].type); Object.freeze(STAGES[k].stroke); Object.freeze(STAGES[k]); });
  Object.freeze(STAGES);

  /* "early", "mild", 1, "GDS 4", "moderate", 5, "advanced", "severe", 7 ... -> early | middle | late */
  function stageOf(v) {
    var s = String(v == null ? "" : v).toLowerCase().trim();
    if (STAGES[s]) return s;
    var n = /(\d)/.exec(s);
    if (/^(early|mild|early-stage|tier ?1|1)$/.test(s)) return "early";
    if (/^(late|advanced|severe|late-stage|tier ?3|3)$/.test(s)) return "late";
    if (/^(middle|moderate|mid|tier ?2|2)$/.test(s)) return "middle";
    if (/gds|fast|stage/.test(s) && n) { var g = +n[1]; return g <= 4 ? "early" : g === 5 ? "middle" : "late"; }
    return "middle";
  }
  var builderLevel = function (stage) { return STAGES[stageOf(stage)].builder; };
  var rules = function (stage) { return STAGES[stageOf(stage)]; };

  /* ---------- type ---------- */
  /* The smallest a resident-facing text role may be. Staff text (tips, answers, the footer) is held to a
     lower, still readable, floor; the little numbers in a puzzle grid are labels, not reading. */
  var STAFF_FLOOR = 10;
  var RESIDENT_ROLES = ["title", "instruction", "body", "label", "word", "clue", "choice", "cell", "name", "heading", "prompt"];
  var STAFF_ROLES = ["staff", "answer", "footer", "cue", "header"];
  var EXEMPT_ROLES = ["number", "mark"];
  function floorFor(stage, role) {
    var S = STAGES[stageOf(stage)];
    if (STAFF_ROLES.indexOf(role) >= 0) return STAFF_FLOOR;
    if (EXEMPT_ROLES.indexOf(role) >= 0) return 8;
    return S.type.floor;
  }
  function typeSize(stage, role) {
    var S = STAGES[stageOf(stage)], t = S.type;
    return Math.max(t.floor, t[role] || t.body);
  }

  /* ---------- which activity suits which stage ----------
     id: the activity's id in the tool named by `tools`. stages: where it belongs. domain: what it exercises.
     Each is held to the stage's type, grid and stroke rules whichever tool prints it. */
  var E = { early: true, middle: false, late: false }, EM = { early: true, middle: true, late: false },
      ML = { early: false, middle: true, late: true }, ALL = { early: true, middle: true, late: true };
  var ACTIVITIES = [
    /* the personalized packet tool (index.html) */
    { id: "wordsearch", tools: ["packet"], name: "Word search", domain: "language", fw: ["cognitive"], stages: ALL },
    { id: "erasearch", tools: ["packet"], name: "Second word search", domain: "language", fw: ["cognitive"], stages: ALL },
    { id: "crossword", tools: ["packet"], name: "Fit the words in", domain: "language", fw: ["cognitive", "errorless"], stages: EM },
    { id: "maze", tools: ["packet"], name: "Find your way through", domain: "motor", fw: ["montessori"], stages: ALL },
    { id: "dots", tools: ["packet"], name: "Join the dots", domain: "motor", fw: ["montessori"], stages: EM },
    { id: "bingo", tools: ["packet"], name: "Bingo card", domain: "social", fw: ["reminiscence"], stages: EM },
    { id: "colornum", tools: ["packet"], name: "Color by number", domain: "creative", fw: ["montessori"], stages: EM },
    { id: "games", tools: ["packet"], name: "Games to play together", domain: "social", fw: ["montessori"], stages: EM },
    { id: "lyric", tools: ["packet"], name: "Finish the line", domain: "procedural", fw: ["errorless", "reminiscence"], stages: ALL },
    { id: "lifestory", tools: ["packet"], name: "My life story", domain: "reminiscence", fw: ["validation", "reminiscence"], stages: EM },
    { id: "sayings", tools: ["packet"], name: "Proverbs and sayings", domain: "procedural", fw: ["errorless"], stages: ALL },
    { id: "career", tools: ["packet"], name: "Where does it belong?", domain: "semantic", fw: ["montessori"], stages: EM },
    { id: "scramble", tools: ["packet"], name: "Mixed-up words", domain: "language", fw: ["cognitive"], stages: EM },
    { id: "name", tools: ["packet"], name: "Name a few", domain: "semantic", fw: ["cognitive"], stages: EM },
    { id: "match", tools: ["packet"], name: "Two halves that go together", domain: "procedural", fw: ["errorless"], stages: EM },
    { id: "assoc", tools: ["packet"], name: "What goes with it?", domain: "semantic", fw: ["errorless"], stages: EM },
    { id: "trivia", tools: ["packet"], name: "About you", domain: "reminiscence", fw: ["reminiscence"], stages: EM },
    { id: "people", tools: ["packet"], name: "The people who help you", domain: "orientation", fw: ["validation"], stages: ALL },
    { id: "talk", tools: ["packet"], name: "Conversation starters", domain: "reminiscence", fw: ["validation", "reminiscence"], stages: ALL },
    { id: "era", tools: ["packet"], name: "Things you may recall", domain: "reminiscence", fw: ["reminiscence"], stages: ALL },
    { id: "task", tools: ["packet"], name: "Something to do", domain: "montessori", fw: ["montessori"], stages: ALL },
    { id: "language", tools: ["packet"], name: "Words from home", domain: "language", fw: ["reminiscence"], stages: EM },
    { id: "popculture", tools: ["packet"], name: "The songs and the pictures", domain: "reminiscence", fw: ["reminiscence"], stages: EM },
    { id: "rather", tools: ["packet"], name: "Which would you rather?", domain: "social", fw: ["validation"], stages: ALL },
    { id: "odd", tools: ["packet"], name: "Which one doesn't belong", domain: "semantic", fw: ["cognitive"], stages: EM },
    { id: "color", tools: ["packet"], name: "Coloring page", domain: "creative", fw: ["montessori"], stages: ALL },
    { id: "mandala", tools: ["packet"], name: "Color the pattern", domain: "creative", fw: ["montessori"], stages: ALL },
    { id: "notes", tools: ["packet"], name: "Staff engagement notes", domain: "staff", fw: [], stages: ALL },
    { id: "clocks", tools: ["packet"], name: "What time is it?", domain: "orientation", fw: ["cognitive"], stages: EM },
    { id: "coins", tools: ["packet"], name: "Match the coins", domain: "semantic", fw: ["cognitive"], stages: EM },
    { id: "provhint", tools: ["packet"], name: "Finish the proverb (with hint)", domain: "procedural", fw: ["errorless"], stages: ALL },
    { id: "tracing", tools: ["packet"], name: "Trace your name", domain: "motor", fw: ["montessori"], stages: ALL },
    { id: "facsupport", tools: ["packet"], name: "Activity support cards", domain: "staff", fw: [], stages: ALL },
    /* the Packet Builder (builder.html) */
    { id: "word-search", tools: ["builder"], name: "Word Search", domain: "language", fw: ["cognitive"], stages: EM },
    { id: "finish-saying", tools: ["builder"], name: "Finish the Saying", domain: "procedural", fw: ["errorless"], stages: ALL },
    { id: "scramble", tools: ["builder"], name: "Word Scramble", domain: "language", fw: ["cognitive"], stages: EM },
    { id: "name-three", tools: ["builder"], name: "Name Three", domain: "semantic", fw: ["cognitive"], stages: EM },
    { id: "goes-together", tools: ["builder"], name: "What Goes Together", domain: "semantic", fw: ["errorless"], stages: ALL },
    { id: "memory-lane", tools: ["builder"], name: "Memory Lane", domain: "reminiscence", fw: ["reminiscence", "validation"], stages: ALL },
    { id: "letter-scramble", tools: ["builder"], name: "Letter Scramble", domain: "language", fw: ["cognitive"], stages: EM },
    { id: "missing-letters", tools: ["builder"], name: "Missing Letters", domain: "language", fw: ["errorless"], stages: EM },
    { id: "alphabet-sweep", tools: ["builder"], name: "A-to-Z Sweep", domain: "semantic", fw: ["cognitive"], stages: E },
    { id: "letter-tracing", tools: ["builder"], name: "Letter Tracing", domain: "motor", fw: ["montessori"], stages: ALL },
    { id: "number-ladder", tools: ["builder"], name: "Number Ladder", domain: "numeracy", fw: ["cognitive"], stages: EM },
    { id: "money-count", tools: ["builder"], name: "Money Count", domain: "numeracy", fw: ["cognitive"], stages: EM },
    { id: "mini-sudoku", tools: ["builder"], name: "Mini Sudoku", domain: "executive", fw: ["cognitive"], stages: E },
    { id: "number-tracing", tools: ["builder"], name: "Number Tracing", domain: "motor", fw: ["montessori"], stages: ALL },
    { id: "chair-yoga", tools: ["builder"], name: "Chair Yoga", domain: "motor", fw: ["montessori"], stages: ALL },
    { id: "line-tracing", tools: ["builder"], name: "Line Tracing", domain: "motor", fw: ["montessori"], stages: ALL },
    { id: "beanbag-target", tools: ["builder"], name: "Beanbag Target", domain: "motor", fw: ["montessori"], stages: ALL },
    { id: "seated-rhythm", tools: ["builder"], name: "Seated Rhythm", domain: "motor", fw: ["montessori"], stages: ALL },
    { id: "lyric-sheet", tools: ["builder"], name: "Sing-Along Sheet", domain: "procedural", fw: ["reminiscence"], stages: ALL },
    { id: "finish-song", tools: ["builder"], name: "Finish the Song", domain: "procedural", fw: ["errorless"], stages: ALL },
    { id: "singer-match", tools: ["builder"], name: "Singer to Song", domain: "semantic", fw: ["errorless"], stages: EM },
    { id: "orientation-board", tools: ["builder"], name: "Daily Orientation Board", domain: "orientation", fw: ["validation"], stages: ALL },
    { id: "silhouette-match", tools: ["builder"], name: "Shadow Matching", domain: "sensory", fw: ["errorless"], stages: ALL },
    { id: "cognicopia-coloring", tools: ["builder"], name: "Cognicopia Coloring Page", domain: "creative", fw: ["montessori"], stages: ALL },
    { id: "cognicopia-coloring-library", tools: ["builder"], name: "Coloring Library", domain: "creative", fw: ["montessori"], stages: ALL },
    { id: "coloring", tools: ["builder"], name: "Coloring Page", domain: "creative", fw: ["montessori"], stages: ALL },
    { id: "reminiscence-cards", tools: ["builder"], name: "Reminiscence Cards", domain: "reminiscence", fw: ["reminiscence", "validation"], stages: ALL },
    /* the activity engine (src/engine/ClinicalActivities.js), in both tools */
    { id: "search-large", tools: ["packet", "builder"], name: "Large word search (12 or 15 square)", domain: "executive", fw: ["cognitive"], stages: E },
    { id: "search-guided", tools: ["packet", "builder"], name: "Guided word search (8 square, across and down)", domain: "language", fw: ["errorless", "cognitive"], stages: ML },
    { id: "ladder", tools: ["packet", "builder"], name: "Word ladder", domain: "executive", fw: ["cognitive"], stages: E },
    { id: "anagram", tools: ["packet", "builder"], name: "Anagrams with clues", domain: "language", fw: ["cognitive", "errorless"], stages: EM },
    { id: "sorting", tools: ["packet", "builder"], name: "Sort into two groups", domain: "semantic", fw: ["cognitive", "errorless"], stages: EM },
    { id: "oddone", tools: ["packet", "builder"], name: "Odd one out", domain: "semantic", fw: ["cognitive"], stages: EM },
    { id: "sequence", tools: ["packet", "builder"], name: "Put it in order", domain: "executive", fw: ["montessori", "errorless"], stages: ALL },
    { id: "choose-ending", tools: ["packet", "builder"], name: "Choose the ending", domain: "procedural", fw: ["errorless"], stages: ALL },
    { id: "matching", tools: ["packet", "builder"], name: "Match the picture to its name", domain: "sensory", fw: ["errorless", "montessori"], stages: ALL },
    { id: "maze-motor", tools: ["builder"], name: "Large-print maze", domain: "motor", fw: ["montessori"], stages: ALL },
    { id: "pathtrace", tools: ["packet", "builder"], name: "Follow the path", domain: "motor", fw: ["montessori"], stages: ML },
    { id: "orientation", tools: ["packet", "builder"], name: "Today: day, season and weather", domain: "orientation", fw: ["validation", "montessori"], stages: ALL },
    { id: "silhouette", tools: ["packet", "builder"], name: "Shape to look at", domain: "sensory", fw: ["montessori"], stages: ML }
  ];
  var byKey = {};
  ACTIVITIES.forEach(function (a) { a.tools.forEach(function (t) { byKey[t + ":" + a.id] = a; }); Object.freeze(a.stages); });

  /* A set of pages that works well together at each stage: a thing to look at, a thing to do with the hands, a
     thing to talk about and the day's orientation, in an hour a care team can give. Used by the "pick a set for
     this level" button. */
  var SUGGESTED = {
    packet: {
      early: ["search-large", "ladder", "anagram", "sorting", "oddone", "sequence", "maze", "orientation", "talk", "mandala", "notes"],
      middle: ["search-guided", "choose-ending", "matching", "sequence", "pathtrace", "orientation", "silhouette", "talk", "notes"],
      late: ["silhouette", "pathtrace", "maze", "orientation", "matching", "choose-ending", "sequence", "search-guided", "talk", "notes"]
    },
    builder: {
      early: ["search-large", "ladder", "anagram", "sorting", "oddone", "sequence", "maze", "orientation", "pathtrace"],
      middle: ["search-guided", "choose-ending", "matching", "sequence", "pathtrace", "orientation", "silhouette", "maze"],
      late: ["silhouette", "pathtrace", "maze", "orientation", "matching", "choose-ending", "sequence", "search-guided"]
    }
  };
  function suggested(stage, tool) {
    var set = (SUGGESTED[tool || "packet"] || SUGGESTED.packet)[stageOf(stage)] || [];
    return set.filter(function (id) { return allowed(stage, id, tool || "packet"); });
  }

  var DOMAIN_LABEL = {
    executive: "Executive function: planning and problem solving", language: "Language and word finding", semantic: "Categories and meaning",
    procedural: "Familiar phrases and songs (procedural memory)", reminiscence: "Life story and reminiscence", orientation: "Orientation to day, place and people",
    motor: "Hand control and coordination", sensory: "Sensory and visual anchoring", creative: "Creative expression", social: "Social and shared play",
    numeracy: "Everyday numbers", montessori: "Meaningful work (Montessori)", staff: "For staff"
  };

  function entry(tool, id) { return byKey[tool + ":" + id] || null; }
  /* An activity this matrix does not list is allowed: it was never classified, and refusing it would break a page. */
  function allowed(stage, id, tool) {
    var a = tool ? entry(tool, id) : (byKey["packet:" + id] || byKey["builder:" + id]);
    return !a || !!a.stages[stageOf(stage)];
  }
  function why(stage, id, tool) {
    var a = tool ? entry(tool, id) : (byKey["packet:" + id] || byKey["builder:" + id]), st = stageOf(stage);
    if (!a || a.stages[st]) return "";
    var where = ["early", "middle", "late"].filter(function (s) { return a.stages[s]; }).map(function (s) { return STAGES[s].label.split(" ")[0].toLowerCase(); });
    return a.name + " is made for the " + where.join(" and ") + " stage" + (where.length > 1 ? "s" : "") + ". At the " + STAGES[st].label.split(" ")[0].toLowerCase() + " stage it asks for more than is kind.";
  }
  function activitiesFor(stage, tool) {
    var st = stageOf(stage);
    return ACTIVITIES.filter(function (a) { return a.stages[st] && (!tool || a.tools.indexOf(tool) >= 0); });
  }

  /* ---------- the adult-dignity filter ----------
     Residents are adults with a lifetime behind them. Nothing printed for them may sound like it is written
     for a child, and no picture may look like it came from a nursery. Words are linted; pictures are
     accepted only from the adult subject categories. */
  var DIGNITY = [
    { id: "baby-talk", re: /\b(tummy|yummy|potty|nighty-?night|bye-?bye|din-?din|num-?nums?|boo-?boo|owie|choo-?choo|doggy|doggie|kitty|bunny|piggy|horsey|ducky|birdie|jammies|nappy|wee-?wee|night-?night)\b/i, why: "Baby talk." },
    { id: "child-address", re: /\b(kiddo|kiddos|buddy|young (lady|man)|little (one|ones|girl|boy|lady|man|friend)|big (girl|boy)|good (girl|boy)|sweetie|honey|dearie|sweetheart|cutie)\b/i, why: "Speaks to an adult as a child." },
    { id: "classroom", re: /\b(gold stars?|stickers?|teacher says|let'?s learn|boys and girls|class(room)? rules|raise your hand|show and tell|story ?time|nap ?time|recess|playtime|circle (the )?correct|homework|time for school|today we (will )?learn)\b/i, why: "Primary-school phrasing." },
    { id: "cheer", re: /\b(yay|hooray|woo-?hoo|super duper|fun fun|so much fun|awesome sauce|oopsie|whoopsie|uh-?oh)\b/i, why: "Cheering for a child." },
    { id: "juvenile-things", re: /\b(cartoon|mascot|emoji|clip ?art|smiley|chibi|kawaii|teddy|stuffed (animal|toy)|crayons?|sippy|pacifier|diaper|rattle|alphabet blocks?|nursery|toddler|preschool|kindergarten|playground)\b/i, why: "Children's things." },
    { id: "praise-pupil", re: /\b(good job|great job|well done|proud of you|nice work|you did it)\b/i, why: "Praise that sounds like a teacher to a pupil." },
    { id: "testing", re: /\b(do you remember|can you remember|try to remember|what is (the )?(date|year|day) today|who am i|who is this|test your)\b/i, why: "A memory test." },
    { id: "royal-we", re: /\b(how are we|are we ready|shall we go to the toilet|let'?s (go|get) (you|ready))\b/i, why: "Elderspeak: the royal we." },
    { id: "quantity-score", re: /\b(you (got|scored|missed)|\d+ out of \d+|score:|wrong|incorrect|mistake)\b/i, why: "Scoring and fault-finding." }
  ];
  var ADULT_CATEGORIES = ["vehicles", "animals", "nature", "objects", "nostalgia"];
  var JUVENILE_TAGS = /cartoon|mascot|emoji|clip_?art|smiley|chibi|kawaii|teddy|toy|crayon|nursery|baby|toddler|kid|child|playground|balloon_animal/i;

  /* the engine's own safety rules (src/pcg/data/safety.json), compiled once, when the procedural engine is loaded */
  var safetyRes = null;
  function safetyRules() {
    if (safetyRes) return safetyRes;
    var d = null;
    try { d = PCG.matrix && PCG.matrix.data ? PCG.matrix.data().safety : null; } catch (e) { d = null; }
    if (!d || !d.banned) return [];
    safetyRes = d.banned.map(function (b) { return { id: b.id, re: new RegExp(b.pattern, b.flags || "") }; });
    return safetyRes;
  }
  function lintText(text) {
    var out = [], s = String(text == null ? "" : text), i, sr = safetyRules();
    for (i = 0; i < DIGNITY.length; i++) if (DIGNITY[i].re.test(s)) out.push(DIGNITY[i].id);
    for (i = 0; i < sr.length; i++) if (sr[i].re.test(s) && out.indexOf(sr[i].id) < 0) out.push(sr[i].id);
    return out;
  }
  var cleanText = function (text) { return lintText(text).length === 0; };
  /* a coloring-library picture a resident may be given at this stage */
  function adultSubject(asset, stage) {
    if (!asset) return false;
    if (ADULT_CATEGORIES.indexOf(asset.category) < 0) return false;
    if ((asset.tags || []).some(function (t) { return JUVENILE_TAGS.test(t); })) return false;
    if (stage && asset.dementiaStageCompatibility && asset.dementiaStageCompatibility.indexOf(stageOf(stage)) < 0) return false;
    return cleanText([asset.title, asset.prompt, asset.completion, asset.banner].join(" "));
  }

  /* ---------- the daily seed ---------- */
  /* Everything random in a packet comes from here. The seed is the resident's first name and the calendar
     date (the local one), so printing at 8 AM and again at 2 PM gives the same packet, and tomorrow's is
     new. A variant number asks for a second packet on the same day. */
  function dailyRng(name, date, variant, salt) {
    var P = PCG.prng;
    if (!P) throw new Error("Load src/pcg/prng.js before ClinicalMatrix.js.");
    var seed = P.dailySeed(name, date == null ? P.today() : date, variant | 0);
    return P.create(salt ? seed + "/" + salt : seed);
  }
  var dateIso = function (date) { var P = PCG.prng; return P.dateParts(date == null ? P.today() : date).iso; };

  /* ---------- clinical tips and conversation starters ----------
     Printed on each page, for the person sitting beside the resident. {page} is "Page 2" or "this page";
     {name} is the resident's first name or "them"; {topic} is the thing the page is about (only used when
     the page has one). Each carries the framework it comes from. */
  var CUES = [
    /* hand-over-hand and motor */
    { fw: "motor", kinds: ["any"], text: "Use hand-over-hand guidance if {name} hesitates on {page}; ease off the moment they take over." },
    { fw: "motor", kinds: ["motor"], text: "Join in beside {name} and move at their pace. Stop at the first sign of tiredness or discomfort; nothing here needs to be finished." },
    { fw: "motor", kinds: ["maze", "trace", "color", "match", "sort", "sequence"], text: "Rest your hand lightly over theirs for the first line only, then let go. The rest is theirs." },
    { fw: "motor", kinds: ["maze", "trace", "color"], text: "Tape the page to the table so it cannot slide, and offer a thick marker or crayon they can grip easily." },
    { fw: "motor", kinds: ["trace", "maze", "color", "search"], text: "If a tremor makes lines wander, that is fine. Praise the effort and the choosing of colors, not the neatness." },
    /* Montessori: choice, preparation, control of error, slow demonstration */
    { fw: "montessori", kinds: ["any"], text: "Offer {page} with both hands and wait ten slow seconds before helping. Choosing to begin is part of the activity." },
    { fw: "montessori", kinds: ["any"], text: "Let {name} choose the marker or pencil. Choice keeps an adult an adult." },
    { fw: "montessori", kinds: ["sequence", "match", "sort", "ladder"], text: "Show the first step slowly without talking, then pass the pencil over. Demonstrate, then step back." },
    { fw: "montessori", kinds: ["sequence"], text: "The check at the foot of the page, printed upside down, lets {name} see their own result. Never mark it for them." },
    { fw: "montessori", kinds: ["any"], text: "Clear the table of everything except this page and one pencil. A quiet, uncluttered place is part of the activity." },
    { fw: "montessori", kinds: ["orient", "sensory", "color"], text: "Sit beside {name}, not across, so you both look at the same page. Move at their pace." },
    /* validation */
    { fw: "validation", kinds: ["any"], text: "If what {name} says has little to do with {page}, accept the feeling: \"That sounds important to you. Tell me more.\"" },
    { fw: "validation", kinds: ["talk", "complete", "orient"], text: "Do not correct a date, a name or a place. Follow where {name} goes and join them there." },
    { fw: "validation", kinds: ["any"], text: "If {name} becomes upset, set the page aside and keep company. Nothing here needs to be finished." },
    { fw: "validation", kinds: ["talk", "sensory"], text: "Say what you see them feel: \"You look happy about that.\" Naming the feeling helps it settle." },
    /* errorless learning */
    { fw: "errorless", kinds: ["complete", "choose", "anagram", "cross", "ladder"], text: "Point to the right word before {name} tries, so every attempt is a success. Do not ask them to guess." },
    { fw: "errorless", kinds: ["complete", "choose", "cross"], text: "Read the first half aloud and pause. If they do not finish it within ten seconds, say it together." },
    { fw: "errorless", kinds: ["search", "cross", "anagram", "ladder"], text: "If {name} stalls, point to the row or the first letter, never the answer. Any word found counts." },
    { fw: "errorless", kinds: ["match", "sort", "odd"], text: "Cover all but two choices so the answer stands out. Remove an option; do not add a hint that tests them." },
    { fw: "errorless", kinds: ["any"], text: "End on a success. If a page is going badly, switch to something {name} knows well and finish there." },
    /* reminiscence + conversation starters */
    { fw: "reminiscence", kinds: ["talk", "match", "color", "sensory"], topic: true, text: "Conversation starter: ask {name} about {topic}. \"Tell me about\" works better than \"do you remember\"." },
    { fw: "reminiscence", kinds: ["any"], topic: true, text: "Conversation starter: {topic}. Who did it with them, and what did it smell or sound like?" },
    { fw: "reminiscence", kinds: ["talk", "sort", "odd", "match"], topic: true, text: "Conversation starter: while {name} works, mention {topic} as you pass. One short sentence is plenty." },
    { fw: "reminiscence", kinds: ["any"], text: "Ask one open question about {page} and let the answer take as long as it takes. Do not quiz." },
    /* communication */
    { fw: "communication", kinds: ["any"], text: "Approach from the front, say {name}'s name, and use one short sentence at a time." },
    { fw: "communication", kinds: ["any"], text: "Say what you are about to do before you do it, and what you see them doing as they do it." },
    { fw: "communication", kinds: ["any"], text: "Check glasses and hearing aids are in, and that the page is well lit and free of glare." },
    { fw: "communication", kinds: ["talk", "complete", "choose"], text: "Read the page aloud slowly if {name} prefers to listen. Reading aloud is as good as reading." },
    { fw: "communication", kinds: ["any"], text: "Offer, never insist. \"Would you like to look at this with me?\" leaves the decision with them." },
    /* sensory */
    { fw: "sensory", kinds: ["sensory", "orient", "color", "trace"], text: "Offer one thing at a time to touch or smell alongside the page, only if welcomed. Check for allergies first." },
    { fw: "sensory", kinds: ["sensory", "match"], text: "Hold a real object like the one in the picture where {name} can see and feel it. Let them look as long as they like." },
    { fw: "sensory", kinds: ["sensory", "orient", "talk"], text: "Keep the room calm: radio off, one voice, and give a few quiet seconds between each thing you say." },
    { fw: "sensory", kinds: ["sensory", "color", "trace"], text: "Run a finger slowly around the edge of the shape first. Touch makes the picture easier to see." },
    /* environment / ending */
    { fw: "environment", kinds: ["any"], text: "Ten minutes is a good session. Stop while {name} is still enjoying it, whether or not the page is done." },
    { fw: "environment", kinds: ["any"], text: "Seat {name} comfortably with feet flat and the page at forearm height, with a dark table surface under it." },
    /* orientation */
    { fw: "validation", kinds: ["orient"], text: "Talk about the day as news you are sharing, not as a question: \"It is a sunny Tuesday in October.\"" },
    { fw: "montessori", kinds: ["orient"], text: "Let {name} point to or circle the weather themselves. Do not tell them the answer first." }
  ];
  CUES.forEach(Object.freeze);

  /* which cue kinds a page type belongs to */
  var KIND = {
    wordsearch: "search", search: "search", erasearch: "search", "search-large": "search", "word-search": "search",
    crossword: "cross", cross: "cross", ladder: "ladder", anagram: "anagram", scramble: "anagram",
    sorting: "sort", oddone: "odd", odd: "odd", sequence: "sequence", "sequence-cards": "sequence",
    matching: "match", match: "match", assoc: "match", maze: "maze", "maze-motor": "maze", pathtrace: "trace", tracing: "trace",
    orientation: "orient", "orientation-board": "orient", silhouette: "sensory", color: "color", mandala: "color", coloring: "color",
    talk: "talk", lifestory: "talk", era: "talk", trivia: "talk", completion: "complete", complete: "complete", sayings: "complete",
    provhint: "complete", lyric: "complete", choose: "choose", "choose-ending": "choose", staff: "staff",
    /* the Packet Builder's own activities */
    "finish-saying": "complete", "letter-scramble": "anagram", "goes-together": "match", "missing-letters": "complete", "name-three": "talk",
    "memory-lane": "talk", "reminiscence-cards": "talk", "finish-song": "complete", "lyric-sheet": "complete", "singer-match": "match",
    "letter-tracing": "trace", "number-tracing": "trace", "line-tracing": "trace", "silhouette-match": "sensory", "cognicopia-coloring": "color",
    "cognicopia-coloring-library": "color", "chair-yoga": "motor", "beanbag-target": "motor", "seated-rhythm": "motor",
    "number-ladder": "sequence", "alphabet-sweep": "any", "money-count": "any", "mini-sudoku": "any"
  };
  var kindOf = function (activity) { return KIND[activity] || (typeof activity === "string" && /search/.test(activity) ? "search" : "any"); };

  function fill(text, c) {
    c = c || {};
    var name = c.name ? String(c.name) : "them";
    return text.replace(/\{page\}/g, c.page ? "Page " + c.page : "this page").replace(/\{name\}/g, name)
      .replace(/\{topic\}/g, c.topic ? String(c.topic) : "").replace(/\s+([.,!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
  }
  /* One tip for one page. `rng` is a seeded stream (so the tip is the same all day); `avoid` is a list of
     frameworks or ids already used on this packet, so a packet does not say the same thing twice. */
  function cue(o) {
    o = o || {};
    var st = stageOf(o.stage), k = kindOf(o.activity || o.kind), rng = o.rng, used = o.used || [];
    var pool = CUES.filter(function (c) {
      if (c.topic && !o.topic) return false;
      return c.kinds.indexOf("any") >= 0 || c.kinds.indexOf(k) >= 0;
    });
    var fresh = pool.filter(function (c) { return used.indexOf(c.text) < 0; });
    if (fresh.length) pool = fresh;
    /* spread across frameworks: prefer one not used yet on this packet */
    var fws = (o.usedFw || []);
    var varied = pool.filter(function (c) { return fws.indexOf(c.fw) < 0; });
    if (varied.length) pool = varied;
    var c = rng ? rng.pick(pool) : pool[0];
    if (!c) return null;
    var text = fill(c.text, { name: o.name, page: o.page, topic: o.topic });
    if (/^Conversation starter:/.test(text) === false) text = "Clinical Tip: " + text;
    return { fw: c.fw, kind: k, raw: c.text, text: text };
  }
  /* A tip for every page of a packet, none repeated: pages = [{ n, activity, topic }] */
  function cuePlan(pages, stage, rng, ctx) {
    ctx = ctx || {};
    var used = [], usedFw = [], out = {};
    pages.forEach(function (pg) {
      var c = cue({ stage: stage, activity: pg.activity, kind: pg.kind, rng: rng.fork ? rng.fork("cue" + pg.n) : rng, name: ctx.name, page: pg.n, topic: pg.topic, used: used, usedFw: usedFw });
      if (c) { used.push(c.raw); usedFw.push(c.fw); if (usedFw.length >= 5) usedFw = []; out[pg.n] = c; }
    });
    return out;
  }

  /* ---------- the page check ----------
     A "vector page" is { w, h, frame:{x,y,w,h}, items:[{d, fill, w, role}], texts:[{text,x,y,size,bold,align,role,rotate}] }.
     validatePage returns every rule the page breaks (an empty list is a pass). */
  function validatePage(page, stage) {
    var st = stageOf(stage || page.stage), S = STAGES[st], problems = [], F = page.frame || { x: SAFE.edge, y: SAFE.edge, w: SAFE.pageW - 2 * SAFE.edge, h: SAFE.pageH - 2 * SAFE.edge };
    var edge = SAFE.edge;
    (page.items || []).forEach(function (it, i) {
      var floor = it.role === "motor" ? S.stroke.motor : it.role === "shell" ? 2.25 : S.stroke.min;
      if (!(it.w >= floor - 1e-9)) problems.push("shape " + i + " (" + it.role + ") is " + it.w + " pt, under the " + floor + " pt " + st + " floor");
      if (["#fff", "#000", "none"].indexOf(it.fill) < 0) problems.push("shape " + i + " is filled " + it.fill + ": only black and white are allowed");
      if (it.bounds) {
        /* the line down the middle of a stroke stays inside the page maker's space; the stroke itself, with its
           own half width, stays inside the 0.5 in margin. */
        var b = it.bounds, hw = it.w / 2;
        if (b[0] < Math.max(edge, F.x) - 0.6 || b[1] < Math.max(edge, F.y) - 0.6 || b[2] > Math.min(SAFE.pageW - edge, F.x + F.w) + 0.6 || b[3] > Math.min(SAFE.pageH - edge, F.y + F.h) + 0.6)
          problems.push("shape " + i + " (" + it.role + ") leaves its space");
        else if (b[0] - hw < edge - 0.6 || b[1] - hw < edge - 0.6 || b[2] + hw > SAFE.pageW - edge + 0.6 || b[3] + hw > SAFE.pageH - edge + 0.6)
          problems.push("shape " + i + " (" + it.role + ") comes within 0.5 in of the paper's edge");
      }
    });
    (page.texts || []).forEach(function (t, i) {
      var role = t.role || "body", floor = floorFor(st, role), resident = STAFF_ROLES.indexOf(role) < 0 && EXEMPT_ROLES.indexOf(role) < 0;
      if (!(t.size >= floor - 1e-9)) problems.push("the " + role + " text \"" + String(t.text).slice(0, 24) + "\" is " + t.size + " pt, under the " + floor + " pt " + st + " floor");
      if (S.type.bold && resident && !t.bold) problems.push("the " + role + " text \"" + String(t.text).slice(0, 24) + "\" is not bold, and the " + st + " stage prints bold");
      if (t.x < F.x - 0.6 && t.align !== "right" || t.x > F.x + F.w + 0.6 && t.align !== "left") problems.push("the text \"" + String(t.text).slice(0, 24) + "\" starts outside its space");
      if (t.y > F.y + F.h + 0.6 || t.y < F.y - 0.6) problems.push("the text \"" + String(t.text).slice(0, 24) + "\" sits outside its space");
      if (resident && lintText(t.text).length) problems.push("the text \"" + String(t.text).slice(0, 30) + "\" breaks the dignity rule: " + lintText(t.text).join(", "));
    });
    return problems;
  }

  /* ---------- the older page tables ----------
     The packet tool keeps its own count table (grid size, words, prompts per stage). constrainLegacy clamps
     it to what the matrix allows, so one rulebook governs both. Returns what it changed. */
  function constrainLegacy(table) {
    var changed = [];
    ["early", "middle", "late"].forEach(function (st) {
      var t = table[st], L = STAGES[st].limits;
      if (!t) return;
      var clamp = function (key, max) { if (typeof t[key] === "number" && max > 0 && t[key] > max) { changed.push(st + "." + key + ": " + t[key] + " -> " + max); t[key] = max; } };
      clamp("grid", Math.max.apply(null, L.wordsearch.sizes));
      clamp("crossSize", L.crossword.max);
      clamp("crossN", L.crossword.words[1]);
      clamp("words", L.wordsearch.words[1]);
      if (st !== "early" && t.dirs && t.dirs.length > L.wordsearch.dirs) { changed.push(st + ".dirs: " + t.dirs.length + " -> " + L.wordsearch.dirs); t.dirs = t.dirs.slice(0, L.wordsearch.dirs); }
    });
    return changed;
  }

  /* ---------- the shell ----------
     What every printed page carries, in points from the top-left of a US Letter page: the resident's name, the date
     and the wing in the header; one clinical tip for the person beside them; the page count in the foot. All of it
     is pure black. The header sits in the top margin and the foot in the bottom one, both inside the 0.5 in the
     printer cannot reach, so the room for a page's own content is the body: 64 to 706 pt. */
  var SHELL = Object.freeze({
    left: SAFE.left, right: SAFE.pageW - SAFE.right,
    header: Object.freeze({ y: 47, ruleY: 52, name: 13, date: 12, rule: 3 }),
    body: Object.freeze({ top: 64, bottom: 706 }),
    tip: Object.freeze({ size: 10, lead: 12, y: 719, lines: 2 }),
    footer: Object.freeze({ ruleY: 738, y: 753, size: 10, page: 12, rule: 2.25 })
  });
  function headerParts(o) {
    o = o || {};
    var P = PCG.prng, iso = o.date != null ? P.dateParts(o.date) : P.today();
    var d = new Date(Date.UTC(iso.y, iso.m - 1, iso.d)), days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var label = days[d.getUTCDay()] + ", " + months[iso.m - 1] + " " + iso.d + ", " + iso.y;
    var wing = String(o.wing || "").trim().slice(0, 40);
    return { name: String(o.name || "").trim(), date: label, short: months[iso.m - 1].slice(0, 3) + " " + iso.d + ", " + iso.y, wing: wing, right: label + (wing ? "  ·  " + wing : "") };
  }
  /* The season for a date: the northern hemisphere unless told otherwise (the time zone names a southern one). */
  var SOUTHERN_ZONES = /^(Australia|Antarctica|Pacific\/(Auckland|Fiji|Tongatapu|Apia|Norfolk|Chatham)|America\/(Argentina|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz|Lima|Bogota)|Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone|Maseru|Mbabane)|Indian\/(Mauritius|Reunion|Antananarivo))/;
  function southern(tz) {
    try { tz = tz || (root.Intl && Intl.DateTimeFormat().resolvedOptions().timeZone) || ""; } catch (e) { tz = ""; }
    return SOUTHERN_ZONES.test(tz) && !/^America\/(Bogota|Lima)/.test(tz);
  }
  function seasonOf(month, south) {   // month 1-12
    var n = month === 12 || month <= 2 ? "winter" : month <= 5 ? "spring" : month <= 8 ? "summer" : "fall";
    if (!south) return n;
    return { winter: "summer", summer: "winter", spring: "fall", fall: "spring" }[n];
  }

  root.CognicopiaClinicalMatrix = Object.freeze({
    VERSION: VERSION, SAFE: SAFE, STAGES: STAGES, SHELL: SHELL, ACTIVITIES: ACTIVITIES, DOMAIN_LABEL: DOMAIN_LABEL, CUES: CUES,
    STAFF_FLOOR: STAFF_FLOOR, RESIDENT_ROLES: RESIDENT_ROLES, STAFF_ROLES: STAFF_ROLES,
    stageOf: stageOf, builderLevel: builderLevel, rules: rules, floorFor: floorFor, typeSize: typeSize,
    allowed: allowed, why: why, activitiesFor: activitiesFor, entry: entry, suggested: suggested, SUGGESTED: SUGGESTED,
    dignity: Object.freeze({ lint: lintText, clean: cleanText, adultSubject: adultSubject, RULES: DIGNITY, ADULT_CATEGORIES: ADULT_CATEGORIES }),
    dailyRng: dailyRng, dateIso: dateIso, cue: cue, cuePlan: cuePlan, kindOf: kindOf, validatePage: validatePage, constrainLegacy: constrainLegacy,
    headerParts: headerParts, seasonOf: seasonOf, southern: southern
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
