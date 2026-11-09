/* =====================================================================
   COGNICOPIA CONTENT MATCHER AND THEMED JOURNAL
   Picks, from the public content catalog (data/content-catalog.json),
   the items that suit one resident, and bundles them into a short themed
   journal ready to print.

   Nothing here leaves the computer. It makes no request, keeps nothing and
   draws no random number: a seed makes the same journal again, and a
   different seed makes a new one. The clock is read in one place only, to
   date a journal made by generateThematicJournal (pass `today` to decide).

   Selecting (selectContentForResident)
     1. Strictly the resident's own level. A resident at Tier_3_Advanced
        never receives a Tier_1 page, whatever the interests say, because
        a page that is too hard or too plain is a failure of dignity, not
        a close match. A resident whose level is not known gets nothing.
     2. Interests are compared with each item's tags: an exact word is
        worth 3, the same family of words (gardening and flowers, baking and
        kitchen) 2, a shared word stem 2, and a tag for the decade the
        resident was young (when a birth year is known) 1. Items that
        touch a topic the resident asked to steer around are left out.
     3. Matches are ranked by score, then by the share of the item's tags
        that matched, then by their place in the catalog. When fewer than
        `limit` items match, the rest are filled from a short list of
        well-loved themes (nostalgia, music, sensory, family...), so a
        profile with no interests still gets a good page.

   Bundling (composeThematicJournal, generateThematicJournal)
     Five pages that share one theme: reminiscence prompts first, then
     conversation trivia, then a word search; any page the catalog cannot
     fill becomes a "My Own Page" of gentle writing starters, so there are
     always five. Type sizes follow the level (never under 16, 20 or 26
     points), pages are US Letter with 0.5 in margins and a 0.75 in binding
     gutter, and everything is pure black on white. Trivia is offered as
     choices to circle and a question to talk about, never as a test.

   Built into assets/services/contentMatcher.js (globalThis.CogniContentMatcher)
   by scripts/build-services.mjs.
   @global CogniContentMatcher
   ===================================================================== */

export const VERSION = "1.0.0";
export const DEFAULT_LIMIT = 5;
export const PAGE_COUNT = 5;
/** The kinds of catalog item a resident reads or does. Templates are structure, not content, and are not offered. */
export const CONTENT_CATEGORIES: readonly string[] = ["ReminiscencePrompt", "Trivia", "WordSearch"];
export const TIERS: readonly string[] = ["Tier_1_Mild", "Tier_2_Moderate", "Tier_3_Advanced"];
/** Weights for an interest that matches a tag. */
export const WEIGHT = { exact: 3, group: 2, stem: 2, era: 1 } as const;
/** When an item matches nothing, these well-loved themes decide which defaults come first (higher is more engaging). */
export const ENGAGEMENT: Readonly<Record<string, number>> = { nostalgia: 3, music: 3, sensory: 2, family: 2, summer: 2, garden: 1, kitchen: 1, movies: 1 };

export type Tier = "Tier_1_Mild" | "Tier_2_Moderate" | "Tier_3_Advanced";
export interface CatalogItem { item_id: string; category: string; cognitive_tier: string; tags: string[]; content_payload: Record<string, unknown>; }
export interface Via { tag: string; via: "exact" | "group" | "stem" | "era"; }
export interface Entry { item: CatalogItem; score: number; matched: Via[]; reason: "interest" | "default"; }
export interface Resident { tier: Tier | null; interests: string[]; birthYear: number | null; avoid: string[]; firstName: string; id: string; }
export interface Problem { code: string; message: string; }

/* ---------- 1. Words, families of words and the person ---------- */

