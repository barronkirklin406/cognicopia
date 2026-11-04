/* Cognicopia reminiscence engine (Agent 4).

   Makes the three-part reminiscence asset for the Personalized Packet Tool on the Today page:
     1. the Resident Memory Sheet: a word search made from their own words, a few "fun to know" notes from their years, and
        things that go together. Nothing on it asks them to recall a fact or marks an answer wrong;
     2. the three-step facilitation protocol: Visual Cue, Verbal Anchor, Validation Statement, with staff notes;
     3. the validation therapy safety notice: affirm the resident's lived reality, never debate historical facts.

   It plugs into the agent orchestrator as a local template ("reminiscence") and a small analyze-stage agent, so the clinical
   audit and the print preview see exactly what it makes. It also builds the "Deep Packet Customization" panel.

   Offline by design: no network call, no storage. What staff type here is used to make one sheet in this browser and nothing
   is kept. The curated era data in assets/services/reminiscenceEngine.js (CogniReminiscence) is used when the page has loaded
   it, and the engine works without it. */

import { CognicopiaAgent, builtinTemplate, avoidMatcher } from "./agent-orchestrator.js";
import { SAFETY_NOTICE } from "./clinical-audit-agent.js";

export const VERSION = "1.0.0";
export const TEMPLATE_NAME = "reminiscence";
export { SAFETY_NOTICE };

/* ---------- small helpers ---------- */
const clean = (v, n = 80) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f{}<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const listOf = (v, n = 80, max = 8) => {
  const raw = Array.isArray(v) ? v : String(v == null ? "" : v).split(/[,;\n]/), seen = new Set(), out = [];
  for (const x of raw) { const t = clean(x, n), k = t.toLowerCase(); if (t && !seen.has(k)) { seen.add(k); out.push(t); } if (out.length >= max) break; }
  return out;
};
/* A small seeded random source: the same seed always gives the same sheet, a new seed gives a different one. */
export function seeded(seed) {
  let h = 2166136261; const s0 = String(seed);
  for (let i = 0; i < s0.length; i++) { h ^= s0.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffled = (a, r) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
export const toLetters = (w) => String(w == null ? "" : w).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z]/g, "").toUpperCase();

/* ---------- deep customization: what staff may add ---------- */
export const FOCUS = Object.freeze({ mixed: "A mix, closest to them first", family: "Family and friends", work: "Their working life", home: "Home, kitchen and garden", music: "Music and dancing", seasons: "The seasons and holidays" });
export const INCLUDE_KEYS = Object.freeze([["wordSearch", "A word search from their own words"], ["sparks", "A few notes from their years, just for fun"], ["matching", "Things that go together"]]);

export function normalizeDeep(raw) {
  const r = raw && typeof raw === "object" ? raw : {}, inc = r.include && typeof r.include === "object" ? r.include : {};
  const on = (k) => inc[k] === undefined ? true : !!inc[k];
  const staff = String(r.staffNotes == null ? "" : r.staffNotes).split(/\n+/).map((l) => clean(l, 140)).filter(Boolean).slice(0, 4);
  return {
    focus: Object.prototype.hasOwnProperty.call(FOCUS, r.focus) ? r.focus : "mixed",
    themeWords: listOf(r.themeWords, 24, 8),   // words for the season or the holiday, not about anyone, so a group sheet may use them
    notes: listOf(r.notes, 140, 4).filter((n) => !/\?\s*$/.test(n)),   // extra "fun to know" lines, such as a season's; never a question
    music: listOf(r.music, 80, 4), foods: listOf(r.foods, 60, 4), places: listOf(r.places, 60, 4), words: listOf(r.words, 24, 8),
    include: { wordSearch: on("wordSearch"), sparks: on("sparks"), matching: on("matching") },
    staffNotes: staff, variant: Math.max(0, Math.min(999, Math.floor(Number(r.variant) || 0)))
  };
}

/* ---------- the word search ---------- */
const FILLER = "AEIOUAEIORSTLNDHCMPBGFYWKV";
/* Strings a random fill must never spell, in any direction. A word search should never put a hurtful word in front of someone. */
const UNWELCOME = Object.freeze(["ASS", "SEX", "DIE", "DIED", "KILL", "DEAD", "DEATH", "HELL", "WAR", "GUN", "JAIL", "SICK", "HATE", "FEAR", "BOMB", "SHOT", "TOMB", "CRY", "PAIN", "ILL", "OLD", "DEMENTIA", "LOST", "FAIL", "STUPID", "DUMB", "BAD", "SAD", "WAIL", "GRAVE", "LOSS", "HURT"]);
const DIRS = Object.freeze([[0, 1], [1, 0]]);      // across (left to right) and down (top to bottom): nothing backward or diagonal, so no word is hard to find

