/* =====================================================================
   Cognicopia Clinical Matrix (Rulebook)
   src/engine/ClinicalMatrix.js

   Runs in browser and Node.js.
   Enforces type floors, stroke floors, stage constraints, adult dignity
   linting, daily deterministic seeded PRNG, reasonings (why), and page validation.
   Zero network requests, zero persistent external tracking.
   ===================================================================== */
(function(root) {
  "use strict";

  const VERSION = "1.0.0";

  const STAGES = {
    early: {
      id: "early",
      label: "Early stage (MCI)",
      name: "Early Stage (GDS 3-4 / MCI)",
      type: { floor: 14, title: 20, instruction: 16, body: 14, label: 14, clue: 14, word: 14, bold: false },
      stroke: { min: 2.25, art: 2.5, rule: 2.25, motor: 2.5 },
      limits: { wordsearch: { sizes: [12, 15] } }
    },
    middle: {
      id: "middle",
      label: "Middle stage (Moderate)",
      name: "Middle Stage (GDS 5 / Moderate)",
      type: { floor: 18, title: 22, instruction: 18, body: 18, label: 18, clue: 18, word: 18, bold: false },
      stroke: { min: 3.0, art: 3.5, rule: 3.0, motor: 3.5 },
      limits: { wordsearch: { sizes: [8, 8] } }
    },
    late: {
      id: "late",
      label: "Late stage (Advanced)",
      name: "Late Stage (GDS 6-7 / Advanced)",
      type: { floor: 24, title: 26, instruction: 24, body: 24, label: 24, clue: 24, word: 24, bold: true },
      stroke: { min: 4.5, art: 6.0, rule: 4.5, motor: 6.0 },
      limits: { wordsearch: { sizes: [] } }
    }
  };

  const SAFE = {
    edge: 36,
    top: 36,
    bottom: 36,
    left: 54,
    right: 54
  };

  const SHELL = {
    left: 54,
    right: 54,
    header: { y: 48, rule: 3.0, ruleY: 54, name: 13, date: 11 },
    body: { top: 64, bottom: 690 },
    tip: { y: 700, size: 10, lead: 12 },
    footer: { y: 756, ruleY: 746, rule: 2.25, size: 9.5, page: 10 }
  };

  function stageOf(s) {
    if (!s) return "middle";
    const str = String(s).toLowerCase().trim();
    if (str.indexOf("early") >= 0 || str.indexOf("mci") >= 0 || str === "gds3" || str === "gds4") return "early";
    if (str.indexOf("late") >= 0 || str.indexOf("adv") >= 0 || str === "gds6" || str === "gds7") return "late";
    return "middle";
  }

  function floorFor(s) {
    const st = stageOf(s);
    return STAGES[st] ? STAGES[st].type.floor : 14;
  }

  /* Activity permissions matrix */
  const ACTIVITIES = {
    "search-large": { early: true, middle: false, late: false, tools: ["packet", "builder"], name: "Large Word Search" },
    "search-guided": { early: false, middle: true, late: true, tools: ["packet", "builder"], name: "Guided Word Search" },
    "word-search": { early: true, middle: true, late: false, tools: ["builder"], name: "Word Search" },
    "wordsearch": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Word Search" },
    "erasearch": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Era Word Search" },
    "crossword": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Mini Crossword" },
    "ladder": { early: true, middle: false, late: false, tools: ["packet", "builder"], name: "Word Ladder" },
    "anagram": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Anagram & Clues" },
    "scramble": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Word Scramble" },
    "sorting": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Two-Group Sorting" },
    "oddone": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Odd One Out" },
    "odd": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Odd One Out" },
    "trivia": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Trivia" },
    "clocks": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Clock Reading" },
    "coins": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Coin Counting" },
    "sequence": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Sequence Steps" },
    "choose-ending": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Complete the Phrase" },
    "match": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Picture Matching" },
    "matching": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Picture Matching" },
    "assoc": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Word Association" },
    "maze": { early: true, middle: true, late: true, tools: ["builder"], name: "Tactile Maze" },
    "maze-motor": { early: true, middle: true, late: true, tools: ["builder"], name: "Tactile Maze" },
    "pathtrace": { early: false, middle: true, late: true, tools: ["packet", "builder"], name: "Path Tracing" },
    "orientation": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Orientation & Calendar" },
    "silhouette": { early: false, middle: true, late: true, tools: ["packet", "builder"], name: "Focus Silhouette" },
    "color": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Coloring Sheet" },
    "mandala": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Mandala Art" },
    "colornum": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Color by Number" },
    "talk": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Conversation Starters" },
    "lifestory": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Life Story" },
    "people": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Famous People" },
    "era": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Down Memory Lane" },
    "rather": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Would You Rather" },
    "name": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Name Three" },
    "sayings": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Familiar Sayings" },
    "provhint": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Proverbs" },
    "career": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Trades & Careers" },
    "language": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Foreign Words" },
    "bingo": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Picture Bingo" },
    "tracing": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Name Tracing" },
    "dots": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Dot-to-Dot" },
    "task": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Daily Routines" },
    "games": { early: true, middle: true, late: false, tools: ["packet", "builder"], name: "Two-Player Games" },
    "lyric": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Song Lyrics" },
    "popculture": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Golden Era Hits" },
    "notes": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Care Notes" },
    "facsupport": { early: true, middle: true, late: true, tools: ["packet", "builder"], name: "Staff Sheet" }
  };

  const FRIENDLY_NAMES = {
    "talk": "Conversation Starters",
    "lifestory": "Life Story",
    "people": "Famous People",
    "era": "Down Memory Lane",
    "trivia": "Trivia",
    "rather": "Would You Rather",
    "name": "Name Three",
    "sayings": "Familiar Sayings",
    "provhint": "Proverbs",
    "choose-ending": "Complete the Phrase",
    "match": "Picture Matching",
    "matching": "Picture Matching",
    "assoc": "Word Association",
    "odd": "Odd One Out",
    "oddone": "Odd One Out",
    "sorting": "Category Sorting",
    "career": "Trades & Careers",
    "language": "Foreign Words",
    "orientation": "Today's Orientation",
    "wordsearch": "Word Search",
    "erasearch": "Era Word Search",
    "search-large": "Large Word Search",
    "search-guided": "Guided Word Search",
    "crossword": "Mini Crossword",
    "ladder": "Word Ladder",
    "anagram": "Anagrams",
    "scramble": "Word Scramble",
    "bingo": "Picture Bingo",
    "tracing": "Name Tracing",
    "clocks": "Clock Reading",
    "coins": "Coin Counting",
    "dots": "Dot-to-Dot",
    "color": "Coloring Sheet",
    "mandala": "Mandala Art",
    "silhouette": "Focus Silhouette",
    "colornum": "Color by Number",
    "task": "Daily Routines",
    "games": "Two-Player Games",
    "maze": "Tactile Maze",
    "maze-motor": "Tactile Maze",
    "pathtrace": "Path Tracing",
    "sequence": "Sequence Steps",
    "lyric": "Song Lyrics",
    "popculture": "Golden Era Hits",
    "notes": "Care Notes",
    "facsupport": "Staff Sheet"
  };

  function allowed(stage, kind, tool) {
    const st = stageOf(stage);
    const act = ACTIVITIES[kind];
    if (!act) {
      if (kind === "word-search" && st === "late") return false;
      if (st === "late" && (kind === "maze-motor" || kind === "orientation" || kind === "silhouette")) return true;
      return true;
    }
    if (tool && act.tools && act.tools.indexOf(tool) < 0) return false;
    return !!act[st];
  }

  function entry(tool, id) {
    const act = ACTIVITIES[id];
    const name = (act && act.name) || FRIENDLY_NAMES[id] || id;
    if (!act) {
      return { id, name, tool: tool || "all", stages: { early: true, middle: true, late: false } };
    }
    return {
      id,
      name,
      tool: tool || "all",
      stages: { early: !!act.early, middle: !!act.middle, late: !!act.late }
    };
  }

  function suggested(stage, tool) {
    const st = stageOf(stage);
    const result = [];
    for (const [id, cfg] of Object.entries(ACTIVITIES)) {
      if (cfg[st]) {
        if (!tool || !cfg.tools || cfg.tools.indexOf(tool) >= 0) {
          result.push(id);
        }
      }
    }
    return result;
  }

  const REASONS = {
    "crossword": {
      middle: "Crossword intersections require multi-directional word puzzle recall that causes fatigue.",
      late: "Crossword grids are not offered at the late stage to prevent cognitive strain."
    },
    "wordsearch": {
      late: "Word searches are replaced by single-focus or guided activities at the late stage."
    },
    "erasearch": {
      late: "Era word searches exceed the visual scanning floor at the late stage."
    },
    "search-large": {
      middle: "Large 12-15 square word searches are replaced by 8-square guided searches at the middle stage.",
      late: "Word search grids exceed the visual scanning floor at the late stage."
    },
    "search-guided": {
      early: "Guided word search is optimized for middle and late stages."
    },
    "ladder": {
      middle: "Word ladders require multi-step letter transformations that cause fatigue at middle stage.",
      late: "Word ladders require working memory recall beyond the late-stage floor."
    },
    "anagram": {
      late: "Letter anagrams require abstract rearrangement that causes frustration at the late stage."
    },
    "scramble": {
      middle: "Unscrambling words without first-letter cues causes unnecessary frustration.",
      late: "Word scrambles are not offered at the late stage."
    },
    "sorting": {
      late: "Multi-item sorting grids are simplified to single-subject focus at the late stage."
    },
    "trivia": {
      late: "Fact recall can feel like a test; open-ended reminiscence is used instead."
    },
    "clocks": {
      late: "Clock-reading tasks can trigger anxiety; sensory art is preferred."
    },
    "coins": {
      late: "Coin counting requires multi-step math that can cause fatigue."
    },
    "dots": {
      late: "Dot-to-dot sequences can be difficult to track with tremor or visual field changes."
    },
    "oddone": {
      late: "Odd-one-out discrimination tasks are replaced by calming single-subject art at the late stage."
    },
    "odd": {
      late: "Odd-one-out discrimination tasks are replaced by calming single-subject art at the late stage."
    },
    "pathtrace": {
      early: "Path tracing is designed as a motor and tactile focus activity for middle and late stages."
    },
    "silhouette": {
      early: "High-contrast iconic silhouettes are tailored for middle and late sensory engagement."
    }
  };

  function why(stage, id, tool) {
    const st = stageOf(stage);
    if (REASONS[id] && REASONS[id][st]) {
      return REASONS[id][st];
    }
    const sLabel = STAGES[st] && STAGES[st].label ? STAGES[st].label.split(" ")[0].toLowerCase() : st;
    return `Not offered at the ${sLabel} level to avoid fatigue, preserve dignity, and ensure errorless success.`;
  }

  function constrainLegacy(table) {
    if (!table) return;
    if (table.early) {
      if (!table.early.dirs) table.early.dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    }
    if (table.middle) {
      if (table.middle.grid > 8) table.middle.grid = 8;
      table.middle.dirs = [[1, 0], [0, 1]];
      if (table.middle.words > 7) table.middle.words = 7;
    }
    if (table.late) {
      if (table.late.grid > 7) table.late.grid = 7;
      table.late.dirs = [[1, 0], [0, 1]];
      if (table.late.words > 5) table.late.words = 5;
    }
    return table;
  }

  /* Adult Dignity Filter */
  const BANNED_PATTERNS = [
    { id: "memory-quiz", re: /do you remember|test your memory|can you recall|did you forget/i },
    { id: "infantilizing", re: /\bgood (girl|boy)\b|\bsweetie\b|\bsweetheart\b|\bdearie\b|\bhoney\b/i },
    { id: "punitive-eval", re: /which answer is wrong|wrong answer|you failed|score:|\bincorrect\b/i },
    { id: "baby-talk", re: /\bkiddie\b|\btoddler\b|\bplaytime\b|\bdaycare\b/i }
  ];

  const dignity = {
    lint: function(text) {
      if (!text || typeof text !== "string") return [];
      const issues = [];
      for (const b of BANNED_PATTERNS) {
        if (b.re.test(text)) {
          issues.push(b.id);
        }
      }
      return issues;
    }
  };

  /* Seeded Deterministic PRNG */
  function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function dailyRng(name, date, variant, salt) {
    const seedStr = `${String(name || "").trim().toLowerCase()}|${String(date || "").trim()}|${variant || 0}|${salt || ""}`;
    let state = hashString(seedStr) || 123456789;

    function next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return ((state >>> 0) / 4294967296);
    }

    return {
      next,
      range: (min, max) => min + Math.floor(next() * (max - min + 1)),
      choice: arr => arr[Math.floor(next() * arr.length)]
    };
  }

  function headerParts(opts) {
    const name = opts && opts.name ? String(opts.name).trim() : "";
    const date = opts && opts.date ? String(opts.date).trim() : "";
    const wing = opts && opts.wing ? String(opts.wing).trim() : "";
    const nameText = name ? "Prepared especially for " + name : "Name: ______________________";
    const right = [wing, date].filter(Boolean).join("  ·  ");
    return { name: nameText, right };
  }

  const CLINICAL_TIPS = [
    "Clinical Tip: Offer, never insist. Follow the resident's natural rhythm.",
    "Clinical Tip: Sit beside them at eye level. Share in the activity together.",
    "Clinical Tip: Validate memories as they emerge. Listen more than you speak.",
    "Clinical Tip: Encourage tactile exploration. Point out familiar themes gently.",
    "Clinical Tip: Praise effort and presence, not speed or precision."
  ];

  function cue(opts) {
    const picker = opts && opts.rng ? opts.rng : dailyRng(opts && opts.name, "", 0, "tips");
    const tipText = CLINICAL_TIPS[Math.floor(picker.next() * CLINICAL_TIPS.length)];
    return { text: tipText };
  }

  function cuePlan(list, stage, rng, opts) {
    const plan = {};
    if (!list || !Array.isArray(list)) return plan;
    const picker = rng || dailyRng(opts && opts.name, "", 0, "tips");
    list.forEach(item => {
      const tipText = CLINICAL_TIPS[Math.floor(picker.next() * CLINICAL_TIPS.length)];
      plan[item.n] = { text: tipText };
    });
    return plan;
  }

  function validatePage(page) {
    const issues = [];
    if (!page) return ["No page provided"];
    const st = stageOf(page.stage || "middle");
    const sRule = STAGES[st];

    if (page.texts && Array.isArray(page.texts)) {
      for (const t of page.texts) {
        if (t.size < sRule.type.floor - 0.01 && t.role !== "shell" && t.role !== "tip") {
          issues.push(`Text '${t.text}' size ${t.size}pt is below floor ${sRule.type.floor}pt`);
        }
        if (sRule.type.bold && !t.bold && t.role !== "shell" && t.role !== "tip") {
          issues.push(`Text '${t.text}' is not bold at late stage`);
        }
        const dign = dignity.lint(t.text);
        if (dign.length > 0) {
          issues.push(`Text '${t.text}' broke dignity rule: ${dign.join(", ")}`);
        }
      }
    }

    if (page.items && Array.isArray(page.items)) {
      for (const it of page.items) {
        if (it.role !== "fill" && it.role !== "shell" && it.w !== undefined && it.w < sRule.stroke.min - 0.01) {
          issues.push(`Item stroke ${it.w}pt is below min ${sRule.stroke.min}pt`);
        }
      }
    }

    return issues;
  }

  const CognicopiaClinicalMatrix = {
    VERSION,
    STAGES,
    SAFE,
    SHELL,
    stageOf,
    floorFor,
    allowed,
    entry,
    suggested,
    why,
    cue,
    constrainLegacy,
    dignity,
    dailyRng,
    headerParts,
    cuePlan,
    validatePage
  };

  root.CognicopiaClinicalMatrix = CognicopiaClinicalMatrix;

})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this));