const slug = (s: unknown): string => String(s == null ? "" : s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
/** A light stem: gardening and gardens both become garden. */
function stem(w: string): string {
  if (w.length <= 4) return w;
  let s = w;
  if (/ies$/.test(s)) s = s.replace(/ies$/, "y");
  else if (/ing$/.test(s) && s.length > 5) s = s.replace(/ing$/, "").replace(/(.)\1$/, "$1");
  else if (/es$/.test(s) && /(ch|sh|x|ss|o)es$/.test(s)) s = s.replace(/es$/, "");
  else if (/s$/.test(s) && !/ss$/.test(s)) s = s.replace(/s$/, "");
  return s;
}
/** Words that mean nearly the same thing to a person, so "baking" finds a kitchen page. */
export const GROUPS: Readonly<Record<string, readonly string[]>> = {
  music: ["music", "song", "songs", "singing", "sing", "hymn", "hymns", "radio", "dance", "dancing", "big_band", "swing", "jazz", "country", "rock_and_roll", "records", "record", "orchestra", "choir", "piano", "ballad", "jukebox"],
  garden: ["garden", "gardening", "flower", "flowers", "plants", "roses", "rose", "tulip", "spring", "yard", "seeds", "outdoors"],
  kitchen: ["kitchen", "cooking", "baking", "bake", "bread", "pie", "recipe", "recipes", "household", "cookies", "pantry", "icebox", "everyday_objects"],
  movies: ["movie", "movies", "film", "films", "musicals", "cinema", "picture_show", "theater"],
  summer: ["summer", "porch", "lemonade", "picnic", "evening", "evenings"],
  family: ["family", "grandchildren", "grandkids", "reunion", "sunday_dinner"],
  crafts: ["knitting", "sewing", "quilting", "crochet", "crafts", "needlework", "art"],
  games: ["puzzles", "puzzle", "crosswords", "crossword", "word_search", "cards", "games", "bingo"]
};
const GROUP_OF: Record<string, string[]> = {};
Object.keys(GROUPS).forEach(g => GROUPS[g].forEach(w => { (GROUP_OF[w] = GROUP_OF[w] || []).push(g); }));
/** The tags a "topics to steer around" choice rules out (a code from the resident profile, or a plain word). */
export const AVOID_TAGS: Readonly<Record<string, readonly string[]>> = {
  war: ["war", "military", "combat"], water: ["water", "boat", "lake", "fishing", "ship", "sea", "sailing"], driving: ["driving", "car", "cars", "truck", "tractor"],
  children: ["children", "child", "baby", "school", "kids"], medical: ["medical", "hospital", "doctor", "nurse"], death: ["death", "funeral"],
  religion: ["religion", "church", "hymn", "hymns", "easter", "christmas"], money: ["money", "bank"], politics: ["politics", "election"],
  storms: ["storms", "storm", "fire", "disaster"], home: ["home", "house"], "family-conflict": ["divorce"]
};
const groupsOf = (w: string): string[] => (GROUP_OF[w] || []).concat(GROUP_OF[stem(w)] || []);
/** The words an interest or a tag is made of: itself, its parts, and their stems. */
function wordsOf(text: string): string[] {
  const s = slug(text), out = new Set<string>();
  if (!s) return [];
  out.add(s);
  s.split("_").filter(p => p.length >= 3).forEach(p => { out.add(p); out.add(stem(p)); });
  out.add(stem(s));
  return Array.from(out);
}

/** The level, from any way a page or a profile writes it: "Mild", "tier 2", 3, "Tier_2_Moderate", "early". */
export function normalizeTier(v: unknown): Tier | null {
  if (typeof v === "number") return TIERS[v - 1] as Tier | undefined || null;
  const s = slug(v);
  if (!s) return null;
  const hit = TIERS.find(t => slug(t) === s);
  if (hit) return hit as Tier;
  const n = /^(?:tier_?)?([123])$/.exec(s);
  if (n) return TIERS[Number(n[1]) - 1] as Tier;
  if (/mild|early|full_detail/.test(s)) return "Tier_1_Mild";
  if (/moderate|middle|guided/.test(s)) return "Tier_2_Moderate";
  if (/advanced|late|simplified/.test(s)) return "Tier_3_Advanced";
  return null;
}
const labelOf = (x: unknown): string => typeof x === "string" ? x : x && typeof x === "object" ? String((x as { label?: unknown }).label || "") : "";
const listOf = (v: unknown): string[] => Array.isArray(v) ? v.map(labelOf).filter(Boolean) : typeof v === "string" ? v.split(/[,;\n]+/).map(x => x.trim()).filter(Boolean) : [];

/**
 * Reads a resident from either shape the program keeps them in:
 * a Cognicopia database resident ({ firstName, interests, hobbies, pastOccupation, cognitiveTier: "Mild" }) or a saved profile
 * from profile.html ({ tier1_core, tier2_enrichment, ... }), and says what matching needs: the level, the interests,
 * the birth year and the topics to avoid.
 * @param profile either shape; a missing or odd one gives no level and no interests
 * @param tierHint the level to use when the caller already knows it (the roster passes the one it works out for the print); it wins over the profile's own
 */
export function normalizeResident(profile: unknown, tierHint?: unknown): Resident {
  const p = (profile && typeof profile === "object" ? profile : {}) as Record<string, unknown>;
  const t1 = (p.tier1_core && typeof p.tier1_core === "object" ? p.tier1_core : {}) as Record<string, unknown>;
  const t2 = (p.tier2_enrichment && typeof p.tier2_enrichment === "object" ? p.tier2_enrichment : {}) as Record<string, unknown>;
  const mus = (t2.music && typeof t2.music === "object" ? t2.music : {}) as Record<string, unknown>;
  const skills = (t2.skills && typeof t2.skills === "object" ? t2.skills : {}) as Record<string, unknown>;
  const interests: string[] = ([] as string[]).concat(listOf(p.interests), listOf(p.hobbies), listOf(p.pastOccupation), listOf(t1.topHobbies), listOf(t1.occupation), listOf(mus.genres), listOf(mus.artists), listOf(skills.items));
  const seen = new Set<string>(), uniq: string[] = [];
  interests.forEach(i => { const k = slug(i); if (k && !seen.has(k)) { seen.add(k); uniq.push(i.slice(0, 80)); } });
  const by = Number(p.birthYear !== undefined ? p.birthYear : t2.birthYear);
  const avoidRaw = ([] as unknown[]).concat(Array.isArray(p.avoid) ? p.avoid : [], ((t1.topicsToAvoid && typeof t1.topicsToAvoid === "object" ? (t1.topicsToAvoid as { topics?: unknown }).topics : []) as unknown[]) || []);
  const avoid = avoidRaw.map(x => slug(x && typeof x === "object" ? (x as { code?: unknown; label?: unknown }).code || (x as { label?: unknown }).label : x)).filter(Boolean);
  const own = normalizeTier(p.cognitive_tier !== undefined ? p.cognitive_tier : p.cognitiveTier !== undefined ? p.cognitiveTier : t1.cognitiveTier);
  const tier = normalizeTier(tierHint) || own;
  return {
    tier, interests: uniq, birthYear: Number.isInteger(by) && by > 1850 && by < 2100 ? by : null, avoid,
    firstName: String(p.firstName || t1.preferredName || "").replace(/[\u0000-\u001F\u007F<>]/g, "").trim().slice(0, 40), id: String(p.id || "")
  };
}

/* ---------- 2. Choosing ---------- */

const isItem = (x: unknown): x is CatalogItem => !!x && typeof x === "object" && typeof (x as CatalogItem).item_id === "string" && typeof (x as CatalogItem).cognitive_tier === "string" && Array.isArray((x as CatalogItem).tags) && !!(x as CatalogItem).content_payload && typeof (x as CatalogItem).content_payload === "object";
/** Accepts a list of records or a loadContentCatalog() result; anything else is an empty catalog. */
export function itemsOf(catalog: unknown): CatalogItem[] {
  const raw = Array.isArray(catalog) ? catalog : catalog && typeof catalog === "object" && Array.isArray((catalog as { items?: unknown }).items) ? (catalog as { items: unknown[] }).items : [];
  return raw.filter(isItem);
}
/** The decades a person spent their teens and twenties in (ages 12 to 25), as tags such as "1950s". */
function formativeDecades(birthYear: number | null): Set<string> {
  const out = new Set<string>();
  if (birthYear === null) return out;
  for (let y = birthYear + 12; y <= birthYear + 25; y++) out.add(Math.floor(y / 10) * 10 + "s");
  return out;
}
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export interface RankOptions {
  /** Which kinds of record may be chosen. Default: reminiscence prompts, trivia and word searches. */
  categories?: readonly string[];
  /** Breaks ties between equal matches differently for each seed (default: the catalog's own order). */
  seed?: string | number;
  /** A level to use when the profile does not carry one. */
  tier?: unknown;
}
export interface Ranking { tier: Tier | null; entries: Entry[]; excluded: string[]; resident: Resident; }

/**
 * Every item of the resident's own level, best first: interest matches, then well-loved defaults.
 * @returns the ranking with all entries (the caller takes as many as it needs), the ids left out for the topics to avoid
 */
export function rankContent(residentProfile: unknown, contentCatalog: unknown, options: RankOptions = {}): Ranking {
  const resident = normalizeResident(residentProfile, options.tier);
  if (!resident.tier) return { tier: null, entries: [], excluded: [], resident };
  const allowed = options.categories || CONTENT_CATEGORIES;
  const decades = formativeDecades(resident.birthYear);
  const interestWords = resident.interests.map(wordsOf);
  const interestGroups = new Set<string>(); interestWords.forEach(ws => ws.forEach(w => groupsOf(w).forEach(g => interestGroups.add(g))));
  const interestSet = new Set<string>(); interestWords.forEach(ws => ws.forEach(w => interestSet.add(w)));
  const interestStems = new Set<string>(); interestWords.forEach(ws => ws.forEach(w => interestStems.add(stem(w))));
  const avoidTags = new Set<string>();
  resident.avoid.forEach(a => { avoidTags.add(a); (AVOID_TAGS[a.replace(/_/g, "-")] || AVOID_TAGS[a] || []).forEach(t => avoidTags.add(t)); });
  const excluded: string[] = [];
  interface Scored { entry: Entry; order: number; engagement: number; precision: number; tie: number; }
  const scored: Scored[] = [];
  const seed = options.seed === undefined ? "" : String(options.seed);
  itemsOf(contentCatalog).forEach((item, order) => {
    if (item.cognitive_tier !== resident.tier || !allowed.includes(item.category)) return;
    if (item.tags.some(t => avoidTags.has(slug(t)))) { excluded.push(item.item_id); return; }
    let score = 0; const matched: Via[] = [];
    item.tags.forEach(raw => {
      const tag = slug(raw);
      if (!tag) return;
      const tw = wordsOf(tag);
      let via: Via["via"] | null = null;
      if (interestSet.has(tag)) via = "exact";
      else if (tw.some(w => groupsOf(w).some(g => interestGroups.has(g)))) via = "group";
      else if (tw.some(w => interestStems.has(stem(w)) && stem(w).length >= 4)) via = "stem";
      else if (decades.has(tag)) via = "era";
      if (via) { score += WEIGHT[via]; matched.push({ tag, via }); }
    });
    scored.push({
      entry: { item, score, matched, reason: score > 0 ? "interest" : "default" },
      order, engagement: item.tags.reduce((n, t) => n + (ENGAGEMENT[slug(t)] || 0), 0),
      precision: item.tags.length ? matched.length / item.tags.length : 0, tie: seed ? hash(seed + "|" + item.item_id) : order
    });
  });
  scored.sort((a, b) => {
    const ai = a.entry.reason === "interest", bi = b.entry.reason === "interest";
    if (ai !== bi) return ai ? -1 : 1;
    if (ai) return b.entry.score - a.entry.score || b.precision - a.precision || a.tie - b.tie || a.order - b.order;
    return b.engagement - a.engagement || a.tie - b.tie || a.order - b.order;
  });
  const entries = scored.map(x => x.entry);
  return { tier: resident.tier, entries, excluded, resident };
}

/**
 * The catalog items that suit one resident, best first.
 * @param residentProfile a database resident ({ interests, cognitiveTier: "Mild" | ... }) or a saved profile from profile.html
 * @param contentCatalog the list of records, or a loadContentCatalog() result
 * @param limit how many to return (default 5)
 * @returns entries { item, score, matched: [{ tag, via }], reason: "interest" | "default" }; fewer than `limit` when the catalog holds fewer of the resident's level; never throws
 */
export function selectContentForResident(residentProfile: unknown, contentCatalog: unknown, limit: number = DEFAULT_LIMIT): Entry[] {
  const n = Number.isFinite(Number(limit)) && Number(limit) >= 1 ? Math.min(50, Math.floor(Number(limit))) : DEFAULT_LIMIT;
  try { return rankContent(residentProfile, contentCatalog).entries.slice(0, n); } catch { return []; }
}

/* ---------- 3. Word search grids ---------- */

function rng(seed: string): () => number {
  let a = hash(seed) || 1;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const DIRS: Record<string, [number, number]> = { right: [0, 1], left: [0, -1], down: [1, 0], up: [-1, 0], down_right: [1, 1], down_left: [1, -1], up_right: [-1, 1], up_left: [-1, -1] };
/** Letters in roughly the proportions of English, so a grid does not look like a pile of Zs and Qs. */
const FILL = "EEEEEEEEEEEEAAAAAAAAARRRRRRRIIIIIIIOOOOOOOOTTTTTTTNNNNNNSSSSSSLLLLCCCUUUDDDPPPMMMHHHGGBBFFYYWWKVXZJQ";

export interface Grid { rows: number; cols: number; cells: string[][]; words: string[]; dropped: string[]; directions: string[]; }
/**
 * Lays words into a grid, the same way for the same seed. Each word runs along one of the allowed directions;
 * a word that cannot be placed is dropped and named in `dropped`.
 */
export function buildGrid(words: readonly string[], rows: number, cols: number, directions: readonly string[], seed: string): Grid {
  const rand = rng(seed), dirs = directions.filter(d => DIRS[d]);
  const use = dirs.length ? dirs : ["right", "down"];
  const cells: string[][] = Array.from({ length: rows }, () => new Array<string>(cols).fill(""));
  const placed: string[] = [], dropped: string[] = [];
  Array.from(words).sort((a, b) => b.length - a.length).forEach(w => {
    for (let attempt = 0; attempt < 400; attempt++) {
      const d = DIRS[use[Math.floor(rand() * use.length)]];
      const r0 = Math.floor(rand() * rows), c0 = Math.floor(rand() * cols);
      const r1 = r0 + d[0] * (w.length - 1), c1 = c0 + d[1] * (w.length - 1);
      if (r1 < 0 || r1 >= rows || c1 < 0 || c1 >= cols) continue;
      let fits = true;
      for (let i = 0; i < w.length && fits; i++) { const ch = cells[r0 + d[0] * i][c0 + d[1] * i]; if (ch && ch !== w[i]) fits = false; }
      if (!fits) continue;
      for (let i = 0; i < w.length; i++) cells[r0 + d[0] * i][c0 + d[1] * i] = w[i];
      placed.push(w); return;
    }
    dropped.push(w);
  });
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!cells[r][c]) cells[r][c] = FILL[Math.floor(rand() * FILL.length)];
  return { rows, cols, cells, words: Array.from(words).filter(w => placed.includes(w)), dropped, directions: use };
}
/** Finds a word in a grid along the directions given: how the checks prove every listed word is really there. */
export function findWord(grid: Grid, word: string, directions: readonly string[] = grid.directions): boolean {
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) for (const name of directions) {
    const d = DIRS[name]; if (!d) continue;
    let i = 0;
    for (; i < word.length; i++) { const rr = r + d[0] * i, cc = c + d[1] * i; if (rr < 0 || cc < 0 || rr >= grid.rows || cc >= grid.cols || grid.cells[rr][cc] !== word[i]) break; }
    if (i === word.length) return true;
  }
  return false;
}