function unwelcomeIn(grid, size, locked) {
  const lines = [];
  for (let r = 0; r < size; r++) lines.push(grid[r].map((c, i) => [c, r * size + i]));
  for (let c = 0; c < size; c++) lines.push(grid.map((row, r) => [row[c], r * size + c]));
  for (const line of lines) {
    const fw = line.map((x) => x[0]).join(""), bw = fw.split("").reverse().join("");
    for (const w of UNWELCOME) for (const [s, rev] of [[fw, false], [bw, true]]) {
      let at = s.indexOf(w);
      while (at >= 0) {
        const cells = []; for (let k = 0; k < w.length; k++) cells.push(line[rev ? s.length - 1 - (at + k) : at + k][1]);
        if (!cells.every((c) => locked.has(c))) return true;      // a match made only of the deliberate words is theirs to keep; one that uses fill letters is not
        at = s.indexOf(w, at + 1);
      }
    }
  }
  return false;
}
export function buildWordSearch(words, opts = {}) {
  const size = Math.max(1, Math.min(30, Math.floor(opts.size) || 8)), seed = opts.seed == null ? "1" : opts.seed, rnd = seeded("ws|" + seed);
  const seen = new Set(), pool = [];
  (words || []).forEach((w) => { const L = toLetters(w); if (L.length >= 3 && L.length <= size && !seen.has(L)) { seen.add(L); pool.push({ shown: L, L }); } });
  const maxWords = Math.max(1, opts.max || 6);
  const order = pool.slice(0, maxWords + 2).sort((a, b) => b.L.length - a.L.length);   // long words first: they are the hardest to fit
  const grid = Array.from({ length: size }, () => Array(size).fill("")), placed = [], skipped = [];
  for (const w of order) {
    if (placed.length >= maxWords) { skipped.push(w.L); continue; }
    const spots = [];
    for (const [dr, dc] of DIRS) for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      const er = r + dr * (w.L.length - 1), ec = c + dc * (w.L.length - 1);
      if (er >= size || ec >= size) continue;
      let ok = true; for (let k = 0; k < w.L.length && ok; k++) { const cell = grid[r + dr * k][c + dc * k]; if (cell && cell !== w.L[k]) ok = false; }
      if (ok) spots.push([r, c, dr, dc]);
    }
    if (!spots.length) { skipped.push(w.L); continue; }
    const [r, c, dr, dc] = spots[Math.floor(rnd() * spots.length)];
    for (let k = 0; k < w.L.length; k++) grid[r + dr * k][c + dc * k] = w.L[k];
    placed.push({ word: w.L, row: r, col: c, dir: dr ? "down" : "across" });
  }
  const locked = new Set(); placed.forEach((p) => { for (let k = 0; k < p.word.length; k++) locked.add((p.row + (p.dir === "down" ? k : 0)) * size + p.col + (p.dir === "across" ? k : 0)); });
  let final = null;
  for (let attempt = 0; attempt < 400 && !final; attempt++) {
    const fr = seeded("fill|" + seed + "|" + attempt), g = grid.map((row) => row.map((ch) => ch || FILLER[Math.floor(fr() * FILLER.length)]));
    if (!unwelcomeIn(g, size, locked)) final = g;
  }
  if (!final) { const alt = "AEIOU"; final = grid.map((row, r) => row.map((ch, c) => ch || alt[(r * 3 + c) % 5])); }   // a vowel-only fill cannot spell any word in the list
  return { size, grid: final.map((row) => row.join("")), words: placed.map((p) => p.word), placed, skipped };
}
/* A word search is always as many columns as rows: 1 x 1, 2 x 2 ... 20 x 20 and on. */
export const isSquareGrid = (grid) => Array.isArray(grid) && grid.length > 0 && grid.every((r) => String(r).length === grid.length);
/* Is every listed word really in the grid, across or down? The tests and the sheet builder both lean on this. */
export function findInGrid(grid, word) {
  const g = (grid || []).map((r) => String(r)), n = g.length, w = toLetters(word);
  if (!w || !n) return false;
  for (let r = 0; r < n; r++) if (g[r].includes(w)) return true;
  for (let c = 0; c < n; c++) { const col = g.map((row) => row[c] || "").join(""); if (col.includes(w)) return true; }
  return false;
}

/* ---------- things that go together ---------- */
const PAIR_POOLS = Object.freeze({
  kitchen: [["Salt", "Pepper"], ["Bread", "Butter"], ["Cup", "Saucer"], ["Milk", "Cookies"], ["Knife", "Fork"], ["Pot", "Lid"]],
  garden: [["Seed", "Soil"], ["Flower", "Vase"], ["Bee", "Hive"], ["Rake", "Leaves"], ["Watering can", "Flowers"], ["Apple", "Tree"]],
  craft: [["Needle", "Thread"], ["Yarn", "Knitting needles"], ["Pencil", "Paper"], ["Scissors", "Paper"], ["Button", "Coat"], ["Paint", "Brush"]],
  tools: [["Hammer", "Nail"], ["Key", "Lock"], ["Nut", "Bolt"], ["Brush", "Paint"], ["Saw", "Wood"], ["Pen", "Paper"]],
  home: [["Sock", "Shoe"], ["Pillow", "Blanket"], ["Soap", "Water"], ["Hat", "Coat"], ["Table", "Chair"], ["Lamp", "Lampshade"]]
});
const POOL_CUES = Object.freeze([["garden", /garden|flower|plant|bird|seed|farm/i], ["craft", /sew|knit|crochet|quilt|craft|paint|draw|embroider/i], ["kitchen", /cook|bak|kitchen|recipe|pie|food|cafe|restaurant/i], ["tools", /carpent|mechanic|build|repair|tool|machin|plumb|electric|work ?shop/i]]);
export function pairPoolFor(profile, deep) {
  if (deep && deep.focus === "home") return "kitchen";
  if (deep && deep.focus === "work") return "tools";
  const text = [profile && profile.career, ...(profile && profile.preferences || []), ...(deep && deep.foods || [])].join(" ");
  for (const [pool, re] of POOL_CUES) if (re.test(text)) return pool;
  return "mixed";
}
export function matchingItems(count, opts = {}) {
  const rnd = seeded("match|" + (opts.seed == null ? "1" : opts.seed)), ok = typeof opts.fine === "function" ? opts.fine : () => true;
  const own = PAIR_POOLS[opts.pool] || [], all = Object.values(PAIR_POOLS).flat();
  const want = [...shuffled(own, rnd), ...shuffled(all.filter((p) => !own.includes(p)), rnd)].filter((p) => ok(p[0]) && ok(p[1]));
  const items = []; const used = new Set();
  for (const [left, right] of want) { if (items.length >= count) break; if (used.has(left) || used.has(right)) continue; used.add(left); used.add(right); items.push({ left, right }); }
  /* The right column is shuffled so it is not simply the same order, and never left exactly as it was. */
  const rights = items.map((i) => i.right); let order = shuffled(rights, rnd), guard = 0;
  while (items.length > 1 && order.every((r, i) => r === rights[i]) && guard++ < 10) order = shuffled(rights, rnd);
  return { items, rightOrder: order };
}