/* ---------- 4. Pages ---------- */

export type Block =
  | { type: "invite"; text: string }
  | { type: "list"; items: string[] }
  | { type: "choices"; lead: string; items: string[]; note: string }
  | { type: "starter"; text: string; lines: number }
  | { type: "grid"; grid: Grid; theme: string }
  | { type: "words"; words: string[] };
export interface JournalPage { no: number; kind: "prompts" | "trivia" | "wordsearch" | "own"; title: string; label: string; itemId: string | null; blocks: Block[]; body: string; }

/** The smallest type each level may print, in points. */
export const TYPE_FLOOR: Readonly<Record<string, number>> = { Tier_1_Mild: 14, Tier_2_Moderate: 18, Tier_3_Advanced: 24 };
const TIER_CLASS: Readonly<Record<string, string>> = { Tier_1_Mild: "cm-t1", Tier_2_Moderate: "cm-t2", Tier_3_Advanced: "cm-t3" };
const QUESTIONS_PER_PAGE: Readonly<Record<string, number>> = { Tier_1_Mild: 3, Tier_2_Moderate: 2, Tier_3_Advanced: 2 };
const THEME_NAMES: Readonly<Record<string, string>> = { music: "Music and Songs", garden: "The Garden", kitchen: "The Kitchen", movies: "The Movies", summer: "Summer Days", family: "Family", crafts: "Handwork", games: "Games and Puzzles", nostalgia: "Remembering", radio: "The Radio Years", household: "Around the House", sensory: "Sights and Sounds" };
const OWN_STARTERS: readonly string[] = [
  "Something about {theme} I would like to tell someone is",
  "A time {theme} made me smile was",
  "The people I think of when I think of {theme} are",
  "If I could spend an afternoon with {theme} again, I would",
  "One thing I know well about {theme} is"
];
const KIND_ORDER: Readonly<Record<string, number>> = { ReminiscencePrompt: 0, Trivia: 1, WordSearch: 2 };
const titleCase = (s: string): string => s.replace(/_/g, " ").replace(/\b[a-z]/g, c => c.toUpperCase());
const esc = (s: unknown): string => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const strings = (v: unknown, out: string[] = []): string[] => { if (typeof v === "string") out.push(v); else if (Array.isArray(v)) v.forEach(x => strings(x, out)); else if (v && typeof v === "object") Object.keys(v).forEach(k => strings((v as Record<string, unknown>)[k], out)); return out; };