/* ---------- fun to know: notes from their years ---------- */
export const ERA_SPARKS = Object.freeze({
  "1940s": ["Families often gathered around the radio in the evening to hear their favorite programs.", "Big-band music filled dance halls and living rooms.", "Backyard vegetable gardens were a source of pride in many neighborhoods.", "Letters written by hand were kept in a drawer for years.", "Train travel took families to visit relatives far away."],
  "1950s": ["Television sets became a new piece of furniture in the living room.", "Soda fountains served milkshakes and ice cream sodas.", "A drive-in theater was a favorite evening out.", "Rock and roll came over the radio and out of the jukebox.", "A Sunday drive was a favorite family outing."],
  "1960s": ["Transistor radios could go anywhere, even to the beach.", "Folk songs and Motown filled the radio.", "Family comedies were a television favorite.", "A record player in the living room played the family's favorite albums.", "Many families gathered for a big Sunday dinner."],
  "1970s": ["Station wagons carried families on summer road trips.", "Crocheted afghans and macramé plant hangers decorated many homes.", "A stereo with a stack of records was the center of many living rooms.", "Color television was a family event in the evening.", "Bell-bottom pants were in style."],
  "1980s": ["Cassette tapes made it easy to carry favorite songs along.", "Video rental stores let families pick a movie for the evening.", "The shopping mall was a popular place to meet friends.", "Many families brought home their first microwave oven.", "Compact discs began to appear in music shops."],
  "mixed": ["Music on the radio has long been a way for people to gather.", "A home-cooked meal brings people to the same table.", "Gardens and flowers mark the turning of the seasons.", "A familiar song can feel like an old friend.", "Many families keep a favorite recipe that has been passed along."]
});
const FOCUS_SPARK_CUES = Object.freeze({ music: /music|song|radio|record|tape|band|dance|jukebox|stereo/i, home: /kitchen|home|garden|living room|crochet|macram|dinner|meal|recipe/i, family: /famil|gather|neighbor|friends|dinner/i });
export function sparksFor(era, count, opts = {}) {
  const rnd = seeded("spark|" + (opts.seed == null ? "1" : opts.seed)), ok = typeof opts.fine === "function" ? opts.fine : () => true;
  let pool = shuffled(ERA_SPARKS[era] || ERA_SPARKS.mixed, rnd).filter(ok);
  const cue = FOCUS_SPARK_CUES[opts.focus]; if (cue) pool = [...pool.filter((s) => cue.test(s)), ...pool.filter((s) => !cue.test(s))];
  return pool.slice(0, Math.max(0, count));
}

/* ---------- does the resident page fit one printed page? ---------- */
/* A Letter page is 1056 px tall; the content starts about 160 px down (heading, subtitle, rule) and must end 72 px above the
   bottom (0.75 in). That leaves about 824 px, and a facility's header band can take about 58 more, so the budget would be 745 on screen; in print the footer line follows the content instead of sitting at the bottom, which takes about 46 px more, so it is 695.
   The estimate is checked against the drawn page by the browser test, in every stage, with and without a header band. */
export const PAGE_BUDGET_PX = 695;
const FONT_PT = Object.freeze({ 1: 18, 2: 20, 3: 24 });
export function estimateBlocksPx(blocks, fontPx) {
  const line = fontPx * 1.35, textW = 672, perLine = (w, bold) => Math.max(6, Math.floor(w / (fontPx * (bold ? 0.6 : 0.44))));
  const titleH = (b) => b.title ? Math.ceil(String(b.title).length / perLine(textW, true)) * fontPx * 1.05 * 1.35 + 6 : 0;
  let total = 0;
  for (const b of blocks) {
    let h = titleH(b) + 14;
    if (b.type === "anchors") h += Math.max(0, ...(b.items || []).map((i) => Math.ceil(String(i).length / perLine(textW / 3 - 32, true)) * line + 28));
    else if (b.type === "note") h += Math.ceil(String(b.text || "").length / perLine(textW)) * line;
    else if (b.type === "prompts") h += (b.items || []).reduce((s, i) => s + Math.ceil(String(i).length / perLine(textW - fontPx * 1.2)) * line + 6, 0);
    else if (b.type === "matching") { const cw = textW / 2 - 40; h += (b.items || []).reduce((s, p) => s + Math.max(Math.ceil(String(p.left).length / perLine(cw)), Math.ceil(String(p.right).length / perLine(cw))) * line + 10, 0); }
    else if (b.type === "wordsearch") {
      const cell = b.cellPx || 30; let x = 0, rows = 1;
      (b.words || []).forEach((w) => { const ww = String(w).length * fontPx * 0.7 + 18; if (x + ww > textW) { rows++; x = 0; } x += ww; });
      h += (b.grid || []).length * cell + 10 + rows * line + (rows - 1) * 6;
    }
    total += h;
  }
  return total;
}

/* ---------- the template ---------- */
function curatedSensory(profile, tier) {
  const R = typeof globalThis !== "undefined" ? globalThis.CogniReminiscence : null;
  if (!R || typeof R.deck !== "function" || !profile.era) return null;
  try {
    const birthYear = parseInt(profile.era, 10) - 5;        // the era is the decade they were about 15, so this is only a close guess, which is all the engine's own "bump" needs
    const res = R.deck({ id: "local", tier1_core: { preferredName: "", cognitiveTier: tier, topicsToAvoid: { topics: [] } }, tier2_enrichment: { birthYear } }, { count: 1, seed: "sheet" });
    const card = res && res.cards && res.cards[0]; if (!card) return null;
    return { song: card.song && card.song.title && card.song.year ? card.song : null, touch: card.touch && card.touch.prompt ? card.touch : null };
  } catch (e) { return null; }
}