/** The theme of a bundle: the tag that matched most often, else the first well-loved tag of the best item. */
export function themeOf(entries: readonly Entry[]): { slug: string; name: string } {
  const count: Record<string, number> = {}, order: string[] = [];
  entries.forEach(e => e.matched.filter(m => m.via !== "era").forEach(m => {
    const g = (groupsOf(m.tag)[0]) || m.tag;
    if (!(g in count)) { count[g] = 0; order.push(g); }
    count[g] += WEIGHT[m.via];
  }));
  let best = "";
  order.forEach(g => { if (!best || count[g] > count[best]) best = g; });
  if (!best && entries.length) best = slug(entries[0].item.tags.find(t => ENGAGEMENT[slug(t)]) || entries[0].item.tags[0] || "nostalgia");
  best = best || "nostalgia";
  return { slug: best, name: THEME_NAMES[best] || titleCase(best) };
}

export interface ComposeOptions {
  /** How many pages (default 5). */
  pages?: number;
  /** Makes a different grid and a different set of starters from the same items (default: a fixed seed). */
  seed?: string | number;
  /** Returns the problems with a line of text, or nothing. An item with any problem line is skipped (the dignity filter plugs in here). */
  lint?: (text: string) => readonly string[];
  /** The date printed under the title, as text. */
  date?: string;
  /** The resident's level, when the caller already knows it (it wins over the profile's own). */
  tier?: unknown;
}
export interface Journal {
  title: string; theme: string; tier: Tier; firstName: string; residentId: string; date: string;
  pages: JournalPage[]; selection: { item_id: string; score: number; reason: string; matched: Via[] }[]; skipped: string[]; problems: Problem[];
}