export function reminiscenceTemplate(ctx) {
  const base = builtinTemplate(ctx), profile = ctx.profile, tier = ctx.tier;
  const personal = ctx.mode !== "group";                       // a group sheet is made from what the residents share: no one's private detail on it
  const avoided = avoidMatcher(ctx.avoid || profile.avoid), fine = (t) => !avoided(String(t));
  const deep0 = ctx.deep || normalizeDeep(ctx.request && ctx.request.deep);
  const deep = Object.assign({}, deep0, { themeWords: (deep0.themeWords || []).filter(fine), notes: (deep0.notes || []).filter(fine), music: deep0.music.filter(fine), foods: deep0.foods.filter(fine), places: deep0.places.filter(fine), words: deep0.words.filter(fine), staffNotes: deep0.staffNotes.filter(fine) });   // a keep-off word never gets in through any field
  const cal = ctx.calibration && typeof ctx.calibration === "object" ? ctx.calibration : {};   // set by the difficulty calibrator (pillar 2): caps for the sheet, never a diagnosis
  const capTo = (v, cap) => (Number(cap) > 0 ? Math.min(v, Number(cap)) : v);
  const fontPt = Math.max(FONT_PT[tier] || 20, Number(cal.minFontPt) || 0), fontPx = fontPt * 96 / 72;
  const seed = [personal ? profile.name : "", profile.era, tier, deep.variant].join("|");   // used only to pick, never printed

  /* 1. the words for the word search: theirs first, then from their years */
  const first = (s) => String(s || "").split(/[\s,]+/).filter(Boolean)[0] || "";
  const FALLBACK_WORDS = ["MUSIC", "GARDEN", "FAMILY", "HOME", "SUNDAY", "SONG", "KITCHEN", "FLOWERS", "RADIO", "SPRING", "DANCE", "SUPPER"];
  const own = [...deep.themeWords, ...(personal ? [...deep.words, ...profile.pets, ...profile.family.map(first), ...profile.preferences.map(first), ...deep.foods.map(first), ...deep.music.map(first), first(profile.career), first(profile.hometown), ...profile.anchors.map(first)] : [...profile.preferences.map(first), ...profile.anchors.map(first)])];
  const size = capTo(tier === 3 ? 6 : tier === 2 ? 7 : 8, cal.maxGrid), count = capTo(tier === 3 ? 4 : 5, cal.maxWords);
  const wanted = [...own, ...FALLBACK_WORDS].filter((w) => w && fine(w) && toLetters(w).length >= 3 && toLetters(w).length <= size);
  let ws = null;
  if (deep.include.wordSearch) { ws = buildWordSearch(wanted, { size, max: count, seed }); if (ws.words.length < 3) ws = null; }

  /* 2. fun to know, 3. things that go together */
  const sparkCount = capTo(tier === 1 ? 3 : 2, cal.maxSparks);
  const sparks = deep.include.sparks ? [...deep.notes, ...sparksFor(profile.era, sparkCount, { seed, focus: deep.focus, fine })].slice(0, sparkCount) : [];
  const match = deep.include.matching ? matchingItems(tier === 1 ? 4 : 3, { seed, pool: pairPoolFor(profile, deep), fine }) : { items: [], rightOrder: [] };

  const baseBlocks = base.pages.resident.blocks, anchors0 = (baseBlocks.find((b) => b.type === "anchors") || { items: [] }).items;
  const anchorsAll = personal && deep.places.length ? [...anchors0, ...deep.places.map((p) => "Home was " + p)].filter(fine) : anchors0;
  /* the people, animals, work and place that are theirs, as one line they can read and answer to in their own way */
  const placeName = String(profile.hometown || "").trim();
  const talk = personal ? [...profile.family.filter(fine).slice(0, 1), ...profile.pets.filter(fine).slice(0, 1), profile.career, placeName, ...profile.preferences.slice(0, 1)].filter((x) => x && fine(x)).slice(0, 5) : [];
  const eraTitle = profile.era ? "From the " + profile.era + ", just for fun" : "Just for fun";
  const build = (s) => {
    const blocks = [];
    if (s.talk && talk.length) blocks.push({ type: "note", title: "We can talk about", text: talk.slice(0, st.talkMax).join("  \u00b7  ") });
    if (s.anchors) blocks.push({ type: "anchors", title: "From your time", items: anchorsAll.slice(0, s.anchors) });
    if (s.sparks && sparks.length) blocks.push({ type: "prompts", title: eraTitle, items: sparks.slice(0, s.sparks) });
    if (ws && s.cell) blocks.push({ type: "wordsearch", title: "Find these words", grid: ws.grid, words: ws.words, cellPx: s.cell });
    if (s.pairs && match.items.length >= 2) {
      const items = match.items.slice(0, s.pairs), keep = new Set(items.map((i) => i.right));
      blocks.push({ type: "matching", title: "Things that go together", items, rightOrder: match.rightOrder.filter((r) => keep.has(r)) });
    }
    return blocks;
  };
  /* Fit one page: if the sheet is too full, give up the least important things first, one step at a time. */
  const st = { talk: true, talkMax: 5, anchors: Math.min(3, anchorsAll.length), sparks: sparks.length, pairs: capTo(match.items.length, cal.maxPairs), cell: tier === 3 ? 40 : tier === 2 ? 40 : 32 };
const floor = tier === 3 ? 40 : 32;   // the latest stage keeps the biggest squares: it gives up other things first
  const reductions = [() => { st.anchors = 0; }, () => { st.sparks = Math.min(st.sparks, 1); }, () => { st.pairs = Math.min(st.pairs, 3); }, () => { st.cell = Math.max(floor, st.cell - 4); }, () => { st.pairs = Math.min(st.pairs, 2); }, () => { st.cell = tier === 3 ? floor : 30; }, () => { st.talkMax = 3; }, () => { st.talkMax = 2; }, () => { st.talk = false; }, () => { st.sparks = 0; }, () => { st.pairs = 0; }];   // the three parts outlast the "we can talk about" line, which page 2 repeats as starters
  let blocks = build(st);
  for (const cut of reductions) { if (estimateBlocksPx(blocks, fontPx) <= PAGE_BUDGET_PX) break; cut(); blocks = build(st); }
  if (!blocks.length) blocks = baseBlocks;               // everything was switched off: the plain conversation sheet still stands

  /* page 2: the three steps, made personal, and the notes */
  const lead = anchorsAll.find(fine) || "something from long ago";
  const pet = profile.pets.find(fine), kin = profile.family.find(fine);
  const photoOf = personal && pet ? ", or a photograph of " + pet : personal && kin ? ", or a photograph of " + kin : "";
  const steps3 = [
    { order: 1, label: "Visual Cue", text: "Sit at eye level in good light. Show " + lead + " on page 1" + photoOf + ", and let them look for as long as they like." },
    { order: 2, label: "Verbal Anchor", text: "Say one short, warm sentence, such as \"" + (personal && profile.name ? profile.name + ", this looks like " : "This looks like ") + lead + ".\" Then wait quietly." },
    { order: 3, label: "Validation Statement", text: tier === 3 ? "Whatever they say or do, join them: \"I'm here with you.\" Do not correct. Stay as long as they want company." : "Whatever they say or feel, join it: \"That sounds like it mattered to you.\" Do not correct. Follow where they take the conversation." }
  ];
  /* Page 2 has room for about six short notes. Staff notes come first, then the rest in order of use; whatever does not fit is left off. */
  const how = [blocks.some((b) => b.type === "wordsearch") ? "the words in the word search run across or down" : "", blocks.some((b) => b.type === "matching") ? "they can draw a line between things that go together" : ""].filter(Boolean);
  const starters = (baseBlocks.find((b) => b.type === "prompts") || { items: [] }).items.slice(0, 2);
  const generic = base.pages.caregiver.notes.slice(how.length ? 1 : 0);      // the first generic note says what the "Page 1" note says, so it steps aside
  const guidance = (Array.isArray(cal.guidance) ? cal.guidance : []).map((g) => String(g)).filter(fine).slice(0, 2);
  const ranked = [...(personal ? deep.staffNotes.map((n) => "Staff note: " + n) : []), ...guidance, ...generic.slice(0, 2), ...(how.length ? ["Page 1: " + how.join(", and ") + ". Pointing, reading aloud or just talking all count; any response is welcome."] : []), ...generic.slice(2), ...(starters.length ? ["If they would like to talk, start with: " + starters.join(" ")] : [])];
  const notes = ranked.slice(0, 6);
  const caregiver = Object.assign({}, base.pages.caregiver, { heading: "Staff Facilitation Protocol", steps: steps3, notes, safetyNotice: SAFETY_NOTICE });

  /* page 3: their own music and kitchen smells, then the safe defaults */
  const sensory = JSON.parse(JSON.stringify(base.pages.sensory)), items = sensory.items;
  const cur = curatedSensory(profile, tier);
  if (personal && deep.music.length) { const i = items.findIndex((x) => x.sense === "Sound"); const t = "Play " + deep.music[0] + " softly, and let them choose to join in. Lower the volume if they turn away."; if (i >= 0) items[i] = { sense: "Sound", text: t }; else items.unshift({ sense: "Sound", text: t }); }
  else if (cur && cur.song && fine(cur.song.title)) { const i = items.findIndex((x) => x.sense === "Sound"); const t = "A song from their years, such as " + cur.song.title + (cur.song.artist ? " by " + cur.song.artist : "") + ", played softly. Lower the volume if they turn away."; if (i >= 0) items[i] = { sense: "Sound", text: t }; }
  if (personal && deep.foods.length) items.push({ sense: "Smell", text: "Offer the scent of " + deep.foods[0] + " from a warm cup or a jar held near. No tasting unless their care plan allows it." });
  sensory.items = items.slice(0, 4);

  /* the summary chips in the preview: only what really reached the sheet */
  const text = JSON.stringify({ blocks, caregiver, sensory });
  const deepTags = [];
  if (personal && deep.music.length && text.includes(deep.music[0])) deepTags.push({ label: "Favorite music", value: deep.music[0] });
  if (personal && deep.foods.length && text.includes(deep.foods[0])) deepTags.push({ label: "Favorite food or scent", value: deep.foods[0] });
  if (personal && deep.places.length && text.includes(deep.places[0])) deepTags.push({ label: "Places", value: deep.places[0] });
  const w = blocks.find((b) => b.type === "wordsearch"); if (w) deepTags.push({ label: "Word search", value: w.words.length + " words" });
  if (personal && deep.staffNotes.length) deepTags.push({ label: "Staff notes", value: deep.staffNotes.length + " on page 2" });
  if (deep.focus !== "mixed") deepTags.push({ label: "Memory focus", value: FOCUS[deep.focus] });

  return Object.assign({}, base, { title: base.title, theme: base.theme, fontPt, deepTags,
    pages: { resident: Object.assign({}, base.pages.resident, { fontPt, blocks }), caregiver, sensory } });
}

/* ---------- the analyze-stage agent ---------- */
export class ReminiscenceAgent extends CognicopiaAgent {
  constructor(o = {}) { super({ name: "ReminiscenceAgent", stage: "analyze", role: "Reminiscence engine: deep customization, validation therapy protocol and staff notes", capabilities: ["deep-customization", "word-search", "validation-protocol"], ...o }); }
  async handle(ctx) {
    ctx.deep = normalizeDeep(ctx.request && ctx.request.deep);
    ctx.analysis = Object.assign({}, ctx.analysis, { reminiscence: { focus: ctx.deep.focus, include: ctx.deep.include, fields: ["music", "foods", "places", "words", "staffNotes"].filter((k) => ctx.deep[k] && ctx.deep[k].length) } });
    return ctx;
  }
}

/* Wire the engine into an orchestrator: the template, and the agent that reads the deep settings. */
export function registerReminiscence(orchestrator) {
  if (!orchestrator || typeof orchestrator.use !== "function") throw new TypeError("registerReminiscence needs an orchestrator");
  orchestrator.registerLocalTemplate(TEMPLATE_NAME, reminiscenceTemplate);
  orchestrator.use(new ReminiscenceAgent());
  return orchestrator;
}
/* The request the orchestrator takes for this engine: the profile, the deep settings, and this engine's template. */
export function buildRequest(profile, deep, extra = {}) {
  return Object.assign({}, extra, { profile: profile || {}, deep: deep || {}, options: Object.assign({}, extra.options, { template: TEMPLATE_NAME }) });
}