function bodyHtml(blocks: readonly Block[], title: string, tier: string): string {
  const parts: string[] = [`<h2 class="cm-h">${esc(title)}</h2>`];
  blocks.forEach(b => {
    if (b.type === "invite") parts.push(`<p class="cm-invite">${esc(b.text)}</p>`);
    else if (b.type === "list") parts.push(`<ul class="cm-list">${b.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`);
    else if (b.type === "choices") parts.push(`<div class="cm-choice"><p class="cm-q">${esc(b.lead)}</p><ul class="cm-choices">${b.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>${b.note ? `<p class="cm-beside">${esc(b.note)}</p>` : ""}</div>`);
    else if (b.type === "starter") parts.push(`<p class="cm-starter">${esc(b.text)} …</p><div class="cm-lines">${new Array(b.lines + 1).join('<div class="cm-rule"></div>')}</div>`);
    else if (b.type === "grid") {
      const g = b.grid, cell = Math.floor(Math.min(0.85, 6.3 / Math.max(g.rows, g.cols)) * 100) / 100;
      const pt = Math.max(TYPE_FLOOR[tier] || 14, Math.min(32, Math.floor(cell * 72 * 0.55)));
      parts.push(`<table class="cm-grid" style="font-size:${pt}pt" aria-label="${esc(b.theme)} word search"><tbody>${g.cells.map(r => `<tr>${r.map(ch => `<td style="width:${cell}in;height:${cell}in">${esc(ch)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
    } else if (b.type === "words") parts.push(`<ul class="cm-words">${b.words.map(w => `<li>${esc(w)}</li>`).join("")}</ul>`);
  });
  return `<div class="cm-page ${TIER_CLASS[tier] || "cm-t2"}">${parts.join("")}</div>`;
}

/**
 * Bundles a ranking into a themed journal of five pages.
 * @param residentProfile the resident, in either shape (the first name is used in the title, nothing else personal)
 * @param ranked the entries from rankContent().entries (best first); items with a line that fails the lint are skipped
 * @param options pages, seed, lint, date
 * @returns the pages (structure and HTML for each), the theme and what was chosen; never throws, and always has the pages asked for
 */
export function composeThematicJournal(residentProfile: unknown, ranked: readonly Entry[], options: ComposeOptions = {}): Journal {
  const resident = normalizeResident(residentProfile, options.tier);
  const tier: Tier = resident.tier || "Tier_2_Moderate";
  const total = Math.max(1, Math.min(12, Math.floor(options.pages || PAGE_COUNT)));
  const seed = String(options.seed === undefined ? "cognicopia" : options.seed);
  const problems: Problem[] = [], skipped: string[] = [];
  if (!resident.tier) problems.push({ code: "tier-missing", message: "The resident's level is not known, so the pages use the middle level." });
  const clean = (e: Entry): boolean => {
    if (!options.lint) return true;
    const bad = strings(e.item.content_payload).some(s => { try { return options.lint!(s).length > 0; } catch { return false; } });
    if (bad) skipped.push(e.item.item_id);
    return !bad;
  };
  const chosen = ranked.filter(e => e.item.cognitive_tier === tier && CONTENT_CATEGORIES.includes(e.item.category)).filter(clean).slice(0, total);
  const theme = themeOf(chosen);
  const ordered = chosen.map((e, i) => ({ e, i })).sort((a, b) => (KIND_ORDER[a.e.item.category] - KIND_ORDER[b.e.item.category]) || a.i - b.i).map(x => x.e);
  const pages: JournalPage[] = [];
  const add = (kind: JournalPage["kind"], title: string, itemId: string | null, blocks: Block[]) => {
    const no = pages.length + 1;
    pages.push({ no, kind, title, label: theme.name, itemId, blocks, body: bodyHtml(blocks, title, tier) });
  };
  ordered.forEach(e => {
    const p = e.item.content_payload as Record<string, unknown>, id = e.item.item_id;
    if (e.item.category === "ReminiscencePrompt") {
      const prompts = (Array.isArray(p.prompts) ? p.prompts : []).filter((x): x is string => typeof x === "string");
      const cues = (Array.isArray(p.sensory_cues) ? p.sensory_cues : []).filter((x): x is string => typeof x === "string");
      const blocks: Block[] = [{ type: "invite", text: prompts[0] || "Tell me about a time you enjoyed." }];
      if (cues.length) blocks.push({ type: "list", items: cues.slice(0, tier === "Tier_3_Advanced" ? 3 : 4) });
      blocks.push({ type: "starter", text: tier === "Tier_3_Advanced" ? "I remember" : prompts[1] ? prompts[1].replace(/[?.]+$/, "") : "I remember", lines: tier === "Tier_3_Advanced" ? 5 : 7 });
      add("prompts", "Let's remember together", id, blocks);
    } else if (e.item.category === "Trivia") {
      const qs = (Array.isArray(p.questions) ? p.questions : []).filter((q): q is Record<string, unknown> => !!q && typeof q === "object").slice(0, QUESTIONS_PER_PAGE[tier]);
      const blocks: Block[] = qs.map(q => {
        const ch = (Array.isArray(q.choices) ? q.choices : []).filter((x): x is string => typeof x === "string");
        return { type: "choices", lead: String(q.prompt || ""), items: ch, note: q.answer ? "For the person beside you: " + String(q.answer) + (q.follow_up ? ". Ask: " + String(q.follow_up) : ".") : "" } as Block;
      });
      add("trivia", "Something to talk about", id, blocks);
    } else if (e.item.category === "WordSearch") {
      const words = (Array.isArray(p.words) ? p.words : []).filter((x): x is string => typeof x === "string");
      const gs = (p.grid_size && typeof p.grid_size === "object" ? p.grid_size : {}) as { rows?: number; cols?: number };
      const rows = Math.max(5, Math.min(20, Number(gs.rows) || 10)), cols = Math.max(5, Math.min(20, Number(gs.cols) || 10));
      const dirs = (Array.isArray(p.directions) ? p.directions : []).filter((x): x is string => typeof x === "string");
      const g = buildGrid(words, rows, cols, dirs, seed + "|" + id);
      if (g.dropped.length) problems.push({ code: "word-dropped", message: `${g.dropped.join(", ")} did not fit the ${rows} by ${cols} grid and was left out.` });
      add("wordsearch", String(p.theme || theme.name), id, [{ type: "grid", grid: g, theme: String(p.theme || theme.name) }, { type: "words", words: g.words }]);
    }
  });
  const rand = rng(seed + "|own");
  const own = OWN_STARTERS.map((s, i) => ({ s, k: rand() + i * 0.0001 })).sort((a, b) => a.k - b.k).map(x => x.s.replace("{theme}", theme.name.toLowerCase().replace(/^the /, "the ")));
  let k = 0;
  while (pages.length < total) {
    const text = own[k % own.length]; k++;
    const blocks: Block[] = tier === "Tier_3_Advanced"
      ? [{ type: "starter", text, lines: 6 }]
      : [{ type: "invite", text: "Write, draw or simply talk about it. There is no right way." }, { type: "starter", text, lines: tier === "Tier_1_Mild" ? 9 : 7 }];
    add("own", "My own page", null, blocks);
  }
  const first = resident.firstName;
  return {
    title: first ? `${first}’s ${theme.name} Journal` : `A ${theme.name} Journal`, theme: theme.name, tier, firstName: first, residentId: resident.id, date: options.date || "",
    pages: pages.slice(0, total), selection: chosen.map(e => ({ item_id: e.item.item_id, score: e.score, reason: e.reason, matched: e.matched })), skipped, problems
  };
}

/* ---------- 5. The printable document ---------- */

/** The look of every themed page. The Packet Builder adds it to its own print styles; the standalone document includes it. Pure black on white. */
export const PAGE_CSS = [
  ".cm-page{color:#000;background:#fff;font-family:'Atkinson Hyperlegible','Segoe UI',Arial,sans-serif;line-height:1.3}",
  ".cm-page *{color:#000}",
  ".cm-t1{font-size:16pt}.cm-t2{font-size:20pt}.cm-t3{font-size:26pt}",
  ".cm-h{margin:0 0 .12in;font-size:1.45em;line-height:1.15;font-weight:700}",
  ".cm-invite,.cm-q,.cm-starter{margin:.1in 0;font-size:1em}",
  ".cm-t3 .cm-invite,.cm-t3 .cm-q,.cm-t3 .cm-starter{font-weight:700}",
  ".cm-list{margin:.08in 0 .12in;padding-left:.35in}.cm-list li{margin:.03in 0}",
  ".cm-choices{margin:.06in 0 .08in;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:.1in}",
  ".cm-choices li{border:3pt solid #000;border-radius:.1in;padding:.06in .18in;font-weight:700}",
  ".cm-beside{margin:.05in 0 .16in;font-size:1em;font-style:italic}",
  ".cm-lines{margin-top:.05in}.cm-rule{height:.5in;border-bottom:2pt solid #000}",
  ".cm-grid{border-collapse:collapse;border:3pt solid #000;margin:.05in auto .15in;font-weight:700;letter-spacing:0}",
  ".cm-grid td{text-align:center;vertical-align:middle;padding:0;line-height:1}",
  ".cm-words{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:.05in .3in;font-weight:700}"
].join("\n");

/** Wraps the pages in one standalone HTML document: US Letter, 0.5 in margins, a 0.75 in binding gutter on the left, one sheet per page. */
export function renderDocument(journal: Journal): string {
  const sheets = journal.pages.map(p => `<section class="cm-sheet"><header class="cm-top"><span>${esc(journal.theme)}</span><span>${esc(journal.title)}</span></header>${p.body}<footer class="cm-foot"><span>${esc(journal.title)}</span><b>Page ${p.no} of ${journal.pages.length}</b></footer></section>`).join("");
  const css = PAGE_CSS + `
@page{size:8.5in 11in;margin:0}
html,body{margin:0;background:#fff}
.cm-sheet{box-sizing:border-box;width:8.5in;height:11in;padding:.5in .5in .5in 1.25in;page-break-after:always;break-after:page;position:relative;overflow:hidden;background:#fff}
.cm-top,.cm-foot{position:absolute;left:1.25in;right:.5in;display:flex;justify-content:space-between;font:700 ${TYPE_FLOOR[journal.tier] || 14}pt 'Atkinson Hyperlegible',Arial,sans-serif;color:#000}
.cm-top{top:.4in}.cm-foot{bottom:.4in}
.cm-sheet .cm-page{margin-top:.5in}`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(journal.title)}</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body>${sheets}</body></html>`;
}

/* ---------- 6. From a resident id to a journal ---------- */

/** What went wrong, in the error's own words (an error from another page or frame is still an error), or a stand-in. */
const whyText = (e: unknown, fallback: string): string => e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string" && (e as { message: string }).message ? (e as { message: string }).message : fallback;

export interface GenerateOptions extends ComposeOptions {
  /** Finds a resident by id. Default: the database (CogniLocalDb.getResident). */
  getResident?: (id: string) => Promise<unknown>;
  /** A catalog (list or load result). Default: CogniContentCatalog.loadContentCatalog(). */
  catalog?: unknown;
  /** How many items to choose from the ranking (default 5). */
  limit?: number;
  /** Also keep the finished journal in the database as a saved packet. Default false. */
  save?: boolean;
  /** For tests: stands in for the database's savePacket. */
  savePacket?: (p: { residentId: string; htmlContent: string; selectedTemplates: string[] }) => Promise<{ id: string }>;
  /** For tests: the date as text. */
  today?: () => string;
}
export interface GenerateResult {
  ok: boolean; source: "network" | "fallback" | "given" | "none"; journal: Journal | null; html: string; savedPacketId: string | null; problems: Problem[];
}

/**
 * Makes a themed journal for one saved resident: finds them, reads the catalog, picks what suits them and
 * bundles five pages. Never throws: a missing resident or an unknown level is a result with ok: false and a plain reason,
 * and a catalog that cannot be read is replaced by the built-in one.
 * @param residentId the resident's id in the database (or whatever `options.getResident` understands)
 * @param options catalog, getResident, limit, pages, seed, lint, save
 */
export async function generateThematicJournal(residentId: string, options: GenerateOptions = {}): Promise<GenerateResult> {
  const root = globalThis as unknown as Record<string, unknown>;
  const problems: Problem[] = [];
  const fail = (code: string, message: string, source: GenerateResult["source"] = "none"): GenerateResult => { problems.push({ code, message }); return { ok: false, source, journal: null, html: "", savedPacketId: null, problems }; };
  try {
    const db = root.CogniLocalDb as { getResident?: (id: string) => Promise<unknown>; savePacket?: GenerateOptions["savePacket"] } | undefined;
    const getResident = options.getResident || (db && db.getResident ? (id: string) => db.getResident!(id) : null);
    if (!getResident) return fail("no-database", "The saved residents could not be opened (the database is not loaded).");
    let profile: unknown;
    try { profile = await getResident(String(residentId)); } catch (e) { return fail("resident-unreadable", "The resident could not be read: " + whyText(e, "locked or unavailable.")); }
    if (!profile) return fail("resident-not-found", "No saved resident has that id.");
    const resident = normalizeResident(profile);
    if (!resident.tier) return fail("tier-missing", "This resident has no care level on file, so pages cannot be matched to them.");
    let catalog: unknown = options.catalog, source: GenerateResult["source"] = "given";
    if (catalog === undefined) {
      const cc = root.CogniContentCatalog as { loadContentCatalog?: (o?: unknown) => Promise<{ items: unknown[]; source: "network" | "fallback"; problems: Problem[] }> } | undefined;
      if (cc && cc.loadContentCatalog) { const r = await cc.loadContentCatalog(); catalog = r; source = r.source; r.problems.forEach(p => problems.push(p)); }
      else { catalog = []; source = "none"; problems.push({ code: "no-catalog", message: "The content catalog is not loaded, so only writing pages are offered." }); }
    } else if (catalog && typeof catalog === "object" && !Array.isArray(catalog) && "source" in (catalog as object)) source = (catalog as { source: "network" | "fallback" }).source;
    const cm = (root.CognicopiaClinicalMatrix as { dignity?: { lint?: (t: string) => string[] } } | undefined);
    const lint = options.lint || (cm && cm.dignity && cm.dignity.lint ? cm.dignity.lint : undefined);
    const today = options.today ? options.today() : (() => { try { return new Date().toISOString().slice(0, 10); } catch { return ""; } })();
    const seed = options.seed === undefined ? String(resident.id || residentId) + "|" + today : options.seed;
    const limit = Number.isFinite(Number(options.limit)) && Number(options.limit) >= 1 ? Math.floor(Number(options.limit)) : DEFAULT_LIMIT;
    const ranking = rankContent(profile, catalog, { seed });
    const journal = composeThematicJournal(profile, ranking.entries.slice(0, Math.max(limit, options.pages || PAGE_COUNT) + 10), { pages: options.pages, seed, lint, date: today });
    journal.problems.forEach(p => problems.push(p));
    const html = renderDocument(journal);
    let savedPacketId: string | null = null;
    if (options.save) {
      const save = options.savePacket || (db && db.savePacket ? (p: Parameters<NonNullable<GenerateOptions["savePacket"]>>[0]) => db.savePacket!(p) : null);
      if (!save) problems.push({ code: "not-saved", message: "The journal was made but could not be kept (the database is not loaded)." });
      else {
        try { savedPacketId = (await save({ residentId: String(residentId), htmlContent: html, selectedTemplates: journal.selection.map(s => s.item_id) })).id; }
        catch (e) { problems.push({ code: "not-saved", message: "The journal was made but could not be kept: " + whyText(e, "the database refused it.") }); }
      }
    }
    return { ok: true, source, journal, html, savedPacketId, problems };
  } catch (e) {
    return fail("failed", "The themed journal could not be made: " + whyText(e, "an unexpected problem."));
  }
}