/* ---------- the Deep Packet Customization panel ---------- */
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else e.setAttribute(k, v === true ? "" : String(v)); }
  kids.flat().forEach((c) => { if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return e;
}
/* mountDeepCustomization(container): builds the panel with DOM calls (never markup strings) and returns { read, reset, shuffle, el }. */
export function mountDeepCustomization(container, opts = {}) {
  if (!container || typeof document === "undefined") return null;
  const id = (s) => (opts.idPrefix || "cgre") + s;
  const field = (key, label, sub, ph, kind = "text") => {
    const input = kind === "area" ? h("textarea", { id: id(key), rows: 3, maxlength: 600, placeholder: ph, class: "cgre-input" }) : h("input", { type: "text", id: id(key), maxlength: 200, autocomplete: "off", placeholder: ph, class: "cgre-input" });
    return h("div", { class: "cgre-field" }, h("label", { for: id(key) }, label, sub ? h("span", { class: "cgre-sub", text: sub }) : null), input);
  };
  const focus = h("select", { id: id("Focus"), class: "cgre-input" }, Object.entries(FOCUS).map(([k, v]) => h("option", { value: k, text: v })));
  const checks = INCLUDE_KEYS.map(([k, label]) => { const cb = h("input", { type: "checkbox", id: id("Inc-" + k), checked: true, "data-include": k }); cb.checked = true; return h("label", { class: "cgre-check", for: id("Inc-" + k) }, cb, h("span", { text: label })); });
  const status = h("p", { class: "cgre-status", id: id("Status"), role: "status", "aria-live": "polite" });
  let variant = 0;
  const shuffleBtn = h("button", { type: "button", class: "cgre-btn", id: id("Shuffle") }, "Make a different version");
  const resetBtn = h("button", { type: "button", class: "cgre-btn", id: id("Reset") }, "Clear these fields");
  const panel = h("details", { class: "cgre-panel", id: id("Panel") },
    h("summary", { class: "cgre-sum" }, h("span", { class: "cgre-sumtitle", text: "Deep Packet Customization" }), h("span", { class: "cgre-opt", text: "optional" })),
    h("div", { class: "cgre-body" },
      h("p", { class: "cgre-lead", text: "Add what you know and the packet becomes theirs. Leave anything blank. What you type here is used to make this one packet in this browser, and nothing is saved or sent." }),
      h("div", { class: "cgre-field" }, h("label", { for: id("Focus") }, "Memory focus", h("span", { class: "cgre-sub", text: "What the sheet leans toward" })), focus),
      field("Music", "Favorite music", "A song, a singer or a kind of music. Separate with commas.", "Sunday hymns, Patsy Cline"),
      field("Foods", "Favorite foods or kitchen smells", "Separate with commas.", "apple pie, fresh coffee"),
      field("Places", "Places they lived", "Separate with commas.", "the farm, Cedar Falls"),
      field("Words", "Extra words for the word search", "Words of 3 or more letters. Separate with commas.", "orchard, piano"),
      h("fieldset", { class: "cgre-inc" }, h("legend", { text: "On the resident page" }), checks),
      field("Staff", "Staff notes for page 2", "One per line. Printed on the staff page only, never on the resident page.", "Prefers the window seat", "area"),
      h("div", { class: "cgre-actions" }, shuffleBtn, resetBtn),
      status));
  container.append(panel);
  const q = (s) => panel.querySelector(s);
  const read = () => normalizeDeep({
    focus: q("#" + id("Focus")).value, music: q("#" + id("Music")).value, foods: q("#" + id("Foods")).value, places: q("#" + id("Places")).value, words: q("#" + id("Words")).value,
    staffNotes: q("#" + id("Staff")).value, variant,
    include: Object.fromEntries(INCLUDE_KEYS.map(([k]) => [k, q("#" + id("Inc-" + k)).checked]))
  });
  const say = (t) => { status.textContent = t; };
  const reset = () => { panel.querySelectorAll("input[type=text],textarea").forEach((e) => { e.value = ""; }); q("#" + id("Focus")).value = "mixed"; panel.querySelectorAll("input[type=checkbox]").forEach((c) => { c.checked = true; }); variant = 0; say("Cleared."); };
  shuffleBtn.addEventListener("click", () => { variant = (variant + 1) % 1000; say("The next preview will use a different version."); if (typeof opts.onShuffle === "function") opts.onShuffle(read()); });
  resetBtn.addEventListener("click", reset);
  return { el: panel, read, reset, say, shuffle: () => { variant = (variant + 1) % 1000; return variant; }, open: () => { panel.open = true; const f = q("#" + id("Focus")); if (f) f.focus(); } };
}
